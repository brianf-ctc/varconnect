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

define(['N/runtime', 'N/format', 'N/record', 'N/search', './CTC_VCSP_Constants.js'], function (
    NS_Runtime,
    NS_Format,
    NS_Record,
    NS_Search,
    CTC_Global
) {
    var LogTitle = 'CTC_Util',
        LogPrefix;

    var CTC_Util = {
        CACHE: {},
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (CTC_Util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        searchAllPaged: function (option) {
            var objSearch,
                arrResults = [],
                logTitle = 'CTC_Utils:searchAllPaged';
            option = option || {};

            try {
                var searchId = option.id || option.searchId;
                var searchType = option.recordType || option.type;

                objSearch = option.searchObj
                    ? option.searchObj
                    : searchId
                    ? NS_Search.load({
                          id: searchId
                      })
                    : searchType
                    ? NS_Search.create({
                          type: searchType
                      })
                    : null;

                if (!objSearch) throw 'Invalid search identifier';
                if (!objSearch.filters) objSearch.filters = [];
                if (!objSearch.columns) objSearch.columns = [];

                if (option.filters) objSearch.filters = objSearch.filters.concat(option.filters);
                if (option.filterExpression) objSearch.filterExpression = option.filterExpression;
                if (option.columns) objSearch.columns = objSearch.columns.concat(option.columns);

                var maxResults = option.maxResults || 0;
                var pageSize = maxResults && maxResults <= 1000 ? maxResults : 1000;

                // run the search
                var objPagedResults = objSearch.runPaged({
                    pageSize: pageSize
                });
                // set the max results to the search length, if not defined;
                maxResults = maxResults || objPagedResults.count;

                for (var i = 0, j = objPagedResults.pageRanges.length; i < j; i++) {
                    var pagedResults = objPagedResults.fetch({
                        index: objPagedResults.pageRanges[i].index
                    });

                    // test if we need to get all the paged results,
                    // .. or just a slice, of maxResults is less than the pageSize
                    arrResults = arrResults.concat(
                        maxResults > pageSize
                            ? pagedResults.data
                            : pagedResults.data.slice(0, maxResults)
                    );

                    // reduce the max results
                    maxResults = maxResults - pageSize;
                    if (maxResults < 0) break;
                }
            } catch (e) {
                log.debug(logTitle, '>> error: ' + JSON.stringify(e));
                throw e.message;
            }

            return arrResults;
        },
        getNodeTextContent: function (node) {
            // log.debug('node', node);
            if (!CTC_Util.isUndefined(node)) return node.textContent;
            else return null;
        },
        isUndefined: function (value) {
            // Obtain `undefined` value that's guaranteed to not have been re-assigned
            var undefined = void 0;
            return value === undefined;
        },
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::');
            log.audit(logTitle, '>> option: ' + JSON.stringify(option));

            var dateString = option.dateString || option,
                dateFormat = CTC_Util.CACHE.DATE_FORMAT,
                date = '';

            if (!dateFormat) {
                try {
                    require(['N/config'], function (config) {
                        var generalPref = config.load({
                            type: config.Type.COMPANY_PREFERENCES
                        });
                        dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
                        return true;
                    });
                } catch (e) {}

                if (!dateFormat) {
                    try {
                        dateFormat = nlapiGetContext().getPreference('DATEFORMAT');
                    } catch (e) {}
                    // log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
                }
                CTC_Util.CACHE.DATE_FORMAT = dateFormat;
                log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
            }

            if (dateString && dateString.length > 0 && dateString != 'NA') {
                try {
                    var stringToProcess = dateString
                        .replace(/-/g, '/')
                        .replace(/\n/g, ' ')
                        .split(' ');

                    for (var i = 0; i < stringToProcess.length; i++) {
                        var singleString = stringToProcess[i];
                        if (singleString) {
                            var stringArr = singleString.split('T'); //handle timestamps with T
                            singleString = stringArr[0];
                            var convertedDate = new Date(singleString);

                            if (!date || convertedDate > date) date = convertedDate;
                        }
                    }
                } catch (e) {
                    log.error(logTitle, LogPrefix + '>> !! ERROR !! ' + util.extractError(e));
                }
            }

            //Convert to string
            if (date) {
                //set date
                var year = date.getFullYear();
                if (year < 2000) {
                    year += 100;
                    date.setFullYear(year);
                }

                date = NS_Format.format({
                    value: date,
                    type: dateFormat ? dateFormat : NS_Format.Type.DATE
                });
            }

            log.audit('---datestring ' + dateString, date);
            return date;
        },
        forceInt: function (stValue) {
            var intValue = parseInt(stValue, 10);

            if (isNaN(intValue) || stValue == Infinity) {
                return 0;
            }

            return intValue;
        },
        forceFloat: function (stValue) {
            var flValue = this.parseFloat(stValue);

            if (isNaN(flValue) || stValue == Infinity) {
                return 0.0;
            }

            return flValue;
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = NS_Search.lookupFields(option);
            // log.debug('flatLookup', 'arrResults>>' + JSON.stringify(arrResults));

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
        waitMs: function (waitms) {
            var logTitle = [LogTitle, 'waitMs'].join('::');
            waitms = waitms || 5000;

            log.audit(logTitle, 'waiting for ' + waitms);

            var nowDate = new Date(),
                isDone = false;
            while (!isDone) {
                var deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitms;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }

            return true;
        },
        waitRandom: function (max) {
            var logTitle = [LogTitle, 'waitRandom'].join('::');

            var waitTimeMS = Math.floor(Math.random() * Math.floor(max));
            max = max || 5000;

            log.audit(logTitle, 'waiting for ' + waitTimeMS);
            var nowDate = new Date(),
                isDone = false;

            while (!isDone) {
                var deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitTimeMS;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }
            log.audit(logTitle, '>> Total Wait: ' + (new Date() - nowDate));
            return true;
        },
        randomStr: function (len) {
            len = len || 5;
            var str = new Date().getTime().toString();
            return str.substring(str.length - len, str.length);
        },
        roundOff: function (value) {
            var flValue = this.forceFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        },
        vcLog: function (option) {
            var logTitle = [LogTitle, 'vcLog'].join('::');
            // log.audit(logTitle, option);

            var VC_LOG_ID = CTC_Global.Records.VC_LOG,
                VC_LOG_FIELDS = CTC_Global.Fields.VarConnectLog,
                LOG_STATUS = CTC_Global.Lists.VC_LOG_STATUS;

            try {
                var logOption = {};
                logOption.APPLICATION = option.appName || CTC_Global.LOG_APPLICATION;
                logOption.HEADER = option.title || logOption.APPLICATION;
                logOption.BODY =
                    option.body ||
                    option.content ||
                    option.message ||
                    option.errorMessage ||
                    option.errorMsg ||
                    (option.error ? CTC_Util.extractError(option.error) : '');

                logOption.BODY = util.isString(logOption.BODY)
                    ? logOption.BODY
                    : JSON.stringify(logOption.BODY);

                if (
                    option.status &&
                    CTC_Util.inArray(option.status, [
                        LOG_STATUS.ERROR,
                        LOG_STATUS.INFO,
                        LOG_STATUS.SUCCESS
                    ])
                )
                    logOption.STATUS = option.status;
                else if (option.isError || option.error || option.errorMessage || option.errorMsg)
                    logOption.STATUS = LOG_STATUS.ERROR;
                else if (option.isSuccess) logOption.STATUS = LOG_STATUS.SUCCESS;
                else logOption.STATUS = LOG_STATUS.INFO;

                logOption.TRANSACTION =
                    option.recordId || option.transaction || option.id || option.internalid || '';

                logOption.DATE = new Date();
                log.audit(logTitle, logOption);

                // create the log
                var recLog = NS_Record.create({ type: VC_LOG_ID });
                for (var field in VC_LOG_FIELDS) {
                    var fieldName = VC_LOG_FIELDS[field];
                    recLog.setValue({
                        fieldId: fieldName,
                        value: logOption[field] || ''
                    });
                }
                return recLog.save();
                // log.audit(logOption.HEADER, logOption.BODY);
            } catch (error) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + CTC_Util.extractError(error));
            }
            return null;
        },
        extractError: function (option) {
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        convertToQuery: function (json) {
            if (typeof json !== 'object') return;

            var qry = [];
            for (var key in json) {
                var qryVal = encodeURIComponent(json[key]);
                var qryKey = encodeURIComponent(key);
                qry.push([qryKey, qryVal].join('='));
            }

            return qry.join('&');
        },
        loadModule: function (mod) {
            var returnValue;
            require([mod], function (modObj) {
                returnValue = modObj;
                return true;
            });
            return returnValue;
        },

        sendRequest: function (option) {
            var logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue = {};

            var VALID_RESP_CODE = [200, 207, 201]; // Added 201 for INGRAM

            var _DEFAULT = {
                validMethods: ['post', 'get'],
                maxRetries: 3,
                maxWaitMs: 3000
            };
            var ns_https = CTC_Util.loadModule('N/https');

            var queryOption = option.query || option.queryOption;
            if (!queryOption || CTC_Util.isEmpty(queryOption)) throw 'Missing query option';

            option.method = (option.method || 'get').toLowerCase();
            var response,
                responseBody,
                parsedResponse,
                param = {
                    noLogs: option.hasOwnProperty('noLogs') ? option.noLogs : false,
                    doRetry: option.hasOwnProperty('doRetry') ? option.doRetry : false,
                    retryCount: option.hasOwnProperty('retryCount') ? option.retryCount : 0,
                    responseType: option.hasOwnProperty('responseType')
                        ? option.responseType
                        : 'JSON',
                    maxRetry: option.hasOwnProperty('maxRetry')
                        ? option.maxRetry
                        : _DEFAULT.maxRetries || 0,

                    logHeader: option.header || logTitle,
                    logTranId: option.internalId || option.transactionId || option.recordId,
                    isXML: option.hasOwnProperty('isXML') ? !!option.isXML : false, // default json
                    isJSON: option.hasOwnProperty('isJSON') ? !!option.isJSON : true, // default json
                    waitMs: option.waitMs || _DEFAULT.maxWaitMs,
                    method: CTC_Util.inArray(option.method, _DEFAULT.validMethods)
                        ? option.method
                        : 'get'
                };

            if (option.isXML) param.isJSON = false;
            log.audit(logTitle, '>> param: ' + JSON.stringify(param));
            var LOG_STATUS = CTC_Global.Lists.VC_LOG_STATUS;

            try {
                if (!param.noLogs) {
                    CTC_Util.vcLog({
                        title: [param.logHeader, 'Request'].join(' - '),
                        content: queryOption,
                        transaction: param.logTranId,
                        status: LOG_STATUS.INFO
                    });
                }

                log.audit(logTitle, '>> REQUEST: ' + JSON.stringify(queryOption));
                returnValue.REQUEST = queryOption;

                //// SEND THE REQUEST //////
                response = ns_https[param.method](queryOption);
                returnValue.RESPONSE = response;

                log.audit(
                    logTitle,
                    '>> RESPONSE ' +
                        JSON.stringify({
                            code: response ? response.code : '-no response-',
                            body: response ? response.body : '-empty response-'
                        })
                );

                if (!response || !response.body) {
                    throw 'Empty or Missing Response !';
                }

                responseBody = response.body;
                if (param.isJSON) {
                    parsedResponse = CTC_Util.safeParse(response);
                    returnValue.PARSED_RESPONSE = parsedResponse;
                }

                if (!response.code || !CTC_Util.inArray(response.code, VALID_RESP_CODE)) {
                    throw 'Received invalid response code - ' + response.code;
                }

                ////////////////////////////
            } catch (error) {
                var errorMsg = CTC_Util.extractError(error);
                returnValue.isError = true;
                returnValue.errorMsg = errorMsg;
                returnValue.error = error;
                returnValue.details = parsedResponse || response;

                CTC_Util.vcLog({
                    title:
                        [param.logHeader + ': Error', errorMsg].join(' - ') +
                        (param.doRetry
                            ? ' (retry:' + param.retryCount + '/' + param.maxRetry + ')'
                            : ''),
                    content: { error: errorMsg, details: returnValue.details },
                    transaction: param.logTranId,
                    isError: true
                });

                log.error(logTitle, '## ERROR ##' + errorMsg + '\n' + JSON.stringify(error));

                if (param.doRetry && param.maxRetry > param.retryCount) {
                    log.audit(logTitle, '... retrying in ' + param.waitMs);
                    option.retryCount = param.retryCount + 1;
                    CTC_Util.waitMs(param.waitMs);
                    returnValue = CTC_Util.sendRequest(option);
                }
            } finally {
                if (!param.noLogs) {
                    returnValue.logId = CTC_Util.vcLog({
                        title: [param.logHeader, 'Response'].join(' - '),
                        content: parsedResponse || responseBody || response,
                        transaction: param.logTranId,
                        status: LOG_STATUS.INFO
                    });
                }
            }

            return returnValue;
        },
        safeParse: function (response) {
            var logTitle = [LogTitle, 'safeParse'].join('::'),
                returnValue;

            // log.audit(logTitle, response);
            try {
                returnValue = JSON.parse(response.body || response);
            } catch (error) {
                log.error(logTitle, '## ERROR ##' + CTC_Util.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },

        isOneWorld: function () {
            return NS_Runtime.isFeatureInEffect({ feature: 'Subsidiaries' });
        },

        getFileContent: function (option) {
            var returnValue = null;
            var logTitle = [LogTitle, 'getFileContent'];

            try {
                var fileId = option.fileId;
                if (!fileId) {
                    var fileName = option.filename || option.name;
                    if (!fileName) return false;

                    var folderId = option.folder || option.folderId || this.getCurrentFolder();
                    var fileInfo = this.searchFile({
                        name: fileName,
                        folder: folderId
                    });

                    if (!fileInfo) return false;
                    fileId = fileInfo.id;
                }

                // load the file
                var NS_File = this.loadModule('N/file');
                var fileObj = NS_File.load({
                    id: fileId
                });

                returnValue = fileObj.getContents();
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            }

            return returnValue;
        },
        searchFolder: function (option) {
            var folderName = option.folderName || option.name;
            if (!folderName) return false;

            var arrCols = ['name', 'parent', 'foldersize', 'parent', 'internalid'];
            var searchOption = {
                type: 'folder',
                columns: arrCols,
                filters: [['name', 'is', folderName]]
            };

            var parentId = option.parent || option.parentFolder;
            if (parentId) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['parent', 'anyof', parentId]);
            }

            var returnValue = null;

            var cacheKey = ['FileLib.searchFolder', JSON.stringify(searchOption)].join('::');
            var folderInfo = this.CACHE[cacheKey];

            if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                var objSearch = NS_Search.create(searchOption);
                folderInfo = []; // prepare for multiple results?
                objSearch.run().each(function (row) {
                    var fInfo = {};

                    for (var i = 0, j = row.columns.length; i < j; i++) {
                        var col = row.columns[i];
                        fInfo[col.name] = row.getValue(col);
                    }
                    fInfo.id = row.id;
                    folderInfo.push(fInfo);
                    return true;
                });

                this.CACHE[cacheKey] = folderInfo;
            }

            return option.doReturnArray && option.doReturnArray === true
                ? folderInfo
                : folderInfo.shift();
        },
        searchFile: function (option) {
            var fileName = option.filename || option.name;
            if (!fileName) return false;

            var arrCols = [
                'name',
                'folder',
                'documentsize',
                'url',
                'created',
                'modified',
                'filetype'
            ];
            var searchOption = {
                type: 'file',
                columns: arrCols,
                filters: [['name', 'is', fileName]]
            };

            var folderId = option.folder || option.folderId;
            if (folderId) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['folder', 'is', folderId]);
            }

            var returnValue = null;

            var cacheKey = ['FileLib.searchFile', JSON.stringify(searchOption)].join('::');
            var fileInfo = this.CACHE[cacheKey];

            if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                var objSearch = NS_Search.create(searchOption);
                fileInfo = []; // prepare for multiple results?
                objSearch.run().each(function (row) {
                    var fInfo = {};

                    for (var i = 0, j = row.columns.length; i < j; i++) {
                        var col = row.columns[i];
                        fInfo[col.name] = row.getValue(col);
                    }
                    fInfo.folderName = row.getText({
                        name: 'folder'
                    });
                    fInfo.id = row.id;

                    fileInfo.push(fInfo);
                    return true;
                });

                this.CACHE[cacheKey] = fileInfo;
            }

            return option.doReturnArray && option.doReturnArray === true
                ? fileInfo
                : fileInfo.shift();
        },
        getCurrentFolder: function (option) {
            var returnValue = null,
                logTitle = [LogTitle, 'getCurrentFolder'].join('::');
            option = option || {};

            try {
                var cacheKey = ['FileLib.getCurrentFolder', JSON.stringify(option)].join('::');
                returnValue = this.CACHE[cacheKey];

                if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                    var scriptId = option.scriptId;
                    if (!scriptId) {
                        if (!option.currentScript) {
                            if (!option.runtime) option.runtime = this.loadModule('N/runtime');
                            option.currentScript = option.runtime.getCurrentScript();
                        }
                        scriptId = option.currentScript.id;
                    }
                    if (!scriptId) return false;

                    var objSearch = NS_Search.create({
                        type: 'script',
                        filters: [['scriptid', 'is', scriptId]],
                        columns: ['scriptfile', 'name']
                    });

                    var fileId = null;
                    objSearch.run().each(function (row) {
                        fileId = row.getValue('scriptfile');
                        return true;
                    });

                    var NS_File = this.loadModule('N/file');
                    var fileObj = NS_File.load({
                        id: fileId
                    });

                    returnValue = fileObj.folder;
                    this.CACHE[cacheKey] = fileObj.folder;
                }
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            } finally {
                // log.debug(logTitle, '>> current folder: ' + returnValue);
            }

            return returnValue;
        }
    };

    return CTC_Util;
});
