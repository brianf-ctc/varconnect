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
 * @NScriptType MapReduceScript
 */

define([
    'N/search',
    'N/runtime',
    'N/error',
    'N/sftp',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Constants',
    './Libraries/moment',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './Libraries/CTC_VC_Lib_Vendor_Map',
    './../Services/ctc_svclib_configlib'
], function (
    ns_search,
    ns_runtime,
    ns_error,
    ns_sftp,
    vc2_util,
    vc2_constant,
    moment,
    lib_billfile,
    lib_vendormap,
    vcs_configLib
) {
    var LogTitle = 'MR_BillFiles-SFTP',
        VCLOG_APPNAME = 'VAR Connect|Retrieve Bill (SFTP)';

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join(':');
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var license = vcs_configLib.validateLicense();
        if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

        var CONNECT_TYPE = {
                API: 1,
                SFTP: 2
            },
            validVendorCfg = [],
            validVendorCfgName = [];

        var paramConfigID = ns_runtime.getCurrentScript().getParameter({ name: 'custscript_ctc_vc_bc_vendor_sftp' });

        var vendorConfigSearch = ns_search.create({
            type: 'customrecord_vc_bill_vendor_config',
            filters: [
                ['custrecord_vc_bc_connect_type', 'anyof', CONNECT_TYPE.SFTP],
                'AND',
                paramConfigID ? ['internalid', 'anyof', paramConfigID] : ['isinactive', 'is', 'F']
                // ['isinactive', 'is', 'F']
            ],
            columns: ['internalid', 'name', 'custrecord_vc_bc_connect_type']
        });

        vendorConfigSearch.run().each(function (result) {
            validVendorCfg.push(result.id);
            validVendorCfgName.push({
                name: result.getValue({ name: 'name' }),
                type: result.getText({ name: 'custrecord_vc_bc_connect_type' }),
                id: result.id
            });

            return true;
        });
        vc2_util.log(logTitle, '>> Valid SFTP Configs : ', [validVendorCfgName, validVendorCfg]);

        return validVendorCfg;
    }

    function map(context) {
        var logTitle = [LogTitle, 'map'].join(':');
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var currentScript = ns_runtime.getCurrentScript();

        var param = {
            billfile: currentScript.getParameter({ name: 'custscript_ctc_vc_bc_vendor_filename' }),
            skipfilecheck: currentScript.getParameter({
                name: 'custscript_ctc_vc_bc_skip_filenamecheck'
            }),
            skip90days: currentScript.getParameter({
                name: 'custscript_ctc_vc_bc_skip_90days_check'
            })
        };

        //get the vendor config details
        vc2_util.log(logTitle, '>> Current : ', [context.value, param]);

        var OrderCFG = ns_search.lookupFields({
            type: 'customrecord_vc_bill_vendor_config',
            id: context.value,
            columns: [
                'custrecord_vc_bc_ack',
                'custrecord_vc_bc_entry',
                'custrecord_vc_bc_user',
                'custrecord_vc_bc_pass',
                'custrecord_vc_bc_partner',
                'custrecord_vc_bc_connect_type',
                'custrecord_vc_bc_host_key',
                'custrecord_vc_bc_url',
                'custrecord_vc_bc_res_path',
                'custrecord_vc_bc_ack_path'
            ]
        });

        var configObj = {
            id: context.value,
            ack_function: OrderCFG.custrecord_vc_bc_ack,
            entry_function: OrderCFG.custrecord_vc_bc_entry,
            user_id: OrderCFG.custrecord_vc_bc_user,
            user_pass: OrderCFG.custrecord_vc_bc_pass,
            partner_id: OrderCFG.custrecord_vc_bc_partner,
            host_key: OrderCFG.custrecord_vc_bc_host_key,
            url: OrderCFG.custrecord_vc_bc_url,
            res_path: OrderCFG.custrecord_vc_bc_res_path,
            ack_path: OrderCFG.custrecord_vc_bc_ack_path
        };
        vc2_util.log(logTitle, '>> configObj: ', configObj);

        try {
            var connection;

            try {
                connection = ns_sftp.createConnection({
                    username: configObj.user_id,
                    passwordGuid: configObj.user_pass,
                    url: configObj.url,
                    directory: configObj.res_path,
                    hostKey: configObj.host_key
                });
            } catch (connect_error) {
                log.error(logTitle + '!CONNECT ERROR!', connect_error);

                vc2_util.vcLog({
                    title: 'SFTP Connect',
                    error: connect_error,
                    status: LOG_STATUS.SFTP_ERROR,
                    details: configObj
                });
            }

            if (!connection) throw 'SFTP Connection error!!';

            vc2_util.vcLog({
                title: 'SFTP Connect',
                message: 'Connection Success!',
                status: LOG_STATUS.SUCCESS,
                details: configObj
            });

            var list = connection.list({ sort: ns_sftp.Sort.DATE_DESC });

            log.audit(logTitle, '>> connectionList: ' + JSON.stringify(list.length));

            // create an array of files created in the last 90 days
            // if we already know about the file we'll ignore it in
            // the next step

            var billFileSearch = ns_search.create({
                type: 'customrecord_ctc_vc_bills',
                filters: [
                    ['custrecord_ctc_vc_bill_integration', 'anyof', context.value],
                    'AND',
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['formulanumeric: FLOOR({now}-{created})', 'lessthanorequalto', '90']
                ],
                columns: [
                    ns_search.createColumn({
                        name: 'name',
                        summary: 'GROUP',
                        sort: ns_search.Sort.ASC
                    })
                ]
            });

            var pagedData = billFileSearch.runPaged({ pageSize: 1000 });
            var existingFiles = [];

            for (var i = 0; i < pagedData.pageRanges.length; i++) {
                var currentPage = pagedData.fetch(i);

                currentPage.data.forEach(function (result) {
                    existingFiles.push(result.getValue({ name: 'name', summary: 'GROUP' }));
                });
            }
            log.audit(logTitle, '>> ..existing Files: ' + JSON.stringify(existingFiles.length));

            var currentFile,
                addedFiles = [];

            for (i = 0; i <= list.length; i++) {
                // log the file
                // if (i > 0) log.audit(logTitle, '******* File: ' + JSON.stringify(currentFile));

                if (!list[i]) break;
                currentFile = { data: list[i] };

                if (list[i].directory) {
                    continue;
                }

                currentFile = {
                    data: list[i],
                    entry_function: configObj.entry_function,
                    ext: list[i].name.slice(-3),
                    ext_rgx:
                        list[i].name.split('.') && list[i].name.split('.').length > 1
                            ? list[i].name.split('.').pop()
                            : '-no-ext-',
                    is90days: moment(list[i].lastModified).isSameOrAfter(moment().subtract(90, 'days'), 'day'),
                    idx: i + 1,
                    list: list.length
                };
                currentFile.ext_rgx = currentFile.ext_rgx ? currentFile.ext_rgx.toLowerCase() : currentFile.ext_rgx;

                if (configObj.entry_function == 'synnex_sftp') {
                    if (list[i].name == '..' || currentFile.ext_rgx !== 'xml') {
                        currentFile.skippedReason = 'non xml file';
                        continue;
                    }
                } else if (configObj.entry_function == 'dh_sftp') {
                    if (list[i].name == '..' || currentFile.ext_rgx !== 'txt') {
                        currentFile.skippedReason = 'non txt file';
                        continue;
                    }
                }

                if (param.billfile) {
                    var matchStr = new RegExp(param.billfile, 'ig');

                    if (!currentFile.data.name.match(matchStr)) {
                        currentFile.skippedReason = 'Not matching the bill file';
                        continue;
                    }
                } else {
                    var isAlreadyProcessed = false;

                    if (!param.skipfilecheck) {
                        for (var e = 0; e < existingFiles.length; e++) {
                            if (list[i].name == existingFiles[e]) {
                                isAlreadyProcessed = true;
                                break;
                            }
                        }
                        if (isAlreadyProcessed) {
                            currentFile.skippedReason = 'already processed';
                            continue;
                        }
                    }

                    if (!param.skip90days && !currentFile.is90days) {
                        currentFile.skippedReason = 'older than 90days';
                        continue;
                    }
                }

                log.audit(logTitle, '..... - adding file: ' + JSON.stringify(list[i]));

                addedFiles.push(list[i].name);
                context.write({
                    key: list[i].name,
                    value: JSON.stringify(configObj)
                });
            }

            log.audit(logTitle, '-- added accounts: ' + JSON.stringify([addedFiles.length, addedFiles]));
        } catch (error) {
            vc2_util.vcLog({
                title: 'SFTP',
                error: error,
                status: LOG_STATUS.SFTP_ERROR,
                details: configObj
            });

            throw error;
        }
    }

    function reduce(context) {
        var logTitle = [LogTitle, 'reduce'].join(':');
        //log.debug(context.key, context.values[0]);
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var configObj = JSON.parse(context.values[0]);
        log.audit(logTitle, '>> ## configObj: ' + JSON.stringify(configObj));

        try {
            var entryFunction = configObj.entry_function;

            var myArr = [];

            switch (entryFunction) {
                case 'dh_sftp':
                    myArr = lib_vendormap.dh_sftp(context.key, configObj);
                    break;
                case 'wellsfargo_sftp':
                    myArr = lib_vendormap.wellsfargo_sftp(context.key, configObj);
                    break;
                case 'synnex_sftp':
                    myArr = lib_vendormap.synnex_sftp(context.key, configObj);
                    break;
            }

            //log.debug(context.key, myArr);
            log.audit(logTitle, '>> ## myArr: ' + JSON.stringify(myArr));

            lib_billfile.process(configObj, myArr, context.key);
        } catch (e) {
            vc2_util.vcLogError({
                title: 'SFTP Process',
                error: e,
                status: LOG_STATUS.SFTP_ERROR,
                details: configObj
            });

            log.error(context.key + ': ' + 'Error encountered in reduce', e);
        }
    }

    function summarize(summary) {
        handleErrorIfAny(summary);
        createSummaryRecord(summary);
    }

    function handleErrorIfAny(summary) {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
        if (inputSummary.error) {
            var e = ns_error.create({
                name: 'INPUT_STAGE_FAILED',
                message: inputSummary.error
            });
            log.error('Stage: getInputData failed', e);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    }

    function handleErrorInStage(stage, summary) {
        summary.errors.iterator().each(function (key, value) {
            log.error(key, value);
            return true;
        });
    }

    function createSummaryRecord(summary) {
        try {
            var summaryJson = {
                script: ns_runtime.getCurrentScript().id,
                seconds: summary.seconds,
                usage: summary.usage,
                yields: summary.yields
            };

            log.audit('summary', summaryJson);
        } catch (e) {
            log.error('Stage: summary failed', e);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
