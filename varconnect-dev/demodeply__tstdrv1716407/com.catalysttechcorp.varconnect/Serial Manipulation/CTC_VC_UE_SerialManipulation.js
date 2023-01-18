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
 * @NScriptType UserEventScript
 * @Description Runs the corresponding MR script depending on the required process for creating serial numbers
 */
/**
 * Project Number: 001225
 * Script Name: VAR Connect Serial Manipulation UE
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */

define([
    'N/task',
    'N/ui/serverWidget',
    'N/runtime',
    'N/record',
    'N/search',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator',
    '../CTC_VC2_Constants.js',
    '../CTC_VC2_Lib_Utils'
], function (
    ns_task,
    ns_ui,
    ns_runtime,
    ns_record,
    ns_search,
    vc_mainconfig,
    vc_licenselib,
    vc2_constant,
    vc_util
) {
    var LogTitle = 'UE|Serials',
        LogPrefix;

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle, 'beforeLoad'].join('::');
            if (ns_runtime.executionContext !== ns_runtime.ContextType.USER_INTERFACE) return;
            if (scriptContext.type === scriptContext.UserEventType.DELETE) return;

            var mainConfig = Helper.loadMainConfig(),
                validLicense = Helper.validateLicense({ mainConfig: mainConfig });

            LogPrefix = [
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id || '_NEW_'
            ].join(':');
            LogPrefix = '[' + LogPrefix + '] ';

            log.debug(
                logTitle,
                LogPrefix +
                    '*** SCRIPT START ****' +
                    JSON.stringify({
                        eventType: scriptContext.type,
                        contextType: ns_runtime.executionContext,
                        mainConfig: mainConfig
                    })
            );

            //If Serial Scan and Update feature is disabled, hide the corresponding columns
            var form = scriptContext.form,
                chkSerialSync;

            if (!mainConfig.serialScanUpdate || !validLicense) {
                var sublist = form.getSublist({ id: 'item' });

                if (sublist) {
                    var fldSerialUpdate = sublist.getField({
                        id: vc2_constant.FIELD.TRANSACTION.SERIAL_NUMBER_UPDATE
                    });

                    //force check if field exists
                    if (fldSerialUpdate)
                        fldSerialUpdate.updateDisplayType({
                            displayType: ns_ui.FieldDisplayType.HIDDEN
                        });

                    var fldSerialScan = sublist.getField({
                        id: vc2_constant.FIELD.TRANSACTION.SERIAL_NUMBER_SCAN
                    });

                    //force check if field exists
                    if (fldSerialScan)
                        fldSerialScan.updateDisplayType({
                            displayType: ns_ui.FieldDisplayType.HIDDEN
                        });
                }

                // serial sync checkbox
                chkSerialSync = form.getField({ id: 'custbody_ctc_vc_serialsync_done' });
                if (chkSerialSync)
                    chkSerialSync.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
            }

            // if (scriptContext.newRecord && scriptContext.newRecord.type == ns_record.Type.INVOICE) {
            var vendorConfig = Helper.searchVendorConfig({
                salesOrder: scriptContext.newRecord.getValue({ fieldId: 'createdfrom' })
            });

            if (!vendorConfig) {
                // serial sync checkbox
                chkSerialSync = form.getField({ id: 'custbody_ctc_vc_serialsync_done' });

                if (chkSerialSync)
                    chkSerialSync.updateDisplayType({
                        displayType: ns_ui.FieldDisplayType.HIDDEN
                    });
            }

            return true;
            // }
        },

        afterSubmit: function (scriptContext) {
            var logTitle = [LogTitle, 'afterSubmit'].join('::');
            LogPrefix = [
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id || '_NEW_'
            ].join(':');
            LogPrefix = '[' + LogPrefix + '] ';

            var mainConfig = Helper.loadMainConfig();
            if (!mainConfig) return;

            if (
                !vc_util.inArray(scriptContext.type, [
                    scriptContext.UserEventType.CREATE,
                    scriptContext.UserEventType.EDIT,
                    scriptContext.UserEventType.XEDIT
                ]) ||
                ns_runtime.executionContext == ns_runtime.ContextType.MAP_REDUCE
            )
                return;

            log.debug(
                logTitle,
                LogPrefix +
                    '****** START SCRIPT *****' +
                    JSON.stringify({
                        eventType: scriptContext.type,
                        contextType: ns_runtime.executionContext
                    })
            );

            var cols = vc2_constant.FIELD.TRANSACTION,
                hasSerials = false,
                hasNoSerials = false,
                record = scriptContext.newRecord,
                lineCount = record.getLineCount({ sublistId: 'item' });

            for (var line = 0; line < lineCount; line++) {
                var serialString = record.getSublistValue({
                    sublistId: 'item',
                    fieldId: cols.SERIAL_NUMBER_SCAN,
                    line: line
                });

                var serialStringUpdate = record.getSublistValue({
                    sublistId: 'item',
                    fieldId: cols.SERIAL_NUMBER_UPDATE,
                    line: line
                });

                if (
                    (serialString && serialString.trim()) ||
                    (serialStringUpdate && serialStringUpdate.trim())
                ) {
                    hasSerials = true;
                } else if (
                    (record.type == ns_record.Type.ITEM_FULFILLMENT ||
                        record.type == ns_record.Type.INVOICE) &&
                    scriptContext.type == scriptContext.UserEventType.CREATE &&
                    (!serialStringUpdate || serialStringUpdate.trim().length == 0)
                ) {
                    hasNoSerials = true;
                }

                if (hasSerials && hasNoSerials) break;
            }

            var tranId = record.getValue({ fieldId: 'tranid' }),
                taskOption = {};
            log.debug(
                logTitle,
                LogPrefix +
                    '>> settings: ' +
                    JSON.stringify({
                        tranId: tranId,
                        hasSerials: hasSerials,
                        hasNoSerials: hasNoSerials,
                        'mainConfig.serialScanUpdate': mainConfig.serialScanUpdate,
                        'mainConfig.copySerialsInv': mainConfig.copySerialsInv
                    })
            );

            //Also check if the corresponding features have been enabled before processing
            var vendorConfig;
            if (record.type == ns_record.Type.INVOICE && mainConfig.copySerialsInv) {
                vendorConfig = Helper.searchVendorConfig({
                    salesOrder: record.getValue({ fieldId: 'createdfrom' })
                });

                // if (vendorConfig) {
                vc_util.waitRandom(10000);

                taskOption = {
                    isMapReduce: true,
                    scriptId: vc2_constant.SCRIPT.SERIAL_UPDATE_ALL_MR,
                    scriptParams: {}
                };
                taskOption.scriptParams['custscript_vc_all_type'] = record.type;
                taskOption.scriptParams['custscript_vc_all_id'] = record.id;
                taskOption.deployId = Helper.forceDeploy(taskOption);
                // }
            }

            if (hasSerials && mainConfig.serialScanUpdate) {
                vc_util.waitRandom(10000);

                taskOption = {
                    isMapReduce: true,
                    scriptId: vc2_constant.SCRIPT.SERIAL_UPDATE_MR,
                    scriptParams: {}
                };
                taskOption.scriptParams['custscript_vc_type'] = record.type;
                taskOption.scriptParams['custscript_vc_id'] = record.id;
                taskOption.scriptParams['custscript_vc_sender'] = ns_runtime.getCurrentUser().id;
                taskOption.deployId = Helper.forceDeploy(taskOption);
            }

            log.audit(logTitle, LogPrefix + '>> Task option:  ' + JSON.stringify(taskOption));
            log.audit(logTitle, LogPrefix + '***** END SCRIPT *****');
        }
    };

    var Helper = {
        validateLicense: function (options) {
            var mainConfig = options.mainConfig,
                license = mainConfig.license,
                response = vc_licenselib.callValidationSuitelet({
                    license: license,
                    external: true
                }),
                result = true;

            if (response == 'invalid') {
                log.error(
                    'License expired',
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
                result = false;
            }

            return result;
        },

        loadMainConfig: function () {
            var mainConfig = vc_mainconfig.getMainConfiguration();

            if (!mainConfig) {
                log.error('No VAR Connect Main Coniguration available');
            } else return mainConfig;
        },

        searchSerials: function (option) {
            var logTitle = [LogTitle, 'searchSerials'].join('::');
            var searchOption = {
                type: 'customrecordserialnum',
                columns: [
                    'internalid',
                    'name',
                    'custrecordserialitem',
                    'custrecordserialsales',
                    'custrecordserialpurchase'
                ],
                filters: [['isinactive', 'is', 'F']]
            };

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId,
                po: option.purchaseOrder || option.purchaseOrderId || option.poId,
                inv: option.invoice || option.invoiceId || option.invId
            };

            log.audit(logTitle, param);

            if (param.po) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialpurchase', 'anyof', param.po]);
            }
            if (param.so) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialsales', 'anyof', param.so]);
            }
            if (param.inv) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialinvoice', 'anyof', param.inv]);
            }
            log.audit(logTitle, searchOption);

            var results = [],
                searchObj = ns_search.create(searchOption),
                searchResults = vc_util.searchAllPaged({ searchObj: searchObj });

            searchResults.forEach(function (result) {
                results.push({
                    id: result.getValue({ name: 'internalid' }),
                    name: result.getValue({ name: 'name' }),
                    itemnum: result.getValue({ name: 'custrecordserialitem' })
                });
                return true;
            });

            // var serialSearch = ns_search.create(searchOption);
            // serialSearch.run().each(function (result) {
            //     results.push({
            //         id: result.getValue({ name: 'internalid' }),
            //         name: result.getValue({ name: 'name' }),
            //         itemnum: result.getValue({ name: 'custrecordserialitem' })
            //     });
            //     return true;
            // });

            return results;
        },

        searchVendorConfig: function (option) {
            var logTitle = [LogTitle, 'searchVendorConfig'].join('::');

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId,
                vendor: option.vendor || option.vendorId
            };

            if (!param.vendor && param.so) {
                param.vendor = Helper.searchVendor({ salesOrder: param.so });
            }

            if (!param.vendor) return false;

            var searchOption = {
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [['custrecord_ctc_vc_vendor', 'anyof', param.vendor]],
                columns: ['internalid', 'custrecord_ctc_vc_vendor']
            };
            var searchVendorCFG = ns_search.create(searchOption);
            if (!searchVendorCFG.runPaged().count) return false;

            searchVendorCFG.run().each(function (result) {
                param.vendorConfig = result.getValue({ name: 'internalid' });
                return true;
            });

            log.audit(logTitle, LogPrefix + JSON.stringify(param));

            return param.vendorConfig;
        },

        searchVendor: function (option) {
            var logTitle = [LogTitle, 'searchVendor'].join('::');

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId
            };

            var searchOption = {
                type: 'purchaseorder',
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['createdfrom', 'anyof', param.so]
                ],
                columns: [
                    'internalid',
                    'transactionname',
                    'entity',
                    'custbody_ctc_vc_serialsync_done',
                    'createdfrom',
                    ns_search.createColumn({
                        name: 'entityid',
                        join: 'vendor'
                    })
                ]
            };

            var searchPO = ns_search.create(searchOption);
            if (!searchPO.runPaged().count) return false;

            searchPO.run().each(function (result) {
                param.vendor = result.getValue({ name: 'entity' });
                param.vendorName = result.getValue({
                    name: 'entityid',
                    join: 'vendor'
                });
                return true;
            });

            log.audit(logTitle, LogPrefix + JSON.stringify(param));

            return param.vendor;
        },

        getTaskStatus: function (taskId) {
            return ns_task.checkStatus({ taskId: taskId });
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

                        var objTask = ns_task.create(taskInfo);

                        var taskId = objTask.submit();
                        var taskStatus = ns_task.checkStatus({
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
                        var searchDeploy = ns_search.create({
                            type: ns_search.Type.SCRIPT_DEPLOYMENT,
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
                            newDeploy = ns_record.copy({
                                type: ns_record.Type.SCRIPT_DEPLOYMENT,
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
                    option.taskType = ns_task.TaskType.SCHEDULED_SCRIPT;
                    option.taskType = option.isMapReduce
                        ? ns_task.TaskType.MAP_REDUCE
                        : option.isSchedScript
                        ? ns_task.TaskType.SCHEDULED_SCRIPT
                        : option.taskType;
                }

                log.debug(logTitle, '>> params: ' + JSON.stringify(option));

                returnValue =
                    FN.deploy(
                        option.scriptId,
                        option.deployId,
                        option.scriptParams,
                        option.taskType
                    ) ||
                    FN.deploy(option.scriptId, null, option.scriptParams, option.taskType) ||
                    FN.copyAndDeploy(option.scriptId, option.scriptParams, option.taskType);

                log.audit(logTitle, '>> deploy: ' + JSON.stringify(returnValue));
            } catch (e) {
                log.error(logTitle, e.name + ': ' + e.message);
                throw e;
            }
            ////////////////////////////////////////

            return returnValue;
        }
    };

    return USER_EVENT;
});
