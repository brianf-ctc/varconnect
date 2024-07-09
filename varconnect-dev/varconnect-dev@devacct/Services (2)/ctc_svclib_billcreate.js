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
    const LogTitle = 'SVC:BillCreate',
        LOG_APP = 'BillCreator';

    var vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js'),
        vc_mainCfg = require('./../CTC_VC_Lib_MainConfiguration'),
        vcs_records = require('./ctc_svclib_records.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_error = require('N/error');

    var fuse = require('./lib/fuse.js');

    const BILLFILE = vc2_constant.RECORD.BILLFILE;

    var MainConfig,
        Helper = {
            loadMainConfig: function () {
                var logTitle = [LogTitle, 'loadMainConfig'].join('::');

                if (!MainConfig) {
                    MainConfig = vc_mainCfg.getMainConfiguration();
                    if (!MainConfig) {
                        log.error(logTitle, 'No Configuration available');
                    }
                }
                return MainConfig;
            },
            searchPO: function (option) {
                var logTitle = [LogTitle, 'searchPO'].join('::'),
                    returnValue;

                Helper.loadMainConfig();

                var poId = option.poId || option.po,
                    poNum = option.poNum || option.ponum;

                if (!poId && !poNum) throw 'Missing PO Identifier';

                var searchObj = ns_search.create({
                    type: 'purchaseorder',
                    filters: [
                        poId
                            ? ['internalid', 'anyof', poId]
                            : MainConfig.overridePONum
                            ? [['numbertext', 'is', poNum], 'OR', ['custbody_ctc_vc_override_ponum', 'is', poNum]]
                            : ['numbertext', 'is', poNum],
                        'AND',
                        ['mainline', 'is', 'T'],
                        'AND',
                        ['type', 'anyof', 'PurchOrd']
                    ],
                    columns: [
                        'trandate',
                        'postingperiod',
                        'type',
                        MainConfig.overridePONum ? 'custbody_ctc_vc_override_ponum' : 'tranid',
                        'tranid',
                        'entity',
                        'amount',
                        'internalid'
                    ]
                });

                var poData = false;
                if (searchObj.runPaged().count) {
                    var searchResult = searchObj.run().getRange({ start: 0, end: 1 }).shift();

                    poData = {
                        id: searchResult.getValue({ name: 'internalid' }),
                        entityId: searchResult.getValue({ name: 'entity' }),
                        tranId: searchResult.getValue({ name: 'tranid' }),
                        date: searchResult.getValue({ name: 'trandate' })
                    };
                }
                returnValue = poData;

                return returnValue;
            },
            collectItemsFromPO: function (option) {
                var logTitle = [LogTitle, 'collectItemsFromPO'],
                    returnValue = [];

                if (!option.poId) return false;

                var itemSearch = ns_search.create({
                    type: 'transaction',
                    filters: [['internalid', 'anyof', option.poId], 'AND', ['mainline', 'is', 'F']],
                    columns: [
                        ns_search.createColumn({
                            name: 'item',
                            summary: 'GROUP'
                        })
                    ]
                });

                var arrSKUs = [],
                    arrPOItems = [];
                itemSearch.run().each(function (result) {
                    var skuData = {
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
                        })
                    };
                    arrSKUs.push(skuData);

                    if (!vc2_util.inArray(skuData.value, arrPOItems)) arrPOItems.push(skuData.value);

                    return true;
                });

                // extract the vendor item names
                var arrSKUVendorNames = Helper.extractVendorItemNames(arrPOItems);

                if (arrSKUVendorNames && !vc2_util.isEmpty(arrSKUVendorNames)) {
                    var skuMapKey = vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY;
                    arrSKUs.forEach(function (skuData) {
                        if (arrSKUVendorNames[skuData.value] && !vc2_util.isEmpty(arrSKUVendorNames[skuData.value])) {
                            skuData[skuMapKey] = arrSKUVendorNames[skuData.value];
                        }

                        return true;
                    });
                }

                returnValue = arrSKUs;
                return returnValue;
            },
            extractVendorItemNames: function (option) {
                var logTitle = [LogTitle, 'extractVendorItemNames'].join('::'),
                    returnValue,
                    arrItemList = option.lines || option;

                try {
                    var GlobalVar = vc2_constant.GLOBAL,
                        ItemMapRecordVar = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;

                    if (!arrItemList || !arrItemList.length) throw 'Missing line item list';

                    var uniqueItemIds = vc2_util.uniqueArray(arrItemList);
                    if (!uniqueItemIds.length) throw 'Missing line item lists';

                    vc2_util.log(logTitle, 'Lookup items for assigned vendor names... ', uniqueItemIds);

                    /// SEARCH for Mapped Vendor Items
                    var searchResults = vc2_util.searchAllPaged({
                        type: ItemMapRecordVar.ID,
                        filterExpression: [
                            [ItemMapRecordVar.FIELD.ITEM, 'anyof', uniqueItemIds],
                            'and',
                            ['isinactive', 'is', 'F']
                        ],
                        columns: [ItemMapRecordVar.FIELD.NAME, ItemMapRecordVar.FIELD.ITEM]
                    });
                    if (!searchResults || !searchResults.length) throw 'No vendor item mapped for items';

                    var vendorItemMap = {};
                    searchResults.forEach(function (result) {
                        var vendorItemName = result.getValue({ name: ItemMapRecordVar.FIELD.NAME }),
                            item = result.getValue({ name: ItemMapRecordVar.FIELD.ITEM });

                        if (!vendorItemMap[item]) vendorItemMap[item] = [];
                        vendorItemMap[item].push(vendorItemName);
                        return true;
                    });

                    returnValue = vendorItemMap;
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                    returnValue = false;

                    // throw ns_error.create({
                    //     name: 'Unable to extract vendor item names',
                    //     message: vc2_util.extractError(error)
                    // });
                }
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
                } catch (error) {
                    vc2_util.logError(logTitle, error);
                    returnValue = false;
                }

                return returnValue;
            },
            loadBillFileData: function (option) {
                var logTitle = [LogTitle, 'Helper.loadBillFileData'].join('::'),
                    returnValue;

                var billFileId = option.billFileId || option.billId;

                if (!billFileId) throw 'Missing Bill File ID';

                var searchOption = {
                    type: BILLFILE.ID,
                    filters: [['internalid', 'anyof', billFileId]],
                    columns: (function (bFields) {
                        var cols = [];
                        for (var fld in bFields) cols.push(bFields[fld]);
                        return cols;
                    })(BILLFILE.FIELD)
                };
                var billFileSearch = ns_search.create(searchOption),
                    billFileValues = {};

                if (!billFileSearch) throw 'BillFile record not found - ' + billFileId;

                billFileSearch.run().each(function (row) {
                    for (var fld in BILLFILE.FIELD) {
                        var fldname = BILLFILE.FIELD[fld];
                        var value = row.getValue({ name: fldname }),
                            text = row.getText({ name: fldname });

                        billFileValues[fld] = value && text && value !== text ? { text: text, value: value } : value;
                    }
                    return true;
                });

                return billFileValues;
            }
        };

    return {
        addProcessLog: function (option) {
            var logTitle = [LogTitle, 'addProcessLog'].join('::'),
                returnValue = {};

            // get bill file data
            var billFileValues = option.billFileData || option.billFile,
                billFileLogs = option.billFileLogs || option.processingLogs,
                billFileId = option.billFileId || option.billId;

            if (!billFileLogs) {
                billFileLogs =
                    (billFileValues && util.isObject(billFileValues)
                        ? billFileValues[BILLFILE.FLD.PROCESS_LOG] || billFileValues.PROCESS_LOG
                        : false) ||
                    // try to lookup the processing logs
                    (billFileId
                        ? (function () {
                              var billfileData = vc2_util.flatLookup({
                                  type: BILLFILE.ID,
                                  id: billFileId,
                                  columns: [BILLFILE.FLD.PROCESS_LOG]
                              });
                              return billfileData[BILLFILE.FLD.PROCESS_LOG];
                          })()
                        : false);

                if (!billFileLogs) throw 'Missing existing bill file logs';
            }

            return returnValue;
        },
        linkPOItems: function (option) {
            var logTitle = [LogTitle, 'linkPOItems'].join('::'),
                returnValue = {};

            try {
                // try {
                var poId = option.poId || option.po,
                    poNum = option.poNum,
                    billFileId = option.billfileId || option.billFile;

                if (!billFileId) throw 'Missing Paramter: billFileId';

                //load the bill file record
                var billFileREC = ns_record.load({
                    type: BILLFILE.ID,
                    id: billFileId
                });
                if (!billFileId) throw 'Missing Bill File Record: (id: $billFileId)';

                var billFileValues = {
                    JSON: billFileREC.getValue({ fieldId: BILLFILE.FIELD.JSON }),
                    PO_NUM: billFileREC.getValue({ fieldId: BILLFILE.FIELD.POID }),
                    PO_LINK: billFileREC.getValue({ fieldId: BILLFILE.FIELD.PO_LINK })
                };
                billFileValues.DATA = vc2_util.safeParse(billFileValues.JSON);

                if (!poId || !poNum) {
                    poId = billFileValues.PO_NUM;
                    poId = billFileValues.PO_LINK;
                }

                var updateValues = {};

                var poData = Helper.searchPO({ poId: poId, poNum: poNum });
                vc2_util.log(logTitle, '// PO Data: ', poData);

                if (!poId && poNum) throw 'Unable to retrieve PO Link';

                // load vendor config
                // var VendorCFG = Helper.loadVendorConfig({ entity: poData.entityId });
                // if (VendorCFG.ENABLE_FULFILLLMENT)
                //     updateValues[BILLFILE.FIELD.IS_RCVBLE] = true;

                // load all PO Items
                var listItemsPO = Helper.collectItemsFromPO({ poId: poData.id });
                vc2_util.log(logTitle, '>> Item from PO: ', listItemsPO);

                var keyVendorSKUMap = vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY;

                // register the po items
                for (var i = 0, j = billFileValues.DATA.lines.length; i < j; i++) {
                    var itemLine = billFileValues.DATA.lines[i];

                    // search filter
                    var filterVendorName = {};
                    filterVendorName[keyVendorSKUMap] = function (values) {
                        vc2_util.log('XXXX FILTER XXXXX', 'values? ', [values, itemLine.ITEMNO]);
                        return vc2_util.inArray(itemLine.ITEMNO, values);
                    };
                    vc2_util.log(logTitle, '.... filters: ', [itemLine, filterVendorName]);

                    var matchingItem =
                        vc2_util.findMatching({
                            list: listItemsPO,
                            filter: { itemNum: itemLine.ITEMNO }
                        }) ||
                        vc2_util.findMatching({
                            list: listItemsPO,
                            filter: filterVendorName
                        });

                    vc2_util.log(logTitle, '... matching ? ', matchingItem);

                    if (
                        matchingItem &&
                        matchingItem.value &&
                        (!itemLine.NSITEM || itemLine.NSITEM != matchingItem.value)
                    ) {
                        // if there's an existing NSITEM
                        if (itemLine.NSITEM) {
                            if (!itemLine.NSITEM_ORIG || itemLine.NSITEM_ORIG != itemLine.NSITEM) {
                                itemLine.NSITEM_ORIG = itemLine.NSITEM;
                            }
                        }
                        // set the new item
                        itemLine.NSITEM = matchingItem.value;
                    }
                }

                var billFileDataJSON = JSON.stringify(billFileValues.DATA);

                if (billFileDataJSON != billFileValues.JSON) updateValues[BILLFILE.FIELD.JSON] = billFileDataJSON;

                // updateValues[BILLFILE.FIELD.JSON] = ;

                // try to update if there are changes
                if (!vc2_util.isEmpty(updateValues)) {
                    returnValue.updateValues = updateValues;
                    ns_record.submitFields({
                        type: BILLFILE.ID,
                        id: billFileId,
                        values: updateValues
                    });
                } else {
                    returnValue.status = 'no-change';
                }
            } catch (error) {
                throw ns_error.create({
                    name: 'Link PO Items Error',
                    message: vc2_util.extractError(error)
                });
            }

            return returnValue;
        }
    };
});
