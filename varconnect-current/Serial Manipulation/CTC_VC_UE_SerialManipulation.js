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
 * 1.01     Jun 7, 2023     christian               Trigger only on serial list change
 *
 */

define([
    'N/task',
    'N/ui/serverWidget',
    'N/runtime',
    'N/record',
    'N/search',
    '../CTC_VC2_Constants.js',
    '../CTC_VC2_Lib_Utils',
    '../Services/ctc_svclib_configlib.js'
], function (
    ns_task,
    ns_ui,
    ns_runtime,
    ns_record,
    ns_search,
    vc2_constant,
    vc2_util,
    vcs_configLib
) {
    var LogTitle = 'UE|Serials',
        LogPrefix;

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle, 'beforeLoad'].join('::');
            if (ns_runtime.executionContext !== ns_runtime.ContextType.USER_INTERFACE) return;
            if (scriptContext.type === scriptContext.UserEventType.DELETE) return;

            var MainCFG = vcs_configLib.mainConfig();

            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            LogPrefix = [
                ns_runtime.executionContext,
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id || '_NEW_'
            ].join(':');
            LogPrefix = '[' + LogPrefix + '] ';
            vc2_util.LogPrefix = LogPrefix;

            vc2_util.log(logTitle, '*** SCRIPT START ****', {
                eventType: scriptContext.type,
                contextType: ns_runtime.executionContext,
                mainConfig: MainCFG
            });

            try {
                //If Serial Scan and Update feature is disabled, hide the corresponding columns
                var form = scriptContext.form,
                    sublist = form.getSublist({ id: 'item' });

                var fieldObj = {
                    serialUpdate: Helper.getSublistField(
                        sublist,
                        vc2_constant.FIELD.TRANSACTION.SERIAL_NUMBER_UPDATE
                    ),
                    serialScan: Helper.getSublistField(
                        sublist,
                        vc2_constant.FIELD.TRANSACTION.SERIAL_NUMBER_SCAN
                    ),
                    serialSync: Helper.getField(form, 'custbody_ctc_vc_serialsync_done')
                };
                vc2_util.log(logTitle, '// fieldObj: ', fieldObj);

                if (!MainCFG.serialScanUpdate) {
                    vc2_util.log(logTitle, '>> sublist: ', sublist);

                    if (sublist) {
                        //force check if field exists
                        if (fieldObj.serialUpdate)
                            fieldObj.serialUpdate.updateDisplayType({
                                displayType: ns_ui.FieldDisplayType.HIDDEN
                            });

                        //force check if field exists
                        if (fieldObj.serialScan)
                            fieldObj.serialScan.updateDisplayType({
                                displayType: ns_ui.FieldDisplayType.HIDDEN
                            });
                    }

                    // serial sync checkbox
                    if (fieldObj.serialSync)
                        fieldObj.serialSync.updateDisplayType({
                            displayType: ns_ui.FieldDisplayType.HIDDEN
                        });
                }

                // if (scriptContext.newRecord && scriptContext.newRecord.type == ns_record.Type.INVOICE) {
                var OrderCFG = Helper.searchVendorConfig({
                    salesOrder: scriptContext.newRecord.getValue({ fieldId: 'createdfrom' })
                });

                if (!OrderCFG) {
                    // serial sync checkbox

                    if (fieldObj.serialSync)
                        fieldObj.serialSync.updateDisplayType({
                            displayType: ns_ui.FieldDisplayType.HIDDEN
                        });
                }
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ## ' + vc2_util.extractError(error));
            }

            return true;
            // }
        },

        afterSubmit: function (scriptContext) {
            var logTitle = [LogTitle, 'afterSubmit'].join('::');

            LogPrefix = [
                ns_runtime.executionContext,
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id || '_NEW_'
            ].join(':');
            LogPrefix = '[' + LogPrefix + '] ';
            vc2_util.LogPrefix = LogPrefix;

            var MainCFG = vcs_configLib.mainConfig();

            try {
                if (!MainCFG) throw 'Missing main config!';

                if (
                    !vc2_util.inArray(scriptContext.type, [
                        scriptContext.UserEventType.CREATE,
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ]) ||
                    ns_runtime.executionContext == ns_runtime.ContextType.MAP_REDUCE
                )
                    throw 'Invalid Context/EventType';

                vc2_util.log(logTitle, '****** START SCRIPT *****');

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

                var hasSerialListChanged = Helper.isSerialListChanged(scriptContext);

                vc2_util.log(logTitle, '/// settings: ', {
                    tranId: tranId,
                    hasSerials: hasSerials,
                    hasNoSerials: hasNoSerials,
                    hasSerialListChanged: hasSerialListChanged,
                    'MainCFG.serialScanUpdate': MainCFG.serialScanUpdate,
                    'MainCFG.copySerialsInv': MainCFG.copySerialsInv
                });

                //Also check if the corresponding features have been enabled before processing
                var OrderCFG;
                if (
                    record.type == ns_record.Type.INVOICE &&
                    MainCFG.copySerialsInv &&
                    (hasSerialListChanged ||
                        scriptContext.type == scriptContext.UserEventType.CREATE)
                ) {
                    OrderCFG = Helper.searchVendorConfig({
                        salesOrder: record.getValue({ fieldId: 'createdfrom' })
                    });

                    // if (OrderCFG) {
                    vc2_util.waitRandom(10000);

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

                if (hasSerials && MainCFG.serialScanUpdate && hasSerialListChanged) {
                    vc2_util.waitRandom(10000);

                    taskOption = {
                        isMapReduce: true,
                        scriptId: vc2_constant.SCRIPT.SERIAL_UPDATE_MR,
                        scriptParams: {}
                    };
                    taskOption.scriptParams['custscript_vc_type'] = record.type;
                    taskOption.scriptParams['custscript_vc_id'] = record.id;
                    taskOption.scriptParams['custscript_vc_sender'] =
                        ns_runtime.getCurrentUser().id;
                    taskOption.deployId = Helper.forceDeploy(taskOption);
                }

                vc2_util.log(logTitle, '// Task option: ', taskOption);
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ##', vc2_util.extractError(error));
            }

            vc2_util.log(logTitle, '***** END SCRIPT *****');
        }
    };

    var Helper = {
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

            vc2_util.log(logTitle, '// param: ', param);

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
            vc2_util.log(logTitle, '//searchOption: ', searchOption);

            var results = [],
                searchObj = ns_search.create(searchOption),
                searchResults = vc2_util.searchAllPaged({ searchObj: searchObj });

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
                param.OrderCFG = result.getValue({ name: 'internalid' });
                return true;
            });

            log.audit(logTitle, LogPrefix + JSON.stringify(param));

            return param.OrderCFG;
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
                columns: ['entity']
            };

            var searchPO = ns_search.create(searchOption);
            searchPO.run().each(function (result) {
                param.vendor = result.getValue({ name: 'entity' });
                return false; // return first vendor
            });

            vc2_util.log(logTitle, '// param', param);

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
                        vc2_util.log(logTitle, '## DEPLOY status: ', {
                            id: taskId,
                            status: taskStatus
                        });
                        returnValue = taskId;
                    } catch (e) {
                        vc2_util.log(logTitle, '## ERROR ## ', vc2_util.extractError(e));
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

                vc2_util.log(logTitle, '// params', option);

                returnValue =
                    FN.deploy(
                        option.scriptId,
                        option.deployId,
                        option.scriptParams,
                        option.taskType
                    ) ||
                    FN.deploy(option.scriptId, null, option.scriptParams, option.taskType) ||
                    FN.copyAndDeploy(option.scriptId, option.scriptParams, option.taskType);

                vc2_util.log(logTitle, '// deploy: ', returnValue);
            } catch (e) {
                vc2_util.log(logTitle, '## ERROR ## ', vc2_util.extractError(e));
                throw e;
            }
            ////////////////////////////////////////

            // initiate the cleanup
            this.cleanUpDeployment(option);

            return returnValue;
        },
        cleanUpDeployment: function (option) {
            var logTitle = [LogTitle, 'cleanUpDeployment'].join('::');

            var searchDeploy = ns_search.create({
                type: ns_search.Type.SCRIPT_DEPLOYMENT,
                filters: [
                    ['script.scriptid', 'is', option.scriptId],
                    'AND',
                    ['status', 'is', 'NOTSCHEDULED'],
                    'AND',
                    ['isdeployed', 'is', 'T']
                ],
                columns: ['scriptid']
            });

            var maxAllowed = option.max || 100; // only allow 100
            var arrResults = vc2_util.searchGetAllResult(searchDeploy);

            vc2_util.log(logTitle, '>> cleanup : ', {
                maxAllowed: maxAllowed,
                totalResults: arrResults.length
            });
            if (maxAllowed > arrResults.length) return;

            var currentScript = ns_runtime.getCurrentScript();
            var countDelete = arrResults.length - maxAllowed;
            var idx = 0;

            while (countDelete-- && currentScript.getRemainingUsage() > 100) {
                try {
                    ns_record.delete({
                        type: ns_record.Type.SCRIPT_DEPLOYMENT,
                        id: arrResults[idx++].id
                    });
                } catch (del_err) {}
            }
            vc2_util.log(logTitle, '// Total deleted: ', idx);

            return true;
        },

        getField: function (form, fieldId) {
            var logTitle = 'getField',
                returnField;

            vc2_util.log(logTitle, '/// fieldId: ', [fieldId]);

            try {
                returnField = form.getField({ id: fieldId });
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ## ', [fieldId, vc2_util.extractError(error)]);
                returnField = null;
            }
            try {
                if (!returnField || !returnField.id) {
                    vc2_util.log(
                        logTitle,
                        '## ERROR ## ',
                        'Field (id=' + fieldId + ') is not exposed'
                    );
                    returnField = null;
                }
            } catch (invocationErr) {
                vc2_util.log(logTitle, '## ERROR ## ', 'Field (id=' + fieldId + ') is not exposed');
                returnField = null;
            }

            return returnField;
        },
        getSublistField: function (sublist, fieldId) {
            var logTitle = 'getSublistField',
                returnField;

            vc2_util.log(logTitle, '/// sublist, fieldId: ', [sublist, fieldId]);

            try {
                returnField = sublist.getField({ id: fieldId });
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ## ', [fieldId, vc2_util.extractError(error)]);
                returnField = null;
            }
            try {
                if (!returnField || !returnField.id) {
                    vc2_util.log(
                        logTitle,
                        '## ERROR ## ',
                        'Field (id=' + fieldId + ') is not exposed'
                    );
                    returnField = null;
                }
            } catch (invocationErr) {
                vc2_util.log(logTitle, '## ERROR ## ', 'Field (id=' + fieldId + ') is not exposed');
                returnField = null;
            }

            return returnField;
        },
        split: function (inputString) {
            var result = [];
            if (inputString) {
                inputString = inputString
                    .replace(/[,\s]+/g, ',')
                    .replace(/(^[,\s]+)|([,\s]+$)/g, '');
                result = inputString.split(',');
            }
            return result;
        },
        matchArrayContents: function (input1, input2) {
            var array1 = input1,
                array2 = input2,
                returnValue = null;
            if (util.isString(input1)) {
                array1 = Helper.split(input1);
            }
            if (util.isString(input2)) {
                array2 = Helper.split(input2);
            }
            if (util.isArray(array1) && util.isArray(array2)) {
                returnValue = 0;
                var y;
                for (var x = 0, xCount = array1.length; x < xCount; x += 1) {
                    var arr1Content = array1[x];
                    var y = array2.indexOf(arr1Content);
                    var cont1Matched = false;
                    while (y >= 0) {
                        cont1Matched = true;
                        array2 = array2.splice(y, 1);
                        y = array2.indexOf(arr1Content);
                    }
                    if (!cont1Matched) {
                        returnValue = -1; // array2 missing some values
                        break;
                    }
                }
                y = 0;
                if (returnValue === 0) {
                    for (var yCount = array2.length; y < yCount; y += 1) {
                        var arr2Content = array2[x];
                        var x = array1.indexOf(arr2Content);
                        if (x == -1) {
                            returnValue = 1; // array2 has some new values
                            break;
                        }
                    }
                }
            }
            return returnValue;
        },
        isSerialListChanged: function (option) {
            var logTitle = [LogTitle || '', 'isSerialListChanged'].join('::'),
                returnValue = false;
            var oldRecord = option.oldRecord,
                record = option.newRecord;
            if (!oldRecord) returnValue = true;
            // create
            else if (oldRecord) {
                var cols = vc2_constant.FIELD.TRANSACTION,
                    hasSerialsChanged = false,
                    hasLineSerials = false,
                    hasExistingSerials = false,
                    lineCount = record.getLineCount({ sublistId: 'item' });
                for (var line = 0; line < lineCount; line++) {
                    var lineUniqueKey = record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'lineuniquekey',
                        line: line
                    });
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
                    var lineEquivalent = oldRecord.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'lineuniquekey',
                        value: lineUniqueKey
                    });
                    var oldSerialString = oldRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: cols.SERIAL_NUMBER_SCAN,
                        line: lineEquivalent
                    });
                    var oldSerialStringUpdate = oldRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: cols.SERIAL_NUMBER_UPDATE,
                        line: lineEquivalent
                    });
                    if (serialString || serialStringUpdate) {
                        hasLineSerials = true;
                    }
                    if (oldSerialString || oldSerialStringUpdate) {
                        hasExistingSerials = true;
                    }
                    if (hasLineSerials != hasExistingSerials) {
                        hasSerialsChanged = true;
                    } else if (hasLineSerials && hasExistingSerials) {
                        hasSerialsChanged =
                            Helper.matchArrayContents(oldSerialString, serialString) !== 0 ||
                            Helper.matchArrayContents(oldSerialStringUpdate, serialStringUpdate) !==
                                0;
                    } else {
                        hasSerialsChanged = false;
                    }
                }
                returnValue = hasSerialsChanged;
            }
            return returnValue;
        }
    };

    return USER_EVENT;
});
