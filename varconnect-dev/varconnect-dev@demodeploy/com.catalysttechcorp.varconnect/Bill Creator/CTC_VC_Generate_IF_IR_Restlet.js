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
    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record',
    './Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    vc2_constant,
    vc2_util,
    vc_recordlib,
    moment
) {
    var LogTitle = 'VC|Generate IF/IR',
        VCLOG_APPNAME = 'VAR Connect | Process Bill (IF)',
        CURRENT = {},
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            try {
                vc2_util.log(logTitle, '**** START SCRIPT **** ', context);

                util.extend(CURRENT, {
                    poId: context.custrecord_ctc_vc_bill_linked_po[0].value,
                    isRecievable: context.custrecord_ctc_vc_bill_is_recievable,
                    billPayload: JSON.parse(context.custrecord_ctc_vc_bill_json)
                });

                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.poId + '] ';

                vc2_util.log(logTitle, '// Current Data: ', CURRENT);

                if (!CURRENT.poId) throw 'Purchase Order Required';

                vc2_util.vcLog({
                    title: 'BillCreator | Fulfillment - Bill File Payload',
                    content: JSON.stringify(CURRENT.billPayload),
                    recordId: CURRENT.poId
                });

                if (!CURRENT.isRecievable)
                    throw 'This Vendor is not enabled for Auto Receipts/Fulfillments';

                CURRENT.PO_REC = ns_record.load({
                    type: 'purchaseorder',
                    id: CURRENT.poId
                });
                CURRENT.PO_DATA = vc_recordlib.extractValues({
                    record: CURRENT.PO_REC,
                    fields: [
                        'tranid',
                        'entity',
                        'dropshipso',
                        'status',
                        'statusRef',
                        'createdfrom'
                    ]
                });

                vc2_util.log(logTitle, '// PO Data: ', CURRENT.PO_DATA);

                if (CURRENT.PO_DATA.createdfrom) {
                    CURRENT.SO_DATA = vc2_util.flatLookup({
                        type: ns_search.Type.SALES_ORDER,
                        id: CURRENT.PO_DATA.createdfrom,
                        columns: ['entity', 'tranid']
                    });
                    vc2_util.log(logTitle, '// SO Data: ', CURRENT.SO_DATA);
                }

                if (CURRENT.PO_DATA.dropshipso == '')
                    throw 'Not a Drop Ship Order';

                var vendorCfg = Helper.loadVendorConfig({
                    entity:
                        CURRENT.PO_DATA.entity.value || CURRENT.PO_DATA.entity
                });

                if (!vendorCfg.ENABLE_FULFILLLMENT)
                    throw 'This Vendor is not enabled for Auto Receipts/Fulfillments';

                // check if IF/IR already exists and if so link it back to the file
                if (
                    Helper.isTransactionExists({
                        invoice: CURRENT.billPayload.invoice
                    })
                )
                    return 'Fulfillment/Receipt Already Exists';

                // check the po status and if it's not ready for billing return back a null value
                if (
                    !vc2_util.inArray(CURRENT.PO_DATA.statusRef, [
                        'pendingBillPartReceived',
                        'pendingReceipt',
                        'partiallyReceived'
                    ])
                )
                    return 'Purchase Order not Ready to be received/fulfilled';

                vc2_util.log(logTitle, '*** Creating Fulfillment... ');

                var recItemFF;
                try {
                    recItemFF = vc_recordlib.transform({
                        fromType: ns_record.Type.SALES_ORDER,
                        fromId: CURRENT.PO_DATA.createdfrom,
                        toType: 'itemfulfillment',
                        isDynamic: true
                    });
                } catch (transform_error) {
                    returnObj.details = vc2_util.extractError(transform_error);
                }
                if (!recItemFF) throw 'Unable to transform to item fulfillment';

                // set the identifier for this fulfillment order
                recItemFF.setValue({
                    fieldId: 'externalid',
                    value: 'ifir_' + CURRENT.billPayload.invoice
                });

                /// SET POSTING PERIOD /////////////
                var shipDate =
                    CURRENT.billPayload.shipDate &&
                    CURRENT.billPayload.shipDate != 'NA'
                        ? CURRENT.billPayload.shipDate
                        : CURRENT.billPayload.date;

                var currentPostingPeriod = recItemFF.getValue({
                    fieldId: 'postingperiod'
                });
                recItemFF.setValue({
                    fieldId: 'trandate',
                    value: ns_format.parse({
                        value: moment(shipDate).toDate(),
                        type: ns_format.Type.DATE
                    })
                });

                // check for the transaction dates periods status to see if we need to revert back to the current
                // period.
                var isPeriodLocked = Helper.isPeriodLocked({
                    record: recItemFF
                });
                if (isPeriodLocked) {
                    // set back to the previos open post period
                    recItemFF.setValue({
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }
                ////////////////////////////////

                recItemFF.setValue({
                    fieldId: 'tranid',
                    value: CURRENT.billPayload.invoice
                });
                recItemFF.setValue({ fieldId: 'shipstatus', value: 'C' });

                var lineCount = recItemFF.getLineCount({ sublistId: 'item' });
                var lineMissingSku = [];

                CURRENT.billPayload.lines.forEach(function (line) {
                    if (!line.NSITEM) {
                        lineMissingSku.push(line.ITEMNO);
                    }
                });

                if (lineMissingSku.length)
                    throw (
                        'Does not have SKU assigned -- ' +
                        lineMissingSku.join(', ')
                    );

                var arrLines = [],
                    arrSerialLines = [];

                // loop 1
                for (var line = lineCount - 1; line >= 0; line--) {
                    recItemFF.selectLine({ sublistId: 'item', line: line });

                    var lineData = {
                        lineNo: line,
                        item: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item'
                        }),
                        receivable:
                            recItemFF.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantityremaining'
                            }) || 0,
                        detailReqd: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'inventorydetailreq'
                        }),
                        isSerialized: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'isserial'
                        }),
                        receiveQty: 0,
                        serials: [],
                        carrier: '',
                        tracking: [],
                        process: false,
                        billLines: []
                    };

                    // check if the line is part of the bill
                    CURRENT.billPayload.lines.forEach(function (billLine) {
                        if (billLine.NSITEM == lineData.item)
                            lineData.billLines.push(billLine);
                        return true;
                    });
                    if (lineData.billLines.length) lineData.process = true;

                    vc2_util.log(logTitle, '... line data: ', lineData);

                    lineData.billLines.forEach(function (billLine) {
                        var receiveQty =
                            billLine.QUANTITY > lineData.receivable
                                ? lineData.receivable // just use all the available quantity from the PO Line
                                : billLine.QUANTITY; // receive all the qty

                        lineData.receiveQty += receiveQty;

                        billLine.QUANTITY -= receiveQty; // then remove this from our required quantity to fulfill

                        if (billLine.TRACKING && billLine.TRACKING.length)
                            lineData.tracking = lineData.tracking.concat(
                                billLine.TRACKING
                            );

                        if (billLine.SERIAL && billLine.SERIAL.length)
                            lineData.serials = lineData.serials.concat(
                                billLine.SERIAL.splice(0, receiveQty)
                            );

                        return true;
                    });

                    arrLines.push(lineData);
                }

                // go through the payload and make sure everyhing has been picked up and is at zero
                var unprocessedLines = [];
                CURRENT.billPayload.lines.forEach(function (billLine) {
                    if (billLine.QUANTITY > 0) {
                        unprocessedLines.push(billLine.ITEMNO);
                    }
                });

                if (unprocessedLines.length)
                    throw (
                        'Could not fully process Fulfillment -- ' +
                        unprocessedLines.join(', ')
                    );

                var arrTrackingNums = [];

                // apply our changes to the IF Lines
                arrLines.forEach(function (lineData) {
                    recItemFF.selectLine({
                        sublistId: 'item',
                        line: lineData.lineNo
                    });

                    recItemFF.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: false
                    });

                    if (lineData.process == true) {
                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: true
                        });

                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemquantity',
                            value: lineData.receiveQty
                        });

                        if (
                            lineData.detailReqd == 'T' ||
                            lineData.isSerialized == 'T'
                        ) {
                            lineData.serials.forEach(function (serial) {
                                subrecordInvDetail =
                                    recItemFF.getCurrentSublistSubrecord({
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
                        lineData.tracking.forEach(function (tracking) {
                            formattedTracking += tracking + '\r\n';
                            if (!vc2_util.inArray(tracking, arrTrackingNums))
                                arrTrackingNums.push(tracking);
                        });

                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_xml_tracking_num',
                            value: formattedTracking
                        });

                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_xml_ship_method',
                            value: CURRENT.billPayload.carrier
                        });

                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_xml_carrier',
                            value: CURRENT.billPayload.carrier
                        });
                    }

                    recItemFF.commitLine({ sublistId: 'item' });

                    arrSerialLines.push({
                        item: lineData.item,
                        serials: lineData.serials
                    });
                });

                Helper.addNativePackages({
                    record: recItemFF,
                    trackingnumbers: arrTrackingNums
                });

                // set the createdby field
                recItemFF.setValue({
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                var newRecordId;

                try {
                    newRecordId = recItemFF.save();
                } catch (save_error) {
                    returnObj.details = vc2_util.extractError(save_error);
                }
                if (!newRecordId) throw 'Unable to create item fulfillment';

                vc2_util.log(
                    logTitle,
                    '/// Item Fulfillment created... [itemfulfillment:' +
                        newRecordId +
                        ']'
                );

                util.extend(returnObj, {
                    id: newRecordId,
                    itemff: newRecordId,
                    msg:
                        'Created Item Fulfillment [itemfulfillment:' +
                        newRecordId +
                        ']',
                    serialData: {
                        poId: CURRENT.poId,
                        soId: CURRENT.PO_DATA.createdfrom,
                        custId: CURRENT.SO_DATA.entity.value,
                        type: 'if',
                        trxId: newRecordId,
                        lines: arrSerialLines
                    }
                });

                vc2_util.vcLog({
                    title: 'BillCreator | Fulfillment',
                    content:
                        'Created Item Fulfillment [itemfulfillment:' +
                        newRecordId +
                        ']',
                    recordId: CURRENT.poId
                });
            } catch (error) {
                util.extend(returnObj, {
                    msg: vc2_util.extractError(error),
                    logstatus: LOG_STATUS.RECORD_ERROR,
                    isError: true
                });

                vc2_util.vcLog({
                    title: 'BillCreator | Fulfillment Error',
                    error: error,
                    details: returnObj.details,
                    status: returnObj.logstatus,
                    recordId: CURRENT.poId
                });

                vc2_util.logError(logTitle, error);
            } finally {
                vc2_util.log(logTitle, '## EXIT SCRIPT ## ', returnObj);
            }

            return returnObj;
        }
    };

    var Helper = {
        isPeriodLocked: function (option) {
            var logTitle = [LogTitle, 'isPeriodLocked'].join('::'),
                returnValue;
            option = option || {};

            var record = option.record;
            var isLocked = false;
            var periodValues = ns_search.lookupFields({
                type: ns_search.Type.ACCOUNTING_PERIOD,
                id: record.getValue({ fieldId: 'postingperiod' }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            isLocked =
                periodValues.aplocked ||
                periodValues.alllocked ||
                periodValues.closed;
            vc2_util.log(logTitle, '>> isPeriodLocked? ', isLocked);
            returnValue = isLocked;

            return returnValue;
        },
        isTransactionExists: function (option) {
            var logTitle = [LogTitle, 'isTransactionExists'].join('::'),
                returnValue;
            option = option || {};

            var transactionSearchObj = ns_search.create({
                type: 'transaction',
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['externalid', 'is', 'ifir_' + option.invoice],
                    'AND',
                    ['type', 'anyof', 'ItemShip', 'ItemRcpt']
                ],
                columns: ['internalid', 'tranid']
            });
            returnValue = !!transactionSearchObj.runPaged().count;

            return returnValue;
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

                vc2_util.log(logTitle, '// config: ', returnValue);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        addNativePackages: function (data) {
            var ifRec = data.record;
            var arrTrackingNums = data.trackingnumbers;
            log.audit(
                'Create-ItemFF::addNativePackages',
                '>> Tracking Nums List: ' + JSON.stringify(arrTrackingNums)
            );

            if (vc2_util.isEmpty(arrTrackingNums)) return false;
            for (var i = 0; i < arrTrackingNums.length; i++) {
                // log.audit("Create-ItemFF::addNativePackages", '>> Tracking Num: ' + JSON.stringify(arrTrackingNums[i]));

                try {
                    if (i === 0) {
                        ifRec.selectLine({
                            sublistId: 'package',
                            line: i
                        });
                    } else {
                        ifRec.selectNewLine({
                            sublistId: 'package'
                        });
                    }

                    ifRec.setCurrentSublistValue({
                        sublistId: 'package',
                        fieldId: 'packageweight',
                        value: 1.0
                    });

                    ifRec.setCurrentSublistValue({
                        sublistId: 'package',
                        fieldId: 'packagetrackingnumber',
                        value: arrTrackingNums[i]
                    });

                    ifRec.commitLine({
                        sublistId: 'package'
                    });
                } catch (package_error) {
                    vc2_util.logError(logTitle, package_error);
                    vc2_util.vcLog({
                        title: 'Fulfillment | Add Native Package Error',
                        error: package_error,
                        status: LOG_STATUS.RECORD_ERROR,
                        recordId: Current.PO_ID
                    });
                }
            }

            log.audit(
                'Create-ItemFF::addNativePackages',
                '>> ifRec: ' +
                    JSON.stringify(ifRec.getSublist({ sublistId: 'package' }))
            );
            return ifRec;
        }
    };

    return RESTLET;
});
