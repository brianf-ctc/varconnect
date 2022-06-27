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
    '../Library/CTC_VCSP_Lib_MainConfiguration',
    '../Library/CTC_VCSP_Lib_LicenseValidator'
], function (libMainConfig, libLicenseValidator) {
    //Checks if catalyst license is valid
    function _validateLicense(options) {
        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            result = false,
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            });

        if (response == 'valid') result = true;

        return result;
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
        if (scriptContext.type == scriptContext.UserEventType.VIEW) {
            var mainConfig = libMainConfig.getMainConfiguration();
            if (mainConfig) {
                if (_validateLicense({ mainConfig: mainConfig })) {
                    var form = scriptContext.form;

                    form.clientScriptModulePath = './CTC_VCSP_CS_SendPO.js';

                    form.addButton({
                        id: 'custpage_ctc_vcsp_sendpo',
                        label: 'Send PO to Vendor',
                        functionName: 'sendPO'
                    });
                }
            }
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
