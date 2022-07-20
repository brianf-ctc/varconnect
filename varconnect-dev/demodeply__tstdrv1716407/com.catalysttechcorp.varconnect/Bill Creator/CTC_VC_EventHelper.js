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

                    fldNew.defaultValue = [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">',
                        fldOrig.label,
                        '</a>',
                        '</span></span>',
                        '<textarea cols="80" rows="10" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        // Helper.escapeHtml(fldOrig.defaultValue),
                        fldOrig.defaultValue,
                        '</textarea>',
                        // '<span class="uir-field inputreadonly uir-resizable">',
                        //     Helper.escapeHtml(fldOrig.defaultValue.substring(0, 500)), '...',
                        //     '<p><a href="#"> See More </a></p>',
                        // '</span>',
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

                var flexScreenUrl = '/app/site/hosting/scriptlet.nl?script=customscript_ctc_vc_bill_flex_screen&deploy=1&record_id=' + Current.recordId;

                // add button to the flex screen
                scriptContext.form.addButton({
                    id: 'custpage_flexscreen', 
                    label: 'Open Flex Screen', 
                    functionName: '(function(url){return window.open(url, "_blank");})("'+flexScreenUrl+'")'
                });

            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {};

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
