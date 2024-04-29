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
    '../Vendor Scripts/CTC_VCSP_Lib_Scansource',
    '../Vendor Scripts/CTC_VCSP_Lib_Carahsoft',
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
    libScanSource,
    libCarahsoft,
    response,
    PO
) {
    let LogTitle = 'LibWS';

    function _validateVendorConfig(options) {
        let logTitle = [LogTitle, 'validateVendorConfig'].join('::');

        let recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            vendorList = VCSP_Global.Lists.API_VENDOR,
            endpoint = recVendorConfig.endPoint;

        if (recVendorConfig.testRequest) {
            endpoint = recVendorConfig.qaEndPoint;
        }
        let requiredWebserviceInfo = {
            endpoint: endpoint
        };
        switch (apiVendor) {
            case vendorList.SYNNEX:
                requiredWebserviceInfo.user = recVendorConfig.user;
                requiredWebserviceInfo.password = recVendorConfig.password;
                break;
            case vendorList.SCANSOURCE:
                requiredWebserviceInfo.businessUnit = recVendorConfig.businessUnit;
                requiredWebserviceInfo.subscriptionKey = recVendorConfig.subscriptionKey;
                if (recVendorConfig.testRequest) {
                    requiredWebserviceInfo.oauthScope = recVendorConfig.qaOauthScope;
                } else {
                    requiredWebserviceInfo.oauthScope = recVendorConfig.oauthScope;
                }
            case vendorList.DANDH:
            case vendorList.INGRAM:
                if (recVendorConfig.testRequest) {
                    requiredWebserviceInfo.tokenEndpoint = recVendorConfig.qaAccessEndPoint;
                    requiredWebserviceInfo.apiKey = recVendorConfig.qaApiKey;
                    requiredWebserviceInfo.apiSecret = recVendorConfig.qaApiSecret;
                } else {
                    requiredWebserviceInfo.tokenEndpoint = recVendorConfig.accessEndPoint;
                    requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                }
                break;
            case vendorList.DELL:
            default:
                if (recVendorConfig.testRequest) {
                    requiredWebserviceInfo.apiKey = recVendorConfig.qaApiKey;
                    requiredWebserviceInfo.apiSecret = recVendorConfig.qaApiSecret;
                } else {
                    requiredWebserviceInfo.apiKey = recVendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = recVendorConfig.apiSecret;
                }
                break;
        }
        log.debug(logTitle, JSON.stringify(requiredWebserviceInfo));

        for (let requiredParam in requiredWebserviceInfo) {
            if (!requiredWebserviceInfo[requiredParam]) {
                throw (
                    'Incomplete webservice information for ' +
                    recVendorConfig.vendorName +
                    '. Missing one of the following: ' +
                    Object.keys(requiredWebserviceInfo).join(', ')
                );
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
            case vendorList.SCANSOURCE:
                libVendor = libScanSource;
                break;
            case vendorList.CARAHSOFT:
                libVendor = libCarahsoft;
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
