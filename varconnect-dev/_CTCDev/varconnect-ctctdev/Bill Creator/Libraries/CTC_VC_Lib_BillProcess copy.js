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
    './../../CTC_VC2_Constants',
    './../../CTC_VC2_Lib_Utils',
    './../../CTC_VC2_Lib_Record',
    './../../Services/ctc_svclib_configlib'
], function (vc2_constant, vc2_util, vc2_record, vcs_configLib) {
    // define(function (require) {
    var LogTitle = 'VC_BillProcess';

    var Current = {
            BillLines: [],

            PO_REC: null,
            BILL_REC: null,

            PurchOrderData: {},
            PurchOrderLines: [],

            VendBillData: {},
            VendBillFiles: {},

            MatchedLines: [],
            BillFile: {},
            VendorData: {},

            BillCFG: {},
            OrderCFG: {},

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
            AllowVariance: false,
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

    /**
     * Bills processing
     *
     *   Parameters:
     *      - PO
     *      - bill config (can be extracted)
     *      - vendor config (can be extracted)
     *
     * PreProcessing
     *  - Load the Bill File record
     *  - Load the JSON data and lines
     *  - Load the PO record
     *  - Load the PO Lines, grouped with same item+rate
     *  - Validate the Bill File
     *  - Validate the Variance Configs
     *
     *  - Load the Biill, if billable
     *  - calculate only if billable
     *  - hide the calculated section, if not billable
     *
     *
     * Actions
     *  * Process Bill
     *  * Ignore Variance
     *  * Include Variance
     *
     *  - Match Vendor lines to PO Lines
     *  -
     */

    var VC_BillProcess = {
        FlexData: Current,
        preprocessBill: function (option) {
            var logTitle = [LogTitle, 'PreProcessBill'].join('::'),
                returnValue = Current;

            try {
                var recOrder = option.recOrder || option.record || {},
                    orderId = option.orderId || option.poId || option.internalId || recOrder.id;

                // load the configs
                Current.BillCFG =
                    option.billConfig || vcs_configLib.billVendorConfig({ poId: orderId });
                // if (!Current.BillCFG) throw 'Missing vendor Config';

                Current.OrderCFG =
                    option.orderConfig || vcs_configLib.orderVendorConfig({ poId: orderId });
                // if (!Current.OrderCFG) throw 'Missing vendor Config';

                Current.PO_REC = recOrder;

                this.loadVarianceConfig();
                this.loadPOData(option);

                if (!Current.PurchOrderData) throw ' Missing PO Data';
                if (!Current.PurchOrderLines) throw ' Missing PO Line';

                this.loadBillFile(option);
                if (!Current.BillFile) throw ' Missing Bill File Data';
                if (!Current.VendorData) throw ' Missing Vendor Data';
                if (!Current.VendorData.invoice) throw ' Missing Invoice No';
                if (!Current.VendorData.lines || !Current.VendorData.lines.length)
                    throw ' Missing Vendor Data Lines';

                vc2_util.log(logTitle, '// bill file data: ', Current.VendorData);

                // check for the charges
                if (vc2_util.isEmpty(Current.VendorData.charges))
                    Helper.setError({ code: 'Missing Vendor Data charges' });

                /// MATCH the orderLines ///
                Current.MatchedLines = [];

                if (!vc2_util.isEmpty(Current.PurchOrderLines)) {
                    Current.MatchedLines =
                        vc2_record.matchOrderLines({
                            orderLines: Current.PurchOrderLines,
                            includeZeroQtyLines: true,
                            vendorLines: Current.VendorData.lines,

                            billConfig: Current.BillCFG,
                            orderConfig: Current.OrderCFG,
                            mainConfig: Current.MainCFG
                        }) || [];
                }

                vc2_util.log(logTitle, '## Matched Lines ', Current.MatchedLines.length);

                /// SETUP the Bill Lines
                Current.VendorData.lines.forEach(function (vendorLine, idx) {
                    var billLine = {
                        Errors: [],
                        Msg: [],
                        Variance: [],
                        OrderLine: {},
                        VarianceAmt: 0
                    };

                    util.extend(billLine, {
                        itemId: vendorLine.itemId,
                        item: vendorLine.itemId,
                        itemName: vendorLine.ITEMNO,
                        lineIdx: vendorLine.LINEIDX,
                        description: vendorLine.DESCRIPTION,
                        quantity: vendorLine.quantity,
                        rate: vendorLine.rate // use the rate from the bill file
                    });

                    vc2_util.log(logTitle, '.. matched line? ', {
                        vendorLine: vendorLine
                    });

                    try {
                        // there are no matched items for this
                        if (!vendorLine.MATCHING || vc2_util.isEmpty(vendorLine.MATCHING))
                            throw 'UNMATCHED_ITEMS';

                        // from the matching lines, try to collect the appliable qty
                        var orderLine = {};
                        vendorLine.MATCHING.forEach(function (matchedLine) {
                            if (vc2_util.isEmpty(orderLine)) util.extend(orderLine, matchedLine);
                            else
                                orderLine.quantity =
                                    (orderLine.quantity || 0) + matchedLine.quantity;

                            orderLine.QTYRCVD =
                                (orderLine.QTYRCVD || 0) + matchedLine.quantityreceived;
                            orderLine.QTYBILLED =
                                (orderLine.QTYBILLED || 0) + matchedLine.quantitybilled;
                        });
                        billLine.OrderLine = orderLine;

                        // check if the quantitys are enough
                        if (billLine.rate != orderLine.rate) {
                            if (!Current.MainCFG.autoprocPriceVar) {
                                billLine.Variance.push('Price');
                                Helper.setVariance('Price');
                            }

                            billLine.VarianceAmt =
                                Math.abs(billLine.rate - orderLine.rate) * billLine.quantity;
                        }

                        orderLine.RECEIVABLE = orderLine.quantity - orderLine.QTYRCVD;
                        orderLine.BILLABLE = orderLine.QTYRCVD - orderLine.QTYBILLED;

                        if (orderLine.RECEIVABLE <= 0 && orderLine.BILLABLE <= 0)
                            throw 'ITEMS_ALREADY_BILLED';

                        // if not enough billable
                        if (orderLine.BILLABLE < billLine.quantity) {
                            // fulfillment is enabled //
                            if (
                                Current.BillCFG.enableFulfillment &&
                                Current.PurchOrderData.isReceivable &&
                                Current.BillFile.IS_RCVBLE
                            ) {
                                if (orderLine.RECEIVABLE < billLine.quantity)
                                    throw 'INSUFFICIENT_QUANTITY';
                            } else if (orderLine.BILLABLE > 0) throw 'INSUFFICIENT_QUANTITY';
                            else throw 'NOT_BILLABLE';
                        }
                    } catch (error) {
                        var errorCode = vc2_util.extractError(error);
                        Helper.setError({
                            errorCode: errorCode,
                            details: billLine.itemName
                        });
                        billLine.Errors.push(errorCode);
                        vc2_util.logError(logTitle, error);
                    } finally {
                        Current.BillLines.push(billLine);
                        vc2_util.log(logTitle, '## Bill Line [' + idx + '] ', billLine);
                    }

                    return true;
                });

                // this.applyBillLines();
                // this.processCharges();
                // this.varianceCheck();

                // // EVAL if AllowBill
                // if (
                //     Current.HasErrors ||
                //     !vc2_util.isEmpty(Current.ErrorList) ||
                //     !vc2_util.isEmpty(Current.Error)
                // ) {
                //     Current.AllowBill = false;
                // } else if (Current.HasVariance) {
                //     if (!Current.AllowBill) Current.AllowBill = Current.AllowVariance;
                // } else Current.AllowBill = true;

                // Helper.dumpCurrentData();

                // // calculate the correct amount
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);

                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        processBillLines: function (option) {
            var logTitle = [LogTitle, 'processBillLines'].join('::'),
                returnValue = Current.PurchOrderData;

            try {
                var recVBill = option.record || option.recBill,
                    doProcessVariance = option.processVariance,
                    doIgnoreVariance = option.ignoreVariance,
                    orderData = option.orderData;

                vc2_util.log(logTitle, '.. doProcessVariance: ', doProcessVariance);
                vc2_util.log(logTitle, '.. doIgnoreVariance: ', doIgnoreVariance);

                // load the bill lines
                var tmpBillLinesArr = vc2_record.extractRecordLines({
                        record: recVBill,
                        findAll: true,
                        columns: [
                            'item',
                            'rate',
                            'quantity',
                            'amount',
                            'quantityreceived',
                            'quantitybilled',
                            'inventorydetailreq',
                            'isserial',
                            'taxrate',
                            'taxrate1',
                            'taxrate2'
                        ]
                    }),
                    tmpBillLinesColl = {};
                for (var i = 0, j = tmpBillLinesArr.length; i < j; i++) {
                    var tmpOrderLine = vc2_util.clone(tmpBillLinesArr[i]);
                    tmpOrderLine.itemId = tmpOrderLine.item;

                    var lineIdx = [
                        tmpOrderLine.item,
                        tmpOrderLine.item_text,
                        tmpOrderLine.rate
                    ].join('|');

                    if (tmpBillLinesColl[lineIdx]) {
                        tmpBillLinesColl[lineIdx].quantity += tmpOrderLine.quantity;
                        tmpBillLinesColl[lineIdx].quantityreceived += tmpOrderLine.quantityreceived;
                        tmpBillLinesColl[lineIdx].quantitybilled += tmpOrderLine.quantitybilled;
                    } else {
                        tmpBillLinesColl[lineIdx] = tmpOrderLine;
                    }

                    vc2_util.log(logTitle, '/// order line: ', [
                        lineIdx,
                        tmpOrderLine,
                        tmpBillLinesColl[lineIdx]
                    ]);
                }
                vc2_util.log(logTitle, '// orderline coll: ', tmpBillLinesColl);

                var VBillLines = [];
                for (var lineIdx in tmpBillLinesColl) {
                    VBillLines.push(tmpBillLinesColl[lineIdx]);
                }

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
                            vc2_util.log(logTitle, '.. lines: ', {
                                vendor: vendorLine,
                                order: matchedLine
                            });

                            recVBill.selectLine({ sublistId: 'item', line: matchedLine.line });
                            var updateLine = {
                                line: matchedLine.line,
                                quantity: matchedLine.APPLIEDQTY
                            };

                            // fix the rate
                            if (matchedLine.rate != vendorLine.rate) {
                                // var updateLine = { line: matchedLine.linex };

                                if (
                                    Current.AllowVariance ||
                                    doProcessVariance ||
                                    Current.MainCFG.autoprocPriceVar
                                ) {
                                    updateLine.rate = vendorLine.rate;
                                } else if (doIgnoreVariance) {
                                    updateLine.rate = matchedLine.rate;
                                }
                            }

                            //set the inventoryreq
                            if (
                                matchedLine.inventorydetailreq == 'T' ||
                                matchedLine.isserial == 'T'
                            ) {
                                if (
                                    !vendorLine.SERIAL ||
                                    !vendorLine.SERIAL.length ||
                                    vendorLine.SERIAL.length < matchedLine.APPLIEDQTY
                                ) {
                                    throw (
                                        'Missing or incomplete serials for item - ' +
                                        vendorLine.ITEMNO +
                                        '. The total inventory detail quantity must be ' +
                                        matchedLine.APPLIEDQTY +
                                        '. '
                                    );
                                }

                                vc2_util.log(logTitle, '.... total serials: ', vendorLine.SERIAL);

                                var subrecInvDetail = recVBill.getCurrentSublistSubrecord({
                                    sublistId: 'item',
                                    fieldId: 'inventorydetail'
                                });

                                var lineInvCnt = subrecInvDetail.getLineCount({
                                        sublistId: 'inventoryassignment'
                                    }),
                                    hasLineChanges = false;

                                vc2_util.log(logTitle, '.... serials line count: ', lineInvCnt);

                                // line it up backwards to remove the unnecessary lines
                                for (var line = lineInvCnt - 1; line >= 0; line--) {
                                    var lineInvDet = {
                                        line: line,
                                        issued: subrecInvDetail.getSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'issueinventorynumber',
                                            line: line
                                        }),
                                        receipt: subrecInvDetail.getSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'receiptinventorynumber',
                                            line: line
                                        })
                                    };

                                    if (
                                        (lineInvDet.issued &&
                                            !vc2_util.inArray(
                                                lineInvDet.issued,
                                                vendorLine.SERIAL
                                            )) ||
                                        (lineInvDet.receipt &&
                                            !vc2_util.inArray(
                                                lineInvDet.receipt,
                                                vendorLine.SERIAL
                                            ))
                                    ) {
                                        vc2_util.log(
                                            logTitle,
                                            '....... removing ! serials: ',
                                            lineInvDet
                                        );
                                        hasLineChanges = true;

                                        subrecInvDetail.selectLine({
                                            sublistId: 'inventoryassignment',
                                            line: line
                                        });

                                        // remove the line
                                        subrecInvDetail.removeLine({
                                            sublistId: 'inventoryassignment',
                                            line: line
                                        });
                                    }
                                }

                                if (hasLineChanges) {
                                    subrecInvDetail.commitLine({
                                        sublistId: 'inventoryassignment'
                                    });
                                    // recVBill.commitLine({ sublistId: 'item' });
                                }
                                lineInvCnt = subrecInvDetail.getLineCount({
                                    sublistId: 'inventoryassignment'
                                });
                                vc2_util.log(logTitle, '.... serials line count (2): ', lineInvCnt);
                            }

                            for (colField in updateLine) {
                                recVBill.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: colField,
                                    value: updateLine[colField]
                                });
                            }
                            recVBill.commitLine({ sublistId: 'item' });

                            // add this to the Billed Lines
                            BilledLines.push(matchedLine);
                        });
                    } catch (error) {
                        var errorCode = vc2_util.extractError(error);
                        Helper.setError({ errorCode: errorCode, details: vendorLine.itemName });
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
                        columns: [
                            'item',
                            'rate',
                            'amount',
                            'quantity',
                            'inventorydetailreq',
                            'isserial'
                        ]
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
                    } else if (lineValues.inventorydetailreq == 'T' || lineValues.isserial == 'T') {
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
                    chargeAmount = vc2_util.parseFloat(chargeAmount);

                    if (!chargeAmount) return;
                    if (
                        !chargeData.enabled ||
                        vc2_util.inArray(chargeData.applied, ['F', 'f', false])
                    )
                        return;
                    chargeData.rate = chargeAmount;
                    chargeData.amount = chargeAmount;
                    chargeData.quantity = 1;

                    vc2_util.log(logTitle, '... add charge: ', {
                        chargeData: chargeData,
                        chargeAmount: chargeAmount,
                        doIgnoreVariance: doIgnoreVariance,
                        doProcessVariance: doProcessVariance
                    });
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
            }

            return returnValue;
        },
        loadPOData: function (option) {
            var logTitle = [LogTitle, 'loadPOData'].join('::'),
                returnValue = Current.PurchOrderData;

            try {
                var recOrder = option.recOrder || option.record,
                    orderId = option.orderId || option.poId || option.internalId;

                if (!recOrder) {
                    if (!orderId) throw 'MISSING_PO';
                    recOrder = vc2_record.load({
                        type: 'purchaseorder',
                        id: orderId,
                        isDynamic: false
                    });
                }
                if (!recOrder) throw 'MISSING_PO';

                // Get PO Data
                Current.PurchOrderData = vc2_record.extractValues({
                    record: recOrder,
                    fields: ['tranid', 'entity', 'taxtotal', 'tax2total', 'status', 'statusRef']
                });

                util.extend(Current.PurchOrderData, {
                    id: orderId,
                    isReceivable: vc2_util.inArray(Current.PurchOrderData.statusRef, [
                        'pendingReceipt',
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isPartiallyBilled: vc2_util.inArray(Current.PurchOrderData.statusRef, [
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isBillable: vc2_util.inArray(Current.PurchOrderData.statusRef, [
                        'pendingBilling',
                        'pendingBillPartReceived'
                    ]),
                    isClosed: vc2_util.inArray(Current.PurchOrderData.statusRef, [
                        'fullyBilled',
                        'closed'
                    ]),
                    isFullyBilled: vc2_util.inArray(Current.PurchOrderData.statusRef, [
                        'fullyBilled'
                    ])
                });

                vc2_util.log(logTitle, '## PO Data:  ', Current.PurchOrderData);

                if (Current.PurchOrderData.isClosed) {
                    Helper.setError({
                        code: Current.PurchOrderData.isFullyBilled ? 'FULLY_BILLED' : 'CLOSED_PO'
                    });
                }

                /// Get the Order Lines ///
                var tmpOrderLinesArr = vc2_record.extractRecordLines({
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
                        ],
                        orderConfig: Current.OrderCFG,
                        mainConfig: Current.MainCFG
                    }),
                    tmpOrderLinesColl = {};

                /// PREPARE THE Data ///
                Current.PurchOrderLines = [];

                for (var i = 0, j = tmpOrderLinesArr.length; i < j; i++) {
                    var tmpOrderLine = vc2_util.clone(tmpOrderLinesArr[i]);
                    tmpOrderLine.itemId = tmpOrderLine.item;

                    var lineIdx = [
                        tmpOrderLine.item,
                        tmpOrderLine.item_text,
                        tmpOrderLine.rate
                    ].join('|');

                    if (tmpOrderLinesColl[lineIdx]) {
                        tmpOrderLinesColl[lineIdx].quantity += tmpOrderLine.quantity;
                        tmpOrderLinesColl[lineIdx].quantityreceived +=
                            tmpOrderLine.quantityreceived;
                        tmpOrderLinesColl[lineIdx].quantitybilled += tmpOrderLine.quantitybilled;
                    } else {
                        tmpOrderLinesColl[lineIdx] = tmpOrderLine;
                    }
                }

                for (var lineIdx in tmpOrderLinesColl) {
                    Current.PurchOrderLines.push(tmpOrderLinesColl[lineIdx]);
                }

                vc2_util.log(logTitle, '## Order Lines:  ', Current.PurchOrderLines);

                // try to create the bill
                try {
                    Current.BILL_REC = vc2_record.transform({
                        fromType: 'purchaseorder',
                        fromId: orderId,
                        toType: 'vendorbill',
                        isDynamic: true
                    });
                } catch (billcreate_error) {
                    vc2_util.logError(logTitle, billcreate_error);
                }
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);

                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        resetValues: function (option) {
            // RESET! //
            util.extend(Current, {
                HasErrors: false,
                HasVariance: false,
                VarianceList: [],
                ErrorList: [],
                Error: {},
                AllowVariance: false,
                AllowBill: false
            });
            return true;
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

                // remove QTY:0 vendor lines
                var arrNonZeroLines = [];

                // prep the vendor lines
                Current.VendorData.lines.forEach(function (vendorLine, lineIdx) {
                    try {
                        ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                            if (vendorLine.hasOwnProperty(field))
                                vendorLine[field] = vc2_util.forceFloat(vendorLine[field]);
                            return true;
                        });
                        vendorLine.QUANTITY = vc2_util.forceInt(vendorLine.QUANTITY);
                        vendorLine.LINEIDX = lineIdx;

                        util.extend(vendorLine, {
                            quantity: vendorLine.QUANTITY,
                            itemId: (vendorLine.NSITEM || '').toString(),
                            rate: vendorLine.BILLRATE || vendorLine.PRICE
                        });

                        // skip the line
                        if (!vendorLine.ITEMNO || !vendorLine.quantity) return;

                        // if (!vendorLine.quantity || vendorLine.quantity <= 0)
                        //     throw 'Zero Quantity line ';

                        if (!vendorLine.NSITEM) throw 'UNMATCHED_ITEMS';
                    } catch (vendorLine_error) {
                        vc2_util.logError(logTitle, vendorLine_error);

                        vendorLine.Errors = vc2_util.extractError(vendorLine_error);

                        Helper.setError({
                            code: vc2_util.extractError(vendorLine_error),
                            details: vendorLine.ITEMNO
                        });
                    } finally {
                        if (vendorLine.quantity) arrNonZeroLines.push(vendorLine);
                    }

                    return true;
                });

                vc2_util.log(logTitle, '.. total bill lines: ', arrNonZeroLines.length);

                Current.VendorData.lines = arrNonZeroLines;
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
                if (!Current.MainCFG) Current.MainCFG = vcs_configLib.mainConfig();

                ChargesCFG = {
                    tax: {
                        name: 'Tax',
                        description: 'VC | Tax Charges',
                        item: Current.MainCFG.defaultTaxItem,
                        applied: Current.MainCFG.isVarianceOnTax ? 'T' : 'F',
                        enabled: Current.MainCFG.isVarianceOnTax,
                        autoProc: Current.MainCFG.autoprocTaxVar
                    },
                    shipping: {
                        name: 'Shipping',
                        description: 'VC | Shipping Charges',
                        item: Current.MainCFG.defaultShipItem,
                        applied: Current.MainCFG.isVarianceOnShipping ? 'T' : 'F',
                        enabled: Current.MainCFG.isVarianceOnShipping,
                        autoProc: Current.MainCFG.autoprocShipVar
                    },
                    other: {
                        name: 'Other Charges',
                        description: 'VC | Other Charges',
                        item: Current.MainCFG.defaultOtherItem,
                        applied: Current.MainCFG.isVarianceOnOther ? 'T' : 'F',
                        enabled: Current.MainCFG.isVarianceOnOther,
                        autoProc: Current.MainCFG.autoprocOtherVar
                    },
                    miscCharges: {
                        name: 'Misc Charges',
                        description: 'VC | Misc Charges',
                        item: Current.MainCFG.defaultOtherItem,
                        applied: Current.MainCFG.isVarianceOnOther ? 'T' : 'F',
                        enabled: Current.MainCFG.isVarianceOnOther,
                        autoProc: Current.MainCFG.autoprocOtherVar
                    }
                };

                vc2_util.log(logTitle, '## ChargesCFG', ChargesCFG);

                for (var chargeType in ChargesCFG) {
                    var chargeInfo = ChargesCFG[chargeType];

                    // check if enabled, but not set!
                    if (chargeInfo.enabled && !chargeInfo.item)
                        Helper.setError({
                            code: 'MISSING_VARIANCE_ITEM',
                            details: chargeInfo.name
                        });
                }
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },

        loadBillLines: function (option) {},
        applyBillLines: function (option) {
            var logTitle = [LogTitle, 'applyBillLines'].join('::');

            try {
                Current.BillLines.forEach(function (billLine) {
                    billLine.amount = billLine.quantity * billLine.rate;
                    billLine.taxAmount = Helper.calculateLineTax(
                        vc2_util.extend(billLine.OrderLine, { amount: billLine.amount })
                    );
                });
                // this.calcuateTotals();
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
                        LineVariance: 0,
                        Charges: 0,
                        AppliedCharges: 0,
                        TxnAmount: 0
                    },
                    VendorData = Current.VendorData;

                Current.BillLines.forEach(function (billLine) {
                    var orderLine = billLine.OrderLine;
                    if (
                        orderLine.item_text.match(/shipping|freight/gi) ||
                        (orderLine.description && orderLine.description.match(/shipping|freight/gi))
                    ) {
                        Total.Shipping += orderLine.amount;
                    }
                    if (billLine.taxAmount) Total.Tax += billLine.taxAmount;

                    Total.LineVariance += billLine.VarianceAmt;
                    Total.LineAmount += billLine.amount;
                });
                Total.LineVariance = vc2_util.roundOff(Total.LineVariance);

                Current.Charges.forEach(function (charge) {
                    var isEnabled = vc2_util.inArray(charge.enabled, ['T', 't', true]),
                        isApplied = vc2_util.inArray(charge.applied, ['T', 't', true]),
                        appliedAmount = vc2_util.parseFloat(charge.rate || charge.amount),
                        isAutoProc = vc2_util.inArray(charge.autoProc, ['T', 't', true]);

                    // vc2_util.log(logTitle, '... charges: ', [
                    //     charge,
                    //     {
                    //         isenabled: isEnabled,
                    //         isapplied: isApplied,
                    //         appliedAmount: appliedAmount,
                    //         isautoProc: isAutoProc
                    //     },
                    //     (isEnabled || isApplied) && appliedAmount,
                    //     (isEnabled || isApplied) && appliedAmount && !isAutoProc
                    // ]);

                    // if the charge is enabled && applied, and non-zero
                    if (isEnabled && isApplied && appliedAmount) {
                        // include it on the Total Applied Charged amount
                        Total.Charges += appliedAmount || 0;
                        // if auto-process, exclude it from the total
                        if (!isAutoProc) Total.AppliedCharges += charge.amount || 0;
                    }
                });

                Total.TxnAmount = Total.Shipping + Total.Tax + Total.LineAmount; // + Total.Charges;
                util.extend(Current.Total, Total);
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
                // } finally {
            }
            // vc2_util.log(logTitle, '>> Totals: ', Current.Total);
            return Current.Total;
        },
        processCharges: function () {
            var logTitle = [LogTitle, 'processCharges'].join('::');

            try {
                // calculate the totals first
                this.calcuateTotals();

                var ChargeLines = [];
                // vc2_util.log(logTitle, '// varianceLines: ', Current.VendorData);

                for (var chargeType in ChargesCFG) {
                    var chargeParam = ChargesCFG[chargeType],
                        chargeAmount = Current.VendorData.charges[chargeType] || 0,
                        varianceLine = vc2_util.findMatching({
                            // dataSet: Current.VendorData.varianceLines || [],
                            dataSet: Current.VendorData.varianceLines || [],
                            filter: { type: chargeParam.name || chargeType }
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
                vc2_util.log(logTitle, 'ChargeLines: ', ChargeLines);

                this.calcuateTotals();
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
        },
        varianceCheck: function (option) {
            var logTitle = [LogTitle, 'varianceCheck'].join('::');
            try {
                // calculate totals first
                this.calcuateTotals();
                // vc2_util.log(logTitle, '>> Totals: ', Current.Total);

                var VendorData = Current.VendorData,
                    Total = Current.Total;

                Total.BillAmount = VendorData.total;

                Total.Variance = vc2_util.roundOff(Total.BillAmount - Total.TxnAmount);
                vc2_util.log(logTitle, '... Totals! ', Total);

                // Calculate/detect the variance if the Total.TxnAmount is not equal to the Bill Amount

                // if (Total.Variance) {
                Current.Charges.forEach(function (charge) {
                    var isEnabled = vc2_util.inArray(charge.enabled, ['T', 't', true]),
                        isApplied = vc2_util.inArray(charge.applied, ['T', 't', true]),
                        hasAmount = vc2_util.parseFloat(charge.rate || charge.amount),
                        isAutoProc = vc2_util.inArray(charge.autoProc, ['T', 't', true]);

                    if (isEnabled && isApplied && hasAmount) {
                        if (!isAutoProc) Helper.setVariance(charge.name);
                    }
                });

                vc2_util.log(logTitle, '... Variance Amount: ', {
                    HasVariance: Current.HasVariance,
                    billVariance: Total.Variance,
                    lineVariance: Total.LineVariance,
                    TotalCharges: Total.Charges,
                    AppliedCharges: Total.AppliedCharges,
                    totalVar: Math.abs(Total.Variance) ? Total.Variance : 0,
                    lineVar: Math.abs(Total.LineVariance) ? Total.LineVariance : 0

                    // varianceAmount: varianceAmount
                });
                Total.Variance =
                    // (Math.abs(Total.AppliedCharges) ? Total.AppliedCharges : 0) +
                    (Math.abs(Total.LineVariance) ? Total.LineVariance : 0) + Total.AppliedCharges;

                vc2_util.log(logTitle, '... Total.Variance! ', Total.Variance);

                if (
                    Current.HasVariance ||
                    Math.abs(Total.Variance) ||
                    Math.abs(Total.AppliedCharges)
                ) {
                    // if there's Bill Variance,
                    if (Math.abs(Total.Variance) > 0) {
                        // if there are line variances
                        if (Math.abs(Total.LineVariance) > 0) {
                            if (Current.MainCFG.autoprocPriceVar) {
                                Current.HasVariance = false;
                                Total.Variance -= Total.LineVariance;
                            } else Current.HasVariance = true;

                            vc2_util.log(logTitle, '... line variance! ', [
                                Total.LineVariance,
                                Current.MainCFG.autoprocPriceVar,
                                Current.HasVariance,
                                Total.Variance
                            ]);
                        }

                        // bill file has charges
                        if (Math.abs(Total.Charges) > 0) {
                            if (Math.abs(Total.AppliedCharges) > 0) {
                                Current.HasVariance = true;
                            } else {
                                Current.HasVariance = false;
                                // Total.Variance -= Total.Charges;

                                vc2_util.log(logTitle, '... no applied !', Total.Variance);
                            }

                            vc2_util.log(logTitle, '... hasCharges! ', [
                                Total.Charges,
                                Total.AppliedCharges,
                                Total.Variance,
                                Current.HasVariance
                            ]);
                        }
                        vc2_util.log(logTitle, '... varianceAmount! ', Total.Variance);

                        if (Total.Variance) {
                            Helper.setVariance('Calc Bill Amount does not match the Invoice Total');
                        }
                    }

                    vc2_util.log(logTitle, '... Variance Amount: ', {
                        HasVariance: Current.HasVariance,
                        totalVariance: Total.Variance,
                        lineVariance: Total.LineVariance,
                        TotalCharges: Total.Charges,
                        AppliedCharges: Total.AppliedCharges
                    });

                    if (Current.HasVariance) {
                        if (Current.MainCFG.allowedVarianceAmountThreshold) {
                            if (
                                Total.AppliedCharges >
                                    Current.MainCFG.allowedVarianceAmountThreshold ||
                                Total.Variance > Current.MainCFG.allowedVarianceAmountThreshold
                            ) {
                                Helper.setVariance('EXCEED_THRESHOLD');
                            } else {
                                Helper.setVariance('WITHIN_THRESHOLD');
                                Current.AllowVariance = true;
                            }
                        }

                        if (Current.MainCFG.allowAdjustLine && Total.Variance) {
                            var otherCharge = vc2_util.clone(ChargesCFG.other);

                            // add to Charges List
                            util.extend(otherCharge, {
                                rate: Total.Variance,
                                amount: Total.Variance,
                                description: 'VC | Adjustment'
                            });
                            Current.Charges.push(otherCharge);
                        }
                    }
                }
                //}
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
            // vc2_util.log(logTitle, '>> Totals: ', Current.Total);
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
                    'BillLines'
                ]
            });

            var paramsToShow = [
                'HasErrors',
                'ErrorList',
                'Error',
                'HasVariance',
                'VarianceList',
                'BillLines',
                'AllowBill',
                'Charges',
                'Total'
            ];

            vc2_util.log(LogTitle, '###### DATA DUMP:start ######');
            paramsToShow.forEach(function (field) {
                vc2_util.log(LogTitle, '##--- (' + field + ')  :', Current[field]);
            });
            vc2_util.log(LogTitle, '###### DATA DUMP:end ######');

            // vc2_util.log(LogTitle, '>> CURRENT (params) :', paramsToShow);
        },
        setError: function (option) {
            var logTitle = [LogTitle, 'setError'].join(': ');

            var errorCode = option.code || option.errorCode,
                errorDetails = option.details;

            vc2_util.log(logTitle, '!! error reported !! ', option);

            if (!Current.Error[errorCode]) Current.Error[errorCode] = [];
            if (!vc2_util.isEmpty(errorDetails)) {
                if (!vc2_util.inArray(errorDetails, Current.Error[errorCode]))
                    Current.Error[errorCode].push(errorDetails);
            }

            Current.ErrorList.push(errorCode);
            Current.HasErrors = true;
            Current.AllowBill = false;
            return true;
        },
        setVariance: function (variance) {
            vc2_util.log('setVariance', '!! VARiANCE !!', [variance, Current.VarianceList]);

            if (!vc2_util.inArray(variance, Current.VarianceList))
                Current.VarianceList.push(variance);

            Current.HasVariance = true;
        },
        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return taxAmount ? taxAmount : 0;
        }
    };

    return VC_BillProcess;
});
