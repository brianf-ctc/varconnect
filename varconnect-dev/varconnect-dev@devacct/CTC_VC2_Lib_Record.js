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
        vc2_util = require('./CTC_VC2_Lib_Utils');

    var LogTitle = 'VC_RecordLib';

    var LineColField = vc2_constant.FIELD.TRANSACTION;

    var VC2_RecordLib = {
        transform: function (option) {
            var logTitle = [LogTitle, 'transform'].join('::'),
                returnValue;

            try {
                if (!option.fromType) throw 'Record fromType is required. [fromType]';
                if (!option.fromId) throw 'Record fromId is required. [fromId]';
                if (!option.toType) throw 'Record toType is required. [toType]';

                // log.audit(logTitle, '// TRANSFORM: ' + JSON.stringify(option));

                returnValue = ns_record.transform(option);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

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

                // log.audit(logTitle, '// LOAD RECORD: ' + JSON.stringify(option));
                returnValue = ns_record.load(option);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
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
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
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
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
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
                mainCfg = option.mainConfig,
                vendorCfg = option.vendorConfig,
                itemField = null,
                returnValue = null;
            try {
                // vendorCfg.itemColumnIdToMatch > vendorCfg.itemFieldIdToMatch > mainCfg.itemColumnIdToMatch > mainCfg.itemFieldIdToMatch
                if (vendorCfg && !vendorCfg.itemColumnIdToMatch) {
                    itemField = vendorCfg.itemFieldIdToMatch;
                }
                if (
                    !itemField &&
                    (!vendorCfg || !vendorCfg.itemColumnIdToMatch) &&
                    mainCfg &&
                    !mainCfg.itemColumnIdToMatch
                ) {
                    itemField = mainCfg.itemFieldIdToMatch;
                }
                log.debug(logTitle, 'Lookup alt name (' + itemField + ')...');
                if (itemField && itemIds.length) {
                    var searchOption = {
                        type: ns_search.Type.ITEM,
                        filterExpression: [
                            ['internalid', 'anyof', itemIds],
                            'and',
                            ['isinactive', 'is', 'F']
                        ],
                        columns: [itemField]
                    };
                    var searchResults = vc2_util.searchAllPaged(searchOption);
                    if (searchResults && searchResults.length) {
                        var altItemNames = {};
                        searchResults.forEach(function (result) {
                            var altItemName = result.getValue({ name: itemField }),
                                itemId = result.id;
                            altItemNames[itemId] = altItemName;
                            return true;
                        });
                        returnValue = altItemNames;
                    }
                    log.debug(logTitle, 'Alt item names=' + JSON.stringify(returnValue));
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to extract alternative item names',
                    message: vc2_util.extractError(error)
                });
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
                    log.debug(
                        logTitle,
                        'Lookup items for assigned vendor names... ' + uniqueItemIds.join(', ')
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
                            log.debug(
                                logTitle,
                                'Vendor item names=' + JSON.stringify(vendorItemMap)
                            );
                        }
                    }
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to extract vendor item names',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        extractRecordLines: function (option) {
            var logTitle = [LogTitle, 'extractRecordLines'].join('::'),
                mainCfg = option.mainConfig,
                vendorCfg = option.vendorConfig,
                returnValue;

            try {
                var GlobalVar = vc2_constant.GLOBAL;
                var record = option.record;
                var itemAltNameColId = null;
                if (vendorCfg) {
                    itemAltNameColId = vendorCfg.itemColumnIdToMatch;
                }
                if (!itemAltNameColId && mainCfg) {
                    itemAltNameColId = mainCfg.itemColumnIdToMatch;
                }
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
                if (itemAltNameColId && columns.indexOf(itemAltNameColId) == -1) {
                    columns.push(itemAltNameColId);
                }
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
                    if (!vc2_util.inArray(lineData.item, uniqueItemIds)) {
                        uniqueItemIds.push(lineData.item);
                    }
                    // log.audit(logTitle, lineData);
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
                    item: uniqueItemIds,
                    mainConfig: mainCfg,
                    vendorConfig: vendorCfg
                });
                returnValue.forEach(function (lineData) {
                    if (lineData && lineData.item) {
                        if (altItemNames) {
                            lineData.alternativeItemName = altItemNames[lineData.item];
                        } else if (itemAltNameColId) {
                            lineData.alternativeItemName = lineData[itemAltNameColId];
                        }
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
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

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

                log.audit(logTitle, '// UPDATE LINE: ' + JSON.stringify(lineData));

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
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

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
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

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

                var mainConfig = option.mainConfig,
                    vendorConfig = option.vendorConfig;

                var VendorList = vc2_constant.LIST.XML_VENDOR,
                    GlobalVar = vc2_constant.GLOBAL;

                if (vc2_util.isEmpty(orderLines)) {
                    orderLines = VC2_RecordLib.extractRecordLines({
                        record: record,
                        mainConfig: mainConfig,
                        vendorConfig: vendorConfig
                    });
                }
                if (vc2_util.isEmpty(vendorLine)) throw 'Vendor line is required';
                if (vc2_util.isEmpty(orderLines)) throw 'Order lines is required';

                var isDandH = vendorConfig.xmlVendor == VendorList.DandH,
                    isIngram = vc2_util.inArray(vendorConfig.xmlVendor, [
                        VendorList.INGRAM_MICRO_V_ONE,
                        VendorList.INGRAM_MICRO
                    ]);

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
                                vendorLine: vendorLine,
                                mainConfig: mainConfig,
                                vendorConfig: vendorConfig
                            });
                            returnValue = !!matchedValue;

                            return returnValue;
                        }
                    }
                });
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

                    vc2_util.log(logTitle, '///...matching: ', matching);

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
         *      vendorConfig - vendor config
         * @returns
         */

        isVendorLineMatched: function (option) {
            var logTitle = [LogTitle, 'isVendorLineMatched'].join('::'),
                returnValue;

            var VendorList = vc2_constant.LIST.XML_VENDOR,
                GlobalVar = vc2_constant.GLOBAL;

            var orderLine = option.orderLine,
                vendorLine = option.vendorLine,
                mainCfg = option.mainConfig,
                vendorCfg = option.vendorConfig;

            if (vc2_util.isEmpty(vendorLine)) throw 'Vendor line is required';
            if (vc2_util.isEmpty(orderLine)) throw 'Order line is required';

            var item = {
                forcedValue: option.alternativeItemName || orderLine.alternativeItemName,
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
                    option.isDandH || vendorCfg ? vendorCfg.xmlVendor == VendorList.DandH : null,
                ingramHashSpace: option.ingramHashSpace || mainCfg ? mainCfg.ingramHashSpace : null,
                isIngram:
                    option.ingramHashSpace || vendorCfg
                        ? vc2_util.inArray(vendorCfg.xmlVendor, [
                              VendorList.INGRAM_MICRO_V_ONE,
                              VendorList.INGRAM_MICRO
                          ])
                        : null,
                isDell: option.isDell || vendorCfg ? vendorCfg.xmlVendor == VendorList.DELL : null
            };
            // vc2_util.log(logTitle, '... settings:', settings);

            var matchedValue;
            try {
                if (item.forcedValue && vendorLine.item_num == item.forcedValue) {
                    matchedValue = 'AltItemName';
                } else if (
                    vc2_util.inArray(vendorLine.item_num, [
                        item.text,
                        item.altValue,
                        item.altText,
                        item.sitemname
                    ])
                ) {
                    matchedValue = 'ItemName';
                } else if (
                    vendorLine.vendorSKU &&
                    item.skuValue &&
                    vendorLine.vendorSKU == item.skuValue
                ) {
                    matchedValue = 'VendorSKU';
                } else if (
                    settings.isDandH &&
                    item.dnhValue &&
                    vc2_util.inArray(item.dnhValue, [vendorLine.item_num, vendorLine.vendorSKU])
                ) {
                    matchedValue = 'D&H item';
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
                } else if (settings.isDell && vendorLine.vendorSKU == item.dellQuoteNo) {
                    matchedValue = 'DellQuoteNo';
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
                                mainConfig: option.mainConfig || option.mainCfg || null,
                                vendorConfig: option.vendorConfig || option.vendorCfg || null,
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
        updateRecord: function (option) {}
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
                    orderRecord = option.record || option.recOrder;

                if (vc2_util.isEmpty(arrOrderLines)) {
                    if (!orderRecord) throw 'Missing record or order lines';

                    arrOrderLines = VC2_RecordLib.extractRecordLines({
                        record: orderRecord,
                        columns: ['item', 'quantity', 'rate'],
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
                    orderLine.APPLIEDQTY = 0;
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
                // vc2_util.log(logTitle, '**** MATCHING ITEMS START **** ', {
                //     orderLines: arrOrderLines,
                //     vendorLines: arrVendorLines
                //     // totalOrderLines: arrOrderLines.length,
                //     // totalVendorLines: arrVendorLines.length
                // });

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
