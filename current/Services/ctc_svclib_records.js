/**
 * Copyright (c) 2025  Catalyst Tech Corp
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

    var vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js');

    var vclib_error = require('./lib/ctc_lib_errors.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record');

    var CACHE_TTL = 300; // store the data for 1mins

    var ERROR_MSG = {
        RECORD_NOT_FOUND: {
            code: 'RECORD_NOT_FOUND',
            message: 'Record not found'
        },
        RECORD_SEARCH_EMPTY: {
            code: 'RECORD_SEARCH_EMPTY',
            message: 'Unable to find the record'
        }
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

            var paramFltrs = [];

            try {
                var recordData = {},
                    results = this.searchTransactions(option);

                if (vc2_util.isEmpty(results)) throw 'RECORD_NOT_FOUND';

                returnValue = results.shift();
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },
        searchTransactions: function (option) {
            var logTitle = [LogTitle, 'searchTransaction'].join('::'),
                returnValue;

            var poNum = option.name || option.tranid || option.poName || option.poNum,
                poId = option.id || option.internalid || option.poId,
                recordType = option.type || option.recordType || 'transaction',
                searchFields = option.fields || option.columns,
                searchFilters = option.filters;

            var paramFltrs = [];

            try {
                var recordsList = [],
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
                    throw {
                        code: 'RECORD_SEARCH_EMPTY',
                        message: 'Unable to find the record',
                        detail: paramFltrs.join('&')
                    };

                searchObj.run().each(function (row) {
                    var recordData = { id: row.id };

                    // update the PO_Data with the column values
                    for (var i = 0, j = searchOption.columns.length; i < j; i++) {
                        var colName = searchOption.columns[i].name || searchOption.columns[i],
                            colValue = row.getValue(searchOption.columns[i]),
                            colText = row.getText(searchOption.columns[i]);

                        recordData[colName] = colValue;

                        if (colText && colText != colValue)
                            recordsList[colName + '_text'] = colText;
                    }

                    recordsList.push(recordData);
                    return true; // return false to break the loop when a record is found.
                });
                returnValue = recordsList;

                // vc2_util.log(logTitle, '## RecordData: ', [recordsList, cacheKey]);

                // set the cachedData
                vc2_util.setNSCache({ name: cacheKey, value: recordsList, cacheTTL: CACHE_TTL });
                vc2_util.saveCacheList({
                    listName: vc2_constant.CACHE_KEY.PO_DATA,
                    cacheKey: cacheKey
                });
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },
        updateRecord: function (option) {
            var logTitle = [LogTitle, 'updateRecord'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };
                if (!option.type) throw { code: 'MISSING_PARAMETER', detail: 'type' };
                if (!option.id) throw { code: 'MISSING_PARAMETER', detail: 'id' };
                if (!option.data) throw { code: 'MISSING_PARAMETER', detail: 'data' };
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
                vclib_error.logError(logTitle, error, ERROR_MSG);
                throw vclib_error.extractError(error);
            }

            return returnValue;
        },
        updateLineValues: function (option) {
            var logTitle = [LogTitle, 'updateLineValues'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };

                var recordObj = option.record,
                    line = option.line,
                    isDynamic = option.isDynamic || false,
                    sublistId = option.sublistId || 'item',
                    lineValues = option.data || option.lineValues || option.values,
                    noCommit = option.noCommit || false;

                if (vc2_util.isEmpty(recordObj)) throw 'Missing required parameter: record';
                if (vc2_util.isEmpty(lineValues)) throw 'Missing required parameter: lineValues';
                if (vc2_util.isEmpty(line)) throw 'Missing required parameter: line';

                if (isDynamic) recordObj.selectLine({ sublistId: sublistId, line: line });

                for (var fld in lineValues) {
                    var colValue = lineValues[fld];
                    if (vc2_util.isEmpty(colValue)) continue;

                    if (isDynamic) {
                        recordObj.setCurrentSublistValue({
                            sublistId: sublistId || 'item',
                            fieldId: fld,
                            line: line,
                            value: colValue
                        });
                    } else {
                        recordObj.setSublistValue({
                            sublistId: sublistId || 'item',
                            fieldId: fld,
                            line: line,
                            value: colValue
                        });
                    }
                }

                if (isDynamic && !noCommit) recordObj.commitLine({ sublistId: sublistId });
            } catch (error) {
                throw vclib_error.extractError(logTitle, error, ERROR_MSG);
            }

            return returnValue;
        },
        extractValues: function (option) {
            var logTitle = [LogTitle, 'extractValues'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };
                if (!option.record) throw { code: 'MISSING_PARAMETER', detail: 'record' };
                if (!option.columns) throw { code: 'MISSING_PARAMETER', detail: 'columns' };

                var recordObj = option.record,
                    columns = option.columns,
                    recordData = {};

                if (util.isArray(option.columns)) {
                    for (var i = 0, j = columns.length; i < j; i++) {
                        var colName = columns[i],
                            colValue = recordObj.getValue({ fieldId: colName }),
                            colText = recordObj.getText({ fieldId: colName });

                        recordData[colName] = colValue;

                        if (colText && colText != colValue) recordData[colName + '_text'] = colText;
                    }
                } else if (util.isObject(option.columns)) {
                    for (var fld in columns) {
                        var colName = columns[fld],
                            colValue = recordObj.getValue({ fieldId: colName }),
                            colText = recordObj.getText({ fieldId: colName });

                        recordData[fld] = colValue;
                        if (colText && colText != colValue) recordData[fld + '_text'] = colText;
                    }
                }

                returnValue = recordData;

                // vc2_util.log(logTitle, 'Values extracted successfully', {
                //     columns: columns
                // });
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },
        extractLineValues: function (option) {
            var logTitle = [LogTitle, 'extractLineValues'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };
                if (!option.record) {
                    if (!option.poId) throw { code: 'MISSING_PARAMETER', detail: 'poId or record' };

                    // if (!option.type) throw 'Missing required parameter: type';

                    option.record = ns_record.load({
                        type: option.type || ns_record.Type.PURCHASE_ORDER,
                        id: option.poId
                    });
                }
                var recordObj = option.record,
                    columns = option.columns || [
                        'item',
                        'itemname',
                        'rate',
                        'amount',
                        'quantity',
                        'location',
                        'quantityreceived',
                        'quantitybilled',
                        'quantityfulfilled',
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

                /// add default columns
                columns.push('lineuniquekey', 'poline', 'orderline', 'line');

                // if the addiotnal columns is not empty, concatenate it with columns
                if (!vc2_util.isEmpty(additionalColumns))
                    columns = columns.concat(additionalColumns);

                columns = vc2_util.uniqueArray(columns);
                var lineCount = recordObj.getLineCount({ sublistId: option.sublistId || 'item' }),
                    lineNo = option.lineNo || option.line;

                for (var line = 0; line < lineCount; line++) {
                    var lineData = {
                        line: line
                    };

                    if (!vc2_util.isEmpty(lineNo) && lineNo != line) continue;

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

                returnValue = vc2_util.isEmpty(lineNo) ? recordLines : recordLines.shift();

                // vc2_util.log(logTitle, 'Values extracted successfully', {
                //     columns: columns
                // });
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },
        load: function (option) {
            var logTitle = [LogTitle, 'load'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };
                if (!option.type) throw { code: 'MISSING_PARAMETER', detail: 'type' };
                if (!option.id) throw { code: 'MISSING_PARAMETER', detail: 'id' };

                var recordType = option.type,
                    recordId = option.id,
                    isDynamic = option.isDynamic || false;

                returnValue = ns_record.load({
                    type: recordType,
                    id: recordId,
                    isDynamic: isDynamic
                });

                // vc2_util.log(logTitle, 'Record loaded successfully', {
                //     type: recordType,
                //     id: recordId
                // });
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                throw vclib_error.extractError(error);
            }

            return returnValue;
        },
        transform: function (option) {
            var logTitle = [LogTitle, 'transform'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', detail: 'option' };
                if (!option.fromType) throw { code: 'MISSING_PARAMETER', detail: 'fromType' };
                if (!option.fromId) throw { code: 'MISSING_PARAMETER', detail: 'fromId' };
                if (!option.toType) throw { code: 'MISSING_PARAMETER', detail: 'toType' };

                // vc2_util.log(logTitle, '// TRANSFORM: ', option);

                returnValue = ns_record.transform(option);

                vc2_util.log(logTitle, 'Record transformed successfully', {
                    fromType: option.fromType,
                    toType: option.toType,
                    id: option.fromId || option.id
                });
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                throw vclib_error.extractError(error);
            }

            return returnValue;
        }
    };

    return RecordsLib;
});
