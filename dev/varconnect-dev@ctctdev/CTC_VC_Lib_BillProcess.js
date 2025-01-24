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
            BILL: {
                ID: null,
                REC: {},
                LINES: [],
                MATCHED: []
            },
            BILLFILE: {
                ID: null,
                REC: {},
                DATA: {},
                JSON: {},
                LINES: [],
                CHARGES: {}
            },
            PO: {
                ID: null,
                REC: null,
                DATA: {},
                LINES: []
            },
            CFG: {
                MainCFG: {},
                BillCFG: {},
                OrderCFG: {}
            },
            CHARGES: {},
            VARLINES: [],
            TOTAL: {
                Shipping: 0,
                Tax: 0,
                Charges: 0,
                Amount: 0
            },
            HasErrors: false,
            HasVariance: false,
            VarianceList: [],
            ErrorList: [],
            Error: {},
            AllowVariance: false,
            AllowBill: false
        },
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
                Current.CFG.MainCFG = vcs_configLib.mainConfig();
                this.loadVarianceConfig();

                this.loadBillFile(option);
                this.loadPOData(option);

                Current.CFG.BillCFG =
                    option.billConfig || Current.PO.ID
                        ? vcs_configLib.billVendorConfig({ poId: Current.PO.ID })
                        : {};

                Current.CFG.OrderCFG =
                    option.orderConfig || Current.PO.ID
                        ? vcs_configLib.orderVendorConfig({ poId: Current.PO.ID })
                        : {};

                if (!Current.BILLFILE.DATA) throw ' Missing Bill File Data';
                if (!Current.BILLFILE.JSON) throw ' Missing Vendor Data';
                if (!Current.BILLFILE.JSON.invoice) throw ' Missing Invoice No';
                if (!Current.BILLFILE.LINES || !Current.BILLFILE.LINES.length)
                    throw ' Missing Vendor Data Lines';

                this.processBillFileLines(option);
                this.procesBillLines(option);
                this.processCharges(option);

                /// CALCULATE THE VARIANCES
                /// (1) Tax Lines
                vc2_util.log(logTitle, '// TAX: ', [Current.TOTAL.Tax, Current.CHARGES.tax]);
                if (
                    Current.TOTAL.Tax &&
                    Current.CHARGES.tax &&
                    Current.CHARGES.tax != Current.TOTAL.Tax
                ) {
                    Helper.setVariance('tax');
                }

                /// (2) Shipping Info
                vc2_util.log(logTitle, '// SHIPPING: ', [
                    Current.TOTAL.Shipping,
                    Current.CHARGES.shipping
                ]);
                if (
                    Current.TOTAL.Shipping &&
                    Current.CHARGES.shipping &&
                    Current.TOTAL.Shipping != Current.CHARGES.shipping
                ) {
                    Helper.setVariance('shipping');
                }

                vc2_util.log(logTitle, '// TOTALS: ', [
                    Current.TOTAL.Amount,
                    Current.BILLFILE.JSON.total
                ]);

                /// (3) Total Amount
                if (
                    Current.TOTAL.Amount &&
                    Current.BILLFILE.JSON.total &&
                    Current.TOTAL.Amount != Current.BILLFILE.JSON.total
                ) {
                    Helper.setVariance('Total Amount');
                }

                vc2_util.log(logTitle, '// BILLFILE.JSON: ', Current.BILLFILE.JSON);
                vc2_util.log(logTitle, '// BILLFILE.LINES: ', Current.BILLFILE.LINES);
                vc2_util.log(logTitle, '// BILLFILE.DATA: ', Current.BILLFILE.DATA);
                vc2_util.log(logTitle, '// BILL.DATA: ', Current.BILL.DATA);

                vc2_util.log(
                    logTitle,
                    '// Status: ',
                    vc2_util.extractValues({
                        source: Current,
                        params: [
                            'TOTAL',
                            'CHARGES',
                            'VarianceList',
                            'HasVariance',
                            'Error',
                            'ErrorList',
                            'HasErrors',
                            'AllowBill'
                        ]
                    })
                );

                // vc2_util.dumpLog(logTitle, Current.CFG, '// BILL PROC CFG: ');
                ///////////////////////

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
        loadBillFile: function (option) {
            var logTitle = [LogTitle, 'loadBillFile'].join('::'),
                returnValue = Current.BILLFILE.DATA;

            try {
                Current.BILLFILE.REC = option.recBillFile || option.billfileRec;
                Current.BILLFILE.DATA = option.billFileData;
                Current.BILLFILE.ID = option.billFileId || option.internalId || option.id;

                if (!Current.BILLFILE.DATA) {
                    if (!Current.BILLFILE.REC) {
                        if (!Current.BILLFILE.ID) throw 'Missing Billfile ID';
                        Current.BILLFILE.REC = vc2_record.load({
                            type: vc2_constant.RECORD.BILLFILE.ID,
                            id: Current.BILLFILE.ID,
                            isDynamic: false
                        });
                        if (!Current.BILLFILE.REC) throw 'Unable to load the bill file record';
                    }

                    Current.BILLFILE.DATA = vc2_record.extractValues({
                        record: Current.BILLFILE.REC,
                        fields: vc2_constant.RECORD.BILLFILE.FIELD
                    });
                }
                Current.BILLFILE.JSON = vc2_util.safeParse(Current.BILLFILE.DATA.JSON);

                // remove QTY:0 vendor lines
                var arrNonZeroLines = [];

                // prep the vendor lines
                Current.BILLFILE.JSON.lines.forEach(function (billfileLine, lineIdx) {
                    try {
                        ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                            if (billfileLine.hasOwnProperty(field))
                                billfileLine[field] = vc2_util.forceFloat(billfileLine[field]);
                            return true;
                        });
                        billfileLine.QUANTITY = vc2_util.forceInt(billfileLine.QUANTITY);
                        billfileLine.LINEIDX = lineIdx;

                        util.extend(billfileLine, {
                            quantity: billfileLine.QUANTITY,
                            itemId: (billfileLine.NSITEM || '').toString(),
                            rate: billfileLine.BILLRATE || billfileLine.PRICE
                        });

                        // skip the line
                        if (!billfileLine.ITEMNO || !billfileLine.quantity) return;

                        // if (!vendorLine.quantity || vendorLine.quantity <= 0)
                        //     throw 'Zero Quantity line ';

                        if (!billfileLine.NSITEM) throw 'UNMATCHED_ITEMS';
                    } catch (vendorLine_error) {
                        vc2_util.logError(logTitle, vendorLine_error);

                        billfileLine.Errors = vc2_util.extractError(vendorLine_error);

                        Helper.setError({
                            code: vc2_util.extractError(vendorLine_error),
                            details: billfileLine.ITEMNO
                        });
                    } finally {
                        if (billfileLine.quantity) arrNonZeroLines.push(billfileLine);
                    }

                    return true;
                });
                vc2_util.log(logTitle, '.. total bill lines: ', arrNonZeroLines.length);
                Current.BILLFILE.LINES = arrNonZeroLines;

                // Prep the charges
                ['shipping', 'other', 'tax'].forEach(function (chargeType) {
                    Current.CHARGES[chargeType] = vc2_util.parseFloat(
                        Current.BILLFILE.JSON.charges[chargeType]
                    );
                    return true;
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            } finally {
                vc2_util.dumpLog(logTitle, Current.BILLFILE, '// BILL FILE: ');
            }

            return returnValue;
        },
        loadPOData: function (option) {
            var logTitle = [LogTitle, 'loadPOData'].join('::'),
                returnValue = Current.PO.DATA;

            try {
                Current.PO.REC = option.recPO || option.recordPO;
                Current.PO.DATA = option.poData || option.orderData;
                Current.PO.ID = option.poId;

                if (!Current.PO.DATA) {
                    if (!Current.PO.REC) {
                        // get the PO Id from the BILL FILE Data
                        Current.PO.ID =
                            Current.PO.ID ||
                            (Current.BILLFILE.DATA && Current.BILLFILE.DATA.PO_LINK)
                                ? Current.BILLFILE.DATA.PO_LINK
                                : null;

                        if (!Current.PO.ID) throw 'Missing PO Id';

                        Current.PO.REC = vc2_record.load({
                            type: 'purchaseorder',
                            id: Current.PO.ID,
                            isDynamic: false
                        });
                        if (!Current.PO.REC) throw 'Unable to load the purchase order';
                    }

                    Current.PO.ID = Current.PO.ID || Current.PO.REC.id;
                    Current.PO.DATA = vc2_record.extractValues({
                        record: Current.PO.REC,
                        fields: [
                            'internalid',
                            'tranid',
                            'entity',
                            'total',
                            'taxtotal',
                            'tax2total',
                            'status',
                            'statusRef'
                        ]
                    });
                }

                // Get PO Data
                util.extend(Current.PO.DATA, {
                    isReceivable: vc2_util.inArray(Current.PO.DATA.statusRef, [
                        'pendingReceipt',
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isPartiallyBilled: vc2_util.inArray(Current.PO.DATA.statusRef, [
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isBillable: vc2_util.inArray(Current.PO.DATA.statusRef, [
                        'pendingBilling',
                        'pendingBillPartReceived'
                    ]),
                    isClosed: vc2_util.inArray(Current.PO.DATA.statusRef, [
                        'fullyBilled',
                        'closed'
                    ]),
                    isFullyBilled: vc2_util.inArray(Current.PO.DATA.statusRef, ['fullyBilled'])
                });

                if (Current.PO.isClosed) {
                    Helper.setError({
                        code: Current.PO.isFullyBilled ? 'FULLY_BILLED' : 'CLOSED_PO'
                    });
                }

                /// Get the Order Lines ///
                Current.PO.LINES = vc2_record.extractRecordLines({
                    record: Current.PO.REC,
                    findAll: true,
                    columns: [
                        'line',
                        'linenumber',
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
                    orderConfig: Current.CFG.OrderCFG,
                    mainConfig: Current.CFG.MainCFG
                });

                var TotalShipping = 0,
                    ChargesDEF = Current.CFG.ChargesDEF || {};
                Current.PO.LINES.forEach(function (orderLine) {
                    orderLine.itemId = orderLine.item;

                    if (
                        orderLine.item_text.match(/shipping|freight/gi) ||
                        (ChargesDEF.shipping &&
                            ChargesDEF.shipping.item &&
                            ChargesDEF.shipping.item == orderLine.item)
                    ) {
                        TotalShipping += orderLine.amount;
                    }
                });
                Current.TOTAL.Shipping = TotalShipping;

                if (Current.PO.DATA.isBillable) {
                    try {
                        Current.BILL.REC = vc2_record.transform({
                            fromType: 'purchaseorder',
                            fromId: Current.PO.ID,
                            toType: 'vendorbill',
                            isDynamic: true
                        });

                        VC_BillProcess.loadBill({
                            recBill: Current.BILL.REC
                        });
                    } catch (billcreate_error) {
                        vc2_util.logError(logTitle, billcreate_error);
                    }
                }

                // try to create the bill
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);

                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        processBillFileLines: function (option) {
            var logTitle = [LogTitle, 'processBillFileLines'].join('::'),
                returnValue = null;

            try {
                if (!Current.PO.LINES) this.loadPOData(option);

                // Match the Order lines
                vc2_record.matchOrderLines({
                    orderLines: Current.PO.LINES,
                    vendorLines: Current.BILLFILE.LINES,
                    includeZeroQtyLines: true,

                    billConfig: Current.CFG.BillCFG,
                    orderConfig: Current.CFG.OrderCFG,
                    mainConfig: Current.CFG.MainCFG
                });

                // /// SETUP the Bill Lines
                Current.BILLFILE.LINES.forEach(function (vendorLine, idx) {
                    // prepare our billine
                    util.extend(vendorLine, {
                        itemId: vendorLine.itemId,
                        item: vendorLine.itemId,
                        itemName: vendorLine.ITEMNO,
                        lineIdx: vendorLine.LINEIDX,
                        description: vendorLine.DESCRIPTION,
                        quantity: vendorLine.quantity,
                        rate: vendorLine.rate, // use the rate from the bill file
                        Errors: [],
                        Msg: [],
                        Variance: [],
                        OrderLine: {},
                        VarianceAmt: 0
                    });

                    try {
                        // there are no matched items for this
                        if (!vendorLine.MATCHING || vc2_util.isEmpty(vendorLine.MATCHING))
                            throw 'UNMATCHED_ITEMS';

                        // from the matching lines, try to collect the appliable qty
                        var orderLine = {};
                        vendorLine.MATCHING.forEach(function (matchedLine) {
                            // initialize the `orderLine`
                            if (vc2_util.isEmpty(orderLine)) util.extend(orderLine, matchedLine);
                            else {
                                orderLine.quantity =
                                    (orderLine.quantity || 0) + matchedLine.quantity;
                                orderLine.quantityreceived =
                                    (orderLine.quantityreceived || 0) +
                                    matchedLine.quantityreceived;
                                orderLine.quantitybilled =
                                    (orderLine.quantitybilled || 0) + matchedLine.quantitybilled;
                            }

                            orderLine.QTYRCVD =
                                (orderLine.QTYRCVD || 0) + matchedLine.quantityreceived;
                            orderLine.QTYBILLED =
                                (orderLine.QTYBILLED || 0) + matchedLine.quantitybilled;
                        });
                        vendorLine.OrderLine = orderLine;

                        // VARIANCE CHECK: Pricing
                        if (vendorLine.rate != orderLine.rate) {
                            if (!Current.CFG.MainCFG.autoprocPriceVar)
                                vendorLine.Variance.push('Price');
                            vendorLine.VarianceAmt =
                                Math.abs(vendorLine.rate - orderLine.rate) * vendorLine.quantity;

                            Helper.setVariance('Price');
                        }
                        orderLine.RECEIVABLE = orderLine.quantity - orderLine.QTYRCVD;
                        orderLine.BILLABLE = orderLine.QTYRCVD - orderLine.QTYBILLED;

                        /// Check if there any billable items
                        if (orderLine.RECEIVABLE <= 0 && orderLine.BILLABLE <= 0)
                            throw 'ITEMS_ALREADY_BILLED';

                        // if not enough billable
                        if (orderLine.BILLABLE < vendorLine.quantity) {
                            // fulfillment is enabled //
                            if (
                                Current.CFG.BillCFG.enableFulfillment &&
                                Current.PO.isReceivable &&
                                Current.BILLFILE.DATA.IS_RCVBLE
                            ) {
                                if (orderLine.RECEIVABLE < vendorLine.quantity)
                                    throw 'INSUFFICIENT_QUANTITY';
                            } else if (orderLine.BILLABLE > 0) throw 'INSUFFICIENT_QUANTITY';
                            else throw 'NOT_BILLABLE';
                        }
                    } catch (line_error) {
                        var errorCode = vc2_util.extractError(line_error);
                        Helper.setError({
                            errorCode: errorCode,
                            details: billLine.itemName
                        });
                        vendorLine.Errors.push(errorCode);
                        vc2_util.logError(logTitle, line_error);
                    } finally {
                        // Current.BillLines.push(billLine);
                        vc2_util.log(logTitle, '## Bill Line [' + idx + '] ', vendorLine);
                    }

                    return true;
                });
            } catch (error) {}

            return returnValue;
        },
        loadVarianceConfig: function () {
            var logTitle = [LogTitle, 'loadVarianceConfig'].join('::'),
                returnValue = {};

            try {
                if (!Current.CFG.MainCFG) Current.CFG.MainCFG = vcs_configLib.mainConfig();

                var ChargesDEF = {
                    tax: {
                        name: 'Tax',
                        description: 'VC | Tax Charges',
                        item: Current.CFG.MainCFG.defaultTaxItem,
                        applied: Current.CFG.MainCFG.isVarianceOnTax ? 'T' : 'F',
                        enabled: Current.CFG.MainCFG.isVarianceOnTax,
                        autoProc: Current.CFG.MainCFG.autoprocTaxVar
                    },
                    shipping: {
                        name: 'Shipping',
                        description: 'VC | Shipping Charges',
                        item: Current.CFG.MainCFG.defaultShipItem,
                        applied: Current.CFG.MainCFG.isVarianceOnShipping ? 'T' : 'F',
                        enabled: Current.CFG.MainCFG.isVarianceOnShipping,
                        autoProc: Current.CFG.MainCFG.autoprocShipVar
                    },
                    other: {
                        name: 'Other Charges',
                        description: 'VC | Other Charges',
                        item: Current.CFG.MainCFG.defaultOtherItem,
                        applied: Current.CFG.MainCFG.isVarianceOnOther ? 'T' : 'F',
                        enabled: Current.CFG.MainCFG.isVarianceOnOther,
                        autoProc: Current.CFG.MainCFG.autoprocOtherVar
                    },
                    miscCharges: {
                        name: 'Misc Charges',
                        description: 'VC | Misc Charges',
                        item: Current.CFG.MainCFG.defaultOtherItem,
                        applied: Current.CFG.MainCFG.isVarianceOnOther ? 'T' : 'F',
                        enabled: Current.CFG.MainCFG.isVarianceOnOther,
                        autoProc: Current.CFG.MainCFG.autoprocOtherVar
                    }
                };

                vc2_util.log(logTitle, '## ChargesDEF', ChargesDEF);

                for (var chargeType in ChargesDEF) {
                    var chargeInfo = ChargesDEF[chargeType];

                    // check if enabled, but not set!
                    if (chargeInfo.enabled && !chargeInfo.item)
                        Helper.setError({
                            code: 'MISSING_VARIANCE_ITEM',
                            details: chargeInfo.name
                        });
                }

                Current.CFG.ChargesDEF = ChargesDEF;
                returnValue = ChargesDEF;
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        loadBill: function (option) {
            var logTitle = [LogTitle, 'loadBill'].join('::'),
                returnValue = null;
            option = option || {};

            try {
                Current.BILL.REC = option.recBill || option.recordBill || Current.BILL.REC;
                Current.BILL.DATA = option.billData || Current.BILL.DATA;
                Current.BILL.ID = option.billId || Current.BILL.ID;

                if (!Current.BILL.DATA && !Current.BILL.REC) throw 'Bill is not provided';

                Current.BILL.DATA = vc2_record.extractValues({
                    record: Current.BILL.REC,
                    fields: [
                        'tranid',
                        'entity',
                        'total',
                        'taxtotal',
                        'tax2total',
                        'status',
                        'statusRef'
                    ]
                });

                Current.BILL.DATA.TOTALTAX = vc2_util.roundOff(
                    (Current.BILL.DATA.taxtotal || 0) + (Current.BILL.DATA.tax2total || 0)
                );

                Current.BILL.LINES = vc2_record.extractRecordLines({
                    record: Current.BILL.REC,
                    findAll: true,
                    columns: [
                        'applied',
                        'item',
                        'rate',
                        'quantity',
                        'amount',
                        'quantityreceived',
                        'quantitybilled',
                        'grossamt',
                        'taxrate',
                        'taxrate1',
                        'taxrate2',
                        'orderline',
                        'line'
                    ],
                    orderConfig: Current.CFG.OrderCFG,
                    mainConfig: Current.CFG.MainCFG
                });
                Current.BILL.LINES.forEach(function (billLine) {
                    billLine.itemId = billLine.item;
                    billLine.TOTALTAX = vc2_util.roundOff(Helper.calculateLineTax(billLine));
                });
                Current.TOTAL.Tax = Current.BILL.DATA.TOTALTAX;
                Current.TOTAL.Amount = Current.BILL.DATA.total;

                vc2_util.log(logTitle, '// Totals: ', Current.TOTAL);

                // process the bill lines
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);

                Helper.setError({
                    code: vc2_util.extractError(error)
                });
            }
        },
        procesBillLines: function (option) {
            var logTitle = [LogTitle, 'processBillLines'].join('::'),
                returnValue = Current.BILL.DATA;
            option = option || {};

            try {
                Current.BILL.REC = option.recBill || option.recordBill || Current.BILL.REC;
                Current.BILL.DATA = option.billData || Current.BILL.DATA;
                Current.BILL.ID = option.billId || Current.BILL.ID;

                vc2_util.log(logTitle, '(pre) BILL DATA: ', [
                    Current.BILL.LINES.length,
                    Current.BILL.DATA
                ]);

                if (!Current.BILL.LINES) {
                    if (!Current.BILL.REC) this.loadBill(option);
                    if (!Current.BILL.LINES) throw 'Missing Bill Lines';
                }
                if (!Current.BILLFILE.LINES) throw 'Missing billfile lines';

                var appliedLinesColl = {};
                var ChargesDEF = Current.CFG.ChargesDEF || {};
                Current.BILLFILE.LINES.forEach(function (billfileLine) {
                    (billfileLine.MATCHING || []).forEach(function (orderLine) {
                        var matchedBillLine = vc2_util.findMatching({
                            dataSet: Current.BILL.LINES,
                            filter: {
                                orderline: orderLine.line + 1
                            }
                        });

                        if (!vc2_util.isEmpty(matchedBillLine))
                            appliedLinesColl[matchedBillLine.line] = matchedBillLine;
                    });
                });

                vc2_util.log(logTitle, '// applied bill lines: ', appliedLinesColl);
                for (var line = Current.BILL.LINES.length - 1; line >= 0; line--) {
                    var lineValues = vc2_record.extractLineValues({
                        record: Current.BILL.REC,
                        sublistId: 'item',
                        line: line,
                        columns: ['line', 'item', 'quantity', 'rate']
                    });

                    if (
                        appliedLinesColl[line] ||
                        lineValues.item_text.match(/shipping|freight/gi) ||
                        (ChargesDEF.shipping &&
                            ChargesDEF.shipping.item &&
                            ChargesDEF.shipping.item == lineValues.item)
                    ) {
                        vc2_util.log(logTitle, '.... including line: ', lineValues.item_text);
                    } else {
                        vc2_util.log(logTitle, '.... removing line: ', lineValues.item_text);
                        Current.BILL.REC.removeLine({ sublistId: 'item', line: line });
                    }
                }

                // reload the bill data
                this.loadBill();
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        processCharges: function (option) {
            var logTitle = [LogTitle, 'processCharges'].join('::'),
                returnValue = null;

            try {
                var ChargesDEF = Current.CFG.ChargesDEF || {};

                for (var type in ChargesDEF) {
                    var lineParam = ChargesDEF[type],
                        amount = Current.CHARGES[type] || 0,
                        varianceLine = vc2_util.findMatching({
                            dataSet: Current.BILLFILE.JSON.varianceLines || [],
                            filter: { type: lineParam.name || type }
                        });

                    // prep the charge line
                    var chargeLine = vc2_util.extend(
                        { type: type, chargeAmount: amount },
                        lineParam
                    );

                    vc2_util.log(logTitle, '// charge line: ', chargeLine);

                    switch (type) {
                        case ChargeType.TAX:
                            util.extend(
                                chargeLine,
                                varianceLine || {
                                    rate: vc2_util.roundOff(amount - Current.TOTAL.Tax),
                                    amount: vc2_util.roundOff(amount - Current.TOTAL.Tax)
                                }
                            );
                            break;
                        case ChargeType.SHIP:
                            util.extend(
                                chargeLine,
                                varianceLine || {
                                    rate: vc2_util.roundOff(amount - Current.TOTAL.Shipping),
                                    amount: vc2_util.roundOff(amount - Current.TOTAL.Shipping)
                                }
                            );
                            break;

                        case ChargeType.OTHER:
                            util.extend(
                                chargeLine,
                                varianceLine || { rate: amount, amount: amount }
                            );
                            break;

                        case ChargeType.MISC:
                    }

                    Current.VARLINES.push(chargeLine);
                }
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }

            return true;
        },
        processBillLines0: function (option) {
            var logTitle = [LogTitle, 'processBillLines'].join('::'),
                returnValue = Current.PO.DATA;

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
                    vendorLines: Current.BILLFILE.LINES
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
                                    Current.CFG.MainCFG.autoprocPriceVar
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

        loadBillLines: function (option) {},
        applyBillLines: function (option) {
            var logTitle = [LogTitle, 'applyBillLines'].join('::');
            try {
                if (!Current.BILL.REC) return false;

                var matchedBillLines = vc2_util.matchOrderLines({});

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
                    VendorData = Current.BILLFILE.JSON;

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
                util.extend(Current.TOTAL, Total);
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
                // } finally {
            }
            // vc2_util.log(logTitle, '>> Totals: ', Current.Total);
            return Current.TOTAL;
        },
        processCharges0: function () {
            var logTitle = [LogTitle, 'processCharges'].join('::');

            try {
                // calculate the totals first
                this.calcuateTotals();

                var ChargeLines = [];
                // vc2_util.log(logTitle, '// varianceLines: ', Current.BILLFILE.JSON);

                for (var chargeType in ChargesCFG) {
                    var chargeParam = ChargesCFG[chargeType],
                        chargeAmount = Current.BILLFILE.JSON.charges[chargeType] || 0,
                        varianceLine = vc2_util.findMatching({
                            // dataSet: Current.BILLFILE.JSON.varianceLines || [],
                            dataSet: Current.BILLFILE.JSON.varianceLines || [],
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
                                    rate: vc2_util.roundOff(chargeAmount - Current.TOTAL.Tax),
                                    amount: vc2_util.roundOff(chargeAmount - Current.TOTAL.Tax)
                                }
                            );
                            4;
                            ChargeLines.push(chargeLine);
                            break;
                        case ChargeType.SHIP:
                            util.extend(
                                chargeLine,
                                varianceLine || {
                                    rate: vc2_util.roundOff(chargeAmount - Current.TOTAL.Shipping),
                                    amount: vc2_util.roundOff(chargeAmount - Current.TOTAL.Shipping)
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
                                    dataSet: Current.BILLFILE.JSON.varianceLines,
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

                var VendorData = Current.BILLFILE.JSON,
                    Total = Current.TOTAL;

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
                            if (Current.CFG.MainCFG.autoprocPriceVar) {
                                Current.HasVariance = false;
                                Total.Variance -= Total.LineVariance;
                            } else Current.HasVariance = true;

                            vc2_util.log(logTitle, '... line variance! ', [
                                Total.LineVariance,
                                Current.CFG.MainCFG.autoprocPriceVar,
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
                        if (Current.CFG.MainCFG.allowedVarianceAmountThreshold) {
                            if (
                                Total.AppliedCharges >
                                    Current.CFG.MainCFG.allowedVarianceAmountThreshold ||
                                Total.Variance > Current.CFG.MainCFG.allowedVarianceAmountThreshold
                            ) {
                                Helper.setVariance('EXCEED_THRESHOLD');
                            } else {
                                Helper.setVariance('WITHIN_THRESHOLD');
                                Current.AllowVariance = true;
                            }
                        }

                        if (Current.CFG.MainCFG.allowAdjustLine && Total.Variance) {
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
