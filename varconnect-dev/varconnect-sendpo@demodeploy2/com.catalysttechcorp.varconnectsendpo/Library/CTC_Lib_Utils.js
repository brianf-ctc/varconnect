/**
 * Copyright (c) 2023 Catalyst Tech Corp
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

define([
    'N/runtime',
    'N/format',
    'N/record',
    'N/search',
    'N/xml',
    './CTC_VCSP_Constants'
], function (NS_Runtime, NS_Format, NS_Record, NS_Search, NS_Xml, VCSP_Global) {
    let LogTitle = 'CTC_Util',
        LogPrefix;

    let CTC_Util = {
        CACHE: {},
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isString(stValue) && stValue.trim() === '') ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (let k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (let i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        uniqueArray: function (arrVar) {
            let arrNew = [];
            for (let i = 0, j = arrVar.length; i < j; i++) {
                if (CTC_Util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        searchAllPaged: function (option) {
            let objSearch,
                arrResults = [],
                logTitle = 'CTC_Utils:searchAllPaged';
            option = option || {};

            try {
                let searchId = option.id || option.searchId;
                let searchType = option.recordType || option.type;

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

                let maxResults = option.maxResults || 0;
                let pageSize = maxResults && maxResults <= 1000 ? maxResults : 1000;

                // run the search
                let objPagedResults = objSearch.runPaged({
                    pageSize: pageSize
                });
                // set the max results to the search length, if not defined;
                maxResults = maxResults || objPagedResults.count;

                for (let i = 0, j = objPagedResults.pageRanges.length; i < j; i++) {
                    let pagedResults = objPagedResults.fetch({
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
            let undefined = void 0;
            return value === undefined;
        },
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
        },
        parseDate: function (option) {
            let logTitle = [LogTitle, 'parseDate'].join('::');
            log.audit(logTitle, '>> option: ' + JSON.stringify(option));

            let dateString = option.dateString || option,
                dateFormat = CTC_Util.CACHE.DATE_FORMAT,
                date = '';

            if (!dateFormat) {
                try {
                    require(['N/config'], function (config) {
                        let generalPref = config.load({
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
                    let stringToProcess = dateString
                        .replace(/-/g, '/')
                        .replace(/\n/g, ' ')
                        .split(' ');

                    for (let i = 0; i < stringToProcess.length; i++) {
                        let singleString = stringToProcess[i];
                        if (singleString) {
                            let stringArr = singleString.split('T'); //handle timestamps with T
                            singleString = stringArr[0];
                            let convertedDate = new Date(singleString);

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
                let year = date.getFullYear();
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
            let intValue = parseInt(stValue, 10);

            if (isNaN(intValue) || stValue == Infinity) {
                return 0;
            }

            return intValue;
        },
        forceFloat: function (stValue) {
            let flValue = this.parseFloat(stValue);

            if (isNaN(flValue) || stValue == Infinity) {
                return 0.0;
            }

            return flValue;
        },
        flatLookup: function (option) {
            let arrData = null,
                arrResults = null;

            arrResults = NS_Search.lookupFields(option);
            // log.debug('flatLookup', 'arrResults>>' + JSON.stringify(arrResults));

            if (arrResults) {
                arrData = {};
                for (let fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
        waitMs: function (waitms) {
            let logTitle = [LogTitle, 'waitMs'].join('::');
            waitms = waitms || 5000;

            log.audit(logTitle, 'waiting for ' + waitms);

            let nowDate = new Date(),
                isDone = false;
            while (!isDone) {
                let deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitms;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }

            return true;
        },
        waitRandom: function (max) {
            let logTitle = [LogTitle, 'waitRandom'].join('::');

            let waitTimeMS = Math.floor(Math.random() * Math.floor(max));
            max = max || 5000;

            log.audit(logTitle, 'waiting for ' + waitTimeMS);
            let nowDate = new Date(),
                isDone = false;

            while (!isDone) {
                let deltaMs = new Date() - nowDate;
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
            let str = new Date().getTime().toString();
            return str.substring(str.length - len, str.length);
        },
        roundOff: function (value) {
            let flValue = this.forceFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        },
        vcLog: function (option) {
            let logTitle = [LogTitle, 'vcLog'].join('::');
            // log.audit(logTitle, option);

            let VC_LOG_ID = VCSP_Global.Records.VC_LOG,
                VC_LOG_FIELDS = VCSP_Global.Fields.VarConnectLog,
                LOG_STATUS = VCSP_Global.Lists.VC_LOG_STATUS;

            try {
                let logOption = {};
                logOption.APPLICATION = option.appName || VCSP_Global.LOG_APPLICATION;
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
                let recLog = NS_Record.create({ type: VC_LOG_ID });
                for (let field in VC_LOG_FIELDS) {
                    let fieldName = VC_LOG_FIELDS[field];
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
            let errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        convertToQuery: function (json) {
            if (typeof json !== 'object') return;

            let qry = [];
            for (let key in json) {
                let qryVal = encodeURIComponent(json[key]);
                let qryKey = encodeURIComponent(key);
                qry.push([qryKey, qryVal].join('='));
            }

            return qry.join('&');
        },
        loadModule: function (mod) {
            let returnValue;
            require([mod], function (modObj) {
                returnValue = modObj;
                return true;
            });
            return returnValue;
        },
        sendRequest: function (option) {
            let logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue = {};

            let VALID_RESP_CODE = [200, 207, 201]; // Added 201 for INGRAM

            let _DEFAULT = {
                validMethods: ['post', 'get'],
                maxRetries: 3,
                maxWaitMs: 3000
            };
            let ns_https = CTC_Util.loadModule('N/https');

            let queryOption = option.query || option.queryOption;
            if (!queryOption || CTC_Util.isEmpty(queryOption)) throw 'Missing query option';

            option.method = (option.method || 'get').toLowerCase();
            let response,
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
            let LOG_STATUS = VCSP_Global.Lists.VC_LOG_STATUS;

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
                let errorMsg = CTC_Util.extractError(error);
                returnValue.isError = true;
                returnValue.errorMsg = errorMsg;
                returnValue.errorName = error.name;
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
            let logTitle = [LogTitle, 'safeParse'].join('::'),
                strToParse = (response ? response.body : response) || response,
                returnValue;

            // log.audit(logTitle, strToParse);
            try {
                if (strToParse) {
                    returnValue = JSON.parse(strToParse);
                }
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
            let returnValue = null;
            let logTitle = [LogTitle, 'getFileContent'];

            try {
                let fileId = option.fileId;
                if (!fileId) {
                    let fileName = option.filename || option.name;
                    if (!fileName) return false;

                    let folderId = option.folder || option.folderId || this.getCurrentFolder();
                    let fileInfo = this.searchFile({
                        name: fileName,
                        folder: folderId
                    });

                    if (!fileInfo) return false;
                    fileId = fileInfo.id;
                }

                // load the file
                let NS_File = this.loadModule('N/file');
                let fileObj = NS_File.load({
                    id: fileId
                });

                returnValue = fileObj.getContents();
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            }

            return returnValue;
        },
        searchFolder: function (option) {
            let folderName = option.folderName || option.name;
            if (!folderName) return false;

            let arrCols = ['name', 'parent', 'foldersize', 'parent', 'internalid'];
            let searchOption = {
                type: 'folder',
                columns: arrCols,
                filters: [['name', 'is', folderName]]
            };

            let parentId = option.parent || option.parentFolder;
            if (parentId) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['parent', 'anyof', parentId]);
            }

            let returnValue = null;

            let cacheKey = ['FileLib.searchFolder', JSON.stringify(searchOption)].join('::');
            let folderInfo = this.CACHE[cacheKey];

            if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                let objSearch = NS_Search.create(searchOption);
                folderInfo = []; // prepare for multiple results?
                objSearch.run().each(function (row) {
                    let fInfo = {};

                    for (let i = 0, j = row.columns.length; i < j; i++) {
                        let col = row.columns[i];
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
            let fileName = option.filename || option.name;
            if (!fileName) return false;

            let arrCols = [
                'name',
                'folder',
                'documentsize',
                'url',
                'created',
                'modified',
                'filetype'
            ];
            let searchOption = {
                type: 'file',
                columns: arrCols,
                filters: [['name', 'is', fileName]]
            };

            let folderId = option.folder || option.folderId;
            if (folderId) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['folder', 'is', folderId]);
            }

            let returnValue = null;

            let cacheKey = ['FileLib.searchFile', JSON.stringify(searchOption)].join('::');
            let fileInfo = this.CACHE[cacheKey];

            if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                let objSearch = NS_Search.create(searchOption);
                fileInfo = []; // prepare for multiple results?
                objSearch.run().each(function (row) {
                    let fInfo = {};

                    for (let i = 0, j = row.columns.length; i < j; i++) {
                        let col = row.columns[i];
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
            let returnValue = null,
                logTitle = [LogTitle, 'getCurrentFolder'].join('::');
            option = option || {};

            try {
                let cacheKey = ['FileLib.getCurrentFolder', JSON.stringify(option)].join('::');
                returnValue = this.CACHE[cacheKey];

                if (this.isEmpty(this.CACHE[cacheKey]) || option.noCache == true) {
                    let scriptId = option.scriptId;
                    if (!scriptId) {
                        if (!option.currentScript) {
                            if (!option.runtime) option.runtime = this.loadModule('N/runtime');
                            option.currentScript = option.runtime.getCurrentScript();
                        }
                        scriptId = option.currentScript.id;
                    }
                    if (!scriptId) return false;

                    let objSearch = NS_Search.create({
                        type: 'script',
                        filters: [['scriptid', 'is', scriptId]],
                        columns: ['scriptfile', 'name']
                    });

                    let fileId = null;
                    objSearch.run().each(function (row) {
                        fileId = row.getValue('scriptfile');
                        return true;
                    });

                    let NS_File = this.loadModule('N/file');
                    let fileObj = NS_File.load({
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
        log: function (option, title, message) {
            let logType = option.type || option,
                logTitle = option.title || title,
                tempMessage = new String(option.message || message || '');
            do {
                let messagePortion = tempMessage.slice(0, 3999);
                tempMessage = tempMessage.slice(3999);
                switch (logType) {
                    case 'DEBUG':
                        log.debug(logTitle, messagePortion);
                        break;
                    case 'AUDIT':
                        log.audit(logTitle, messagePortion);
                        break;
                    case 'ERROR':
                        log.error(logTitle, messagePortion);
                        break;
                    default:
                        break;
                }
            } while (tempMessage.length > 0);
        },
        leftPadString: function (str, padding, len) {
            let tempStr = str + '';
            let pad = padding + '';
            for (let i = tempStr.length; i < len; i += pad.length) {
                tempStr = pad + tempStr;
            }
            return tempStr.slice(len * -1);
        },
        formatToSynnexDate: function (option) {
            let dateToFormat = option.date || option,
                formattedDate = dateToFormat;
            if (dateToFormat && dateToFormat instanceof Date) {
                // CCYY-MM-DDTHH:MM:SS
                formattedDate = [
                    [
                        dateToFormat.getFullYear(),
                        this.leftPadString(dateToFormat.getMonth() + 1, '0', 2),
                        this.leftPadString(dateToFormat.getDate(), '0', 2)
                    ].join('-'),
                    [
                        this.leftPadString(dateToFormat.getHours(), '0', 2),
                        this.leftPadString(dateToFormat.getMinutes(), '0', 2),
                        this.leftPadString(dateToFormat.getSeconds(), '0', 2)
                    ].join(':')
                ].join('T');
            }
            return formattedDate;
        },
        parseFromSynnexDate: function (option) {
            let dateToParse = option.date || option,
                parsedDate = dateToParse;
            if (dateToParse) {
                // CCYY-MM-DDTHH:MM:SS
                let dateTimeComponents = dateToParse.split('T'),
                    dateComponents = dateTimeComponents[0].split('-'),
                    timeComponents = dateTimeComponents[1].split(':');
                parsedDate = new Date(
                    dateComponents[0],
                    dateComponents[1] - 1,
                    dateComponents[2],
                    timeComponents[0],
                    timeComponents[1],
                    timeComponents[2]
                );
            }
            return parsedDate;
        },
        parseISOString: function (option) {
            let date = option.date || option,
                dateComponents = date.split(/\D+/);
            return new Date(
                Date.UTC(
                    dateComponents[0],
                    --dateComponents[1],
                    dateComponents[2],
                    dateComponents[3],
                    dateComponents[4],
                    dateComponents[5],
                    dateComponents[6]
                )
            );
        },
        xmlNodeToJson: function (option) {
            let xmlNode = option.node || option,
                json = option.json;
            if (xmlNode) {
                let mainKey = xmlNode.nodeName;
                if (xmlNode.nodeType == NS_Xml.NodeType.TEXT_NODE) {
                    let value = xmlNode.textContent;
                    if (!this.isEmpty(value)) {
                        json[mainKey] = value;
                    }
                } else {
                    let jsonNode = {};
                    if (!json) json = {};
                    if (json[mainKey]) {
                        if (!util.isArray(json[mainKey])) {
                            json[mainKey] = [json[mainKey]];
                        }
                        json[mainKey].push(jsonNode);
                    } else {
                        json[mainKey] = jsonNode;
                    }
                    if (xmlNode.hasAttributes()) {
                        let nodeAttributes = xmlNode.attributes;
                        for (let attribKey in nodeAttributes) {
                            let attrib = nodeAttributes[attribKey],
                                attribName = ['#', attrib.name].join(''),
                                attribValue = attrib.value;
                            jsonNode[attribName] = attribValue;
                        }
                    }
                    if (
                        xmlNode.hasChildNodes() &&
                        (xmlNode.childNodes.length > 1 ||
                            xmlNode.childNodes[0].nodeType != NS_Xml.NodeType.TEXT_NODE)
                    ) {
                        let childNodes = xmlNode.childNodes;
                        for (let i = 0, x = childNodes.length; i < x; i += 1) {
                            let childNode = childNodes[i];
                            this.xmlNodeToJson({
                                node: childNode,
                                json: jsonNode
                            });
                        }
                    } else {
                        let value = xmlNode.textContent;
                        if (this.isEmpty(value)) {
                            delete json[mainKey];
                        } else {
                            if (xmlNode.hasAttributes()) {
                                jsonNode['#text'] = value;
                            } else {
                                delete json[mainKey];
                                json[mainKey] = value;
                            }
                        }
                    }
                }
            }
            return json;
        },
        xmlToJson: function (option) {
            let xmlDoc = option.xml || option,
                json = option.json;
            if (xmlDoc && xmlDoc.documentElement) {
                if (!json) json = {};
                let childNodes = xmlDoc.documentElement.childNodes;
                for (let i = 0, len = childNodes.length; i < len; i += 1) {
                    let node = childNodes[i];
                    this.xmlNodeToJson({
                        node: node,
                        json: json
                    });
                }
            }
            return json;
        }
    };

    return CTC_Util;
});
