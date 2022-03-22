/**
 * Copyright (c) 2020 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * Project Number: 001225
 * Script Name: VAR Connect Serial Manipulation UE
 * Author: paolodl@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @Description Runs the corresponding MR script depending on the required process for creating serial numbers
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */

/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
    'N/task',
    'N/ui/serverWidget',
    'N/runtime',
    'N/record',
    '../CTC_VC_Constants.js',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator',
    '../Library/CTC_Util.js'
], function (task, ui, runtime, record, constants, libMainConfig, libLicenseValidator, Util) {
    function _validateLicense(options) {
        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            }),
            result = true;

        if (response == 'invalid') {
            log.error(
                'License expired',
                'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
            );
            result = false;
        }

        return result;
    }

    function _loadMainConfig() {
        var mainConfig = libMainConfig.getMainConfiguration();

        if (!mainConfig) {
            log.error('No VAR Connect Main Coniguration available');
        } else return mainConfig;
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
        if (scriptContext.type !== scriptContext.UserEventType.DELETE) {
            var mainConfig = _loadMainConfig();

            //If Serial Scan and Update feature is disabled, hide the corresponding columns
            if (!mainConfig.serialScanUpdate || !_validateLicense({ mainConfig: mainConfig })) {
                var form = scriptContext.form,
                    sublist = form.getSublist({ id: 'item' });

                if (sublist) {
                    var field = sublist.getField({
                        id: constants.Columns.SERIAL_NUMBER_UPDATE
                    });

                    //force check if field exists
                    if (field && JSON.stringify(field) != '{}')
                        field.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

                    field = sublist.getField({
                        id: constants.Columns.SERIAL_NUMBER_SCAN
                    });

                    //force check if field exists
                    if (field && JSON.stringify(field) != '{}')
                        field.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
                }
            }
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
    function afterSubmit(scriptContext) {
        if (
            scriptContext.type !== scriptContext.UserEventType.DELETE &&
            runtime.executionContext != runtime.ContextType.MAP_REDUCE
        ) {
            log.debug('afterSubmit');

            var mainConfig = _loadMainConfig();

            if (mainConfig) {
                var cols = constants.Columns,
                    scripts = constants.Scripts.Script,
                    hasSerials = false,
                    hasNoSerials = false,
                    rec = scriptContext.newRecord,
                    itemLen = rec.getLineCount({ sublistId: 'item' });

                for (var itemCounter = 0; itemCounter < itemLen; itemCounter++) {
                    var serialString = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: cols.SERIAL_NUMBER_SCAN,
                        line: itemCounter
                    });

                    var serialStringUpdate = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: cols.SERIAL_NUMBER_UPDATE,
                        line: itemCounter
                    });

                    if (
                        (serialString && serialString.trim()) ||
                        (serialStringUpdate && serialStringUpdate.trim())
                    ) {
                        hasSerials = true;
                    } else if (
                        (rec.type == record.Type.ITEM_FULFILLMENT ||
                            rec.type == record.Type.INVOICE) &&
                        scriptContext.type == scriptContext.UserEventType.CREATE &&
                        (!serialStringUpdate || serialStringUpdate.trim().length == 0)
                    ) {
                        hasNoSerials = true;
                    }

                    if (hasSerials && hasNoSerials) break;
                }

                //Also check if the corresponding features have been enabled before processing
                if (hasNoSerials && rec.type == record.Type.INVOICE && mainConfig.copySerialsInv) {
                    var tranId = rec.getValue({ fieldId: 'tranid' });
                    log.debug(tranId + ' has no serials', true);

                    Util.waitRandom(10000);

                    var taskOption = {
                        isMapReduce: true,
                        scriptId: scripts.SERIAL_UPDATE_ALL_MR,
                        scriptParams: {}
                    };
                    taskOption.scriptParams['custscript_vc_all_type'] = rec.type;
                    taskOption.scriptParams['custscript_vc_all_id'] = rec.id;
                    var taskId = Util.forceDeploy(taskOption);
                }
                if (hasSerials && mainConfig.serialScanUpdate) {
                    var tranId = rec.getValue({ fieldId: 'tranid' });
                    log.debug(tranId + ' has serials', true);

                    Util.waitRandom(10000);

                    var taskOption = {
                        isMapReduce: true,
                        scriptId: scripts.SERIAL_UPDATE_MR,
                        scriptParams: {}
                    };
                    taskOption.scriptParams['custscript_vc_type'] = rec.type;
                    taskOption.scriptParams['custscript_vc_id'] = rec.id;
                    taskOption.scriptParams['custscript_vc_sender'] = runtime.getCurrentUser().id;
                    var taskId = Util.forceDeploy(taskOption);
                }
            }
        }
    }

    return {
        beforeLoad: beforeLoad,
        afterSubmit: afterSubmit
    };
});
