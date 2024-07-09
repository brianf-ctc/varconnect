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
        vc2_record = require('./../CTC_VC2_Lib_Record.js'),
        vcs_configLib = require('./ctc_svclib_configlib.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_error = require('N/error');

    var fuse = require('./lib/fuse.js');

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

    var Helper = {
        cleanupOrderLines: function (option) {
            var logTitle = [LogTitle, 'cleanupOrderLines'].join('::'),
                returnValue;

            try {
                var lineCount = CURRENT.PO_REC.getLineCount({ sublistId: 'item' }),
                    hasLineUpdates = false;

                for (line = 0; line < lineCount; line++) {
                    var orderLineData = vc2_record.extractLineValues({
                            record: CURRENT.PO_REC,
                            line: line,
                            columns: vc2_util.arrayKeys(MAPPING.lineColumn)
                        }),
                        updateLineValues = {};

                    for (var fld in orderLineData) {
                        if (orderLineData[fld] == 'Duplicate Item') updateLineValues[fld] = ' ';
                    }

                    if (!vc2_util.isEmpty(updateLineValues)) {
                        vc2_util.log(logTitle, '// cleanup needed line data: ', [orderLineData, updateLineValues]);

                        updateLineValues.line = line;
                        vc2_record.updateLine({
                            record: CURRENT.PO_REC,
                            lineData: updateLineValues
                        });

                        hasLineUpdates = true;
                    }
                }

                returnValue = hasLineUpdates;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }
        }
    };

    return {
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

            var poNum = option.name || option.poName || option.poNum,
                poId = option.id || option.internalid;

            if (!poNum && !poId) throw 'Missing parameter: PO Num/ PO Id';

            // retrive
            var cachedData = vc2_util.getNSCache({
                name: JSON.stringify([logTitle, option]),
                isJSON: true
            });
            returnValue = cachedData;

            if (!cachedData || option.forced) {
                var MainCFG = vcs_configLib.mainConfig();
                var searchOption = {
                        type: 'purchaseorder',
                        filters: [['mainline', 'is', 'T'], 'AND', ['type', 'anyof', 'PurchOrd']],
                        columns: [
                            'internalid',
                            'type',
                            'tranid',
                            'trandate',
                            'entity',
                            'subsidiary',
                            'postingperiod',
                            'custbody_ctc_vc_override_ponum',
                            'custbody_ctc_bypass_vc',
                            'amount',
                            'createdfrom',
                            'custbody_isdropshippo',
                            'custbody_ctc_po_link_type'
                            // 'dropshipso'
                        ]
                    },
                    PO_Data;

                if (poId) {
                    searchOption.filters.push('AND');
                    searchOption.filters.push(['internalid', 'anyof', poId]);
                } else if (poNum) {
                    searchOption.filters.push('AND');
                    if (MainCFG.overridePONum) {
                        searchOption.filters.push(['custbody_ctc_vc_override_ponum', 'is', poNum]);
                    } else {
                        searchOption.filters.push(['numbertext', 'is', poNum]);
                    }
                }
                var searchObj = ns_search.create(searchOption);
                if (searchObj.runPaged().count) {
                    var searchResult = searchObj.run().getRange({ start: 0, end: 1 }).shift();

                    var PO_Data = {
                        id: searchResult.getValue({ name: 'internalid' })
                    };

                    for (var i = 0, j = searchOption.columns.length; i < j; i++) {
                        PO_Data[searchOption.columns[i].name || searchOption.columns[i]] = searchResult.getValue({
                            name: searchOption.columns[i]
                        });
                    }
                }
                returnValue = PO_Data || false;

                // set the cachedData
                vc2_util.setNSCache({
                    name: JSON.stringify([logTitle, option]),
                    value: PO_Data,
                    cacheTTL: CACHE_TTL
                });
            }
            return returnValue;
        },
        updatePOLines: function (option) {
            var logTitle = [LogTitle, 'updatePOLines'],
                returnValue;

            var poData = option.poData;

            CURRENT.PO_RECORD = option.po_record || option.record;
            CURRENT.VendorLines = option.vendorLines;
            CURRENT.MainCFG = option.mainConfig;
            CURRENT.OrderCFG = option.orderConfig;

            if (!CURRENT.VendorLines) throw 'Missing vendor lines';
            if (!CURRENT.PO_RECORD) {
                if (!poData || !poData.id) throw 'Missing PO Record';
                CURRENT.PO_RECORD = vc2_record.load({
                    type: 'purchaseorder',
                    id: poData.id,
                    isDynamic: true
                });
            }

            // clean up the lines ///
            var isUpdatedPO = Helper.cleanupOrderLines();

            var arrPOCols = [
                'item',
                'quantity',
                'rate',
                'amount',
                vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                vc2_constant.FIELD.TRANSACTION.DH_MPN,
                vc2_constant.FIELD.TRANSACTION.DELL_QUOTE_NO,
                vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
            ];

            var itemAltNameColId = CURRENT.OrderCFG.itemColumnIdToMatch || CURRENT.MainCFG.itemColumnIdToMatch;
            if (itemAltNameColId) arrPOCols.push(itemAltNameColId);

            CURRENT.OrderLines = vc2_record.extractRecordLines({
                record: CURRENT.PO_REC,
                findAll: true,
                mainConfig: CURRENT.MainCFG,
                orderConfig: CURRENT.OrderCFG,
                columns: arrPOCols
            });

            // loop thru the vendor lines
            for (var i = 0, j = CURRENT.VendorLines.length; i < j; i++) {
                var vendorLine = CURRENT.VendorLines[i];
                vc2_util.log(logTitle, ' #### VENDOR LINE ####', vendorLine);

                try {
                    /**
                    (0) -- create PO line --
                    (1) find if there are matching order lines
                    (2) map the vendor values to the order lines
                    (3) 

                    
                    */
                } catch (error) {}
            }

            return returnValue;
        },

        findMatchingOrderLine: function (option) {},

        findMatchingVendorLine: function (option) {}
    };
});
