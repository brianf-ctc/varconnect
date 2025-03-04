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
 * @Description VAR Connect library for netsuit record handling
 */

/**
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jan 1, 2020	    <author email>			Initial Build
 * 2.00		Nov 2, 2020		paolodl@nscatalyst.com	Add hash conversion to space for Ingram
 * 3.00		Feb 8, 2021		paolodl@nscatalyst.com	Add popylation for new date columns
 * 4.00		Jun 3, 2021		paolodl@nscatalyst.com	Add get order line function
 * 4.01		Jul 21,2021		paolodl@nscatalyst.com	Dynamic date parse
 * 4.02		Apr 8,2022		christian@nscatalyst.com	Date parse returns closest date for ETA
 *                                                      Updating fields overwrite value if append failed
 * 4.03		May 10,2022		christian@nscatalyst.com	Carrier info should not append to itself
 * 4.04		Jun 14,2022		christian@nscatalyst.com	Return errors and line key for updatePOItemData
 * 4.05		Jun 28,2022		christian@nscatalyst.com	Update po header and line order status
 *
 */

define([
    'N/config',
    'N/format',
    'N/search',
    'N/record',
    './CTC_VC2_Lib_Record',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js',
    './Services/ctc_svclib_configlib.js',
    './Services/ctc_svclib_process-v1.js'
], function (
    ns_config,
    ns_format,
    ns_search,
    ns_record,
    vc2_record,
    vc2_util,
    vc2_constant,
    vcs_configLib,
    vcs_processLib
) {
    var LogTitle = 'NS_Library',
        LogPrefix;

    var Current = {
        dateFormat: null,
        PO_NUM: null,
        VendorLines: [],
        OrderLines: [],
        MainCFG: null,
        OrderCFG: null
    };

    var MAXLEN = {
        TEXT: 300,
        TEXTAREA: 3950,
        ERRORMSG: 'Maximum Field Length Exceeded'
    };

    var ERROR_MSG = vc2_constant.ERRORMSG;

    var Helper = {
        getDateFormat: function () {
            if (!Current.dateFormat) {
                var generalPref = ns_config.load({
                    type: ns_config.Type.COMPANY_PREFERENCES
                });
                Current.dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            }
            return Current.dateFormat;
        },
        formatDate: function (date) {
            return date ? ns_format.format({ value: date, type: ns_format.Type.DATE }) : null;
        },
        buildVendorStatus: function (vendorLine) {
            var vendorStatus = [];

            //40-MW400-11,SHIPPED,#001-ITEMNAME,Qty:1Shipped

            if (vendorLine.order_num && vendorLine.order_num != 'NA')
                vendorStatus.push(vendorLine.order_num);

            if (vendorLine.order_status && vendorLine.order_status != 'NA')
                vendorStatus.push(vendorLine.order_status);

            if (vendorLine.line_num) vendorStatus.push('#' + vendorLine.line_num);
            if (vendorLine.item_num) vendorStatus.push(vendorLine.item_num);
            if (vendorLine.ship_qty) vendorStatus.push('Qty:' + vendorLine.ship_qty);

            if (vendorLine.line_status && vendorLine.line_status != 'NA')
                vendorStatus.push(vendorLine.line_status);

            return vendorStatus.length ? vendorStatus.join(',') : '';
        },
        buildLineVendorInfo: function (currLineValue, vendorInfo) {
            if (!vendorInfo) return null;

            var curVendorInfo = vc2_util.safeParse(currLineValue) || [];
            if (!util.isArray(curVendorInfo)) curVendorInfo = [curVendorInfo];

            vendorInfo = vc2_util.extractValues({
                source: vendorInfo,
                params: [
                    'line_num',
                    'item_num',
                    'item_num_alt',
                    'vendorSKU',
                    'order_num',
                    'order_status',
                    'line_status',
                    'ship_qty',
                    'ship_date',
                    'order_date',
                    'order_eta',
                    'order_delivery_eta',
                    'eta_ship_desc',
                    'eta_ship_source',
                    'eta_delivery_date',
                    'serial_num',
                    'tracking_num',
                    'carrier',
                    'is_shipped'
                ]
            });

            if (
                !vc2_util.findMatching({
                    list: curVendorInfo,
                    filter: vendorInfo
                })
            ) {
                curVendorInfo.push(vendorInfo);
            }

            return JSON.stringify(curVendorInfo);
        },
        setContent: function (value, type) {
            if (!value) return null;

            var fnSetContent = {
                TEXTAREA: function (value) {
                    // If the value is a string, keep it as it is. Otherwise, check if it's an array or not.
                    var strValue = util.isString(value)
                        ? value
                        : util.isArray(value)
                        ? value.join('\n') // If it's an array, concatenate all its elements with newline delimiter.
                        : JSON.stringify(value); // If it's neither string nor array, convert to JSON string.

                    // Check if length of the output string exceeds max limit, then return a substring containing first 199 characters.
                    return strValue.length > MAXLEN.TEXTAREA
                        ? strValue.substr(0, MAXLEN.TEXTAREA - 1)
                        : strValue; // If not, return the whole string.
                },
                // This function takes 'value' as input argument and returns a truncated string version of the value based on its type:
                TEXT: function (value) {
                    // If the value is a string, keep it as it is. Otherwise, check if it's an array or not.
                    var strValue = util.isString(value)
                        ? value
                        : util.isArray(value)
                        ? value.join('\n') // If it's an array, concatenate all its elements with newline delimiter.
                        : JSON.stringify(value); // If it's neither string nor array, convert to JSON string.

                    // Check if length of the output string exceeds max limit, then return a substring containing first 199 characters.
                    return strValue.length > MAXLEN.TEXT
                        ? strValue.substr(0, MAXLEN.TEXT - 1)
                        : strValue; // If not, return the whole string.
                }
            };

            return (fnSetContent[type] || fnSetContent['TEXT']).call(this, value);
        },
        cleanupOrderLines: function (option) {
            var logTitle = [LogTitle, 'cleanupOrderLines'].join('::'),
                returnValue;

            try {
                var lineCount = Current.PO_REC.getLineCount({ sublistId: 'item' }),
                    hasLineUpdates = false;

                for (line = 0; line < lineCount; line++) {
                    var orderLineData = vc2_record.extractLineValues({
                            record: Current.PO_REC,
                            line: line,
                            columns: vc2_util.arrayKeys(MAPPING.lineColumn)
                        }),
                        updateLineValues = {};

                    for (var fld in orderLineData) {
                        if (orderLineData[fld] == 'Duplicate Item') updateLineValues[fld] = ' ';
                    }

                    if (!vc2_util.isEmpty(updateLineValues)) {
                        vc2_util.log(logTitle, '// cleanup needed line data: ', [
                            orderLineData,
                            updateLineValues
                        ]);

                        updateLineValues.line = line;
                        vc2_record.updateLine({
                            record: Current.PO_REC,
                            lineData: updateLineValues
                        });

                        hasLineUpdates = true;
                    }
                }

                returnValue = hasLineUpdates;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    var MAPPING = {
        lineColumn: {
            custcol_ctc_xml_dist_order_num: 'order_num', //text
            custcol_ctc_xml_date_order_placed: 'order_date', //text
            custcol_ctc_vc_order_placed_date: 'order_date', //date
            custcol_ctc_vc_shipped_date: 'ship_date', //date
            custcol_ctc_vc_eta_date: 'order_eta', //date
            custcol_ctc_vc_delivery_eta_date: 'order_delivery_eta', //date
            custcol_ctc_xml_ship_date: 'ship_date', //text
            custcol_ctc_xml_carrier: 'carrier', // text
            custcol_ctc_xml_eta: 'order_eta', //textarea
            custcol_ctc_xml_tracking_num: 'tracking_num', // textarea
            custcol_ctc_xml_inb_tracking_num: 'tracking_num', // textarea
            custcol_ctc_xml_serial_num: 'serial_num', // textarea
            // custcol_ctc_vc_xml_prom_deliv_date: 'promised_date',
            // custcol_ctc_vc_prom_deliv_date: 'promised_date',
            custcol_ctc_vc_vendor_info: 'INFO',
            custcol_ctc_vc_order_status: 'STATUS' // text
        },
        colVendorInfo: 'custcol_ctc_vc_vendor_info',
        vendorColumns: [
            'order_num',
            'order_status',
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'ship_date',
            'tracking_num',
            'carrier',
            'serial_num',
            // 'promised_date',
            'STATUS'
        ],
        columnType: {
            RESET: [
                'custcol_ctc_xml_dist_order_num',
                'custcol_ctc_xml_carrier',
                'custcol_ctc_xml_tracking_num',
                'custcol_ctc_xml_inb_tracking_num',
                'custcol_ctc_xml_serial_num',
                'custcol_ctc_vc_order_status'

                // 'custcol_ctc_xml_date_order_placed',
                // 'custcol_ctc_xml_ship_date',
                // 'custcol_ctc_xml_eta',
                // 'custcol_ctc_vc_xml_prom_deliv_date',
            ],

            DATE: [
                'custcol_ctc_vc_order_placed_date',
                'custcol_ctc_vc_eta_date',
                'custcol_ctc_vc_delivery_eta_date',
                'custcol_ctc_vc_prom_deliv_date',
                'custcol_ctc_vc_shipped_date'
            ],
            // entry: ['custcol_ctc_xml_carrier', 'custcol_ctc_vc_order_status'],
            // stack: ['custcol_ctc_xml_eta'],
            BIGLIST: [
                'custcol_ctc_xml_tracking_num',
                'custcol_ctc_xml_inb_tracking_num',
                'custcol_ctc_xml_eta',
                'custcol_ctc_xml_serial_num',
                'custcol_ctc_vc_xml_prom_deliv_date'
                // 'custcol_ctc_vc_order_status'
            ],
            ORDERSTATUS: ['custcol_ctc_vc_order_status'],
            LIST: [
                'custcol_ctc_xml_dist_order_num',
                'custcol_ctc_xml_date_order_placed',
                'custcol_ctc_xml_ship_date',
                'custcol_ctc_xml_carrier'
                // 'custcol_ctc_xml_tracking_num',
                // 'custcol_ctc_xml_inb_tracking_num'
            ]
        }
    };

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    //	function updatePOItemData(poNum, lineData)
    function updatePOItemData(option) {
        var logTitle = [LogTitle, 'updatePO'].join('::');

        var arrVendorLines = option.lineData; //vc2_util.copyValues();
        Current.PO_NUM = option.poNum;
        Current.PO_REC = option.po_record;
        Current.isDropPO = option.isDropPO;
        returnValue = { id: null };

        Current.MainCFG = option.mainConfig || vcs_configLib.mainConfig();
        Current.OrderCFG =
            option.orderConfig || vcs_configLib.orderVendorConfig({ poId: Current.PO_REC.id });

        LogPrefix = ['[', Current.PO_REC.type, ':', Current.PO_REC.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var isUpdatedPO = false;
        Helper.getDateFormat();
        try {
            if (!Current.PO_REC || Current.PO_REC == null) throw ERROR_MSG.MISSING_PO;

            var POData = {
                bypassVC: Current.PO_REC.getValue({ fieldId: 'custbody_ctc_bypass_vc' }),
                createdFromID: Current.PO_REC.getValue({ fieldId: 'createdfrom' }),
                isDropPO: Current.PO_REC.getValue({ fieldId: 'custbody_isdropshippo' }),
                DocNum: Current.PO_REC.getValue({ fieldId: 'tranid' })
            };

            var specialOrder = false;
            vc2_util.log(logTitle, '// PO Data: ', POData);

            returnValue.id = POData.createdFromID;
            if (POData.bypassVC) return returnValue;

            // extract lines from the PO
            var itemAltNameColId =
                    Current.OrderCFG.itemColumnIdToMatch || Current.MainCFG.itemColumnIdToMatch,
                // Alt MPN Col
                itemAltMPNColId =
                    Current.OrderCFG.itemMPNColumnIdToMatch ||
                    Current.MainCFG.itemMPNColumnIdToMatch,
                // PO Columns
                poColumns = [
                    'item',
                    'quantity',
                    'rate',
                    'amount',
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN,
                    vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO
                ];

            if (itemAltNameColId) poColumns.push(itemAltNameColId);
            if (itemAltMPNColId) poColumns.push(itemAltMPNColId);

            Current.OrderLines = vc2_record.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: poColumns,
                mainConfig: Current.MainCFG,
                orderConfig: Current.OrderCFG
            });

            vc2_util.log(logTitle, '###### UPDATE PO LINES: START ######');
            vc2_util.log(logTitle, '... PO lines data:', Current.OrderLines);

            // clean up the order lines
            isUpdatedPO = Helper.cleanupOrderLines();

            // loop thru all vendor lines
            for (var i = 0; i < arrVendorLines.length; i++) {
                var vendorLine = arrVendorLines[i];
                vc2_util.log(logTitle, '***** Line Info ****** ', vendorLine);

                // check if its skipped
                if (vendorLine.SKIPPED) {
                    vc2_util.log(logTitle, '...  skipping line', vendorLine.SKIPPED);
                    continue;
                }

                try {
                    /// look for a matching line from the
                    var orderLineMatch = vc2_record.findMatchingOrderLine({
                        record: Current.PO_REC,
                        orderLines: Current.OrderLines,
                        lineData: vendorLine,
                        mainConfig: Current.MainCFG,
                        orderConfig: Current.OrderCFG
                    });
                    vendorLine.STATUS = Helper.buildVendorStatus(vendorLine);

                    var orderLineData,
                        updateLineValues = {};

                    if (orderLineMatch) {
                        orderLineData = vc2_record.extractLineValues({
                            record: Current.PO_REC,
                            line: orderLineMatch.line,
                            columns: vc2_util.arrayKeys(MAPPING.lineColumn)
                        });

                        // update the order status lines
                        vcs_processLib.updateMatchedLine({
                            poId: Current.PO_REC.id,
                            vendorLine: vendorLine,
                            orderLine: orderLineMatch
                        });

                        // vc2_util.serviceRequest({
                        //     moduleName: 'processV1',
                        //     action: 'updateMatchedLine',
                        //     parameters: {
                        //         poId: Current.PO_REC.id,
                        //         vendorLine: vendorLine,
                        //         orderLine: orderLineMatch
                        //     }
                        // });
                    }

                    if (!orderLineMatch) {
                        throw util.extend(ERROR_MSG.MATCH_NOT_FOUND, {
                            details: [vendorLine.item_num, vendorLine.vendorSKU].join(':')
                        });
                    }

                    // clear the vendor order status && vendor info
                    orderLineData['custcol_ctc_vc_order_status'] = '';
                    orderLineData['custcol_ctc_vc_vendor_info'] = '';

                    // var SHIP_FIELDS = ['ship_date', 'tracking_num', 'carrier', 'serial_num'];
                    var SHIP_FIELDS = []; // ['ship_date', 'tracking_num', 'serial_num'];

                    // loop thru the vendor columns
                    for (var ii = 0, jj = MAPPING.vendorColumns.length; ii < jj; ii++) {
                        var vendorCol = MAPPING.vendorColumns[ii];

                        if (vc2_util.inArray(vendorCol, SHIP_FIELDS)) {
                            // If DropShip and fulfillment is not enabled
                            if (
                                Current.isDropPO &&
                                (!Current.MainCFG.createIF || !Current.OrderCFG.processDropships)
                            ) {
                                vc2_util.log(logTitle, '..  skipping ship fields', vendorCol);
                                continue;
                            }

                            if (
                                !Current.isDropPO &&
                                (!Current.MainCFG.createIR ||
                                    !Current.OrderCFG.processSpecialOrders)
                            ) {
                                vc2_util.log(logTitle, '..  skipping ship fields', vendorCol);
                                continue;
                            }
                        }

                        var orderCols = vc2_util.getKeysFromValues({
                                source: MAPPING.lineColumn,
                                value: vendorCol
                            }),
                            vendorValue = vendorLine[vendorCol];

                        for (var iii = 0, jjj = orderCols.length; iii < jjj; iii++) {
                            var currLineCol = orderCols[iii],
                                currLineVal = orderLineData[currLineCol],
                                currLineText = orderLineData[currLineCol + '_text'],
                                vendorListValue,
                                currListValue;

                            // undefined fix
                            if (currLineVal && util.isString(currLineVal))
                                currLineVal = currLineVal.replace(/undefined/gi, '\n');

                            // set the new
                            var newValue = vendorValue;

                            // // if vendorValue is empty or 'NA', check if we need to update the column
                            // if (vc2_util.isEmpty(newValue) || newValue == 'NA') {
                            //     if (currLineVal) updateLineValues[currLineCol] = newValue;
                            //     continue;
                            // }

                            if (vc2_util.inArray(currLineCol, MAPPING.columnType.RESET)) {
                                currLineVal = null;
                                currLineText = null;
                            }

                            /// LIST TYPE //////////////
                            if (vc2_util.inArray(currLineCol, MAPPING.columnType.LIST)) {
                                // If currLineVal exists, is not equal to 'NA' or 'Duplicate Item',
                                //      split it by new lines to create an array
                                //      otherwise, set an empty array to currListValue
                                currListValue =
                                    currLineVal &&
                                    currLineVal !== 'NA' &&
                                    currLineVal !== 'Duplicate Item'
                                        ? currLineVal.split(/\n/)
                                        : [];

                                // no change at all, if empty`
                                if (vc2_util.isEmpty(newValue) || newValue == 'NA') continue;

                                // make the list unique
                                currListValue = vc2_util.uniqueArray(currListValue);

                                // if the new value is not yet, add it
                                if (!vc2_util.inArray(newValue, currListValue)) {
                                    if (currLineCol == 'custcol_ctc_xml_eta') {
                                        currListValue.unshift(newValue); // custcol_ctc_xml_eta is a stack, place it on top
                                    } else {
                                        currListValue.push(newValue);
                                    }
                                }

                                newValue = Helper.setContent(currListValue, 'TEXT') || 'NA';

                                // Check if the current line value is different from the new value
                                if (orderLineData[currLineCol] != newValue) {
                                    updateLineValues[currLineCol] = newValue;
                                }
                            }

                            /// BIG LIST TYPE //////////////
                            //   -  newValues can be comma-separated values
                            //   -  currentValues can be multiple entries
                            else if (vc2_util.inArray(currLineCol, MAPPING.columnType.BIGLIST)) {
                                // create list for current value
                                currListValue =
                                    currLineVal && currLineVal !== 'NA'
                                        ? currLineVal.split(/\n/)
                                        : [];

                                // create list for vendor value
                                vendorListValue =
                                    vendorValue && vendorValue != 'NA'
                                        ? vendorValue.split(/,/)
                                        : [];

                                var newListValue = [],
                                    hasExceededLength = false;
                                currListValue.concat(vendorListValue).forEach(function (entree) {
                                    if (hasExceededLength) return false;

                                    // do not include NA or Duplicate Item entrees
                                    if (
                                        vc2_util.inArray(entree, [
                                            'NA',
                                            'Duplicate Item',
                                            MAXLEN.ERRORMSG
                                        ])
                                    )
                                        return false;

                                    // do not include duplicates
                                    if (vc2_util.inArray(entree, newListValue)) return false;

                                    newListValue.push(entree);

                                    // if it already exceeded, add our error msg
                                    if (newListValue.join('\n').length > MAXLEN.TEXTAREA - 50) {
                                        hasExceededLength = true;
                                        newListValue.pop();
                                        newListValue.push(MAXLEN.ERRORMSG);
                                    }

                                    return true;
                                });

                                newValue = Helper.setContent(newListValue, 'TEXTAREA') || 'NA';

                                // Check if the current line value is different from the new value
                                if (orderLineData[currLineCol] != newValue) {
                                    updateLineValues[currLineCol] = newValue;
                                }
                            }

                            /// ORDER STATUS TYPE //////////////
                            //   -  newValues can be comma-separated values
                            //   -  currentValues can be multiple entries
                            else if (
                                vc2_util.inArray(currLineCol, MAPPING.columnType.ORDERSTATUS)
                            ) {
                                // create list for current value
                                currListValue =
                                    currLineVal && currLineVal !== 'NA'
                                        ? currLineVal.split(/\n/)
                                        : [];

                                // create list for vendor value
                                vendorValue = vendorValue && vendorValue != 'NA' ? vendorValue : '';

                                if (
                                    vendorValue &&
                                    vendorValue != 'NA' &&
                                    !vc2_util.inArray(vendorValue, currListValue)
                                ) {
                                    currListValue.push(vendorValue);
                                }

                                var newListValue = [],
                                    hasExceededLength = false;

                                currListValue.forEach(function (value) {
                                    if (hasExceededLength) return false;

                                    // do not include NA or Duplicate Item entrees
                                    if (
                                        vc2_util.inArray(value, [
                                            'NA',
                                            'Duplicate Item',
                                            MAXLEN.ERRORMSG
                                        ])
                                    )
                                        return false;

                                    // do not include duplicates
                                    if (vc2_util.inArray(value, newListValue)) return false;

                                    newListValue.push(value);

                                    // if it already exceeded, add our error msg
                                    if (newListValue.join('\n').length > MAXLEN.TEXTAREA - 50) {
                                        hasExceededLength = true;
                                        newListValue.pop();
                                        newListValue.push(MAXLEN.ERRORMSG);
                                    }

                                    return true;
                                });

                                newValue = Helper.setContent(newListValue, 'TEXTAREA');

                                // Check if the current line value is different from the new value
                                if (orderLineData[currLineCol] != newValue) {
                                    updateLineValues[currLineCol] = newValue;
                                }
                            }

                            /// DATE COLUMN TYPE //////////////
                            else if (vc2_util.inArray(currLineCol, MAPPING.columnType.DATE)) {
                                // no change at all, if empty
                                if (vc2_util.isEmpty(newValue) || newValue == 'NA') continue;

                                newValue =
                                    vendorCol == 'order_eta'
                                        ? parseDate({
                                              dateString: vendorValue,
                                              returnClosestDate: true
                                          })
                                        : parseDate({
                                              dateString: vendorValue
                                          });

                                if (Helper.formatDate(currLineVal) != Helper.formatDate(newValue))
                                    updateLineValues[currLineCol] = newValue;
                            } else {
                                currLineVal =
                                    currLineVal &&
                                    currLineVal !== 'NA' &&
                                    currLineVal !== 'Duplicate Item'
                                        ? currLineVal
                                        : 'NA';

                                newValue = vendorValue && vendorValue !== 'NA' ? vendorValue : 'NA';

                                // for everything else, just overwrite if not the same value already
                                if (orderLineData[currLineCol] != newValue)
                                    updateLineValues[currLineCol] = newValue;
                            }
                        }
                    }
                    vc2_util.log(logTitle, '...updateLineValues', updateLineValues);

                    if (
                        !vc2_util.isEmpty(updateLineValues) ||
                        !orderLineData[MAPPING.colVendorInfo]
                    ) {
                        // set the line to update
                        updateLineValues.line = orderLineMatch.line;

                        updateLineValues[MAPPING.colVendorInfo] = Helper.setContent(
                            Helper.buildLineVendorInfo(
                                orderLineData[MAPPING.colVendorInfo],
                                vendorLine
                            ),
                            'TEXTAREA'
                        );

                        isUpdatedPO = true;

                        vc2_record.updateLine({
                            record: Current.PO_REC,
                            lineData: updateLineValues
                        });
                    }
                } catch (line_error) {
                    vc2_util.logError(logTitle, line_error);

                    vc2_util.vcLog({
                        title: 'Update Record Line',
                        error: line_error,
                        transaction: Current.PO_REC ? Current.PO_REC.id : null,
                        // status: vc2_constant.LIST.VC_LOG_STATUS.RECORD_ERROR,
                        isError: true
                    });

                    continue;
                }
            }

            if (isUpdatedPO) {
                Current.PO_REC.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                returnValue.lineuniquekey = null;
                vc2_util.log(logTitle, ' // PO updated successfully!');
            }
            vc2_util.log(logTitle, 'VendorLines', arrVendorLines);

            // send the serviceRequest instead of a lib access
        } catch (error) {
            vc2_util.vcLog({
                title: 'PO Update',
                message: error.message || error,
                recordId: Current.PO_REC ? Current.PO_REC.id : null,
                status:
                    error.status || error.logStatus || vc2_constant.LIST.VC_LOG_STATUS.RECORD_ERROR
            });

            vc2_util.logError(logTitle, error);

            returnValue.id = null;
            returnValue.error = error;
        } finally {
            vc2_util.log(logTitle, '###### UPDATE PO LINES: END ######', returnValue);
        }

        return returnValue;
    }

    function validateLineNumber(option) {
        //po_record, itemNum, vendorSKU, hashSpace, xmlVendor
        var logTitle = [LogTitle, 'validateLineNumber'].join('::'),
            returnValue = null;

        var lineData = option.lineData,
            orderLines = option.orderLines || Current.OrderLines,
            hashSpace =
                option.ingramHashSpace || Current.MainCFG ? Current.MainCFG.ingramHashSpace : null,
            xmlVendor = option.xmlVendor || Current.OrderCFG ? Current.OrderCFG.xmlVendor : null;

        Current.PO_REC = option.po_record || Current.PO_REC;
        lineData.vendorSKU = lineData.vendorSKU || lineData.item_num_alt;

        vc2_util.log(logTitle, '>> lineData: ', lineData);
        var VendorList = vc2_constant.LIST.XML_VENDOR,
            GlobalVar = vc2_constant.GLOBAL;

        try {
            if (vc2_util.isEmpty(lineData.item_num) || lineData.item_num == 'NA')
                throw 'Item number is missing';

            var lineNotFound = false,
                matchFound = false,
                lineItemValues = {},
                i;
            for (var i = 0; i <= orderLines.length; i++) {
                var orderLine = orderLines[i];
                vc2_util.log(logTitle, '...order linevalues: ', orderLineData);

                lineItemValues = {
                    itemNum: orderLine[GlobalVar.ITEM_ID_LOOKUP_COL],
                    skuName: GlobalVar.VENDOR_SKU_LOOKUP_COL
                        ? orderLine[GlobalVar.VENDOR_SKU_LOOKUP_COL]
                        : null,
                    dnhName: orderLine[vc2_constant.FIELD.TRANSACTION.DH_MPN]
                };

                vc2_util.log(logTitle, '... line values: ', lineItemValues);

                // check for itemNum or skuName
                if (
                    // check for itemNum
                    lineData.item_num == lineItemValues.itemNum ||
                    // check for vendorSKU
                    (lineData.vendorSKU && lineData.vendorSKU == lineItemValues.skuName) ||
                    // check for dnh
                    (xmlVendor == VendorList.DandH &&
                        vc2_util.inArray(lineItemValues.dnhName, [
                            lineData.item_num,
                            lineData.vendorSKU
                        ]))
                ) {
                    // match found;
                    matchFound = true;
                    break;
                }

                // check for ingram match
                if (
                    Current.MainCFG.ingramHashSpace &&
                    vc2_util.inArray(Current.OrderCFG.xmlVendor, [
                        VendorList.INGRAM_MICRO_V_ONE,
                        VendorList.INGRAM_MICRO
                    ])
                ) {
                    // check for itemNum
                    if (lineItemValues.itemNum.replace('#', ' ') == lineData.item_num) break;
                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                record;
            }

            var lineCount = Current.PO_REC.getLineCount({ sublistId: 'item' });
            if (lineCount <= 0) throw 'No line items found';

            for (i = 0; i < lineCount; i++) {
                lineNotFound = false;

                lineItemValues = {
                    itemNum: Current.PO_REC.getSublistText({
                        sublistId: 'item',
                        fieldId: vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                        line: i
                    }),
                    skuName: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                        ? Current.PO_REC.getSublistText({
                              sublistId: 'item',
                              fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                              line: i
                          })
                        : null,
                    dnhName: Current.PO_REC.getSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        line: i
                    })
                };

                vc2_util.log(logTitle, '// lineValues: ', lineItemValues);

                // check for itemNum or skuName
                if (
                    // check for itemNum
                    lineData.item_num == lineItemValues.itemNum ||
                    // check for vendorSKU
                    (lineData.vendorSKU && lineData.vendorSKU == lineItemValues.skuName) ||
                    // check for dnh
                    (xmlVendor == VendorList.DandH &&
                        vc2_util.inArray(lineItemValues.dnhName, [
                            lineData.item_num,
                            lineData.vendorSKU
                        ]))
                ) {
                    // match found;
                    matchFound = true;
                    break;
                }

                // check for ingram match
                if (
                    Current.MainCFG.ingramHashSpace &&
                    vc2_util.inArray(Current.OrderCFG.xmlVendor, [
                        VendorList.INGRAM_MICRO_V_ONE,
                        VendorList.INGRAM_MICRO
                    ])
                ) {
                    // check for itemNum
                    if (lineItemValues.itemNum.replace('#', ' ') == lineData.item_num) break;
                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                var tempItemNum = Current.PO_REC.getSublistText({
                    sublistId: 'item',
                    fieldId: vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    line: i
                });

                var tempVendorSKU = vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                    ? Current.PO_REC.getSublistText({
                          sublistId: 'item',
                          fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                          line: i
                      })
                    : null;

                // check for itemNum
                if (tempItemNum == lineData.item_num) break;

                // check for vendorSKU
                if (lineData.vendorSKU && tempVendorSKU && tempVendorSKU == lineData.vendorSKU)
                    break;

                //Ingram Hash replacement
                if (
                    Current.MainCFG.ingramHashSpace &&
                    (Current.OrderCFG.xmlVendor == VendorList.INGRAM_MICRO_V_ONE ||
                        Current.OrderCFG.xmlVendor == VendorList.INGRAM_MICRO)
                ) {
                    // check for itemNum
                    if (lineData.item_num.replace('#', ' ') == tempItemNum) break;

                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                if (Current.OrderCFG.xmlVendor == VendorList.DandH) {
                    //D&H Item replacement
                    var dAndhItem = Current.PO_REC.getSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        line: i
                    });

                    if (dAndhItem == lineData.item_num) break;
                }

                // we reached this, line not yet found
                lineNotFound = true;
            }

            returnValue = lineNotFound ? null : i;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            returnValue = null;
        } finally {
            vc2_util.log(logTitle, '// Line Number: ', returnValue);
        }

        return returnValue;
    }

    function parseDate(option) {
        var logTitle = [LogTitle, 'parseDate'].join('::');

        var dateString = option.dateString,
            date = '';

        if (dateString && dateString.length > 0 && dateString != 'NA') {
            try {
                var stringToProcess = dateString.replace(/-/g, '/').replace(/\n/g, ' ').split(' ');
                var currentDate = new Date();

                for (var i = 0; i < stringToProcess.length; i++) {
                    var singleString = stringToProcess[i];
                    if (singleString) {
                        var stringArr = singleString.split('T'); //handle timestamps with T
                        singleString = stringArr[0];
                        var convertedDate = new Date(singleString);
                        date = date || convertedDate;

                        // returnClosestDate gets date nearest current date vs default latest date
                        if (
                            option.returnClosestDate &&
                            ((convertedDate >= currentDate && convertedDate < date) ||
                                (convertedDate < currentDate && convertedDate > date))
                        ) {
                            date = convertedDate;
                        } else if (!option.returnClosestDate && convertedDate > date) {
                            date = convertedDate;
                        }
                    }
                }
            } catch (e) {
                vc2_util.logError(logTitle, e);
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
                type: Current.dateFormat ? Current.dateFormat : ns_format.Type.DATE
            });
        }

        return date;
    }

    function getOrderLineNumbers(options) {
        var logTitle = [LogTitle, 'getOrderLineNumbers'].join('::');

        var fulfillmentId = options.fulfillmentId,
            poLine = options.poLine,
            soLine,
            fulfillmentLine;

        var recFulfillment = record.load({
            type: record.Type.ITEM_FULFILLMENT,
            id: fulfillmentId
        });

        if (recFulfillment) {
            var lineCount = recFulfillment.getLineCount({
                sublistId: 'item'
            });

            for (var i = 0; i < lineCount; i++) {
                var currPoLine = recFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'poline',
                    line: i
                });

                if (!currPoLine != poLine) continue;
                else {
                    soLine = recFulfillment.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'orderline',
                        line: i
                    });
                    fulfillmentLine = recFulfillment.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        line: i
                    });
                    break;
                }
            }
        }

        return {
            poLine: poLine,
            soLine: soLine,
            fulfillmentLine: fulfillmentLine
        };
    }

    function addOrderLine(option) {
        var logTitle = [LogTitle, 'addOrderLine'].join('::'),
            returnValue = true;

        try {
            var vendorLine = option.vendorLine,
                poID = option.poId;

            vc2_util.log(logTitle, '// vendorLine: ', vendorLine);

            var ORDERLINE_REC = vc2_constant.RECORD.ORDER_LINE;
            var orderLine = vendorLine.MATCHED_ORDERLINE || {};

            var OrderlineValues = {
                VENDOR: Current.OrderCFG.xmlVendor,
                TXN_LINK: poID,
                ORDER_NUM: vendorLine.order_num,
                ORDER_STATUS: vendorLine.order_status,
                LINE_STATUS: vendorLine.line_status,
                ITEM: vendorLine.item_num,
                ITEM_LINK: orderLine.item,
                SKU: vendorLine.vendorSKU || vendorLine.item_num_alt,
                LINE_NO: vendorLine.line_num,
                POLINE_UNIQKEY: orderLine.line,
                QTY: vendorLine.ship_qty,
                PO_QTY: orderLine.quantity,
                ORDER_DATE:
                    vc2_util.isEmpty(vendorLine.order_date) || vendorLine.order_date == 'NA'
                        ? null
                        : parseDate({ dateString: vendorLine.order_date }),

                ORDER_DATETXT: vendorLine.order_date,
                SHIPPED_DATE:
                    vc2_util.isEmpty(vendorLine.ship_date) || vendorLine.ship_date == 'NA'
                        ? null
                        : parseDate({ dateString: vendorLine.ship_date }),

                ETA_DATE:
                    vc2_util.isEmpty(vendorLine.order_eta_ship) || vendorLine.order_eta_ship == 'NA'
                        ? null
                        : parseDate({ dateString: vendorLine.order_eta_ship }),

                ETD_DATE:
                    vc2_util.isEmpty(vendorLine.eta_delivery_date) ||
                    vendorLine.eta_delivery_date == 'NA'
                        ? null
                        : parseDate({ dateString: vendorLine.eta_delivery_date }),

                CARRIER: vendorLine.carrier,
                // SHIP_METHOD: '',
                TRACKING: vendorLine.tracking_num,
                SERIALNUM: vendorLine.serial_num,
                ORDER_DATA: '',
                LINE_DATA: vendorLine.vendorData
            };

            vc2_util.log(logTitle, '///OrderlineValues ', OrderlineValues);

            // do a search
            var searchOption = {
                type: ORDERLINE_REC.ID,
                columns: ['internalid'],
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    [ORDERLINE_REC.FIELD.TXN_LINK, 'anyof', OrderlineValues.TXN_LINK],
                    'AND',
                    [ORDERLINE_REC.FIELD.ORDER_NUM, 'is', OrderlineValues.ORDER_NUM],
                    'AND',
                    [ORDERLINE_REC.FIELD.ITEM, 'is', OrderlineValues.ITEM]
                ]
            };

            if (OrderlineValues.POLINE_UNIQKEY) {
                searchOption.filters.push('AND', [
                    ORDERLINE_REC.FIELD.POLINE_UNIQKEY,
                    'is',
                    OrderlineValues.POLINE_UNIQKEY
                ]);
            }

            vc2_util.log(logTitle, '// search option:  ', searchOption);
            var searchObj = ns_search.create(searchOption);

            var hasExisting = searchObj.runPaged().count;
            vc2_util.log(logTitle, '>> Total existing orderline: ', hasExisting);

            if (hasExisting) {
                searchObj.run().each(function (row) {
                    ns_record.submitFields({
                        type: ORDERLINE_REC.ID,
                        id: row.id,
                        values: OrderlineValues
                    });
                });
            } else {
                var recOL = ns_record.create({ type: ORDERLINE_REC.ID });

                for (var fld in OrderlineValues) {
                    recOL.setValue({
                        fieldId: ORDERLINE_REC.FIELD[fld],
                        value: OrderlineValues[fld]
                    });
                }
                recOL.save();
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);

            // vc2_util.vcLog({
            //     title: 'Update Record Line',
            //     error: line_error,
            //     transaction: Current.PO_REC ? Current.PO_REC.id : null,
            //     // status: vc2_constant.LIST.VC_LOG_STATUS.RECORD_ERROR,
            //     isError: true
            // });
        }

        return returnValue;
    }

    return {
        updatepo: updatePOItemData,
        validateline: validateLineNumber,
        validateLineNumber: validateLineNumber,
        getOrderLineNumbers: getOrderLineNumbers,
        parseDate: parseDate,
        FieldMapping: MAPPING
    };
});
