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
 *
 */

define([
    'N/search',
    'N/record',
    'N/runtime',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js'
], function (NS_Search, NS_Record, NS_Runtime, VC_Global, VC_Constants, VC_Log, VC_Util) {
    var LogTitle = 'ItemRcptLIB',
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


    ///////////////////////////////////////////////////////////////////////
    //** Update PO Fields with parsed XML data
    ///////////////////////////////////////////////////////////////////////
    function updateItemReceipts(option) {
        var logTitle = [LogTitle, 'updateItemReceipts'].join('::');

        Current.MainCFG = option.mainConfig;
        Current.VendorCFG = option.vendorConfig;
        Current.PO_ID = option.poId;
        Current.OrderLines = option.lineData;
        Current.Vendor = option.vendor;

        LogPrefix = '[purchaseorder:' + Current.PO_ID + ']';
        log.debug(logTitle, '############ ITEM RECEIPT CREATION: START ############');
        log.debug(logTitle, LogPrefix + '>> Order Lines: ' + JSON.stringify(Current.OrderLines));

        var OrderLines = option.lineData;

        try {
            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.VendorCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (VC_Util.isEmpty(Current.OrderLines)) throw 'Empty Line Data';

            if (!ItemRcptLib.validateDate()) throw 'Invalid PO Date';

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
                var logPrefix = LogPrefix + ' [' + OrderLines[i].order_num + '] ';

                if (VC_Util.inArray(OrderLines[i].order_num, arrOrderNums)) {
                    log.debug(logTitle, logPrefix + '......skipped: same order');
                    continue;
                }

                if (!OrderLines[i].order_num || OrderLines[i].order_num == 'NA') {
                    log.debug(logTitle, logPrefix + '......skipped: no item order num');
                    continue;
                }

                if (
                    OrderLines[i].hasOwnProperty('is_shipped') &&
                    OrderLines[i].is_shipped === false
                ) {
                    log.debug(logTitle, logPrefix + '......skipped: not yet shipped');
                    continue;
                }

                if (OrderLines[i].hasOwnProperty('ns_record') && OrderLines[i].ns_record) {
                    log.debug(logTitle, logPrefix + '......skipped: receipt already exists.');
                    continue;
                }

                OrderLines[i].ship_qty = parseInt(OrderLines[i].ship_qty || '0', 10);
                OrderLines[i].vendorOrderNum = Current.NumPrefix + OrderLines[i].order_num;

                log.debug(logTitle, logPrefix + '......added order.');
                arrOrderNums.push(OrderLines[i].order_num);
            }

            log.debug(
                logTitle,
                LogPrefix + '>> Receipt Order Nums: ' + JSON.stringify(arrOrderNums)
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
        } finally {
            log.debug(logTitle, '############ ITEM RECEIPT CREATION: END ############');
        }
    }

    ///////////////////////////////////////////////////////////////////////

    var ItemRcptLib = {
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
    };

    ///////////////////////////////////////////////////////////////////////
    var Helper = {
        validatePODate: function (Current.PO_ID, PO_Valid_Date) {
            var logTitle = [LogTitle, 'validatePODate'].join('::');
            log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify([Current.PO_ID, PO_Valid_Date]));

            var isValid = false;

            if (!Helper.isEmpty(Current.PO_ID)) {
                var d1 = Date.parse(PO_Valid_Date);
                var searchId = NS_Runtime.getCurrentScript().getParameter('custscript_searchid2');

                var filters = NS_Search.createFilter({
                    name: 'internalid',
                    operator: NS_Search.Operator.IS,
                    values: Current.PO_ID
                });
                var mySearch = NS_Search.load({ id: searchId });
                mySearch.filters.push(filters);
                mySearch.run().each(function (result) {
                    var docStatus = result.getText({
                        name: 'statusref'
                    });
                    if (docStatus.indexOf('Partially') < 0) {
                        isValid = true;
                    } else {
                        var docDate = result.getValue({
                            name: 'trandate'
                        });
                        if (!Helper.isEmpty(docDate)) {
                            var d2 = Date.parse(docDate);
                            if (d1 < d2) {
                                isValid = true;
                            }
                        }
                    }
                });
            }
            log.audit(
                logTitle,
                LogPrefix + 'is Valid PO Date ? ' + JSON.stringify([Current.PO_ID, isValid])
            );

            return isValid;
        },
        orderExists: function (transID) {
            var logTitle = [LogTitle, 'orderExists'].join('::');
            // log.audit(logTitle, '>> ..order exists transid: ' + JSON.stringify(transID));

            var filters = NS_Search.createFilter({
                name: 'custbody_ctc_if_vendor_order_match',
                operator: NS_Search.Operator.IS,
                values: transID
            });
            var mySearch = NS_Search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
            mySearch.filters.push(filters);

            // If order num already exists do nothing
            var found = false,
                foundId;
            mySearch.run().each(function (result) {
                found = true;
                foundId = result.id;
            });

            log.audit(
                logTitle,
                LogPrefix + '.... is Order Exists ? ' + JSON.stringify([transID, foundId, found])
            );

            return found;
        },
        itemInLineData: function (tempItemNum, lineData, tempVendorSKU) {
            var logTitle = [LogTitle, 'itemInLineData'].join('::');
            log.audit(
                logTitle,
                LogPrefix +
                    '>> params: ' +
                    JSON.stringify({
                        tempItemNum: tempItemNum,
                        tempVendorSKU: tempVendorSKU
                    })
            );

            var isInData = false;
            for (var i = 0; i < lineData.length; i++) {
                if (tempVendorSKU) {
                    if (tempVendorSKU == lineData[i].vendorSKU) {
                        //log.debug('matched vendor sku for line '+i)
                        isInData = true;
                        break;
                    }
                }
                if (tempItemNum == lineData[i].item_num) {
                    isInData = true;
                    break;
                }
            }

            log.audit(logTitle, LogPrefix + 'is itemInLineData? ' + JSON.stringify(isInData));

            return isInData;
        },
        updateXMLField: function (objRecord, fieldVal, fieldID) {
            var logTitle = [LogTitle, 'updateXMLField'].join('::');
            // log.audit(logTitle, '>>> : ' + JSON.stringify([fieldVal, fieldID]));

            if (!Helper.isEmpty(fieldVal)) {
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID,
                    value: fieldVal
                });
                objRecord.commitLine({ sublistId: 'item' });
            }
        },
        removeIRLine: function (objRecord, lineNum) {
            var logTitle = [LogTitle, 'removeIRLine'].join('::');
            log.audit(logTitle, LogPrefix + '>>> remove line: ' + JSON.stringify(lineNum));

            objRecord.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            objRecord.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: false
            });
            objRecord.commitLine({ sublistId: 'item' });
        },
        addIRLine: function (objRecord, lineNum) {
            var logTitle = [LogTitle, 'addIRLine'].join('::');
            log.audit(logTitle, LogPrefix + '>>> add line: ' + JSON.stringify(lineNum));

            objRecord.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            objRecord.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: true
            });
            objRecord.commitLine({ sublistId: 'item' });
        },
        printerFriendlyLines: function (options) {
            var logTitle = [LogTitle, 'printerFriendlyLines'].join('::');
            log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(options));

            var recordLines = options.recordLines,
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
        isEmpty: function (stValue) {
            if (stValue === '' || stValue == null || stValue == undefined) {
                return true;
            } else {
                if (typeof stValue == 'string') {
                    if (stValue == '') {
                        return true;
                    }
                } else if (typeof stValue == 'object') {
                    if (stValue.length == 0 || stValue.length == 'undefined') {
                        return true;
                    }
                }

                return false;
            }
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
                header: ['Create Receipt', option.title ? '::' + option.title : null].join(''),
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
        }
    };

    return {
        updateIR: updateItemReceipts
    };
});
