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
var VCFolder = 'SuiteScripts/VCFolder/Bill Creator';
require([
    'N/record',
    'N/search',
    'N/format',
    'N/runtime',
    VCFolder + '/../CTC_VC2_Constants',
    VCFolder + '/../CTC_VC2_Lib_Utils',
    VCFolder + '/../CTC_VC_Lib_MainConfiguration',
    VCFolder + '/Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    ns_runtime,
    vc_constant,
    vc2_util,
    VC_MainCfg,
    moment
) {
    var LogTitle = 'VC_GENR_BILL_RL',
        LOG_APP = 'Bill Creator : Generate Bill (Restlet)',
        CURRENT_PO = '',
        Current = {},
        LogPrefix = '',
        BILL_CREATOR = vc_constant.Bill_Creator;

    function _post(context) {
        var logTitle = [LogTitle, 'POST'].join('::'),
            returnObj = {},
            currScript = ns_runtime.getCurrentScript();

        var param = Helper.getBillingConfig();

        try {
            log.audit(logTitle, LogPrefix + 'Params: ' + JSON.stringify(param));
            log.audit(logTitle, LogPrefix + 'Request: ' + context);

            Current = {
                poId:
                    context.custrecord_ctc_vc_bill_linked_po &&
                    context.custrecord_ctc_vc_bill_linked_po[0]
                        ? context.custrecord_ctc_vc_bill_linked_po[0].value
                        : false,
                billInAdvance: context.billInAdvance || false,
                processVariance: context.custrecord_ctc_vc_bill_proc_variance
            };

            ///////////////////
            if (!Current.poId) {
                returnObj.details = ' PO ID:' + Current.poId + ' is missing or inactive.';
                throw BILL_CREATOR.Code.MISSING_PO;
            }
            ///////////////////
            LogPrefix = '[purchaseorder:' + Current.poId + '] ';

            Current.PO_REC = RecordHelper.load({
                type: 'purchaseorder',
                id: Current.poId
            });

            Current.PO_DATA = RecordHelper.loadData({
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
                vc2_util.inArray(Current.PO_DATA.statusRef, [
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
            log.audit(
                logTitle,
                LogPrefix + '>> Bill Payload:' + JSON.stringify(Current.PayloadData)
            );

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
                returnObj.details = 'Linked to existing bill (id:' + arrExistingBills[0] + ' ). ';
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

            var hasVariance = false,
                totalVarianceAmount = 0,
                listVarianceDetails = [],
                listVariance = [];

            //// TRANSFORM TO VENDOR BILL ////////////////
            var transformOption = {
                fromType: 'purchaseorder',
                fromId: Current.poId,
                toType: 'vendorbill',
                isDynamic: true
            };

            if (param.defaultBillForm) {
                transformOption.customform = param.defaultBillForm;
            }

            log.debug(
                logTitle,
                LogPrefix +
                    '***** Vendor Bill record creation:start *****' +
                    JSON.stringify(transformOption)
            );

            Current.BILL_REC = RecordHelper.transform(transformOption);

            if (param.defaultBillForm) {
                Current.BILL_REC.setValue({ fieldId: 'customform', value: param.defaultBillForm });
            }

            // store the current posting period
            var currentPostingPeriod = Current.BILL_REC.getValue({ fieldId: 'postingperiod' });
            log.audit(
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

            // run through the billfile lines
            var arrLines = Helper.preprocessBillLines(),
                hasUnmatchedLines = false;

            for (var i = 0, j = arrLines.length; i < j; i++) {
                var lineData = arrLines[i];

                if (!lineData.matchingLinesBill || lineData.matchingLinesBill.length) {
                    hasUnmatchedLines = true;
                    continue;
                }

                for (var ii = 0, jj = lineData.matchingLinesBill.length; ii < jj; ii++) {
                    var matchedLine = lineData.matchingLinesBill[ii];

                    RecordHelper.updateLine({
                        record: Current.BILL_REC,
                        lineData: {
                            line: matchedLine.line,
                            rate: lineData.rate,
                            quantity: ii == 0 ? lineData.quantity : 0 // only apply on the first matched line
                        }
                    });
                }

                lineData.processed = true;
            }
            ///////////////////////////////
            return returnObj;

            var fileFullyProcessed = true;
            log.debug(logTitle, 'Checking unprocessed payload line...');
            Current.PayloadData.lines.forEach(function (line) {
                if (line.QUANTITY > 0) {
                    fileFullyProcessed = false;

                    returnObj.details = [
                        'Bill line quantity exceeds PO line quantity: ',
                        JSON.stringify({
                            item: line.ITEMNO,
                            qty: line.QUANTITY
                        })
                    ].join('');
                    log.debug(
                        logTitle,
                        '// line has remaining unprocessed qty' + JSON.stringify(line)
                    );
                }
            });

            if (!fileFullyProcessed) {
                throw BILL_CREATOR.Code.NOT_FULLY_PROCESSED;
            }

            arrLines.reverse();

            /// PROCESS THE LINES /////////////
            log.debug(logTitle, 'Validating lines to process: ' + JSON.stringify(arrLines));

            var taxTotal = 0;

            for (var lineVB = 0; lineVB < arrLines.length; lineVB++) {
                var lineDataVB = arrLines[lineVB],
                    lineVariance = [],
                    lineTaxTotal = 0;

                log_prefix = ['[line #', lineDataVB.lineNo, '] ...'].join('');
                log.debug(logTitle, log_prefix + 'Proceessing line: ' + JSON.stringify(lineDataVB));

                // remove line, if not included in the payload bill
                if (!lineDataVB.process || !lineDataVB.billQty || lineDataVB.billQty < 1) {
                    log.debug(logTitle, log_prefix + '// removing line, not part of the bill');
                    Current.BILL_REC.removeLine({
                        sublistId: 'item',
                        line: lineDataVB.lineNo
                    });
                    continue;
                }

                ////////////////
                Current.BILL_REC.selectLine({
                    sublistId: 'item',
                    line: lineDataVB.lineNo
                });
                var currentLineData = {
                    qty: Current.BILL_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    }),
                    rate: Current.BILL_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    }),
                    amount: Current.BILL_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount'
                    }),
                    taxrate1: Current.BILL_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate1'
                    }),
                    taxrate2: Current.BILL_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate2'
                    })
                };

                // calculate tax
                currentLineData.taxrate1 = util.isString(currentLineData.taxrate1)
                    ? parseFloat(currentLineData.taxrate1 || '0')
                    : currentLineData.taxrate1;
                if (currentLineData.taxrate1 > 0) {
                    currentLineData.taxAmount1 =
                        currentLineData.amount * (currentLineData.taxrate1 / 100);
                    lineTaxTotal += currentLineData.taxAmount1;
                }

                currentLineData.taxrate2 = util.isString(currentLineData.taxrate2)
                    ? parseFloat(currentLineData.taxrate2 || '0')
                    : currentLineData.taxrate2;
                if (currentLineData.taxrate2 > 0) {
                    currentLineData.taxAmount2 =
                        currentLineData.amount * (currentLineData.taxrate2 / 100);
                    lineTaxTotal += currentLineData.taxAmount2;
                }

                log.debug(
                    logTitle,
                    log_prefix + 'Checking for variance: ' + JSON.stringify(currentLineData)
                );

                /// LINE: QTY Variance /////////////////////
                ///////////////////////////////////
                if (lineDataVB.billQty != currentLineData.qty) {
                    log.debug(logTitle, log_prefix + '// bill quantity is > po quantity');

                    if (lineDataVB.billQty > currentLineData.qty) {
                        log.debug(logTitle, log_prefix + '// bill quantity is > po quantity');

                        lineVariance.push('Quantity');
                        listVariance.push('Quantity');

                        listVarianceDetails.push({
                            type: 'line',
                            label: 'Quantity',
                            diffQty: lineDataVB.billQty - currentLineData.qty,
                            diffAmount: Helper.roundOff(
                                (lineDataVB.billQty - currentLineData.qty) *
                                    (lineDataVB.billRate - currentLineData.rate)
                            )
                        });
                    } else {
                        Current.BILL_REC.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: lineDataVB.billQty
                        });
                    }
                }
                ///////////////////////////////////

                /// LINE: RATE Variance /////////////////////
                ///////////////////////////////////
                if (lineDataVB.billRate != currentLineData.rate) {
                    log.debug(logTitle, log_prefix + '// bill rate doesnt match po rate');

                    lineVariance.push('Price');
                    listVariance.push('Price');

                    Current.BILL_REC.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: lineDataVB.billRate
                    });

                    listVarianceDetails.push({
                        type: 'line',
                        label: 'Rate',
                        diffAmount: Helper.roundOff(lineDataVB.billRate - currentLineData.rate)
                    });
                }
                ///////////////////////////////////

                if (lineVariance.length) {
                    hasVariance = true;
                    Current.BILL_REC.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_create_bill_variance',
                        value: true
                    });
                    Current.BILL_REC.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_bill_variance_rsn',
                        value: lineVariance.join('\r\n')
                    });
                }

                taxTotal += lineTaxTotal;

                log.debug(logTitle, log_prefix + ' line tax total:  ' + lineTaxTotal);

                Current.BILL_REC.commitLine({ sublistId: 'item' });
            }
            ///////////////////////////////
            log.debug(
                logTitle,
                'Processing charges :  ' + JSON.stringify(Current.PayloadData.charges)
            );
            log.debug(logTitle, '// variances :  ' + JSON.stringify(Current.PayloadData.variance));

            taxTotal = Helper.roundOff(taxTotal) || 0;

            var vbTaxTotal =
                parseFloat(Current.BILL_REC.getValue({ fieldId: 'taxtotal' }) || 0) +
                parseFloat(Current.BILL_REC.getValue({ fieldId: 'tax2total' }) || 0);

            var deltaCharges = {
                tax: Helper.roundOff(Current.PayloadData.charges.tax - taxTotal)
            };

            log.debug(
                logTitle,
                'Tax Total: ' +
                    JSON.stringify({
                        lineTaxTotal: taxTotal,
                        vbTaxTotal: vbTaxTotal,
                        poTaxTotal: Current.taxTotal,
                        taxCharges: Current.PayloadData.charges.tax,
                        delta: deltaCharges.tax
                    })
            );

            var ignoreVariance =
                Current.PayloadData.hasOwnProperty('ignoreVariance') &&
                Current.PayloadData.ignoreVariance == 'T';

            log.audit(
                logTitle,
                '>> variance lines: ' + JSON.stringify(Current.PayloadData.varianceLines)
            );
            log.audit(logTitle, '>> variance: ' + JSON.stringify(Current.PayloadData.variance));

            var varianceLines = [];

            if (Current.PayloadData.varianceLines && Current.PayloadData.varianceLines.length) {
                hasVariance = true;

                Current.PayloadData.varianceLines.forEach(function (varianceData) {
                    if (varianceData.hasOwnProperty('applied') && varianceData.applied == 'T') {
                        listVariance.push(varianceData.name);
                        listVarianceDetails.push({
                            label: varianceData.name,
                            diffAmount: varianceData.rate
                        });

                        Helper.addNewLine({
                            record: Current.BILL_REC,
                            qty: 1,
                            description: varianceData.description,
                            item: varianceData.item,
                            rate: varianceData.rate,
                            customer: Current.SO_DATA.entity
                        });
                    }

                    return true;
                });
            } else {
                var varianceValues = Current.PayloadData.variance || {};

                var taxVariance = { apply: false, amount: 0 };
                var shipVariance = { apply: false, amount: 0 };
                var otherVariance = { apply: false, amount: 0 };
                var adjustmentVariance = { apply: false, amount: 0 };

                taxVariance.apply = param.hasTaxVariance;
                taxVariance.amount = deltaCharges.tax;
                if (varianceValues.hasOwnProperty('applyTax')) {
                    taxVariance.apply = varianceValues.applyTax == 'T';
                    taxVariance.amount = varianceValues.tax;
                }
                log.debug(logTitle, '>> taxVariance: ' + JSON.stringify(taxVariance));

                shipVariance.apply = param.hasShippingVariance;
                shipVariance.amount = Current.PayloadData.charges.shipping;
                if (varianceValues.hasOwnProperty('applyShip')) {
                    shipVariance.apply = varianceValues.applyShip == 'T';
                    shipVariance.amount = varianceValues.shipping;
                }
                log.debug(logTitle, '>> shipVariance: ' + JSON.stringify(shipVariance));

                otherVariance.apply = param.hasOtherVariance;
                otherVariance.amount = Current.PayloadData.charges.other;
                if (varianceValues.hasOwnProperty('applyShip')) {
                    otherVariance.apply = varianceValues.applyOther == 'T';
                    otherVariance.amount = varianceValues.other;
                }
                log.debug(logTitle, '>> otherVariance: ' + JSON.stringify(otherVariance));

                if (varianceValues.hasOwnProperty('applyAdjustment')) {
                    adjustmentVariance.apply = varianceValues.applyAdjustment == 'T';
                    adjustmentVariance.amount = varianceValues.adjustment;
                }
                log.debug(logTitle, '>> adjustmentVariance: ' + JSON.stringify(adjustmentVariance));

                if (!ignoreVariance && taxVariance.apply && taxVariance.amount) {
                    hasVariance = true;
                    listVariance.push('Tax');

                    listVarianceDetails.push({
                        label: 'Tax',
                        diffAmount: taxVariance.amount
                    });

                    try {
                        Helper.addNewLine({
                            record: Current.BILL_REC,
                            qty: 1,
                            description: 'VC: Tax Variance',
                            item: param.taxItem,
                            rate: taxVariance.amount,
                            customer: Current.SO_DATA.entity
                        });

                        varianceLines.push({
                            type: 'tax',
                            item: param.taxItem,
                            rate: taxVariance.amount,
                            quantity: 1
                        });
                    } catch (line_err) {
                        returnObj.details = Helper.extractError(line_err);
                        throw 'Unable to add tax variance line';
                    }
                }

                if (!ignoreVariance && shipVariance.apply && shipVariance.amount) {
                    hasVariance = true;
                    listVariance.push('Shipping');

                    listVarianceDetails.push({
                        label: 'Shipping',
                        diffAmount: shipVariance.amount
                    });

                    try {
                        Helper.addNewLine({
                            record: Current.BILL_REC,
                            qty: 1,
                            description: 'VC: Ship Variance',
                            item: param.shipItem,
                            rate: shipVariance.amount,
                            customer: Current.SO_DATA.entity
                        });

                        varianceLines.push({
                            type: 'shipping',
                            item: param.shipItem,
                            rate: shipVariance.amount,
                            quantity: 1
                        });
                    } catch (line_err) {
                        returnObj.details = Helper.extractError(line_err);
                        throw 'Unable to add shipping variance line';
                    }
                }

                if (!ignoreVariance && otherVariance.apply && otherVariance.amount) {
                    hasVariance = true;
                    listVariance.push('Other');

                    listVarianceDetails.push({
                        label: 'Other',
                        diffAmount: otherVariance.amount
                    });

                    try {
                        Helper.addNewLine({
                            record: Current.BILL_REC,
                            qty: 1,
                            item: param.otherItem,
                            description: 'VC: Other Charges',
                            rate: otherVariance.amount,
                            customer: Current.SO_DATA.entity
                        });

                        varianceLines.push({
                            type: 'other',
                            item: param.otherItem,
                            rate: otherVariance.amount,
                            quantity: 1
                        });
                    } catch (line_err) {
                        returnObj.details = Helper.extractError(line_err);
                        throw 'Unable to add other charges line';
                    }
                }

                if (adjustmentVariance.apply && adjustmentVariance.amount) {
                    hasVariance = true;
                    listVariance.push('Adjustments');

                    listVarianceDetails.push({
                        label: 'Adjustments',
                        diffAmount: otherVariance.amount
                    });

                    try {
                        Helper.addNewLine({
                            record: Current.BILL_REC,
                            qty: 1,
                            item: param.otherItem,
                            description: 'VC: Adjustments',
                            rate: adjustmentVariance.amount,
                            customer: Current.SO_DATA.entity
                        });

                        varianceLines.push({
                            type: 'adjustment',
                            item: param.otherItem,
                            description: 'VC: Adjustments',
                            rate: adjustmentVariance.amount,
                            quantity: 1
                        });
                    } catch (line_err) {
                        returnObj.details = Helper.extractError(line_err);
                        throw 'Unable to add adjustments line';
                    }
                }
            }

            /////////////////////////////////
            var allowBillVariance = false,
                allowableVarianceThreshold = param.allowedThreshold;
            totalVarianceAmount = 0;

            // param.allowedThreshold;

            if (allowableVarianceThreshold && listVarianceDetails.length) {
                listVarianceDetails.forEach(function (variance) {
                    totalVarianceAmount += variance.diffAmount;
                    return true;
                });
                totalVarianceAmount = Helper.roundOff(totalVarianceAmount);

                log.debug(logTitle, '>>> totalVarianceAmount: ' + totalVarianceAmount);
                log.debug(
                    logTitle,
                    '>>> allowableVarianceThreshold: ' + allowableVarianceThreshold
                );

                allowBillVariance =
                    Math.abs(totalVarianceAmount) <= Math.abs(allowableVarianceThreshold);
                log.debug(logTitle, '>>> allowBillVariance: ' + allowBillVariance);
            }

            if (hasVariance && !Current.processVariance && !allowBillVariance) {
                util.extend(returnObj, BILL_CREATOR.Code.HAS_VARIANCE);

                // make listVariance unique
                var objVariance = {},
                    tmpArray = [];
                listVariance.forEach(function (varValue) {
                    if (!objVariance.hasOwnProperty(varValue)) {
                        objVariance[varValue] = 1;
                        tmpArray.push(varValue);
                    }
                });
                listVariance = tmpArray;

                returnObj.details = listVariance.length ? ' -- ' + listVariance.join(', ') : '';
                returnObj.msg += returnObj.details;

                if (!allowBillVariance && allowableVarianceThreshold) {
                    returnObj.msg =
                        'Variance Total exceeded the Allowable Threshold - ' +
                        JSON.stringify({
                            total: totalVarianceAmount,
                            threshold: allowableVarianceThreshold
                        }) +
                        '\n' +
                        returnObj.msg;
                }

                return returnObj;
            }

            /////////////////////////////////

            log.debug(logTitle, '** Saving the bill record ** ');

            // attempt to save the record ////
            Current.BILL_REC.setValue({
                fieldId: 'approvalstatus',
                value: param.billDefaultStatus || 1
            }); // defaults to pending approval

            if (param.dontSaveBill) {
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

                if (allowableVarianceThreshold && allowBillVariance) {
                    returnObj.msg =
                        'Variance Total is less than Allowable Threshold - ' +
                        JSON.stringify({
                            total: totalVarianceAmount,
                            threshold: allowableVarianceThreshold
                        }) +
                        '\n\t\t' +
                        returnObj.msg;
                }

                if (varianceLines && varianceLines.length) {
                    returnObj.varianceLines = varianceLines;
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
            returnObj.msg = error.msg || Helper.extractError(error);
            returnObj.details = returnObj.details || Helper.extractError(error);
            returnObj.status = error.status || BILL_CREATOR.Status.ERROR;
            returnObj.isError = true;
            returnObj.msg = [
                returnObj.msg,
                returnObj.details != returnObj.msg ? returnObj.details : ''
            ].join(' ');

            log.audit(logTitle, '## ERROR ## ' + JSON.stringify(returnObj));
        } finally {
            log.debug(logTitle, '## EXIT SCRIPT ## ' + JSON.stringify(returnObj));
        }

        return returnObj;
    }

    var Helper = {
        extractError: function (option) {
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
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
                var lineData = RecordHelper.extractLineValues({
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

            log.audit(
                logTitle,
                LogPrefix + '>> Existing Bill: ' + JSON.stringify(arrExistingBills)
            );
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
                log.debug(
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
            log.audit(logTitle, LogPrefix + '>> isPeriodLocked? ' + JSON.stringify(isLocked));
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
            log.audit(logTitle, LogPrefix + '>> added new line: ' + JSON.stringify(option));
            return returnValue;
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        },
        getBillingConfig: function () {
            var mainConfig = VC_MainCfg.getMainConfiguration();
            if (!mainConfig) {
                log.error('No Configuration available');
                throw new Error('No Configuration available');
            }
            return {
                defaultBillForm: mainConfig.defaultBillForm,
                billDefaultStatus: mainConfig.defaultVendorBillStatus,
                allowedThreshold: mainConfig.allowedVarianceAmountThreshold,
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
            var logTitle = [LogTitle, 'preprocessBillLines'].join('::');
            var arrLines = [],
                matchedLinesBill = {};

            if (!Current.BILL_REC) return false;

            log.audit(logTitle, LogPrefix + '/// Look for matched bill lines...');

            var i, j, ii, jj, lineInfo, logPrefix;
            for (i = 0, j = Current.PayloadData.lines.length; i < j; i++) {
                lineInfo = Current.PayloadData.lines[i];

                var lineData = {
                    item: lineInfo.ITEMNO,
                    nsitem: lineInfo.NSITEM || '',
                    quantity: lineInfo.QUANTITY,
                    description: lineInfo.DESCRIPTION,
                    rate: lineInfo.BILLRATE || lineInfo.PRICE,
                    amount: lineInfo.QUANTITY * (lineInfo.BILLRATE || lineInfo.PRICE),
                    info: lineInfo
                };

                logPrefix = LogPrefix + ' [item:' + lineInfo.ITEMNO + '] ';
                log.audit(logTitle, logPrefix + '>> lineData: ' + JSON.stringify(lineData));

                if (!lineInfo.NSITEM) continue;
                if (Current.BILL_REC) {
                    var matchingLinesBill =
                        RecordHelper.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineData.nsitem,
                                rate: lineData.rate,
                                quantity: lineData.quantity
                            }
                        }) ||
                        // if none found, search for matching item, rate
                        RecordHelper.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineData.nsitem,
                                rate: lineData.rate
                            }
                        }) ||
                        RecordHelper.extractRecordLines({
                            record: Current.BILL_REC,
                            findAll: true,
                            filter: {
                                item: lineData.nsitem,
                                quantity: lineData.quantity
                            }
                        });

                    log.audit(
                        logTitle,
                        logPrefix + '>> matchingLinesBill: ' + JSON.stringify(matchingLinesBill)
                    );

                    lineData.matchingLinesBill = [];
                    for (
                        ii = 0, jj = matchingLinesBill ? matchingLinesBill.length : 0;
                        ii < jj;
                        ii++
                    ) {
                        var matchedLine = matchingLinesBill[ii];
                        if (matchedLinesBill[matchedLine.line]) continue;
                        matchedLinesBill[matchedLine.line] = lineInfo;
                        lineData.matchingLinesBill.push(matchedLine);
                    }
                }

                arrLines.push(lineData);
            }

            log.audit(
                logTitle,
                LogPrefix + '/// Look for bill lines that doesnt have direct matches...'
            );
            // do a second round, and look for unmatched lines
            for (i = 0, j = arrLines.length; i < j; i++) {
                lineInfo = arrLines[i];
                logPrefix = LogPrefix + ' [item:' + lineInfo.item + '] ';
                if (lineInfo.matchingLinesBill && lineInfo.matchingLinesBill.length) continue;

                var matchedLines = RecordHelper.extractRecordLines({
                    record: Current.BILL_REC,
                    findAll: true,
                    filter: { item: lineInfo.nsitem }
                });

                for (ii = 0, jj = matchedLines ? matchedLines.length : 0; ii < jj; ii++) {
                    if (matchedLinesBill[matchedLines[ii].line]) continue;
                    arrLines[i].matchingLinesBill.push(matchedLines[ii]);

                    matchedLinesBill[matchedLines[ii].line] = lineInfo.info;

                    log.audit(
                        logTitle,
                        logPrefix + '>> matching items: ' + JSON.stringify(matchedLines[ii])
                    );
                }
            }

            Current.MatchedLines = matchedLinesBill;

            return arrLines;
        },
        extend: function (source, contrib) {
            // do this to preserve the source values
            return util.extend(util.extend({}, source), contrib);
        }
    };

    var RecordHelper = {
        transform: function (option) {
            var returnRec;
            try {
                if (!option.fromType) throw 'Record fromType is required. [fromType]';
                if (!option.fromId) throw 'Record fromId is required. [fromId]';
                if (!option.toType) throw 'Record toType is required. [toType]';

                returnRec = ns_record.transform(option);
            } catch (err) {
                throw (
                    'Unable to transform record: ' +
                    vc2_util.extractError(err) +
                    '\n' +
                    JSON.stringify(option)
                );
            }
            return returnRec;
        },
        load: function (option) {
            var returnRec;
            try {
                if (!option.type) throw 'Record type is required. [type]';
                if (!option.id) throw 'Record ID is required. [id]';

                returnRec = ns_record.load(option);
            } catch (err) {
                throw (
                    'Unable to load record: ' +
                    vc2_util.extractError(err) +
                    '\n' +
                    JSON.stringify(option)
                );
            }
            return returnRec;
        },
        loadData: function (option) {
            var returnData;
            try {
                if (!option.record || !option.fields) return false;
                returnData = {};

                for (var fld in option.fields) {
                    var fieldId = option.fields[fld];
                    var fieldName = util.isArray(option.fields) ? fieldId : fld;

                    var value = option.record.getValue({ fieldId: fieldId }) || '',
                        textValue = option.record.getText({ fieldId: fieldId });
                    returnData[fieldName] = value;

                    if (textValue !== null && textValue != value) {
                        returnData[fieldName + '_text'] = textValue;
                    }
                }
            } catch (error) {
                throw (
                    'Unable to load record: ' +
                    vc2_util.extractError(err) +
                    '\n' +
                    JSON.stringify(option)
                );
            }
            return returnData;
        },
        extractLineValues: function (option) {
            var record = option.record,
                sublistId = option.sublistId || 'item',
                groupId = option.groupId,
                line = option.line,
                columns = option.columns;

            if (!record || !columns) return false;
            if (line == null || line < 0) return false;

            var lineData = {};
            for (var i = 0, j = columns.length; i < j; i++) {
                var lineOption = {
                    sublistId: sublistId,
                    group: groupId,
                    fieldId: columns[i],
                    line: line
                };
                var value = record.getSublistValue(lineOption),
                    textValue = record.getSublistText(lineOption);
                lineData[columns[i]] = value;
                if (textValue !== null && value != textValue)
                    lineData[columns[i] + '_text'] = textValue;
            }

            return lineData;
        },
        extractRecordLines: function (option) {
            var record = option.record;
            var columns = option.columns || [
                'item',
                'rate',
                'quantity',
                'amount',
                'quantityreceived',
                'quantitybilled',
                'taxrate',
                'taxrate1',
                'taxrate2'
            ];
            var sublistId = option.sublistId || 'item';
            if (!record) return false;

            var lineCount = record.getLineCount({ sublistId: sublistId }),
                arrRecordLines = [];
            for (var line = 0; line < lineCount; line++) {
                var lineData = RecordHelper.extractLineValues({
                    record: record,
                    sublistId: sublistId,
                    line: line,
                    columns: columns
                });
                lineData.line = line;

                if (!option.filter) {
                    arrRecordLines.push(lineData);
                    continue;
                }

                var isFound = true;
                // check if this line satisfy our filters
                for (var field in option.filter) {
                    var lineValue = lineData.hasOwnProperty(field)
                        ? lineData[field]
                        : record.getSublistValue({
                              sublistId: sublistId,
                              fieldId: field,
                              line: line
                          });

                    if (option.filter[field] != lineValue) {
                        isFound = false;
                        break;
                    }
                }
                if (isFound) {
                    arrRecordLines.push(lineData);
                    if (!option.findAll) break;
                }
            }

            return arrRecordLines && arrRecordLines.length
                ? option.findAll
                    ? arrRecordLines
                    : arrRecordLines.shift()
                : false;
        },
        updateLine: function (option) {
            var record = option.record,
                sublistId = option.sublistId || 'item',
                lineData = option.lineData;

            if (!record || !lineData) return false;

            if (!lineData.hasOwnProperty('line')) return;

            var lineOption = { sublistId: sublistId, line: lineData.line };

            record.selectLine(lineOption);

            for (var fieldId in lineData) {
                if (fieldId == 'line') continue;
                if (vc2_util.isEmpty(lineData[fieldId])) continue;

                record.setCurrentSublistValue(
                    Helper.extend(lineOption, { fieldId: fieldId, value: lineData[fieldId] })
                );
            }

            record.commitLine(lineOption);
            return record;
        },
        addLine: function (option) {
            var record = option.record,
                sublistId = option.sublistId || 'item',
                lineData = option.lineData;

            if (!record || !lineData) return false;

            var lineOption = { sublistId: sublistId };
            record.selectNewLine(lineOption);

            for (var fieldId in lineData) {
                if (vc2_util.isEmpty(lineData[fieldId])) continue;

                record.setCurrentSublistValue(
                    Helper.extend(lineOption, { fieldId: fieldId, value: lineData[fieldId] })
                );
            }
            record.commitLine(lineOption);

            var lineCount = record.getLineCount(lineOption);
            return lineCount - 1;
        }
    };

    //////////////////////////////
    var arrFields = [
            'custrecord_ctc_vc_bill_is_recievable',
            'custrecord_ctc_vc_bill_log',
            'custrecord_ctc_vc_bill_proc_status',
            'custrecord_ctc_vc_bill_proc_variance',
            'custrecord_ctc_vc_bill_linked_po',
            'custrecord_ctc_vc_bill_json'
        ],
        searchValues = ns_search.lookupFields({
            type: 'customrecord_ctc_vc_bills',
            id: '71201',
            columns: arrFields
        });

    _post(searchValues);
});
