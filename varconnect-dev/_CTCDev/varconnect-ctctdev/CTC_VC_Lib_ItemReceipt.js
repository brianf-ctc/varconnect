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
 */

/**
 * CTC_Create_Item_receipt.js
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Apr 13, 2019	ocorrea		Creates Item Receipt after receiving XML data for special order POs
 * 1.01		Apr 22, 2022	christian	Limit text serial numbers to 4000 chars
 * 2.00     Nov 01, 2022    christian   Refactored code base using item_fulfillment lib as reference
 *
 */

define(function (require) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_format = require('N/format'),
        ns_config = require('N/config');

    var vc2_constant = require('./CTC_VC2_Constants.js'),
        vc_log = require('./CTC_VC_Lib_Log.js'),
        vc_record = require('./CTC_VC_Lib_Record.js'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js'),
        vc2_record = require('./CTC_VC2_Lib_Record.js'),
        vcs_configLib = require('./Services/ctc_svclib_configlib.js');

    var LogTitle = 'ItemRRLib',
        LogPrefix = '',
        _TEXT_AREA_MAX_LENGTH = 4000;

    var Current = {
        DateFormat: null,
        PO_ID: null,
        SO_ID: null,
        OrderLines: null,
        MainCFG: null,
        OrderCFG: null,
        Vendor: null
    };

    var ItemRRLib = {};

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    ItemRRLib.updateIR = function (option) {
        var logTitle = [LogTitle, 'updateItemReceipts'].join('::'),
            responseData;
        Current.Script = ns_runtime.getCurrentScript();
        vc2_util.log(logTitle, '############ ITEM RECEIPT CREATION: START ############');
        try {
            Current.Features = {
                MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' }),
                ENABLE_CROSS_SUB_FULFILLMENT: ns_runtime.isFeatureInEffect({
                    feature: 'crosssubsidiaryfulfillment'
                })
            };

            Current.PO_ID = option.poId || option.recPurchOrd.id;
            Current.Vendor = option.vendor;

            LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';
            vc2_util.LogPrefix = LogPrefix;

            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            vc2_util.log(logTitle, '// CURRENT: ', Current);

            Current.MainCFG = option.mainConfig || vcs_configLib.mainConfig();
            Current.OrderCFG =
                option.orderConfig || vcs_configLib.orderVendorConfig({ poId: Current.PO_ID });

            Current.OrderLines = option.lineData;
            Current.PO_REC = option.recPurchOrd;

            vc2_util.log(logTitle, '// OrderLines: ', Current.OrderLines);

            //////////////////////
            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.OrderCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (vc2_util.isEmpty(Current.OrderLines)) throw 'Empty Line Data';

            // if (!Helper.validatePODate()) throw 'Invalid PO Date';

            Current.NumPrefix = Current.OrderCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw 'Config Error: Missing Fulfillment Prefix';

            var OrderLines = Helper.sortLineData(Current.OrderLines);

            var arrOrderNums = [],
                arrVendorOrderNums = [],
                OrderLinesByNum = {},
                responseData = [],
                i,
                ii,
                iii;

            ///////////////////////////////////////////////////
            // Collect unique the Item Receipt orders from the response
            vc2_util.log(logTitle, '*** LOOK for unique orders ***');

            OrderLines.forEach(function (orderLine) {
                try {
                    // if (vc2_util.inArray(orderLine.order_num, arrOrderNums)) {
                    //     orderLine.RESULT = 'DUPLICATE';
                    //     return;
                    // }

                    if (!orderLine.order_num || orderLine.order_num == 'NA')
                        throw ERROR_MSG.MISSING_ORDERNUM;

                    if (orderLine.hasOwnProperty('is_shipped') && orderLine.is_shipped === false)
                        throw ERROR_MSG.NOT_YET_SHIPPED;

                    if (orderLine.hasOwnProperty('ns_record') && orderLine.ns_record)
                        throw ERROR_MSG.ORDER_EXISTS;

                    orderLine.ship_qty = parseInt(orderLine.ship_qty || '0', 10);
                    if (orderLine.ship_qty == 0) throw ERROR_MSG.NO_SHIP_QTY;

                    orderLine.vendorOrderNum = Current.NumPrefix + orderLine.order_num;
                    orderLine.RESULT = 'ADDED';

                    var orderNum = orderLine.order_num,
                        vendorOrderNum = Current.NumPrefix + orderNum;

                    if (!OrderLinesByNum[orderNum]) OrderLinesByNum[orderNum] = [];
                    OrderLinesByNum[orderNum].push(orderLine);

                    if (!vc2_util.inArray(orderNum, arrOrderNums)) {
                        arrOrderNums.push(orderNum);
                        arrVendorOrderNums.push(vendorOrderNum);
                    }
                } catch (order_error) {
                    vc2_util.logError(logTitle, order_error);
                    orderLine.RESULT = vc2_util.extractError(order_error);

                    vc2_util.vcLog({
                        title: 'Item Receipt Error [' + orderLine.order_num + '] (1) ',
                        error: order_error,
                        details: orderLine,
                        recordId: Current.PO_ID
                    });
                    return;
                }

                return true;
            });
            vc2_util.log(logTitle, '// Unique Orders', arrVendorOrderNums);
            vc2_util.log(logTitle, '// OrderLines By OrderNum', OrderLinesByNum);

            //// PRE-SEARCH of existing IRS ///
            var arrExistingIRS = Helper.findExistingOrders({ orderNums: arrVendorOrderNums });
            vc2_util.log(logTitle, '// Existing IRs', arrExistingIRS);

            ///////////////////////////////////////////////////
            // Loop through each unique order num checking to see if it does not already exist as an item receipt
            var OrigLogPrefix = LogPrefix;
            // for (i = 0; i < arrOrderNums.length; i++) {
            //     var orderNum = arrOrderNums[i],
            //         vendorOrderNum = Current.NumPrefix + orderNum;

            for (var orderNum in OrderLinesByNum) {
                var vendorOrderNum = Current.NumPrefix + orderNum,
                    vendorOrderLines = OrderLinesByNum[orderNum];

                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';
                vc2_util.LogPrefix = LogPrefix;

                try {
                    vc2_util.log(logTitle, '**** PROCESSING Order [' + vendorOrderNum + '] ****');

                    // skip any existing orders
                    if (vc2_util.inArray(vendorOrderNum, arrExistingIRS))
                        throw ERROR_MSG.ORDER_EXISTS;

                    vc2_util.vcLog({
                        title: 'ItemReceipt | Order Lines [' + vendorOrderNum + '] ',
                        message: vendorOrderLines,
                        recordId: Current.PO_ID
                    });

                    if (!vendorOrderLines.length) throw 'No items to receive';

                    ///////////////////////////////////////////////
                    var record;

                    try {
                        // create item receipt from purchase order
                        record = ns_record.transform({
                            fromType: ns_record.Type.PURCHASE_ORDER,
                            fromId: Current.PO_ID,
                            toType: ns_record.Type.ITEM_RECEIPT,
                            isDynamic: true
                        });
                        vc2_util.log(logTitle, '... record transform success');
                    } catch (transform_err) {
                        vc2_util.logError(logTitle, transform_err);
                        record = null;
                        throw vc2_util.extend(ERROR_MSG.TRANSFORM_ERROR, {
                            message: 'Error while creating item receipt ',
                            details: vc2_util.extractError(transform_err)
                        });
                    }

                    var recordIsChanged = false,
                        updateIRData = {};
                    var lineItemCount = record.getLineCount({ sublistId: 'item' });

                    var hasReceivableLine = false,
                        receivablesLines = [],
                        arrLineRRData = [],
                        uniqueItemIds = [],
                        matchingLine,
                        line,
                        lineRRData;
                    for (line = 0; line < lineItemCount; line++) {
                        lineRRData = vc2_record.extractLineValues({
                            record: record,
                            line: line,
                            columns: ['item']
                        });
                        arrLineRRData.push(lineRRData);
                        if (uniqueItemIds.indexOf(lineRRData.item) == -1) {
                            uniqueItemIds.push(lineRRData.item);
                        }
                    }
                    var arrVendorItemNames = vc2_record.extractVendorItemNames({
                        lines: arrLineRRData
                    });
                    var itemAltNameColId =
                            Current.OrderCFG.itemColumnIdToMatch ||
                            Current.MainCFG.itemColumnIdToMatch,
                        itemMPNColId =
                            Current.OrderCFG.itemMPNColumnIdToMatch ||
                            Current.MainCFG.itemMPNColumnIdToMatch;
                    var altItemNames = vc2_record.extractAlternativeItemName({
                        item: uniqueItemIds,
                        mainConfig: Current.MainCFG,
                        orderConfig: Current.OrderCFG
                    });

                    /// REMOVE any items that is not in the XML  Line Data /////////////
                    vc2_util.log(logTitle, '**** Prepare item receipt lines ****');
                    for (line = 0; line < lineItemCount; line++) {
                        // fetch line item data

                        lineRRData = {
                            line: line,
                            item_num: record.getSublistText({
                                sublistId: 'item',
                                fieldId: vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                line: line
                            }),
                            sku_name: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                      line: line
                                  })
                                : '',
                            item_po: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'createdpo',
                                line: line
                            }),
                            line_po: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'poline',
                                line: line
                            }),
                            dandh: record.getSublistText({
                                sublistId: 'item',
                                fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                                line: line
                            }),
                            quantity: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: line
                            }),
                            CURRENTPO: Current.PO_ID
                        };
                        lineRRData[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                            arrVendorItemNames[line][
                                vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                            ];
                        lineRRData = vc2_record.getAltPartNumValues({
                            source: altItemNames,
                            target: lineRRData,
                            orderConfig: Current.OrderCFG,
                            mainConfig: Current.MainCFG,
                            sku: itemAltNameColId
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: itemAltNameColId,
                                      line: line
                                  })
                                : null,
                            mpn: itemMPNColId
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: itemMPNColId,
                                      line: line
                                  })
                                : null
                        });
                        vc2_util.log(logTitle, '// receipt line', lineRRData);

                        try {
                            /// REMOVE lines thats not from the list
                            matchingLine = Helper.findMatchingItem({
                                data: lineRRData, // dataToFind
                                dataSet: vendorOrderLines // dataToTest
                            });

                            if (!matchingLine) throw 'Line not found on receivable items';

                            vc2_util.log(logTitle, '...added to item receipt ');
                            Helper.addIRLine({ record: record, line: line });
                            receivablesLines.push(lineRRData);

                            hasReceivableLine = true;
                            recordIsChanged = true;
                        } catch (lineRR_err) {
                            vc2_util.log(
                                logTitle,
                                '...removed: ' + vc2_util.extractError(lineRR_err)
                            );
                            Helper.removeIRLine({ record: record, line: line });
                            recordIsChanged = true;
                        }
                    }
                    //////////////////////////////////////////////////////////////////////\
                    // skip the order if no receivable items
                    if (!hasReceivableLine) throw ERROR_MSG.NO_RECEIVABLES;

                    // Build a list of unique items with their total quantities shipped for this shipment
                    var UniqueLineItems = [];
                    vc2_util.log(
                        logTitle,
                        '**** Collect all items to receive ****',
                        vendorOrderLines
                    );

                    for (ii = 0; ii < vendorOrderLines.length; ii++) {
                        var lineToReceive = vendorOrderLines[ii];

                        var currentItem = {
                            order_num: orderNum,
                            item_num: lineToReceive.item_num,
                            order_date: lineToReceive.order_date,
                            order_eta: lineToReceive.order_eta,
                            ship_date: lineToReceive.ship_date,
                            carrier: lineToReceive.carrier,
                            ship_qty: parseInt(lineToReceive.ship_qty || '0', 10) || 0,
                            totalShipped: parseInt(lineToReceive.ship_qty || '0', 10) || 0,
                            all_tracking_nums: Helper.uniqueList({
                                value: lineToReceive.tracking_num
                            }),
                            all_serial_nums: Helper.uniqueList({
                                value: lineToReceive.serial_num
                            })
                        };
                        vc2_util.log(logTitle, '// curent item', currentItem);

                        matchingLine = Helper.findMatchingItem({
                            data: lineToReceive,
                            dataSet: UniqueLineItems,
                            fieldToTest: 'item_num'
                        });

                        if (!matchingLine) {
                            UniqueLineItems.push(currentItem);
                            continue;
                        }

                        for (iii = 0; iii < UniqueLineItems.length; iii++) {
                            var uniqItem = UniqueLineItems[iii];
                            if (lineToReceive.item_num !== uniqItem.item_num) continue;

                            // update total shipped qty
                            uniqItem.totalShipped += lineToReceive.ship_qty * 1;

                            // update tracking num list
                            var tmpTrackList = Helper.uniqueList({
                                value: lineToReceive.tracking_num
                            });
                            if (!vc2_util.isEmpty(uniqItem.all_tracking_nums)) {
                                tmpTrackList += '\n' + uniqItem.all_tracking_nums;
                            }
                            uniqItem.all_tracking_nums = Helper.uniqueList({
                                value: tmpTrackList,
                                splitStr: '\n'
                            });

                            // update serials list
                            var tmpSerialList = Helper.uniqueList({
                                value: lineToReceive.serial_num
                            });
                            if (!vc2_util.isEmpty(uniqItem.all_serial_nums)) {
                                tmpTrackList += '\n' + uniqItem.all_serial_nums;
                            }
                            uniqItem.all_serial_nums = Helper.uniqueList({
                                value: tmpSerialList,
                                splitStr: '\n'
                            });
                        }
                    }
                    vc2_util.log(logTitle, '// UniqueLineItems', UniqueLineItems);

                    ///////////////////////////////////////////////////////////////////
                    /// VALIDATE the receipt line items
                    var lineItemRRCount = record.getLineCount({ sublistId: 'item' });
                    var recordLines = [];
                    vc2_util.log(logTitle, '**** START item receipt lines validation ****');

                    updateIRData.custbody_ctc_if_vendor_order_match = vendorOrderNum;
                    updateIRData.custbody_ctc_vc_createdby_vc = true;
                    for (line = 0; line < lineItemRRCount; line++) {
                        record.selectLine({ sublistId: 'item', line: line });
                        lineRRData = {
                            lineNo: line,
                            item: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL
                            }),
                            quantity: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity'
                            }),
                            isReceived: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'itemreceive'
                            }),
                            vendorSKU: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                ? record.getCurrentSublistValue({
                                      sublistId: 'item',
                                      fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                  })
                                : '',
                            line_po: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'poline',
                                line: line
                            }),
                            dandh: record.getSublistText({
                                sublistId: 'item',
                                fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                                line: line
                            }),
                            isSerialized: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'isserial'
                            }),
                            isSerialItem: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'isserialitem'
                            }),
                            isInvDetailReqd: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'inventorydetailreq'
                            })
                        };
                        lineRRData.quantity = parseInt(lineRRData.quantity || '0', 10);
                        vc2_util.log(logTitle, '// current line', lineRRData);

                        if (!lineRRData.isReceived) {
                            vc2_util.log(logTitle, '... skipped: not yet received');
                            Helper.setLineValues({
                                record: record,
                                values: { itemreceive: false },
                                doCommit: true
                            });
                            continue;
                        }
                        lineRRData[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                            arrVendorItemNames[line][
                                vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                            ];
                        lineRRData = vc2_record.getAltPartNumValues({
                            source: altItemNames,
                            target: lineRRData,
                            orderConfig: Current.OrderCFG,
                            mainConfig: Current.MainCFG,
                            sku: itemAltNameColId
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: itemAltNameColId,
                                      line: line
                                  })
                                : null,
                            mpn: itemMPNColId
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: itemMPNColId,
                                      line: line
                                  })
                                : null
                        });

                        for (ii = 0; ii < UniqueLineItems.length; ii++) {
                            var itemToShip = UniqueLineItems[ii];
                            vc2_util.log(logTitle, '// item to Ship', itemToShip);

                            var isMatchingLine =
                                (lineRRData.alternativeItemName &&
                                    vc2_util.inArray(lineRRData.alternativeItemName, [
                                        itemToShip.item_num,
                                        itemToShip.vendorSKU
                                    ])) ||
                                (lineRRData.alternativeItemName2 &&
                                    vc2_util.inArray(lineRRData.alternativeItemName2, [
                                        itemToShip.item_num,
                                        itemToShip.vendorSKU
                                    ])) ||
                                (lineRRData.alternativeSKU &&
                                    lineRRData.alternativeSKU == dataToTest.vendorSKU) ||
                                (lineRRData.alternativeMPN &&
                                    lineRRData.alternativeMPN == dataToTest[itemType]) ||
                                lineRRData.item == itemToShip.item_num ||
                                (lineRRData.vendorSKU &&
                                    lineRRData.vendorSKU == itemToShip.vendorSKU) ||
                                (lineRRData.dandh &&
                                    Current.OrderCFG.xmlVendor ==
                                        vc2_constant.LIST.XML_VENDOR.DandH &&
                                    lineRRData.dandh == itemToShip.item_num) ||
                                (lineRRData[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] &&
                                    vc2_util.inArray(
                                        itemToShip.item_num,
                                        lineRRData[
                                            vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                                        ].split('\n')
                                    ));

                            if (!isMatchingLine) {
                                vc2_util.log(logTitle, '... skipped');
                                continue;
                            }

                            var itemrrValues = {
                                quantity: itemToShip.totalShipped,
                                custcol_ctc_xml_dist_order_num: itemToShip.order_num,
                                custcol_ctc_xml_date_order_placed: itemToShip.order_date,
                                custcol_ctc_xml_eta: itemToShip.order_eta,
                                custcol_ctc_xml_ship_date: itemToShip.ship_date,
                                custcol_ctc_xml_carrier: itemToShip.carrier,
                                custcol_ctc_xml_tracking_num: itemToShip.all_tracking_nums,
                                custcol_ctc_vc_eta_date: Helper.parseDate({
                                    dateString: itemToShip.order_eta
                                }),
                                custcol_ctc_vc_delivery_eta_date: Helper.parseDate({
                                    dateString: itemToShip.order_delivery_eta
                                }),
                                custcol_ctc_vc_order_placed_date: Helper.parseDate({
                                    dateString: itemToShip.order_date
                                }),
                                custcol_ctc_vc_shipped_date: Helper.parseDate({
                                    dateString: itemToShip.ship_date
                                })
                            };

                            ////////////////////////////////////////////
                            /// if total Shipped is empty /////
                            if (itemToShip.totalShipped == 0) {
                                vc2_util.log(logTitle, '...skipped: no more items left to ship.');
                                Helper.setLineValues({
                                    record: record,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                recordIsChanged = true;
                                continue;
                            }

                            ////////////////////////////////////////////
                            // don't allow receipt if the available quantity is less
                            if (lineRRData.quantity < itemToShip.ship_qty) {
                                vc2_util.log(
                                    logTitle,
                                    '... skipped: rem qty is less than required ship qty. '
                                );

                                Helper.setLineValues({
                                    record: record,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                recordIsChanged = true;
                                continue;
                            }

                            ////////////////////////////////////////////
                            // don't allow receipt if the available quantity is less
                            if (lineRRData.quantity < itemToShip.totalShipped) {
                                itemrrValues.quantity = lineRRData.quantity;

                                Helper.setLineValues({
                                    record: record,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                recordIsChanged = true;
                                continue;
                            }

                            if (
                                (Current.OrderCFG.useShipDate == true ||
                                    Current.OrderCFG.useShipDate == 'T') &&
                                itemToShip.ship_date &&
                                itemToShip.ship_date != 'NA'
                            ) {
                                updateIRData['trandate'] = vc_record.parseDate({
                                    dateString: itemToShip.ship_date
                                });
                            }

                            ///////////////////////////////////////////////
                            Helper.setLineValues({ record: record, values: itemrrValues });
                            ///////////////////////////////////////////////

                            //// SERIALS DETECTION ////////////////
                            var arrSerials = itemToShip.all_serial_nums
                                ? itemToShip.all_serial_nums.split(/\n/)
                                : [];

                            vc2_util.log(logTitle, '... serials', arrSerials);

                            record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ctc_xml_serial_num',
                                value: arrSerials.join('\n').substr(0, _TEXT_AREA_MAX_LENGTH)
                            });

                            //// TRACKING NUMBERS DETECTION ////////////////
                            var arrTrackingNums = itemToShip.all_tracking_nums
                                ? itemToShip.all_tracking_nums.split(/\n/)
                                : [];

                            vc2_util.log(logTitle, '... tracking', arrTrackingNums);

                            var trackingField = Current.MainCFG.useInboundTrackingNumbers
                                ? vc2_constant.FIELD.TRANSACTION.INBOUND_TRACKING_NUM
                                : 'custcol_ctc_xml_tracking_num';
                            record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: trackingField,
                                value: arrTrackingNums.join('\n').substr(0, _TEXT_AREA_MAX_LENGTH)
                            });

                            UniqueLineItems[ii].totalShipped -= lineRRData.quantity;
                            recordLines.push({
                                item_num: lineRRData.item,
                                totalShipped: lineRRData.quantity,
                                order_num: itemToShip.order_num,
                                order_date: itemToShip.order_date,
                                order_eta: itemToShip.order_eta,
                                order_delivery_eta: itemToShip.order_delivery_eta,
                                ship_date: itemToShip.ship_date,
                                carrier: itemToShip.carrier,
                                all_serial_nums: arrSerials.join('\n'),
                                all_tracking_nums: arrTrackingNums.join('\n')
                            });

                            if (
                                (lineRRData.isSerialized == 'T' || lineRRData.isSerialItem) &&
                                arrSerials.length &&
                                Helper.validateSerials({ serials: arrSerials })
                            ) {
                                var currentLocation = record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'location'
                                });

                                var resultSerials = Helper.addNativeSerials({
                                    record: record,
                                    serials: arrSerials
                                });

                                if (!resultSerials) {
                                    // do not clear location as some receipt fail when there is more than one loc
                                    // blanks are counted as another location

                                    // only prevent inventory detail from being required after location changes
                                    // to stay true to native behavior
                                    record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'inventorydetailreq',
                                        value: lineRRData.isInvDetailReqd
                                    });
                                }
                            }
                        }
                        record.commitLine({ sublistId: 'item' });
                        recordIsChanged = true;
                    }

                    vc2_util.log(logTitle, '>> record lines', recordLines);

                    if (vc2_util.isEmpty(recordLines)) {
                        vc2_util.log(
                            logTitle,
                            '>> No Matching Lines To Receive:  ' + vendorOrderNum
                        );
                        continue;
                    }

                    try {
                        var objId;

                        if (recordIsChanged) {
                            vc2_util.log(logTitle, ' ///  updateIRData', updateIRData);
                            if (!vc2_util.isEmpty(updateIRData)) {
                                for (var fld in updateIRData) {
                                    record.setValue({ fieldId: fld, value: updateIRData[fld] });
                                }
                            }

                            objId = record.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });

                            responseData.push({ id: objId, orderNum: orderNum });
                        } else {
                            objId = record.id;
                            responseData.push({ id: objId, orderNum: orderNum });
                        }

                        vc2_util.vcLog({
                            title: 'Item Receipt | Successfully Created:',
                            message:
                                '##' +
                                ('Created Item Receipt (' + objId + ') \n') +
                                Helper.printerFriendlyLines({ recordLines: recordLines }),
                            recordId: Current.PO_ID,
                            isSuccess: true
                        });

                        vc2_util.log(
                            logTitle,
                            '## Created Item Receipt: [itemreceipt:' + objId + ']'
                        );
                    } catch (itemrr_err) {
                        var errMsg = vc2_util.extractError(itemrr_err);
                        vc2_util.log(
                            logTitle,
                            '/// ITEM RECEIPT Create error',
                            itemrr_err,
                            'error'
                        );

                        vc2_util.vcLog({ error: itemrr_err, title: 'Create Item Receipt Error' });
                        throw errMsg;
                    }
                } catch (ordernum_error) {
                    vc2_util.logError(logTitle, ordernum_error);
                    vc2_util.vcLog({
                        title: 'Item Receipt Error [' + vendorOrderNum + ']',
                        error: ordernum_error,
                        recordId: Current.PO_ID
                    });
                    continue;
                }
            }
            return responseData;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            vc2_util.vcLog({
                title: 'Item Receipt Error',
                error: error,
                status: LOG_STATUS.RECORD_ERROR,
                recordId: Current.PO_ID
            });

            throw error;
        } finally {
            vc2_util.log(logTitle, '############ ITEM RECEIPT CREATION: END ############');
        }
    };
    ////////////////////////////////////

    ///////////////////////////////////////////////////////////////////////

    ///////////////////////////////////////////////////////////////////////
    var dateFormat;
    var Helper = {
        uniqueList: function (option) {
            var strList = option.listString || option.value,
                splitStr = option.splitStr || ',',
                joinStr = option.joinStr || '\n';

            var arrList = [];
            if (strList && util.isString(strList)) {
                arrList = strList.split(splitStr);
            }
            arrList = vc2_util.uniqueArray(arrList);

            return arrList.join(joinStr);
        },
        _lookupMonthNo: function (monthName) {
            var monthFullnames = [
                'JANUARY',
                'FEBRUARY',
                'MARCH',
                'APRIL',
                'MAY',
                'JUNE',
                'JULY',
                'AUGUST',
                'SEPTEMBER',
                'OCTOBER',
                'NOVEMBER',
                'DECEMBER'
            ];
            var upperCasedMonthName = monthName.toUpperCase();
            var monthNo = null;
            for (var i = 0, len = monthFullnames.length; i < len; i += 1) {
                if (monthFullnames[i].indexOf(upperCasedMonthName) == 0) {
                    monthNo = i + 1;
                    break;
                }
            }
            return monthNo;
        },
        parseDate: function (option) {
            // use only with date strings retrieved from NetSuite date fields
            var dateTimeString = option.dateString,
                dateFormat = dateFormat || option.dateFormat,
                date;
            if (!dateFormat) {
                var generalPref = ns_config.load({
                    type: ns_config.Type.COMPANY_PREFERENCES
                });
                dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            }
            if (dateTimeString && dateTimeString.length > 0 && dateTimeString != 'NA') {
                try {
                    var tempString = dateTimeString.replace(/[-. ]/g, '/').replace(/,/g, '');
                    var dateTimeComponents = tempString.split('T'); //handle timestamps with T
                    var dateStr = dateTimeComponents[0];
                    var dateComponents = dateStr.split('/');
                    switch (dateFormat) {
                        case 'DD MONTH, YYYY':
                        case 'D MONTH, YYYY':
                        case 'DD-MONTH-YYYY':
                        case 'D-MONTH-YYYY':
                        case 'DD-Mon-YYYY':
                        case 'D-Mon-YYYY':
                            var convertedMonth = Helper._lookupMonthNo(dateComponents[1]);
                        case 'DD/MM/YYYY':
                        case 'DD.MM.YYYY':
                        case 'D/M/YYYY':
                        case 'D.M.YYYY':
                            dateStr = [
                                convertedMonth || dateComponents[1],
                                dateComponents[0],
                                dateComponents[2]
                            ].join('/');
                            break;
                        default:
                            break;
                    }
                    date =
                        new Date(Date.parse(dateStr)) ||
                        ns_format.parse({
                            value: dateTimeString,
                            type: ns_format.Type.DATE
                        });
                } catch (e) {
                    log.error('Error parsing date ' + dateTimeString, e);
                }
            }
            return date;
        },
        printerFriendlyLines: function (option) {
            var logTitle = [LogTitle, 'printerFriendlyLines'].join('::');
            log.audit(
                logTitle,
                vc2_util.getUsage() + LogPrefix + '>> option: ' + JSON.stringify(option)
            );

            var recordLines = option.recordLines,
                outputString = '',
                orderDetails = '';

            for (var i = 0; i < recordLines.length; i++) {
                var line = recordLines[i];

                if (outputString.length > 0) outputString += '\n\n';

                if (!orderDetails) {
                    orderDetails += 'Order';
                    orderDetails += '\n   Num      : ' + line.order_num;
                    orderDetails += '\n   Date     : ' + line.order_date;
                    orderDetails += '\n   ETA      : ' + line.order_eta;
                    orderDetails += '\n   Deliv ETA: ' + line.order_delivery_eta;
                    orderDetails += '\n   Ship Date: ' + line.ship_date;
                    orderDetails += '\n   Carrier  : ' + line.carrier;
                }

                outputString += 'Item Num    : ' + line.item_num;
                outputString += '\n   Qty    : ' + line.totalShipped;
                var serials;
                if (typeof line.all_serial_nums == 'string') serials = line.all_serial_nums;
                else if (typeof line.all_serial_nums == 'object')
                    serials = line.all_serial_nums.join(',');
                outputString += '\n   Serials: ' + serials;
            }

            outputString = orderDetails + '\n' + outputString;

            return outputString;
        },
        sortLineData: function (lineData) {
            var sort_by = function (field, reverse, primer) {
                var key = primer
                    ? function (x) {
                          return primer(x[field]);
                      }
                    : function (x) {
                          return x[field];
                      };

                reverse = !reverse ? 1 : -1;

                return function (a, b) {
                    return (a = key(a)), (b = key(b)), reverse * ((a > b) - (b > a));
                };
            };

            lineData.sort(
                sort_by('order_num', false, function (a) {
                    return a.toUpperCase();
                })
            );

            return lineData;
        },
        log: function (title, content, objVar, logtype) {
            logtype = logtype || 'audit';
            if (objVar && objVar !== null) content += ' -- ' + JSON.stringify(objVar);
            return log[logtype](title, vc2_util.getUsage() + LogPrefix + content);
        },
        validateSerials: function (option) {
            var logTitle = [LogTitle, 'validateSerials'].join('::');

            var serialList = option.serials || [],
                validSerialList = [];

            serialList.forEach(function (serial) {
                if (serial && serial !== 'NA') validSerialList.push(serial);
                return true;
            });

            log.audit(
                logTitle,
                vc2_util.getUsage() +
                    LogPrefix +
                    '>> Valid Serials: ' +
                    JSON.stringify([validSerialList.length, validSerialList])
            );

            return validSerialList.length ? validSerialList : false;
        },
        // Added by Clemen - 04/28/2022
        addNativeSerials: function (option) {
            var logTitle = [LogTitle, 'addNativeSerials'].join('::');

            var record = option.record;
            var validSerialList = this.validateSerials(option);
            vc2_util.log(logTitle, '// Set Inventory Details: ', validSerialList);
            if (!validSerialList) return;

            var addedSerials = [];

            var TryThese = [
                // Attempt to add the serials using inventorydetail
                function () {
                    var inventoryDetailRec = record.getCurrentSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail'
                    });

                    for (var i = 0; i < validSerialList.length; i++) {
                        if (!validSerialList[i] || validSerialList[i] == 'NA') continue;
                        vc2_util.log(logTitle, '... add new serial:  ', validSerialList[i]);

                        inventoryDetailRec.selectNewLine({ sublistId: 'inventoryassignment' });
                        inventoryDetailRec.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            value: validSerialList[i]
                        });
                        inventoryDetailRec.commitLine({ sublistId: 'inventoryassignment' });

                        addedSerials.push(validSerialList[i]);
                    }
                },
                // just use the serial numbers
                function () {
                    // just set the serial number field
                    record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'serialnumbers',
                        value: validSerialList.join('\n')
                    });

                    addedSerials = validSerialList;
                }
            ];

            // now try it
            TryThese.forEach(function (fn) {
                var isSuccess = false;

                try {
                    fn.call();
                } catch (error) {
                    vc2_util.log(
                        logTitle,
                        '!! ERROR adding serialnumbers - ' + vc2_util.extractError(error),
                        error
                    );
                    isSuccess = false;
                }

                if (isSuccess) return false;
            });

            vc2_util.log(logTitle, '## Added Serials: ', addedSerials);

            return true;
        },
        validatePODate: function (option) {
            var logTitle = [LogTitle, 'validateDate'].join('::'),
                logPrefix = LogPrefix + ' validateDate || ',
                returnValue;
            option = option || {};

            try {
                if (!Current.PO_ID) throw 'Missing PO ID';
                if (!Current.OrderCFG) throw 'Missing Vendor Config';

                var searchId = ns_runtime.getCurrentScript().getParameter('custscript_searchid2');
                var searchObj = ns_search.load({ id: searchId });

                searchObj.filters.push(
                    ns_search.createFilter({
                        name: 'internalid',
                        operator: ns_search.Operator.IS,
                        values: Current.PO_ID
                    })
                );
                searchObj.filters.push(
                    ns_search.createFilter({
                        name: 'trandate',
                        operator: ns_search.Operator.ONORAFTER,
                        values: Current.OrderCFG.startDate
                    })
                );

                returnValue = !!searchObj.runPaged().count;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        isMatchingLine: function (option) {
            var logTitle = [LogTitle, 'isMatchingLine'].join('::'),
                returnValue;
            option = option || {};
            try {
                var dataToFind = option.lineData || option.dataToFind,
                    dataToTest = option.apiData || option.dataToTest || {},
                    fieldToTest = option.testField;

                var hashSpace = Current.MainCFG.ingramHashSpace,
                    xmlVendor = Current.OrderCFG.xmlVendor,
                    vendorList = vc2_constant.LIST.XML_VENDOR;

                var logPrefix = LogPrefix + ' [Item: ' + dataToTest.item_num + ']';
                var hasMatch = false;

                // log.audit(logTitle,  vc_util.getUsage() + LogPrefix + ' // isMatchingLine: ' + JSON.stringify(option));

                var LineItemCheck = {
                    altItemCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // altItemCheck:[' + itemType + ']: ',
                            returnValue = false;

                        try {
                            if (!dataToFind[itemType] || !dataToTest[itemType])
                                throw '[' + itemType + '] not present';

                            if (
                                (!dataToFind.alternativeItemName ||
                                    !vc2_util.inArray(dataToFind.alternativeItemName, [
                                        dataToTest[itemType],
                                        dataToTest.vendorSKU
                                    ])) &&
                                (!dataToFind.alternativeItemName2 ||
                                    !vc2_util.inArray(dataToFind.alternativeItemName, [
                                        dataToTest[itemType],
                                        dataToTest.vendorSKU
                                    ])) &&
                                (!dataToFind.alternativeSKU ||
                                    dataToFind.alternativeSKU != dataToTest.vendorSKU) &&
                                (!dataToFind.alternativeMPN ||
                                    dataToFind.alternativeMPN != dataToTest[itemType])
                            ) {
                                throw ' not matched.';
                            }

                            returnValue = true;
                            log.audit(logTitle, _logPrefix + ' >> matched. <<');
                        } catch (check_error) {
                            // log.audit(
                            //     logTitle,
                            //     _logPrefix + '... skipped: ' + vc_util.extractError(check_error)
                            // );
                        }
                        return returnValue;
                    },
                    ingramCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // ingramCheck:[' + itemType + ']: ',
                            returnValue = false;

                        try {
                            if (!dataToFind[itemType] || !dataToTest[itemType])
                                throw '[' + itemType + '] not present';

                            if (
                                !hashSpace &&
                                !vc2_util.inArray(xmlVendor, [
                                    vendorList.INGRAM_MICRO_V_ONE,
                                    vendorList.INGRAM_MICRO
                                ])
                            )
                                throw 'non ingram vendor';

                            if (dataToFind[itemType].replace('#', '') != dataToTest[itemType])
                                throw 'value not matched.';

                            returnValue = true;
                            log.audit(logTitle, _logPrefix + ' >> matched. <<');
                        } catch (check_error) {
                            // log.audit(
                            //     logTitle,
                            //     _logPrefix + '... skipped: ' + vc_util.extractError(check_error)
                            // );
                        }
                        return returnValue;
                    },
                    itemCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // itemCheck:[' + itemType + ']',
                            returnValue = false;

                        try {
                            if (!dataToTest[itemType]) throw '[' + itemType + '] not present';

                            if (
                                !vc2_util.inArray(dataToFind[itemType], [
                                    dataToTest.vendorSKU,
                                    dataToTest.item_num_alt,
                                    dataToTest.item_num
                                ])
                            )
                                throw ' not matched.';

                            returnValue = true;
                            log.audit(logTitle, _logPrefix + ' >> matched. <<');
                        } catch (check_error) {
                            // log.audit(
                            //     logTitle,
                            //     _logPrefix + '... skipped: ' + vc_util.extractError(check_error)
                            // );
                        }
                        return returnValue;
                    },
                    dnhCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // D&H Check:[' + itemType + ']',
                            returnValue = false;

                        try {
                            if (!dataToTest[itemType]) throw '[' + itemType + '] not present';
                            if (xmlVendor !== vendorList.DandH) throw 'non D&H vendor';
                            if (dataToFind.dandh !== dataToTest[itemType]) throw ' not matched.';
                            returnValue = true;
                            log.audit(logTitle, _logPrefix + ' >> matched. <<');
                        } catch (check_error) {
                            // log.audit(
                            //     logTitle,
                            //     _logPrefix + '... skipped: ' + vc_util.extractError(check_error)
                            // );
                        }
                        return returnValue;
                    },
                    vendorNameCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // vendorNameCheck:[' + itemType + ']',
                            returnValue = false;

                        try {
                            if (!dataToTest[itemType]) throw '[' + itemType + '] not present';

                            if (
                                !dataToFind[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] ||
                                !vc2_util.inArray(
                                    dataToTest[itemType],
                                    dataToFind[
                                        vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                                    ].split('\n')
                                )
                            )
                                throw ' not matched.';

                            returnValue = true;
                            log.audit(logTitle, _logPrefix + ' >> matched. <<');
                        } catch (check_error) {
                            // log.audit(
                            //     logTitle,
                            //     _logPrefix + '... skipped: ' + vc_util.extractError(check_error)
                            // );
                        }
                        return returnValue;
                    }
                };

                ['item_num', 'sku_name'].forEach(function (fld) {
                    if (!hasMatch && (!fieldToTest || fieldToTest == fld)) {
                        hasMatch =
                            LineItemCheck.altItemCheck(fld) ||
                            LineItemCheck.itemCheck(fld) ||
                            LineItemCheck.ingramCheck(fld) ||
                            LineItemCheck.dnhCheck(fld) ||
                            LineItemCheck.vendorNameCheck(fld);
                    }
                    return true;
                });

                returnValue = hasMatch;
            } catch (error) {
                log.error(
                    logTitle,
                    vc2_util.getUsage() + LogPrefix + '## ERROR ## ' + JSON.stringify(error)
                );
                returnValue = false;
                throw vc2_util.extractError(error);
            }

            return returnValue;
        },
        findMatchingItem: function (option) {
            var logTitle = [LogTitle, 'findMatchingItem'].join('::'),
                returnValue;
            option = option || {};
            try {
                var matchingItem = null;
                var dataSet = option.dataSet || [],
                    dataToFind = option.data || option.lineData,
                    fieldToTest = option.fieldToTest;

                for (var i = 0, j = dataSet.length; i < j; i++) {
                    var dataToTest = dataSet[i];
                    var logPrefix = LogPrefix + ' [Item: ' + dataToTest.item_num + ']';
                    // log.audit(
                    //     logTitle,
                    //     logPrefix + '/// Testing -- : ' + JSON.stringify(dataToTest.item_num)
                    // );

                    if (
                        Helper.isMatchingLine({
                            dataToFind: dataToFind,
                            dataToTest: dataToTest,
                            fieldToTest: fieldToTest
                        })
                    ) {
                        matchingItem = dataToTest;
                        break;
                    }
                }

                returnValue = matchingItem;
            } catch (error) {
                log.error(
                    logTitle,
                    vc2_util.getUsage() + LogPrefix + '## ERROR ## ' + JSON.stringify(error)
                );
                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                // log.audit(logTitle,  vc_util.getUsage() + LogPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        findExistingOrders: function (option) {
            var logTitle = [LogTitle, 'findExistingOrders'].join('::'),
                logPrefix = LogPrefix + ' findExistingOrders || ',
                returnValue;
            option = option || {};

            try {
                var listOrderNum = option.orderNums;
                if (vc2_util.isEmpty(listOrderNum)) return false;

                var searchOption = {
                    type: 'itemreceipt',
                    filters: [['type', 'anyof', 'ItemRcpt'], 'AND', ['mainline', 'is', 'T']],
                    columns: [
                        'mainline',
                        'internalid',
                        'trandate',
                        'tranid',
                        'entity',
                        'custbody_ctc_if_vendor_order_match'
                    ]
                };

                searchOption.filters.push('AND');
                var orderNumFilter = [];
                listOrderNum.forEach(function (orderNum) {
                    orderNumFilter.push([
                        'custbody_ctc_if_vendor_order_match',
                        ns_search.Operator.IS,
                        orderNum
                    ]);
                    orderNumFilter.push('OR');
                    return true;
                });
                orderNumFilter.pop('OR');
                searchOption.filters.push(orderNumFilter);

                // log.audit(
                //     logTitle,
                //     vc_util.getUsage() +
                //         LogPrefix +
                //         '>> searchOption: ' +
                //         JSON.stringify(searchOption)
                // );

                var arrResults = [];
                var searchResults = vc2_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                searchResults.forEach(function (result) {
                    var orderNum = result.getValue({ name: 'custbody_ctc_if_vendor_order_match' });

                    if (!vc2_util.inArray(orderNum, arrResults)) {
                        arrResults.push(orderNum);
                    }

                    return true;
                });

                returnValue = arrResults;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                // log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        removeIRLine: function (option) {
            var logTitle = [LogTitle, 'removeIRLine'].join('::'),
                logPrefix = LogPrefix + ' removeIRLine || ',
                returnValue;
            option = option || {};

            try {
                option.record.selectLine({
                    sublistId: 'item',
                    line: option.line
                });
                option.record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemreceive',
                    value: false
                });
                option.record.commitLine({ sublistId: 'item' });
                returnValue = true;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc2_util.extractError(error);
            }

            return returnValue;
        },
        addIRLine: function (option) {
            var logTitle = [LogTitle, 'addIRLine'].join('::'),
                logPrefix = LogPrefix + ' addIRLine || ',
                returnValue;
            option = option || {};

            try {
                option.record.selectLine({
                    sublistId: 'item',
                    line: option.line
                });
                option.record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemreceive',
                    value: true
                });
                option.record.commitLine({ sublistId: 'item' });
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc2_util.extractError(error);
            }

            return returnValue;
        },
        setLineValues: function (option) {
            var logTitle = [LogTitle, 'setLineValues'].join('::'),
                logPrefix = LogPrefix + ' // set line value - ',
                returnValue;
            option = option || {};

            try {
                if (!option.record) throw 'Missing record';
                if (vc2_util.isEmpty(option.values)) throw 'Missing values';

                if (option.line) {
                    option.record.selectLine({
                        sublistId: 'item',
                        line: option.line
                    });
                }

                log.audit(logTitle, logPrefix + '... ' + JSON.stringify(option.values));

                for (var fld in option.values) {
                    option.record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fld,
                        value: option.values[fld]
                    });
                }

                if (option.line || option.doCommit) {
                    option.record.commitLine({ sublistId: 'item' });
                }
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
            }

            return returnValue;
        }
    };

    return ItemRRLib;
});
