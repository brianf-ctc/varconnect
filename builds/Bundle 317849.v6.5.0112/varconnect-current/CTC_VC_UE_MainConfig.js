/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Enables and disables fields depending on current selection
 *
 */ /**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', './CTC_VC_Constants.js', './CTC_VC_Lib_LicenseValidator'], function (
    serverWidget,
    constants,
    libLicenseValidator
) {
    //Disables and clears the fields
    function _disableAndClearFields(options) {
        var form = options.form,
            fields = options.fields;

        for (var field in fields) {
            var formField = form.getField({ id: fields[field] });
            formField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            formField.defaultValue = '';
        }
    }

    //Validates license and displays the corresponding status
    function _validateLicense(options) {
        var newRecord = options.newRecord,
            license = newRecord.getValue({ fieldId: constants.Fields.MainConfig.LICENSE }),
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            }),
            licenseText;

        log.debug('response', response);

        if (response == 'valid') {
            licenseText =
                "<span style='background-color:lightgreen'><b>VERIFIED: Your License for VAR Connect is currently valid.</b></span>";
        } else if (response == 'invalid') {
            licenseText =
                "<span style='background-color:red; color: white;'><b>WARNING: Your License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.</b></span>";
        }

        newRecord.setValue({
            fieldId: constants.Fields.MainConfig.LICENSE_TEXT,
            value: licenseText
        });
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
        log.debug(scriptContext.type);
        if (
            scriptContext.type === scriptContext.UserEventType.CREATE ||
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.COPY
        ) {
            var newRecord = scriptContext.newRecord,
                isProcessDropship = newRecord.getValue({
                    fieldId: constants.Fields.MainConfig.PROCESS_DROPSHIPS
                }),
                isProcessSpecialOrder = newRecord.getValue({
                    fieldId: constants.Fields.MainConfig.PROCESS_SPECIAL_ORDERS
                });

            if (!isProcessDropship)
                _disableAndClearFields({
                    form: scriptContext.form,
                    fields: [
                        constants.Fields.MainConfig.CREATE_ITEM_FULFILLMENTS,
                        constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_DROPSHIPS
                    ]
                });
            if (!isProcessSpecialOrder)
                _disableAndClearFields({
                    form: scriptContext.form,
                    fields: [
                        constants.Fields.MainConfig.CREATE_ITEM_RECEIPTS,
                        constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS
                    ]
                });
        }
        if (
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.VIEW
        ) {
            var newRecord = scriptContext.newRecord;
            _validateLicense({ newRecord: newRecord });
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
