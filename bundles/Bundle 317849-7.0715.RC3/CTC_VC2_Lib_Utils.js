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
        ns_xml = null,
        ns_url = null,
        vc2_constant = require('./CTC_VC2_Constants.js');

    var LogTitle = 'VC2_UTILS',
        LogPrefix;

    var vc2_util = {};

    //CHECKERS
    util.extend(vc2_util, {
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
        isUndefined: function (value) {
            // Obtain `undefined` value that's guaranteed to not have been re-assigned
            var undefined = void 0;
            return value === undefined;
        }
    });

    // CACHE
    util.extend(vc2_util, {
        CACHE: {},
        getCache: function (cacheKey) {
            return vc2_util.CACHE.hasOwnProperty(cacheKey) ? vc2_util.CACHE[cacheKey] : null;
        },
        setCache: function (cacheKey, objVar) {
            vc2_util.CACHE[cacheKey] = objVar;
        }
    });

    // UTILS
    util.extend(vc2_util, {
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (vc2_util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        // Wait for a certain amount of time.
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
            var returnValue = 0;
            try {
                returnValue = stValue
                    ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0')
                    : 0;
            } catch (e) {}

            return returnValue;
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
            if (!vc2_util.isUndefined(node)) return node.textContent || node.shift().textContent;
            else return null;
        },
        getNodeContent: function (node) {
            var returnValue;
            if (node && node.length) returnValue = node.shift().textContent;

            return returnValue;
        },
        loadModule: function (mod) {
            var returnValue = require(mod);
            return returnValue;
        },
        loadModuleNS: function (mod) {
            var returnValue;
            require([mod], function (nsMod) {
                returnValue = nsMod;
            });
            return returnValue;
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::');

            var dateString = option.dateString || option,
                dateFormat = vc2_util.CACHE.DATE_FORMAT,
                date = '';

            if (!dateFormat) {
                try {
                    require(['N/config'], function (config) {
                        var generalPref = config.load({
                            type: config.Type.COMPANY_PREFERENCES
                        });
                        dateFormat = generalPref.getValue({
                            fieldId: 'DATEFORMAT'
                        });
                        return true;
                    });
                } catch (e) {}

                if (!dateFormat) {
                    try {
                        dateFormat = nlapiGetContext().getPreference('DATEFORMAT');
                    } catch (e) {}
                }
                vc2_util.CACHE.DATE_FORMAT = dateFormat;
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
                    vc2_util.logError(logTitle, e);
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

            // log.audit(
            //     logTitle,
            //     JSON.stringify({
            //         param: option,
            //         dateString: dateString,
            //         format: dateFormat,
            //         dateValue: date
            //     })
            // );

            return date;
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);

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
        }
    });

    // WEB SERVICES
    util.extend(vc2_util, {
        // Generate serial link.
        generateSerialLink: function (option) {
            ns_url = ns_url || vc2_util.loadModule('N/url') || vc2_util.loadModuleNS('N/url');

            var protocol = 'https://';
            var domain = ns_url.resolveDomain({
                hostType: ns_url.HostType.APPLICATION
            });
            var linkUrl = ns_url.resolveScript({
                scriptId: vc2_constant.SCRIPT.VIEW_SERIALS_SL,
                deploymentId: vc2_constant.DEPLOYMENT.VIEW_SERIALS_SL,
                params: option
            });

            return protocol + domain + linkUrl;
        },
        // Converts a JSON object to a query string.
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
        // Creates a function to send and parse a request.
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
            if (!queryOption || vc2_util.isEmpty(queryOption)) throw 'Missing query option';

            option.method = (option.method || 'get').toLowerCase();
            var response,
                responseBody,
                parsedResponse,
                param = {
                    noLogs: option.hasOwnProperty('noLogs') ? option.noLogs : false,
                    doRetry: option.hasOwnProperty('doRetry') ? option.doRetry : false,
                    retryCount: option.hasOwnProperty('retryCount') ? option.retryCount : 1,
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
                    method: vc2_util.inArray(option.method, _DEFAULT.validMethods)
                        ? option.method
                        : 'get'
                };
            if (option.isXML) param.isJSON = false;
            queryOption.method = param.method.toUpperCase();

            // log.audit(logTitle, '>> param: ' + JSON.stringify(param));
            var LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;
            var startTime = new Date();
            try {
                if (!param.noLogs) {
                    vc2_util.vcLog({
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
                response = ns_https.request(queryOption);

                // ns_https[param.method](queryOption);
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
                    parsedResponse = vc2_util.safeParse(response);
                    returnValue.PARSED_RESPONSE = parsedResponse;
                }

                if (!response.code || !vc2_util.inArray(response.code, VALID_RESP_CODE)) {
                    throw parsedResponse
                        ? JSON.stringify(parsedResponse)
                        : 'Received invalid response code - ' + response.code;
                }

                ////////////////////////////
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                returnValue.isError = true;
                returnValue.errorMsg = errorMsg;
                returnValue.error = error;
                returnValue.details = parsedResponse || response;

                // vc2_util.vcLog({
                //     title:
                //         param.logHeader +
                //         ': Error' +
                //         (param.doRetry
                //             ? ' (retry:' + param.retryCount + '/' + param.maxRetry + ')'
                //             : ''),
                //     error: { message: errorMsg, details: returnValue.details },
                //     transaction: param.logTranId
                // });

                vc2_util.logError(logTitle, errorMsg);

                if (param.doRetry)
                    vc2_util.log(
                        logTitle,
                        '## RETRY ##  -- ' + param.retryCount + '/' + param.maxRetry
                    );

                if (param.doRetry && param.maxRetry > param.retryCount) {
                    log.audit(logTitle, '... retrying in ' + param.waitMs);
                    option.retryCount = param.retryCount + 1;
                    vc2_util.waitMs(param.waitMs);
                    returnValue = vc2_util.sendRequest(option);
                }
            } finally {
                vc2_util.log(logTitle, '>> RESPONSE time: ', {
                    duration: this.roundOff((new Date() - startTime) / 1000)
                });

                if (!param.noLogs) {
                    vc2_util.vcLog({
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
        // Parses the response body into a JSON object.
        safeParse: function (response) {
            var logTitle = [LogTitle, 'safeParse'].join('::'),
                returnValue;
            try {
                returnValue = JSON.parse(response.body || response);
            } catch (error) {
                log.audit(logTitle, '## ' + vc2_util.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },

        handleResponse: function (request, responseType) {
            return responseType == 'JSON'
                ? this.handleJSONResponse(request)
                : this.handleXMLResponse(request);
        },

        // handleResponse
        handleJSONResponse: function (request) {
            var logTitle = [LogTitle, 'handleJSONResponse'].join(':'),
                returnValue = request;

            // detect the error
            var parsedResp = request.PARSED_RESPONSE;
            if (!parsedResp) throw 'Unable to parse response';

            // check for faultstring
            if (parsedResp.fault && parsedResp.fault.faultstring)
                throw parsedResp.fault.faultstring;

            // check response.errors
            if (
                parsedResp.errors &&
                util.isArray(parsedResp.errors) &&
                !vc2_util.isEmpty(parsedResp.errors)
            ) {
                var respErrors = parsedResp.errors
                    .map(function (err) {
                        return [err.id, err.message].join(': ');
                    })
                    .join(', ');
                throw respErrors;
            }

            // chek for error_description
            if (parsedResp.error && parsedResp.error_description)
                throw parsedResp.error_description;

            // ARROW: ResponseHeader

            if (request.isError || request.RESPONSE.code != '200') {
                throw 'Unexpected Error - ' + JSON.stringify(request.PARSED_RESPONSE);
            }

            return returnValue;
        },

        handleXMLResponse: function (request) {
            var logTitle = [LogTitle, 'handleXMLResponse'].join(':'),
                returnValue = request;

            if (request.isError && request.errorMsg) throw request.errorMsg;

            if (!request.RESPONSE || !request.RESPONSE.body)
                throw 'Invalid or missing XML response';

            ns_xml = ns_xml || vc2_util.loadModule('N/xml') || vc2_util.loadModuleNS('N/xml');

            var xmlResponse = request.RESPONSE.body,
                xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse });
            if (!xmlDoc) throw 'Unable to parse XML response';

            // Failure-Message ( D&H )
            var respStatus = vc2_util.getNodeContent(
                ns_xml.XPath.select({ node: xmlDoc, xpath: '//STATUS' })
            );

            if (respStatus && vc2_util.inArray(respStatus.toUpperCase(), ['FAILURE'])) {
                var respStatusMessage = vc2_util.getNodeContent(
                    ns_xml.XPath.select({ node: xmlDoc, xpath: '//MESSAGE' })
                );

                throw respStatusMessage || 'Unexpected failure';
            }

            // ERROR DETAIL - Synnex
            var respErrorDetail = vc2_util.getNodeContent(
                ns_xml.XPath.select({ node: xmlDoc, xpath: '//ErrorDetail' })
            );
            if (respErrorDetail) throw respErrorDetail;

            //OrderInfo/ErrorMsg - TechData
            var respErrorInfo =
                vc2_util.getNodeContent(
                    ns_xml.XPath.select({
                        node: xmlDoc,
                        xpath: '//OrderInfo/ErrorMsg'
                    })
                ) ||
                vc2_util.getNodeContent(ns_xml.XPath.select({ node: xmlDoc, xpath: '//ErrorMsg' }));
            if (respErrorInfo) throw respErrorInfo;

            return returnValue;
        }
    });

    // LOGS
    util.extend(vc2_util, {
        handleError: function (error, logTitle) {},
        getUsage: function () {
            var REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[usage:' + REMUSAGE + '] ';
        },
        // Creates a function that extracts the error message from the given option.
        extractError: function (option) {
            option = option || {};
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        // Creates a vc2 log function.
        vcLog: function (option) {
            var logTitle = [LogTitle, 'vcLog'].join('::');

            var VC_LOG = vc2_constant.RECORD.VC_LOG,
                LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

            try {
                var logOption = {},
                    batchTransaction = option.batch,
                    isBatched = batchTransaction != null;

                logOption.DATE = new Date();
                logOption.APPLICATION = option.appName || vc2_constant.LOG_APPLICATION;
                logOption.HEADER = option.title || logOption.APPLICATION;
                logOption.BODY = option.body || option.content || option.message || option.details;
                logOption.STATUS =
                    option.logStatus ||
                    option.status ||
                    (option.isSuccess ? LOG_STATUS.SUCCESS : LOG_STATUS.INFO);

                logOption.TRANSACTION =
                    option.recordId || option.transaction || option.id || option.internalid || '';

                if (option.error) {
                    var errorMsg = vc2_util.extractError(option.error);
                    logOption.BODY = errorMsg;

                    logOption.STATUS = option.error.logStatus || option.status || LOG_STATUS.ERROR;
                    if (option.error.details) option.details = option.error.details;
                }

                if (option.details) {
                    logOption.HEADER = option.title
                        ? [option.title, logOption.BODY].join(' - ')
                        : logOption.BODY;
                    logOption.BODY = option.details;
                }

                // vc2_util.log(
                //     logOption.HEADER,
                //     vc2_util.getKeysFromValues({ source: LOG_STATUS, value: logOption.STATUS }) +
                //         ' : ',
                //     logOption.BODY
                // );

                logOption.BODY = util.isString(logOption.BODY)
                    ? logOption.BODY
                    : JSON.stringify(logOption.BODY);

                if (logOption.HEADER && logOption.HEADER.length > 300) {
                    logOption.HEADER = logOption.HEADER.substr(0, 300);
                }

                if (isBatched) {
                    var VC_LOG_BATCH = vc2_constant.RECORD.VC_LOG_BATCH;
                    var batchOption = {
                        TRANSACTION: batchTransaction
                    };
                    // create the log as an inline item
                    var recBatch =
                        this._batchedVCLogs[batchTransaction] ||
                        ns_record.create({ type: VC_LOG_BATCH.ID });
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
                } else {
                    // create the log
                    var recLog = ns_record.create({ type: VC_LOG.ID });
                    for (var field in VC_LOG.FIELD) {
                        var fieldName = VC_LOG.FIELD[field];
                        recLog.setValue({
                            fieldId: fieldName,
                            value: logOption[field] || ''
                        });
                    }
                    recLog.save();
                }
            } catch (error) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + vc2_util.extractError(error));
            }
            return true;
        },

        vcLogError: function (option) {
            var logTitle = [LogTitle, ''].join(':'),
                returnValue = true;

            var logOption = option;

            // check for logStatus, error, title and details
            // if there are details, move all the error to the title
            if (option.details) {
                logOption.body = option.details;
                logOption.title = [
                    option.title,
                    option.errorMsg || option.error || vc2_util.extractError(option.error)
                ].join(' - ');
            }
            logOption.status = option.status || vc2_constant.LIST.VC_LOG_STATUS.ERROR; // common error

            return this.vcLog(logOption);
        },
        _batchedVCLogs: {},
        submitVCLogBatch: function (batchTransaction) {
            var logTitle = [LogTitle, 'submitVCLogBatch'].join('::');
            var recBatch = this._batchedVCLogs[batchTransaction];
            if (recBatch) {
                var VC_LOG = vc2_constant.RECORD.VC_LOG,
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
        LogPrefix: null,
        log: function (logTitle, msg, objvar) {
            var logMsg = msg,
                logType = 'audit',
                logPrefx = this.LogPrefix || '';

            try {
                if (!util.isString(msg)) {
                    logMsg = msg.msg || msg.text || msg.content || '';
                    logPrefx = msg.prefix || msg.prfx || msg.pre || logPrefx;
                    logType = msg.type || 'audit';
                }

                log[logType || 'audit'](
                    logTitle,
                    vc2_util.getUsage() +
                        (logPrefx ? logPrefx + ' ' : '') +
                        logMsg +
                        (!vc2_util.isEmpty(objvar) ? JSON.stringify(objvar) : '')
                );
            } catch (error) {}

            return true;
        },
        logError: function (logTitle, errorMsg) {
            vc2_util.log(logTitle, { type: 'error', msg: '### ERROR: ' }, errorMsg);
            return;
        },
        logDebug: function (logTitle, msg, msgVar) {
            var msgObj = util.isString(msg) ? { msg: msg } : msg;
            msgObj.type = 'debug';

            vc2_util.log(logTitle, msgObj, msgVar);
            return;
        }
    });

    // NS API
    util.extend(vc2_util, {
        // Performs a search and returns the results.
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
        isOneWorld: function () {
            return ns_runtime.isFeatureInEffect({ feature: 'Subsidiaries' });
        }
    });

    // object
    util.extend(vc2_util, {
        extend: function (source, contrib) {
            // do this to preserve the source values
            return util.extend(util.extend({}, source), contrib);
        },
        removeNullValues: function (option) {
            var newObj = {};
            if (!option || vc2_util.isEmpty(option) || !util.isObject(option)) return newObj;

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
        clone: function (obj) {
            return JSON.parse(JSON.stringify(obj));
        },
        // This function takes an option object as argument
        findMatching: function (option) {
            var logTitle = [LogTitle, 'findMatching'].join('::'),
                returnValue;

            // Sets dataSource with either option.dataSource or option.dataSet or option.list
            var dataSource = option.dataSource || option.dataSet || option.list,
                // Set filter to the value of option.filter
                filter = option.filter,
                //  If dataSource is empty or not an array, return false
                findAll = option.findAll;

            if (vc2_util.isEmpty(dataSource) || !util.isArray(dataSource)) return false;

            // Initializes an empty array
            var arrResults = [];

            // Loops throught the dataSource array
            for (var i = 0, j = dataSource.length; i < j; i++) {
                var isFound = true;

                // Loops through the keys of the filter object
                for (var fld in filter) {
                    // If current value is a function, set isFound to the result of calling it with dataSource[i][fld] as an argument, otherwise compare it to filter[fld]
                    isFound = util.isFunction(filter[fld])
                        ? filter[fld].call(dataSource[i], dataSource[i][fld])
                        : dataSource[i][fld] == filter[fld];

                    // If isFound is false, breaks loop
                    if (!isFound) break;
                }

                // If every key-value pair from the filter object was found on the element being inspected, push that element to arrResults. If findAll is false, break the loop.
                if (isFound) {
                    arrResults.push(dataSource[i]);
                    if (!findAll) break;
                }
            }

            //If array of results is not empty, set valueOfReturn to its first element or array itself depending on findAll flag. Otherwise, set it to false
            returnValue =
                arrResults && arrResults.length
                    ? findAll
                        ? arrResults
                        : arrResults.shift()
                    : false;

            // Return value stored in returnValue variable
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
        arrayKeys: function (option) {
            var logTitle = [LogTitle, 'getKeyValues'].join('::'),
                returnValue = [];

            if (vc2_util.isEmpty(option)) return false;

            for (var fld in option) {
                if (!vc2_util.inArray(fld, returnValue)) returnValue.push(fld);
            }

            return returnValue;
        },
        getKeysFromValues: function (option) {
            var logTitle = [LogTitle, 'getKeyValues'].join('::'),
                returnValue;

            var sourceObj = option.source || option.sourceObj,
                values = option.value || option.values;

            if (
                vc2_util.isEmpty(sourceObj) ||
                vc2_util.isEmpty(values) ||
                !util.isObject(sourceObj) ||
                (!util.isArray(values) && !util.isString(values))
            )
                return false;

            if (!util.isArray(values)) values = [values];

            returnValue = [];
            for (var fld in sourceObj) {
                if (
                    vc2_util.inArray(sourceObj[fld], values) &&
                    !vc2_util.inArray(fld, returnValue)
                ) {
                    returnValue.push(fld);
                }
            }

            return returnValue;
        },
        getValuesFromKeys: function (option) {
            var logTitle = [LogTitle, 'getValuesFromKeys'].join('::'),
                returnValue;

            var sourceObj = option.source || option.sourceObj,
                params = option.params || option.keys;

            if (
                vc2_util.isEmpty(sourceObj) ||
                vc2_util.isEmpty(params) ||
                !util.isObject(sourceObj) ||
                (!util.isArray(params) && !util.isString(params))
            )
                return false;

            if (!util.isArray(params)) params = [params];

            returnValue = [];
            for (var fld in sourceObj) {
                if (
                    vc2_util.inArray(fld, params) &&
                    !vc2_util.inArray(sourceObj[fld], returnValue)
                ) {
                    returnValue.push(sourceObj[fld]);
                }
            }

            return returnValue;
        }
    });

    // files
    util.extend(vc2_util, {
        // Search for a script in the current folder.
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
        // Searches for a file in the library.
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

            returnValue =
                option.doReturnArray && option.doReturnArray === true ? fileInfo : fileInfo.shift();

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
    });

    return vc2_util;
});
