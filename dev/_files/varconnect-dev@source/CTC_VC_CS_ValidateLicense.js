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
 * @NScriptType ClientScript
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Enables and disables fields depending on current selection
 *
 */
define(['./CTC_VC_Constants', './CTC_VC_Lib_LicenseValidator'], function (
    constants,
    libLicenseValidator
) {
    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {
        if (scriptContext.fieldId == constants.Fields.MainConfig.LICENSE) {
            var currentRecord = scriptContext.currentRecord,
                license = currentRecord.getValue({ fieldId: scriptContext.fieldId });

            var response = libLicenseValidator.callValidationSuitelet({ license: license });

            log.debug('response', JSON.stringify(response));
        }

        return true;
    }

    return {
        validateField: validateField
    };
});
