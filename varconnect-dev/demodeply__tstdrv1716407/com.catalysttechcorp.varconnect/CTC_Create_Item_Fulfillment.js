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

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/format',
    'N/config',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js'
], function (
    NS_Search,
    NS_Runtime,
    NS_Record,
    NS_Format,
    NS_Config,
    VC_Global,
    VC_Constants,
    VC_Log,
    VC_Util
) {
    var LogTitle = 'Create-ItemFF',
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

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemFulfillments(option) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::');

        Current.MainCFG = option.mainConfig;
        Current.VendorCFG = option.vendorConfig;
        Current.SO_REC = option.recSalesOrd;
        Current.PO_REC = option.recPurchOrd;

        Current.PO_ID = option.poId || Current.PO_REC.id;
        Current.SO_ID = option.soId || Current.SO_REC.id;

        Current.OrderLines = option.lineData;
        Current.Vendor = option.vendor;

        var OrderLines = option.lineData;

        LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';
        log.debug(logTitle, '############ ITEM FULFILLMENT CREATION: START ############');
        log.debug(logTitle, LogPrefix + '>> Order Lines: ' + JSON.stringify(Current.OrderLines));

        try {
            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.VendorCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (VC_Util.isEmpty(Current.OrderLines)) throw 'Empty Line Data';

            if (!ItemFFLib.validateDate()) throw 'Invalid PO Date';

            Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw 'Config Error: Missing Fulfillment Prefix';

            OrderLines = Helper.sortLineData(OrderLines);

            var arrOrderNums = [],
                i,
                ii,
                iii;

            var responseData = [],
                OrigLogPrefix = LogPrefix;

            ///////////////////////////////////////////////////
            // Collect unique the Item Fulfillment orders from the response
            for (i = 0; i < OrderLines.length; i++) {
                LogPrefix = OrigLogPrefix + ' [' + OrderLines[i].order_num + '] ';

                if (VC_Util.inArray(OrderLines[i].order_num, arrOrderNums)) {
                    log.debug(logTitle, LogPrefix + '......skipped: same order');
                    continue;
                }

                if (!OrderLines[i].order_num || OrderLines[i].order_num == 'NA') {
                    log.debug(logTitle, LogPrefix + '......skipped: no item order num');
                    continue;
                }

                if (
                    OrderLines[i].hasOwnProperty('is_shipped') &&
                    OrderLines[i].is_shipped === false
                ) {
                    log.debug(logTitle, LogPrefix + '......skipped: not yet shipped');
                    continue;
                }

                if (OrderLines[i].hasOwnProperty('ns_record') && OrderLines[i].ns_record) {
                    log.debug(logTitle, LogPrefix + '......skipped: fulfillment already exists.');
                    continue;
                }

                OrderLines[i].ship_qty = parseInt(OrderLines[i].ship_qty || '0', 10);
                OrderLines[i].vendorOrderNum = Current.NumPrefix + OrderLines[i].order_num;

                log.debug(logTitle, LogPrefix + '......added order.');
                arrOrderNums.push(OrderLines[i].order_num);
            }
            LogPrefix = OrigLogPrefix;
            log.debug(
                logTitle,
                LogPrefix + '>> Fulfillment Order Nums: ' + JSON.stringify(arrOrderNums)
            );

            ///////////////////////////////////////////////////
            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            for (i = 0; i < arrOrderNums.length; i++) {
                var orderNum = arrOrderNums[i],
                    vendorOrderNum = Current.NumPrefix + orderNum;

                log.debug(
                    logTitle,
                    LogPrefix + '##################################################'
                );
                log.debug(
                    logTitle,
                    LogPrefix + '****** PROCESSING ORDER [' + vendorOrderNum + '] ******'
                );
                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';

                // skip any existing orders
                if (orderNum == 'NA') continue;

                /// check if order exists //////////////////
                var isOrderExists = ItemFFLib.orderExists({ vendorOrderNum: vendorOrderNum });
                log.debug(
                    logTitle,
                    LogPrefix + '/// Order Exists? ' + JSON.stringify(isOrderExists)
                );
                if (isOrderExists) continue;

                var LinesToFulfill = [];

                // Build an array with all XML line data with the same order num
                for (ii = 0; ii < OrderLines.length; ii++) {
                    if (orderNum != OrderLines[ii].order_num) continue;
                    LinesToFulfill.push(OrderLines[ii]);
                }

                if (!LinesToFulfill.length) {
                    log.debug(logTitle, LogPrefix + '>>> No items to fulfill.');
                    continue;
                }

                log.debug(
                    logTitle,
                    LogPrefix + '>> LinesToFulfill: ' + JSON.stringify(LinesToFulfill)
                );

                ///////////////////////////////////////////////
                var defaultItemFFValues = {};
                if (NS_Runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' })) {
                    var defaultShipGroup = Helper.getShipGroup({
                        recSalesOrd: Current.SO_REC,
                        recPurchOrd: Current.PO_REC
                    });
                    if (defaultShipGroup) {
                        defaultItemFFValues.shipgroup = defaultShipGroup;
                    }
                }

                ///////////////////////////////////////////////

                ////////////////////////////////////////////////////////
                var record;
                log.debug(
                    logTitle,
                    LogPrefix +
                        ' ///// Transform to Fulfillment .....' +
                        JSON.stringify(defaultItemFFValues)
                );
                try {
                    // create item fulfillment from sales order
                    record = NS_Record.transform({
                        fromType: NS_Record.Type.SALES_ORDER,
                        fromId: Current.SO_ID,
                        toType: NS_Record.Type.ITEM_FULFILLMENT,
                        isDynamic: true,
                        defaultValues: defaultItemFFValues
                    });
                    log.debug(logTitle, LogPrefix + '...success.');
                } catch (err) {
                    Helper.logMsg({
                        title: 'Transform Error on SO: ' + Current.SO_ID,
                        error: err
                    });
                    continue;
                }
                ////////////////////////////////////////////////////////

                var recordIsChanged = false;
                var lineItemCount = record.getLineCount({ sublistId: 'item' });

                log.debug(
                    logTitle,
                    LogPrefix + ' ///// Remove fulfillment lines not in orders received .....'
                );
                log.debug(
                    logTitle,
                    LogPrefix + '>> Pending Fulfillment - line count: ' + lineItemCount
                );

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
                            fieldId: VC_Global.ITEM_FUL_ID_LOOKUP_COL,
                            line: line
                        }),
                        skuName: VC_Global.VENDOR_SKU_LOOKUP_COL
                            ? record.getSublistText({
                                  sublistId: 'item',
                                  fieldId: VC_Global.VENDOR_SKU_LOOKUP_COL,
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
                            fieldId: VC_Constants.Columns.DH_MPN,
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
                        LogPrefix + '*** fulfillment line:  ' + JSON.stringify(lineFFData)
                    );

                    /// REMOVE lines from different POs
                    if (lineFFData.item_po != Current.PO_ID) {
                        log.debug(logTitle, LogPrefix + '.... removed: not same PO ');
                        ItemFFLib.removeFulfillmentLine({ record: record, line: line });
                        recordIsChanged = true;
                    }

                    /// REMOVE lines thats not from the list
                    matchingLine = ItemFFLib.findMatchingItem({
                        data: lineFFData,
                        dataSet: LinesToFulfill
                    });
                    // log.debug(
                    //     logTitle,
                    //     LogPrefix + '/// matching line: ' + JSON.stringify(matchingLine)
                    // );

                    if (!matchingLine) {
                        log.debug(logTitle, LogPrefix + '.... removed: line item not found.');
                        ItemFFLib.removeFulfillmentLine({ record: record, line: line });
                        recordIsChanged = true;
                    } else {
                        log.debug(logTitle, LogPrefix + '.... adding line to item fulfillment.');
                        ItemFFLib.addFulfillmentLine({ record: record, line: line });
                        fulfillableLines.push(lineFFData);

                        hasFulfillableLine = true;
                        recordIsChanged = true;
                    }
                }
                //////////////////////////////////////////////////////////////////////

                log.debug(
                    logTitle,
                    LogPrefix + '>>> fulfillableLines: ' + JSON.stringify(fulfillableLines)
                );

                // skip the order if no fulfillable items
                if (!hasFulfillableLine) continue;

                //////////////////////////////////////////////////////////////////////
                // Build a list of unique items with their total quantities shipped for this shipment
                var UniqueLineItems = [];
                log.debug(logTitle, LogPrefix + '**** Collect all items to fulfill ****');
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
                        LogPrefix + '>>... currentItem: ' + JSON.stringify(currentItem.item_num)
                    );

                    matchingLine = ItemFFLib.findMatchingItem({
                        data: lineToFulfill,
                        dataSet: UniqueLineItems,
                        fieldToTest: 'item_num'
                    });

                    if (!matchingLine) {
                        UniqueLineItems.push(currentItem);
                        log.debug(
                            logTitle,
                            LogPrefix +
                                ' ... added to unique items - ' +
                                JSON.stringify(UniqueLineItems.length)
                        );
                        continue;
                    }

                    for (iii = 0; iii < UniqueLineItems.length; iii++) {
                        if (LinesToFulfill[ii].item_num !== UniqueLineItems[iii].item_num) continue;

                        UniqueLineItems[iii].totalShipped += LinesToFulfill[ii].ship_qty * 1;

                        var tmpTrackList = Helper.uniqueList({
                            value: LinesToFulfill[ii].tracking_num
                        });
                        if (!VC_Util.isEmpty(UniqueLineItems[iii].all_tracking_nums)) {
                            tmpTrackList += '\n' + UniqueLineItems[iii].all_tracking_nums;
                        }
                        UniqueLineItems[iii].all_tracking_nums = Helper.uniqueList({
                            value: tmpTrackList,
                            splitStr: '\n'
                        });

                        var tmpSerialList = Helper.uniqueList({
                            value: LinesToFulfill[ii].serial_num
                        });
                        if (!VC_Util.isEmpty(UniqueLineItems[iii].all_serial_nums)) {
                            tmpTrackList += '\n' + UniqueLineItems[iii].all_serial_nums;
                        }
                        UniqueLineItems[iii].all_serial_nums = Helper.uniqueList({
                            value: tmpSerialList,
                            splitStr: '\n'
                        });

                        log.debug(
                            logTitle,
                            LogPrefix +
                                ' ... updated unique item data - ' +
                                JSON.stringify([UniqueLineItems.length, UniqueLineItems[iii]])
                        );
                        // break;
                    }
                }
                log.debug(
                    logTitle,
                    LogPrefix + ' ... Unique Items - ' + JSON.stringify(UniqueLineItems)
                );

                var lineItemFFCount = record.getLineCount({ sublistId: 'item' });
                var recordLines = [];
                log.debug(
                    logTitle,
                    LogPrefix + '**** START ITEM FULFILLMENT LINES VALIDATION ****'
                );

                log.debug(logTitle, LogPrefix + '>> count: ' + lineItemFFCount);

                // loop through all items in item fulfillment
                for (line = 0; line < lineItemFFCount; line++) {
                    record.selectLine({ sublistId: 'item', line: line });

                    lineFFData = {
                        lineNo: line,
                        item: record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: VC_Global.ITEM_FUL_ID_LOOKUP_COL
                        }),
                        quantity: record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity'
                        }),
                        isReceived: record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive'
                        }),
                        vendorSKU: VC_Global.VENDOR_SKU_LOOKUP_COL
                            ? record.getCurrentSublistValue({
                                  sublistId: 'item',
                                  fieldId: VC_Global.VENDOR_SKU_LOOKUP_COL
                              })
                            : '',
                        line_po: record.getSublistText({
                            sublistId: 'item',
                            fieldId: 'poline',
                            line: line
                        }),
                        dandh: record.getSublistText({
                            sublistId: 'item',
                            fieldId: VC_Constants.Columns.DH_MPN,
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
                        LogPrefix + '>> current line: ' + JSON.stringify(lineFFData)
                    );

                    if (!lineFFData.isReceived) {
                        log.debug(logTitle, LogPrefix + '....skipping: not received.');
                        ItemFFLib.setLineValues({
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
                            LogPrefix + '>> item to ship ? ' + JSON.stringify(itemToShip)
                        );

                        if (
                            lineFFData.item == itemToShip.item_num ||
                            (lineFFData.vendorSKU &&
                                lineFFData.vendorSKU == itemToShip.vendorSKU) ||
                            (lineFFData.dandh &&
                                Current.VendorCFG.xmlVendor ==
                                    VC_Constants.Lists.XML_VENDOR.DandH &&
                                lineFFData.dandh == itemToShip.item_num)
                        ) {
                            log.debug(logTitle, LogPrefix + '....selected');

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
                                    LogPrefix + '>> skipped: no more items left to ship.'
                                );
                                ItemFFLib.setLineValues({
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
                                    LogPrefix +
                                        '>> skipped: remaining quantity is less than required ship quantity. [' +
                                        (lineFFData.quantity + ' / ' + itemToShip.ship_qty + ']')
                                );

                                ItemFFLib.setLineValues({
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

                                ItemFFLib.setLineValues({
                                    record: record,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                recordIsChanged = true;
                                continue;
                            }

                            ///////////////////////////////////////////////
                            ItemFFLib.setLineValues({ record: record, values: itemffValues });
                            ///////////////////////////////////////////////

                            //// SERIALS DETECTION ////////////////
                            var arrSerials = itemToShip.all_serial_nums
                                ? itemToShip.all_serial_nums.split(/\n/)
                                : [];

                            log.debug(
                                logTitle,
                                LogPrefix + '... line Serials: ' + JSON.stringify(arrSerials)
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
                                    // do not clear location as some fulfillments fail when there is more than one
                                    // blanks are counted as another location
                                    record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'inventorydetailreq',
                                        value: lineFFData.isInvDetailReqd
                                    });
                                }
                            }
                        }
                    }
                    record.commitLine({ sublistId: 'item' });
                    recordIsChanged = true;
                }

                log.debug(logTitle, LogPrefix + '>> recordLines: ' + JSON.stringify(recordLines));

                if (VC_Util.isEmpty(recordLines)) {
                    Helper.logMsg({
                        status: VC_Constants.Lists.VC_LOG_STATUS.INFO,
                        title: 'Fulfillment Lines',
                        message: '>> No Matching Lines To Fulfill'
                    });

                    continue;
                }

                Helper.logMsg({
                    status: VC_Constants.Lists.VC_LOG_STATUS.INFO,
                    title: 'Fulfillment Lines',
                    message: Helper.printerFriendlyLines({
                        recordLines: recordLines
                    })
                });

                var arrAllTrackingNumbers = [];
                /*** Start Clemen - Package ***/
                for (ii = 0; ii < UniqueLineItems.length; ii++) {
                    var strTrackingNums = UniqueLineItems[ii].all_tracking_nums;

                    if (!VC_Util.isEmpty(strTrackingNums)) {
                        var arrTrackingNums = strTrackingNums.split('\n');
                        arrAllTrackingNumbers = arrAllTrackingNumbers.concat(arrTrackingNums);
                    }
                }
                /*** End Clemen - Package ***/

                try {
                    var objId;

                    if (recordIsChanged) {
                        if (VC_Global.PICK_PACK_SHIP) {
                            record.setValue({
                                fieldId: 'shipstatus',
                                value: 'C'
                            });
                        }

                        record.setValue({
                            fieldId: 'custbody_ctc_if_vendor_order_match',
                            value: vendorOrderNum,
                            ignoreFieldChange: true
                        });

                        var lineItemCountX = record.getLineCount({
                            sublistId: 'item'
                        });

                        log.debug(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('Item line count = ' + lineItemCountX)
                        );

                        /*** Start Clemen - Package ***/
                        log.debug(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('arrAllTrackingNumbers = ' + JSON.stringify(arrAllTrackingNumbers))
                        );

                        if (
                            !VC_Util.isEmpty(arrAllTrackingNumbers) &&
                            arrAllTrackingNumbers.length > 0
                        ) {
                            record = Helper.addNativePackages({
                                record: record,
                                trackingnumbers: arrAllTrackingNumbers
                            });
                        }
                        /*** End Clemen - Package ***/

                        log.debug(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('Package line count = ' +
                                    record.getLineCount({ sublistId: 'package' }))
                        );

                        log.debug(
                            logTitle,
                            LogPrefix +
                                '**** ITEM FULFILLMENT CREATION ****' +
                                JSON.stringify(recordLines)
                        );

                        objId = record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });

                        responseData.push({
                            id: objId,
                            orderNum: orderNum
                        });
                    } else {
                        objId = record.id;
                        responseData.push({
                            id: objId,
                            orderNum: orderNum
                        });
                    }

                    log.debug(
                        logTitle,
                        LogPrefix + '## Created Item Fulfillment: [itemfulfillment:' + objId + ']'
                    );

                    Helper.logMsg({
                        title: 'Create Fulfillment',
                        isSucces: true,
                        message: '## Created Item Fulfillment: [itemfulfillment:' + objId + ']'
                    });
                } catch (err) {
                    var errMsg = Helper.extractError(err);
                    log.error(
                        logTitle,
                        LogPrefix +
                            ('## Fulfillment Creation Error:  ' + errMsg) +
                            ('|  Details: ' + JSON.stringify(err))
                    );

                    Helper.logMsg({
                        error: err,
                        title: 'Create Fulfillment Error'
                    });
                }
            }
            return responseData;
        } catch (error) {
            var errorMsg = Helper.extractError(error);
            log.error(
                logTitle,
                LogPrefix + '## ERROR:  ' + errorMsg + '| Details: ' + JSON.stringify(error)
            );
            Helper.logMsg({ title: logTitle + ':: Error', error: error });
            return false;
        }
    }

    var ItemFFLib = {
        validateDate: function (option) {
            var logTitle = [LogTitle, 'validateDate'].join('::'),
                logPrefix = LogPrefix + ' validateDate || ',
                returnValue;
            option = option || {};

            try {
                if (!Current.PO_ID) throw 'Missing PO ID';
                if (!Current.VendorCFG) throw 'Missing Vendor Config';

                var searchId = NS_Runtime.getCurrentScript().getParameter('custscript_searchid2');
                var searchObj = NS_Search.load({ id: searchId });

                searchObj.filters.push(
                    NS_Search.createFilter({
                        name: 'internalid',
                        operator: NS_Search.Operator.IS,
                        values: Current.PO_ID
                    })
                );
                searchObj.filters.push(
                    NS_Search.createFilter({
                        name: 'trandate',
                        operator: NS_Search.Operator.ONORAFTER,
                        values: Current.VendorCFG.startDate
                    })
                );

                returnValue = !!searchObj.runPaged().count;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
            } finally {
                log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        validateOrderList: function (option) {
            var logTitle = [LogTitle, 'validateOrderList'].join('::'),
                logPrefix = LogPrefix + ' validateOrderList || ',
                returnValue;
            option = option || {};

            try {
                var sortedOrders = Helper.sortLineData(Current.OrderLines);
                log.audit(logTitle, LogPrefix + '.. sorted: ' + JSON.stringify(sortedOrders));

                // remove duplicates
                var uniqueOrders = {};

                for (var i = 0, j = sortedOrders.length; i < j; i++) {
                    var lineData = sortedOrders[i];
                    logPrefix = LogPrefix + ' validateOrder || ' + lineData.order_num + ' ';

                    lineData.vendorOrder = Current.NumPrefix + lineData.order_num;
                    lineData.ship_qty = parseInt(lineData.ship_qty || '0', 10);

                    if (lineData.hasOwnProperty('is_shipped') && lineData.is_shipped === false) {
                        log.audit(logTitle, logPrefix + '.. skipped: not yet shipped.');
                        continue;
                    }

                    if (!lineData.hasOwnProperty('order_num') || lineData.order_num == 'NA') {
                        log.audit(logTitle, logPrefix + '.. skipped: no ordernum detected.');
                        continue;
                    }

                    if (!VC_Util.isEmpty(lineData.ns_record)) {
                        log.audit(logTitle, logPrefix + '.. skipped: fulfillment already exists.');
                        continue;
                    }

                    if (VC_Util.isEmpty(uniqueOrders[lineData.order_num])) {
                        uniqueOrders[lineData.order_num] = {
                            data: lineData,
                            lines: []
                        };
                    }

                    uniqueOrders[lineData.order_num].lines.push(lineData);
                }

                returnValue = uniqueOrders;
            } catch (error) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
            } finally {
                // log.audit(logTitle, LogPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
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
                    vendorList = VC_Constants.Lists.XML_VENDOR;

                var logPrefix = LogPrefix + ' [Item: ' + dataToTest.item_num + ']';
                var hasMatch = false;

                // log.audit(logTitle, LogPrefix + ' // isMatchingLine: ' + JSON.stringify(option));

                var LineItemCheck = {
                    ingramCheck: function (itemType) {
                        var _logPrefix = logPrefix + ' // ingramCheck:[' + itemType + ']: ',
                            returnValue = false;

                        try {
                            if (!dataToFind[itemType] || !dataToTest[itemType])
                                throw '[' + itemType + '] not present';

                            if (
                                !hashSpace &&
                                !VC_Util.inArray(xmlVendor, [
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
                            //     _logPrefix + '... skipped: ' + Helper.extractError(check_error)
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
                                !VC_Util.inArray(dataToFind[itemType], [
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
                            //     _logPrefix + '... skipped: ' + Helper.extractError(check_error)
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
                            //     _logPrefix + '... skipped: ' + Helper.extractError(check_error)
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
                log.error(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
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
                        ItemFFLib.isMatchingLine({
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
                log.error(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
            } finally {
                // log.audit(logTitle, LogPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        orderExists: function (option) {
            var logTitle = [LogTitle, 'orderExists'].join('::'),
                logPrefix = LogPrefix + ' orderExists || ',
                returnValue;
            option = option || {};

            try {
                var searchOption = {
                    type: 'itemfulfillment',
                    filters: [
                        ['type', 'anyof', 'ItemShip'],
                        'AND',
                        ['mainline', 'is', 'T'],
                        'AND',
                        [
                            'custbody_ctc_if_vendor_order_match',
                            NS_Search.Operator.IS,
                            option.vendorOrderNum
                        ]
                    ],
                    columns: [
                        'mainline',
                        'internalid',
                        'trandate',
                        'tranid',
                        'entity',
                        'custbody_ctc_if_vendor_order_match'
                    ]
                };

                // log.audit(logTitle, LogPrefix + '>> searchOption: ' + JSON.stringify(searchOption));

                var searchObj = NS_Search.create(searchOption);
                returnValue = !!searchObj.runPaged().count;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
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
                throw Helper.extractError(error);
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
                throw Helper.extractError(error);
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
                if (VC_Util.isEmpty(option.values)) throw 'Missing values';

                if (option.line) {
                    option.record.selectLine({
                        sublistId: 'item',
                        line: option.line
                    });
                }

                for (var fld in option.values) {
                    option.record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fld,
                        value: option.values[fld]
                    });

                    log.audit(
                        logTitle,
                        logPrefix + '... ' + JSON.stringify([fld, option.values[fld]])
                    );
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
            arrList = VC_Util.uniqueArray(arrList);

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
                var generalPref = NS_Config.load({
                    type: NS_Config.Type.COMPANY_PREFERENCES
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
                        NS_Format.parse({
                            value: dateTimeString,
                            type: NS_Format.Type.DATE
                        });
                } catch (e) {
                    log.error('Error parsing date ' + dateTimeString, e);
                }
            }
            return date;
        },
        formatDate: function (option) {
            var dateString = option.dateString,
                date;

            if (!dateFormat) {
                var generalPref = NS_Config.load({
                    type: NS_Config.Type.COMPANY_PREFERENCES
                });
                dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            }

            if (dateString && dateString.length > 0 && dateString != 'NA') {
                try {
                    var stringToProcess = dateString.split('\n');

                    for (var i = 0; i < stringToProcess.length; i++) {
                        var singleString = stringToProcess[i];
                        if (singleString) {
                            var convertedDate = Helper.parseDate({
                                dateString: singleString
                            });

                            if (!date || (convertedDate && convertedDate > date))
                                date = convertedDate;
                        }
                    }
                } catch (e) {
                    log.error('Error parsing date ' + dateString, e);
                }
            }

            //Convert to string
            if (date) {
                //set date
                var year = date.getFullYear();
                if (year < 2000) {
                    year += 100;
                    date.setFullYear(year);
                }

                date = NS_Format.format({
                    value: date,
                    type: NS_Format.Type.DATE
                });
            }

            return date;
        },

        parseDate_old: function (option) {
            var dateString = option.dateString,
                date;

            if (!dateFormat) {
                var generalPref = NS_Config.load({
                    type: NS_Config.Type.COMPANY_PREFERENCES
                });
                dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
                // log.debug('dateFormat', dateFormat);
            }

            if (dateString && dateString.length > 0 && dateString != 'NA') {
                try {
                    var stringToProcess = dateString
                        .replace(/-/g, '/')
                        .replace(/\n/g, ' ')
                        .split(' ');

                    for (var i = 0; i < stringToProcess.length; i++) {
                        var singleString = stringToProcess[i];
                        if (singleString) {
                            var stringArr = singleString.split('T'); //hanlde timestamps with T
                            singleString = stringArr[0];
                            var convertedDate = new Date(singleString);

                            if (!date || convertedDate > date) date = convertedDate;
                        }
                    }
                } catch (e) {
                    log.error('Error parsing date ' + dateString, e);
                }
            }

            //Convert to string
            if (date) {
                //set date
                var year = date.getFullYear();
                if (year < 2000) {
                    year += 100;
                    date.setFullYear(year);
                }

                date = NS_Format.format({
                    value: date,
                    type: dateFormat ? dateFormat : NS_Format.Type.DATE
                });
            }

            return date;
        },
        printerFriendlyLines: function (option) {
            var logTitle = [LogTitle, 'printerFriendlyLines'].join('::');
            log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

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
        extractError: function (option) {
            option = option || {};
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        logMsg: function (option) {
            option = option || {};

            var logOption = {
                transaction: Current.PO_ID,
                header: ['Create Fulfillment', option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? Helper.extractError(option.error) : option.errorMsg),

                status:
                    option.status ||
                    (option.error
                        ? VC_Constants.Lists.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? VC_Constants.Lists.VC_LOG_STATUS.SUCCESS
                        : VC_Constants.Lists.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, LogPrefix + '::' + JSON.stringify(logOption));
            VC_Log.recordLog(logOption);
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
                    log.error(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(serial_error));
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
            log.audit(
                'Create-ItemFF::addNativePackages',
                '>> Tracking Nums List: ' + JSON.stringify(arrTrackingNums)
            );

            if (!VC_Util.isEmpty(arrTrackingNums)) {
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
                LogPrefix + '>> currrent item/location: ' + JSON.stringify(lineData)
            );

            var lineLoc;

            if (VC_Util.isEmpty(lineData.location)) {
                //Use SO's header level Location
                var locationLookup = recSO.getValue({
                    fieldId: 'location'
                });

                if (locationLookup && locationLookup.location && locationLookup.location[0]) {
                    lineLoc = locationLookup.location[0].value;
                }

                log.audit(
                    logTitle,
                    LogPrefix + '>> lookup search: ' + JSON.stringify([locationLookup, lineLoc])
                );

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

            log.audit(logTitle, LogPrefix + '>> Line Location : after: ' + JSON.stringify(lineLoc));

            return record;
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
        }
    };

    return {
        updateIF: updateItemFulfillments,
        updateItemFulfillments: updateItemFulfillments
    };
});
