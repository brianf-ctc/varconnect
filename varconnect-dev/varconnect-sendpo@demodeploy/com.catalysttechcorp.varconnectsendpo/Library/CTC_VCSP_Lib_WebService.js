/**
 * @Copyright (c) 2022 Catalyst Tech Corp
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
define([
    './CTC_Lib_Utils.js',
    './CTC_VCSP_Constants.js',
    './CTC_VCSP_Lib_VendorConfig.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Dell.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Arrow.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Synnex.js',
    // '../Vendor Scripts/CTC_VCSP_Lib_IngramMicro.js',
    '../VO/CTC_VCSP_Response.js',
    '../VO/CTC_VCSP_PO.js'
], function (ctc_util, constants, libVendorConfig, libDell, libArrow, libSynnex, response, PO) {
    var LogTitle = 'LibWS';

    function _validateVendorConfig(options) {
        var logTitle = [LogTitle, 'validateVendorConfig'].join('::');

        var recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            endpoint = recVendorConfig.endPoint;

        var requiredWebserviceInfo = {
            endpoint: endpoint
        };
        switch (apiVendor) {
            case constants.Lists.API_VENDOR.SYNNEX:
                requiredWebserviceInfo.user = recVendorConfig.user;
                requiredWebserviceInfo.password = recVendorConfig.password;
                break;
            case constants.Lists.API_VENDOR.INGRAM:
                requiredWebserviceInfo.endpoint = recVendorConfig.accessEndPoint;
                requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                break;
            case constants.Lists.API_VENDOR.DELL:
            default:
                requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                break;
        }
        log.debug(logTitle, JSON.stringify(requiredWebserviceInfo));

        for (var requiredParam in requiredWebserviceInfo) {
            if (!requiredWebserviceInfo[requiredParam]) {
                throw 'Incomplete webservice information for ' + recVendorConfig.vendorName;
            }
        }

        return;
    }

    function _getVendorLibrary(options) {
        var logTitle = [LogTitle, 'getVendorLibrary'].join('::');

        var recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            vendorList = constants.Lists.API_VENDOR,
            libVendor;

        log.debug(logTitle, '>> API Vendor: ' + apiVendor);
        log.debug(logTitle, '>> lib Vendor: ' + libVendor);

        switch (apiVendor) {
            case vendorList.DELL:
                libVendor = libDell;
                break;
            case vendorList.ARROW:
                libVendor = libArrow;
                break;
            case vendorList.SYNNEX:
                libVendor = libSynnex;
                break;
            // case vendorList.INGRAM:
            //     libVendor = libIngram;
            //     break;
            default:
                log.error('Switch case vendor', 'API Vendor not setup');
                break;
        }
        log.debug(logTitle, 'Lib Vendor: ' + libVendor);
        // log.debug(logTitle, JSON.stringify(libVendor) + ' :: Object Keys: ' + libVendor.constructor);

        return libVendor;
    }

    function _updateRecPO(options) {
        var recVendorConfig = options.recVendorConfig,
            recPO = options.recPO,
            nativePO = options.nativePO;

        recPO.setValuesFromVendorConfig({
            recVendorConfig: recVendorConfig,
            nativePO: nativePO
        });
    }

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        var nativePO = options.nativePO,
            recPO = new PO(nativePO),
            resp;

        try {
            var recVendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: recPO.entity,
                subsidiary: recPO.subsidiary
            });

            if (recVendorConfig) {
                _updateRecPO({
                    recPO: recPO,
                    nativePO: nativePO,
                    recVendorConfig: recVendorConfig
                });

                var libVendor = _getVendorLibrary({
                    recVendorConfig: recVendorConfig
                });

                log.debug(logTitle, 'Lib Vendor: ' + Object.keys(libVendor));
                if (
                    !libVendor ||
                    (Object.keys(libVendor).length === 0 && libVendor.constructor === Object)
                )
                    throw 'Missing or invalid vendor configuration';

                _validateVendorConfig({
                    recVendorConfig: recVendorConfig
                });

                resp = new response(
                    libVendor.process({
                        recVendorConfig: recVendorConfig,
                        recPO: recPO
                    })
                );
            }
        } catch (e) {
            resp = new response({
                code: 'error',
                message: ctc_util.extractError(e)
            });
        }

        return resp;
    }

    return {
        process: process
    };
});
