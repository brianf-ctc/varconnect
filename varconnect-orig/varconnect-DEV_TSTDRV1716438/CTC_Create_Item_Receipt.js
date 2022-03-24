/**
 * Copyright (c) 2019 Catalyst Tech Corp
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
 * 1.00		Apr 13, 2019	ocorrea		Creates Item Receipt after receiving XML data for special order POs
 *
 */

/**
 *CTC_Create_Item_receipt.js
 *@NApiVersion 2.x
 *@NModuleScope Public
 */

define(['N/search', 'N/record', 'N/runtime', './VC_Globals.js', './CTC_VC_Constants.js'], function (
    search,
    record,
    runtime,
    vcGlobals,
    constants
) {
    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    function updateItemReceipts(options) {
        //			po_ID, lineData, vendor
        var mainConfig = options.mainConfig,
            vendorConfig = options.vendorConfig,
            po_ID = options.poId,
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
        //			var PO_Valid_Date = '4/13/2019';
        var PO_Valid_Date = vendorConfig.startDate;

        log.debug({
            title: 'updateItemReceipts`',
            details: 'po_ID = ' + po_ID
        });
        log.debug({
            title: 'updateItemReceipts`',
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

            //				var numPrefix = '';
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
            //						title: 'updateItemReceipts`',
            //						details: 'Vendor not supported. vendor = '+vendor
            //					});
            //						return false;
            //				}

            var receiptOrders = [];
            // Build a non-repeating array of order nums
            for (var i = 0; i < lineData.length; i++) {
                if (receiptOrders.indexOf(lineData[i].order_num) < 0)
                    receiptOrders.push(lineData[i].order_num);
            }

            log.debug({
                title: 'receiptOrders`',
                details: ' receiptOrders = ' + JSON.stringify(receiptOrders)
            });

            var responseData = [];

            // Loop through each unique order num checking to see if it does not already exist as an item receipt
            for (var j = 0; j < receiptOrders.length; j++) {
                if (!orderExists(numPrefix + receiptOrders[j])) {
                    var receiptLines = [];
                    // Build an array with all XML line data with the same order num
                    for (var x = 0; x < lineData.length; x++) {
                        if (receiptOrders[j] == lineData[x].order_num)
                            receiptLines.push(lineData[x]);
                    }
                    log.debug('receiptLines', ' receiptLines = ' + JSON.stringify(receiptLines));

                    if (receiptLines.length > 0) {
                        try {
                            // create item receipt from sales order
                            var objRecord = record.transform({
                                fromType: record.Type.PURCHASE_ORDER,
                                fromId: po_ID,
                                toType: record.Type.ITEM_RECEIPT,
                                isDynamic: true
                            });
                        } catch (err) {
                            log.error({
                                title: 'Create Item Receipt',
                                details:
                                    'Could not transform po ID ' + po_ID + ' error = ' + err.message
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

                                if (!itemInLineData(tempItemNum, receiptLines, tempVendorSKU)) {
                                    // remove line from item receipt not in current receiptLines
                                    log.debug({
                                        title: 'item not in receipt line, removing line from item receipt',
                                        details:
                                            'tempItemNum = ' + tempItemNum + ' line num = ' + cnt
                                    });

                                    removeIRLine(objRecord, cnt);
                                    rec_Changed = true;
                                } else {
                                    log.debug({
                                        title: 'adding line to item receipt',
                                        details: 'objRecord = ' + objRecord.id + ' cnt = ' + cnt
                                    });

                                    addIRLine(objRecord, cnt);
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

                                if (
                                    !itemInLineData(receiptLines[itemCnt].item_num, uniqueItems, '')
                                ) {
                                    el.item_num = receiptLines[itemCnt].item_num;
                                    el.totalShipped = parseInt(receiptLines[itemCnt].ship_qty);
                                    el.order_num = receiptOrders[j];
                                    el.order_date = receiptLines[itemCnt].order_date;
                                    el.order_eta = receiptLines[itemCnt].order_eta;
                                    el.ship_date = receiptLines[itemCnt].ship_date;

                                    var tempTrackingNums = Array();
                                    tempTrackingNums =
                                        receiptLines[itemCnt].tracking_num.split(',');
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

                                    el.carrier = receiptLines[itemCnt].carrier;

                                    if (mainConfig.linkSerialIF) {
                                        var tempSerials = Array();
                                        tempSerials = receiptLines[itemCnt].serial_num.split(',');
                                        for (
                                            var snIndex = 0;
                                            snIndex < tempSerials.length;
                                            snIndex++
                                        ) {
                                            if (
                                                el.all_serial_nums.indexOf(tempSerials[snIndex]) < 0
                                            ) {
                                                el.all_serial_nums += tempSerials[snIndex] + '\n';
                                            }
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
                                            receiptLines[itemCnt].item_num ==
                                            uniqueItems[uniqueIndex].item_num
                                        ) {
                                            uniqueItems[uniqueIndex].totalShipped += parseInt(
                                                receiptLines[itemCnt].ship_qty
                                            );

                                            var tempTrackingNums = Array();
                                            tempTrackingNums =
                                                receiptLines[itemCnt].tracking_num.split(',');
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

                                            if (mainConfig.linkSerialIF) {
                                                var tempSerials = Array();
                                                tempSerials =
                                                    receiptLines[itemCnt].serial_num.split(',');
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

                                    for (var tmp2 = 0; tmp2 < uniqueItems.length; tmp2++) {
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
                                                rec_Changed = true;

                                                if (mainConfig.linkSerialIF) {
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
                                                        objRecord.commitLine({ sublistId: 'item' });
                                                    }
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

                                                objRecord.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'quantity',
                                                    value: parseInt(uniqueItems[tmp2].totalShipped)
                                                });
                                                if (mainConfig.linkSerialIF) {
                                                    objRecord.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_ctc_xml_serial_num',
                                                        value: uniqueItems[tmp2].all_serial_nums
                                                    });
                                                }
                                                uniqueItems[tmp2].totalShipped = 0;
                                                if (mainConfig.linkSerialIF) {
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
                            log.debug({
                                title: 'Before Item receipt save',
                                details: 'Item line count = ' + lineItemCountX
                            });

                            for (var tmp3 = 0; tmp3 < uniqueItems.length; tmp3++) {
                                var found = false;
                                var trackingField = mainConfig.useInboundTrackingNumbers
                                    ? constants.Columns.INBOUND_TRACKING_NUM
                                    : 'custcol_ctc_xml_tracking_num';
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
                                            fieldId: trackingField,
                                            value: uniqueItems[tmp3].all_tracking_nums
                                        });
                                        objRecord.commitLine({ sublistId: 'item' });
                                        rec_Changed = true;
                                    }
                                }
                            }

                            try {
                                if (rec_Changed) {
                                    objRecord.setValue({
                                        fieldId: 'custbody_ctc_if_vendor_order_match',
                                        value: numPrefix + receiptOrders[j],
                                        ignoreFieldChange: true
                                    });

                                    var lineItemCountX = objRecord.getLineCount({
                                        sublistId: 'item'
                                    });
                                    log.debug({
                                        title: 'Before Item receipt save',
                                        details: 'Item line count = ' + lineItemCountX
                                    });

                                    var objId = objRecord.save({
                                        enableSourcing: false,
                                        ignoreMandatoryFields: true
                                    });
                                    responseData.push({ id: objId, orderNum: receiptOrders[j] });
                                } else {
                                    var objId = objRecord.id;
                                    responseData.push({ id: objId, orderNum: receiptOrders[j] });
                                }
                            } catch (err) {
                                log.error({
                                    title: 'Create Item receipt',
                                    details: 'Could not save item receipt error = ' + err.message
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
                title: 'Create Item receipt',
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
                title: 'Create Item receipt',
                details: 'LEAVING validatePODate ppo id = ' + po_ID + ' isValid = ' + isValid
            });

            return isValid;
        }

        function orderExists(transID) {
            log.debug({
                title: 'Create Item Receipt',
                details: 'order exists transid = ' + transID
            });

            var filters = search.createFilter({
                name: 'custbody_ctc_if_vendor_order_match',
                operator: search.Operator.IS,
                values: transID
            });
            var mySearch = search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
            mySearch.filters.push(filters);
            // If order num already exists do nothing
            var found = false;
            mySearch.run().each(function (result) {
                found = true;
            });
            log.debug({
                title: 'Create Item receipt',
                details: 'LEAVING order exists transid = ' + transID + ' found = ' + found
            });

            return found;
        }

        function itemInLineData(tempItemNum, lineData, tempVendorSKU) {
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
            return isInData;
        }

        function updateXMLField(objRecord, fieldVal, fieldID) {
            if (!isEmpty(fieldVal)) {
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID,
                    value: fieldVal
                });
                objRecord.commitLine({ sublistId: 'item' });
            }
        }

        function removeIRLine(objRecord, lineNum) {
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
        }
        function addIRLine(objRecord, lineNum) {
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
        }
    }

    return {
        updateIR: updateItemReceipts
    };
});
