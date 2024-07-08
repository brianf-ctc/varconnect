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
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/error',
    'N/https',
    'N/config',
    './Libraries/moment',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './../CTC_VC_Constants'
], function (
    ns_search,
    ns_record,
    ns_runtime,
    ns_error,
    ns_https,
    ns_config,
    moment,
    vcBillFile,
    VC_Constants
) {
    var LOG_TITLE = 'VC_PROC_BILL_MR',
        LOG_APP = 'Process Bills (MR)',
        BILL_CREATOR = VC_Constants.Bill_Creator,
        CURRENT_PO = '';

    function _getDateFormat() {
        var logTitle = [LOG_TITLE, '_getDateFormat'].join(':');

        var generalPref = ns_config.load({
            type: ns_config.Type.COMPANY_PREFERENCES
        });
        var dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
        log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
        return dateFormat;
    }

    function getInputData() {
        var logTitle = [LOG_TITLE, 'getInputData'].join(':');

        log.debug(logTitle, '*** START SCRIPT ***');

        var billInAdvance = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_bill_in_adv'
        });

        var filters = [
            ['custrecord_ctc_vc_bill_linked_bill', 'anyof', '@NONE@'],
            'AND',
            [
                'custrecord_ctc_vc_bill_proc_status',
                'anyof',
                BILL_CREATOR.Status.PENDING,
                BILL_CREATOR.Status.REPROCESS,
                BILL_CREATOR.Status.ERROR
            ],
            'AND',
            ['custrecord_ctc_vc_bill_linked_po.mainline', 'is', 'T']
        ];

        // added isolate bill file id //
        // @bfeliciano
        var billFileId = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_bill_fileid'
        });

        if (billFileId) {
            var updateValues = {
                custrecord_ctc_vc_bill_proc_statu: BILL_CREATOR.Status.REPROCESS
            };

            // log.debug(logTitle, '>> updateValues: ' + JSON.stringify(updateValues));

            ns_record.submitFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                values: updateValues,
                options: {
                    enablesourcing: true,
                    ignoreMandatoryFields: true
                }
            });

            log.debug(logTitle, '>> billFileId: ' + JSON.stringify(billFileId));
            filters.push('AND');
            filters.push(['internalid', 'anyof', billFileId]);
            // } else {
            // if (billInAdvance == true) {
            //     // include all applicable statuses
            //     filters.push('AND');
            //     filters.push([
            //         'custrecord_ctc_vc_bill_linked_po.status',
            //         'anyof',
            //         'PurchOrd:B', // PendingReceipt
            //         'PurchOrd:D', // PartiallyReceived
            //         'PurchOrd:E', // PendingBilling_PartiallyReceived
            //         'PurchOrd:F', // PendingBill
            //         'PurchOrd:G' // FullyBilled
            //     ]);
            // } else {
            //     // only include statuses that have been received and are ready to be billed
            //     filters.push('AND');
            //     filters.push([
            //         'custrecord_ctc_vc_bill_linked_po.status',
            //         'anyof',
            //         'PurchOrd:E', // PendingBilling_PartiallyReceived
            //         'PurchOrd:F', // PendingBill
            //         'PurchOrd:G' // FullyBilled
            //     ]);
            // }
        }

        // end
        // filters.push('OR');
        // filters.push(['custrecord_ctc_vc_bill_linked_po','anyof','@NONE@']);
        log.debug(logTitle, '>> filters: ' + JSON.stringify({ filters: filters }));

        return ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: filters,
            columns: [
                'internalid',
                'custrecord_ctc_vc_bill_po',
                'custrecord_ctc_vc_bill_number',
                'custrecord_ctc_vc_bill_proc_status',
                'custrecord_ctc_vc_bill_log'
            ]
        });
    }

    function reduce(context) {
        var logTitle = [LOG_TITLE, 'reduce'].join(':');

        var billInAdvance = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_bill_in_adv'
        });

        log.debug(logTitle, '>> context: ' + JSON.stringify(context));
        log.debug(logTitle, '>> total to process: ' + JSON.stringify(context.values.length));

        // var serialsToProcess = null;

        var parentSearchFields = [
            'custrecord_ctc_vc_bill_is_recievable',
            'custrecord_ctc_vc_bill_log',
            'custrecord_ctc_vc_bill_proc_status',
            'custrecord_ctc_vc_bill_proc_variance',
            'custrecord_ctc_vc_bill_linked_po',
            'custrecord_ctc_vc_bill_json'
        ];

        for (var i = 0, j = context.values.length; i < j; i++) {
            var searchValues = JSON.parse(context.values[i]);

            log.debug(logTitle, '>> searchValues: ' + JSON.stringify(searchValues));
            var record_id = searchValues.id;

            try {
                var rec = ns_search.lookupFields({
                    type: 'customrecord_ctc_vc_bills',
                    id: record_id,
                    columns: parentSearchFields
                });

                log.debug(logTitle, '>> results: ' + JSON.stringify(rec));

                var updateValues = {};
                var restletHeaders = {
                    'Content-Type': 'application/json'
                };

                // get any updated values from the record
                var requestObj = JSON.parse(JSON.stringify(rec));
                log.debug(logTitle, '>> requestObj: ' + JSON.stringify(requestObj));

                requestObj.billInAdvance = billInAdvance;

                var createBillResponse = ns_https.requestRestlet({
                    headers: restletHeaders,
                    scriptId: 'customscript_vc_bill_creator_restlet',
                    deploymentId: 'customdeploy1',
                    method: 'POST',
                    body: JSON.stringify(requestObj)
                });

                var r = JSON.parse(createBillResponse.body);
                log.debug(logTitle, '>> responseBody: ' + JSON.stringify(r));

                if (r.status) {
                    updateValues.custrecord_ctc_vc_bill_proc_status = r.status;
                }

                if (r.msg) {
                    // var currentMessages = rec.custrecord_ctc_vc_bill_log;
                    // var newMessage = moment().format(_getDateFormat()) + ' - ' + r.msg;
                    // updateValues.custrecord_ctc_vc_bill_log = newMessage + '\r\n' + currentMessages;
                    updateValues.custrecord_ctc_vc_bill_log = vcBillFile.addNote({
                        note: r.msg,
                        current: rec.custrecord_ctc_vc_bill_log
                    });
                }

                if (r.id) {
                    updateValues.custrecord_ctc_vc_bill_linked_bill = r.id;
                }

                if (r.varianceLines) {
                    var jsonData = JSON.parse(rec.custrecord_ctc_vc_bill_json);
                    jsonData.varianceLines = r.varianceLines;
                    updateValues.custrecord_ctc_vc_bill_json = JSON.stringify(jsonData);
                }

                log.debug(logTitle, '>> update fields: ' + JSON.stringify(updateValues));

                //if the updateValues object isn't empty update the record
                if (JSON.stringify(updateValues).length > 2) {
                    ns_record.submitFields({
                        type: 'customrecord_ctc_vc_bills',
                        id: record_id,
                        values: updateValues
                    });
                }
            } catch (e) {
                log.error(context.key + ': ' + 'Error encountered in reduce', e);
            }
        }
    }

    function summarize(summary) {
        handleErrorIfAny(summary);
        createSummaryRecord(summary);
    }

    function handleErrorIfAny(summary) {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
        if (inputSummary.error) {
            var e = ns_error.create({
                name: 'INPUT_STAGE_FAILED',
                message: inputSummary.error
            });
            log.error('Stage: getInputData failed', e);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    }

    function handleErrorInStage(stage, summary) {
        summary.errors.iterator().each(function (key, value) {
            log.error(key, value);
            return true;
        });
    }

    function createSummaryRecord(summary) {
        try {
            var summaryJson = {
                script: ns_runtime.getCurrentScript().id,
                seconds: summary.seconds,
                usage: summary.usage,
                yields: summary.yields
            };

            log.audit('summary', summaryJson);
        } catch (e) {
            log.error('Stage: summary failed', e);
        }
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
