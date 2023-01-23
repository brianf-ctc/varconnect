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

define(function (require) {
    // load modules https://requirejs.org/docs/api.html#modulenotes
    var ns_runtime = require('N/runtime'),
        ns_format = require('N/format'),
        ns_record = require('N/record'),
        ns_search = require('N/search'),
        vc2_global = require('./CTC_VC2_Constants.js');

    var LogTitle = 'VC2_UTILS',
        LogPrefix;

    var vc_util = {
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
        getCache: function (cacheKey) {
            return vc_util.CACHE.hasOwnProperty(cacheKey) ? vc_util.CACHE[cacheKey] : null;
        },
        setCache: function (cacheKey, objVar) {
            vc_util.CACHE[cacheKey] = objVar;
        },
        getUsage: function () {
            var REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[rem-usage:' + REMUSAGE + '] ';
        },
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (vc_util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
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
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
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
        getNodeTextContent: function (node) {
            // log.debug('node', node);
            if (!vc_util.isUndefined(node)) return node.textContent;
            else return null;
        },
        generateSerialLink: function (params) {
            var ns_url = vc_util.loadModule('N/url');

            var protocol = 'https://';
            var domain = ns_url.resolveDomain({
                hostType: ns_url.HostType.APPLICATION
            });
            var linkUrl = ns_url.resolveScript({
                scriptId: constants.Scripts.Script.VIEW_SERIALS_SL,
                deploymentId: constants.Scripts.Deployment.VIEW_SERIALS_SL,
                params: params
            });

            return protocol + domain + linkUrl;
        },
        isUndefined: function (value) {
            // Obtain `undefined` value that's guaranteed to not have been re-assigned
            var undefined = void 0;
            return value === undefined;
        },
        extractError: function (option) {
            option = option || {};
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage)) errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        convertToQuery: function (json) {
            if (typeof json !== 'object') return;

            var qry = [];
            for (var key in json) {
                var qryVal = encodeURIComponent(json[key]),
                    qryKey = encodeURIComponent(key);
                qry.push([qryKey, qryVal].join('='));
            }

            return qry.join('&');
        },
        vcLog: function (option) {
            var logTitle = [LogTitle, 'vcLog'].join('::');
            // log.audit(logTitle, option);

            var VC_LOG = vc2_global.RECORD.VC_LOG,
                LOG_STATUS = vc2_global.LIST.VC_LOG_STATUS;

            try {
                var logOption = {},
                    batchTransaction = option.batch,
                    isBatched = batchTransaction != null;
                logOption.APPLICATION = option.appName || vc2_global.LOG_APPLICATION;
                logOption.HEADER = option.title || logOption.APPLICATION;
                logOption.BODY =
                    option.body ||
                    option.content ||
                    option.message ||
                    option.errorMessage ||
                    option.errorMsg ||
                    (option.error ? vc_util.extractError(option.error) : '');

                logOption.BODY = util.isString(logOption.BODY) ? logOption.BODY : JSON.stringify(logOption.BODY);

                if (
                    option.status &&
                    vc_util.inArray(option.status, [LOG_STATUS.ERROR, LOG_STATUS.INFO, LOG_STATUS.SUCCESS])
                )
                    logOption.STATUS = option.status;
                else if (option.isError || option.error || option.errorMessage || option.errorMsg)
                    logOption.STATUS = LOG_STATUS.ERROR;
                else if (option.isSuccess) logOption.STATUS = LOG_STATUS.SUCCESS;
                else logOption.STATUS = LOG_STATUS.INFO;

                logOption.TRANSACTION = option.recordId || option.transaction || option.id || option.internalid || '';

                logOption.DATE = new Date();
                // log.audit(logTitle, logOption);

                if (isBatched) {
                    var VC_LOG_BATCH = vc2_global.RECORD.VC_LOG_BATCH;
                    var batchOption = {
                        TRANSACTION: batchTransaction
                    };
                    // create the log as an inline item
                    var recBatch = this._batchedVCLogs[batchTransaction] || ns_record.create({ type: VC_LOG_BATCH.ID });
                    for (var field in VC_LOG_BATCH.FIELD) {
                        var fieldName = VC_LOG_BATCH.FIELD[field];
                        recBatch.setValue({
                            fieldId: fieldName,
                            value: batchOption[field] || ''
                        });
                    }
                    var sublistId = ['recmach', VC_LOG.FIELD.BATCH].join(''),
                        line = recBatch.getLineCount({
                            sublistId: sublistId
                        });
                    for (var column in VC_LOG.FIELD) {
                        var columnName = VC_LOG.FIELD[column];
                        recBatch.setSublistValue({
                            sublistId: sublistId,
                            fieldId: columnName,
                            line: line,
                            value: logOption[column] || ''
                        });
                    }
                    this._batchedVCLogs[batchTransaction] = recBatch;
                    log.audit(logOption.HEADER, logOption.BODY);
                } else {
                    // create the log
                    var recLog = ns_record.create({ type: VC_LOG.ID });
                    for (var field in VC_LOG.FIELD) {
                        var fieldName = VC_LOG.FIELD[field];
                        // log.audit(
                        //     logTitle,
                        //     '>> set log field: ' +
                        //         JSON.stringify([field, fieldName, logOption[field] || ''])
                        // );

                        recLog.setValue({
                            fieldId: fieldName,
                            value: logOption[field] || ''
                        });
                    }
                    recLog.save();
                    // log.audit(logOption.HEADER, logOption.BODY);
                }
            } catch (error) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + vc_util.extractError(error));
            }
            return true;
        },
        loadModule: function (mod) {
            var returnValue = require(mod);
            return returnValue;
        },
        sendRequest: function (option) {
            var logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue = {};

            var VALID_RESP_CODE = [200, 207];

            var _DEFAULT = {
                validMethods: ['post', 'get'],
                maxRetries: 3,
                maxWaitMs: 3000
            };
            var ns_https = require('N/https');

            var queryOption = option.query || option.queryOption;
            if (!queryOption || vc_util.isEmpty(queryOption)) throw 'Missing query option';

            option.method = (option.method || 'get').toLowerCase();
            var response,
                responseBody,
                parsedResponse,
                param = {
                    noLogs: option.hasOwnProperty('noLogs') ? option.noLogs : false,
                    doRetry: option.hasOwnProperty('doRetry') ? option.doRetry : false,
                    retryCount: option.hasOwnProperty('retryCount') ? option.retryCount : 1,
                    responseType: option.hasOwnProperty('responseType') ? option.responseType : 'JSON',
                    maxRetry: option.hasOwnProperty('maxRetry') ? option.maxRetry : _DEFAULT.maxRetries || 0,

                    logHeader: option.header || logTitle,
                    logTranId: option.internalId || option.transactionId || option.recordId,
                    isXML: option.hasOwnProperty('isXML') ? !!option.isXML : false, // default json
                    isJSON: option.hasOwnProperty('isJSON') ? !!option.isJSON : true, // default json
                    waitMs: option.waitMs || _DEFAULT.maxWaitMs,
                    method: vc_util.inArray(option.method, _DEFAULT.validMethods) ? option.method : 'get'
                };
            if (option.isXML) param.isJSON = false;

            // log.audit(logTitle, '>> param: ' + JSON.stringify(param));
            var LOG_STATUS = vc2_global.LIST.VC_LOG_STATUS;
            var startTime = new Date();
            try {
                if (!param.noLogs) {
                    vc_util.vcLog({
                        title: [param.logHeader, ' Request ', '(' + param.method + ')'].join(''),
                        content: queryOption,
                        transaction: param.logTranId,
                        status: LOG_STATUS.INFO
                    });
                }

                log.audit(logTitle, '>> REQUEST: ' + JSON.stringify(queryOption));
                returnValue.REQUEST = queryOption;

                /////////////////////////////////////////
                //// SEND THE REQUEST //////
                response = ns_https[param.method](queryOption);
                returnValue.RESPONSE = response;
                /////////////////////////////////////////

                log.audit(
                    logTitle,
                    '>> RESPONSE ' +
                        JSON.stringify({
                            duration: this.roundOff((new Date() - startTime) / 1000),
                            code: response.code || '-no response-',
                            body: response.body || '-empty response-'
                        })
                );

                if (!response || !response.body) {
                    throw 'Empty or Missing Response !';
                }
                responseBody = response.body;
                if (param.isJSON) {
                    parsedResponse = vc_util.safeParse(response);
                    returnValue.PARSED_RESPONSE = parsedResponse;
                }

                if (!response.code || !vc_util.inArray(response.code, VALID_RESP_CODE)) {
                    throw parsedResponse
                        ? JSON.stringify(parsedResponse)
                        : 'Received invalid response code - ' + response.code;
                }

                ////////////////////////////
            } catch (error) {
                var errorMsg = vc_util.extractError(error);
                returnValue.isError = true;
                returnValue.errorMsg = errorMsg;
                returnValue.error = error;
                returnValue.details = parsedResponse || response;

                log.audit(
                    logTitle,
                    '>> RESPONSE time: ' +
                        JSON.stringify({
                            duration: this.roundOff((new Date() - startTime) / 1000)
                        })
                );

                vc_util.vcLog({
                    title:
                        [param.logHeader + ': Error', errorMsg].join(' - ') +
                        (param.doRetry ? ' (retry:' + param.retryCount + '/' + param.maxRetry + ')' : ''),
                    content: { error: errorMsg, details: returnValue.details },
                    transaction: param.logTranId,
                    isError: true
                });

                log.error(logTitle, '## ERROR ##' + errorMsg + '\n' + JSON.stringify(error));
                if (param.doRetry) log.audit(logTitle, '## RETRY ##  -- ' + param.retryCount + '/' + param.maxRetry);

                if (param.doRetry && param.maxRetry > param.retryCount) {
                    log.audit(logTitle, '... retrying in ' + param.waitMs);
                    option.retryCount = param.retryCount + 1;
                    vc_util.waitMs(param.waitMs);
                    returnValue = vc_util.sendRequest(option);
                }
            } finally {
                if (!param.noLogs) {
                    vc_util.vcLog({
                        title: [param.logHeader, 'Response'].join(' - '),
                        content: param.isJSON
                            ? JSON.stringify(parsedResponse || responseBody || response)
                            : responseBody,
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
                log.error(logTitle, '## ERROR ##' + vc_util.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },
        searchAllPaged: function (option) {
            var objSearch,
                arrResults = [],
                logTitle = [LogTitle, 'searchAllPaged'].join('::');
            option = option || {};

            try {
                var searchId = option.id || option.searchId;
                var searchType = option.recordType || option.type;

                objSearch = option.searchObj
                    ? option.searchObj
                    : searchId
                    ? ns_search.load({
                          id: searchId
                      })
                    : searchType
                    ? ns_search.create({
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
                        maxResults > pageSize ? pagedResults.data : pagedResults.data.slice(0, maxResults)
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
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::');

            var dateString = option.dateString || option,
                dateFormat = vc_util.CACHE.DATE_FORMAT,
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
                }
                vc_util.CACHE.DATE_FORMAT = dateFormat;
            }

            if (dateString && dateString.length > 0 && dateString != 'NA') {
                try {
                    var stringToProcess = dateString.replace(/-/g, '/').replace(/\n/g, ' ').split(' ');

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

                date = ns_format.format({
                    value: date,
                    type: dateFormat ? dateFormat : ns_format.Type.DATE
                });
            }

            log.audit(
                logTitle,
                JSON.stringify({
                    param: option,
                    dateString: dateString,
                    format: dateFormat,
                    dateValue: date
                })
            );

            return date;
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld]) ? arrResults[fld][0] : arrResults[fld];
                }
            }
            return arrData;
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
            var flValue = util.isNumber(value) ? value : this.forceFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        },
        getTaskStatus: function (taskId) {
            var ns_task = require('N/task');
            return ns_task.checkStatus({ taskId: taskId });
        },
        forceDeploy: function (option) {
            var logTitle = [LogTitle, 'forceDeploy'].join('::');
            var returnValue = null;
            var ns_task = require('N/task');

            var FN = {
                randomStr: function (len) {
                    len = len || 5;
                    var str = new Date().getTime().toString();
                    return str.substring(str.length - len, str.length);
                },
                deploy: function (scriptId, deployId, scriptParams, taskType) {
                    var logTitle = [LogTitle, 'forceDeploy:deploy'].join('::');
                    var returnValue = false;

                    try {
                        var taskInfo = {
                            taskType: taskType,
                            scriptId: scriptId
                        };
                        if (deployId) taskInfo.deploymentId = deployId;
                        if (scriptParams) taskInfo.params = scriptParams;

                        var objTask = ns_task.create(taskInfo);

                        var taskId = objTask.submit();
                        var taskStatus = ns_task.checkStatus({
                            taskId: taskId
                        });

                        // check the status
                        log.audit(
                            logTitle,
                            '## DEPLOY status: ' +
                                JSON.stringify({
                                    id: taskId,
                                    status: taskStatus
                                })
                        );
                        returnValue = taskId;
                    } catch (e) {
                        log.error(logTitle, e.name + ':' + e.message);
                    }

                    return returnValue;
                },
                copyDeploy: function (scriptId) {
                    var logTitle = [LogTitle, 'forceDeploy:copyDeploy'].join('::');
                    var returnValue = false;
                    try {
                        var searchDeploy = ns_search.create({
                            type: ns_search.Type.SCRIPT_DEPLOYMENT,
                            filters: [
                                ['script.scriptid', 'is', scriptId],
                                'AND',
                                ['status', 'is', 'NOTSCHEDULED'],
                                'AND',
                                ['isdeployed', 'is', 'T']
                            ],
                            columns: ['scriptid']
                        });
                        var newDeploy = null;

                        searchDeploy.run().each(function (result) {
                            if (!result.id) return false;
                            newDeploy = ns_record.copy({
                                type: ns_record.Type.SCRIPT_DEPLOYMENT,
                                id: result.id
                            });

                            var newScriptId = result.getValue({ name: 'scriptid' });
                            newScriptId = newScriptId.toUpperCase().split('CUSTOMDEPLOY')[1];
                            newScriptId = [newScriptId.substring(0, 20), FN.randomStr()].join('_');

                            newDeploy.setValue({ fieldId: 'status', value: 'NOTSCHEDULED' });
                            newDeploy.setValue({ fieldId: 'isdeployed', value: true });
                            newDeploy.setValue({
                                fieldId: 'scriptid',
                                value: newScriptId.toLowerCase().trim()
                            });
                        });

                        return newDeploy
                            ? newDeploy.save({
                                  enableSourcing: false,
                                  ignoreMandatoryFields: true
                              })
                            : false;
                    } catch (e) {
                        log.error(logTitle, e.name + ': ' + e.message);
                        throw e;
                    }
                },
                copyAndDeploy: function (scriptId, params, taskType) {
                    FN.copyDeploy(scriptId);
                    FN.deploy(scriptId, null, params, taskType);
                }
            };
            ////////////////////////////////////////
            try {
                if (!option.scriptId)
                    throw error.create({
                        name: 'MISSING_REQD_PARAM',
                        message: 'missing script id',
                        notifyOff: true
                    });

                if (!option.taskType) {
                    option.taskType = ns_task.TaskType.SCHEDULED_SCRIPT;
                    option.taskType = option.isMapReduce
                        ? ns_task.TaskType.MAP_REDUCE
                        : option.isSchedScript
                        ? ns_task.TaskType.SCHEDULED_SCRIPT
                        : option.taskType;
                }

                log.debug(logTitle, '>> params: ' + JSON.stringify(option));

                returnValue =
                    FN.deploy(option.scriptId, option.deployId, option.scriptParams, option.taskType) ||
                    FN.deploy(option.scriptId, null, option.scriptParams, option.taskType) ||
                    FN.copyAndDeploy(option.scriptId, option.scriptParams, option.taskType);

                log.audit(logTitle, '>> deploy: ' + JSON.stringify(returnValue));
            } catch (e) {
                log.error(logTitle, e.name + ': ' + e.message);
                throw e;
            }
            ////////////////////////////////////////

            return returnValue;
        },

        _batchedVCLogs: {},
        submitVCLogBatch: function (batchTransaction) {
            var logTitle = [LogTitle, 'submitVCLogBatch'].join('::');
            var recBatch = this._batchedVCLogs[batchTransaction];
            if (recBatch) {
                var VC_LOG = vc2_global.RECORD.VC_LOG,
                    sublistId = ['recmach', VC_LOG.FIELD.BATCH].join('');
                var lineCount = recBatch.getLineCount({
                    sublistId: sublistId
                });
                if (lineCount > 0) {
                    recBatch.save();
                    log.audit(logTitle, 'VC Logs submitted for batch ' + batchTransaction);
                } else {
                    recBatch = null;
                }
            }
            if (!recBatch) {
                log.debug(logTitle, 'No VC Logs to submit for batch ' + batchTransaction);
            }
        },
        isOneWorld: function () {
            return ns_runtime.isFeatureInEffect({ feature: 'Subsidiaries' });
        },
        extend: function (source, contrib) {
            // do this to preserve the source values
            return util.extend(util.extend({}, source), contrib);
        },

        removeNullValues: function (option) {
            var newObj = {};
            if (!option || vc_util.isEmpty(option) || !util.isObject(option)) return newObj;

            for (var prop in option) {
                if (option[prop] === null) continue;
                newObj[prop] = option[prop];
            }

            return newObj;
        },

        copyValues: function (source, contrib, option) {
            option = option || {};
            if (!util.isObject(source) || !util.isObject(contrib)) return false;

            var onlyNullValues = option.onlyNullValues || false,
                overwriteSource = option.overwriteSource || false;

            var newSource = overwriteSource ? source : util.extend({}, source);

            for (var fld in contrib) {
                var value = contrib[fld];

                if (!newSource.hasOwnProperty(fld) || newSource[fld] == null) {
                    newSource[fld] = value;
                }

                if (onlyNullValues) continue;
                newSource[fld] = value;
            }

            return newSource;
        },

        findMatching: function (option) {
            var logTitle = [LogTitle, 'findMatching'].join('::'),
                returnValue;

            var dataSource = option.dataSource || option.dataSet,
                filter = option.filter,
                findAll = option.findAll;

            if (vc_util.isEmpty(dataSource) || !util.isArray(dataSource)) return false;

            var arrResults = [],
                arrIndex = [];
            for (var i = 0, j = dataSource.length; i < j; i++) {
                var isFound = true;
                for (var fld in filter) {
                    if (dataSource[i][fld] != filter[fld]) {
                        isFound = false;
                        break;
                    }
                }
                if (isFound) {
                    arrResults.push(dataSource[i]);
                    arrIndex.push(i);
                    if (!findAll) break;
                }
            }

            returnValue = {
                data: arrResults && arrResults.length ? (findAll ? arrResults : arrResults.shift()) : false,
                index: arrIndex && arrIndex.length ? (findAll ? arrIndex : arrIndex.shift()) : false
            };

            return returnValue;
        },

        findMatchingEntry: function (option) {
            var logTitle = [LogTitle, 'findMatchingEntry'].join('::'),
                returnValue;

            var dataSource = option.dataSource || option.dataSet,
                filter = option.filter,
                findAll = option.findAll;

            if (vc_util.isEmpty(dataSource) || !util.isArray(dataSource)) return false;

            var arrResults = [];
            for (var i = 0, j = dataSource.length; i < j; i++) {
                var isFound = true;
                for (var fld in filter) {
                    if (dataSource[i][fld] != filter[fld]) {
                        isFound = false;
                        break;
                    }
                }
                if (isFound) {
                    arrResults.push(dataSource[i]);
                    if (!findAll) break;
                }
            }

            returnValue = arrResults && arrResults.length ? (findAll ? arrResults : arrResults.shift()) : false;

            return returnValue;
        },
        extractValues: function (option) {
            var logTitle = [LogTitle, 'extractValues'].join('::'),
                returnValue;

            var sourceObj = option.source || option.sourceObj;
            var params = option.params || option.fields;

            if (this.isEmpty(sourceObj) || this.isEmpty(params)) return false;
            if (!util.isObject(sourceObj) && !util.isArray(params)) return false;

            returnValue = {};

            for (var i = 0, j = params.length; i < j; i++) {
                if (!params[i]) continue;
                returnValue[params[i]] = sourceObj[params[i]];
            }

            return returnValue;
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

                    var objSearch = ns_search.create({
                        type: 'script',
                        filters: [['scriptid', 'is', scriptId]],
                        columns: ['scriptfile', 'name']
                    });

                    var fileId = null;
                    objSearch.run().each(function (row) {
                        fileId = row.getValue('scriptfile');
                        return true;
                    });

                    var ns_file = this.loadModule('N/file');
                    var fileObj = ns_file.load({
                        id: fileId
                    });

                    // get the actual folderPathj
                    var folderInfo = {
                        path: (function (path) {
                            var pathNew = path.split('/');
                            pathNew.pop();
                            return pathNew.join('/');
                        })(fileObj.path),
                        id: fileObj.folder
                    };

                    log.audit(logTitle, folderInfo);

                    returnValue = folderInfo;
                    this.CACHE[cacheKey] = folderInfo;
                }
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            } finally {
                // log.debug(logTitle, '>> current folder: ' + returnValue);
            }

            return returnValue;
        },
        searchFile: function (option) {
            var fileName = option.filename || option.name;
            if (!fileName) return false;

            var arrCols = ['name', 'folder', 'documentsize', 'url', 'created', 'modified', 'filetype'];
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
                var objSearch = ns_search.create(searchOption);
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

            returnValue = option.doReturnArray && option.doReturnArray === true ? fileInfo : fileInfo.shift();

            return returnValue;
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
                var ns_file = this.loadModule('N/file');
                var fileObj = ns_file.load({
                    id: fileId
                });

                returnValue = fileObj.getContents();
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            }

            return returnValue;
        }
    };

    return vc_util;
});
