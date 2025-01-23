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
    var LogTitle = 'SVC:ItemMatching',
        LOG_APP = 'VCProcess';

    var ns_search = require('N/search'),
        ns_record = require('N/record');

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var vcs_configLib = require('./ctc_svclib_config'),
        vcs_recordLib = require('./ctc_svclib_records');

    var LibItemMatching = {
        matchOrderLines: function (option) {
            var logTitle = [LogTitle, 'matchOrderLines'].join('::'),
                returnValue;

            option = option || {};

            try {
                if (!option.poId) throw 'Missing required parameter: poId';
                if (!option.vendorLines) throw 'Missing required parameter: vendorLines';

                var vendorLines = option.vendorLines,
                    poId = option.poId,
                    MainCFG = option.mainConfig || vcs_configLib.mainConfig() || {},
                    VendorCFG =
                        option.vendorConfig || vcs_configLib.vendorConfig({ poId: poId }) || {};

                var poRecord = vcs_recordLib.load({
                    type: ns_record.Type.PURCHASE_ORDER,
                    id: poId
                });
                var poLines = vcs_recordLib.extractLineValues({
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
                            return LibItemMatching.isItemMatched({
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
                            return LibItemMatching.isItemAltMatched({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listAltNames: LibItemMatching.fetchItemAltNames({
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
                            return LibItemMatching.isItemMapped({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listMappedItems: LibItemMatching.fetchItemMapping({
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
        isItemAltMatched: function (option) {
            // try to match the item alt names
            var logTitle = [LogTitle, 'isItemAltMatched'].join('::'),
                returnValue;
            option = option || {};

            try {
                if (!option.poLine) throw 'Missing required parameter: poLine';
                if (!option.vendorLine) throw 'Missing required parameter: vendorLine';

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listAltNames = option.listAltNames,
                    MainCFG = option.mainConfig || vcs_configLib.mainConfig() || {},
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
            option = option || {};

            try {
                if (!option.poLine) throw 'Missing required parameter: poLine';
                if (!option.vendorLine) throw 'Missing required parameter: vendorLine';

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listMappedItems = option.listMappedItems;

                if (!listMappedItems || !listMappedItems[poLine.item])
                    throw 'No mapped names found';

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
                    value: currentMappedItems
                });
                CURRENT.MAPPED_ITEMS = currentMappedItems;

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
                    value: currentAltNames
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

    return LibItemMatching;
});
