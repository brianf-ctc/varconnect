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
    './Libraries/CTC_VC_Lib_BillProcess',

    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record',
    './../CTC_VC_Lib_Record.js',
    './../Services/ctc_svclib_configlib',
    './Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    vc_billprocess,
    vc2_constant,
    vc2_util,
    vc_recordlib,
    vc_nslib,
    vcs_configLib,
    moment
) {
    var LogTitle = 'VC|Generate IF/IR',
        VCLOG_APPNAME = 'VAR Connect | Process Bill (IF)',
        Current = {},
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var orderLineFields = [
        'item',
        'quantity',
        'rate',
        'amount',
        'custcol_ctc_xml_dist_order_num',

        'custcol_ctc_xml_date_order_placed',
        'custcol_ctc_vc_order_placed_date',
        'custcol_ctc_vc_shipped_date',
        'custcol_ctc_vc_eta_date',
        'custcol_ctc_xml_ship_date',
        'custcol_ctc_xml_eta',
        //
        'custcol_ctc_xml_carrier',
        'custcol_ctc_xml_tracking_num',
        'custcol_ctc_xml_inb_tracking_num',
        'custcol_ctc_xml_serial_num'
    ];

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            try {
                vc2_util.log(logTitle, '**** START SCRIPT **** ', context);

                util.extend(Current, {
                    poId: context.PO_LINK,
                    billFileId: context.ID,
                    isRecievable: context.IS_RCVBLE,
                    billPayload: vc2_util.safeParse(context.JSON)
                });
                vc2_util.LogPrefix = '[purchaseorder:' + Current.poId + '] ';
                vc2_util.log(logTitle, '// Current Data: ', Current);
                if (!Current.poId) throw 'Purchase Order Required';

                // load the bill file
                if (!Current.billFileId) throw 'Bill File ID is required';
                vc_billprocess.loadBillFile({ id: Current.billFileId });

                vc2_util.vcLog({
                    title: 'BillCreator | Fulfillment - Bill File Payload',
                    content: JSON.stringify(Current.billPayload),
                    recordId: Current.poId
                });

                if (!Current.isRecievable)
                    throw 'This Vendor is not enabled for Auto Receipts/Fulfillments';

                Current.PO_REC = ns_record.load({
                    type: 'purchaseorder',
                    id: Current.poId,
                    isDynamic: true
                });

                Current.PO_DATA = vc_recordlib.extractValues({
                    record: Current.PO_REC,
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

                vc2_util.log(logTitle, '// PO Data: ', Current.PO_DATA);

                if (Current.PO_DATA.createdfrom) {
                    Current.SO_DATA = vc2_util.flatLookup({
                        type: ns_search.Type.SALES_ORDER,
                        id: Current.PO_DATA.createdfrom,
                        columns: ['entity', 'tranid']
                    });
                    vc2_util.log(logTitle, '// SO Data: ', Current.SO_DATA);
                }

                if (Current.PO_DATA.dropshipso == '') throw 'Not a Drop Ship Order';

                var MainCFG = vcs_configLib.mainConfig();
                var BillCFG = vcs_configLib.billVendorConfig({ poId: Current.poId });
                var OrderCFG = vcs_configLib.orderVendorConfig({ poId: Current.poId });

                // vc_billprocess.preprocessBill({
                //     recOrder: Current.PO_REC,
                //     orderConfig: BillCFG,
                //     billFileId: Current.billFileId
                // });

                // if (vc_billprocess.FlexData) {
                //     for (var billField in vc_billprocess.FlexData)
                //         vc2_util.log(
                //             logTitle,
                //             '// BillLines ',
                //             vc_billprocess.FlexData.BillLines
                //         );
                // }

                if (!BillCFG.enableFulfillment)
                    throw 'This Vendor is not enabled for Auto Receipts/Fulfillments';

                // check if IF/IR already exists and if so link it back to the file
                if (Helper.isTransactionExists({ invoice: Current.billPayload.invoice }))
                    return 'Fulfillment/Receipt Already Exists';

                // check the po status and if it's not ready for billing return back a null value
                if (
                    !vc2_util.inArray(Current.PO_DATA.statusRef, [
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
                        fromId: Current.PO_DATA.createdfrom,
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
                    value: 'ifir_' + Current.billPayload.invoice
                });

                /// SET POSTING PERIOD /////////////
                var shipDate =
                    Current.billPayload.shipDate && Current.billPayload.shipDate != 'NA'
                        ? Current.billPayload.shipDate
                        : Current.billPayload.date;

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

                recItemFF.setValue({
                    fieldId: 'tranid',
                    value: Current.billPayload.invoice
                });
                recItemFF.setValue({ fieldId: 'shipstatus', value: 'C' });
                recItemFF.setValue({
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                var arrLines = Helper.preprocessFulfillLine({
                    record: recItemFF,
                    mainConfig: MainCFG,
                    orderConfig: OrderCFG
                });

                vc2_util.log(logTitle, '// Payload lines: ', Current.billPayload.lines);
                vc2_util.log(logTitle, '// IF Lines: ', arrLines);

                var arrMissingSKUs = [],
                    arrUnprocessedLines = [],
                    arrSerialLines = [],
                    objItemSerials = {},
                    arrTrackingNums = [];

                Current.billPayload.lines.forEach(function (billLine) {
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
                    try {
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

                        // get the po line data
                        var poLineData = vc_recordlib.extractRecordLines({
                            record: Current.PO_REC,
                            columns: orderLineFields,
                            filter: {
                                line: parseInt(lineData.poline) - 1
                            }
                        });
                        vc2_util.log(logTitle, '... poLineData: ', poLineData);

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

                        var updateItemFFline = {
                            // itemreceive: true,
                            itemquantity: totalAppliedQty,
                            quantity: totalAppliedQty
                        };

                        recItemFF.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: true
                        });

                        // recItemFF.setCurrentSublistValue({
                        //     sublistId: 'item',
                        //     fieldId: 'itemquantity',
                        //     value: totalAppliedQty
                        // });
                        // recItemFF.setCurrentSublistValue({
                        //     sublistId: 'item',
                        //     fieldId: 'quantity',
                        //     value: totalAppliedQty
                        // });

                        if (
                            !vc2_util.isEmpty(poLineData) &&
                            totalAppliedQty == poLineData.quantity
                        ) {
                            var poTrackingNum =
                                    poLineData.custcol_ctc_xml_tracking_num ||
                                    poLineData.custcol_ctc_xml_inb_tracking_num,
                                poSerialNum = poLineData.custcol_ctc_xml_serial_num;

                            // update the itemff lines
                            if (poTrackingNum && poTrackingNum != 'NA')
                                arrLineTracking = poTrackingNum.split(/\n/g);

                            if (poSerialNum && poSerialNum != 'NA')
                                arrLineSerials = poSerialNum.split(/\n/g);

                            orderLineFields.forEach(function (poLineFld) {
                                var poLineValue = poLineData[poLineFld];

                                // skip the tracking and serial fields
                                if (
                                    vc2_util.inArray(poLineFld, [
                                        'item',
                                        'itemquantity',
                                        'quantity',
                                        'rate',
                                        'amount'
                                        // 'custcol_ctc_xml_tracking_num',
                                        // 'custcol_ctc_xml_inb_tracking_num',
                                        // 'custcol_ctc_xml_serial_num'
                                    ])
                                )
                                    return true;

                                // skip empty values
                                if (vc2_util.isEmpty(poLineValue) || poLineValue == 'NA')
                                    return true;

                                updateItemFFline[poLineFld] = poLineValue;
                                return true;
                            });
                        }

                        var formattedTracking = '';
                        arrLineTracking.forEach(function (tracking) {
                            formattedTracking += tracking + '\r\n';
                            if (!vc2_util.inArray(tracking, arrTrackingNums))
                                arrTrackingNums.push(tracking);
                        });

                        if (formattedTracking)
                            updateItemFFline['custcol_ctc_xml_tracking_num'] = formattedTracking;

                        if (Current.billPayload.carrier) {
                            updateItemFFline['custcol_ctc_xml_ship_method'] =
                                Current.billPayload.carrier;

                            updateItemFFline['custcol_ctc_xml_carrier'] =
                                Current.billPayload.carrier;
                        }

                        vc2_util.log(logTitle, '/// item ff line:  ', updateItemFFline);

                        for (var itemffLineField in updateItemFFline) {
                            recItemFF.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: itemffLineField,
                                value: updateItemFFline[itemffLineField]
                            });
                        }

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

                        recItemFF.commitLine({ sublistId: 'item' });

                        if (!objItemSerials[lineData.item]) objItemSerials[lineData.item] = [];
                        objItemSerials[lineData.item] = vc2_util.uniqueArray(
                            objItemSerials[lineData.item].concat(arrLineSerials)
                        );
                    } catch (itemffLine_error) {
                        vc2_util.logError(logTitle, itemffLine_error);
                    }
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
                Helper.updatePOLines({
                    mainConfig: MainCFG,
                    orderConfig: OrderCFG
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
                    '/// Item Fulfillment created... [itemfulfillment:' + newRecordId + ']'
                );

                util.extend(returnObj, {
                    id: newRecordId,
                    itemff: newRecordId,
                    msg: 'Created Item Fulfillment [itemfulfillment:' + newRecordId + ']',
                    serialData: {
                        poId: Current.poId,
                        soId: Current.PO_DATA.createdfrom,
                        custId: Current.SO_DATA.entity.value,
                        type: 'if',
                        trxId: newRecordId,
                        lines: arrSerialLines
                    }
                });

                vc2_util.vcLog({
                    title: 'BillCreator | Fulfillment',
                    content: 'Created Item Fulfillment [itemfulfillment:' + newRecordId + ']',
                    recordId: Current.poId
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);

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
                    recordId: Current.poId
                });
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

        addNativePackages: function (data) {
            var logTitle = [LogTitle, 'addNativePackages'].join('::');

            var ifRec = data.record;
            var arrTrackingNums = data.trackingnumbers;
            vc2_util.log(logTitle, '>> Tracking Nums List: ', arrTrackingNums);

            if (vc2_util.isEmpty(arrTrackingNums)) return false;
            for (var i = 0; i < arrTrackingNums.length; i++) {
                // log.audit("Create-ItemFF::addNativePackages", '>> Tracking Num: ' + JSON.stringify(arrTrackingNums[i]));

                try {
                    if (i === 0) {
                        ifRec.selectLine({ sublistId: 'package', line: i });
                    } else {
                        ifRec.selectNewLine({ sublistId: 'package' });
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

                    ifRec.commitLine({ sublistId: 'package' });
                } catch (package_error) {
                    vc2_util.logError(logTitle, package_error);
                    vc2_util.vcLog({
                        title: 'Fulfillment | Add Native Package Error',
                        error: package_error,
                        status: LOG_STATUS.RECORD_ERROR,
                        recordId: Current.poId
                    });
                }
            }

            return ifRec;
        },
        preprocessFulfillLine: function (option) {
            var logTitle = [LogTitle, 'preprocessFulfillLine'].join('::'),
                arrLines = [],
                logPrefix = '';

            // CURRENT.billPayload.lines
            var itemAltNameColId =
                    option.orderConfig.itemColumnIdToMatch || option.mainConfig.itemColumnIdToMatch,
                itemMPNColId =
                    option.orderConfig.itemMPNColumnIdToMatch ||
                    option.mainConfig.itemMPNColumnIdToMatch,
                poColumns = [
                    'item',
                    'quantity',
                    'quantityremaining',
                    'inventorydetailreq',
                    'isserial',
                    'poline',
                    vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                ];
            if (itemAltNameColId) {
                poColumns.push(itemAltNameColId);
            }
            if (itemMPNColId) {
                poColumns.push(itemMPNColId);
            }
            var arrFulfillLines = vc_recordlib.extractRecordLines({
                record: option.record,
                findAll: true,
                columns: poColumns,
                orderConfig: option.orderConfig,
                mainConfig: option.mainConfig
            });
            // sort by quantity
            arrFulfillLines = arrFulfillLines.sort(function (a, b) {
                return a.quantity - b.quantity;
            });
            // vc2_util.log(logTitle, '// arrFulfillLines: ', arrFulfillLines);

            Current.billPayload.lines.forEach(function (billLine) {
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
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeItemName,
                                quantity: itemffLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeItemName2,
                                quantity: itemffLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeSKU,
                                quantity: itemffLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.item,
                                quantity: itemffLine.quantity,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        [],
                    byItem:
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeItemName,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeItemName2,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.alternativeSKU,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
                            findAll: true,
                            filter: {
                                nsitem: itemffLine.item,
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }) ||
                        vc2_util.findMatching({
                            dataSet: Current.billPayload.lines,
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
            var logTitle = [LogTitle, 'preprocessFulfillLine1'].join('::'),
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

            Current.billPayload.lines.forEach(function (billLine) {
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
            var MainCFG = option.mainConfig,
                OrderCFG = option.orderConfig;
            var billLines = [];

            Current.billPayload.lines.forEach(function (billLine) {
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
                    id: Current.poId,
                    isDynamic: true
                }),
                poNum: Current.poId,
                mainConfig: MainCFG,
                orderConfig: OrderCFG,
                isDropPO:
                    Current.PO_DATA.dropshipso ||
                    Current.PO_DATA.custbody_ctc_po_link_type == 'Drop Shipment' ||
                    Current.PO_DATA.custbody_isdropshippo,
                lineData: billLines
            });

            vc2_util.log(logTitle, '... result: ', updateStatus);

            return true;
        }
    };

    return RESTLET;
});
