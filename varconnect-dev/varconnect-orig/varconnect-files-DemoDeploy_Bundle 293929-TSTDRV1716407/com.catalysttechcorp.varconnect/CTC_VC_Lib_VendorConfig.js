/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 *
 */ /**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
define([
    'N/search',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Utilities'
], function (search, vcGlobals, constants, util) {
    var vendorConfigFields = [
        constants.Fields.VendorConfig.ID, //0
        constants.Fields.VendorConfig.SUBSIDIARY, //1
        constants.Fields.VendorConfig.XML_VENDOR, //2
        constants.Fields.VendorConfig.VENDOR, //3
        constants.Fields.VendorConfig.WEBSERVICE_ENDPOINT, //4
        constants.Fields.VendorConfig.START_DATE, //5
        constants.Fields.VendorConfig.USERNAME, //6
        constants.Fields.VendorConfig.PASSWORD, //7
        constants.Fields.VendorConfig.CUSTOMER_NO, //8
        constants.Fields.VendorConfig.PROCESS_DROPSHIPS, //9
        constants.Fields.VendorConfig.PROCESS_SPECIAL_ORDERS, //10
        constants.Fields.VendorConfig.FULFILLMENT_PREFIX, //11
        constants.Fields.VendorConfig.ACCESS_ENDPOINT, //12
        constants.Fields.VendorConfig.API_KEY, //13
        constants.Fields.VendorConfig.API_SECRET, //14
        constants.Fields.VendorConfig.OATH_SCOPE //15
    ];

    function _generateVendorConfig(result) {
        log.debug('_generateVendorConfig', JSON.stringify(result));
        return {
            id: result.getValue({ name: vendorConfigFields[0] }),
            subsidiary: result.getValue({ name: vendorConfigFields[1] }),
            xmlVendor: result.getValue({ name: vendorConfigFields[2] }),
            xmlVendorText: result.getText({ name: vendorConfigFields[2] }),
            vendor: result.getValue({ name: vendorConfigFields[3] }),
            endPoint: result.getValue({ name: vendorConfigFields[4] }),
            startDate: result.getValue({ name: vendorConfigFields[5] }),
            user: result.getValue({ name: vendorConfigFields[6] }),
            password: result.getValue({ name: vendorConfigFields[7] }),
            customerNo: result.getValue({ name: vendorConfigFields[8] }),
            processDropships: result.getValue({ name: vendorConfigFields[9] }),
            processSpecialOrders: result.getValue({ name: vendorConfigFields[10] }),
            fulfillmentPrefix: result.getValue({ name: vendorConfigFields[11] }),
            accessEndPoint: result.getValue({ name: vendorConfigFields[12] }),
            apiKey: result.getValue({ name: vendorConfigFields[13] }),
            apiSecret: result.getValue({ name: vendorConfigFields[14] }),
            oauthScope: result.getValue({ name: vendorConfigFields[15] })
        };
    }

    function getVendorConfiguration(options) {
        var config = null,
            vendor = options.vendor,
            subsidiary = options.subsidiary;

        log.debug('params', 'vendor ' + vendor + '| subs: ' + subsidiary);
        var filter = [];
        filter.push(
            search.createFilter({
                name: constants.Fields.VendorConfig.VENDOR,
                operator: search.Operator.ANYOF,
                values: vendor
            })
        );
        filter.push(
            search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            })
        );

        if (vcGlobals.ENABLE_SUBSIDIARIES && subsidiary)
            filter.push(
                search.createFilter({
                    name: constants.Fields.VendorConfig.SUBSIDIARY,
                    operator: search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = search.create({
            type: constants.Records.VENDOR_CONFIG,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.debug('error', JSON.stringify(e));
        }

        if (result && result[0]) {
            config = _generateVendorConfig(result[0]);
        }

        log.debug('getVendorConfiguration', config);

        return config;
    }

    function getMultipleConfigurations(options) {
        var arrConfig = [],
            vendor = options.vendor,
            subsidiary = options.subsidiary;

        log.debug('params', 'vendor ' + vendor + '| subs: ' + subsidiary);
        var filter = [];
        filter.push(
            search.createFilter({
                name: constants.Fields.VendorConfig.VENDOR,
                operator: search.Operator.ANYOF,
                values: vendor
            })
        );
        filter.push(
            search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            })
        );

        if (vcGlobals.ENABLE_SUBSIDIARIES)
            filter.push(
                search.createFilter({
                    name: constants.Fields.VendorConfig.SUBSIDIARY,
                    operator: search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = search.create({
            type: constants.Records.VENDOR_CONFIG,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 5
            });
        } catch (e) {
            log.debug('error', JSON.stringify(e));
        }

        if (result && result[0]) {
            var config = null;
            for (var i = 0; i < result.length; i++) {
                config = _generateVendorConfig(result[i]);
                arrConfig.push(config);
            }
        }

        log.debug('getMultipleConfigurations', arrConfig);

        return arrConfig;
    }

    function getDebugVendorConfiguration(options) {
        var config = null,
            vendor = options.xmlVendor,
            subsidiary = options.subsidiary;

        log.debug('params', 'vendor ' + vendor + '| subs: ' + subsidiary);
        var filter = [];
        filter.push(
            search.createFilter({
                name: constants.Fields.VendorConfig.XML_VENDOR,
                operator: search.Operator.ANYOF,
                values: vendor
            })
        );
        filter.push(
            search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            })
        );

        if (vcGlobals.ENABLE_SUBSIDIARIES && subsidiary)
            filter.push(
                search.createFilter({
                    name: constants.Fields.VendorConfig.SUBSIDIARY,
                    operator: search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = search.create({
            type: constants.Records.VENDOR_CONFIG,
            filters: filter,
            columns: vendorConfigFields
        });

        try {
            var result = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.debug('error', JSON.stringify(e));
        }

        if (result && result[0]) {
            config = _generateVendorConfig(result[0]);
        }

        log.debug('vendor config', config);

        return config;
    }

    return {
        getVendorConfiguration: getVendorConfiguration,
        getMultipleConfigurations: getMultipleConfigurations,
        getDebugVendorConfiguration: getDebugVendorConfiguration
    };
});
