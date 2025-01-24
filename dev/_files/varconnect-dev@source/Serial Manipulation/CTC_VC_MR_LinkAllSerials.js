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
 * @NScriptType MapReduceScript
 * @Description Links all serial numbers from the createdfrom SO to the new Invoice
 */

/**
 * Project Number: 001225
 * Script Name: VAR Connect Link All SO Serial MR
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 * 1.20		Apr 2, 2021		paolodl@nscatalyst.com	Only process unlinked serials
 *
 */
define([
    'N/record',
    'N/search',
    'N/runtime',
    '../CTC_VC_Constants.js',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator'
], function (ns_record, ns_search, ns_runtime, constants, libMainConfig, libLicenseValidator) {
    var LogTitle = 'MR_LinkSerials',
        PARAM = {};

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

    function _updateTransaction() {
        // var recType = ns_runtime.getCurrentScript().getParameter('custscript_vc_all_type'),
        //     recId = ns_runtime.getCurrentScript().getParameter('custscript_vc_all_id');
        // if (PARAM.recordType == ns_record.Type.INVOICE) {
        //     var rec = ns_record.load({
        //         type: PARAM.recordType,
        //         id: PARAM.recordId
        //     });
        //     rec.save();
        // }
    }

    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join('::');

        try {
            PARAM = {
                recordType: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_type'),
                recordId: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_id')
            };
            log.debug(logTitle, '>> PARAMS: ' + JSON.stringify(PARAM));

            if (!PARAM.recordType || !PARAM.recordId) throw 'Missing record details';

            var mainConfig = _loadMainConfig();
            log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
            _validateLicense({ mainConfig: mainConfig });

            if (!mainConfig || !mainConfig.copySerialsInv) {
                //Terminate if Copy Serials functionality is not set
                log.audit(logTitle, 'Copy Serials functionality is not set');
                return;
            }

            var record = ns_record.load({ type: PARAM.recordType, id: PARAM.recordId });
            if (!record) throw 'Invalid record/record type';

            // update the sync
            ns_record.submitFields({
                type: PARAM.recordType,
                id: PARAM.recordId,
                values: {
                    custbody_ctc_vc_serialsync_done: false
                }
            });

            var lineCount = record.getLineCount({ sublistId: 'item' }),
                createdFrom = record.getValue({ fieldId: 'createdfrom' }),
                recordType = record.type,
                itemList = [],
                soId = '',
                ifId = '',
                returnObj = [];

            for (var line = 0; line < lineCount; line++) {
                var itemNum = record.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: line
                });
                var updateSerialString = record.getSublistValue({
                    sublistId: 'item',
                    fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
                    line: line
                });

                if (!updateSerialString || updateSerialString.trim().length < 1)
                    itemList.push(itemNum);
            }
            log.debug(logTitle, '>> itemList: ' + JSON.stringify(itemList));

            if (recordType == 'itemfulfillment') {
                ifId = PARAM.recordId;
                var useSO = true;
                var lookup = ns_search.lookupFields({
                    type: ns_search.Type.TRANSACTION,
                    id: createdFrom,
                    columns: ['type']
                });

                if (lookup) {
                    if (
                        lookup.type &&
                        lookup.type.length > 0 &&
                        lookup.type[0].value == 'VendAuth'
                    ) {
                        vendorAuthId = createdFrom;
                        useSO = false;
                    }
                }

                if (useSO) soId = createdFrom;
            } else if (recordType == 'invoice') {
                soId = createdFrom;
            }

            if (!soId) {
                log.error('No source Sales Order');
                return false;
                // throw new Error('No source Sales Order');
            }

            var filters = [
                {
                    name: 'custrecordserialsales',
                    operator: 'anyof',
                    values: soId
                },
                {
                    name: 'custrecordserialitem',
                    operator: 'anyof',
                    values: itemList
                }
            ];

            if (PARAM.recordType == ns_record.Type.ITEM_FULFILLMENT) {
                filters.push({
                    name: 'custrecorditemfulfillment',
                    operator: 'isempty'
                });
            } else if (PARAM.recordType == ns_record.Type.INVOICE) {
                filters.push({
                    name: 'custrecordserialinvoice',
                    operator: 'isempty'
                });
            }

            return ns_search.create({
                type: 'customrecordserialnum',
                filters: filters,
                columns: ['internalid']
            });
        } catch (error) {
            log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            return false;
        }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        var logTitle = [LogTitle, 'reduce'].join('::');

        var sc;
        try {
            PARAM = {
                recordType: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_type'),
                recordId: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_id')
            };
            log.debug(logTitle, '>> PARAMS: ' + JSON.stringify(PARAM));

            var data = JSON.parse(context.values[0]);
            log.debug(logTitle, '>> data: ' + JSON.stringify(data));

            if (data) {
                var serialId = data.id,
                    val = {},
                    field;

                if (PARAM.recordType == ns_record.Type.ITEM_FULFILLMENT) {
                    field = 'custrecorditemfulfillment';
                    val[field] = PARAM.recordId;
                } else if (PARAM.recordType == ns_record.Type.INVOICE) {
                    field = 'custrecordserialinvoice';
                    val[field] = PARAM.recordId;
                }

                if (field)
                    sc = ns_record.submitFields({
                        type: 'customrecordserialnum',
                        id: serialId,
                        values: val
                    });
            }
        } catch (e) {
            log.error('reduce', e.message);
        }

        return sc ? sc : '';
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
        var logTitle = [LogTitle, 'summarize'].join('::');

        PARAM = {
            recordType: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_type'),
            recordId: ns_runtime.getCurrentScript().getParameter('custscript_vc_all_id')
        };

        //any errors that happen in the above methods are thrown here so they should be handled
        //log stuff that we care about, like number of serial numbers
        // log.audit('summarize');
        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error('Reduce Error for key: ' + key, error);
            return true;
        });
        var reduceKeys = [];
        summary.reduceSummary.keys.iterator().each(function (key) {
            reduceKeys.push(key);
            return true;
        });
        if (reduceKeys && reduceKeys.length > 0) _updateTransaction();
        log.audit(logTitle, 'REDUCE keys processed' + JSON.stringify(reduceKeys));

        // update the sync
        ns_record.submitFields({
            type: PARAM.recordType,
            id: PARAM.recordId,
            values: {
                custbody_ctc_vc_serialsync_done: true
            }
        });
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
