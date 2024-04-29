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
    './Libraries/CTC_VC_Lib_BillProcess',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',

    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Constants',
    './Libraries/moment'
], function (
    ns_search,
    ns_record,
    ns_runtime,
    ns_error,
    ns_https,
    vc_billprocess,
    vc_billfile,
    vc2_util,
    vc2_constant,
    moment
) {
    var LogTitle = 'VC PROCESS BILL',
        VCLOG_APPNAME = 'VAR Connect | Process Bill',
        LogPrefix = '',
        BILL_CREATOR = vc2_constant.Bill_Creator,
        BILL_FILE = vc2_constant.RECORD.BILLFILE,
        BILLFILE_FLD = vc2_constant.RECORD.BILLFILE.FIELD,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

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
            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;
            vc2_util.LogPrefix = 'GetInputData';

            var ScriptParam = {
                billFileID: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_fileid'
                }),
                billInAdv: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_in_adv'
                })
            };
            vc2_util.log(logTitle, '*** START SCRIPT ***', ScriptParam);

            ////// SEARCH OPTION //////////////
            var searchOption = {
                type: BILL_FILE.ID,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    // [BILLFILE_FLD.BILL_LINK, 'anyof', '@NONE@'],
                    // 'AND',
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

                // searchOption.filters.push('AND');
                searchOption.filters = ['internalid', 'anyof', ScriptParam.billFileID];
            }
            log.debug(logTitle, '>> searchOption: ' + JSON.stringify(searchOption));

            var searchObj = ns_search.create(searchOption);
            var totalPending = searchObj.runPaged().count;
            vc2_util.log(logTitle, '>> Bills To Process: ' + totalPending);

            return searchObj;
        },

        reduce: function (context) {
            var logTitle = [LogTitle, 'reduce', context.key].join(':');
            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            var ScriptParam = {
                billFileID: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_fileid'
                }),
                billInAdv: ns_runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_bc_bill_in_adv'
                })
            };
            vc2_util.log(logTitle, '/// To Process: ', context.values.length);

            // var serialsToProcess = null;
            for (var i = 0, j = context.values.length; i < j; i++) {
                var currentValues = JSON.parse(context.values[i]);

                var CurrentData = {},
                    UpdateValues = {},
                    ReturnObj = { msg: '' };

                vc2_util.log(logTitle, '/// === START =====================================///');
                vc2_util.log(logTitle, '/// CURRENT VALUES: ', currentValues);

                try {
                    vc_billprocess.resetValues();

                    var isFullyBilled = vc2_util.inArray(
                        currentValues.values['statusref.' + BILLFILE_FLD.PO_LINK].value,
                        ['fullyBilled', 'closed']
                    );

                    if (isFullyBilled) {
                        return util.extend(ReturnObj, BILL_CREATOR.Code.FULLY_BILLED);
                    }

                    vc_billprocess.loadBillFile({ id: currentValues.id });
                    var BillFileData = vc_billprocess.FlexData.BillFile;
                    vc2_util.log(logTitle, '... bill file data: ', BillFileData);

                    if (vc_billprocess.FlexData.HasErrors) {
                        return util.extend(
                            ReturnObj,
                            vc_billprocess.reportError() || { msg: 'Unexpected Error occurred.' }
                        );
                    }

                    util.extend(CurrentData, {
                        PO_ID: currentValues.values[BILLFILE_FLD.PO_LINK].value,
                        entity: currentValues.values['entity.' + BILLFILE_FLD.PO_LINK].value,
                        poStatus: currentValues.values['statusref.' + BILLFILE_FLD.PO_LINK],
                        billFileId: currentValues.id,
                        billFile: BillFileData,
                        billData: JSON.parse(BillFileData.JSON),
                        isBillReceivable: BillFileData.IS_RCVBLE
                    });

                    vc2_util.LogPrefix = '[purchaseorder:' + CurrentData.PO_ID + ' ]';
                    util.extend(CurrentData, {
                        isOrderReceivable: vc2_util.inArray(CurrentData.poStatus.value, [
                            'pendingReceipt',
                            'partiallyReceived',
                            'pendingBillPartReceived'
                        ])
                    });
                    vc2_util.log(logTitle, '... CurrentData: ', CurrentData);

                    var vendorCfg = Helper.loadVendorConfig(CurrentData);
                    var statusNote = [
                        'PO Status: ' + CurrentData.poStatus.text,
                        'Bill File receivable? ' + JSON.stringify(CurrentData.isBillReceivable),
                        'Fulfillment enabled? ' + JSON.stringify(vendorCfg.ENABLE_FULFILLLMENT)
                    ].join(' ');

                    // add it to the VC Logs
                    vc2_util.vcLog({
                        title: 'Bill Creator | Process Bill',
                        recordId: CurrentData.PO_ID,
                        message: statusNote
                    });

                    /// check for existing bill
                    var arrExistingBills = Helper.getExistingBill({
                        entity: CurrentData.entity,
                        invoiceNo: CurrentData.billData.invoice
                    });
                    vc2_util.log(logTitle, '... existing bills? ', arrExistingBills);

                    /// BILL ALREADY EXISTS //////////////////////
                    if (arrExistingBills && arrExistingBills.length) {
                        ReturnObj = vc2_util.extend(BILL_CREATOR.Code.EXISTING_BILLS, {
                            id: arrExistingBills[0].id,
                            existingBills: JSON.stringify(arrExistingBills),
                            details: [
                                'Bill #' + arrExistingBills[0].tranId,
                                ' (id:' + arrExistingBills[0].id + '). '
                            ].join('')
                        });
                        return;
                    }

                    /// ITEM FULFILLMENT  ///////////
                    var respItemff = {};
                    if (
                        vendorCfg.ENABLE_FULFILLLMENT &&
                        CurrentData.isBillReceivable &&
                        CurrentData.isOrderReceivable
                    ) {
                        respItemff = Helper.createItemFulfillment({
                            currentData: currentValues,
                            billFileData: CurrentData.billFile
                        });

                        vc2_util.log(logTitle, '... itemff response: ', respItemff);
                        if (respItemff.isError) {
                            util.extend(ReturnObj, respItemff);
                            throw respItemff.msg;
                        }
                    }
                    ////////////////////

                    /// PREPARE for BILL CREATION
                    // get any updated values from the record
                    var billCreateReqBody = util.extend(
                        vc2_util.extractValues({
                            source: CurrentData.billFile,
                            params: ['ID', 'PO_LINK', 'PROC_VARIANCE', 'IS_RCVBLE']
                        }),
                        {
                            paramBillInAdv: ScriptParam.billInAdv
                        }
                    );
                    vc2_util.log(logTitle, '... bill create req: ', billCreateReqBody);
                    var billCreateReq = vc2_util.sendRequestRestlet({
                        header: 'Bill Creator | Bill Create',
                        method: 'POST',
                        recordId: BillFileData.PO_LINK,
                        isJSON: true,
                        query: {
                            headers: { 'Content-Type': 'application/json' },
                            scriptId: SCRIPT.RL_BILLCREATE.ID,
                            deploymentId: SCRIPT.RL_BILLCREATE.DEPLOY,
                            body: JSON.stringify(billCreateReqBody)
                        }
                    });
                    vc2_util.handleJSONResponse(billCreateReq);
                    if (!billCreateReq.PARSED_RESPONSE) throw 'Unable to parse response body';

                    ReturnObj = billCreateReq.PARSED_RESPONSE;
                    if (ReturnObj.isError) throw ReturnObj.msg;
                } catch (error) {
                    vc2_util.logError(logTitle, JSON.stringify(error));

                    ReturnObj.isError = true;
                    ReturnObj.errorMsg = vc2_util.extractError(error);

                    // vc2_util.vcLogError({
                    //     title: 'Bill Creator | Error',
                    //     recordId: current.PO_ID,
                    //     details: vc2_util.extractError(error)
                    // });
                } finally {
                    log.debug(logTitle, '// FINALLY // returnObj: ' + JSON.stringify(ReturnObj));

                    // check for any logs
                    var logMsg = ReturnObj.msg || ReturnObj.errorMsg;
                    if (ReturnObj.details) logMsg += ' ' + ReturnObj.details;
                    if (logMsg)
                        vc_billfile.addNote({
                            note: logMsg,
                            id: currentValues.id
                        });

                    if (ReturnObj.status) {
                        UpdateValues[BILLFILE_FLD.STATUS] = ReturnObj.status;
                    }

                    if (ReturnObj.id) {
                        UpdateValues[BILLFILE_FLD.BILL_LINK] = ReturnObj.id;
                    }

                    if (ReturnObj.varianceLines) {
                        CurrentData.billData.varianceLines = ReturnObj.varianceLines;
                        UpdateValues[BILLFILE_FLD.JSON] = JSON.stringify(CurrentData.billData);
                    }

                    log.debug(logTitle, '>> update fields: ' + JSON.stringify(UpdateValues));

                    //if the updateValues object isn't empty update the record
                    if (!vc2_util.isEmpty(UpdateValues)) {
                        ns_record.submitFields({
                            type: BILL_FILE.ID,
                            id: currentValues.id,
                            values: UpdateValues
                        });
                    }
                }
                vc2_util.log(logTitle, '/// === END =======================================///');
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
                'internalid',
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

                vc2_util.log(logTitle, '... vendor config: ', returnValue);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
                // returnValue = false;
            }

            return returnValue;
        },
        createItemFulfillment: function (option) {
            var logTitle = [LogTitle, 'createItemFulfillment'].join('::'),
                returnValue = {};

            try {
                var recordData = option.currentData,
                    billFileData = option.billFileData;

                vc2_util.log(logTitle, '**** ITEM FF Request ***');

                // vc2_util.log(logTitle, '// record data: ', recordData);
                // vc2_util.log(logTitle, '... bill file data: ', billFileData);

                var itemFFReqBody = vc2_util.extractValues({
                    source: billFileData,
                    params: ['PO_LINK', 'ID', 'IS_RCVBLE', 'JSON']
                });
                vc2_util.log(logTitle, '... itemff request: ', itemFFReqBody);

                var itemFFReq = vc2_util.sendRequestRestlet({
                    header: 'Bill Creator | ItemFF Request',
                    method: 'POST',
                    recordId: billFileData.PO_LINK,
                    isJSON: true,
                    query: {
                        headers: { 'Content-Type': 'application/json' },
                        scriptId: SCRIPT.RL_ITEMFF.ID,
                        deploymentId: SCRIPT.RL_ITEMFF.DEPLOY,
                        body: JSON.stringify(itemFFReqBody)
                    }
                });
                vc2_util.handleJSONResponse(itemFFReq);
                var itemFFResponse = itemFFReq.PARSED_RESPONSE;
                if (!itemFFResponse) throw 'Unable to parse response body';

                vc2_util.log(logTitle, '... response: ', itemFFResponse);

                if (itemFFResponse.isError) {
                    util.extend(returnValue, itemFFResponse);
                    throw itemFFResponse.errorMsg || itemFFResponse.msg;
                }

                if (itemFFResponse.itemff) {
                    vc_billfile.addNote({
                        id: recordData.id,
                        note:
                            'Item Fulfillment succesfully created...  ' +
                            ('[id:' + itemFFResponse.itemff + ']')
                    });
                }

                /// SERIALS PROCESSING ///
                if (itemFFResponse.serialData && itemFFResponse.serialData.lines) {
                    vc2_util.log(logTitle, '// Processing serials...', itemFFResponse.serialData);
                    var serialsToProcess = itemFFResponse.serialData;

                    /// SERIALS PROCESSING ///
                    for (var i = 0; i < serialsToProcess.lines.length; i++) {
                        // skip line with no serials
                        if (vc2_util.isEmpty(serialsToProcess.lines[i].serials)) continue;

                        var serialsAddReq = vc2_util.sendRequestRestlet({
                            header: LogTitle + '| Serials Process',
                            method: 'POST',
                            recordId: billFileData.PO_LINK,
                            isJSON: true,
                            query: {
                                headers: { 'Content-Type': 'application/json' },
                                scriptId: SCRIPT.RL_SERIALS.ID,
                                deploymentId: SCRIPT.RL_SERIALS.DEPLOY,
                                body: JSON.stringify({
                                    lineToProcess: i,
                                    serialObj: serialsToProcess
                                })
                            }
                        });

                        vc2_util.handleJSONResponse(serialsAddReq);
                        var itemFFResponse = itemFFReq.PARSED_RESPONSE;
                        if (!itemFFResponse) throw 'Unable to parse response body';

                        vc2_util.log(
                            logTitle,
                            '... (serials) response: ',
                            serialsAddReq.PARSED_RESPONSE
                        );
                    }
                }
                /// SERIALS PROCESSING ///

                // ////////////////////////////
            } catch (error) {
                vc2_util.logError(logTitle, error);
                vc_billfile.addNote({
                    id: recordData.id,
                    note: 'Error creating fulfillment : ' + returnValue.msg
                });
                returnValue.isError = true;
            } finally {
                vc2_util.log(logTitle, returnValue);
            }

            return returnValue;
        },
        getExistingBill: function (option) {
            var logTitle = [LogTitle, 'getExistingBill'].join('::'),
                returnValue;
            option = option || {};
            var arrExistingBills = [];

            var vendorbillSearchObj = ns_search.create({
                type: 'vendorbill',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['mainname', 'anyof', option.entity],
                    'AND',
                    ['numbertext', 'is', option.invoiceNo],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid', 'tranid', 'transactionnumber']
            });

            vendorbillSearchObj.run().each(function (result) {
                arrExistingBills.push({
                    id: result.getValue('internalid'),
                    tranId: result.getValue('tranid'),
                    tranNum: result.getValue('transactionnumber')
                });

                return true;
            });

            log.audit(
                logTitle,
                LogPrefix + '>> Existing Bill: ' + JSON.stringify(arrExistingBills)
            );
            returnValue = arrExistingBills;

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
