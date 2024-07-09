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
    './CTC_VC_Lib_Carahsoft.js',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils',
    'N/format'
], function (
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
    lib_carahsoft,
    vc_vendorcfg,
    vc2_constant,
    vc2_util,
    ns_format
) {
    var LogTitle = 'WebSvcLib',
        LogPrefix = '';

    function _validateVendorConfig(option) {
        var logTitle = [LogTitle, '_validateVendorConfig'].join('::');

        var poNum = option.poNum,
            OrderCFG = option.orderConfig,
            endpoint = OrderCFG.endPoint,
            user = OrderCFG.user,
            password = OrderCFG.password,
            customerNo = OrderCFG.customerNo;

        if (!endpoint || !user || !password) throw Error('Incomplete webservice information for ' + OrderCFG.vendor);
    }

    /**
     * Mainly for debug
     */
    function handleRequest(option) {
        var logTitle = [LogTitle, 'handleRequest'].join('::');

        var poNum = option.poNum,
            poId = option.poId,
            OrderCFG = option.orderConfig,
            country = option.country,
            countryCode = option.countryCode,
            responseXML;

        LogPrefix = '[purchaseorder:' + poId + '] ';

        if (OrderCFG) {
            var libVendor = _getVendorLibrary({
                orderConfig: OrderCFG
            });

            if (libVendor) {
                _validateVendorConfig({
                    poNum: poNum,
                    orderConfig: OrderCFG
                });
                responseXML = libVendor.processRequest({
                    poNum: poNum,
                    poId: poId,
                    orderConfig: OrderCFG,
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
            OrderCFG = option.orderConfig,
            xmlVendor = OrderCFG.xmlVendor,
            libVendor = option.libVendor;

        outputArray = libVendor.processResponse({
            orderConfig: OrderCFG,
            responseXML: responseXML
        });

        return outputArray;
    }

    function _getVendorLibrary(option) {
        var logTitle = [LogTitle, '_getVendorLibrary'].join('::');

        var OrderCFG = option.orderConfig,
            xmlVendor = OrderCFG.xmlVendor,
            vendorList = vc2_constant.LIST.XML_VENDOR,
            xmlVendorText = OrderCFG.xmlVendorText,
            libVendor;

        vc2_util.log(logTitle, '>> XML Vendor:', xmlVendor);

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
            case vendorList.CARAHSOFT:
                libVendor = lib_carahsoft;
                break;
            default:
                log.error('Switch case vendor', 'XML Vendor not setup');
                break;
        }

        return libVendor;
    }

    function parseDate(option) {
        var logTitle = [LogTitle, 'parseDate'].join('::');
        option = option || {};

        var dateString = option.dateString || option,
            date = null;

        if (dateString && dateString.length > 0 && dateString != 'NA') {
            try {
                var multipleDateStrArr = dateString.replace(/\n/g, ' ').split(' ');
                for (var i = 0; i < multipleDateStrArr.length; i++) {
                    var singleDateStr = multipleDateStrArr[i];
                    if (singleDateStr) {
                        var stringArr = singleDateStr.split('T'); //handle timestamps with T
                        var dateComponent = stringArr[0];
                        var convertedDate = null;
                        try {
                            convertedDate = ns_format.parse({
                                value: singleDateStr,
                                type: ns_format.Type.DATE
                            });
                        } catch (dateParseErr) {
                            try {
                                convertedDate = ns_format.parse({
                                    value: dateComponent,
                                    type: ns_format.Type.DATE
                                });
                            } catch (dateParseErr) {
                                // do nothing
                            }
                        }
                        if (!convertedDate) {
                            try {
                                convertedDate = new Date(singleDateStr);
                            } catch (dateParseErr) {
                                try {
                                    convertedDate = new Date(dateComponent);
                                } catch (dateParseErr) {
                                    // do nothing
                                }
                            }
                        }
                        if (!convertedDate) {
                            try {
                                singleDateStr = singleDateStr.replace(/-/g, '/');
                                convertedDate = new Date(singleDateStr);
                            } catch (dateParseErr) {
                                try {
                                    dateComponent = dateComponent.replace(/-/g, '/');
                                    convertedDate = new Date(dateComponent);
                                } catch (dateParseErr) {
                                    // do nothing
                                }
                            }
                        }
                        if (!convertedDate) {
                            vc2_util.logError('Unable to recognize date format.', e);
                            date = dateString;
                        } else {
                            date = convertedDate;
                        }
                    }
                }
            } catch (e) {
                vc2_util.logError(logTitle, e);
            }
        }
        return date;
    }

    function _checkDates(option) {
        var logTitle = [LogTitle, '_checkDates'].join('::');

        vc2_util.log(logTitle, '.. check dates: ', option);

        var poNum = option.poNum,
            startDate = option.startDate,
            tranDate = option.tranDate,
            xmlVendorText = option.xmlVendorText;

        var dtStartDate = parseDate(startDate),
            dtTranDate = parseDate(tranDate);

        vc2_util.log(logTitle, '>> check dates: ', [dtStartDate, dtTranDate, dtStartDate <= dtTranDate]);

        return dtStartDate <= dtTranDate;
    }

    function _handleSingleVendor(option) {
        var logTitle = [LogTitle, '_handleSingleVendor'].join('::');

        var OrderCFG = option.orderConfig,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            startDate = OrderCFG.startDate,
            xmlVendorText = OrderCFG.xmlVendorText,
            outputArray;

        LogPrefix = '[purchaseorder:' + poId + '] ';

        _validateVendorConfig({ poNum: poNum, orderConfig: OrderCFG });

        vc2_util.log(logTitle, '/// Current ', {
            poNum: poNum,
            startDate: startDate,
            tranDate: tranDate,
            xmlVendorText: xmlVendorText
        });

        // validate the date
        var isValidDate = vc2_util.parseNSDate(tranDate) > vc2_util.parseNSDate(startDate);

        if (!isValidDate) {
            vc2_util.vcLog({
                title: 'WebService | Date Check',
                error:
                    'Invalid transaction date -- ' +
                    JSON.stringify({
                        'config startdate': startDate,
                        'transaction date': tranDate
                    }),
                recordId: poId,
                status: vc2_constant.LIST.VC_LOG_STATUS.INFO
            });

            return false;
        }

        var libVendor = _getVendorLibrary({ orderConfig: OrderCFG });
        if (!libVendor) return false;

        // try {
        outputArray = libVendor.process({
            poNum: poNum,
            poId: poId,
            countryCode: option.countryCode,
            orderConfig: OrderCFG
        });

        vc2_util.vcLog({
            recordId: poId,
            title: 'WebService | Output Lines',
            body: !vc2_util.isEmpty(outputArray) ? JSON.stringify(outputArray) : '-no lines to process-',
            status: vc2_constant.LIST.VC_LOG_STATUS.INFO
        });

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
                vc2_util.vcLog({
                    title: 'WebService | Date Check',
                    error:
                        'Invalid transaction date -- ' +
                        JSON.stringify({
                            'config startdate': startDate,
                            'transaction date': tranDate
                        }),
                    recordId: poId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
                });

                continue;
            }

            itemArray = itemArray.concat(
                _handleSingleVendor({
                    orderConfig: config,
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

        var MainCFG = option.mainConfig,
            OrderCFG = option.orderConfig,
            vendor = option.vendor,
            poNum = option.poNum,
            poId = option.poId,
            tranDate = option.tranDate,
            subsidiary = option.subsidiary,
            vendorList = vc2_constant.LIST.XML_VENDOR,
            xmlVendor = OrderCFG.xmlVendor,
            countryCode = option.countryCode,
            outputArray = null;

        LogPrefix = '[purchaseorder:' + poId + '] ';

        try {
            if (!OrderCFG) throw 'No Vendor Config available for ' + vendor;

            returnValue.prefix = OrderCFG.fulfillmentPrefix;

            // if (
            //     MainCFG.multipleIngram &&
            //     (xmlVendor == vendorList.INGRAM_MICRO_V_ONE || xmlVendor == vendorList.INGRAM_MICRO)
            // ) {
            //     outputArray = _handleMultipleVendor({
            //         vendor: vendor,
            //         subsidiary: subsidiary,
            //         poNum: poNum,
            //         poId: poId,
            //         countryCode: countryCode,
            //         tranDate: tranDate
            //     });
            // } else {
            outputArray = _handleSingleVendor({
                orderConfig: OrderCFG,
                poNum: poNum,
                poId: poId,
                countryCode: countryCode,
                tranDate: tranDate
            });
            // }

            returnValue.itemArray = outputArray;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            var errorMsg = vc2_util.extractError(error);

            // vc2_util.vcLog({
            //     recordId: poId,
            //     title: 'WebService | Error encountered',
            //     details: errorMsg,
            //     status: vc2_constant.LIST.VC_LOG_STATUS.WS_ERROR
            // });

            returnValue.isError = true;
            returnValue.errorMessage = errorMsg;
        }

        return returnValue;
    }

    return {
        handleRequest: handleRequest,
        process: process
    };
});
