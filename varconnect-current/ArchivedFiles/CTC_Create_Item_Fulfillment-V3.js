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
 * CTC_Create_Item_Fulfillment.js
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Sep 8, 2017		jcorrea		Creates Item Fulfillment after receiving XML data
 * 			Sep 16, 2017	jcorrea		Integrate code from debugger version
 *			Jan 9, 2019		ocorrea		Add support for vendorSku matching
 *			Oct 1, 2020		paolodl		Auto Shipped status for Pick, Pack, Ship
 *			Feb 8, 2021		paolodl		Add population for new date columns
 * 2.00		May 28, 2021	paolodl		Also check for line number
 * 2.01		Mar 21, 2022	ccanaria	Add functionality for package
 * 2.02		Mar 31, 2022	ccanaria	Add functionality to put serials using standard inventiory details
 * 2.03		Apr 22, 2022	christian	Limit text serial numbers to 4000 chars
 * 2.05     May 2, 2022     brianff     moved the line location setting on the Helper
 *                                      removed the 'NA' on native serial settings
 *                                      fixed bug on determing unique line items to fulfill
 *                                      code cleanup, updated variable names
 * 2.06		 May 18, 2022	christian	Location lookup can have empty array
 * 2.07		 Aug 24, 2022	christian	Old parseDate renamed to formatDate. Revamped parseDate.
 * 3.00      Sep 15, 2022   brianff     Refactored code base
 *                                      Re-applied multi-ship changes, and
 *                                          prevent blanking locations if the serials are not applied
 */

define(function (require) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_format = require('N/format'),
        ns_config = require('N/config');

    var vc_constants = require('./CTC_VC2_Constants.js'),
        vc_log = require('./CTC_VC_Lib_Log.js'),
        vc_util = require('./CTC_VC2_Lib_Utils.js'),
        util_record = require('./CTC_VC2_Lib_Record.js');

    var LogTitle = 'ItemFFLIB',
        LogPrefix = '',
        _TEXT_AREA_MAX_LENGTH = 4000;

    var Current = {
        DateFormat: null,
        PO_ID: null,
        SO_ID: null,
        OrderLines: null,
        MainCFG: null,
        VendorCFG: null,
        Vendor: null
    };

    var ItemFFLib = {};

    ///////////////////////////////////////////////////////////////////////
    ItemFFLib.processOrderLines = function (option) {
        var logTitle = [LogTitle, 'processOrderLines'].join('::'),
            returnValue;

        Current.Script = ns_runtime.getCurrentScript();
        log.debug(logTitle, '############ ITEM FULFILLMENT CREATION: START ############');
        try {
            Current.Features = {
                MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })
            };

            Current.MainCFG = option.mainConfig;
            Current.VendorCFG = option.vendorConfig;
            Current.PO_ID = option.poId || option.recPurchOrd.id;
            Current.SO_ID = option.soId || option.recSalesOrd.id;
            Current.Vendor = option.vendor;

            LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';

            Helper.log(logTitle, '// CURRENT: ', Current);

            Current.OrderLines = option.lineData;
            Current.SO_REC = option.recSalesOrd;
            Current.PO_REC = option.recPurchOrd;

            Helper.log(logTitle, '// OrderLines: ', Current.OrderLines);

            //////////////////////
            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.VendorCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (vc_util.isEmpty(Current.OrderLines)) throw 'Empty Line Data';

            if (!Helper.validateDate()) throw 'Invalid PO Date';

            Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw 'Config Error: Missing Fulfillment Prefix';

            // sort the lines by order num
            var OrderLines = Helper.sortLineData(Current.OrderLines);

            var arrOrderNums = [],
                arrVendorOrderNums = [],
                i,
                ii,
                iii;

            // cleanup and make the list unique
            OrderLines.forEach(function (orderLine) {
                if (vc_util.inArray(orderLine.order_num, arrOrderNums)) {
                    orderLine.RESULT = 'DUPLICATE';
                    return;
                }

                if (!orderLine.order_num || orderLine.order_num == 'NA') {
                    orderLine.RESULT = 'MISSING ORDERNUM';
                    return;
                }

                if (orderLine.hasOwnProperty('is_shipped') && orderLine.is_shipped === false) {
                    orderLine.RESULT = 'NOT SHIPPED';
                    return;
                }

                if (orderLine.hasOwnProperty('ns_record') && orderLine.ns_record) {
                    orderLine.RESULT = 'ORDER EXISTS';
                    return;
                }

                orderLine.ship_qty = parseInt(orderLine.ship_qty || '0', 10);
                orderLine.vendorOrderNum = Current.NumPrefix + orderLine.order_num;
                orderLine.RESULT = 'ADDED';

                arrOrderNums.push(orderLine.order_num);
                arrVendorOrderNums.push(Current.NumPrefix + orderLine.order_num);

                return true;
            });
            Helper.log(logTitle, 'OrderLines', OrderLines);
            Helper.log(logTitle, 'Unique Orders', [arrOrderNums, arrVendorOrderNums]);

            //// PRE-SEARCH of existing IFS ///
            var arrExistingIFS = Helper.findExistingOrders({ orderNums: arrVendorOrderNums });
            Helper.log(logTitle, 'existing IFs', arrExistingIFS);

            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            var OrigLogPrefix = LogPrefix;
            for (i = 0; i < arrOrderNums.length; i++) {
                var orderNum = arrOrderNums[i],
                    vendorOrderNum = Current.NumPrefix + orderNum;

                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';

                Helper.log(logTitle, '/// PROCESSING ORDER [' + vendorOrderNum + ']');

                var LinesToFulfill = [];

                try {
                    /// check if order exists //////////////////
                    if (vc_util.inArray(vendorOrderNum, arrExistingIFS)) throw 'ORDER_EXISTS';

                    // Build an array with all XML line data with the same order num
                    for (ii = 0; ii < OrderLines.length; ii++) {
                        if (orderNum != OrderLines[ii].order_num) continue;
                        LinesToFulfill.push(OrderLines[ii]);
                    }

                    if (!LinesToFulfill.length) continue;
                    Helper.log(logTitle, '... lines to fulfill: ', LinesToFulfill);

                    var defaultItemFFValues = {};
                    if (Current.Features.MULTISHIPTO) {
                        var defaultShipGroup = Helper.getShipGroup({
                            recSalesOrd: Current.SO_REC,
                            recPurchOrd: Current.PO_REC
                        });
                        if (defaultShipGroup) {
                            defaultItemFFValues.shipgroup = defaultShipGroup;
                        }
                    }

                    var fulfillData = ItemFFLib.createFulfillment({
                        lines: LinesToFulfill,
                        defaultValues: defaultItemFFValues
                    });
                } catch (order_error) {
                    var orderErrMsg = vc_util.extractError(order_error);
                    Helper.logMsg({
                        title: 'Notes',
                        message: orderNum + 'Skipped : ' + orderErrMsg
                    });
                    Helper.log(logTitle, 'Notes', order_error);
                    continue;
                }
            }
        } catch (error) {
            var errorMsg = vc_util.extractError(error);

            log.error(
                logTitle,
                vc_util.getUsage() + (LogPrefix + '## ERROR:  ') + (errorMsg + '| Details: ' + JSON.stringify(error))
            );
            Helper.logMsg({ title: logTitle + ':: Error', error: error });
            returnValue = false;
        } finally {
            log.debug(logTitle, vc_util.getUsage() + '############ ITEM FULFILLMENT CREATION: END ############');
        }

        return returnValue;
    };
    ///////////////////////////////////////////////////////////////////////

    var ERROR_MSG = {
        ORDER_EXISTS: 'Order already exists',
        TRANSFORM_ERROR: 'Transform error ' + Current.SO_ID,
        NO_FULFILLABLES: 'No fulfillable lines'
    };

    ItemFFLib.createFulfillment = function (option) {
        var logTitle = [LogTitle, 'createFulfillment'].join('::'),
            returnValue;
        Current.Script = ns_runtime.getCurrentScript();
        log.debug(logTitle, '############ ITEM FULFILLMENT CREATION: START ############');

        try {
            var linesToFulfill = option.lines,
                defaultValues = option.defaultValues,
                lineItemCount,
                recordIsChanged = false;

            var record = util_record.transform({
                fromType: ns_record.Type.SALES_ORDER,
                fromId: Current.SO_ID,
                toType: ns_record.Type.ITEM_FULFILLMENT,
                isDynamic: true,
                defaultValues: defaultValues
            });
            if (!record) throw 'TRANSFORM_ERROR';

            lineItemCount = record.getLineCount({ sublistId: 'item' });

            ///////////////////////////////////////////////////////////////////
            /// REMOVE any items that is not in the XML  Line Data /////////////
            var hasFulfillableLine = false,
                fulfillableLines = [],
                matchingLine,
                line,
                lineFFData;

            for (line = 0; line < lineItemCount; line++) {
                lineFFData = {
                    line: line,
                    item_num: record.getSublistText({
                        sublistId: 'item',
                        fieldId: vc_constants.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                        line: line
                    }),
                    skuName: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                        ? record.getSublistText({
                              sublistId: 'item',
                              fieldId: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL,
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
                        fieldId: vc_constants.FIELD.ITEM.DH_MPN,
                        line: line
                    }),
                    quantity: record.getSublistText({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: line
                    }),
                    CURRENTPO: Current.PO_ID
                };

                Helper.log(logTitle, '...fulfill line: ', lineFFData);

                try {
                    /// REMOVE lines from different POs
                    if (lineFFData.item_po != Current.PO_ID) throw 'Not same PO';

                    /// REMOVE lines thats not from the list
                    matchingLine = Helper.findMatchingItem({
                        data: lineFFData,
                        dataSet: linesToFulfill
                    });

                    if (!matchingLine) throw 'Line not found on fulfillable items';

                    Helper.addFulfillmentLine({ record: record, line: line });
                    fulfillableLines.push(lineFFData);

                    hasFulfillableLine = true;
                    recordIsChanged = true;
                } catch (line_err) {
                    Helper.log(logTitle, '...removed: ' + vc_util.extractError(line_err));
                    Helper.removeFulfillmentLine({ record: record, line: line });
                    recordIsChanged = true;
                }
            }

            // skip the order if no fulfillable items
            if (!hasFulfillableLine) throw 'NO_FULFILLABLES';

            ///////////////////////////////////////////////////////////////////
            /// BUILD a list of unique items with their total quantities shipped for this shipment
            var UniqueLineItems = [];
            Helper.log(logTitle, '**** Collect all items to fulfill ****');

            linesToFulfill.forEach(function (lineData) {
                var currentItem = {
                    order_num: orderNum,
                    item_num: lineData.item_num,
                    order_date: lineData.order_date,
                    order_eta: lineData.order_eta,
                    ship_date: lineData.ship_date,
                    carrier: lineData.carrier,
                    ship_qty: parseInt(lineData.ship_qty || '0', 10) || 0,
                    totalShipped: parseInt(lineData.ship_qty || '0', 10) || 0,
                    all_tracking_nums: Helper.uniqueList({ value: lineData.tracking_num }),
                    all_serial_nums: Helper.uniqueList({ value: lineData.serial_num })
                };
                Helper.log(logTitle, '... current item: ', currentItem);

                var matchingLine = Helper.findMatchingItem({
                    data: lineData,
                    dataSet: UniqueLineItems,
                    fieldToTest: 'item_num'
                });

                if (!matchingLine) {
                    // not yet on the unique line items
                    UniqueLineItems.push(currentItem);
                    return;
                }

                for (var i = 0; i < UniqueLineItems.length; i++) {
                    var uniqItem = UniqueLineItems[i];
                    if (uniqItem.item_num !== lineData.item_num) continue;

                    // update the total shipped qty
                    uniqItem.totalShipped += lineData.ship_qty * 1;

                    // update tracking num list
                    var tmpTrackList = Helper.uniqueList({ value: lineData.tracking_num });
                    if (!vc_util.isEmpty(uniqItem.all_tracking_nums)) {
                        tmpTrackList += '\n' + uniqItem.all_tracking_nums;
                    }
                    uniqItem.all_tracking_nums = Helper.uniqueList({
                        value: tmpTrackList,
                        splitStr: '\n'
                    });

                    // update the serials list
                    var tmpSerialList = Helper.uniqueList({ value: lineData.serial_num });

                    if (!vc_util.isEmpty(uniqItem.all_serial_nums)) {
                        tmpTrackList += '\n' + uniqItem.all_serial_nums;
                    }
                    uniqItem.all_serial_nums = Helper.uniqueList({
                        value: tmpSerialList,
                        splitStr: '\n'
                    });
                }
            });
            Helper.log(logTitle, '// UniqueLineItems', UniqueLineItems);

            ///////////////////////////////////////////////////////////////////
            /// VALIDATE the fulfillment line items
            lineItemCount = record.getLineCount({ sublistId: 'item' });
            Helper.log(logTitle, '**** VALIDATE Fulfillment Lines ****');

            for (line = 0; line < lineItemCount; line++) {
                record.selectLine({ sublistId: 'item', line: line });
                lineFFData = {
                    lineNo: line,
                    item: record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: vc_constants.GLOBAL.ITEM_FUL_ID_LOOKUP_COL
                    }),
                    quantity: record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    }),
                    isReceived: record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive'
                    }),
                    vendorSKU: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                        ? record.getCurrentSublistValue({
                              sublistId: 'item',
                              fieldId: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                          })
                        : '',
                    line_po: record.getSublistText({
                        sublistId: 'item',
                        fieldId: 'poline',
                        line: line
                    }),
                    dandh: record.getSublistText({
                        sublistId: 'item',
                        fieldId: vc_constants.FIELD.ITEM.DH_MPN,
                        line: line
                    }),
                    isSerialized: record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'isserial'
                    }),
                    isInvDetailReqd: record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'inventorydetailreq'
                    })
                };
                lineFFData.quantity = parseInt(lineFFData.quantity || '0', 10);
                Helper.log(logTitle, '... current line: ', lineFFData);

                if (!lineFFData.isReceived) {
                    Helper.log(logTitle, '... >> skipping: not received ');
                    Helper.setLineValues({
                        record: record,
                        values: { itemreceive: false },
                        doCommit: true
                    });
                    continue;
                }

                for (var ii = 0; ii < UniqueLineItems.length; ii++) {
                    var itemToShip = UniqueLineItems[ii];

                    var isMatchingLine =
                        lineFFData.item == itemToShip.item_num ||
                        (lineFFData.vendorSKU && lineFFData.vendorSKU == itemToShip.vendorSKU) ||
                        (lineFFData.dandh &&
                            Current.VendorCFG.xmlVendor == vc_constants.LIST.XML_VENDOR.DandH &&
                            lineFFData.dandh == itemToShip.item_num);

                    if (!isMatchingLine) continue;
                    Helper.log(logTitle, '... item to ship ', itemToShip);

                    ////////////////////////////////////////////
                    /// Skip: if total Shipped is empty /////
                    if (itemToShip.totalShipped == 0) {
                        Helper.log(logTitle, '...... skipped: no more items left to ship. ');

                        Helper.setLineValues({
                            record: record,
                            values: { itemreceive: false },
                            doCommit: true
                        });
                        recordIsChanged = true;
                        continue;
                    }

                    ////////////////////////////////////////////
                    // Skip: if the available quantity is less
                    if (lineFFData.quantity < itemToShip.ship_qty) {
                        Helper.log(logTitle, '...... skipped: rem qty is less than required ship qty. ');
                        Helper.setLineValues({
                            record: record,
                            values: { itemreceive: false },
                            doCommit: true
                        });
                        recordIsChanged = true;
                        continue;
                    }

                    ////////////////////////////////////////////
                    // Skip: if the available quantity is less
                    if (lineFFData.quantity < itemToShip.totalShipped) {
                        Helper.log(logTitle, '...... skipped: available qty is less. ');
                        Helper.setLineValues({
                            record: record,
                            values: { itemreceive: false },
                            doCommit: true
                        });
                        recordIsChanged = true;
                        continue;
                    }

                    var itemffValues = {
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
                        custcol_ctc_vc_order_placed_date: Helper.parseDate({
                            dateString: itemToShip.order_date
                        }),
                        custcol_ctc_vc_shipped_date: Helper.parseDate({
                            dateString: itemToShip.ship_date
                        })
                    };

                    ///////////////////////////////////////////////
                    Helper.setLineValues({ record: record, values: itemffValues });
                    ///////////////////////////////////////////////
                }
            }
        } catch (error) {
        } finally {
            log.debug(logTitle, vc_util.getUsage() + '############ ITEM FULFILLMENT CREATION: END ############');
        }

        return returnValue;
    };

    //// OLD FUNCTION //////////////////
    ItemFFLib.updateItemFulfillments = function (option) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::');
        Current.Script = ns_runtime.getCurrentScript();
        log.debug(logTitle, '############ ITEM FULFILLMENT CREATION: START ############');

        try {
            Current.Features = {
                MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })
            };

            Current.MainCFG = option.mainConfig;
            Current.VendorCFG = option.vendorConfig;
            Current.PO_ID = option.poId || option.recPurchOrd.id;
            Current.SO_ID = option.soId || option.recSalesOrd.id;
            LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';
            Current.Vendor = option.vendor;

            log.debug(logTitle, LogPrefix + '// CURRENT: ' + JSON.stringify(Current));

            Current.OrderLines = option.lineData;

            log.debug(logTitle, LogPrefix + '/// order lines: ' + JSON.stringify(Current.OrderLines));

            Current.SO_REC = option.recSalesOrd;
            Current.PO_REC = option.recPurchOrd;

            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.VendorCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (vc_util.isEmpty(Current.OrderLines)) throw 'Empty Line Data';

            if (!Helper.validateDate()) throw 'Invalid PO Date';

            Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw 'Config Error: Missing Fulfillment Prefix';

            // sort the line data
            var OrderLines = Helper.sortLineData(Current.OrderLines);

            var arrOrderNums = [],
                arrVendorOrderNums = [],
                i,
                ii,
                iii;

            var responseData = [],
                OrigLogPrefix = LogPrefix;

            ///////////////////////////////////////////////////
            // Collect unique the Item Fulfillment orders from the response
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + ('**** Looking for unique orders: ' + OrderLines.length)
            );
            for (i = 0; i < OrderLines.length; i++) {
                LogPrefix = OrigLogPrefix + ('[' + OrderLines[i].order_num + '] ');

                if (vc_util.inArray(OrderLines[i].order_num, arrOrderNums)) continue;

                if (!OrderLines[i].order_num || OrderLines[i].order_num == 'NA') {
                    log.audit(logTitle, vc_util.getUsage() + LogPrefix + '......skipped: no item order num');
                    continue;
                }

                if (OrderLines[i].hasOwnProperty('is_shipped') && OrderLines[i].is_shipped === false) {
                    log.audit(logTitle, vc_util.getUsage() + LogPrefix + '......skipped: not yet shipped');

                    continue;
                }

                if (OrderLines[i].hasOwnProperty('ns_record') && OrderLines[i].ns_record) {
                    log.audit(
                        logTitle,
                        vc_util.getUsage() + (LogPrefix + '......skipped: fulfillment already exists.')
                    );
                    continue;
                }

                OrderLines[i].ship_qty = parseInt(OrderLines[i].ship_qty || '0', 10);
                OrderLines[i].vendorOrderNum = Current.NumPrefix + OrderLines[i].order_num;

                log.audit(logTitle, vc_util.getUsage() + LogPrefix + '......added order.');
                arrOrderNums.push(OrderLines[i].order_num);
                arrVendorOrderNums.push(Current.NumPrefix + OrderLines[i].order_num);
            }
            LogPrefix = OrigLogPrefix;
            log.debug(
                logTitle,
                vc_util.getUsage() +
                    LogPrefix +
                    ('>> Fulfillment Order Nums: ' + JSON.stringify([arrOrderNums, arrVendorOrderNums]))
            );

            //// PRE-SEARCH of existing IFS ///
            var arrExistingIFS = Helper.findExistingOrders({ orderNums: arrVendorOrderNums });
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + ('>> arrExistingIFS: ' + JSON.stringify(arrExistingIFS))
            );

            ///////////////////////////////////////////////////
            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            for (i = 0; i < arrOrderNums.length; i++) {
                var orderNum = arrOrderNums[i],
                    vendorOrderNum = Current.NumPrefix + orderNum;

                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';

                log.debug(
                    logTitle,
                    vc_util.getUsage() + (LogPrefix + '****** PROCESSING ORDER [' + vendorOrderNum + '] ******')
                );
                var LinesToFulfill = [];

                try {
                    /// check if order exists //////////////////
                    if (vc_util.inArray(vendorOrderNum, arrExistingIFS)) throw 'Order already exists';

                    // Build an array with all XML line data with the same order num
                    for (ii = 0; ii < OrderLines.length; ii++) {
                        if (orderNum != OrderLines[ii].order_num) continue;
                        LinesToFulfill.push(OrderLines[ii]);
                    }

                    if (!LinesToFulfill.length) throw 'No items to fulfill';

                    var defaultItemFFValues = {};
                    if (Current.Features.MULTISHIPTO) {
                        var defaultShipGroup = Helper.getShipGroup({
                            recSalesOrd: Current.SO_REC,
                            recPurchOrd: Current.PO_REC
                        });
                        if (defaultShipGroup) {
                            defaultItemFFValues.shipgroup = defaultShipGroup;
                        }
                    }

                    ///////////////////////////////////////////////
                    var record;

                    try {
                        // create item fulfillment from sales order
                        record = ns_record.transform({
                            fromType: ns_record.Type.SALES_ORDER,
                            fromId: Current.SO_ID,
                            toType: ns_record.Type.ITEM_FULFILLMENT,
                            isDynamic: true,
                            defaultValues: defaultItemFFValues
                        });
                        log.debug(logTitle, vc_util.getUsage() + LogPrefix + '// transform success.');
                    } catch (transform_err) {
                        Helper.logMsg({
                            title: 'Transform Error on SO: ' + Current.SO_ID,
                            error: transform_err
                        });
                        throw 'Transform error on SO: ' + vc_util.extractError(transform_err);
                    }

                    var recordIsChanged = false;
                    var lineItemCount = record.getLineCount({ sublistId: 'item' });

                    /// REMOVE any items that is not in the XML  Line Data /////////////
                    var hasFulfillableLine = false,
                        fulfillableLines = [],
                        matchingLine,
                        line,
                        lineFFData;

                    for (line = 0; line < lineItemCount; line++) {
                        // fetch line item data

                        lineFFData = {
                            line: line,
                            item_num: record.getSublistText({
                                sublistId: 'item',
                                fieldId: vc_constants.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                line: line
                            }),
                            skuName: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                ? record.getSublistText({
                                      sublistId: 'item',
                                      fieldId: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL,
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
                                fieldId: vc_constants.FIELD.ITEM.DH_MPN,
                                line: line
                            }),
                            quantity: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: line
                            }),
                            CURRENTPO: Current.PO_ID
                        };

                        log.debug(
                            logTitle,
                            vc_util.getUsage() + (LogPrefix + '*** fulfillment line:  ' + JSON.stringify(lineFFData))
                        );

                        /// REMOVE lines from different POs
                        if (lineFFData.item_po != Current.PO_ID) {
                            log.debug(logTitle, vc_util.getUsage() + LogPrefix + '.... removed: not same PO ');
                            Helper.removeFulfillmentLine({ record: record, line: line });
                            recordIsChanged = true;
                        }

                        /// REMOVE lines thats not from the list
                        matchingLine = Helper.findMatchingItem({
                            data: lineFFData,
                            dataSet: LinesToFulfill
                        });

                        if (!matchingLine) {
                            log.debug(
                                logTitle,
                                vc_util.getUsage() + (LogPrefix + '.... removed: line item not found.')
                            );
                            Helper.removeFulfillmentLine({ record: record, line: line });
                            recordIsChanged = true;
                        } else {
                            log.debug(
                                logTitle,
                                vc_util.getUsage() + (LogPrefix + '.... adding line to item fulfillment.')
                            );
                            Helper.addFulfillmentLine({ record: record, line: line });
                            fulfillableLines.push(lineFFData);

                            hasFulfillableLine = true;
                            recordIsChanged = true;
                        }
                    }
                    //////////////////////////////////////////////////////////////////////

                    // skip the order if no fulfillable items
                    if (!hasFulfillableLine) throw 'No fulfillable lines';

                    //////////////////////////////////////////////////////////////////////
                    // Build a list of unique items with their total quantities shipped for this shipment
                    var UniqueLineItems = [];
                    log.debug(logTitle, vc_util.getUsage() + LogPrefix + '**** Collect all items to fulfill ****');
                    for (ii = 0; ii < LinesToFulfill.length; ii++) {
                        var lineToFulfill = LinesToFulfill[ii];

                        var currentItem = {
                            order_num: orderNum,
                            item_num: lineToFulfill.item_num,
                            order_date: lineToFulfill.order_date,
                            order_eta: lineToFulfill.order_eta,
                            ship_date: lineToFulfill.ship_date,
                            carrier: lineToFulfill.carrier,
                            ship_qty: parseInt(lineToFulfill.ship_qty || '0', 10) || 0,
                            totalShipped: parseInt(lineToFulfill.ship_qty || '0', 10) || 0,
                            all_tracking_nums: Helper.uniqueList({
                                value: lineToFulfill.tracking_num
                            }),
                            all_serial_nums: Helper.uniqueList({
                                value: lineToFulfill.serial_num
                            })
                        };
                        log.debug(
                            logTitle,
                            vc_util.getUsage() + (LogPrefix + '>>... currentItem: ' + JSON.stringify(currentItem))
                        );

                        matchingLine = Helper.findMatchingItem({
                            data: lineToFulfill,
                            dataSet: UniqueLineItems,
                            fieldToTest: 'item_num'
                        });

                        if (!matchingLine) {
                            UniqueLineItems.push(currentItem);
                            continue;
                        }

                        for (iii = 0; iii < UniqueLineItems.length; iii++) {
                            if (LinesToFulfill[ii].item_num !== UniqueLineItems[iii].item_num) continue;

                            UniqueLineItems[iii].totalShipped += LinesToFulfill[ii].ship_qty * 1;

                            var tmpTrackList = Helper.uniqueList({
                                value: LinesToFulfill[ii].tracking_num
                            });
                            if (!vc_util.isEmpty(UniqueLineItems[iii].all_tracking_nums)) {
                                tmpTrackList += '\n' + UniqueLineItems[iii].all_tracking_nums;
                            }
                            UniqueLineItems[iii].all_tracking_nums = Helper.uniqueList({
                                value: tmpTrackList,
                                splitStr: '\n'
                            });

                            var tmpSerialList = Helper.uniqueList({
                                value: LinesToFulfill[ii].serial_num
                            });
                            if (!vc_util.isEmpty(UniqueLineItems[iii].all_serial_nums)) {
                                tmpTrackList += '\n' + UniqueLineItems[iii].all_serial_nums;
                            }
                            UniqueLineItems[iii].all_serial_nums = Helper.uniqueList({
                                value: tmpSerialList,
                                splitStr: '\n'
                            });

                            log.debug(
                                logTitle,
                                vc_util.getUsage() +
                                    (LogPrefix +
                                        ' ... updated unique item data - ' +
                                        JSON.stringify([UniqueLineItems.length, UniqueLineItems[iii]]))
                            );
                            // break;
                        }
                    }

                    var lineItemFFCount = record.getLineCount({ sublistId: 'item' });
                    var recordLines = [];
                    log.debug(
                        logTitle,
                        vc_util.getUsage() + (LogPrefix + '**** START ITEM FULFILLMENT LINES VALIDATION ****')
                    );

                    // loop through all items in item fulfillment
                    for (line = 0; line < lineItemFFCount; line++) {
                        record.selectLine({ sublistId: 'item', line: line });

                        lineFFData = {
                            lineNo: line,
                            item: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: vc_constants.GLOBAL.ITEM_FUL_ID_LOOKUP_COL
                            }),
                            quantity: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity'
                            }),
                            isReceived: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'itemreceive'
                            }),
                            vendorSKU: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                ? record.getCurrentSublistValue({
                                      sublistId: 'item',
                                      fieldId: vc_constants.GLOBAL.VENDOR_SKU_LOOKUP_COL
                                  })
                                : '',
                            line_po: record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'poline',
                                line: line
                            }),
                            dandh: record.getSublistText({
                                sublistId: 'item',
                                fieldId: vc_constants.FIELD.ITEM.DH_MPN,
                                line: line
                            }),
                            isSerialized: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'isserial'
                            }),
                            isInvDetailReqd: record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'inventorydetailreq'
                            })
                        };
                        lineFFData.quantity = parseInt(lineFFData.quantity || '0', 10);
                        log.debug(
                            logTitle,
                            vc_util.getUsage() + (LogPrefix + '>> current line: ' + JSON.stringify(lineFFData))
                        );

                        if (!lineFFData.isReceived) {
                            log.debug(logTitle, vc_util.getUsage() + (LogPrefix + '....skipping: not received.'));
                            Helper.setLineValues({
                                record: record,
                                values: { itemreceive: false },
                                doCommit: true
                            });
                            continue;
                        }

                        for (ii = 0; ii < UniqueLineItems.length; ii++) {
                            var itemToShip = UniqueLineItems[ii];

                            log.debug(
                                logTitle,
                                vc_util.getUsage() + (LogPrefix + '>> item to ship ? ' + JSON.stringify(itemToShip))
                            );

                            if (
                                lineFFData.item == itemToShip.item_num ||
                                (lineFFData.vendorSKU && lineFFData.vendorSKU == itemToShip.vendorSKU) ||
                                (lineFFData.dandh &&
                                    Current.VendorCFG.xmlVendor == vc_constants.LIST.XML_VENDOR.DandH &&
                                    lineFFData.dandh == itemToShip.item_num)
                            ) {
                                log.debug(logTitle, vc_util.getUsage() + (LogPrefix + '....selected'));

                                var itemffValues = {
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
                                    log.debug(
                                        logTitle,
                                        vc_util.getUsage() + (LogPrefix + '>> skipped: no more items left to ship.')
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
                                // don't allow fulfillment if the available quantity is less
                                if (lineFFData.quantity < itemToShip.ship_qty) {
                                    log.debug(
                                        logTitle,
                                        vc_util.getUsage() +
                                            LogPrefix +
                                            '>> skipped: remaining quantity is less than required ship quantity. ' +
                                            JSON.stringify({
                                                qty: lineFFData.quantity,
                                                ship_qty: itemToShip.ship_qty
                                            })
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
                                // don't allow fulfillment if the available quantity is less
                                if (lineFFData.quantity < itemToShip.totalShipped) {
                                    itemffValues.quantity = lineFFData.quantity;

                                    Helper.setLineValues({
                                        record: record,
                                        values: { itemreceive: false },
                                        doCommit: true
                                    });
                                    recordIsChanged = true;
                                    continue;
                                }

                                ///////////////////////////////////////////////
                                Helper.setLineValues({ record: record, values: itemffValues });
                                ///////////////////////////////////////////////

                                //// SERIALS DETECTION ////////////////
                                var arrSerials = itemToShip.all_serial_nums
                                    ? itemToShip.all_serial_nums.split(/\n/)
                                    : [];

                                log.debug(
                                    logTitle,
                                    vc_util.getUsage() + (LogPrefix + '... serials: ' + JSON.stringify(arrSerials))
                                );

                                record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ctc_xml_serial_num',
                                    value: arrSerials.join('\n').substr(0, _TEXT_AREA_MAX_LENGTH)
                                });

                                UniqueLineItems[ii].totalShipped -= lineFFData.quantity;
                                recordLines.push({
                                    item_num: lineFFData.item,
                                    totalShipped: lineFFData.quantity,
                                    order_num: itemToShip.order_num,
                                    order_date: itemToShip.order_date,
                                    order_eta: itemToShip.order_eta,
                                    ship_date: itemToShip.ship_date,
                                    carrier: itemToShip.carrier,
                                    all_serial_nums: arrSerials.join('\n')
                                });

                                if (
                                    lineFFData.isSerialized === 'T' &&
                                    arrSerials.length &&
                                    Helper.validateSerials({ serials: arrSerials })
                                ) {
                                    var currentLocation = record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'location'
                                    });

                                    if (!currentLocation)
                                        Helper.setLineLocation({
                                            record: record,
                                            recSO: Current.SO_REC
                                        });

                                    var resultSerials = Helper.addNativeSerials({
                                        record: record,
                                        serials: arrSerials
                                    });

                                    if (!resultSerials) {
                                        // do not clear location as some fulfillments fail when there is more than one loc
                                        // blanks are counted as another location

                                        // only prevent inventory detail from being required after location changes
                                        record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'inventorydetailreq',
                                            value: lineFFData.isInvDetailReqd
                                        });
                                    }
                                }
                            } else log.audit(logTitle, vc_util.getUsage() + LogPrefix + '...skipped.');
                        }
                        record.commitLine({ sublistId: 'item' });
                        recordIsChanged = true;
                    }

                    log.debug(
                        logTitle,
                        vc_util.getUsage() + (LogPrefix + '>> recordLines: ' + JSON.stringify(recordLines))
                    );

                    if (vc_util.isEmpty(recordLines)) {
                        Helper.logMsg({
                            title: 'Fulfillment Lines',
                            message: '>> No Matching Lines To Fulfill:  ' + vendorOrderNum
                        });

                        continue;
                    }

                    Helper.logMsg({
                        title: 'Fulfillment Lines',
                        message: Helper.printerFriendlyLines({ recordLines: recordLines })
                    });

                    /*** Start Clemen - Package ***/
                    var arrAllTrackingNumbers = [];
                    try {
                        for (ii = 0; ii < UniqueLineItems.length; ii++) {
                            var strTrackingNums = UniqueLineItems[ii].all_tracking_nums;

                            if (!vc_util.isEmpty(strTrackingNums)) {
                                var arrTrackingNums = strTrackingNums.split('\n');
                                arrAllTrackingNumbers = arrAllTrackingNumbers.concat(arrTrackingNums);
                            }
                        }
                        log.debug(
                            logTitle,
                            vc_util.getUsage() +
                                (LogPrefix + '/// arrAllTrackingNumbers: ' + JSON.stringify(arrAllTrackingNumbers))
                        );

                        if (!vc_util.isEmpty(arrAllTrackingNumbers)) {
                            record = Helper.addNativePackages({
                                record: record,
                                trackingnumbers: arrAllTrackingNumbers
                            });
                        }

                        log.debug(
                            logTitle,
                            vc_util.getUsage() +
                                (LogPrefix +
                                    '/// Package line count = ' +
                                    record.getLineCount({ sublistId: 'package' }))
                        );
                    } catch (package_error) {
                        log.error(
                            logTitle,
                            vc_util.getUsage() +
                                (LogPrefix +
                                    '/// PACKAGE ERROR: ' +
                                    vc_util.extractError(package_error) +
                                    ('|  Details: ' + JSON.stringify(package_error)))
                        );

                        Helper.logMsg({
                            error: package_error,
                            title: 'Set Package Error'
                        });
                    }
                    /*** End Clemen - Package ***/

                    if (Current.Features.MULTILOCINVT) {
                        // set on the same location
                        Helper.setSameLocation({ record: record });
                    }

                    try {
                        var objId;

                        if (recordIsChanged) {
                            if (vc_constants.GLOBAL.PICK_PACK_SHIP) {
                                record.setValue({ fieldId: 'shipstatus', value: 'C' });
                            }

                            record.setValue({
                                fieldId: 'custbody_ctc_if_vendor_order_match',
                                value: vendorOrderNum,
                                ignoreFieldChange: true
                            });

                            log.debug(
                                logTitle,
                                vc_util.getUsage() +
                                    (LogPrefix + '**** ITEM FULFILLMENT CREATION ****' + JSON.stringify(recordLines))
                            );

                            objId = record.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });

                            responseData.push({ id: objId, orderNum: orderNum });
                        } else {
                            objId = record.id;
                            responseData.push({ id: objId, orderNum: orderNum });
                        }

                        log.debug(
                            logTitle,
                            vc_util.getUsage() +
                                LogPrefix +
                                ('## Created Item Fulfillment: [itemfulfillment:' + objId + ']')
                        );

                        Helper.logMsg({
                            title: 'Create Fulfillment',
                            isSuccess: true,
                            message: '## Created Item Fulfillment: [itemfulfillment:' + objId + ']'
                        });
                    } catch (itemff_err) {
                        var errMsg = vc_util.extractError(itemff_err);
                        log.error(
                            logTitle,
                            vc_util.getUsage() +
                                LogPrefix +
                                ('## Fulfillment Creation Error:  ' + errMsg) +
                                ('|  Details: ' + JSON.stringify(itemff_err))
                        );

                        Helper.logMsg({
                            error: itemff_err,
                            title: 'Create Fulfillment Error'
                        });
                        throw errMsg;
                    }
                } catch (line_err) {
                    log.audit(logTitle, vc_util.getUsage() + LogPrefix + '>> skipped: ' + JSON.stringify(line_err));
                    continue;
                }
            }
            return responseData;
        } catch (error) {
            var errorMsg = vc_util.extractError(error);
            log.error(
                logTitle,
                vc_util.getUsage() + (LogPrefix + '## ERROR:  ') + (errorMsg + '| Details: ' + JSON.stringify(error))
            );
            Helper.logMsg({ title: logTitle + ':: Error', error: error });
            return false;
        } finally {
            log.debug(logTitle, vc_util.getUsage() + '############ ITEM FULFILLMENT CREATION: END ############');
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
            arrList = vc_util.uniqueArray(arrList);

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
                            dateStr = [convertedMonth || dateComponents[1], dateComponents[0], dateComponents[2]].join(
                                '/'
                            );
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
            log.audit(logTitle, vc_util.getUsage() + LogPrefix + '>> option: ' + JSON.stringify(option));

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
                    orderDetails += '\n   Ship Date: ' + line.ship_date;
                    orderDetails += '\n   Carrier  : ' + line.carrier;
                }

                outputString += 'Item Num    : ' + line.item_num;
                outputString += '\n   Qty    : ' + line.totalShipped;
                var serials;
                if (typeof line.all_serial_nums == 'string') serials = line.all_serial_nums;
                else if (typeof line.all_serial_nums == 'object') serials = line.all_serial_nums.join(',');
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
            return log[logtype](title, vc_util.getUsage() + LogPrefix + content);
        },
        logMsg: function (option) {
            option = option || {};

            var LOG_STATUS = vc_constants.LIST.VC_LOG_STATUS;

            var logOption = {
                transaction: Current.PO_ID,
                header: ['Fulfillment', option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? vc_util.extractError(option.error) : option.errorMsg),

                status:
                    option.status ||
                    (option.error ? LOG_STATUS.ERROR : option.isSuccess ? LOG_STATUS.SUCCESS : LOG_STATUS.INFO)
            };

            log.audit(LogTitle, LogPrefix + '::' + JSON.stringify(logOption));
            vc_log.recordLog(logOption);
            return true;
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
                vc_util.getUsage() +
                    LogPrefix +
                    '>> Valid Serials: ' +
                    JSON.stringify([validSerialList.length, validSerialList])
            );

            return validSerialList.length ? validSerialList : false;
        },
        // Added by Clemen - 04/28/2022
        addNativeSerials: function (option) {
            var logTitle = [LogTitle, 'addNativeSerials'].join('::'),
                logPrefix = LogPrefix + '// Set Inventory Details: ';

            var ifRec = option.record;
            var validSerialList = this.validateSerials(option);
            if (!validSerialList) return;

            var inventoryDetailRecord = ifRec.getCurrentSublistSubrecord({
                sublistId: 'item',
                fieldId: 'inventorydetail'
            });

            log.audit(logTitle, logPrefix + ' //setting up serials...');

            var addedSerials = [];
            for (var i = 0; i < validSerialList.length; i++) {
                if (!validSerialList[i] || validSerialList[i] == 'NA') continue;

                try {
                    inventoryDetailRecord.selectLine({
                        sublistId: 'inventoryassignment',
                        line: i
                    });

                    inventoryDetailRecord.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        value: validSerialList[i]
                    });
                    inventoryDetailRecord.commitLine({
                        sublistId: 'inventoryassignment'
                    });
                    // log.audit(logTitle, logPrefix + '...added serial no: ' + validSerialList[i]);

                    addedSerials.push(validSerialList[i]);
                } catch (serial_error) {
                    log.error(logTitle, vc_util.getUsage() + LogPrefix + '## ERROR ## ' + JSON.stringify(serial_error));
                }
            }

            log.audit(
                logTitle,
                LogPrefix +
                    ' >> done <<' +
                    JSON.stringify({
                        length: addedSerials.length,
                        serials: addedSerials
                    })
            );

            return true;
        },
        addNativePackages: function (data) {
            var ifRec = data.record;
            var arrTrackingNums = data.trackingnumbers;
            log.audit('Create-ItemFF::addNativePackages', '>> Tracking Nums List: ' + JSON.stringify(arrTrackingNums));

            if (!vc_util.isEmpty(arrTrackingNums)) {
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
                    } catch (e) {
                        log.error('Create-ItemFF::addNativePackages', 'Error adding package line.');
                    }
                }
            }

            log.audit(
                'Create-ItemFF::addNativePackages',
                '>> ifRec: ' + JSON.stringify(ifRec.getSublist({ sublistId: 'package' }))
            );
            return ifRec;
        },
        setLineLocation: function (option) {
            var logTitle = [LogTitle, 'setLineLocation'].join('::');

            var record = option.record,
                recSO = option.recSO;

            var lineData = {
                item: record.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                }),
                location: record.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location'
                })
            };
            log.audit(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> currrent item/location: ' + JSON.stringify(lineData)
            );

            var lineLoc;

            if (vc_util.isEmpty(lineData.location)) {
                //Use SO's header level Location
                lineLoc = recSO.getValue({
                    fieldId: 'location'
                });

                log.audit(logTitle, vc_util.getUsage() + LogPrefix + '>> SO Location - ' + JSON.stringify(lineLoc));

                // set the line item
                if (lineLoc) {
                    record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: lineLoc
                    });
                }
            }

            // check if the location isempty
            lineLoc = record.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'location'
            });

            log.audit(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> Line Location : after: ' + JSON.stringify(lineLoc)
            );

            return record;
        },
        setSameLocation: function (option) {
            var logTitle = [LogTitle, 'setSameLocation'].join('::'),
                logPrefix = LogPrefix + '//SET SAME LOCATION: ';

            var record = option.record;

            // get location from line items
            var arrLocation = [];
            var lineCount = record.getLineCount({ sublistId: 'item' }),
                line,
                itemData;

            log.audit(logTitle, logPrefix + '// total line count - ' + JSON.stringify(lineCount));
            for (line = 0; line < lineCount; line++) {
                itemData = {
                    item: record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: line
                    }),
                    location: record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: line
                    }),
                    location_text: record.getSublistText({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: line
                    })
                };

                if (!itemData.location || vc_util.inArray(itemData.location, arrLocation)) continue;
                arrLocation.push(itemData.location);
            }
            log.audit(logTitle, logPrefix + '// unique location: ' + JSON.stringify(arrLocation));

            if (!arrLocation || arrLocation.length > 1) {
                // just fetch the location from the SO

                if (Current.SO_REC) {
                    var orderLocation = Current.SO_REC.getValue({ fieldId: 'location' });
                    log.audit(logTitle, logPrefix + '// orderLocation: ' + JSON.stringify(orderLocation));
                    if (orderLocation) arrLocation = [orderLocation];
                }
            }
            if (!arrLocation || arrLocation.length > 1) return false;

            for (line = 0; line < lineCount; line++) {
                itemData = {
                    item: record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: line
                    }),
                    location: record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: line
                    })
                };

                log.audit(logTitle, vc_util.getUsage() + LogPrefix + '... item data: ' + JSON.stringify(itemData));

                // only set those who are empty, or not the same
                if (!itemData.location || itemData.location != arrLocation[0]) {
                    log.audit(logTitle, LogTitle + '... set line data to: ' + JSON.stringify(arrLocation));
                    record.selectLine({ sublistId: 'item', line: line });
                    record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: arrLocation[0]
                    });
                    record.commitLine({ sublistId: 'item', ignoreRecalc: true });
                }
            }

            return arrLocation;
        },
        getShipGroup: function (option) {
            var logTitle = [LogTitle, 'getShipGroup'].join('::'),
                recPurchOrd = option.recPurchOrd,
                recSalesOrd = option.recSalesOrd,
                shipgroup = null;
            if (recSalesOrd && recPurchOrd) {
                var poId = recPurchOrd.id;
                var line = recSalesOrd.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'createdpo',
                    value: poId
                });
                log.debug(logTitle, 'PO with id= ' + poId + ' found in line: ' + line);
                if (line >= 0) {
                    shipgroup = recSalesOrd.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'shipgroup',
                        line: line
                    });
                }
            }
            return shipgroup;
        },

        validateDate: function (option) {
            var logTitle = [LogTitle, 'validateDate'].join('::'),
                logPrefix = LogPrefix + ' validateDate || ',
                returnValue;
            option = option || {};

            try {
                if (!Current.PO_ID) throw 'Missing PO ID';
                if (!Current.VendorCFG) throw 'Missing Vendor Config';

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
                        values: Current.VendorCFG.startDate
                    })
                );

                returnValue = !!searchObj.runPaged().count;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc_util.extractError(error);
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
                    xmlVendor = Current.VendorCFG.xmlVendor,
                    vendorList = vc_constants.LIST.XML_VENDOR;

                var logPrefix = LogPrefix + ' [Item: ' + dataToTest.item_num + ']';
                var hasMatch = false;

                // log.audit(logTitle,  vc_util.getUsage() + LogPrefix + ' // isMatchingLine: ' + JSON.stringify(option));

                var LineItemCheck = {
                    ingramCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // ingramCheck:[' + itemType + ']: ',
                            returnValue = false;

                        try {
                            if (!dataToFind[itemType] || !dataToTest[itemType]) throw '[' + itemType + '] not present';

                            if (
                                !hashSpace &&
                                !vc_util.inArray(xmlVendor, [vendorList.INGRAM_MICRO_V_ONE, vendorList.INGRAM_MICRO])
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
                                !vc_util.inArray(dataToFind[itemType], [
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
                    }
                };

                ['item_num', 'sku_name'].forEach(function (fld) {
                    if (!hasMatch && (!fieldToTest || fieldToTest == fld)) {
                        hasMatch =
                            LineItemCheck.itemCheck(fld) ||
                            LineItemCheck.ingramCheck(fld) ||
                            LineItemCheck.dnhCheck(fld);
                    }
                    return true;
                });

                returnValue = hasMatch;
            } catch (error) {
                log.error(logTitle, vc_util.getUsage() + LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc_util.extractError(error);
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
                log.error(logTitle, vc_util.getUsage() + LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc_util.extractError(error);
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
                var listOrderNum = option.vendorOrderNums || option.orderNums;
                if (vc_util.isEmpty(listOrderNum)) return false;

                var searchOption = {
                    type: 'itemfulfillment',
                    filters: [['type', 'anyof', 'ItemShip'], 'AND', ['mainline', 'is', 'T']],
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
                    orderNumFilter.push(['custbody_ctc_if_vendor_order_match', ns_search.Operator.IS, orderNum]);
                    orderNumFilter.push('OR');
                    return true;
                });
                orderNumFilter.pop('OR');
                searchOption.filters.push(orderNumFilter);

                log.audit(
                    logTitle,
                    vc_util.getUsage() + LogPrefix + '>> searchOption: ' + JSON.stringify(searchOption)
                );

                var arrResults = [];
                var searchResults = vc_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                searchResults.forEach(function (result) {
                    var orderNum = result.getValue({ name: 'custbody_ctc_if_vendor_order_match' });

                    if (!vc_util.inArray(orderNum, arrResults)) {
                        arrResults.push(orderNum);
                    }

                    return true;
                });

                returnValue = arrResults;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc_util.extractError(error);
            } finally {
                // log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        removeFulfillmentLine: function (option) {
            var logTitle = [LogTitle, 'removeFulfillmentLine'].join('::'),
                logPrefix = LogPrefix + ' removeFulfillmentLine || ',
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
                throw vc_util.extractError(error);
            }

            return returnValue;
        },
        addFulfillmentLine: function (option) {
            var logTitle = [LogTitle, 'addFulfillmentLine'].join('::'),
                logPrefix = LogPrefix + ' addFulfillmentLine || ',
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
                throw vc_util.extractError(error);
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
                if (vc_util.isEmpty(option.values)) throw 'Missing values';

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

    return ItemFFLib;
});
