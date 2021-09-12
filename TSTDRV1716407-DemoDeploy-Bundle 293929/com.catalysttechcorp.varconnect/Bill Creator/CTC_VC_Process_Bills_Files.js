        /**
         * @NApiVersion 2.1
         * @NScriptType MapReduceScript
         */


        define(['N/search', 'N/record', 'N/runtime', 'N/error', 'N/log', 'N/https', './Libraries/moment', 'N/runtime'],
            function(search, record, runtime, error, log, https, moment, runtime) {

                var BILL_FILE_STATUS = {
                    PENDING: 1,
                    ERROR: 2,
                    PROCESSED: 3,
                    REPROCESS: 4,
                    CLOSED: 5,
                    HOLD: 6,
                    VARIANCE: 7
                };
                var MESSAGE_CODE = {
                    PO_IS_MISSING: 'Purchase Order Required',
                    PO_NOT_BILLABLE: 'Purchase Order not Ready to Bill',
                    NOT_FULLY_PROCESS: 'Could not fully process Bill File',
                    ALREADY_BILLED: 'Item are already billed',
                    LINK_EXISTING_BILLS: 'Linked to existing Vendor Bill',
                    HAS_VARIANCE: 'One or More Variances in Vendor Bill',
                    BILL_CREATED: 'Created Vendor Bill',
                    BILL_NOT_CREATED: 'Failed to create the Vendor Bill'
                };
               
                function getInputData() {

                    var billInAdvance = runtime.getCurrentScript().getParameter({
                        name: 'custscript_ctc_vc_bc_bill_in_adv'
                    });    
    
                    var filters = [
                        ["custrecord_ctc_vc_bill_linked_bill", "anyof", "@NONE@"],
                        "AND", ["custrecord_ctc_vc_bill_proc_status", "anyof", "1", "4"], // pending, reprocess
                        "AND", ["custrecord_ctc_vc_bill_linked_po.mainline", "is", "T"]
                    ];

                    // B = Pending Receipt
                    // D = Partially Received
                    // E = Pending Billing/Partially Received
                    // F = Pending Bill
                    // G = Fully Billed

                    if (billInAdvance == true){
                        // include all applicable statuses
                        filters.push("AND");
                        filters.push(["custrecord_ctc_vc_bill_linked_po.status", "anyof", "PurchOrd:B", "PurchOrd:D", "PurchOrd:E", "PurchOrd:F", "PurchOrd:G"])
                    } else {
                        // only include statuses that have been received and are ready to be billed
                        filters.push("AND");
                        filters.push(["custrecord_ctc_vc_bill_linked_po.status", "anyof", "PurchOrd:E", "PurchOrd:F", "PurchOrd:G"])
                    }

                    var billFileId = runtime.getCurrentScript().getParameter({name:'custscript_ctc_vc_bc_bill_fileid'});
                    if (billFileId) {
                            filters.push("AND");
                            filters.push(["internalid", "anyof", billFileId]);
                    }

                    return search.create({
                        type: "customrecord_ctc_vc_bills",
                        filters: filters,
                        columns: [
                            "internalid",
                            "custrecord_ctc_vc_bill_po",
                            "custrecord_ctc_vc_bill_number",
                            "custrecord_ctc_vc_bill_proc_status",
                            "custrecord_ctc_vc_bill_log",
                            search.createColumn({
                                name: "statusref",
                                join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO",
                                label: "Status"
                            })
                        ]
                    });


                }

                function reduce(context) {

                    var billInAdvance = runtime.getCurrentScript().getParameter({
                        name: 'custscript_ctc_vc_bc_bill_in_adv'
                    });    

                    log.debug('context', context);

                    var searchValues = JSON.parse(context.values);

                    var record_id = searchValues.id;

                    // var serialsToProcess = null;

                    log.debug('values', searchValues);

                    var parentSearchFields = ['custrecord_ctc_vc_bill_is_recievable', 'custrecord_ctc_vc_bill_log', 'custrecord_ctc_vc_bill_proc_status',
                        'custrecord_ctc_vc_bill_proc_variance', 'custrecord_ctc_vc_bill_linked_po', 'custrecord_ctc_vc_bill_json'
                    ];

                    try {

                        var rec = search.lookupFields({
                            type: 'customrecord_ctc_vc_bills',
                            id: record_id,
                            columns: parentSearchFields
                        })

                        log.debug('rec', rec);

                        var updateValues = {};

                        var restletHeaders = {
                            "Content-Type": 'application/json'
                        };

                        // var poStatus = searchValues.values['statusref.CUSTRECORD_CTC_VC_BILL_LINKED_PO'].text;

                        // var isRecievable = rec.custrecord_ctc_vc_bill_is_recievable;

                        // if (poStatus == 'Pending Receipt' || poStatus == 'Partially Received' || poStatus == 'Pending Billing/Partially Received') {

                        //     if (isRecievable == true) {

                        //         var createFulfillmentResponse = https.requestRestlet({
                        //             headers: restletHeaders,
                        //             scriptId: 'customscript_vc_if_ir_restlet',
                        //             deploymentId: 'customdeploy1',
                        //             method: 'POST',
                        //             body: JSON.stringify(rec)
                        //         });

                        //         log.debug('createFulfillmentResponse', createFulfillmentResponse.code + ': ' + createFulfillmentResponse.body);

                        //         log.debug('serialObj', JSON.parse(createFulfillmentResponse.body).serialObj);

                        //         var currentMessages = rec.custrecord_ctc_vc_bill_log;

                        //         if (createFulfillmentResponse.code !== 200) {
                        //             updateValues.custrecord_ctc_vc_bill_proc_status = 2; //error

                        //             var newMessage = moment().format('MM-DD-YY') + ' - ' + 'Error Creating Fulfillment: ' + createFulfillmentResponse.body;

                        //             updateValues.custrecord_ctc_vc_bill_log = currentMessages + '\r\n' + newMessage;

                        //             record.submitFields({
                        //                 type: 'customrecord_ctc_vc_bills',
                        //                 id: record_id,
                        //                 values: updateValues
                        //             });

                        //             return;

                        //         } else {

                        //             var newMessage = '';

                        //             if (createFulfillmentResponse.body.hasOwnProperty('serialObj')) {
                        //                 serialsToProcess = JSON.parse(createFulfillmentResponse.body).serialObj;
                        //                 newMessage = moment().format('MM-DD-YY') + ' - ' + 'Created Fulfillment';
                        //             }                                

                        //             var responseJson = JSON.parse(createFulfillmentResponse.body)

                        //             if (responseJson.hasOwnProperty('msg')) {
                        //                 newMessage = moment().format('MM-DD-YY') + ' - ' + responseJson.msg;
                        //                 updateValues.custrecord_ctc_vc_bill_proc_status = 2; //error
                        //             }

                        //             updateValues.custrecord_ctc_vc_bill_log = currentMessages + '\r\n' + newMessage;

                        //             record.submitFields({
                        //                 type: 'customrecord_ctc_vc_bills',
                        //                 id: record_id,
                        //                 values: updateValues
                        //             });
                        //         }
                        //     }
                        // }

                        // get any updated values from the record

                        rec = search.lookupFields({
                            type: 'customrecord_ctc_vc_bills',
                            id: record_id,
                            columns: parentSearchFields
                        })

                        var requestObj = JSON.parse(JSON.stringify(rec));

                        requestObj.billInAdvance = billInAdvance;

                        var createBillResponse = https.requestRestlet({
                            headers: restletHeaders,
                            scriptId: 'customscript_vc_bill_creator_restlet',
                            deploymentId: 'customdeploy1',
                            method: 'POST',
                            body: JSON.stringify(requestObj)
                        });

                        var r = JSON.parse(createBillResponse.body);

                        log.debug('createBillResponse', createBillResponse.body);

                        if (r.billStatus) {
                                updateValues.custrecord_ctc_vc_bill_proc_status = r.billStatus;
                        }
                        if (r.msg) {
                                var currentMessages = rec.custrecord_ctc_vc_bill_log;
                                var newMessage = moment().format('MM-DD-YY') + ' - ' + r.msg;
                                updateValues.custrecord_ctc_vc_bill_log = currentMessages + '\r\n' + newMessage;
                        }
                        if (r.id) {
                                updateValues.custrecord_ctc_vc_bill_linked_bill = r.id;        
                        }

                        /*
                        if (r.hasOwnProperty('id') == true) {
                            updateValues.custrecord_ctc_vc_bill_linked_bill = r.id;
                            if (r.hasOwnProperty('close')) {
                                updateValues.custrecord_ctc_vc_bill_proc_status = 5; //closed
                            } else {
                                updateValues.custrecord_ctc_vc_bill_proc_status = 3; //processed
                            }

                        } else {
                            var currentStatus = rec.custrecord_ctc_vc_bill_proc_status[0].value;
                            if (r.msg == 'Purchase Order not Ready to Bill') {
                                updateValues.custrecord_ctc_vc_bill_proc_status = 1; //pending
                            } else if (r.msg == 'One or More Variances in Vendor Bill') {
                                updateValues.custrecord_ctc_vc_bill_proc_status = 7; //variance
                            } else if (currentStatus == '4' || currentStatus == '1') {
                                updateValues.custrecord_ctc_vc_bill_proc_status = 2; //error
                            }
                        }

                        if (r.hasOwnProperty('msg') == true) {
                            if (r.msg !== 'Purchase Order not Ready to Bill') {
                                var currentMessages = rec.custrecord_ctc_vc_bill_log;
                                var newMessage = moment().format('MM-DD-YY') + ' - ' + r.msg;
                                updateValues.custrecord_ctc_vc_bill_log = currentMessages + '\r\n' + newMessage;
                            }
                        }
                        */

                        //if the updateValues object isn't empty update the record
                        if (JSON.stringify(updateValues).length > 2) {

                            record.submitFields({
                                type: 'customrecord_ctc_vc_bills',
                                id: record_id,
                                values: updateValues
                            });

                        }

                        // log.debug('serialsToProcess', serialsToProcess);

                        // if (serialsToProcess) {

                        //     for (var i = 0; i < serialsToProcess.lines.length; i++) {

                        //         var requestObj = {};
                        //         requestObj.lineToProcess = i;
                        //         requestObj.serialObj = serialsToProcess;

                        //         var createSerialResponse = https.requestRestlet({
                        //             headers: restletHeaders,
                        //             scriptId: 'customscript_vc_serial_record_restlet',
                        //             deploymentId: 'customdeploy1',
                        //             method: 'POST',
                        //             body: JSON.stringify(requestObj)
                        //         });

                        //         log.debug('createSerialResponse', createSerialResponse.code + ': ' + createSerialResponse.body);

                        //     }
                        // }

                    } catch (e) {
                        log.error(context.key + ': ' + 'Error encountered in reduce', e);
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
                        var e = error.create({
                            name: 'INPUT_STAGE_FAILED',
                            message: inputSummary.error
                        });
                        log.error('Stage: getInputData failed', e);
                    }
                    handleErrorInStage('map', mapSummary);
                    handleErrorInStage('reduce', reduceSummary);
                }

                function handleErrorInStage(stage, summary) {

                    summary.errors.iterator().each(function(key, value) {
                        log.error(key, value);
                        return true;
                    });
                }

                function createSummaryRecord(summary) {
                    try {

                        var summaryJson = {
                            script: runtime.getCurrentScript().id,
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
