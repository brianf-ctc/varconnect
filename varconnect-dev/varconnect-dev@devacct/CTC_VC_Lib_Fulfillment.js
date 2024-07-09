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

    var vc2_constant = require('./CTC_VC2_Constants.js'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js'),
        vc_record = require('./CTC_VC_Lib_Record.js'),
        vc2_record = require('./CTC_VC2_Lib_Record.js'),
        vcs_configLib = require('./Services/ctc_svclib_configlib.js');

    var LogTitle = 'ItemFFLIB',
        LogPrefix = '',
        _TEXT_AREA_MAX_LENGTH = 4000;

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var Current = {
        DateFormat: null,
        PO_ID: null,
        SO_ID: null,
        OrderLines: null,
        MainCFG: null,
        OrderCFG: null,
        Vendor: null
    };

    var ItemFFLib = {};

    ItemFFLib.updateItemFulfillments = function (option) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::'),
            responseData;
        Current.Script = ns_runtime.getCurrentScript();
        vc2_util.log(logTitle, '############ ITEM FULFILLMENT CREATION: START ############');

        try {
            Current.Features = {
                MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' }),
                ENABLE_CROSS_SUB_FULFILLMENT: ns_runtime.isFeatureInEffect({
                    feature: 'crosssubsidiaryfulfillment'
                })
            };
            Current.PO_ID = option.poId || option.recPurchOrd.id;
            Current.SO_ID = option.soId || option.recSalesOrd.id;
            Current.Vendor = option.vendor;

            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            Current.MainCFG = option.mainConfig || vcs_configLib.mainConfig();
            Current.OrderCFG = option.orderConfig || vcs_configLib.orderVendorConfig({ poId: Current.PO_ID });

            LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';
            vc2_util.LogPrefix = LogPrefix;

            Current.OrderLines = option.lineData;
            Current.SO_REC = option.recSalesOrd;
            Current.PO_REC = option.recPurchOrd;

            vc2_util.log(
                logTitle,
                '// OrderLines: ',
                Current.OrderLines.length > 4 ? Current.OrderLines.length : Current.OrderLines
            );

            //////////////////////
            if (!Current.MainCFG) throw ERROR_MSG.MISSING_CONFIG;
            if (!Current.OrderCFG) throw ERROR_MSG.MISSING_VENDORCFG;
            if (!Current.PO_ID) throw ERROR_MSG.MISSING_PO;
            if (vc2_util.isEmpty(Current.OrderLines)) throw ERROR_MSG.MISSING_LINES;
            // if (!Helper.validateDate()) throw ERROR_MSG.INVALID_PODATE;

            Current.NumPrefix = Current.OrderCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw ERROR_MSG.MISSING_PREFIX;

            // sort the line data
            var OrderLines = Helper.sortLineData(Current.OrderLines);

            var arrOrderNums = [],
                arrVendorOrderNums = [],
                OrderLinesByNum = {},
                responseData = [],
                i,
                ii,
                iii;

            ///////////////////////////////////////////////////
            // Collect unique the Item Fulfillment orders from the response
            vc2_util.log(logTitle, '----- LOOK for unique orders -----');

            OrderLines.forEach(function (orderLine) {
                try {
                    if (!orderLine.order_num || orderLine.order_num == 'NA') throw ERROR_MSG.MISSING_ORDERNUM;

                    if (orderLine.hasOwnProperty('is_shipped') && orderLine.is_shipped === false)
                        throw ERROR_MSG.NOT_YET_SHIPPED;

                    if (orderLine.hasOwnProperty('ns_record') && orderLine.ns_record) throw ERROR_MSG.ORDER_EXISTS;

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
                        title: 'Fulfillment [' + orderLine.order_num + '] ',
                        error: order_error,
                        details: orderLine,
                        recordId: Current.PO_ID
                    });
                    return;
                }

                return true;
            });

            // vc2_util.log(logTitle, 'OrderLines', OrderLines);
            vc2_util.log(logTitle, '// Unique Orders', arrVendorOrderNums);
            vc2_util.log(logTitle, '// OrderLines By OrderNum', OrderLinesByNum);

            vc2_util.vcLog({
                title: 'Fulfillment',
                message: 'Orderlines By Ordernum',
                details: OrderLinesByNum,
                recordId: Current.PO_ID
            });

            if (vc2_util.isEmpty(arrVendorOrderNums)) throw ERROR_MSG.NO_ORDERS_TO_FULFILL;

            //// PRE-SEARCH of existing IFS ///
            var arrExistingIFS = Helper.findExistingOrders({ orderNums: arrVendorOrderNums });
            vc2_util.log(logTitle, '... existing IFs ', arrExistingIFS);

            ///////////////////////////////////////////////////
            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            var OrigLogPrefix = LogPrefix;

            for (var orderNum in OrderLinesByNum) {
                var vendorOrderNum = Current.NumPrefix + orderNum,
                    vendorOrderLines = OrderLinesByNum[orderNum];

                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';
                vc2_util.LogPrefix = LogPrefix;

                try {
                    vc2_util.log(logTitle, '**** PROCESSING Order [' + vendorOrderNum + '] ****');

                    if (vc2_util.inArray(vendorOrderNum, arrExistingIFS)) throw ERROR_MSG.ORDER_EXISTS;
                    // throw util.extend(ERROR_MSG.ORDER_EXISTS, { details: vendorOrderNum });

                    vc2_util.vcLog({
                        title: 'Fulfillment | Order Lines [' + vendorOrderNum + '] ',
                        message: vendorOrderLines,
                        recordId: Current.PO_ID
                    });

                    var defaultItemFFValues = {},
                        inventoryLocations = [],
                        successfulIFs = [];

                    if (Current.Features.MULTISHIPTO) {
                        var defaultShipGroup = Helper.getShipGroup({
                            recSalesOrd: Current.SO_REC,
                            recPurchOrd: Current.PO_REC
                        });
                        if (defaultShipGroup) {
                            defaultItemFFValues.shipgroup = defaultShipGroup;
                        }
                    }
                    if (Current.Features.ENABLE_CROSS_SUB_FULFILLMENT) {
                        inventoryLocations = Helper.getInventoryLocations({
                            recSalesOrd: Current.SO_REC,
                            recPurchOrd: Current.PO_REC
                        });
                    }
                    if (!inventoryLocations.length) {
                        inventoryLocations.push(null);
                    }

                    /// TRANSFORM recordfindMatchingVendorLine
                    for (
                        var locCtr = 0, locationCount = inventoryLocations.length;
                        locCtr < locationCount;
                        locCtr += 1
                    ) {
                        var defaultInventoryLocation = inventoryLocations[locCtr];
                        if (defaultInventoryLocation) {
                            defaultItemFFValues.inventorylocation = defaultInventoryLocation;
                        }
                        vc2_util.log(logTitle, '/// Start Transform Record ...', defaultInventoryLocation);
                        var recItemFF;
                        try {
                            recItemFF = vc2_record.transform({
                                fromType: ns_record.Type.SALES_ORDER,
                                fromId: Current.SO_ID,
                                toType: ns_record.Type.ITEM_FULFILLMENT,
                                isDynamic: true,
                                defaultValues: defaultItemFFValues
                            });
                        } catch (transformErr) {
                            vc2_util.logError(logTitle, transformErr);
                            recItemFF = null;
                        }
                        if (!recItemFF) {
                            if (defaultInventoryLocation) {
                                if (locCtr + 1 == locationCount && successfulIFs.length == 0) {
                                    inventoryLocations.push(null);
                                    locationCount += 1;
                                }
                                continue;
                            } else {
                                throw vc2_util.extend(ERROR_MSG.TRANSFORM_ERROR);
                            }
                        }

                        vc2_util.log(logTitle, '... record transform success');

                        ///////////////
                        var recordIsChanged,
                            lineFF,
                            line,
                            updateFFData = {},
                            recordLines = [],
                            arrFulfillableLines = [];

                        if (vc2_constant.GLOBAL.PICK_PACK_SHIP) {
                            updateFFData['shipstatus'] = 'C';
                            // recItemFF.setValue({ fieldId: 'shipstatus', value: 'C' });
                        }

                        var lineItemCount = recItemFF.getLineCount({ sublistId: 'item' });

                        vc2_util.log(logTitle, '/// VALIDATE orderlines/fulfillment lines..', lineItemCount);

                        var arrFFItems = [],
                            uniqueItemIds = [];
                        for (line = 0; line < lineItemCount; line++) {
                            var lineFFItem = vc2_record.extractLineValues({
                                record: recItemFF,
                                line: line,
                                columns: ['item']
                            });
                            arrFFItems.push(lineFFItem);
                            if (uniqueItemIds.indexOf(lineFFItem.item) == -1) {
                                uniqueItemIds.push(lineFFItem.item);
                            }
                        }
                        // get alt item name
                        var itemAltNameColId =
                            Current.OrderCFG.itemColumnIdToMatch || Current.MainCFG.itemColumnIdToMatch;

                        var itemMPNColId =
                            Current.OrderCFG.itemMPNColumnIdToMatch || Current.MainCFG.itemMPNColumnIdToMatch;

                        var lineCols = [
                                'item',
                                'sitemname',
                                'quantity',
                                'quantityremaining',
                                'itemreceive',
                                'poline',
                                'binitem',
                                'inventorydetailreq',
                                'isserial',
                                'createdpo',
                                'location',
                                vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                vc2_constant.FIELD.TRANSACTION.DH_MPN,
                                vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO
                            ],
                            altItemNames = vc2_record.extractAlternativeItemName({
                                item: uniqueItemIds,
                                mainConfig: Current.MainCFG,
                                orderConfig: Current.OrderCFG
                            }),
                            arrVendorItemNames = vc2_record.extractVendorItemNames({
                                lines: arrFFItems
                            });

                        if (itemAltNameColId) lineCols.push(itemAltNameColId);
                        if (itemMPNColId) lineCols.push(itemMPNColId);

                        for (line = 0; line < lineItemCount; line++) {
                            try {
                                lineFF = vc2_record.extractLineValues({
                                    record: recItemFF,
                                    line: line,
                                    columns: lineCols
                                });
                                lineFF.line = line;
                                lineFF.availqty = lineFF.quantityremaining;
                                lineFF[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                                    arrVendorItemNames[line][vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY];
                                lineFF = vc2_record.getAltPartNumValues({
                                    source: altItemNames,
                                    target: lineFF,
                                    orderConfig: Current.OrderCFG,
                                    mainConfig: Current.MainCFG
                                });
                                vc2_util.log(logTitle, '*** fulfillment line ***', lineFF);

                                // get the po lines values
                                if (lineFF.poline) {
                                    var poLineCols = [
                                        'item',
                                        vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                        vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                        vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO
                                    ];
                                    if (itemAltNameColId) {
                                        poLineCols.push(itemAltNameColId);
                                    }
                                    if (itemMPNColId) {
                                        poLineCols.push(itemMPNColId);
                                    }
                                    lineFF.poLineData = vc2_record.extractLineValues({
                                        record: Current.PO_REC,
                                        line: parseInt(lineFF.poline, 10) - 1,
                                        columns: poLineCols
                                    });
                                    // inherit po line values
                                    if (lineFF[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY]) {
                                        lineFF.poLineData[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                                            lineFF[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY];
                                    }
                                    lineFF.poLineData = vc2_record.getAltPartNumValues({
                                        source: altItemNames,
                                        target: lineFF.poLineData,
                                        orderConfig: Current.OrderCFG,
                                        mainConfig: Current.MainCFG
                                    });
                                    vc2_util.log(logTitle, '*** PO Line: ***', lineFF.poLineData);
                                }

                                lineFF.matchedVendorLines = [];
                                if (!lineFF.createdpo || lineFF.createdpo != Current.PO_ID) throw 'Not same PO';

                                // if (!lineFF.itemreceive) throw 'not yet received';

                                // find matching vendor line
                                var matchingVendorLine = Helper.findMatchingVendorLine({
                                    vendorLines: vendorOrderLines,
                                    orderLine: lineFF,
                                    mainConfig: Current.MainCFG,
                                    orderConfig: Current.OrderCFG
                                });

                                if (!matchingVendorLine) ERROR_MSG.LINE_NOT_MATCHED;

                                vc2_util.log(logTitle, '/// matched vendor line: ', matchingVendorLine);

                                if (!util.isArray(matchingVendorLine)) matchingVendorLine = [matchingVendorLine];

                                var totalQty = 0;
                                matchingVendorLine.forEach(function (vendorLine) {
                                    // skip this vendor line
                                    if (!vendorLine.ship_qty) return false;

                                    // check how many qty this vendor line can use
                                    var qtyToUse =
                                        vendorLine.AVAILQTY >= lineFF.availqty
                                            ? lineFF.availqty // this is our ceiling qty
                                            : vendorLine.AVAILQTY; // fulfill everything

                                    if (!qtyToUse) return false;

                                    totalQty += qtyToUse;

                                    vendorLine.AVAILQTY -= qtyToUse;
                                    vendorLine.APPLIEDLINES.push(lineFF.line + 1);

                                    lineFF.availqty -= qtyToUse;
                                    lineFF.matchedVendorLines.push(vendorLine);

                                    return true;
                                });

                                if (!totalQty) throw 'No quantity to fulfill';

                                // add to fulfillment
                                Helper.addFulfillmentLine({
                                    record: recItemFF,
                                    line: line,
                                    quantity: totalQty
                                });

                                // adjust the AVAILQTY
                                arrFulfillableLines.push(lineFF);
                                recordIsChanged = true;
                            } catch (line_error) {
                                vc2_util.logError(logTitle, line_error);
                                Helper.removeFulfillmentLine({ record: recItemFF, line: line });
                                recordIsChanged = true;
                            }
                        }

                        if (vc2_util.isEmpty(arrFulfillableLines))
                            throw util.extend(ERROR_MSG.NO_MATCHINGITEMS_TO_FULFILL, {
                                details: vendorOrderLines
                            });

                        /// CHECK for unfulfilled or over fulfilled vendor lines for this order /////////////
                        var fulfillError = [];
                        vendorOrderLines.forEach(function (vendorLine) {
                            if (vendorLine.AVAILQTY == 0) return false;
                            fulfillError.push(
                                '#' + ('Unfulfilled qty - ' + vendorLine.item_num) + (', qty: ' + vendorLine.ship_qty)
                            );
                            return true;
                        });

                        if (fulfillError && fulfillError.length) {
                            throw vc2_util.extend(ERROR_MSG.UNABLE_TO_FULFILL, {
                                details: fulfillError.join('\n')
                            });
                        }

                        //////////////////////
                        if (Current.Features.MULTILOCINVT) {
                            // set on the same location
                            Helper.setSameLocation({ record: recItemFF });
                        }

                        updateFFData.custbody_ctc_if_vendor_order_match = vendorOrderNum;
                        updateFFData.custbody_ctc_vc_createdby_vc = true;

                        ////////////////////////////////////
                        vc2_util.log(logTitle, '//// UPDATE fulfillment lines from vendor line data');
                        for (line = 0; line < lineItemCount; line++) {
                            try {
                                recItemFF.selectLine({ sublistId: 'item', line: line });
                                vc2_util.log(logTitle, '**** Selecting line #' + line + '****');

                                // get the matched fulfilled line
                                var matchedFFLine = vc2_util.findMatching({
                                    list: arrFulfillableLines,
                                    filter: { line: line },
                                    findAll: true
                                });

                                if (!matchedFFLine) {
                                    vc2_util.log(logTitle, '... Not fulfilled yet');
                                    continue;
                                }

                                matchedFFLine = matchedFFLine[0] || matchedFFLine;
                                vc2_util.log(logTitle, '.... fulfilled line', matchedFFLine);

                                var matchedVendorLine = matchedFFLine.matchedVendorLines;
                                if (!matchedVendorLine) throw 'No vendor lines found';

                                if (!util.isArray(matchedVendorLine)) matchedVendorLine = [matchedVendorLine];

                                // get the current value
                                var lineFFData = vc2_record.extractLineValues({
                                    record: recItemFF,
                                    line: line,
                                    columns: ['itemreceive', 'binitem', 'inventorydetailreq', 'isserial', 'location']
                                });

                                if (!lineFFData.itemreceive) {
                                    vc2_util.log(logTitle, '... not received');
                                    continue;
                                }

                                var updateLineValues = {},
                                    uniqVendorLine = {},
                                    allTrackingNum = '',
                                    allSerialNums = '',
                                    totalQty = 0,
                                    FFLineMap = vc_record.FieldMapping;

                                matchedVendorLine.forEach(function (vendorLine) {
                                    for (var fld in vendorLine) {
                                        var value = vendorLine[fld];
                                        uniqVendorLine[fld] = value;
                                    }

                                    totalQty += vendorLine.ship_qty;

                                    var tmpTrackingNos = Helper.uniqueList({
                                            value: vendorLine.tracking_num
                                        }),
                                        tmpSerialNos = Helper.uniqueList({
                                            value: vendorLine.serial_num
                                        });

                                    allTrackingNum = (allTrackingNum ? allTrackingNum + '\n' : '') + tmpTrackingNos;

                                    allSerialNums = (allSerialNums ? allSerialNums + '\n' : '') + tmpSerialNos;

                                    return true;
                                });
                                uniqVendorLine.all_tracking_nums = allTrackingNum;
                                uniqVendorLine.all_serial_nums = allSerialNums;
                                uniqVendorLine.totalShipped = totalQty;

                                vc2_util.log(logTitle, '// uniqVendorLine: ', uniqVendorLine);

                                // create the update fulfillment line
                                for (var col in FFLineMap.lineColumn) {
                                    var vendorCol = FFLineMap.lineColumn[col],
                                        orderValue = uniqVendorLine[vendorCol];
                                    if (vc2_util.isEmpty(orderValue)) continue;

                                    if (vc2_util.inArray(col, FFLineMap.columnType.DATE)) {
                                        // vc2_util.log(logTitle, '... skipping ', col);
                                        // continue;
                                        orderValue = vc_record.parseDate({
                                            dateString: orderValue
                                        });
                                    }
                                    updateLineValues[col] = orderValue;
                                }
                                updateLineValues.custcol_ctc_xml_tracking_num = allTrackingNum
                                    ? allTrackingNum.substr(0, _TEXT_AREA_MAX_LENGTH)
                                    : '';
                                updateLineValues.custcol_ctc_xml_serial_num = allSerialNums
                                    ? allSerialNums.substr(0, _TEXT_AREA_MAX_LENGTH)
                                    : '';

                                /// update the fulfillment trandate
                                if (
                                    (Current.OrderCFG.useShipDate == true || Current.OrderCFG.useShipDate == 'T') &&
                                    uniqVendorLine.ship_date &&
                                    uniqVendorLine.ship_date != 'NA'
                                ) {
                                    updateFFData['trandate'] = vc_record.parseDate({
                                        dateString: uniqVendorLine.ship_date
                                    });
                                }

                                /// UPDATE fulfillment lines
                                vc2_util.log(logTitle, '// updateLineValues: ', updateLineValues);
                                if (!vc2_util.isEmpty(updateLineValues)) {
                                    Helper.setLineValues({
                                        record: recItemFF,
                                        values: updateLineValues
                                    });
                                }
                                recItemFF.commitLine({ sublistId: 'item' });

                                ////////////////////////////////////
                                vc2_util.log(logTitle, '//// UPDATE fulfillment lines for Inventory Details');

                                // //// SERIALS DETECTION ////////////////
                                var arrSerials = allSerialNums ? allSerialNums.split(/\n/) : [];
                                vc2_util.log(logTitle, '... serials: ', arrSerials);

                                if (
                                    lineFFData.isserial === 'T' &&
                                    arrSerials.length &&
                                    Helper.validateSerials({ serials: arrSerials })
                                ) {
                                    var resultSerials;
                                    if (arrSerials.length == totalQty) {
                                        resultSerials = Helper.addNativeSerials({
                                            record: recItemFF,
                                            serials: arrSerials,
                                            line: line,
                                            doCommit: true
                                        });
                                    } else {
                                        throw util.extend(ERROR_MSG.INSUFFICIENT_SERIALS, {
                                            details: [
                                                'Quantity:' + totalQty,
                                                'Serials count: ' + arrSerials.length
                                            ].join(' ')
                                        });

                                        // if (!resultSerials || arrSerials.length != totalQty) {
                                        //     // only prevent inventory detail from being required after location changes
                                        //     // do not clear location as some fulfillments fail when there is more than one loc
                                        //     // blanks are counted as another location
                                        //     //
                                        //     recItemFF.setCurrentSublistValue({
                                        //         sublistId: 'item',
                                        //         fieldId: 'inventorydetailreq',
                                        //         value: lineFFData.inventorydetailreq
                                        //     });
                                        // }
                                    }
                                }
                                recordLines.push(uniqVendorLine);

                                recordIsChanged = true;
                            } catch (line_error) {
                                vc2_util.logError(logTitle, line_error);
                                vc2_util.vcLog({
                                    title: 'Fulfillment | Line Error',
                                    error: line_error,
                                    status: LOG_STATUS.RECORD_ERROR,
                                    recordId: Current.PO_ID
                                });

                                Helper.setLineValues({
                                    record: recItemFF,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                continue;
                            }
                        }

                        vc2_util.log(logTitle, ' ///  updateFFData', updateFFData);
                        if (!vc2_util.isEmpty(updateFFData)) {
                            for (var fld in updateFFData) {
                                recItemFF.setValue({ fieldId: fld, value: updateFFData[fld] });
                            }
                        }

                        ////////////////////
                        vc2_util.log(logTitle, '>> record lines', recordLines);
                        if (vc2_util.isEmpty(recordLines)) {
                            vc2_util.log(logTitle, '*** No lines to fulfill ****');
                            vc2_util.vcLog({
                                title: 'Fulfillment Lines',
                                message: 'No Matching Lines To Fulfill:  ' + vendorOrderNum,
                                recordId: Current.PO_ID
                            });
                            break;
                        }

                        /*** Start Clemen - Package ***/
                        var arrAllTrackingNumbers = [];
                        try {
                            for (var ii = 0; ii < recordLines.length; ii++) {
                                var strTrackingNums = recordLines[ii].all_tracking_nums;

                                if (!vc2_util.isEmpty(strTrackingNums)) {
                                    var arrTrackingNums = strTrackingNums.split('\n');
                                    arrAllTrackingNumbers = arrAllTrackingNumbers.concat(arrTrackingNums);
                                }
                            }
                            vc2_util.log(logTitle, '/// tracking numbers', arrAllTrackingNumbers);

                            if (!vc2_util.isEmpty(arrAllTrackingNumbers)) {
                                recItemFF = Helper.addNativePackages({
                                    record: recItemFF,
                                    trackingnumbers: arrAllTrackingNumbers
                                });
                            }
                        } catch (package_error) {
                            vc2_util.logError(logTitle, package_error);
                            vc2_util.vcLog({
                                title: 'Fulfillment | Set Package Error',
                                error: package_error,
                                status: LOG_STATUS.RECORD_ERROR,
                                recordId: Current.PO_ID
                            });
                        }
                        /*** End Clemen - Package ***/

                        // try to save the record
                        var itemffId;
                        try {
                            itemffId = recItemFF.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                            responseData.push({ id: itemffId, orderNum: orderNum });

                            vc2_util.log(logTitle, '## Created Item FF: [itemfulfillment:' + itemffId + ']');

                            vc2_util.vcLog({
                                title: 'Fulfillment | Successfully Created:',
                                message:
                                    '##' +
                                    ('Created Fulfillment (' + itemffId + ') \n') +
                                    Helper.printerFriendlyLines({ recordLines: recordLines }),
                                recordId: Current.PO_ID,
                                isSuccess: true
                            });
                        } catch (itemff_err) {
                            vc2_util.log(logTitle, '/// FULFILLMENT Create error', itemff_err, 'error');

                            vc2_util.vcLog({
                                title: 'Fulfillment | Save Fulfillment Error',
                                error: itemff_err,
                                status: LOG_STATUS.RECORD_ERROR
                            });
                            throw itemff_err;
                        }
                    }
                } catch (orderNum_error) {
                    vc2_util.logError(logTitle, orderNum_error);
                    vc2_util.vcLog({
                        title: 'Fulfillment |  OrderNum Error ',
                        error: orderNum_error,
                        // status: LOG_STATUS.RECORD_ERROR,
                        recordId: Current.PO_ID
                    });

                    continue;
                }
            }

            return responseData;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            vc2_util.vcLog({
                title: 'Fulfillment Error',
                error: error,
                status: LOG_STATUS.RECORD_ERROR,
                recordId: Current.PO_ID
            });

            throw error;
        } finally {
            vc2_util.log(logTitle, '############ ITEM FULFILLMENT CREATION: END ############');
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
            log.audit(logTitle, vc2_util.getUsage() + LogPrefix + '>> option: ' + JSON.stringify(option));

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
                    return a.toString().toUpperCase();
                })
            );

            return lineData;
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
            var logTitle = [LogTitle, 'addNativeSerials'].join('::'),
                logPrefix = LogPrefix + '// Set Inventory Details: ';

            var record = option.record,
                line = option.line;

            try {
                var validSerialList = this.validateSerials(option);
                if (!validSerialList) return;

                // re-select line for native data
                if (option.doCommit) record.selectLine({ sublistId: 'item', line: line });

                var currentLocation = record.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location'
                });
                vc2_util.log(logTitle, '.. current location: ', currentLocation);

                if (!currentLocation) Helper.setLineLocation({ record: record, recSO: Current.SO_REC });

                var inventoryDetailRecord = record.getCurrentSublistSubrecord({
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

                        inventoryDetailRecord.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: 1
                        });

                        inventoryDetailRecord.commitLine({
                            sublistId: 'inventoryassignment'
                        });
                        log.audit(logTitle, logPrefix + '...added serial no: ' + validSerialList[i]);

                        addedSerials.push(validSerialList[i]);
                    } catch (serial_error) {
                        vc2_util.logError(logTitle, serial_error);
                        vc2_util.vcLog({
                            title: 'Fulfillment | Inventory Detail Error',
                            error: serial_error,
                            status: LOG_STATUS.RECORD_ERROR,
                            recordId: Current.PO_ID
                        });
                    }
                }

                vc2_util.log(logTitle, LogPrefix + '>> done << ', addedSerials);

                if (option.doCommit) record.commitLine({ sublistId: 'item' });
            } catch (serials_error) {
                vc2_util.logError(logTitle, serials_error);
                vc2_util.vcLog({
                    title: 'Fulfillment | Native Serials',
                    error: serials_error,
                    status: LOG_STATUS.WARN,
                    recordId: Current.PO_ID
                });
            }

            return true;
        },
        addNativePackages: function (data) {
            var logTitle = [LogTitle, 'addNativePackages'].join('::');
            var ifRec = data.record;
            var arrTrackingNums = data.trackingnumbers;
            var sublistId = 'package',
                sublistIdSuffix = '';
            log.audit('Create-ItemFF::addNativePackages', '>> Tracking Nums List: ' + JSON.stringify(arrTrackingNums));

            if (!vc2_util.isEmpty(arrTrackingNums)) {
                var sublists = ifRec.getSublists();
                if (sublists) {
                    for (var i = 0, len = sublists.length; i < len; i += 1) {
                        if (sublists[i] == sublistId) {
                            break;
                        } else if (sublists[i].indexOf(sublistId) == 0) {
                            sublistIdSuffix = sublists[i].slice(sublistId.length);
                            sublistId = sublists[i];
                            log.debug(logTitle, 'package+carrier=' + sublistId + '/' + sublistIdSuffix);
                            break;
                        }
                    }
                }
                for (var i = 0; i < arrTrackingNums.length; i++) {
                    // log.audit("Create-ItemFF::addNativePackages", '>> Tracking Num: ' + JSON.stringify(arrTrackingNums[i]));

                    try {
                        if (i === 0) {
                            ifRec.selectLine({
                                sublistId: sublistId,
                                line: i
                            });
                        } else {
                            ifRec.selectNewLine({
                                sublistId: sublistId
                            });
                        }

                        ifRec.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: 'packageweight' + sublistIdSuffix,
                            value: 1.0
                        });

                        ifRec.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: 'packagetrackingnumber' + sublistIdSuffix,
                            value: arrTrackingNums[i]
                        });

                        ifRec.commitLine({
                            sublistId: sublistId
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
            }

            log.audit(
                'Create-ItemFF::addNativePackages',
                '/// Package line count=' +
                    ifRec.getLineCount({ sublistId: sublistId }) +
                    ' >> ifRec: ' +
                    JSON.stringify(ifRec.getSublist({ sublistId: sublistId }))
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
                vc2_util.getUsage() + LogPrefix + '>> currrent item/location: ' + JSON.stringify(lineData)
            );

            var lineLoc;

            if (vc2_util.isEmpty(lineData.location)) {
                //Use SO's header level Location
                lineLoc = recSO.getValue({
                    fieldId: 'location'
                });

                log.audit(logTitle, vc2_util.getUsage() + LogPrefix + '>> SO Location - ' + JSON.stringify(lineLoc));

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
                vc2_util.getUsage() + LogPrefix + '>> Line Location : after: ' + JSON.stringify(lineLoc)
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

            // log.audit(logTitle, logPrefix + '// total line count :' + JSON.stringify(lineCount));
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

                if (!itemData.location || vc2_util.inArray(itemData.location, arrLocation)) continue;
                arrLocation.push(itemData.location);
            }
            vc2_util.log(logTitle, logPrefix + '// unique location: ', arrLocation);

            if (!arrLocation || arrLocation.length > 1) {
                // just fetch the location from the SO

                if (Current.SO_REC) {
                    var orderLocation = Current.SO_REC.getValue({ fieldId: 'location' });
                    if (orderLocation) arrLocation = [orderLocation];

                    vc2_util.log(logTitle, logPrefix + '// orderLocation: ', orderLocation);
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

                // only set those who are empty, or not the same
                if (!itemData.location || itemData.location != arrLocation[0]) {
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
                // log.debug(logTitle, 'PO with id= ' + poId + ' found in line: ' + line);
                vc2_util.log(logTitle, '/// found in line: ', [poId, line]);

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
        getInventoryLocations: function (option) {
            var logTitle = [LogTitle, 'getInventoryLocations'].join('::'),
                recPurchOrd = option.recPurchOrd,
                recSalesOrd = option.recSalesOrd,
                inventoryLocations = [];
            if (recSalesOrd && recPurchOrd) {
                var poId = recPurchOrd.id;
                for (var i = 0, len = recSalesOrd.getLineCount({ sublistId: 'item' }); i < len; i += 1) {
                    var soInvLoc = recSalesOrd.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'inventorylocation',
                        line: i,
                        value: poId
                    });
                    var soCreatedPO = recSalesOrd.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'createdpo',
                        line: i,
                        value: poId
                    });
                    if (soCreatedPO == poId && inventoryLocations.indexOf(soInvLoc) == -1) {
                        inventoryLocations.push(soInvLoc);
                    }
                }
                log.debug(logTitle, '///inventory locations=' + inventoryLocations.join());
            }
            return inventoryLocations;
        },
        validateDate: function (option) {
            var logTitle = [LogTitle, 'validateDate'].join('::'),
                logPrefix = LogPrefix + ' validateDate || ',
                returnValue;
            option = option || {};

            try {
                if (!Current.PO_ID) throw ERROR_MSG.MISSING_PO;
                if (!Current.OrderCFG) throw ERROR_MSG.MISSING_VENDORCFG;

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
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment | Invalid Date ',
                    error: error,
                    recordId: Current.PO_ID
                });

                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
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
                if (vc2_util.isEmpty(listOrderNum)) return false;

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
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment |  Existing Orders Error',
                    error: error,
                    recordId: Current.PO_ID
                });

                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                // log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        findMatchingVendorLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingVendorLine'].join('::'),
                returnValue;

            try {
                var vendorLines = option.vendorLines,
                    orderLine = option.orderLine,
                    line = option.line,
                    quantity = option.quantity;

                if (!vendorLines) throw 'Vendor Lines are missing';
                if (!orderLine) throw 'Order Line is missing';

                // find all matching the item_name
                var matchingVendorLine = vc2_util.findMatching({
                    list: vendorLines,
                    findAll: true,
                    filter: {
                        item_num: function (value) {
                            var vendorLine = this;

                            var matchedValue =
                                vc2_record.isVendorLineMatched({
                                    orderLine: orderLine,
                                    vendorLine: vendorLine,
                                    mainConfig: Current.MainCFG,
                                    orderConfig: Current.OrderCFG
                                }) ||
                                (orderLine.poLineData
                                    ? vc2_record.isVendorLineMatched({
                                          orderLine: orderLine.poLineData,
                                          vendorLine: vendorLine,
                                          mainConfig: Current.MainCFG,
                                          orderConfig: Current.OrderCFG
                                      })
                                    : false);

                            vendorLine.ship_qty = util.isString(vendorLine.ship_qty)
                                ? vc2_util.parseFloat(vendorLine.ship_qty)
                                : vendorLine.ship_qty;

                            if (!vendorLine.hasOwnProperty('AVAILQTY')) vendorLine.AVAILQTY = vendorLine.ship_qty;

                            if (!vendorLine.hasOwnProperty('APPLIEDLINES')) vendorLine.APPLIEDLINES = [];

                            return !!matchedValue;
                        }
                    }
                });
                vc2_util.log(logTitle, '... matchingVendorLine: ', matchingVendorLine);
                if (!matchingVendorLine) throw 'No items matched!';

                // if has match multiple matches
                if (matchingVendorLine.length > 1) {
                    var matched = {
                        // matching ship_qty and line_no
                        qtyLine: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                // match the quantity or quantity_remaining
                                ship_qty: function (value) {
                                    var shipQty = vc2_util.parseFloat(value),
                                        qty = quantity || orderLine.quantity || orderLine.quantityremaining;
                                    return shipQty == qty;
                                },
                                // match the line_no, if its available
                                line_no: function (value) {
                                    var shipLine = vc2_util.parseFloat(value),
                                        poLine = orderLine.poline
                                            ? vc2_util.parseFloat(orderLine.poline)
                                            : vc2_util.parseFloat(orderLine.line);

                                    return shipLine == poLine;
                                },
                                // still has available quantity
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }),
                        // fully match the available quantity
                        qtyFull: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                // match the quantity or quantity_remaining
                                ship_qty: function (value) {
                                    var shipQty = vc2_util.parseFloat(value),
                                        qty = quantity || orderLine.quantity || orderLine.quantityremaining;
                                    return shipQty == qty;
                                },
                                // still has available quantity
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }),
                        // partially match the available quantity
                        qtyPartial: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                AVAILQTY: function (value) {
                                    var qty = quantity || orderLine.availqty;

                                    return value > 0 && qty >= value;
                                }
                            }
                        })
                    };
                    matchingVendorLine = matched.qtyLine || matched.qtyFull || matched.qtyPartial;
                }
                returnValue = matchingVendorLine;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
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
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment Error | Remove Line Error',
                    error: error,
                    status: LOG_STATUS.RECORD_ERROR,
                    recordId: Current.PO_ID
                });

                returnValue = false;
                throw vc2_util.extractError(error);
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

                if (option.quantity) {
                    option.record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: option.quantity
                    });
                }

                option.record.commitLine({ sublistId: 'item' });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment | Add Line Error',
                    error: error,
                    status: LOG_STATUS.RECORD_ERROR,
                    recordId: Current.PO_ID
                });

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

            var curFld, curValue;

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

                for (curFld in option.values) {
                    curValue = option.values[curFld];
                    option.record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: curFld,
                        value: curValue
                    });
                }

                if (option.line || option.doCommit) {
                    option.record.commitLine({ sublistId: 'item' });
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment | Set Line Value Error',
                    error: error,
                    details: [curFld, curValue],
                    status: LOG_STATUS.RECORD_ERROR,
                    recordId: Current.PO_ID
                });

                returnValue = false;
            }

            return returnValue;
        }
    };

    return ItemFFLib;
});
