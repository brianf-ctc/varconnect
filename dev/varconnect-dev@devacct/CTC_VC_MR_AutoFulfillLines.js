/**
 * Copyright (c) 2025 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author ajdeleon
 * @clickUpId CPDT-2135
 */

/*jshint esversion: 9 */
define((require) => {
    const search = require('N/search'),
        record = require('N/record'),
        runtime = require('N/runtime'),
        error = require('N/error'),
        EntryPoint = {},
        SCRIPT_PARAMETER_NAMES = {
            poId: { optional: true, id: 'custscript_vc_afl_poid' }
        };

    EntryPoint.getInputData = () => {
        return search.load({
            id: 'customsearch_ctc_vc_auto_fulfill_lines',
            type: 'purchaseorder'
        });
    };

    EntryPoint.map = (context) => {
        let objValue = JSON.parse(context.value);
        let objValues = objValue.values;

        let itemId = objValues.item.value;
        let soId = objValues.createdfrom.value;

        let itemFulfilled = isItemFulfilled(itemId, soId);
        log.debug(`map | isItemFulfilled: ${itemFulfilled}`, `item ID: ${itemId} | So ID:${soId}`);

        if (itemFulfilled === false) {
            context.write({
                key: soId,
                value: objValues
            });
        }
    };

    EntryPoint.reduce = (context) => {
        log.debug('reduce context', context);
        let arrValues = context.values;
        arrValues = arrValues.map(JSON.parse);
        let stSoId = context.key;

        let objRec = record.transform({
            fromType: record.Type.SALES_ORDER,
            fromId: stSoId,
            toType: record.Type.ITEM_FULFILLMENT,
            isDynamic: true,
            ignoreMandatoryFields: true
        });
        //temporary
        objRec.setValue({
            fieldId: 'custbody_cust_priority',
            value: 1
        });

        objRec.setValue({
            fieldId: 'shipstatus',
            value: 'C'
        });
        let ifId = objRec.save();
        log.audit('ifId', ifId);
    };

    EntryPoint.summarize = (summary) => {
        let type = summary.toString();
        log.audit(
            '[Summarize] ' + type,
            'Usage Consumed: ' +
                summary.usage +
                ' | Number of Queues: ' +
                summary.concurrency +
                ' | Number of Yields: ' +
                summary.yields
        );
        summary.output.iterator().each(function (key, value) {
            log.debug('summary', `key: ${key} | value: ${value}`);
            return true;
        });
        logErrorIfAny(summary);
    };

    const logErrorIfAny = (summary) => {
        let inputSummary = summary.inputSummary;
        let mapSummary = summary.mapSummary;
        let reduceSummary = summary.reduceSummary;
        //get input data error
        if (inputSummary.error) {
            log.error('input error', inputSummary.error);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    };

    const handleErrorInStage = (stage, summary) => {
        let errorMsg = [];
        summary.errors.iterator().each(function (key, value) {
            let msg = 'SCRIPT FAILURE: ' + key + '. Error was:' + JSON.parse(value).message;
            errorMsg.push(msg);
            return true;
        });
        if (errorMsg.length > 0) {
            log.error(stage, JSON.stringify(errorMsg));
        }
    };

    const isItemFulfilled = (itemId, soId) => {
        let objIfSearch = search.create({
            type: 'itemfulfillment',
            filters: [
                ['type', 'anyof', 'ItemShip'],
                'AND',
                ['item', 'anyof', itemId],
                'AND',
                ['createdfrom', 'anyof', soId]
            ],
            columns: ['internalid', 'statusref']
        });
        let searchCount = objIfSearch.runPaged().count;
        if (searchCount >= 1) {
            return true;
        }
        return false;
    };

    const Helper = {
        getScriptParameters: () => {
            var stLogTitle = 'getScriptParameters';
            var parametersMap = {};
            var scriptContext = runtime.getCurrentScript();
            var obj;
            var value;
            var optional;
            var id;
            var arrMissingParams = [];

            for (let key in SCRIPT_PARAMETER_NAMES) {
                if (SCRIPT_PARAMETER_NAMES.hasOwnProperty(key)) {
                    obj = SCRIPT_PARAMETER_NAMES[key];
                    if (typeof obj === 'string') {
                        value = scriptContext.getParameter(obj);
                    } else {
                        id = obj.id;
                        optional = obj.optional;
                        value = scriptContext.getParameter(id);
                    }
                    if (value || value === false || value === 0) {
                        parametersMap[key] = value;
                    } else if (!optional) {
                        arrMissingParams.push(key + '[' + id + ']');
                    }
                }
            }

            if (arrMissingParams && arrMissingParams.length) {
                var objError = {};
                objError.name = 'Missing Script Parameter Values';
                objError.message =
                    'The following script parameters are empty: ' + arrMissingParams.join(', ');
                objError = error.create(objError);
                for (let key in parametersMap) {
                    if (parametersMap.hasOwnProperty(key)) {
                        objError[key] = parametersMap[key];
                    }
                }
                throw objError;
            }
            log.audit(stLogTitle, parametersMap);
            return parametersMap;
        }
    };

    return EntryPoint;
});
