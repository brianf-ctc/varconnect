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
    './CTC_Lib_EventRouter',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants'
], function (NS_Runtime, NS_Search, NS_Record, NS_Msg, EventRouter, VC2_Util, VC2_Global) {
    var LogTitle = 'VC:BILLFILE';

    var Helper = {
        displayAsInlineTextarea: function (form, arrFields) {
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            log.audit('displayAsInlineTextarea', arrFields);

            arrFields.forEach(function (fieldId) {
                log.audit('displayAsInlineTextarea', fieldId);
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

                    log.audit('displayAsInlineTextarea', fldOrig);
                    log.audit('displayAsInlineTextarea', fldNew);

                    var strValue = fldOrig.defaultValue;

                    //test for JSON
                    try {
                        var jsonObj = JSON.parse(strValue);
                        strValue = JSON.stringify(jsonObj, null, '    ');
                    } catch (err) {
                        log.audit('json log test', VC2_Util.extractError(err));
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
                    log.audit('displayAsInlineTextarea', errfld);
                }
                return true;
            }); // end: arrFields.forEach
        }
    };

    EventRouter.Action['customrecord_ctc_vc_bills'] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

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
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action['customrecord_vc_bill_vendor_config'] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, ['custrecord_vc_bc_host_key']);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[VC2_Global.RECORD.VC_LOG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vcsp_log_body'
                ]);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    // EventRouter.Action[NS_Record.Type.PURCHASE_ORDER] = {
    //     onBeforeLoad: function (scriptContext, Current) {
    //         var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

    //         try {
    //             log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

    //             if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
    //             if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

    //             var actionOrderStatus = EventRouter.addActionURL('triggerOrderStatus');
    //             log.audit(logTitle, '>> actionOrderStatus: ' + JSON.stringify(actionOrderStatus));

    //             var fldBtn = scriptContext.form.addField({
    //                 id: 'custpage_lnkbtn_orderstatus',
    //                 label: 'Order Status',
    //                 type: 'inlinehtml',
    //                 // container: 'custtab_ctc_varconnect'
    //             });
    //             fldBtn.defaultValue =' <span> this is a test </a>';

    //             // var sublistVCLog,
    //             //     arrSublists = scriptContext.newRecord.getSublists();
    //             // var validSublists = [
    //             //     'item',
    //             //     'taxdetails',
    //             //     'item',
    //             //     'expense',
    //             //     'contacts',
    //             //     'output',
    //             //     'activities',
    //             //     'mediaitem',
    //             //     'usernotes',
    //             //     'links',
    //             //     'approvals',
    //             //     'cases',
    //             //     'systemnotes',
    //             //     'activeworkflows',
    //             //     'workflowhistory',
    //             //     'messages',
    //             //     'calls',
    //             //     'tasks'
    //             // ];
    //             // for (var i = 0, j = arrSublists.length; i < j; i++) {
    //             //     if (VC2_Util.inArray(arrSublists[i], validSublists)) continue;

    //             //     var sublistInfo = scriptContext.form.getSublist({ id: arrSublists[i] });
    //             //     if (sublistInfo.label.match(/VAR Connect Logs/i)) {
    //             //         sublistVCLog = sublistInfo;
    //             //         break;
    //             //     }
    //             // }

    //             // log.audit(logTitle, '>> sublist: ' + JSON.stringify(sublistVCLog));

    //             // if (!sublistVCLog) return;
    //             // sublistVCLog.addButton({
    //             //     id: 'custpage_btn_orderstatus',
    //             //     label: 'Check Order Status',
    //             //     functionName: "(function () {alert(123);})():"
    //             //     // functionName: "(function (url) {alert(url);})('" + actionOrderStatus + "'):"
    //             // });
    //         } catch (error) {
    //             log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
    //             return;
    //         }

    //         return true;
    //     }
    // };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {
        triggerOrderStatus: function (scriptContext, Current) {
            log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));
            return true;
        }
    };

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            log.audit(logTitle, EventRouter.Type);
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

            log.audit(logTitle, EventRouter.Type);
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

            log.audit(logTitle, EventRouter.Type);
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
