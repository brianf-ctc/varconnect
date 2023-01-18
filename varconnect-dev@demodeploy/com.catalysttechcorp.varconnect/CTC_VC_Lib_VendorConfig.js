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
define(['N/search', './CTC_VC2_Constants', './CTC_VC2_Lib_Utils'], function (
    ns_search,
    vc2_constant,
    vc2_util
) {
    var LogTitle = 'VendorCFG',
        LogPrefix = LogPrefix || '';

    var VendorCFG = vc2_constant.RECORD.VENDOR_CONFIG;

    var vendorConfigFields = [
        VendorCFG.FIELD.ID, //0
        VendorCFG.FIELD.SUBSIDIARY, //1
        VendorCFG.FIELD.XML_VENDOR, //2
        VendorCFG.FIELD.VENDOR, //3
        VendorCFG.FIELD.WEBSERVICE_ENDPOINT, //4
        VendorCFG.FIELD.START_DATE, //5
        VendorCFG.FIELD.USERNAME, //6
        VendorCFG.FIELD.PASSWORD, //7
        VendorCFG.FIELD.CUSTOMER_NO, //8
        VendorCFG.FIELD.PROCESS_DROPSHIPS, //9
        VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS, //10
        VendorCFG.FIELD.FULFILLMENT_PREFIX, //11
        VendorCFG.FIELD.ACCESS_ENDPOINT, //12
        VendorCFG.FIELD.API_KEY, //13
        VendorCFG.FIELD.API_SECRET, //14
        VendorCFG.FIELD.OATH_SCOPE //15
    ];

    function _generateVendorConfig(result) {
        var logTitle = [LogTitle, '_generateVendorConfig'].join('::');
        // log.audit(logTitle, LogPrefix + '>> result: ' + JSON.stringify(result));

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
            oauthScope: result.getValue({ name: vendorConfigFields[15] }),
            country: result.getValue({
                name: 'country',
                join: 'custrecord_ctc_vc_vendor_subsidiary'
            })
        };
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

        // log.audit(
        //     logTitle,
        //     '>> search option: ' +
        //         JSON.stringify({
        //             type: VendorCFG.ID,
        //             filters: filter,
        //             columns: vendorConfigFields
        //         })
        // );

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

        log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(config));

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

        log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(arrConfig));

        return arrConfig;
    }

    function getDebugVendorConfiguration(options) {
        var logTitle = [LogTitle, 'getDebugVendorConfiguration'].join('::');
        // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(options));

        var config = null,
            vendor = options.xmlVendor,
            subsidiary = options.subsidiary;

        var filter = [];
        filter.push(
            ns_search.createFilter({
                name: VendorCFG.FIELD.XML_VENDOR,
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

        log.audit(logTitle, LogPrefix + '>> config: ' + JSON.stringify(config));

        return config;
    }

    return {
        getVendorConfiguration: getVendorConfiguration,
        getMultipleConfigurations: getMultipleConfigurations,
        getDebugVendorConfiguration: getDebugVendorConfiguration
    };
});
