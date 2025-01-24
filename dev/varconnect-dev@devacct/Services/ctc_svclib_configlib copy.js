/**
 * Copyright (c) 2025  sCatalyst Tech Corp
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

    var vc2_util = require('../CTC_VC2_Lib_Utils'),
        vc2_constant = require('../CTC_VC2_Constants'),
        vcs_recordsLib = require('./ctc_svclib_records.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_runtime = require('N/runtime'),
        ns_url = require('N/url'),
        ns_https = require('N/https');

    var MAIN_CFG = vc2_constant.RECORD.MAIN_CONFIG,
        VENDOR_CFG = vc2_constant.RECORD.VENDOR_CONFIG,
        BILL_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG,
        SENDPOVND_CFG = vc2_constant.RECORD.SENDPOVENDOR_CONFIG;

    var VC_LICENSE = vc2_constant.LICENSE;

    //// LICENSE LIBRARY ////
    var LibLicense = {
        /**
         * Fetch license info from license server
         * @param {*} option
         *  option.doRetry: retry on fail
         *  option.maxRetry: max amount of retry
         *  option.retryWait: waitms before trying again
         * @returns
         */
        fetchLicense: function (option) {
            var logTitle = 'VC_LICENSE::fetchLicense',
                logPrefix = '[LICENSE-CHECK] ',
                response,
                returnValue = {};

            var startTime = new Date();

            var doRetry = option.doRetry,
                maxRetry = doRetry ? option.maxRetry || VC_LICENSE.MAX_RETRY : 0,
                retryCount = option.retryCount || 1,
                retryWaitMS = option.retryWaitMS || option.retryWait || 1000;

            try {
                var queryOption = {
                    method: ns_https.Method.GET,
                    url:
                        VC_LICENSE.URL +
                        '?' +
                        ('producttypeid=' + VC_LICENSE.PRODUCT_CODE) +
                        ('&nsaccountid=' + ns_runtime.accountId)
                };
                vc2_util.log(logTitle, logPrefix + 'Send Request query: ', queryOption);
                response = ns_https.request(queryOption);
                vc2_util.log(logTitle, logPrefix + 'Response: ', response);

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
                    vc2_util.log(logTitle, logPrefix + '... retry count : ' + retryCount);
                    option.retryCount = retryCount + 1;
                    vc2_util.waitMs(retryWaitMS); // wait before re-sending
                    LibLicense.fetchLicense(option);
                }
            } finally {
                var durationSec = vc2_util.roundOff((new Date() - startTime) / 1000);
                vc2_util.log(logTitle, logPrefix + '# response time: ' + durationSec + 's');
            }

            return returnValue;
        },
        validate: function (option) {
            var logTitle = 'VC_LICENSE::validate',
                logPrefix = '[LICENSE-CHECK] ',
                returnValue = {};

            try {
                // prep the cache
                var licenseInfo = vc2_util.getNSCache({ name: VC_LICENSE.KEY });
                licenseInfo = vc2_util.safeParse(licenseInfo);

                vc2_util.log(logTitle, logPrefix + '...license data: ', licenseInfo);

                var checkLicenseBad = function (licenseData) {
                    return (
                        // no cache retrieved
                        !licenseData ||
                        // error on license response
                        licenseData.hasError ||
                        // error on license server
                        licenseData.error ||
                        // inactive license
                        licenseData.status !== 'active'
                    );
                };

                if (checkLicenseBad(licenseInfo)) {
                    // force fetch the license
                    licenseInfo = LibLicense.fetchLicense(option);

                    // if it still bad, then throw an error
                    if (checkLicenseBad(licenseInfo))
                        throw licenseInfo.error ||
                            licenseInfo.errorMsg ||
                            licenseInfo.status != 'active'
                            ? 'License is not active'
                            : licenseInfo.message;

                    //// CACHE the license info
                    vc2_util.setNSCache({
                        name: VC_LICENSE.KEY,
                        value: licenseInfo,
                        cacheTTL: VC_LICENSE.CACHE_TTL
                    });
                }

                returnValue = licenseInfo;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = vc2_util.extractError(error);
            }

            return returnValue;
        }
    };

    var ListConfigType = {
        MAIN: 'MAIN_CONFIG',
        VENDOR: 'VENDOR_CONFIG',
        ORDER: 'VENDOR_CONFIG',
        BILL: 'BILLCREATE_CONFIG',
        SENDPO: 'SENDPOVENDOR_CONFIG'
    };

    /// MAIN CONFIG ////
    var ConfigLibParams = {
        MAIN: {
            name: 'MAIN CONFIG',
            type: 'MAIN_CONFIG',
            mapping: vc2_constant.MAPPING.MAIN_CONFIG,
            recordDef: vc2_constant.RECORD.MAIN_CONFIG,

            searchOption: function () {
                var current = ConfigLibParams.MAIN;

                return {
                    type: current.recordDef.ID,
                    filters: [['isinactive', 'is', 'F']],
                    columns: (function () {
                        var flds = [];
                        for (var fld in current.mapping) flds.push(current.mapping[fld]);
                        return flds;
                    })()
                };
            }
        },
        ORDER: {},
        BILL: {},
        SENDPO: {}
    };

    var ConfigLib = {
        configType: null,
        cacheParams: [],
        cacheKey: null,
        generateCacheKey: function (option) {
            this.cacheParams = vc2_util.uniqueArray(this.cacheParams);
            this.cacheKey = [
                ListConfigType[this.configType],
                this.cacheParams.join('&'),
                vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
            ].join('__');

            return this.cacheKey;
        },
        load: function (option) {
            var logTitle = 'ConfigLib::load',
                returnValue;

            try {
                var configType = option.configType;
                if (!configType) throw 'Please provide a config type';

                this.configType = configType;
                vc2_util.LogPrefix = '[' + ListConfigType[configType] + '] ';
                vc2_util.log(logTitle, '**** LOADING CONFIG: START ****');

                var configMap = ConfigLibParams[configType].mapping,
                    configRecord = ConfigLibParams[configType].recordDef,
                    configData = {};

                // build the search option
                var searchOption = ConfigLibParams[configType].searchOption(option);

                // check for the cache
                var cachedValue = this.getCache(option);
                if (!vc2_util.isEmpty(cachedValue)) return cachedValue;

                vc2_util.log(logTitle, '// searchOption: ', searchOption);
                var searchObj = ns_search.create(searchOption);
                if (!searchObj) return false;

                vc2_util.log(logTitle, '###  Total Results: ', searchObj.runPaged().count);
                searchObj.run().each(function (row) {
                    for (var field in configMap) {
                        var value = row.getValue({ name: configMap[field] });
                        configData[field] = !vc2_util.isEmpty(value) ? value.value || value : null;
                    }
                    return true;
                });

                returnValue = configData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '**** LOADING CONFIG: END ****', [
                    returnValue,
                    this.cacheKey,
                    this.cacheParams
                ]);
                vc2_util.LogPrefix = ''; // reset the log prefix
            }

            return returnValue;
        },
        send:  function (option) {},
        getCache: function (option) {
            var cacheKey = this.cacheKey || this.generateCacheKey(option);
            return vc2_util.getNSCache({ name: cacheKey, isJSON: true });
        },
        setCache: function (cacheValue) {
            if (vc2_util.isEmpty(cacheValue)) return;
            var cacheKey = this.cacheKey || this.generateCacheKey();
            vc2_util.setNSCache({ name: cacheKey, value: cacheValue });
        },
        removeCache: function (option) {
            var cacheKey = this.cacheKey || this.generateCacheKey(option);
            return vc2_util.removeCache({ name: cacheKey });
        }
    };

    // (MainConfigLib = {
    //     configType: ListConfigType.MAIN,
    //     cacheKey: null,
    //     cacheParams: [],
    //     generateCacheKey: function (option) {
    //         // build the cache key, by joining the cache params
    //         this.cacheParams = vc2_util.uniqueArray(this.cacheParams);
    //         this.cacheKey = [
    //             this.configType,
    //             this.cacheParams.join('&'),
    //             vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
    //         ].join('__');
    //     },
    //     load: function (option) {
    //         var logTitle = 'MainConfigLib::load',
    //             returnValue;
    //         option = option || {};

    //         vc2_util.LogPrefix = '[MAIN CONFIG] ';
    //         vc2_util.log(logTitle, '**** LOADING CONFIG: START ****');

    //         try {
    //             var configMap = vc2_constant.MAPPING[this.configType],
    //                 configRecord = vc2_constant.RECORD[this.configType],
    //                 configData = {};

    //             var searchOption = {
    //                 type: configRecord.ID,
    //                 filters: [['isinactive', 'is', 'F']],
    //                 columns: (function () {
    //                     var flds = [];
    //                     for (var fld in configMap) flds.push(configMap[fld]);
    //                     return flds;
    //                 })()
    //             };

    //             this.generateCacheKey();

    //             var cachedValue = vc2_util.getNSCache({ name: this.cacheKey });
    //             if (!vc2_util.isEmpty(cachedValue)) return cachedValue;

    //             var searchObj = ns_search.create(searchOption);
    //             if (!searchObj) return false;

    //             searchObj.run().each(function (row) {
    //                 for (var field in configMap) {
    //                     var value = row.getValue({ name: configMap[field] });
    //                     configData[field] = !vc2_util.isEmpty(value) ? value.value || value : null;
    //                 }
    //                 return true;
    //             });

    //             returnValue = configData;
    //         } catch (error) {
    //             vc2_util.logError(logTitle, error);
    //             returnValue = false;
    //         } finally {
    //             vc2_util.log(logTitle, '**** LOADING CONFIG: END ****', [
    //                 returnValue,
    //                 this.cacheKey,
    //                 this.cacheParams
    //             ]);
    //             vc2_util.LogPrefix = ''; // reset the log prefix
    //         }
    //         return returnValue;
    //     }
    // }),
    //     (OrderConfigLib = {
    //         configType: ListConfigType.VENDOR,
    //         cacheKey: null,
    //         cacheParams: [],
    //         generateCacheKey: function (option) {
    //             // build the cache key, by joining the cache params
    //             this.cacheParams = vc2_util.uniqueArray(this.cacheParams);
    //             this.cacheKey = [
    //                 this.configType,
    //                 this.cacheParams.join('&'),
    //                 vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
    //             ].join('__');
    //         }
    //     });

    //// CONFIG LIB ////
    // var __ConfigLib = {
    //     ConfigType: ListConfigType.MAIN,
    //     CacheKey: null,
    //     CacheParams: [],
    //     buildSearchOption: function (option) {
    //         var configType = option.configType || this.ConfigType;

    //         var configRecord = vc2_constant.RECORD[configType],
    //             configMap = vc2_constant.MAPPING[configType];

    //         // reset the cache params
    //         this.CacheParams = [];

    //         return {
    //             type: configRecord.ID,
    //             filters: [['isinactive', 'is', 'F']],
    //             columns: (function () {
    //                 var flds = [];
    //                 for (var fld in configMap) flds.push(configMap[fld]);
    //                 return flds;
    //             })()
    //         };
    //     },
    //     search: function (option) {
    //         var logTitle = [LogTitle, 'ConfigLib.search'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         try {
    //             // RETURN cached valued
    //             var searchOption = this.buildSearchOption(option);

    //             // generate the search
    //             if (!searchOption) return false;
    //             // vc2_util.log(logTitle, '... search Option: ', [this.CacheKey, searchOption]);

    //             var searchObj = ns_search.create(searchOption);

    //             // total results
    //             var numResults = searchObj.runPaged().count;
    //             vc2_util.log(logTitle, '###  Total Results: ', numResults);

    //             returnValue = searchObj;
    //         } catch (error) {
    //             vc2_util.logError(logTitle, error);
    //             throw error;
    //         }

    //         return returnValue;
    //     },
    //     load: function (option) {
    //         var logTitle = [LogTitle, 'ConfigLib.load'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         vc2_util.LogPrefix = '[' + this.ConfigNameValue + '] ';
    //         vc2_util.log(logTitle, '**** LOADING CONFIG: START ****');

    //         try {
    //             var configMap = vc2_constant.MAPPING[this.ConfigType],
    //                 configData = {},
    //                 recordData = {};

    //             // load the current record
    //             if (option.poId || option.poNum) {
    //                 recordData = vcs_recordsLib.searchTransaction({
    //                     name: option.poNum,
    //                     id: option.poId,
    //                     columns: [
    //                         'entity',
    //                         'internalid',
    //                         'vendor.internalid',
    //                         'vendor.entityid',
    //                         'vendor.custentity_vc_bill_config'
    //                     ]
    //                 });

    //                 option.recordData = recordData;
    //             }

    //             /// build the search option
    //             var searchOption = this.buildSearchOption(option);

    //             // check for the cache
    //             var cachedValue = this.getCache(option);
    //             if (!vc2_util.isEmpty(cachedValue)) return cachedValue;

    //             vc2_util.log(logTitle, '// searchOption: ', searchOption);
    //             var searchObj = ns_search.create(searchOption);
    //             if (!searchObj) return false;

    //             var numResults = searchObj.runPaged().count;
    //             vc2_util.log(logTitle, '###  Total Results: ', numResults);

    //             // run the search values
    //             searchObj.run().each(function (row) {
    //                 for (var field in configMap) {
    //                     var value = row.getValue({ name: configMap[field] });
    //                     configData[field] = !vc2_util.isEmpty(value) ? value.value || value : null;
    //                 }
    //                 return true;
    //             });
    //             // add the country code
    //             if (
    //                 !vc2_util.isEmpty(configData) &&
    //                 !vc2_util.isEmpty(recordData) &&
    //                 recordData.country
    //             )
    //                 configData.country = recordData.country.value || recordData.country;

    //             if (!vc2_util.isEmpty(configData)) this.setCache(configData);

    //             returnValue = configData;
    //         } catch (error) {
    //             vc2_util.logError(logTitle, error);
    //             throw error;
    //         } finally {
    //             vc2_util.log(logTitle, '**** LOADING CONFIG: END ****', [
    //                 returnValue,
    //                 this.CacheParams,
    //                 this.CacheKey
    //             ]);
    //             vc2_util.LogPrefix = ''; // reset the log prefix
    //         }
    //         return returnValue;
    //     },
    //     buildPayload: function (option) {
    //         var logTitle = [LogTitle, 'ConfigLib.buildPayload'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         // generate the payload
    //         var configType = option.configType || this.ConfigType;
    //         var configRecordDef = vc2_constant.RECORD[configType],
    //             configId = option.configId || option.id,
    //             skippedFields = option.skippedFields || this.SkippedFields,
    //             configFields = ['name', 'isinactive', 'internalid'],
    //             configNameField = option.nameField || this.ConfigNameField,
    //             configNameValue = option.nameValue || this.ConfigNameValue,
    //             payloadData = [];

    //         configRecordDef.FIELD['NAME'] = 'name';
    //         configRecordDef.FIELD['INACTIVE'] = 'isinactive';
    //         configRecordDef.FIELD['MODIFIED'] = 'lastmodified';
    //         configRecordDef.FIELD['MODIFIED_BY'] = 'lastmodifiedby';

    //         for (var fieldName in configRecordDef.FIELD) {
    //             if (vc2_util.inArray(configRecordDef.FIELD[fieldName], skippedFields)) continue;
    //             configFields.push(configRecordDef.FIELD[fieldName]);
    //         }
    //         if (configNameField) configFields.push(configNameField);

    //         // Do the lookup
    //         var configData = vc2_util.flatLookup({
    //             type: configRecordDef.ID,
    //             id: configId,
    //             columns: configFields
    //         });

    //         // TRY to update CONFIG.name ////////
    //         if (
    //             configData.name == configData.internalid.value &&
    //             (configNameValue || (configNameField && configData[configNameField]))
    //         ) {
    //             configData.name =
    //                 configNameField && configData[configNameField]
    //                     ? configData[configNameField].text || configData[configNameField]
    //                     : configNameValue;

    //             vc2_util.log(logTitle, ' **** FIX CONFIG NAME ***** ', configData.name);

    //             ns_record.submitFields({
    //                 type: configRecordDef.ID,
    //                 id: configId,
    //                 values: { name: configData.name }
    //             });
    //         }
    //         //////////////////////////////////////////
    //         // initialize the payloadData
    //         payloadData.push({
    //             settingFieldId: '_config_name',
    //             settingFieldName: 'CONFIG_NAME',
    //             settingValue: configType
    //         });

    //         for (var fieldName in configRecordDef.FIELD) {
    //             var fieldId = configRecordDef.FIELD[fieldName],
    //                 fieldValue =
    //                     configData[fieldId] == null
    //                         ? 'null'
    //                         : configData[fieldId] === true
    //                         ? 'T'
    //                         : configData[fieldId] === false
    //                         ? 'F'
    //                         : configData[fieldId];

    //             var data = {
    //                 settingFieldId: fieldId,
    //                 settingFieldName: fieldName,
    //                 settingValue: fieldValue.value || fieldValue
    //             };
    //             if (
    //                 configData.hasOwnProperty(fieldId) &&
    //                 fieldValue.text &&
    //                 fieldValue.text !== data.settingValue
    //             ) {
    //                 data['settingFieldText'] = fieldValue.text;
    //             }
    //             payloadData.push(data);
    //         }

    //         return payloadData;
    //     },
    //     send: function (option) {
    //         var logTitle = [LogTitle, 'ConfigLib.send'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         var configType = option.configType || this.ConfigType;
    //         var configRecord = vc2_constant.RECORD[configType],
    //             configId = option.id,
    //             payloadData = [];

    //         var configURL =
    //             'https://' +
    //             ns_url.resolveDomain({
    //                 hostType: ns_url.HostType.APPLICATION,
    //                 accountId: ns_runtime.accountId
    //             }) +
    //             ns_url.resolveRecord({ recordType: configRecord.ID, recordId: configId });

    //         vc2_util.log(logTitle, '// configURL: ', configURL);

    //         var payloadData = this.buildPayload(option);
    //         // vc2_util.log(logTitle, '// payloadData: ', payloadData);

    //         // prepare the payload
    //         var queryOption = {
    //             method: ns_https.Method.POST,
    //             url:
    //                 'https://nscatalystserver.azurewebsites.net/logconfig.php' +
    //                 '?' +
    //                 ('producttypeid=' + VC_LICENSE.PRODUCT_CODE) +
    //                 ('&nsaccountid=' + ns_runtime.accountId) +
    //                 ('&settingsid=' + configId) +
    //                 ('&rectype=' + configRecord.ID) +
    //                 ('&settingsurl=' + encodeURIComponent(configURL)),
    //             body: JSON.stringify(payloadData)
    //         };

    //         //// SEND THE REQUEST ////
    //         vc2_util.log(logTitle, '### Send Request query: ', queryOption.url);
    //         response = ns_https.request(queryOption);
    //         vc2_util.log(logTitle, '### Response: ', response);
    //         /////////////////////////

    //         if (!response || !response.body) throw 'Unable to get response';
    //         if (!response.code || response.code !== 200)
    //             throw 'Received invalid response code - ' + response.code;
    //         returnValue = response.body;

    //         return returnValue;
    //     },
    //     /// CACHING ///
    //     generateCacheKey: function (option) {
    //         var configType = this.ConfigType;

    //         if (this.CacheParams && this.CacheParams.length) {
    //             this.CacheParams = vc2_util.uniqueArray(this.CacheParams);
    //         }

    //         var cacheKey = [
    //             vc2_constant.CACHE_KEY[configType],
    //             this.CacheParams.join('&'),
    //             vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
    //         ].join('__');

    //         this.CacheKey = cacheKey;

    //         return cacheKey;
    //     },
    //     getCache: function (option) {
    //         var cacheKey = this.CacheKey || this.generateCacheKey(option);
    //         return vc2_util.getNSCache({ name: cacheKey, isJSON: true });
    //     },
    //     setCache: function (cacheValue) {
    //         if (vc2_util.isEmpty(cacheValue)) return;
    //         var cacheKey = this.CacheKey || this.generateCacheKey();

    //         vc2_util.setNSCache({ name: cacheKey, value: cacheValue });
    //     },
    //     removeCache: function (option) {
    //         var cacheKey = this.CacheKey || this.generateCacheKey(option);
    //         return vc2_util.removeCache({ name: cacheKey });
    //     }
    // };

    // var __MainConfigLib = vc2_util.extend(__ConfigLib, {
    //     ConfigType: ListConfigType.MAIN,
    //     SkippedFields: ['custrecord_ctc_vc_license_text'],
    //     ConfigNameValue: 'MAIN CONFIG',
    //     configNameField: 'custrecord_ctc_vc_xml_vendor',
    //     load: function (option) {
    //         var logTitle = [LogTitle, 'MainConfigLib.load'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         vc2_util.LogPrefix = '[' + this.ConfigNameValue + '] ';
    //         vc2_util.log(logTitle, '**** LOADING CONFIG: START ****');

    //         try {
    //             var configMap = vc2_constant.MAPPING[this.ConfigType],
    //                 configData = {};

    //             var searchObj = this.search(option);

    //             var cachedValue = this.getCache(option);
    //             if (!vc2_util.isEmpty(cachedValue)) return cachedValue;

    //             var searchObj = this.search(option);
    //             if (!searchObj) return false;

    //             searchObj.run().each(function (row) {
    //                 for (var field in configMap) {
    //                     var value = row.getValue({ name: configMap[field] });
    //                     configData[field] = !vc2_util.isEmpty(value) ? value.value || value : null;
    //                 }
    //                 return true;
    //             });

    //             if (!vc2_util.isEmpty(configData)) this.setCache(configData);

    //             returnValue = configData;
    //         } catch (error) {
    //             vc2_util.logError(logTitle, error);
    //             throw error;
    //         } finally {
    //             vc2_util.log(logTitle, '**** LOADING CONFIG: END ****', [
    //                 returnValue,
    //                 this.CacheParams,
    //                 this.CacheKey
    //             ]);

    //             vc2_util.LogPrefix = ''; // reset the log
    //         }
    //         return returnValue;
    //     }
    // });

    // var __OrderConfigLib = vc2_util.extend(__ConfigLib, {
    //     ConfigType: ListConfigType.VENDOR,
    //     ConfigNameValue: 'VENDOR CONFIG',
    //     ConfigNameField: 'custrecord_ctc_vc_xml_vendor',
    //     SkippedFields: ['custrecord_ctc_vc_xml_req'],
    //     CountryCodeField: VENDOR_CFG.FIELD.SUBSIDIARY,
    //     buildSearchOption: function (option) {
    //         var logTitle = [LogTitle, 'OrderConfigLib.buildSearchOption'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         var configId = option.configId || option.id,
    //             vendorId = option.vendor || option.vendorId,
    //             subsId = option.subsidiary || option.subsidiaryId,
    //             poNum = option.poNum || option.tranid || option.tranId,
    //             poId = option.poId,
    //             recordData = option.recordData;

    //         vc2_util.log(logTitle, '// option: ', option);

    //         // reset the params
    //         this.CacheParams = [];
    //         this.CacheKey = null;

    //         var searchOption = __ConfigLib.buildSearchOption({ configType: ListConfigType.VENDOR });

    //         // ADD the COUNTRY from either the subsidiary or the VENDOR
    //         searchOption.columns.push(VENDOR_CFG.FIELD.SUBSIDIARY + '.country');

    //         // if the configId is specified, exit the script immediately
    //         if (configId) {
    //             searchOption.filters.push('AND', ['internalid', 'anyof', configId]);
    //             this.CacheParams.push('configId=' + configId);
    //             // return searchOption;
    //         }

    //         if (!vendorId && (poId || poNum)) {
    //             var MainCFG = EndPoint.mainConfig();

    //             if (!recordData) {
    //                 recordData = vcs_recordsLib.searchTransaction({
    //                     name: poNum,
    //                     id: poId,
    //                     overridePO: MainCFG.overridePONum,
    //                     columns: [
    //                         'entity',
    //                         'internalid',
    //                         'vendor.internalid',
    //                         'vendor.entityid',
    //                         'vendor.custentity_vc_bill_config',
    //                         vc2_util.isOneWorld() ? 'subsidiary' : null,
    //                         vc2_util.isOneWorld() ? 'subsidiary.country' : null
    //                     ]
    //                 });
    //             }

    //             if (recordData && !vc2_util.isEmpty(recordData)) {
    //                 vendorId = recordData.entity
    //                     ? recordData.entity.value || recordData.entity
    //                     : null;
    //                 subsidiaryId = recordData.subsidiary
    //                     ? recordData.subsidiary.value || recordData.subsidiary
    //                     : null;
    //                 this.CacheParams.push('poId=' + recordData.id);
    //                 this.CacheParams.push('poNum=' + recordData.tranid);
    //             }
    //         }
    //         // else throw 'Please provide a vendor configuration or PO record';

    //         if (vendorId) {
    //             searchOption.filters.push('AND', [VENDOR_CFG.FIELD.VENDOR, 'anyof', vendorId]);
    //             this.CacheParams.push('vendorId=' + vendorId);
    //         }

    //         if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
    //             searchOption.filters.push('AND', [VENDOR_CFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
    //             this.CacheParams.push('subsId=' + subsId);
    //         }

    //         if (!this.CacheParams.length)
    //             throw 'Please provide a vendor configuration or PO record';

    //         return searchOption;
    //     },
    //     setCache: function (cacheValue) {
    //         if (vc2_util.isEmpty(cacheValue)) return;
    //         var cacheKey = this.CacheKey || this.generateCacheKey();

    //         // save it first
    //         vc2_util.setNSCache({ name: cacheKey, value: cacheValue });

    //         vc2_util.saveCacheList({
    //             listName: vc2_constant.CACHE_KEY.VENDOR_CONFIG,
    //             cacheKey: cacheKey
    //         });

    //         return true;
    //     },
    //     removeCache: function (option) {
    //         vc2_util.deleteCacheList({ listName: vc2_constant.CACHE_KEY.VENDOR_CONFIG });
    //     }
    // });

    // var __BillConfigLib = vc2_util.extend(__ConfigLib, {
    //     ConfigType: ListConfigType.BILL,
    //     SkippedFields: [],
    //     ConfigNameValue: 'BILLCREATE CONFIG',
    //     ConfigNameField: 'custrecord_vc_bc_xmlapi_vendor',
    //     buildSearchOption: function (option) {
    //         var logTitle = [LogTitle, 'BillConfigLib.buildSearchOption'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         var configId = option.configId || option.id,
    //             subsId = option.subsidiary || option.subsidiaryId,
    //             poNum = option.poNum || option.tranid || option.tranId,
    //             poId = option.poId,
    //             recordData = option.recordData;

    //         this.CacheParams = [];
    //         this.CacheKey = null;

    //         var searchOption = __ConfigLib.buildSearchOption({ configType: ListConfigType.BILL });

    //         if (configId) {
    //             searchOption.filters.push('AND', ['internalid', 'anyof', configId]);
    //             this.CacheParams.push('configId=' + configId);
    //             return searchOption;
    //         }

    //         if (!configId && (poId || poNum)) {
    //             if (!recordData) {
    //                 var MainCFG = EndPoint.mainConfig();
    //                 recordData = vcs_recordsLib.searchTransaction({
    //                     name: poNum,
    //                     id: poId,
    //                     overridePO: MainCFG.overridePONum,
    //                     columns: [
    //                         'entity',
    //                         'internalid',
    //                         'vendor.internalid',
    //                         'vendor.entityid',
    //                         'vendor.custentity_vc_bill_config',
    //                         vc2_util.isOneWorld() ? 'subsidiary' : null
    //                     ]
    //                 });
    //             }
    //             if (recordData && !vc2_util.isEmpty(recordData)) {
    //                 this.CacheParams.push('poId=' + recordData.id);
    //                 this.CacheParams.push('poNum=' + recordData.tranid);

    //                 configId = recordData.custentity_vc_bill_config
    //                     ? recordData.custentity_vc_bill_config.value ||
    //                       recordData.custentity_vc_bill_config
    //                     : null;
    //                 vendorId = recordData.entity
    //                     ? recordData.entity.value || recordData.entity
    //                     : null;
    //                 subsidiaryId = recordData.subsidiary
    //                     ? recordData.subsidiary.value || recordData.subsidiary
    //                     : null;
    //             }
    //         }

    //         // if the configId is specified, exit the script immediately
    //         if (configId) {
    //             var billConfigs = configId.split(/,/);
    //             searchOption.filters.push('AND', ['internalid', 'anyof', billConfigs]);
    //             this.CacheParams.push('configId=' + configId);
    //         }

    //         if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsidiaryId) {
    //             searchOption.filters.push('AND', [
    //                 [BILL_CFG.FIELD.SUBSIDIARY, 'anyof', subsidiaryId],
    //                 'OR',
    //                 [BILL_CFG.FIELD.SUBSIDIARY, 'noneof', '@NONE@']
    //             ]);
    //             this.CacheParams.push('subsId=' + subsidiaryId);
    //         }

    //         vc2_util.log(logTitle, '// params: ', this.CacheParams);

    //         if (!this.CacheParams.length || !configId)
    //             throw 'Please provide a vendor configuration or PO record';

    //         return searchOption;
    //     },
    //     load: function (option) {
    //         var logTitle = [LogTitle, 'ConfigLib.load'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         vc2_util.LogPrefix = '[' + this.ConfigNameValue + '] ';
    //         vc2_util.log(logTitle, '**** LOADING CONFIG: START ****');

    //         try {
    //             var configMap = vc2_constant.MAPPING[this.ConfigType],
    //                 configData = {},
    //                 recordData = {};

    //             // load the current record
    //             if (option.poId || option.poNum) {
    //                 recordData = vcs_recordsLib.searchTransaction({
    //                     name: option.poNum,
    //                     id: option.poId,
    //                     columns: [
    //                         'entity',
    //                         'internalid',
    //                         'vendor.internalid',
    //                         'vendor.entityid',
    //                         'vendor.custentity_vc_bill_config'
    //                     ]
    //                 });
    //                 option.recordData = recordData;

    //                 // if (recordData && !vc2_util.isEmpty(recordData)) {
    //                 //     this.CacheParams.push('poId=' + recordData.id);
    //                 //     this.CacheParams.push('poNum=' + recordData.tranid);

    //                 //     option.comfigId = recordData.custentity_vc_bill_config;
    //                 //     option.subsidiaryId = recordData.subsidiary;
    //                 // }
    //             }
    //             var searchOption = this.buildSearchOption(option);

    //             var cachedValue = this.getCache(option);
    //             if (!vc2_util.isEmpty(cachedValue)) return cachedValue;

    //             vc2_util.log(logTitle, '// searchOption: ', searchOption);
    //             var searchObj = ns_search.create(searchOption);
    //             if (!searchObj) return false;

    //             searchObj.run().each(function (row) {
    //                 for (var field in configMap) {
    //                     var value = row.getValue({ name: configMap[field] });
    //                     configData[field] = !vc2_util.isEmpty(value) ? value.value || value : null;
    //                 }
    //                 return true;
    //             });

    //             if (!vc2_util.isEmpty(configData)) this.setCache(configData);

    //             returnValue = configData;
    //         } catch (error) {
    //             vc2_util.logError(logTitle, error);
    //             throw error;
    //         } finally {
    //             vc2_util.log(logTitle, '**** LOADING CONFIG: END ****', [
    //                 returnValue,
    //                 this.CacheParams,
    //                 this.CacheKey
    //             ]);
    //             vc2_util.LogPrefix = ''; // reset the log prefix
    //         }
    //         return returnValue;
    //     },
    //     setCache: function (cacheValue) {
    //         if (vc2_util.isEmpty(cacheValue)) return;
    //         var cacheKey = this.CacheKey || this.generateCacheKey();

    //         // save it first
    //         vc2_util.setNSCache({ name: cacheKey, value: cacheValue });

    //         vc2_util.saveCacheList({
    //             listName: vc2_constant.CACHE_KEY.BILLCREATE_CONFIG,
    //             cacheKey: cacheKey
    //         });
    //     },
    //     removeCache: function (option) {
    //         vc2_util.deleteCacheList({ listName: vc2_constant.CACHE_KEY.BILLCREATE_CONFIG });
    //     }
    // });

    // var __SendPOConfigLib = vc2_util.extend(__ConfigLib, {
    //     ConfigType: ListConfigType.SENDPO,
    //     ConfigNameValue: 'SENDPO VENDOR CONFIG',
    //     ConfigNameField: 'custrecord_ctc_vcsp_api_vendor',
    //     buildSearchOption: function (option) {
    //         var logTitle = [LogTitle, 'SendPOConfigLib.buildSearchOption'].join('::'),
    //             returnValue;
    //         option = option || {};

    //         var configId = option.configId || option.id,
    //             vendorId = option.vendor || option.vendorId,
    //             subsId = option.subsidiary || option.subsidiaryId,
    //             poNum = option.poNum || option.tranid || option.tranId,
    //             poId = option.poId;

    //         var searchOption = __ConfigLib.buildSearchOption({ configType: ListConfigType.SENDPO });

    //         // if the configId is specified, exit the script immediately
    //         if (configId) {
    //             searchOption.filters.push('AND', ['internalid', 'anyof', configId]);
    //             this.CacheParams.push('configId=' + configId);
    //             return searchOption;
    //         }

    //         var recordData = {};
    //         if (!vendorId && (poId || poNum)) {
    //             var MainCFG = EndPoint.mainConfig();

    //             recordData = vcs_recordsLib.searchTransaction({
    //                 name: poNum,
    //                 id: poId,
    //                 overridePO: MainCFG.overridePONum,
    //                 columns: [
    //                     'entity',
    //                     'internalid',
    //                     'vendor.internalid',
    //                     'vendor.entityid',
    //                     'vendor.custentity_vc_bill_config'
    //                 ]
    //             });

    //             if (recordData && !vc2_util.isEmpty(recordData)) {
    //                 this.CacheParams.push('poId=' + recordData.id);
    //                 this.CacheParams.push('poNum=' + recordData.tranid);

    //                 vendorId = recordData.entity
    //                     ? recordData.entity.value || recordData.entity
    //                     : null;
    //                 subsId = recordData.subsidiary
    //                     ? recordData.subsidiary.value || recordData.subsidiary
    //                     : null;
    //             }
    //         }
    //         // else throw 'Please provide a vendor configuration or PO record';

    //         if (vendorId) {
    //             searchOption.filters.push('AND', [SENDPOVND_CFG.FIELD.VENDOR, 'anyof', vendorId]);
    //             this.CacheParams.push('vendorId=' + vendorId);
    //         }

    //         if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES && subsId) {
    //             searchOption.filters.push('AND', [SENDPOVND_CFG.FIELD.SUBSIDIARY, 'anyof', subsId]);
    //             this.CacheParams.push('subsId=' + subsId);
    //         }

    //         if (!this.CacheParams.length)
    //             throw 'Please provide a vendor configuration or PO record';

    //         vc2_util.log(logTitle, '// searchoption: ', searchOption);
    //         vc2_util.log(logTitle, '// CacheParams: ', this.CacheParams);

    //         return searchOption;
    //     },
    //     setCache: function (cacheValue) {
    //         if (vc2_util.isEmpty(cacheValue)) return;

    //         var cacheKey = this.CacheKey || this.generateCacheKey();

    //         // save it first
    //         vc2_util.setNSCache({ name: cacheKey, value: cacheValue });

    //         vc2_util.saveCacheList({
    //             listName: vc2_constant.CACHE_KEY.SENDPOVND_CONFIG,
    //             cacheKey: cacheKey
    //         });
    //     },
    //     removeCache: function (option) {
    //         vc2_util.deleteCacheList({ listName: vc2_constant.CACHE_KEY.SENDPOVND_CONFIG });
    //     }
    // });

    var EndPoint = {
        ConfigType: ListConfigType,
        loadConfig: function (option) {
            var logTitle = [LogTitle, 'loadConfig'].join('::'),
                returnValue;
            option = option || {};

            var configType = option.configType || this.ConfigType.MAIN;
            try {
                vc2_util.log(logTitle, '// option: ', option);

                // load the config based on the type
                switch (configType) {
                    case ListConfigType.MAIN:
                        return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
                    case ListConfigType.VENDOR:
                        return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
                    case ListConfigType.BILL:
                        return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
                    case ListConfigType.SENDPO:
                        return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
                    default:
                        throw 'Invalid config type';
                }
            } catch (error) {}

            return returnValue;
        },
        removeConfigCache: function (option) {
            var logTitle = [LogTitle, 'removeConfigCache'].join('::'),
                configType = option.configType || this.ConfigType.MAIN;

            // remove the config cache based on the type
            switch (configType) {
                case ListConfigType.MAIN:
                    return __MainConfigLib.removeCache(option);
                case ListConfigType.VENDOR:
                    return __OrderConfigLib.removeCache(option);
                case ListConfigType.BILL:
                    return __BillConfigLib.removeCache(option);
                case ListConfigType.SENDPO:
                    return __SendPOConfigLib.removeCache(option);
                default:
                    throw 'Invalid config type';
            }
        },
        sendConfig: function (option) {
            var logTitle = [LogTitle, 'sendConfig'].join('::'),
                configType = option.configType || this.ConfigType.MAIN;

            // remove the config cache based on the type
            switch (configType) {
                case ListConfigType.MAIN:
                    return __MainConfigLib.send(option);
                case ListConfigType.VENDOR:
                    return __OrderConfigLib.send(option);
                case ListConfigType.BILL:
                    return __BillConfigLib.send(option);
                case ListConfigType.SENDPO:
                    return __SendPOConfigLib.send(option);
                default:
                    throw 'Invalid config type';
            }
        },
        mainConfig: function (option) {
            var logTitle = [LogTitle, 'mainConfig'].join(':'),
                option = option || {},
                returnValue;

            try {
                return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
            } catch (error) {}
        },
        orderVendorConfig: function (option) {
            var logTitle = [LogTitle, 'orderVendorConfig'].join(':'),
                returnValue;
            try {
                return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
            } catch (error) {}
        },
        billVendorConfig: function (option) {
            var logTitle = [LogTitle, 'billVendorConfig'].join(':'),
                returnValue;

            try {
                return ConfigLib.load(util.extend(option, { configType: 'MAIN' }));
            } catch (error) {}
        },
        sendPOVendorConfig: function (option) {
            var logTitle = [LogTitle, 'sendPOVendorConfig'].join(':'),
                returnValue;
            try {
                return __SendPOConfigLib.load(option);
            } catch (error) {}
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join(':'),
                returnValue;

            var servResponse = LibLicense.validate({ doRetry: true, retryMax: 3 });
            // vc2_util.log(logTitle, 'servResponse: ', servResponse);
            returnValue = servResponse;

            return returnValue;
        },
        sendVendorConfig: function (option) {
            var logTitle = [LogTitle, 'sendVendorConfig'].join('::');

            __OrderConfigLib.send({ id: option.recordId || option.id });

            return true;
        },
        sendBillConfig: function (option) {
            var logTitle = [LogTitle, 'sendBillConfig'].join('::');

            __BillConfigLib.send({ id: option.recordId || option.id });

            return true;
        },
        sendMainConfig: function (option) {
            var logTitle = [LogTitle, 'sendMainConfig'].join('::');

            __MainConfigLib.send({ id: option.recordId || option.id });

            return true;
        }
    };

    EndPoint.vendorConfig = EndPoint.orderVendorConfig;

    return EndPoint;
});
