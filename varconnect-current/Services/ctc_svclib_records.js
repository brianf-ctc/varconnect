/**
 * Copyright (c) 2025  sCatalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(function (require) {
    var LogTitle = 'SVC:Records';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record');

    var CACHE_TTL = 300; // store the data for 1mins

    var CURRENT = {},
        ERROR_MSG = vc2_constant.ERRORMSG,
        MAPPING = {
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

    var FIELD_MAPPING = {
        PO_LINE_COLUMN: {
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
            custcol_ctc_vc_vendor_info: 'INFO',
            custcol_ctc_vc_order_status: 'STATUS' // text
        },
        VENDOR_LINE_COL: [
            'order_num',
            'order_status',
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'ship_date',
            'tracking_num',
            'carrier',
            'serial_num',
            'STATUS'
        ],
        COLUMNS: [
            'internalid',
            'type',
            'tranid',
            'trandate',
            'entity',
            'postingperiod',
            'custbody_ctc_vc_override_ponum',
            'custbody_ctc_bypass_vc',
            'amount',
            'createdfrom',
            'custbody_isdropshippo',
            'custbody_ctc_po_link_type'
        ]
    };

    var Helper = {
        sanitizeString: function (str) {
            return str ? str.replace(/[^a-zA-Z0-9]/g, '') : str;
        }
    };

    var RecordsLib = {
        searchTransaction: function (option) {
            var logTitle = [LogTitle, 'searchTransaction'].join('::'),
                returnValue;

            var poNum = option.name || option.tranid || option.poName || option.poNum,
                poId = option.id || option.internalid || option.poId,
                recordType = option.type || option.recordType || ns_record.Type.PURCHASE_ORDER,
                searchFields = option.fields || option.columns,
                searchFilters = option.filters;

            var paramFltrs = [];

            try {
                if (!poNum && !poId) throw 'Missing parameter: PO Num/ PO Id';

                var recordData = {},
                    searchOption = {
                        type: recordType,
                        filters: [['mainline', 'is', 'T']],
                        columns: [
                            'internalid',
                            'type',
                            'tranid',
                            'trandate',
                            'entity',
                            'postingperiod',
                            'custbody_ctc_vc_override_ponum',
                            'custbody_ctc_bypass_vc',
                            'amount',
                            'createdfrom',
                            'custbody_isdropshippo',
                            'custbody_ctc_po_link_type'
                        ]
                    };

                if (vc2_util.isOneWorld()) {
                    searchOption.columns.push('subsidiary');
                    searchOption.columns.push('subsidiary.country');
                }

                // if the searchFields is not empty, concatenate it with searchOption.columns
                if (!vc2_util.isEmpty(searchFields))
                    searchOption.columns = searchOption.columns.concat(searchFields);

                if (poId) {
                    searchOption.filters.push('AND', ['internalid', 'anyof', poId]);
                    paramFltrs.push('id=' + poId);
                } else if (poNum) {
                    searchOption.filters.push('AND', [
                        ['numbertext', 'is', poNum],
                        'OR',
                        ['custbody_ctc_vc_override_ponum', 'is', poNum]
                    ]);
                    paramFltrs.push('tranid=' + poNum);
                } else if (!vc2_util.isEmpty(searchFilters)) {
                    searchOption.filters.push('AND', searchFilters);
                    paramFltrs.push('__AND=' + searchOption.filters.join('||'));
                }

                //// RETRIEVE CACHED DATA
                var cacheKey = [
                    vc2_constant.CACHE_KEY.PO_DATA,
                    paramFltrs.join('&'),
                    searchOption.columns.join(':')
                ].join('__');

                // retrive the cache
                var cachedData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });
                if (!vc2_util.isEmpty(cachedData)) return cachedData;

                // vc2_util.log(logTitle, '>> search option', searchOption);

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count)
                    throw 'Unable to find the record : filters=' + paramFltrs.join('&');

                searchObj.run().each(function (row) {
                    recordData.id = row.id;

                    // update the PO_Data with the column values
                    for (var i = 0, j = searchOption.columns.length; i < j; i++) {
                        var colName = searchOption.columns[i].name || searchOption.columns[i],
                            colValue = row.getValue(searchOption.columns[i]),
                            colText = row.getText(searchOption.columns[i]);

                        recordData[colName] = colValue;

                        if (colText && colText != colValue) recordData[colName + '_text'] = colText;
                    }
                    return true; // return false to break the loop when a record is found.
                });
                returnValue = recordData;

                vc2_util.log(logTitle, '## RecordData: ', [recordData, cacheKey]);

                // set the cachedData
                vc2_util.setNSCache({ name: cacheKey, value: recordData, cacheTTL: CACHE_TTL });
                vc2_util.saveCacheList({
                    listName: vc2_constant.CACHE_KEY.PO_DATA,
                    cacheKey: cacheKey
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        updateRecord: function (option) {
            var logTitle = [LogTitle, 'updateRecord'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.type) throw 'Missing required parameter: type';
                if (!option.id) throw 'Missing required parameter: id';
                if (!option.data) throw 'Missing required parameter: data';
                var recordData = option.data;

                if (option.record) {
                    var recordObj = option.record;

                    for (var key in recordData) {
                        if (recordData.hasOwnProperty(key)) {
                            recordObj.setValue({
                                fieldId: key,
                                value: recordData[key]
                            });
                        }
                    }

                    returnValue = recordObj.save();
                } else {
                    returnValue = ns_record.submitFields({
                        type: option.type,
                        id: option.id,
                        values: recordData,
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }

                vc2_util.log(logTitle, 'Record updated successfully', {
                    type: option.type,
                    id: option.id
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        updateLineValues: function (option) {},
        extractValues: function (option) {
            var logTitle = [LogTitle, 'extractValues'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.record) throw 'Missing required parameter: record';
                if (!option.columns) throw 'Missing required parameter: columns';

                var recordObj = option.record,
                    columns = option.columns,
                    recordData = {};

                for (var i = 0, j = columns.length; i < j; i++) {
                    var colName = columns[i],
                        colValue = recordObj.getValue({ fieldId: colName }),
                        colText = recordObj.getText({ fieldId: colName });

                    recordData[colName] = colValue;

                    if (colText && colText != colValue) recordData[colName + '_text'] = colText;
                }

                returnValue = recordData;

                vc2_util.log(logTitle, 'Values extracted successfully', {
                    columns: columns
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        extractLineValues: function (option) {
            var logTitle = [LogTitle, 'extractLineValues'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.record) {
                    if (!option.poId) throw 'Missing required parameter: poId';
                    // if (!option.type) throw 'Missing required parameter: type';

                    option.record = ns_record.load({
                        type: option.type || ns_record.Type.PURCHASE_ORDER,
                        id: option.poId
                    });
                }
                var recordObj = option.record,
                    columns = option.columns || [
                        'item',
                        'rate',
                        'quantity',
                        'amount',
                        'quantityreceived',
                        'quantitybilled',
                        'taxrate',
                        'taxrate1',
                        'taxrate2',
                        'poline',
                        'orderline',
                        'lineuniquekey'
                    ],
                    additionalColumns = option.additionalColumns || [],
                    recordLines = [],
                    filter = option.filter || {};

                // if the addiotnal columns is not empty, concatenate it with columns
                if (!vc2_util.isEmpty(additionalColumns))
                    columns = columns.concat(additionalColumns);

                var lineCount = recordObj.getLineCount({ sublistId: option.sublistId || 'item' });

                for (var line = 0; line < lineCount; line++) {
                    var lineData = {
                        line: line
                    };

                    for (var i = 0, j = columns.length; i < j; i++) {
                        var colName = columns[i],
                            colValue = recordObj.getSublistValue({
                                sublistId: option.sublistId || 'item',
                                fieldId: colName,
                                line: line
                            }),
                            colText = recordObj.getSublistText({
                                sublistId: option.sublistId || 'item',
                                fieldId: colName,
                                line: line
                            });

                        lineData[colName] = colValue;

                        if (colText && colText != colValue) lineData[colName + '_text'] = colText;
                    }

                    var match = true;
                    for (var key in filter) {
                        if (filter.hasOwnProperty(key) && lineData[key] !== filter[key]) {
                            match = false;
                            break;
                        }
                    }

                    if (match) {
                        recordLines.push(lineData);
                    }
                }

                returnValue = recordLines;

                vc2_util.log(logTitle, 'Values extracted successfully', {
                    columns: columns
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        load: function (option) {
            var logTitle = [LogTitle, 'load'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.type) throw 'Missing required parameter: type';
                if (!option.id) throw 'Missing required parameter: id';

                var recordType = option.type,
                    recordId = option.id,
                    isDynamic = option.isDynamic || false;

                returnValue = ns_record.load({
                    type: recordType,
                    id: recordId,
                    isDynamic: isDynamic
                });

                vc2_util.log(logTitle, 'Record loaded successfully', {
                    type: recordType,
                    id: recordId
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        transform: function (option) {
            var logTitle = [LogTitle, 'transform'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.fromType) throw 'Missing required parameter: fromType';
                if (!option.toType) throw 'Missing required parameter: toType';
                if (!option.id) throw 'Missing required parameter: id';

                var fromType = option.fromType,
                    toType = option.toType,
                    recordId = option.id,
                    isDynamic = option.isDynamic || false,
                    defaultValues = option.defaultValues || {};

                returnValue = ns_record.transform({
                    fromType: fromType,
                    toType: toType,
                    id: recordId,
                    isDynamic: isDynamic,
                    defaultValues: defaultValues
                });

                vc2_util.log(logTitle, 'Record transformed successfully', {
                    fromType: fromType,
                    toType: toType,
                    id: recordId
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return RecordsLib;
});
