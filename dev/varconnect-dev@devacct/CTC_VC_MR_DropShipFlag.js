/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 *
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author ajdeleon
 **/

/*jshint esversion: 9 */
define((require) => {
    const ns_record = require('N/record'),
        ns_error = require('N/error'),
        ns_runtime = require('N/runtime'),
        EntryPoint = {},
        SCRIPT_LOGS = {},
        SCRIPT_PARAMETER_NAMES = {
            recordType: { optional: false, id: 'custscript_vc_dsf_recordtype' },
            recordId: { optional: false, id: 'custscript_vc_dsf_recordid' }
        };

    EntryPoint.getInputData = () => {
        let objParams = Helper.getScriptParameters();
        return [
            {
                recordType: objParams.recordType,
                recordId: objParams.recordId
            }
        ];
    };

    EntryPoint.reduce = (context) => {
        let arrValues = context.values;
        arrValues = arrValues.map(JSON.parse);
        SCRIPT_LOGS.arrValues = arrValues;

        for (let i = 0; i < arrValues.length; i++) {
            let recordId = arrValues[i].recordId;
            let recordType = arrValues[i].recordType;
            let isUpdated = setDropShip(recordType, recordId);

            SCRIPT_LOGS.isUpdated = isUpdated;

            if (isUpdated === true) {
                context.write({
                    key: recordId,
                    value: `Successfully updated ${recordType} record with ID ${recordId}`
                });
            }
        }

        log.debug('SCRIPT_LOGS', SCRIPT_LOGS);
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
            log.audit(`summarize`, `${key} - ${value}`);
            return true;
        });
        logErrorIfAny(summary);
    };

    const setDropShip = (recordType, recordId) => {
        SCRIPT_LOGS.recordType = recordType;
        SCRIPT_LOGS.recordId = recordId;

        //load record since 'dropshipso' cannot be fetched using lookupfields.
        let objRec = ns_record.load({
                type: recordType,
                id: recordId
            }),
            dropShip = objRec.getValue({ fieldId: 'dropshipso' });
        createdFrom = objRec.getValue({ fieldId: 'createdfrom' });

        SCRIPT_LOGS.dropShip = dropShip;
        SCRIPT_LOGS.createdFrom = createdFrom;

        if (!Helper.isEmpty(createdFrom) && !Helper.isEmpty(dropShip)) {
            //submit fields to prevent 'record has been changed' error
            ns_record.submitFields({
                type: recordType,
                id: recordId,
                values: {
                    custbody_isdropshippo: true
                },
                ignoreMandatoryFields: true
            });
            return true;
        }
    };

    const logErrorIfAny = (summary) => {
        let inputSummary = summary.inputSummary;
        let mapSummary = summary.mapSummary;
        let reduceSummary = summary.reduceSummary;
        //get input data ns_error
        if (inputSummary.error) {
            let e = ns_error.create({
                name: 'Error on Get Input Data',
                message: inputSummary.error
            });
            log.error('Input Data', e.message);
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

    const Helper = {
        getScriptParameters: () => {
            var stLogTitle = 'getScriptParameters';
            var parametersMap = {};
            var scriptContext = ns_runtime.getCurrentScript();
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
                objError = ns_error.create(objError);
                for (let key in parametersMap) {
                    if (parametersMap.hasOwnProperty(key)) {
                        objError[key] = parametersMap[key];
                    }
                }
                throw objError;
            }
            log.audit(stLogTitle, parametersMap);
            return parametersMap;
        },
        isEmpty: (stValue) => {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isString(stValue) && stValue.trim() === '') ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (let k in v) return false;
                        return true;
                    })(stValue))
            );
        }
    };

    return EntryPoint;
});
