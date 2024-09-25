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
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([
    'N/search',
    'N/record',
    'N/format',
    'N/config',
    'N/https',
    'N/error',
    './../../CTC_VC2_Constants',
    './../../CTC_VC2_Lib_Utils',
    './../../Services/ctc_svclib_configlib',
    './moment'
], function (
    ns_search,
    ns_record,
    ns_format,
    ns_config,
    ns_https,
    ns_error,
    vc2_constant,
    vc2_util,
    vcs_configLib,
    moment
) {
    var LogTitle = 'LIB::BillFiles',
        LogPrefix;

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var MainConfig = null;

    var Helper = {
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (Helper.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::'),
                returnValue;

            var dateString = option.dateString || option,
                dateValue = '';

            try {
                if (dateString && dateString.length > 0 && dateString != 'NA') {
                    dateValue = moment(dateString).toDate();
                }

                //Convert to string
                if (dateValue) {
                    dateValue = ns_format.format({
                        value: dateValue,
                        type: ns_format.Type.DATE
                    });
                }

                returnValue = dateValue;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, 'Parsed Date [' + dateString + ']: ', [
                    dateValue,
                    typeof dateValue
                ]);
            }
            return returnValue;
        },
        extractAlternativeItemName: function (option) {
            var logTitle = [LogTitle, 'extractAlternativeItemName'].join('::'),
                itemIds = option.item,
                OrderCFG = option.orderConfig,
                itemField = null,
                mpnField = null,
                returnValue = null;
            try {
                // OrderCFG.itemColumnIdToMatch > OrderCFG.itemFieldIdToMatch > MainConfig.itemColumnIdToMatch > MainConfig.itemFieldIdToMatch
                if (OrderCFG && !OrderCFG.itemColumnIdToMatch) {
                    itemField = OrderCFG.itemFieldIdToMatch;
                }
                if (
                    !itemField &&
                    (!OrderCFG || !OrderCFG.itemColumnIdToMatch) &&
                    MainConfig &&
                    !MainConfig.itemColumnIdToMatch
                ) {
                    itemField = MainConfig.itemFieldIdToMatch;
                }
                // OrderCFG.itemMPNColumnIdToMatch > OrderCFG.itemMPNFieldIdToMatch > MainCFG.itemMPNColumnIdToMatch > MainCFG.itemMPNFieldIdToMatch
                if (OrderCFG && !OrderCFG.itemMPNColumnIdToMatch) {
                    mpnField = OrderCFG.itemMPNFieldIdToMatch;
                }
                if (
                    !mpnField &&
                    (!OrderCFG || !OrderCFG.itemMPNColumnIdToMatch) &&
                    MainConfig &&
                    !MainConfig.itemMPNColumnIdToMatch
                ) {
                    mpnField = MainConfig.itemMPNFieldIdToMatch;
                }
                if (itemIds.length && (itemField || mpnField)) {
                    var itemColumns = [];
                    if (itemField) {
                        itemColumns.push(itemField);
                    }
                    if (mpnField) {
                        itemColumns.push(mpnField);
                    }
                    vc2_util.log(logTitle, 'Lookup alt names for items... ' + itemIds.join(', '));
                    var searchOption = {
                        type: ns_search.Type.ITEM,
                        filterExpression: [
                            ['internalid', 'anyof', itemIds],
                            'and',
                            ['isinactive', 'is', 'F']
                        ],
                        columns: itemColumns
                    };
                    var searchResults = vc2_util.searchAllPaged(searchOption);
                    if (searchResults && searchResults.length) {
                        var altItemNames = {
                            _sku: false,
                            _mpn: false
                        };
                        searchResults.forEach(function (result) {
                            var altItemName = null,
                                mpnValue = null;
                            if (itemField) {
                                altItemName = result.getValue({ name: itemField });
                                altItemNames._sku = true;
                            }
                            if (mpnField) {
                                mpnValue = result.getValue({ name: mpnField });
                                altItemNames._mpn = true;
                            }
                            var itemId = result.id;
                            altItemNames[itemId] = {
                                partNumber: altItemName,
                                mpn: mpnValue
                            };
                            return true;
                        });
                        returnValue = altItemNames;
                    }
                    vc2_util.log(logTitle, 'Alt item names=', returnValue);
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);

                throw ns_error.create({
                    name: 'Unable to extract alternative item names',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        getAltPartNumValues: function (option) {
            var logTitle = [LogTitle, 'getAltPartNumValues'].join('::'),
                source = option.source,
                skuColumn = null,
                mpnColumn = null,
                sku = option.sku,
                mpn = option.mpn,
                isItemOnlyMatchedWithVendorSKU = null,
                isMPNMatchedWithName = null,
                returnValue = option.target;
            if (option.orderConfig) {
                skuColumn = option.orderConfig.itemColumnIdToMatch;
                mpnColumn = option.orderConfig.itemMPNColumnIdToMatch;
                isItemOnlyMatchedWithVendorSKU = option.orderConfig.matchItemToPartNumber;
                isMPNMatchedWithName = option.orderConfig.matchMPNWithPartNumber;
            }
            if (option.mainConfig) {
                skuColumn = skuColumn || option.mainConfig.itemColumnIdToMatch;
                mpnColumn = mpnColumn || option.mainConfig.itemMPNColumnIdToMatch;
                isItemOnlyMatchedWithVendorSKU = vc2_util.isEmpty(isItemOnlyMatchedWithVendorSKU)
                    ? option.mainConfig.matchItemToPartNumber
                    : null;
                isMPNMatchedWithName = vc2_util.isEmpty(isMPNMatchedWithName)
                    ? option.mainConfig.matchMPNWithPartNumber
                    : null;
            }
            if (source && source[returnValue.item]) {
                if (source._sku) {
                    if (isItemOnlyMatchedWithVendorSKU) {
                        returnValue.alternativeSKU = source[returnValue.item].partNumber;
                    } else {
                        returnValue.alternativeItemName = source[returnValue.item].partNumber;
                    }
                }
                if (source._mpn) {
                    if (isMPNMatchedWithName) {
                        returnValue.alternativeItemName2 = source[returnValue.item].mpn;
                    } else {
                        returnValue.alternativeMPN = source[returnValue.item].mpn;
                    }
                }
            }
            if ((!source || !source._sku) && (sku || skuColumn)) {
                if (isItemOnlyMatchedWithVendorSKU) {
                    returnValue.alternativeSKU = sku || returnValue[skuColumn];
                } else {
                    returnValue.alternativeItemName = sku || returnValue[skuColumn];
                }
            }
            if ((!source || !source._mpn) && (mpn || mpnColumn)) {
                if (isMPNMatchedWithName) {
                    returnValue.alternativeItemName2 = mpn || returnValue[mpnColumn];
                } else {
                    returnValue.alternativeMPN = mpn || returnValue[mpnColumn];
                }
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
        searchPO: function (poName) {
            var logTitle = [LogTitle, 'searchPO'].join('::'),
                poColumns = [
                    'trandate',
                    'postingperiod',
                    'type',
                    MainConfig.overridePONum ? 'custbody_ctc_vc_override_ponum' : 'tranid',
                    'tranid',
                    'entity',
                    'amount',
                    'internalid'
                ],
                returnValue;

            vc2_util.log(logTitle, '// search for existing PO: ', poName);

            if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES) {
                poColumns.push('subsidiary');
            }
            var searchObj = ns_search.create({
                type: 'purchaseorder',
                filters: [
                    MainConfig.overridePONum
                        ? [
                              ['numbertext', 'is', poName],
                              'OR',
                              ['custbody_ctc_vc_override_ponum', 'is', poName]
                          ]
                        : ['numbertext', 'is', poName],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'PurchOrd']
                ],
                columns: poColumns
            });

            var poData = false;
            if (searchObj.runPaged().count) {
                var searchResult = searchObj.run().getRange({ start: 0, end: 1 }).shift();

                poData = {
                    id: searchResult.getValue({ name: 'internalid' }),
                    entityId: searchResult.getValue({ name: 'entity' }),
                    entityName: searchResult.getText({ name: 'entity' }),
                    tranId: searchResult.getValue({ name: 'tranid' }),
                    date: searchResult.getValue({ name: 'trandate' }),
                    subsidiary: null
                };
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES) {
                    poData.subsidiary = searchResult.getValue({ name: 'subsidiary' });
                }
            }
            returnValue = poData;
            vc2_util.log(logTitle, '... PO Data : ', poData);

            return returnValue;
        },
        billFileExists: function (option) {
            var logTitle = [LogTitle, 'searchBillFile'].join('::'),
                returnValue;

            // existing bill files that is not yet processed


            if (option && option.invoice) {
                var parsedDate = parseDate({ dateString: option.date });
                var searchObj = ns_search.create({
                    type: 'customrecord_ctc_vc_bills',
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['custrecord_ctc_vc_bill_number', 'is', option.invoice]
                        // 'AND',
                        // [
                        //     ['custrecord_ctc_vc_bill_date', 'on', parsedDate],
                        //     'OR',
                        //     ['custrecord_ctc_vc_bill_date', 'noton', parsedDate]
                        // ]
                    ],
                    columns: ['id']
                });
                returnValue = searchObj.runPaged().count;
            }

            return !!returnValue;
        },
        collectItemsFromPO: function (option) {
            var logTitle = [LogTitle, 'collectItemsFromPO'],
                poColumns = [
                    ns_search.createColumn({
                        name: 'item',
                        summary: 'GROUP'
                    })
                ],
                returnValue = [];

            if (!option.poId) return false;
            var itemAltSKUColId = null;
            if (option.orderConfig) {
                itemAltSKUColId = option.orderConfig.itemColumnIdToMatch;
            }
            if (!itemAltSKUColId && MainConfig) {
                itemAltSKUColId = MainConfig.itemColumnIdToMatch;
            }
            var itemAltMPNColId = null;
            if (option.orderConfig) {
                itemAltMPNColId = option.orderConfig.itemMPNColumnIdToMatch;
            }
            if (!itemAltMPNColId && MainConfig) {
                itemAltMPNColId = MainConfig.itemMPNColumnIdToMatch;
            }
            if (itemAltSKUColId) {
                itemAltSKUColId =
                    vc2_constant.FIELD_TO_SEARCH_COLUMN_MAP.TRANSACTION[itemAltSKUColId] ||
                    itemAltSKUColId;
                if (util.isObject(itemAltSKUColId)) {
                    util.extend(itemAltSKUColId, {
                        summary: 'GROUP'
                    });
                    poColumns.push(ns_search.createColumn(itemAltSKUColId));
                } else {
                    poColumns.push(
                        ns_search.createColumn({
                            name: itemAltSKUColId,
                            summary: 'GROUP'
                        })
                    );
                }
            }
            if (itemAltMPNColId) {
                itemAltMPNColId =
                    vc2_constant.FIELD_TO_SEARCH_COLUMN_MAP.TRANSACTION[itemAltMPNColId] ||
                    itemAltMPNColId;
                if (util.isObject(itemAltMPNColId)) {
                    util.extend(itemAltMPNColId, {
                        summary: 'GROUP'
                    });
                    poColumns.push(ns_search.createColumn(itemAltMPNColId));
                } else {
                    poColumns.push(
                        ns_search.createColumn({
                            name: itemAltMPNColId,
                            summary: 'GROUP'
                        })
                    );
                }
            }
            var itemSearch = ns_search.create({
                type: 'transaction',
                filters: [['internalid', 'anyof', option.poId], 'AND', ['mainline', 'is', 'F']],
                columns: poColumns
            });

            var arrSKUs = [];
            itemSearch.run().each(function (result) {
                var poLine = {
                    text: result.getText({
                        name: 'item',
                        summary: 'GROUP'
                    }),
                    itemNum: result.getText({
                        name: 'item',
                        summary: 'GROUP'
                    }),
                    value: result.getValue({
                        name: 'item',
                        summary: 'GROUP'
                    }),
                    item: result.getValue({
                        name: 'item',
                        summary: 'GROUP'
                    })
                };
                if (itemAltSKUColId) {
                    poLine[itemAltSKUColId] = result.getValue({
                        name: itemAltSKUColId,
                        summary: 'GROUP'
                    });
                    if (poLine[itemAltSKUColId] == '- None -') {
                        poLine[itemAltSKUColId] = null;
                    }
                }
                if (itemAltMPNColId) {
                    poLine[itemAltMPNColId] = result.getValue({
                        name: itemAltMPNColId,
                        summary: 'GROUP'
                    });
                    if (poLine[itemAltMPNColId] == '- None -') {
                        poLine[itemAltMPNColId] = null;
                    }
                }
                arrSKUs.push(poLine);
                return true;
            });
            returnValue = arrSKUs;

            var arrPOItems = [],
                uniqueItemIds = [];
            arrSKUs.forEach(function (skuDetails) {
                arrPOItems.push({ item: skuDetails.value });
                if (uniqueItemIds.indexOf(skuDetails.value) == -1) {
                    uniqueItemIds.push(skuDetails.value);
                }
                return true;
            });
            var arrSKUsVendorNames = Helper.extractVendorItemNames({ lines: arrPOItems });
            var altItemNames = Helper.extractAlternativeItemName({
                item: uniqueItemIds,
                orderConfig: option.orderConfig
            });

            for (var i = 0, len = arrSKUs.length; i < len; i += 1) {
                arrSKUs[i].vendorItemName =
                    arrSKUsVendorNames[i][vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY];
                arrSKUs[i] = Helper.getAltPartNumValues({
                    source: altItemNames,
                    target: arrSKUs[i],
                    orderConfig: option.orderConfig,
                    mainConfig: MainConfig
                });
            }
            vc2_util.log(logTitle, '// arrSKUs: ', arrSKUs);

            return returnValue;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
                returnValue;
            var entityId = option.entity;
            var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

            try {
                var searchOption = {
                    type: 'vendor',
                    filters: [['internalid', 'anyof', entityId]],
                    columns: []
                };

                for (var field in BILLCREATE_CFG.FIELD) {
                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        })
                    );
                }

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count) throw 'No config available';

                returnValue = {};
                searchObj.run().each(function (row) {
                    for (var field in BILLCREATE_CFG.FIELD) {
                        returnValue[field] = row.getValue({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        });
                    }
                    return true;
                });

                vc2_util.log(logTitle, '// config: ', returnValue);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        isItemMatchRL: function (option) {
            var logTitle = [LogTitle, 'isFuseMatch'].join('::'),
                returnValue = false;

            try {
                var fuzzyResp = ns_https.requestRestlet({
                    headers: { 'Content-Type': 'application/json' },
                    scriptId: vc2_constant.SCRIPT.ITEM_MATCH_RL,
                    deploymentId: vc2_constant.DEPLOYMENT.ITEM_MATCH_RL,
                    method: 'POST',
                    body: JSON.stringify({
                        list: option.list,
                        keys: option.searchKeys,
                        searchValue: option.value
                    })
                });
                var results = JSON.parse(fuzzyResp.body);
                vc2_util.log(logTitle, '/// Fuse match: ', results);

                if (results.match) {
                    returnValue = true;
                }
            } catch (match_error) {
                vc2_util.logError(logTitle, match_error);
            }

            return returnValue;
        }
    };

    var dateFormat;
    function parseDate(option) {
        var logTitle = [LogTitle, 'parseDate'].join('::');
        vc2_util.log(logTitle, '>> options: ', option);

        var dateString = option.dateString || option,
            dateValue = '';

        if (dateString && dateString.length > 0 && dateString != 'NA') {
            try {
                dateValue = moment(dateString).toDate();
            } catch (e) {
                vc2_util.logError(logTitle, e);
            }
        }
        vc2_util.log(logTitle, 'Parsed Date :' + dateString + ' : ', [dateValue, typeof dateValue]);
        // return date;
        //Convert to string
        if (dateValue) {
            dateValue = ns_format.format({
                value: dateValue,
                type: ns_format.Type.DATE
            });
        }

        vc2_util.log(logTitle, 'return value :', [dateValue, typeof dateValue]);

        return dateValue;
    }

    function process(configObj, myArr, name) {
        var logTitle = [LogTitle, 'process'].join('::');

        vc2_util.log(logTitle, '**** START process ****  ');
        vc2_util.log(logTitle, '>> configObj: ', configObj);
        vc2_util.log(logTitle, '>> myArr: ', myArr);
        vc2_util.log(logTitle, '>> name: ', name);

        MainConfig = vcs_configLib.mainConfig();

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            vc2_util.log(logTitle, '>> dateFormat: ', dateFormat);
        }

        try {
            if (!myArr || !myArr.length) throw 'Empty response';

            for (var i = 0; i < myArr.length; i++) {
                var currentOrder = myArr[i].ordObj;
                LogPrefix = '[bill:' + currentOrder.invoice + '] ';
                vc2_util.LogPrefix = '[bill:' + currentOrder.invoice + '] ';

                vc2_util.log(logTitle, '###### PROCESSING [' + currentOrder.invoice + '] ######');
                vc2_util.log(logTitle, { idx: i, data: myArr[i] });

                vc2_util.log(logTitle, '// Look for existing bills...');
                if (Helper.billFileExists(currentOrder)) {
                    vc2_util.log(logTitle, '...already exists, skipping');
                    continue;
                }

                vc2_util.log(logTitle, ' /// Initiate bill file record.');
                var billFileNotes = [];
                var billFileValues = {
                    name: name,
                    custrecord_ctc_vc_bill_file_position: i + 1,
                    custrecord_ctc_vc_bill_po: currentOrder.po,
                    custrecord_ctc_vc_bill_number: currentOrder.invoice,
                    custrecord_ctc_vc_bill_date: moment(currentOrder.date).toDate(),
                    custrecord_ctc_vc_bill_proc_status: 1,
                    custrecord_ctc_vc_bill_integration: configObj.id,
                    custrecord_ctc_vc_bill_src: myArr[i].xmlStr
                };

                var dueDate = null,
                    manualDueDate = false;

                if (currentOrder.hasOwnProperty('duedate') == true) {
                    dueDate = currentOrder.duedate;
                    manualDueDate = true;
                }

                var poData = Helper.searchPO(currentOrder.po.toString().trim());
                if (!poData) {
                    billFileNotes.push('PO Link is not found : [' + currentOrder.po + ']');
                } else {
                    // load the vendor config
                    var billVendorCFG = vcs_configLib.billVendorConfig({ poId: poData.id });
                    var orderVendorCFG = vcs_configLib.orderVendorConfig({ poId: poData.id });

                    billFileValues.custrecord_ctc_vc_bill_linked_po = poData.id;
                    billFileNotes.push('Linked to PO: ' + poData.tranId + ' (' + poData.id + ') ');

                    ///////////////////////////////////
                    //For Ergo:  Cisco, Dell, EMC, Scansource, Westcon
                    // if (Helper.inArray(poData.entityId, ['75', '203', '216', '371', '496'])) {
                    //     billFileValues.custrecord_ctc_vc_bill_is_recievable = true;
                    // }

                    if (billVendorCFG.enableFulfillment)
                        billFileValues.custrecord_ctc_vc_bill_is_recievable = true;

                    var vendorTerms = 0;
                    var searchTerms = ns_search.lookupFields({
                        type: ns_search.Type.VENDOR,
                        id: poData.entityId,
                        columns: ['terms']
                    });

                    if (searchTerms.terms.length > 0) {
                        vendorTerms = searchTerms.terms[0].value;

                        if (!manualDueDate) {
                            var daysToPay = ns_search.lookupFields({
                                type: ns_search.Type.TERM,
                                id: vendorTerms,
                                columns: ['daysuntilnetdue']
                            }).daysuntilnetdue;

                            dueDate = moment(currentOrder.date)
                                .add(parseInt(daysToPay), 'days')
                                .format('MM/DD/YYYY');
                        }
                    }
                }

                if (dueDate !== null) {
                    billFileValues.custrecord_ctc_vc_bill_due_date = moment(dueDate).toDate();
                    if (manualDueDate) {
                        billFileValues.custrecord_ctc_vc_bill_due_date_f_file = true;
                    }
                }

                var ii;
                if (poData.id) {
                    // match payload items to transaction items
                    var availableSkus = Helper.collectItemsFromPO({
                        poId: poData.id,
                        orderConfig: orderVendorCFG
                    });
                    var arrMatchedSKU = [];

                    for (ii = 0; ii < currentOrder.lines.length; ii++) {
                        var itemNo = currentOrder.lines[ii].ITEMNO;
                        var vendorSKU = currentOrder.lines[ii].SKU;

                        var logPrefix = '// search for matching item [' + itemNo + '] ';

                        var matchedSku = false;

                        for (var iii = 0; iii < availableSkus.length; iii++) {
                            if (
                                (availableSkus[iii].alternativeItemName &&
                                    availableSkus[iii].alternativeItemName == itemNo) ||
                                (availableSkus[iii].alternativeItemName2 &&
                                    availableSkus[iii].alternativeItemName2 == itemNo) ||
                                (availableSkus[iii].alternativeSKU &&
                                    availableSkus[iii].alternativeSKU == vendorSKU) ||
                                (availableSkus[iii].alternativeMPN &&
                                    availableSkus[iii].alternativeMPN == itemNo) ||
                                (availableSkus[iii].text && availableSkus[iii].text == itemNo) ||
                                (availableSkus[iii].vendorItemName &&
                                    availableSkus[iii].vendorItemName == itemNo)
                            ) {
                                matchedSku = availableSkus[iii].value;
                                break;
                            }
                        }
                        vc2_util.log(logTitle, logPrefix + '.. exact match ? ', matchedSku);

                        if (!matchedSku) {
                            matchedSku = Helper.isItemMatchRL({
                                list: availableSkus,
                                searchKeys: ['text'],
                                value: itemNo
                            });

                            vc2_util.log(logTitle, logPrefix + '.. fuzzy match ? ', matchedSku);
                        }

                        if (!matchedSku) {
                            billFileNotes.push('Not matched SKU: ' + itemNo);
                            vc2_util.log(logTitle, logPrefix + '.. match not found. ');
                        } else {
                            currentOrder.lines[ii].NSITEM = matchedSku;
                            arrMatchedSKU.push(matchedSku);
                        }
                    }

                    vc2_util.log(logTitle, '... matched items: ', arrMatchedSKU);

                    if (arrMatchedSKU.length) {
                        billFileNotes.push('Matched SKU: ' + arrMatchedSKU.length);
                    }
                } else {
                    for (ii = 0; ii < currentOrder.lines.length; ii++) {
                        currentOrder.lines[ii].NSITEM = '';
                    }
                }
                billFileValues.custrecord_ctc_vc_bill_json = JSON.stringify(currentOrder);
                billFileValues.custrecord_ctc_vc_bill_log = addNote({
                    note: billFileNotes.join(' | ')
                });

                // create the bill file record
                var objRecord = ns_record.create({
                    type: 'customrecord_ctc_vc_bills',
                    isDynamic: true
                });

                for (var fieldId in billFileValues) {
                    objRecord.setValue({
                        fieldId: fieldId,
                        value: billFileValues[fieldId]
                    });
                }
                var record_id = objRecord.save();

                vc2_util.vcLog({
                    title: 'Bill File',
                    message: 'Created bill file |' + [record_id, billFileValues.name].join(' - '),
                    details: billFileValues,
                    status: LOG_STATUS.SUCCESS
                });

                vc2_util.log(logTitle, '>> Bill File created: ' + record_id);
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw error;
        }

        vc2_util.log(logTitle, '**** END process ****  ');

        return null;
    }

    function addNote(option) {
        var logTitle = [LogTitle, 'addNote'].join('::');

        vc2_util.log(logTitle, option);

        var billFileId = option.billFileId || option.billId || option.id,
            notes = option.note || option.notes || option.content,
            allNotes = option.all || option.allNotes || option.current || '';

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
        }

        // get the current notes
        if (billFileId) {
            var recData = ns_search.lookupFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                columns: ['custrecord_ctc_vc_bill_log']
            });
            allNotes = recData.custrecord_ctc_vc_bill_log;
        }
        if (notes) allNotes = allNotes + '\r\n' + moment().format('MM/DD/YYYY') + ' - ' + notes;

        // lets simplify ///
        // first, split up the notes by date, and make each an object
        var arrNotes = [];
        allNotes.split(/\r\n/).map(function (line) {
            if (arrNotes.indexOf(line) < 0) arrNotes.push(line);
            return true;
        });
        var newNoteStr = arrNotes.join('\r\n');

        if (billFileId) {
            // update
            ns_record.submitFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                values: {
                    custrecord_ctc_vc_bill_log: newNoteStr
                },
                options: {
                    ignoreMandatoryFields: true
                }
            });
        }

        return newNoteStr;
    }

    // Add the return statement that identifies the entry point function.
    return {
        mainConfig: MainConfig,
        process: process,
        addNote: addNote
    };
});
