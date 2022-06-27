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
    '../Library/CTC_VCSP_Lib_MainConfiguration',
    '../Library/CTC_VCSP_Lib_LicenseValidator',
    '../Library/CTC_VCSP_Lib_VendorConfig'
], function (
    NS_Runtime,
    NS_Search,
    NS_Record,
    libMainConfig,
    libLicenseValidator,
    libVendorConfig
) {
    var LogTitle = 'VC:SENDPO';

    var Helper = {
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = NS_Search.lookupFields(option);
            // log.debug('flatLookup', 'arrResults>>' + JSON.stringify(arrResults));

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        }
    };

    //Checks if catalyst license is valid
    function _validateLicense(options) {
        var logTitle = [LogTitle, '_validateLicense'].join('::');

        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            result = true,
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            });

        log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
        log.audit(logTitle, '>> license: ' + JSON.stringify(license));
        // log.audit(logTitle, '>> response: ' + JSON.stringify(response));

        // if (response == 'valid') result = true;

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
        var logTitle = [LogTitle, 'beforeLoad'].join('::');

        try {
            var UserEventData = {
                eventType: scriptContext.type,
                contextType: NS_Runtime.executionContext
            };

            log.audit(logTitle, '>> runtime data: ' + JSON.stringify(UserEventData));

            if (UserEventData.eventType !== scriptContext.UserEventType.VIEW) return;
            if (UserEventData.contextType !== NS_Runtime.ContextType.USER_INTERFACE) return;

            var recordData = {};

            if (scriptContext.newRecord) {
                recordData.type = scriptContext.newRecord.type;
                recordData.id = scriptContext.newRecord.id;
            }
            log.audit(logTitle, '>> Record Data: ' + JSON.stringify(recordData));

            var lookupData = Helper.flatLookup({
                type: recordData.type, 
                id: recordData.id, 
                columns: ['subsidiary','entity']
            });
            log.audit(logTitle, '>> lookupData: ' + JSON.stringify(lookupData));

            // check for main config
            var mainConfig = libMainConfig.getMainConfiguration();
            log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
            if (!mainConfig) return;

            // check for valid license
            if (!_validateLicense({ mainConfig: mainConfig })) return;

            var vendorCfg = libVendorConfig.getVendorConfiguration({
                vendor: lookupData.entity.value, 
                subsidiary: lookupData.subsidiary.value
            });
            log.audit(logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
            if (!vendorCfg) return;

            // check for any vendor configuration
            var form = scriptContext.form;
            form.clientScriptModulePath = './CTC_VCSP_CS_SendPO.js';
            form.addButton({
                id: 'custpage_ctc_vcsp_sendpo',
                label: 'Send PO to Vendor',
                functionName: 'sendPO'
            });
        } catch (error) {
            log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            return;
        }

        return;
    }

    return {
        beforeLoad: beforeLoad
    };
});
