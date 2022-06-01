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
 * 2.03		Apr 22, 2022	christian	Limit text serial numbers to 4000 chars
 * 2.05     May 2, 2022     brianff     moved the line location setting on the Helper
 *                                      removed the 'NA' on native serial settings
 *                                      fixed bug on determing unique line items to fulfill
 *                                      code cleanup, updated variable names
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
    'N/format',
    'N/config',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    ns_format,
    ns_config,
    vcGlobals,
    constants,
    vcLog,
    vc2Utils
) {
    var LogTitle = 'Create-ItemFF',
        LogPrefix = '',
        _TEXT_AREA_MAX_LENGTH = 4000;

    var PO_ID, dateFormat;

    var Helper = {
        validatePODate: function (po_ID, PO_Valid_Date) {
            var logTitle = [LogTitle, 'validatePODate'].join('::');
            log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify([po_ID, PO_Valid_Date]));

            var isValid = false;

            if (!Helper.isEmpty(po_ID)) {
                var d1 = Date.parse(PO_Valid_Date);
                var searchId = ns_runtime.getCurrentScript().getParameter('custscript_searchid2');

                var filters = ns_search.createFilter({
                    name: 'internalid',
                    operator: ns_search.Operator.IS,
                    values: po_ID
                });
                var mySearch = ns_search.load({ id: searchId });
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

            var filters = ns_search.createFilter({
                name: 'custbody_ctc_if_vendor_order_match',
                operator: ns_search.Operator.IS,
                values: transID
            });
            var mySearch = ns_search.load({ id: 'customsearch_ctc_if_vendor_orders' });
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
        itemInLineData: function (option) {
            var logTitle = [LogTitle, 'itemInLineData'].join('::');
            // log.audit(logTitle, LogPrefix + '>> params: ' + JSON.stringify(option));

            var vendorList = constants.Lists.XML_VENDOR;
            var isInData = false;

            var lineData = option.lineData,
                lineDataSet = option.lineDataSet,
                hashSpace = option.hashSpace,
                xmlVendor = option.vendor;

            for (var i = 0; i < lineDataSet.length; i++) {
                if (!lineDataSet[i]) continue;
                var fulfillLineData = lineDataSet[i];

                log.audit(
                    logTitle,
                    LogPrefix +
                        '>> lineToFind / currentLineData : ' +
                        JSON.stringify([lineData, fulfillLineData])
                );

                // 2.00
                if (
                    !fulfillLineData.line_num ||
                    fulfillLineData.line_num == 'NA' ||
                    !lineData.poLine ||
                    fulfillLineData.line_num == lineData.poLine ||
                    lineData.itemNum == fulfillLineData.item_num ||
                    vc2Utils.inArray(lineData.itemNum, [
                        fulfillLineData.item_num,
                        fulfillLineData.item_num_alt,
                        fulfillLineData.vendorSKU
                    ]) ||
                    vc2Utils.inArray(lineData.skuName, [
                        fulfillLineData.item_num,
                        fulfillLineData.item_num_alt,
                        fulfillLineData.vendorSKU
                    ])
                ) {
                    if (lineData.skuName) {
                        if (
                            lineData.skuName == fulfillLineData.vendorSKU ||
                            lineData.skuName == fulfillLineData.item_num_alt ||
                            lineData.skuName == fulfillLineData.item_num
                        ) {
                            log.debug(logTitle, LogPrefix + '.......matched vendor sku');
                            isInData = true;
                        }

                        //Ingram Hash replacement
                        if (
                            hashSpace &&
                            (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                                xmlVendor == vendorList.INGRAM_MICRO)
                        ) {
                            if (fulfillLineData.vendorSKU.replace('#', ' ') == lineData.skuName) {
                                log.debug(
                                    logTitle,
                                    LogPrefix + '.......matched for Ingram Hash SKU '
                                );
                                isInData = true;
                            }
                        }
                    }
                    // log.debug(
                    //     lineData.itemNum == fulfillLineData.item_num,
                    //     lineData.itemNum + ' = ' + fulfillLineData.item_num
                    // );
                    if (
                        (lineData.itemNum &&
                            (lineData.itemNum == fulfillLineData.item_num ||
                                lineData.itemNum == fulfillLineData.item_num_alt)) ||
                        (lineData.item_num &&
                            (lineData.item_num == fulfillLineData.item_num ||
                                lineData.item_num == fulfillLineData.item_num_alt))
                    ) {
                        log.debug(logTitle, LogPrefix + '.......matched for line item num ');
                        isInData = true;
                    }

                    //Ingram Hash replacement
                    if (
                        hashSpace &&
                        (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                            xmlVendor == vendorList.INGRAM_MICRO)
                    ) {
                        if (
                            (lineData.itemNum &&
                                fulfillLineData.item_num.replace('#', ' ') == lineData.itemNum) ||
                            (lineData.item_num &&
                                fulfillLineData.item_num.replace('#', ' ') == lineData.item_num)
                        ) {
                            isInData = true;
                        }
                    }

                    //D&H Item replacement
                    if (
                        lineData.dandh == fulfillLineData.item_num &&
                        xmlVendor == vendorList.DandH
                    ) {
                        isInData = true;
                    }
                }

                if (isInData) {
                    log.audit(logTitle, LogPrefix + '... found line data. ');
                    break;
                }
            }

            log.audit(logTitle, LogPrefix + '... is itemInLineData? ' + JSON.stringify(isInData));

            return isInData;
        },
        updateXMLField: function (record, fieldVal, fieldID) {
            var logTitle = [LogTitle, 'updateXMLField'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> : ' + JSON.stringify([fieldVal, fieldID]));

            if (!Helper.isEmpty(fieldVal)) {
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID,
                    value: fieldVal
                });
                record.commitLine({ sublistId: 'item' });
            }
        },
        removeIFLine: function (record, lineNum) {
            var logTitle = [LogTitle, 'removeIFLine'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> remove line: ' + JSON.stringify(lineNum));

            record.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: false
            });
            record.commitLine({ sublistId: 'item' });
        },
        addIFLine: function (record, lineNum) {
            var logTitle = [LogTitle, 'addIFLine'].join('::');
            // log.audit(logTitle, LogPrefix + '>>> add line: ' + JSON.stringify(lineNum));

            record.selectLine({
                sublistId: 'item',
                line: lineNum
            });
            record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'itemreceive',
                value: true
            });
            record.commitLine({ sublistId: 'item' });
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
        uniqueList: function (option) {
            var strList = option.listString || option.value,
                splitStr = option.splitStr || ',',
                joinStr = option.joinStr || '\n';

            var arrList = [];
            if (strList && util.isString(strList)) {
                arrList = strList.split(splitStr);
            }
            arrList = vc2Utils.uniqueArray(arrList);

            return arrList.join(joinStr);
        },
        parseDate: function (option) {
            var dateString = option.dateString,
                date;

            if (!dateFormat) {
                var generalPref = ns_config.load({
                    type: ns_config.Type.COMPANY_PREFERENCES
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

                date = ns_format.format({
                    value: date,
                    type: dateFormat ? dateFormat : ns_format.Type.DATE
                });
            }

            return date;
        },
        setColumnDate: function (option) {
            var fieldId = option.fieldId,
                value = option.value,
                record = option.record;

            // log.debug('setcolumndate ' + fieldId, value);
            if (value && value.length > 0)
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldId,
                    value: value
                });
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

            var customrecordserialnumSearchObj = ns_search.create({
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
        },
        // Added by Clemen - 04/28/2022
        addNativeSerials: function (data) {
            var ifRec = data.record;
            var snList = data.serials;
            if (Helper.isEmpty(snList) || !snList.length) return ifRec;

            log.audit(
                'Create-ItemFF::addNativeSerials',
                '>> Serial List: ' + JSON.stringify(snList)
            );
            // v2.05 @brianff remove invalid serials - NA
            var validSerialList = [];
            snList.forEach(function (serial) {
                if (serial !== 'NA') validSerialList.push(serial);
                return true;
            });

            log.audit(
                'Create-ItemFF::addNativeSerials',
                '>> Valid Serials: ' + JSON.stringify(validSerialList)
            );
            if (Helper.isEmpty(validSerialList) || !validSerialList.length) return ifRec;

            var inventoryDetailRecord = ifRec.getCurrentSublistSubrecord({
                sublistId: 'item',
                fieldId: 'inventorydetail'
            });

            for (var i = 0; i < validSerialList.length; i++) {
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
            }

            return ifRec;
        },
        addNativePackages: function (data) {
            var ifRec = data.record;
            var arrTrackingNums = data.trackingnumbers;
            log.debug(
                'Create-ItemFF::addNativePackages',
                '>> Tracking Nums List: ' + JSON.stringify(arrTrackingNums)
            );

            if (!Helper.isEmpty(arrTrackingNums)) {
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

            log.debug(
                'Create-ItemFF::addNativePackages',
                '>> ifRec: ' + JSON.stringify(ifRec.getSublist({ sublistId: 'package' }))
            );
            return ifRec;
        },
        setLineLocation: function (option) {
            var logTitle = [LogTitle, 'setLineLocation'].join('::');
            // log.audit(logTitle, LogPrefix + '>> ' + JSON.stringify(option));

            var record = option.record,
                orderId = option.orderId;

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

            if (Helper.isEmpty(lineData.location)) {
                //Use SO's header level Location
                var locationLookup = ns_search.lookupFields({
                    type: 'salesorder',
                    id: orderId,
                    columns: ['location']
                });

                if (locationLookup && locationLookup.location) {
                    lineLoc = locationLookup.location[0].value;
                }

                log.audit(
                    logTitle,
                    LogPrefix + '>> lookup search: ' + JSON.stringify([locationLookup, lineLoc])
                );
                // set the line item
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: lineLoc
                });
            }

            // check if the location isempty
            lineLoc = record.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'location'
            });

            log.audit(logTitle, LogPrefix + '>> Line Location : after' + JSON.stringify(lineLoc));

            return record;
        }
    };

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemFulfillments(option) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));
        //			po_ID, so_ID, lineData, vendor
        var mainConfig = option.mainConfig,
            vendorConfig = option.vendorConfig,
            po_ID = option.poId,
            so_ID = option.soId,
            arrLineData = option.lineData,
            vendor = option.vendor;

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

            if (arrLineData == null || !arrLineData.length) {
                throw 'Empty Line Data';
            }

            var numPrefix = vendorConfig.fulfillmentPrefix;
            if (!numPrefix) {
                throw 'Config Error: Missing Fulfillment Prefix';
            }

            arrLineData = Helper.sortLineData(arrLineData);

            var fulfillmentOrders = [],
                i,
                ii,
                iii;

            // Build a non-repeating array of order nums
            for (i = 0; i < arrLineData.length; i++) {
                if (
                    arrLineData[i].order_num &&
                    fulfillmentOrders.indexOf(arrLineData[i].order_num) < 0
                )
                    fulfillmentOrders.push(arrLineData[i].order_num);
            }

            log.audit(
                logTitle,
                LogPrefix + '>> fulfillmentOrders = ' + JSON.stringify(fulfillmentOrders)
            );
            var responseData = [];

            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            for (i = 0; i < fulfillmentOrders.length; i++) {
                var fulfillOrderNum = fulfillmentOrders[i],
                    vendorOrderNum = numPrefix + fulfillOrderNum;

                // skip any existing orders
                if (Helper.orderExists(vendorOrderNum)) {
                    log.audit(logTitle, LogPrefix + '...order already exists');
                    continue;
                }

                var arrLinesToFulfill = [];

                // Build an array with all XML line data with the same order num
                for (ii = 0; ii < arrLineData.length; ii++) {
                    if (fulfillOrderNum != arrLineData[ii].order_num) continue;

                    // log.audit(logTitle, '... verifying line data: ' + JSON.stringify(arrLineData[ii]));
                    if (
                        arrLineData[ii].hasOwnProperty('is_shipped') &&
                        arrLineData[ii].is_shipped === false
                    ) {
                        log.audit(logTitle, '......skipping line: not yet shipped');
                        continue;
                    }

                    log.audit(logTitle, '... adding to fulfillment lines');
                    arrLinesToFulfill.push(arrLineData[ii]);
                }

                log.audit(
                    logTitle,
                    LogPrefix + '>> arrLinesToFulfill = ' + JSON.stringify(arrLinesToFulfill)
                );
                if (!arrLinesToFulfill.length) {
                    log.audit(logTitle, LogPrefix + '** No items to fulfill ** ');
                    continue;
                }

                var recItemFF;

                log.audit(logTitle, LogPrefix + '****  Transform to Fulfillment ****');
                try {
                    // create item fulfillment from sales order
                    recItemFF = ns_record.transform({
                        fromType: ns_record.Type.SALES_ORDER,
                        fromId: so_ID,
                        toType: ns_record.Type.ITEM_FULFILLMENT,
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
                var lineItemCount = recItemFF.getLineCount({
                    sublistId: 'item'
                });

                log.audit(
                    logTitle,
                    LogPrefix + '>> Pending Fulfillment: line count: ' + lineItemCount
                );

                /// REMOVE any items that is not in the XML  Line Data /////////////
                for (var line = 0; line < lineItemCount; line++) {
                    // fetch line item data
                    var itemLineData = {
                        line: line,
                        itemNum: recItemFF.getSublistText({
                            sublistId: 'item',
                            fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL,
                            line: line
                        }),
                        skuName: vcGlobals.VENDOR_SKU_LOOKUP_COL
                            ? recItemFF.getSublistText({
                                  sublistId: 'item',
                                  fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
                                  line: line
                              })
                            : '',
                        itemPO: recItemFF.getSublistText({
                            sublistId: 'item',
                            fieldId: 'createdpo',
                            line: line
                        }),
                        poLine: recItemFF.getSublistText({
                            sublistId: 'item',
                            fieldId: 'poline',
                            line: line
                        }),
                        dandh: recItemFF.getSublistText({
                            sublistId: 'item',
                            fieldId: constants.Columns.DH_MPN,
                            line: line
                        })
                    };

                    log.audit(
                        logTitle,
                        LogPrefix +
                            '>>> Pending Fulfillment: line data: ' +
                            JSON.stringify(itemLineData)
                    );

                    if (
                        !Helper.itemInLineData({
                            lineData: itemLineData,
                            lineDataSet: arrLinesToFulfill,
                            hashSpace: mainConfig.ingramHashSpace,
                            vendor: vendorConfig.xmlVendor
                        })
                    ) {
                        // remove line from item fulfillment not in current arrLinesToFulfill
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '.... item not in fulfillment line, removing line from item fulfillment.'
                        );

                        Helper.removeIFLine(recItemFF, line);
                        rec_Changed = true;
                    } else if (itemLineData.itemPO != po_ID) {
                        // remove line from item fulfillment if the item's PO is not the one being processed
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '.... item PO not the one being processed, removing line from item fulfillment: '
                        );

                        Helper.removeIFLine(recItemFF, line);
                        rec_Changed = true;
                    } else {
                        log.audit(logTitle, LogPrefix + '.... adding line to item fulfillment.');
                        Helper.addIFLine(recItemFF, line);
                        rec_Changed = true;
                    }
                }
                //////////////////////////////////////////////////////////////////////

                // Build a list of unique items with their total quantities shipped for this shipment
                log.audit(
                    logTitle,
                    LogPrefix + '>>> Collect all items and add up the quantities....'
                );
                var uniqueItems = [];
                log.audit(
                    logTitle,
                    LogPrefix + '>> arrLinesToFulfill: ' + JSON.stringify(arrLinesToFulfill)
                );

                for (var itemCnt = 0; itemCnt < arrLinesToFulfill.length; itemCnt++) {
                    var lineToFulfill = arrLinesToFulfill[itemCnt];
                    var currentItem = {
                        item_num: lineToFulfill.item_num,
                        totalShipped: parseInt(lineToFulfill.ship_qty) || 0,
                        order_num: fulfillOrderNum,
                        order_date: lineToFulfill.order_date,
                        order_eta: lineToFulfill.order_eta,
                        ship_date: lineToFulfill.ship_date,
                        carrier: lineToFulfill.carrier,
                        all_tracking_nums: Helper.uniqueList({
                            value: lineToFulfill.tracking_num
                        }),
                        all_serial_nums: Helper.uniqueList({
                            value: lineToFulfill.serial_num
                        })
                    };

                    log.audit(
                        logTitle,
                        LogPrefix + '>>... currentItem: ' + JSON.stringify(currentItem)
                    );

                    if (
                        !Helper.itemInLineData({
                            lineData: lineToFulfill,
                            lineDataSet: uniqueItems,
                            hashSpace: mainConfig.ingramHashSpace,
                            vendor: vendorConfig.xmlVendor
                        })
                    ) {
                        uniqueItems.push(currentItem);

                        log.audit(
                            logTitle,
                            LogPrefix +
                                ' ... added to unique items - ' +
                                JSON.stringify(uniqueItems.length)
                        );
                    } else {
                        for (var uniqIdx = 0; uniqIdx < uniqueItems.length; uniqIdx++) {
                            if (
                                arrLinesToFulfill[itemCnt].item_num == uniqueItems[uniqIdx].item_num
                            ) {
                                uniqueItems[uniqIdx].totalShipped += parseInt(
                                    arrLinesToFulfill[itemCnt].ship_qty
                                );

                                var tmpTrackList = Helper.uniqueList({
                                    value: arrLinesToFulfill[itemCnt].tracking_num
                                });
                                if (!Helper.isEmpty(uniqueItems[uniqIdx].all_tracking_nums)) {
                                    tmpTrackList += '\n' + uniqueItems[uniqIdx].all_tracking_nums;
                                }
                                uniqueItems[uniqIdx].all_tracking_nums = Helper.uniqueList({
                                    value: tmpTrackList,
                                    splitStr: '\n'
                                });

                                var tmpSerialList = Helper.uniqueList({
                                    value: arrLinesToFulfill[itemCnt].serial_num
                                });
                                if (!Helper.isEmpty(uniqueItems[uniqIdx].all_serial_nums)) {
                                    tmpTrackList += '\n' + uniqueItems[uniqIdx].all_serial_nums;
                                }
                                uniqueItems[uniqIdx].all_serial_nums = Helper.uniqueList({
                                    value: tmpSerialList,
                                    splitStr: '\n'
                                });

                                log.audit(
                                    logTitle,
                                    LogPrefix +
                                        ' ... updated unique item data - ' +
                                        JSON.stringify(uniqueItems[uniqIdx])
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

                var lineItemFFCount = recItemFF.getLineCount({
                    sublistId: 'item'
                });

                var recordLines = [];
                log.audit(
                    logTitle,
                    LogPrefix + '**** START ITEM FULFILLMENT LINES VALIDATION ****'
                );

                // loop through all items in item fulfillment
                for (line = 0; line < lineItemFFCount; line++) {
                    recItemFF.selectLine({
                        sublistId: 'item',
                        line: line
                    });

                    var lineFFData = {
                        lineNo: line,
                        item: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL
                        }),
                        quantity: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity'
                        }),
                        isReceived: recItemFF.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive'
                        }),
                        vendorSKU: vcGlobals.VENDOR_SKU_LOOKUP_COL
                            ? recItemFF.getCurrentSublistValue({
                                  sublistId: 'item',
                                  fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL
                              })
                            : '',
                        poLine: recItemFF.getSublistText({
                            sublistId: 'item',
                            fieldId: 'poline',
                            line: line
                        })
                    };

                    log.audit(
                        logTitle,
                        LogPrefix + ' current line : ' + JSON.stringify(lineFFData.isReceived)
                    );

                    if (!lineFFData.isReceived) continue;

                    // if item has not been removed (item receive flag set to false)
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

                    for (var tmp2 = 0; tmp2 < uniqueItems.length; tmp2++) {
                        if (
                            !uniqueItems[tmp2].line_num ||
                            uniqueItems[tmp2].line_num == 'NA' ||
                            uniqueItems[tmp2].line_num == lineFFData.poLine
                        ) {
                            if (
                                lineFFData.item == uniqueItems[tmp2].item_num ||
                                (lineFFData.vendorSKU != '' &&
                                    lineFFData.vendorSKU == uniqueItems[tmp2].vendorSKU)
                            ) {
                                log.audit(
                                    logTitle,
                                    LogPrefix +
                                        '... unique item : ' +
                                        JSON.stringify(uniqueItems[tmp2])
                                );

                                // /////////////////////////////////
                                // // set the location here
                                Helper.setLineLocation({
                                    record: recItemFF,
                                    orderId: so_ID
                                });
                                // ////////////////////////////////

                                if (
                                    lineFFData.quantity < parseInt(uniqueItems[tmp2].totalShipped)
                                ) {
                                    uniqueItems[tmp2].totalShipped -= parseInt(lineFFData.quantity);

                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_num,
                                        'custcol_ctc_xml_dist_order_num'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_date,
                                        'custcol_ctc_xml_date_order_placed'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_eta,
                                        'custcol_ctc_xml_eta'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].ship_date,
                                        'custcol_ctc_xml_ship_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].carrier,
                                        'custcol_ctc_xml_carrier'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].order_eta
                                        }),
                                        'custcol_ctc_vc_eta_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].order_date
                                        }),
                                        'custcol_ctc_vc_order_placed_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].ship_date
                                        }),
                                        'custcol_ctc_vc_shipped_date'
                                    );

                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_eta_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                    //     rec: recItemFF
                                    // });
                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_order_placed_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                    //     rec: recItemFF
                                    // });
                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_shipped_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                    //     rec: recItemFF
                                    // });
                                    rec_Changed = true;

                                    log.audit(
                                        logTitle,
                                        '>> serials/qty: ' +
                                            JSON.stringify([
                                                uniqueItems[tmp2].all_serial_nums,
                                                lineFFData.quantity
                                            ])
                                    );

                                    if (uniqueItems[tmp2].all_serial_nums.length > 0) {
                                        // var tempSerials = '';
                                        var arrTempSerials =
                                            uniqueItems[tmp2].all_serial_nums.split('\n');
                                        var arrTempSerials2 = arrTempSerials.splice(
                                            parseInt(lineFFData.quantity)
                                        );

                                        uniqueItems[tmp2].all_serial_nums =
                                            arrTempSerials.join('\n');

                                        recItemFF.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_ctc_xml_serial_num',
                                            value: arrTempSerials2.join('\n')
                                        });

                                        item = {
                                            item_num: lineFFData.item,
                                            totalShipped: lineFFData.quantity,
                                            order_num: uniqueItems[tmp2].order_num,
                                            order_date: uniqueItems[tmp2].order_date,
                                            order_eta: uniqueItems[tmp2].order_eta,
                                            ship_date: uniqueItems[tmp2].ship_date,
                                            //															"all_tracking_nums": "",
                                            carrier: uniqueItems[tmp2].carrier,
                                            all_serial_nums: arrTempSerials2.join('\n')
                                        };

                                        recordLines.push(item);

                                        /*** Start Clem - Serial functionality 1 ***/
                                        // Check if serialized
                                        var isSerialized = recItemFF.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'isserial'
                                        });
                                        log.audit(logTitle, '>> is serialized1: ' + isSerialized);

                                        if (isSerialized && isSerialized === 'T') {
                                            recItemFF = Helper.addNativeSerials({
                                                record: recItemFF,
                                                serials: item.all_serial_nums
                                                // soid: so_ID
                                            });
                                        }
                                        /*** End Clem - Serial functionality 1 ***/

                                        recItemFF.commitLine({
                                            sublistId: 'item'
                                        });
                                    }
                                } else if (parseInt(uniqueItems[tmp2].totalShipped) == 0) {
                                    recItemFF.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'itemreceive',
                                        value: false
                                    });
                                    recItemFF.commitLine({ sublistId: 'item' });
                                    rec_Changed = true;
                                } else {
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_num,
                                        'custcol_ctc_xml_dist_order_num'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_date,
                                        'custcol_ctc_xml_date_order_placed'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].order_eta,
                                        'custcol_ctc_xml_eta'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].ship_date,
                                        'custcol_ctc_xml_ship_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        uniqueItems[tmp2].carrier,
                                        'custcol_ctc_xml_carrier'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].order_eta
                                        }),
                                        'custcol_ctc_vc_eta_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].order_date
                                        }),
                                        'custcol_ctc_vc_order_placed_date'
                                    );
                                    Helper.updateXMLField(
                                        recItemFF,
                                        Helper.parseDate({
                                            dateString: uniqueItems[tmp2].ship_date
                                        }),
                                        'custcol_ctc_vc_shipped_date'
                                    );

                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_eta_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_eta }),
                                    //     rec: recItemFF
                                    // });
                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_order_placed_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].order_date }),
                                    //     rec: recItemFF
                                    // });
                                    // Helper.setColumnDate({
                                    //     fieldId: 'custcol_ctc_vc_shipped_date',
                                    //     value: Helper.parseDate({ dateString: uniqueItems[tmp2].ship_date }),
                                    //     rec: recItemFF
                                    // });

                                    recItemFF.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        value: parseInt(uniqueItems[tmp2].totalShipped)
                                    });
                                    recItemFF.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_ctc_xml_serial_num',
                                        value: uniqueItems[tmp2].all_serial_nums.substr(
                                            0,
                                            _TEXT_AREA_MAX_LENGTH
                                        )
                                    });

                                    item = {
                                        item_num: lineFFData.item,
                                        totalShipped: lineFFData.quantity,
                                        order_num: uniqueItems[tmp2].order_num,
                                        order_date: uniqueItems[tmp2].order_date,
                                        order_eta: uniqueItems[tmp2].order_eta,
                                        ship_date: uniqueItems[tmp2].ship_date,
                                        //															"all_tracking_nums": "",
                                        carrier: uniqueItems[tmp2].carrier,
                                        all_serial_nums: uniqueItems[tmp2].all_serial_nums
                                    };
                                    recordLines.push(item);

                                    // // Check if serialized
                                    var isSerialized = recItemFF.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'isserial'
                                    });
                                    log.audit(logTitle, '>> is serialized2: ' + isSerialized);

                                    if (isSerialized && isSerialized === 'T') {
                                        recItemFF = Helper.addNativeSerials({
                                            record: recItemFF,
                                            serials: item.all_serial_nums.split('\n')
                                            // soid: so_ID
                                        });
                                    }
                                    /*** End Clem - Serial functionality 2 ***/

                                    uniqueItems[tmp2].totalShipped = 0;
                                    uniqueItems[tmp2].all_serial_nums = '';

                                    recItemFF.commitLine({ sublistId: 'item' });
                                    rec_Changed = true;
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

                // var lineItemCountX = recItemFF.getLineCount({
                //     sublistId: 'item'
                // });
                // log.audit(
                //     logTitle,
                //     LogPrefix +
                //         '>> Before Item Fulfillment save : ' +
                //         ('Item line count = ' + lineItemCountX)
                // );

                var arrAllTrackingNumbers = [];

                for (var tmp3 = 0; tmp3 < uniqueItems.length; tmp3++) {
                    var found = false;
                    if (vcGlobals.VENDOR_SKU_LOOKUP_COL && uniqueItems[tmp3].vendorSKU != 'NA') {
                        var index = recItemFF.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
                            value: uniqueItems[tmp3].vendorSKU
                        });

                        if (index >= 0) {
                            found = true;
                            recItemFF.selectLine({
                                sublistId: 'item',
                                line: index
                            });
                            recItemFF.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ctc_xml_tracking_num',
                                value: uniqueItems[tmp3].all_tracking_nums
                            });
                            recItemFF.commitLine({ sublistId: 'item' });
                            rec_Changed = true;
                        }
                    }
                    if (!found) {
                        var index = recItemFF.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: vcGlobals.ITEM_FUL_ID_LOOKUP_COL,
                            value: uniqueItems[tmp3].item_num
                        });

                        if (index >= 0) {
                            recItemFF.selectLine({
                                sublistId: 'item',
                                line: index
                            });
                            recItemFF.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ctc_xml_tracking_num',
                                value: uniqueItems[tmp3].all_tracking_nums
                            });
                            recItemFF.commitLine({ sublistId: 'item' });
                            rec_Changed = true;
                        }
                    }

                    /*** Start Clemen - Package ***/
                    var strTrackingNums = uniqueItems[tmp3].all_tracking_nums;

                    if (!Helper.isEmpty(strTrackingNums)) {
                        var arrTrackingNums = strTrackingNums.split('\n');
                        arrAllTrackingNumbers = arrAllTrackingNumbers.concat(arrTrackingNums);
                        rec_Changed = true;
                    }
                    /*** End Clemen - Package ***/
                }

                try {
                    var objId;

                    if (rec_Changed) {
                        if (vcGlobals.PICK_PACK_SHIP) {
                            recItemFF.setValue({
                                fieldId: 'shipstatus',
                                value: 'C'
                            });
                        }

                        recItemFF.setValue({
                            fieldId: 'custbody_ctc_if_vendor_order_match',
                            value: vendorOrderNum,
                            ignoreFieldChange: true
                        });

                        var lineItemCountX = recItemFF.getLineCount({
                            sublistId: 'item'
                        });

                        log.audit(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('Item line count = ' + lineItemCountX)
                        );

                        /*** Start Clemen - Package ***/
                        log.audit(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('arrAllTrackingNumbers = ' + JSON.stringify(arrAllTrackingNumbers))
                        );

                        if (
                            !Helper.isEmpty(arrAllTrackingNumbers) &&
                            arrAllTrackingNumbers.length > 0
                        ) {
                            recItemFF = Helper.addNativePackages({
                                record: recItemFF,
                                trackingnumbers: arrAllTrackingNumbers
                            });
                        }
                        /*** End Clemen - Package ***/

                        log.audit(
                            logTitle,
                            LogPrefix +
                                'Before Item Fulfillment save : ' +
                                ('Package line count = ' +
                                    recItemFF.getLineCount({ sublistId: 'package' }))
                        );

                        log.audit(
                            logTitle,
                            LogPrefix +
                                '**** ITEM FULFILLMENT CREATION ****' +
                                JSON.stringify(recordLines)
                        );

                        objId = recItemFF.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });

                        responseData.push({
                            id: objId,
                            orderNum: fulfillOrderNum
                        });
                    } else {
                        objId = recItemFF.id;
                        responseData.push({
                            id: objId,
                            orderNum: fulfillOrderNum
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
        updateIF: updateItemFulfillments,
        updateItemFulfillments: updateItemFulfillments
    };
});
