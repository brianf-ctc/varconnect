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
    './CTC_VC_Lib_Utilities',
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
    util,
    vc2Utils,
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
    var LogTitle = 'WebSvcLib';

    function _validateVendorConfig(options) {
        var logTitle = [LogTitle, '_validateVendorConfig'].join('::');
        // log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var poNum = options.poNum,
            vendorConfig = options.vendorConfig,
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
    function handleRequest(options) {
        var logTitle = [LogTitle, 'handleRequest'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
            country = options.country,
            countryCode = options.countryCode,
            responseXML;

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

    function _handleResponse(options) {
        var logTitle = [LogTitle, '_handleResponse'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var outputArray = null,
            responseXML = options.responseXML,
            vendorConfig = options.vendorConfig,
            xmlVendor = vendorConfig.xmlVendor,
            libVendor = options.libVendor;

        outputArray = libVendor.processResponse({
            vendorConfig: vendorConfig,
            responseXML: responseXML
        });

        return outputArray;
    }

    function _getVendorLibrary(options) {
        var logTitle = [LogTitle, '_getVendorLibrary'].join('::');
        // log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var vendorConfig = options.vendorConfig,
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

    function _checkDates(options) {
        var logTitle = [LogTitle, '_checkDates'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var poNum = options.poNum,
            startDate = options.startDate,
            tranDate = options.tranDate,
            xmlVendorText = options.xmlVendorText;

        var dtStartDate = vc2Utils.parseDate(startDate),
            dtTranDate = vc2Utils.parseDate(tranDate);

        log.audit(
            logTitle,
            '>> check dates: ' + JSON.stringify([dtStartDate, dtTranDate, dtStartDate < dtTranDate])
        );

        return dtStartDate <= dtTranDate;
    }

    function _handleSingleVendor(options) {
        var logTitle = [LogTitle, '_handleSingleVendor'].join('::');

        log.audit(logTitle, options);

        var vendorConfig = options.vendorConfig,
            poNum = options.poNum,
            poId = options.poId,
            tranDate = options.tranDate,
            startDate = vendorConfig.startDate,
            xmlVendorText = vendorConfig.xmlVendorText,
            outputArray;

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
                    countryCode: options.countryCode,
                    vendorConfig: vendorConfig
                });
            } catch (e) {
                log.error(logTitle, '!! ERROR !!' + util.extractError(e));

                vcLog.recordLog({
                    header: 'VAR Connect ERROR',
                    body: JSON.stringify({
                        error: util.extractError(e),
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

    function _handleMultipleVendor(options) {
        var logTitle = [LogTitle, '_handleMultipleVendor'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var vendor = options.vendor,
            subsidiary = options.subsidiary,
            poNum = options.poNum,
            poId = options.poId,
            tranDate = options.tranDate,
            configs = libVendorConfig.getMultipleConfigurations({
                vendor: vendor,
                subsidiary: subsidiary
            }),
            vendorConfigs = [],
            itemArray = [];

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
                log.error(logTitle, '!! ERROR !!' + JSON.stringify(e));

                vcLog.recordLog({
                    header: 'WebService',
                    body: 'Error encountered: ' + vc2Utils.extractError(e),
                    transaction: poId,
                    status: constants.Lists.VC_LOG_STATUS.ERROR
                });
            }
        }

        return itemArray;
    }

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, options);

        var mainConfig = options.mainConfig,
            vendorConfig = options.vendorConfig,
            vendor = options.vendor,
            poNum = options.poNum,
            poId = options.poId,
            tranDate = options.tranDate,
            subsidiary = options.subsidiary,
            vendorList = constants.Lists.XML_VENDOR,
            xmlVendor = vendorConfig.xmlVendor,
            countryCode = options.countryCode,
            outputArray = null;

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
            } else log.error('No Vendor Config available for ' + vendor);

            return {
                itemArray: outputArray,
                prefix: vendorConfig.fulfillmentPrefix
            };
        } catch (e) {
            log.error(logTitle, '!! ERROR !!' + JSON.stringify(e));

            vcLog.recordLog({
                header: 'WebService::process',
                body: 'Error encountered: ' + vc2Utils.extractError(e),
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
