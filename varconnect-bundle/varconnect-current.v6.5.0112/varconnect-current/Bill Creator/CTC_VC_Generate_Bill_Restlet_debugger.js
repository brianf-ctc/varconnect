/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
var VCFolder = '/SuiteScripts/VCFolder/Bill Creator';
require([
    'N/record',
    'N/search',
    'N/format',
    'N/runtime',
    VCFolder + '/../CTC_VC_Constants',
    VCFolder + '/../CTC_VC_Lib_Log'
], function (record, search, format, runtime, VC_Constants, VC_Log) {
    var LOG_TITLE = 'VC_GENR_BILL_RL',
        LOG_APP = 'Bill Creator : Generate Bill (Restlet)',
        CURRENT_PO = '',
        BILL_CREATOR = VC_Constants.Bill_Creator;

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
            var logTitle = [LOG_TITLE, 'getLinesToBill'].join('::'),
                returnValue;
            option = option || {};

            var arrLinesToBill = [];

            var recPO = option.poRecord,
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
                    if (
                        lineBill.NSITEM == vbLineData.item &&
                        lineBill.QUANTITY > vbLineData.qtybilled
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

            var vendorbillSearchObj = search.create({
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

            log.audit(logTitle, '>> Existing Bill: ' + JSON.stringify(arrExistingBills));
            returnValue = arrExistingBills;

            return returnValue;
        },
        isPeriodLocked: function (option) {
            var logTitle = [LOG_TITLE, 'isPeriodLocked'].join('::'),
                returnValue;
            option = option || {};

            var recBill = option.recordBill;
            var isLocked = false;
            var periodValues = search.lookupFields({
                type: search.Type.ACCOUNTING_PERIOD,
                id: recBill.getValue({ fieldId: 'postingperiod' }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            isLocked = periodValues.aplocked || periodValues.alllocked || periodValues.closed;
            log.audit(logTitle, '>> isPeriodLocked? ' + JSON.stringify(isLocked));
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
            log.audit(logTitle, '>> added new line: ' + JSON.stringify(option));
            return returnValue;
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return false;

            return Math.round(flValue * 100) / 100;
        }
    };

    function _post(context) {
        var logTitle = [LOG_TITLE, 'POST'].join('::'),
            returnObj = {},
            currentData = {},
            currScript = runtime.getCurrentScript();

        var param = {
            shipItem: currScript.getParameter({
                name: 'custscript_ctc_bc_ship_item'
            }),
            taxItem: currScript.getParameter({
                name: 'custscript_ctc_bc_tax_item'
            }),
            otherItem: currScript.getParameter({
                name: 'custscript_ctc_bc_other_item'
            }),
            hasShippingVariance: currScript.getParameter({
                name: 'custscript_ctc_bc_ship_var'
            }),
            hasTaxVariance: currScript.getParameter({
                name: 'custscript_ctc_bc_tax_var'
            }),
            hasOtherVariance: currScript.getParameter({
                name: 'custscript_ctc_bc_other_var'
            }),
            billDefaultStatus: currScript.getParameter({
                name: 'custscript_ctc_bc_bill_status'
            }),
            dontSaveBill: currScript.getParameter({
                name: 'custscript_ctc_bc_bill_dontcreate'
            })
        };

        try {
            log.audit(logTitle, 'Params: ' + JSON.stringify(param));
            log.audit(logTitle, 'Request: ' + context);

            currentData = {
                poId:
                    context.custrecord_ctc_vc_bill_linked_po &&
                    context.custrecord_ctc_vc_bill_linked_po[0]
                        ? context.custrecord_ctc_vc_bill_linked_po[0].value
                        : false,
                billInAdvance: context.billInAdvance || false,
                processVariance: context.custrecord_ctc_vc_bill_proc_variance
            };
            log.debug(logTitle, 'CurrentData: ' + JSON.stringify(currentData));

            ///////////////////
            if (!currentData.poId) {
                returnObj.details = ['PO ID:', currentData.poId, ' is missing or inactive'].join(
                    ''
                );
                throw BILL_CREATOR.Code.MISSING_PO;
            }
            ///////////////////
            var log_prefix;

            var recPO = record.load({
                type: 'purchaseorder',
                id: currentData.poId
            });
            CURRENT_PO = currentData.poId;

            currentData.poNum = recPO.getValue({ fieldId: 'tranid' });
            currentData.poEntity = recPO.getValue({ fieldId: 'entity' });
            currentData.taxTotal =
                parseFloat(recPO.getValue({ fieldId: 'taxtotal' })) +
                parseFloat(recPO.getValue({ fieldId: 'tax2total' }));

            var billPayload = JSON.parse(context.custrecord_ctc_vc_bill_json);

            log.audit(logTitle, 'Bill Payload:' + JSON.stringify(billPayload));
            log.debug(logTitle, 'Validating remaining items to bill...');

            /// FIND EXISTING BILLS ////////////////////////////
            log.debug(logTitle, 'Checking for existing bills...');

            var arrExistingBills = Helper.getExistingBill({
                entity: currentData.poEntity,
                invoiceNo: billPayload.invoice
            });

            if (arrExistingBills && arrExistingBills.length) {
                var billRec = record.load({
                    type: 'vendorbill',
                    id: arrExistingBills[0]
                });

                returnObj = JSON.parse(JSON.stringify(billRec));
                returnObj.existingBills = JSON.stringify(arrExistingBills);
                returnObj.details = 'Linked to existing bill (id:' + arrExistingBills[0] + ' )';
                util.extend(returnObj, BILL_CREATOR.Code.EXISTING_BILLS);

                return returnObj;
            }
            ///////////////////////////////////

            /// VALIDATE REMAING ITEMS TO BILL /////////////////////////
            var arrLinesToBill = Helper.getLinesToBill({
                payload: billPayload,
                poRecord: recPO
            });
            log.debug(logTitle, 'Lines to bill..' + JSON.stringify(arrLinesToBill));

            if (!arrLinesToBill || !arrLinesToBill.length) {
                returnObj.details = 'All items on the bill are already billed';
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

            log.debug(logTitle, 'PO Status: ' + JSON.stringify(poStatus));
            if (
                poStatus.statusRef == 'pendingBilling' ||
                poStatus.statusRef == 'pendingBillPartReceived' ||
                currentData.billInAdvance
            ) {
                // continue processing
                log.debug(logTitle, 'PO is ready for billing: ');
            } else {
                /// not ready for billing!
                log.debug(
                    logTitle,
                    '// Skipping poId, Purchase Order not Ready to Bill' +
                        JSON.stringify({
                            poNum: currentData.poNum,
                            status: poStatus
                        })
                );

                returnObj.details = [
                    'PO#',
                    currentData.poNum,
                    ' current status: ' + poStatus.statusRef
                ].join('');

                throw BILL_CREATOR.Code.NOT_BILLABLE;
            }
            ///////////////////////////////////

            var hasVariance = false,
                listVariance = [];

            //// TRANSFORM TO VENDOR BILL ////////////////
            log.debug(logTitle, '** Vendor Bill record creation:start **');
            var recBill = record.transform({
                fromType: 'purchaseorder',
                fromId: currentData.poId,
                toType: 'vendorbill',
                isDynamic: true
            });

            // store the current posting period
            var postingPeriod = recBill.getValue({ fieldId: 'postingperiod' });

            recBill.setValue({
                fieldId: 'trandate',
                value: format.parse({
                    value: billPayload.date,
                    type: format.Type.DATE
                })
            });
            if (billPayload.duedate) {
                recBill.setValue({
                    fieldId: 'duedate',
                    value: format.parse({
                        value: billPayload.duedate,
                        type: format.Type.DATE
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
            ///////////////////////////////////

            log.debug(logTitle, '.. set invoice name: ' + billPayload.invoice);
            recBill.setValue({
                fieldId: 'tranid',
                value: billPayload.invoice
            });

            /// VALIDATE THE LINES /////////////
            var lineCount = recBill.getLineCount({ sublistId: 'item' });
            var arrLines = [];

            log.debug(
                logTitle,
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
                log.debug(logTitle, log_prefix + 'validating line: ' + JSON.stringify(vbLineData));

                var isLineFound = false;

                for (var bpline = 0; bpline < billPayload.lines.length; bpline++) {
                    var payloadLineData = billPayload.lines[bpline];
                    if (payloadLineData.NSITEM != vbLineData.item) continue;

                    isLineFound = true;

                    log.debug(
                        logTitle,
                        log_prefix + 'matching lines: ' + JSON.stringify(payloadLineData)
                    );

                    var billQty =
                        payloadLineData.QUANTITY > vbLineData.quantity
                            ? vbLineData.quantity
                            : payloadLineData.QUANTITY;

                    vbLineData.billQty += billQty;
                    vbLineData.billRate = payloadLineData.PRICE;
                    payloadLineData.QUANTITY -= billQty;
                    vbLineData.process = true;
                }
                if (!isLineFound) {
                    log.debug(logTitle, log_prefix + '// unable to find matching payload line');
                }

                arrLines.push(vbLineData);
            }
            ///////////////////////////////

            var fileFullyProcessed = true;
            log.debug(logTitle, 'Checking unprocessed payload line...');
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
                    log.debug(logTitle, log_prefix + '// bill rate doesnt match po rate');

                    lineVariance.push('Price');
                    listVariance.push('Price');

                    recBill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: lineDataVB.billRate
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

                log.debug(logTitle, log_prefix + ' line tax total:  ' + lineTaxTotal);

                recBill.commitLine({ sublistId: 'item' });
            }
            ///////////////////////////////
            log.debug(logTitle, 'Processing charges :  ' + JSON.stringify(billPayload.charges));
            log.debug(logTitle, '// variances :  ' + JSON.stringify(billPayload.variance));

            taxTotal = Helper.roundOff(taxTotal);

            var vbTaxTotal =
                parseFloat(recBill.getValue({ fieldId: 'taxtotal' })) +
                parseFloat(recBill.getValue({ fieldId: 'tax2total' }));

            var deltaCharges = {
                tax: Helper.roundOff(billPayload.charges.tax - taxTotal)
            };

            log.debug(
                logTitle,
                'Tax Total: ' +
                    JSON.stringify({
                        lineTaxTotal: taxTotal,
                        vbTaxTotal: vbTaxTotal,
                        poTaxTotal: currentData.taxTotal,
                        taxCharges: billPayload.charges.tax,
                        delta: deltaCharges.tax
                    })
            );

            var ignoreVariance =
                billPayload.hasOwnProperty('ignoreVariance') && billPayload.ignoreVariance == 'T';

            log.audit(logTitle, '>> variance lines: ' + JSON.stringify(billPayload.varianceLines));
            log.audit(logTitle, '>> variance: ' + JSON.stringify(billPayload.variance));

            if (billPayload.varianceLines && billPayload.varianceLines.length) {
                hasVariance = true;

                billPayload.varianceLines.forEach(function (varianceData) {
                    listVariance.push(varianceData.name);
                    Helper.addNewLine({
                        record: recBill,
                        qty: 1,
                        description: varianceData.description,
                        item: varianceData.item,
                        rate: taxVariance.rate
                    });

                    return true;
                });
            } else {
                var varianceValues = billPayload.variance || {};

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
                shipVariance.amount = billPayload.charges.shipping;
                if (varianceValues.hasOwnProperty('applyShip')) {
                    shipVariance.apply = varianceValues.applyShip == 'T';
                    shipVariance.amount = varianceValues.shipping;
                }
                log.debug(logTitle, '>> shipVariance: ' + JSON.stringify(shipVariance));

                otherVariance.apply = param.hasOtherVariance;
                otherVariance.amount = billPayload.charges.other;
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

                    try {
                        Helper.addNewLine({
                            record: recBill,
                            qty: 1,
                            description: 'VC: Tax Variance',
                            item: param.taxItem,
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

                    try {
                        Helper.addNewLine({
                            record: recBill,
                            qty: 1,
                            description: 'VC: Ship Variance',
                            item: param.shipItem,
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

                    try {
                        Helper.addNewLine({
                            record: recBill,
                            qty: 1,
                            item: param.otherItem,
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

                    try {
                        Helper.addNewLine({
                            record: recBill,
                            qty: 1,
                            item: param.otherItem,
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

            if (hasVariance && !currentData.processVariance) {
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

                return returnObj;
            }

            /////////////////////////////////

            log.debug(logTitle, '** Saving the bill record ** ');

            // attempt to save the record ////
            recBill.setValue({ fieldId: 'approvalstatus', value: param.billDefaultStatus || 1 }); // defaults to pending approval

            if (param.dontSaveBill) {
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
                    '>>> Bill Created succesfully...' + [currentData.poNum, billPayload.invoice]
                );

                returnObj = JSON.parse(JSON.stringify(recBill));
                util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATED);
                returnObj.details =
                    'Linked to vendor bill ' +
                    JSON.stringify({ id: newRecordId, name: billPayload.invoice });
            } else {
                log.debug(
                    logTitle,
                    '// bill creation fail...' + [currentData.poNum, billPayload.invoice]
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
            ].join('\r\n');

            log.audit(logTitle, '## ERROR ## ' + JSON.stringify(returnObj));
        } finally {
            VC_Log.add({
                header: LOG_APP,
                transaction: CURRENT_PO,
                body: [
                    returnObj.msg,
                    returnObj.details != returnObj.msg ? returnObj.details : ''
                ].join(' -- '),
                status: returnObj.isError
                    ? VC_Constants.Lists.VC_LOG_STATUS.ERROR
                    : VC_Constants.Lists.VC_LOG_STATUS.INFO
            });

            log.debug(logTitle, '## EXIT SCRIPT ## ' + JSON.stringify(returnObj));
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
        searchValues = search.lookupFields({
            type: 'customrecord_ctc_vc_bills',
            id: '574',
            columns: arrFields
        });

    _post(searchValues);

    // return {
    //     post: _post
    // };
});
