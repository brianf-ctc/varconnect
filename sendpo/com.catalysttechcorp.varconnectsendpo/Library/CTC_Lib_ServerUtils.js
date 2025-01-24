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

define(['N/file', 'N/render', 'N/runtime', '../Library/CTC_Lib_Utils', './CTC_VCSP_Constants'], function (
    NS_File,
    NS_Render,
    NS_Runtime,
    CTC_Util,
    VCSP_Global
) {
    let LogTitle = 'CTC_ServerSideUtil',
        LogPrefix;

    let CTC_ServerSideUtil = {
        CACHE: {},
        getFileContent: function (options) {
            let returnValue = null;
            let logTitle = [LogTitle, 'getFileContent'];

            try {
                let fileId = options.fileId;
                if (!fileId) {
                    let fileName = options.filename || options.name;
                    if (!fileName) return false;

                    let folderId = options.folder || options.folderId || CTC_ServerSideUtil.getCurrentFolder();
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
        getCurrentFolder: function (options) {
            let returnValue = null,
                logTitle = [LogTitle, 'getCurrentFolder'].join('::');
            options = options || {};

            try {
                let cacheKey = ['FileLib.getCurrentFolder', JSON.stringify(options)].join('::');
                returnValue = CTC_ServerSideUtil.CACHE[cacheKey];

                if (CTC_Util.isEmpty(CTC_ServerSideUtil.CACHE[cacheKey]) || options.noCache == true) {
                    let scriptId = options.scriptId;
                    if (!scriptId) {
                        if (!options.currentScript) {
                            if (!options.runtime) options.runtime = NS_Runtime;
                            options.currentScript = options.runtime.getCurrentScript();
                        }
                        scriptId = options.currentScript.id;
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
        renderTemplate: function (options) {
            let templateBody = options.body,
                poObj = options.purchaseOrder || {},
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
