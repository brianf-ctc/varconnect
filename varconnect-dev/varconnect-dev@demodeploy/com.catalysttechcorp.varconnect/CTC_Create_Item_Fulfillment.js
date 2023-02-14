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
        vc_log = require('./CTC_VC_Lib_Log.js'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js'),
        vc_record = require('./CTC_VC_Lib_Record.js'),
        vc2_record = require('./CTC_VC2_Lib_Record.js');

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

    var ERROR_MSG = {
        ORDER_EXISTS: 'Order already exists',
        TRANSFORM_ERROR: 'Transform error ' + Current.SO_ID,
        NO_FULFILLABLES: 'No fulfillable lines'
    };

    ItemFFLib.updateItemFulfillments = function (option) {
        var logTitle = [LogTitle, 'updateItemFulfillments'].join('::'),
            responseData;
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

            // Helper.log(logTitle, '// CURRENT: ', Current);

            Current.OrderLines = option.lineData;
            Current.SO_REC = option.recSalesOrd;
            Current.PO_REC = option.recPurchOrd;

            Helper.log(logTitle, '// OrderLines: ', Current.OrderLines);

            //////////////////////
            if (!Current.MainCFG) throw 'Missing main configuration';
            if (!Current.VendorCFG) throw 'Missing vendor configuration';
            if (!Current.PO_ID) throw 'Missing PO ID';
            if (vc2_util.isEmpty(Current.OrderLines)) throw 'Missing order lines';

            if (!Helper.validateDate()) throw 'Invalid PO Date';

            Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;
            if (!Current.NumPrefix) throw 'Config Error: Missing Fulfillment Prefix';

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
            Helper.log(logTitle, '----- LOOK for unique orders -----');

            OrderLines.forEach(function (orderLine) {
                // if (vc2_util.inArray(orderLine.order_num, arrOrderNums)) {
                //     // orderLine.RESULT = 'DUPLICATE';
                //     return;
                // }

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

                if (orderLine.ship_qty == 0) {
                    orderLine.RESULT = 'NO SHIP QTY';
                    return;
                }

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

                return true;
            });

            // Helper.log(logTitle, 'OrderLines', OrderLines);
            Helper.log(logTitle, '// Unique Orders', arrVendorOrderNums);
            Helper.log(logTitle, '// OrderLines By OrderNum', OrderLinesByNum);

            //// PRE-SEARCH of existing IFS ///
            Helper.log(logTitle, '// Looking for existing fulfillments: ', arrVendorOrderNums);
            var arrExistingIFS = Helper.findExistingOrders({ orderNums: arrVendorOrderNums });
            Helper.log(logTitle, '... existing IFs', arrExistingIFS);

            ///////////////////////////////////////////////////
            // Loop through each unique order num checking to see if it does not already exist as an item fulfillment
            var OrigLogPrefix = LogPrefix;

            for (var orderNum in OrderLinesByNum) {
                var vendorOrderNum = Current.NumPrefix + orderNum,
                    vendorOrderLines = OrderLinesByNum[orderNum];

                LogPrefix = OrigLogPrefix + ' [' + vendorOrderNum + '] ';
                try {
                    Helper.log(logTitle, '**** PROCESSING Order [' + vendorOrderNum + '] ****');

                    if (vc2_util.inArray(vendorOrderNum, arrExistingIFS))
                        throw 'Order already exists';

                    Helper.log(logTitle, '... OrderLines: ', vendorOrderLines);

                    var defaultItemFFValues = {},
                        recordIsChanged = false;
                    if (Current.Features.MULTISHIPTO) {
                        var defaultShipGroup = Helper.getShipGroup({
                            recSalesOrd: Current.SO_REC,
                            recPurchOrd: Current.PO_REC
                        });
                        if (defaultShipGroup) {
                            defaultItemFFValues.shipgroup = defaultShipGroup;
                        }
                    }

                    //// TRANSFORM record
                    Helper.log(logTitle, '/// Start Transform Record ...');
                    var recItemFF = vc2_record.transform({
                        fromType: ns_record.Type.SALES_ORDER,
                        fromId: Current.SO_ID,
                        toType: ns_record.Type.ITEM_FULFILLMENT,
                        isDynamic: true,
                        defaultValues: defaultItemFFValues
                    });
                    if (vc2_constant.GLOBAL.PICK_PACK_SHIP) {
                        recItemFF.setValue({ fieldId: 'shipstatus', value: 'C' });
                    }
                    if (!recItemFF)
                        throw 'Transform error on SO: ' + vc2_util.extractError(transform_err);

                    var recordIsChanged,
                        lineFF,
                        line,
                        updateFFData = {},
                        recordLines = [],
                        arrFulfillableLines = [];

                    Helper.log(logTitle, '... record transform success');
                    //////////////////

                    // REMOVE lines not in orderlines
                    var lineItemCount = recItemFF.getLineCount({ sublistId: 'item' });
                    Helper.log(
                        logTitle,
                        '/// VALIDATE orderlines/fulfillment lines..',
                        lineItemCount
                    );

                    for (line = 0; line < lineItemCount; line++) {
                        try {
                            lineFF = vc2_record.extractLineValues({
                                record: recItemFF,
                                line: line,
                                columns: [
                                    'item',
                                    'quantity',
                                    'quantityremaining',
                                    'itemreceive',
                                    'poline',
                                    'isserial',
                                    'inventorydetailreq',
                                    'createdpo',
                                    vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                    vc2_constant.FIELD.TRANSACTION.DH_MPN
                                ]
                            });
                            lineFF.line = line;
                            Helper.log(logTitle, '*** fulfillment line ***', lineFF);

                            if (!lineFF.createdpo || lineFF.createdpo != Current.PO_ID)
                                throw 'Not same PO';

                            // find matching vendor line
                            var matchingVendorLine = vc2_record.findMatchingVendorLine({
                                vendorLines: vendorOrderLines,
                                orderLine: lineFF,
                                line: line,
                                quantity: lineFF.quantityremaining,
                                mainConfig: Current.MainCFG,
                                vendorConfig: Current.VendorCFG
                            });

                            if (!matchingVendorLine) throw 'Line item not matched';
                            Helper.log(logTitle, '/// matched vendor line: ', matchingVendorLine);

                            if (!util.isArray(matchingVendorLine))
                                matchingVendorLine = [matchingVendorLine];

                            var totalQty = 0;
                            matchingVendorLine.forEach(function (vendorLine) {
                                var usedQty =
                                    lineFF.quantityremaining >= vendorLine.ship_qty
                                        ? vendorLine.ship_qty
                                        : lineFF.quantityremaining;

                                vendorLine.AVAILQTY -= usedQty;
                                vendorLine.APPLIEDLINES.push(lineFF.line + 1);
                                totalQty += usedQty;

                                return true;
                            });

                            if (lineFF.quantityremaining >= totalQty) {
                                // add to fulfillment
                                Helper.addFulfillmentLine({
                                    record: recItemFF,
                                    line: line,
                                    quantity: totalQty
                                });
                            }

                            // adjust the AVAILQTY
                            arrFulfillableLines.push(lineFF);
                            recordIsChanged = true;
                        } catch (line_error) {
                            Helper.log(
                                logTitle,
                                '... removed: ' + vc2_util.extractError(line_error)
                            );
                            Helper.removeFulfillmentLine({ record: recItemFF, line: line });
                            recordIsChanged = true;
                        }
                    }

                    if (!arrFulfillableLines.length) throw 'No fulfillable lines for this order';

                    /// CHECK for unfulfilled or over fulfilled vendor lines for this order /////////////
                    var unFulfilledItems = vc2_util.findMatching({
                        list: vendorOrderLines,
                        findAll: true,
                        filter: {
                            AVAILQTY: function (value) {
                                var hasError = false;
                                if (value > 0 || value < 0) {
                                    hasError = true;

                                    this.ERRORMSG =
                                        value > 0
                                            ? 'Unfulfilled items'
                                            : value < 0
                                            ? 'Insufficient Qty'
                                            : '';
                                }

                                return hasError;
                            }
                        }
                    });

                    if (unFulfilledItems && unFulfilledItems.length) {
                        Helper.log(logTitle, '// unfulfilled lines: ', unFulfilledItems);
                        var unffError = [];
                        unFulfilledItems.forEach(function (unffitem) {
                            unffError.push(
                                [
                                    unffitem.ERRORMSG,
                                    unffitem.item_num,
                                    'qty:' + unffitem.ship_qty
                                ].join(', ')
                            );
                            return true;
                        });

                        throw 'Unable to fulfill the following items:\n' + unffError.join('\n');
                    }
                    ////////////////////////////////////

                    ////////////////////////////////////
                    Helper.log(logTitle, '//// UPDATE fulfillment lines from vendor line data');

                    lineItemCount = recItemFF.getLineCount({ sublistId: 'item' });
                    for (line = 0; line < lineItemCount; line++) {
                        try {
                            lineFF = vc2_record.extractLineValues({
                                record: recItemFF,
                                line: line,
                                columns: [
                                    'item',
                                    'quantity',
                                    'quantityremaining',
                                    'itemreceive',
                                    'isserial',
                                    'inventorydetailreq',
                                    vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                    vc2_constant.FIELD.TRANSACTION.DH_MPN
                                ]
                            });
                            lineFF.line = line;
                            Helper.log(logTitle, '*** fulfillment line ***', lineFF);

                            recItemFF.selectLine({ sublistId: 'item', line: line });

                            if (!lineFF.itemreceive) {
                                Helper.log(logTitle, '... skipped: not yet received');
                                Helper.setLineValues({
                                    record: recItemFF,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                continue;
                            }

                            /// find the matching vendor line(s)
                            var matchedVendorLine = vc2_util.findMatching({
                                list: vendorOrderLines,
                                findAll: true,
                                filter: {
                                    APPLIEDLINES: function (value) {
                                        Helper.log(logTitle, '... APPLIED LINES: ', [
                                            lineFF.line + 1,
                                            value
                                        ]);
                                        return vc2_util.inArray(lineFF.line + 1, value);
                                    }
                                }
                            });
                            // Helper.log(logTitle, '... matchedVendorLine: ', matchedVendorLine);
                            if (!matchedVendorLine) {
                                Helper.log(
                                    logTitle,
                                    '... skipped: matching vendor lines not found'
                                );
                                Helper.setLineValues({
                                    record: recItemFF,
                                    values: { itemreceive: false },
                                    doCommit: true
                                });
                                continue;
                            }

                            if (!util.isArray(matchedVendorLine))
                                matchedVendorLine = [matchedVendorLine];

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

                                allTrackingNum =
                                    (allTrackingNum ? allTrackingNum + '\n' : '') + tmpTrackingNos;

                                allSerialNums =
                                    (allSerialNums ? allSerialNums + '\n' : '') + tmpSerialNos;

                                return true;
                            });
                            uniqVendorLine.all_tracking_nums = allTrackingNum;
                            uniqVendorLine.all_serial_nums = allSerialNums;
                            uniqVendorLine.totalShipped = totalQty;

                            Helper.log(logTitle, '// uniqVendorLine: ', uniqVendorLine);

                            // create the update fulfillment line
                            for (var col in FFLineMap.lineColumn) {
                                var vendorCol = FFLineMap.lineColumn[col],
                                    orderValue = uniqVendorLine[vendorCol];
                                if (vc2_util.isEmpty(orderValue)) continue;

                                if (vc2_util.inArray(col, FFLineMap.columnType.date)) {
                                    orderValue = vc_record.parseDate({ dateString: orderValue });
                                }
                                updateLineValues[col] = orderValue;
                            }
                            updateLineValues.custcol_ctc_xml_tracking_num = allTrackingNum
                                ? allTrackingNum.substr(0, _TEXT_AREA_MAX_LENGTH)
                                : '';
                            updateLineValues.custcol_ctc_xml_serial_num = allSerialNums
                                ? allSerialNums.substr(0, _TEXT_AREA_MAX_LENGTH)
                                : '';

                            Helper.log(logTitle, '// updateLineValues: ', updateLineValues);

                            /// update the fulfillment trandate
                            if (
                                (Current.VendorCFG.useShipDate == true ||
                                    Current.VendorCFG.useShipDate == 'T') &&
                                uniqVendorLine.ship_date
                            ) {
                                updateFFData['trandate'] = vc_record.parseDate({
                                    dateString: uniqVendorLine.ship_date
                                });
                            }

                            /// UPDATE fulfillment lines
                            if (!vc2_util.isEmpty(updateLineValues)) {
                                Helper.setLineValues({
                                    record: recItemFF,
                                    values: updateLineValues
                                });
                            }

                            //// SERIALS DETECTION ////////////////
                            var arrSerials = allSerialNums ? allSerialNums.split(/\n/) : [];
                            Helper.log(logTitle, '... serials', arrSerials);

                            if (
                                lineFF.isserial === 'T' &&
                                arrSerials.length &&
                                Helper.validateSerials({ serials: arrSerials })
                            ) {
                                var currentLocation = recItemFF.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'location'
                                });

                                if (!currentLocation)
                                    Helper.setLineLocation({
                                        record: recItemFF,
                                        recSO: Current.SO_REC
                                    });

                                var resultSerials = Helper.addNativeSerials({
                                    record: recItemFF,
                                    serials: arrSerials
                                });

                                if (!resultSerials) {
                                    // do not clear location as some fulfillments fail when there is more than one loc
                                    // blanks are counted as another location

                                    // only prevent inventory detail from being required after location changes
                                    recItemFF.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'inventorydetailreq',
                                        value: lineFF.inventorydetailreq
                                    });
                                }
                            }

                            recordLines.push(uniqVendorLine);

                            recItemFF.commitLine({ sublistId: 'item' });
                            recordIsChanged = true;
                        } catch (line_error) {
                            vc2_util.logError(logTitle, line_error);
                            continue;
                        }
                    }

                    ////////////////////
                    Helper.log(logTitle, '>> record lines', recordLines);
                    if (vc2_util.isEmpty(recordLines)) {
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
                        for (var ii = 0; ii < recordLines.length; ii++) {
                            var strTrackingNums = recordLines[ii].all_tracking_nums;

                            if (!vc2_util.isEmpty(strTrackingNums)) {
                                var arrTrackingNums = strTrackingNums.split('\n');
                                arrAllTrackingNumbers =
                                    arrAllTrackingNumbers.concat(arrTrackingNums);
                            }
                        }
                        Helper.log(logTitle, '/// tracking numbers', arrAllTrackingNumbers);

                        if (!vc2_util.isEmpty(arrAllTrackingNumbers)) {
                            recItemFF = Helper.addNativePackages({
                                record: recItemFF,
                                trackingnumbers: arrAllTrackingNumbers
                            });
                        }

                        Helper.log(
                            logTitle,
                            '/// Package line count',
                            recItemFF.getLineCount({ sublistId: 'package' })
                        );
                    } catch (package_error) {
                        Helper.log(logTitle, '/// PACKAGE error', package_error, 'error');
                        Helper.logMsg({
                            error: package_error,
                            title: 'Set Package Error'
                        });
                    }
                    /*** End Clemen - Package ***/

                    if (Current.Features.MULTILOCINVT) {
                        // set on the same location
                        Helper.setSameLocation({ record: recItemFF });
                    }
                    updateFFData.custbody_ctc_if_vendor_order_match = vendorOrderNum;
                    updateFFData.custbody_ctc_vc_createdby_vc = true;

                    Helper.log(logTitle, ' ///  updateFFData', updateFFData);
                    if (!vc2_util.isEmpty(updateFFData)) {
                        for (var fld in updateFFData) {
                            recItemFF.setValue({ fieldId: fld, value: updateFFData[fld] });
                        }
                    }

                    // try to save the record
                    var itemffId;
                    try {
                        itemffId = recItemFF.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        responseData.push({ id: itemffId, orderNum: orderNum });

                        Helper.log(
                            logTitle,
                            '## Created Item Fulfillment: [itemfulfillment:' + itemffId + ']'
                        );

                        Helper.logMsg({
                            title: 'Create Fulfillment',
                            isSuccess: true,
                            message:
                                '## Created Item Fulfillment: [itemfulfillment:' + itemffId + ']'
                        });
                    } catch (itemff_err) {
                        var errMsg = vc2_util.extractError(itemff_err);
                        Helper.log(logTitle, '/// FULFILLMENT Create error', itemff_err, 'error');

                        Helper.logMsg({ error: itemff_err, title: 'Create Fulfillment Error' });
                        throw itemff_err;
                    }
                } catch (orderNum_error) {
                    Helper.log(logTitle, '## ERROR ##', orderNum_error);
                    continue;
                }
            }

            return responseData;
        } catch (error) {
            var errorMsg = vc2_util.extractError(error);
            log.error(
                logTitle,
                vc2_util.getUsage() +
                    (LogPrefix + '## ERROR:  ') +
                    (errorMsg + '| Details: ' + JSON.stringify(error))
            );
            Helper.logMsg({ title: logTitle + ':: Error', error: error });
            throw error;
            return false;
        } finally {
            log.debug(
                logTitle,
                vc2_util.getUsage() + '############ ITEM FULFILLMENT CREATION: END ############'
            );
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
        logMsg: function (option) {
            option = option || {};

            var LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

            var logOption = {
                transaction: Current.PO_ID,
                header: ['Fulfillment', option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? vc2_util.extractError(option.error) : option.errorMsg),

                status:
                    option.status ||
                    (option.error
                        ? LOG_STATUS.ERROR
                        : option.isSuccess
                        ? LOG_STATUS.SUCCESS
                        : LOG_STATUS.INFO)
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
                    log.error(
                        logTitle,
                        vc2_util.getUsage() +
                            LogPrefix +
                            '## ERROR ## ' +
                            JSON.stringify(serial_error)
                    );
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

            if (!vc2_util.isEmpty(arrTrackingNums)) {
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
                vc2_util.getUsage() +
                    LogPrefix +
                    '>> currrent item/location: ' +
                    JSON.stringify(lineData)
            );

            var lineLoc;

            if (vc2_util.isEmpty(lineData.location)) {
                //Use SO's header level Location
                lineLoc = recSO.getValue({
                    fieldId: 'location'
                });

                log.audit(
                    logTitle,
                    vc2_util.getUsage() + LogPrefix + '>> SO Location - ' + JSON.stringify(lineLoc)
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

            log.audit(
                logTitle,
                vc2_util.getUsage() +
                    LogPrefix +
                    '>> Line Location : after: ' +
                    JSON.stringify(lineLoc)
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

                if (!itemData.location || vc2_util.inArray(itemData.location, arrLocation))
                    continue;
                arrLocation.push(itemData.location);
            }
            log.audit(logTitle, logPrefix + '// unique location: ' + JSON.stringify(arrLocation));

            if (!arrLocation || arrLocation.length > 1) {
                // just fetch the location from the SO

                if (Current.SO_REC) {
                    var orderLocation = Current.SO_REC.getValue({ fieldId: 'location' });
                    log.audit(
                        logTitle,
                        logPrefix + '// orderLocation: ' + JSON.stringify(orderLocation)
                    );
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

                // log.audit(
                //     logTitle,
                //     vc2_util.getUsage() + LogPrefix + '... item data: ' + JSON.stringify(itemData)
                // );

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
                Helper.log(logTitle, '/// found in line: ', [poId, line]);

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
                    xmlVendor = Current.VendorCFG.xmlVendor,
                    vendorList = vc2_constant.LIST.XML_VENDOR;

                var logPrefix = LogPrefix + ' [Item: ' + dataToTest.item_num + ']';
                var hasMatch = false;

                // log.audit(logTitle,  vc_util.getUsage() + LogPrefix + ' // isMatchingLine: ' + JSON.stringify(option));

                var LineItemCheck = {
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
        findMatchingVendorLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingVendorLine'].join('::'),
                returnValue;

            var vendorLines = option.vendorLines,
                itemffLine = option.lineData,
                matchingVendorLine;

            var matchingLine = vc2_util.findMatching({
                list: vendorLines,
                findAll: true,
                filter: {
                    item_num: function (value) {
                        var vendorLine = this;

                        var matchedValue = vc2_record.isVendorLineMatched({
                            orderLine: itemffLine,
                            vendorLine: vendorLine,
                            mainConfig: Current.MainCFG,
                            vendorConfig: Current.VendorCFG
                        });

                        vendorLine.ship_qty = util.isString(vendorLine.ship_qty)
                            ? vc2_util.parseFloat(vendorLine.ship_qty)
                            : vendorLine.ship_qty;

                        if (matchedValue) vendorLine.MATCHEDBY = matchedValue;
                        if (!vendorLine.hasOwnProperty('AVAILQTY'))
                            vendorLine.AVAILQTY = vendorLine.ship_qty;
                        if (!vendorLine.hasOwnProperty('APPLIEDLINES'))
                            vendorLine.APPLIEDLINES = [];

                        return !!matchedValue;
                    }
                }
            });
            matchingVendorLine = matchingLine;

            // if has match multiple lines
            if (matchingLine.length > 1) {
                var matched = {
                    qtyLine: vc2_util.findMatching({
                        list: matchingLine,
                        findAll: true,
                        filter: {
                            ship_qty: function (value) {
                                var shipQty = vc2_util.parseFloat(value),
                                    qtyRem = itemffLine.quantityremaining;
                                return shipQty == qtyRem;
                            },
                            line_no: function (value) {
                                var shipLine = vc2_util.parseFloat(value),
                                    poLine = vc2_util.parseFloat(itemffLine.poline);

                                return shipLine == poLine;
                            },
                            AVAILQTY: function (value) {
                                return value > 0;
                            }
                        }
                    }),
                    qtyFull: vc2_util.findMatching({
                        list: matchingLine,
                        findAll: true,
                        filter: {
                            ship_qty: function (value) {
                                var shipQty = vc2_util.parseFloat(value),
                                    qtyRem = itemffLine.quantityremaining;
                                return shipQty == qtyRem;
                            },
                            AVAILQTY: function (value) {
                                return value > 0;
                            }
                        }
                    }),
                    qtyPartial: vc2_util.findMatching({
                        list: matchingLine,
                        findAll: true,
                        filter: {
                            ship_qty: function (value) {
                                var shipQty = vc2_util.parseFloat(value),
                                    qtyRem = itemffLine.quantityremaining;
                                return shipQty <= qtyRem;
                            },
                            AVAILQTY: function (value) {
                                return value > 0;
                            }
                        }
                    })
                };
                matchingVendorLine = matched.qtyLine || matched.qtyFull || matched.qtyPartial;
            }
            returnValue = matchingVendorLine[0] || matchingVendorLine;

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

    return ItemFFLib;
});
