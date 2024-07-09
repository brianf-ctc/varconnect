/**
 * Copyright (c) 2024  sCatalyst Tech Corp
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
define(function (require) {
    const LogTitle = 'SVC:ConfigLib',
        LOG_APP = 'ConfigLib';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_https = require('N/https');

    var MAIN_CFG = vc2_constant.RECORD.MAIN_CONFIG,
        MAIN_CFG_MAP = vc2_constant.MAPPING.MAIN_CONFIG,
        // vendor config fields/map
        VENDOR_CFG = vc2_constant.RECORD.VENDOR_CONFIG,
        VENDOR_CFG_MAP = vc2_constant.MAPPING.VENDOR_CONFIG,
        // bill vendor config fields/map
        BILL_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG,
        BILL_CFG_MAP = vc2_constant.MAPPING.BILLCREATE_CONFIG,
        // sendpo vendor config
        SENDPOVND_CFG = vc2_constant.RECORD.SENDPOVENDOR_CONFIG,
        SENDPOVND_CFG_MAP = vc2_constant.MAPPING.SENDPOVND_CONFIG;

    var VC_LICENSE = vc2_constant.LICENSE;

    var LibLicense = {
        fetchLicense: function (option) {
            var logTitle = 'VC_LICENSE::fetchLicense',
                logPrefix = '[LICENSE-CHECK] ',
                response,
                returnValue = {};

            vc2_util.LogPrefix = logPrefix;

            var startTime = new Date();

            var doRetry = option.doRetry,
                maxRetry = doRetry ? option.maxRetry || VC_LICENSE.MAX_RETRY : 0,
                retryCount = option.retryCount || 1,
                retryWaitMS = option.retryWaitMS || option.retryWait || 2000;

            try {
                var queryOption = {
                    method: ns_https.Method.GET,
                    url:
                        VC_LICENSE.URL +
                        '?' +
                        ('producttypeid=' + VC_LICENSE.PRODUCT_CODE) +
                        ('&nsaccountid=' + ns_runtime.accountId)
                };
                vc2_util.log(logTitle, 'Send Request query: ', queryOption);
                response = ns_https.request(queryOption);
                vc2_util.log(logTitle, 'Response: ', response);

                if (!response || !response.body) throw 'Unable to get response';
                if (!response.code || response.code !== 200) throw 'Received invalid response code - ' + response.code;

                // turn off retry from this point, since we can confirm that we are able to connect
                doRetry = false;

                var parsedResp = vc2_util.safeParse(response.body);
                if (!parsedResp) throw 'Unable to parse response';

                returnValue = parsedResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = vc2_util.extractError(error);

                if (doRetry && maxRetry > retryCount) {
                    vc2_util.log(logTitle, '... retry count : ' + retryCount);
                    option.retryCount = retryCount + 1;
                    vc2_util.waitMs(retryWaitMS); // wait before re-sending
                    LibLicense.fetchLicense(option);
                }
            } finally {
                var durationSec = vc2_util.roundOff((new Date() - startTime) / 1000);
                vc2_util.log(logTitle, '# response time: ' + durationSec + 's');
            }

            return returnValue;
        },
        validate: function (option) {
            var logTitle = 'VC_LICENSE::validate',
                logPrefix = '[LICENSE-CHECK] ',
                returnValue = {};

            vc2_util.LogPrefix = logPrefix;

            try {
                // prep the cache
                var vcLicenseResp = vc2_util.getNSCache({ name: VC_LICENSE.KEY });
                vcLicenseResp = vc2_util.safeParse(vcLicenseResp);

                vc2_util.log(logTitle, '..vcLicenseResp', vcLicenseResp);

                if (!vcLicenseResp || vcLicenseResp.error || vcLicenseResp.status == 'inactive') {
                    vcLicenseResp = LibLicense.fetchLicense(option);

                    if (vcLicenseResp && !vcLicenseResp.error)
                        vc2_util.setNSCache({
                            name: VC_LICENSE.KEY,
                            value: vcLicenseResp,
                            cacheTTL: VC_LICENSE.CACHE_TTL
                        });
                }

                if (!vcLicenseResp || vcLicenseResp.error || vcLicenseResp.isError || vcLicenseResp.hasError)
                    throw vcLicenseResp.error || vcLicenseResp.errorMsg || vcLicenseResp.message;

                if (!vcLicenseResp.status) throw 'Unable to fetch license status';
                if (vcLicenseResp.status != 'active') throw 'License is not active';

                returnValue = vcLicenseResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = vc2_util.extractError(error);
            }

            return returnValue;
        }
    };

    var Helper = {
        fetchVendorFromPO: function (poId) {
            if (!poId) return false;

            var lookupOption = {
                type: 'purchaseorder',
                id: poId,
                columns: [
                    'internalid',
                    'entity',
                    'vendor.internalid',
                    'vendor.entityid',
                    'vendor.custentity_vc_bill_config'
                ]
            };
            if (vc2_util.isOneWorld()) lookupOption.columns.push('subsidiary');
            var result = vc2_util.flatLookup(lookupOption);
            vc2_util.log('Helper.fetchVendorFromPO', '// PO Data: ', result);

            return result;
        },

        fetchVendorData: function (vendorId) {
            if (!vendorId) return false;

            var searchOption = {
                type: 'vendor',
                filters: [['internalid', 'anyof', vendorId]],
                columns: ['internalid', 'entityid', 'custentity_vc_bill_config']
            };
            if (vc2_util.isOneWorld()) searchOption.columns.push('subsidiary');

            var result = {};
            ns_search
                .create(searchOption)
                .run()
                .each(function (row) {
                    result.internalid = row.id;
                    result.custentity_vc_bill_config = row.getValue({
                        name: 'custentity_vc_bill_config'
                    });

                    // check if multiple
                    var billConfigs = result.custentity_vc_bill_config.split(/,/);
                    if (billConfigs.length > 1) result.custentity_vc_bill_config = billConfigs;

                    if (vc2_util.isOneWorld()) result.subsidiary = row.getValue({ name: 'subsidiary' });
                    return true;
                });

            vc2_util.log('Helper.fetchVendorData', '// Vendor Data: ', result);

            return result;
        }
    };

    var EndPoint = {
        orderConfig: {},
        //
        mainConfig: function (option) {
            var logTitle = [LogTitle, 'mainConfig'].join(':'),
                option = option || {},
                returnValue;

            var mainConfigData = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.MAIN_CONFIG,
                isJSON: true
            });

            var forced = option && option.forced;

            // vc2_util.log(logTitle, '>> main config: ', option);

            if (!mainConfigData || forced) {
                // vc2_util.log(logTitle, '## FETCH Main COnfig ## ', forced);

                // do the main config search
                var searchObj = ns_search.create({
                    type: MAIN_CFG.ID,
                    filters: [['isinactive', 'is', 'F']],
                    columns: (function () {
                        var flds = [];
                        for (var fld in MAIN_CFG_MAP) flds.push(MAIN_CFG_MAP[fld]);
                        return flds;
                    })()
                });
                mainConfigData = {};

                searchObj.run().each(function (row) {
                    for (var fld in MAIN_CFG_MAP) {
                        var rowValue = row.getValue({ name: MAIN_CFG_MAP[fld] });
                        mainConfigData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });

                mainConfigData.allowedVarianceAmountThreshold = vc2_util.parseFloat(
                    mainConfigData.allowedVarianceAmountThreshold || '0'
                );

                if (!mainConfigData) throw 'No Configuration available';
                // vc2_util.log(logTitle, 'mainConfig>> ', mainConfigData);

                vc2_util.setNSCache({
                    name: vc2_constant.CACHE_KEY.MAIN_CONFIG,
                    value: mainConfigData
                });
            }

            returnValue = mainConfigData;

            vc2_util.log(logTitle, '// MAIN CONFIG', returnValue);

            return returnValue;
        },
        orderVendorConfig: function (option) {
            var logTitle = [LogTitle, 'orderVendorConfig'].join(':'),
                returnValue;

            var configId = option.configId || option.id,
                vendorId = option.vendor || option.vendorId,
                subsId = option.subsidiary || option.subsidiaryId,
                poId = option.poId,
                cacheKey = '',
                cacheParams = [];

            // vc2_util.log(logTitle, '>> vendor config: ', option);

            var searchOption = {
                type: VENDOR_CFG.ID,
                filters: [['isinactive', 'is', 'F'], 'AND'],
                columns: (function () {
                    var flds = [];
                    for (var fld in VENDOR_CFG.FIELD) {
                        flds.push(VENDOR_CFG.FIELD[fld]);
                    }
                    flds.push({ name: 'country', join: VENDOR_CFG.FIELD.SUBSIDIARY });
                    return flds;
                })()
            };

            if (configId) {
                searchOption.filters.push(['internalid', 'anyof', configId]);
                cacheParams.push('id=' + configId);
            } else {
                if (poId && !vendorId) {
                    var vendorInfo = Helper.fetchVendorFromPO(poId);
                    vendorId = vendorInfo.entity.value || vendorInfo.entity;
                    subsId = vendorInfo.subsidiary.value || vendorInfo.subsidiary || null;
                    cacheParams.push('poid=' + poId);
                }

                if (vendorId) {
                    searchOption.filters.push([VENDOR_CFG.FIELD.VENDOR, 'anyof', vendorId]);
                    cacheParams.push('vendor=' + vendorId);
                }
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
                    if (searchOption.filters.length) searchOption.filters.push('AND');
                    searchOption.filters.push([VENDOR_CFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                    cacheParams.push('subs=' + subsId);
                }
            }

            if (!cacheParams || !cacheParams.length) {
                vc2_util.log(logTitle, 'Missing vendor configuration parameters!');
                return false;
            }

            cacheKey = vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__' + cacheParams.join('&');
            var configData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });

            if (!configData || option.forced) {
                configData = {};
                var searchObj = ns_search.create(searchOption);

                searchObj.run().each(function (row) {
                    for (var fld in VENDOR_CFG_MAP) {
                        var rowValue = row.getValue({ name: VENDOR_CFG_MAP[fld] });
                        configData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }

                    configData.xmlVendorText = row.getText({ name: VENDOR_CFG.FIELD.XML_VENDOR });

                    configData.country = row.getValue({
                        name: 'country',
                        join: VENDOR_CFG.FIELD.SUBSIDIARY
                    });

                    return true;
                });
                if (vc2_util.isEmpty(configData)) {
                    vc2_util.log(logTitle, 'No Vendor Configuration available');
                    return false;
                }

                vc2_util.setNSCache({ name: cacheKey, value: configData });
            }
            returnValue = configData;

            // add the cache to the cache list
            var vendorCacheList = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST',
                isJSON: true
            });

            if (!vendorCacheList) vendorCacheList = { LIST: [vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST'] };

            if (!vc2_util.inArray(cacheKey, vendorCacheList.LIST)) vendorCacheList.LIST.push(cacheKey);

            vc2_util.setNSCache({
                name: vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST',
                value: vendorCacheList
            });

            if (option.forced) {
                // run through each
                vendorCacheList.forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
                vc2_util.removeCache({ name: vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST' });
            }
            ///

            vc2_util.log(logTitle, '// VENDOR CONFIG', returnValue);
            return returnValue;
        },
        billVendorConfig: function (option) {
            var logTitle = [LogTitle, 'billVendorConfig'].join(':'),
                returnValue;

            var configId = option.configId || option.id,
                vendorId = option.vendor || option.vendorId,
                subsId = option.subsidiary || option.subsidiaryId,
                poId = option.poId,
                cacheKey = '',
                cacheParams = [];

            // search for our billCreateConfig
            var searchOption = {
                type: BILL_CFG.ID,
                filters: [],
                columns: (function () {
                    var flds = [];
                    for (var fld in BILL_CFG_MAP) flds.push(BILL_CFG_MAP[fld]);
                    return flds;
                })()
            };

            if (poId && !vendorId) {
                var orderInfo = Helper.fetchVendorFromPO(poId);
                vendorId = orderInfo.entity.value || orderInfo.entity;
                subsId = orderInfo.subsidiary.value || orderInfo.subsidiary || null;
                cacheParams.push('poid=' + poId);
            }
            if (vendorId && !configId) {
                var vendorData = Helper.fetchVendorData(vendorId);
                configId = vendorData.custentity_vc_bill_config;

                vc2_util.log(logTitle, '## VENDOR DATA -- ', vendorData);
                cacheParams.push('vendor=' + vendorId);
            }

            vc2_util.log(logTitle, 'cacheParams'.cacheParams);

            if (!configId) {
                vc2_util.log(logTitle, '## NO BILL CONFIG ON VENDOR ##');
                return false;
            }

            searchOption.filters.push(['internalid', 'anyof', configId]);
            cacheParams.push('id=' + configId);

            if (subsId && util.isArray(configId) && configId.length) {
                searchOption.filters.push('AND', [BILL_CFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                cacheParams.push('subs=' + subsId);
            }

            if (!cacheParams || !cacheParams.length) {
                vc2_util.log(logTitle, 'Missing bill vendor configuration parameters!');
                return false;
            }

            cacheKey = vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__' + cacheParams.join('&');
            var configData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });

            if (!configData || option.forced) {
                vc2_util.log(logTitle, '// search Option ', searchOption.filters);

                configData = {};
                var searchObj = ns_search.create(searchOption);

                searchObj.run().each(function (row) {
                    for (var fld in BILL_CFG_MAP) {
                        var rowValue = row.getValue({ name: BILL_CFG_MAP[fld] });
                        configData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });
                if (vc2_util.isEmpty(configData)) {
                    vc2_util.log(logTitle, 'No Bill Vendor Configuration found');
                    return false;
                } else vc2_util.setNSCache({ name: cacheKey, value: configData });
            }
            returnValue = configData;

            // add it on the VC Config List

            // add the cache to the cache list
            var configCacheList = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST',
                isJSON: true
            });

            if (!configCacheList)
                configCacheList = {
                    LIST: [vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST']
                };

            if (!vc2_util.inArray(cacheKey, configCacheList.LIST)) configCacheList.LIST.push(cacheKey);

            vc2_util.setNSCache({
                name: vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST',
                value: configCacheList
            });

            // if option.forced //
            if (option.forced) {
                configCacheList.forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
                vc2_util.removeCache({ name: vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST' });
            }
            ///

            vc2_util.log(logTitle, '// BILL CONFIG', returnValue);

            return returnValue;
        },
        sendPOVendorConfig: function (option) {
            var logTitle = [LogTitle, 'sendPOVendorConfig'].join(':'),
                returnValue;

            var configId = option.configId || option.id,
                vendorId = option.vendor || option.vendorId,
                subsId = option.subsidiary || option.subsidiaryId,
                poId = option.poId,
                cacheKey = '',
                cacheParams = [];

            var searchOption = {
                type: SENDPOVND_CFG.ID,
                filters: [['isinactive', 'is', 'F'], 'AND'],
                columns: (function () {
                    var flds = [];
                    for (var fld in SENDPOVND_CFG.FIELD) {
                        flds.push(SENDPOVND_CFG.FIELD[fld]);
                    }
                    return flds;
                })()
            };

            if (configId) {
                searchOption.filters.push(['internalid', 'anyof', configId]);
                cacheParams.push('id=' + configId);
            } else {
                if (poId && !vendorId) {
                    var vendorInfo = Helper.fetchVendorFromPO(poId);
                    vendorId = vendorInfo.entity.value || vendorInfo.entity;
                    subsId = vendorInfo.subsidiary.value || vendorInfo.subsidiary || null;
                    cacheParams.push('poid=' + poId);
                }

                if (vendorId) {
                    searchOption.filters.push([SENDPOVND_CFG.FIELD.VENDOR, 'anyof', vendorId]);
                    cacheParams.push('vendor=' + vendorId);
                }
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
                    if (searchOption.filters.length) searchOption.filters.push('AND');
                    searchOption.filters.push([SENDPOVND_CFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                    cacheParams.push('subs=' + subsId);
                }
            }

            if (!cacheParams || !cacheParams.length) {
                vc2_util.log(logTitle, 'Missing vendor configuration parameters!');
                return false;
            }

            cacheKey = vc2_constant.CACHE_KEY.SENDPOVND_CONFIG + '__' + cacheParams.join('&');
            var configData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });

            if (!configData || option.forced) {
                configData = {};
                var searchObj = ns_search.create(searchOption);

                searchObj.run().each(function (row) {
                    for (var fld in SENDPOVND_CFG_MAP) {
                        var rowValue = row.getValue({ name: SENDPOVND_CFG_MAP[fld] });
                        configData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });
                if (vc2_util.isEmpty(configData)) {
                    vc2_util.log(logTitle, 'No SendPO Vendor Configuration available');
                    return false;
                }

                vc2_util.setNSCache({ name: cacheKey, value: configData });
            }
            returnValue = configData;

            // add the cache to the cache list
            var vendorCacheList = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.SENDPOVND_CONFIG + '__LIST',
                isJSON: true
            });

            if (!vendorCacheList) vendorCacheList = { LIST: [vc2_constant.CACHE_KEY.SENDPOVND_CONFIG + '__LIST'] };

            if (!vc2_util.inArray(cacheKey, vendorCacheList.LIST)) vendorCacheList.LIST.push(cacheKey);

            vc2_util.setNSCache({
                name: vc2_constant.CACHE_KEY.SENDPOVND_CONFIG + '__LIST',
                value: vendorCacheList
            });

            if (option.forced) {
                // run through each
                vendorCacheList.forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
                vc2_util.removeCache({ name: vc2_constant.CACHE_KEY.SENDPOVND_CONFIG + '__LIST' });
            }
            ///

            vc2_util.log(logTitle, '// SEND PO VENDOR CONFIG', returnValue);
            return returnValue;
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join(':'),
                returnValue;

            var servResponse = LibLicense.validate({ doRetry: true, retryMax: 3 });
            // vc2_util.log(logTitle, 'servResponse: ', servResponse);
            returnValue = servResponse;

            return returnValue;
        }
    };

    EndPoint.vendorConfig = EndPoint.orderVendorConfig;

    return EndPoint;
});
