/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Sep 8, 2017		jcorrea		Creates Item Fulfillment after receiving XML data
 * 			Sep 16, 2017	jcorrea		Integrate code from debugger version
 *			Jan 9, 2019		ocorrea		Add support for vendorSku matching
 *			Oct 1, 2020		paolodl		Auto Shipped status for Pick, Pack, Ship
 *			Feb 8, 2021		paolodl		Add population for new date columns
 * 2.00		May 28, 2021	paolodl		Also check for line number
 */

/**
 *CTC_Create_Item_Fulfillment.js
 *@NApiVersion 2.x
 *@NModuleScope Public
 */

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/log',
    'N/xml',
    'N/https',
    'N/runtime',
    'N/format',
    'N/config',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js'
], function (
    search,
    runtime,
    rec,
    log,
    xml,
    https,
    runtime,
    format,
    config,
    vcGlobals,
    constants,
    vcLog
) {
    var dateFormat;

    function execute() {}

    function _printerFriendlyLines(options) {
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
    }

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemFulfillments(options) {
        //			po_ID, so_ID, lineData, vendor
        var mainConfig = options.mainConfig,
            vendorConfig = options.vendorConfig,
            po_ID = options.poId,
            so_ID = options.soId,
            lineData = options.lineData,
            vendor = options.vendor;
        /******
			 lineData definition {	line_num:"NA",
									item_num = "NA',1
									order_num:"NA",
									order_date:"NA",
									order_eta:"NA",
									ship_qty:"NA",
									ship_date:"NA",
									tracking_num:"NA",
									carrier:"NA",
									serial_num:"NA"};
			 ***/

        /*** CONSTANTS - Custom IDs ***/
        //		var PO_TYPE_FIELD_ID = "custbody16";
        //		var PO_SO_Line_Numbers = "customsearch948"
        //			var PO_Valid_Date = '9/19/2017';
        var PO_Valid_Date = vendorConfig.startDate;

        log.debug({
            title: 'updateItemFulfillments`',
            details: 'so_ID = ' + so_ID
        });
        log.debug({
            title: 'updateItemFulfillments`',
            details: 'vendor = ' + vendor + ' lineData = ' + JSON.stringify(lineData)
        });

        if (!validatePODate(po_ID, PO_Valid_Date)) {
            return false;
        }

        if (lineData != null && lineData.length > 0) {
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
            var numPrefix = vendorConfig.fulfillmentPrefix;
            if (!numPrefix) return false;
            //				switch (vendor) {
            //					case "Synnex":			numPrefix = 'SY';
            //						break;
            //
            //					case "Ingram Micro":	numPrefix = 'IM';
            //						break;
            //
            //					case "Tech Data":		numPrefix = 'TD';
            //						break;
            //
            //					case "D & H":			numPrefix = 'DH';
            //						break;
            //
            //					default:				log.error({
            //						title: 'updateItemFulfillments`',
            //						details: 'Vendor not supported. vendor = '+vendor
            //					});
            //						return false;
            //				}

            var fulfillmentOrders = [];
            // Build a non-repeating array of order nums
            for (var i = 0; i < lineData.length; i++) {
                if (lineData[i].order_num && fulfillmentOrders.indexOf(lineData[i].order_num) < 0)
                    fulfillmentOrders.push(lineData[i].order_num);
            }

            log.debug({
                title: 'fulfillmentOrders`',
                details: ' fulfillmentOrders = ' + JSON.stringify(fulfillmentOrders)
            });

            var responseData = [];

            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            for (var j = 0; j < fulfillmentOrders.length; j++) {
                if (!orderExists(numPrefix + fulfillmentOrders[j])) {
                    var fulfillmentLines = [];
                    // Build an array with all XML line data with the same order num
                    for (var x = 0; x < lineData.length; x++) {
                        if (fulfillmentOrders[j] == lineData[x].order_num)
                            fulfillmentLines.push(lineData[x]);
                    }
                    log.debug({
                        title: 'fulfillmentLines`',
                        details: ' fulfillmentLines = ' + JSON.stringify(fulfillmentLines)
                    });

                    if (fulfillmentLines.length > 0) {
                        try {
                            // create item fulfillment from sales order
                            var objRecord = rec.transform({
                                fromType: rec.Type.SALES_ORDER,
                                fromId: so_ID,
                                toType: rec.Type.ITEM_FULFILLMENT,
                                isDynamic: true
                            });
                        } catch (err) {
                            log.error({
                                title: 'Create Item Fulfillment',
                                details:
                                    'Could not transform SO ID ' + so_ID + ' error = ' + err.message
                            });
                        }

                        if (objRecord != null) {
                            var rec_Changed = false;
                            var lineItemCount = objRecord.getLineCount({
                                sublistId: 'item'
                            });
                            // remove IF line if not in XML line date
                            for (var cnt = 0; cnt < lineItemCount; cnt++) {
                                var tempItemNum = objRecord.getSublistText({
                                    sublistId: 'item',
                                    fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL,
                                    line: cnt
                                });
                                var tempVendorSKU = '';
                                if (vcGlobals.VENDOR_SKU_LOOKUP_COL != null) {
                                    tempVendorSKU = objRecord.getSublistText({
                                        sublistId: 'item',
                                        fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
                                        line: cnt
                                    });
                                }

                                var tempItemPO = objRecord.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'createdpo',
                                    line: cnt
                                });
                                var tempItemLine = objRecord.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'poline',
                                    line: cnt
                                });
                                if (
                                    !itemInLineData(
                                        tempItemNum,
                                        fulfillmentLines,
                                        tempVendorSKU,
                                        mainConfig.ingramHashSpace,
                                        vendorConfig.xmlVendor,
                                        tempItemLine
                                    )
                                ) {
                                    // remove line from item fulfillment not in current fulfillmentLines
                                    log.debug({
                                        title: 'item not in fulfillment line, removing line from item fulfillment',
                                        details:
                                            'tempItemNum = ' + tempItemNum + ' line num = ' + cnt
                                    });

                                    removeIFLine(objRecord, cnt);
                                    rec_Changed = true;
                                } else if (tempItemPO != po_ID) {
                                    // remove line from item fulfillment if the item's PO is not the one being processed
                                    log.debug({
                                        title: 'item PO not the one being processed, removing line from item fulfillment',
                                        details: 'tempItemPO = ' + tempItemPO + ' po_ID = ' + po_ID
                                    });

                                    removeIFLine(objRecord, cnt);
                                    rec_Changed = true;
                                } else {
                                    log.debug({
                                        title: 'adding line to item fulfillment',
                                        details: 'objRecord = ' + objRecord.id + ' cnt = ' + cnt
                                    });

                                    addIFLine(objRecord, cnt);
                                    rec_Changed = true;
                                }
                            }
                            // Build a list of unique items with their total quantities shipped for this shipment
                            var uniqueItems = [];
                            log.debug('fulfillmentLines', fulfillmentLines);
                            for (var itemCnt = 0; itemCnt < fulfillmentLines.length; itemCnt++) {
                                var el = {
                                    item_num: '',
                                    totalShipped: '0',
                                    order_num: '',
                                    order_date: '',
                                    order_eta: '',
                                    ship_date: '',
                                    all_tracking_nums: '',
                                    carrier: '',
                                    all_serial_nums: ''
                                };

                                //									var tempItemLine;
                                //									try {
                                //										tempItemLine = objRecord.getSublistText({
                                //											sublistId: 'item',
                                //											fieldId: 'poline',
                                //											line: itemCnt
                                //										});
                                //									} catch (e) {
                                //										log.audit('WARN', 'poline not available');
                                //									}

                                if (
                                    !itemInLineData(
                                        fulfillmentLines[itemCnt].item_num,
                                        uniqueItems,
                                        '',
                                        mainConfig.ingramHashSpace,
                                        vendorConfig.xmlVendor,
                                        tempItemLine
                                    )
                                ) {
                                    el.item_num = fulfillmentLines[itemCnt].item_num;
                                    el.totalShipped = parseInt(fulfillmentLines[itemCnt].ship_qty);
                                    el.order_num = fulfillmentOrders[j];
                                    el.order_date = fulfillmentLines[itemCnt].order_date;
                                    el.order_eta = fulfillmentLines[itemCnt].order_eta;
                                    el.ship_date = fulfillmentLines[itemCnt].ship_date;

                                    var tempTrackingNums = Array();
                                    if (fulfillmentLines[itemCnt].tracking_num)
                                        tempTrackingNums = fulfillmentLines[itemCnt].tracking_num;
                                    if (typeof tempTrackingNums == 'string')
                                        tempTrackingNums =
                                            fulfillmentLines[itemCnt].tracking_num.split(',');
                                    for (
                                        var tnIndex = 0;
                                        tnIndex < tempTrackingNums.length;
                                        tnIndex++
                                    ) {
                                        if (
                                            el.all_tracking_nums.indexOf(
                                                tempTrackingNums[tnIndex]
                                            ) < 0
                                        ) {
                                            el.all_tracking_nums +=
                                                tempTrackingNums[tnIndex] + '\n';
                                        }
                                    }

                                    el.carrier = fulfillmentLines[itemCnt].carrier;

                                    var tempSerials = Array();
                                    if (fulfillmentLines[itemCnt].serial_num)
                                        tempSerials = fulfillmentLines[itemCnt].serial_num;
                                    if (typeof tempSerials == 'string')
                                        tempSerials =
                                            fulfillmentLines[itemCnt].serial_num.split(',');
                                    for (var snIndex = 0; snIndex < tempSerials.length; snIndex++) {
                                        if (el.all_serial_nums.indexOf(tempSerials[snIndex]) < 0) {
                                            el.all_serial_nums += tempSerials[snIndex] + '\n';
                                        }
                                    }

                                    uniqueItems.push(el);
                                } else {
                                    for (
                                        var uniqueIndex = 0;
                                        uniqueIndex < uniqueItems.length;
                                        uniqueIndex++
                                    ) {
                                        if (
                                            fulfillmentLines[itemCnt].item_num ==
                                            uniqueItems[uniqueIndex].item_num
                                        ) {
                                            uniqueItems[uniqueIndex].totalShipped += parseInt(
                                                fulfillmentLines[itemCnt].ship_qty
                                            );

                                            var tempTrackingNums = Array();
                                            if (fulfillmentLines[itemCnt].tracking_num)
                                                tempTrackingNums =
                                                    fulfillmentLines[itemCnt].tracking_num;
                                            if (typeof tempTrackingNums == 'string')
                                                tempTrackingNums =
                                                    fulfillmentLines[itemCnt].tracking_num.split(
                                                        ','
                                                    );
                                            for (
                                                var tnIndex = 0;
                                                tnIndex < tempTrackingNums.length;
                                                tnIndex++
                                            ) {
                                                if (
                                                    uniqueItems[
                                                        uniqueIndex
                                                    ].all_tracking_nums.indexOf(
                                                        tempTrackingNums[tnIndex]
                                                    ) < 0
                                                ) {
                                                    uniqueItems[uniqueIndex].all_tracking_nums +=
                                                        tempTrackingNums[tnIndex] + '\n';
                                                }
                                            }

                                            var tempSerials = Array();
                                            if (fulfillmentLines[itemCnt].serial_num)
                                                tempSerials = fulfillmentLines[itemCnt].serial_num;
                                            if (typeof tempSerials == 'string')
                                                tempSerials =
                                                    fulfillmentLines[itemCnt].serial_num.split(',');
                                            for (
                                                var snIndex = 0;
                                                snIndex < tempSerials.length;
                                                snIndex++
                                            ) {
                                                if (
                                                    uniqueItems[
                                                        uniqueIndex
                                                    ].all_serial_nums.indexOf(
                                                        tempSerials[snIndex]
                                                    ) < 0
                                                ) {
                                                    uniqueItems[uniqueIndex].all_serial_nums +=
                                                        tempSerials[snIndex] + '\n';
                                                }
                                            }
                                            break;
                                        }
                                    }
                                }
                            }

                            // debug messages
                            /* 								uniqueItems.forEach(function(entry) {
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items item Num = '+entry.item_num
                                                                    });
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items totalShipped = '+entry.totalShipped
                                                                    });
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items order_num = '+entry.order_num
                                                                    });
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items all_tracking_nums = '+entry.all_tracking_nums
                                                                    });
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items carrier = '+entry.carrier
                                                                    });
                                                                    log.debug({
                                                                        title: 'Create Item Fulfillment',
                                                                        details: 'Unique items all_serial_nums = '+entry.all_serial_nums
                                                                    });
                                                                });

                                 */
                            var lineItemCount2 = objRecord.getLineCount({
                                sublistId: 'item'
                            });

                            var recordLines = [];
                            // loop through all items in item fulfillment
                            for (var cnt2 = 0; cnt2 < lineItemCount2; cnt2++) {
                                objRecord.selectLine({
                                    sublistId: 'item',
                                    line: cnt2
                                });
                                var received2 = objRecord.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'itemreceive'
                                });
                                // if item has not been removed (item receive flag set to false)
                                if (received2) {
                                    var item = {
                                        item_num: '',
                                        totalShipped: '0',
                                        order_num: '',
                                        order_date: '',
                                        order_eta: '',
                                        ship_date: '',
                                        all_tracking_nums: '',
                                        carrier: '',
                                        all_serial_nums: ''
                                    };
                                    var currItemNum = objRecord.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL
                                    });
                                    var currItemQty = parseInt(
                                        objRecord.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'quantity'
                                        })
                                    );

                                    var currVendorSKU = '';
                                    if (vcGlobals.VENDOR_SKU_LOOKUP_COL) {
                                        currVendorSKU = objRecord.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL
                                        });
                                    }

                                    var tempItemLine = objRecord.getSublistText({
                                        sublistId: 'item',
                                        fieldId: 'poline',
                                        line: cnt2
                                    });

                                    for (var tmp2 = 0; tmp2 < uniqueItems.length; tmp2++) {
                                        if (
                                            !uniqueItems[tmp2].line_num ||
                                            uniqueItems[tmp2].line_num == 'NA' ||
                                            uniqueItems[tmp2].line_num == tempItemLine
                                        ) {
                                            if (
                                                currItemNum == uniqueItems[tmp2].item_num ||
                                                (currVendorSKU != '' &&
                                                    currVendorSKU == uniqueItems[tmp2].vendorSKU)
                                            ) {
                                                if (
                                                    currItemQty <
                                                    parseInt(uniqueItems[tmp2].totalShipped)
                                                ) {
                                                    uniqueItems[tmp2].totalShipped -=
                                                        parseInt(currItemQty);

                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_num,
                                                        'custcol_ctc_xml_dist_order_num'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_date,
                                                        'custcol_ctc_xml_date_order_placed'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_eta,
                                                        'custcol_ctc_xml_eta'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].ship_date,
                                                        'custcol_ctc_xml_ship_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].carrier,
                                                        'custcol_ctc_xml_carrier'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].order_eta
                                                        }),
                                                        'custcol_ctc_vc_eta_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].order_date
                                                        }),
                                                        'custcol_ctc_vc_order_placed_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].ship_date
                                                        }),
                                                        'custcol_ctc_vc_shipped_date'
                                                    );

                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_eta_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                                    //														rec: objRecord
                                                    //													});
                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_order_placed_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                                    //														rec: objRecord
                                                    //													});
                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_shipped_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                                    //														rec: objRecord
                                                    //													});

                                                    rec_Changed = true;

                                                    if (
                                                        uniqueItems[tmp2].all_serial_nums.length > 0
                                                    ) {
                                                        var tempSerials = '';
                                                        var tempSerials2 = '';
                                                        var snSplit =
                                                            uniqueItems[tmp2].all_serial_nums.split(
                                                                '\n'
                                                            );
                                                        for (
                                                            var tempCount = 0;
                                                            tempCount < snSplit.length;
                                                            tempCount++
                                                        ) {
                                                            if (tempCount < parseInt(currItemQty))
                                                                tempSerials +=
                                                                    snSplit.shift() + '\n';
                                                            else break;
                                                        }
                                                        // reset Unique serial nums to whatever is left after processing current line
                                                        for (
                                                            var i2 = 0;
                                                            i2 < snSplit.length;
                                                            i2++
                                                        ) {
                                                            if (snSplit[i2].length > 0)
                                                                tempSerials2 += snSplit[i2] + '\n';
                                                        }
                                                        uniqueItems[tmp2].all_serial_nums =
                                                            tempSerials2;

                                                        objRecord.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: 'custcol_ctc_xml_serial_num',
                                                            value: tempSerials
                                                        });

                                                        item = {
                                                            item_num: currItemNum,
                                                            totalShipped: currItemQty,
                                                            order_num: uniqueItems[tmp2].order_num,
                                                            order_date:
                                                                uniqueItems[tmp2].order_date,
                                                            order_eta: uniqueItems[tmp2].order_eta,
                                                            ship_date: uniqueItems[tmp2].ship_date,
                                                            //															"all_tracking_nums": "",
                                                            carrier: uniqueItems[tmp2].carrier,
                                                            all_serial_nums: tempSerials
                                                        };
                                                        recordLines.push(item);

                                                        objRecord.commitLine({ sublistId: 'item' });
                                                    }
                                                } else if (
                                                    parseInt(uniqueItems[tmp2].totalShipped) == 0
                                                ) {
                                                    objRecord.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'itemreceive',
                                                        value: false
                                                    });
                                                    objRecord.commitLine({ sublistId: 'item' });
                                                    rec_Changed = true;
                                                } else {
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_num,
                                                        'custcol_ctc_xml_dist_order_num'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_date,
                                                        'custcol_ctc_xml_date_order_placed'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].order_eta,
                                                        'custcol_ctc_xml_eta'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].ship_date,
                                                        'custcol_ctc_xml_ship_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        uniqueItems[tmp2].carrier,
                                                        'custcol_ctc_xml_carrier'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].order_eta
                                                        }),
                                                        'custcol_ctc_vc_eta_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].order_date
                                                        }),
                                                        'custcol_ctc_vc_order_placed_date'
                                                    );
                                                    updateXMLField(
                                                        objRecord,
                                                        parseDate({
                                                            dateString: uniqueItems[tmp2].ship_date
                                                        }),
                                                        'custcol_ctc_vc_shipped_date'
                                                    );

                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_eta_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                                    //														rec: objRecord
                                                    //													});
                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_order_placed_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                                    //														rec: objRecord
                                                    //													});
                                                    //													setColumnDate({
                                                    //														fieldId: 'custcol_ctc_vc_shipped_date',
                                                    //														value: parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                                    //														rec: objRecord
                                                    //													});

                                                    objRecord.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'quantity',
                                                        value: parseInt(
                                                            uniqueItems[tmp2].totalShipped
                                                        )
                                                    });
                                                    objRecord.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_ctc_xml_serial_num',
                                                        value: uniqueItems[tmp2].all_serial_nums
                                                    });

                                                    item = {
                                                        item_num: currItemNum,
                                                        totalShipped: currItemQty,
                                                        order_num: uniqueItems[tmp2].order_num,
                                                        order_date: uniqueItems[tmp2].order_date,
                                                        order_eta: uniqueItems[tmp2].order_eta,
                                                        ship_date: uniqueItems[tmp2].ship_date,
                                                        //															"all_tracking_nums": "",
                                                        carrier: uniqueItems[tmp2].carrier,
                                                        all_serial_nums: tempSerials
                                                    };
                                                    recordLines.push(item);

                                                    uniqueItems[tmp2].totalShipped = 0;
                                                    uniqueItems[tmp2].all_serial_nums = '';
                                                    objRecord.commitLine({ sublistId: 'item' });
                                                    rec_Changed = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            log.debug('recordLines', recordLines);

                            if (recordLines)
                                vcLog.recordLog({
                                    header: 'Fulfillment Lines',
                                    body: _printerFriendlyLines({ recordLines: recordLines }),
                                    transaction: po_ID,
                                    status: constants.Lists.VC_LOG_STATUS.INFO
                                });

                            var lineItemCountX = objRecord.getLineCount({
                                sublistId: 'item'
                            });
                            log.debug({
                                title: 'Before Item Fulfillment save',
                                details: 'Item line count = ' + lineItemCountX
                            });

                            for (var tmp3 = 0; tmp3 < uniqueItems.length; tmp3++) {
                                var found = false;
                                if (
                                    vcGlobals.VENDOR_SKU_LOOKUP_COL &&
                                    uniqueItems[tmp3].vendorSKU != 'NA'
                                ) {
                                    var index = objRecord.findSublistLineWithValue({
                                        sublistId: 'item',
                                        fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
                                        value: uniqueItems[tmp3].vendorSKU
                                    });

                                    if (index >= 0) {
                                        found = true;
                                        objRecord.selectLine({
                                            sublistId: 'item',
                                            line: index
                                        });
                                        objRecord.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_ctc_xml_tracking_num',
                                            value: uniqueItems[tmp3].all_tracking_nums
                                        });
                                        objRecord.commitLine({ sublistId: 'item' });
                                        rec_Changed = true;
                                    }
                                }
                                if (!found) {
                                    var index = objRecord.findSublistLineWithValue({
                                        sublistId: 'item',
                                        fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL,
                                        value: uniqueItems[tmp3].item_num
                                    });

                                    if (index >= 0) {
                                        objRecord.selectLine({
                                            sublistId: 'item',
                                            line: index
                                        });
                                        objRecord.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_ctc_xml_tracking_num',
                                            value: uniqueItems[tmp3].all_tracking_nums
                                        });
                                        objRecord.commitLine({ sublistId: 'item' });
                                        rec_Changed = true;
                                    }
                                }
                            }

                            try {
                                if (rec_Changed) {
                                    if (vcGlobals.PICK_PACK_SHIP)
                                        objRecord.setValue({
                                            fieldId: 'shipstatus',
                                            value: 'C'
                                        });

                                    objRecord.setValue({
                                        fieldId: 'custbody_ctc_if_vendor_order_match',
                                        value: numPrefix + fulfillmentOrders[j],
                                        ignoreFieldChange: true
                                    });

                                    var lineItemCountX = objRecord.getLineCount({
                                        sublistId: 'item'
                                    });
                                    log.debug({
                                        title: 'Before Item Fulfillment save',
                                        details: 'Item line count = ' + lineItemCountX
                                    });

                                    var objId = objRecord.save({
                                        enableSourcing: false,
                                        ignoreMandatoryFields: true
                                    });
                                    responseData.push({
                                        id: objId,
                                        orderNum: fulfillmentOrders[j]
                                    });
                                } else {
                                    var objId = objRecord.id;
                                    responseData.push({
                                        id: objId,
                                        orderNum: fulfillmentOrders[j]
                                    });
                                }
                            } catch (err) {
                                log.error({
                                    title: 'Create Item Fulfillment',
                                    details:
                                        'Could not save item fulfillment error = ' + err.message
                                });
                            }
                        }
                    }
                }
            }
            return responseData;
        }

        function validatePODate(po_ID, PO_Valid_Date) {
            log.debug({
                title: 'Create Item Fulfillment',
                details: 'validatePODate ppo id = ' + po_ID
            });

            if (!isEmpty(po_ID)) {
                var d1 = Date.parse(PO_Valid_Date);
                var isValid = false;
                var searchId = runtime.getCurrentScript().getParameter('custscript_searchid2');

                var filters = search.createFilter({
                    name: 'internalid',
                    operator: search.Operator.IS,
                    values: po_ID
                });
                var mySearch = search.load({ id: searchId });
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
                        if (!isEmpty(docDate)) {
                            var d2 = Date.parse(docDate);
                            if (d1 < d2) {
                                isValid = true;
                            }
                        }
                    }
                });
            }
            log.debug({
                title: 'Create Item Fulfillment',
                details: 'LEAVING validatePODate ppo id = ' + po_ID + ' isValid = ' + isValid
            });

            return isValid;
        }

        function orderExists(transID) {
            log.debug({
                title: 'Create Item Fulfillment',
                details: 'order exists transid = ' + transID
            });

            var filters = search.createFilter({
                name: 'custbody_ctc_if_vendor_order_match',
                operator: search.Operator.IS,
                values: transID
            });
            var mySearch = search.load({ id: 'customsearch_ctc_if_vendor_orders' });
            mySearch.filters.push(filters);
            // If order num already exists do nothing
            var found = false;
            mySearch.run().each(function (result) {
                found = true;
            });
            log.debug({
                title: 'Create Item Fulfillment',
                details: 'LEAVING order exists transid = ' + transID + ' found = ' + found
            });

            return found;
        }

        function itemInLineData(
            tempItemNum,
            lineData,
            tempVendorSKU,
            hashSpace,
            xmlVendor,
            tempItemLine
        ) {
            log.debug('tempItemNum ' + tempItemNum + ' |tempVendorSKU ' + tempVendorSKU, lineData);
            var vendorList = constants.Lists.XML_VENDOR;
            var isInData = false;
            for (var i = 0; i < lineData.length; i++) {
                //					log.debug(tempItemNum + ' = ' + lineData[i].item_num, tempVendorSKU + ' = ' + lineData[i].vendorSKU);
                // 2.00
                if (
                    lineData[i] &&
                    (!lineData[i].line_num ||
                        lineData[i].line_num == 'NA' ||
                        !tempItemLine ||
                        lineData[i].line_num == tempItemLine ||
                        tempItemNum == lineData[i].item_num)
                ) {
                    if (tempVendorSKU) {
                        if (
                            tempVendorSKU == lineData[i].vendorSKU ||
                            tempVendorSKU == lineData[i].item_num
                        ) {
                            //log.debug('matched vendor sku for line '+i)
                            isInData = true;
                            break;
                        }

                        //Ingram Hash replacement
                        if (
                            hashSpace &&
                            (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                                xmlVendor == vendorList.INGRAM_MICRO)
                        ) {
                            if (lineData[i].vendorSKU.replace('#', ' ') == tempVendorSKU) {
                                isInData = true;
                                break;
                            }
                        }
                    }
                    log.debug(
                        tempItemNum == lineData[i].item_num,
                        tempItemNum + ' = ' + lineData[i].item_num
                    );
                    if (tempItemNum == lineData[i].item_num) {
                        isInData = true;
                        break;
                    }

                    //Ingram Hash replacement
                    if (
                        hashSpace &&
                        (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                            xmlVendor == vendorList.INGRAM_MICRO)
                    ) {
                        if (lineData[i].item_num.replace('#', ' ') == tempItemNum) {
                            isInData = true;
                            break;
                        }
                    }
                }
            }
            return isInData;
        }

        function updateXMLField(rec, fieldVal, fieldID) {
            if (!isEmpty(fieldVal)) {
                rec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID,
                    value: fieldVal
                });
                rec.commitLine({ sublistId: 'item' });
            }
        }

        function removeIFLine(rec, lineNum) {
            rec.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: false
            });
            rec.commitLine({ sublistId: 'item' });
        }
        function addIFLine(rec, lineNum) {
            rec.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: true
            });
            rec.commitLine({ sublistId: 'item' });
        }

        /**
         * Evaluate if the given string or object value is empty, null or undefined.
         *
         * @param {String}
         *                stValue - string or object to evaluate
         * @returns {Boolean} - true if empty/null/undefined, false if not
         * @author mmeremilla
         */

        function isEmpty(stValue) {
            if (stValue == '' || stValue == null || stValue == undefined) {
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
        }

        function parseDate(options) {
            var dateString = options.dateString,
                date;

            if (!dateFormat) {
                var generalPref = config.load({
                    type: config.Type.COMPANY_PREFERENCES
                });
                dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
                log.debug('dateFormat', dateFormat);
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

                date = format.format({
                    value: date,
                    type: dateFormat ? dateFormat : format.Type.DATE
                });
            }

            return date;
        }

        function setColumnDate(options) {
            var fieldId = options.fieldId,
                value = options.value,
                rec = options.rec;

            log.debug('setcolumndate ' + fieldId, value);
            if (value && value.length > 0)
                rec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldId,
                    value: value
                });
        }
    }

    return {
        updateIF: updateItemFulfillments
    };
});
