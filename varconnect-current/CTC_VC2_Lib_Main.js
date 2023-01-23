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
 * @NScriptType MapReduceScript
 */

define(function (require) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime');

    var vc_util = require('./CTC_VC2_Lib_Utils'),
        vc_constants = require('./CTC_VC2_Constants'),
        vc_license = require('./CTC_VC_Lib_LicenseValidator'),
        vc_maincfg = require('./CTC_VC_Lib_MainConfiguration'),
        vc_vendorcfg = require('./CTC_VC_Lib_VendorConfig');

    var LogTitle = 'LIB_VCMain',
        LogPrefix = '',
        Current = {};

    var VC_Main = {
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');
            // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));
            // return true;

            var mainConfig = option.mainConfig || this.loadMainConfig(),
                license = mainConfig.license,
                response = vc_license.callValidationSuitelet({
                    license: license,
                    external: true
                });

            if (response == 'invalid')
                throw new Error(
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
        },
        loadMainConfig: function () {
            var logTitle = [LogTitle, 'loadMainConfig'].join('::');

            var mainConfig = vc_maincfg.getMainConfiguration();
            if (!mainConfig) {
                log.error(logTitle, 'No Configuration available');
                throw new Error('No Configuration available');
            } else return mainConfig;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');
            // log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary,
                vendorConfig = vc_vendorcfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                log.audit(logTitle, 'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName);
            }

            log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));
            return vendorConfig;
        }
    };

    return VC_Main;
});
