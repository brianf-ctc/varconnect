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
                this.processBillLines(option);
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

                    if (Current.CFG.MainCFG.allowAdjustLine) {
                        this.addChargeLine({
                            amount: Current.TOTAL.Amount - Current.BILLFILE.JSON.total,
                            description: 'VC | Adjustment'
                        });
                    }
                }

                if (!Current.PO.DATA.isBillable) {
                    Helper.setError('NOT_BILLABLE');
                }

                vc2_util.log(logTitle, '// BILLFILE.JSON: ', Current.BILLFILE.JSON);
                vc2_util.log(logTitle, '// BILLFILE.LINES: ', Current.BILLFILE.LINES);

                if (Current.HasVariance) {
                    this.processBillLines(option);
                }

                vc2_util.log(logTitle, '// BILL.DATA: ', Current.BILL.DATA);
                vc2_util.log(logTitle, '// BILL.LINES: ', Current.BILL.LINES);
                vc2_util.log(
                    logTitle,
                    '// Status: ',
                    vc2_util.extractValues({
                        source: Current,
                        params: [
                            'TOTAL',
                            'CHARGES',
                            'VarianceList',
                            'VARLINES',
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

                Current.BILLFILE.LINES.forEach(function (vendorLine, idx) {
                    util.extend(vendorLine, {
                        itemId: vendorLine.itemId,
                        item: vendorLine.itemId,
                        itemName: vendorLine.ITEMNO,
                        lineIdx: vendorLine.LINEIDX,
                        description: vendorLine.DESCRIPTION,
                        quantity: vendorLine.quantity,
                        rate: vendorLine.rate, // use the rate from the bill file
                        amount: vc2_util.roundOff(vendorLine.quantity * vendorLine.rate),
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

                        vc2_util.log(logTitle, '///(2) OrderLine [' + (idx + 1) + ']', orderLine);

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
                        vc2_util.log(logTitle, '///(3) OrderLine [' + (idx + 1) + ']', orderLine);
                    } catch (line_error) {
                        var errorCode = vc2_util.extractError(line_error);
                        Helper.setError({ code: errorCode, details: vendorLine.itemName });
                        vendorLine.Errors.push(errorCode);
                        vc2_util.logError(logTitle, line_error);
                    } finally {
                        vc2_util.log(logTitle, '## Bill Line [' + (idx + 1) + '] ', vendorLine);
                    }
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

                if (!Current.PO.DATA.isBillable) return false;
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
        processBillLines: function (option) {
            var logTitle = [LogTitle, 'processBillLines'].join('::'),
                returnValue = Current.BILL.DATA;
            option = option || {};

            try {
                Current.BILL.REC = option.recBill || option.recordBill || Current.BILL.REC;
                Current.BILL.DATA = option.billData || Current.BILL.DATA;
                Current.BILL.ID = option.billId || Current.BILL.ID;

                if (!Current.PO.DATA.isBillable) return false;

                vc2_util.log(logTitle, '(pre) BILL DATA: ', [
                    Current.BILL.LINES.length,
                    Current.BILL.DATA
                ]);

                // if (!Current.BILL.LINES) {
                //     if (!Current.BILL.REC) this.loadBill(option);
                //     if (!Current.BILL.LINES) throw 'Missing Bill Lines';
                // }
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

                // add the Variances
                (Current.VARLINES || []).forEach(function (varianceLine) {
                    try {
                        if (varianceLine.amount || varianceLine.rate)
                            vc2_record.addLine({
                                record: Current.BILL.REC,
                                lineData: vc2_util.extend(
                                    vc2_util.extractValues({
                                        source: varianceLine,
                                        params: ['item', 'description', 'rate', 'quantity']
                                    })
                                )
                            });
                    } catch (line_err) {
                        vc2_util.logError(logTitle, line_err);
                    }
                });

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
        addChargeLine: function (option) {
            var logTitle = [LogTitle, 'processCharges'].join('::'),
                returnValue = null;
            try {
                var chargeType = option.chargeType || option.type || ChargeType.OTHER,
                    chargeName = option.chargeName || option.name,
                    chargeAmount = option.chargeAmount || option.amount || option.rate,
                    chargeDescription = option.description;

                var chargeLine = Current.CFG.ChargesDEF[chargeType];
                if (!chargeLine) return false;

                util.extend(chargeLine, {
                    name: chargeName || chargeLine.name,
                    description: chargeDescription || chargeLine.description,
                    rate: chargeAmount,
                    amount: chargeAmount
                });

                // add the variance line
                Current.VARLINES.push(chargeLine);
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
            return true;
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
