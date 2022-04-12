/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['../Library/CTC_VCSP_Lib_LicenseValidator', '../Library/CTC_VCSP_Constants'], function (
    libLicenseValidator,
    constants
) {
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
                "<span style='background-color:lightgreen'><b>VERIFIED: Your License for VAR Connect Send PO is currently valid.</b></span>";
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
        if (
            scriptContext.type === scriptContext.UserEventType.EDIT ||
            scriptContext.type === scriptContext.UserEventType.VIEW
        ) {
            var newRecord = scriptContext.newRecord;
            _validateLicense({ newRecord: newRecord });
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
