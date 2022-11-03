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
    var LogTitle = 'VC:SENDPO';
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
        constants.Fields.VendorConfig.Bill.EMAIL, //25,
        constants.Fields.VendorConfig.Bill.PHONENO, //26,
        constants.Fields.VendorConfig.PAYMENT.MEAN, //26,
        constants.Fields.VendorConfig.PAYMENT.OTHER, //26,
        constants.Fields.VendorConfig.PAYMENT.TERM,
        constants.Fields.VendorConfig.EVENT_TYPE //5 //26,
    ];

    function _generateVendorConfig(result) {
        // log.debug('vendor config', JSON.stringify(result));

        var FieldSendPO = constants.Fields.VendorConfig;
        return {
            id: result.getValue({ name: FieldSendPO.ID }),
            subsidiary: result.getValue({ name: FieldSendPO.SUBSIDIARY }),
            apiVendor: result.getValue({ name: FieldSendPO.API_VENDOR }),
            vendor: result.getValue({ name: FieldSendPO.VENDOR }),
            vendorName: result.getText({ name: FieldSendPO.VENDOR }),
            endPoint: result.getValue({ name: FieldSendPO.WEBSERVICE_ENDPOINT }),
            user: result.getValue({ name: FieldSendPO.USERNAME }),
            password: result.getValue({ name: FieldSendPO.PASSWORD }),
            customerNo: result.getValue({ name: FieldSendPO.CUSTOMER_NO }),
            apiKey: result.getValue({ name: FieldSendPO.API_KEY }),
            apiSecret: result.getValue({ name: FieldSendPO.API_SECRET }),
            accessEndPoint: result.getValue({ name: FieldSendPO.ACCESS_ENDPOINT }),
            skuColumn: result.getValue({ name: FieldSendPO.SKU_COLUMN }),
            eventType: result.getValue({ name: FieldSendPO.EVENT_TYPE }),
            Bill: {
                addressee: result.getValue({ name: FieldSendPO.Bill.ADDRESSEE }),
                attention: result.getValue({ name: FieldSendPO.Bill.ATTENTION }),
                address1: result.getValue({ name: FieldSendPO.Bill.ADDRESS_1 }),
                address2: result.getValue({ name: FieldSendPO.Bill.ADDRESS_2 }),
                phoneno: result.getValue({ name: FieldSendPO.Bill.PHONENO }),
                city: result.getValue({ name: FieldSendPO.Bill.CITY }),
                state: result.getValue({ name: FieldSendPO.Bill.STATE }),
                zip: result.getValue({ name: FieldSendPO.Bill.ZIP }),
                country: result.getValue({ name: FieldSendPO.Bill.COUNTRY }),
                email: result.getValue({ name: FieldSendPO.Bill.EMAIL })
            },
            testRequest: result.getValue({ name: FieldSendPO.TEST_REQUEST }),
            qaEndPoint: result.getValue({ name: FieldSendPO.QA_WEBSERVICE_ENDPOINT }),
            qaAccessEndPoint: result.getValue({ name: FieldSendPO.QA_ACCESS_ENDPOINT }),
            qaApiKey: result.getValue({ name: FieldSendPO.QA_API_KEY }),
            qaApiSecret: result.getValue({ name: FieldSendPO.QA_API_SECRET }),
            paymentMean: result.getText({ name: FieldSendPO.PAYMENT.MEAN }),
            paymentOther: result.getText({ name: FieldSendPO.PAYMENT.OTHER }),
            paymentTerm: result.getText({ name: FieldSendPO.PAYMENT.TERM })
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
