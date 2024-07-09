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

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 */
define(['N/search', './CTC_VC2_Constants', './CTC_VC2_Lib_Utils'], function (ns_search, vc2_constant, vc2_util) {
    var LogTitle = 'VendorCFG',
        LogPrefix = LogPrefix || '';

    var VendorCFG = vc2_constant.RECORD.VENDOR_CONFIG;

    var vendorConfigFields = [
        VendorCFG.FIELD.ID,
        VendorCFG.FIELD.SUBSIDIARY,
        VendorCFG.FIELD.XML_VENDOR,
        VendorCFG.FIELD.VENDOR,
        VendorCFG.FIELD.WEBSERVICE_ENDPOINT,
        VendorCFG.FIELD.START_DATE,
        VendorCFG.FIELD.USERNAME,
        VendorCFG.FIELD.PASSWORD,
        VendorCFG.FIELD.CUSTOMER_NO,
        VendorCFG.FIELD.PROCESS_DROPSHIPS,
        VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS,
        VendorCFG.FIELD.FULFILLMENT_PREFIX,
        VendorCFG.FIELD.ACCESS_ENDPOINT,
        VendorCFG.FIELD.API_KEY,
        VendorCFG.FIELD.API_SECRET,
        VendorCFG.FIELD.OATH_SCOPE,
        {
            name: 'country',
            join: VendorCFG.FIELD.SUBSIDIARY
        },
        VendorCFG.FIELD.USE_SHIPDATE,
        VendorCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH,
        VendorCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH,
        VendorCFG.FIELD.MATCH_CUSTOM_ITEM_TO_NAME,
        VendorCFG.FIELD.CUSTOM_MPN_COL_TO_MATCH,
        VendorCFG.FIELD.CUSTOM_MPN_FLD_TO_MATCH,
        VendorCFG.FIELD.MATCH_CUSTOM_MPN_TO_NAME
    ];

    function _generateVendorConfig(result) {
        var logTitle = [LogTitle, '_generateVendorConfig'].join('::');
        // log.audit(logTitle, LogPrefix + '>> result: ' + JSON.stringify(result));

        return {
            id: result.getValue({ name: VendorCFG.FIELD.ID }),
            subsidiary: result.getValue({ name: VendorCFG.FIELD.SUBSIDIARY }),
            xmlVendor: result.getValue({ name: VendorCFG.FIELD.XML_VENDOR }),
            xmlVendorText: result.getText({ name: VendorCFG.FIELD.XML_VENDOR }),
            vendor: result.getValue({ name: VendorCFG.FIELD.VENDOR }),
            endPoint: result.getValue({ name: VendorCFG.FIELD.WEBSERVICE_ENDPOINT }),
            startDate: result.getValue({ name: VendorCFG.FIELD.START_DATE }),
            user: result.getValue({ name: VendorCFG.FIELD.USERNAME }),
            password: result.getValue({ name: VendorCFG.FIELD.PASSWORD }),
            customerNo: result.getValue({ name: VendorCFG.FIELD.CUSTOMER_NO }),
            processDropships: result.getValue({ name: VendorCFG.FIELD.PROCESS_DROPSHIPS }),
            processSpecialOrders: result.getValue({ name: VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS }),
            fulfillmentPrefix: result.getValue({ name: VendorCFG.FIELD.FULFILLMENT_PREFIX }),
            accessEndPoint: result.getValue({ name: VendorCFG.FIELD.ACCESS_ENDPOINT }),
            apiKey: result.getValue({ name: VendorCFG.FIELD.API_KEY }),
            apiSecret: result.getValue({ name: VendorCFG.FIELD.API_SECRET }),
            oauthScope: result.getValue({ name: VendorCFG.FIELD.OATH_SCOPE }),
            useShipDate: result.getValue({ name: VendorCFG.FIELD.USE_SHIPDATE }),
            country: result.getValue({
                name: 'country',
                join: VendorCFG.FIELD.SUBSIDIARY
            }),
            itemColumnIdToMatch: result.getValue({
                name: VendorCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH
            }),
            itemFieldIdToMatch: result.getValue({
                name: VendorCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH
            }),
            matchItemToPartNumber: result.getValue({
                name: VendorCFG.FIELD.MATCH_CUSTOM_ITEM_TO_NAME
            }),
            itemMPNColumnIdToMatch: result.getValue({
                name: VendorCFG.FIELD.CUSTOM_MPN_COL_TO_MATCH
            }),
            itemMPNFieldIdToMatch: result.getValue({
                name: VendorCFG.FIELD.CUSTOM_MPN_FLD_TO_MATCH
            }),
            matchMPNWithPartNumber: result.getValue({
                name: VendorCFG.FIELD.MATCH_CUSTOM_MPN_TO_NAME
            })
        };
    }

    function getVendorConfigurationCache(options) {
        var config = vc2_util.getNSCache({ key: 'VC_VENDOR_CONFIG_0326' });
        if (vc2_util.isEmpty(config)) config = getVendorConfiguration(options);

        if (!vc2_util.isEmpty(config)) {
            vc2_util.setNSCache({ key: 'VC_VENDOR_CONFIG', cacheTTL: 14400, value: config });
        }
        return config;
    }
    function getMultipleConfigurationsCache(options) {
        var config = vc2_util.getNSCache({ key: 'VC_MULTIPLE_VENDOR_CONFIG' });
        if (vc2_util.isEmpty(config)) config = getMultipleConfigurations(options);

        if (!vc2_util.isEmpty(config)) {
            vc2_util.setNSCache({
                key: 'VC_MULTIPLE_VENDOR_CONFIG',
                cacheTTL: 14400,
                value: config
            });
        }
        return config;
    }
    function getDebugVendorConfigurationCache(options) {
        var config = vc2_util.getNSCache({ key: 'VC_DEBUG_VENDOR_CONFIG' });
        if (vc2_util.isEmpty(config)) config = getDebugVendorConfiguration(options);

        if (!vc2_util.isEmpty(config)) {
            vc2_util.setNSCache({ key: 'VC_DEBUG_VENDOR_CONFIG', cacheTTL: 14400, value: config });
        }
        return config;
    }

    function getVendorConfiguration(options) {
        var logTitle = [LogTitle, 'getVendorConfiguration'].join('::');
        // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(options));

        var config = null,
            vendor = options.vendor,
            subsidiary = options.subsidiary;

        var filter = [];
        filter.push(
            ns_search.createFilter({
                name: VendorCFG.FIELD.VENDOR,
                operator: ns_search.Operator.ANYOF,
                values: vendor
            })
        );
        filter.push(
            ns_search.createFilter({
                name: 'isinactive',
                operator: ns_search.Operator.IS,
                values: false
            })
        );

        if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsidiary)
            filter.push(
                ns_search.createFilter({
                    name: VendorCFG.FIELD.SUBSIDIARY,
                    operator: ns_search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = ns_search.create({
            type: VendorCFG.ID,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.error(logTitle, LogPrefix + '!! ERROR !!' + vc2_util.extractError(e));
        }

        if (result && result[0]) {
            config = _generateVendorConfig(result[0]);
        }

        // log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(config));

        return config;
    }

    function getMultipleConfigurations(options) {
        var logTitle = [LogTitle, 'getMultipleConfigurations'].join('::');
        // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(options));

        var arrConfig = [],
            vendor = options.vendor,
            subsidiary = options.subsidiary;

        var filter = [];
        filter.push(
            ns_search.createFilter({
                name: VendorCFG.FIELD.VENDOR,
                operator: ns_search.Operator.ANYOF,
                values: vendor
            })
        );
        filter.push(
            ns_search.createFilter({
                name: 'isinactive',
                operator: ns_search.Operator.IS,
                values: false
            })
        );

        if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES)
            filter.push(
                ns_search.createFilter({
                    name: VendorCFG.FIELD.SUBSIDIARY,
                    operator: ns_search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = ns_search.create({
            type: VendorCFG.ID,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 5
            });
        } catch (e) {
            log.error(logTitle, LogPrefix + '!! ERROR !!' + vc2_util.extractError(e));
        }

        if (result && result[0]) {
            var config = null;
            for (var i = 0; i < result.length; i++) {
                config = _generateVendorConfig(result[i]);
                arrConfig.push(config);
            }
        }

        // log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(arrConfig));

        return arrConfig;
    }

    function getDebugVendorConfiguration(options) {
        var logTitle = [LogTitle, 'getDebugVendorConfiguration'].join('::');
        // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(options));

        var config = null,
            vendor = options.xmlVendor,
            subsidiary = options.subsidiary,
            recId = options.internalid;

        var filter = [];

        if (vendor) {
            filter.push(
                ns_search.createFilter({
                    name: VendorCFG.FIELD.XML_VENDOR,
                    operator: ns_search.Operator.ANYOF,
                    values: vendor
                })
            );
        }

        if (recId) {
            filter.push(
                ns_search.createFilter({
                    name: 'internalid',
                    operator: ns_search.Operator.ANYOF,
                    values: recId
                })
            );
        }

        filter.push(
            ns_search.createFilter({
                name: 'isinactive',
                operator: ns_search.Operator.IS,
                values: false
            })
        );

        if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsidiary)
            filter.push(
                ns_search.createFilter({
                    name: VendorCFG.FIELD.SUBSIDIARY,
                    operator: ns_search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        log.audit(
            logTitle,
            '>> search option: ' +
                JSON.stringify({
                    type: VendorCFG.ID,
                    filters: filter,
                    columns: vendorConfigFields
                })
        );

        vendorConfigFields.push(
            ns_search.createColumn({
                name: 'country',
                join: 'custrecord_ctc_vc_vendor_subsidiary'
            })
        );

        var vendorSearch = ns_search.create({
            type: VendorCFG.ID,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.error(logTitle, LogPrefix + '!! ERROR !!' + vc2_util.extractError(e));
        }

        if (result && result[0]) {
            config = _generateVendorConfig(result[0]);
        }

        // log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(config));

        return config;
    }

    return {
        getVendorConfiguration: getVendorConfigurationCache,
        getMultipleConfigurations: getMultipleConfigurationsCache,
        getDebugVendorConfiguration: getDebugVendorConfigurationCache
    };
});
