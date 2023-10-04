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
define(['N/record', 'N/search', 'N/log', 'N/format', './Libraries/lodash'], function (
    record,
    search,
    log,
    format,
    lodash
) {
    function _post(context) {
        var vcSerial = {};

        log.debug('context', context);

        var billPayload = JSON.parse(context.custrecord_ctc_vc_bill_json);

        var poId = context.custrecord_ctc_vc_bill_linked_po[0].value;
        vcSerial.poId = poId;

        var isRecievable = context.custrecord_ctc_vc_bill_is_recievable;

        if (isRecievable == false) {
            log.audit('return', 'This Vendor is not enabled for Auto Receipts/Fulfillments');
            return {
                msg: 'This Vendor is not enabled for Auto Receipts/Fulfillments'
            };
        }

        log.debug('poId', poId);

        // if no PO exists, stop processing and return

        if (!poId) {
            log.audit('return', 'Purchase Order Required');
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

        var dropShipSo = poRec.getValue({
            fieldId: 'dropshipso'
        });

        if (dropShipSo == '') {
            log.audit('return', 'Not a Drop Ship Order');
            return {
                msg: 'Not a Drop Ship Order'
            };
        }

        var poEntity = poRec.getValue({
            fieldId: 'entity'
        });

        vcSerial.soId = createdFrom = poRec.getValue({
            fieldId: 'createdfrom'
        });

        vcSerial.custId = search.lookupFields({
            type: search.Type.SALES_ORDER,
            id: vcSerial.soId,
            columns: ['entity']
        }).entity[0].value;

        vcSerial.type = null;

        vcSerial.lines = [];

        log.debug('poEntity', poEntity);

        if (
            poEntity == '75' ||
            poEntity == '203' ||
            poEntity == '216' ||
            poEntity == '371' ||
            poEntity == '496'
        ) {
            //Cisco || Dell || EMC || Scansource || Westcon

            // check if IF/IR already exists and if so link it back to the file

            log.debug('running', 'if/ir');

            var alreadyExists = false;

            var poEntity = poRec.getValue({
                fieldId: 'entity'
            });

            var transactionSearchObj = search.create({
                type: 'transaction',
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['externalid', 'is', 'ifir_' + billPayload.invoice],
                    'AND',
                    ['type', 'anyof', 'ItemShip', 'ItemRcpt']
                ],
                columns: ['internalid', 'tranid']
            });

            transactionSearchObj.run().each(function (result) {
                alreadyExists = true;
                return true;
            });

            if (alreadyExists) {
                // IF/IR already exists, exit.
                log.audit('return', 'IF/IR Already Exists');
                return {
                    msg: 'IF/IR Already Exists'
                };
            }

            // check the po status and if it's not ready for billing return back a null value

            var myStatus = poRec.getValue({
                fieldId: 'status'
            });

            var process = false;

            if (
                myStatus == 'Pending Billing/Partially Received' ||
                myStatus == 'Pending Receipt' ||
                myStatus == 'Partially Received'
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
            }

            var trx = null;

            log.debug('creating fulfillment');
            vcSerial.type = 'if';

            var soId = poRec.getValue({
                fieldId: 'createdfrom'
            });

            trx = record.transform({
                fromType: 'salesorder',
                fromId: soId,
                toType: 'itemfulfillment',
                isDynamic: true
            });

            trx.setValue({
                fieldId: 'externalid',
                value: 'ifir_' + billPayload.invoice
            });

            // this is the "current" open period.  if the bill date is in a prior period and that period
            // is locked or closed we'll revert back to this period later in the process so that the bill
            // isn't put into a period that is actively being closed.

            var currentPostingPeriod = trx.getValue({
                fieldId: 'postingperiod'
            });

            trx.setValue({
                fieldId: 'trandate',
                value: format.parse({
                    value: billPayload.date,
                    type: format.Type.DATE
                })
            });

            // check for the transaction dates periods status to see if we need to revert back to the current
            // period.

            var getPeriodValues = search.lookupFields({
                type: search.Type.ACCOUNTING_PERIOD,
                id: trx.getValue({
                    fieldId: 'postingperiod'
                }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            if (getPeriodValues.aplocked || getPeriodValues.alllocked || getPeriodValues.closed)
                trx.setValue({
                    fieldId: 'postingperiod',
                    value: currentPostingPeriod
                });

            trx.setValue({
                fieldId: 'tranid',
                value: billPayload.invoice
            });

            trx.setValue({
                fieldId: 'shipstatus',
                value: 'C'
            });

            var lineCount = trx.getLineCount({
                sublistId: 'item'
            });

            var lineMissingSku = [];

            billPayload.lines.forEach(function (line) {
                if (line.NSITEM == '' || line.NSITEM == null) {
                    lineMissingSku.push(line.ITEMNO);
                }
            });

            if (lineMissingSku.length > 0) {
                return {
                    msg: JSON.stringify(lineMissingSku) + ' does not have a NetSuite SKU Assigned'
                };
            }

            var stage = [];

            // loop 1
            for (var i = lineCount - 1; i >= 0; i--) {
                var sObj = {
                    lineNumber: i,
                    lineItem: null,
                    lineReceivable: 0,
                    lineDetailRequired: false,
                    receiveQty: 0,
                    serials: [],
                    carrier: '',
                    tracking: [],
                    process: false
                };

                trx.selectLine({
                    sublistId: 'item',
                    line: i
                });

                sObj.lineItem = trx.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                });

                sObj.lineReceivable = trx.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityremaining'
                });

                sObj.lineDetailRequired = trx.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'inventorydetailreq'
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
                    var receiveQty = 0;

                    // the po has more qty than what's on this bill line so exhaust it all here
                    if (billPayload.lines[x].QUANTITY <= sObj.lineReceivable) {
                        receiveQty = billPayload.lines[x].QUANTITY;
                    }

                    // the po line is less than what we have to fulfill. attempt to push them there now hoping there are
                    // more lines later with the same SKU. If not we'll throw an error later
                    if (billPayload.lines[x].QUANTITY > sObj.lineReceivable) {
                        receiveQty = sObj.lineReceivable;
                    }

                    sObj.receiveQty += receiveQty;
                    billPayload.lines[x].QUANTITY -= receiveQty;
                    sObj.tracking.concat(billPayload.lines[x].TRACKING);
                    if (billPayload.lines[x].CARRIER !== '') {
                        sObj.carrier = billPayload.lines[x].CARRIER;
                    }

                    if (sObj.lineDetailRequired == true) {
                        if (billPayload.lines[x].SERIAL.length >= receiveQty) {
                            for (var z = 0; z < receiveQty; z++) {
                                sObj.serials.push(billPayload.lines[x].SERIAL);
                            }
                        }

                        billPayload.lines[x].SERIAL.splice(0, receiveQty);
                    }
                }

                stage.push(sObj);
            }

            // loop 2
            // go through the payload and make sure everyhing has been picked up and is at zero

            var fileFullyProcessed = true;

            billPayload.lines.forEach(function (line) {
                if (line.QUANTITY > 0) {
                    fileFullyProcessed = false;
                    log.audit('unprocessed line', JSON.stringify(line));
                }
            });

            if (fileFullyProcessed == false) {
                return {
                    msg: 'Could not fully process Fulfillment'
                };
            }

            //loop 3
            stage.forEach(function (line) {
                var vcSerialLine = {
                    item: line.lineItem,
                    serials: line.serials
                };

                trx.selectLine({
                    sublistId: 'item',
                    line: line.lineNumber
                });

                trx.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemreceive',
                    value: false
                });

                if (line.process == true) {
                    trx.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: true
                    });

                    trx.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemquantity',
                        value: line.receiveQty
                    });

                    if (line.lineDetailRequired == true) {
                        line.serials.forEach(function (serial) {
                            subrecordInvDetail = trx.getCurrentSublistSubrecord({
                                sublistId: 'item',
                                fieldId: 'inventorydetail'
                            });

                            subrecordInvDetail.selectNewLine({
                                sublistId: 'inventoryassignment'
                            });
                            subrecordInvDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                value: serial
                            });
                            subrecordInvDetail.commitLine({
                                sublistId: 'inventoryassignment'
                            });
                        });
                    }

                    var formattedTracking = '';

                    //log.debug('tracking', tracking)

                    line.tracking.forEach(function (tracking) {
                        formattedTracking += tracking + '\r\n';
                    });

                    trx.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_xml_tracking_num',
                        value: formattedTracking
                    });

                    trx.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_xml_ship_method',
                        value: line.carrier
                    });
                }

                trx.commitLine({
                    sublistId: 'item'
                });

                vcSerial.lines.push(vcSerialLine);
            });

            var newRecord = trx.save();

            if (newRecord) {
                log.audit('if/ir created', poNum + ': ' + billPayload.invoice);
                vcSerial.trxId = newRecord;
            } else {
                log.audit('no if/ir created', poNum + ': ' + billPayload.invoice);

                return {
                    msg: 'Could Not Create New IF/IR'
                };
            }

            var returnTrx = JSON.parse(JSON.stringify(trx));
            returnTrx.serialObj = vcSerial;
            returnTrx.msg = 'Created IF/IR';

            log.audit('return', returnTrx);

            return returnTrx;
        }
    }

    return {
        //get: _get,
        post: _post
    };
});
