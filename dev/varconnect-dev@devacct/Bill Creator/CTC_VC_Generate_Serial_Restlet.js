/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
 * @NScriptType Restlet
 */
define(['N/record', './../CTC_VC2_Constants', './../CTC_VC2_Lib_Utils'], function (
    ns_record,
    vc2_constant,
    vc2_util
) {
    var LogTitle = 'VC|Generate Serials',
        VCLOG_APPNAME = 'VAR Connect | Process Bill (Serials)',
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS,
        CURRENT = {},
        LogPrefix = '';

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            try {
                vc2_util.log(logTitle, '**** START SCRIPT **** ', context);

                util.extend(CURRENT, {
                    serialData: context.serialObj,
                    poId: context.serialObj.poId,
                    line: context.lineToProcess
                });
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.poId + '] ';

                vc2_util.log(logTitle, '/// serials: ', CURRENT);

                var dataToProcess = CURRENT.serialData.lines[CURRENT.line];
                // var dataToProcess = CURRENT.serialData.lines[CURRENT.line].serials;

                vc2_util.vcLog({
                    title: 'BillCreator | Serials to Process',
                    content: JSON.stringify(dataToProcess),
                    recordId: CURRENT.poId
                });

                var arrSerialIds = [];

                for (var i = 0; i < dataToProcess.serials.length; i++) {
                    var serialNum = dataToProcess.serials[i];
                    vc2_util.log(logTitle, '... serial data: ', serialNum);

                    var serialRec = ns_record.create({
                        type: 'customrecordserialnum',
                        isDynamic: true
                    });

                    serialRec.setValue({ fieldId: 'name', value: serialNum });

                    serialRec.setValue({
                        fieldId: 'custrecordserialpurchase',
                        value: CURRENT.serialData.poId
                    });

                    serialRec.setValue({
                        fieldId: 'custrecordserialsales',
                        value: CURRENT.serialData.soId
                    });

                    serialRec.setValue({
                        fieldId: 'custrecordserialitem',
                        value: dataToProcess.item
                    });

                    serialRec.setValue({
                        fieldId: 'custrecordcustomer',
                        value: CURRENT.serialData.custId
                    });

                    if (CURRENT.serialData.type == 'if') {
                        serialRec.setValue({
                            fieldId: 'custrecorditemfulfillment',
                            value: CURRENT.serialData.trxId
                        });
                    } else if (CURRENT.serialData.type == 'ir') {
                        serialRec.setValue({
                            fieldId: 'custrecorditemreceipt',
                            value: CURRENT.serialData.trxId
                        });
                    }

                    var record_id = serialRec.save();
                    vc2_util.log(logTitle, '... serial added: ', record_id);

                    arrSerialIds.push(record_id);
                }

                returnObj.serialIds = arrSerialIds;
            } catch (error) {
                returnObj.msg = vc2_util.extractError(error);
                returnObj.isError = true;

                vc2_util.vcLog({
                    title: 'BillCreator | Serials Error',
                    error: error,
                    recordId: CURRENT.poId
                });

                vc2_util.logError(logTitle, error);
            }

            return returnObj;
        }
    };

    return RESTLET;
});
