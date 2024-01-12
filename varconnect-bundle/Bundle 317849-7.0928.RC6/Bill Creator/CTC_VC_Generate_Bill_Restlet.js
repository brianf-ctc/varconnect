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
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Restlet
 */
define([
    'N/record',
    'N/search',
    'N/format',
    'N/runtime',
    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record',
    './../CTC_VC_Lib_MainConfiguration',
    './Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    ns_runtime,
    vc2_constant,
    vc2_util,
    vc_recordlib,
    vc_mainCfg,
    moment
) {
    var LogTitle = 'VC BILL CREATE RL',
        VCLOG_APPNAME = 'VAR Connect | Process Bill',
        Current = {
            Config: {},
            TOTALS: {
                AMOUNT: 0,
                TAX_AMOUNT: 0,
                SHIP_AMOUNT: 0,
                LINE_AMOUNT: 0,
                VARIANCE_AMT: 0
            },
            varianceParam: {
                varianceLines: [],
                ignoreVariance: false,
                totalVarianceAmount: 0,
                allowedThreshold: 0,
                hasVariance: false,
                allowVariance: false,
                listVariance: []
            }
        },
        LogPrefix = '',
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS,
        BILL_CREATOR = vc2_constant.Bill_Creator;

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var VARIANCE_DEF = {},
        VARIANCE_TYPE = {
            MISC: 'miscCharges',
            TAX: 'tax',
            SHIP: 'shipping',
            OTHER: 'other',
            ADJ: 'adjustment'
        };

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            try {
                vc2_util.log(logTitle, '###########################################');
                vc2_util.log(logTitle, '### Request: ', context);

                util.extend(Current, {
                    poId:
                        context.custrecord_ctc_vc_bill_linked_po &&
                        context.custrecord_ctc_vc_bill_linked_po[0]
                            ? context.custrecord_ctc_vc_bill_linked_po[0].value
                            : false,
                    billInAdvance: context.billInAdvance || false,
                    processVariance: context.custrecord_ctc_vc_bill_proc_variance
                });

                Current.Config = Helper.loadBillingConfig();
                vc2_util.log(logTitle, '// CurrentConfig: ', Current.Config);

                util.extend(Current.varianceParam, {
                    allowedThreshold: parseFloat(Current.Config.allowedThreshold || '0'),
                    processVariance: Current.processVariance
                });

                // PREPARE VARIANCE APPLICATION
                VARIANCE_DEF = {
                    tax: {
                        name: 'Tax',
                        item: Current.Config.taxItem,
                        applied: Current.Config.applyTax ? 'T' : 'F',
                        enabled: Current.Config.applyTax,
                        description: 'VC | Tax Charges'
                    },
                    shipping: {
                        name: 'Shipping',
                        item: Current.Config.shipItem,
                        applied: Current.Config.applyShip ? 'T' : 'F',
                        enabled: Current.Config.applyShip,
                        description: 'VC | Shipping Charges'
                    },
                    other: {
                        name: 'Other Charges',
                        item: Current.Config.otherItem,
                        applied: Current.Config.applyOther ? 'T' : 'F',
                        enabled: Current.Config.applyOther,
                        description: 'VC | Other Charges'
                    },
                    miscCharges: {
                        name: 'Misc Charges',
                        item: Current.Config.otherItem,
                        applied: Current.Config.applyOther ? 'T' : 'F',
                        enabled: Current.Config.applyOther,
                        description: 'VC | Misc Charges'
                        // },
                        // adjustment: {
                        //     name: 'Adjustment',
                        //     item: Current.Config.otherItem,
                        //     applied: Current.Config.applyOther ? 'T' : 'F',
                        //     enabled: Current.Config.applyOther,
                        //     description: 'VC | Adjustment'
                    }
                };

                ///////////////////
                if (!Current.poId) {
                    returnObj.details = ' PO ID:' + Current.poId + ' is missing or inactive.';
                    throw BILL_CREATOR.Code.MISSING_PO;
                }
                ///////////////////
                LogPrefix = '[purchaseorder:' + Current.poId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                Current.PO_REC = vc_recordlib.load({
                    type: 'purchaseorder',
                    id: Current.poId
                });

                Current.PO_DATA = vc_recordlib.extractValues({
                    record: Current.PO_REC,
                    fields: ['tranid', 'entity', 'taxtotal', 'tax2total', 'status', 'statusRef']
                });
                Current.PO_DATA.taxtotal = parseFloat(Current.PO_DATA.taxtotal || 0);
                Current.PO_DATA.tax2total = parseFloat(Current.PO_DATA.tax2total || 0);
                Current.PO_DATA.taxTotal = Current.PO_DATA.taxtotal + Current.PO_DATA.tax2total;

                Current.JSON_DATA = vc2_util.safeParse(context.custrecord_ctc_vc_bill_json);

                util.extend(Current.PO_DATA, {
                    isReceivable: vc2_util.inArray(Current.PO_DATA.statusRef, [
                        'pendingReceipt',
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isPartiallyBilled: vc2_util.inArray(Current.PO_DATA.statusRef, [
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]),
                    isBillable: vc2_util.inArray(Current.PO_DATA.statusRef, [
                        'pendingBilling',
                        'pendingBillPartReceived'
                    ]),
                    isClosed: vc2_util.inArray(Current.PO_DATA.statusRef, [
                        'fullyBilled',
                        'closed'
                    ]),
                    isBillFileReceivable: context.custrecord_ctc_vc_bill_is_recievable
                });

                vc2_util.log(logTitle, '>> Current.PO_DATA: ', Current.PO_DATA);
                /////////////////////////////////////////////

                /////////////////
                var arrLinesPO = Helper.preprocessOrderLines();

                /// UNMATCHED items detected
                if (!vc2_util.isEmpty(arrLinesPO.unmatched)) {
                    return util.extend(returnObj, BILL_CREATOR.Code.UNMATCHED_ITEMS);
                }

                /// NO Receivable items
                if (vc2_util.isEmpty(arrLinesPO.receivable)) {
                    if (vc2_util.isEmpty(arrLinesPO.billable)) {
                        util.extend(returnObj, BILL_CREATOR.Code.ITEMS_ALREADY_BILLED);
                        return returnObj;
                    }
                    // else util.extend(returnObj, BILL_CREATOR.Code.NOT_FULLY_PROCESSED);
                } else {
                    util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                    return returnObj;
                }

                ////////////////

                Current.VendorCFG = Helper.loadVendorConfig({
                    entity: Current.PO_DATA.entity
                });
                vc2_util.log(logTitle, '>> Vendor Config: ', Current.VendorCFG);

                /// FIND EXISTING BILLS ////////////////////////////
                vc2_util.log(logTitle, ' // Checking for existing bills...');

                var arrExistingBills = Helper.getExistingBill({
                    entity: Current.PO_DATA.entity,
                    invoiceNo: Current.JSON_DATA.invoice
                });

                /// BILL ALREADY EXISTS //////////////////////
                if (arrExistingBills && arrExistingBills.length) {
                    var billRec = ns_record.load({
                        type: 'vendorbill',
                        id: arrExistingBills[0]
                    });

                    returnObj = JSON.parse(JSON.stringify(billRec));
                    returnObj.existingBills = JSON.stringify(arrExistingBills);
                    returnObj.details =
                        'Linked to existing bill (id:' + arrExistingBills[0] + ' ). ';
                    util.extend(returnObj, BILL_CREATOR.Code.EXISTING_BILLS);

                    return returnObj;
                }
                ///////////////////////////////////

                /// STATUS CHECK ////////////////////////////
                if (Current.PO_DATA.isBillable || Current.billInAdvance) {
                    // continue processing
                    vc2_util.log(logTitle, '>> PO is ready for billing. ');
                } else if (Current.PO_DATA.isClosed) {
                    /// Bill is already closed!
                    vc2_util.log(
                        logTitle,
                        '>>  Skipping poId, Purchase Order is Fully Billed / Closed'
                    );

                    if (Current.PO_DATA.statusRef == 'fullyBilled')
                        util.extend(returnObj, BILL_CREATOR.Code.FULLY_BILLED);
                    else util.extend(returnObj, BILL_CREATOR.Code.CLOSED_PO);

                    returnObj.details = [
                        'PO #' + Current.PO_DATA.tranid,
                        ' - : ' + Current.PO_DATA.status
                    ].join('');

                    return returnObj;
                } else if (Current.PO_DATA.statusRef == 'pendingReceipt') {
                    // not yet received initially, and not yet for billing
                    vc2_util.log(logTitle, '>>  Skipping poId, Purchase Order not Ready to Bill');

                    util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                    returnObj.details = [
                        'PO #' + Current.PO_DATA.tranid,
                        ' - : ' + Current.PO_DATA.status
                    ].join('');

                    return returnObj;
                    // } else {

                    //     /// not ready for billing!
                    //     vc2_util.log(logTitle, '>>  Skipping poId, Purchase Order not Ready to Bill');

                    //     util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                    //     returnObj.details = ['PO #' + Current.PO_DATA.tranid, ' - : ' + Current.PO_DATA.status].join('');

                    //     return returnObj;
                }
                ///////////////////////////////////
                ['shipping', 'other', 'tax'].forEach(function (chargeType) {
                    var chargeAmount = Current.JSON_DATA.charges[chargeType] || '0';
                    Current.JSON_DATA.charges[chargeType] = parseFloat(chargeAmount);
                    return true;
                });

                vc2_util.log(logTitle, '>> JSON DATA:', Current.JSON_DATA);

                util.extend(Current.varianceParam, {
                    varianceLines: Current.JSON_DATA.varianceLines || {},
                    ignoreVariance:
                        Current.JSON_DATA.hasOwnProperty('ignoreVariance') &&
                        (Current.JSON_DATA.ignoreVariance == 'T' ||
                            Current.JSON_DATA.ignoreVariance === true)
                });
                vc2_util.log(logTitle, '>> Current.varianceParam: ', Current.varianceParam);

                // /// VALIDATE REMAING ITEMS TO BILL /////////////////////////
                // var arrLinesToBill = Helper.getLinesToBill({
                //     payload: Current.JSON_DATA,
                //     record: Current.PO_REC
                // });
                // log.debug(logTitle, 'Lines to bill..' + JSON.stringify(arrLinesToBill));

                // if (!arrLinesToBill || !arrLinesToBill.length) {
                //     returnObj.details = 'All items on the bill are already billed.';
                //     util.extend(returnObj, BILL_CREATOR.Code.ITEMS_ALREADY_BILLED);
                //     return returnObj;
                // }
                // ///////////////////////////////////

                ///////////////////////////////////
                // Get sales order details
                Current.SO_DATA = Helper.getSalesOrderDetails({
                    poId: Current.poId
                });
                ///////////////////////////////////

                // var hasVariance = false,
                //     totalVarianceAmount = 0,
                //     listVarianceDetails = [],
                //     listVariance = [];

                //// TRANSFORM TO VENDOR BILL ////////////////
                var transformOption = {
                    fromType: 'purchaseorder',
                    fromId: Current.poId,
                    toType: 'vendorbill',
                    isDynamic: true
                };

                if (Current.Config.defaultBillForm) {
                    transformOption.customform = Current.Config.defaultBillForm;
                }

                vc2_util.log(
                    logTitle,
                    '***** Vendor Bill record creation:start *****',
                    transformOption
                );

                Current.POBILL_REC = vc_recordlib.transform(transformOption);

                if (Current.Config.defaultBillForm) {
                    Current.POBILL_REC.setValue({
                        fieldId: 'customform',
                        value: Current.Config.defaultBillForm
                    });
                }

                /// SET POSTING PERIOD
                var currentPostingPeriod = Current.POBILL_REC.getValue({
                    fieldId: 'postingperiod'
                });
                vc2_util.log(logTitle, '>> posting period: ', currentPostingPeriod);
                Current.POBILL_REC.setValue({
                    fieldId: 'trandate',
                    value: ns_format.parse({
                        value: moment(Current.JSON_DATA.date).toDate(),
                        type: ns_format.Type.DATE
                    })
                });
                if (Current.JSON_DATA.duedate) {
                    Current.POBILL_REC.setValue({
                        fieldId: 'duedate',
                        value: ns_format.parse({
                            value: moment(Current.JSON_DATA.duedate).toDate(),
                            type: ns_format.Type.DATE
                        })
                    });
                }

                //// CHECK THE POSTING PERIOD ////////////////
                var isPeriodLocked = Helper.isPeriodLocked({
                    recordBill: Current.POBILL_REC
                });
                if (isPeriodLocked) {
                    // set to original period
                    Current.POBILL_REC.setValue({
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }
                ///////////////////////////////////

                vc2_util.log(logTitle, '.. set invoice name: ', Current.JSON_DATA.invoice);
                Current.POBILL_REC.setValue({
                    fieldId: 'tranid',
                    value: Current.JSON_DATA.invoice
                });

                /// VALIDATE THE LINES /////////////
                var lineCount = Current.POBILL_REC.getLineCount({
                    sublistId: 'item'
                });

                vc2_util.log(logTitle, 'Matching vb-to-payload lines...line count: ', {
                    vbLines: lineCount,
                    payloadLines: Current.JSON_DATA.lines.length
                });

                //// LINES PROCESSING //////////////////////////////////////////
                vc2_util.log(logTitle, '============================= ');
                vc2_util.log(logTitle, '/// LINES PROCESSING...');

                // run through the billfile lines
                var arrBillLines = Helper.preprocessBillLines(),
                    unmatchedLines = [],
                    insufficientQty = [];

                // vc2_util.log(logTitle, '>> Bill Lines : ', arrBillLines);

                var LinesToBill = {};

                /// APPLY the lines to the Bill Lines
                arrBillLines.forEach(function (billLine) {
                    vc2_util.log(logTitle, '========= new line ========= ');
                    vc2_util.log(logTitle, '>>>> bill line:  ', billLine);

                    if (!billLine.matchingLines || !billLine.matchingLines.length) {
                        // check if the unmatched as amount
                        if (billLine.BILLRATE <= 0 || billLine.PRICE <= 0 || billLine.QUANTITY <= 0)
                            vc2_util.log(logTitle, '*** skipping unmatched line: Zero Price/Qty.');
                        else unmatchedLines.push(billLine);
                        return;
                    }

                    billLine.matchingLines.forEach(function (matchedLine) {
                        vc2_util.log(logTitle, ' ...matched item: ', matchedLine);

                        // variance detected: the rate not the same
                        if (billLine.rate != matchedLine.rate) {
                            Current.varianceParam.listVariance.push('Price');
                            Current.varianceParam.hasVariance = true;
                        }

                        if (!LinesToBill[matchedLine.line]) {
                            LinesToBill[matchedLine.line] = matchedLine;
                        } else return;

                        vc_recordlib.updateLine({
                            record: Current.POBILL_REC,
                            lineData: {
                                line: matchedLine.line,
                                rate: billLine.rate,
                                quantity: matchedLine.appliedqty
                            }
                        });

                        var billLineData = vc_recordlib.extractLineValues({
                            record: Current.POBILL_REC,
                            line: matchedLine.line,
                            columns: ['item', 'rate', 'quantity', 'amount', 'taxrate1', 'taxrate2']
                        });

                        vc2_util.log(logTitle, '>> billLineData:  ', billLineData);

                        LinesToBill[matchedLine.line].totalAmount = billLineData.amount;
                        LinesToBill[matchedLine.line].totalTaxAmt =
                            Helper.calculateLineTax(billLineData);

                        return true;
                    });

                    if (billLine.quantity > billLine.appliedqty) {
                        Current.varianceParam.listVariance.push('Quantity');
                        Current.varianceParam.hasVariance = true;
                        insufficientQty.push(billLine);
                    }

                    return true;
                });

                vc2_util.log(logTitle, '/// Billed Lines -- ', {
                    lines: LinesToBill,
                    unmatched: unmatchedLines,
                    missing: insufficientQty
                });

                /// calculate TOTALS
                for (var line in LinesToBill) {
                    Current.TOTALS.LINE_AMOUNT += LinesToBill[line].totalAmount;
                    Current.TOTALS.TAX_AMOUNT += LinesToBill[line].totalTaxAmt;
                }
                Current.TOTALS.AMOUNT = Current.TOTALS.LINE_AMOUNT + Current.TOTALS.TAX_AMOUNT;

                /// UNMATCHED ITEMS DETECTED ///////////
                if (unmatchedLines && unmatchedLines.length) {
                    returnObj.details =
                        'Bills has unmatched items not found in the bill: ' +
                        (function () {
                            var arrunmatched = [];
                            unmatchedLines.map(function (unmline) {
                                if (!vc2_util.inArray(unmline.ITEMNO, arrunmatched))
                                    arrunmatched.push(unmline.ITEMNO);
                            });

                            return arrunmatched.join(', ');
                        })();

                    throw BILL_CREATOR.Code.NOT_FULLY_PROCESSED;
                }

                /// INSUFFICIENT QTY FOR BILL ITEMS ////////
                if (insufficientQty && insufficientQty.length) {
                    returnObj.details =
                        'Not enough billable quantity for the following items: ' +
                        insufficientQty
                            .map(function (lineData) {
                                return lineData.item;
                            })
                            .join(', ');

                    throw BILL_CREATOR.Code.INSUFFICIENT_QUANTITY;
                }

                /// REMOVE ALL UNMATCHED LINES ////
                Helper.removeUnmatchedLines(LinesToBill);

                vc2_util.log(logTitle, '### TOTALS:  ', Current.TOTALS);
                vc2_util.log(
                    logTitle,
                    '>> Bill Lines: ',
                    vc_recordlib.extractRecordLines({
                        record: Current.POBILL_REC,
                        findAll: true,
                        columns: ['item', 'rate', 'quantity', 'amount']
                    })
                );
                ////////////////////////////////////////////////////////////////

                /// VARIANCE LINES PROCESSING /////////////////////////////////
                util.extend(Current.varianceParam, {
                    totalVarianceAmount: 0,
                    allowVariance: true
                });
                vc2_util.log(logTitle, '/// Variance Processing... ', Current.varianceParam);

                var arrVarianceLines = Helper.preprocessVarianceLines(Current.varianceParam);
                vc2_util.log(logTitle, '... variance lines : ', arrVarianceLines);

                for (i = 0, j = arrVarianceLines.length; i < j; i++) {
                    var varianceLine = arrVarianceLines[i];

                    var lineData = vc2_util.extend(varianceLine, {
                        // applied: 'T',
                        amount: varianceLine.amount || varianceLine.rate,
                        rate: varianceLine.amount || varianceLine.rate
                    });
                    Current.varianceParam.totalVarianceAmount += lineData.amount;

                    if (lineData.applied == 'F' || lineData.rate == 0) continue;
                    if (!varianceLine.item) continue;

                    vc2_util.log(logTitle, '>>> charge line Data: ', [lineData, varianceLine]);
                    var newLine;
                    try {
                        newLine = vc_recordlib.addLine({
                            record: Current.POBILL_REC,
                            lineData: vc2_util.extend(lineData, {
                                customer: Current.SO_DATA.entity
                            })
                        });
                    } catch (line_err) {
                        returnObj.details = varianceLine.name;
                        throw BILL_CREATOR.Code.UNABLE_TO_ADD_VARIANCE_LINE;
                    }

                    // var newLineData = vc_recordlib.extractLineValues({
                    //     record: Current.POBILL_REC,
                    //     line: newLine,
                    //     columns: ['amount', 'taxrate1', 'taxrate2']
                    // });
                }
                Current.TOTALS.VARIANCE_AMT = Current.varianceParam.totalVarianceAmount;

                vc2_util.log(logTitle, '// TOTALS (after variance): ', Current.TOTALS);
                vc2_util.log(logTitle, '// Current.varianceParam: ', Current.varianceParam);

                if (!Current.varianceParam.ignoreVariance) {
                    var adjustmentLine =
                        vc2_util.findMatching({
                            dataSet: arrVarianceLines,
                            filter: { type: 'adjustment' }
                        }) || {};

                    // var ``

                    // calculate the adjustment

                    Current.varianceParam.adjustment =
                        Current.JSON_DATA.total -
                        (Current.TOTALS.AMOUNT + Current.TOTALS.VARIANCE_AMT);
                    Current.varianceParam.adjustment = vc2_util.roundOff(
                        Current.varianceParam.adjustment
                    );

                    vc2_util.log(logTitle, '// calculate adjustment: ', {
                        adj: Current.varianceParam.adjustment,
                        billTotal: Current.JSON_DATA.total,
                        poTotal: Current.TOTALS.AMOUNT,
                        totalVariance: Current.TOTALS.VARIANCE_AMT
                    });

                    if (Current.varianceParam.adjustment != 0) {
                        // if (Current.TOTALS.VARIANCE_AMT != 0) {
                        Current.varianceParam.hasVariance = true;

                        if (Current.varianceParam.adjustment) {
                            vc_recordlib.addLine({
                                record: Current.POBILL_REC,
                                lineData: vc2_util.extend(VARIANCE_DEF.miscCharges, {
                                    rate: Current.varianceParam.adjustment,
                                    quantity: 1,
                                    customer: Current.SO_DATA.entity,
                                    description: 'VC | Adjustment'
                                })
                            });

                            Current.varianceParam.totalVarianceAmount +=
                                Current.varianceParam.adjustment;
                        }

                        Current.varianceParam.allowVariance = Current.varianceParam.allowedThreshold
                            ? Math.abs(Current.varianceParam.adjustment) <=
                              Math.abs(Current.varianceParam.allowedThreshold)
                            : false;
                    }
                }

                vc2_util.log(logTitle, '>> variance params: ', Current.varianceParam);

                /**
                    If variance is detected, check if there's a variance threshold, 
                        if it exceeded the threshold, dont post
                        if it is less than, allow bill creation
                 */

                if (
                    Current.varianceParam.hasVariance &&
                    !(
                        Current.varianceParam.allowVariance ||
                        Current.varianceParam.processVariance ||
                        Current.varianceParam.ignoreVariance
                    )
                ) {
                    util.extend(returnObj, BILL_CREATOR.Code.HAS_VARIANCE);
                    var listVariance = vc2_util.uniqueArray(Current.varianceParam.listVariance);

                    returnObj.details = listVariance ? listVariance.join(', ') : '';
                    returnObj.msg += returnObj.details ? ' [' + returnObj.details + '] ' : '';

                    if (
                        Current.varianceParam.allowedThreshold &&
                        !Current.varianceParam.allowVariance
                    ) {
                        returnObj.msg +=
                            ' Variance Total exceeded the allowable threshold: ' +
                            JSON.stringify({
                                total: Current.varianceParam.adjustment,
                                threshold: Current.varianceParam.allowedThreshold
                            });
                    }
                    return returnObj;
                }
                ////////////////////////////////////////////////////////////////

                vc2_util.log(logTitle, '** Saving the bill record ** ');

                // attempt to save the record ////
                Current.POBILL_REC.setValue({
                    fieldId: 'approvalstatus',
                    value: Current.Config.billDefaultStatus || 1
                }); // defaults to pending approval

                // Bill Save is disabled
                if (Current.Config.dontSaveBill) {
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATE_DISABLED);
                    return returnObj;
                }

                // set the createdby field
                Current.POBILL_REC.setValue({
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                var newRecordId = Current.POBILL_REC.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (newRecordId) {
                    vc2_util.log(logTitle, '>>> Bill Created succesfully...', [
                        Current.PO_DATA.tranid,
                        Current.JSON_DATA.invoice
                    ]);

                    returnObj = JSON.parse(JSON.stringify(Current.POBILL_REC));
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATED);

                    if (
                        Current.varianceParam.allowedThreshold &&
                        Current.varianceParam.allowVariance
                    ) {
                        returnObj.msg +=
                            ' Variance total is within the allowable threshold.' +
                            JSON.stringify({
                                total: Current.varianceParam.totalVarianceAmount,
                                threshold: Current.varianceParam.allowedThreshold
                            });
                    }

                    if (
                        Current.varianceParam.varianceLines &&
                        Current.varianceParam.varianceLines.length
                    ) {
                        returnObj.varianceLines = Current.varianceParam.varianceLines;
                    }

                    returnObj.details =
                        'Linked to vendor bill ' +
                        JSON.stringify({
                            id: newRecordId,
                            name: Current.JSON_DATA.invoice
                        });
                } else {
                    vc2_util.log(logTitle, '// bill creation fail...', [
                        Current.PO_DATA.tranid,
                        Current.JSON_DATA.invoice
                    ]);
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_NOT_CREATED);
                    // return returnObj;
                }

                return returnObj;
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ## ', error);
                returnObj.msg = error.msg || vc2_util.extractError(error);
                returnObj.details = returnObj.details || vc2_util.extractError(error);
                returnObj.status = error.status || BILL_CREATOR.Status.ERROR;
                returnObj.isError = true;
                if (error.logstatus) returnObj.logstatus = error.logstatus;
                returnObj.msg = [
                    returnObj.msg,
                    returnObj.details != returnObj.msg ? returnObj.details : ''
                ].join(' ');

                vc2_util.log(logTitle, '## ERROR ## ', returnObj);
            } finally {
                if (returnObj.logstatus) {
                    vc2_util.log(logTitle, '**** vc log (finally) ***', returnObj);
                    vc2_util.vcLog({
                        title: 'Process Bill' + (returnObj.isError ? '| Error' : ''),
                        message: returnObj.msg,
                        logStatus: returnObj.logstatus,
                        recordId: Current.poId
                    });
                }

                vc2_util.log(logTitle, '## EXIT SCRIPT ## ', returnObj);
            }

            return returnObj;
        }
    };

    var Helper = {
        getLinesToBill: function (option) {
            var logTitle = [LogTitle, 'getLinesToBill'].join('::'),
                returnValue;
            option = option || {};

            var arrLinesToBill = [];

            var record = option.record,
                billPayload = option.payload;

            var lineCount = record.getLineCount({ sublistId: 'item' });
            var hasFoundLines = false;
            for (var line = 0; line < lineCount; line++) {
                var lineData = vc_recordlib.extractLineValues({
                    record: record,
                    columns: ['item', 'rate', 'quantity', 'quantityreceived', 'quantitybilled']
                });
                lineData.line = line;

                lineData.remainingQty =
                    parseFloat(lineData.quantityreceived || '0') -
                    parseFloat(lineData.quantitybilled || '0');

                vc2_util.log(logTitle, '...>> vbline: ', vbLineData);

                billPayload.lines.forEach(function (lineBill) {
                    if (lineBill.NSITEM == lineData.item) hasFoundLines = true;
                    if (
                        lineBill.NSITEM == lineData.item &&
                        lineBill.QUANTITY <= lineData.remainingQty
                    ) {
                        arrLinesToBill.push(lineBill);
                    }

                    return true;
                });
            }

            if (!hasFoundLines) throw 'Unable to find matching lines';

            vc2_util.log(logTitle, '>> Lines To Bill: ', arrLinesToBill);
            returnValue = arrLinesToBill;

            return returnValue;
        },
        getExistingBill: function (option) {
            var logTitle = [LogTitle, 'getExistingBill'].join('::'),
                returnValue;
            option = option || {};
            var arrExistingBills = [];

            var vendorbillSearchObj = ns_search.create({
                type: 'vendorbill',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['mainname', 'anyof', option.entity],
                    'AND',
                    ['numbertext', 'is', option.invoiceNo],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid']
            });

            vendorbillSearchObj.run().each(function (result) {
                arrExistingBills.push(result.getValue('internalid'));
                return true;
            });

            // vc2_util.log(logTitle, '>> Existing Bill: ', arrExistingBills || '-none-');
            returnValue = arrExistingBills;

            return returnValue;
        },
        getSalesOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getSalesOrderDetails'].join('::'),
                returnValue;
            option = option || {};
            var poId = option.poId;
            if (poId) {
                var poDetails = ns_search.lookupFields({
                    type: 'transaction',
                    id: poId,
                    columns: ['createdfrom.entity']
                });
                var multiselectFields = ['createdfrom.entity'];
                var soDetails = {};
                for (var field in poDetails) {
                    var soFieldName = field;
                    if (field.indexOf('createdfrom.') == 0) {
                        soFieldName = field.substr(12);
                    }
                    if (
                        multiselectFields.indexOf(field) >= 0 &&
                        poDetails[field] &&
                        poDetails[field][0] &&
                        poDetails[field][0].value
                    ) {
                        soDetails[soFieldName] = poDetails[field][0].value;
                    } else {
                        soDetails[soFieldName] = poDetails[field];
                    }
                }

                vc2_util.log(logTitle, '... PO Details: ', poDetails);
                vc2_util.log(logTitle, '... SO Details: ', soDetails);

                returnValue = soDetails;
            }
            return returnValue;
        },
        isPeriodLocked: function (option) {
            var logTitle = [LogTitle, 'isPeriodLocked'].join('::'),
                returnValue;
            option = option || {};

            var recBill = option.recordBill;
            var isLocked = false;
            var periodValues = ns_search.lookupFields({
                type: ns_search.Type.ACCOUNTING_PERIOD,
                id: recBill.getValue({ fieldId: 'postingperiod' }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            isLocked = periodValues.aplocked || periodValues.alllocked || periodValues.closed;
            vc2_util.log(logTitle, '>> isPeriodLocked? ', isLocked);
            returnValue = isLocked;

            return returnValue;
        },
        addNewLine: function (option) {
            var logTitle = [LogTitle, 'addNewLine'].join('::'),
                returnValue;
            option = option || {};
            var record = option.record;

            if (!option.item) throw 'Missing item';

            record.selectNewLine({ sublistId: 'item' });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: option.item
            });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                value: option.description || 'VC New Line'
            });
            if (option.customer) {
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'customer',
                    value: option.customer
                });
            }
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: option.qty || 1
            });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: option.rate
            });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: option.rate
            });

            record.commitLine({ sublistId: 'item' });
            returnValue = true;

            vc2_util.log(logTitle, '>> added new line: ', option);
            return returnValue;
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        },
        loadBillingConfig: function () {
            var mainConfig = vc_mainCfg.getMainConfiguration();
            if (!mainConfig) {
                log.error('No Configuration available');
                throw new Error('No Configuration available');
            }
            return {
                defaultBillForm: mainConfig.defaultBillForm,
                billDefaultStatus: mainConfig.defaultVendorBillStatus,
                allowedThreshold: mainConfig.allowedVarianceAmountThreshold,

                applyTax: mainConfig.isVarianceOnTax || false,
                taxItem: mainConfig.defaultTaxItem,
                taxItem2: mainConfig.defaultTaxItem2,
                applyShip: mainConfig.isVarianceOnShipping || false,
                shipItem: mainConfig.defaultShipItem,
                applyOther: mainConfig.isVarianceOnOther || false,
                otherItem: mainConfig.defaultOtherItem,

                // hasTaxVariance: mainConfig.isVarianceOnTax || false,
                // taxItem: mainConfig.defaultTaxItem,
                // hasShippingVariance: mainConfig.isVarianceOnShipping || false,
                // shipItem: mainConfig.defaultShipItem,
                // hasOtherVariance: mainConfig.isVarianceOnOther || false,
                // otherItem: mainConfig.defaultOtherItem,
                dontSaveBill: mainConfig.isBillCreationDisabled || false
            };
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
                returnValue;
            var entityId = option.entity;
            var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

            try {
                var searchOption = {
                    type: 'vendor',
                    filters: [['internalid', 'anyof', entityId]],
                    columns: []
                };

                for (var field in BILLCREATE_CFG.FIELD) {
                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        })
                    );
                }

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count) throw 'No config available';

                returnValue = {};
                searchObj.run().each(function (row) {
                    for (var field in BILLCREATE_CFG.FIELD) {
                        returnValue[field] = row.getValue({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        });
                    }
                    return true;
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        preprocessOrderLines: function (option) {
            var logTitle = [LogTitle, 'preprocessOrderLines'].join('::'),
                arrLines = [],
                logPrefix = '';

            var lineColumns = ['item', 'quantity', 'quantityreceived', 'quantitybilled'];

            // fetch the bill lines
            var arrPOLines = Current.PO_REC
                ? vc_recordlib.extractRecordLines({
                      record: Current.PO_REC,
                      columns: lineColumns,
                      findAll: true
                  })
                : [];

            arrPOLines.forEach(function (poLine) {
                poLine.availableqty = poLine.quantity;
                poLine.appliedqty = 0;
                return true;
            });

            var unmatchedItems = [];

            // get the line items from bill data
            Current.JSON_DATA.lines.forEach(function (jsonLine, i) {
                logPrefix = '[ITEM:' + [jsonLine.ITEMNO, i].join(':') + '] ';
                // vc2_util.log(logTitle, logPrefix + '##############################');

                vc2_util.log(logTitle, logPrefix + '***** line: ', jsonLine);

                if (vc2_util.isEmpty(jsonLine.NSITEM)) {
                    unmatchedItems.push(jsonLine);
                    return;
                }

                jsonLine.QUANTITY = vc2_util.forceInt(jsonLine.QUANTITY);

                util.extend(jsonLine, {
                    item: jsonLine.ITEMNO,
                    nsitem: (jsonLine.NSITEM || '').toString(),
                    quantity: jsonLine.QUANTITY,
                    appliedqty: 0,
                    remainingqty: jsonLine.QUANTITY,
                    matchingLines: []
                });

                // look for matching lines on the vblines
                var matchingLines = {
                    fullyMatched:
                        vc2_util.findMatching({
                            dataSet: arrPOLines,
                            findAll: true,
                            filter: {
                                item: jsonLine.nsitem,
                                rate: jsonLine.rate,
                                quantity: jsonLine.quantity,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemRateMatch:
                        vc2_util.findMatching({
                            dataSet: arrPOLines,
                            findAll: true,
                            filter: {
                                item: jsonLine.nsitem,
                                rate: jsonLine.rate,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemMatch:
                        vc2_util.findMatching({
                            dataSet: arrPOLines,
                            findAll: true,
                            filter: {
                                item: jsonLine.nsitem,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || []
                };

                var fnExtactBilledQty = function (matchedLine) {
                    if (jsonLine.remainingqty <= 0) return; // skip if no more remaining billable qty
                    if (matchedLine.availableqty <= 0) return; // skip if no more available billable qty

                    var qtyToBill =
                        matchedLine.availableqty >= jsonLine.remainingqty
                            ? jsonLine.remainingqty //      if the availqty can cover all the remqty
                            : matchedLine.availableqty; //  get enough availqt to cover remqty

                    matchedLine.appliedqty += qtyToBill; // add to qpplied qty
                    jsonLine.appliedqty += qtyToBill; //    add to qpplied qty

                    matchedLine.availableqty -= qtyToBill; // deduct from available qty
                    jsonLine.remainingqty -= qtyToBill;

                    jsonLine.nsqty = (jsonLine.nsqty || 0) + matchedLine.quantity; // total nsqty for this item
                    jsonLine.nsrate = matchedLine.rate; //  (lineData.nsqty || 0) + matchedLine.quantity;

                    jsonLine.matchingLines.push(matchedLine);

                    return true;
                };

                /// run the same thing thru all of the matches, until all of the billdata.qt == billedqty
                matchingLines.fullyMatched.forEach(fnExtactBilledQty);
                matchingLines.itemRateMatch.forEach(fnExtactBilledQty);
                matchingLines.itemMatch.forEach(fnExtactBilledQty);

                arrLines.push(jsonLine);
                return true;
            });

            vc2_util.log(logTitle, '// PO Lines : ', arrLines);

            var arrResults = {
                unmatched: unmatchedItems,
                billable: [],
                receivable: []
            };
            arrLines.forEach(function (lineData) {
                (lineData.matchingLines || []).forEach(function (matchedLine, ii) {
                    lineData.receivedqty =
                        (lineData.receivedqty || 0) + matchedLine.quantityreceived;
                    lineData.billedqty = (lineData.billedqty || 0) + matchedLine.quantitybilled;
                    return true;
                });

                // the total received qty is less than the rquired
                if (lineData.quantity > lineData.receivedqty) arrResults.receivable.push(lineData);
                if (lineData.quantity > lineData.billedqty) arrResults.billable.push(lineData);

                vc2_util.log(logTitle, '// line for billing: ', lineData);
                return true;
            });

            vc2_util.log(logTitle, '// arrResults : ', arrResults);

            return arrResults;
        },
        preprocessBillLines: function (option) {
            var logTitle = [LogTitle, 'preprocessBillLines'].join('::'),
                arrLines = [],
                logPrefix = '';

            var lineColumns = [
                'item',
                'rate',
                'quantity',
                'amount',
                'taxrate',
                'taxrate1',
                'taxrate2',
                vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
            ];

            if (!Current.POBILL_REC) return false;

            // fetch the bill lines
            var arrBillLines = Current.POBILL_REC
                ? vc_recordlib.extractRecordLines({
                      record: Current.POBILL_REC,
                      columns: lineColumns,
                      findAll: true
                  })
                : [];

            arrBillLines.forEach(function (matchedLine) {
                matchedLine.availableqty = matchedLine.quantity;
                matchedLine.appliedqty = 0;
                return true;
            });

            // get the line items from bill data
            Current.JSON_DATA.lines.forEach(function (billLine, i) {
                logPrefix = '[ITEM:' + [billLine.ITEMNO, i].join(':') + '] ';

                // fix the values from the json content
                ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                    if (billLine.hasOwnProperty(field))
                        billLine[field] = vc2_util.forceFloat(billLine[field]);
                    return true;
                });
                billLine.QUANTITY = vc2_util.forceInt(billLine.QUANTITY);
                /////////////

                util.extend(billLine, {
                    item: billLine.ITEMNO,
                    nsitem: (billLine.NSITEM || '').toString(),
                    quantity: billLine.QUANTITY,
                    rate: billLine.BILLRATE || billLine.PRICE,

                    appliedqty: 0,
                    remainingqty: billLine.QUANTITY,
                    matchingLines: []
                });

                var vendorItemNameFilter = {
                    availableqty: function (value) {
                        return value > 0;
                    }
                };
                vendorItemNameFilter[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                    function (value) {
                        return value && vc2_util.inArray(billLine.nsitem, value.split('\n'));
                    };
                // look for matching lines on the vblines
                var matchingLines = {
                    fullyMatched:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.rate,
                                quantity: billLine.quantity,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemRateMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.rate,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: vendorItemNameFilter
                        }) ||
                        []
                };

                vc2_util.log(logTitle, logPrefix + '****  BILL LINE: ', billLine);
                // vc2_util.log(logTitle, logPrefix + '... matching lines: ', matchingLines);

                var fnExtactBilledQty = function (matchedLine) {
                    if (billLine.remainingqty <= 0) return; // skip if no more remaining billable qty
                    if (billLine.availableqty <= 0) return; // skip if no more available billable qty

                    var qtyToBill =
                        matchedLine.availableqty >= billLine.remainingqty
                            ? billLine.remainingqty //      if the availqty can cover all the remqty
                            : matchedLine.availableqty; //  get enough availqt to cover remqty

                    matchedLine.appliedqty += qtyToBill; // add to qpplied qty
                    billLine.appliedqty += qtyToBill; //    add to qpplied qty

                    matchedLine.availableqty -= qtyToBill; // deduct from available qty
                    billLine.remainingqty -= qtyToBill;

                    billLine.nsqty = (billLine.nsqty || 0) + matchedLine.quantity; // total nsqty for this item
                    billLine.nsrate = matchedLine.rate; //  (lineData.nsqty || 0) + matchedLine.quantity;

                    vc2_util.log(logTitle, logPrefix + '... matched: ', matchedLine);
                    billLine.matchingLines.push(matchedLine);

                    return true;
                };

                /// run the same thing thru all of the matches, until all of the billdata.qt == billedqty
                matchingLines.fullyMatched.forEach(fnExtactBilledQty);
                matchingLines.itemRateMatch.forEach(fnExtactBilledQty);
                matchingLines.itemMatch.forEach(fnExtactBilledQty);

                arrLines.push(billLine);
                return true;
            });

            return arrLines;
        },
        removeUnmatchedLines: function (linesToBill) {
            var logTitle = [LogTitle, 'removeUnmatchedLines'].join('::');

            if (!Current.POBILL_REC) return false;
            var lineCount = Current.POBILL_REC.getLineCount({
                sublistId: 'item'
            });

            // do it backwards
            for (var line = lineCount - 1; line >= 0; line--) {
                var lineValues = vc_recordlib.extractLineValues({
                    record: Current.POBILL_REC,
                    line: line,
                    columns: ['item', 'rate', 'amount', 'quantity']
                });
                lineValues.line = line;

                if (!linesToBill[line] || lineValues.quantity == 0) {
                    try {
                        Current.POBILL_REC.removeLine({
                            sublistId: 'item',
                            line: line
                        });
                        vc2_util.log(logTitle, '... removed line:  ', lineValues);
                    } catch (remove_err) {
                        vc2_util.logError(logTitle, remove_err);
                    }
                }
            }
            return true;
        },
        preprocessVarianceLines: function (option) {
            var logTitle = [LogTitle, 'preprocessVarianceLines'].join('::');

            // check for the variance lines
            var arrVarianceLines = [];
            for (var varTypeName in VARIANCE_TYPE) {
                var varType = VARIANCE_TYPE[varTypeName];
                var logPrefix = '[' + varType + '] ';

                // get the initial variance def for this type
                var varianceInfo = VARIANCE_DEF[varType] || {},
                    // get the charge amount
                    chargedAmt = Current.JSON_DATA.charges[varType],
                    // look for any updated varianceLines
                    matchingVarianceLine = vc2_util.findMatching({
                        dataSet: Current.JSON_DATA.varianceLines,
                        filter: { type: varType }
                    });

                vc2_util.log(logTitle, logPrefix + '.. variance data: ', {
                    info: varianceInfo,
                    amount: vc2_util.forceFloat(chargedAmt),
                    matching: matchingVarianceLine
                });

                // if (matchingVarianceLine.item) delete matchingVarianceLine.item;
                // if (!vc2_util.isEmpty(varianceInfo) && !varianceInfo.enabled) continue; // skip
                //
                if (vc2_util.isEmpty(varianceInfo)) continue; // skip
                if (!vc2_util.isEmpty(matchingVarianceLine)) {
                    matchingVarianceLine.rate = vc2_util.forceFloat(matchingVarianceLine.rate);
                    matchingVarianceLine.amount = vc2_util.forceFloat(matchingVarianceLine.amount);
                }

                varianceInfo.type = varType;
                switch (varType) {
                    case VARIANCE_TYPE.MISC:
                        (chargedAmt || []).forEach(function (miscCharge) {
                            // look for any existing varianceLine
                            var matchingMiscLine = vc2_util.findMatching({
                                dataSet: Current.JSON_DATA.varianceLines,
                                filter: {
                                    type: varType,
                                    description: miscCharge.description
                                }
                            });

                            // add it to our variance lines
                            arrVarianceLines.push(
                                vc2_util.extend(varianceInfo, matchingMiscLine || miscCharge)
                            );
                        });

                        break;
                    case VARIANCE_TYPE.TAX:
                        // get the diff from TAX TOTAL, and TAX CHARGES
                        var taxVariance = vc2_util.extend(varianceInfo, {
                            rate: vc2_util.roundOff(chargedAmt - Current.TOTALS.TAX_AMOUNT),
                            amount: vc2_util.roundOff(chargedAmt - Current.TOTALS.TAX_AMOUNT)
                        });
                        if (taxVariance.amount > 0) {
                            arrVarianceLines.push(taxVariance);
                            if (taxVariance.enabled) {
                                Current.varianceParam.listVariance.push('Tax');
                            }
                        }

                        break;
                    case VARIANCE_TYPE.SHIP:
                        var shipVariance = vc2_util.extend(
                            varianceInfo,
                            matchingVarianceLine || {
                                rate: vc2_util.roundOff(chargedAmt - Current.TOTALS.SHIP_AMOUNT),
                                amount: vc2_util.roundOff(chargedAmt - Current.TOTALS.SHIP_AMOUNT)
                            }
                        );
                        if (shipVariance.amount > 0) {
                            arrVarianceLines.push(shipVariance);
                            if (shipVariance.enabled) {
                                Current.varianceParam.listVariance.push('Shipping');
                            }
                        }

                        break;
                    case VARIANCE_TYPE.OTHER:
                    case VARIANCE_TYPE.ADJ:
                        arrVarianceLines.push(
                            vc2_util.extend(
                                varianceInfo,
                                matchingVarianceLine || {
                                    rate: chargedAmt,
                                    amount: chargedAmt
                                }
                            )
                        );

                        break;
                }

                vc2_util.log(logTitle, logPrefix + '//... variance line: ', {
                    chargeAmount: chargedAmt,
                    info: varianceInfo,
                    matchingLine: matchingVarianceLine,
                    lineToAdd: arrVarianceLines[arrVarianceLines.length - 1]
                });

                // vc2_util.log(logTitle, logPrefix + '//... chargeInfo: ', chargedAmt);
                // vc2_util.log(logTitle, logPrefix + '//... varianceInfo: ', varianceInfo);
                // vc2_util.log(logTitle, logPrefix + '//... matchingVarianceLine: ', matchingVarianceLine);
            }

            vc2_util.log(logTitle, '// variance info: ', arrVarianceLines);
            return arrVarianceLines;
        },
        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return vc2_util.roundOff(taxAmount) || 0;
        }
    };

    return RESTLET;
});
