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
    './CTC_VC2_Lib_EventRouter',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants',
    './Services/ctc_svclib_configlib'
], function (
    ns_runtime,
    ns_record,
    ns_task,
    ns_redirect,
    EventRouter,
    vc2_util,
    vc2_constant,
    vcs_configLib
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
            var vcBarCSS = '',
                vcBarClass = '';

            var vcBarJS = [
                '<script type="text/javascript">',
                'jQuery(document).ready(function () {',
                'var jq=jQuery;',
                'var vcBarEl = jq("<div>", ' +
                    ('{id:"' + Helper.VCBarId + '",') +
                    ('style:"' + vcBarCSS + '",') +
                    ('class:"' + vcBarClass + '"});'),
                'jq("<div>", {id:"vcBarMenu", style:"margin: 0 0 10px 0;padding: 10px; background-color: #EEE;"})',
                '.appendTo(vcBarEl);',
                'jq("<div>", {id:"vcBarNote"}).appendTo(vcBarEl);',
                // ('vcBarEl.append("' + option.message + '");') +
                'jq("#' + tabId + '_form table:eq(1)").before(vcBarEl);',
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
                    'border-right: .8px solid #999; padding: 0 15px;text-decoration:none;bacnground-color:#CCC;',
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
                'var spanEl = jq("<span>", {style:"font-size: 12px;"}).append(btnElm);',
                'jq("#' + Helper.VCBarId + ' #vcBarMenu").append(spanEl);',
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
        }
        // addToActionMenu: function (form, arrButtons) {
        //     if (!arrButtons || !arrButtons.length) return;
        //     arrButtons = util.isArray(arrButtons) ? arrButtons : [arrButtons];

        //     var JSCode =
        //         'window.NS_Button = function () {' +
        //         'var delay = window.menusAreOpen ? 0 : 100;' +
        //         "window.rolloverDelay = setTimeout(\"showMenu('spn_PRINT_d1', true, 'PRINT', 0, 2);\",delay);" +
        //         "resetNavMenuTimer('PRINT');" +
        //         'setTimeout(\'startTimer("PRINT")\', delay);' +
        //         'return {' +
        //         'addToMenu: function (arrBtnNames) {' +
        //         'var jq = window.jQuery || jQuery;' +
        //         'if (!jq) return;' +
        //         'arrBtnNames = arrBtnNames.constructor == Array ? arrBtnNames : [arrBtnNames];' +
        //         'console.log(arrBtnNames, jq);' +
        //         'for (var i = 0, j = arrBtnNames.length; i < j; i += 1) {' +
        //         'var btnName = arrBtnNames[i];' +
        //         "var btnElem = jq('input[name=\"' + btnName + '\"]')[0];" +
        //         'if (!btnElem) continue;' +
        //         'console.log(btnName, btnElem);' +
        //         'var btnMenu = [' +
        //         '\'<tr><td class="ac_text">\',' +
        //         "'<a class=\"ddmAnchor\" href=\"javascript:NLInvokeButton(getButton('' + btnName + ''))\">'," +
        //         '\'<img class="record-icon-small" src="/uirefresh/img/print.png" alt="">\',' +
        //         "'<span class=\"ac_text_pad\">' + btnElem.value + '</span>'," +
        //         "'</td></tr>'" +
        //         " ].join('');" +
        //         "jq('table.ac_table tbody').append(btnMenu);" +
        //         "var btnParent = jq(btnElem).parents('table')[0]; " +
        //         'jq(btnParent).hide(); ' +
        //         '}}};};';

        //     JSCode += 'NS_Button().addToMenu(' + JSON.stringify(arrButtons) + ');';

        //     var fldJSActionMenu = form.addField({
        //         id: 'custpage_jscont_addtoaction',
        //         label: 'SOME CONTENT',
        //         type: 'inlinehtml'
        //     });

        //     fldJSActionMenu.defaultValue = '<script type="text/javascript">' + JSCode + '</script>';
        //     // ];
        // }
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

    EventRouter.Action[vc2_constant.RECORD.BILLCREATE_CONFIG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                Helper.hideFields(scriptContext.form, ['custrecord_vc_bc_maincfg']);

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                Helper.displayAsInlineTextarea(scriptContext.form, ['custrecord_vc_bc_host_key']);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        },
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

                var cacheListName = vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST';
                var vendorCacheList = vc2_util.getNSCache({
                    name: cacheListName,
                    isJSON: true
                });
                vc2_util.log(logTitle, 'Bill VendorConfig CACHE List: ', vendorCacheList);

                (vendorCacheList.LIST || []).forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

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

                var cacheListName = vc2_constant.CACHE_KEY.BILLCREATE_CONFIG + '__LIST';
                var vendorCacheList = vc2_util.getNSCache({
                    name: cacheListName,
                    isJSON: true
                });
                vc2_util.log(logTitle, 'Bill VendorConfig CACHE List: ', vendorCacheList);

                (vendorCacheList.LIST || []).forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.VENDOR_CONFIG.ID] = {
        onAfterSubmit: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onAfterSubmit'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ', Current);
                // if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                var cacheListName = vc2_constant.CACHE_KEY.VENDOR_CONFIG + '__LIST';
                var vendorCacheList = vc2_util.getNSCache({
                    name: cacheListName,
                    isJSON: true
                });
                vc2_util.log(logTitle, 'VendorConfig CACHE List: ', vendorCacheList);

                (vendorCacheList.LIST || []).forEach(function (cacheKey) {
                    vc2_util.removeCache({ name: cacheKey });
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.MAIN_CONFIG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ', Current);
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                var MainCFG = vcs_configLib.mainConfig();
                vc2_util.log(logTitle, 'MainCFG>> ', MainCFG);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        },
        onAfterSubmit: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onAfterSubmit'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ', Current);
                // reset the cache for main config

                vc2_util.removeCache({
                    name: vc2_constant.CACHE_KEY.MAIN_CONFIG
                });

                var MainCFG = vcs_configLib.mainConfig({ forced: true });
                vc2_util.log(logTitle, 'mainConfig>> ', MainCFG);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

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

    EventRouter.Action[ns_record.Type.PURCHASE_ORDER] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.VIEW,
                        scriptContext.UserEventType.EDIT
                    ])
                )
                    return;

                var Form = scriptContext.form;
                var MainCFG = vcs_configLib.mainConfig();
                if (!MainCFG) return;

                var currentRecord = scriptContext.newRecord;

                var OrderCFG = vcs_configLib.orderVendorConfig({ poId: Current.recordId });
                vc2_util.log(logTitle, '// OrderCFG:  ' + JSON.stringify(OrderCFG));

                var BillCFG = vcs_configLib.billVendorConfig({ poId: Current.recordId });
                vc2_util.log(logTitle, '// billVendorCfg:  ' + JSON.stringify(BillCFG));

                if (!MainCFG.overridePONum) {
                    Helper.hideFields(Form, ['custbody_ctc_vc_override_ponum']);
                }

                var license = vcs_configLib.validateLicense();
                if (license.hasError)
                    Helper.setVCBarNote({
                        form: scriptContext.form,
                        error: 'Your License is no longer valid or have expired. '
                    });

                if (OrderCFG)
                    Helper.addVCButton({
                        form: scriptContext.form,
                        id: 'btn_orderstatus',
                        label: ' Process Order Status',
                        action: EventRouter.addActionURL('actionOrderStatus')
                    });

                var CONNECT_TYPE = { API: 1, SFTP: 2 };

                if (BillCFG && BillCFG.connectionType == CONNECT_TYPE.API)
                    Helper.addVCButton({
                        form: scriptContext.form,
                        id: 'btn_billsapi',
                        label: 'Fetch Bill Files - API',
                        action: EventRouter.addActionURL('actionGetBillsAPI')
                    });

                // VENDOR LINE INFO /////
                var lineCount = currentRecord.getLineCount({
                        sublistId: 'item'
                    }),
                    hasVendorInfo = false;

                var fldVendorScr = scriptContext.form.addField({
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
                return;
            }

            return true;
        }
    };

    EventRouter.Action['__ALL__'] = {
        onBeforeLoad: function (scriptContext, Current) {},
        onBeforeSubmit: function (scriptContext, Current) {},
        onAfterSubmit: function (scriptContext, Current) {}
    };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {
        actionOrderStatus: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'actionOrderStatus'].join('::'),
                returnValue;
            vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));

            var mrTask = ns_task.create({
                taskType: ns_task.TaskType.MAP_REDUCE,
                scriptId: vc2_constant.SCRIPT.ORDERSTATUS_MR,
                params: {
                    custscript_orderstatus_searchid: 'customsearch_ctc_open_po_search',
                    custscript_orderstatus_orderid: Current.recordId
                }
            });
            mrTask.submit();
            vc2_util.waitMs(2000);

            ns_redirect.redirect({
                url: '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&sortcol=dateCreated&sortdir=DESC&scripttype=&primarykey=' //&scripttype=customscript_ctc_vc_process_bills'
            });

            return true;
        },
        actionGetBillsAPI: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'actionGetBiills'].join('::'),
                returnValue;
            vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));

            var mrTask = ns_task.create({
                taskType: ns_task.TaskType.MAP_REDUCE,
                scriptId: vc2_constant.SCRIPT.GETBILLS_API,
                params: {
                    custscript_ctc_vc_bc_po_id: Current.recordId
                }
            });
            mrTask.submit();
            vc2_util.waitMs(2000);

            ns_redirect.redirect({
                url: '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&sortcol=dateCreated&sortdir=DESC&scripttype=&primarykey=' //&scripttype=customscript_ctc_vc_process_bills'
            });

            return true;
        },

        triggerOrderStatus: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'reloadBillFile'].join('::'),
                returnValue;
            // vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));
            return true;
        },
        reloadBillFile: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'reloadBillFile'].join('::'),
                returnValue;
        }
    };

    var mapRecordNames = {};
    mapRecordNames[ns_record.Type.PURCHASE_ORDER] = 'PO';
    mapRecordNames[vc2_constant.RECORD.VC_LOG.ID] = 'VCLOG';
    mapRecordNames[vc2_constant.RECORD.MAIN_CONFIG.ID] = 'MAINCFG';
    mapRecordNames[vc2_constant.RECORD.VENDOR_CONFIG.ID] = 'VENDORCFG';
    mapRecordNames[vc2_constant.RECORD.BILLCREATE_CONFIG.ID] = 'BILLVCFG';
    mapRecordNames[vc2_constant.RECORD.BILLFILE.ID] = 'BILLFILE';

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            var Current = EventRouter.Current;
            vc2_util.LogPrefix = [
                mapRecordNames[Current.recordType],
                Current.recordId || '_new_',
                Current.eventType
            ].join(':');
            vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            try {
                EventRouter.execute(EventRouter.Type.CUSTOM);
                EventRouter.execute(EventRouter.Type.BEFORE_LOAD);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        },
        beforeSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeSubmit'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            var Current = EventRouter.Current;
            vc2_util.LogPrefix = [
                mapRecordNames[Current.recordType],
                Current.recordId || '_new_',
                Current.eventType
            ].join(':');
            vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            try {
                EventRouter.execute(EventRouter.Type.BEFORE_SUBMIT);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        },
        afterSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onAfterSubmit'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            var Current = EventRouter.Current;
            vc2_util.LogPrefix = [
                mapRecordNames[Current.recordType],
                Current.recordId || '_new_',
                Current.eventType
            ].join(':');
            vc2_util.LogPrefix = '[' + vc2_util.LogPrefix + '] ';

            try {
                EventRouter.execute(EventRouter.Type.AFTER_SUBMIT);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        }
    };

    return USER_EVENT;
});
