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
define(function (require) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_error = require('N/error'),
        vc2_constant = require('./CTC_VC2_Constants'),
        vc2_util = require('./CTC_VC2_Lib_Utils'),
        vcs_configLib = require('./Services/ctc_svclib_configlib');

    var LogTitle = 'VC2_RecordLib';

    var Current = {};

    var LineColField = vc2_constant.FIELD.TRANSACTION;

    var VC2_RecordLib = {
        transform: function (option) {
            var logTitle = [LogTitle, 'transform'].join('::'),
                returnValue;

            try {
                if (!option.fromType) throw 'Record fromType is required. [fromType]';
                if (!option.fromId) throw 'Record fromId is required. [fromId]';
                if (!option.toType) throw 'Record toType is required. [toType]';

                log.audit(logTitle, '// TRANSFORM: ' + JSON.stringify(option));

                returnValue = ns_record.transform(option);
            } catch (error) {
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to transform record',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        load: function (option) {
            var logTitle = [LogTitle, 'load'].join('::'),
                returnValue;

            try {
                if (!option.type) throw 'Record type is required. [type]';
                if (!option.id) throw 'Record ID is required. [id]';

                log.audit(logTitle, '// LOAD RECORD: ' + JSON.stringify(option));
                returnValue = ns_record.load(option);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw ns_error.create({
                    name: 'Unable to load record',
                    message: vc2_util.extractError(error)
                });
                // throw (
                //     'Unable to load record: ' +
                //     (vc_util.extractError(error) + '\n' + JSON.stringify(error))
                // );
            }

            return returnValue;
        },
        setRecordValue: function (option) {
            var logTitle = [LogTitle, 'setRecordValue'].join('::'),
                returnValue;

            try {
                if (!option.record) throw 'Record is required';
                if (!option.fieldId) throw 'Field ID is required';

                vc2_util.log(logTitle, '## set field value: ', [option.fieldId, option.value]);

                option.record.setValue({
                    fieldId: option.fieldId,
                    value: option.value
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw ns_error.create({
                    name: 'Unable to set the record field',
                    message: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        extractValues: function (option) {
            var logTitle = [LogTitle, 'extractValues'].join('::'),
                returnValue;

            try {
                if (!option.record || !option.fields) return false;
                returnValue = {};

                // log.audit(logTitle, '// EXTRACT VALUES: ' + JSON.stringify(option.fields));

                for (var fld in option.fields) {
                    var fieldId = option.fields[fld];
                    var fieldName = util.isArray(option.fields) ? fieldId : fld;

                    var value = option.record.getValue({ fieldId: fieldId }) || '',
                        textValue = option.record.getText({ fieldId: fieldId });
                    returnValue[fieldName] = value;

                    if (textValue !== null && textValue != value) {
                        returnValue[fieldName + '_text'] = textValue;
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw ns_error.create({
                    name: 'Unable to extract values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        extractLineValues: function (option) {
            var logTitle = [LogTitle, 'extractLineValues'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    groupId = option.groupId,
                    line = option.line,
                    columns = option.columns;

                if (!record || !columns) return false;
                if (line == null || line < 0) return false;

                var lineData = {};
                for (var i = 0, j = columns.length; i < j; i++) {
                    var lineOption = {
                        sublistId: sublistId,
                        group: groupId,
                        fieldId: columns[i],
                        line: line
                    };
                    var value = record.getSublistValue(lineOption),
                        textValue = record.getSublistText(lineOption);
                    lineData[columns[i]] = value;
                    if (textValue !== null && value != textValue)
                        lineData[columns[i] + '_text'] = textValue;

                    // vc2_util.log(logTitle, '>> text/value', [lineOption, value, textValue]);
                }

                returnValue = lineData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
                throw ns_error.create({
                    name: 'Unable to extract values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        extractAlternativeItemName: function (option) {
            var logTitle = [LogTitle, 'extractAlternativeItemName'].join('::'),
                itemIds = option.item,
                returnValue = null;
            try {
                var itemField = null,
                    mpnField = null;

                // immediately exit, nothing the see here
                if (vc2_util.isEmpty(itemIds)) return false;

                Current.MainCFG =
                    Current.MainCFG || option.mainConfig || vcs_configLib.mainConfig() || {};
                Current.OrderCFG = Current.OrderCFG || option.orderConfig || {};

                itemField =
                    Current.OrderCFG.itemFieldIdToMatch || Current.MainCFG.itemFieldIdToMatch;
                mpnField =
                    Current.OrderCFG.itemMPNFieldIdToMatch || Current.MainCFG.itemMPNFieldIdToMatch;

                // exit if both are empty
                if (!itemField && !mpnField) return false;

                vc2_util.log(logTitle, '## Lookup alt name/mpn: ', {
                    itemName: itemField,
                    mpn: mpnField
                });

                var searchOption = {
                    type: ns_search.Type.ITEM,
                    filterExpression: [
                        ['internalid', 'anyof', itemIds],
                        'and',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: []
                };

                if (itemField) searchOption.columns.push(itemField);
                if (mpnField) searchOption.columns.push(mpnField);

                var searchResults = vc2_util.searchAllPaged(searchOption);

                if (!searchResults || !searchResults.length) return false;

                var altItemNames = {
                    _sku: !!itemField,
                    _mpn: !!mpnField
                };

                searchResults.forEach(function (result) {
                    var altName = {
                        partNumber: itemField ? result.getValue({ name: itemField }) : null,
                        mpn: mpnField ? result.getValue({ name: mpnField }) : null
                    };
                    altItemNames[result.id] = altName;
                    return true;
                });

                vc2_util.log(logTitle, '/// Alt item names: ', altItemNames);
                returnValue = altItemNames;

                vc2_util.log(logTitle, 'Alt item names=', returnValue);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }
            return returnValue;
        },
        extractVendorItemNames: function (option) {
            var logTitle = [LogTitle, 'extractVendorItemNames'].join('::'),
                returnValue = option.lines || option;
            try {
                var GlobalVar = vc2_constant.GLOBAL,
                    ItemMapRecordVar = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;

                if (returnValue && returnValue.length) {
                    var uniqueItemIds = [];
                    for (var i = 0, len = returnValue.length; i < len; i += 1) {
                        var lineData = returnValue[i];
                        if (!vc2_util.inArray(lineData.item, uniqueItemIds)) {
                            uniqueItemIds.push(lineData.item);
                        }
                    }
                    vc2_util.log(
                        logTitle,
                        'Lookup items for assigned vendor names... ',
                        uniqueItemIds.join(', ')
                    );
                    if (uniqueItemIds.length) {
                        var searchOption = {
                            type: ItemMapRecordVar.ID,
                            filterExpression: [
                                [ItemMapRecordVar.FIELD.ITEM, 'anyof', uniqueItemIds],
                                'and',
                                ['isinactive', 'is', 'F']
                            ],
                            columns: [ItemMapRecordVar.FIELD.NAME, ItemMapRecordVar.FIELD.ITEM]
                        };
                        var searchResults = vc2_util.searchAllPaged(searchOption);
                        if (searchResults && searchResults.length) {
                            var vendorItemMap = {};
                            searchResults.forEach(function (result) {
                                var vendorItemName = result.getValue({
                                        name: ItemMapRecordVar.FIELD.NAME
                                    }),
                                    item = result.getValue({ name: ItemMapRecordVar.FIELD.ITEM });
                                if (!vendorItemMap[item]) vendorItemMap[item] = [];
                                vendorItemMap[item].push(vendorItemName);
                                return true;
                            });
                            for (var i = 0, len = returnValue.length; i < len; i += 1) {
                                var lineData = returnValue[i],
                                    vendorItemNames = vendorItemMap[lineData.item];
                                if (vendorItemNames && vendorItemNames.length) {
                                    lineData[GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                                        vendorItemNames.join('\n');
                                }
                            }
                            vc2_util.log(logTitle, 'Vendor item names=', vendorItemMap);
                        }
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to extract vendor item names',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        extractRecordLines: function (option) {
            var logTitle = [LogTitle, 'extractRecordLines'].join('::'),
                returnValue;

            try {
                var GlobalVar = vc2_constant.GLOBAL;
                var record = option.record;

                Current.MainCFG =
                    Current.MainCFG || option.mainConfig || vcs_configLib.mainConfig() || {};
                Current.OrderCFG = Current.OrderCFG || option.orderConfig || {};

                var itemAltNameColId =
                        Current.OrderCFG.itemColumnIdToMatch || Current.MainCFG.itemColumnIdToMatch,
                    itemMPNColId =
                        Current.OrderCFG.itemMPNColumnIdToMatch ||
                        Current.MainCFG.itemMPNColumnIdToMatch;

                var columns = option.columns || [
                    'item',
                    'rate',
                    'quantity',
                    'amount',
                    'quantityreceived',
                    'quantitybilled',
                    'taxrate',
                    'taxrate1',
                    'taxrate2',
                    GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                ];

                if (itemAltNameColId && !vc2_util.inArray(columns, itemAltNameColId))
                    columns.push(itemAltNameColId);

                if (itemMPNColId && !vc2_util.inArray(columns, itemMPNColId))
                    columns.push(itemMPNColId);

                var sublistId = option.sublistId || 'item';
                if (!record) return false;

                var includeItemMappingIndex = columns.indexOf(
                    GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                );

                // include the global var proxy column in the extract list to trigger the item mapping lookup
                if (includeItemMappingIndex >= 0) {
                    columns.splice(includeItemMappingIndex, 1);
                }

                var lineCount = record.getLineCount({ sublistId: sublistId }),
                    uniqueItemIds = [],
                    arrRecordLines = [];

                for (var line = 0; line < lineCount; line++) {
                    var lineData = VC2_RecordLib.extractLineValues({
                        record: record,
                        sublistId: sublistId,
                        line: line,
                        columns: columns
                    });
                    lineData.line = line;
                    // vc2_util.log(logTitle, '... line data: ', lineData);

                    if (!vc2_util.inArray(lineData.item, uniqueItemIds)) {
                        uniqueItemIds.push(lineData.item);
                    }

                    if (!option.filter) {
                        arrRecordLines.push(lineData);
                        continue;
                    }

                    var isFound = true;
                    // check if this line satisfy our filters
                    for (var field in option.filter) {
                        var lineValue = lineData.hasOwnProperty(field)
                            ? lineData[field]
                            : record.getSublistValue({
                                  sublistId: sublistId,
                                  fieldId: field,
                                  line: line
                              });

                        if (option.filter[field] != lineValue) {
                            isFound = false;
                            break;
                        }
                    }
                    if (isFound) {
                        arrRecordLines.push(lineData);
                        if (!option.findAll) break;
                    }
                }

                returnValue =
                    arrRecordLines && arrRecordLines.length
                        ? option.findAll
                            ? arrRecordLines
                            : arrRecordLines.shift()
                        : false;

                var altItemNames = VC2_RecordLib.extractAlternativeItemName({
                    item: uniqueItemIds
                });
                // vc2_util.log(logTitle, '... altItemNames: ', altItemNames);
                // vc2_util.log(logTitle, '... returnValue: ', returnValue);

                (returnValue
                    ? util.isArray(returnValue)
                        ? returnValue
                        : [returnValue]
                    : []
                ).forEach(function (lineData) {
                    if (lineData && lineData.item) {
                        lineData = VC2_RecordLib.getAltPartNumValues({
                            source: altItemNames,
                            target: lineData
                        });
                    }
                    return true;
                });
                if (returnValue && includeItemMappingIndex >= 0) {
                    columns.splice(
                        includeItemMappingIndex,
                        0,
                        GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                    );
                    returnValue = VC2_RecordLib.extractVendorItemNames({
                        lines: returnValue
                    });
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to extract line values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        updateLine: function (option) {
            var logTitle = [LogTitle, 'updateLine'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    lineData = option.lineData;

                if (!record || !lineData) return false;
                if (!lineData.hasOwnProperty('line')) return;

                var lineOption = { sublistId: sublistId, line: lineData.line };

                vc2_util.log(logTitle, '// UPDATE LINE: ', lineData);

                record.selectLine(lineOption);
                for (var fieldId in lineData) {
                    if (fieldId == 'line') continue;
                    if (vc2_util.isEmpty(lineData[fieldId])) continue;

                    var hasError = false,
                        newValue;

                    // store the old value
                    var currValue = record.getCurrentSublistValue(
                        vc2_util.extend(lineOption, { fieldId: fieldId })
                    );

                    try {
                        // set the new value
                        record.setCurrentSublistValue(
                            vc2_util.extend(lineOption, {
                                fieldId: fieldId,
                                value: lineData[fieldId]
                            })
                        );
                        newValue = record.getCurrentSublistValue(
                            vc2_util.extend(lineOption, { fieldId: fieldId })
                        );

                        // if (newValue != lineData[fieldId]) throw 'New value not set properly';
                    } catch (set_error) {
                        vc2_util.log(logTitle, '## SET ERROR ##', [
                            fieldId,
                            lineData[fieldId],
                            set_error
                        ]);
                        hasError = true;
                    }

                    if (hasError) {
                        /// revert back to the original value
                        record.setCurrentSublistValue(
                            vc2_util.extend(lineOption, {
                                fieldId: fieldId,
                                value: currValue
                            })
                        );
                    }
                }

                record.commitLine(lineOption);
                returnValue = record;
            } catch (error) {
                returnValue = false;
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to update line values',
                    message: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        addLine: function (option) {
            var logTitle = [LogTitle, 'addLine'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    lineData = option.lineData;

                if (!record || !lineData) return false;
                var lineOption = { sublistId: sublistId };

                // log.audit(logTitle, '// ADD LINE: ' + JSON.stringify(lineData));
                vc2_util.log(logTitle, '// ADD LINE: ', lineData);

                record.selectNewLine(lineOption);
                for (var fieldId in lineData) {
                    if (vc2_util.isEmpty(lineData[fieldId])) continue;

                    record.setCurrentSublistValue(
                        vc2_util.extend(lineOption, { fieldId: fieldId, value: lineData[fieldId] })
                    );
                }
                record.commitLine(lineOption);

                var lineCount = record.getLineCount(lineOption);
                returnValue = lineCount - 1;
            } catch (error) {
                returnValue = false;
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to add line values',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        findMatchingOrderLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingOrderLine'].join('::'),
                returnValue;

            try {
                var vendorLine = option.vendorLine || option.lineData,
                    orderLines = option.orderLines,
                    record = option.record;

                vc2_util.log(logTitle, '*** Item Matching: Start ****');
                vc2_util.log(logTitle, '// vendor Line: ', vendorLine);

                Current.MainCFG =
                    Current.MainCFG || option.mainConfig || vcs_configLib.mainConfig() || {};
                Current.OrderCFG = Current.OrderCFG || option.orderConfig || {};

                var VendorList = vc2_constant.LIST.XML_VENDOR,
                    GlobalVar = vc2_constant.GLOBAL;

                if (vc2_util.isEmpty(orderLines)) {
                    orderLines = VC2_RecordLib.extractRecordLines({
                        record: record,
                        mainConfig: Current.MainCFG,
                        orderConfig: Current.OrderCFG
                    });
                }
                if (vc2_util.isEmpty(vendorLine)) throw 'Vendor line is required';
                if (vc2_util.isEmpty(orderLines)) throw 'Order lines is required';

                // vc2_util.log(logTitle, '...orderLines: ', orderLines);

                var matchedLines = vc2_util.findMatching({
                    list: orderLines,
                    findAll: true,
                    filter: {
                        item_text: function (value) {
                            var orderLine = this;
                            var skuValue = orderLine[GlobalVar.VENDOR_SKU_LOOKUP_COL],
                                dnhValue = orderLine[LineColField.DH_MPN];

                            var matchedValue = null,
                                returnValue = false;

                            matchedValue = VC2_RecordLib.isVendorLineMatched({
                                orderLine: orderLine,
                                vendorLine: vendorLine
                                // mainConfig: Current.MainCFG,
                                // orderConfig: Current.OrderCFG
                            });
                            returnValue = !!matchedValue;

                            return returnValue;
                        }
                    }
                });
                // vc2_util.log(logTitle, '// matched line ?: ', matchedLines);

                var orderLineMatch = matchedLines && matchedLines[0] ? matchedLines[0] : null;

                if (!matchedLines || !matchedLines.length) {
                    // lineValue.LINE_MATCH = false;
                    vendorLine.ORDER_LINE = null;

                    vc2_util.log(logTitle, '// no matching order line');
                } else if (matchedLines.length == 1) {
                } else if (matchedLines.length > 1) {
                    vc2_util.log(logTitle, '// multiple matches found: ', matchedLines.length);
                    // more than one matched line
                    var matching = {
                        qtyLine: vc2_util.findMatching({
                            list: matchedLines,
                            findAll: true,
                            filter: {
                                MATCHED: function (value) {
                                    return value !== true;
                                },
                                quantity: vc2_util.parseFloat(vendorLine.ship_qty),
                                line: !vc2_util.isEmpty(vendorLine.line_no)
                                    ? vendorLine.line_no - 1
                                    : -1
                            }
                        }),
                        line: vc2_util.findMatching({
                            list: matchedLines,
                            findAll: true,
                            filter: {
                                MATCHED: function (value) {
                                    return value !== true;
                                },
                                line: !vc2_util.isEmpty(vendorLine.line_no)
                                    ? vendorLine.line_no - 1
                                    : -1
                            }
                        }),
                        qty: vc2_util.findMatching({
                            list: matchedLines,
                            findAll: true,
                            filter: {
                                MATCHED: function (value) {
                                    return value !== true;
                                },
                                quantity: vc2_util.parseFloat(vendorLine.ship_qty)
                            }
                        })
                    };

                    // vc2_util.log(logTitle, '///...matching: ', matching);

                    orderLineMatch =
                        matching.qtyLine || matching.line || matching.qty || matchedLines[0];
                }

                // if it has multiple matches, get the first one
                if (orderLineMatch && orderLineMatch.length) orderLineMatch = orderLineMatch[0];
                // vc2_util.log(logTitle, '// orderLineMatch: ', orderLineMatch);

                if (orderLineMatch) {
                    // mark the order line
                    vendorLine.MATCHED_ORDERLINE = orderLineMatch;
                    vendorLine.ORDER_LINE = orderLineMatch.line;
                    orderLineMatch.MATCHED = true;
                }

                returnValue = orderLineMatch;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        /*
         * @param {*} option
         *      orderLine - line data from the PO
         *      vendorLine - line data from the vendor response
         *      mainConfig - VAR connect mainConfig. ingramHashSpace option
         *      orderConfig - vendor config
         * @returns
         */

        isVendorLineMatched: function (option) {
            var logTitle = [LogTitle, 'isVendorLineMatched'].join('::'),
                returnValue;

            var VendorList = vc2_constant.LIST.XML_VENDOR,
                GlobalVar = vc2_constant.GLOBAL;

            var orderLine = option.orderLine,
                vendorLine = option.vendorLine;

            Current.MainCFG =
                Current.MainCFG || option.mainConfig || vcs_configLib.mainConfig() || {};
            Current.OrderCFG = Current.OrderCFG || option.orderConfig || {};

            if (vc2_util.isEmpty(vendorLine)) throw 'Vendor line is required';
            if (vc2_util.isEmpty(orderLine)) throw 'Order line is required';

            // vc2_util.log(logTitle, '... is matched? [orderLine] ', orderLine);
            // vc2_util.log(logTitle, '... is matched? [vendorLine] ', vendorLine);

            var item = {
                forcedValue: option.alternativeItemName || orderLine.alternativeItemName,
                altForcedValue: option.alternativeItemName2 || orderLine.alternativeItemName2,
                forcedSKU: option.alternativeSKU || orderLine.alternativeSKU,
                forcedMPN: option.alternativeMPN || orderLine.alternativeMPN,
                text: option.itemText || orderLine.item_text || orderLine.itemname,
                altValue: option.itemAlt || orderLine[GlobalVar.ITEM_FUL_ID_LOOKUP_COL],
                altText:
                    option.itemAltText || orderLine[GlobalVar.ITEM_FUL_ID_LOOKUP_COL + '_text'],
                sitemname: orderLine.sitemname,
                skuValue: option.skuValue || orderLine[GlobalVar.VENDOR_SKU_LOOKUP_COL],
                dnhValue: option.dnhValue || orderLine[LineColField.DH_MPN],
                dellQuoteNo: option.dellQuoteNo || orderLine[LineColField.DELL_QUOTE_NO],
                vendorItemNames: orderLine[GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY]
            };
            // vc2_util.log(logTitle, '.. item values: ', item);

            var settings = {
                isDandH:
                    option.isDandH || Current.OrderCFG
                        ? Current.OrderCFG.xmlVendor == VendorList.DandH
                        : null,
                ingramHashSpace:
                    option.ingramHashSpace || Current.MainCFG
                        ? Current.MainCFG.ingramHashSpace
                        : null,
                isIngram:
                    option.ingramHashSpace || Current.OrderCFG
                        ? vc2_util.inArray(Current.OrderCFG.xmlVendor, [
                              VendorList.INGRAM_MICRO_V_ONE,
                              VendorList.INGRAM_MICRO
                          ])
                        : null,
                isDell:
                    option.isDell || Current.OrderCFG
                        ? Current.OrderCFG.xmlVendor == VendorList.DELL
                        : null
            };
            // vc2_util.log(logTitle, '... settings:', settings);

            var matchedValue;
            try {
                // Check if vendor line item number or vendor SKU matches the forced values
                if (
                    vendorLine.item_num &&
                    vendorLine.vendorSKU &&
                    ((item.forcedValue &&
                        vc2_util.inArray(item.forcedValue, [
                            vendorLine.item_num,
                            vendorLine.vendorSKU
                        ])) ||
                        (item.altForcedValue &&
                            vc2_util.inArray(item.altForcedValue, [
                                vendorLine.item_num,
                                vendorLine.vendorSKU
                            ])))
                ) {
                    matchedValue = 'AltItemName';
                    // Check if vendor line item number matches the forced MPN
                } else if (
                    vendorLine.item_num &&
                    item.forcedMPN &&
                    vendorLine.item_num == item.forcedMPN
                ) {
                    matchedValue = 'AltMPN';
                    // Check if vendor SKU matches the forced SKU
                } else if (
                    vendorLine.vendorSKU &&
                    item.forcedSKU &&
                    vendorLine.vendorSKU == item.forcedSKU
                ) {
                    matchedValue = 'AltVendorSKU';
                    // Check if vendor line item number matches any of the item names or alternative values
                } else if (
                    vc2_util.inArray(vendorLine.item_num, [
                        item.text,
                        item.altValue,
                        item.altText,
                        item.sitemname
                    ])
                ) {
                    matchedValue = 'ItemName';
                    // Check if vendor SKU matches the SKU value
                } else if (
                    vendorLine.vendorSKU &&
                    item.skuValue &&
                    vendorLine.vendorSKU == item.skuValue
                ) {
                    matchedValue = 'VendorSKU';
                    // Check if the vendor is D&H and the item matches the D&H value
                } else if (
                    settings.isDandH &&
                    item.dnhValue &&
                    vc2_util.inArray(item.dnhValue, [vendorLine.item_num, vendorLine.vendorSKU])
                ) {
                    matchedValue = 'D&H item';
                    // Check if the vendor is Ingram and the item matches the Ingram hash space
                } else if (settings.isIngram && settings.ingramHashSpace) {
                    var hashValue = {};
                    for (var typ in item) {
                        hashValue[typ] = item[typ] ? item[typ].replace('#', ' ') : '';
                    }

                    if (
                        vc2_util.inArray(vendorLine.item_num, [
                            hashValue.text,
                            hashValue.altValue,
                            hashValue.altText
                        ])
                    )
                        matchedValue = 'Ingram-Item';
                    else if (
                        vendorLine.vendorSKU &&
                        hashValue.skuValue &&
                        vendorLine.vendorSKU == hashValue.skuValue
                    )
                        matchedValue = 'Ingram-SKU';
                    // Check if the vendor is Dell and the vendor SKU matches the Dell quote number
                } else if (settings.isDell && vendorLine.vendorSKU == item.dellQuoteNo) {
                    matchedValue = 'DellQuoteNo';
                    // Check if the vendor item names contain the vendor line item number
                } else if (
                    item.vendorItemNames &&
                    vc2_util.inArray(vendorLine.item_num, item.vendorItemNames.split('\n'))
                ) {
                    matchedValue = 'VendorSKU';
                }

                returnValue = matchedValue;

                if (matchedValue) {
                    orderLine.MATCHED_VALUE = matchedValue;
                }
            } catch (err) {
                vc2_util.log(logTitle, '[item_num.filter] !! error !!', [err, item]);
                returnValue = false;
                // } finally {
                // vc2_util.log(logTitle, ' matched ? ', matchedValue);
            }

            return returnValue;
        },
        findMatchingVendorLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingVendorLine'].join('::'),
                returnValue;

            try {
                var vendorLines = option.vendorLines,
                    orderLine = option.orderLine,
                    line = option.line,
                    quantity = option.quantity,
                    record = option.record;

                if (!vendorLines) throw 'Vendor Lines are missing';
                if (!orderLine) {
                    if (!vc2_util.isEmpty(record) && !vc2_util.isEmpty(line)) {
                        orderLine = VC2_RecordLib.extractLineValues({
                            record: record,
                            line: line,
                            columns: [
                                'item',
                                'quantity',
                                'quantityremaining',
                                vc2_constant.GLOBAL.ITEM_FUL_ID_LOOKUP_COL,
                                vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                                LineColField.DH_MPN
                            ]
                        });
                        Helper.log(logTitle, '*** fulfillment line ***', orderLine);
                    }
                }
                if (!orderLine) throw 'Order Line is missing';

                // first match
                var matchingVendorLine = vc2_util.findMatching({
                    list: vendorLines,
                    findAll: true,
                    filter: {
                        item_num: function (value) {
                            var vendorLine = this;

                            // vc2_util.log(logTitle, '>> vendorLine', vendorLine);
                            var matchedValue = VC2_RecordLib.isVendorLineMatched({
                                orderLine: orderLine,
                                vendorLine: vendorLine,
                                isDandH: option.isDandH || null,
                                isIngram: option.isIngram || null,
                                ingramHashSpace: option.ingramHashSpace || null
                            });
                            if (matchedValue) vendorLine.MATCHEDBY = matchedValue;

                            vendorLine.ship_qty = util.isString(vendorLine.ship_qty)
                                ? vc2_util.parseFloat(vendorLine.ship_qty)
                                : vendorLine.ship_qty;

                            if (!vendorLine.hasOwnProperty('AVAILQTY'))
                                vendorLine.AVAILQTY = vendorLine.ship_qty;

                            if (!vendorLine.hasOwnProperty('APPLIEDLINES'))
                                vendorLine.APPLIEDLINES = [];

                            return !!matchedValue;
                        }
                    }
                });
                vc2_util.log(logTitle, '... matchingVendorLine: ', matchingVendorLine);
                if (!matchingVendorLine) throw 'No items matched!';

                // matches more than once
                if (matchingVendorLine.length > 1) {
                    var matched = {
                        qtyLine: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                ship_qty: function (value) {
                                    var shipQty = vc2_util.parseFloat(value),
                                        qty =
                                            quantity ||
                                            orderLine.quantity ||
                                            orderLine.quantityremaining;
                                    return shipQty == qty;
                                },
                                line_no: function (value) {
                                    var shipLine = vc2_util.parseFloat(value),
                                        poLine = orderLine.poline
                                            ? vc2_util.parseFloat(orderLine.poline)
                                            : vc2_util.parseFloat(orderLine.line);

                                    return shipLine == poLine;
                                },
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }),
                        qtyFull: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                ship_qty: function (value) {
                                    var shipQty = vc2_util.parseFloat(value),
                                        qty =
                                            quantity ||
                                            orderLine.quantity ||
                                            orderLine.quantityremaining;
                                    return shipQty == qty;
                                },
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        }),
                        qtyPartial: vc2_util.findMatching({
                            list: matchingVendorLine,
                            findAll: true,
                            filter: {
                                ship_qty: function (value) {
                                    var shipQty = vc2_util.parseFloat(value),
                                        qty =
                                            quantity ||
                                            orderLine.quantity ||
                                            orderLine.quantityremaining;
                                    return shipQty <= qty;
                                },
                                AVAILQTY: function (value) {
                                    return value > 0;
                                }
                            }
                        })
                    };
                    // vc2_util.log(logTitle, '... refine matches: ', matched);
                    matchingVendorLine = matched.qtyLine || matched.qtyFull || matched.qtyPartial;
                }

                returnValue = matchingVendorLine;
            } catch (error) {
                vc2_util.log(logTitle, '## NO MATCH ## ', error);
                returnValue = false;
            }

            return returnValue;
        },
        getAltPartNumValues: function (option) {
            var logTitle = [LogTitle, 'getAltPartNumValues'].join('::');
            // returnValue;

            // first get our configs
            Current.MainCFG =
                Current.MainCFG || option.mainConfig || vcs_configLib.mainConfig() || {};
            Current.OrderCFG = Current.OrderCFG || option.orderConfig || {};

            // vc2_util.log(logTitle, '### Option: ', option);

            var field = {
                    altNames: option.source,
                    sku: option.sku,
                    mpn: option.mpn,
                    skuColumn:
                        Current.OrderCFG.itemColumnIdToMatch || Current.MainCFG.itemColumnIdToMatch,
                    mpnColumn:
                        Current.OrderCFG.itemMPNColumnIdToMatch ||
                        Current.MainCFG.itemMPNColumnIdToMatch,
                    isItemMatchedWVendorSKU:
                        Current.OrderCFG.matchItemToPartNumber ||
                        Current.MainCFG.matchItemToPartNumber,
                    isMPNMatchedWName:
                        Current.OrderCFG.matchMPNWithPartNumber ||
                        Current.MainCFG.matchMPNWithPartNumber
                },
                lineData = option.target;

            // vc2_util.log(logTitle, '... field settings / linevalues: ', {
            //     field: field,
            //     lineData: lineData
            // });

            if (field.altNames && field.altNames[lineData.item]) {
                if (field.altNames._sku) {
                    if (field.isItemMatchedWVendorSKU) {
                        lineData.alternativeSKU = field.altNames[lineData.item].partNumber;
                    } else {
                        lineData.alternativeItemName = field.altNames[lineData.item].partNumber;
                    }
                }
                if (field.altNames._mpn) {
                    if (field.isMPNMatchedWName) {
                        lineData.alternativeItemName2 = field.altNames[lineData.item].mpn;
                    } else {
                        lineData.alternativeMPN = field.altNames[lineData.item].mpn;
                    }
                }
            }

            if (field.sku || field.skuColumn) {
                if (field.isItemMatchedWVendorSKU) {
                    lineData.alternativeSKU = field.sku || lineData[field.skuColumn];
                } else {
                    lineData.alternativeItemName = field.sku || lineData[field.skuColumn];
                }
            }

            if (field.mpn || field.mpnColumn) {
                if (field.isMPNMatchedWName) {
                    lineData.alternativeItemName2 = field.mpn || lineData[field.mpnColumn];
                } else {
                    lineData.alternativeMPN = field.mpn || lineData[field.mpnColumn];
                }
            }

            // vc2_util.log(logTitle, '### Return: ', lineData);

            return lineData;
        }
    };

    // line item matching
    util.extend(VC2_RecordLib, {
        matchOrderLines: function (option) {
            var logTitle = [LogTitle, 'matchOrderLines'].join('::'),
                returnValue;

            try {
                var arrOrderLines = option.orderLines,
                    arrVendorLines = option.vendorLines,
                    includeZeroQtyLines = option.includeZeroQtyLines || false,
                    includeBilledQty = option.includeUnbilledQty || false,
                    includeFullyMatched = option.includeFullyMatched || false,
                    orderRecord = option.record || option.recOrder;

                if (vc2_util.isEmpty(arrOrderLines)) {
                    if (!orderRecord) throw 'Missing record or order lines';

                    arrOrderLines = VC2_RecordLib.extractRecordLines({
                        record: orderRecord,
                        columns: ['item', 'quantity', 'rate', 'quantityreceived', 'quantitybilled'],
                        findAll: true
                    });
                }
                if (vc2_util.isEmpty(arrOrderLines)) throw 'Missing order lines';
                if (vc2_util.isEmpty(arrVendorLines)) throw 'Missing vendor lines';

                /// PREP the DATA ///
                arrOrderLines.forEach(function (orderLine) {
                    orderLine.quantity = vc2_util.forceInt(orderLine.quantity);
                    orderLine.rate = vc2_util.forceFloat(orderLine.rate);

                    orderLine.AVAILQTY = orderLine.quantity;
                    orderLine.FULLQTY = orderLine.quantity;
                    orderLine.APPLIEDQTY = 0;

                    if (includeBilledQty) {
                        orderLine.quantityreceived = vc2_util.forceInt(orderLine.quantityreceived);
                        orderLine.quantitybilled = vc2_util.forceInt(orderLine.quantitybilled);
                        orderLine.AVAILQTY = orderLine.quantityreceived - orderLine.quantitybilled;
                    }

                    return true;
                });
                arrVendorLines.forEach(function (vendorLine) {
                    vendorLine.quantity = vc2_util.forceInt(vendorLine.quantity);
                    vendorLine.rate = vc2_util.forceFloat(vendorLine.rate);

                    vendorLine.AVAILQTY = vendorLine.quantity;
                    vendorLine.APPLIEDQTY = 0;
                    return true;
                });

                /// START the loop
                var arrOutputLines = [];
                arrVendorLines.forEach(function (vendorLine) {
                    try {
                        // look for required cols
                        if (!vendorLine.itemId) return; // skip vendorlines that dont have item id
                        if (!includeZeroQtyLines && !vendorLine.quantity) return;

                        var vendorItemNameFilter = {
                            AVAILQTY: function (val) {
                                return val > 0;
                            }
                        };
                        vendorItemNameFilter[vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                            function (value) {
                                return (
                                    value && vc2_util.inArray(vendorLine.itemId, value.split('\n'))
                                );
                            };

                        vendorLine.MATCHING = [];

                        var matchingOrderLines = {
                            // fully matched items
                            fullyMatched:
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        alternativeItemName: vendorLine.itemId,
                                        quantity: vendorLine.quantity,
                                        rate: vendorLine.rate,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        itemId: vendorLine.itemId,
                                        quantity: vendorLine.quantity,
                                        rate: vendorLine.rate,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                [],
                            // item rate match
                            itemRate:
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        alternativeItemName: vendorLine.itemId,
                                        rate: vendorLine.rate,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        itemId: vendorLine.itemId,
                                        rate: vendorLine.rate,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                [],
                            // item qty
                            itemQty:
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        alternativeItemName: vendorLine.itemId,
                                        quantity: vendorLine.quantity,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        itemId: vendorLine.itemId,
                                        quantity: vendorLine.quantity,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                [],
                            // just match the items
                            itemOnly:
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        alternativeItemName: vendorLine.itemId,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: {
                                        itemId: vendorLine.itemId,
                                        AVAILQTY: function (val) {
                                            return val > 0;
                                        }
                                    }
                                }) ||
                                vc2_util.findMatching({
                                    dataSet: arrOrderLines,
                                    findAll: true,
                                    filter: vendorItemNameFilter
                                }) ||
                                []
                        };

                        // vc2_util.dumpLog(logTitle, matchingOrderLines, 'Matching Lines: ');

                        // try to distribute the AVAILQTY
                        var fnQuantityDist = function (matchedOrderLine) {
                            try {
                                // vc2_util.log(logTitle, '.... order line: ', matchedOrderLine);
                                if (matchedOrderLine.AVAILQTY <= 0) return; // skip if there are no AVAILQTY
                                if (vendorLine.AVAILQTY <= 0) return; // skip if there are no AVAILQTY

                                // var qtyRemaining÷
                                var qtyToApply =
                                    matchedOrderLine.AVAILQTY >= vendorLine.AVAILQTY
                                        ? vendorLine.AVAILQTY // if the orderline can cover the entire vendorline
                                        : matchedOrderLine.AVAILQTY; // just use up the orderline

                                matchedOrderLine.AVAILQTY -= qtyToApply;
                                matchedOrderLine.APPLIEDQTY += qtyToApply;

                                vendorLine.APPLIEDQTY += qtyToApply;
                                vendorLine.AVAILQTY -= qtyToApply;

                                vendorLine.MATCHING.push(vc2_util.clone(matchedOrderLine));
                            } catch (err) {
                                vc2_util.logError(logTitle, err);
                            }

                            return true;
                        };

                        matchingOrderLines.fullyMatched.forEach(fnQuantityDist);
                        matchingOrderLines.itemRate.forEach(fnQuantityDist);
                        matchingOrderLines.itemQty.forEach(fnQuantityDist);
                        matchingOrderLines.itemOnly.forEach(fnQuantityDist);

                        // vendorLine.MATCHED_LINES = matchingOrderLines;
                    } catch (match_error) {
                        vc2_util.logError(logTitle, match_error);
                    } finally {
                        arrOutputLines.push(vendorLine);
                    }

                    return true;
                });

                returnValue = arrOutputLines;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    });

    return VC2_RecordLib;
});
