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

var VCFolder = 'SuiteScripts/CTC.ACP/VCFolder/Bill Creator';
require([
    'N/record',
    'N/search',
    'N/format',
    'N/runtime',
    VCFolder + '/Libraries/moment',
    VCFolder + '/../CTC_VC2_Lib_Utils',
    VCFolder + '/../CTC_VC2_Constants',
    VCFolder + '/../CTC_VC_Lib_Log'
], function (ns_record, ns_search, ns_format, ns_runtime, moment, VC2_Lib, VC_Constants, VC_Log) {
    var LOG_TITLE = 'VC_GENR_BILL_RL',
        LOG_APP = 'Bill Creator : Generate Bill (Restlet)',
        LogPrefix = '',
        CURRENT_PO = '',
        BILL_CREATOR = VC_Constants.Bill_Creator,
        PARAM_FIELDS = {
            shipItem: 'custscript_ctc_bc_ship_item',
            taxItem: 'custscript_ctc_bc_tax_item',
            otherItem: 'custscript_ctc_bc_other_item',
            hasShippingVariance: 'custscript_ctc_bc_ship_var',
            hasTaxVariance: 'custscript_ctc_bc_tax_var',
            hasOtherVariance: 'custscript_ctc_bc_other_var',
            billDefaultStatus: 'custscript_ctc_bc_bill_status',
            dontSaveBill: 'custscript_ctc_bc_bill_dontcreate',
            allowedThreshold: 'custscript_ctc_bc_variance_threshold',
            defaultBillForm: 'custscript_ctc_bc_bill_form'
        };

    var Helper = {
        extractError: function (option) {
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage)) errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        getLinesToBill: function (option) {
            var logTitle = [LOG_TITLE, 'getLinesToBill'].join('::'),
                returnValue;
            option = option || {};

            var arrLinesToBill = [];

            var recPO = option.record,
                billPayload = option.payload;

            var lineCount = recPO.getLineCount({ sublistId: 'item' });
            var hasFoundLines = false;
            for (var line = 0; line < lineCount; line++) {
                var vbLineData = {
                    lineNo: line,
                    item: recPO.getSublistValue({
                        sublistId: 'item',
                        line: line,
                        fieldId: 'item'
                    }),
                    item_text: recPO.getSublistText({
                        sublistId: 'item',
                        line: line,
                        fieldId: 'item'
                    }),
                    qty: recPO.getSublistValue({
                        sublistId: 'item',
                        line: line,
                        fieldId: 'quantity'
                    }),
                    qtybilled: recPO.getSublistValue({
                        sublistId: 'item',
                        line: line,
                        fieldId: 'quantitybilled'
                    })
                };
                billPayload.lines.forEach(function (lineBill) {
                    if (lineBill.NSITEM == vbLineData.item) hasFoundLines = true;
                    if (lineBill.NSITEM == vbLineData.item && lineBill.QUANTITY > vbLineData.qtybilled) {
                        arrLinesToBill.push(lineBill);
                    }

                    return true;
                });
            }

            if (!hasFoundLines) throw 'Unable to find matching lines';

            log.audit(logTitle, LogPrefix + '>> Lines To Bill: ' + JSON.stringify(arrLinesToBill));
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

            log.audit(logTitle, LogPrefix + '>> Existing Bill: ' + JSON.stringify(arrExistingBills));
            returnValue = arrExistingBills;

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
            var flValue = VC2_Lib.forceFloat(value);
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        }
    };

    function _post(context) {
        var logTitle = [LOG_TITLE, 'POST'].join('::'),
            returnObj = {},
            currentData = {},
            currScript = ns_runtime.getCurrentScript();

        var scriptParam = {};

        for (var paramName in PARAM_FIELDS) {
            scriptParam[paramName] = currScript.getParameter({ name: PARAM_FIELDS[paramName] });
        }

        try {
            log.audit(logTitle, LogPrefix + 'Params: ' + JSON.stringify(scriptParam));
            log.audit(logTitle, LogPrefix + 'Request: ' + context);

            currentData = {
                poId:
                    context.custrecord_ctc_vc_bill_linked_po && context.custrecord_ctc_vc_bill_linked_po[0]
                        ? context.custrecord_ctc_vc_bill_linked_po[0].value
                        : false,
                billInAdvance: context.billInAdvance || false,
                processVariance: context.custrecord_ctc_vc_bill_proc_variance
            };
            log.debug(logTitle, LogPrefix + 'CurrentData: ' + JSON.stringify(currentData));

            ///////////////////
            if (!currentData.poId) {
                returnObj.details = ' PO ID:' + currentData.poId + ' is missing or inactive.';
                throw BILL_CREATOR.Code.MISSING_PO;
            }
            ///////////////////
            var log_prefix;
            LogPrefix = ' [purchaseorder:' + currentData.poId + '] ';
            var recPO = ns_record.load({ type: 'purchaseorder', id: currentData.poId });
            CURRENT_PO = currentData.poId;

            currentData.poNum = recPO.getValue({ fieldId: 'tranid' });
            currentData.poEntity = recPO.getValue({ fieldId: 'entity' });
            currentData.taxTotal =
                VC2_Lib.forceFloat(recPO.getValue({ fieldId: 'taxtotal' })) +
                VC2_Lib.forceFloat(recPO.getValue({ fieldId: 'tax2total' }));

            var billPayload = JSON.parse(context.custrecord_ctc_vc_bill_json);

            log.audit(logTitle, LogPrefix + 'Bill Payload:' + JSON.stringify(billPayload));
            log.debug(logTitle, LogPrefix + 'Validating remaining items to bill...');

            VC2_Lib.vcLog({
                title: LOG_APP,
                recordId: CURRENT_PO,
                body: '*** VENDOR BILL CREATION START *****: ' + JSON.stringify(currentData)
            });

            /// FIND EXISTING BILLS ////////////////////////////
            log.debug(logTitle, LogPrefix + 'Checking for existing bills...');

            var arrExistingBills = Helper.getExistingBill({
                entity: currentData.poEntity,
                invoiceNo: billPayload.invoice
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

            /// VALIDATE REMAING ITEMS TO BILL /////////////////////////
            var arrLinesToBill = Helper.getLinesToBill({
                payload: billPayload,
                record: recPO
            });
            log.debug(logTitle, LogPrefix + 'Lines to bill..' + JSON.stringify(arrLinesToBill));

            if (!arrLinesToBill || !arrLinesToBill.length) {
                returnObj.details = 'All items on the bill are already billed.';
                util.extend(returnObj, BILL_CREATOR.Code.ITEMS_ALREADY_BILLED);
                return returnObj;
            }
            ///////////////////////////////////

            ///////////////////////////////////
            // Status check
            var poStatus = {
                status: recPO.getValue({ fieldId: 'status' }),
                statusRef: recPO.getValue({ fieldId: 'statusRef' })
            };

            log.debug(logTitle, LogPrefix + 'PO Status: ' + JSON.stringify(poStatus));

            VC2_Lib.vcLog({
                title: LOG_APP,
                recordId: CURRENT_PO,
                body: 'PO Status: ' + JSON.stringify(poStatus)
            });

            if (
                poStatus.statusRef == 'pendingBilling' ||
                poStatus.statusRef == 'pendingBillPartReceived' ||
                currentData.billInAdvance
            ) {
                // continue processing
                log.debug(logTitle, LogPrefix + 'PO is ready for billing: ');
            } else {
                /// not ready for billing!
                log.debug(
                    logTitle,
                    LogPrefix +
                        '// Skipping poId, Purchase Order not Ready to Bill' +
                        JSON.stringify({
                            poNum: currentData.poNum,
                            status: poStatus
                        })
                );

                returnObj.details = ['PO #' + currentData.poNum, ' - current status: ' + poStatus.status].join('');

                throw BILL_CREATOR.Code.NOT_BILLABLE;
            }
            ///////////////////////////////////

            var hasVariance = false,
                totalVarianceAmount = 0,
                listVarianceDetails = [],
                listVariance = [];

            //// TRANSFORM TO VENDOR BILL ////////////////
            var transformOption = {
                fromType: 'purchaseorder',
                fromId: currentData.poId,
                toType: 'vendorbill',
                isDynamic: true
            };

            if (scriptParam.defaultBillForm) {
                transformOption.customform = scriptParam.defaultBillForm;
            }

            log.debug(
                logTitle,
                LogPrefix + '***** Vendor Bill record creation:start *****' + JSON.stringify(transformOption)
            );

            ////////////////////////////////
            var recBill;
            try {
                recBill = ns_record.transform(transformOption);
            } catch (transform_error) {
                var transform_error_msg = VC2_Lib.extractError(transform_error);
                returnObj.details = 'Error: ' + transform_error_msg;
                throw BILL_CREATOR.Code.BILL_NOT_CREATED;
            }
            ////////////////////////////////

            if (scriptParam.defaultBillForm) {
                recBill.setValue({ fieldId: 'customform', value: scriptParam.defaultBillForm });
            }

            /// SET THE DATE/DUE DATE ///////////////////
            var postingPeriod = recBill.getValue({ fieldId: 'postingperiod' });
            recBill.setValue({
                fieldId: 'trandate',
                value: ns_format.parse({
                    value: moment(billPayload.date).toDate(),
                    type: ns_format.Type.DATE
                })
            });
            if (billPayload.duedate) {
                recBill.setValue({
                    fieldId: 'duedate',
                    value: ns_format.parse({
                        value: moment(billPayload.duedate).toDate(),
                        type: ns_format.Type.DATE
                    })
                });
            }

            //// CHECK THE POSTING PERIOD ////////////////
            var isPeriodLocked = Helper.isPeriodLocked({ recordBill: recBill });
            if (isPeriodLocked) {
                // set to original period
                recBill.setValue({
                    fieldId: 'postingperiod',
                    value: postingPeriod
                });
            }

            /// TRANSACTION NAME  ///////////////////
            log.debug(logTitle, LogPrefix + '.. set invoice name: ' + billPayload.invoice);
            recBill.setValue({
                fieldId: 'tranid',
                value: billPayload.invoice
            });

            /// VALIDATE THE LINES /////////////
            var lineCount = recBill.getLineCount({ sublistId: 'item' });
            var arrLines = [];

            log.debug(
                logTitle,
                LogPrefix +
                    'Matching vb-to-payload lines...line count: ' +
                    JSON.stringify({
                        vbLines: lineCount,
                        payloadLines: billPayload.lines.length
                    })
            );

            for (var line = 0; line < lineCount; line++) {
                log_prefix = ['[line #', line, '] ...'].join('');

                recBill.selectLine({ sublistId: 'item', line: line });
                var vbLineData = {
                    lineNo: line,
                    item: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    }),
                    rate: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    }),
                    quantity: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    }),
                    taxRate1: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate1'
                    }),
                    taxRate2: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate2'
                    }),
                    billQty: 0,
                    billRate: 0,
                    process: false
                };
                log.debug(logTitle, LogPrefix + log_prefix + 'validating line: ' + JSON.stringify(vbLineData));

                var isLineFound = false;

                for (var bpline = 0; bpline < billPayload.lines.length; bpline++) {
                    var payloadLineData = billPayload.lines[bpline];
                    if (payloadLineData.NSITEM != vbLineData.item) continue;

                    isLineFound = true;

                    log.debug(logTitle, LogPrefix + log_prefix + 'matching lines: ' + JSON.stringify(payloadLineData));

                    var billQty =
                        payloadLineData.QUANTITY > vbLineData.quantity ? vbLineData.quantity : payloadLineData.QUANTITY;

                    vbLineData.billQty += billQty;
                    vbLineData.billRate = payloadLineData.PRICE;
                    payloadLineData.QUANTITY -= billQty;
                    vbLineData.process = true;
                }
                if (!isLineFound) {
                    log.debug(logTitle, LogPrefix + log_prefix + '// unable to find matching payload line');
                }

                arrLines.push(vbLineData);
            }
            ///////////////////////////////

            var fileFullyProcessed = true;
            log.debug(logTitle, LogPrefix + 'Checking unprocessed payload line...');
            billPayload.lines.forEach(function (line) {
                if (line.QUANTITY > 0) {
                    fileFullyProcessed = false;

                    returnObj.details = [
                        'Bill line quantity exceeds PO line quantity: ',
                        JSON.stringify({
                            item: line.ITEMNO,
                            qty: line.QUANTITY
                        })
                    ].join('');
                    log.debug(logTitle, LogPrefix + '// line has remaining unprocessed qty' + JSON.stringify(line));
                }
            });

            if (!fileFullyProcessed) {
                throw BILL_CREATOR.Code.NOT_FULLY_PROCESSED;
            }

            arrLines.reverse();

            /// PROCESS THE LINES /////////////
            log.debug(logTitle, LogPrefix + 'Validating lines to process: ' + JSON.stringify(arrLines));

            var taxTotal = 0;

            for (var lineVB = 0; lineVB < arrLines.length; lineVB++) {
                var lineDataVB = arrLines[lineVB],
                    lineVariance = [],
                    lineTaxTotal = 0;

                log_prefix = ['[line #', lineDataVB.lineNo, '] ...'].join('');
                log.debug(logTitle, LogPrefix + log_prefix + 'Proceessing line: ' + JSON.stringify(lineDataVB));

                // remove line, if not included in the payload bill
                if (!lineDataVB.process || !lineDataVB.billQty || lineDataVB.billQty < 1) {
                    log.debug(logTitle, LogPrefix + log_prefix + '// removing line, not part of the bill');
                    recBill.removeLine({
                        sublistId: 'item',
                        line: lineDataVB.lineNo
                    });
                    continue;
                }

                ////////////////
                recBill.selectLine({
                    sublistId: 'item',
                    line: lineDataVB.lineNo
                });
                var currentLineData = {
                    qty: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    }),
                    rate: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    }),
                    amount: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount'
                    }),
                    taxrate1: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate1'
                    }),
                    taxrate2: recBill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate2'
                    })
                };

                // calculate tax
                currentLineData.taxrate1 = util.isString(currentLineData.taxrate1)
                    ? VC2_Lib.forceFloat(currentLineData.taxrate1)
                    : currentLineData.taxrate1;
                if (currentLineData.taxrate1 > 0) {
                    currentLineData.taxAmount1 = currentLineData.amount * (currentLineData.taxrate1 / 100);
                    lineTaxTotal += currentLineData.taxAmount1;
                }

                currentLineData.taxrate2 = util.isString(currentLineData.taxrate2)
                    ? VC2_Lib.forceFloat(currentLineData.taxrate2)
                    : currentLineData.taxrate2;
                if (currentLineData.taxrate2 > 0) {
                    currentLineData.taxAmount2 = currentLineData.amount * (currentLineData.taxrate2 / 100);
                    lineTaxTotal += currentLineData.taxAmount2;
                }

                log.debug(
                    logTitle,
                    LogPrefix + log_prefix + 'Checking for variance: ' + JSON.stringify(currentLineData)
                );

                /// LINE: QTY Variance /////////////////////
                ///////////////////////////////////
                if (lineDataVB.billQty != currentLineData.qty) {
                    log.debug(logTitle, LogPrefix + log_prefix + '// bill quantity is > po quantity');

                    if (lineDataVB.billQty > currentLineData.qty) {
                        log.debug(logTitle, LogPrefix + log_prefix + '// bill quantity is > po quantity');

                        lineVariance.push('Quantity');
                        listVariance.push('Quantity');

                        listVarianceDetails.push({
                            type: 'line',
                            label: 'Quantity',
                            diffQty: lineDataVB.billQty - currentLineData.qty,
                            diffAmount: VC2_Lib.roundOff(
                                (lineDataVB.billQty - currentLineData.qty) *
                                    (lineDataVB.billRate - currentLineData.rate)
                            )
                        });
                    } else {
                        recBill.setCurrentSublistValue({
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
                    log.debug(logTitle, LogPrefix + log_prefix + '// bill rate doesnt match po rate');

                    lineVariance.push('Price');
                    listVariance.push('Price');

                    recBill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: lineDataVB.billRate
                    });

                    listVarianceDetails.push({
                        type: 'line',
                        label: 'Rate',
                        diffAmount: VC2_Lib.roundOff(lineDataVB.billRate - currentLineData.rate)
                    });
                }
                ///////////////////////////////////

                if (lineVariance.length) {
                    hasVariance = true;
                    recBill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_create_bill_variance',
                        value: true
                    });
                    recBill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_bill_variance_rsn',
                        value: lineVariance.join('\r\n')
                    });
                }

                taxTotal += lineTaxTotal;

                log.debug(logTitle, LogPrefix + log_prefix + ' line tax total:  ' + lineTaxTotal);

                recBill.commitLine({ sublistId: 'item' });
            }
            ///////////////////////////////
            log.debug(logTitle, LogPrefix + 'Processing charges :  ' + JSON.stringify(billPayload.charges));
            log.debug(logTitle, LogPrefix + '// variances :  ' + JSON.stringify(billPayload.variance));

            taxTotal = VC2_Lib.roundOff(taxTotal) || 0;

            var vbTaxTotal =
                VC2_Lib.forceFloat(recBill.getValue({ fieldId: 'taxtotal' })) +
                VC2_Lib.forceFloat(recBill.getValue({ fieldId: 'tax2total' }));

            var deltaCharges = {
                tax: VC2_Lib.roundOff(billPayload.charges.tax - taxTotal)
            };

            log.debug(
                logTitle,
                LogPrefix +
                    'Tax Total: ' +
                    JSON.stringify({
                        lineTaxTotal: taxTotal,
                        vbTaxTotal: vbTaxTotal,
                        poTaxTotal: currentData.taxTotal,
                        taxCharges: billPayload.charges.tax,
                        delta: deltaCharges.tax
                    })
            );

            var ignoreVariance = billPayload.hasOwnProperty('ignoreVariance') && billPayload.ignoreVariance == 'T';

            log.audit(logTitle, LogPrefix + '>> variance lines: ' + JSON.stringify(billPayload.varianceLines));
            log.audit(logTitle, LogPrefix + '>> variance: ' + JSON.stringify(billPayload.variance));

            if (billPayload.varianceLines && billPayload.varianceLines.length) {
                hasVariance = true;

                billPayload.varianceLines.forEach(function (varianceData) {
                    listVariance.push(varianceData.name);

                    listVarianceDetails.push({
                        label: varianceData.name,
                        diffAmount: varianceData.rate
                    });

                    Helper.addNewLine({
                        record: recBill,
                        qty: 1,
                        description: varianceData.description,
                        item: varianceData.item,
                        rate: varianceData.rate
                    });

                    return true;
                });
            } else {
                var varianceValues = billPayload.variance || {};

                var taxVariance = { apply: false, amount: 0 };
                var shipVariance = { apply: false, amount: 0 };
                var otherVariance = { apply: false, amount: 0 };
                var adjustmentVariance = { apply: false, amount: 0 };

                taxVariance.apply = scriptParam.hasTaxVariance;
                taxVariance.amount = deltaCharges.tax;
                if (varianceValues.hasOwnProperty('applyTax')) {
                    taxVariance.apply = varianceValues.applyTax == 'T';
                    taxVariance.amount = varianceValues.tax;
                }
                log.debug(logTitle, LogPrefix + '>> taxVariance: ' + JSON.stringify(taxVariance));

                shipVariance.apply = scriptParam.hasShippingVariance;
                shipVariance.amount = billPayload.charges.shipping;
                if (varianceValues.hasOwnProperty('applyShip')) {
                    shipVariance.apply = varianceValues.applyShip == 'T';
                    shipVariance.amount = varianceValues.shipping;
                }
                log.debug(logTitle, LogPrefix + '>> shipVariance: ' + JSON.stringify(shipVariance));

                otherVariance.apply = scriptParam.hasOtherVariance;
                otherVariance.amount = billPayload.charges.other;
                if (varianceValues.hasOwnProperty('applyShip')) {
                    otherVariance.apply = varianceValues.applyOther == 'T';
                    otherVariance.amount = varianceValues.other;
                }
                log.debug(logTitle, LogPrefix + '>> otherVariance: ' + JSON.stringify(otherVariance));

                if (varianceValues.hasOwnProperty('applyAdjustment')) {
                    adjustmentVariance.apply = varianceValues.applyAdjustment == 'T';
                    adjustmentVariance.amount = varianceValues.adjustment;
                }
                log.debug(logTitle, LogPrefix + '>> adjustmentVariance: ' + JSON.stringify(adjustmentVariance));

                if (!ignoreVariance && taxVariance.apply && taxVariance.amount) {
                    hasVariance = true;
                    listVariance.push('Tax');

                    listVarianceDetails.push({
                        label: 'Tax',
                        diffAmount: taxVariance.amount
                    });

                    try {
                        Helper.addNewLine({
                            record: recBill,
                            qty: 1,
                            description: 'VC: Tax Variance',
                            item: scriptParam.taxItem,
                            rate: taxVariance.amount
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
                            record: recBill,
                            qty: 1,
                            description: 'VC: Ship Variance',
                            item: scriptParam.shipItem,
                            rate: shipVariance.amount
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
                            record: recBill,
                            qty: 1,
                            item: scriptParam.otherItem,
                            description: 'VC: Other Charges',
                            rate: otherVariance.amount
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
                            record: recBill,
                            qty: 1,
                            item: scriptParam.otherItem,
                            description: 'VC: Adjustments',
                            rate: adjustmentVariance.amount
                        });
                    } catch (line_err) {
                        returnObj.details = Helper.extractError(line_err);
                        throw 'Unable to add adjustments line';
                    }
                }
            }

            /////////////////////////////////
            var allowBillVariance = false,
                allowableVarianceThreshold = scriptParam.allowedThreshold;

            // scriptParam.allowedThreshold;

            if (allowableVarianceThreshold && listVarianceDetails.length) {
                listVarianceDetails.forEach(function (variance) {
                    totalVarianceAmount += variance.diffAmount;
                    return true;
                });
                totalVarianceAmount = VC2_Lib.roundOff(totalVarianceAmount);

                log.debug(logTitle, LogPrefix + '>>> totalVarianceAmount: ' + totalVarianceAmount);
                log.debug(logTitle, LogPrefix + '>>> allowableVarianceThreshold: ' + allowableVarianceThreshold);

                allowBillVariance = Math.abs(totalVarianceAmount) <= Math.abs(allowableVarianceThreshold);
                log.debug(logTitle, LogPrefix + '>>> allowBillVariance: ' + allowBillVariance);
            }

            if (hasVariance && !currentData.processVariance && !allowBillVariance) {
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

            log.debug(logTitle, LogPrefix + '** Saving the bill record ** ');

            // attempt to save the record ////
            recBill.setValue({
                fieldId: 'approvalstatus',
                value: scriptParam.billDefaultStatus || 1
            }); // defaults to pending approval

            if (scriptParam.dontSaveBill) {
                util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATE_DISABLED);
                return returnObj;
            }

            var newRecordId = recBill.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            if (newRecordId) {
                log.debug(
                    logTitle,
                    LogPrefix + '>>> Bill Created succesfully...' + [currentData.poNum, billPayload.invoice]
                );

                returnObj = JSON.parse(JSON.stringify(recBill));
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

                returnObj.details =
                    'Linked to vendor bill ' + JSON.stringify({ id: newRecordId, name: billPayload.invoice });
            } else {
                log.debug(logTitle, LogPrefix + '// bill creation fail...' + [currentData.poNum, billPayload.invoice]);
                util.extend(returnObj, BILL_CREATOR.Code.BILL_NOT_CREATED);
                return returnObj;
            }

            return returnObj;
        } catch (error) {
            returnObj.msg = error.msg || Helper.extractError(error);
            returnObj.details = returnObj.details || Helper.extractError(error);
            returnObj.status = error.status || BILL_CREATOR.Status.ERROR;
            returnObj.isError = true;
            returnObj.msg = [returnObj.msg, returnObj.details != returnObj.msg ? returnObj.details : ''].join(' ');

            log.audit(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(returnObj));
        } finally {
            VC2_Lib.vcLog({
                title: LOG_APP,
                recordId: CURRENT_PO,
                body: [returnObj.msg, returnObj.details != returnObj.msg ? returnObj.details : ''].join(' '),
                status: returnObj.isError
                    ? VC_Constants.LIST.VC_LOG_STATUS.ERROR
                    : VC_Constants.LIST.VC_LOG_STATUS.INFO,
                doLog: true
            });

            // VC_Log.add({
            //     header: LOG_APP,
            //     transaction: CURRENT_PO,
            //     body: [
            //         returnObj.msg,
            //         returnObj.details != returnObj.msg ? returnObj.details : ''
            //     ].join(' '),
            //     status: returnObj.isError
            //         ? VC_Constants.LIST.VC_LOG_STATUS.ERROR
            //         : VC_Constants.LIST.VC_LOG_STATUS.INFO
            // });

            log.debug(logTitle, LogPrefix + '## EXIT SCRIPT ## ' + JSON.stringify(returnObj));
        }

        return returnObj;
    }

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
            id: '4417',
            columns: arrFields
        });

    _post(searchValues);

    // return {
    //     post: _post
    // };
});
