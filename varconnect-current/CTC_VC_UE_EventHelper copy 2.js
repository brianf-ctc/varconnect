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
 */
define([
    'N/runtime',
    'N/record',
    'N/task',
    'N/redirect',
    'N/search',
    'N/url',
    // './CTC_VC2_Lib_EventRouter',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants'
    // './Services/ctc_svclib_configlib'
], function (
    ns_runtime,
    ns_record,
    ns_task,
    ns_redirect,
    ns_search,
    ns_url,
    // EventRouter,
    vc2_util,
    vc2_constant
    // vcs_configLib
) {
    var LogTitle = 'VC:BILLFILE';

    var Helper = {
        hideFields: function (form, arrFields) {
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            vc2_util.log('displayAsInlineTextarea', arrFields);

            arrFields.forEach(function (fieldId) {
                var fldObj = form.getField({ id: fieldId });
                fldObj.updateDisplayType({ displayType: 'hidden' });
            });
        },
        displayAsInlineTextarea: function (form, arrFields) {
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            // vc2_util.log('displayAsInlineTextarea', arrFields);

            arrFields.forEach(function (fieldId) {
                vc2_util.log('displayAsInlineTextarea', fieldId);
                if (!fieldId) return true;

                try {
                    var fldOrig = form.getField({ id: fieldId });
                    if (!fldOrig || !fldOrig.defaultValue || fldOrig.defaultValue.length < 200)
                        return true;

                    var fldNew = form.addField({
                        id: ['custpage', fieldId].join('_'),
                        label: fldOrig.label,
                        type: 'inlinehtml'
                    });

                    vc2_util.log('displayAsInlineTextarea', fldOrig);
                    vc2_util.log('displayAsInlineTextarea', fldNew);

                    var strValue = fldOrig.defaultValue;

                    //test for JSON
                    try {
                        var jsonObj = JSON.parse(strValue);
                        strValue = JSON.stringify(jsonObj, null, '    ');
                    } catch (err) {
                        vc2_util.log('json log test', vc2_util.extractError(err));
                    }

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
                    fldOrig.updateDisplayType({ displayType: 'hidden' });
                } catch (errfld) {
                    vc2_util.log('displayAsInlineTextarea', errfld);
                }
                return true;
            }); // end: arrFields.forEach
        },
        loadBillItemsSublist: function (form) {
            var logTitle = 'loadBillItemsSublist';

            var vclinesTab = 'custpage_vclines';

            form.addTab({
                id: vclinesTab,
                label: 'VC Lines'
                // tab: vcTab
            });

            // add a new field
            var sublistName = 'vcbillfile';
            var arrSublists = [],
                arrColNames = {
                    lineno: '#',
                    item: 'Item',
                    quantity: 'Qty',
                    rate: 'Price',
                    amount: 'Amount',
                    ship_date: 'Shipped Date',
                    eta_date: 'ETA Date',
                    order_date: 'Order Date'
                },
                arrValues = [
                    {
                        lineno: 1,
                        item: '10000 Sample Item',
                        quantity: 3,
                        rate: 150,
                        amount: 450,
                        ship_date: '04/05/2024',
                        eta_date: '04/05/2024',
                        order_date: '04/01/2024'
                    }
                ],
                arrButtons = {
                    refresh: 'Refresh Data',
                    fulfill: 'Create Fulfillment',
                    fetchbill: 'Fetch Bills',
                    billcreate: 'Create Bill'
                };

            for (var i = 0, j = 5; i < j; i++) {
                var sublist = form.addSublist({
                    id: 'custpage_' + sublistName + '_' + (i + 1),
                    label: 'Bill File #' + (i + 1),
                    type: 'EDITOR',
                    tab: vclinesTab
                });

                for (var btn in arrButtons) {
                    sublist.addButton({
                        id: 'custpage_' + btn + i,
                        label: arrButtons[btn],
                        functionName: '(function (){})()'
                    });
                }

                for (var colfield in arrColNames) {
                    // vc2_util.log(logTitle, 'add column:', colfield);
                    // add the columns
                    sublist.addField({
                        id: 'custpage_' + colfield,
                        label: arrColNames[colfield],
                        type: 'TEXT'
                    });
                }

                //add the datat
                for (var ii = 0, jj = 5; ii < jj; ii++) {
                    for (var colfield in arrColNames) {
                        // vc2_util.log(logTitle, 'add values:', [colfield, arrValues[0][colfield]]);

                        // add the columns
                        sublist.setSublistValue({
                            id: 'custpage_' + colfield,
                            line: ii,
                            value: arrValues[0][colfield]
                        });
                    }
                }
            }
        },
        jsFieldCount: 0,
        addJSField: function (option) {
            var form = option.form,
                tabId = option.tabId || Helper.getVCTab(form);

            var fldVCBar = form.addField({
                id: ['custpage_vcbar_', ++Helper.jsFieldCount].join(''),
                label: 'VC Bar',
                type: 'inlinehtml',
                container: tabId
            });
            fldVCBar.defaultValue = option.jsContent;
        },
        VCBarId: false,
        addVCBar: function (option) {
            var form = option.form,
                tabId = option.tabId || Helper.getVCTab(form);

            if (Helper.VCBarId) return;
            Helper.VCBarId = 'vcBar_' + new Date().getTime();
            var vcBarCSS = 'margin: 0 0 10px 0;',
                vcBarClass = '';

            var vcBarJS = [
                '<script type="text/javascript">',
                'jQuery(document).ready(function () {',
                'var jq=jQuery;',
                'var vcBarEl = jq("<div>", ' +
                    ('{id:"' + Helper.VCBarId + '",') +
                    ('style:"' + vcBarCSS + '",') +
                    ('class:"' + vcBarClass + '"});'),
                // add the vcBarMenu
                'jq("<div>", {id:"vcBarMenu", style:"margin: 0;padding: 10px; background-color: #f5f5f5;"})',
                '.appendTo(vcBarEl);',
                // add the vcBarLinks
                'jq("<div>", {id:"vcBarLinks", style:"margin: 0;padding: 10px; background-color: #f5f5f5;"})',
                '.appendTo(vcBarEl);',
                // add the vcBarNotes
                'jq("<div>", {id:"vcBarNote"}).appendTo(vcBarEl);',
                // ('vcBarEl.append("' + option.message + '");') +
                'jq("#' + tabId + '_form table:eq(1)").before(vcBarEl);',

                'jq("#vcBarMenu").hide();',
                'jq("#vcBarLinks").hide();',
                '});',
                '</script>'
            ];

            Helper.addJSField(
                util.extend(option, {
                    jsContent: vcBarJS.join('')
                })
            );

            return true;
        },
        setVCBarNote: function (option) {
            var form = option.form,
                tabId = option.tabId || Helper.getVCTab(form);

            Helper.addVCBar(option);

            var note = option.note || option.message || option.error,
                isError = !!option.error;

            var vcBarCSS = 'padding: 8px;',
                vcBarClass = 'uir-list-header-td listheader',
                vcNoteCSS = 'font-size: 12px;';

            if (isError) {
                vcBarCSS += 'background: #FCCFCF none !important;';
                vcNoteCSS += 'color:#F00;';
                note = '<b> ERROR :</b> ' + note;
            }

            var vcBarNoteJS = [
                '<script type="text/javascript">',
                'jQuery(document).ready(function () {',
                'var jq=jQuery;',
                'var vcBarEl = ' +
                    ('jq("#' + Helper.VCBarId + ' #vcBarNote").attr({') +
                    ('style:"' + vcBarCSS + '",') +
                    (' class: "' + vcBarClass + '"});'),
                'jq("<span>").attr(' +
                    ('{style:"' + vcNoteCSS + '"})') +
                    ('.html("' + note + '").appendTo(vcBarEl);'),
                '});',
                '</script>'
            ];

            Helper.addJSField(
                util.extend(option, {
                    jsContent: vcBarNoteJS.join('')
                })
            );
        },
        addVCButton: function (option) {
            var form = option.form,
                tabId = option.tabId || Helper.getVCTab(form);

            Helper.addVCBar(option);

            var VCBtnCSS =
                    'border: .8px solid #999; padding: 5px 15px;text-decoration:none;background-color:#E5E5E5;margin:0 15px 0 0;border-radius:4px;',
                VCBtnClass = '';

            var VCButtonJS = [
                '<script type="text/javascript">',
                'jQuery(document).ready(function () {',
                'var jq=jQuery;',
                'var btnElm = jq("<a>", ' +
                    ('{class:"' + VCBtnClass + '",') +
                    ('style: "' + VCBtnCSS + '",') +
                    ('href: "' + option.action + '", target: "_blank"})') +
                    '.hover( function () {jq(this).css({ backgroundColor: "#C5C5C5" });}, function () {jq(this).css({ backgroundColor: "#E5E5E5" });} ) ' +
                    ('.html("' + option.label.toUpperCase() + '");'),
                'var spanEl = jq("<span>", {style:"font-size: 12px;"}).append(btnElm);',
                'jq("#' + Helper.VCBarId + ' #vcBarMenu").append(spanEl);',
                'jq("#vcBarMenu").show();',
                '});',
                '</script>'
            ];

            Helper.addJSField(
                util.extend(option, {
                    jsContent: VCButtonJS.join('')
                })
            );
        },
        addVCBarLink: function (option) {
            var form = option.form,
                tabId = option.tabId || Helper.getVCTab(form);

            Helper.addVCBar(option);

            var VCBtnCSS = 'padding: 0 10px;text-decoration:underline;',
                VCBtnClass = '';

            var VCButtonJS = [
                '<script type="text/javascript">',
                'jQuery(document).ready(function () {',
                'var jq=jQuery;',
                'var btnElm = jq("<a>", ' +
                    ('{class:"' + VCBtnClass + '",') +
                    ('style: "' + VCBtnCSS + '",') +
                    ('href: "' + option.action + '", target: "_blank"})') +
                    ('.html("' + option.label.toUpperCase() + '");'),
                'var spanEl = jq("<span>", {style:"font-size: 11px;"}).append(btnElm);',
                'jq("#' + Helper.VCBarId + ' #vcBarLinks").append(spanEl);',
                'jq("#vcBarLinks").show();',
                // 'jq("#vcBarMenu").show();',
                '});',
                '</script>'
            ];

            Helper.addJSField(
                util.extend(option, {
                    jsContent: VCButtonJS.join('')
                })
            );
        },
        getVCTab: function (form) {
            var allTabs = form.getTabs();
            if (!allTabs || !allTabs.length) return;

            var vcTab = null;

            allTabs.forEach(function (tabId) {
                var formTab = form.getTab({ id: tabId });
                if (formTab && formTab.label == 'VAR Connect') {
                    vcTab = tabId;
                    return true;
                }
            });

            return vcTab;
        },
        addSerialSync: function (form) {
            Helper.addVCButton({
                form: form,
                id: 'btn_linkserials',
                label: 'Link SerialNumbers',
                action: EventRouter.addActionURL('actionLinkSerials')
            });
            return true;
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
        redirToMRPage: function () {
            vc2_util.waitMs(2000);
            ns_redirect.redirect({
                url: '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&sortcol=dateCreated&sortdir=DESC&scripttype=&primarykey=' //&scripttype=customscript_ctc_vc_process_bills'
            });
        }
    };

    EventRouter.Action[vc2_constant.RECORD.BILLFILE.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vc_bill_src',
                    'custrecord_ctc_vc_bill_json'
                ]);

                var flexScreenUrl =
                    '/app/site/hosting/scriptlet.nl?script=customscript_ctc_vc_bill_flex_screen&deploy=1&record_id=' +
                    Current.recordId;

                // add button to the flex screen
                scriptContext.form.addButton({
                    id: 'custpage_flexscreen',
                    label: 'Open Flex Screen',
                    functionName:
                        '(function(url){return window.open(url, "_blank");})("' +
                        flexScreenUrl +
                        '")'
                });
                // add button to the flex screen
                // scriptContext.form.addButton({
                //     id: 'custpage_reloadpo',
                //     label: 'Reload PO/Items',
                //     functionName:
                //         '(function(url){window.location.href=url;})("' +
                //         EventRouter.addActionURL('reloadBillFile') +
                //         '")'
                // });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.BILLCREATE_CONFIG.ID] = [
        {
            onBeforeLoad: function (scriptContext, Current) {
                var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

                try {
                    vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));
                    if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                    Helper.hideFields(scriptContext.form, ['custrecord_vc_bc_maincfg']);

                    if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                    Helper.displayAsInlineTextarea(scriptContext.form, [
                        'custrecord_vc_bc_host_key'
                    ]);
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                    return;
                }
            }
        },
        {
            onAfterSubmit: function (scriptContext, Current) {
                var logTitle = [LogTitle, 'onAfterSubmit'].join('::');
                try {
                    vc2_util.log(logTitle, '>> Current: ', Current);

                    if (
                        !vc2_util.inArray(Current.eventType, [
                            scriptContext.UserEventType.EDIT,
                            scriptContext.UserEventType.XEDIT
                        ])
                    )
                        return;

                    vcs_configLib.sendConfig({
                        id: Current.recordId,
                        configType: vcs_configLib.ConfigType.BILL
                    });
                    vcs_configLib.removeConfigCache({ configType: vcs_configLib.ConfigType.BILL });

                    // load the config
                    vcs_configLib.loadConfig({
                        id: Current.recordId,
                        configType: vcs_configLib.ConfigType.BILL
                    });
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                    return;
                }
            }
        }
    ];

    EventRouter.Action[ns_record.Type.VENDOR] = {
        onAfterSubmit: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onAfterSubmit'].join('::');
            try {
                vc2_util.log(logTitle, '>> Current: ', Current);

                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ])
                )
                    return;

                vcs_configLib.removeConfigCache({ configType: vcs_configLib.ConfigType.BILL });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };


    EventRouter.Action[vc2_constant.RECORD.SENDPOVENDOR_CONFIG.ID] = [
        {
            onAfterSubmit: function (scriptContext, Current) {
                var logTitle = [LogTitle, 'onAfterSubmit'].join('::');

                try {
                    if (
                        !vc2_util.inArray(Current.eventType, [
                            scriptContext.UserEventType.EDIT,
                            scriptContext.UserEventType.CREATE,
                            scriptContext.UserEventType.XEDIT
                        ])
                    )
                        return;

                    vcs_configLib.sendConfig({
                        id: Current.recordId,
                        configType: vcs_configLib.ConfigType.SENDPO
                    });
                    vcs_configLib.removeConfigCache({
                        configType: vcs_configLib.ConfigType.SENDPO
                    });
                    vcs_configLib.loadConfig({
                        id: Current.recordId,
                        configType: vcs_configLib.ConfigType.SENDPO
                    });
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                }

                return true;
            }
        }
    ];

    EventRouter.Action[vc2_constant.RECORD.VC_LOG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vcsp_log_body'
                ]);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    

    EventRouter.Action[ns_record.Type.PURCHASE_ORDER] = [
        // --- UPDATE THE VENDOR LINE INFO ---  //
        {
            onBeforeLoad: function (scriptContext, Current) {
                var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

                try {
                    vc2_util.log(logTitle, '// VENDOR LINE START');

                    if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                    if (
                        !vc2_util.inArray(Current.eventType, [
                            scriptContext.UserEventType.VIEW,
                            scriptContext.UserEventType.EDIT
                        ])
                    )
                        return;

                    var currentRecord = scriptContext.newRecord,
                        Form = scriptContext.form;

                    var lineCount = currentRecord.getLineCount({
                            sublistId: 'item'
                        }),
                        hasVendorInfo = false;

                    var fldVendorScr = Form.addField({
                            id: 'custpage_ctc_povendor_scr',
                            label: 'Clear Vendor Info',
                            type: 'inlinehtml'
                        }),
                        sublistItem = scriptContext.form.getSublist({
                            id: 'item'
                        });

                    var scriptVendorInfo = [
                        '<script type="text/javascript">',
                        'jQuery(document).ready(function () {',
                        'var jq=jQuery;',
                        'var fnVENDLINE=function(ln){',
                        'var tr=jq.find("table#item_splits tr")[ln], ',
                        'td=jq(tr).find("td[data-ns-tooltip=\'VENDOR LINE INFO\']")[0],',
                        'sp=jq(td).find("span")[0];',
                        'jq(sp).text("Details");',
                        'jq(td).empty().append(sp);',
                        '};'
                    ];

                    for (var line = 0; line < lineCount; line++) {
                        var vendorInfoJSON = currentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ctc_vc_vendor_info',
                            line: line
                        });
                        if (!vendorInfoJSON) continue;
                        hasVendorInfo = true;
                        scriptVendorInfo.push(
                            'try{ fnVENDLINE("' + (line + 1) + '"); } catch(e){console.log(e);}'
                        );
                    }
                    scriptVendorInfo.push('});</script>');
                    fldVendorScr.defaultValue = scriptVendorInfo.join('');

                    try {
                        if (!hasVendorInfo || Current.eventType == scriptContext.UserEventType.EDIT)
                            sublistItem
                                .getField({ id: 'custcol_ctc_vc_vendor_info' })
                                .updateDisplayType({ displayType: 'HIDDEN' });
                    } catch (eer) {
                        vc2_util.logError(logTitle, eer);
                    }
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                } finally {
                    vc2_util.log(logTitle, '// VENDOR LINE END');
                    return true;
                }
            }
        },

        // --- ADD THE VC ACTION BUTTONS --- //
        {
            onBeforeLoad: function (scriptContext, Current) {
                var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

                try {
                    vc2_util.log(logTitle, '// VC BUTTONS: START');

                    if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                    if (
                        !vc2_util.inArray(Current.eventType, [
                            scriptContext.UserEventType.VIEW,
                            scriptContext.UserEventType.EDIT
                        ])
                    )
                        return;

                    var Form = scriptContext.form;

                    MainCFG = vcs_configLib.mainConfig();
                    if (!MainCFG) return;

                    if (!MainCFG.overridePONum) {
                        Helper.hideFields(Form, ['custbody_ctc_vc_override_ponum']);
                    }

                    var license = vcs_configLib.validateLicense();
                    if (license.hasError)
                        Helper.setVCBarNote({
                            form: scriptContext.form,
                            error: 'Your License is no longer valid or have expired. '
                        });

                    OrderCFG = vcs_configLib.orderVendorConfig({ poId: Current.recordId });
                    if (OrderCFG) {
                        Helper.addVCButton({
                            form: scriptContext.form,
                            id: 'btn_orderstatus',
                            label: ' Process Order Status',
                            action: EventRouter.addActionURL('actionOrderStatus')
                        });

                        var orderCFGUrl = ns_url.resolveRecord({
                            recordType: vc2_constant.RECORD.VENDOR_CONFIG.ID,
                            recordId: OrderCFG.id
                        });
                        Helper.addVCBarLink({
                            form: scriptContext.form,
                            label: 'Order Status Config',
                            action: orderCFGUrl
                        });
                    }

                    BillCFG = vcs_configLib.billVendorConfig({ poId: Current.recordId });
                    // vc2_util.log(logTitle, '// billVendorCfg:  ' + JSON.stringify(BillCFG));

                    var CONNECT_TYPE = { API: 1, SFTP: 2 };

                    if (BillCFG && BillCFG.connectionType == CONNECT_TYPE.API) {
                        Helper.addVCButton({
                            form: scriptContext.form,
                            id: 'btn_billsapi',
                            label: 'Fetch Bill Files - API',
                            action: EventRouter.addActionURL('actionGetBillsAPI')
                        });

                        var billCFGUrl = ns_url.resolveRecord({
                            recordType: vc2_constant.RECORD.BILLCREATE_CONFIG.ID,
                            recordId: BillCFG.id
                        });
                        Helper.addVCBarLink({
                            form: scriptContext.form,
                            label: 'Bill Vendor Config',
                            action: billCFGUrl
                        });
                    }

                    var SendPOCFG = vcs_configLib.sendPOVendorConfig({ poId: Current.recordId });
                    // vc2_util.log(logTitle, '// sendpo vendor:  ' + JSON.stringify(SendPOCFG));

                    if (SendPOCFG) {
                        var sendPOCfgUrl = ns_url.resolveRecord({
                            recordType: vc2_constant.RECORD.SENDPOVENDOR_CONFIG.ID,
                            recordId: SendPOCFG.id
                        });
                        Helper.addVCBarLink({
                            form: scriptContext.form,
                            label: 'Send PO Config',
                            action: sendPOCfgUrl
                        });
                    }

                    if (OrderCFG || BillCFG) Helper.addSerialSync(scriptContext.form);
                } catch (error) {
                    log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                } finally {
                    vc2_util.log(logTitle, '// VC BUTTONS: END');
                    return true;
                }
            }
        }
    ];

    EventRouter.Action[ns_record.Type.INVOICE] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');
            try {
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                if (!vc2_util.inArray(Current.eventType, [scriptContext.UserEventType.VIEW]))
                    return;
                Helper.addSerialSync(scriptContext.form);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }

            return true;
        }
    };

    EventRouter.Action[ns_record.Type.SALES_ORDER] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');
            try {
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                if (!vc2_util.inArray(Current.eventType, [scriptContext.UserEventType.VIEW]))
                    return;
                Helper.addSerialSync(scriptContext.form);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }

            return true;
        }
    };

    EventRouter.Action[ns_record.Type.ITEM_FULFILLMENT] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');
            try {
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                if (!vc2_util.inArray(Current.eventType, [scriptContext.UserEventType.VIEW]))
                    return;
                Helper.addSerialSync(scriptContext.form);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }

            return true;
        }
    };


    var mapRecordNames = {};
    mapRecordNames[ns_record.Type.PURCHASE_ORDER] = 'PO';
    mapRecordNames[ns_record.Type.SALES_ORDER] = 'SO';
    mapRecordNames[ns_record.Type.INVOICE] = 'INV';
    mapRecordNames[ns_record.Type.ITEM_FULFILLMENT] = 'ITEMFF';
    mapRecordNames[vc2_constant.RECORD.VC_LOG.ID] = 'VCLOG';
    mapRecordNames[vc2_constant.RECORD.MAIN_CONFIG.ID] = 'MAINCFG';
    mapRecordNames[vc2_constant.RECORD.VENDOR_CONFIG.ID] = 'VENDORCFG';
    mapRecordNames[vc2_constant.RECORD.BILLCREATE_CONFIG.ID] = 'BILLVCFG';
    mapRecordNames[vc2_constant.RECORD.BILLFILE.ID] = 'BILLFILE';

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;
            log.audit(logTitle, '>> START SCRIPT!! ');

            // EventRouter.initialize(scriptContext);

            // var Current = EventRouter.Current;
            // vc2_util.LogPrefix = [
            //     mapRecordNames[Current.recordType],
            //     Current.recordId || '_new_',
            //     Current.eventType
            // ].join(':');
            // vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            // try {
            //     EventRouter.execute(EventRouter.Type.CUSTOM);
            //     EventRouter.execute(EventRouter.Type.BEFORE_LOAD);
            // } catch (error) {
            //     log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            //     returnValue = false;
            //     throw error;
            // }

            return returnValue;
        },
        beforeSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeSubmit'].join('::'),
                returnValue = null;

            // EventRouter.initialize(scriptContext);

            // var Current = EventRouter.Current;
            // vc2_util.LogPrefix = [
            //     mapRecordNames[Current.recordType],
            //     Current.recordId || '_new_',
            //     Current.eventType
            // ].join(':');
            // vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            // try {
            //     EventRouter.execute(EventRouter.Type.BEFORE_SUBMIT);
            // } catch (error) {
            //     log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            //     returnValue = false;
            //     throw error;
            // }

            // return returnValue;
        },
        afterSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onAfterSubmit'].join('::'),
                returnValue = null;
            log.audit(logTitle, '>> START SCRIPT!! ');

            // EventRouter.initialize(scriptContext);

            // var Current = EventRouter.Current;
            // vc2_util.LogPrefix = [
            //     mapRecordNames[Current.recordType],
            //     Current.recordId || '_new_',
            //     Current.eventType
            // ].join(':');
            // vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            // try {
            //     EventRouter.execute(EventRouter.Type.AFTER_SUBMIT);
            // } catch (error) {
            //     log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            //     returnValue = false;
            //     throw error;
            // }

            // return returnValue;
        }
    };

    return USER_EVENT;
});