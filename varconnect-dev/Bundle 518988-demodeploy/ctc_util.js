/**
 * Copyright (c) 2020 Catalyst Tech Corp
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
define(['N/format', 'N/record', 'N/search', 'N/task'], function (
    NS_Format,
    NS_Record,
    NS_Search,
    NS_Task
) {
    var LogTitle = 'CTC_Util';

    var CTC_Util = {
        CACHE: {},
        /**
         * Checks for empty values
         *   - null, empty string,
         *   - empty array
         *   - empty object
         * @param  {string|integer|array|object} stValue
         * @return {boolean}
         */
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

        /**
         * Checks if the value given is part of a collection
         * @param  {any} stValue
         * @param  {array} arrValue
         * @return {boolean}
         */
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },

        /**
         * [description]
         * @param  {[type]} stValue [description]
         * @return {[type]}         [description]
         */
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.replace(/[^0-9.-]+/g, '') || '0') : 0;
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

        /**
         * Parses a string date (usually from CXML value)
         * @param  {object} option
         * @return {[type]}        [description]
         */
        parseCxmlDate: function (option) {
            var dateStr = option.value || option.dateString,
                dateValue;

            var parts = {
                date: dateStr.match(/^\d{4}.\d{2}.\d{2}/gi)
                    ? dateStr.split(/^(\d{4}).(\d{2}).(\d{2}).*$/gi).filter(function (val) {
                          val = this.parseFloat(val);
                          return val && !isNaN(val) ? val : null;
                      })
                    : null,
                time: dateStr.match(/^.*\d{2}:\d{2}:\d{2}/gi)
                    ? dateStr.split(/^.*(\d{2}):(\d{2}):(\d{2}).*$/gi).filter(function (val) {
                          val = this.parseFloat(val);
                          return val && !isNaN(val) ? val : null;
                      })
                    : null,
                tmz: dateStr.match(/^.*[\s+-]\d{2}\D?\d{2}$/gi)
                    ? this.parseFloat(dateStr.replace(/^.*([\s-+]\d{2})\D?(\d{2})$/gi, '$1'))
                    : null
            };

            dateValue = new Date(
                this.parseFloat(parts.date[0]),
                this.parseFloat(parts.date[1]) - 1,
                this.parseFloat(parts.date[2])
            );

            if (!CTC_Util.isEmpty(parts.time)) {
                dateValue.setHours(this.parseFloat(parts.time[0]));
                dateValue.setMinutes(this.parseFloat(parts.time[1]));
                dateValue.setSeconds(this.parseFloat(parts.time[2]));
            }

            var thisTZ = this.parseFloat(
                new Date().toString().replace(/^.*GMT([\s+-]\d{2}).*$/gi, '$1')
            );
            if (!CTC_Util.isEmpty(parts.tmz) && thisTZ != parts.tmz) {
                // check the native timezone
                // var dt1 = new Date( dateValue.getTime() + ((parts.tmz-thisTZ) * 60 * 60 * 1000) );
                dateValue = new Date(dateValue.getTime() + (thisTZ - parts.tmz) * 60 * 60 * 1000);
            }

            return dateValue;
        },

        randomAlphaNum: function (option) {
            option = option || {};
            var resultStr = '';
            var DEFAULT_MASK = '20aA5#2!';
            var pool = {
                a: 'abcdefghijklmnopqrstuvwxyz',
                A: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                '#': '0123456789',
                '!': '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\'
            };

            var getRandom = function (len, poolStr) {
                var resultStr = '';
                if (!poolStr) poolStr = pool.a + pool.b + pool['#'];
                while (len--) resultStr += poolStr[Math.floor(Math.random() * poolStr.length)];
                return resultStr;
            };

            try {
                // extract the masks
                var arrMask = (option.mask || DEFAULT_MASK)
                    .replace(/(\d+)([aA#!]+)/g, '$2=$1&')
                    .split('&');
                for (i = 0; i < arrMask.length; i++) {
                    var maskM = arrMask[i].split('=');
                    var poolStr = '';
                    maskM[0].split('').forEach(function (m) {
                        if (pool[m]) poolStr += pool[m];
                    });
                    var len = parseInt(maskM[1] || '0', 10);
                    if (!poolStr || !len) continue;

                    resultStr += getRandom(len, poolStr);
                }
            } catch (e) {
                resultStr = getRandom(12);
            }
            if (!resultStr) resultStr = getRandom(12);

            return (option.prefix || '') + resultStr + (option.suffix || '');
        },

        formatCxmlDate: function (option) {
            var dateValue = new Date(option.value || option.dateValue),
                showTime = option.datetime || true,
                showTimezone = option.timezone || true,
                dateStr;

            if (!dateValue) return false;

            dateStr = [
                dateValue.getFullYear(),
                (dateValue.getMonth() < 9 ? '0' : '') + (dateValue.getMonth() + 1),
                (dateValue.getDate() <= 9 ? '0' : '') + dateValue.getDate()
            ].join('-');

            if (showTime) {
                var timeStr = [
                    (dateValue.getHours() <= 9 ? '0' : '') + dateValue.getHours(),
                    (dateValue.getMinutes() <= 9 ? '0' : '') + dateValue.getMinutes(),
                    (dateValue.getSeconds() <= 9 ? '0' : '') + dateValue.getSeconds()
                ].join(':');
                dateStr += 'T' + timeStr;

                if (showTimezone) {
                    var tz = dateValue.toString().replace(/^.*GMT([\s+-]\d{2}).*$/gi, '$1');
                    dateStr += [tz, '00'].join(':');
                }
            }

            return dateStr;
        },
        parseDate: function (option) {
            var dateStr = option.value || option.dateString,
                dateValue;

            /// attempt to parse it first
            if (!dateValue) {
                try {
                    dateValue = NS_Format.parse({
                        value: dateStr,
                        type: option.format || NS_File.Type.DATETIMETZ
                    });
                } catch (err) {}
            }

            if (!dateValue || dateValue == 'Invalid Date') {
                try {
                    dateValue = new Date(
                        dateStr.replace(
                            /(\d{4}).(\d{2}).(\d{2})T(\d{2}):(\d{2}):(\d{2})(.\d{2}):(\d{2})/gi,
                            '$1-$2-$3T$4:$5:$6.000$7:$8'
                        )
                    );
                } catch (err) {}
            }

            if (!dateValue || dateValue == 'Invalid Date') {
                try {
                    dateValue = new Date(
                        dateStr.replace(
                            /(\d{4}).(\d{2}).(\d{2})T(\d{2}):(\d{2}):(\d{2})(.\d{2}):(\d{2})/gi,
                            '$1-$2-$3T$4:$5:$6.000'
                        )
                    );
                } catch (err) {}
            }

            if (!dateValue || dateValue == 'Invalid Date') {
                try {
                    dateValue = new Date(
                        dateStr.replace(
                            /(\d{4}).(\d{2}).(\d{2})T(\d{2}):(\d{2}):(\d{2})(.\d{2}):(\d{2})/gi,
                            '$1-$2-$3'
                        )
                    );
                } catch (err) {}
            }

            return dateValue;
        },
        parseFormatDate: function (option) {
            var optionFormat = {};

            optionFormat.value = this.parseDate(option);
            optionFormat.format = option.format || NS_Format.Type.DATE;

            return this.formatDate(optionFormat);
        },
        formatDate: function (option) {
            var optionFormat = {};

            optionFormat.value = option.value || option.date;
            if (option.format) optionFormat.format = option.format;

            return NS_Format.format(optionFormat);
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = NS_Search.lookupFields(option);
            // log.debug('flatLookup', 'arrResults>>' + JSON.stringify(arrResults));

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] =
                        util.isArray(arrResults[fld]) && arrResults[fld].length == 1
                            ? arrResults[fld][0]
                            : arrResults[fld];

                    if (util.isObject(arrData[fld])) {
                        if (arrData[fld].text) {
                            arrData[fld + '_text'] = arrData[fld].text;
                        }
                        if (arrData[fld].value) {
                            arrData[fld] = arrData[fld].value;
                        }
                    }
                    if (util.isArray(arrData[fld])) {
                        var tmpFldValue = [],
                            tmpFldText = [];
                        for (var i = 0, j = arrData[fld].length; i < j; i++) {
                            if (util.isObject(arrData[fld][i])) {
                                if (arrData[fld][i].text) {
                                    tmpFldText.push(arrData[fld][i].text);
                                }
                                if (arrData[fld][i].value) {
                                    tmpFldValue.push(arrData[fld][i].value);
                                }
                            } else {
                                tmpFldValue.push(arrData[fld][i]);
                            }
                        }

                        arrData[fld] = tmpFldValue;
                        if (tmpFldText.length) {
                            arrData[fld + '_text'] = tmpFldText;
                        }
                    }
                }
            }
            return arrData;
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
                var pageStart = option.pageStart || 0;

                // run the search
                var objPagedResults = objSearch.runPaged({
                    pageSize: pageSize
                });
                // set the max results to the search length, if not defined;
                maxResults = maxResults || objPagedResults.count;

                for (var i = 0, j = objPagedResults.pageRanges.length; i < j; i++) {
                    if (pageStart && i < pageStart - 1) continue;

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
        groupArray: function (arrData, chunkSize) {
            var returnValue = [];

            try {
                if (
                    !util.isArray(arrData) ||
                    !util.isNumber(chunkSize) ||
                    CTC_Util.isEmpty(arrData) ||
                    CTC_Util.isEmpty(chunkSize)
                )
                    return [];

                var arrGrouped = [],
                    start = 0,
                    end = chunkSize;
                // log.debug('groupArray', JSON.stringify([start, chunkSize, arrData]))

                while (arrData.length > start) {
                    arrGrouped.push(arrData.slice(start, end));
                    start = start + chunkSize;
                    end = end + chunkSize;
                }

                returnValue = arrGrouped;
            } catch (err) {
                log.debug(logTitle, '>> error: ' + JSON.stringify(e));
                throw e.message;
            }

            return returnValue;
        },
        flatten: function (objValue) {
            if (!objValue || !util.isArray(objValue)) return objValue;
            var objValue2 = {};

            for (var i = 0, j = objValue.length; i < j; i++) {
                var listKeys = [];
                for (var key in objValue[i]) {
                    if (objValue2[key]) {
                        objValue2[key] = [objValue2[key]];
                        objValue2[key].push(objValue[i][key]);
                    } else {
                        objValue2[key] = objValue[i][key];
                    }
                }
            }

            return objValue2;
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
        deltaTime: function (stDate) {
            var unit = 'ms',
                diff = new Date() - stDate;
            if (diff >= 1000) {
                diff = Math.round(diff / 1000);
                unit = 'sec';
            }
            if (diff >= 60 && unit == 'sec') {
                diff = Math.round((100 * diff) / 60) / 100;
                unit = 'min';
            }
            if (diff >= 60 && unit == 'min') {
                diff = Math.round((100 * diff) / 60) / 100;
                unit = 'hr';
            }
            return [diff, unit].join(' ');
        },
        randomStr: function (len) {
            len = len || 5;
            var str = new Date().getTime().toString();
            return str.substring(str.length - len, str.length);
        },
        forceDeploy: function (option) {
            var logTitle = [LogTitle, 'forceDeploy'].join('::');
            var returnValue = null;
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

                        var objTask = NS_Task.create(taskInfo);

                        var taskId = objTask.submit();
                        var taskStatus = NS_Task.checkStatus({
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
                        var searchDeploy = NS_Search.create({
                            type: NS_Search.Type.SCRIPT_DEPLOYMENT,
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
                            newDeploy = NS_Record.copy({
                                type: NS_Record.Type.SCRIPT_DEPLOYMENT,
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
                    option.taskType = NS_Task.TaskType.SCHEDULED_SCRIPT;
                    option.taskType = option.isMapReduce
                        ? NS_Task.TaskType.MAP_REDUCE
                        : option.isSchedScript
                        ? NS_Task.TaskType.SCHEDULED_SCRIPT
                        : option.taskType;
                }

                log.debug(logTitle, '>> params: ' + JSON.stringify(option));

                returnValue =
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
        loadModule: function (modulePath) {
            var returnValue = null;

            if (!modulePath) throw 'Missing module path';
            require([modulePath], function (_obj) {
                returnValue = _obj;
            });

            return returnValue;
        },

        /**
         * Returns the current working folder of the given scriptid
         * If scriptId is not defined, it gets the current script id
         *
         * @param  option.scriptId (optional)
         *
         * @return {[type]}        [description]
         */
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
        },
        duplicateSearch: function (option) {
            var returnValue = null,
                logTitle = [LogTitle, 'duplicateSearch'].join('::');
            option = option || {};

            try {
                var filterExpr = [['mainline', 'is', 'T']];

                var tranType = option.transactionType || option.tranType;
                if (tranType) {
                    filterExpr.push('AND');
                    filterExpr.push(['type', 'anyof', tranType]);
                }

                var tranId = option.tranid || option.tranId;
                if (tranId) {
                    filterExpr.push('AND');
                    filterExpr.push(['number', 'equalto', tranId]);
                }

                var internalId = option.id || option.internalId || option.internalid;
                if (internalId) {
                    filterExpr.push('AND');
                    filterExpr.push(['internalidnumber', 'notequalto', internalId]);
                }

                var transactionName = option.type || option.name;
                var dupSearchObj = NS_Search.create({
                    type: transactionName,
                    filters: filterExpr,
                    columns: ['tranid', 'internalid']
                });

                var resultsCount = dupSearchObj.runPaged().count;
                log.debug(logTitle, '>> Results Count: ' + resultsCount);

                returnValue = resultsCount > 0 ? true : false;
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            } finally {
                // log.debug(logTitle, '>> current folder: ' + returnValue);
            }

            return returnValue;
        },
        searchLastOrderId: function (option) {
            var logTitle = [LogTitle, 'searchLastTranid'].join(':');

            var filterExpr = [
                ['type', 'anyof', 'SalesOrd'],
                'AND', // search for invoice transactions
                ['mainline', 'is', 'T'] // .. ignore line fields
                // , 'AND',
                // ['subsidiary', 'anyof', option.subsidiary] // .. in the same subsidiary
            ];

            if (!this.isEmpty(option.subsidiary)) {
                filterExpr.push('AND');
                filterExpr.push(['subsidiary', 'anyof', option.subsidiary]);
            }

            if (!this.isEmpty(option.tranid)) {
                filterExpr.push('AND');
                filterExpr.push(['tranid', 'anyof', option.subsidiary]);
            }

            if (!this.isEmpty(option.recordId)) {
                filterExpr.push('AND');
                filterExpr.push(['internalid', 'noneof', option.recordId]);
            }

            // search the last tranid
            var orderSearch = NS_Search.create({
                type: 'salesorder',
                filters: [filterExpr],
                columns: [
                    'tranid',
                    NS_Search.createColumn({ name: 'internalid', sort: NS_Search.Sort.DESC })
                ]
            });

            var lastTranId;
            orderSearch.run().each(function (result) {
                lastTranId = result.getValue({ name: 'tranid' });
                return false;
            });

            return this.parseFloat(lastTranId);
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
        extractError: function (option) {
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        }
    };

    return CTC_Util;
});
