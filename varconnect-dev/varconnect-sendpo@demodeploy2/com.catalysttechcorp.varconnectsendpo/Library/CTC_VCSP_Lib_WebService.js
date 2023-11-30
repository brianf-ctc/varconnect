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
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define([
    './CTC_Lib_Utils',
    './CTC_VCSP_Constants',
    './CTC_VCSP_Lib_VendorConfig',
    '../Vendor Scripts/CTC_VCSP_Lib_Dell',
    '../Vendor Scripts/CTC_VCSP_Lib_Arrow',
    '../Vendor Scripts/CTC_VCSP_Lib_Synnex',
    '../Vendor Scripts/CTC_VCSP_Lib_IngramMicro',
    '../Vendor Scripts/CTC_VCSP_Lib_DandH',
    '../VO/CTC_VCSP_Response',
    '../VO/CTC_VCSP_PO'
], function (
    CTC_Util,
    VCSP_Global,
    libVendorConfig,
    libDell,
    libArrow,
    libSynnex,
    libIngram,
    libDandH,
    response,
    PO
) {
    let LogTitle = 'LibWS';

    function _validateVendorConfig(options) {
        let logTitle = [LogTitle, 'validateVendorConfig'].join('::');

        let recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            endpoint = recVendorConfig.endPoint;

        let requiredWebserviceInfo = {
            endpoint: endpoint
        };
        switch (apiVendor) {
            case VCSP_Global.Lists.API_VENDOR.SYNNEX:
                requiredWebserviceInfo.user = recVendorConfig.user;
                requiredWebserviceInfo.password = recVendorConfig.password;
                break;
            case VCSP_Global.Lists.API_VENDOR.INGRAM:
                requiredWebserviceInfo.endpoint = recVendorConfig.accessEndPoint;
                requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                break;
            case VCSP_Global.Lists.API_VENDOR.DELL:
            default:
                requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                break;
        }
        log.debug(logTitle, JSON.stringify(requiredWebserviceInfo));

        for (let requiredParam in requiredWebserviceInfo) {
            if (!requiredWebserviceInfo[requiredParam]) {
                throw 'Incomplete webservice information for ' + recVendorConfig.vendorName;
            }
        }

        return;
    }

    function _getVendorLibrary(options) {
        let logTitle = [LogTitle, 'getVendorLibrary'].join('::');

        let recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            vendorList = VCSP_Global.Lists.API_VENDOR,
            libVendor;

        log.debug(logTitle, '>> API Vendor: ' + apiVendor);

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
            case vendorList.INGRAM:
                libVendor = libIngram;
                break;
            case vendorList.DANDH:
                libVendor = libDandH;
                break;
            default:
                log.error(logTitle, 'API Vendor not setup');
                break;
        }
        // log.debug(logTitle, JSON.stringify(libVendor) + ' :: Object Keys: ' + libVendor.constructor);

        return libVendor;
    }

    function _updateRecPO(options) {
        let recVendorConfig = options.recVendorConfig,
            recPO = options.recPO,
            nativePO = options.nativePO;

        recPO.setValuesFromVendorConfig({
            recVendorConfig: recVendorConfig,
            nativePO: nativePO
        });
    }

    function process(options) {
        let recPO = options.nativePO,
            objPO = new PO(recPO),
            resp;

        try {
            let recVendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: objPO.entity,
                subsidiary: objPO.subsidiary
            });

            if (recVendorConfig) {
                _updateRecPO({
                    recPO: objPO,
                    nativePO: recPO,
                    recVendorConfig: recVendorConfig
                });

                let libVendor = _getVendorLibrary({
                    recVendorConfig: recVendorConfig
                });

                if (!libVendor) throw 'Missing or invalid vendor configuration';

                _validateVendorConfig({
                    recVendorConfig: recVendorConfig
                });

                resp = new response(
                    libVendor.process({
                        recVendorConfig: recVendorConfig,
                        recPO: objPO,
                        nativePO: recPO
                    })
                );
            }
        } catch (e) {
            resp = new response({
                code: 'error',
                message: CTC_Util.extractError(e)
            });
        }

        return resp;
    }

    return {
        process: process
    };
});
