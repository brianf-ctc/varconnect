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

    var vcs_configLib = require('./ctc_svclib_configlib'),
        vcs_recordLib = require('./ctc_svclib_records');

    var Current = {},
        ErrorMsg = {};

    var LibItemMatching = {
        matchOrderLines: function (option) {
            var logTitle = [LogTitle, 'matchOrderLines'].join('::'),
                returnValue;

            option = option || {};

            try {
                var vendorLines = option.vendorLines,
                    poId = option.poId,
                    poLines = option.poLines,
                    poRec = option.poRec,
                    orderId = option.orderId,
                    orderLines = option.orderLines || [],
                    orderType = option.orderType || ns_record.Type.PURCHASE_ORDER,
                    orderRecord = option.orderRecord || option.orderRec || option.record,
                    MainCFG = option.mainConfig || vcs_configLib.mainConfig() || {},
                    VendorCFG = option.vendorConfig;

                // PO record is a required parameter, since we need this to source out the PO lines
                if (!poRec) {
                    if (!poId) throw 'Missing required parameter: poId';
                    poRec = vcs_recordLib.load({ type: ns_record.Type.PURCHASE_ORDER, id: poId });
                    if (!poRec) throw 'Unable to load PO record';
                } else poId = poRec.id;

                // if a separet related order record is provided, load it
                // it can be a Sales Order, Fulfillment/Receipt or Invoice
                if (orderId && orderId != poId && orderType) {
                    orderRecord = vcs_recordLib.load({ type: orderType, id: orderId });
                } else if (orderRecord) {
                    orderId = orderRecord.id;
                    orderType = orderRecord.type;
                }

                // Load the Vendor Config, if not provided
                if (!VendorCFG) VendorCFG = vcs_configLib.vendorConfig({ poId: poId });

                // prep the required line fields
                var orderLineFields = [
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN,
                    vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO,
                    vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY,
                    VendorCFG.itemColumnIdToMatch || MainCFG.itemColumnIdToMatch || 'item',
                    VendorCFG.itemMPNColumnIdToMatch || MainCFG.itemMPNColumnIdToMatch || 'item'
                ];

                // The plan is use the poLines as anchor to match the vendorLines
                // then use the orderLines for matched lines
                var altPOLines;
                if (vc2_util.isEmpty(poLines))
                    poLines = vcs_recordLib.extractLineValues({
                        record: poRec,
                        additionalColumns: orderLineFields
                    });
                else
                    altPOLines = vcs_recordLib.extractLineValues({
                        record: poRec,
                        additionalColumns: orderLineFields
                    });

                if (vc2_util.isEmpty(orderLines) && orderRecord && orderId && orderId != poId)
                    orderLines = vcs_recordLib.extractLineValues({
                        record: orderRecord,
                        additionalColumns: orderLineFields
                    });

                //// START: MATCHING ORDER LINES ///////////////////////////////
                vc2_util.log(logTitle, '##### Match Order Lines #####', {
                    po: poId,
                    order: [orderId, orderType],
                    vendorLines: vendorLines
                });

                if (!vc2_util.isEmpty(altPOLines)) {
                    // link it to the poLines using the lineuniquekey

                    poLines.forEach(function (poLine) {
                        var matchedLine = altPOLines.filter(function (altPOLine) {
                            return altPOLine.lineuniquekey == poLine.lineuniquekey;
                        });
                        if (matchedLine.length) util.extend(poLine, matchedLine[0]);

                        return true;
                    });
                }

                // if there are order lines, merge it with the poLines
                if (!vc2_util.isEmpty(orderLines)) {
                    poLines.forEach(function (poLine) {
                        var matchedLine = orderLines.filter(function (orderLine) {
                            var returnValue;
                            // if from SO, match the item and quantity and rate

                            if (orderType == ns_record.Type.SALES_ORDER) {
                                returnValue =
                                    orderLine.item == poLine.item &&
                                    orderLine.quantity == poLine.quantity &&
                                    orderLine.rate == poLine.rate;
                            } else if (
                                orderType == ns_record.Type.ITEM_FULFILLMENT ||
                                orderType == ns_record.Type.ITEM_RECEIPT
                            ) {
                                returnValue = orderLine.poline == poLine.line;
                            }

                            return returnValue;
                        });
                        if (matchedLine.length) poLine.ORDERLINE = matchedLine[0];
                    });
                }

                // prep the orderLines and vendorLines
                // order it by quantity descending
                poLines.forEach(function (poLine) {
                    poLine.AVAILQTY =
                        poLine.AVAILQTY || !vc2_util.isEmpty(poLine.quantityreceived)
                            ? poLine.quantity - poLine.quantityreceived
                            : !vc2_util.isEmpty(poLine.quantityfulfilled)
                            ? poLine.quantity - poLine.quantityfulfilled
                            : poLine.quantity;

                    poLine.APPLIEDQTY = 0;
                    if (!poLine.APPLIEDRATE) poLine.APPLIEDRATE = poLine.rate || poLine.unitprice;
                    poLine.UseQuantity = function (qty) {
                        this.APPLIEDQTY += qty;
                        this.AVAILQTY -= qty;
                        return { APPLIEDQTY: qty };
                    };
                });
                //sort the orderLines by AVAILQTY descending
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

                /// =====================================
                /// LOOP thru each vendorLines
                vendorLines.forEach(function (vendorLine) {
                    // first step, is to look for matching items
                    // availabe in the orderLines
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
                                    orderLines: orderLines,
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
                                    orderLines: orderLines
                                })
                            });
                        });
                    }

                    // if there's still no match, skip the vendorLine
                    if (!MatchedLines.byItem.length) return;

                    // filter the orderLines that would fit the vendorLine AVAILQTY
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
                        var poLine = poLine, // get the first item
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(poLine, appliedLine));
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

                var altItemNames = listAltNames[poLine.item];

                /// try to match the items
                var isMatched = false;

                if (MainCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = MainCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(altItemNames[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(altItemNames[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME
                          ]);
                }
                // Check if VendorCFG itemFieldIdToMatch is defined and poLine has the corresponding value
                if (!isMatched && VendorCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = VendorCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(altItemNames[VendorCFG.itemFieldIdToMatch], [
                              vendorLine.ITEMNAME,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(altItemNames[VendorCFG.itemFieldIdToMatch], [
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
                if (!option.itemIds && !option.orderLines)
                    throw 'Missing required parameter: itemIds or orderLines';

                var ItemMapREC = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;

                var itemIds =
                    option.itemIds ||
                    option.orderLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds)) throw 'No itemIds found';

                var currentMappedItems =
                    Current.MAPPED_ITEMS ||
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
                Current.MAPPED_ITEMS = currentMappedItems;

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
                if (!option.itemIds && !option.orderLines)
                    throw 'Missing required parameter: itemIds or orderLines';

                var MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var itemIds =
                    option.itemIds ||
                    option.orderLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds)) throw 'No itemIds found';

                // Check All the Missing Items from CACHE
                var currentAltNames =
                    Current.ALTNAMES ||
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
