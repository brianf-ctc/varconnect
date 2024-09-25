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

define(['N/file', 'N/render', '../Library/CTC_Lib_Utils', './CTC_VCSP_Constants'], function (
    NS_File,
    NS_Render,
    CTC_Util,
    VCSP_Global
) {
    let LogTitle = 'CTC_ServerSideUtil',
        LogPrefix;

    let CTC_ServerSideUtil = {
        CACHE: {},
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
        renderTemplate: function (options) {
            // TODO
        }
    };

    return CTC_ServerSideUtil;
});
