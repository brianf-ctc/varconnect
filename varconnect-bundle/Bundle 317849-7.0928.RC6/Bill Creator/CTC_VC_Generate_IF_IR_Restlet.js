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
    './../CTC_VC_Lib_MainConfiguration',
    './../CTC_VC_Lib_Record.js',
    './../CTC_VC_Lib_VendorConfig',
    './Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    vc2_constant,
    vc2_util,
    vc_recordlib,
    vc_maincfg,
    vc_nslib,
    vc_vendorcfg,
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
                    id: CURRENT.poId,
                    isDynamic: true
                });
                CURRENT.PO_DATA = vc_recordlib.extractValues({
                    record: CURRENT.PO_REC,
                    fields: [
                        'tranid',
                        'entity',
                        'dropshipso',
                        'status',
                        'statusRef',
                        'createdfrom',
                        'subsidiary',
                        'custbody_ctc_po_link_type',
                        'custbody_isdropshippo'
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

                if (CURRENT.PO_DATA.dropshipso == '') throw 'Not a Drop Ship Order';

                var vendorCfg = Helper.loadBillVendorConfig({
                    entity: CURRENT.PO_DATA.entity.value || CURRENT.PO_DATA.entity
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
                    CURRENT.billPayload.shipDate && CURRENT.billPayload.shipDate != 'NA'
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
                if (Helper.isPeriodLocked({ record: recItemFF })) {
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
                recItemFF.setValue({
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                var arrLines = Helper.preprocessFulfillLine({
                    record: recItemFF
                });

                vc2_util.log(logTitle, '// Payload lines: ', CURRENT.billPayload.lines);

                var arrMissingSKUs = [],
                    arrUnprocessedLines = [],
                    arrSerialLines = [],
                    objItemSerials = {},
                    arrTrackingNums = [];

                CURRENT.billPayload.lines.forEach(function (billLine) {
                    if (!billLine.NSITEM) arrMissingSKUs.push(billLine.ITEMNO);
                    if (billLine.AVAILQTY > 0) arrUnprocessedLines.push(billLine.ITEMNO);
                    return true;
                });
                if (arrMissingSKUs.length)
                    throw 'Does not have SKU assigned -- ' + arrMissingSKUs.join(', ');
                if (arrUnprocessedLines.length)
                    throw (
                        'Could not fully process Fulfillment -- ' + arrUnprocessedLines.join(', ')
                    );

                var lineCount = recItemFF.getLineCount({ sublistId: 'item' });

                var arrAppliedSerials = [];
                //loop backwards from the line
                for (var line = lineCount - 1; line >= 0; line--) {
                    recItemFF.selectLine({ sublistId: 'item', line: line });

                    var lineData = vc2_util.findMatching({
                        dataSet: arrLines,
                        filter: { line: line }
                    });

                    if (
                        !lineData ||
                        !lineData.matchingLines ||
                        vc2_util.isEmpty(lineData.matchingLines)
                    ) {
                        // unselect the item receive
                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: false
                        });
                        recItemFF.commitLine({ sublistId: 'item' });
                        continue;
                    }

                    vc2_util.log(logTitle, '... line data: ', lineData);
                    var totalAppliedQty = lineData.APPLIEDQTY,
                        arrLineSerials = [],
                        arrLineTracking = [];

                    lineData.matchingLines.forEach(function (billLine) {
                        // totalAppliedQty += billLine.APPLIEDQTY;
                        if (billLine.SERIAL && billLine.SERIAL.length)
                            arrLineSerials = arrLineSerials.concat(billLine.SERIAL);
                        if (billLine.TRACKING && billLine.TRACKING.length)
                            arrLineTracking = arrLineTracking.concat(billLine.TRACKING);

                        return true;
                    });

                    recItemFF.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        value: true
                    });

                    recItemFF.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemquantity',
                        value: totalAppliedQty
                    });
                    recItemFF.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: totalAppliedQty
                    });

                    if (
                        arrLineSerials &&
                        arrLineSerials.length &&
                        (lineData.inventorydetailreq == 'T' || lineData.isserial == 'T')
                    ) {
                        arrLineSerials.forEach(function (serial) {
                            if (totalAppliedQty <= 0) return;
                            if (vc2_util.inArray(serial, arrAppliedSerials)) return;

                            vc2_util.log(logTitle, '...serial:', [
                                serial,
                                totalAppliedQty,
                                arrAppliedSerials
                            ]);

                            subrecordInvDetail = recItemFF.getCurrentSublistSubrecord({
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

                            arrAppliedSerials.push(serial);
                            totalAppliedQty--;
                        });
                    }

                    var formattedTracking = '';
                    arrLineTracking.forEach(function (tracking) {
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

                    recItemFF.commitLine({ sublistId: 'item' });

                    if (!objItemSerials[lineData.item]) objItemSerials[lineData.item] = [];
                    objItemSerials[lineData.item] = vc2_util.uniqueArray(
                        objItemSerials[lineData.item].concat(arrLineSerials)
                    );
                }

                for (var lineItem in objItemSerials) {
                    arrSerialLines.push({
                        item: lineItem,
                        serials: objItemSerials[lineItem]
                    });
                }

                Helper.addNativePackages({
                    record: recItemFF,
                    trackingnumbers: arrTrackingNums
                });

                vc2_util.log(
                    logTitle,
                    '>> Fulfillment lines: ',
                    vc_recordlib.extractRecordLines({
                        record: recItemFF,
                        findAll: true,
                        columns: [
                            'item',
                            'quantity',
                            'itemreceive',
                            'itemquantity',
                            'quantityremaining',
                            'inventorydetailreq',
                            'inventorydetail',
                            'isserial'
                        ],
                        filter: {
                            itemreceive: true
                        }
                    })
                );

                // update the PO
                Helper.updatePOLines();

                var newRecordId;
                try {
                    newRecordId = recItemFF.save();
                } catch (save_error) {
                    returnObj.details = vc2_util.extractError(save_error);
                }
                if (!newRecordId) throw 'Unable to create item fulfillment';

                vc2_util.log(
                    logTitle,
                    '/// Item Fulfillment created... [itemfulfillment:' + newRecordId + ']'
                );

                util.extend(returnObj, {
                    id: newRecordId,
                    itemff: newRecordId,
                    msg: 'Created Item Fulfillment [itemfulfillment:' + newRecordId + ']',
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
                    content: 'Created Item Fulfillment [itemfulfillment:' + newRecordId + ']',
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

            isLocked = periodValues.aplocked || periodValues.alllocked || periodValues.closed;
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
        loadBillVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadBillVendorConfig'].join('::'),
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
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary,
                vendorConfig = vc_vendorcfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                vc2_util.log(
                    logTitle,
                    'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName
                );
            }

            return vendorConfig;
        },
        addNativePackages: function (data) {
            var logTitle = [LogTitle, 'addNativePackages'].join('::');

            var ifRec = data.record;

            try {
                var arrTrackingNums = data.trackingnumbers;

                vc2_util.log(logTitle, '>> Tracking Nums List: ', arrTrackingNums);

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
                            recordId: CURRENT.poId
                        });
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }
            return ifRec;
        },
        preprocessFulfillLine: function (option) {
            var logTitle = [LogTitle, 'preprocessFulfillLine'].join('::'),
                arrLines = [],
                logPrefix = '';

            // CURRENT.billPayload.lines
            var arrFulfillLines = vc_recordlib.extractRecordLines({
                record: option.record,
                findAll: true,
                columns: [
                    'item',
                    'quantity',
                    'quantityremaining',
                    'inventorydetailreq',
                    'isserial',
                    vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                ]
            });
            // sort by quantity
            arrFulfillLines = arrFulfillLines.sort(function (a, b) {
                return a.quantity - b.quantity;
            });
            // vc2_util.log(logTitle, '// arrFulfillLines: ', arrFulfillLines);

            CURRENT.billPayload.lines.forEach(function (billLine) {
                billLine.QUANTITY = vc2_util.forceInt(billLine.QUANTITY);
                util.extend(billLine, {
                    nsitem: (billLine.NSITEM || '').toString(),
                    quantity: billLine.QUANTITY,
                    APPLIEDQTY: 0,
                    AVAILQTY: billLine.QUANTITY
                });
                return true;
            });

            var vendorItemNameFilter = {
                AVAILQTY: function (value) {
                    return value > 0;
                }
            };
            vendorItemNameFilter[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] = function (
                value
            ) {
                return value && vc2_util.inArray(itemffLine.item, value.split('\n'));
            };
            arrFulfillLines.forEach(function (itemffLine) {
                util.extend(itemffLine, {
                    APPLIEDQTY: 0,
                    AVAILQTY: itemffLine.quantity,
                    matchingLines: []
                });

                var matchingLines = {
                    fully:
                        vc2_util.findMatching({
                            dataSet: CURRENT.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.item,
                                quantity: itemffLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    byItem:
                        vc2_util.findMatching({
                            dataSet: CURRENT.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.item,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: CURRENT.billPayload.lines,
                            findAll: true,
                            filter: vendorItemNameFilter
                        }) ||
                        []
                };

                var fnApplyQty = function (matchedLine) {
                    var logPrefix = '[Apply Qty] ';

                    vc2_util.log(logTitle, logPrefix + '// matched line: ', {
                        matched: vc2_util.extractValues({
                            source: matchedLine,
                            params: ['ITEMNO', 'AVAILQTY', 'QUANTITY']
                        }),
                        line: vc2_util.extractValues({
                            source: itemffLine,
                            params: ['item', 'AVAILQTY', 'quantity', 'line']
                        })
                    });

                    if (matchedLine.AVAILQTY <= 0) return;
                    if (itemffLine.AVAILQTY <= 0) return;

                    var qtyToApply =
                        matchedLine.AVAILQTY >= itemffLine.AVAILQTY
                            ? itemffLine.AVAILQTY
                            : matchedLine.AVAILQTY;

                    vc2_util.log(logTitle, logPrefix + '..... applied qty: ', qtyToApply);

                    itemffLine.AVAILQTY -= qtyToApply;
                    matchedLine.AVAILQTY -= qtyToApply;

                    itemffLine.APPLIEDQTY += qtyToApply;
                    matchedLine.APPLIEDQTY += qtyToApply;

                    itemffLine.matchingLines.push(matchedLine);

                    return true;
                };

                matchingLines.fully.forEach(fnApplyQty);
                matchingLines.byItem.forEach(fnApplyQty);

                arrLines.push(itemffLine);

                return true;
            });

            // vc2_util.log(logTitle, '// Lines: ', arrLines);
            // vc2_util.log(logTitle, '// Payload Lines: ', CURRENT.billPayload.lines);

            return arrLines;
        },
        preprocessFulfillLine1: function (option) {
            var logTitle = [LogTitle, 'preprocessFulfillLine'].join('::'),
                arrLines = [],
                logPrefix = '';

            // CURRENT.billPayload.lines
            var arrFulfillLines = vc_recordlib.extractRecordLines({
                record: option.record,
                findAll: true,
                columns: ['item', 'quantity', 'quantityremaining', 'inventorydetailreq', 'isserial']
            });

            arrFulfillLines.forEach(function (itemffLine) {
                itemffLine.APPLIEDQTY = 0;
                itemffLine.AVAILQTY = itemffLine.quantity;
                return true;
            });
            // vc2_util.log(logTitle, '// fulfill lines: ', arrFulfillLines);

            CURRENT.billPayload.lines.forEach(function (billLine) {
                billLine.QUANTITY = vc2_util.forceInt(billLine.QUANTITY);

                util.extend(billLine, {
                    item: billLine.ITEMNO,
                    nsitem: (billLine.NSITEM || '').toString(),
                    quantity: billLine.QUANTITY,
                    APPLIEDQTY: 0,
                    AVAILQTY: billLine.QUANTITY,
                    matchingLines: []
                });

                // vc2_util.log(logTitle, '/// billLine : ', billLine);

                // look for matching
                var matchingLines = {
                    fully:
                        vc2_util.findMatching({
                            dataSet: arrFulfillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                quantity: billLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    byItem:
                        vc2_util.findMatching({
                            dataSet: arrFulfillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || []
                };

                // vc2_util.log(logTitle, '/// matched lines: ', matchingLines);

                var fnApplyQty = function (matchedLine) {
                    if (matchedLine.AVAILQTY <= 0) return;
                    if (billLine.AVAILQTY <= 0) return;

                    var qtyToApply =
                        matchedLine.AVAILQTY >= billLine.AVAILQTY
                            ? billLine.AVAILQTY
                            : matchedLine.AVAILQTY;

                    billLine.AVAILQTY -= qtyToApply;
                    matchedLine.AVAILQTY -= qtyToApply;

                    billLine.APPLIEDQTY += qtyToApply;
                    matchedLine.APPLIEDQTY += qtyToApply;

                    billLine.matchingLines.push(matchedLine);

                    return true;
                };

                matchingLines.fully.forEach(fnApplyQty);
                matchingLines.byItem.forEach(fnApplyQty);

                arrLines.push(billLine);

                return true;
            });

            // vc2_util.log(logTitle, '// Lines: ', arrLines);
            // vc2_util.log(logTitle, '// Payload Lines: ', CURRENT.billPayload.lines);

            return arrLines;
        },
        updatePOLines: function (option) {
            var logTitle = [LogTitle, 'updatePOLines'].join('::');

            // get the vendor config
            var mainConfig = vc_maincfg.getMainConfiguration(),
                vendorConfig = Helper.loadVendorConfig({
                    vendor: CURRENT.PO_DATA.entity,
                    subsidiary: CURRENT.PO_DATA.subsidiary,
                    vendorName: CURRENT.PO_DATA.entity_text
                });
            var billLines = [];

            CURRENT.billPayload.lines.forEach(function (billLine) {
                billLines.push({
                    vendorSKU: billLine.ITEMNO,
                    item_num: billLine.ITEMNO,
                    carrier: billLine.CARRIER,
                    serial_num: (billLine.SERIAL || []).join(','),
                    tracking_num: (billLine.TRACKING || []).join(',')
                });
            });

            var updateStatus = vc_nslib.updatepo({
                po_record: ns_record.load({
                    type: 'purchaseorder',
                    id: CURRENT.poId,
                    isDynamic: true
                }),
                poNum: CURRENT.poId,
                mainConfig: mainConfig,
                vendorConfig: vendorConfig,
                isDropPO:
                    CURRENT.PO_DATA.dropshipso ||
                    CURRENT.PO_DATA.custbody_ctc_po_link_type == 'Drop Shipment' ||
                    CURRENT.PO_DATA.custbody_isdropshippo,
                lineData: billLines
            });

            vc2_util.log(logTitle, '... result: ', updateStatus);

            return true;
        }
    };

    return RESTLET;
});
