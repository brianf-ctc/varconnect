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
    let CURRENT = {
        transaction: null,
        purchaseOrder: null,
        vendorConfig: null,
        vendorLibrary: null
    };

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
                    requiredWebserviceInfo.subscriptionKey = vendorConfig.qaSubscriptionKey;
                } else {
                    requiredWebserviceInfo.apiKey = vendorConfig.apiKey;
                    requiredWebserviceInfo.apiSecret = vendorConfig.apiSecret;
                    requiredWebserviceInfo.subscriptionKey = vendorConfig.subscriptionKey;
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

        // CTC_Util.log('AUDIT', '_updatePurchaseOrder', '/// complete vendor config: ' + JSON.stringify(vendorConfig));

        poObj.setValuesFromVendorConfig({
            vendorConfig: vendorConfig,
            transaction: record
        });
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            resp;
        CURRENT.transaction = option.transaction;
        try {
            (CURRENT.purchaseOrder = new PO(CURRENT.transaction)),
                (CURRENT.vendorConfig = libVendorConfig.getVendorConfiguration({
                    vendor: CURRENT.purchaseOrder.entity,
                    subsidiary: CURRENT.purchaseOrder.subsidiary,
                    transaction: CURRENT.transaction
                }));

            log.audit(logTitle, '/// Vendor Config: ' + JSON.stringify(CURRENT.vendorConfig));

            if (CURRENT.vendorConfig) {
                CURRENT.purchaseOrder = CTC_Util.extendPO({
                    purchaseOrder: CURRENT.purchaseOrder,
                    vendorConfig: CURRENT.vendorConfig,
                    transaction: CURRENT.transaction
                });
                _updatePurchaseOrder({
                    purchaseOrder: CURRENT.purchaseOrder,
                    transaction: CURRENT.transaction,
                    vendorConfig: CURRENT.vendorConfig
                });
                if (CURRENT.vendorConfig.additionalPOFields) {
                    CURRENT.vendorConfig.additionalPOFields = CTC_SSUtil.renderTemplate({
                        body: CURRENT.vendorConfig.additionalPOFields,
                        purchaseOrder: CURRENT.purchaseOrder
                    });
                }

                CURRENT.vendorLibrary = _getVendorLibrary({
                    vendorConfig: CURRENT.vendorConfig
                });

                if (!CURRENT.vendorLibrary) throw 'Missing or invalid vendor configuration';

                _validateVendorConfig({
                    vendorConfig: CURRENT.vendorConfig
                });

                resp = new response(
                    CURRENT.vendorLibrary.process({
                        vendorConfig: CURRENT.vendorConfig,
                        purchaseOrder: CURRENT.purchaseOrder,
                        transaction: CURRENT.transaction
                    })
                );
            }
        } catch (error) {
            let errorMsg = CTC_Util.extractError(error);
            CTC_Util.logError(logTitle, JSON.stringify(error));

            resp = new response({
                code: 'error',
                message: CTC_Util.extractError(error)
            });
        }

        return resp;
    }

    function getOrderStatus() {
        let logTitle = [LogTitle, 'getOrderStatus'].join('::'),
            returnValue;
        try {
            let taskOption = {
                isMapReduce: true,
                scriptId: VCSP_Global.Scripts.Script.ORDERSTATUS_MR,
                scriptParams: {}
            };
            if (
                CURRENT.vendorConfig &&
                CURRENT.vendorConfig.runOrderStatus &&
                CURRENT.purchaseOrder &&
                CURRENT.purchaseOrder.id
            ) {
                taskOption.scriptParams['custscript_orderstatus_searchid'] =
                    'customsearch_ctc_open_po_search';
                taskOption.scriptParams['custscript_orderstatus_orderid'] =
                    CURRENT.purchaseOrder.id;
                CTC_Util.log(logTitle, '>> order status params: ' + JSON.stringify(taskOption));
                taskOption.deployId = CTC_SSUtil.forceDeploy(taskOption);
            }
        } catch (error) {
            let errorMsg = CTC_Util.extractError(error);
            CTC_Util.logError(logTitle, JSON.stringify(error));
        }
        return true;
    }

    return {
        process: process,
        getOrderStatus: getOrderStatus
    };
});
