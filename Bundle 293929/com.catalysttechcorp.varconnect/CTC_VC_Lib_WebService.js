define([
    'N/https',
    'N/search',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Utilities',
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
    constants,
    util,
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
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

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
            vendorConfig = options.vendorConfig,
            country = options.country,
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
                    vendorConfig: vendorConfig,
                    country: country,
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
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

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

        // log.debug(
        //     xmlVendorText + ' ' + poNum + ' dates',
        //     'startDate ' + startDate + ' tranDate ' + tranDate
        // );
        // log.debug('check dates', new Date(startDate) < new Date(tranDate));

        return new Date(startDate) < new Date(tranDate);
    }

    function _handleSingleVendor(options) {
        var logTitle = [LogTitle, '_handleSingleVendor'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        var vendorConfig = options.vendorConfig,
            poNum = options.poNum,
            poId = options.poId,
            tranDate = options.tranDate,
            startDate = vendorConfig.startDate,
            xmlVendorText = vendorConfig.xmlVendorText,
            outputArray;

        //		log.debug(poNum + ' dates', 'startDate ' + startDate + ' tranDate ' + tranDate);
        //		log.debug('check dates', new Date(startDate) < new Date(tranDate));

        //		if (new Date(startDate) < new Date(tranDate)) {
        var dateCheck = _checkDates({
            poNum: poNum,
            startDate: startDate,
            tranDate: tranDate,
            xmlVendorText: xmlVendorText
        });

        if (dateCheck) {
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
        } else {
            log.audit(logTitle, '>> Invalid Date ');
        }

        log.audit(logTitle, '>> Output Array: ' + JSON.stringify(outputArray));

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

                if (dateCheck) {
                    itemArray = itemArray.concat(
                        _handleSingleVendor({
                            vendorConfig: config,
                            poNum: poNum,
                            poId: poId,
                            tranDate: tranDate
                        })
                    );
                }
            } catch (e) {
                log.error(logTitle, '!! ERROR !!' + util.extractError(e));
            }
        }

        return itemArray;
    }

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, '>> params: ' + JSON.stringify(options));

        try {
            var mainConfig = options.mainConfig,
                vendorConfig = options.vendorConfig,
                vendor = options.vendor,
                poNum = options.poNum,
                poId = options.poId,
                tranDate = options.tranDate,
                subsidiary = options.subsidiary,
                vendorList = constants.Lists.XML_VENDOR,
                xmlVendor = vendorConfig.xmlVendor,
                outputArray = null;

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
                        tranDate: tranDate
                    });
                } else {
                    outputArray = _handleSingleVendor({
                        vendorConfig: vendorConfig,
                        poNum: poNum,
                        poId: poId,
                        tranDate: tranDate
                    });
                }
            } else log.error('No Vendor Config available for ' + vendor);

            return {
                itemArray: outputArray,
                prefix: vendorConfig.fulfillmentPrefix
            };
        } catch (e) {
            log.error(logTitle, '!! ERROR !!' + util.extractError(e));
        }
    }

    return {
        handleRequest: handleRequest,
        process: process
    };
});
