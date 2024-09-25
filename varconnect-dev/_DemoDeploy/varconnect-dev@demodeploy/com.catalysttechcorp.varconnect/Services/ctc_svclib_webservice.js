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
    const LogTitle = 'SVC:WebSVC',
        LOG_APP = 'WebSVC';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js'),
        vc_websvclib = require('../CTC_VC_Lib_WebService'),
        vcs_configLib = require('./ctc_svclib_configlib.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_error = require('N/error');

    var Helper = {
        getPODetails: function (poNum) {
            var searchOption = {
                    type: 'purchaseorder',
                    filters: [
                        [
                            ['type', 'anyof', 'PurchOrd'],
                            'AND',
                            ['numbertext', 'is', poNum],
                            'AND',
                            ['mainline', 'is', 'T']
                        ]
                    ],
                    columns: ['entity', 'tranid', 'subsidiary']
                },
                poData = {};

            vc2_util.log('getPODetails', '// search option: ', searchOption);

            var poSearchObj = ns_search.create(searchOption);

            poSearchObj.run().each(function (result) {
                // if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES)
                poData['subsidiary'] = result.getValue('subsidiary');
                poData['vendor'] = result.getValue('entity');
                poData['id'] = result.id;

                return false;
            });

            return poData || null;
        }
    };

    return {
        OrderStatusDebug: function (option) {
            var logTitle = [LogTitle, 'OrderStatusDebug'].join(':'),
                returnValue;

            var poNum = option.poNum || option.tranid,
                poId = option.poId || option.id;

            var poData = Helper.getPODetails(poNum);
            // if (!poData || vc2_util.isEmpty(poData) || !poNum) throw 'Valid PO Number is required';
            vc2_util.log(logTitle, '>> poData: ', poData);

            var vendorConfig = vcs_configLib.vendorConfig({
                vendor: poData && poData.vendor ? poData.vendor.value || poData.vendor : null,
                subsidiary: poData && poData.subsidiary ? poData.subsidiary : null,
                configId: option.vendorConfigId
            });
            if (!vendorConfig) throw 'Please make sure Vendor configuration was setup correctly';

            var outputObj = vc_websvclib.handleRequest({
                vendorConfig: vendorConfig,
                poNum: poNum,
                poId: poData.id,
                country:
                    vendorConfig.country == 'CA'
                        ? vc2_constant.LIST.COUNTRY.CA
                        : vc2_constant.LIST.COUNTRY.US,
                countryCode: vendorConfig.country
            });

            return outputObj;

            // return returnValue;
        },
        orderStatus: function (option) {}
    };
});
