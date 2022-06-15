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
 */
define(['N/record', 'N/search', 'N/runtime'], function (record, search, runtime) {
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
        log.debug('getInputData');
        var recType = runtime.getCurrentScript().getParameter('custscript_all_type'),
            recId = runtime.getCurrentScript().getParameter('custscript_all_id');

        var rec = record.load({
            type: recType,
            id: recId
        });

        if (!rec) log.error('Invalid record', 'Type: + ' + recType + ' | Id: ' + recId);

        var itemLen = rec.getLineCount({ sublistId: 'item' }),
            createdFrom = rec.getValue({ fieldId: 'createdfrom' }),
            recordType = rec.type,
            itemList = [],
            soId = '',
            ifId = '',
            returnObj = [];

        for (var itemCounter = 0; itemCounter < itemLen; itemCounter++) {
            var itemNum = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: itemCounter
            });
            var updateSerialString = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_ctc_my_serial_number_update',
                line: itemCounter
            });

            if (!updateSerialString || updateSerialString.trim().length < 1) itemList.push(itemNum);
        }

        if (recordType == 'itemfulfillment') {
            ifId = recId;
            var useSO = true;
            var lookup = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: createdFrom,
                columns: ['type']
            });

            if (lookup) {
                if (lookup.type && lookup.type.length > 0 && lookup.type[0].value == 'VendAuth') {
                    vendorAuthId = createdFrom;
                    useSO = false;
                }
            }

            if (useSO) soId = createdFrom;
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

        return search.create({
            type: 'customrecordserialnum',
            filters: filters,
            columns: ['internalid']
        });
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        var sc;
        try {
            log.debug('reduce');

            var data = JSON.parse(context.values[0]);

            if (data) {
                var serialId = data.id,
                    recType = runtime.getCurrentScript().getParameter('custscript_all_type'),
                    recId = runtime.getCurrentScript().getParameter('custscript_all_id'),
                    val = {},
                    field;

                if (recType == record.Type.ITEM_FULFILLMENT) {
                    field = 'custrecorditemfulfillment';
                    val[field] = recId;
                }

                if (field)
                    sc = record.submitFields({
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
        //any errors that happen in the above methods are thrown here so they should be handled
        //log stuff that we care about, like number of serial numbers
        log.audit('summarize');
        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error('Reduce Error for key: ' + key, error);
            return true;
        });
        var reduceKeys = [];
        summary.reduceSummary.keys.iterator().each(function (key) {
            reduceKeys.push(key);
            return true;
        });
        log.audit('REDUCE keys processed', reduceKeys);
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
