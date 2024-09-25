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
    ns_search,
    pref,
    constant
) {
    var LogTitle = 'VC:SENDPO';
    var vendorConfigFields = [
        constant.Fields.VendorConfig.ID, //0
        constant.Fields.VendorConfig.SUBSIDIARY, //1
        constant.Fields.VendorConfig.API_VENDOR, //2
        constant.Fields.VendorConfig.VENDOR, //3
        constant.Fields.VendorConfig.WEBSERVICE_ENDPOINT, //4
        constant.Fields.VendorConfig.USERNAME, //5
        constant.Fields.VendorConfig.PASSWORD, //6
        constant.Fields.VendorConfig.CUSTOMER_NO, //7
        constant.Fields.VendorConfig.API_KEY, //8
        constant.Fields.VendorConfig.API_SECRET, //9
        constant.Fields.VendorConfig.ACCESS_ENDPOINT, //10
        constant.Fields.VendorConfig.SKU_COLUMN, //11
        constant.Fields.VendorConfig.Bill.ADDRESSEE, //12
        constant.Fields.VendorConfig.Bill.ATTENTION, //13
        constant.Fields.VendorConfig.Bill.ADDRESS_1, //14
        constant.Fields.VendorConfig.Bill.ADDRESS_2, //15
        constant.Fields.VendorConfig.Bill.CITY, //16
        constant.Fields.VendorConfig.Bill.STATE, //17
        constant.Fields.VendorConfig.Bill.ZIP, //18
        constant.Fields.VendorConfig.Bill.COUNTRY, //19
        constant.Fields.VendorConfig.TEST_REQUEST, //20
        constant.Fields.VendorConfig.QA_WEBSERVICE_ENDPOINT, //21
        constant.Fields.VendorConfig.QA_ACCESS_ENDPOINT, //22
        constant.Fields.VendorConfig.QA_API_KEY, //23
        constant.Fields.VendorConfig.QA_API_SECRET, //24
        constant.Fields.VendorConfig.Bill.EMAIL, //25,
        constant.Fields.VendorConfig.Bill.PHONENO, //26,
        constant.Fields.VendorConfig.PAYMENT.MEAN, //26,
        constant.Fields.VendorConfig.PAYMENT.OTHER, //26,
        constant.Fields.VendorConfig.PAYMENT.TERM,
        constant.Fields.VendorConfig.FIELDMAP,
        constant.Fields.VendorConfig.EVENT_TYPE //5 //26,
    ];

    function _generateVendorConfig(result) {
        // log.debug('vendor config', JSON.stringify(result));

        var VendorConfig = constant.Fields.VendorConfig;
        return {
            id: result.getValue({ name: VendorConfig.ID }),
            subsidiary: result.getValue({ name: VendorConfig.SUBSIDIARY }),
            apiVendor: result.getValue({ name: VendorConfig.API_VENDOR }),
            vendor: result.getValue({ name: VendorConfig.VENDOR }),
            vendorName: result.getText({ name: VendorConfig.VENDOR }),
            endPoint: result.getValue({ name: VendorConfig.WEBSERVICE_ENDPOINT }),
            user: result.getValue({ name: VendorConfig.USERNAME }),
            password: result.getValue({ name: VendorConfig.PASSWORD }),
            customerNo: result.getValue({ name: VendorConfig.CUSTOMER_NO }),
            apiKey: result.getValue({ name: VendorConfig.API_KEY }),
            apiSecret: result.getValue({ name: VendorConfig.API_SECRET }),
            accessEndPoint: result.getValue({ name: VendorConfig.ACCESS_ENDPOINT }),
            skuColumn: result.getValue({ name: VendorConfig.SKU_COLUMN }),
            eventType: result.getValue({ name: VendorConfig.EVENT_TYPE }),
            Bill: {
                addressee: result.getValue({ name: VendorConfig.Bill.ADDRESSEE }),
                attention: result.getValue({ name: VendorConfig.Bill.ATTENTION }),
                address1: result.getValue({ name: VendorConfig.Bill.ADDRESS_1 }),
                address2: result.getValue({ name: VendorConfig.Bill.ADDRESS_2 }),
                phoneno: result.getValue({ name: VendorConfig.Bill.PHONENO }),
                city: result.getValue({ name: VendorConfig.Bill.CITY }),
                state: result.getValue({ name: VendorConfig.Bill.STATE }),
                zip: result.getValue({ name: VendorConfig.Bill.ZIP }),
                country: result.getValue({ name: VendorConfig.Bill.COUNTRY }),
                email: result.getValue({ name: VendorConfig.Bill.EMAIL })
            },
            testRequest: result.getValue({ name: VendorConfig.TEST_REQUEST }),
            qaEndPoint: result.getValue({ name: VendorConfig.QA_WEBSERVICE_ENDPOINT }),
            qaAccessEndPoint: result.getValue({ name: VendorConfig.QA_ACCESS_ENDPOINT }),
            qaApiKey: result.getValue({ name: VendorConfig.QA_API_KEY }),
            qaApiSecret: result.getValue({ name: VendorConfig.QA_API_SECRET }),
            paymentMean: result.getText({ name: VendorConfig.PAYMENT.MEAN }),
            paymentOther: result.getText({ name: VendorConfig.PAYMENT.OTHER }),
            paymentTerm: result.getText({ name: VendorConfig.PAYMENT.TERM }),
            fieldmap: result.getValue({ name: VendorConfig.FIELDMAP }),
            Mapping: {
                ponum: result.getValue({ name: VendorConfig.MAPPING.PONUM })
            }
        };
    }

    function getVendorConfiguration(options) {
        var logTitle = [LogTitle, 'getVendorConfig'].join(':'),
            config = null,
            vendor = options.vendor,
            subsidiary = options.subsidiary;

        log.debug(logTitle, 'Params: ' + JSON.stringify(options));
        var filter = [];
        filter.push(
            ns_search.createFilter({
                name: constant.Fields.VendorConfig.VENDOR,
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

        if (pref.ENABLE_SUBSIDIARIES)
            filter.push(
                ns_search.createFilter({
                    name: constant.Fields.VendorConfig.SUBSIDIARY,
                    operator: ns_search.Operator.ANYOF,
                    values: subsidiary
                })
            );

        var vendorSearch = ns_search.create({
            type: constant.Records.VENDOR_CONFIG,
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
