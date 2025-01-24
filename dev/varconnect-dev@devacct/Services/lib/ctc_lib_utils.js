/**
 * Copyright (c) 2024 Catalyst Tech Corp
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
    let ns_runtime = require('N/runtime'),
        ns_cache = require('N/cache');

    let VC_GLOBAL = require('./ctc_lib_constants');

    let VC_UTIL = {};

    // CHECKERS
    util.extend(VC_UTIL, {
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
        },
        paramCheck: function (option) {
            if (!option.params || util.isObject(option.params)) return false;
            if (!option.reqd) return true; // no required fields

            if (!util.isArray(option.reqd)) option.reqd = [option.reqd];
            var hasMissing = false;

            option.reqd.forEach(function (field) {
                if (util.isArray(field)) {
                } else {
                    if (!option.params[field]) {
                        hasMissing = true;
                        return false;
                    }
                }
            });
        }
    });

    // UTILITIES
    util.extend(VC_UTIL, {
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (VC_UTIL.inArray(arrVar[i], arrNew)) continue;
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
        }
    });

    // LOGGING
    util.extend(VC_UTIL, {
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

            // var VC_LOG = vc2_constant.RECORD.VC_LOG,
            //     LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

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
                    var errorMsg = VC_UTIL.extractError(option.error);
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

                // VC_UTIL.log(
                //     logOption.HEADER,
                //     VC_UTIL.getKeysFromValues({ source: LOG_STATUS, value: logOption.STATUS }) +
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
                log.error(logTitle, LogPrefix + '## ERROR ## ' + VC_UTIL.extractError(error));
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
                    option.errorMsg || option.error || VC_UTIL.extractError(option.error)
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
                    VC_UTIL.getUsage() +
                        (logPrefx ? logPrefx + ' ' : '') +
                        logMsg +
                        (!VC_UTIL.isEmpty(objvar) ? JSON.stringify(objvar) : '')
                );
            } catch (error) {}

            return true;
        },
        logError: function (logTitle, errorMsg) {
            VC_UTIL.log(logTitle, { type: 'error', msg: '### ERROR: ' }, errorMsg);
            return;
        },
        logDebug: function (logTitle, msg, msgVar) {
            var msgObj = util.isString(msg) ? { msg: msg } : msg;
            msgObj.type = 'debug';

            VC_UTIL.log(logTitle, msgObj, msgVar);
            return;
        }
    });

    // LOCAL LOCAL_CACHE
    util.extend(VC_UTIL, {
        LOCAL_CACHE: {},
        getCache: function (cacheKey) {
            return VC_UTIL.LOCAL_CACHE.hasOwnProperty(cacheKey)
                ? VC_UTIL.LOCAL_CACHE[cacheKey]
                : null;
        },
        setCache: function (cacheKey, objVar) {
            VC_UTIL.LOCAL_CACHE[cacheKey] = objVar;
        }
    });

    ///
    util.extend(VC_UTIL, {
        getNSCache: function (option) {
            var returnValue;
            try {
                var cacheName = VC_GLOBAL.CACHE.NAME,
                    cacheTTL = option.cacheTTL || VC_GLOBAL.CACHE.TTL;

                var cacheKey = option.cacheKey || option.key || option.name || VC_GLOBAL.CACHE.NAME;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheObj = ns_cache.getCache({
                    name: cacheName,
                    scope: ns_cache.Scope.PROTECTED
                });

                returnValue = cacheObj.get({ key: cacheKey, ttl: cacheTTL });
                if (option.isJSON && returnValue) returnValue = VC_UTIL.safeParse(returnValue);

                VC_UTIL.log('## NS CACHE ##', '// CACHE fetch: ', [cacheName, cacheKey, cacheTTL]);
            } catch (error) {
                VC_UTIL.logError('getNSCache', error);
                returnValue = null;
            }

            return returnValue;
        },
        setNSCache: function (option) {
            try {
                var cacheName = VC_GLOBAL.CACHE.NAME,
                    cacheTTL = option.cacheTTL || VC_GLOBAL.CACHE.TTL;

                var cacheKey = option.cacheKey || option.key || option.name || VC_GLOBAL.CACHE.NAME;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheValue = option.value || option.cacheValue;
                if (VC_UTIL.isEmpty(cacheValue)) throw 'Missing cache value!';
                if (!util.isString(cacheValue)) cacheValue = JSON.stringify(cacheValue);

                var cacheObj = ns_cache.getCache({
                    name: cacheName,
                    scope: ns_cache.Scope.PROTECTED
                });
                cacheObj.put({ key: cacheKey, value: cacheValue, ttl: cacheTTL });

                // VC_UTIL.log('## NS CACHE ##', '// CACHE stored: ', [
                //     cacheName,
                //     cacheKey,
                //     cacheTTL
                // ]);
            } catch (error) {
                VC_UTIL.logError('setNSCache', error);
            }
        },
        removeCache: function (option) {
            try {
                var cacheName = VC_GLOBAL.CACHE.NAME,
                    cacheTTL = option.cacheTTL || VC_GLOBAL.CACHE.TTL;

                var cacheKey = option.cacheKey || option.key || option.name || VC_GLOBAL.CACHE.NAME;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheObj = ns_cache.getCache({
                    name: cacheName,
                    scope: ns_cache.Scope.PROTECTED
                });
                cacheObj.remove({ key: cacheKey });

                VC_UTIL.log('## NS CACHE ##', '// CACHE removed : ', [
                    cacheName,
                    cacheKey,
                    cacheTTL
                ]);
            } catch (error) {
                VC_UTIL.logError('removeNSCache', error);
            }
        }
    });

    return VC_UTIL;
});
