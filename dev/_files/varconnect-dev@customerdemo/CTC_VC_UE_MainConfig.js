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

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Enables and disables fields depending on current selection
 *
 */

define([
    'N/runtime',
    'N/ui/serverWidget',
    'N/ui/message',
    './CTC_VC2_Constants.js',
    './CTC_VC_Lib_LicenseValidator'
], function (ns_runtime, ns_ui, ns_msg, vc2_constant, vc_license) {
    var LogTitle = 'MainCFG';

    var MAINCFG = vc2_constant.RECORD.MAIN_CONFIG;

    //Disables and clears the fields
    function _disableAndClearFields(options) {
        var logTitle = [LogTitle, 'disableAndClearFields'].join('::');

        var form = options.form,
            fields = options.fields;
        log.debug(logTitle, '>> fields: ' + JSON.stringify(fields));

        for (var field in fields) {
            var formField = form.getField({ id: fields[field] });
            formField.updateDisplayType({ displayType: ns_ui.FieldDisplayType.DISABLED });
            formField.defaultValue = '';
        }
    }

    //Validates license and displays the corresponding status
    function _validateLicense(options) {
        var logTitle = [LogTitle, 'validateLicense'].join('::');

        var newRecord = options.newRecord,
            license = newRecord.getValue({ fieldId: MAINCFG.FIELD.LICENSE }),
            response = vc_license.callValidationSuitelet({
                license: license,
                external: true
            });

        log.debug(logTitle, '>> response: ' + JSON.stringify(response));

        if (response == 'valid') {
            newRecord.setValue({
                fieldId: MAINCFG.FIELD.LICENSE_TEXT,
                value: "<span style='background-color:lightgreen'><b>VERIFIED: Your License for VAR Connect is currently valid.</b></span>"
            });
        } else {
            newRecord.setValue({
                fieldId: MAINCFG.FIELD.LICENSE_TEXT,
                value:
                    "<span style='background-color:red; color: white;'><b>ERROR: " +
                    response +
                    '.</b></span>'
            });

            options.form.addPageInitMessage({
                title: 'WARNING',
                message:
                    'Your License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.',
                type: ns_msg.Type.ERROR
            });
        }
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
        var logTitle = [LogTitle, 'beforeLoad'].join('::');

        log.debug(
            logTitle,
            JSON.stringify({
                eventType: scriptContext.type,
                contextType: ns_runtime.executionContext
            })
        );

        if (
            scriptContext.type === scriptContext.UserEventType.CREATE ||
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.COPY
        ) {
            var newRecord = scriptContext.newRecord,
                isProcessDropship = newRecord.getValue({
                    fieldId: MAINCFG.FIELD.PROCESS_DROPSHIPS
                }),
                isProcessSpecialOrder = newRecord.getValue({
                    fieldId: MAINCFG.FIELD.PROCESS_SPECIAL_ORDERS
                });

            log.debug(logTitle, '>> isProcessDropship: ' + JSON.stringify(isProcessDropship));
            log.debug(
                logTitle,
                '>> isProcessSpecialOrder: ' + JSON.stringify(isProcessSpecialOrder)
            );

            if (!isProcessDropship)
                _disableAndClearFields({
                    form: scriptContext.form,
                    fields: [
                        MAINCFG.FIELD.CREATE_ITEM_FULFILLMENTS,
                        MAINCFG.FIELD.IGNORE_DIRECT_SHIPS_DROPSHIPS
                    ]
                });
            if (!isProcessSpecialOrder)
                _disableAndClearFields({
                    form: scriptContext.form,
                    fields: [
                        MAINCFG.FIELD.CREATE_ITEM_RECEIPTS,
                        MAINCFG.FIELD.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS
                    ]
                });
        }
        if (
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.VIEW
        ) {
            var newRecord = scriptContext.newRecord;
            _validateLicense({ newRecord: newRecord, form: scriptContext.form });
        }
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {}

    return {
        beforeLoad: beforeLoad
        //        beforeSubmit: beforeSubmit
    };
});
