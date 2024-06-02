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
    'N/search',
    'N/record',
    'N/ui/message',
    './CTC_VC2_Lib_EventRouter',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants',
    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig',
    './Services/ctc_svclib_configlib'
], function (
    ns_runtime,
    ns_search,
    ns_record,
    ns_msg,
    EventRouter,
    vc2_util,
    vc2_constant,
    vc_maincfg,
    vc_vendorcfg,
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
        }
    };

    EventRouter.Action[vc2_constant.RECORD.MAIN_CONFIG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ', Current);
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                var mainConfig = vcs_configLib.mainConfig();
                vc2_util.log(logTitle, 'mainConfig>> ', mainConfig);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        },
        onAfterSubmit: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onAfterSubmit'].join('::');

            try {
                vc2_util.log(logTitle, '>> Current: ', Current);
                // if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                var mainConfig = vcs_configLib.mainConfig({ forced: true });
                vc2_util.log(logTitle, 'mainConfig>> ', mainConfig);
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

                vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));

                var mainCfg = vc_maincfg.getMainConfiguration();
                vc2_util.log(logTitle, '// Main Confg: ' + JSON.stringify(mainCfg));
                if (!mainCfg) return;

                var currentRecord = scriptContext.newRecord;

                var vendorCfg = vc_vendorcfg.getVendorConfiguration({
                    vendor: currentRecord.getValue({ fieldId: 'entity' }),
                    subsidiary: currentRecord.getValue({
                        fieldId: 'subsidiary'
                    })
                });
                vc2_util.log(logTitle, '// vendorCfg:  ' + JSON.stringify(vendorCfg));

                if (!mainCfg.overridePONum) {
                    Helper.hideFields(scriptContext.form, ['custbody_ctc_vc_override_ponum']);
                }

                // // add button to the flex screen
                // scriptContext.form.addButton({
                //     id: 'custpage_orderstatus',
                //     label: 'VC | Order Status',
                //     functionName:
                //         '(function(url){window.location.href=url;})("' +
                //         EventRouter.addActionURL('actionOrderStatus') +
                //         '")'
                // });

                // scriptContext.form.addButton({
                //     id: 'custpage_fetchbill',
                //     label: 'VC | Fetch Bills',
                //     functionName:
                //         '(function(url){window.location.href=url;})("' +
                //         EventRouter.addActionURL('actionFetchBills') +
                //         '")'
                // });

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
        triggerOrderStatus: function (scriptContext, Current) {
            vc2_util.log(logTitle, '>> Current: ' + JSON.stringify(Current));
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
