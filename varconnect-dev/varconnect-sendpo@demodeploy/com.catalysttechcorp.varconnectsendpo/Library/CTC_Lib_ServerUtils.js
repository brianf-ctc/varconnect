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
    './CTC_Lib_Utils',
    './CTC_VCSP_Constants'
], function (NS_File, NS_Render, NS_Runtime, NS_Cache, CTC_Util, VCSP_Global) {
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
            var logTitle = [LogTitle, 'getNSCache'].join('::'),
                returnValue;
            try {
                var cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                var cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheObj = NS_Cache.getCache({
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
            var logTitle = [LogTitle, 'setNSCache'].join('::'),
                returnValue;

            try {
                var cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                var cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheValue = option.value || option.cacheValue;
                if (this.isEmpty(cacheValue)) throw 'Missing cache value!';
                if (!util.isString(cacheValue)) cacheValue = JSON.stringify(cacheValue);

                var cacheObj = NS_Cache.getCache({
                    name: cacheName,
                    scope: NS_Cache.Scope.PUBLIC
                });
                cacheObj.put({ key: cacheKey, value: cacheValue, ttl: cacheTTL });
            } catch (error) {
                CTC_Util.logError(logTitle, error);
            }
        },
        removeCache: function (option) {
            var logTitle = [LogTitle, 'removeCache'].join('::'),
                returnValue;

            try {
                var cacheName = this.NSCACHE_NAME,
                    cacheTTL = option.cacheTTL || this.NSCACHE_TTL;

                var cacheKey = option.cacheKey || option.key || option.name || this.NSCACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheObj = NS_Cache.getCache({
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
        }
    };
    return CTC_ServerSideUtil;
});
