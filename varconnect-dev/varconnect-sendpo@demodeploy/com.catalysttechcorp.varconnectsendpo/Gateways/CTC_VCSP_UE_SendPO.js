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
 * @NScriptType UserEventScript
 */
define([
    'N/runtime',
    'N/search',
    'N/record',
    'N/ui/message',
    'N/redirect',
    'N/url',
    'N/ui/serverWidget',
    'N/task',
    'N/redirect',
    '../Library/CTC_Lib_EventRouter',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Lib_Main',
    '../Library/CTC_VCSP_Lib_MainConfiguration',
    '../Library/CTC_VCSP_Lib_LicenseValidator',
    '../Library/CTC_VCSP_Lib_VendorConfig',
    '../Library/CTC_VCSP_Constants'
], function (
    NS_Runtime,
    NS_Search,
    NS_Record,
    NS_Msg,
    NS_Redirect,
    NS_Url,
    NS_ServerWidget,
    NS_Task,
    NS_Redir,
    EventRouter,
    CTC_Util,
    libMain,
    libMainConfig,
    libLicenseValidator,
    libVendorConfig,
    VCSP_Global
) {
    let LogTitle = 'VC:SENDPO';

    let Helper = {
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
                        for (let k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            let i = arrValue.length - 1;
            for (; i >= 0; i--) {
                if (stValue == arrValue[i]) {
                    break;
                }
            }
            return i > -1;
        },
        hideFields: function (option) {
            let logTitle = [LogTitle, 'hideFields'].join(':'),
                form = option.form,
                sublistId = option.sublistId,
                fieldIds = option.fieldIds;
            if (!fieldIds || !fieldIds.length) return;
            fieldIds = util.isArray(fieldIds) ? fieldIds : [fieldIds];

            log.audit(
                logTitle,
                'Fields: ' +
                    JSON.stringify({
                        sublistId: sublistId,
                        fieldIds: fieldIds
                    })
            );

            if (sublistId) {
                form = form.getSublist({ id: sublistId });
            }
            if (!form) {
                return;
            }

            fieldIds.forEach(function (fieldId) {
                let fldObj = form.getField({ id: fieldId });
                if (fldObj) {
                    try {
                        fldObj.updateDisplayType({
                            displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                        });
                    } catch (hideErr) {
                        log.debug(
                            logTitle,
                            ['Error hiding ', fieldId, ': ', hideErr.name, '- ', hideErr.message].join('')
                        );
                    }
                }
            });
        },
        showFields: function (option) {
            let logTitle = [LogTitle, 'showFields'].join(':'),
                form = option.form,
                sublistId = option.sublistId,
                fieldIds = option.fieldIds;
            if (!fieldIds || !fieldIds.length) return;
            fieldIds = util.isArray(fieldIds) ? fieldIds : [fieldIds];

            log.audit(
                logTitle,
                'Fields: ' +
                    JSON.stringify({
                        sublistId: sublistId,
                        fieldIds: fieldIds
                    })
            );

            if (sublistId) {
                form = form.getSublist({ id: sublistId });
            }
            if (!form) {
                return;
            }

            fieldIds.forEach(function (fieldId) {
                let fldObj = form.getField({ id: fieldId });
                if (fldObj) {
                    try {
                        fldObj.updateDisplayType({
                            displayType: NS_ServerWidget.FieldDisplayType.NORMAL
                        });
                    } catch (displayErr) {
                        log.debug(
                            logTitle,
                            ['Error displaying ', fieldId, ': ', displayErr.name, '- ', displayErr.message].join('')
                        );
                    }
                }
            });
        },
        displayAsInlineTextarea: function (form, arrFields) {
            let logTitle = [LogTitle, 'displayAsInlineTextarea'].join(':');
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            log.audit(logTitle, arrFields);

            arrFields.forEach(function (fieldId) {
                log.audit(logTitle, 'Original field: ' + fieldId);
                if (!fieldId) return true;

                try {
                    let fldOrig = form.getField({ id: fieldId });
                    log.audit(logTitle, JSON.stringify(fldOrig));

                    if (!fldOrig || !fldOrig.defaultValue) return true;

                    let newFieldDetails = {
                        id: ['custpage', fieldId].join('_'),
                        label: fldOrig.label,
                        type: 'inlinehtml'
                    };
                    let fldNew = form.addField(newFieldDetails);
                    log.audit(logTitle, 'New field: ' + JSON.stringify(newFieldDetails));

                    let strValue = fldOrig.defaultValue;

                    fldNew.defaultValue = [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">',
                        fldOrig.label,
                        '</a>',
                        '</span></span>',
                        '<textarea cols="60" rows="10" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        strValue,
                        '</textarea>',
                        '</div>'
                    ].join('');

                    form.insertField({ field: fldNew, nextfield: fldOrig.id });
                    fldOrig.updateDisplayType({
                        displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                    });
                } catch (error) {
                    log.audit(logTitle, error);
                    throw error;
                }
                return true;
            }); // end: arrFields.forEach
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
                        CTC_Util.logError(logTitle, CTC_Util.extractError(e));
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

                log.audit(logTitle, '// params: ' + JSON.stringify(option));

                returnValue =
                    FN.deploy(option.scriptId, option.deployId, option.scriptParams, option.taskType) ||
                    FN.deploy(option.scriptId, null, option.scriptParams, option.taskType) ||
                    FN.copyAndDeploy(option.scriptId, option.scriptParams, option.taskType);

                log.audit(logTitle, '// deploy: ' + JSON.stringify(returnValue));
            } catch (e) {
                CTC_Util.logError(logTitle, CTC_Util.extractError(e));
                throw e;
            }
            ////////////////////////////////////////

            // initiate the cleanup
            // this.cleanUpDeployment(option);

            return returnValue;
        }
        // cleanUpDeployment: function (option) {
        //     var logTitle = [LogTitle, 'cleanUpDeployment'].join('::');

        //     var searchDeploy = NS_Search.create({
        //         type: NS_Search.Type.SCRIPT_DEPLOYMENT,
        //         filters: [
        //             ['script.scriptid', 'is', option.scriptId],
        //             'AND',
        //             ['status', 'is', 'NOTSCHEDULED'],
        //             'AND',
        //             ['isdeployed', 'is', 'T']
        //         ],
        //         columns: ['scriptid']
        //     });

        //     var maxAllowed = option.max || 100; // only allow 100
        //     var arrResults = vc2_util.searchGetAllResult(searchDeploy);

        //     vc2_util.log(logTitle, '>> cleanup : ', {
        //         maxAllowed: maxAllowed,
        //         totalResults: arrResults.length
        //     });
        //     if (maxAllowed > arrResults.length) return;

        //     var currentScript = ns_runtime.getCurrentScript();
        //     var countDelete = arrResults.length - maxAllowed;
        //     var idx = 0;

        //     while (countDelete-- && currentScript.getRemainingUsage() > 100) {
        //         try {
        //             NS_Record.delete({
        //                 type: NS_Record.Type.SCRIPT_DEPLOYMENT,
        //                 id: arrResults[idx++].id
        //             });
        //         } catch (del_err) {}
        //     }
        //     vc2_util.log(logTitle, '// Total deleted: ', idx);

        //     return true;
        // }
    };

    let purchaseOrderValidation = {};
    purchaseOrderValidation.setMemoAndHelper = function (option) {
        let logTitle = [LogTitle, 'setMemoAndHelper'].join('::'),
            scriptContext = option.scriptContext,
            vendorCfg = option.vendorConfig;
        log.debug(logTitle, 'Consolidating line memos to header...');
        let lineMemos = [],
            memoField = vendorCfg ? vendorCfg.memoField || 'memo' : 'memo';
        for (let i = 0, lineCount = scriptContext.newRecord.getLineCount('item'); i < lineCount; i += 1) {
            let lineMemo = scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: VCSP_Global.Fields.Transaction.Item.MEMO,
                line: i
            });
            if (lineMemo && lineMemo.trim()) {
                lineMemos.push(['@', i + 1, ': ', lineMemo].join(''));
            }
        }
        let consolidatedMemo = [scriptContext.newRecord.getValue(memoField), lineMemos.join('\n')].join('\n').trim();
        scriptContext.newRecord.setValue(memoField, consolidatedMemo);
        log.debug(logTitle, 'Adding "Repopulate memo" button...');
        scriptContext.form.getSublist('item').addButton({
            id: 'custpage_ctc_vcsp_remergememo',
            label: 'Repopulate memo',
            functionName:
                `( function(fieldId) {
                        require(['N/currentRecord'], function(ns_currentRecord) {
                            let currentRecord = ns_currentRecord.get(),
                                memo = currentRecord.getValue('${memoField}'),
                                memoField = currentRecord.getField('${memoField}');
                            if (!memo || !memo.trim() || window.confirm('This will overwrite the contents of the ' + memoField.label + ' field. Proceed?')) {
                                let lineMemos = [];
                                for (let i = 0, lineCount = currentRecord.getLineCount('item'); i < lineCount; i += 1) {
                                    let lineMemo = currentRecord.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: fieldId,
                                        line: i,
                                    });
                                    if (lineMemo && lineMemo.trim()) {
                                        lineMemos.push([
                                            '@',
                                            (i + 1),
                                            ': ',
                                            lineMemo
                                        ].join(''));
                                    }
                                }
                                let consolidatedMemo = lineMemos.join('\\n').trim();
                                currentRecord.setValue('${memoField}', consolidatedMemo);
                            }
                        });
                    })('` +
                VCSP_Global.Fields.Transaction.Item.MEMO +
                `')`
        });
    };
    purchaseOrderValidation.addPopupButton = function (option) {
        let logTitle = [LogTitle, 'addPopupButton'].join('::'),
            scriptContext = option.scriptContext,
            vendorCfg = option.vendorConfig,
            poid = option.poid;
        if (scriptContext && scriptContext.form && vendorCfg && vendorCfg.addVendorDetailsEnabled) {
            // check if vendor details is mapped
            if (vendorCfg.additionalPOFields) {
                let vendorDetailsPopupUrl = NS_Url.resolveScript({
                    deploymentId: VCSP_Global.Scripts.Deployment.VENDOR_DETAILS_SL,
                    scriptId: VCSP_Global.Scripts.Script.VENDOR_DETAILS_SL,
                    params: {
                        vendorConfigId: vendorCfg.id,
                        title: 'Additional Vendor Details',
                        poid: poid
                    },
                    returnExternalUrl: false
                });
                log.audit(logTitle, 'Additional vendor details pop-up url: ' + vendorDetailsPopupUrl);
                if (poid) {
                    scriptContext.form.addButton({
                        id: 'custpage_ctc_vcsp_setvenddetl',
                        label: 'Add VC Vendor Details',
                        functionName: '(function(url){window.location.href=url;})("' + vendorDetailsPopupUrl + '")'
                    });
                } else {
                    scriptContext.form.addButton({
                        id: 'custpage_ctc_vcsp_setvenddetl',
                        label: 'Add VC Vendor Details',
                        functionName:
                            `(function(url) {
                                url = url + '&lineCount=' + nlapiGetLineItemCount('item');
                                window.open(url, 'vcspctcsendpopopup', 'popup=yes,width=1000,height=750,resizable=yes,scrollbar=yes');
                            })("` +
                            vendorDetailsPopupUrl +
                            `")`
                    });
                }
            } else {
                let vendorDetailsPopupUrl = NS_Url.resolveScript({
                    deploymentId: VCSP_Global.Scripts.Deployment.VENDOR_DETAILS_SL,
                    scriptId: VCSP_Global.Scripts.Script.VENDOR_DETAILS_SL,
                    params: {
                        title: 'Additional Vendor Details'
                    },
                    returnExternalUrl: false
                });
                log.audit(logTitle, 'Additional vendor details pop-up url: ' + vendorDetailsPopupUrl);
                scriptContext.form.addButton({
                    id: 'custpage_ctc_vcsp_setvenddetl',
                    label: 'Add VC Vendor Details',
                    functionName:
                        `(function(url) {
                            let subsidiaryId = nlapiGetFieldValue('subsidiary'),
                                vendorId = nlapiGetFieldValue('entity');
                            if (subsidiaryId && vendorId) {
                                url = url + '&subsidiaryId=' + subsidiaryId;
                                url = url + '&vendorId=' + vendorId;
                                url = url + '&lines=' + nlapiGetLineItemCount('item');
                                window.open(url, 'vcspctcsendpopopup', 'popup=yes,width=1000,height=750,resizable=yes,scrollbar=yes');
                            } else {
                                window.alert('Please choose a vendor');
                            }
                        })("` +
                        vendorDetailsPopupUrl +
                        `")`
                });
            }
        }
    };
    purchaseOrderValidation.limitPOLineColumns = function (option) {
        let logTitle = [LogTitle, 'limitPOLineColumns'].join('::'),
            poLineSublistId = ['recmach', VCSP_Global.Fields.VarConnectPOLine.PURCHASE_ORDER].join(''),
            scriptContext = option.scriptContext,
            vendorCfg = option.vendorConfig,
            eventType = option.eventType;
        log.debug(logTitle, 'Event type= ' + eventType);
        if (scriptContext.form) {
            let poLineColumnsToDisplay = [],
                poLineColumnsToDisplayStr = vendorCfg.poLineColumns,
                poLineColumnsToIgnore = ['internalid'];
            if (poLineColumnsToDisplayStr && poLineColumnsToDisplayStr.length) {
                poLineColumnsToDisplay = poLineColumnsToDisplayStr.split(/[\s,]+/) || [];
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.CREATE_LOG) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.CREATE_LOG);
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.UPDATE_LOG) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.UPDATE_LOG);
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.JSON_DATA) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.JSON_DATA);
            }
            let poLineColumnsToHide = [];
            for (let fieldName in VCSP_Global.Fields.VarConnectPOLine) {
                let fieldId = VCSP_Global.Fields.VarConnectPOLine[fieldName];
                if (poLineColumnsToDisplay.indexOf(fieldId) == -1 && poLineColumnsToIgnore.indexOf(fieldId) == -1) {
                    poLineColumnsToHide.push(fieldId);
                }
            }
            log.debug(logTitle, 'Hiding fields: ' + poLineColumnsToHide.join(', '));
            Helper.hideFields({
                form: scriptContext.form,
                sublistId: poLineSublistId,
                fieldIds: poLineColumnsToHide
            });
            log.debug(logTitle, 'Showing fields: ' + poLineColumnsToDisplay.join(', '));
            Helper.showFields({
                form: scriptContext.form,
                sublistId: poLineSublistId,
                fieldIds: poLineColumnsToDisplay
            });
        }
    };
    purchaseOrderValidation.getPoLineValues = function (option) {
        let logTitle = [LogTitle, 'getPoLineValues'].join('::'),
            purchaseOrderId = option.poid || option,
            poLineColumns = option.columns,
            returnValue = null;
        if (purchaseOrderId) {
            if (poLineColumns) {
                poLineColumns = JSON.parse(JSON.stringify(poLineColumns));
            } else {
                poLineColumns = [];
                for (let fieldName in VCSP_Global.Fields.VarConnectPOLine) {
                    poLineColumns.push(VCSP_Global.Fields.VarConnectPOLine[fieldName]);
                }
            }
            poLineColumns.splice(
                0,
                0,
                NS_Search.createColumn({
                    name: 'internalid',
                    sort: NS_Search.Sort.ASC
                })
            );
            let poLineSearch = NS_Search.create({
                type: VCSP_Global.Records.VC_POLINE,
                filters: [
                    [VCSP_Global.Fields.VarConnectPOLine.PURCHASE_ORDER, NS_Search.Operator.ANYOF, purchaseOrderId],
                    'and',
                    ['isinactive', NS_Search.Operator.IS, 'F']
                ],
                columns: poLineColumns
            });
            returnValue = CTC_Util.searchAllPaged({
                searchObj: poLineSearch
            });
        }
        log.debug(logTitle, JSON.stringify(returnValue));
        return returnValue;
    };
    purchaseOrderValidation.replacePOLineSublist = function (option) {
        let logTitle = [LogTitle, 'replacePOLineSublist'].join('::'),
            scriptContext = option.scriptContext,
            form = scriptContext.form,
            vendorCfg = option.vendorConfig,
            eventType = option.eventType,
            poid = option.poid;
        log.debug(logTitle, 'Event type= ' + eventType);
        if (scriptContext.form) {
            let poLineColumnsToDisplayStr = vendorCfg.poLineColumns;
            let poLineColumnsToDisplay = [];
            if (poLineColumnsToDisplayStr && poLineColumnsToDisplayStr.length) {
                poLineColumnsToDisplay = poLineColumnsToDisplayStr.split(/[\s,]+/);
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.CREATE_LOG) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.CREATE_LOG);
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.UPDATE_LOG) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.UPDATE_LOG);
            }
            if (poLineColumnsToDisplay.indexOf(VCSP_Global.Fields.VarConnectPOLine.JSON_DATA) == -1) {
                poLineColumnsToDisplay.push(VCSP_Global.Fields.VarConnectPOLine.JSON_DATA);
            }
            log.debug(logTitle, 'Showing fields: ' + poLineColumnsToDisplay.join(', '));
            let poLineList = purchaseOrderValidation.getPoLineValues({
                poid: poid,
                columns: poLineColumnsToDisplay
            });
            if (poLineList.length) {
                let sublistId = ['recmach', VCSP_Global.Fields.VarConnectPOLine.PURCHASE_ORDER].join('');
                let sublist = form.getSublist({
                    id: sublistId
                });
                let viewSublistId = 'custpage_ctc_vcsp_poline';
                let viewSublist = form.addSublist({
                    id: viewSublistId,
                    label: 'VAR Connect PO Line',
                    type: NS_ServerWidget.SublistType.INLINEEDITOR,
                    tab: 'VAR CONNECT'
                });
                form.insertSublist({
                    sublist: viewSublist,
                    nextsublist: sublistId
                });
                let samplePOLineId = poLineList[0].id;
                log.debug(logTitle, 'Sample PO Line: ' + samplePOLineId);
                let samplePOLine = NS_Record.load({
                    type: VCSP_Global.Records.VC_POLINE,
                    id: samplePOLineId
                });
                poLineColumnsToDisplay.forEach((fieldId) => {
                    let fieldObj = samplePOLine.getField({
                        fieldId: fieldId
                    });
                    log.debug(logTitle, 'Adding fields: ' + JSON.stringify(fieldObj));
                    switch (fieldId) {
                        case 'id':
                            viewSublist.addField({
                                id: fieldId,
                                label: fieldObj.label,
                                type: NS_ServerWidget.FieldType.SELECT,
                                source: VCSP_Global.Records.VC_POLINE
                            });
                            break;
                        case VCSP_Global.Fields.VarConnectPOLine.JSON_DATA:
                            viewSublist.addField({
                                id: fieldId,
                                label: 'Full Details',
                                type: NS_ServerWidget.FieldType.TEXTAREA
                            });
                            break;
                        case VCSP_Global.Fields.VarConnectPOLine.CREATE_LOG:
                        case VCSP_Global.Fields.VarConnectPOLine.UPDATE_LOG:
                            viewSublist.addField({
                                id: fieldId,
                                label: fieldObj.label,
                                type: NS_ServerWidget.FieldType.SELECT,
                                source: VCSP_Global.Records.VC_LOG
                            });
                            break;
                        default:
                            viewSublist.addField({
                                id: fieldId,
                                label: fieldObj.label,
                                type: NS_ServerWidget.FieldType.TEXT
                            });
                            break;
                    }
                    for (let i = 0, len = poLineList.length; i < len; i += 1) {
                        let poLineRow = poLineList[i],
                            value = null;
                        switch (fieldId) {
                            case VCSP_Global.Fields.VarConnectPOLine.JSON_DATA:
                                value = poLineRow.getText(fieldId) || poLineRow.getValue(fieldId);
                                // if (value) {
                                //     let newValue = '<span class="uir-field-truncated-value" data-ns-tooltip="' + value + '">Details</span>';
                                //     log.debug(logTitle, 'More details=' + newValue);
                                //     value = newValue;
                                // }
                                break;
                            default:
                                value = poLineRow.getText(fieldId) || poLineRow.getValue(fieldId);
                                break;
                        }
                        if (!CTC_Util.isEmpty(value)) {
                            viewSublist.setSublistValue({
                                id: fieldId,
                                line: i,
                                value: value
                            });
                        }
                    }
                });
                if (sublist) {
                    log.debug(logTitle, 'Removing sublist ' + sublistId);
                    sublist.displayType = NS_ServerWidget.SublistDisplayType.HIDDEN;
                }
            }
        }
    };
    purchaseOrderValidation.initVendorDetails = function (option) {
        let logTitle = [LogTitle, 'initVendorDetails'].join('::'),
            scriptContext = option.scriptContext || option,
            newRecord = scriptContext.newRecord;
        log.debug(logTitle, 'Setting vendor details...');
        let vendorDetailValuesStr = newRecord.getValue(VCSP_Global.Fields.Transaction.VENDOR_DETAILS),
            vendorDetailValues = vendorDetailValuesStr ? CTC_Util.safeParse(vendorDetailValuesStr) : {},
            actualVendorDetailValues = null;
        for (let i = 0, len = newRecord.getLineCount('item'); i < len; i += 1) {
            let orderLine = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'orderline',
                line: i
            });
            actualVendorDetailValues = vendorDetailValues[orderLine];
            if (actualVendorDetailValues) {
                newRecord.setValue({
                    fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS,
                    value: JSON.stringify(actualVendorDetailValues)
                });
                break;
            }
        }
        if (!actualVendorDetailValues) {
            log.debug(logTitle, 'No vendor details found...');
        }
    };

    EventRouter.Action['purchaseorder'] = {
        onBeforeLoad: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                let mainConfig,
                    vendorCfg,
                    popupWindowParams = {};

                switch (Current.eventType) {
                    case scriptContext.UserEventType.VIEW:
                        let recordData = {};
                        if (scriptContext.newRecord) {
                            recordData.type = scriptContext.newRecord.type;
                            recordData.id = scriptContext.newRecord.id;
                            popupWindowParams.poid = recordData.id;
                        }
                        log.audit(logTitle, '>> Record Data: ' + JSON.stringify(recordData));

                        let lookupData = CTC_Util.flatLookup({
                            type: recordData.type,
                            id: recordData.id,
                            columns: [
                                'subsidiary',
                                'entity',
                                VCSP_Global.Fields.Transaction.IS_PO_SENT,
                                VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP
                            ]
                        });
                        log.audit(logTitle, '>> lookupData: ' + JSON.stringify(lookupData));

                        ////////////////
                        var cacheTaskID = CTC_Util.getNSCache({
                                key: 'sendpo-taskid:' + Current.recordId
                            }),
                            cacheResponse = CTC_Util.getNSCache({
                                key: 'sendpo-response:' + Current.recordId,
                                isJSON: true
                            }),
                            isSendPOEnabled = !lookupData[VCSP_Global.Fields.Transaction.IS_PO_SENT];

                        log.audit(logTitle, '// cache task id: ' + JSON.stringify([cacheTaskID, cacheResponse]));

                        if (cacheTaskID) {
                            var sendPOTask = NS_Task.checkStatus({ taskId: cacheTaskID });
                            var sendPOMsg = {
                                title: 'Please wait...',
                                message: 'Sending PO in progress.',
                                type: NS_Msg.Type.WARNING
                            };
                            log.audit(logTitle, '// cache task status: ' + JSON.stringify(sendPOTask));

                            if (CTC_Util.inArray(sendPOTask.status, ['PENDING', 'PROCESSING'])) {
                                isSendPOEnabled = false;

                                var redirToURL =
                                    '/app/common/scripting/scriptstatus.nl?daterange=TODAY&sortcol=dcreated&sortdir=DESC&rnd=' +
                                    new Date().getTime();

                                sendPOMsg.message +=
                                    '&nbsp;' +
                                    ('[' + sendPOTask.status + '] &nbsp; ') +
                                    '<br/><br/><p><a href="javascript:(function(){location.reload(1);})()"> Refresh</a> | ' +
                                    ('<a href="' + redirToURL + '" target="_blank">Check script status</a></p>');
                            } else if (CTC_Util.inArray(sendPOTask.status, ['FAILED'])) {
                                sendPOMsg.type = NS_Msg.Type.ERROR;
                                sendPOMsg.title = 'Send PO Error';
                                sendPOMsg.message = JSON.stringify(cacheResponse);

                                CTC_Util.removeCache({
                                    key: 'sendpo-response:' + Current.recordId
                                });
                                CTC_Util.removeCache({ key: 'sendpo-taskid:' + Current.recordId });
                            } else if (CTC_Util.inArray(sendPOTask.status, ['COMPLETE'])) {
                                if (!cacheResponse || cacheResponse.isError) {
                                    sendPOMsg.type = NS_Msg.Type.ERROR;
                                    sendPOMsg.title = 'Send PO Error';

                                    sendPOMsg.message = cacheResponse
                                        ? cacheResponse.error ||
                                          cacheResponse.errorMessage ||
                                          cacheResponse.errorMsg ||
                                          cacheResponse.message ||
                                          'Unexpected error occurred'
                                        : 'Unexpected error occurred';

                                    sendPOMsg.message +=
                                        '<br/><br/> See the details at the bottom on the VAR Connect Tab &gt;&gt; VAR Connect Logs.';

                                    // remove the logs
                                } else {
                                    sendPOMsg.type = NS_Msg.Type.CONFIRMATION;
                                    sendPOMsg.message = JSON.stringify(cacheResponse);
                                }

                                CTC_Util.removeCache({
                                    key: 'sendpo-response:' + Current.recordId
                                });
                                CTC_Util.removeCache({ key: 'sendpo-taskid:' + Current.recordId });

                                //     // delete the cache
                            }

                            scriptContext.form.addPageInitMessage(sendPOMsg);
                        }

                        ////////////////
                        /////////////////////////////////

                        // check for main config
                        mainConfig = libMainConfig.getMainConfiguration();
                        log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                        if (mainConfig) {
                            vendorCfg = libVendorConfig.getVendorConfiguration({
                                vendor: lookupData.entity.value,
                                subsidiary: lookupData.subsidiary.value
                            });
                            // CTC_Util.log('AUDIT', logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
                            if (vendorCfg) {
                                popupWindowParams.scriptContext = scriptContext;
                                popupWindowParams.vendorConfig = vendorCfg;

                                if (vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.MANUAL) {
                                    scriptContext.form.addButton({
                                        id: 'custpage_ctc_vcsp_sendpo',
                                        label: 'Send PO to Vendor',
                                        functionName:
                                            '(function(url){window.location.href=url;})("' +
                                            EventRouter.addActionURL('schedSendPO') +
                                            '")'
                                    }).isDisabled = !isSendPOEnabled;
                                } else {
                                    if (lookupData[VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP]) {
                                        scriptContext.form.addButton({
                                            id: 'custpage_ctc_vcsp_sendpo',
                                            label: 'Manually Send PO to Vendor',
                                            functionName:
                                                '(function(url){window.location.href=url;})("' +
                                                EventRouter.addActionURL('schedSendPO') +
                                                '")'
                                        }).isDisabled = !isSendPOEnabled;
                                    }
                                }
                                Helper.displayAsInlineTextarea(scriptContext.form, [
                                    VCSP_Global.Fields.Transaction.VENDOR_RECEIPT,
                                    VCSP_Global.Fields.Transaction.VENDOR_DETAILS
                                ]);
                                purchaseOrderValidation.replacePOLineSublist({
                                    vendorConfig: vendorCfg,
                                    scriptContext: scriptContext,
                                    eventType: Current.eventType,
                                    poid: scriptContext.newRecord.id
                                });
                            }
                        }
                        break;
                    case scriptContext.UserEventType.CREATE:
                        purchaseOrderValidation.initVendorDetails(scriptContext);
                    case scriptContext.UserEventType.COPY:
                        let fieldIdsToBlankOut = [
                            VCSP_Global.Fields.Transaction.VENDOR_PO_NUMBER,
                            VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP,
                            VCSP_Global.Fields.Transaction.VENDOR_RECEIPT
                        ];
                        fieldIdsToBlankOut.forEach(function (fieldId) {
                            log.debug(logTitle, 'Emptying ' + fieldId + '...');
                            scriptContext.newRecord.setValue({
                                fieldId: fieldId,
                                value: '',
                                ignoreFieldChange: true
                            });
                            return true;
                        });
                        scriptContext.newRecord.setValue({
                            fieldId: VCSP_Global.Fields.Transaction.IS_PO_SENT,
                            value: false,
                            ignoreFieldChange: true
                        });
                    case scriptContext.UserEventType.EDIT:
                        // check for main config
                        mainConfig = libMainConfig.getMainConfiguration();
                        log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                        if (mainConfig) {
                            let vendorConfigParams = {
                                vendor: scriptContext.newRecord.getValue('entity'),
                                subsidiary: scriptContext.newRecord.getValue('subsidiary')
                            };
                            if (vendorConfigParams.vendor && vendorConfigParams.subsidiary) {
                                vendorCfg = libVendorConfig.getVendorConfiguration(vendorConfigParams);
                            }
                            purchaseOrderValidation.setMemoAndHelper({
                                vendorConfig: vendorCfg,
                                scriptContext: scriptContext
                            });
                            log.audit(logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
                            // popupWindowParams.scriptContext = scriptContext;
                            if (vendorCfg) {
                                // popupWindowParams.vendorConfig = vendorCfg;
                                purchaseOrderValidation.limitPOLineColumns({
                                    vendorConfig: vendorCfg,
                                    scriptContext: scriptContext,
                                    eventType: Current.eventType
                                });
                            }
                        }
                        break;
                    default:
                        break;
                }
                purchaseOrderValidation.addPopupButton(popupWindowParams);
            } catch (error) {
                log.error(logTitle, error);
                return;
            }
        },
        onAfterSubmit: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'onAfterSubmit'].join('::');
            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                let recordData = {};
                if (scriptContext.newRecord) {
                    recordData.type = scriptContext.newRecord.type;
                    recordData.id = scriptContext.newRecord.id;
                }
                log.audit(logTitle, '>> Record Data: ' + JSON.stringify(recordData));

                if (Current.eventType == scriptContext.UserEventType.DELETE) return;
                let createdFromRecTypeCol = {
                    name: 'recordtype',
                    join: 'createdFrom'
                };
                let searchResults = CTC_Util.searchAllPaged({
                    type: NS_Search.Type.TRANSACTION,
                    filterExpression: [
                        ['recordtype', NS_Search.Operator.IS, NS_Search.Type.PURCHASE_ORDER],
                        'AND',
                        ['internalid', NS_Search.Operator.ANYOF, recordData.id]
                    ],
                    columns: [
                        createdFromRecTypeCol,
                        'approvalstatus',
                        'subsidiary',
                        'entity',
                        VCSP_Global.Fields.Transaction.IS_PO_SENT,
                        VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP
                    ]
                });
                let lookupData = searchResults[0];
                log.audit(logTitle, '>> lookupData: ' + JSON.stringify(lookupData));

                // check for main config
                let mainConfig = libMainConfig.getMainConfiguration();
                log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                if (!mainConfig) return;

                let vendorCfg = libVendorConfig.getVendorConfiguration({
                    vendor: lookupData.getValue('entity'),
                    subsidiary: lookupData.getValue('subsidiary')
                });
                log.audit(logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
                if (!vendorCfg) return;

                let isPendingSendOnCreate = vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.ON_CREATE,
                    isPendingSendOnApprove = vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.ON_APPROVE;
                if (isPendingSendOnCreate) {
                    let createEventTypes = [scriptContext.UserEventType.CREATE, scriptContext.UserEventType.COPY];
                    isPendingSendOnCreate = createEventTypes.indexOf(Current.eventType) >= 0;
                }
                if (isPendingSendOnCreate || isPendingSendOnApprove) {
                    let isToBeSent = !lookupData.getValue(VCSP_Global.Fields.Transaction.IS_PO_SENT);
                    let isCreatedFromSalesOrder =
                        lookupData.getValue(createdFromRecTypeCol) == NS_Record.Type.SALES_ORDER;
                    let isApproved = lookupData.getValue('approvalstatus') >= 2;
                    log.debug(
                        logTitle,
                        JSON.stringify({
                            isToBeSent: isToBeSent,
                            isPendingSendOnCreate: isPendingSendOnCreate,
                            isCreatedFromSalesOrder: isCreatedFromSalesOrder,
                            isApproved: isApproved
                        })
                    );
                    if (
                        isToBeSent &&
                        isCreatedFromSalesOrder &&
                        (isPendingSendOnCreate || (isPendingSendOnApprove && isApproved))
                    ) {
                        NS_Redirect.toRecord({
                            type: Current.recordType,
                            id: Current.recordId,
                            parameters: {
                                routeract: 'sendPO'
                            }
                        });
                    }
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify({ name: error.name, message: error.message }));
                return;
            }
        }
    };

    let salesOrderValidation = {};
    salesOrderValidation.addPopupSublistButton = function (option) {
        let logTitle = [LogTitle, 'addPopupSublistButton'].join('::'),
            scriptContext = option.scriptContext;
        if (scriptContext && scriptContext.form) {
            let vendorDetailsPopupUrl = NS_Url.resolveScript({
                deploymentId: VCSP_Global.Scripts.Deployment.VENDOR_DETAILS_SL,
                scriptId: VCSP_Global.Scripts.Script.VENDOR_DETAILS_SL,
                params: {
                    prompt: 'Choose line and vendor',
                    title: 'Additional Vendor Details'
                },
                returnExternalUrl: false
            });
            log.audit(logTitle, 'Additional vendor details pop-up prompt url : ' + vendorDetailsPopupUrl);
            scriptContext.form.getSublist({ id: 'item' }).addButton({
                id: 'custpage_ctc_vcsp_setvenddetl',
                label: 'Add VC Vendor Details',
                functionName:
                    `(function(url) {
                        let subsidiaryId = nlapiGetFieldValue('subsidiary');
                        if (subsidiaryId) {
                            let lines = [];
                            for (let i = 1, len = nlapiGetLineItemCount('item'); i <= len; i += 1) {
                                lines.push(nlapiGetLineItemText('item', 'item', i));
                            }
                            url = url + '&subsidiaryId=' + subsidiaryId;
                            url = url + '&lines=' + encodeURIComponent(JSON.stringify(lines));
                            window.open(url, 'vcspctcsendpopopup', 'popup=yes,width=1000,height=750,resizable=yes,scrollbar=yes');
                        } else {
                            window.alert('Please choose a customer');
                        }
                    })("` +
                    vendorDetailsPopupUrl +
                    `")`
            });
        }
    };

    EventRouter.Action['salesorder'] = {
        onBeforeLoad: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'onBeforeLoad'].join('::');
            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                let popupWindowParams = {};
                switch (Current.eventType) {
                    case scriptContext.UserEventType.CREATE:
                    case scriptContext.UserEventType.EDIT:
                        // check for main config
                        let mainConfig = libMainConfig.getMainConfiguration();
                        log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                        if (mainConfig) {
                            popupWindowParams.scriptContext = scriptContext;
                        }
                        break;
                    default:
                        break;
                }
                salesOrderValidation.addPopupSublistButton(popupWindowParams);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify({ name: error.name, message: error.message }));
                return;
            }
        }
    };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {
        schedSendPO: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'action.schedSendPO'].join('::');
            let sessObj = NS_Runtime.getCurrentSession();
            let response;

            // SEND TO SS SEND PO
            var taskOption = {
                isSchedScript: true,
                scriptId: 'customscript_ctc_vcsp_ss_sendpo',
                scriptParams: {
                    custscript_ctc_vcsp_sendpo_poid: Current.recordId
                }
            };
            log.audit(logTitle, '// task deploy: ' + JSON.stringify(taskOption));

            var taskIdStr = Helper.forceDeploy(taskOption);
            CTC_Util.setNSCache({ key: 'sendpo-taskid:' + Current.recordId, value: taskIdStr });

            // redirect
            NS_Redir.toRecord({
                type: Current.recordType,
                id: Current.recordId
            });
        },
        sendPO: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'action.sendPO'].join('::');
            let sessObj = NS_Runtime.getCurrentSession();
            let response;

            try {
                response = libMain.sendPO({ purchaseOrderId: Current.recordId });
                log.audit(logTitle, response);

                // add the session
                if (response.isError) {
                    let errorMsg = response.error ? response.error.message : response.errorMsg;
                    log.error(
                        logTitle,
                        '## ERROR ## ' +
                            JSON.stringify({
                                name: response.error
                                    ? response.error.type
                                    : response.errorName || 'UNEXPECTED_VC_ERROR',
                                message: [
                                    '(id=',
                                    response.error ? response.error.id : response.errorId || Current.recordId,
                                    ') ',
                                    errorMsg
                                ].join('')
                            })
                    );
                    sessObj.set({
                        name: 'sendpo-error',
                        value: errorMsg ? errorMsg.replace('\n', '<br />') : 'Unexpected error.'
                    });
                } else {
                    sessObj.set({
                        name: 'sendpo-success',
                        value: 'PO has been successfully sent to the vendor.'
                    });
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify({ name: error.name, message: error.message }));

                sessObj.set({
                    name: 'sendpo-error',
                    value: CTC_Util.extractError(error).replace('\n', '<br />')
                });
            }

            return true;
        }
    };
    EventRouter.Action[VCSP_Global.Records.VENDOR_CONFIG] = {
        onBeforeLoad: function (scriptContext, Current) {
            let logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;
                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    VCSP_Global.Fields.VendorConfig.FIELD_MAP,
                    VCSP_Global.Fields.VendorConfig.ADDITIONAL_PO_FIELDS,
                    VCSP_Global.Fields.VendorConfig.PO_LINE_COLUMNS
                ]);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify({ name: error.name, message: error.message }));
                return;
            }
        }
    };

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            LogTitle = [LogTitle, scriptContext.type, scriptContext.newRecord.type, scriptContext.newRecord.id].join(
                '::'
            );
            let logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;
            EventRouter.initialize(scriptContext);
            log.audit(logTitle, EventRouter.Type);
            try {
                // check for valid license
                if (!libLicenseValidator.isLicenseValid()) {
                    log.audit(logTitle, 'Inactive license key.');
                    return;
                }
                EventRouter.execute(EventRouter.Type.CUSTOM);
                EventRouter.execute(EventRouter.Type.BEFORE_LOAD);
            } catch (beforeLoadError) {
                log.error(
                    logTitle,
                    '## ERROR ## ' +
                        JSON.stringify({
                            name: beforeLoadError.name,
                            message: beforeLoadError.message
                        })
                );
                returnValue = false;
                throw beforeLoadError;
            }
            return returnValue;
        },
        // beforeSubmit: function (scriptContext) {
        //     LogTitle = [
        //         LogTitle,
        //         scriptContext.type,
        //         scriptContext.newRecord.type,
        //         scriptContext.newRecord.id
        //     ].join('::');
        //     let logTitle = [LogTitle || '', 'onBeforeSubmit'].join('::'),
        //         returnValue = null;
        //     EventRouter.initialize(scriptContext);
        //     try {
        //         // check for valid license
        //         if (!libLicenseValidator.isLicenseValid()) {
        //             log.audit(logTitle, 'Inactive license key.');
        //             return;
        //         }
        //         returnValue = EventRouter.execute(EventRouter.Type.BEFORE_SUBMIT);
        //     } catch (beforeSubmitError) {
        //         log.error(logTitle, '## ERROR ## ' + JSON.stringify({name: beforeSubmitError.name, message: beforeSubmitError.message}));
        //         returnValue = false;
        //         throw beforeSubmitError;
        //     }
        //     return returnValue;
        // },
        afterSubmit: function (scriptContext) {
            LogTitle = [LogTitle, scriptContext.type, scriptContext.newRecord.type, scriptContext.newRecord.id].join(
                '::'
            );
            let logTitle = [LogTitle || '', 'onAfterSubmit'].join('::'),
                returnValue = null;
            EventRouter.initialize(scriptContext);
            try {
                // check for valid license
                if (!libLicenseValidator.isLicenseValid()) {
                    log.audit(logTitle, 'Inactive license key.');
                    return;
                }
                returnValue = EventRouter.execute(EventRouter.Type.AFTER_SUBMIT);
            } catch (afterSubmitError) {
                log.error(
                    logTitle,
                    '## ERROR ## ' +
                        JSON.stringify({
                            name: afterSubmitError.name,
                            message: afterSubmitError.message
                        })
                );
                returnValue = false;
                throw afterSubmitError;
            }
            return returnValue;
        }
    };

    return USER_EVENT;
});
