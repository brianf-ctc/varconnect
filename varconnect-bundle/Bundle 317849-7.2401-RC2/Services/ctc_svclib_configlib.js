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
    const LogTitle = 'SVC:ConfigLib',
        LOG_APP = 'ConfigLib';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var ns_search = require('N/search');

    var VendorCFG = vc2_constant.RECORD.VENDOR_CONFIG,
        VendorCFG_Map = function (row) {
            return {
                id: row.getValue({ name: VendorCFG.FIELD.ID }),
                subsidiary: row.getValue({ name: VendorCFG.FIELD.SUBSIDIARY }),
                xmlVendor: row.getValue({ name: VendorCFG.FIELD.XML_VENDOR }),
                xmlVendorText: row.getText({ name: VendorCFG.FIELD.XML_VENDOR }),
                vendor: row.getValue({ name: VendorCFG.FIELD.VENDOR }),
                endPoint: row.getValue({ name: VendorCFG.FIELD.WEBSERVICE_ENDPOINT }),
                startDate: row.getValue({ name: VendorCFG.FIELD.START_DATE }),
                user: row.getValue({ name: VendorCFG.FIELD.USERNAME }),
                password: row.getValue({ name: VendorCFG.FIELD.PASSWORD }),
                customerNo: row.getValue({ name: VendorCFG.FIELD.CUSTOMER_NO }),
                processDropships: row.getValue({ name: VendorCFG.FIELD.PROCESS_DROPSHIPS }),
                processSpecialOrders: row.getValue({
                    name: VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS
                }),
                fulfillmentPrefix: row.getValue({ name: VendorCFG.FIELD.FULFILLMENT_PREFIX }),
                accessEndPoint: row.getValue({ name: VendorCFG.FIELD.ACCESS_ENDPOINT }),
                apiKey: row.getValue({ name: VendorCFG.FIELD.API_KEY }),
                apiSecret: row.getValue({ name: VendorCFG.FIELD.API_SECRET }),
                oauthScope: row.getValue({ name: VendorCFG.FIELD.OATH_SCOPE }),
                useShipDate: row.getValue({ name: VendorCFG.FIELD.USE_SHIPDATE }),
                country: row.getValue({
                    name: 'country',
                    join: VendorCFG.FIELD.SUBSIDIARY
                }),
                itemColumnIdToMatch: row.getValue({
                    name: VendorCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH
                }),
                itemFieldIdToMatch: row.getValue({
                    name: VendorCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH
                })
            };
        };

    var MainCFG = vc2_constant.RECORD.MAIN_CONFIG,
        MainCFG_Map = {
            id: MainCFG.FIELD.ID,
            emailTemplate: MainCFG.FIELD.SCHEDULED_FULFILLMENT_TEMPLATE,
            emailSender: MainCFG.FIELD.SCHEDULED_FULFILLMENT_SENDER,
            serialNoFolder: MainCFG.FIELD.SERIAL_NO_FOLDER_ID,
            processDropships: MainCFG.FIELD.PROCESS_DROPSHIPS,
            processSpecialOrders: MainCFG.FIELD.PROCESS_SPECIAL_ORDERS,
            createIF: MainCFG.FIELD.CREATE_ITEM_FULFILLMENTS,
            createIR: MainCFG.FIELD.CREATE_ITEM_RECEIPTS,
            ignoreDirectShipDropship: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_DROPSHIPS,
            ignoreDirectShipSpecialOrder: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS,
            createSerialDropship: MainCFG.FIELD.CREATE_SERIAL_DROPSHIPS,
            createSerialSpecialOrder: MainCFG.FIELD.CREATE_SERIAL_SPECIAL_ORDERS,
            useInboundTrackingNumbers: MainCFG.FIELD.USE_INB_TRACKING_SPECIAL_ORDERS,
            license: MainCFG.FIELD.LICENSE,
            copySerialsInv: MainCFG.FIELD.COPY_SERIALS_INV,
            serialScanUpdate: MainCFG.FIELD.SERIAL_SCAN_UPDATE,
            invPrintSerials: MainCFG.FIELD.INV_PRINT_SERIALS,
            printSerialsTemplate: MainCFG.FIELD.PRINT_SERIALS_TEMPLATE,
            multipleIngram: MainCFG.FIELD.MULTIPLE_INGRAM,
            ingramHashSpace: MainCFG.FIELD.INGRAM_HASH_TO_SPACE,
            fulfillmentSearch: MainCFG.FIELD.FULFILMENT_SEARCH,
            defaultBillForm: MainCFG.FIELD.DEFAULT_BILL_FORM,
            defaultVendorBillStatus: MainCFG.FIELD.DEFAULT_VENDOR_BILL_STATUS,
            allowedVarianceAmountThreshold: MainCFG.FIELD.ALLOWED_VARIANCE_AMOUNT_THRESHOLD,
            isVarianceOnTax: MainCFG.FIELD.VARIANCE_ON_TAX,
            allowAdjustLine: MainCFG.FIELD.ALLOW_ADJUSTLINE,
            defaultTaxItem: MainCFG.FIELD.DEFAULT_TAX_ITEM,
            defaultTaxItem2: MainCFG.FIELD.DEFAULT_TAX_ITEM2,
            isVarianceOnShipping: MainCFG.FIELD.VARIANCE_ON_SHIPPING,
            defaultShipItem: MainCFG.FIELD.DEFAULT_SHIPPING_ITEM,
            isVarianceOnOther: MainCFG.FIELD.VARIANCE_ON_OTHER,
            defaultOtherItem: MainCFG.FIELD.DEFAULT_OTHER_ITEM,
            isBillCreationDisabled: MainCFG.FIELD.DISABLE_VENDOR_BILL_CREATION,
            overridePONum: MainCFG.FIELD.OVERRIDE_PO_NUM,
            autoprocPriceVar: MainCFG.FIELD.AUTOPROC_PRICEVAR,
            autoprocTaxVar: MainCFG.FIELD.AUTOPROC_TAXVAR,
            autoprocShipVar: MainCFG.FIELD.AUTOPROC_SHIPVAR,
            autoprocOtherVar: MainCFG.FIELD.AUTOPROC_OTHERVAR,
            itemColumnIdToMatch: MainCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH,
            itemFieldIdToMatch: MainCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH
        };

    return {
        mainConfig: function (option) {
            var logTitle = [LogTitle, 'MainConfig'].join(':'),
                option = option || {},
                returnValue;

            var mainConfigData = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.MAIN_CONFIG,
                isJSON: true
            });

            var forced = option && option.forced;

            vc2_util.log(logTitle, '>> main config: ', option);

            if (!mainConfigData || forced) {
                vc2_util.log(logTitle, '## FETCH Main COnfig ## ', forced);

                // do the main config search
                var searchObj = ns_search.create({
                    type: MainCFG.ID,
                    filters: [['isinactive', 'is', 'F']],
                    columns: (function () {
                        var flds = [];
                        for (var fld in MainCFG_Map) flds.push(MainCFG_Map[fld]);
                        return flds;
                    })()
                });
                mainConfigData = {};

                searchObj.run().each(function (row) {
                    for (var fld in MainCFG_Map) {
                        var rowValue = row.getValue({ name: MainCFG_Map[fld] });
                        mainConfigData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });

                if (!mainConfigData) throw 'No Configuration available';
                vc2_util.log(logTitle, 'mainConfig>> ', mainConfigData);

                vc2_util.setNSCache({
                    name: vc2_constant.CACHE_KEY.MAIN_CONFIG,
                    value: mainConfigData
                });
            }

            returnValue = mainConfigData;

            return returnValue;
        },
        vendorConfig: function (option) {
            var logTitle = [LogTitle, 'MainConfig'].join(':'),
                returnValue;

            var configId = option.configId || option.id,
                vendorId = option.vendor || option.vendorId,
                subsId = option.subsidiary || option.subsidiaryId,
                cacheKey = '',
                cacheParams = [];

            log.audit(logTitle, option);

            var searchOption = {
                type: VendorCFG.ID,
                filters: [],
                columns: (function () {
                    var flds = [];
                    for (var fld in VendorCFG.FIELD) {
                        flds.push(VendorCFG.FIELD[fld]);
                    }
                    flds.push({
                        name: 'country',
                        join: VendorCFG.FIELD.SUBSIDIARY
                    });
                    return flds;
                })()
            };

            if (configId) {
                searchOption.filters.push(['internalid', 'anyof', configId]);
                cacheParams.push('id=' + configId);
            } else {
                if (vendorId) {
                    searchOption.filters.push([VendorCFG.FIELD.VENDOR, 'anyof', vendorId]);
                    cacheParams.push('vendor=' + vendorId);
                }
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
                    if (searchOption.filters.length) searchOption.filters.push('AND');
                    searchOption.filters.push([VendorCFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                    cacheParams.push('subs=' + subsId);
                }
            }

            if (!cacheParams || !cacheParams.length)
                throw 'Missing vendor configuration parameters!';
            cacheKey = vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__' + cacheParams.join('&');

            log.audit(logTitle, searchOption);
            log.audit(logTitle, cacheParams);
            log.audit(logTitle, cacheKey);

            var vendorConfigData = vc2_util.getNSCache({
                name: cacheKey,
                isJSON: true
            });

            if (!vendorConfigData) {
                var searchObj = ns_search.create(searchOption);

                // log.audit(logTitle, 'search count: ' + searchObj.runPaged().count);

                searchObj.run().each(function (row) {
                    vendorConfigData = VendorCFG_Map(row);
                    return;
                });

                if (!vendorConfigData) throw 'No Vendor Configuration available';

                vc2_util.setNSCache({
                    name: cacheKey,
                    value: vendorConfigData
                });
            }
            returnValue = vendorConfigData;

            return returnValue;
        },
        billVendorConfig: function (option) {}
    };
});
