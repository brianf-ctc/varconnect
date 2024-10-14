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
    'N/search',
    'N/format',
    './../../CTC_VC2_Constants',
    './../../CTC_VC2_Lib_Utils',
    './../../CTC_VC2_Lib_Record',
    './../../Services/ctc_svclib_configlib'
], function (ns_search, ns_format, vc2_constant, vc2_util, vc2_record, vcs_configLib) {
    // define(function (require) {
    var LogTitle = 'VC_BillProcess';

    var Current = {
            BILL: {
                ID: null,
                REC: null,
                LINES: [],
                MATCHED: []
            },
            BILLFILE: {
                ID: null,
                REC: null,
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
                OrderCFG: {},
                ChargesDEF: {}
            },
            STATUS: {
                IsProcessed: false,
                IsFullyBilled: false,
                IsReceivable: false,
                IsBillable: false,
                IsClosed: false,
                HasVariance: false,
                HasErrors: false,
                IgnoreVariance: false,
                AllowVariance: false,
                AllowToReceive: false,
                AllowToBill: false
            },
            CHARGES: {},
            VARLINES: [],
            TOTAL: {
                SHIPPING: 0,
                BILL_TAX: 0,
                CHARGES: 0,
                BILL_TOTAL: 0,
                POLINE_TOTAL: 0,
                VARIANCE: 0
            },
            ErrorList: [],
            VarianceList: [],
            Error: {}
        },
        ChargeType = {
            TAX: 'tax',
            SHIP: 'shipping',
            OTHER: 'other',
            MISC: 'miscCharges',
            ADJ: 'adjustment'
        };

    var VC_BillProcess = {
        Flex: Current,
        resetValues: function () {
            util.extend(Current, {
                BILL: {
                    ID: null,
                    REC: null,
                    LINES: [],
                    MATCHED: []
                },
                BILLFILE: {
                    ID: null,
                    REC: null,
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
                STATUS: {
                    IsProcessed: false,
                    IsFullyBilled: false,
                    IsReceivable: false,
                    IsBillable: false,
                    IsClosed: false,
                    HasVariance: false,
                    HasErrors: false,
                    IgnoreVariance: false,
                    AllowVariance: false,
                    AllowToReceive: false,
                    AllowToBill: false
                },
                CHARGES: {},
                VARLINES: [],
                TOTAL: {
                    SHIPPING: 0,
                    BILL_TAX: 0,
                    CHARGES: 0,
                    BILL_TOTAL: 0,
                    POLINE_TOTAL: 0,
                    VARIANCE: 0
                },
                ErrorList: [],
                VarianceList: [],
                Error: {}
            });

            return true;
        },
        preprocessBill: function (option) {
            var logTitle = [LogTitle, 'PreProcessBill'].join('::'),
                returnValue = Current;

            try {
                Current.CFG.MainCFG = vcs_configLib.mainConfig();
                this.loadVarianceConfig(option);
                this.loadBillFile(option);

                if (Current.CFG.MainCFG.isBillCreationDisabled)
                    throw 'Vendor Bill creation is disabled ';
                this.loadPOData(option);

                if (vc2_util.isEmpty(Current.PO.REC)) throw 'MISSING_PO';

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
                if (Current.TOTAL.BILL_TOTAL != Current.BILLFILE.JSON.total) {
                    var adjustAmount =
                        Current.BILLFILE.JSON.total -
                        (Current.TOTAL.BILL_TOTAL + Current.TOTAL.VARIANCE);

                    Current.TOTAL.VARIANCE += adjustAmount;

                    Helper.setVariance('Bill Total');

                    if (Current.CFG.MainCFG.allowAdjustLine) {
                        this.addChargeLine({
                            amount: adjustAmount,
                            description: 'VC | Adjustment'
                        });
                    }
                }

                ////////////////////////////////
                // EVALUATE THE STATUS
                Current.STATUS.AllowToBill = true;

                if (
                    Current.STATUS.HasErrors ||
                    Current.STATUS.HasVariance ||
                    Current.STATUS.IsProcessed ||
                    Current.STATUS.IsClosed ||
                    Current.STATUS.IsFullyBilled
                )
                    Current.STATUS.AllowToBill = false;

                // if (
                //     (Current.HasVariance || Current.HasErrors) &&
                //     Current.STATUS.IsBillable &&
                //     Current.STATUS.IsReceivable &&
                //     Current.STATUS.AllowToReceive
                // ) {
                //     Current.STATUS.AllowVariance = true;
                // }

                if (Current.STATUS.IsFullyBilled) {
                    // check if we ahve ITEMS_ALREADY_BILLED
                    var ErrorList = [],
                        ErrorColl = {};

                    Current.ErrorList.forEach(function (errorCode) {
                        if (
                            vc2_util.inArray(errorCode, [
                                'ITEMS_ALREADY_BILLED',
                                'INSUFFICIENT_QUANTITY'
                            ])
                        ) {
                            // skip
                        } else {
                            ErrorList.push(errorCode);
                            ErrorColl[errorCode] = Current.Error[errorCode];
                        }
                    });
                    Current.ErrorList = ErrorList;
                    Current.Error = ErrorColl;

                    Helper.setError({ code: 'ITEMS_ALREADY_BILLED' });
                }

                if (Current.STATUS.HasVariance && !Current.STATUS.IsFullyBilled) {
                    var allowedVarianceAmt = Current.CFG.MainCFG.allowedVarianceAmountThreshold;

                    if (Current.STATUS.AllowVariance || Current.STATUS.IgnoreVariance)
                        Current.STATUS.AllowToBill = true;

                    if (!vc2_util.isEmpty(allowedVarianceAmt)) {
                        if (allowedVarianceAmt < Math.abs(Current.TOTAL.VARIANCE)) {
                            Helper.setError({
                                code: 'EXCEED_THRESHOLD',
                                details: ns_format.format({
                                    value: allowedVarianceAmt,
                                    type: ns_format.Type.CURRENCY
                                })
                            });
                        } else {
                            Helper.setVariance('WITHIN_THRESHOLD');
                            Current.STATUS.AllowVariance = true;
                            Current.STATUS.AllowToBill = true;
                        }
                    }
                }

                ////////////////////////////

                Helper.dumpCurrentData();
                // vc2_util.dumpLog(logTitle, Current.CFG, '// BILL PROC CFG: ');
                ///////////////////////

                // // calculate the correct amount
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: vc2_util.extractError(error) });
            }

            return returnValue;
        },
        // processBill: function (option) {
        //     var logTitle = [LogTitle, 'processBill'].join('::'),
        //         returnValue = Current;

        //     try {
        //         if (!Current.BILL.REC) this.preprocessBill(option);
        //         if (!Current.BILL.REC) return false;
        //         if (!Current.STATUS.AllowToBill) throw 'Bill is not allowed';

        //         vc2_util.log(logTitle, '/// BillFILE DATA: ', Current.BILLFILE.DATA);
        //         vc2_util.log(logTitle, '/// BillFILE LINES: ', Current.BILLFILE.LINES);

        //         vc2_util.log(logTitle, '/// Bill DATA: ', Current.BILL.DATA);
        //         vc2_util.log(logTitle, '/// Bill LINES: ', Current.BILL.LINES);

        //         /// SET the posting period
        //         var currPostingPeriod = Current.BILL.REC.getValue({ fieldId: 'postingperiod' });

        //         // set the trandate
        //         // Current.BILL.REC.setValue({
        //         //     fieldId: 'trandate',
        //         //     value: ns_form

        //         // })
        //     } catch (error) {
        //         vc2_util.logError(logTitle, error);
        //         Helper.setError({ code: vc2_util.extractError(error) });
        //     }

        //     return returnValue;
        // },
        loadBillFile: function (option) {
            var logTitle = [LogTitle, 'loadBillFile'].join('::'),
                returnValue = Current.BILLFILE;

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

                if (vc2_util.isEmpty(Current.BILLFILE.DATA.PO_LINK))
                    Helper.setError({ code: 'MISSING_PO' });

                Current.BILLFILE.JSON = vc2_util.safeParse(Current.BILLFILE.DATA.JSON);
                if (vc2_util.isEmpty(Current.BILLFILE.DATA.JSON))
                    Helper.setError({
                        code: 'INCOMPLETE_BILLFILE',
                        details: 'Missing parsed bill file data'
                    });

                var BILLFILE_LINES = [];

                // prep the vendor lines
                Current.BILLFILE.JSON.lines.forEach(function (billfileLine, idx) {
                    try {
                        ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                            if (billfileLine.hasOwnProperty(field))
                                billfileLine[field] = vc2_util.forceFloat(billfileLine[field]);
                            return true;
                        });
                        billfileLine.QUANTITY = vc2_util.forceInt(billfileLine.QUANTITY);
                        billfileLine.LINEIDX = idx;

                        util.extend(billfileLine, {
                            quantity: billfileLine.QUANTITY,
                            itemId: (billfileLine.NSITEM || '').toString(),
                            rate: billfileLine.BILLRATE || billfileLine.PRICE,

                            item: (billfileLine.NSITEM || '').toString(),
                            itemName: billfileLine.ITEMNO,
                            description: billfileLine.DESCRIPTION,
                            quantity: billfileLine.QUANTITY
                        });
                        billfileLine.amount = vc2_util.roundOff(
                            billfileLine.quantity * billfileLine.rate
                        );

                        // skip the line, if there are no ITEMNO
                        if (!billfileLine.ITEMNO) throw 'MISSING_ITEMNO';
                        // skip if no quantities
                        if (!billfileLine.quantity) return;
                    } catch (line_error) {
                        vc2_util.logError(logTitle, line_error);
                        billfileLine.Errors = vc2_util.extractError(line_error);
                        Helper.setError({
                            code: vc2_util.extractError(line_error),
                            details: billfileLine.ITEMNO || 'Line #' + (idx + 1)
                        });
                    } finally {
                        if (billfileLine.quantity) BILLFILE_LINES.push(billfileLine);
                    }

                    return true;
                });
                vc2_util.log(logTitle, '.. total bill lines: ', BILLFILE_LINES.length);
                if (vc2_util.isEmpty(BILLFILE_LINES))
                    Helper.setError({ code: 'MISSING_BILL_LINES' });

                Current.BILLFILE.LINES = BILLFILE_LINES;

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
                vc2_util.dumpLog(logTitle, Current.BILLFILE, 'BILLFILE');
            }

            /////////// EVAL /////////////
            var VC_STATUS = vc2_constant.Bill_Creator.Status;
            if (Current.BILLFILE.DATA.STATUS == VC_STATUS.CLOSED) {
                Current.STATUS.IsClosed = true;
                // Current.STATUS.IsProcessed = true;
            }
            if (Current.BILLFILE.DATA.STATUS == VC_STATUS.PROCESSED)
                Current.STATUS.IsProcessed = true;

            if (Current.BILLFILE.DATA.BILL_LINK) {
                Current.STATUS.IsProcessed = true;
                Current.STATUS.IsBillable = false;
            }

            if (Current.BILLFILE.DATA.PROC_VARIANCE) Current.STATUS.AllowVariance = true;

            if (Current.BILLFILE.JSON && Current.BILLFILE.JSON.ignoreVariance == 'T')
                Current.STATUS.IgnoreVariance = true;

            /////////// EVAL /////////////

            return returnValue;
        },
        loadPOData: function (option) {
            var logTitle = [LogTitle, 'loadPOData'].join('::'),
                returnValue = Current.PO.DATA;

            try {
                Current.PO.REC = option.recPO || option.recordPO || null;
                Current.PO.DATA = option.poData || option.orderData || {};
                Current.PO.ID = option.poId;

                if (vc2_util.isEmpty(Current.PO.DATA)) {
                    if (!Current.PO.REC) {
                        // get the PO Id from the BILL FILE Data
                        Current.PO.ID =
                            Current.PO.ID ||
                            (Current.BILLFILE.DATA && Current.BILLFILE.DATA.PO_LINK)
                                ? Current.BILLFILE.DATA.PO_LINK
                                : null;

                        if (!Current.PO.ID) throw 'MISSING_PO';
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

                if (vc2_util.isEmpty(Current.PO.REC)) return false;

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
                Current.TOTAL.SHIPPING = TotalShipping;

                if (!Current.STATUS.IsProcessed && Current.PO.DATA.isBillable) {
                    if (option.noBill) return;

                    /// ATTEMPT to PRE-CREATE the BILL
                    try {
                        var transformOption = {
                            fromType: 'purchaseorder',
                            fromId: Current.PO.ID,
                            toType: 'vendorbill',
                            isDynamic: true
                        };

                        if (Current.CFG.MainCFG && Current.CFG.MainCFG.defaultBillForm)
                            transformOption.customform = Current.CFG.MainCFG.defaultBillForm;

                        Current.BILL.REC = vc2_record.transform(transformOption);

                        if (Current.CFG.MainCFG && Current.CFG.MainCFG.defaultBillForm) {
                            Current.BILL.REC.setValue({
                                fieldId: 'customform',
                                value: Current.CFG.MainCFG.defaultBillForm
                            });
                        }

                        VC_BillProcess.loadBill({ recBill: Current.BILL.REC });
                    } catch (billcreate_error) {
                        vc2_util.logError(logTitle, billcreate_error);
                        Helper.setError({ code: vc2_util.extractError(billcreate_error) });
                    }
                } else if (Current.BILLFILE.DATA.BILL_LINK) {
                    /// ATTEMPT to LOAD THE Bill
                    try {
                        Current.BILL.REC = vc2_record.load({
                            type: 'vendorbill',
                            id: Current.BILLFILE.DATA.BILL_LINK
                        });

                        VC_BillProcess.loadBill({ recBill: Current.BILL.REC });
                    } catch (bilload_error) {
                        vc2_util.logError(logTitle, bilload_error);
                        Helper.setError({ code: vc2_util.extractError(bilload_error) });
                    }
                }
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: vc2_util.extractError(error) });
            } finally {
                vc2_util.log(logTitle, '## ', returnValue);
            }

            /////////// EVAL /////////////
            if (Current.PO.DATA.isClosed) {
                Helper.setError({
                    code: Current.PO.DATA.isFullyBilled ? 'FULLY_BILLED' : 'CLOSED_PO'
                });
                Current.STATUS.IsClosed = true;
                if (Current.PO.DATA.isFullyBilled) Current.STATUS.IsFullyBilled = true;
            }
            if (Current.PO.DATA.isReceivable) {
                Current.STATUS.IsReceivable = true;

                if (Current.CFG.BillCFG.enableFulfillment && Current.BILLFILE.DATA.IS_RCVBLE)
                    Current.STATUS.AllowToReceive = true;
            }
            /////////// EVAL /////////////

            return returnValue;
        },
        processBillFileLines: function (option) {
            var logTitle = [LogTitle, 'processBillFileLines'].join('::'),
                returnValue = Current.BILLFILE.LINES;

            try {
                if (!Current.PO.LINES) this.loadPOData(option);

                // Match the Order lines
                vc2_record.matchOrderLines({
                    orderLines: Current.PO.LINES,
                    vendorLines: Current.BILLFILE.LINES,
                    includeZeroQtyLines: true,
                    // includeUnbilledQty: true,
                    // includeFullyMatched: true,

                    billConfig: Current.CFG.BillCFG,
                    orderConfig: Current.CFG.OrderCFG,
                    mainConfig: Current.CFG.MainCFG
                });

                Current.BILLFILE.LINES.forEach(function (vendorLine, idx) {
                    util.extend(vendorLine, {
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

                            vendorLine.VarianceAmt = vc2_util.roundOff(
                                Math.abs(vendorLine.rate - orderLine.rate) * vendorLine.quantity
                            );
                            Current.TOTAL.VARIANCE += vendorLine.VarianceAmt;

                            Helper.setVariance('Price');
                        }
                        orderLine.RECEIVABLE = orderLine.quantity - orderLine.QTYRCVD;
                        orderLine.BILLABLE = orderLine.QTYRCVD - orderLine.QTYBILLED;

                        Current.TOTAL.POLINE_TOTAL += orderLine.amount;

                        /// Check if there any billable items
                        if (orderLine.RECEIVABLE <= 0 && orderLine.BILLABLE <= 0)
                            throw 'ITEMS_ALREADY_BILLED';

                        // if not enough billable
                        if (orderLine.BILLABLE < vendorLine.quantity) {
                            // fulfillment is enabled //
                            if (
                                Current.CFG.BillCFG.enableFulfillment &&
                                Current.PO.DATA.isReceivable &&
                                Current.BILLFILE.DATA.IS_RCVBLE
                            ) {
                                if (orderLine.RECEIVABLE < vendorLine.quantity)
                                    throw 'INSUFFICIENT_QUANTITY';
                            } else if (orderLine.BILLABLE > 0) throw 'INSUFFICIENT_QUANTITY';
                            else throw 'ITEM_NOT_BILLABLE';
                        }
                    } catch (line_error) {
                        var errorCode = vc2_util.extractError(line_error);
                        vc2_util.logError(logTitle, line_error);

                        Helper.setError({ code: errorCode, details: vendorLine.itemName });
                        vendorLine.Errors.push(errorCode);
                    } finally {
                        vc2_util.log(logTitle, '## Bill Line [' + (idx + 1) + '] ', vendorLine);
                    }
                });
            } catch (error) {
                var errorCode = vc2_util.extractError(error);
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: error });
            }

            /////////// EVAL /////////////

            if (!vc2_util.isEmpty(Current.PO.REC)) {
                var isTrulyFullyBilled = true, // if all of the items are billed
                    isBillable = true;
                Current.BILLFILE.LINES.forEach(function (vendorLine) {
                    // vc2_util.log(logTitle, '.. qty check: ', {
                    //     qty: vendorLine.quantity,
                    //     applied: vendorLine.APPLIEDQTY,
                    //     avail: vendorLine.AVAILQTY,
                    //     orderBLD: vendorLine.OrderLine.QTYBILLED,
                    //     orderBLE: vendorLine.OrderLine.BILLABLE
                    // });

                    // if (vendorLine.OrderLine.BILLABLE || vendorLine.OrderLine.RECEIVABLE)
                    //     isTrulyFullyBilled = false;

                    // 20
                    // 10 | 0 | 0 = NOT BILLABLE - NOT BILLED
                    // 10 | 10 | 0 = BILLABLE  - NOT BILLED
                    // 10 | 10 | 10 = NOT BILLABLE - BILLED

                    if (vendorLine.quantity >= vendorLine.OrderLine.QTYBILLED)
                        isTrulyFullyBilled = false;

                    // if (vendorLine.OrderLine.BILLABLE) isTrulyFullyBilled = false;
                    // if (!vendorLine.OrderLine.AVAILQTY) isBillable = false;
                });
                if (isTrulyFullyBilled) Current.STATUS.IsFullyBilled = true;
                if (isBillable) Current.STATUS.IsBillable = true;
            }
            /////////// EVAL /////////////

            return returnValue;
        },
        loadVarianceConfig: function () {
            var logTitle = [LogTitle, 'loadVarianceConfig'].join('::'),
                returnValue = {};

            try {
                if (vc2_util.isEmpty(Current.CFG.MainCFG))
                    Current.CFG.MainCFG = vcs_configLib.mainConfig();

                vc2_util.log(logTitle, '// CFG: ', Current.CFG);

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
            } finally {
                vc2_util.log(logTitle, '// CFG: ', Current.CFG);
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

                // if (!Current.PO.DATA) return false;
                // if (!Current.PO.DATA.isBillable) return false;
                if (!Current.BILL.REC) throw 'Bill is not provided';

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

                Current.BILL.LINES =
                    vc2_record.extractRecordLines({
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
                    }) || [];
                Current.BILL.LINES.forEach(function (billLine) {
                    billLine.itemId = billLine.item;
                    billLine.TOTALTAX = vc2_util.roundOff(Helper.calculateLineTax(billLine));
                });
                Current.TOTAL.BILL_TAX = Current.BILL.DATA.TOTALTAX;
                Current.TOTAL.BILL_TOTAL = Current.BILL.DATA.total;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: vc2_util.extractError(error) });
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

                if (!Current.PO.DATA) return false;
                if (!Current.PO.DATA.isBillable) return false;
                if (!Current.BILL.REC) return false;

                vc2_util.log(logTitle, '(pre) BILL DATA: ', [
                    Current.BILL.LINES.length,
                    Current.BILL.DATA
                ]);

                if (!Current.BILLFILE.LINES) throw 'Missing billfile lines';

                var appliedLinesColl = {};
                var ChargesDEF = Current.CFG.ChargesDEF || {};
                Current.BILLFILE.LINES.forEach(function (billfileLine) {
                    vc2_util.log(logTitle, '// MATCHED BILL LINES: ', billfileLine);

                    (billfileLine.MATCHING || []).forEach(function (orderLine) {
                        var matchedBillLine = vc2_util.findMatching({
                            dataSet: Current.BILL.LINES,
                            filter: {
                                orderline: orderLine.line + 1
                            }
                        });

                        if (!vc2_util.isEmpty(matchedBillLine)) {
                            appliedLinesColl[matchedBillLine.line] = util.extend(
                                util.extend(
                                    matchedBillLine,
                                    vc2_util.extractValues({
                                        source: orderLine,
                                        params: ['APPLIEDQTY', 'AVAILQTY']
                                    })
                                ),
                                vc2_util.extractValues({
                                    source: billfileLine,
                                    params: ['BILLRATE', 'PRICE', 'TRACKING']
                                })
                            );
                        }
                    });
                });

                vc2_util.log(logTitle, '// applied bill lines: ', appliedLinesColl);
                for (var line = Current.BILL.LINES.length - 1; line >= 0; line--) {
                    var billLineValues = vc2_record.extractLineValues({
                            record: Current.BILL.REC,
                            sublistId: 'item',
                            line: line,
                            columns: ['line', 'item', 'quantity', 'rate']
                        }),
                        vendorLineValues = Current.BILL.LINES[line];

                    var isLineIncluded = appliedLinesColl[line],
                        isShippingLine =
                            billLineValues.item_text.match(/shipping|freight/gi) ||
                            (ChargesDEF.shipping &&
                                ChargesDEF.shipping.item &&
                                ChargesDEF.shipping.item == billLineValues.item);

                    if (isLineIncluded) {
                        vc2_util.log(logTitle, '... adding line: ', [
                            billLineValues,
                            vendorLineValues,
                            appliedLinesColl[line]
                        ]);

                        Current.BILL.REC.selectLine({ sublistId: 'item', line: line });
                        Current.BILL.REC.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: vendorLineValues.BILLRATE || vendorLineValues.PRICE
                        });
                        Current.BILL.REC.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: vendorLineValues.APPLIEDQTY
                        });
                        Current.BILL.REC.commitLine({ sublistId: 'item' });
                    } else if (isShippingLine) {
                        vc2_util.log(logTitle, '... adding shipping line: ', [
                            billLineValues,
                            vendorLineValues
                        ]);
                    } else {
                        vc2_util.log(logTitle, '.... removing line: ', billLineValues.item_text);
                        Current.BILL.REC.removeLine({ sublistId: 'item', line: line });
                    }
                }

                // // reload the bill data
                this.loadBill();
            } catch (error) {
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: vc2_util.extractError(error) });
            }

            return returnValue;
        },
        processCharges: function (option) {
            var logTitle = [LogTitle, 'processCharges'].join('::'),
                returnValue = Current.VARLINES;

            try {
                var ChargesCFG = Current.CFG.ChargesDEF || {};
                vc2_util.log(logTitle, '## Charges: ', [
                    Current.CHARGES,
                    ChargesCFG,
                    Current.TOTAL
                ]);

                for (var type in ChargesCFG) {
                    var chargeInfo = ChargesCFG[type],
                        chargeAmount = Current.CHARGES[type] || 0;

                    // prep the charge line
                    var chargeLine = vc2_util.extend(
                            { type: type, amount: chargeAmount },
                            chargeInfo
                        ),
                        varianceLine = vc2_util.findMatching({
                            dataSet: Current.BILLFILE.JSON.variance_lines || [],
                            filter: { type: chargeInfo.name || type }
                        });

                    // vc2_util.log(logTitle, '// charge line (pre):  ', [
                    //     chargeAmount,
                    //     chargeInfo,
                    //     chargeLine,
                    //     varianceLine
                    // ]);

                    switch (type) {
                        case ChargeType.TAX:
                            var taxVarianceAmt = vc2_util.roundOff(
                                chargeAmount - Current.TOTAL.BILL_TAX
                            );

                            util.extend(
                                chargeLine,
                                varianceLine || { rate: taxVarianceAmt, amount: taxVarianceAmt }
                            );

                            chargeLine.applied = ChargesCFG[type].enabled
                                ? chargeLine.applied
                                : 'F';

                            if (chargeLine.applied == 'T') Current.TOTAL.VARIANCE += taxVarianceAmt;
                            if (Math.abs(taxVarianceAmt)) Helper.setVariance('Tax');

                            break;
                        case ChargeType.SHIP:
                            var shipVarianceAmt = vc2_util.roundOff(
                                chargeAmount - Current.TOTAL.SHIPPING
                            );
                            util.extend(
                                chargeLine,
                                varianceLine || { rate: shipVarianceAmt, amount: shipVarianceAmt }
                            );

                            chargeLine.applied = ChargesCFG[type].enabled
                                ? chargeLine.applied
                                : 'F';

                            if (chargeLine.applied == 'T')
                                Current.TOTAL.VARIANCE += shipVarianceAmt;

                            if (Math.abs(shipVarianceAmt)) Helper.setVariance('Shipping');

                            break;
                        case ChargeType.OTHER:
                        case ChargeType.MISC:
                            var otherVarianceAmt = chargeAmount - Current.TOTAL.CHARGES;

                            util.extend(
                                chargeLine,
                                varianceLine || { rate: otherVarianceAmt, amount: otherVarianceAmt }
                            );

                            chargeLine.applied = ChargesCFG[type].enabled
                                ? chargeLine.applied
                                : 'F';

                            if (chargeLine.applied == 'T')
                                Current.TOTAL.VARIANCE += otherVarianceAmt;

                            if (Math.abs(otherVarianceAmt)) Helper.setVariance('Other Charges');

                            break;
                    }

                    vc2_util.log(logTitle, '// charge line:  ', [chargeLine]);
                    Current.VARLINES.push(chargeLine);
                }
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
                Helper.setError({ code: vc2_util.extractError(error) });
            }

            return returnValue;
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
            var logTitle = [LogTitle, 'reportError'].join(': ');
            if (!Current.STATUS.HasErrors || vc2_util.isEmpty(Current.Error)) return false;

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

                if (!vc2_util.isEmpty(Current.Error[errorCode])) {
                    errorObj.details = util.isArray(Current.Error[errorCode])
                        ? Current.Error[errorCode].join(', ')
                        : Current.Error[errorCode];
                }
            }

            return errorObj;
        },
        searchExistingBills: function (option) {
            var logTitle = [LogTitle, 'searchExistingBills'].join('::'),
                returnValue;
            option = option || {};

            var entityId = option.entity || (Current.PO.DATA ? Current.PO.DATA.entity : null),
                invoiceNo =
                    option.invoiceNo ||
                    (Current.BILLFILE.DATA ? Current.BILLFILE.DATA.invoice : null);

            vc2_util.log(logTitle, '// Search for existing bills: ', [entityId, invoiceNo, option]);
            if (!entityId || !invoiceNo)
                throw (
                    'Missing bill identifier: ' +
                    JSON.stringify({ entity: entityId, invoice: invoiceNo })
                );

            var arrExistingBills = [];
            var vendorbillSearchObj = ns_search.create({
                type: 'vendorbill',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['mainname', 'anyof', entityId],
                    'AND',
                    ['numbertext', 'is', invoiceNo],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid', 'tranid']
            });

            vendorbillSearchObj.run().each(function (result) {
                arrExistingBills.push(result.getValue('internalid'));
                return true;
            });

            vc2_util.log(logTitle, '>> Existing Bill: ', arrExistingBills || '-none-');
            returnValue = arrExistingBills;

            return returnValue;
        },
        addBillLines: function (option) {
            var logTitle = [LogTitle, 'addBillLines'].join('::'),
                returnValue = null;
            option = option || {};
            try {
                var varLines = option.varLines || Current.VARLINES;
                if (vc2_util.isEmpty(Current.BILL.REC)) throw 'Missing vendor bill record';
                if (vc2_util.isEmpty(varLines)) throw 'Missing vendor bill charges';

                (varLines || []).forEach(function (lineData) {
                    if (!vc2_util.isTrue(lineData.enabled)) return;
                    if (!vc2_util.isTrue(lineData.applied)) return;
                    if (lineData.amount <= 0) return;

                    try {
                        var newLine = vc2_record.addLine({
                            record: Current.BILL.REC,
                            lineData: vc2_util.extend(
                                vc2_util.extractValues({
                                    source: lineData,
                                    params: ['item', 'description', 'rate', 'quantity']
                                }),

                                Current.PO.DATA.entity
                            )
                        });
                    } catch (error) {
                        Helper.setError({
                            errorCode: 'UNABLE_TO_ADD_VARIANCE_LINE',
                            details: lineData.name
                        });
                    }
                });
            } catch (error) {
                // collect all the errors
                vc2_util.logError(logTitle, error);
            }
            return true;
        }
    };

    var Helper = {
        dumpCurrentData: function (option) {
            vc2_util.log(LogTitle, '###### DATA DUMP:start ######');
            ['PO', 'BILLFILE', 'BILL'].forEach(function (name) {
                // vc2_util.dumpLog(LogTitle, Current[name].DATA, '##--[' + name + ']--##');
                // vc2_util.dumpLog(LogTitle, Current[name].LINES, '##--[' + name + ']--##');
            });
            vc2_util.dumpLog(
                LogTitle,
                vc2_util.extractValues({
                    source: Current,
                    params: [
                        'TOTAL',
                        'STATUS',
                        'CHARGES',
                        'VarianceList',
                        'ErrorList',
                        'Error',
                        'VARLINES'
                        // 'CFG'
                    ]
                })
            );
            vc2_util.log(LogTitle, '###### DATA DUMP:end ######');
        },
        setError: function (option) {
            var logTitle = [LogTitle, 'setError'].join(': ');

            var errorCode = option.code || option.errorCode,
                errorDetails = option.details;

            vc2_util.logError(logTitle, option);

            // Add to the Error Code collection
            if (!Current.Error[errorCode]) Current.Error[errorCode] = [];
            if (!vc2_util.isEmpty(errorDetails)) {
                if (!vc2_util.inArray(errorDetails, Current.Error[errorCode]))
                    Current.Error[errorCode].push(errorDetails);
            }
            // Add to the error lists
            if (!vc2_util.inArray(errorCode, Current.ErrorList)) Current.ErrorList.push(errorCode);

            Current.STATUS.HasErrors = true;
            Current.STATUS.AllowToBill = false;

            return true;
        },
        setVariance: function (variance) {
            vc2_util.log('setVariance', '!! VARiANCE !!', [variance, Current.VarianceList]);

            if (!vc2_util.inArray(variance, Current.VarianceList))
                Current.VarianceList.push(variance);

            Current.STATUS.HasVariance = true;
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
