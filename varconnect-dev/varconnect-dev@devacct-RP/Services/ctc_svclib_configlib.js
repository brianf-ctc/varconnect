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

    // var VendorCFG = vc2_constant.RECORD.VENDOR_CONFIG,
    //     VendorCFG_Map = function (row) {
    //         return {
    //             id: row.getValue({ name: VendorCFG.FIELD.ID }),
    //             subsidiary: row.getValue({ name: VendorCFG.FIELD.SUBSIDIARY }),
    //             xmlVendor: row.getValue({ name: VendorCFG.FIELD.XML_VENDOR }),
    //             xmlVendorText: row.getText({ name: VendorCFG.FIELD.XML_VENDOR }),
    //             vendor: row.getValue({ name: VendorCFG.FIELD.VENDOR }),
    //             endPoint: row.getValue({ name: VendorCFG.FIELD.WEBSERVICE_ENDPOINT }),
    //             startDate: row.getValue({ name: VendorCFG.FIELD.START_DATE }),
    //             user: row.getValue({ name: VendorCFG.FIELD.USERNAME }),
    //             password: row.getValue({ name: VendorCFG.FIELD.PASSWORD }),
    //             customerNo: row.getValue({ name: VendorCFG.FIELD.CUSTOMER_NO }),
    //             processDropships: row.getValue({ name: VendorCFG.FIELD.PROCESS_DROPSHIPS }),
    //             processSpecialOrders: row.getValue({
    //                 name: VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS
    //             }),
    //             fulfillmentPrefix: row.getValue({ name: VendorCFG.FIELD.FULFILLMENT_PREFIX }),
    //             accessEndPoint: row.getValue({ name: VendorCFG.FIELD.ACCESS_ENDPOINT }),
    //             apiKey: row.getValue({ name: VendorCFG.FIELD.API_KEY }),
    //             apiSecret: row.getValue({ name: VendorCFG.FIELD.API_SECRET }),
    //             oauthScope: row.getValue({ name: VendorCFG.FIELD.OATH_SCOPE }),
    //             useShipDate: row.getValue({ name: VendorCFG.FIELD.USE_SHIPDATE }),
    //             country: row.getValue({
    //                 name: 'country',
    //                 join: VendorCFG.FIELD.SUBSIDIARY
    //             }),
    //             itemColumnIdToMatch: row.getValue({
    //                 name: VendorCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH
    //             }),
    //             itemFieldIdToMatch: row.getValue({
    //                 name: VendorCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH
    //             }),
    //             matchItemToPartNumber: row.getValue({
    //                 name: VendorCFG.FIELD.MATCH_CUSTOM_ITEM_TO_NAME
    //             }),
    //             itemMPNColumnIdToMatch: row.getValue({
    //                 name: VendorCFG.FIELD.CUSTOM_MPN_COL_TO_MATCH
    //             }),
    //             itemMPNFieldIdToMatch: row.getValue({
    //                 name: VendorCFG.FIELD.CUSTOM_MPN_FLD_TO_MATCH
    //             }),
    //             matchMPNWithPartNumber: row.getValue({
    //                 name: VendorCFG.FIELD.MATCH_CUSTOM_MPN_TO_NAME
    //             })
    //         };
    //     };

    var MainCFG = vc2_constant.RECORD.MAIN_CONFIG,
        MainCFG_Map = vc2_constant.MAPPING.MAIN_CONFIG,
        // vendor config fields/map
        VendorCFG = vc2_constant.RECORD.VENDOR_CONFIG,
        VendorCFG_Map = vc2_constant.MAPPING.VENDOR_CONFIG,
        // bill vendor config fields/map
        BillVendorCFG = vc2_constant.RECORD.BILLCREATE_CONFIG,
        BillVendorCFG_Map = vc2_constant.MAPPING.BILLCREATE_CONFIG;

    var VC_LICENSE = vc2_constant.LICENSE;

    var LibLicense = {
        fetchLicense: function (option) {
            var logTitle = 'VC_LICENSE::fetchLicense',
                logPrefix = '[LICENSE-CHECK] ',
                response,
                returnValue = {};

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
                log.audit(
                    logTitle,
                    logPrefix + 'Send Request query: ' + JSON.stringify(queryOption)
                );
                response = ns_https.request(queryOption);
                log.audit(logTitle, logPrefix + 'Response: ' + JSON.stringify(response));

                if (!response || !response.body) throw 'Unable to get response';
                if (!response.code || response.code !== 200)
                    throw 'Received invalid response code - ' + response.code;

                // turn off retry from this point, since we can confirm that we are able to connect
                doRetry = false;

                var parsedResp = vc2_util.safeParse(response.body);
                if (!parsedResp) throw 'Unable to parse response';

                returnValue = parsedResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = vc2_util.extractError(error);

                if (doRetry && maxRetry > retryCount) {
                    log.audit(logTitle, logPrefix + '... retry count : ' + retryCount);
                    option.retryCount = retryCount + 1;
                    vc2_util.waitMs(retryWaitMS); // wait before re-sending
                    LibLicense.fetchLicense(option);
                }
            } finally {
                var durationSec = vc2_util.roundOff((new Date() - startTime) / 1000);
                log.audit(logTitle, logPrefix + '# response time: ' + durationSec + 's');
            }

            return returnValue;
        },
        validate: function (option) {
            var logTitle = 'VC_LICENSE::validate',
                logPrefix = '[LICENSE-CHECK] ',
                returnValue = {};

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

                if (
                    !vcLicenseResp ||
                    vcLicenseResp.error ||
                    vcLicenseResp.isError ||
                    vcLicenseResp.hasError
                )
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

                    if (vc2_util.isOneWorld())
                        result.subsidiary = row.getValue({ name: 'subsidiary' });
                    return true;
                });

            vc2_util.log('Helper.fetchVendorData', '// Vendor Data: ', result);

            return result;
        }
    };

    return {
        //
        mainConfig: function (option) {
            var logTitle = [LogTitle, 'MainConfig'].join(':'),
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
                    type: MainCFG.ID,
                    filters: [['isinactive', 'is', 'F']],
                    columns: (function () {
                        var flds = [];
                        for (var fld in MainCFG_Map) flds.push(MainCFG_Map[fld]);
                        return flds;
                    })()
                });
                mainConfigData = {};

                searchObj.run().each(function (row) {
                    for (var fld in MainCFG_Map) {
                        var rowValue = row.getValue({ name: MainCFG_Map[fld] });
                        mainConfigData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });

                if (!mainConfigData) throw 'No Configuration available';
                // vc2_util.log(logTitle, 'mainConfig>> ', mainConfigData);

                vc2_util.setNSCache({
                    name: vc2_constant.CACHE_KEY.MAIN_CONFIG,
                    value: mainConfigData
                });
            }

            returnValue = mainConfigData;

            return returnValue;
        },
        vendorConfig: function (option) {
            var logTitle = [LogTitle, 'vendorConfig'].join(':'),
                returnValue;

            var configId = option.configId || option.id,
                vendorId = option.vendor || option.vendorId,
                subsId = option.subsidiary || option.subsidiaryId,
                poId = option.poId,
                cacheKey = '',
                cacheParams = [];

            // vc2_util.log(logTitle, '>> vendor config: ', option);

            var searchOption = {
                type: VendorCFG.ID,
                filters: [],
                columns: (function () {
                    var flds = [];
                    for (var fld in VendorCFG.FIELD) {
                        flds.push(VendorCFG.FIELD[fld]);
                    }
                    flds.push({ name: 'country', join: VendorCFG.FIELD.SUBSIDIARY });
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
                    searchOption.filters.push([VendorCFG.FIELD.VENDOR, 'anyof', vendorId]);
                    cacheParams.push('vendor=' + vendorId);
                }
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
                    if (searchOption.filters.length) searchOption.filters.push('AND');
                    searchOption.filters.push([VendorCFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                    cacheParams.push('subs=' + subsId);
                }
            }

            if (!cacheParams || !cacheParams.length)
                throw 'Missing vendor configuration parameters!';

            cacheKey = vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__' + cacheParams.join('&');
            var configData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });

            if (!configData || option.forced) {
                configData = {};
                var searchObj = ns_search.create(searchOption);

                searchObj.run().each(function (row) {
                    for (var fld in VendorCFG_Map) {
                        var rowValue = row.getValue({ name: VendorCFG_Map[fld] });
                        configData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }

                    configData.xmlVendor = row.getText({ name: VendorCFG.FIELD.XML_VENDOR });

                    configData.country = row.getValue({
                        name: 'country',
                        join: VendorCFG.FIELD.SUBSIDIARY
                    });

                    return true;
                });
                if (vc2_util.isEmpty(configData)) throw 'No Vendor Configuration available';

                vc2_util.setNSCache({ name: cacheKey, value: configData });
            }
            returnValue = configData;

            // add the cache to the cache list
            var vendorCacheList = vc2_util.getNSCache({
                name: vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST',
                isJSON: true
            });

            if (!vendorCacheList)
                vendorCacheList = { LIST: [vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST'] };

            if (!vc2_util.inArray(cacheKey, vendorCacheList.LIST))
                vendorCacheList.LIST.push(cacheKey);

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
                type: BillVendorCFG.ID,
                filters: [],
                columns: (function () {
                    var flds = [];
                    for (var fld in BillVendorCFG_Map) flds.push(BillVendorCFG_Map[fld]);
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
                cacheParams.push('vendor=' + vendorId);
            }

            if (configId) {
                searchOption.filters.push(['internalid', 'anyof', configId]);
                cacheParams.push('id=' + configId);
            } else
                throw 'Incomplete data to retrieve bill create vendor config: Missing either poId, vendorId  ';

            if (subsId && util.isArray(configId) && configId.length) {
                searchOption.filters.push('AND', [BillVendorCFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
                cacheParams.push('subs=' + subsId);
            }

            if (!cacheParams || !cacheParams.length)
                throw 'Missing bill vendor configuration parameters!';

            cacheKey = vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__' + cacheParams.join('&');
            var configData = vc2_util.getNSCache({ name: cacheKey, isJSON: true });

            if (!configData || option.forced) {
                vc2_util.log(logTitle, '// search Option ', searchOption);

                configData = {};
                var searchObj = ns_search.create(searchOption);

                searchObj.run().each(function (row) {
                    for (var fld in BillVendorCFG_Map) {
                        var rowValue = row.getValue({ name: BillVendorCFG_Map[fld] });
                        configData[fld] = rowValue ? rowValue.value || rowValue : null;
                    }
                    return true;
                });
                if (vc2_util.isEmpty(configData)) throw 'No Bill Vendor Configuration found';
                else vc2_util.setNSCache({ name: cacheKey, value: configData });
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

            if (!vc2_util.inArray(cacheKey, configCacheList.LIST))
                configCacheList.LIST.push(cacheKey);

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

            return returnValue;
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join(':'),
                returnValue;

            var servResponse = LibLicense.validate({ doRetry: true, retryMax: 3 });
            vc2_util.log(logTitle, 'servResponse: ', servResponse);
            returnValue = servResponse;

            return returnValue;
        }
    };
});
