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
 * 2.01		Mar 21, 2022	ccanaria	Add functionality for package
 * 2.02		Mar 31, 2022	ccanaria	Add functionality to put serials using standard inventiory details
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
    'N/xml',
    'N/format',
    'N/config',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js'
], function (search, runtime, rec, xml, format, config, vcGlobals, constants, vcLog, vc2Utils) {
    var LogTitle = 'Create-ItemFF',
        LogPrefix = '';

    var PO_ID, dateFormat;

    var Helper = {
        validatePODate: function (po_ID, PO_Valid_Date) {
            var logTitle = [LogTitle, 'validatePODate'].join('::');
            log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify([po_ID, PO_Valid_Date]));

            var isValid = false;

            if (!Helper.isEmpty(po_ID)) {
                var d1 = Date.parse(PO_Valid_Date);
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
                LogPrefix + 'is Valid PO Date ? ' + JSON.stringify([po_ID, isValid])
            );

            return isValid;
        },

        orderExists: function (transID) {
            var logTitle = [LogTitle, 'orderExists'].join('::');
            // log.audit(logTitle, '>> ..order exists transid: ' + JSON.stringify(transID));

            var filters = search.createFilter({
                name: 'custbody_ctc_if_vendor_order_match',
                operator: search.Operator.IS,
                values: transID
            });
            var mySearch = search.load({ id: 'customsearch_ctc_if_vendor_orders' });
            mySearch.filters.push(filters);
            // If order num already exists do nothing
            var found = false,
                foundId;
            mySearch.run().each(function (result) {
                found = true;
                foundId = result.id;
                return true;
            });

            log.audit(
                logTitle,
                LogPrefix + '.... is Order Exists ? ' + JSON.stringify([transID, foundId, found])
            );

            return found;
        },

        itemInLineData: function (
            tempItemNum,
            lineData,
            tempVendorSKU,
            hashSpace,
            xmlVendor,
            tempItemLine,
            tempDAndH
        ) {
            var logTitle = [LogTitle, 'itemInLineData'].join('::');
            log.audit(
                logTitle,
                LogPrefix +
                    '>> params: ' +
                    JSON.stringify({
                        tempItemNum: tempItemNum,
                        tempVendorSKU: tempVendorSKU,
                        hashSpace: hashSpace,
                        xmlVendor: xmlVendor,
                        tempItemLine: tempItemLine,
                        tempDAndH: tempDAndH
                    })
            );

            var vendorList = constants.Lists.XML_VENDOR;
            var isInData = false;
            for (var i = 0; i < lineData.length; i++) {
                if (!lineData[i]) continue;

                // 2.00
                if (
                    !lineData[i].line_num || //note: ??
                    lineData[i].line_num == 'NA' || //note: ??
                        !tempItemLine ||
                        lineData[i].line_num == tempItemLine ||
                    tempItemNum == lineData[i].item_num ||
                    vc2Utils.inArray(tempItemNum, [
                        lineData[i].item_num,
                        lineData[i].item_num_alt,
                        lineData[i].vendorSKU
                    ]) ||
                    vc2Utils.inArray(tempVendorSKU, [
                        lineData[i].item_num,
                        lineData[i].item_num_alt,
                        lineData[i].vendorSKU
                    ])
                ) {
                    if (tempVendorSKU) {
                        if (
                            tempVendorSKU == lineData[i].vendorSKU ||
                            tempVendorSKU == lineData[i].item_num_alt ||
                            tempVendorSKU == lineData[i].item_num
                        ) {
                            //log.debug('matched vendor sku for line '+i)
                            isInData = true;
                        }

                        //Ingram Hash replacement
                        if (
                            hashSpace &&
                            (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                                xmlVendor == vendorList.INGRAM_MICRO)
                        ) {
                            if (lineData[i].vendorSKU.replace('#', ' ') == tempVendorSKU) {
                                isInData = true;
                            }
                        }
                    }
                    log.debug(
                        tempItemNum == lineData[i].item_num,
                        tempItemNum + ' = ' + lineData[i].item_num
                    );
                    if (
                        tempItemNum == lineData[i].item_num ||
                        tempItemNum == lineData[i].item_num_alt
                    ) {
                        isInData = true;
                    }

                    //Ingram Hash replacement
                    if (
                        hashSpace &&
                        (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                            xmlVendor == vendorList.INGRAM_MICRO)
                    ) {
                        if (lineData[i].item_num.replace('#', ' ') == tempItemNum) {
                            isInData = true;
                        }
                    }

                    //D&H Item replacement
                    if (tempDAndH == lineData[i].item_num && xmlVendor == vendorList.DandH) {
                        isInData = true;
                    }
                }

                if (isInData) {
                    log.audit(
                        logTitle,
                        LogPrefix + '... found line data: ' + JSON.stringify(lineData[i])
                    );
                        break;
                    }
                }

            log.audit(logTitle, LogPrefix + '... is itemInLineData? ' + JSON.stringify(isInData));

            return isInData;
        },

        updateXMLField: function (rec, fieldVal, fieldID) {
            var logTitle = [LogTitle, 'updateXMLField'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> : ' + JSON.stringify([fieldVal, fieldID]));

            if (!Helper.isEmpty(fieldVal)) {
                rec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID,
                    value: fieldVal
                });
                rec.commitLine({ sublistId: 'item' });
            }
        },

        removeIFLine: function (rec, lineNum) {
            var logTitle = [LogTitle, 'removeIFLine'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> remove line: ' + JSON.stringify(lineNum));

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
        },

        addIFLine: function (rec, lineNum) {
            var logTitle = [LogTitle, 'addIFLine'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> add line: ' + JSON.stringify(lineNum));

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
        },

        isEmpty: function (stValue) {
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
        },

        parseDate: function (options) {
            var dateString = options.dateString,
                date;

            if (!dateFormat) {
                var generalPref = config.load({
                    type: config.Type.COMPANY_PREFERENCES
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

                date = format.format({
                    value: date,
                    type: dateFormat ? dateFormat : format.Type.DATE
                });
            }

            return date;
        },

        setColumnDate: function (options) {
            var fieldId = options.fieldId,
                value = options.value,
                rec = options.rec;

            // log.debug('setcolumndate ' + fieldId, value);
            if (value && value.length > 0)
                rec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldId,
                    value: value
                });
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
                transaction: PO_ID,
                header: ['Create Fulfillment', option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? Helper.extractError(option.error) : option.errorMsg),

                status:
                    option.status ||
                    (option.error
                        ? constants.Lists.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? constants.Lists.VC_LOG_STATUS.SUCCESS
                        : constants.Lists.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, LogPrefix + '::' + JSON.stringify(logOption));
            vcLog.recordLog(logOption);
            return true;
        },

        // Added by Clemen - 03/18/2022
        getSerials: function (soId, itemId) {
            var retVal;

            var customrecordserialnumSearchObj = search.create({
                type: 'customrecordserialnum',
                filters: [
                    ['custrecordserialsales', 'is', soId],
                    'AND',
                    ['custrecordserialitem', 'is', itemId]
                ],
                columns: ['name']
            });

            var snList = [];

            var searchResultCount = customrecordserialnumSearchObj.runPaged().count;
            log.debug('customrecordserialnumSearchObj result count', searchResultCount);

            for (var x = 0; x < searchResultCount; x += 1000) {
                var rangeStart = x;

                var searchResult = customrecordserialnumSearchObj.run().getRange({
                    start: rangeStart,
                    end: rangeStart + 1000
                });

                for (var i = 0; i < searchResult.length; i++) {
                    var snNum = searchResult[i].getValue({
                        name: 'name'
                    });
                    var snId = searchResult[i].id;

                    snList.push({
                        snNum: snNum,
                        snId: snId
                    });
                }
            }

            retVal = snList;

            return retVal;
        }
    };

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemFulfillments(options) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));
        //			po_ID, so_ID, lineData, vendor
        var mainConfig = options.mainConfig,
            vendorConfig = options.vendorConfig,
            po_ID = options.poId,
            so_ID = options.soId,
            lineData = options.lineData,
            vendor = options.vendor;

        PO_ID = po_ID;

        LogPrefix = '[purchaseorder:' + po_ID + ']';

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
        try {
            /*** CONSTANTS - Custom IDs ***/
            var PO_Valid_Date = vendorConfig.startDate;

            if (!Helper.validatePODate(po_ID, PO_Valid_Date)) {
                throw 'Invalid PO Date : ' + PO_Valid_Date;
            }

            if (lineData == null || !lineData.length) {
                throw 'Empty Line Data';
            }

            var numPrefix = vendorConfig.fulfillmentPrefix;
            if (!numPrefix) {
                throw 'Config Error: Missing Fulfillment Prefix';
            }

            lineData = Helper.sortLineData(lineData);

            var fulfillmentOrders = [];

            // Build a non-repeating array of order nums
            for (var i = 0; i < lineData.length; i++) {
                if (lineData[i].order_num && fulfillmentOrders.indexOf(lineData[i].order_num) < 0)
                    fulfillmentOrders.push(lineData[i].order_num);
            }

            log.audit(
                logTitle,
                LogPrefix + '>> fulfillmentOrders = ' + JSON.stringify(fulfillmentOrders)
            );

            var responseData = [];

            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            for (var j = 0; j < fulfillmentOrders.length; j++) {
                // skip any existing orders
                if (Helper.orderExists(numPrefix + fulfillmentOrders[j])) {
                    log.audit(logTitle, LogPrefix + '...order already exists');
                    continue;
                }

                var fulfillmentLines = [];

                // Build an array with all XML line data with the same order num
                for (var x = 0; x < lineData.length; x++) {
                    if (fulfillmentOrders[j] != lineData[x].order_num) continue;

                    log.audit(logTitle, '... verifying line data: ' + JSON.stringify(lineData[x]));
                    if (
                        lineData[x].hasOwnProperty('is_shipped') &&
                        lineData[x].is_shipped === false
                    ) {
                        log.audit(logTitle, '......skipping line: not yet shipped');
                        continue;
                    }

                    log.audit(logTitle, '... adding to fulfillment lines');
                        fulfillmentLines.push(lineData[x]);
                }

                log.audit(
                    logTitle,
                    LogPrefix + '>> fulfillmentLines = ' + JSON.stringify(fulfillmentLines)
                );
                if (!fulfillmentLines.length) {
                    log.audit(logTitle, LogPrefix + '** No items to fulfill ** ');
                    continue;
                }

                var objRecord;

                log.audit(logTitle, LogPrefix + '****  Transform to Fulfillment ****');

                try {
                    // create item fulfillment from sales order
                    objRecord = rec.transform({
                        fromType: rec.Type.SALES_ORDER,
                        fromId: so_ID,
                        toType: rec.Type.ITEM_FULFILLMENT,
                        isDynamic: true
                    });

                    log.audit(logTitle, LogPrefix + '...success');
                } catch (err) {
                    Helper.logMsg({
                        title: 'Transform Error on SO: ' + so_ID,
                        error: err
                    });

                    continue;
                }

                var rec_Changed = false;
                var lineItemCount = objRecord.getLineCount({
                    sublistId: 'item'
                });

                log.audit(logTitle, LogPrefix + '>> line count: ' + lineItemCount);

                var tempItemNum,
                    tempVendorSKU,
                    tempItemPO,
                    tempItemLine,
                    tempDAndH,
                    tempTrackingNums,
                    tempSerials;

                // remove IF line if not in XML line date
                for (var cnt = 0; cnt < lineItemCount; cnt++) {
                    tempItemNum = objRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL,
                        line: cnt
                    });
                    tempVendorSKU = '';

                    if (vcGlobals.VENDOR_SKU_LOOKUP_COL != null) {
                        tempVendorSKU = objRecord.getSublistText({
                            sublistId: 'item',
                            fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
                            line: cnt
                        });
                    }

                    tempItemPO = objRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'createdpo',
                        line: cnt
                    });
                    tempItemLine = objRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: 'poline',
                        line: cnt
                    });
                    tempDAndH = objRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: constants.Columns.DH_MPN,
                        line: cnt
                    });

                    log.audit(
                        logTitle,
                        '..line values: ' +
                            JSON.stringify({
                                tempItemNum: tempItemNum,
                                tempVendorSKU: tempVendorSKU,
                                tempItemPO: tempItemPO,
                                tempItemLine: tempItemLine,
                                tempDAndH: tempDAndH
                            })
                    );

                    if (
                        !Helper.itemInLineData(
                            tempItemNum,
                            fulfillmentLines,
                            tempVendorSKU,
                            mainConfig.ingramHashSpace,
                            vendorConfig.xmlVendor,
                            tempItemLine,
                            tempDAndH
                        )
                    ) {
                        // remove line from item fulfillment not in current fulfillmentLines
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '.... item not in fulfillment line, removing line from item fulfillment: ' +
                                JSON.stringify({
                                    tempItemNum: tempItemNum,
                                    lineCnt: cnt
                                })
                        );

                        Helper.removeIFLine(objRecord, cnt);
                        rec_Changed = true;
                    } else if (tempItemPO != po_ID) {
                        // remove line from item fulfillment if the item's PO is not the one being processed
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '.... item PO not the one being processed, removing line from item fulfillment: ' +
                                JSON.stringify({
                                    tempItemPO: tempItemPO,
                                    po_ID: po_ID
                                })
                        );

                        Helper.removeIFLine(objRecord, cnt);

                        rec_Changed = true;
                    } else {
                        log.audit(logTitle, LogPrefix + '.... adding line to item fulfillment.');
                        Helper.addIFLine(objRecord, cnt);
                        rec_Changed = true;
                    }
                }
                // Build a list of unique items with their total quantities shipped for this shipment
                log.audit(
                    logTitle,
                    LogPrefix + '>>> Collect all items and add up the quantities....'
                );
                var uniqueItems = [];
                log.audit(
                    logTitle,
                    LogPrefix + '>> fulfillmentLines: ' + JSON.stringify(fulfillmentLines)
                );

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

                    if (
                        !Helper.itemInLineData(
                            fulfillmentLines[itemCnt].item_num,
                            uniqueItems,
                            '',
                            mainConfig.ingramHashSpace,
                            vendorConfig.xmlVendor,
                            tempItemLine,
                            tempDAndH
                        )
                    ) {
                        el.item_num = fulfillmentLines[itemCnt].item_num;
                        el.totalShipped = parseInt(fulfillmentLines[itemCnt].ship_qty);
                        el.order_num = fulfillmentOrders[j];
                        el.order_date = fulfillmentLines[itemCnt].order_date;
                        el.order_eta = fulfillmentLines[itemCnt].order_eta;
                        el.ship_date = fulfillmentLines[itemCnt].ship_date;

                        tempTrackingNums = Array();
                        if (fulfillmentLines[itemCnt].tracking_num)
                            tempTrackingNums = fulfillmentLines[itemCnt].tracking_num;
                        if (typeof tempTrackingNums == 'string')
                            tempTrackingNums = fulfillmentLines[itemCnt].tracking_num.split(',');
                        for (var tnIndex = 0; tnIndex < tempTrackingNums.length; tnIndex++) {
                            if (el.all_tracking_nums.indexOf(tempTrackingNums[tnIndex]) < 0) {
                                el.all_tracking_nums += tempTrackingNums[tnIndex] + '\n';
                            }
                        }

                        el.carrier = fulfillmentLines[itemCnt].carrier;

                        tempSerials = Array();
                        if (fulfillmentLines[itemCnt].serial_num)
                            tempSerials = fulfillmentLines[itemCnt].serial_num;
                        if (typeof tempSerials == 'string')
                            tempSerials = fulfillmentLines[itemCnt].serial_num.split(',');
                        for (var snIndex = 0; snIndex < tempSerials.length; snIndex++) {
                            if (el.all_serial_nums.indexOf(tempSerials[snIndex]) < 0) {
                                el.all_serial_nums += tempSerials[snIndex] + '\n';
                            }
                        }

                        uniqueItems.push(el);

                        log.audit(
                            logTitle,
                            LogPrefix + ' ... added line data - ' + JSON.stringify(el)
                        );
                    } else {
                        for (var uniqueIndex = 0; uniqueIndex < uniqueItems.length; uniqueIndex++) {
                            if (
                                fulfillmentLines[itemCnt].item_num ==
                                uniqueItems[uniqueIndex].item_num
                            ) {
                                uniqueItems[uniqueIndex].totalShipped += parseInt(
                                    fulfillmentLines[itemCnt].ship_qty
                                );

                                tempTrackingNums = Array();
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
                                        uniqueItems[uniqueIndex].all_tracking_nums.indexOf(
                                            tempTrackingNums[tnIndex]
                                        ) < 0
                                    ) {
                                        uniqueItems[uniqueIndex].all_tracking_nums +=
                                            tempTrackingNums[tnIndex] + '\n';
                                    }
                                }

                                tempSerials = Array();
                                if (fulfillmentLines[itemCnt].serial_num)
                                    tempSerials = fulfillmentLines[itemCnt].serial_num;
                                if (typeof tempSerials == 'string')
                                    tempSerials = fulfillmentLines[itemCnt].serial_num.split(',');
                                for (var snIndex = 0; snIndex < tempSerials.length; snIndex++) {
                                    if (
                                        uniqueItems[uniqueIndex].all_serial_nums.indexOf(
                                            tempSerials[snIndex]
                                        ) < 0
                                    ) {
                                        uniqueItems[uniqueIndex].all_serial_nums +=
                                            tempSerials[snIndex] + '\n';
                                    }
                                }

                                log.audit(
                                    logTitle,
                                    LogPrefix +
                                        ' ... updated line data - ' +
                                        JSON.stringify(uniqueItems[uniqueIndex])
                                );
                                break;
                            }
                        }
                    }
                }
                log.audit(
                    logTitle,
                    LogPrefix + ' ... uniqueItems - ' + JSON.stringify(uniqueItems)
                );

                // debug messages
                // uniqueItems.forEach(function (entry) {
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items item Num = ' + entry.item_num
                //     });
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items totalShipped = ' + entry.totalShipped
                //     });
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items order_num = ' + entry.order_num
                //     });
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items all_tracking_nums = ' + entry.all_tracking_nums
                //     });
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items carrier = ' + entry.carrier
                //     });
                //     log.debug({
                //         title: 'Create Item Fulfillment',
                //         details: 'Unique items all_serial_nums = ' + entry.all_serial_nums
                //     });
                // });

                var lineItemCount2 = objRecord.getLineCount({
                    sublistId: 'item'
                });

                var recordLines = [];
                log.audit(logTitle, LogPrefix + '>>> Validate all the received line items....');

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

                        log.audit(
                            logTitle,
                            LogPrefix +
                                '... item/qty: ' +
                                JSON.stringify({
                                    currItemNum: currItemNum,
                                    currItemQty: currItemQty,
                                    itemField: vcGlobals.ITEM_FUL_ID_LOOKUP_COL
                                })
                        );

                        var currVendorSKU = '';
                        if (vcGlobals.VENDOR_SKU_LOOKUP_COL) {
                            currVendorSKU = objRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL
                            });
                        }

                        tempItemLine = objRecord.getSublistText({
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
                                    log.audit(
                                        logTitle,
                                        LogPrefix +
                                            '... unique item : ' +
                                            JSON.stringify(uniqueItems[tmp2])
                                    );

                                    if (currItemQty < parseInt(uniqueItems[tmp2].totalShipped)) {
                                        uniqueItems[tmp2].totalShipped -= parseInt(currItemQty);

                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_num,
                                            'custcol_ctc_xml_dist_order_num'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_date,
                                            'custcol_ctc_xml_date_order_placed'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_eta,
                                            'custcol_ctc_xml_eta'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].ship_date,
                                            'custcol_ctc_xml_ship_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].carrier,
                                            'custcol_ctc_xml_carrier'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].order_eta
                                            }),
                                            'custcol_ctc_vc_eta_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].order_date
                                            }),
                                            'custcol_ctc_vc_order_placed_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].ship_date
                                            }),
                                            'custcol_ctc_vc_shipped_date'
                                        );

                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_eta_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                        //     rec: objRecord
                                        // });
                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_order_placed_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                        //     rec: objRecord
                                        // });
                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_shipped_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                        //     rec: objRecord
                                        // });

                                        rec_Changed = true;

                                        if (uniqueItems[tmp2].all_serial_nums.length > 0) {
                                            var tempSerials = '';
                                            var tempSerials2 = '';
                                            var snSplit =
                                                uniqueItems[tmp2].all_serial_nums.split('\n');
                                            for (
                                                var tempCount = 0;
                                                tempCount < snSplit.length;
                                                tempCount++
                                            ) {
                                                if (tempCount < parseInt(currItemQty))
                                                    tempSerials += snSplit.shift() + '\n';
                                                else break;
                                            }
                                            // reset Unique serial nums to whatever is left after processing current line
                                            for (var i2 = 0; i2 < snSplit.length; i2++) {
                                                if (snSplit[i2].length > 0)
                                                    tempSerials2 += snSplit[i2] + '\n';
                                            }
                                            uniqueItems[tmp2].all_serial_nums = tempSerials2;

                                            objRecord.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_ctc_xml_serial_num',
                                                value: tempSerials
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

                                            /*** Start Clem - Serial functionality 1 ***/
                                            // Check if serialized
                                            var isSerialized = objRecord.getCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'isserial'
                                            });

                                            if (isSerialized || isSerialized === 'T') {
                                                // Check if DropShip PO
                                                var dropShipPO = objRecord.getCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'createpo'
                                                });

                                                if (!Helper.isEmpty(dropShipPO)) {
                                                    //Check if location is set on line level

                                                    var lineLoc = objRecord.getCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'location'
                                                    });

                                                    if (Helper.isEmpty(lineLoc)) {
                                                        //Use SO's header level Location
                                                        var locationLookup = search.lookupFields({
                                                            type: 'salesorder',
                                                            id: so_ID,
                                                            columns: ['location']
                                                        });

                                                        if (locationLookup) {
                                                            lineLoc =
                                                                locationLookup.location[0].value;
                                                        }
                                                    }

                                                    if (!Helper.isEmpty(lineLoc)) {
                                                        objRecord.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: 'location',
                                                            value: lineLoc
                                                        });

                                                        var itemId =
                                                            objRecord.getCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: 'item'
                                                            });

                                                        // Get Serial numbers associated with the line item
                                                        var snList = Helper.getSerials(
                                                            so_ID,
                                                            itemId
                                                        );
                                                        log.debug('snList', JSON.stringify(snList));

                                                        if (!Helper.isEmpty(snList)) {
                                                            var inventoryDetailRecord =
                                                                objRecord.getCurrentSublistSubrecord(
                                                                    {
                                                                        sublistId: 'item',
                                                                        fieldId: 'inventorydetail'
                                                                    }
                                                                );

                                                            for (
                                                                var y = 0;
                                                                y < snList.length;
                                                                y++
                                                            ) {
                                                                if (snList[y].snId > 0) {
                                                                    inventoryDetailRecord.selectLine(
                                                                        {
                                                                            sublistId:
                                                                                'inventoryassignment',
                                                                            line: y
                                                                        }
                                                                    );

                                                                    inventoryDetailRecord.setCurrentSublistValue(
                                                                        {
                                                                            sublistId:
                                                                                'inventoryassignment',
                                                                            fieldId:
                                                                                'receiptinventorynumber',
                                                                            value: snList[y].snNum
                                                                        }
                                                                    );

                                                                    inventoryDetailRecord.commitLine(
                                                                        {
                                                                            sublistId:
                                                                                'inventoryassignment'
                                                                        }
                                                                    );
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            /*** End Clem - Serial functionality 1 ***/

                                            objRecord.commitLine({
                                                sublistId: 'item'
                                            });
                                        }
                                    } else if (parseInt(uniqueItems[tmp2].totalShipped) == 0) {
                                        objRecord.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'itemreceive',
                                            value: false
                                        });
                                        objRecord.commitLine({ sublistId: 'item' });
                                        rec_Changed = true;
                                    } else {
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_num,
                                            'custcol_ctc_xml_dist_order_num'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_date,
                                            'custcol_ctc_xml_date_order_placed'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].order_eta,
                                            'custcol_ctc_xml_eta'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].ship_date,
                                            'custcol_ctc_xml_ship_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            uniqueItems[tmp2].carrier,
                                            'custcol_ctc_xml_carrier'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].order_eta
                                            }),
                                            'custcol_ctc_vc_eta_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].order_date
                                            }),
                                            'custcol_ctc_vc_order_placed_date'
                                        );
                                        Helper.updateXMLField(
                                            objRecord,
                                            Helper.parseDate({
                                                dateString: uniqueItems[tmp2].ship_date
                                            }),
                                            'custcol_ctc_vc_shipped_date'
                                        );

                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_eta_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                        //     rec: objRecord
                                        // });
                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_order_placed_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                        //     rec: objRecord
                                        // });
                                        // Helper.setColumnDate({
                                        //     fieldId: 'custcol_ctc_vc_shipped_date',
                                        //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                        //     rec: objRecord
                                        // });

                                        objRecord.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'quantity',
                                            value: parseInt(uniqueItems[tmp2].totalShipped)
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

                                        /*** Start Clem - Serial functionality 2 ***/
                                        // Check if serialized
                                        var isSerialized = objRecord.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'isserial'
                                        });

                                        if (isSerialized || isSerialized === 'T') {
                                            // Check if DropShip PO
                                            var dropShipPO = objRecord.getCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'createpo'
                                            });

                                            if (!Helper.isEmpty(dropShipPO)) {
                                                //Check if location is set on line level
                                                var lineLoc = objRecord.getCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'location'
                                                });

                                                if (Helper.isEmpty(lineLoc)) {
                                                    //Use SO's header level Location
                                                    var locationLookup = search.lookupFields({
                                                        type: 'salesorder',
                                                        id: so_ID,
                                                        columns: ['location']
                                                    });
                                                    log.audit(
                                                        'locationLookup',
                                                        JSON.stringify(locationLookup)
                                                    );

                                                    if (locationLookup) {
                                                        lineLoc = locationLookup.location[0].value;
                                                    }
                                                }

                                                if (!Helper.isEmpty(lineLoc)) {
                                                    objRecord.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'location',
                                                        value: lineLoc
                                                    });

                                                    var itemId = objRecord.getCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'item'
                                                    });

                                                    // Get Serial numbers associated with the line item
                                                    var snList = Helper.getSerials(so_ID, itemId);
                                                    log.debug('snList', JSON.stringify(snList));

                                                    if (!Helper.isEmpty(snList)) {
                                                        var inventoryDetailRecord =
                                                            objRecord.getCurrentSublistSubrecord({
                                                                sublistId: 'item',
                                                                fieldId: 'inventorydetail'
                                                            });

                                                        for (var y = 0; y < snList.length; y++) {
                                                            if (snList[y].snId > 0) {
                                                                inventoryDetailRecord.selectLine({
                                                                    sublistId:
                                                                        'inventoryassignment',
                                                                    line: y
                                                                });

                                                                inventoryDetailRecord.setCurrentSublistValue(
                                                                    {
                                                                        sublistId:
                                                                            'inventoryassignment',
                                                                        fieldId:
                                                                            'receiptinventorynumber',
                                                                        value: snList[y].snNum
                                                                    }
                                                                );

                                                                inventoryDetailRecord.commitLine({
                                                                    sublistId: 'inventoryassignment'
                                                                });
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        /*** End Clem - Serial functionality 2 ***/

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

                log.audit(logTitle, LogPrefix + '>> recordLines: ' + JSON.stringify(recordLines));

                if (recordLines)
                    Helper.logMsg({
                        status: constants.Lists.VC_LOG_STATUS.INFO,
                        title: 'Fulfillment Lines',
                        message: Helper.printerFriendlyLines({
                            recordLines: recordLines
                        })
                    });

                var lineItemCountX = objRecord.getLineCount({
                    sublistId: 'item'
                });
                log.audit(
                    logTitle,
                    LogPrefix +
                        '>> Before Item Fulfillment save : ' +
                        ('Item line count = ' + lineItemCountX)
                );

                for (var tmp3 = 0; tmp3 < uniqueItems.length; tmp3++) {
                    var found = false;
                    if (vcGlobals.VENDOR_SKU_LOOKUP_COL && uniqueItems[tmp3].vendorSKU != 'NA') {
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

                            /*** Start Clemen - Package 1***/
                            objRecord.selectLine({
                                sublistId: 'package',
                                line: tmp3
                            });

                            objRecord.setCurrentSublistValue({
                                sublistId: 'package',
                                fieldId: 'packagetrackingnumber',
                                value: uniqueItems[tmp3].all_tracking_nums
                            });

                            objRecord.commitLine({
                                sublistId: 'package'
                            });
                            /*** End Clemen - Package 1***/
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

                            /*** Start Clemen - Package 2***/
                            objRecord.selectLine({
                                sublistId: 'package',
                                line: tmp3
                            });

                            objRecord.setCurrentSublistValue({
                                sublistId: 'package',
                                fieldId: 'packagetrackingnumber',
                                value: uniqueItems[tmp3].all_tracking_nums
                            });

                            objRecord.commitLine({
                                sublistId: 'package'
                            });
                            /*** End Clemen - Package 2***/
                        }
                    }
                }

                try {
                    var objId;

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

                        log.audit(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('Item line count = ' + lineItemCountX)
                        );

                        log.emergency(
                            logTitle,
                            LogPrefix +
                                '**** ITEM FULFILLMENT CREATION ****' +
                                JSON.stringify(recordLines)
                        );

                        objId = objRecord.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                        responseData.push({
                            id: objId,
                            orderNum: fulfillmentOrders[j]
                        });
                    } else {
                        objId = objRecord.id;
                        responseData.push({
                            id: objId,
                            orderNum: fulfillmentOrders[j]
                        });
                    }

                    log.audit(
                        logTitle,
                        LogPrefix + '## Created Item Fulfillement: [itemfulfillment:' + objId + ']'
                    );

                    Helper.logMsg({
                        title: 'Create Fulfillment',
                        isSucces: true,
                        message: '## Created Item Fulfillement: [itemfulfillment:' + objId + ']'
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

    return {
        updateIF: updateItemFulfillments
    };
});
