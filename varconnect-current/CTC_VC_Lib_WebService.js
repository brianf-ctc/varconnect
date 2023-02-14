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

define([
    'N/https',
    'N/search',
    'N/format',
    './CTC_VC_Lib_Synnex',
    './CTC_VC_Lib_TechData',
    './CTC_VC_Lib_DandH',
    './CTC_VC_Lib_Ingram',
    './CTC_VC_Lib_Dell',
    './CTC_VC_Lib_Arrow',
    './CTC_VC_Lib_Ingram_v1',
    './CTC_VC_Lib_Jenne',
    './CTC_VC_Lib_ScanSource',
    './CTC_VC_Lib_WeFi.js',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_Log.js'
], function (
    ns_https,
    ns_search,
    ns_format,
    lib_synnex,
    lib_techdata,
    lib_dnh,
    lib_ingram,
    lib_dell,
    lib_arrow,
    lib_ingramv1,
    lib_jenne,
    lib_scansource,
    lib_wefi,
    vc2_constant,
    vc2_util,
    vc_vendorcfg,
    vc_log
) {
    var LogTitle = 'WebSvcLib',
        LogPrefix = '';

    function _validateVendorConfig(option) {
        var logTitle = [LogTitle, '_validateVendorConfig'].join('::');

        var poNum = option.poNum,
            vendorConfig = option.vendorConfig,
            endpoint = vendorConfig.endPoint,
            user = vendorConfig.user,
            password = vendorConfig.password,
            customerNo = vendorConfig.customerNo;

        if (!endpoint || !user || !password)
            throw Error('Incomplete webservice information for ' + vendorConfig.vendor);
    }

    /**
     * Mainly for debug
     */
    function handleRequest(option) {
        var logTitle = [LogTitle, 'handleRequest'].join('::');

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            country = option.country,
            countryCode = option.countryCode,
            responseXML;

        LogPrefix = '[purchaseorder:' + poId + '] ';

        if (vendorConfig) {
            var libVendor = _getVendorLibrary({
                vendorConfig: vendorConfig
            });

            if (libVendor) {
                _validateVendorConfig({
                    poNum: poNum,
                    vendorConfig: vendorConfig
                });
                responseXML = libVendor.processRequest({
                    poNum: poNum,
                    poId: poId,
                    vendorConfig: vendorConfig,
                    countryCode: countryCode,
                    fromDebug: true,
                    country: country
                });
            }
        }

        return responseXML;
    }

    function _handleResponse(option) {
        var logTitle = [LogTitle, '_handleResponse'].join('::');

        var outputArray = null,
            responseXML = option.responseXML,
            vendorConfig = option.vendorConfig,
            xmlVendor = vendorConfig.xmlVendor,
            libVendor = option.libVendor;

        outputArray = libVendor.processResponse({
            vendorConfig: vendorConfig,
            responseXML: responseXML
        });

        return outputArray;
    }

    function _getVendorLibrary(option) {
        var logTitle = [LogTitle, '_getVendorLibrary'].join('::');

        var vendorConfig = option.vendorConfig,
            xmlVendor = vendorConfig.xmlVendor,
            vendorList = vc2_constant.LIST.XML_VENDOR,
            xmlVendorText = vendorConfig.xmlVendorText,
            libVendor;

        vc2_util.log(logTitle, '>> XML Vendor:', xmlVendorText);

        switch (xmlVendor) {
            case vendorList.TECH_DATA:
                libVendor = lib_techdata;
                break;
            case vendorList.SYNNEX:
                libVendor = lib_synnex;
                break;
            case vendorList.DandH:
                libVendor = lib_dnh;
                break;
            case vendorList.INGRAM_MICRO:
                libVendor = lib_ingram;
                break;
            case vendorList.AVNET:
            case vendorList.WESTCON:
            case vendorList.ARROW:
                libVendor = lib_arrow;
                break;
            case vendorList.DELL:
                libVendor = lib_dell;
                break;
            case vendorList.INGRAM_MICRO_V_ONE:
                libVendor = lib_ingramv1;
                break;
            case vendorList.JENNE:
                libVendor = lib_jenne;
                break;
            case vendorList.SCANSOURCE:
                libVendor = lib_scansource;
                break;
            case vendorList.WEFI:
                libVendor = lib_wefi;
                break;
            default:
                log.error('Switch case vendor', 'XML Vendor not setup');
                break;
        }

        return libVendor;
    }

    function _checkDates(option) {
        var logTitle = [LogTitle, '_checkDates'].join('::');

        var poNum = option.poNum,
            startDate = option.startDate,
            tranDate = option.tranDate,
            xmlVendorText = option.xmlVendorText;

        var dtStartDate = vc2_util.parseDate(startDate),
            dtTranDate = vc2_util.parseDate(tranDate);

        return dtStartDate <= dtTranDate;
    }

    function _handleSingleVendor(option) {
        var logTitle = [LogTitle, '_handleSingleVendor'].join('::');

        var vendorConfig = option.vendorConfig,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            startDate = vendorConfig.startDate,
            xmlVendorText = vendorConfig.xmlVendorText,
            outputArray;

        LogPrefix = '[purchaseorder:' + poId + '] ';
        // vc2_util.LogPrefix = LogPrefix;

        _validateVendorConfig({ poNum: poNum, vendorConfig: vendorConfig });

        vc2_util.log(logTitle, '/// Current ', {
            poNum: poNum,
            tranDate: tranDate
            // vendorConfig: vendorConfig
        });

        var dateCheck = _checkDates({
            poNum: poNum,
            startDate: startDate,
            tranDate: tranDate,
            xmlVendorText: xmlVendorText
        });

        if (!dateCheck) {
            vc_log.recordLog({
                header: 'WebService',
                body:
                    'Invalid transaction date -- ' +
                    JSON.stringify({
                        'config startdate': startDate,
                        'transaction date': tranDate
                    }),
                transaction: poId,
                status: vc2_constant.LIST.VC_LOG_STATUS.ERROR
            });

            return false;
        }

        var libVendor = _getVendorLibrary({ vendorConfig: vendorConfig });
        if (!libVendor) return false;

        // try {
        outputArray = libVendor.process({
            poNum: poNum,
            poId: poId,
            countryCode: option.countryCode,
            vendorConfig: vendorConfig
        });

        vc_log.recordLog({
            header: 'Output Lines',
            body: !vc2_util.isEmpty(outputArray)
                ? JSON.stringify(outputArray)
                : '-no lines to process-',
            status: vc2_constant.LIST.VC_LOG_STATUS.INFO,
            transaction: poId
        });
        // } catch (e) {
        //     vc2_util.logError(logTitle, e);

        //     vc_log.recordLog({
        //         header: 'VAR Connect ERROR',
        //         body: JSON.stringify({
        //             error: vc2_util.extractError(e),
        //             details: JSON.stringify(e)
        //         }),
        //         status: vc2_constant.LIST.VC_LOG_STATUS.ERROR,
        //         transaction: poId
        //     });
        // }

        return outputArray;
    }

    function _handleMultipleVendor(option) {
        var logTitle = [LogTitle, '_handleMultipleVendor'].join('::');
        vc2_util.log(logTitle, '>> params: ', option);

        var vendor = option.vendor,
            subsidiary = option.subsidiary,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            configs = vc_vendorcfg.getMultipleConfigurations({
                vendor: vendor,
                subsidiary: subsidiary
            }),
            vendorConfigs = [],
            itemArray = [];

        LogPrefix = '[purchaseorder:' + poId + '] ';

        vc2_util.log(logTitle, '/// Params:', {
            poNum: poNum,
            tranDate: tranDate,
            configs: configs
        });

        for (var i = 0; i < configs.length; i++) {
            var config = configs[i],
                startDate = config.startDate,
                xmlVendorText = config.xmlVendorText;
            // log.debug('config ' + i, config);

            var dateCheck = _checkDates({
                poNum: poNum,
                startDate: startDate,
                tranDate: tranDate,
                xmlVendorText: xmlVendorText
            });

            if (!dateCheck) {
                vc_log.recordLog({
                    header: 'WebService',
                    body:
                        'Invalid transaction date -- ' +
                        JSON.stringify({
                            'config startdate': startDate,
                            'transaction date': tranDate
                        }),
                    transaction: poId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.ERROR
                });

                continue;
            }

            itemArray = itemArray.concat(
                _handleSingleVendor({
                    vendorConfig: config,
                    poNum: poNum,
                    poId: poId,
                    tranDate: tranDate
                })
            );
        }

        return itemArray;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::'),
            returnValue = {};

        var mainConfig = option.mainConfig,
            vendorConfig = option.vendorConfig,
            vendor = option.vendor,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            subsidiary = option.subsidiary,
            vendorList = vc2_constant.LIST.XML_VENDOR,
            xmlVendor = vendorConfig.xmlVendor,
            countryCode = option.countryCode,
            outputArray = null;

        LogPrefix = '[purchaseorder:' + poId + '] ';
        // vc2_util.LogPrefix = LogPrefix;

        try {
            if (!vendorConfig) throw 'No Vendor Config available for ' + vendor;

            returnValue.prefix = vendorConfig.fulfillmentPrefix;

            if (
                mainConfig.multipleIngram &&
                (xmlVendor == vendorList.INGRAM_MICRO_V_ONE || xmlVendor == vendorList.INGRAM_MICRO)
            ) {
                outputArray = _handleMultipleVendor({
                    vendor: vendor,
                    subsidiary: subsidiary,
                    poNum: poNum,
                    poId: poId,
                    countryCode: countryCode,
                    tranDate: tranDate
                });
            } else {
                outputArray = _handleSingleVendor({
                    vendorConfig: vendorConfig,
                    poNum: poNum,
                    poId: poId,
                    countryCode: countryCode,
                    tranDate: tranDate
                });
            }

            returnValue.itemArray = outputArray;
        } catch (e) {
            vc2_util.logError(logTitle, e);

            vc_log.recordLog({
                header: 'WebService::process',
                body: 'Error encountered: ' + vc2_util.extractError(e),
                transaction: poId,
                status: vc2_constant.LIST.VC_LOG_STATUS.ERROR
            });

            returnValue.isError = true;
            returnValue.errorMessage = vc2_util.extractError(e);
        }

        return returnValue;
    }

    return {
        handleRequest: handleRequest,
        process: process
    };
});
