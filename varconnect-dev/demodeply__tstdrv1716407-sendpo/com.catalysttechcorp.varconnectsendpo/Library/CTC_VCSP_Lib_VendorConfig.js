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
 * 1.00		Jan 9, 2020		paolodl		Library for Vendor Configuration
 *
 */
define(['N/search', './CTC_VCSP_Lib_Preferences.js', './CTC_VCSP_Constants.js'], function (
    search,
    pref,
    constants
) {
    var vendorConfigFields = [
        constants.Fields.VendorConfig.ID, //0
        constants.Fields.VendorConfig.SUBSIDIARY, //1
        constants.Fields.VendorConfig.API_VENDOR, //2
        constants.Fields.VendorConfig.VENDOR, //3
        constants.Fields.VendorConfig.WEBSERVICE_ENDPOINT, //4
        constants.Fields.VendorConfig.USERNAME, //5
        constants.Fields.VendorConfig.PASSWORD, //6
        constants.Fields.VendorConfig.CUSTOMER_NO, //7
        constants.Fields.VendorConfig.API_KEY, //8
        constants.Fields.VendorConfig.API_SECRET, //9
        constants.Fields.VendorConfig.ACCESS_ENDPOINT, //10
        constants.Fields.VendorConfig.SKU_COLUMN, //11
        constants.Fields.VendorConfig.Bill.ADDRESSEE, //12
        constants.Fields.VendorConfig.Bill.ATTENTION, //13
        constants.Fields.VendorConfig.Bill.ADDRESS_1, //14
        constants.Fields.VendorConfig.Bill.ADDRESS_2, //15
        constants.Fields.VendorConfig.Bill.CITY, //16
        constants.Fields.VendorConfig.Bill.STATE, //17
        constants.Fields.VendorConfig.Bill.ZIP, //18
        constants.Fields.VendorConfig.Bill.COUNTRY, //19
        constants.Fields.VendorConfig.TEST_REQUEST, //20
        constants.Fields.VendorConfig.QA_WEBSERVICE_ENDPOINT, //21
        constants.Fields.VendorConfig.QA_ACCESS_ENDPOINT, //22
        constants.Fields.VendorConfig.QA_API_KEY, //23
        constants.Fields.VendorConfig.QA_API_SECRET, //24
        constants.Fields.VendorConfig.Bill.EMAIL //25
    ];

    function _generateVendorConfig(result) {
        // log.debug('vendor config', JSON.stringify(result));
        return {
            id: result.getValue({ name: vendorConfigFields[0] }),
            subsidiary: result.getValue({ name: vendorConfigFields[1] }),
            apiVendor: result.getValue({ name: vendorConfigFields[2] }),
            vendor: result.getValue({ name: vendorConfigFields[3] }),
            endPoint: result.getValue({ name: vendorConfigFields[4] }),
            user: result.getValue({ name: vendorConfigFields[5] }),
            password: result.getValue({ name: vendorConfigFields[6] }),
            customerNo: result.getValue({ name: vendorConfigFields[7] }),
            apiKey: result.getValue({ name: vendorConfigFields[8] }),
            apiSecret: result.getValue({ name: vendorConfigFields[9] }),
            accessEndPoint: result.getValue({ name: vendorConfigFields[10] }),
            skuColumn: result.getValue({ name: vendorConfigFields[11] }),
            Bill: {
                addressee: result.getValue({ name: vendorConfigFields[12] }),
                attention: result.getValue({ name: vendorConfigFields[13] }),
                address1: result.getValue({ name: vendorConfigFields[14] }),
                address2: result.getValue({ name: vendorConfigFields[15] }),
                city: result.getValue({ name: vendorConfigFields[16] }),
                state: result.getValue({ name: vendorConfigFields[17] }),
                zip: result.getValue({ name: vendorConfigFields[18] }),
                country: result.getValue({ name: vendorConfigFields[19] }),
                email: result.getValue({ name: vendorConfigFields[25] })
            },
            testRequest: result.getValue({ name: vendorConfigFields[20] }),
            qaEndPoint: result.getValue({ name: vendorConfigFields[21] }),
            qaAccessEndPoint: result.getValue({ name: vendorConfigFields[22] }),
            qaApiKey: result.getValue({ name: vendorConfigFields[23] }),
            qaApiSecret: result.getValue({ name: vendorConfigFields[24] })
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

        if (pref.ENABLE_SUBSIDIARIES)
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

        var result = vendorSearch.run().getRange({
            start: 0,
            end: 1
        });

        if (result && result[0]) {
            config = _generateVendorConfig(result[0]);
        }

        // log.debug('vendor config', config);

        return config;
    }

    return {
        getVendorConfiguration: getVendorConfiguration
    };
});
