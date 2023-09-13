/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([
    'N/record',
    './../../CTC_VC_Lib_MainConfiguration',
    './../../CTC_VC2_Constants',
    './../../CTC_VC2_Lib_Utils',
    './../../CTC_VC2_Lib_Record'
], function (ns_record, vc_maincfg, vc2_constant, vc2_util, vc2_record) {
    // define(function (require) {
    var LogTitle = 'VC_BillProcess';

    var Current = {
            BillLines: [],
            OrderData: {},
            OrderLines: [],
            MatchedLines: [],
            BillFile: {},
            VendorData: {},
            VendorCFG: {},
            Charges: [],
            Total: {
                Shipping: 0,
                Tax: 0,
                LineAmount: 0,
                Charges: 0,
                TxnAmount: 0,
                BillAmount: 0,
                BillCharges: 0
            },

            HasErrors: false,
            HasVariance: false,
            VarianceList: [],
            ErrorList: [],
            Error: {},
            AllowBill: false
        },
        BillCreator = vc2_constant.Bill_Creator,
        ChargesCFG = {},
        ChargeType = {
            TAX: 'tax',
            SHIP: 'shipping',
            OTHER: 'other',
            MISC: 'miscCharges',
            ADJ: 'adjustment'
        };

    // Order Lines - lines to be billed from the PO
    // Vendor Data - data from the bill file

    var VC_BillProcess = {
        FlexData: Current,
        preprocessBill: function (option) {
            var logTitle = [LogTitle, 'PreProcessBill'].join('::'),
                returnValue = Current;

            var vendorConfig = option.vendorConfig;

            try {
                if (!vendorConfig) throw 'Missing vendor Config';

                Current.VendorCFG = vendorConfig;
                this.loadVarianceConfig();

                // load the variance config
                this.loadOrderData(option);
                this.loadBillFile(option);

                if (!Current.OrderData) throw ' Missing PO Data';
                if (!Current.OrderLines) throw ' Missing PO Line';
                if (!Current.BillFile) throw ' Missing Bill File Data';
                if (!Current.VendorData) throw ' Missing Vendor Data';

                // if (Current.OrderData.isClosed)
                //     throw Current.OrderData.isFullyBilled ? 'FULLY_BILLED' : 'CLOSED_PO';

                /// MATCH the orderLines ///

                Current.MatchedLines = vc2_record.matchOrderLines({
                    orderLines: Current.OrderLines,
                    vendorLines: Current.VendorData.lines
                });
                vc2_util.log(logTitle, '/// Matched Lines ', Current.MatchedLines);

                /// SETUP the Bill Lines
                (Current.MatchedLines || []).forEach(function (vendorLine) {
                    var BillLine = {
                        Errors: [],
                        Msg: [],
                        Variance: [],
                        OrderLine: {}
                    };
                    try {
                        util.extend(BillLine, {
                            itemId: vendorLine.itemId,
                            item: vendorLine.itemId,
                            itemName: vendorLine.ITEMNO,
                            description: vendorLine.DESCRIPTION,
                            quantity: vendorLine.quantity,
                            rate: vendorLine.rate // use the rate from the bill file
                        });

                        // there are no matched items for this
                        if (!vendorLine.MATCHING || vc2_util.isEmpty(vendorLine.MATCHING))
                            throw 'UNMATCHED_ITEMS';

                        // from the matching lines, try to collect the appliable qty
                        var orderLine = {};
                        (vendorLine.MATCHING || []).forEach(function (matchedLine) {
                            if (vc2_util.isEmpty(orderLine)) util.extend(orderLine, matchedLine);
                            else
                                orderLine.quantity =
                                    (orderLine.quantity || 0) + matchedLine.quantity;

                            orderLine.QTYRCVD =
                                (orderLine.QTYRCVD || 0) + matchedLine.quantityreceived;
                            orderLine.QTYBILLED =
                                (orderLine.QTYBILLED || 0) + matchedLine.quantitybilled;
                        });
                        BillLine.OrderLine = orderLine;

                        // check if the quantitys are enough
                        if (BillLine.rate != orderLine.rate) Helper.setVariance('Price');

                        orderLine.RECEIVABLE = orderLine.quantity - orderLine.QTYRCVD;
                        orderLine.BILLABLE = orderLine.QTYRCVD - orderLine.QTYBILLED;

                        if (orderLine.RECEIVABLE <= 0 && orderLine.BILLABLE <= 0)
                            throw 'ITEMS_ALREADY_BILLED';

                        // if not enough billable
                        if (orderLine.BILLABLE < BillLine.quantity) {
                            // fulfillment is enabled //
                            if (
                                Current.VendorCFG.ENABLE_FULFILLLMENT &&
                                Current.OrderData.isReceivable &&
                                Current.BillFile.IS_RCVBLE
                            ) {
                                if (orderLine.RECEIVABLE < BillLine.quantity)
                                    throw 'INSUFFICIENT_QUANTITY';
                            } else throw 'INSUFFICIENT_QUANTITY';
                        }
                    } catch (error) {
                        var errorCode = vc2_util.extractError(error);
                        Helper.setError({
                            errorCode: errorCode,
                            details: BillLine.itemName
                        });
                        vc2_util.logError(logTitle, error);
                    } finally {
                        Current.BillLines.push(BillLine);
                    }
                    return true;
                });

                this.applyBillLines();
                this.processCharges();
                this.varianceCheck();

                // // calculate the correct amount
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            } finally {
                [
                    'VendorData',
                    'BillLines',
                    'BillFile',
                    'Charges',
                    'OrderData',
                    'OrderLines'
                ].forEach(function (fld) {
                    vc2_util.log(logTitle, '>> CURRENT [' + fld + ']: ', Current[fld]);
                });
                Helper.dumpCurrentData();
            }

            return returnValue;
        },
        processBillLines: function (option) {
            var logTitle = [LogTitle, 'processBillLines'].join('::'),
                returnValue = Current.OrderData;

            try {
                var recVBill = option.record || option.recBill,
                    doProcessVariance = option.processVariance,
                    doIgnoreVariance = option.ignoreVariance,
                    orderData = option.orderData;

                // reset the errors
                Current.HasErrors = false;
                Current.HasVariance = false;
                Current.AllowBill = false;
                Current.ErrorList = [];
                Current.VarianceList = [];
                Current.Error = {};

                Helper.dumpCurrentData();

                // load the bill lines
                var VBillLines = vc2_record.extractRecordLines({
                    record: recVBill,
                    findAll: true,
                    columns: [
                        'item',
                        'rate',
                        'quantity',
                        'amount',
                        'quantityreceived',
                        'quantitybilled',
                        'taxrate',
                        'taxrate1',
                        'taxrate2'
                    ]
                });
                vc2_util.log(logTitle, '/// Vendor Bill Lines: ', VBillLines);

                /// PREPARE THE Data ///
                VBillLines.forEach(function (vbLine) {
                    vbLine.itemId = vbLine.item;
                    return true;
                });

                var MatchedLines = vc2_record.matchOrderLines({
                    orderLines: VBillLines,
                    vendorLines: Current.VendorData.lines
                });

                vc2_util.log(logTitle, '/// Matched Lines: ', MatchedLines);

                var BilledLines = [];

                // Apply the lines
                MatchedLines.forEach(function (vendorLine) {
                    try {
                        // there are no matched items for this
                        if (!vendorLine.MATCHING || vc2_util.isEmpty(vendorLine.MATCHING))
                            throw 'UNMATCHED_ITEMS';

                        // from the matching lines, try to collect the appliable qty
                        var orderLine = {};
                        vendorLine.MATCHING.forEach(function (matchedLine) {
                            if (matchedLine.rate != vendorLine.rate) {
                                if (doProcessVariance) {
                                    // set the rate to the bill rate
                                    vc2_record.updateLine({
                                        record: recVBill,
                                        lineData: {
                                            line: matchedLine.line,
                                            rate: vendorLine.rate,
                                            quantity: matchedLine.APPLIEDQTY
                                        }
                                    });
                                } else if (doIgnoreVariance) {
                                    // set the rate to the PO Rate
                                    vc2_record.updateLine({
                                        record: recVBill,
                                        lineData: {
                                            line: matchedLine.line,
                                            rate: matchedLine.rate,
                                            quantity: matchedLine.APPLIEDQTY
                                        }
                                    });
                                }
                            }

                            // add this to the Billed Lines
                            BilledLines.push(matchedLine);
                        });
                    } catch (error) {
                        var errorCode = vc2_util.extractError(error);
                        Helper.setError({ errorCode: errorCode, details: vendorLine });
                        vc2_util.logError(logTitle, error);
                    }
                    return true;
                });

                vc2_util.log(logTitle, '/// Billed Lines: ', BilledLines);

                // try to remove unbilled lines
                var lineCount = recVBill.getLineCount({ sublistId: 'item' });
                for (var line = lineCount - 1; line >= 0; line--) {
                    // check if this line is billed
                    var lineValues = vc2_record.extractLineValues({
                        record: recVBill,
                        line: line,
                        columns: ['item', 'rate', 'amount', 'quantity']
                    });
                    lineValues.isUnbilled = true;
                    BilledLines.forEach(function (billedLine) {
                        if (billedLine.line == line) lineValues.isUnbilled = false;
                    });

                    vc2_util.log(logTitle, '... is unbilled? ', lineValues);

                    if (lineValues.isUnbilled || !lineValues.quantity) {
                        try {
                            recVBill.removeLine({ sublistId: 'item', line: line });
                            vc2_util.log(logTitle, '...... removed line:  ', lineValues);
                        } catch (remove_err) {
                            vc2_util.logError(logTitle, remove_err);
                        }
                    }
                }

                vc2_util.log(logTitle, '... Current.Charges: ', Current.Charges);

                // Process the Charges
                Current.Charges.forEach(function (chargeData) {
                    var chargeAmount = doProcessVariance
                        ? chargeData.rate || chargeData.amount
                        : doIgnoreVariance
                        ? chargeData.chargeAmount
                        : chargeData.rate || chargeData.amount;

                    if (!chargeAmount) return;
                    if (
                        !chargeData.enabled ||
                        vc2_util.inArray(chargeData.applied, ['F', 'f', false])
                    )
                        return;
                    chargeData.rate = chargeAmount;
                    chargeData.amount = chargeAmount;
                    chargeData.quantity = 1;

                    vc2_util.log(logTitle, '... add charge: ', chargeData);
                    var newLine;
                    try {
                        newLine = vc2_record.addLine({
                            record: recVBill,
                            lineData: vc2_util.extend(
                                vc2_util.extractValues({
                                    source: chargeData,
                                    params: ['item', 'description', 'rate', 'quantity']
                                }),
                                {
                                    customer: orderData.entity
                                }
                            )
                        });
                    } catch (line_err) {
                        Helper.setError({
                            errorCode: 'UNABLE_TO_ADD_VARIANCE_LINE',
                            details: chargeData.name
                        });
                    }
                });
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            } finally {
                Helper.dumpCurrentData();
            }

            return returnValue;
        },
        loadOrderData: function (option) {
            var logTitle = [LogTitle, 'loadOrderData'].join('::'),
                returnValue = Current.OrderData;

            try {
                var recOrder = option.recOrder || option.record,
                    orderId = option.orderId || option.poId || option.internalId;

                if (!recOrder) {
                    if (!orderId) throw 'Missing PO Id';
                    recOrder = vc2_record.load({
                        type: 'purchaseorder',
                        id: orderId,
                        isDynamic: false
                    });
                }
                if (!recOrder) throw 'Missing PO record';

                // Get PO Data
                Current.OrderData = vc2_record.extractValues({
                    record: recOrder,
                    fields: ['tranid', 'entity', 'taxtotal', 'tax2total', 'status', 'statusRef']
                });

                util.extend(Current.OrderData, {
                    isReceivable: vc2_util.inArray(Current.OrderData.statusRef, [
                        'pendingReceipt',
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isPartiallyBilled: vc2_util.inArray(Current.OrderData.statusRef, [
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isBillable: vc2_util.inArray(Current.OrderData.statusRef, [
                        'pendingBilling',
                        'pendingBillPartReceived'
                    ]),
                    isClosed: vc2_util.inArray(Current.OrderData.statusRef, [
                        'fullyBilled',
                        'closed'
                    ]),
                    isFullyBilled: vc2_util.inArray(Current.OrderData.statusRef, ['fullyBilled'])
                });

                /// Get the Order Lines ///
                Current.OrderLines = vc2_record.extractRecordLines({
                    record: recOrder,
                    findAll: true,
                    columns: [
                        'item',
                        'rate',
                        'quantity',
                        'amount',
                        'quantityreceived',
                        'quantitybilled',
                        'taxrate',
                        'taxrate1',
                        'taxrate2'
                    ]
                });

                /// PREPARE THE Data ///
                Current.OrderLines.forEach(function (orderLine) {
                    orderLine.itemId = orderLine.item;
                    return true;
                });
                vc2_util.log(logTitle, '/// PREPARE order lines', Current.OrderLines);
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        loadBillFile: function (option) {
            var logTitle = [LogTitle, 'loadBillFile'].join('::'),
                returnValue = Current.BillFile;

            try {
                var recBillFile = option.recBillFile || option.record,
                    billFileId = option.billFileId || option.internalId || option.id;

                if (!recBillFile) {
                    if (!billFileId) throw 'Missing Bill File Id';
                    recBillFile = vc2_record.load({
                        type: vc2_constant.RECORD.BILLFILE.ID,
                        id: billFileId,
                        isDynamic: false
                    });
                }
                if (!recBillFile) throw 'Missing bill file record';

                // bill file data
                Current.BillFile = vc2_record.extractValues({
                    record: recBillFile,
                    fields: vc2_constant.RECORD.BILLFILE.FIELD
                });
                Current.VendorData = vc2_util.safeParse(Current.BillFile.JSON);

                // prep the vendor lines
                Current.VendorData.lines.forEach(function (vendorLine) {
                    try {
                        ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                            if (vendorLine.hasOwnProperty(field))
                                vendorLine[field] = vc2_util.forceFloat(vendorLine[field]);
                            return true;
                        });
                        vendorLine.QUANTITY = vc2_util.forceInt(vendorLine.QUANTITY);

                        if (!vendorLine.NSITEM) throw 'UNMATCHED_ITEMS';

                        util.extend(vendorLine, {
                            quantity: vendorLine.QUANTITY,
                            itemId: (vendorLine.NSITEM || '').toString(),
                            rate: vendorLine.BILLRATE || vendorLine.PRICE
                        });
                    } catch (vendorLine_error) {
                        vc2_util.logError(logTitle, vendorLine_error);
                        Helper.setError({
                            code: vc2_util.extractError(vendorLine_error),
                            details: vendorLine.ITEMNO
                        });
                    }

                    return true;
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            } finally {
            }

            return returnValue;
        },
        loadVarianceConfig: function () {
            var logTitle = [LogTitle, 'loadVarianceConfig'].join('::'),
                returnValue = ChargesCFG;

            try {
                if (!Current.MainCFG) Current.MainCFG = Helper.loadBillingConfig();

                ChargesCFG = {
                    tax: {
                        name: 'Tax',
                        description: 'VC | Tax Charges',
                        item: Current.MainCFG.taxItem,
                        applied: Current.MainCFG.applyTax ? 'T' : 'F',
                        enabled: Current.MainCFG.applyTax
                    },
                    shipping: {
                        name: 'Shipping',
                        description: 'VC | Shipping Charges',
                        item: Current.MainCFG.shipItem,
                        applied: Current.MainCFG.applyShip ? 'T' : 'F',
                        enabled: Current.MainCFG.applyShip
                    },
                    other: {
                        name: 'Other Charges',
                        description: 'VC | Other Charges',
                        item: Current.MainCFG.otherItem,
                        applied: Current.MainCFG.applyOther ? 'T' : 'F',
                        enabled: Current.MainCFG.applyOther
                    },
                    miscCharges: {
                        name: 'Misc Charges',
                        description: 'VC | Misc Charges',
                        item: Current.MainCFG.otherItem,
                        applied: Current.MainCFG.applyOther ? 'T' : 'F',
                        enabled: Current.MainCFG.applyOther
                    }
                };
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        applyBillLines: function (option) {
            var logTitle = [LogTitle, 'applyBillLines'].join('::');

            try {
                Current.BillLines.forEach(function (billLine) {
                    billLine.amount = billLine.quantity * billLine.rate;
                    billLine.taxAmount = Helper.calculateLineTax(
                        vc2_util.extend(billLine.OrderLine, { amount: billLine.amount })
                    );
                });
                this.calcuateTotals();
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
        },
        calcuateTotals: function (option) {
            var logTitle = [LogTitle, 'calcuateTotals'].join('::');

            try {
                var Total = {
                        Shipping: 0,
                        Tax: 0,
                        LineAmount: 0,
                        Charges: 0,
                        TxnAmount: 0
                    },
                    VendorData = Current.VendorData;

                // reset
                // CURRENT.Total = Total;

                Current.BillLines.forEach(function (billLine) {
                    var orderLine = billLine.OrderLine;
                    if (
                        orderLine.item_text.match(/shipping|freight/gi) ||
                        (orderLine.description && orderLine.description.match(/shipping|freight/gi))
                    ) {
                        Total.Shipping += orderLine.amount;
                    }

                    if (billLine.taxAmount) Total.Tax += billLine.taxAmount;
                    Total.LineAmount += billLine.amount;
                });

                Current.Charges.forEach(function (charge) {
                    if (vc2_util.inArray(charge.applied, ['T', 't', true]))
                        Total.Charges += charge.amount || 0;
                });
                Total.TxnAmount = Total.Shipping + Total.Tax + Total.LineAmount + Total.Charges;

                util.extend(Current.Total, Total);
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
        },
        processCharges: function () {
            var logTitle = [LogTitle, 'processCharges'].join('::');

            try {
                // calculate the totals first
                this.calcuateTotals();

                var ChargeLines = [];

                for (var chargeType in ChargesCFG) {
                    var chargeParam = ChargesCFG[chargeType],
                        chargeAmount = Current.VendorData.charges[chargeType] || 0,
                        varianceLine = vc2_util.findMatching({
                            // dataSet: Current.VendorData.varianceLines || [],
                            dataSet: Current.VendorData.variances || [],
                            filter: { type: chargeType }
                        });

                    var chargeLine = vc2_util.extend(
                        { type: chargeType, chargeAmount: chargeAmount },
                        chargeParam
                    );

                    // delete any pre-existing item on the matched varianceLine
                    if (vc2_util.isEmpty(varianceLine)) {
                        if (varianceLine.item) delete varianceLine.item;

                        if (varianceLine.rate != varianceLine.amount) {
                            varianceLine.rate = varianceLine.rate || varianceLine.amount;
                            varianceLine.amount = varianceLine.rate || varianceLine.amount;
                        }
                    }

                    switch (chargeType) {
                        case ChargeType.TAX:
                            util.extend(
                                chargeLine,
                                varianceLine || {
                                    rate: vc2_util.roundOff(chargeAmount - Current.Total.Tax),
                                    amount: vc2_util.roundOff(chargeAmount - Current.Total.Tax)
                                }
                            );

                            ChargeLines.push(chargeLine);
                            break;
                        case ChargeType.SHIP:
                            util.extend(
                                chargeLine,
                                varianceLine || {
                                    rate: vc2_util.roundOff(chargeAmount - Current.Total.Shipping),
                                    amount: vc2_util.roundOff(chargeAmount - Current.Total.Shipping)
                                }
                            );

                            ChargeLines.push(chargeLine);
                            break;
                        case ChargeType.OTHER:
                            util.extend(
                                chargeLine,
                                varianceLine || { rate: chargeAmount, amount: chargeAmount }
                            );

                            ChargeLines.push(chargeLine);
                            break;
                        case ChargeType.MISC:
                            /// MISC is an array
                            (chargeAmount || []).forEach(function (miscCharge) {
                                // look for any existing varianceLine
                                var matchingMiscLine = vc2_util.findMatching({
                                    dataSet: Current.VendorData.varianceLines,
                                    filter: {
                                        type: chargeType,
                                        description: miscCharge.description
                                    }
                                });
                                ChargeLines.push(util.extend(chargeLine, matchingMiscLine));
                            });

                            break;
                    }
                }
                Current.Charges = ChargeLines;

                this.calcuateTotals();
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
        },
        varianceCheck: function (option) {
            var logTitle = [LogTitle, 'varianceCheck'].join('::');
            try {
                vc2_util.log(logTitle, '... variance check');
                // calculate totals first
                this.calcuateTotals();

                var VendorData = Current.VendorData,
                    Total = Current.Total;

                Total.BillAmount = VendorData.total;
                Total.BillCharges =
                    (VendorData.charges.tax || 0) +
                    (VendorData.charges.shipping || 0) +
                    VendorData.charges.other;

                Current.Charges.forEach(function (charge) {
                    if (charge.rate || charge.amount) Helper.setVariance(charge.name);
                });

                Total.Variance = vc2_util.roundOff(Total.BillAmount - Total.TxnAmount);
                vc2_util.log(logTitle, '... Variance: ', Total.Variance);

                if (Current.HasVariance)
                    Current.HasVariance = Total.BillCharges > 0 || Math.abs(Total.Variance) > 0;

                vc2_util.log(logTitle, '... HasVariance: ', Current.HasVariance);

                if (Current.HasVariance) {
                    if (Current.MainCFG.allowedThreshold) {
                        if (
                            Total.BillCharges > Current.MainCFG.allowedThreshold ||
                            Math.abs(Total.Variance) > Current.MainCFG.allowedThreshold
                        ) {
                            Helper.setVariance('EXCEED_THRESHOLD');
                        } else {
                            Current.AllowBill = true;
                        }
                    }

                    if (Math.abs(Total.Variance) && Current.MainCFG.allowAdjustLine) {
                        var otherCharge = vc2_util.clone(ChargesCFG.other);
                        util.extend(otherCharge, {
                            rate: Total.Variance,
                            amount: Total.Variance,
                            description: 'VC | Adjustment'
                        });

                        // add to Charges List
                        Current.Charges.push(otherCharge);
                    }
                } else {
                    // no variance detected, then allow bill
                    Current.AllowBill = true;
                }

                /**
                    VendorAmountTotal = ?LineTotal? + (Tax + Shipping + Other)                
                    BillAmount = LineTotal + (Tax + Shipping)
                */
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
        },
        reportError: function (option) {
            var logTitle = [LogTitle, 'setError'].join(': ');
            if (!Current.HasErrors || vc2_util.isEmpty(Current.Error)) return false;

            var errorObj = {};

            for (var errorCode in Current.Error) {
                util.extend(
                    errorObj,
                    vc2_constant.Bill_Creator.Code[errorCode] || {
                        msg: errorCode,
                        status: vc2_constant.Bill_Creator.Status.ERROR,
                        logstatus: vc2_constant.LIST.VC_LOG_STATUS.ERROR
                    }
                );
                vc2_util.log(logTitle, '.. error: ', {
                    errorObj: errorObj,
                    errorCode: errorCode,
                    error: vc2_constant.Bill_Creator.Code[errorCode],
                    status: vc2_constant.LIST.VC_LOG_STATUS.ERROR,
                    details: Current.Error[errorCode]
                });

                if (!vc2_util.isEmpty(Current.Error[errorCode])) {
                    errorObj.details = util.isArray(Current.Error[errorCode])
                        ? Current.Error[errorCode].join(', ')
                        : Current.Error[errorCode];
                }
            }

            return errorObj;
        }
    };

    var Helper = {
        dumpCurrentData: function (option) {
            var paramsToShow = vc2_util.extractValues({
                source: Current,
                params: [
                    'HasErrors',
                    'HasVariance',
                    'VarianceList',
                    'ErrorList',
                    'Error',
                    'AllowBill',
                    'Total',
                    'MainCFG'
                ]
            });

            vc2_util.log(logTitle, '>> CURRENT (params) :', paramsToShow);
        },
        setError: function (option) {
            var logTitle = [LogTitle, 'setError'].join(': ');

            var errorCode = option.code || option.errorCode,
                errorDetails = option.details;

            vc2_util.log(logTitle, '... option: ', option);
            vc2_util.log(logTitle, '... option2: ', [errorCode, errorDetails]);

            if (!Current.Error[errorCode]) Current.Error[errorCode] = [];
            if (!vc2_util.isEmpty(errorDetails)) Current.Error[errorCode].push(errorDetails);

            Current.ErrorList.push(errorCode);
            Current.HasErrors = true;
            Current.AllowBill = false;
            return true;
        },
        setVariance: function (variance) {
            if (!vc2_util.inArray(variance, Current.VarianceList))
                Current.VarianceList.push(variance);
            Current.HasVariance = true;
        },
        loadBillingConfig: function () {
            var mainConfig = vc_maincfg.getMainConfiguration();
            if (!mainConfig) {
                log.error('No Configuration available');
                throw new Error('No Configuration available');
            }
            return {
                applyTax: mainConfig.isVarianceOnTax,
                taxItem: mainConfig.defaultTaxItem,
                taxItem2: mainConfig.defaultTaxItem2,
                applyShip: mainConfig.isVarianceOnShipping,
                shipItem: mainConfig.defaultShipItem,
                applyOther: mainConfig.isVarianceOnOther,
                otherItem: mainConfig.defaultOtherItem,
                allowedThreshold: vc2_util.parseFloat(
                    mainConfig.allowedVarianceAmountThreshold || '0'
                ),
                allowAdjustLine: mainConfig.allowAdjustLine
            };
        },
        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return taxAmount ? vc2_util.roundOff(taxAmount) : 0;
        }
    };

    return VC_BillProcess;
});
