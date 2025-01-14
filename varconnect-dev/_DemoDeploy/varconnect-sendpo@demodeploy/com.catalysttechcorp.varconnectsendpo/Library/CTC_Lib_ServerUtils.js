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
 * @description Utility functions that are only supported on server side scripts.
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([
    'N/file',
    'N/render',
    'N/runtime',
    'N/cache',
    'N/task',
    'N/search',
    'N/record',
    './CTC_Lib_Utils',
    './CTC_VCSP_Constants'
], function (
    NS_File,
    NS_Render,
    NS_Runtime,
    NS_Cache,
    NS_Task,
    NS_Search,
    NS_Record,
    CTC_Util,
    VCSP_Global
) {
    let LogTitle = 'CTC_ServerSideUtil',
        LogPrefix;

    let CTC_ServerSideUtil = {
        // LOCAL CACHING
        CACHE: {},
        getCache: function (cacheKey) {
            return this.CACHE.hasOwnProperty(cacheKey) ? this.CACHE[cacheKey] : null;
        },
        setCache: function (cacheKey, objVar) {
            this.CACHE[cacheKey] = objVar;
        },
        // N/CACHE
        NSCACHE_NAME: 'VCSP_202406',
        NSCACHE_KEY: 'VCSP_202406',
        NSCACHE_TTL: 86400, // 1 whole day
        getNSCache: function (option) {
            let logTitle = [LogTitle, 'getNSCache'].join('::'),
                returnValue;
            try {
                let cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                let cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                let cacheObj = NS_Cache.getCache({
                    name: cacheName,
                    scope: NS_Cache.Scope.PUBLIC
                });

                returnValue = cacheObj.get({ key: cacheKey, ttl: cacheTTL });
                if (option.isJSON && returnValue) returnValue = this.safeParse(returnValue);

                this.log({
                    type: 'AUDIT',
                    title: logTitle,
                    message: '// CACHE fetch: ' + JSON.stringify([cacheName, cacheKey, cacheTTL])
                });
            } catch (error) {
                CTC_Util.logError(logTitle, error);
                returnValue = null;
            }

            return returnValue;
        },
        setNSCache: function (option) {
            let logTitle = [LogTitle, 'setNSCache'].join('::'),
                returnValue;

            try {
                let cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                let cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                let cacheValue = option.value || option.cacheValue;
                if (this.isEmpty(cacheValue)) throw 'Missing cache value!';
                if (!util.isString(cacheValue)) cacheValue = JSON.stringify(cacheValue);

                let cacheObj = NS_Cache.getCache({
                    name: cacheName,
                    scope: NS_Cache.Scope.PUBLIC
                });
                cacheObj.put({ key: cacheKey, value: cacheValue, ttl: cacheTTL });
            } catch (error) {
                CTC_Util.logError(logTitle, error);
            }
        },
        removeCache: function (option) {
            let logTitle = [LogTitle, 'removeCache'].join('::'),
                returnValue;

            try {
                let cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                let cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                let cacheObj = NS_Cache.getCache({
                    name: cacheName,
                    scope: NS_Cache.Scope.PUBLIC
                });
                cacheObj.remove({ key: cacheKey });

                this.log({
                    type: 'AUDIT',
                    title: logTitle,
                    message: '// CACHE remove: ' + JSON.stringify([cacheName, cacheKey, cacheTTL])
                });
            } catch (error) {
                CTC_Util.logError(logTitle, error);
            }
        },
        getFileContent: function (option) {
            let returnValue = null;
            let logTitle = [LogTitle, 'getFileContent'];

            try {
                let fileId = option.fileId;
                if (!fileId) {
                    let fileName = option.filename || option.name;
                    if (!fileName) return false;

                    let folderId =
                        option.folder || option.folderId || CTC_ServerSideUtil.getCurrentFolder();
                    let fileInfo = CTC_Util.searchFile({
                        name: fileName,
                        folder: folderId
                    });

                    if (!fileInfo) return false;
                    fileId = fileInfo.id;
                }

                // load the file
                let fileObj = NS_File.load({
                    id: fileId
                });

                returnValue = fileObj.getContents();
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            }

            return returnValue;
        },
        getCurrentFolder: function (option) {
            let returnValue = null,
                logTitle = [LogTitle, 'getCurrentFolder'].join('::');
            option = option || {};

            try {
                let cacheKey = ['FileLib.getCurrentFolder', JSON.stringify(option)].join('::');
                returnValue = CTC_ServerSideUtil.CACHE[cacheKey];

                if (
                    CTC_Util.isEmpty(CTC_ServerSideUtil.CACHE[cacheKey]) ||
                    option.noCache == true
                ) {
                    let scriptId = option.scriptId;
                    if (!scriptId) {
                        if (!option.currentScript) {
                            if (!option.runtime) option.runtime = NS_Runtime;
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

                    let fileObj = NS_File.load({
                        id: fileId
                    });

                    returnValue = fileObj.folder;
                    CTC_ServerSideUtil.CACHE[cacheKey] = fileObj.folder;
                }
            } catch (e) {
                log.error(logTitle, JSON.stringify(e));
            } finally {
                // log.debug(logTitle, '>> current folder: ' + returnValue);
            }

            return returnValue;
        },
        renderTemplate: function (option) {
            let templateBody = option.body,
                poObj = option.purchaseOrder || {},
                returnValue;
            // CTC_Util.log('DEBUG', 'renderTemplate.templateBody', templateBody);
            // CTC_Util.log('DEBUG', 'renderTemplate.record', poObj);
            let templateRenderer = NS_Render.create();
            templateRenderer.templateContent = templateBody;
            templateRenderer.addCustomDataSource({
                format: NS_Render.DataSource.OBJECT,
                alias: 'record',
                data: poObj
            });
            let user = NS_Runtime.getCurrentUser();
            templateRenderer.addCustomDataSource({
                format: NS_Render.DataSource.OBJECT,
                alias: 'currentUser',
                data: user
            });
            returnValue = templateRenderer.renderAsString();
            // CTC_Util.log('DEBUG', 'renderTemplate.renderedBody', returnValue);
            return returnValue;
        },
        cleanUpDeployment: function (option) {
            let logTitle = [LogTitle, 'cleanUpDeployment'].join('::');

            let searchDeploy = NS_Search.create({
                type: NS_Search.Type.SCRIPT_DEPLOYMENT,
                filters: [
                    ['script.scriptid', 'is', option.scriptId],
                    'AND',
                    ['status', 'is', 'NOTSCHEDULED'],
                    'AND',
                    ['isdeployed', 'is', 'T']
                ],
                columns: ['scriptid']
            });

            let maxAllowed = option.max || 100; // only allow 100
            let arrResults = CTC_Util.searchAllPaged({ searchObj: searchDeploy });

            CTC_Util.log(logTitle, '>> cleanup : ', {
                maxAllowed: maxAllowed,
                totalResults: arrResults.length
            });
            if (maxAllowed > arrResults.length) return;

            let currentScript = NS_Runtime.getCurrentScript();
            let countDelete = arrResults.length - maxAllowed;
            let idx = 0;

            while (countDelete-- && currentScript.getRemainingUsage() > 100) {
                try {
                    NS_Record.delete({
                        type: NS_Record.Type.SCRIPT_DEPLOYMENT,
                        id: arrResults[idx++].id
                    });
                } catch (del_err) {}
            }
            CTC_Util.log(logTitle, '// Total deleted: ', idx);

            return true;
        },
        forceDeploy: function (option) {
            let logTitle = [LogTitle, 'forceDeploy'].join('::');
            let returnValue = null;
            let FN = {
                randomStr: function (len) {
                    len = len || 5;
                    let str = new Date().getTime().toString();
                    return str.substring(str.length - len, str.length);
                },
                deploy: function (scriptId, deployId, scriptParams, taskType) {
                    let logTitle = [LogTitle, 'forceDeploy:deploy'].join('::');
                    let returnValue = false;

                    try {
                        let taskInfo = {
                            taskType: taskType,
                            scriptId: scriptId
                        };
                        if (deployId) taskInfo.deploymentId = deployId;
                        if (scriptParams) taskInfo.params = scriptParams;

                        let objTask = NS_Task.create(taskInfo);

                        let taskId = objTask.submit();
                        let taskStatus = NS_Task.checkStatus({
                            taskId: taskId
                        });

                        // check the status
                        CTC_Util.log(logTitle, '## DEPLOY status: ', {
                            id: taskId,
                            status: taskStatus
                        });
                        returnValue = taskId;
                    } catch (e) {
                        CTC_Util.log(logTitle, '## ERROR ## ', CTC_Util.extractError(e));
                    }

                    return returnValue;
                },
                copyDeploy: function (scriptId) {
                    let logTitle = [LogTitle, 'forceDeploy:copyDeploy'].join('::');
                    let returnValue = false;
                    try {
                        let searchDeploy = NS_Search.create({
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
                        let newDeploy = null;

                        searchDeploy.run().each(function (result) {
                            if (!result.id) return false;
                            newDeploy = NS_Record.copy({
                                type: NS_Record.Type.SCRIPT_DEPLOYMENT,
                                id: result.id
                            });

                            let newScriptId = result.getValue({ name: 'scriptid' });
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

                CTC_Util.log(logTitle, '// params', option);

                returnValue =
                    FN.deploy(
                        option.scriptId,
                        option.deployId,
                        option.scriptParams,
                        option.taskType
                    ) ||
                    FN.deploy(option.scriptId, null, option.scriptParams, option.taskType) ||
                    FN.copyAndDeploy(option.scriptId, option.scriptParams, option.taskType);

                CTC_Util.log(logTitle, '// deploy: ', returnValue);
            } catch (e) {
                CTC_Util.log(logTitle, '## ERROR ## ', CTC_Util.extractError(e));
                throw e;
            }
            ////////////////////////////////////////

            // initiate the cleanup
            this.cleanUpDeployment(option);

            return returnValue;
        }
    };
    return CTC_ServerSideUtil;
});
