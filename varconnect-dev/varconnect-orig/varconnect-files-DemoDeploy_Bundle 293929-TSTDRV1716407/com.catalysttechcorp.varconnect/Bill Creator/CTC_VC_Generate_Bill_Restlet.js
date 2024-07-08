/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['./Libraries/lodash', 'N/record', 'N/search', 'N/log', 'N/format', 'N/runtime'],
    function(lodash, record, search, log, format, runtime) {

        var Helper = {
            extractError: function (option) {
                var errorMessage = util.isString(option) ? option :
                    option.message || option.error || JSON.stringify(option);

                if (!errorMessage || !util.isString(errorMessage))
                    errorMessage = 'Unexpected Error occurred';

                return errorMessage;
            },
            getLinesToBill: function (option) {
                var logTitle = 'getLinesToBill',
                    returnValue;
                option = option || {};

                var arrLinesToBill = [];

                var recPO = option.poRecord,
                    billPayload = option.payload;

                var lineCount = recPO.getLineCount({ sublistId: 'item' });
                for (var line = 0; line < lineCount; line++) {
                    var lineData = {
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
                        }),
                    };
                    billPayload.lines.forEach(function (lineBill) {
                        if (lineBill.NSITEM == lineData.item &&
                            lineBill.QUANTITY > lineData.qtybilled) {
                            arrLinesToBill.push(lineBill);
                        }

                        return true;
                    });
                }

                log.audit(logTitle, '>> Lines To Bill: ' + JSON.stringify(arrLinesToBill));
                returnValue = arrLinesToBill;

                return returnValue;
            },
            getExistingBill: function (option) {
                var logTitle = 'getExistingBill',
                    returnValue;
                option = option || {};
                var arrExistingBills = [];

                var vendorbillSearchObj = search.create({
                    type: "vendorbill",
                    filters: [["type", "anyof", "VendBill"],
                        "AND", ["mainname", "anyof", option.entity],
                        "AND", ["numbertext", "is", option.invoiceNo],
                        "AND", ["mainline", "is", "T"]
                    ],
                    columns: ["internalid"]
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
                var logTitle = 'isPeriodLocked',
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
                var logTitle = 'isPeriodLocked',
                    returnValue;
                option = option || {};
                var record = option.record;

                record.selectNewLine({ sublistId: 'item' });
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: option.item
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
                record.commitLine({ sublistId: 'item' });

                returnValue = true;

                return returnValue;
            }
        };
        var BILL_FILE_STATUS = {
            PENDING: 1,
            ERROR: 2,
            PROCESSED: 3,
            REPROCESS: 4,
            CLOSED: 5,
            HOLD: 6,
            VARIANCE: 7
        };
        var MESSAGE_CODE = {
            PO_IS_MISSING: 'Purchase Order Required',
            PO_NOT_BILLABLE: 'Purchase Order not Ready to Bill',
            NOT_FULLY_PROCESS: 'Could not fully process Bill File',
            ALREADY_BILLED: 'Item are already billed',
            LINK_EXISTING_BILLS: 'Linked to existing Vendor Bill',
            HAS_VARIANCE: 'One or More Variances in Vendor Bill',
            BILL_CREATED: 'Created Vendor Bill',
            BILL_NOT_CREATED: 'Failed to create the Vendor Bill'
        };

        function _post_orig(context) {

            var s = runtime.getCurrentScript();

            log.debug('context', context);

            var billInAdvance = context.billInAdvance;

            var poId = context.custrecord_ctc_vc_bill_linked_po[0].value;

            var processVariance = context.custrecord_ctc_vc_bill_proc_variance;

            log.debug('poId', poId)

            // if no PO exists, stop processing and return

            if (!poId) {
                return {
                    msg: 'Purchase Order Required',
                    billStatus: BILL_FILE_STATUS.ERROR
                };
            }

            var poRec = record.load({
                type: 'purchaseorder',
                id: poId,
            });

            var poNum = poRec.getValue({
                fieldId: 'tranid'
            });

            var billPayload = JSON.parse(context.custrecord_ctc_vc_bill_json);

            // check if bill already exists and if so link it back to the file

            var existingBillIds = []

            var poEntity = poRec.getValue({
                fieldId: 'entity'
            });

            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters: [
                    ["type", "anyof", "VendBill"],
                    "AND", ["mainname", "anyof", poEntity],
                    "AND", ["numbertext", "is", billPayload.invoice],
                    "AND", ["mainline", "is", "T"]
                ],
                columns: [
                    "internalid"
                ]
            });

            vendorbillSearchObj.run().each(function(result) {
                existingBillIds.push(result.getValue('internalid'));
                return true;
            });

            if (existingBillIds.length > 0) {
                log.audit('skipping', poNum + ': ' + 'inv# ' + billPayload.invoice + ' already exists');

                var billRec = record.load({
                    type: 'vendorbill',
                    id: existingBillIds[0],
                })

                var returnObj = JSON.parse(JSON.stringify(billRec));

                returnObj.close = true;
                returnObj.msg = 'Linked to existing Vendor Bill'

                return (returnObj);

            }

            // check the po status and if it's not ready for billing return back a null value

            var myStatus = poRec.getValue({
                fieldId: 'status'
                }),
                myStatusRef = poRec.getValue({
                    fieldId: 'statusRef'
            })

            log.debug('mystatus', JSON.stringify([myStatus, myStatusRef]))

            var process = false;

            if (myStatusRef == 'pendingBilling' ||
                myStatus == 'Pending Billing/Partially Received' ||
                myStatus == 'Pending Bill' || billInAdvance == true) {
                process = true;
            };

            if (process == false) {
                log.audit('skipping', poNum + ': ' + 'inv# ' + billPayload.invoice + ', purchase order not received');
                return {
                    msg: 'Purchase Order not Ready to Bill'
                };
                //return;
            }

            // all the prerquisites have been met to generate a bill

            var hasVariance = false;

            var bill = record.transform({
                fromType: 'purchaseorder',
                fromId: poId,
                toType: 'vendorbill',
                isDynamic: true
            });

            // this is the "current" open period.  if the bill date is in a prior period and that period 
            // is locked or closed we'll revert back to this period later in the process so that the bill
            // isn't put into a period that is actively being closed.

            var currentPostingPeriod = bill.getValue({
                fieldId: 'postingperiod'
            });

            bill.setValue({
                fieldId: 'trandate',
                value: format.parse({
                    value: billPayload.date,
                    type: format.Type.DATE
                })
            });

            if (billPayload.hasOwnProperty('duedate') == true) {

                bill.setValue({
                    fieldId: 'duedate',
                    value: format.parse({
                        value: billPayload.duedate,
                        type: format.Type.DATE
                    })
                });

            }


            // check for the transaction dates periods status to see if we need to revert back to the current
            // period.

            var getPeriodValues = search.lookupFields({
                type: search.Type.ACCOUNTING_PERIOD,
                id: bill.getValue({
                    fieldId: 'postingperiod'
                }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            if (getPeriodValues.aplocked ||
                getPeriodValues.alllocked ||
                getPeriodValues.closed)
                bill.setValue({
                    fieldId: 'postingperiod',
                    value: currentPostingPeriod
                });


            bill.setValue({
                fieldId: 'tranid',
                value: billPayload.invoice
            });

            // iterate transformed bill lines and update based on data we got back from vendor

            var numLines = bill.getLineCount({
                sublistId: 'item'
            });
            var stage = [];

            // loop 1
            // iterate the bill lines and build out a line level payload with the summarized bill data we have from the flex file
            // this could be a one:many situation where one line on the flex file gets distributed across multiple lines on the bill

            for (var i = 0; i < numLines; i++) {

                log.debug('validating line', i);

                var sObj = {
                    lineNumber: i,
                    lineItem: null,
                    lineRate: 0,
                    lineBillable: 0,
                    billQty: 0,
                    billRate: 0,
                    process: false
                };

                bill.selectLine({
                    sublistId: 'item',
                    line: i
                });

                sObj.lineItem = bill.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                });

                sObj.lineRate = bill.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate'
                });

                sObj.lineBillable = bill.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity'
                });

                var itemIdxs = [];

                for (var z = 0; z < billPayload.lines.length; z++) {
                    if (billPayload.lines[z].NSITEM == sObj.lineItem) {
                        itemIdxs.push(z)
                    }
                }

                if (itemIdxs.length > 0) {
                    sObj.process = true;
                }

                for (var x = 0; x < itemIdxs.length; x++) {

                    var flexQty = billPayload.lines[itemIdxs[x]].QUANTITY;

                    var billQty = 0;

                    // the po has more qty than what's on this bill line so exhaust it all here

                    if (flexQty <= sObj.lineBillable) {
                        billQty = flexQty;
                    }

                    // the po line is less than what we have to bill. attempt to push them there now hoping there are 
                    // more lines later with the same SKU. If not we'll throw an error later

                    if (flexQty > sObj.lineBillable) {
                        billQty = sObj.lineBillable
                    }

                    sObj.billQty += billQty;
                    billPayload.lines[itemIdxs[x]].QUANTITY -= billQty;

                    sObj.billRate = billPayload.lines[itemIdxs[x]].PRICE;

                }

                stage.push(sObj);
            }

            // loop 2
            // go through the payload and make sure everyhing was picked up and put into the stage file
            // there should be no quantity remaining in the bill payload.

            var fileFullyProcessed = true;

            billPayload.lines.forEach(function(line) {
                if (line.QUANTITY > 0) {
                    fileFullyProcessed = false;
                    log.audit('unprocessed line', JSON.stringify(line));
                }
            })

            if (fileFullyProcessed == false) {
                return {
                    msg: 'Could not fully process Bill File'
                };

            }


            // flip the array so we can work from the bottom up which is a requirement since we are deleting lines
            lodash.reverse(stage);

            //loop 3
            // take the staged data from loop 1 and either set the qty/amt or delete the line from the bill
            var totalVarianceMsg = [];

            stage.forEach(function(line) {

                log.debug('processing line', line.lineNumber);
                log.debug('line details', line);

                bill.selectLine({
                    sublistId: 'item',
                    line: line.lineNumber
                });

                if (line.process == false) {

                    bill.removeLine({
                        sublistId: 'item',
                        line: line.lineNumber
                    });

                } else {

                    var payloadQty = line.billQty;

                    var payloadPrice = line.billRate

                    // start matching ns values to file values and call out any variances                

                    var varianceReasons = '';

                    var nsQty = bill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    });

                    var nsPrice = bill.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate'
                    });

                    //Check file qty vs bill qty here
                    //If not match, continue vendor invoice loop

                    if (payloadQty !== nsQty) {

                        if (payloadQty == 0) {

                            bill.removeLine({
                                sublistId: 'item',
                                line: line.lineNumber
                            });

                            return;
                        }

                        // this shouldn't be able to happen

                        if (payloadQty > nsQty) {

                            bill.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ctc_create_bill_variance',
                                value: true
                            });

                            varianceReasons += 'Quantity Mismatch (' + nsQty + ')\r\n';
                            hasVariance = true;
                            totalVarianceMsg.push('Quantity');

                            log.debug('variance', varianceReasons);
                        }
                    };

                    // bill.setCurrentSublistValue({
                    //     sublistId: 'item',
                    //     fieldId: 'custcol_ctc_create_bill_qty',
                    //     value: payloadQty
                    // });

                    if (nsQty > payloadQty)
                        bill.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: payloadQty
                        });

                    //bill only fulfilled changes - END

                    if (payloadPrice !== nsPrice) {

                        bill.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_create_bill_variance',
                            value: true
                        });

                        varianceReasons += 'Price Mismatch (' + nsPrice + ')\r\n';
                        hasVariance = true;
                        totalVarianceMsg.push('Price');

                        log.debug('variance', varianceReasons);

                        bill.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: payloadPrice
                        });
                    };

                    bill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_bill_variance_rsn',
                        value: varianceReasons
                    });

                    log.debug('commit-line', 'commit-line: true');

                    bill.commitLine({
                        sublistId: "item"
                    })
                }
            })

            // add header level vendor charges as line items

            log.debug('charges', JSON.stringify(billPayload.charges));
            if (billPayload.charges.shipping !== 0) {

                bill.selectNewLine({
                    sublistId: 'item'
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: s.getParameter({
                        name: 'custscript_ctc_bc_ship_item'
                    })
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: billPayload.charges.shipping
                });

                bill.commitLine({
                    sublistId: "item"
                });

                var shipVariance = s.getParameter({
                    name: 'custscript_ctc_bc_ship_var_2'
                })

                if (shipVariance == true){
                    hasVariance = true;
                    totalVarianceMsg.push('Shipping');
                }

            }

            if (billPayload.charges.tax !== 0) {

                bill.selectNewLine({
                    sublistId: 'item'
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: s.getParameter({
                        name: 'custscript_ctc_bc_tax_item'
                    })
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: billPayload.charges.tax
                });

                bill.commitLine({
                    sublistId: "item"
                });

                var taxVariance = s.getParameter({
                    name: 'custscript_ctc_bc_tax_var'
                })

                if (taxVariance == true){
                    hasVariance = true;
                    totalVarianceMsg.push('Tax');
                }

            }

            if (billPayload.charges.other !== 0) {

                bill.selectNewLine({
                    sublistId: 'item'
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: s.getParameter({
                        name: 'custscript_ctc_bc_other_item'
                    })
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: billPayload.charges.other
                });

                bill.commitLine({
                    sublistId: "item"
                });

                var otherVariance = s.getParameter({
                    name: 'custscript_ctc_bc_other_var'
                })

                if (otherVariance == true){
                    hasVariance = true;
                    totalVarianceMsg.push('Other Charges');
                }
            }

            log.debug('processVariance', processVariance);

            if (hasVariance == true && processVariance !== true) {

                return {
                    msg: 'One or More Variances in Vendor Bill -- ' + totalVarianceMsg.join('  | '),
                    variance: true
                };
            }

            bill.setValue({
                fieldId: 'approvalstatus',
                value: 2
            });

            var newRecord = bill.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            if (newRecord) {
                log.audit('bill created', poNum + ': ' + billPayload.invoice);
            } else {
                log.audit('no bill created', poNum + ': ' + billPayload.invoice);
            }

            var returnBill = JSON.parse(JSON.stringify(bill));
            returnBill.msg = 'Created Vendor Bill';

            return returnBill;
        }

        function _post(context) {
            var logTitle = 'POST',
                returnObj = {},
                ignoreError = true,
                currentData = {},
                currScript = runtime.getCurrentScript();

            var param = {
                shipItem: currScript.getParameter({ name: 'custscript_ctc_bc_ship_item' }),
                taxItem: currScript.getParameter({ name: 'custscript_ctc_bc_tax_item' }),
                otherItem: currScript.getParameter({ name: 'custscript_ctc_bc_other_item' }),
                hasShippingVariance: currScript.getParameter({ name: 'custscript_ctc_bc_ship_var' }),
                hasTaxVariance: currScript.getParameter({ name: 'custscript_ctc_bc_tax_var' }),
                hasOtherVariance: currScript.getParameter({ name: 'custscript_ctc_bc_other_var' }),
            };

            try {
                log.audit(logTitle, '>> params: ' + JSON.stringify(param));
                log.audit(logTitle, '>> request: ' + context);

                currentData = {
                    poId: context.custrecord_ctc_vc_bill_linked_po && context.custrecord_ctc_vc_bill_linked_po[0] ?
                        context.custrecord_ctc_vc_bill_linked_po[0].value : false,
                    billInAdvance: context.billInAdvance,
                    processVariance: context.custrecord_ctc_vc_bill_proc_variance
                };
                log.debug(logTitle, '>>  currentData:' + JSON.stringify(currentData));

                if (!currentData.poId) {
                    throw 'PO_IS_MISSING';
                }

                var recPO = record.load({
                    type: 'purchaseorder',
                    id: currentData.poId
                });

                currentData.poNum = recPO.getValue({ fieldId: 'tranid' });
                currentData.poEntity = recPO.getValue({ fieldId: 'entity' });
                currentData.taxTotal = recPO.getValue({ fieldId: 'taxtotal' });
                var billPayloadObj = JSON.parse(context.custrecord_ctc_vc_bill_json);

                log.audit(logTitle, '>>  Bill Payload:' + JSON.stringify(billPayloadObj));
                log.debug(logTitle, '>>  Validating remaining items to bill...');

                /// FIND EXISTING BILLS ////////////////////////////
                log.debug(logTitle, '>>  Checking for existing bills...');
                var arrExistingBills = Helper.getExistingBill({
                    entity: currentData.poEntity,
                    invoiceNo: billPayloadObj.invoice
                });

                if (arrExistingBills && arrExistingBills.length) {

                    var billRec = record.load({
                        type: 'vendorbill',
                        id: arrExistingBills[0],
                    });

                    returnObj = JSON.parse(JSON.stringify(billRec));
                    returnObj.existingBills = JSON.stringify(arrExistingBills);
                    returnObj.billStatus = BILL_FILE_STATUS.CLOSED
                    returnObj.close = true;
                    returnObj.code = 'LINK_EXISTING_BILLS';
                    returnObj.msg = MESSAGE_CODE['LINK_EXISTING_BILLS'];
                    return returnObj;
                }
                ///////////////////////////////////

                /// VALIDATE REMAING ITEMS TO BILL /////////////////////////////
                var arrLinesToBill = Helper.getLinesToBill({
                    payload: billPayloadObj,
                    poRecord: recPO
                });

                if (!arrLinesToBill || !arrLinesToBill.length) {
                    returnObj.close = true;
                    returnObj.billStatus = BILL_FILE_STATUS.CLOSED
                    returnObj.code = 'ALREADY_BILLED';
                    returnObj.msg = MESSAGE_CODE['ALREADY_BILLED'];
                    return returnObj;
                }
                ///////////////////////////////////

                ///////////////////////////////////
                // get status of PO
                var poStatus = {
                    status: recPO.getValue({ fieldId: 'status' }),
                    statusRef: recPO.getValue({ fieldId: 'statusRef' }),
                };

                if (poStatus.statusRef == 'pendingBilling' ||
                    poStatus.status == 'Pending Billing/Partially Received' ||
                    poStatus.status == 'Pending Bill' || billInAdvance) {

                    // continue processing
                    log.audit(logTitle, '>> Status: ' + JSON.stringify(poStatus));

                } else {
                    /// not ready for billing!
                    log.audit(logTitle, '>> Skipping poId, Purchase Order not Ready to Bill' +
                        JSON.stringify({ poNum: currentData.poNum, status: poStatus }));

                    throw 'PO_NOT_BILLABLE';
                }
                ///////////////////////////////////

                var hasVariance = false,
                    listVariance = [];


                //// TRANSFORM TO VENDOR BILL ////////////////
                var recBill = record.transform({
                    fromType: 'purchaseorder',
                    fromId: currentData.poId,
                    toType: 'vendorbill',
                    isDynamic: true
                });

                // store the current posting period
                var postingPeriod = recBill.getValue({
                    fieldId: 'postingperiod'
                });

                recBill.setValue({
                    fieldId: 'trandate',
                    value: format.parse({
                        value: billPayloadObj.date,
                        type: format.Type.DATE
                    })
                });
                if (billPayloadObj.duedate) {
                    recBill.setValue({
                        fieldId: 'duedate',
                        value: format.parse({
                            value: billPayloadObj.duedate,
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

                recBill.setValue({
                    fieldId: 'tranid',
                    value: billPayloadObj.invoice
                });

                /// VALIDATE THE LINES /////////////
                var lineCount = recBill.getLineCount({ sublistId: 'item' });
                var arrLines = [];

                for (var line = 0; line < lineCount; line++) {
                    recBill.selectLine({ sublistId: 'item', line: line });
                    var lineData = {
                        lineNo: line,
                        lineItem: recBill.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }),
                        lineRate: recBill.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' }),
                        lineBillable: recBill.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' }),
                        billQty: 0,
                        billRate: 0,
                        process: false
                    };
                    log.debug(logTitle, '>> validating line: ' + JSON.stringify(lineData));

                    for (var bpline = 0; bpline < billPayloadObj.lines.length; bpline++) {

                        var bplineData = billPayloadObj.lines[bpline];
                        if (bplineData.NSITEM == lineData.lineItem) {

                            var billQty = bplineData.QUANTITY > lineData.lineBillable ?
                                lineData.lineBillable : bplineData.QUANTITY;

                            lineData.billQty += billQty;
                            lineData.billRate = bplineData.PRICE;
                            bplineData.QUANTITY -= billQty;
                            lineData.process = true;
                        }
                    }
                    arrLines.push(lineData);
                }
                ///////////////////////////////

                var fileFullyProcessed = true;
                billPayloadObj.lines.forEach(function (line) {
                    if (line.QUANTITY > 0) {
                        fileFullyProcessed = false;
                        log.audit('unprocessed line', JSON.stringify(line));
                    }
                });

                if (!fileFullyProcessed) {
                    throw 'NOT_FULLY_PROCESS';
                }

                arrLines.reverse();

                /// PROCESS THE LINES /////////////
                for (var lineVB = 0; lineVB < arrLines.length; lineVB++) {
                    var lineDataVB = arrLines[lineVB],
                        lineVariance = [];
                    log.debug(logTitle, '>>> Proceessing line: ' + JSON.stringify(lineDataVB));

                    if (!lineDataVB.process) {
                        recBill.removeLine({ sublistId: 'item', line: lineDataVB.lineNo });
                        continue;
                    }

                    ////////////////
                    recBill.selectLine({ sublistId: 'item', line: lineDataVB.lineNo });

                    var currentLineData = {
                        qty: recBill.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity'
                        }),
                        rate: recBill.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate'
                        }),
                    };

                    /// LINE: QTY Variance /////////////////////
                    ///////////////////////////////////
                    if (lineDataVB.billQty != currentLineData.qty) {

                        if (lineDataVB.billQty == 0) {
                            recBill.removeLine({ sublistId: 'item', line: lineDataVB.lineNo });
                            continue;
                        }

                        if (lineDataVB.billQty > currentLineData.qty) {

                            recBill.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ctc_create_bill_variance',
                                value: true

                            });

                            lineVariance.push('Quantity Mismatch (' + currentLineData.qty + ')');
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

                        lineVariance.push('Price Mismatch (' + currentLineData.rate + ')');
                        listVariance.push('Price');

                        recBill.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_create_bill_variance',
                            value: true
                        });

                        recBill.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: lineDataVB.billRate
                        });
                    }
                    ///////////////////////////////////

                    if (lineVariance.length) hasVariance = true;
                    recBill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_bill_variance_rsn',
                        value: lineVariance.join("\r\n")
                    });

                    recBill.commitLine({ sublistId: "item" });
                }
                ///////////////////////////////
                log.debug(logTitle, '>> Processing charges :  ' + JSON.stringify(billPayloadObj.charges));

                if (billPayloadObj.charges.shipping) {
                    Helper.addNewLine({
                        record: recBill,
                        item: param.shipItem,
                        qty: 1,
                        rate: billPayloadObj.charges.shipping
                    });

                    if (param.hasShippingVariance) {
                        listVariance.push('Shipping');
                        hasVariance = true;
                    }
                }
                if (billPayloadObj.charges.tax) {
                    Helper.addNewLine({
                        record: recBill,
                        item: param.taxItem,
                        qty: 1,
                        rate: billPayloadObj.charges.tax
                    });

                    if (param.hasTaxVariance) {
                        if (currentData.taxTotal != billPayloadObj.charges.tax) {
                            listVariance.push('Tax');
                            hasVariance = true;
                        }
                    }
                }
                if (billPayloadObj.charges.other) {
                    Helper.addNewLine({
                        record: recBill,
                        item: param.otherItem,
                        qty: 1,
                        rate: billPayloadObj.charges.other
                    });

                    if (param.hasOtherVariance) {
                        listVariance.push('Tax');
                        hasVariance = true;
                    }
                }

                if (hasVariance && !currentData.processVariance) {

                    returnObj.billStatus = BILL_FILE_STATUS.VARIANCE
                    returnObj.code = 'HAS_VARIANCE';
                    returnObj.msg = MESSAGE_CODE['HAS_VARIANCE'];
                    if (listVariance.length) {
                        returnObj.msg+= ' -- ' + listVariance.join(' | ');
                    }
                    return returnObj;
                }

                // attempt to save the record ////
                recBill.setValue({ fieldId: 'approvalstatus', value: 2 });
                var newRecordId = recBill.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (newRecordId) {
                    log.debug(logTitle, '>>> Bill Created succesfully...' + [currentData.poNum, billPayloadObj.invoice]);

                    returnObj = JSON.parse(JSON.stringify(recBill));
                    returnObj.billStatus = BILL_FILE_STATUS.PROCESSED;
                    returnObj.code = 'BILL_CREATED';
                    returnObj.msg = MESSAGE_CODE['BILL_CREATED'];

                } else {
                    log.debug(logTitle, '>>> Bill Created fail...' + [currentData.poNum, billPayloadObj.invoice]);

                    returnObj = JSON.parse(JSON.stringify(recBill));
                    returnObj.billStatus = BILL_FILE_STATUS.ERROR;
                    returnObj.code = 'BILL_NOT_CREATED';
                    returnObj.msg = MESSAGE_CODE['BILL_NOT_CREATED'];
                }

                return returnObj;

            } catch (error) {
                var errorCode = Helper.extractError(error);
                returnObj.code = errorCode;
                returnObj.msg = MESSAGE_CODE[errorCode] || errorCode;
                returnObj.billStatus = BILL_FILE_STATUS.ERROR;

                log.audit(logTitle, '## ERROR ## ' + JSON.stringify(returnObj));
            }

            return returnObj;
        }

        return {
            post: _post
        };
    });
