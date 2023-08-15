/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/file',
    './CTC_VC_Lib_Serials.js'
], function (ns_search, ns_runtime, ns_record, ns_file, vc_serialLib) {
    function getInputData() {
        log.audit('getInputData');
        var fileId = ns_runtime
            .getCurrentScript()
            .getParameter('custscript_serialsFileId');
        log.debug('fileId param', fileId);

        var serialArray = [];
        var fileObj = ns_file.load({
            id: fileId
        });

        var fileContents = JSON.parse(fileObj.getContents());
        var poId = fileContents.poId;
        var soId = fileContents.soId;
        for (i in fileContents.items) {
            var itemId = fileContents.items[i].itemId;
            var serials = fileContents.items[i].serials;

            for (j in serials) {
                var line = {
                    poId: poId,
                    soId: soId,
                    itemId: itemId,
                    serial: serials[j]
                };
                log.debug('line to add', line);
                serialArray.push({
                    poId: poId,
                    soId: soId,
                    itemId: itemId,
                    serialNum: serials[j]
                });
            }
        }

        log.debug(serialArray);

        return serialArray;
    }

    function reduce(context) {
        // reduce runs on each serial number to save it
        // each instance of reduce has 5000 unit and this way there will be a new one for each line

        //var serial = context.key;
        var data = JSON.parse(context.values[0]);
        var poId = data.poId;
        var soId = data.soId;
        var itemNum = data.itemId;
        var serialNum = data.serialNum;

        log.debug('reduce serial', serialNum);
        log.debug('reduce poId', poId);
        log.debug('reduce soId', soId);
        log.debug('reduce itemNum', itemNum);
        vc_serialLib.createSerial(serialNum, poId, itemNum, soId);
    }

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
