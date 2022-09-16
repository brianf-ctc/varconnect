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
 * @Description Runs the corresponding MR script depending on the required process for creating serial numbers
 */
/**
 * Project Number: 001225
 * Script Name: VAR Connect Serial Manipulation UE
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */

define([
    'N/task',
    'N/ui/serverWidget',
    'N/runtime',
    'N/record',
    'N/search',
    '../CTC_VC_Constants.js',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator',
    '../CTC_VC2_Lib_Utils'
], function (
    ns_task,
    ns_ui,
    ns_runtime,
    ns_record,
    ns_search,
    constants,
    vc_mainconfig,
    vc_licenselib,
    vc_util
) {
    var LogTitle = 'UE_SerialManip';

    function _validateLicense(options) {
        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            response = vc_licenselib.callValidationSuitelet({
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
        var mainConfig = vc_mainconfig.getMainConfiguration();

        if (!mainConfig) {
            log.error('No VAR Connect Main Coniguration available');
        } else return mainConfig;
    }

    var Helper = {
        searchSerials: function (option) {
            var logTitle = [LogTitle, 'searchSerials'].join('::');
            var searchOption = {
                type: 'customrecordserialnum',
                columns: [
                    'internalid',
                    'name',
                    'custrecordserialitem',
                    'custrecordserialsales',
                    'custrecordserialpurchase'
                ],
                filters: [['isinactive', 'is', 'F']]
            };

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId,
                po: option.purchaseOrder || option.purchaseOrderId || option.poId,
                inv: option.invoice || option.invoiceId || option.invId
            };

            log.audit(logTitle, param);

            if (param.po) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialpurchase', 'anyof', param.po]);
            }
            if (param.so) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialsales', 'anyof', param.so]);
            }
            if (param.inv) {
                searchOption.filters.push('AND');
                searchOption.filters.push(['custrecordserialinvoice', 'anyof', param.inv]);
            }
            log.audit(logTitle, searchOption);

            var results = [],
                searchObj = ns_search.create(searchOption),
                searchResults = vc_util.searchAllPaged({ searchObj: searchObj });

            searchResults.forEach(function (result) {
                results.push({
                    id: result.getValue({ name: 'internalid' }),
                    name: result.getValue({ name: 'name' }),
                    itemnum: result.getValue({ name: 'custrecordserialitem' })
                });
                return true;
            });

            // var serialSearch = ns_search.create(searchOption);
            // serialSearch.run().each(function (result) {
            //     results.push({
            //         id: result.getValue({ name: 'internalid' }),
            //         name: result.getValue({ name: 'name' }),
            //         itemnum: result.getValue({ name: 'custrecordserialitem' })
            //     });
            //     return true;
            // });

            return results;
        },

        searchVendorConfig: function (option) {
            var logTitle = [LogTitle, 'searchVendorConfig'].join('::');

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId,
                vendor: option.vendor || option.vendorId
            };

            if (!param.vendor && param.so) {
                param.vendor = Helper.searchVendor({ salesOrder: param.so });
            }

            if (!param.vendor) return false;

            log.audit(logTitle, param);

            var searchOption = {
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [['custrecord_ctc_vc_vendor', 'anyof', param.vendor]],
                columns: ['internalid', 'custrecord_ctc_vc_vendor']
            };
            log.audit(logTitle, searchOption);
            var searchVendorCFG = ns_search.create(searchOption);
            if (!searchVendorCFG.runPaged().count) return false;

            searchVendorCFG.run().each(function (result) {
                param.vendorConfig = result.getValue({ name: 'internalid' });
                return true;
            });

            log.audit(logTitle, param);

            return param.vendorConfig;
        },

        searchVendor: function (option) {
            var logTitle = [LogTitle, 'searchVendor'].join('::');

            var param = {
                so: option.salesOrder || option.salesOrderId || option.soId
            };

            var searchOption = {
                type: 'purchaseorder',
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['createdfrom', 'anyof', param.so]
                ],
                columns: [
                    'internalid',
                    'transactionname',
                    'entity',
                    'custbody_ctc_vc_serialsync_done',
                    'createdfrom',
                    ns_search.createColumn({
                        name: 'entityid',
                        join: 'vendor'
                    })
                ]
            };
            log.audit(logTitle, searchOption);

            var searchPO = ns_search.create(searchOption);
            if (!searchPO.runPaged().count) return false;

            searchPO.run().each(function (result) {
                param.vendor = result.getValue({ name: 'entity' });
                param.vendorName = result.getValue({
                    name: 'entityid',
                    join: 'vendor'
                });
                return true;
            });

            log.audit(logTitle, param);

            return param.vendor;
        }
    };

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
        if (scriptContext.type === scriptContext.UserEventType.DELETE) return;
        var mainConfig = _loadMainConfig();

        // log.debug(
        //     logTitle,
        //     JSON.stringify({
        //         eventType: scriptContext.type,
        //         contextType: ns_runtime.executionContext,
        //         mainConfig: mainConfig
        //     })
        // );

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
                    field.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });

                field = sublist.getField({
                    id: constants.Columns.SERIAL_NUMBER_SCAN
                });

                //force check if field exists
                if (field && JSON.stringify(field) != '{}')
                    field.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
            }

            // serial sync checkbox
            var chkSerialSync = form.getField({ id: 'custbody_ctc_vc_serialsync_done' });
            if (chkSerialSync)
                chkSerialSync.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
        }

        if (scriptContext.newRecord && scriptContext.newRecord.type == ns_record.Type.INVOICE) {
            var form = scriptContext.form;

            var vendorConfig = Helper.searchVendorConfig({
                salesOrder: scriptContext.newRecord.getValue({ fieldId: 'createdfrom' })
            });

            if (!vendorConfig) {
                // serial sync checkbox
                var chkSerialSync = form.getField({ id: 'custbody_ctc_vc_serialsync_done' });
                if (chkSerialSync)
                    chkSerialSync.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
            }

            return true;
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
        var logTitle = [LogTitle, 'afterSubmit'].join('::');
        var logPrefix =
            '[' + scriptContext.newRecord.type + ':' + scriptContext.newRecord.id + '] ';

        if (
            scriptContext.type == scriptContext.UserEventType.DELETE ||
            ns_runtime.executionContext == ns_runtime.ContextType.MAP_REDUCE
        )
            return;

        var mainConfig = _loadMainConfig();
        if (!mainConfig) return;

        log.debug(
            logTitle,
            logPrefix +
                JSON.stringify({
                    eventType: scriptContext.type,
                    contextType: ns_runtime.executionContext
                })
        );

        var cols = constants.Columns,
            scripts = constants.Scripts.Script,
            hasSerials = false,
            hasNoSerials = false,
            record = scriptContext.newRecord,
            lineCount = record.getLineCount({ sublistId: 'item' });

        for (var line = 0; line < lineCount; line++) {
            var serialString = record.getSublistValue({
                sublistId: 'item',
                fieldId: cols.SERIAL_NUMBER_SCAN,
                line: line
            });

            var serialStringUpdate = record.getSublistValue({
                sublistId: 'item',
                fieldId: cols.SERIAL_NUMBER_UPDATE,
                line: line
            });

            if (
                (serialString && serialString.trim()) ||
                (serialStringUpdate && serialStringUpdate.trim())
            ) {
                hasSerials = true;
            } else if (
                (record.type == ns_record.Type.ITEM_FULFILLMENT ||
                    record.type == ns_record.Type.INVOICE) &&
                scriptContext.type == scriptContext.UserEventType.CREATE &&
                (!serialStringUpdate || serialStringUpdate.trim().length == 0)
            ) {
                hasNoSerials = true;
            }

            if (hasSerials && hasNoSerials) break;
        }
        log.debug(
            logTitle,
            logPrefix +
                '>> settings: ' +
                JSON.stringify({
                    hasSerials: hasSerials,
                    hasNoSerials: hasNoSerials
                })
        );

        //Also check if the corresponding features have been enabled before processing
        if (hasNoSerials && record.type == ns_record.Type.INVOICE && mainConfig.copySerialsInv) {
            var vendorConfig = Helper.searchVendorConfig({
                salesOrder: record.getValue({ fieldId: 'createdfrom' })
            });

            var serialList = Helper.searchSerials({
                salesOrder: record.getValue({ fieldId: 'createdfrom' })
            });

            log.audit(logTitle, {
                vendorConfig: vendorConfig,
                serialList: serialList
            });

            // if (vendorConfig) {
            //     var tranId = record.getValue({ fieldId: 'tranid' });
            //     log.debug(tranId + ' has no serials', true);

            //     vc_util.waitRandom(10000);

            //     var taskOption = {
            //         isMapReduce: true,
            //         scriptId: scripts.SERIAL_UPDATE_ALL_MR,
            //         scriptParams: {}
            //     };
            //     taskOption.scriptParams['custscript_vc_all_type'] = record.type;
            //     taskOption.scriptParams['custscript_vc_all_id'] = record.id;
            //     vc_util.forceDeploy(taskOption);
            // } else {
            //     // just check it
            // }
        }
        if (hasSerials && mainConfig.serialScanUpdate) {
            var tranId = record.getValue({ fieldId: 'tranid' });
            log.debug(tranId + ' has serials', true);

            vc_util.waitRandom(10000);

            var taskOption = {
                isMapReduce: true,
                scriptId: scripts.SERIAL_UPDATE_MR,
                scriptParams: {}
            };
            taskOption.scriptParams['custscript_vc_type'] = record.type;
            taskOption.scriptParams['custscript_vc_id'] = record.id;
            taskOption.scriptParams['custscript_vc_sender'] = ns_runtime.getCurrentUser().id;
            vc_util.forceDeploy(taskOption);
        }
    }

    return {
        beforeLoad: beforeLoad,
        afterSubmit: afterSubmit
    };
});
