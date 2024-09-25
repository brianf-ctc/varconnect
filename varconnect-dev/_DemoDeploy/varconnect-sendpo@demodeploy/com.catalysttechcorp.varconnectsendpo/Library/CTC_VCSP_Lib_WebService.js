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
    './CTC_Lib_ServerUtils',
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
    CTC_SSUtil,
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

    function _validateVendorConfig(option) {
        let logTitle = [LogTitle, 'validateVendorConfig'].join('::');

        let vendorConfig = option.vendorConfig,
            apiVendor = vendorConfig.apiVendor,
            vendorList = VCSP_Global.Lists.API_VENDOR,
            endpoint = vendorConfig.endPoint;

        if (vendorConfig.testRequest) {
            endpoint = vendorConfig.qaEndPoint;
        }
        let requiredWebserviceInfo = {
            endpoint: endpoint
        };
        switch (apiVendor) {
            case vendorList.SYNNEX:
                requiredWebserviceInfo.user = vendorConfig.user;
                requiredWebserviceInfo.password = vendorConfig.password;
                break;
            case vendorList.SCANSOURCE:
                requiredWebserviceInfo.businessUnit = vendorConfig.businessUnit;
                if (vendorConfig.testRequest) {
                    requiredWebserviceInfo.oauthScope = vendorConfig.qaOauthScope;
                    requiredWebserviceInfo.subscriptionKey = vendorConfig.qaSubscriptionKey;
                } else {
                    requiredWebserviceInfo.oauthScope = vendorConfig.oauthScope;
                    requiredWebserviceInfo.subscriptionKey = vendorConfig.subscriptionKey;
                }
            case vendorList.DANDH:
            case vendorList.INGRAM:
                if (vendorConfig.testRequest) {
                    requiredWebserviceInfo.tokenEndpoint = vendorConfig.qaAccessEndPoint;
                    requiredWebserviceInfo.apiKey = vendorConfig.qaApiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.qaApiSecret;
                } else {
                    requiredWebserviceInfo.tokenEndpoint = vendorConfig.accessEndPoint;
                    requiredWebserviceInfo.apiKey = vendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.apiSecret;
                }
                break;
            case vendorList.ARROW:
                if (vendorConfig.testRequest) {
                    requiredWebserviceInfo.apiKey = vendorConfig.qaApiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.qaApiSecret;
                    requiredWebserviceInfo.oauthScope = vendorConfig.qaSubscriptionKey;
                } else {
                    requiredWebserviceInfo.apiKey = vendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.apiSecret;
                    requiredWebserviceInfo.oauthScope = vendorConfig.oauthScope;
                }
                break;
            case vendorList.DELL:
            default:
                if (vendorConfig.testRequest) {
                    requiredWebserviceInfo.apiKey = vendorConfig.qaApiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.qaApiSecret;
                } else {
                    requiredWebserviceInfo.apiKey = vendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.apiSecret;
                }
                break;
        }
        log.debug(logTitle, JSON.stringify(requiredWebserviceInfo));

        for (let requiredParam in requiredWebserviceInfo) {
            if (!requiredWebserviceInfo[requiredParam]) {
                throw (
                    'Incomplete webservice information for ' +
                    vendorConfig.vendorName +
                    '. Missing one of the following: ' +
                    Object.keys(requiredWebserviceInfo).join(', ')
                );
            }
        }

        return;
    }

    function _getVendorLibrary(option) {
        let logTitle = [LogTitle, 'getVendorLibrary'].join('::');

        let vendorConfig = option.vendorConfig,
            apiVendor = vendorConfig.apiVendor,
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

    function _updatePurchaseOrder(option) {
        let vendorConfig = option.vendorConfig,
            poObj = option.purchaseOrder,
            record = option.transaction;

        log.audit('_updatePurchaseOrder', '/// vendor config: ' + JSON.stringify(vendorConfig));

        poObj.setValuesFromVendorConfig({
            vendorConfig: vendorConfig,
            transaction: record
        });
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            record = option.transaction,
            poObj = new PO(record),
            resp;
        try {
            let vendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: poObj.entity,
                subsidiary: poObj.subsidiary,
                transaction: record
            });

            log.audit(logTitle, '/// Vendor Config: ' + JSON.stringify(vendorConfig));

            if (vendorConfig) {
                poObj = CTC_Util.extendPO({
                    purchaseOrder: poObj,
                    vendorConfig: vendorConfig,
                    transaction: record
                });
                if (vendorConfig.additionalPOFields) {
                    vendorConfig.additionalPOFields = CTC_SSUtil.renderTemplate({
                        body: vendorConfig.additionalPOFields,
                        purchaseOrder: poObj
                    });
                }
                _updatePurchaseOrder({
                    purchaseOrder: poObj,
                    transaction: record,
                    vendorConfig: vendorConfig
                });

                let libVendor = _getVendorLibrary({
                    vendorConfig: vendorConfig
                });

                if (!libVendor) throw 'Missing or invalid vendor configuration';

                _validateVendorConfig({
                    vendorConfig: vendorConfig
                });

                resp = new response(
                    libVendor.process({
                        vendorConfig: vendorConfig,
                        purchaseOrder: poObj,
                        transaction: record
                    })
                );
            }
        } catch (error) {
            var errorMsg = CTC_Util.extractError(error);
            CTC_Util.logError(logTitle, JSON.stringify(error));

            resp = new response({
                code: 'error',
                message: CTC_Util.extractError(error)
            });
        }

        return resp;
    }

    return {
        process: process
    };
});
