/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for main processing of VAR Connect Send PO
 */
define(['N/record', './CTC_VCSP_Constants'], function (NS_Record, VCSP_Global) {
    function recordLog(options) {
        let header = options.header,
            body = options.body,
            transaction = options.transaction,
            status = options.status,
            logFields = VCSP_Global.Fields.VarConnectLog;

        let recLog = NS_Record.create({
            type: VCSP_Global.Records.VC_LOG
        });

        recLog.setValue({
            fieldId: logFields.APPLICATION,
            value: VCSP_Global.LOG_APPLICATION
        });
        recLog.setValue({
            fieldId: logFields.HEADER,
            value: header
        });
        recLog.setValue({
            fieldId: logFields.BODY,
            value: body
        });
        recLog.setValue({
            fieldId: logFields.TRANSACTION,
            value: transaction
        });
        recLog.setValue({
            fieldId: logFields.STATUS,
            value: status
        });

        recLog.save();
    }

    return {
        recordLog: recordLog
    };
});
