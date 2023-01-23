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
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Constants'
], function (
    ns_search,
    ns_record,
    ns_runtime,
    ns_error,
    ns_https,
    ns_config,
    moment,
    vc_billfile,
    vc2_util,
    vc2_constant
) {
    var LogTitle = 'VC PROCESS BILL',
        LogPrefix = '',
        BILL_CREATOR = vc2_constant.Bill_Creator,
        BILL_FILE = vc2_constant.RECORD.BILLFILE,
        BILLFILE_FLD = vc2_constant.RECORD.BILLFILE.FIELD;

    var SCRIPT = {
        RL_ITEMFF: {
            ID: 'customscript_vc_if_ir_restlet',
            DEPLOY: 'customdeploy1'
        },
        RL_BILLCREATE: {
            ID: 'customscript_vc_bill_creator_restlet',
            DEPLOY: 'customdeploy1'
        },
        RL_SERIALS: {
            ID: 'customscript_vc_serial_record_restlet',
            DEPLOY: 'customdeploy1'
        }
    };

    var MAP_REDUCE = {
        getInputData: function () {
            var logTitle = [LogTitle, 'getInputData'].join(':');

            log.debug(logTitle, '*** START SCRIPT ***');

            var ScriptParam = {
                billFileID: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_fileid'
                }),
                billInAdv: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_in_adv'
                })
            };

            ////// SEARCH OPTION //////////////
            var searchOption = {
                type: BILL_FILE.ID,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    [BILLFILE_FLD.BILL_LINK, 'anyof', '@NONE@'],
                    'AND',
                    [BILLFILE_FLD.PO_LINK, 'noneof', '@NONE@'],
                    'AND',
                    [BILLFILE_FLD.PO_LINK + '.mainline', 'is', 'T'],
                    'AND',
                    [
                        // PENDING PROCESS  or RE-PROCESS STATUS
                        [
                            BILLFILE_FLD.STATUS,
                            'anyof',
                            BILL_CREATOR.Status.PENDING,
                            BILL_CREATOR.Status.REPROCESS,
                            BILL_CREATOR.Status.ERROR
                        ],
                        'OR',
                        [
                            // PROCESSED and PO is already CLOSED or BILLED
                            [
                                BILLFILE_FLD.STATUS,
                                'noneof',
                                BILL_CREATOR.Status.ERROR,
                                BILL_CREATOR.Status.PROCESSED,
                                BILL_CREATOR.Status.CLOSED
                            ],
                            'AND',
                            [
                                BILLFILE_FLD.PO_LINK + '.status',
                                'anyof',
                                'PurchOrd:H', // Fully Billed
                                'PurchOrd:G' // Closed
                            ]
                        ]
                    ]
                ],
                columns: [
                    'internalid',
                    BILLFILE_FLD.POID,
                    BILLFILE_FLD.BILL_NUM,
                    BILLFILE_FLD.STATUS,
                    BILLFILE_FLD.PROCESS_LOG,
                    BILLFILE_FLD.PO_LINK,
                    ns_search.createColumn({
                        name: 'entity',
                        join: BILLFILE_FLD.PO_LINK
                    }),
                    ns_search.createColumn({
                        name: 'statusref',
                        join: BILLFILE_FLD.PO_LINK
                    }),
                    ns_search.createColumn({
                        name: 'status',
                        join: BILLFILE_FLD.PO_LINK
                    })
                ]
            };

            if (ScriptParam.billFileID) {
                Helper.updateBillFile({
                    internalId: ScriptParam.billFileID,
                    updateValues: {
                        custrecord_ctc_vc_bill_proc_statu: BILL_CREATOR.Status.REPROCESS
                    }
                });

                searchOption.filters.push('AND');
                searchOption.filters.push(['internalid', 'anyof', ScriptParam.billFileID]);
            }
            log.debug(logTitle, '>> searchOption: ' + JSON.stringify(searchOption));

            var searchObj = ns_search.create(searchOption);
            var totalPending = searchObj.runPaged().count;
            log.audit(logTitle, '>> Bills To Process: ' + totalPending);

            return searchObj;
        },

        reduce: function (context) {
            var logTitle = [LogTitle, 'reduce'].join(':');

            var ScriptParam = {
                billFileID: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_fileid'
                }),
                billInAdv: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_in_adv'
                })
            };

            log.debug(logTitle, '>> ScriptParam: ' + JSON.stringify(ScriptParam));
            log.debug(logTitle, '>> total to process: ' + JSON.stringify(context.values.length));

            // var serialsToProcess = null;
            for (var i = 0, j = context.values.length; i < j; i++) {
                var currentData = JSON.parse(context.values[i]);
                var updateValues = {};

                try {
                    var poId = currentData.values[BILLFILE_FLD.PO_LINK].value;
                    LogPrefix = '[purchaseorder:' + poId + ' ]';

                    log.audit(logTitle, LogPrefix + ' ... currentData: ' + JSON.stringify(currentData));

                    var vendorCfg = Helper.loadVendorConfig({
                        entity: currentData.values['entity.' + BILLFILE_FLD.PO_LINK].value
                    });

                    var requestBillFile = Helper.fetchBillFile({ internalId: currentData.id });
                    log.audit(logTitle, LogPrefix + ' ... billFileData: ' + JSON.stringify(requestBillFile));

                    // check the PO Status
                    var poStatus = currentData.values['statusref.' + BILLFILE_FLD.PO_LINK];
                    log.audit(logTitle, LogPrefix + ' ... po status: ' + JSON.stringify(poStatus));

                    var isBillReceivable = requestBillFile[BILLFILE_FLD.IS_RCVBLE];
                    log.audit(logTitle, LogPrefix + ' ... isBillReceivable: ' + JSON.stringify(isBillReceivable));

                    var isOrderReceivable = vc2_util.inArray(poStatus.value, [
                        'pendingReceipt',
                        'partiallyReceived',
                        'pendingBillPartReceived'
                    ]);
                    log.audit(logTitle, LogPrefix + '... isOrderReceivable: ' + JSON.stringify(isOrderReceivable));

                    var respItemff = {};
                    if (vendorCfg.ENABLE_FULFILLLMENT && isBillReceivable && isOrderReceivable) {
                        respItemff = Helper.createItemFulfillment({
                            currentData: currentData,
                            billFileData: requestBillFile
                        });
                    }

                    // get any updated values from the record
                    var reqBillCreate = util.extend(JSON.parse(JSON.stringify(requestBillFile)), {
                        paramBillInAdv: ScriptParam.billInAdv,
                        billFileId: currentData.id
                    });

                    log.debug(logTitle, '>> requestObj: ' + JSON.stringify(reqBillCreate));

                    var respBillCreate = ns_https.requestRestlet({
                        headers: { 'Content-Type': 'application/json' },
                        scriptId: SCRIPT.RL_BILLCREATE.ID,
                        deploymentId: SCRIPT.RL_BILLCREATE.DEPLOY,
                        method: 'POST',
                        body: JSON.stringify(reqBillCreate)
                    });

                    var respBody = JSON.parse(respBillCreate.body);
                    log.debug(logTitle, '>> responseBody: ' + JSON.stringify(respBody));

                    if (respBody.status) {
                        updateValues[BILLFILE_FLD.STATUS] = respBody.status;
                    }

                    if (respBody.msg) {
                        updateValues[BILLFILE_FLD.PROCESS_LOG] = vc_billfile.addNote({
                            note: respBody.msg,
                            current: requestBillFile[BILLFILE_FLD.PROCESS_LOG]
                        });
                    }

                    if (respBody.id) {
                        updateValues[BILLFILE_FLD.BILL_LINK] = respBody.id;
                    }

                    if (respBody.varianceLines) {
                        var jsonData = JSON.parse(requestBillFile[BILLFILE_FLD.JSON]);
                        jsonData.varianceLines = respBody.varianceLines;
                        updateValues[BILLFILE_FLD.JSON] = JSON.stringify(jsonData);
                    }

                    log.debug(logTitle, '>> update fields: ' + JSON.stringify(updateValues));

                    //if the updateValues object isn't empty update the record
                    if (!vc2_util.isEmpty(updateValues)) {
                        ns_record.submitFields({
                            type: BILL_FILE.ID,
                            id: currentData.id,
                            values: updateValues
                        });
                    }
                } catch (e) {
                    log.error(context.key + ': ' + 'Error encountered in reduce', e);
                }
            }
        },

        summarize: function (summary) {
            handleErrorIfAny(summary);
            createSummaryRecord(summary);
        }
    };

    var Helper = {
        fetchBillFile: function (option) {
            if (!option.internalId) return false;
            var parentSearchFields = [
                BILLFILE_FLD.IS_RCVBLE,
                BILLFILE_FLD.PROCESS_LOG,
                BILLFILE_FLD.STATUS,
                BILLFILE_FLD.PROC_VARIANCE,
                BILLFILE_FLD.PO_LINK,
                BILLFILE_FLD.JSON
            ];

            return ns_search.lookupFields({
                type: BILL_FILE.ID,
                id: option.internalId,
                columns: parentSearchFields
            });
        },
        updateBillFile: function (option) {
            var updateValues = option.updateValues || {};

            if (option.notes) {
                vc_billfile.addNote({
                    id: option.internalId,
                    note: option.notes
                });

                // var arrNotes = [];
                // if (option.current && option.current.custrecord_ctc_vc_bill_log) {
                //     arrNotes.push(option.current.custrecord_ctc_vc_bill_log);
                // }
                // arrNotes.push(moment().format('MM-DD-YY') + ' - ' + option.notes);
                // updateValues.custrecord_ctc_vc_bill_log = arrNotes.join('\r\n');
            }

            var hasValues = false,
                val;
            for (val in updateValues) hasValues = true;
            if (!hasValues || !option.internalId) return false;

            ns_record.submitFields({
                type: BILL_FILE.ID,
                id: option.internalId,
                values: updateValues
            });

            return updateValues;
        },
        cleanUpLogs: function (option) {
            var billFileValues = Helper.fetchBillFile(option);
            var logNotes = billFileValues.custrecord_ctc_vc_bill_log;

            var logLines = [];
            logNotes.split(/\n/g).map(function (str) {
                if (logLines.indexOf(str) < 0) logLines.push(str);
                return true;
            });

            Helper.updateBillFile({
                internalId: option.internalId,
                updateValues: {
                    custrecord_ctc_vc_bill_log: logLines.join('\n')
                }
            });
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
                returnValue;
            var entityId = option.entity;
            var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

            try {
                var searchOption = {
                    type: 'vendor',
                    filters: [['internalid', 'anyof', entityId]],
                    columns: []
                };

                for (var field in BILLCREATE_CFG.FIELD) {
                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        })
                    );
                }

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count) throw 'No config available';

                returnValue = {};
                searchObj.run().each(function (row) {
                    for (var field in BILLCREATE_CFG.FIELD) {
                        returnValue[field] = row.getValue({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        });
                    }
                    return true;
                });

                log.audit(logTitle, LogPrefix + '// config: ' + JSON.stringify(returnValue));
            } catch (error) {
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
            }

            return returnValue;
        },
        createItemFulfillment: function (option) {
            var logTitle = [LogTitle, 'createItemFulfillment'].join('::'),
                returnValue = true;

            try {
                var recordData = option.currentData,
                    billFileData = option.billFileData;

                log.audit(logTitle, LogPrefix + '>> recordData   : ' + JSON.stringify(recordData));
                log.audit(logTitle, LogPrefix + '>> billFileData   : ' + JSON.stringify(billFileData));

                var respItemFF = ns_https.requestRestlet({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    scriptId: SCRIPT.RL_ITEMFF.ID,
                    deploymentId: SCRIPT.RL_ITEMFF.DEPLOY,
                    body: JSON.stringify(billFileData)
                });

                log.audit(logTitle, LogPrefix + '>> response-itemff   : ' + JSON.stringify(respItemFF));

                if (respItemFF.code == 200) {
                    var respBody = JSON.parse(respItemFF.body);
                    if (!respBody) throw 'Unable to parse response body';

                    log.audit(logTitle, LogPrefix + '>> respBody   : ' + JSON.stringify(respBody));

                    if (respBody.isError) throw respBody.errorMsg || respBody.msg;

                    if (respBody.itemff) {
                        vc_billfile.addNote({
                            id: recordData.id,
                            note: 'Item Fulfillment succesfully created...  ' + ('[id:' + respBody.itemff + ']')
                        });
                    }

                    if (respBody.serialData) {
                        log.audit(
                            logTitle,
                            LogPrefix + '/// Processing serials...  ' + JSON.stringify(respBody.serialData)
                        );

                        var serialsToProcess = respBody.serialData;

                        for (var i = 0; i < serialsToProcess.lines.length; i++) {
                            var requestObj = {};
                            requestObj.lineToProcess = i;
                            requestObj.serialObj = serialsToProcess;

                            var respSerials = ns_https.requestRestlet({
                                headers: { 'Content-Type': 'application/json' },
                                scriptId: SCRIPT.RL_SERIALS.ID,
                                deploymentId: SCRIPT.RL_SERIALS.DEPLOY,
                                method: 'POST',
                                body: JSON.stringify({
                                    lineToProcess: i,
                                    serialObj: serialsToProcess
                                })
                            });

                            log.debug(logTitle, LogPrefix + '// serials: ' + JSON.stringify(respSerials));
                        }
                    }
                } else {
                    /// ERROR //////////////
                    vc_billfile.addNote({
                        id: recordData.id,
                        note: 'Error creating fulfillment : ' + respItemFF.body
                    });

                    Helper.updateBillFile({
                        internalId: recordData.id,
                        current: billFileData,
                        updateValues: {
                            custrecord_ctc_vc_bill_proc_status: BILL_CREATOR.Status.ERROR
                        }
                    });
                    throw 'Error creating fulfillment: ' + respItemFF.body;
                    ////////////////////////////
                }
            } catch (error) {
                log.error(logTitle, LogPrefix + '** ERROR **' + vc2_util.extractError(error));
                returnValue = false;
            }

            return returnValue;
        }
    };

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

    return MAP_REDUCE;
});
