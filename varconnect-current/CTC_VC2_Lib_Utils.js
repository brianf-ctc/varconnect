/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/runtime', 'N/format', 'N/record', 'N/search', './CTC_VC2_Constants.js'], function (
    NS_Runtime,
    NS_Format,
    NS_Record,
    NS_Search,
    VC2_Global
) {
    var LogTitle = 'VC2_UTILS',
        LogPrefix;

    var Util = {
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
                if (Util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        getNodeTextContent: function (node) {
            // log.debug('node', node);
            if (!Util.isUndefined(node)) return node.textContent;
            else return null;
        },
        generateSerialLink: function (params) {
            var NS_Url = Util.loadModule('N/url');

            var protocol = 'https://';
            var domain = NS_Url.resolveDomain({
                hostType: NS_Url.HostType.APPLICATION
            });
            var linkUrl = NS_Url.resolveScript({
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
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::');
            log.audit(logTitle, '>> option: ' + JSON.stringify(option));

            var dateString = option.dateString || option,
                dateFormat = Util.CACHE.DATE_FORMAT,
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
                Util.CACHE.DATE_FORMAT = dateFormat;
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
            log.audit(logTitle, option);

            var VC_LOG = VC2_Global.RECORD.VC_LOG,
                LOG_STATUS = VC2_Global.LIST.VC_LOG_STATUS;

            try {
                var logOption = {};
                logOption.APPLICATION = option.appName || VC2_Global.LOG_APPLICATION;
                logOption.HEADER = option.title || logOption.APPLICATION;
                logOption.BODY =
                    option.body ||
                    option.content ||
                    option.message ||
                    option.errorMessage ||
                    option.errorMsg ||
                    (option.error ? Util.extractError(option.error) : '');

                if (
                    option.status &&
                    Util.inArray(option.status, [
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
                // log.audit(logTitle, logOption);

                // create the log
                var recLog = NS_Record.create({ type: VC_LOG.ID });
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
                log.audit(logOption.HEADER, logOption.BODY);
            } catch (error) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + Util.extractError(error));
            }
            return true;
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

        // webRequest: function (option) {
        //     var logTitle = [LogTitle, 'webRequest'].join('::');
        //     log.audit(logTitle, option);

        //     var _DEFAULT = {
        //         validMethods: ['post', 'get'],
        //         maxRetries: 3,
        //         maxWaitMs: 3000
        //     };
        //     var ns_https = Util.loadModule('N/https');

        //     var queryOption = option.query || option.queryOption,
        //         response,
        //         requestObj = {
        //             hasErrors: false,
        //             errorMessage: '',

        //             send: function (option) {}
        //         };


        //     var request = Util.webRequest();
        //     request.send({});

        //     request.get

        //     return requestObj;
        // },

        sendRequest: function (option) {
            var logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue = {};

            log.audit(logTitle, option);

            var _DEFAULT = {
                validMethods: ['post', 'get'],
                maxRetries: 3,
                maxWaitMs: 3000
            };
            var ns_https = Util.loadModule('N/https');

            var queryOption = option.query || option.queryOption;
            if (!queryOption || Util.isEmpty(queryOption)) throw 'Missing query option';

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

                    waitMs: option.waitMs || _DEFAULT.maxWaitMs,
                    method: Util.inArray(option.method, _DEFAULT.validMethods)
                        ? option.method
                        : 'get'
                };

            log.audit(logTitle, '>> param: ' + JSON.stringify(param));
            var LOG_STATUS = VC2_Global.LIST.VC_LOG_STATUS;
            try {
                if (!param.noLogs) {
                    Util.vcLog({
                        title: [param.logHeader, 'Request'].join(' - '),
                        content: JSON.stringify(queryOption),
                        transaction: param.logTranId,
                        status: LOG_STATUS.INFO
                    });
                }

                log.audit(logTitle, '>> REQUEST: ' + JSON.stringify(queryOption));
                returnValue.REQUEST = queryOption;

                //// SEND THE REQUEST //////
                response = ns_https[param.method](queryOption);
                returnValue.RESPONSE = response;

                parsedResponse = Util.safeParse(response);
                returnValue.PARSED_RESPONSE = parsedResponse;

                responseBody = response.body;

                if (!response.code || response.code != 200) {
                    throw 'Received invalid response code - ' + response.code;
                }
                if (!response || !response.body) {
                    throw 'Empty or Missing Response !';
                }

                ////////////////////////////
            } catch (error) {
                var errorMsg = Util.extractError(error);
                returnValue.isError = true;
                returnValue.errorMsg = errorMsg;
                returnValue.error = error;

                Util.vcLog({
                    title:
                        [param.logHeader + ': Error', errorMsg].join(' - ') +
                        (param.doRetry
                            ? ' (retry:' + param.retryCount + '/' + param.maxRetry + ')'
                            : ''),
                    content: JSON.stringify(error),
                    transaction: param.logTranId,
                    isError: true
                });

                log.error(logTitle, '## ERROR ##' + errorMsg + '\n' + JSON.stringify(error));

                if (param.doRetry && param.maxRetry > param.retryCount) {
                    log.audit(logTitle, '... retrying in ' + param.waitMs);
                    option.retryCount = param.retryCount + 1;
                    Util.waitMs(param.waitMs);
                    returnValue = Util.sendRequest(option);
                }
            } finally {
                log.audit(
                    logTitle,
                    '>> RESPONSE ' +
                        JSON.stringify({
                            code: response.code || '-no response-',
                            body: response.body || '-empty response-'
                        })
                );

                if (!param.noLogs) {
                    Util.vcLog({
                        title: [param.logHeader, 'Response'].join(' - '),
                        content: JSON.stringify(parsedResponse || responseBody || response),
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
                log.error(logTitle, '## ERROR ##' + Util.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },

        isOneWorld: function () {
            return NS_Runtime.isFeatureInEffect({ feature: 'Subsidiaries' });
        }
    };

    return Util;
});
