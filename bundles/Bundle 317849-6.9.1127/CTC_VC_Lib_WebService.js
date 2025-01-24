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
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_Synnex',
    './CTC_VC_Lib_TechData',
    './CTC_VC_Lib_DandH',
    './CTC_VC_Lib_Ingram',
    './CTC_VC_Lib_Dell',
    './CTC_VC_Lib_Arrow',
    './CTC_VC_Lib_Ingram_v1',
    './CTC_VC_Lib_Jenne',
    './CTC_VC_Lib_ScanSource',
    './CTC_VC_Lib_Log.js'
], function (
    https,
    search,
    format,
    constants,
    vc_util,
    libVendorConfig,
    libSynnex,
    libTechData,
    libDandH,
    libIngram,
    libDell,
    libArrow,
    libIngramV1,
    libJenne,
    libScanSource,
    vcLog
) {
    var LogTitle = 'WebSvcLib',
        LogPrefix = '';

    function _validateVendorConfig(option) {
        var logTitle = [LogTitle, '_validateVendorConfig'].join('::');
        // log.audit(logTitle, '>> params: ' + JSON.stringify(option));

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
        log.audit(logTitle, '>> params: ' + JSON.stringify(option));

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

            // log.debug('Lib_WS: libVendor', !!libVendor);
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

            // log.debug('Lib_WS: response ' + poNum, responseXML);
        }

        return responseXML;
    }

    function _handleResponse(option) {
        var logTitle = [LogTitle, '_handleResponse'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(option));

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
        // log.audit(logTitle, '>> params: ' + JSON.stringify(option));

        var vendorConfig = option.vendorConfig,
            xmlVendor = vendorConfig.xmlVendor,
            vendorList = constants.Lists.XML_VENDOR,
            xmlVendorText = vendorConfig.xmlVendorText,
            libVendor;

        log.audit(logTitle, '>> XML Vendor: ' + xmlVendorText);

        switch (xmlVendor) {
            case vendorList.TECH_DATA:
                libVendor = libTechData;
                break;
            case vendorList.SYNNEX:
                libVendor = libSynnex;
                break;
            case vendorList.DandH:
                libVendor = libDandH;
                break;
            case vendorList.INGRAM_MICRO:
                libVendor = libIngram;
                break;
            case vendorList.AVNET:
            case vendorList.WESTCON:
            case vendorList.ARROW:
                libVendor = libArrow;
                break;
            case vendorList.DELL:
                libVendor = libDell;
                break;
            case vendorList.INGRAM_MICRO_V_ONE:
                libVendor = libIngramV1;
                break;
            case vendorList.JENNE:
                libVendor = libJenne;
                break;
            case vendorList.SCANSOURCE:
                libVendor = libScanSource;
                break;
            default:
                log.error('Switch case vendor', 'XML Vendor not setup');
                break;
        }

        return libVendor;
    }

    function _checkDates(option) {
        var logTitle = [LogTitle, '_checkDates'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(option));

        var poNum = option.poNum,
            startDate = option.startDate,
            tranDate = option.tranDate,
            xmlVendorText = option.xmlVendorText;

        var dtStartDate = vc_util.parseDate(startDate),
            dtTranDate = vc_util.parseDate(tranDate);

        log.audit(
            logTitle,
            '>> check dates: ' + JSON.stringify([dtStartDate, dtTranDate, dtStartDate < dtTranDate])
        );

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
        log.audit(
            logTitle,
            LogPrefix +
                '/// ' +
                JSON.stringify({
                    poNum: poNum,
                    tranDate: tranDate,
                    vendorConfig: vendorConfig
                })
        );

        var dateCheck = _checkDates({
            poNum: poNum,
            startDate: startDate,
            tranDate: tranDate,
            xmlVendorText: xmlVendorText
        });

        if (!dateCheck) {
            vcLog.recordLog({
                header: 'WebService',
                body:
                    'Invalid transaction date -- ' +
                    JSON.stringify({
                        'config startdate': startDate,
                        'transaction date': tranDate
                    }),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.ERROR
            });

            return false;
        }

        var libVendor = _getVendorLibrary({
            vendorConfig: vendorConfig
        });

        if (libVendor) {
            _validateVendorConfig({
                poNum: poNum,
                vendorConfig: vendorConfig
            });
            try {
                outputArray = libVendor.process({
                    poNum: poNum,
                    poId: poId,
                    countryCode: option.countryCode,
                    vendorConfig: vendorConfig
                });
            } catch (e) {
                log.error(logTitle, LogPrefix + '!! ERROR !!' + vc_util.extractError(e));

                vcLog.recordLog({
                    header: 'VAR Connect ERROR',
                    body: JSON.stringify({
                        error: vc_util.extractError(e),
                        details: JSON.stringify(e)
                    }),
                    status: constants.Lists.VC_LOG_STATUS.ERROR,
                    transaction: poId
                });
            }
        }

        // log.audit(logTitle, '>> Order Lines: ' + JSON.stringify(outputArray));

        return outputArray;
    }

    function _handleMultipleVendor(option) {
        var logTitle = [LogTitle, '_handleMultipleVendor'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(option));

        var vendor = option.vendor,
            subsidiary = option.subsidiary,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            configs = libVendorConfig.getMultipleConfigurations({
                vendor: vendor,
                subsidiary: subsidiary
            }),
            vendorConfigs = [],
            itemArray = [];

        LogPrefix = '[purchaseorder:' + poId + '] ';
        log.audit(
            logTitle,
            LogPrefix +
                '/// ' +
                JSON.stringify({
                    poNum: poNum,
                    tranDate: tranDate,
                    configs: configs
                })
        );

        for (var i = 0; i < configs.length; i++) {
            try {
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
                    vcLog.recordLog({
                        header: 'WebService',
                        body:
                            'Invalid transaction date -- ' +
                            JSON.stringify({
                                'config startdate': startDate,
                                'transaction date': tranDate
                            }),
                        transaction: poId,
                        status: constants.Lists.VC_LOG_STATUS.ERROR
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
            } catch (e) {
                log.error(logTitle, LogPrefix + '!! ERROR !!' + JSON.stringify(e));

                vcLog.recordLog({
                    header: 'WebService',
                    body: 'Error encountered: ' + vc_util.extractError(e),
                    transaction: poId,
                    status: constants.Lists.VC_LOG_STATUS.ERROR
                });
            }
        }

        return itemArray;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, option);

        var mainConfig = option.mainConfig,
            vendorConfig = option.vendorConfig,
            vendor = option.vendor,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            subsidiary = option.subsidiary,
            vendorList = constants.Lists.XML_VENDOR,
            xmlVendor = vendorConfig.xmlVendor,
            countryCode = option.countryCode,
            outputArray = null;

        LogPrefix = '[purchaseorder:' + poId + '] ';

        try {
            if (vendorConfig) {
                if (
                    mainConfig.multipleIngram &&
                    (xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
                        xmlVendor == vendorList.INGRAM_MICRO)
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
            } else throw 'No Vendor Config available for ' + vendor;

            return {
                itemArray: outputArray,
                prefix: vendorConfig.fulfillmentPrefix
            };
        } catch (e) {
            log.error(logTitle, LogPrefix + '!! ERROR !!' + JSON.stringify(e));

            vcLog.recordLog({
                header: 'WebService::process',
                body: 'Error encountered: ' + vc_util.extractError(e),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.ERROR
            });
        }
    }

    return {
        handleRequest: handleRequest,
        process: process
    };
});
