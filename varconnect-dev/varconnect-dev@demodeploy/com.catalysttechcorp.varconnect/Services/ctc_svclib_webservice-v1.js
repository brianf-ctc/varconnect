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
        vc_websvclib = require('../CTC_VC_Lib_WebService.js'),
        vcs_recordsLib = require('./ctc_svclib_records.js'),
        vcs_configLib = require('./ctc_svclib_configlib.js'),
        vc2_record = require('./../CTC_VC2_Lib_Record.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_error = require('N/error');

    var CACHE_TTL = 300; // store the data for 1mins

    return {
        OrderStatusDebug: function (option) {
            var logTitle = [LogTitle, 'OrderStatusDebug'].join(':'),
                returnValue;

            var poNum = option.poNum || option.tranid;
            var poData = vcs_recordsLib.searchPO({ name: poNum });

            // if (!poData || vc2_util.isEmpty(poData) || !poNum) throw 'Valid PO Number is required';
            vc2_util.log(logTitle, '>> poData: ', poData);

            var OrderCFG = vcs_configLib.orderVendorConfig({
                vendor: poData ? poData.entity : null,
                subsidiary: poData ? poData.subsidiary : null,
                configId: option.vendorConfigId
            });
            if (!OrderCFG) throw 'Please make sure Vendor configuration was setup correctly';

            var outputObj = vc_websvclib.handleRequest({
                orderConfig: OrderCFG,
                poNum: poNum,
                poId: poData.id,
                country: OrderCFG.country == 'CA' ? vc2_constant.LIST.COUNTRY.CA : vc2_constant.LIST.COUNTRY.US,
                countryCode: OrderCFG.country
            });

            return outputObj;

            // return returnValue;
        },
        OrderStatus: function (option) {
            var logTitle = [LogTitle, 'OrderStatus'].join('::'),
                returnValue;

            var poNum = option.poNum || option.tranid,
                configId = option.vendorConfigId,
                po_record = option.po_record || option.record,
                poId = option.poId;

            var poData = vcs_recordsLib.searchPO({ name: poNum });
            vc2_util.log(logTitle, '>> poData: ', poData);

            var vendor = poData.entity,
                subsidiary = poData.subsidiary,
                MainCFG = vcs_configLib.mainConfig(),
                OrderCFG = vcs_configLib.orderVendorConfig({
                    vendor: vendor,
                    subsidiary: subsidiary,
                    configId: configId
                });

            var processOption = {
                mainConfig: MainCFG,
                orderConfig: OrderCFG,
                vendor: vendor,
                poId: poData.id,
                poNum: poNum,
                tranDate: poData.trandate,
                subsidiary: subsidiary,
                countryCode: OrderCFG.country
            };
            vc2_util.log(logTitle, '## processing: ', processOption);

            processOption.po_record =
                po_record ||
                (poData && poData.id
                    ? vc2_record.load({
                          type: 'purchaseorder',
                          id: poData.id,
                          isDynamic: true
                      })
                    : null);

            var outputLines = vc_websvclib.process(processOption);

            returnValue = outputLines;

            return returnValue;
        }
    };
});
