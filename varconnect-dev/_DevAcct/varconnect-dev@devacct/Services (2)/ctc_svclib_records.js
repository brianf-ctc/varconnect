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

    var vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js'),
        vc_mainCfg = require('./../CTC_VC_Lib_MainConfiguration');

    var ns_search = require('N/search');
    var fuse = require('./lib/fuse.js');

    var MainConfig;
    var RECORD_LIB = {};

    var Helper = {
        loadMainConfig: function () {
            if (!MainConfig) {
                MainConfig = vc_mainCfg.getMainConfiguration();
                if (!MainConfig) {
                    log.error(logTitle, 'No Configuration available');
                }
            }
        }
    };

    var SEARCH = {
        fuzzyItemSearch: function (option) {},
        itemSearch: function (option) {
            vc2_util.log(LogTitle, 'option', option);

            if (option.sku) throw 'SKU Name is ' + option.sku;

            return '## OPTION ##' + JSON.stringify(option);
        },
        fetchItemsPO: function (option) {
            var logTitle = [LogTitle, 'fetchItemsPO'].join('::'),
                returnValue;

            var poId = option.poId || option.internalId || option.po;
            if (!poId) throw 'Missing Paramter: PO ID';

            var itemSearch = ns_search.create({
                type: 'transaction',
                filters: [['internalid', 'anyof', poId], 'AND', ['mainline', 'is', 'F']],
                columns: [
                    ns_search.createColumn({
                        name: 'item',
                        summary: 'GROUP'
                    })
                ]
            });

            var arrSKUs = [];
            itemSearch.run().each(function (result) {
                arrSKUs.push({
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
                });
                return true;
            });
            returnValue = arrSKUs;

            // var arrPOItems = [];
            // arrSKUs.forEach(function (skuDetails) {
            //     arrPOItems.push({ item: skuDetails.value });
            //     return true;
            // });
            // var arrSKUsVendorNames = Helper.extractVendorItemNames({ lines: arrPOItems });
            // vc2_util.log(logTitle, '// arrSKUsVendorNames: ', arrSKUsVendorNames);

            // for (var i = 0, len = arrSKUs.length; i < len; i += 1) {
            //     arrSKUs[i].vendorItemName =
            //         arrSKUsVendorNames[i][vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY];
            //     // return true;
            // }

            returnValue = arrSKUs;
            return returnValue;
        },
        searchPO: function (option) {
            var logTitle = [LogTitle, 'searchPO'],
                returnValue;

            var poNum = option.name || option.poName || option.poNum;
            if (!poNum) throw 'Missing parameter: PO Num';

            Helper.loadMainConfig();

            var searchOption = {
                    type: 'purchaseorder',
                    filters: [
                        MainConfig.overridePONum
                            ? [
                                  ['numbertext', 'is', poNum],
                                  'OR',
                                  ['custbody_ctc_vc_override_ponum', 'is', poNum]
                              ]
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
                },
                poData;
            var searchObj = ns_search.create(searchOption);

            if (searchObj.runPaged().count) {
                var searchResult = searchObj.run().getRange({ start: 0, end: 1 }).shift();

                poData = {
                    id: searchResult.getValue({ name: 'internalid' }),
                    entityId: searchResult.getValue({ name: 'entity' }),
                    tranId: searchResult.getValue({ name: 'tranid' }),
                    date: searchResult.getValue({ name: 'trandate' })
                };
            }
            returnValue = poData || false;

            return returnValue;
        }
    };
    util.extend(RECORD_LIB, SEARCH);

    return RECORD_LIB;
});
