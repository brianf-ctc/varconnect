/**
 * Copyright (c) 2025 NS Catalyst Tech Corp
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
    /**
     * Item Matching Service Module Usage:
     *
     * 1. Match Order Lines:
     *    matchOrderLines({
     *      poId: <string>,          // Purchase Order ID
     *      vendorLines: [{          // Array of vendor line items
     *        ITEM_TEXT: <string>,    // Item name/number from vendor
     *        SKUNAME: <string>,     // SKU from vendor
     *        MPNNAME: <string>,     // MPN from vendor
     *        QUANTITY: <number>,    // Quantity from vendor
     *        SERIALS: <string[]>    // Array of serial numbers
     *      }],
     *      mainConfig: {},          // Main configuration object
     *      vendorConfig: {}         // Vendor-specific configuration
     *    })
     *
     * 2. Check Item Match:
     *    isItemMatched({
     *      poLine: {},             // PO line item
     *      vendorLine: {},         // Vendor line item
     *      mainConfig: {},         // Main configuration
     *      vendorConfig: {}        // Vendor configuration
     *    })
     *
     * 3. Check Alternative Names Match:
     *    isItemAltMatched({
     *      poLine: {},             // PO line item
     *      vendorLine: {},         // Vendor line item
     *      listAltNames: {},       // Alternative names mapping
     *      mainConfig: {},         // Main configuration
     *      vendorConfig: {}        // Vendor configuration
     *    })
     *
     * 4. Fetch Item Mappings:
     *    fetchItemMapping({
     *      itemIds: <string[]>,    // Array of item IDs
     *      orderLines: []          // Array of order lines
     *    })
     *
     */
    var LogTitle = 'SVC:ItemMatching',
        LOG_APP = 'VCProcess';

    var ns_search = require('N/search'),
        ns_record = require('N/record');

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js'),
        vclib_error = require('./lib/ctc_lib_errors.js');

    var vcs_configLib = require('./ctc_svclib_configlib'),
        vcs_recordLib = require('./ctc_svclib_records');

    var Current = {};

    var ERROR_MSG = {
        NO_ALT_NAMES: {
            code: 'NO_ALT_NAMES',
            message: 'No alternative names found for item'
        },
        NO_MAPPED_NAMES: {
            code: 'NO_MAPPED_NAMES',
            message: 'No mapped names found for item'
        },
        MISSING_PARAMETER: {
            code: 'MISSING_PARAMETER',
            message: 'Missing required parameter: {details}'
        },
        LOAD_ERROR: {
            code: 'LOAD_ERROR',
            message: 'Error loading record: {details}'
        },
        NO_MAPPED_NAMES_TO_FETCH: {
            code: 'NO_MAPPED_NAMES_TO_FETCH',
            message: 'No mapped names available to fetch'
        }
    };

    /**
     * Library for matching vendor lines with purchase order lines using various strategies
     * @namespace
     * @property {function} matchOrderLines - Matches vendor lines with PO lines using multiple matching strategies
     * @property {function} isItemMatched - Checks direct item matches between PO and vendor lines
     * @property {function} isItemAltMatched - Checks matches using alternative item names
     * @property {function} isItemMapped - Checks matches using vendor item mapping records
     * @property {function} fetchItemMapping - Retrieves item mappings from vendor item mapping records
     * @property {function} fetchItemAltNames - Retrieves alternative item names from item records
     *
     * @example
     * // Match vendor lines with PO lines
     * var result = LibItemMatching.matchOrderLines({
     *     vendorLines: vendorLineItems,
     *     poId: purchaseOrderId,
     *     poLines: purchaseOrderLines,
     *     poRec: purchaseOrderRecord,
     *     mainConfig: mainConfiguration,
     *     vendorConfig: vendorConfiguration
     * });
     *
     * // Check if items match directly
     * var isMatched = LibItemMatching.isItemMatched({
     *     poLine: purchaseOrderLine,
     *     vendorLine: vendorLineItem,
     *     mainConfig: mainConfiguration,
     *     vendorConfig: vendorConfiguration
     * });
     *
     * // Get item mappings
     * var mappings = LibItemMatching.fetchItemMapping({
     *     itemIds: ['123', '456'],
     *     orderLines: orderLineItems
     * });
     */
    var LibItemMatching = {
        // Match vendor lines with PO lines using various matching strategies
        matchOrderLines: function (option) {
            var logTitle = [LogTitle, 'matchOrderLines'].join('::'),
                returnValue;

            option = option || {};

            try {
                // Extract and normalize input parameters
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

                // Load PO record if not provided
                if (!poRec) {
                    if (!poId) throw { code: 'MISSING_PARAMETER', details: 'poId' };
                    poRec = vcs_recordLib.load({ type: ns_record.Type.PURCHASE_ORDER, id: poId });
                    if (!poRec) throw { code: 'LOAD_ERROR', details: 'poId:' + poId };
                } else poId = poRec.id;

                // Load related order record if provided (SO, Fulfillment, or Invoice)
                if (orderId && orderId != poId && orderType) {
                    orderRecord = vcs_recordLib.load({ type: orderType, id: orderId });
                } else if (orderRecord) {
                    orderId = orderRecord.id;
                    orderType = orderRecord.type;
                }

                // Load vendor config if not provided
                if (!VendorCFG) VendorCFG = vcs_configLib.vendorConfig({ poId: poId });

                // Define required line item fields for extraction
                var orderLineFields = [
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN,
                    vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO,
                    vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY,
                    VendorCFG.itemColumnIdToMatch || MainCFG.itemColumnIdToMatch || 'item',
                    VendorCFG.itemMPNColumnIdToMatch || MainCFG.itemMPNColumnIdToMatch || 'item'
                ];

                // Extract PO lines if not provided
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

                // Extract order lines if not provided and order record exists
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

                // Link alternative PO lines using lineuniquekey if they exist
                if (!vc2_util.isEmpty(altPOLines)) {
                    poLines.forEach(function (poLine) {
                        var matchedLine = altPOLines.filter(function (altPOLine) {
                            return altPOLine.lineuniquekey == poLine.lineuniquekey;
                        });
                        if (matchedLine.length) util.extend(poLine, matchedLine[0]);
                        return true;
                    });
                }

                // Merge order lines with PO lines if they exist
                if (!vc2_util.isEmpty(orderLines)) {
                    poLines.forEach(function (poLine) {
                        var matchedLine = orderLines.filter(function (orderLine) {
                            var returnValue;
                            // Match criteria varies by order type
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
                            } else if (orderType == ns_record.Type.PURCHASE_ORDER) {
                                returnValue = orderLine.line == poLine.line;
                            }
                            return returnValue;
                        });
                        if (matchedLine.length) poLine.ORDERLINE = matchedLine[0];
                    });
                }

                // Prepare PO lines - calculate available quantities and add utility methods
                poLines.forEach(function (poLine) {
                    // Calculate available quantity based on received/fulfilled quantity
                    if (vc2_util.isEmpty(poLine.AVAILQTY)) {
                        // Default to full quantity
                        poLine.AVAILQTY = poLine.quantity;

                        // If quantity received exists, subtract from total quantity
                        if (!vc2_util.isEmpty(poLine.quantityreceived)) {
                            poLine.AVAILQTY = poLine.quantity - poLine.quantityreceived;
                        }
                        // Otherwise if quantity fulfilled exists, subtract from total quantity
                        else if (!vc2_util.isEmpty(poLine.quantityfulfilled)) {
                            poLine.AVAILQTY = poLine.quantity - poLine.quantityfulfilled;
                        }
                    }

                    if (vc2_util.isEmpty(poLine.APPLIEDRATE))
                        poLine.APPLIEDRATE = poLine.rate || poLine.unitprice;

                    poLine.APPLIEDQTY = 0;
                    // Add utility method for quantity tracking
                    poLine.UseQuantity = function (qty) {
                        this.APPLIEDQTY += qty;
                        this.AVAILQTY -= qty;
                        return { APPLIEDQTY: qty };
                    };
                });

                // Sort PO lines by available quantity descending
                poLines.sort(function (a, b) {
                    return b.AVAILQTY - a.AVAILQTY;
                });

                // Prepare vendor lines - normalize quantities and add utility methods
                vendorLines.forEach(function (vendorLine) {
                    vendorLine.APPLIEDQTY = 0;
                    vendorLine.MATCHING = [];
                    vendorLine.HAS_MATCH = false;
                    vendorLine.MATCHED_BY = null;

                    vendorLine.AVAILQTY = vc2_util.forceInt(
                        vendorLine.QUANTITY || vendorLine.ship_qty || vendorLine.quantity
                    );
                    vendorLine.QUANTITY = vendorLine.AVAILQTY;
                    if (!vendorLine.APPLIEDRATE)
                        vendorLine.APPLIEDRATE = vc2_util.forceFloat(
                            vendorLine.unitprice || vendorLine.line_price
                        );

                    // Process serial numbers if present
                    if (vendorLine.SERIALS) {
                        if (util.isString(vendorLine.SERIALS))
                            vendorLine.SERIALS = vendorLine.SERIALS.split(',');
                        vendorLine.SERIALS.sort();
                    }

                    // Add utility method for quantity and serial tracking
                    vendorLine.UseQuantity = function (qty) {
                        var returnValue = {};
                        this.APPLIEDQTY += qty;
                        this.AVAILQTY -= qty;
                        returnValue.APPLIEDQTY = qty;

                        if (this.SERIALS) {
                            returnValue.APPLIEDSERIALS = this.SERIALS.slice(0, qty);
                            this.SERIALS = this.SERIALS.slice(qty);
                        }

                        return returnValue;
                    };
                });

                // Sort vendor lines by available quantity descending
                vendorLines.sort(function (a, b) {
                    return b.AVAILQTY - a.AVAILQTY;
                });

                /// Match vendor lines with PO lines
                vendorLines.forEach(function (vendorLine) {
                    /// ITEM MATCHING //////
                    // Try different matching strategies
                    var MatchedLines = {
                        // Try direct item matching first
                        byItem: poLines.filter(function (poLine) {
                            return LibItemMatching.isItemMatched({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                mainConfig: MainCFG,
                                vendorConfig: VendorCFG
                            });
                        })
                    };

                    // If no direct matches, try alternative names
                    if (!MatchedLines.byItem.length) {
                        var listItemAltNames = LibItemMatching.fetchItemAltNames({
                            orderLines: orderLines,
                            mainConfig: MainCFG,
                            vendorConfig: VendorCFG
                        });

                        MatchedLines.byItem = poLines.filter(function (poLine) {
                            return LibItemMatching.isItemAltMatched({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listAltNames: listItemAltNames,
                                mainConfig: MainCFG,
                                vendorConfig: VendorCFG
                            });
                        });
                    }

                    // If still no matches, try item mappings
                    if (!MatchedLines.byItem.length) {
                        var listMappedItems = LibItemMatching.fetchItemMapping({
                            orderLines: orderLines
                        });
                        MatchedLines.byItem = poLines.filter(function (poLine) {
                            return LibItemMatching.isItemMapped({
                                poLine: poLine,
                                vendorLine: vendorLine,
                                listMappedItems: listMappedItems
                            });
                        });
                    }
                    ///////////////////////////

                    // Skip if no matches found
                    if (!MatchedLines.byItem.length) return;

                    // Further filter matches by rate and quantity
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

                    // Process exact matches first (matching rate and quantity)
                    if (MatchedLines.byRateQty.length) {
                        var matchedLine = MatchedLines.byRateQty[0],
                            appliedLine = vendorLine.UseQuantity(matchedLine.AVAILQTY);

                        vendorLine.MATCHING.push(vc2_util.extend(matchedLine, appliedLine));
                        matchedLine.UseQuantity(appliedLine.APPLIEDQTY);
                        return true;
                    }

                    // Process rate matches
                    MatchedLines.byRate.forEach(function (poLine) {
                        if (!poLine.AVAILQTY || !vendorLine.AVAILQTY) return;

                        var qty = Math.min(poLine.AVAILQTY, vendorLine.AVAILQTY),
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(poLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    // Process quantity matches
                    MatchedLines.byQty.forEach(function (poLine) {
                        if (!poLine.AVAILQTY || !vendorLine.AVAILQTY) return;

                        var qty = Math.min(poLine.AVAILQTY, vendorLine.AVAILQTY),
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(poLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    // Process remaining item matches
                    MatchedLines.byItem.forEach(function (poLine) {
                        if (!poLine.AVAILQTY || !vendorLine.AVAILQTY) return;

                        var qty = Math.min(poLine.AVAILQTY, vendorLine.AVAILQTY),
                            appliedLine = vendorLine.UseQuantity(qty);

                        vendorLine.MATCHING.push(vc2_util.extend(poLine, appliedLine));
                        poLine.UseQuantity(appliedLine.APPLIEDQTY);
                    });

                    vc2_util.log(logTitle, 'Matched Line: ', MatchedLines);
                });

                // Sort vendor lines by line number
                vendorLines.sort(function (a, b) {
                    return a.line - b.line;
                });

                returnValue = vendorLines;
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Check if a PO line item matches a vendor line item using direct comparison
        isItemMatched: function (option) {
            var logTitle = [LogTitle, 'isItemMatched'].join('::'),
                returnValue;

            try {
                // Validate required parameters
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                if (!option.poLine) throw { code: 'MISSING_PARAMETER', details: 'poLine' };
                if (!option.vendorLine) throw { code: 'MISSING_PARAMETER', details: 'vendorLine' };

                // Extract input parameters
                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var VendorList = vc2_constant.LIST.XML_VENDOR,
                    GlobalVar = vc2_constant.GLOBAL;

                // Determine vendor-specific settings
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

                // Normalize PO line item values for comparison
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

                // Define matching strategies
                returnValue = false;
                var matchCondition = {
                    // Basic item matching - checks if vendor item/MPN/SKU matches PO item name or SKU
                    ITEM: function () {
                        // Check if vendor item name matches PO item name or SKU
                        return (
                            // Match vendor item name against PO name/SKU
                            (vendorLine.ITEM_TEXT &&
                                vc2_util.inArray(vendorLine.ITEM_TEXT, [
                                    poItem.name,
                                    poItem.skuValue
                                ])) ||
                            // Match vendor MPN against PO name/SKU
                            (vendorLine.MPNNAME &&
                                vc2_util.inArray(vendorLine.MPNNAME, [
                                    poItem.name,
                                    poItem.skuValue
                                ])) ||
                            // Match vendor SKU against PO name/SKU
                            (vendorLine.SKUNAME &&
                                vc2_util.inArray(vendorLine.SKUNAME, [
                                    poItem.name,
                                    poItem.skuValue
                                ]))
                        );
                    },
                    // Alternative item matching using configured columns
                    ALTITEM_COL: function () {
                        var isMatched = false;

                        // Try main config matching first
                        if (MainCFG.itemColumnIdToMatch && poLine[MainCFG.itemColumnIdToMatch]) {
                            isMatched = MainCFG.matchItemToPartNumber
                                ? vc2_util.inArray(poLine[MainCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEM_TEXT,
                                      vendorLine.SKUNAME
                                  ])
                                : vc2_util.inArray(poLine[MainCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEM_TEXT,
                                      vendorLine.SKUNAME,
                                      vendorLine.MPNNAME
                                  ]);
                        }
                        // Then try vendor config matching
                        else if (
                            VendorCFG.itemColumnIdToMatch &&
                            poLine[VendorCFG.itemColumnIdToMatch]
                        ) {
                            isMatched = VendorCFG.matchItemToPartNumber
                                ? vc2_util.inArray(poLine[VendorCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEM_TEXT,
                                      vendorLine.SKUNAME
                                  ])
                                : vc2_util.inArray(poLine[VendorCFG.itemColumnIdToMatch], [
                                      vendorLine.ITEM_TEXT,
                                      vendorLine.SKUNAME,
                                      vendorLine.MPNNAME
                                  ]);
                        }

                        return isMatched;
                    },
                    // D&H specific matching
                    DNH_ITEM: function () {
                        return (
                            settings.isDandH &&
                            poItem.dnhValue &&
                            vc2_util.inArray(poItem.dnhValue, [
                                vendorLine.ITEM_TEXT,
                                vendorLine.SKUNAME,
                                vendorLine.MPNNAME
                            ])
                        );
                    },
                    // Dell specific matching
                    DELL_ITEM: function () {
                        return (
                            settings.isDell &&
                            poItem.dellQuoteNo &&
                            vc2_util.inArray(poItem.dellQuoteNo, [
                                vendorLine.ITEM_TEXT,
                                vendorLine.SKUNAME,
                                vendorLine.MPNNAME
                            ])
                        );
                    }
                };

                // Try each matching strategy in sequence
                for (var key in matchCondition) {
                    var result = matchCondition[key].call();
                    if (result) {
                        vendorLine.MATCHED_BY = key;
                        vendorLine.HAS_MATCH = true;
                        returnValue = key;
                        break;
                    }
                }

                vc2_util.log(logTitle, '*** Item matched: ', [
                    returnValue,
                    poItem,
                    vc2_util.extractValues({
                        source: vendorLine,
                        fields: ['ITEM_TEXT', 'SKU', 'itemId']
                    })
                ]);
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Check if items match using alternative names from item records
        isItemAltMatched: function (option) {
            var logTitle = [LogTitle, 'isItemAltMatched'].join('::'),
                returnValue;
            option = option || {};

            try {
                // Validate required parameters
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                if (!option.poLine) throw { code: 'MISSING_PARAMETER', details: 'poLine' };
                if (!option.vendorLine) throw { code: 'MISSING_PARAMETER', details: 'vendorLine' };

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listAltNames = option.listAltNames,
                    MainCFG = option.mainConfig || vcs_configLib.mainConfig() || {},
                    VendorCFG = option.vendorConfig || {};

                // Ensure alternative names exist for the item
                if (!listAltNames || !listAltNames[poLine.item])
                    throw { code: 'NO_ALT_NAMES', detail: poLine.item };

                var altItemNames = listAltNames[poLine.item];
                var isMatched = false;

                // Try matching using main config field first
                if (MainCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = MainCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(altItemNames[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEM_TEXT,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(altItemNames[MainCFG.itemFieldIdToMatch], [
                              vendorLine.ITEM_TEXT,
                              vendorLine.SKUNAME
                          ]);
                }

                // If no match, try vendor config field
                if (!isMatched && VendorCFG.itemFieldIdToMatch && listAltNames[poLine.item]) {
                    isMatched = VendorCFG.matchMPNWithPartNumber
                        ? vc2_util.inArray(altItemNames[VendorCFG.itemFieldIdToMatch], [
                              vendorLine.ITEM_TEXT,
                              vendorLine.SKUNAME,
                              vendorLine.MPNNAME
                          ])
                        : vc2_util.inArray(altItemNames[VendorCFG.itemFieldIdToMatch], [
                              vendorLine.ITEM_TEXT,
                              vendorLine.SKUNAME
                          ]);
                }

                // Update vendor line if matched
                if (isMatched) {
                    vendorLine.MATCHED_BY = 'ALTITEM_REC';
                    vendorLine.HAS_MATCH = true;
                }

                returnValue = isMatched;
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Check if a PO line item matches a vendor line item using mapped items
        isItemMapped: function (option) {
            // try to match the item alt names
            var logTitle = [LogTitle, 'isItemMapped'].join('::'),
                returnValue;
            option = option || {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                if (!option.poLine) throw { code: 'MISSING_PARAMETER', details: 'poLine' };
                if (!option.vendorLine) throw { code: 'MISSING_PARAMETER', details: 'vendorLine' };

                var poLine = option.poLine,
                    vendorLine = option.vendorLine,
                    listMappedItems = option.listMappedItems;

                if (!listMappedItems || !listMappedItems[poLine.item])
                    throw { code: 'NO_MAPPED_NAMES', detail: poLine.item };

                /// try to match the items
                var isMatched = false;

                listMappedItems[poLine.item].forEach(function (mappedItem) {
                    if (isMatched) return;
                    isMatched = vc2_util.inArray(mappedItem, [
                        vendorLine.ITEM_TEXT,
                        vendorLine.SKUNAME,
                        vendorLine.MPNNAME
                    ]);
                });

                if (isMatched) {
                    vendorLine.MATCHED_BY = 'MAPPING';
                    vendorLine.HAS_MATCH = true;
                }
                returnValue = isMatched;
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Fetch item mappings from the vendor item mapping record
        fetchItemMapping: function (option) {
            var logTitle = [LogTitle, 'fetchItemMapping'].join('::'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                if (!option.itemIds && !option.orderLines)
                    throw { code: 'MISSING_PARAMETER', details: 'itemIds or orderLines' };

                var ItemMapREC = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;

                var itemIds =
                    option.itemIds ||
                    option.orderLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds))
                    throw { code: 'MISSING_PARAMETER', details: 'No itemIds found' };

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
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Fetch alternative item names from item records
        fetchItemAltNames: function (option) {
            var logTitle = [LogTitle, 'fetchItemAltNames'].join('::'),
                returnValue;
            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                if (!option.itemIds && !option.orderLines)
                    throw { code: 'MISSING_PARAMETER', details: 'itemIds or orderLines' };

                var MainCFG = option.mainConfig || {},
                    VendorCFG = option.vendorConfig || {};

                var itemIds =
                    option.itemIds ||
                    option.orderLines.map(function (line) {
                        return line.item;
                    });

                if (vc2_util.isEmpty(itemIds))
                    throw { code: 'MISSING_PARAMETER', details: 'No itemIds found' };

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
                if (!searchOption.columns.length)
                    throw { code: 'NO_ALT_NAMES_TO_FETCH', message: 'No alt names to fetch' };

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
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return LibItemMatching;
});
