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
    './CTC_VC2_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js'
], function (ns_search, ns_record, ns_runtime, vc2_constant, vc_log, vc2_util) {
    var LogTitle = 'Create-ItemRcpt',
        LogPrefix = '',
        _TEXT_AREA_MAX_LENGTH = 4000;

    var PO_ID;

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
            var mySearch = ns_search.load({
                id: 'customsearch_ctc_ir_vendor_orders'
            });
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
                transaction: PO_ID,
                header: ['Create Receipt', option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? Helper.extractError(option.error) : option.errorMsg),

                status:
                    option.status ||
                    (option.error
                        ? vc2_constant.LIST.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? vc2_constant.LIST.VC_LOG_STATUS.SUCCESS
                        : vc2_constant.LIST.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, LogPrefix + '::' + JSON.stringify(logOption));
            vc_log.recordLog(logOption);
            return true;
        }
    };

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemReceipts(options) {
        var logTitle = [LogTitle, 'updateItemReceipts'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        //			po_ID, lineData, vendor
        var MainCFG = options.mainConfig,
            OrderCFG = options.orderConfig,
            po_ID = options.poId,
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

        /*** CONSTANTS - Custom IDs ***/
        //			var PO_Valid_Date = '4/13/2019';

        try {
            var PO_Valid_Date = OrderCFG.startDate;

            if (!Helper.validatePODate(po_ID, PO_Valid_Date)) {
                throw 'Invalid PO Date : ' + PO_Valid_Date;
            }

            if (lineData == null || !lineData.length) {
                throw 'Empty Line Data';
            }

            var numPrefix = OrderCFG.fulfillmentPrefix;
            if (!numPrefix) {
                throw 'Config Error: Missing Fulfillment Prefix';
            }

            lineData = Helper.sortLineData(lineData);

            var receiptOrders = [];
            // Build a non-repeating array of order nums
            for (var i = 0; i < lineData.length; i++) {
                if (receiptOrders.indexOf(lineData[i].order_num) < 0)
                    receiptOrders.push(lineData[i].order_num);
            }

            log.audit(logTitle, LogPrefix + '>> receiptOrders = ' + JSON.stringify(receiptOrders));

            var responseData = [];

            // Loop through each unique order num checking to see if it does not already exist as an item receipt
            for (var j = 0; j < receiptOrders.length; j++) {
                // skip any existing orders
                if (Helper.orderExists(numPrefix + receiptOrders[j])) {
                    log.audit(logTitle, LogPrefix + '...order already exists');
                    continue;
                }

                var receiptLines = [];
                // Build an array with all XML line data with the same order num
                for (var x = 0; x < lineData.length; x++) {
                    if (receiptOrders[j] !== lineData[x].order_num) continue;

                    log.audit(logTitle, '... verifying line data: ' + JSON.stringify(lineData[x]));
                    if (
                        lineData[x].hasOwnProperty('is_shipped') &&
                        lineData[x].is_shipped === false
                    ) {
                        log.audit(logTitle, '......skipping line: not yet shipped');
                        continue;
                    }

                    log.audit(logTitle, '... adding to receipt lines');
                    receiptLines.push(lineData[x]);
                }
                log.audit(
                    logTitle,
                    LogPrefix + '>> receiptLines = ' + JSON.stringify(receiptLines)
                );
                if (!receiptLines.length) {
                    log.audit(logTitle, LogPrefix + '** No items to receive ** ');
                    continue;
                }

                var objRecord;

                log.audit(logTitle, LogPrefix + '****  Transform to Item Receipt ****');

                try {
                    // create item receipt from sales order
                    objRecord = ns_record.transform({
                        fromType: ns_record.Type.PURCHASE_ORDER,
                        fromId: po_ID,
                        toType: ns_record.Type.ITEM_RECEIPT,
                        isDynamic: true
                    });

                    log.audit(logTitle, LogPrefix + '... success');
                } catch (err) {
                    Helper.logMsg({
                        title: 'Transform Error on PO: ' + po_ID,
                        error: err
                    });

                    continue;
                }

                var rec_Changed = false;
                var lineItemCount = objRecord.getLineCount({
                    sublistId: 'item'
                });
                log.audit(logTitle, LogPrefix + '>> line count: ' + lineItemCount);
                // remove IF line if not in XML line date
                for (var cnt = 0; cnt < lineItemCount; cnt++) {
                    var tempItemNum = objRecord.getSublistText({
                        sublistId: 'item',
                        fieldId: vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                        line: cnt
                    });
                    var tempVendorSKU = '';

                    if (vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL != null) {
                        tempVendorSKU = objRecord.getSublistText({
                            sublistId: 'item',
                            fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                            line: cnt
                        });
                    }

                    if (!Helper.itemInLineData(tempItemNum, receiptLines, tempVendorSKU)) {
                        // remove line from item receipt not in current receiptLines
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '>> item not in receipt line, removing line from item receipt ' +
                                JSON.stringify({
                                    tempItemNum: tempItemNum,
                                    lineNum: cnt
                                })
                        );

                        Helper.removeIRLine(objRecord, cnt);
                        rec_Changed = true;
                    } else {
                        log.audit(
                            logTitle,
                            LogPrefix +
                                '>> adding line to item receipt : ' +
                                JSON.stringify({
                                    objRecordId: objRecord.id,
                                    lineNum: cnt
                                })
                        );

                        Helper.addIRLine(objRecord, cnt);
                        rec_Changed = true;
                    }
                }
                // Build a list of unique items with their total quantities shipped for this shipment
                var uniqueItems = [];
                for (var itemCnt = 0; itemCnt < receiptLines.length; itemCnt++) {
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

                    if (!Helper.itemInLineData(receiptLines[itemCnt].item_num, uniqueItems, '')) {
                        el.item_num = receiptLines[itemCnt].item_num;
                        el.totalShipped = parseInt(receiptLines[itemCnt].ship_qty);
                        el.order_num = receiptOrders[j];
                        el.order_date = receiptLines[itemCnt].order_date;
                        el.order_eta = receiptLines[itemCnt].order_eta;
                        el.ship_date = receiptLines[itemCnt].ship_date;

                        var tempTrackingNums = Array();
                        tempTrackingNums = receiptLines[itemCnt].tracking_num.split(',');
                        for (var tnIndex = 0; tnIndex < tempTrackingNums.length; tnIndex++) {
                            if (el.all_tracking_nums.indexOf(tempTrackingNums[tnIndex]) < 0) {
                                el.all_tracking_nums += tempTrackingNums[tnIndex] + '\n';
                            }
                        }

                        el.carrier = receiptLines[itemCnt].carrier;

                        if (MainCFG.linkSerialIF) {
                            var tempSerials = Array();
                            tempSerials = receiptLines[itemCnt].serial_num.split(',');
                            for (var snIndex = 0; snIndex < tempSerials.length; snIndex++) {
                                if (el.all_serial_nums.indexOf(tempSerials[snIndex]) < 0) {
                                    el.all_serial_nums += tempSerials[snIndex] + '\n';
                                }
                            }
                        }

                        uniqueItems.push(el);
                    } else {
                        for (var uniqueIndex = 0; uniqueIndex < uniqueItems.length; uniqueIndex++) {
                            if (
                                receiptLines[itemCnt].item_num == uniqueItems[uniqueIndex].item_num
                            ) {
                                uniqueItems[uniqueIndex].totalShipped += parseInt(
                                    receiptLines[itemCnt].ship_qty
                                );

                                var tempTrackingNums = Array();
                                tempTrackingNums = receiptLines[itemCnt].tracking_num.split(',');
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

                                if (MainCFG.linkSerialIF) {
                                    var tempSerials = Array();
                                    tempSerials = receiptLines[itemCnt].serial_num.split(',');
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
                                }
                                break;
                            }
                        }
                    }
                }

                var lineItemCount2 = objRecord.getLineCount({
                    sublistId: 'item'
                });

                // loop through all items in item receipt
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
                        var currItemNum = objRecord.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL
                        });
                        var currItemQty = parseInt(
                            objRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity'
                            })
                        );

                        var currVendorSKU = '';
                        if (vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL) {
                            currVendorSKU = objRecord.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                            });
                        }

                        for (var tmp2 = 0; tmp2 < uniqueItems.length; tmp2++) {
                            if (
                                currItemNum == uniqueItems[tmp2].item_num ||
                                (currVendorSKU != '' &&
                                    currVendorSKU == uniqueItems[tmp2].vendorSKU)
                            ) {
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
                                    rec_Changed = true;

                                    if (MainCFG.linkSerialIF) {
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
                                                value: tempSerials.substr(0, _TEXT_AREA_MAX_LENGTH)
                                            });
                                            objRecord.commitLine({
                                                sublistId: 'item'
                                            });
                                        }
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

                                    objRecord.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        value: parseInt(uniqueItems[tmp2].totalShipped)
                                    });
                                    if (MainCFG.linkSerialIF) {
                                        objRecord.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_ctc_xml_serial_num',
                                            value: uniqueItems[tmp2].all_serial_nums.substr(
                                                0,
                                                _TEXT_AREA_MAX_LENGTH
                                            )
                                        });
                                    }
                                    uniqueItems[tmp2].totalShipped = 0;
                                    if (MainCFG.linkSerialIF) {
                                        uniqueItems[tmp2].all_serial_nums = '';
                                    }
                                    objRecord.commitLine({ sublistId: 'item' });
                                    rec_Changed = true;
                                }
                            }
                        }
                    }
                }

                var lineItemCountX = objRecord.getLineCount({
                    sublistId: 'item'
                });

                log.audit(
                    logTitle,
                    LogPrefix + ' >> Before Item receipt save: lineItemCountX' + lineItemCountX
                );

                for (var tmp3 = 0; tmp3 < uniqueItems.length; tmp3++) {
                    var found = false;
                    var trackingField = MainCFG.useInboundTrackingNumbers
                        ? vc2_constant.FIELD.TRANSACTION.INBOUND_TRACKING_NUM
                        : 'custcol_ctc_xml_tracking_num';
                    if (
                        vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL &&
                        uniqueItems[tmp3].vendorSKU != 'NA'
                    ) {
                        var index = objRecord.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
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
                                fieldId: trackingField,
                                value: uniqueItems[tmp3].all_tracking_nums
                            });
                            objRecord.commitLine({ sublistId: 'item' });
                            rec_Changed = true;
                        }
                    }

                    if (!found) {
                        var index = objRecord.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                            value: uniqueItems[tmp3].item_num
                        });

                        if (index >= 0) {
                            objRecord.selectLine({
                                sublistId: 'item',
                                line: index
                            });
                            objRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: trackingField,
                                value: uniqueItems[tmp3].all_tracking_nums
                            });
                            objRecord.commitLine({ sublistId: 'item' });
                            rec_Changed = true;
                        }
                    }
                }

                try {
                    var objId;

                    if (rec_Changed) {
                        objRecord.setValue({
                            fieldId: 'custbody_ctc_if_vendor_order_match',
                            value: numPrefix + receiptOrders[j],
                            ignoreFieldChange: true
                        });

                        var lineItemCountX = objRecord.getLineCount({
                            sublistId: 'item'
                        });

                        log.audit(
                            logTitle,
                            LogPrefix +
                                'Before Item receipt save : ' +
                                ('Item line count = ' + lineItemCountX)
                        );

                        objId = objRecord.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                        responseData.push({
                            id: objId,
                            orderNum: receiptOrders[j]
                        });
                    } else {
                        objId = objRecord.id;
                        responseData.push({
                            id: objId,
                            orderNum: receiptOrders[j]
                        });
                    }

                    log.audit(
                        logTitle,
                        LogPrefix + '## Created Item Receipt: [itemreceipt:' + objId + ']'
                    );

                    Helper.logMsg({
                        title: 'Create Item Receipt',
                        isSucces: true,
                        message: '## Created Item Receipt: [itemfulfillment:' + objId + ']'
                    });
                } catch (err) {
                    var errMsg = Helper.extractError(err);
                    log.error(
                        logTitle,
                        LogPrefix +
                            ('## Item Receipt Error:  ' + errMsg) +
                            ('|  Details: ' + JSON.stringify(err))
                    );
                    Helper.logMsg({
                        error: err,
                        title: 'Create Item Receipt Error'
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
        updateIR: updateItemReceipts
    };
});
