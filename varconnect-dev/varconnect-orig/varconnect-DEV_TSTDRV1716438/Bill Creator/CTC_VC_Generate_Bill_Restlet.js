/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['./Libraries/lodash', 'N/record', 'N/search', 'N/log', 'N/format', 'N/runtime'], function (
    lodash,
    record,
    search,
    log,
    format,
    runtime
) {
    function _post(context) {
        var s = runtime.getCurrentScript();

        log.debug('context', context);

        var billInAdvance = context.billInAdvance;

        var poId = context.custrecord_ctc_vc_bill_linked_po[0].value;

        var processVariance = context.custrecord_ctc_vc_bill_proc_variance;

        log.debug('poId', poId);

        // if no PO exists, stop processing and return

        if (!poId) {
            return {
                msg: 'Purchase Order Required'
            };
        }

        var poRec = record.load({
            type: 'purchaseorder',
            id: poId
        });

        var poNum = poRec.getValue({
            fieldId: 'tranid'
        });

        var billPayload = JSON.parse(context.custrecord_ctc_vc_bill_json);

        // check if bill already exists and if so link it back to the file

        var existingBillIds = [];

        var poEntity = poRec.getValue({
            fieldId: 'entity'
        });

        var vendorbillSearchObj = search.create({
            type: 'vendorbill',
            filters: [
                ['type', 'anyof', 'VendBill'],
                'AND',
                ['mainname', 'anyof', poEntity],
                'AND',
                ['numbertext', 'is', billPayload.invoice],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        });

        vendorbillSearchObj.run().each(function (result) {
            existingBillIds.push(result.getValue('internalid'));
            return true;
        });

        if (existingBillIds.length > 0) {
            log.audit('skipping', poNum + ': ' + 'inv# ' + billPayload.invoice + ' already exists');

            var billRec = record.load({
                type: 'vendorbill',
                id: existingBillIds[0]
            });

            var returnObj = JSON.parse(JSON.stringify(billRec));

            returnObj.close = true;
            returnObj.msg = 'Linked to existing Vendor Bill';

            return returnObj;
        }

        // check the po status and if it's not ready for billing return back a null value

        var myStatus = poRec.getValue({
            fieldId: 'status'
        });

        var process = false;

        if (
            myStatus == 'Pending Billing/Partially Received' ||
            myStatus == 'Pending Bill' ||
            billInAdvance == true
        ) {
            process = true;
        }

        if (process == false) {
            log.audit(
                'skipping',
                poNum + ': ' + 'inv# ' + billPayload.invoice + ', purchase order not received'
            );
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

        if (getPeriodValues.aplocked || getPeriodValues.alllocked || getPeriodValues.closed)
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
                    itemIdxs.push(z);
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
                    billQty = sObj.lineBillable;
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

        billPayload.lines.forEach(function (line) {
            if (line.QUANTITY > 0) {
                fileFullyProcessed = false;
                log.audit('unprocessed line', JSON.stringify(line));
            }
        });

        if (fileFullyProcessed == false) {
            return {
                msg: 'Could not fully process Bill File'
            };
        }

        // flip the array so we can work from the bottom up which is a requirement since we are deleting lines

        lodash.reverse(stage);

        //loop 3
        // take the staged data from loop 1 and either set the qty/amt or delete the line from the bill

        stage.forEach(function (line) {
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

                var payloadPrice = line.billRate;

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

                        log.debug('variance', varianceReasons);
                    }
                }

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

                    log.debug('variance', varianceReasons);

                    bill.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: payloadPrice
                    });
                }

                bill.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ctc_bill_variance_rsn',
                    value: varianceReasons
                });

                bill.commitLine({
                    sublistId: 'item'
                });
            }
        });

        // add header level vendor charges as line items

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
                sublistId: 'item'
            });

            var shipVariance = s.getParameter({
                name: 'custscript_ctc_bc_ship_var'
            });

            if (shipVariance == true) {
                hasVariance = true;
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
                sublistId: 'item'
            });

            var taxVariance = s.getParameter({
                name: 'custscript_ctc_bc_tax_var'
            });

            if (taxVariance == true) {
                hasVariance = true;
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
                sublistId: 'item'
            });

            var otherVariance = s.getParameter({
                name: 'custscript_ctc_bc_other_var'
            });

            if (otherVariance == true) {
                hasVariance = true;
            }
        }

        log.debug('processVariance', processVariance);

        if (hasVariance == true && processVariance !== true) {
            return {
                msg: 'One or More Variances in Vendor Bill',
                variance: true
            };
        }

        bill.setValue({
            fieldId: 'approvalstatus',
            value: 2
        });

        var newRecord = bill.save();

        if (newRecord) {
            log.audit('bill created', poNum + ': ' + billPayload.invoice);
        } else {
            log.audit('no bill created', poNum + ': ' + billPayload.invoice);
        }

        var returnBill = JSON.parse(JSON.stringify(bill));
        returnBill.msg = 'Created Vendor Bill';

        return returnBill;
    }

    return {
        post: _post
    };
});
