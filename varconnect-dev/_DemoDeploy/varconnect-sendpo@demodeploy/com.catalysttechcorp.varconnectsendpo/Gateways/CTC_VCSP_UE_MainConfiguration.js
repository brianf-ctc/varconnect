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
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(['../Library/CTC_VCSP_Lib_LicenseValidator', '../Library/CTC_VCSP_Constants'], function (
    libLicenseValidator,
    VCSP_Global
) {
    //Validates license and displays the corresponding status
    function _validateLicense(option) {
        let newRecord = option.newRecord,
            isLicenseValid = libLicenseValidator.isLicenseValid(),
            licenseText;
        log.debug('response', isLicenseValid);
        if (isLicenseValid) {
            licenseText =
                "<span style='background-color:lightgreen'><b>VERIFIED: Your License for VAR Connect Send PO is currently valid.</b></span>";
        } else {
            licenseText =
                "<span style='background-color:red; color: white;'><b>WARNING: Your License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.</b></span>";
        }
        newRecord.setValue({
            fieldId: VCSP_Global.Fields.MainConfig.LICENSE_TEXT,
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
        if (
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.VIEW
        ) {
            let newRecord = scriptContext.newRecord;
            _validateLicense({ newRecord: newRecord });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
