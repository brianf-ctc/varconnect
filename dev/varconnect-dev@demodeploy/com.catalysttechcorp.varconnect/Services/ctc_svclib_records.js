/**
 * Copyright (c) 2024  sCatalyst Tech Corp
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
        },
        isItemAltMatched: function (option) {
            var logTitle = [LogTitle, 'isItemAltMatched'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.itemIds && !option.poLines)
                    throw 'Missing required parameter: itemIds or poLines';

                var itemIds =
                    option.itemIds ||
                    option.poLines.map(function (line) {
                        return line.item;
                    });
                if (itemIds.length == 0) return false;
                itemIds = vc2_util.uniqueArray(itemIds);

                var listAltItemNames =
                    CURRENT.ALTNAMES ||
                    vc2_util.getNSCache({
                        name: 'ALT_ITEM_NAMES',
                        isJSON: true
                    }) ||
                    {};

                if (!vc2_util.isEmpty(listAltItemNames)) {
                    itemResults = itemIds.filter(function (itemId) {
                        return !vc2_util.isEmpty(listAltItemNames[itemId]);
                    });
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }
            return returnValue;
        },
        isItemMapped: function (option) {}
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
        },

        matchOrderLines: function (option) {
            var logTitle = [LogTitle, 'matchOrderLines'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.poId) throw 'Missing required parameter: poId';
                if (!option.vendorLines) throw 'Missing required parameter: vendorLines';

                var vendorLines = option.vendorLines,
                    poId = option.poId,
                    MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var poRecord = RecordsLib.load({ type: ns_record.Type.PURCHASE_ORDER, id: poId });
                var poLines = RecordsLib.extractLineValues({
                    record: poRecord,
                    additionalColumns: [
                        vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                        vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                        vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO,
                        vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY,
                        VendorCFG.itemColumnIdToMatch || MainCFG.itemColumnIdToMatch || 'item',
                        VendorCFG.itemMPNColumnIdToMatch || MainCFG.itemMPNColumnIdToMatch || 'item'
                    ]
                });

                if (!poRecord) throw 'Unable to load the PO record';
                vc2_util.log(logTitle, '## PO Lines: ', poLines);

                // prep the poLines and vendorLines
                // order it by quantity descending
                poLines.forEach(function (poLine) {
                    poLine.AVAILQTY = poLine.quantity - poLine.quantityreceived;
                    poLine.APPLIEDQTY = 0;
                    if (!poLine.APPLIEDRATE) poLine.APPLIEDRATE = poLine.rate || poLine.unitprice;
                    poLine.UseQuantity = function (qty) {
                        this.APPLIEDQTY += qty;
                        this.AVAILQTY -= qty;
                        return { APPLIEDQTY: qty };
                    };
                });
                //sort the poLines by AVAILQTY descending
                poLines.sort(function (a, b) {
                    return b.AVAILQTY - a.AVAILQTY;
                });

                vendorLines.forEach(function (vendorLine) {
                    vendorLine.APPLIEDQTY = 0;
                    vendorLine.MATCHING = [];

                    vendorLine.AVAILQTY = vc2_util.forceInt(
                        vendorLine.QUANTITY || vendorLine.ship_qty || vendorLine.quantity
                    );
                    vendorLine.QUANTITY = vendorLine.AVAILQTY;
                    if (!vendorLine.APPLIEDRATE)
                        vendorLine.APPLIEDRATE = vc2_util.forceFloat(
                            vendorLine.unitprice || vendorLine.line_price
                        );

                    /// check if there are serials
                    if (vendorLine.SERIALS) {
                        if (util.isString(vendorLine.SERIALS))
                            vendorLine.SERIALS = vendorLine.SERIALS.split(',');

                        // sort the serials
                        vendorLine.SERIALS.sort();
                    }

                    vendorLine.UseQuantity = function (qty) {
                        var returnValue = {};
                        this.APPLIEDQTY += qty;
                        this.AVAILQTY -= qty;

                        returnValue.APPLIEDQTY = qty;

                        if (this.SERIALS) {
                            returnValue.APPLIEDSERIALS = this.SERIALS.slice(0, qty);
                            // remove the applied serials
                            this.SERIALS = this.SERIALS.slice(qty);
                        }

                        return returnValue;
                    };
                });
                // sort the vendorLines by AVAILQTY descending
                vendorLines.sort(function (a, b) {
                    return b.AVAILQTY - a.AVAILQTY;
                });

                var arrItemAltNames, arrItemMappings;

                /// =====================================
                /// LOOP thru each vendorLines
                vendorLines.forEach(function (vendorLine) {
                    // first step, is to look for matching items
                    // availabe in the poLines
                    var MatchedLines = {
                        byItem: poLines.filter(function (poLine) {
                            return RecordsLib.isItemMatched({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                mainConfig: MainCFG,
                                vendorConfig: VendorCFG
                            });
                        })
                    };

                    if (!MatchedLines.byItem.length) {
                        // try to match the item alt names
                        MatchedLines.byItem = poLines.filter(function (poLine) {
                            return RecordsLib.isItemAltMatched({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listAltNames: RecordsLib.fetchItemAltNames({
                                    poLines: poLines,
                                    mainConfig: MainCFG,
                                    vendorConfig: VendorCFG
                                }),
                                mainConfig: MainCFG,
                                vendorConfig: VendorCFG
                            });
                        });
                    }

                    if (!MatchedLines.byItem.length) {
                        // try to match the item mappings
                        MatchedLines.byItem = poLines.filter(function (poLine) {
                            return RecordsLib.isItemMapped({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listMappedItems: RecordsLib.fetchItemMapping({
                                    poLines: poLines
                                })
                            });
                        });
                    }

                    // if there's still no match, skip the vendorLine
                    if (!MatchedLines.byItem.length) return;

                    // filter the polines that would fit the vendorLine AVAILQTY
                    util.extend(MatchedLines, {
                        byRateQty: MatchedLines.byItem.filter(function (poLine) {
                            return (
                                poLine.AVAILQTY == vendorLine.AVAILQTY &&
                                poLine.APPLIEDRATE == vendorLine.APPLIEDRATE
                            );
                        }),
                        byRate: MatchedLines.byItem.filter(function (poLine) {
                            return poLine.APPLIEDRATE == vendorLine.APPLIEDRATE;
                        }),
                        byQty: MatchedLines.byItem.filter(function (poLine) {
                            return poLine.AVAILQTY == vendorLine.AVAILQTY;
                        })
                    });

                    // if there's a byRateQty match, use it
                    if (MatchedLines.byRateQty.length) {
                        // this is the exact match

                        var matchedLine = MatchedLines.byRateQty[0], // get the first item
                            appliedLine = vendorLine.UseQuantity(matchedLine.AVAILQTY);

                        vendorLine.MATCHING.push(vc2_util.extend(matchedLine, appliedLine));
                        matchedLine.UseQuantity(appliedLine.APPLIEDQTY);

                        return true;
                    }

                    // if there's no exact match, loop thru the rate match
                    MatchedLines.byRate.forEach(function (poLine) {
                        if (!poLine.AVAILQTY) return;
                        if (!vendorLine.AVAILQTY) return;

                        var qty =
                            poLine.AVAILQTY > vendorLine.AVAILQTY
                                ? vendorLine.AVAILQTY
                                : poLine.AVAILQTY;
                        var matchedLine = poLine, // get the first item
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(matchedLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    // if there's no rate match, loop thru the quantity match
                    MatchedLines.byQty.forEach(function (poLine) {
                        if (!poLine.AVAILQTY) return;
                        if (!vendorLine.AVAILQTY) return;

                        var qty =
                            poLine.AVAILQTY > vendorLine.AVAILQTY
                                ? vendorLine.AVAILQTY
                                : poLine.AVAILQTY;

                        var matchedLine = poLine, // get the first item
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(matchedLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    // if there's no rate match, loop thru the item match
                    // until the vendorLine AVAILQTY is 0
                    MatchedLines.byItem.forEach(function (poLine) {
                        if (!poLine.AVAILQTY) return;
                        if (!vendorLine.AVAILQTY) return;

                        var qty =
                            poLine.AVAILQTY > vendorLine.AVAILQTY
                                ? vendorLine.AVAILQTY
                                : poLine.AVAILQTY;

                        var matchedLine = poLine, // get the first item
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(matchedLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    vc2_util.log(logTitle, 'Matched Line: ', MatchedLines);
                });
                /// END of vendor lines loop
                /// =====================================

                // sort the vendorLines by line number
                vendorLines.sort(function (a, b) {
                    return a.line - b.line;
                });

                returnValue = vendorLines;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },

        isItemMatched: function (option) {
            var logTitle = [LogTitle, 'isItemMatched'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.poLine) throw 'Missing required parameter: poLine';
                if (!option.vendorLine) throw 'Missing required parameter: vendorLine';

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var VendorList = vc2_constant.LIST.XML_VENDOR,
                    GlobalVar = vc2_constant.GLOBAL;

                var settings = {
                    isDandH:
                        option.isDandH || VendorCFG
                            ? VendorCFG.xmlVendor == VendorList.DandH
                            : null,
                    ingramHashSpace:
                        option.ingramHashSpace || MainCFG ? MainCFG.ingramHashSpace : null,
                    isIngram:
                        option.ingramHashSpace || VendorCFG
                            ? vc2_util.inArray(VendorCFG.xmlVendor, [
                                  VendorList.INGRAM_MICRO_V_ONE,
                                  VendorList.INGRAM_MICRO
                              ])
                            : null,
                    isDell:
                        option.isDell || VendorCFG ? VendorCFG.xmlVendor == VendorList.DELL : null
                };

                // normalize the item value
                var poItem = {
                    name: poLine.item_text || poLine.itemText || poLine.itemName,
                    skuValue:
                        poLine[GlobalVar.ITEM_ID_LOOKUP_COL] ||
                        poLine[GlobalVar.VENDOR_SKU_LOOKUP_COL],
                    altItem: poLine[VendorCFG.itemColumnIdToMatch || MainCFG.itemColumnIdToMatch],
                    altMPN: poLine[
                        VendorCFG.itemMPNColumnIdToMatch || MainCFG.itemMPNColumnIdToMatch
                    ],
                    sitemName: poLine.sitemname,
                    dnhValue: option.dnhValue || poLine[vc2_constant.FIELD.TRANSACTION.DH_MPN],
                    dellQuoteNo:
                        option.dellQuoteNo || poLine[vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO]
                };

                // try these matching conditions
                returnValue = false;
                var matchingCondition = {
                    ITEM: function () {
                        return (
                            (vendorLine.ITEMNAME &&
                                vc2_util.inArray(vendorLine.ITEMNAME, [
                                    poItem.name,
                                    poItem.skuValue
                                ])) ||
                            (vendorLine.MPNNAME &&
                                vc2_util.inArray(vendorLine.MPNNAME, [
                                    poItem.name,
                                    poItem.skuValue
                                ])) ||
                            // vendorSKU matches with item name or skuValue or altItem or altMPN
                            (vendorLine.SKUNAME &&
                                vc2_util.inArray(vendorLine.SKUNAME, [
                                    poItem.name,
                                    poItem.skuValue
                                ]))
                        );
                    },
                    ALTITEM_COL: function () {
                        var isMatched = false;

                        // Check if MainCFG itemColumnIdToMatch is defined and poLine has the corresponding value
                        if (MainCFG.itemColumnIdToMatch && poLine[MainCFG.itemColumnIdToMatch]) {
                            isMatched = MainCFG.matchItemToPartNumber
                                ? // If matchItemToPartNumber is true, match only with ITEMNAME and SKUNAME
                                  vc2_util.inArray(poLine[MainCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEMNAME,
                                      vendorLine.SKUNAME
                                  ])
                                : // Otherwise, match with ITEMNAME, SKUNAME, and MPNNAME
                                  vc2_util.inArray(poLine[MainCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEMNAME,
                                      vendorLine.SKUNAME,
                                      vendorLine.MPNNAME
                                  ]);
                        }
                        // Check if VendorCFG itemColumnIdToMatch is defined and poLine has the corresponding value
                        else if (
                            VendorCFG.itemColumnIdToMatch &&
                            poLine[VendorCFG.itemColumnIdToMatch]
                        ) {
                            isMatched = VendorCFG.matchItemToPartNumber
                                ? // If matchItemToPartNumber is true, match only with ITEMNAME and SKUNAME
                                  vc2_util.inArray(poLine[VendorCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEMNAME,
                                      vendorLine.SKUNAME
                                  ])
                                : // Otherwise, match with ITEMNAME, SKUNAME, and MPNNAME
                                  vc2_util.inArray(poLine[VendorCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEMNAME,
                                      vendorLine.SKUNAME,
                                      vendorLine.MPNNAME
                                  ]);
                        }

                        return isMatched;
                    },
                    DNH_ITEM: function () {
                        return (
                            settings.isDandH &&
                            poItem.dnhValue &&
                            vc2_util.inArray(poItem.dnhValue, [
                                vendorLine.ITEMNAME,
                                vendorLine.SKUNAME,
                                vendorLine.MPNNAME
                            ])
                        );
                    },
                    DELL_ITEM: function () {
                        return (
                            settings.isDell &&
                            poItem.dellQuoteNo &&
                            vc2_util.inArray(poItem.dellQuoteNo, [
                                vendorLine.ITEMNAME,
                                vendorLine.SKUNAME,
                                vendorLine.MPNNAME
                            ])
                        );
                    }
                };

                //loop thru the matching condition
                for (var key in matchingCondition) {
                    var result = matchingCondition[key].call();
                    if (result) {
                        vendorLine.MATCHED_BY = key;
                        returnValue = key;
                        break;
                    }
                }

                vc2_util.log(logTitle, '*** Item matched: ', returnValue);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },

        isItemAltMatched: function (option) {
            // try to match the item alt names
            var logTitle = [LogTitle, 'isItemAltMatched'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.poLine) throw 'Missing required parameter: poLine';
                if (!option.vendorLine) throw 'Missing required parameter: vendorLine';

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listAltNames = option.listAltNames,
                    MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                if (!listAltNames || !listAltNames[poLine.item]) throw 'No Alt Names found';

                var altItemNames = listAltNames[poLine.item],
                    arrAltNames = [];

                for (var key in altItemNames) {
                    if (altItemNames.hasOwnProperty(key)) {
                        arrAltNames.push(altItemNames[key]);
                    }
                }

                /// try to match the items
                var isMatched = false;

                if (MainCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = MainCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(poLine[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(poLine[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME
                          ]);
                }
                // Check if VendorCFG itemFieldIdToMatch is defined and poLine has the corresponding value
                if (!isMatched && VendorCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = VendorCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(poLine[VendorCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(poLine[VendorCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME
                          ]);
                }

                if (isMatched) vendorLine.MATCHED_BY = 'ALTITEM_REC';

                returnValue = isMatched;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },

        isItemMapped: function (option) {
            // try to match the item alt names
            var logTitle = [LogTitle, 'isItemMapped'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.poLine) throw 'Missing required parameter: poLine';
                if (!option.vendorLine) throw 'Missing required parameter: vendorLine';

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listMappedItems = option.listMappedItems,
                    MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                if (!listMappedItems || !listMappedItems[poLine.item]) throw 'No Alt Names found';

                /// try to match the items
                var isMatched = false;

                listMappedItems[poLine.item].forEach(function (mappedItem) {
                    if (isMatched) return;
                    isMatched = vc2_util.inArray(mappedItem, [
                        vendorLine.ITEMNAME,
                        vendorLine.SKUNAME,
                        vendorLine.MPNNAME
                    ]);
                });

                if (isMatched) vendorLine.MATCHED_BY = 'MAPPING';

                returnValue = isMatched;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },

        fetchItemMapping: function (option) {
            var logTitle = [LogTitle, 'fetchItemMapping'].join('::'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.itemIds && !option.poLines)
                    throw 'Missing required parameter: itemIds or poLines';

                var ItemMapREC = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;

                var itemIds =
                    option.itemIds ||
                    option.poLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds)) throw 'No itemIds found';

                var currentMappedItems =
                    CURRENT.MAPPED_ITEMS ||
                    vc2_util.getNSCache({
                        name: 'MAPPED_ITEMS',
                        isJSON: true
                    }) ||
                    {};
                var missingItemIds = [];
                itemIds.forEach(function (itemId) {
                    if (vc2_util.isEmpty(currentMappedItems[itemId])) {
                        missingItemIds.push(itemId);
                    }
                });

                // if all of the itemids are already fetched, return the list
                if (!missingItemIds.length) return currentMappedItems;

                /// fetch the item mappings
                var searchOption = {
                    type: ItemMapREC.ID,
                    columns: ['internalid', 'name', ItemMapREC.FIELD.ITEM],
                    filters: [[ItemMapREC.FIELD.ITEM, 'anyof', missingItemIds]]
                };
                var arrSearchResults = vc2_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                arrSearchResults.forEach(function (result) {
                    var itemId = result.getValue(ItemMapREC.FIELD.ITEM),
                        mappedName = result.getValue('name');

                    if (!currentMappedItems[itemId]) currentMappedItems[itemId] = [];
                    currentMappedItems[itemId].push(mappedName);
                });
                // set the cache
                vc2_util.setNSCache({
                    name: 'MAPPED_ITEMS',
                    value: currentMappedItems,
                    cacheTTL: CACHE_TTL
                });

                returnValue = currentMappedItems;
                vc2_util.log(logTitle, '*** Mapped Item Names:', {
                    MappedItems: currentMappedItems
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },

        fetchItemAltNames: function (option) {
            var logTitle = [LogTitle, 'fetchItemAltNames'].join('::'),
                returnValue;
            try {
                if (!option) throw 'Missing required parameter: option';
                if (!option.itemIds && !option.poLines)
                    throw 'Missing required parameter: itemIds or poLines';

                var MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var itemIds =
                    option.itemIds ||
                    option.poLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds)) throw 'No itemIds found';

                // Check All the Missing Items from CACHE
                var currentAltNames =
                    CURRENT.ALTNAMES ||
                    vc2_util.getNSCache({
                        name: 'ALT_ITEM_NAMES',
                        isJSON: true
                    }) ||
                    {};

                var missingItemIds = [];
                itemIds.forEach(function (itemId) {
                    if (vc2_util.isEmpty(currentAltNames[itemId])) {
                        missingItemIds.push(itemId);
                    }
                });

                // if all of the itemids are already fetched, return the list
                if (!missingItemIds.length) return currentAltNames;

                var searchOption = {
                    type: 'item',
                    columns: [],
                    filters: [['internalid', 'anyof', missingItemIds]]
                };

                // Alt item names from MainCFG
                if (MainCFG.itemFieldIdToMatch)
                    searchOption.columns.push(MainCFG.itemFieldIdToMatch);
                if (MainCFG.itemMPNColumnIdToMatch)
                    searchOption.columns.push(MainCFG.itemMPNColumnIdToMatch);
                // Alt item names from VendorCFG
                if (VendorCFG.itemFieldIdToMatch)
                    searchOption.columns.push(VendorCFG.itemFieldIdToMatch);
                if (VendorCFG.itemMPNFieldIdToMatch)
                    searchOption.columns.push(VendorCFG.itemMPNFieldIdToMatch);

                searchOption.columns = vc2_util.uniqueArray(searchOption.columns);
                if (!searchOption.columns.length) throw 'No alt names to fetch';
                searchOption.columns.push('name');

                var arrSearchResults = vc2_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                // loop thru the search results
                arrSearchResults.forEach(function (result) {
                    var itemData = {
                        id: result.id,
                        name: result.getValue('name')
                    };

                    searchOption.columns.forEach(function (col) {
                        var colName = col.name || col;
                        itemData[colName] = result.getValue(col);
                    });

                    currentAltNames[itemData.id] = itemData;
                });

                // set the cache
                vc2_util.setNSCache({
                    name: 'ALT_ITEM_NAMES',
                    value: currentAltNames,
                    cacheTTL: CACHE_TTL
                });

                returnValue = currentAltNames;
                vc2_util.log(logTitle, '*** Item Alt Names:', { 'Alt Names': returnValue });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return RecordsLib;
});
