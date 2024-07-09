/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for Vendor Configuration
 *
 */
define([
    'N/search',
    'N/record',
    './CTC_VCSP_Lib_Preferences',
    './CTC_VCSP_Constants',
    './CTC_Lib_Utils',
    '../VO/CTC_VCSP_PO'
], function (NS_Search, NS_Record, VCSP_Pref, VCSP_Global, CTC_Util, PO) {
    let LogTitle = 'VC:SENDPO';
    let VendorConfig = VCSP_Global.Fields.VendorConfig;
    let vendorConfigFields = [
        { name: VendorConfig.ID },
        { name: VendorConfig.SUBSIDIARY },
        { name: 'country', join: VendorConfig.SUBSIDIARY },
        { name: VendorConfig.API_VENDOR },
        { name: VendorConfig.VENDOR },
        { name: VendorConfig.WEBSERVICE_ENDPOINT },
        { name: VendorConfig.USERNAME },
        { name: VendorConfig.PASSWORD },
        { name: VendorConfig.CUSTOMER_NO },
        { name: VendorConfig.API_KEY },
        { name: VendorConfig.API_SECRET },
        { name: VendorConfig.ACCESS_ENDPOINT },
        { name: VendorConfig.OAUTH_SCOPE },
        { name: VendorConfig.SUBSCRIPTION_KEY },
        { name: VendorConfig.Bill.ID },
        { name: VendorConfig.Bill.ADDRESSEE },
        { name: VendorConfig.Bill.ATTENTION },
        { name: VendorConfig.Bill.ADDRESS_1 },
        { name: VendorConfig.Bill.ADDRESS_2 },
        { name: VendorConfig.Bill.CITY },
        { name: VendorConfig.Bill.STATE },
        { name: VendorConfig.Bill.ZIP },
        { name: VendorConfig.Bill.COUNTRY },
        { name: VendorConfig.TEST_REQUEST },
        { name: VendorConfig.IS_SPECIAL_ITEM_NAME },
        { name: VendorConfig.QA_WEBSERVICE_ENDPOINT },
        { name: VendorConfig.QA_ACCESS_ENDPOINT },
        { name: VendorConfig.QA_OAUTH_SCOPE },
        { name: VendorConfig.QA_API_KEY },
        { name: VendorConfig.QA_API_SECRET },
        { name: VendorConfig.QA_SUBSCRIPTION_KEY },
        { name: VendorConfig.PONUM_FIELD },
        { name: VendorConfig.ITEM_COLUMN },
        { name: VendorConfig.QUOTE_COLUMN },
        { name: VendorConfig.MEMO_FIELD },
        { name: VendorConfig.SHIP_CONTACT_FIELD },
        { name: VendorConfig.SHIP_EMAIL_FIELD },
        { name: VendorConfig.SHIP_PHONE_FIELD },
        { name: VendorConfig.Bill.EMAIL },
        { name: VendorConfig.Bill.PHONENO },
        { name: VendorConfig.PAYMENT.MEAN },
        { name: VendorConfig.PAYMENT.OTHER },
        { name: VendorConfig.PAYMENT.TERM },
        { name: VendorConfig.FIELD_MAP },
        { name: VendorConfig.EVENT_TYPE },
        { name: VendorConfig.ENABLE_ADD_VENDOR_DETAILS },
        { name: VendorConfig.ADDITIONAL_PO_FIELDS },
        { name: VendorConfig.ADD_DETAILS_ON_SUBMIT },
        { name: VendorConfig.PO_LINE_COLUMNS },
        { name: VendorConfig.BUSINESS_UNIT }
    ];

    function _generateVendorConfig(option) {
        // log.debug('vendor config', JSON.stringify(result));
        let result = option.result,
            record = option.transaction,
            poObj = option.purchaseOrder;
        let vendorConfigRecord = NS_Record.load({
            type: VCSP_Global.Records.VENDOR_CONFIG,
            id: result.id,
            isDynamic: false
        });
        let returnValue = {
            id: result.getValue({ name: VendorConfig.ID }),
            subsidiary: result.getValue({ name: VendorConfig.SUBSIDIARY }),
            country: result.getValue({ name: 'country', join: VendorConfig.SUBSIDIARY }),
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
            oauthScope: result.getValue({ name: VendorConfig.OAUTH_SCOPE }),
            subscriptionKey: result.getValue({ name: VendorConfig.SUBSCRIPTION_KEY }),
            poNumField: result.getValue({ name: VendorConfig.PONUM_FIELD }),
            itemColumn: result.getValue({ name: VendorConfig.ITEM_COLUMN }),
            quoteColumn: result.getValue({ name: VendorConfig.QUOTE_COLUMN }),
            memoField: result.getValue({ name: VendorConfig.MEMO_FIELD }),
            shipContactField: result.getValue({ name: VendorConfig.SHIP_CONTACT_FIELD }),
            shipEmailField: result.getValue({ name: VendorConfig.SHIP_EMAIL_FIELD }),
            shipPhoneField: result.getValue({ name: VendorConfig.SHIP_PHONE_FIELD }),
            eventType: result.getValue({ name: VendorConfig.EVENT_TYPE }),
            Bill: {
                id: result.getValue({ name: VendorConfig.Bill.ID }),
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
            isSpecialItemName: result.getValue({ name: VendorConfig.IS_SPECIAL_ITEM_NAME }),
            testRequest: result.getValue({ name: VendorConfig.TEST_REQUEST }),
            qaEndPoint: result.getValue({ name: VendorConfig.QA_WEBSERVICE_ENDPOINT }),
            qaAccessEndPoint: result.getValue({ name: VendorConfig.QA_ACCESS_ENDPOINT }),
            qaOauthScope: result.getValue({ name: VendorConfig.QA_OAUTH_SCOPE }),
            qaApiKey: result.getValue({ name: VendorConfig.QA_API_KEY }),
            qaApiSecret: result.getValue({ name: VendorConfig.QA_API_SECRET }),
            qaSubscriptionKey: result.getValue({ name: VendorConfig.QA_SUBSCRIPTION_KEY }),
            paymentMean: result.getText({ name: VendorConfig.PAYMENT.MEAN }),
            paymentOther: result.getText({ name: VendorConfig.PAYMENT.OTHER }),
            paymentTerm: result.getText({ name: VendorConfig.PAYMENT.TERM }),
            fieldMap: vendorConfigRecord.getValue(VendorConfig.FIELD_MAP),
            addVendorDetailsEnabled: result.getValue({
                name: VendorConfig.ENABLE_ADD_VENDOR_DETAILS
            }),
            additionalPOFields: vendorConfigRecord.getValue(VendorConfig.ADDITIONAL_PO_FIELDS),
            includeAdditionalDetailsOnSubmit: vendorConfigRecord.getValue(VendorConfig.ADD_DETAILS_ON_SUBMIT),
            poLineColumns: vendorConfigRecord.getValue(VendorConfig.PO_LINE_COLUMNS),
            businessUnit: vendorConfigRecord.getText(VendorConfig.BUSINESS_UNIT)
        };
        if (!returnValue.addVendorDetailsEnabled) {
            returnValue.additionalPOFields = null;
        }
        return returnValue;
    }

    function getVendorConfiguration(option) {
        let logTitle = [LogTitle, 'getVendorConfig'].join(':'),
            config = null,
            record = option.transaction,
            vendorConfigId = option.vendorConfigId,
            vendor = option.vendor,
            subsidiary = option.subsidiary,
            poObj = null;
        if (record) {
            poObj = new PO(record);
        }
        if (poObj) {
            vendor = poObj.entity;
            subsidiary = poObj.subsidiary;
        }
        log.debug(
            logTitle,
            'Params: ' +
                JSON.stringify({
                    vendorConfigId: vendorConfigId,
                    vendor: vendor,
                    subsidiary: subsidiary
                })
        );
        let filter = [];
        if (vendorConfigId) {
            filter.push(
                NS_Search.createFilter({
                    name: VendorConfig.ID,
                    operator: NS_Search.Operator.ANYOF,
                    values: vendorConfigId
                })
            );
        } else {
            filter.push(
                NS_Search.createFilter({
                    name: VendorConfig.VENDOR,
                    operator: NS_Search.Operator.ANYOF,
                    values: vendor
                })
            );
            filter.push(
                NS_Search.createFilter({
                    name: 'isinactive',
                    operator: NS_Search.Operator.IS,
                    values: false
                })
            );

            if (VCSP_Pref.isSubsidiariesEnabled()) {
                filter.push(
                    NS_Search.createFilter({
                        name: VendorConfig.SUBSIDIARY,
                        operator: NS_Search.Operator.ANYOF,
                        values: subsidiary
                    })
                );
            }
        }

        let vendorSearch = NS_Search.create({
            type: VCSP_Global.Records.VENDOR_CONFIG,
            filters: filter,
            columns: vendorConfigFields
        });

        let result = vendorSearch.run().getRange({
            start: 0,
            end: 1
        });

        if (result && result[0]) {
            config = _generateVendorConfig({
                result: result[0],
                transaction: record,
                purchaseOrder: poObj
            });
        }

        // log.debug('vendor config', config);

        return config;
    }

    function getAvailableVendorList(option) {
        let logTitle = [LogTitle, 'getAvailableVendorList'].join(':'),
            vendorList = null,
            subsidiary = option.subsidiary;

        log.debug(logTitle, 'Params: ' + JSON.stringify(option));
        let filter = [];
        filter.push(
            NS_Search.createFilter({
                name: 'isinactive',
                operator: NS_Search.Operator.IS,
                values: false
            })
        );

        if (VCSP_Pref.isSubsidiariesEnabled()) {
            filter.push(
                NS_Search.createFilter({
                    name: VendorConfig.SUBSIDIARY,
                    operator: NS_Search.Operator.ANYOF,
                    values: subsidiary
                })
            );
        }

        let columns = [{ name: VendorConfig.VENDOR }];

        let vendorSearch = NS_Search.create({
            type: VCSP_Global.Records.VENDOR_CONFIG,
            filters: filter,
            columns: columns
        });

        let results = vendorSearch.run().getRange({
            start: 0,
            end: 1000
        });

        let vendorAdded = {};
        if (results && results.length) {
            vendorList = [];
            results.forEach((result) => {
                let vendorId = result.getValue(columns[0]);
                if (vendorId && !vendorAdded[vendorId]) {
                    vendorList.push({
                        value: vendorId,
                        text: result.getText(columns[0])
                    });
                    vendorAdded[vendorId] = true;
                }
                return true;
            });
        }

        return vendorList;
    }

    function getVendorAdditionalPOFields(option) {
        let logTitle = [LogTitle, 'getVendorAdditionalPOFields'].join(':'),
            vendorConfigId = option.vendorConfig,
            subsidiaryId = option.subsidiary,
            vendorId = option.vendor,
            returnValue = null;
        // init search details
        let searchColumns = [{ name: VendorConfig.ADDITIONAL_PO_FIELDS }, { name: VendorConfig.FIELD_MAP }],
            searchDetails;
        if (vendorConfigId) {
            returnValue = getVendorConfiguration({
                vendorConfigId: vendorConfigId
            });
        } else if (vendorId) {
            returnValue = getVendorConfiguration({
                vendor: vendorId,
                subsidiary: subsidiaryId
            });
        }
        if (returnValue) {
            searchDetails = {
                type: VCSP_Global.Records.VENDOR_CONFIG,
                filters: [
                    [VendorConfig.ID, NS_Search.Operator.ANYOF, returnValue.id],
                    'AND',
                    ['isinactive', NS_Search.Operator.IS, 'F']
                ],
                columns: searchColumns
            };
            log.debug(logTitle, 'Looking up additional vendor config fields: ' + JSON.stringify(searchDetails));
            let vendorSearch = NS_Search.create(searchDetails);
            let results = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
            if (results && results.length) {
                returnValue.additionalPOFields = results[0].getValue(searchColumns[0]);
                returnValue.fieldMap = results[0].getValue(searchColumns[1]);
            }
        }
        return returnValue;
    }

    return {
        getVendorConfiguration: getVendorConfiguration,
        getAvailableVendorList: getAvailableVendorList,
        getVendorAdditionalPOFields: getVendorAdditionalPOFields
    };
});
