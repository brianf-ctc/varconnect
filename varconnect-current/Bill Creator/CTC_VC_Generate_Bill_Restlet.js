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
    vc_constants,
    vc_util,
    vc_recordlib,
    vc_mainCfg,
    moment
) {
    var LOG_TITLE = 'VC_GENR_BILL_RL',
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
        BILL_CREATOR = vc_constants.Bill_Creator;

    var VARIANCE_DEF = {},
        VARIANCE_TYPE = {
            MISC: 'miscCharges',
            TAX: 'tax',
            SHIP: 'shipping',
            OTHER: 'other'
        };

    var RESTLET = {
        post: function (context) {
            var logTitle = [LOG_TITLE, 'POST'].join('::'),
                returnObj = {};

            try {
                log.debug(logTitle, LogPrefix + 'Request: ' + JSON.stringify(context));

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
                log.debug(logTitle, LogPrefix + 'Params: ' + JSON.stringify(Current.Config));

                util.extend(Current.varianceParam, {
                    allowedThreshold: parseFloat(Current.Config.allowedThreshold || '0')
                });

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
                    }
                };

                ///////////////////
                if (!Current.poId) {
                    returnObj.details = ' PO ID:' + Current.poId + ' is missing or inactive.';
                    throw BILL_CREATOR.Code.MISSING_PO;
                }
                ///////////////////
                LogPrefix = '[purchaseorder:' + Current.poId + '] ';

                Current.PO_REC = vc_recordlib.load({
                    type: 'purchaseorder',
                    id: Current.poId
                });

                Current.PO_DATA = vc_recordlib.extractValues({
                    record: Current.PO_REC,
                    fields: ['tranid', 'entity', 'taxtotal', 'tax2total', 'status', 'statusRef']
                });

                Current.PO_DATA.taxTotal =
                    parseFloat(Current.PO_DATA.taxtotal || 0) +
                    parseFloat(Current.PO_DATA.tax2total || 0);

                log.debug(
                    logTitle,
                    LogPrefix + '>> Current.PO_DATA: ' + JSON.stringify(Current.PO_DATA)
                );
                /////////////////////////////////////////////

                /// STATUS CHECK ////////////////////////////
                if (
                    vc_util.inArray(Current.PO_DATA.statusRef, [
                        'pendingBilling',
                        'pendingBillPartReceived'
                    ]) ||
                    Current.billInAdvance
                ) {
                    // continue processing
                    log.debug(logTitle, LogPrefix + '>> PO is ready for billing: ');
                } else {
                    /// not ready for billing!
                    log.debug(
                        logTitle,
                        LogPrefix + '>>  Skipping poId, Purchase Order not Ready to Bill'
                    );

                    util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                    returnObj.details = [
                        'PO #' + Current.tranid,
                        ' - : ' + Current.PO_DATA.status
                    ].join('');

                    return returnObj;
                }
                ///////////////////////////////////

                Current.PayloadData = JSON.parse(context.custrecord_ctc_vc_bill_json);
                log.debug(
                    logTitle,
                    LogPrefix + '>> Bill Payload:' + JSON.stringify(Current.PayloadData)
                );

                util.extend(Current.varianceParam, {
                    varianceLines: Current.PayloadData.varianceLines,
                    ignoreVariance:
                        Current.PayloadData.hasOwnProperty('ignoreVariance') &&
                        (Current.PayloadData.ignoreVariance == 'T' ||
                            Current.PayloadData.ignoreVariance === true)
                });

                /// FIND EXISTING BILLS ////////////////////////////
                log.debug(logTitle, LogPrefix + ' // Checking for existing bills...');

                var arrExistingBills = Helper.getExistingBill({
                    entity: Current.PO_DATA.entity,
                    invoiceNo: Current.PayloadData.invoice
                });

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

                // /// VALIDATE REMAING ITEMS TO BILL /////////////////////////
                // var arrLinesToBill = Helper.getLinesToBill({
                //     payload: Current.PayloadData,
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

                log.debug(logTitle, transformOption);
                log.debug(logTitle, Current.Config);

                if (Current.Config.defaultBillForm) {
                    transformOption.customform = Current.Config.defaultBillForm;
                }

                log.debug(
                    logTitle,
                    LogPrefix +
                        '***** Vendor Bill record creation:start *****' +
                        JSON.stringify(transformOption)
                );

                Current.BILL_REC = vc_recordlib.transform(transformOption);

                if (Current.Config.defaultBillForm) {
                    Current.BILL_REC.setValue({
                        fieldId: 'customform',
                        value: Current.Config.defaultBillForm
                    });
                }

                // store the current posting period
                var currentPostingPeriod = Current.BILL_REC.getValue({ fieldId: 'postingperiod' });
                log.debug(
                    logTitle,
                    LogPrefix + '>> posting period: ' + JSON.stringify(currentPostingPeriod)
                );

                Current.BILL_REC.setValue({
                    fieldId: 'trandate',
                    value: ns_format.parse({
                        value: moment(Current.PayloadData.date).toDate(),
                        type: ns_format.Type.DATE
                    })
                });
                if (Current.PayloadData.duedate) {
                    Current.BILL_REC.setValue({
                        fieldId: 'duedate',
                        value: ns_format.parse({
                            value: moment(Current.PayloadData.duedate).toDate(),
                            type: ns_format.Type.DATE
                        })
                    });
                }

                //// CHECK THE POSTING PERIOD ////////////////
                var isPeriodLocked = Helper.isPeriodLocked({ recordBill: Current.BILL_REC });
                if (isPeriodLocked) {
                    // set to original period
                    Current.BILL_REC.setValue({
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }
                ///////////////////////////////////

                log.debug(logTitle, '.. set invoice name: ' + Current.PayloadData.invoice);
                Current.BILL_REC.setValue({
                    fieldId: 'tranid',
                    value: Current.PayloadData.invoice
                });

                /// VALIDATE THE LINES /////////////
                var lineCount = Current.BILL_REC.getLineCount({ sublistId: 'item' });

                log.debug(
                    logTitle,
                    'Matching vb-to-payload lines...line count: ' +
                        JSON.stringify({
                            vbLines: lineCount,
                            payloadLines: Current.PayloadData.lines.length
                        })
                );

                var i, j, ii, jj;
                //// LINES PROCESSING //////////////////////////////////////////
                log.debug(logTitle, LogPrefix + '/// LINES PROCESSING...');

                // run through the billfile lines
                var arrLines = Helper.preprocessBillLines(),
                    unmatchedLines = [],
                    insufficientQuantity = [];

                for (i = 0, j = arrLines.length; i < j; i++) {
                    var lineInfo = arrLines[i];

                    if (!lineInfo.matchingLines || !lineInfo.matchingLines.length) {
                        unmatchedLines.push(lineInfo);
                        break;
                    }

                    log.debug(
                        logTitle,
                        LogPrefix + '>> current line:  ' + JSON.stringify(lineInfo)
                    );

                    var totalLineQty = 0;
                    lineInfo.QUANTITY = parseFloat(lineInfo.QUANTITY);

                    for (ii = 0, jj = lineInfo.matchingLines.length; ii < jj; ii++) {
                        var matchedLine = lineInfo.matchingLines[ii];

                        log.debug(
                            logTitle,
                            LogPrefix + '....>> matched line:  ' + JSON.stringify(matchedLine)
                        );

                        if (
                            vc_util.forceFloat(lineInfo.PRICE) !=
                            vc_util.forceFloat(matchedLine.rate)
                        ) {
                            Current.varianceParam.listVariance.push('Price');
                            Current.varianceParam.hasVariance = true;
                        }

                        // merge the bills
                        vc_recordlib.updateLine({
                            record: Current.BILL_REC,
                            lineData: {
                                line: matchedLine.line,
                                rate:
                                    ii == 0
                                        ? parseFloat(lineInfo.PRICE || lineInfo.PRICE || '0')
                                        : 0,
                                quantity: ii == 0 ? lineInfo.QUANTITY : 0 // only apply on the first matched line
                            }
                        });

                        var billLineData = vc_recordlib.extractLineValues({
                            record: Current.BILL_REC,
                            line: matchedLine.line,
                            columns: ['amount', 'taxrate1', 'taxrate2']
                        });

                        log.debug(
                            logTitle,
                            LogPrefix + '....>> updated line:  ' + JSON.stringify(billLineData)
                        );
                        log.debug(
                            logTitle,
                            LogPrefix + '....>> TOTALS:  ' + JSON.stringify(Current.TOTALS)
                        );

                        Current.TOTALS.LINE_AMOUNT += billLineData.amount;
                        Current.TOTALS.TAX_AMOUNT += Helper.calculateLineTax(billLineData);

                        totalLineQty += matchedLine.quantity;
                    }

                    lineInfo.QUANTITY = lineInfo.QUANTITY - totalLineQty;
                    if (lineInfo.QUANTITY) {
                        Current.varianceParam.listVariance.push('Quantity');
                        Current.varianceParam.hasVariance = true;

                        insufficientQuantity.push(lineInfo);
                        break;
                    }

                    lineInfo.processed = true;
                }
                log.debug(
                    logTitle,
                    LogPrefix +
                        '>> Lines: ' +
                        JSON.stringify({
                            lines: arrLines,
                            unmatched: unmatchedLines,
                            missingQty: insufficientQuantity
                        })
                );

                Current.TOTALS.AMOUNT = Current.TOTALS.LINE_AMOUNT + Current.TOTALS.TAX_AMOUNT;

                log.debug(
                    logTitle,
                    LogPrefix +
                        '....>> Totals:  ' +
                        JSON.stringify({
                            lineAmount: Current.TOTALS.LINE_AMOUNT,
                            lineTax: Current.TOTALS.TAX_AMOUNT,
                            Total: Current.TOTALS.AMOUNT
                        })
                );

                ///////////////////////////////
                if (unmatchedLines && unmatchedLines.length) {
                    returnObj.details =
                        'Bills has unmatched items not found in the bill: ' +
                        unmatchedLines[0].ITEMNO;
                    throw BILL_CREATOR.Code.NOT_FULLY_PROCESSED;
                }

                if (insufficientQuantity && insufficientQuantity.length) {
                    returnObj.details =
                        'Not enough billable quantity for the following items: ' +
                        insufficientQuantity
                            .map(function (el) {
                                return el.ITEMNO;
                            })
                            .join(', ');

                    throw BILL_CREATOR.Code.INSUFFICIENT_QUANTITY;
                }

                log.debug(
                    logTitle,
                    LogPrefix +
                        '.. matched lines for the Bill - ' +
                        JSON.stringify(Current.MatchedLines)
                );
                Helper.removeUnmatchedLines();
                ////////////////////////////////////////////////////////////////

                //// VARIANCE LINES PROCESSING /////////////////////////////////
                log.debug(logTitle, LogPrefix + '//// Variance Processing... ');

                util.extend(Current.varianceParam, {
                    totalVarianceAmount: 0,
                    hasVariance: false,
                    allowVariance: false
                });

                var arrVarianceLines = Helper.preprocessVarianceLines(Current.varianceParam);
                for (i = 0, j = arrVarianceLines.length; i < j; i++) {
                    var varianceLine = arrVarianceLines[i];
                    if (!varianceLine.item) continue;

                    lineData = vc_util.extend(varianceLine, {
                        applied: 'T',
                        amount: varianceLine.amount || varianceLine.rate,
                        rate: varianceLine.amount || varianceLine.rate
                    });

                    if (lineData.applied == 'F' || lineData.rate == 0) continue;

                    log.debug(
                        logTitle,
                        LogPrefix + '>>> charge line Data: ' + JSON.stringify(lineData)
                    );

                    var newLine = vc_recordlib.addLine({
                        record: Current.BILL_REC,
                        lineData: vc_util.extend(lineData, {
                            customer: Current.SO_DATA.entity
                        })
                    });

                    var newLineData = vc_recordlib.extractLineValues({
                        record: Current.BILL_REC,
                        line: newLine,
                        columns: ['amount', 'taxrate1', 'taxrate2']
                    });

                    Current.varianceParam.totalVarianceAmount += newLineData.amount;
                }
                Current.TOTALS.VARIANCE_AMT = Current.varianceParam.totalVarianceAmount;

                // calculate the adjustment
                Current.varianceParam.adjustment =
                    Current.PayloadData.total -
                    (Current.TOTALS.AMOUNT + Current.TOTALS.VARIANCE_AMT);

                Current.varianceParam.adjustment = vc_util.roundOff(
                    Current.varianceParam.adjustment
                );

                if (Current.varianceParam.adjustment != 0) {
                    Current.varianceParam.hasVariance = true;
                    vc_recordlib.addLine({
                        record: Current.BILL_REC,
                        lineData: vc_util.extend(VARIANCE_DEF.miscCharges, {
                            rate: Current.varianceParam.adjustment,
                            quantity: 1,
                            customer: Current.SO_DATA.entity,
                            description: 'VC | Adjustment'
                        })
                    });

                    Current.varianceParam.allowVariance = Current.varianceParam.allowedThreshold
                        ? Math.abs(Current.varianceParam.adjustment) <=
                          Math.abs(Current.varianceParam.allowedThreshold)
                        : false;
                }

                log.debug(
                    logTitle,
                    LogPrefix + '>> variance params: ' + JSON.stringify(Current.varianceParam)
                );

                /**
                    If variance is detected, check if there's a variance threshold, 
                        if it exceeded the threshold, dont post
                        if it is less than, allow bill creation
                 */

                if (Current.varianceParam.hasVariance && !Current.processVariance) {
                    util.extend(returnObj, BILL_CREATOR.Code.HAS_VARIANCE);
                    var listVariance = vc_util.uniqueArray(Current.varianceParam.listVariance);

                    returnObj.details = listVariance ? listVariance.join(', ') : '';
                    returnObj.msg += '\n' + returnObj.details;

                    if (
                        Current.varianceParam.allowedThreshold &&
                        !Current.varianceParam.allowVariance
                    ) {
                        returnObj.msg +=
                            '\nVariance Total exceeded the allowable threshold: ' +
                            JSON.stringify({
                                total: Current.varianceParam.adjustment,
                                threshold: Current.varianceParam.allowedThreshold
                            });
                        return returnObj;
                    } else if (!Current.varianceParam.allowedThreshold) {
                        return returnObj;
                    }
                }
                ////////////////////////////////////////////////////////////////

                log.debug(logTitle, '** Saving the bill record ** ');

                // attempt to save the record ////
                Current.BILL_REC.setValue({
                    fieldId: 'approvalstatus',
                    value: Current.Config.billDefaultStatus || 1
                }); // defaults to pending approval

                // Bill Save is disabled
                if (Current.Config.dontSaveBill) {
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATE_DISABLED);
                    return returnObj;
                }

                var newRecordId = Current.BILL_REC.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (newRecordId) {
                    log.debug(
                        logTitle,
                        '>>> Bill Created succesfully...' +
                            [Current.tranid, Current.PayloadData.invoice]
                    );

                    returnObj = JSON.parse(JSON.stringify(Current.BILL_REC));
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATED);

                    if (
                        Current.varianceParam.allowedThreshold &&
                        Current.varianceParam.allowVariance
                    ) {
                        returnObj.msg +=
                            '\nVariance total is within the allowable threshold.' +
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
                        JSON.stringify({ id: newRecordId, name: Current.PayloadData.invoice });
                } else {
                    log.debug(
                        logTitle,
                        '// bill creation fail...' + [Current.tranid, Current.PayloadData.invoice]
                    );
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_NOT_CREATED);
                    return returnObj;
                }

                return returnObj;
            } catch (error) {
                returnObj.msg = error.msg || vc_util.extractError(error);
                returnObj.details = returnObj.details || vc_util.extractError(error);
                returnObj.status = error.status || BILL_CREATOR.Status.ERROR;
                returnObj.isError = true;
                returnObj.msg = [
                    returnObj.msg,
                    returnObj.details != returnObj.msg ? returnObj.details : ''
                ].join(' ');

                log.debug(logTitle, '## ERROR ## ' + JSON.stringify(returnObj));
            } finally {
                log.debug(logTitle, '## EXIT SCRIPT ## ' + JSON.stringify(returnObj));
            }

            return returnObj;
        }
    };

    var Helper = {
        getLinesToBill: function (option) {
            var logTitle = [LOG_TITLE, 'getLinesToBill'].join('::'),
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

                log.audit(logTitle, '...>> vbline: ' + JSON.stringify(vbLineData));

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

            log.audit(logTitle, '>> Lines To Bill: ' + JSON.stringify(arrLinesToBill));
            returnValue = arrLinesToBill;

            return returnValue;
        },
        getExistingBill: function (option) {
            var logTitle = [LOG_TITLE, 'getExistingBill'].join('::'),
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

            log.audit(
                logTitle,
                LogPrefix + '>> Existing Bill: ' + JSON.stringify(arrExistingBills)
            );
            returnValue = arrExistingBills;

            return returnValue;
        },
        getSalesOrderDetails: function (option) {
            var logTitle = [LOG_TITLE, 'getSalesOrderDetails'].join('::'),
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
                log.audit(
                    logTitle,
                    LogPrefix +
                        ('>> PO: ' + JSON.stringify(poDetails)) +
                        ('<br />\nSO: ' + JSON.stringify(soDetails))
                );
                returnValue = soDetails;
            }
            return returnValue;
        },
        isPeriodLocked: function (option) {
            var logTitle = [LOG_TITLE, 'isPeriodLocked'].join('::'),
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
            log.audit(logTitle, LogPrefix + '>> isPeriodLocked? ' + JSON.stringify(isLocked));
            returnValue = isLocked;

            return returnValue;
        },
        addNewLine: function (option) {
            var logTitle = [LOG_TITLE, 'addNewLine'].join('::'),
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
            log.audit(logTitle, LogPrefix + '>> added new line: ' + JSON.stringify(option));
            return returnValue;
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

                applyTax: mainConfig.isVarianceOnTax,
                taxItem: mainConfig.defaultTaxItem,
                taxItem2: mainConfig.defaultTaxItem2,
                applyShip: mainConfig.isVarianceOnShipping,
                shipItem: mainConfig.defaultShipItem,
                applyOther: mainConfig.isVarianceOnOther,
                otherItem: mainConfig.defaultOtherItem,

                hasTaxVariance: mainConfig.isVarianceOnTax,
                taxItem: mainConfig.defaultTaxItem,
                hasShippingVariance: mainConfig.isVarianceOnShipping,
                shipItem: mainConfig.defaultShipItem,
                hasOtherVariance: mainConfig.isVarianceOnOther,
                otherItem: mainConfig.defaultOtherItem,
                dontSaveBill: mainConfig.isBillCreationDisabled
            };
        },
        preprocessBillLines: function (option) {
            var logTitle = [LOG_TITLE, 'preprocessBillLines'].join('::');
            var arrLines = [],
                MatchedBillLines = {};

            if (!Current.BILL_REC) return false;

            log.audit(logTitle, LogPrefix + '// Look for matched bill lines...');

            var i, j, ii, jj, lineInfo, matchingLines, matchedLine, logPrefix;

            for (i = 0, j = Current.PayloadData.lines.length; i < j; i++) {
                lineInfo = util.extend({}, Current.PayloadData.lines[i]);
                if (!lineInfo.NSITEM) continue;

                logPrefix = LogPrefix + ' [item:' + lineInfo.ITEMNO + '] ';
                log.audit(logTitle, logPrefix + '>> lineData: ' + JSON.stringify(lineInfo));

                lineInfo.matchingLines = [];

                if (Current.BILL_REC) {
                    matchingLines =
                        vc_recordlib.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineInfo.NSITEM,
                                rate: parseFloat(lineInfo.BILLRATE || lineInfo.PRICE),
                                quantity: lineInfo.QUANTITY
                            }
                        }) ||
                        // if none found, search for matching item, rate
                        vc_recordlib.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineInfo.NSITEM,
                                rate: parseFloat(lineInfo.BILLRATE || lineInfo.PRICE)
                            }
                        }) ||
                        // if none found, search for matching item, qty
                        vc_recordlib.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineInfo.NSITEM,
                                quantity: lineInfo.QUANTITY
                            }
                        });

                    for (ii = 0, jj = matchingLines ? matchingLines.length : 0; ii < jj; ii++) {
                        matchedLine = matchingLines[ii];
                        // skip if this was matched previously
                        if (MatchedBillLines[matchedLine.line]) continue;

                        MatchedBillLines[matchedLine.line] = matchedLine;
                        lineInfo.matchingLines.push(matchedLine);

                        log.audit(
                            logTitle,
                            logPrefix + '>> matchedLine: ' + JSON.stringify(matchedLine)
                        );
                    }
                }

                arrLines.push(lineInfo);
            }

            log.audit(
                logTitle,
                LogPrefix + '/// Look for bill lines that doesnt have direct matches...'
            );

            // do a second round, and look for unmatched lines
            for (i = 0, j = arrLines.length; i < j; i++) {
                lineInfo = arrLines[i];

                logPrefix = LogPrefix + ' [item:' + lineInfo.ITEMNO + '] ';

                if (lineInfo.matchingLines && lineInfo.matchingLines.length) continue;

                // look for matched lines with same item only
                matchingLines = vc_recordlib.extractRecordLines({
                    record: Current.BILL_REC,
                    findAll: true,
                    filter: { item: lineInfo.NSITEM }
                });

                for (ii = 0, jj = matchingLines ? matchingLines.length : 0; ii < jj; ii++) {
                    matchedLine = matchingLines[ii];

                    // skip if this line is already matched
                    if (MatchedBillLines[matchedLine.line]) continue;

                    arrLines[i].matchingLines.push(matchedLine);
                    MatchedBillLines[matchedLine.line] = matchedLine;

                    log.audit(
                        logTitle,
                        logPrefix + '>> matchedLine: ' + JSON.stringify(matchedLine)
                    );
                }
            }

            Current.MatchedLines = MatchedBillLines;
            return arrLines;
        },
        removeUnmatchedLines: function (option) {
            var logTitle = [LOG_TITLE, 'removeUnmatchedLines'].join('::');

            if (!Current.BILL_REC) return false;
            var lineCount = Current.BILL_REC.getLineCount({ sublistId: 'item' });

            // var arrLineData = vc_recordlib.extractRecordLines({
            //     record: Current.BILL_REC,
            //     findAll: true,
            //     columns: ['item', 'rate', 'amount', 'quantity']
            // });

            // log.audit(logTitle, LogPrefix + '>>arrLineData: ' + JSON.stringify(arrLineData));

            // do it backwards
            for (var line = lineCount - 1; line >= 0; line--) {
                var lineValues = vc_recordlib.extractLineValues({
                    record: Current.BILL_REC,
                    line: line,
                    columns: ['item', 'rate', 'amount', 'quantity']
                });
                lineValues.line = line;

                if (!Current.MatchedLines[line] || lineValues.quantity == 0) {
                    log.audit(
                        logTitle,
                        LogPrefix +
                            '... non-matching found!:  ' +
                            JSON.stringify([lineValues, Current.MatchedLines[line]])
                    );

                    try {
                        Current.BILL_REC.removeLine({ sublistId: 'item', line: line });
                        log.audit(logTitle, '... removed line');
                    } catch (remove_err) {
                        log.audit(
                            logTitle,
                            LogPrefix + '## REMOVE ERROR ## ' + JSON.stringify(remove_err)
                        );
                    }
                }
            }
            return true;
        },

        preprocessVarianceLines: function (option) {
            var logTitle = [LOG_TITLE, 'preprocessVarianceLines'].join('::');

            // check for the variance lines
            var arrVarianceLines = [];
            for (var varTypeName in VARIANCE_TYPE) {
                var varType = VARIANCE_TYPE[varTypeName];
                var logPrefix = LogPrefix + '[' + varType + '] ';

                var varianceInfo = VARIANCE_DEF[varType] || {},
                    chargeInfo = Current.PayloadData.charges[varType],
                    matchingVarianceLine = vc_util.findMatchingEntry({
                        dataSet: Current.PayloadData.varianceLines,
                        filter: { type: varType }
                    });

                log.audit(
                    logTitle,
                    logPrefix +
                        '// variance info: ' +
                        JSON.stringify({
                            varianceInfo: varianceInfo,
                            chargeInfo: chargeInfo,
                            matchingVarianceLine: matchingVarianceLine
                        })
                );

                if (!vc_util.isEmpty(varianceInfo) && !varianceInfo.enabled) continue; // skip
                varianceInfo.type = varType;

                switch (varType) {
                    case VARIANCE_TYPE.MISC:
                        (chargeInfo || []).forEach(function (miscCharge) {
                            // look for any existing varianceLine
                            var matchingMiscLine = vc_util.findMatchingEntry({
                                dataSet: Current.PayloadData.varianceLines,
                                filter: {
                                    type: varType,
                                    description: miscCharge.description
                                }
                            });

                            // add it to our variance lines
                            arrVarianceLines.push(
                                vc_util.extend(varianceInfo, matchingMiscLine || miscCharge)
                            );
                        });

                        break;
                    case VARIANCE_TYPE.TAX:
                        // get the diff from TAX TOTAL, and TAX CHARGES
                        var taxVariance = vc_util.extend(
                            varianceInfo,
                            matchingVarianceLine || {
                                rate: vc_util.roundOff(chargeInfo - Current.TOTALS.TAX_AMOUNT),
                                amount: vc_util.roundOff(chargeInfo - Current.TOTALS.TAX_AMOUNT)
                            }
                        );
                        arrVarianceLines.push(taxVariance);

                        if (chargeInfo != Current.TOTALS.TAX_AMOUNT) {
                            Current.varianceParam.listVariance.push('Tax');
                        }

                        break;
                    case VARIANCE_TYPE.SHIP:
                        var shipVariance = vc_util.extend(
                            varianceInfo,
                            matchingVarianceLine || {
                                rate: vc_util.roundOff(chargeInfo - Current.TOTALS.SHIP_AMOUNT),
                                amount: vc_util.roundOff(chargeInfo - Current.TOTALS.SHIP_AMOUNT)
                            }
                        );
                        arrVarianceLines.push(shipVariance);

                        if (chargeInfo != Current.TOTALS.SHIP_AMOUNT) {
                            Current.varianceParam.listVariance.push('Shipping');
                        }

                        break;
                    case VARIANCE_TYPE.OTHER:
                    case VARIANCE_TYPE.ADJ:
                        arrVarianceLines.push(
                            vc_util.extend(
                                varianceInfo,
                                matchingVarianceLine || {
                                    rate: chargeInfo,
                                    amount: chargeInfo
                                }
                            )
                        );

                        break;
                }
            }

            return arrVarianceLines;
        },

        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return vc_util.roundOff(taxAmount) || 0;
        }
    };

    return RESTLET;
});
