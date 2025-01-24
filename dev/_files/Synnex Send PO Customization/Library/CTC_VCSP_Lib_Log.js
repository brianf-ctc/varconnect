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
 */
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for main processing of VAR Connect Send PO
 */
define(['N/record', './CTC_VCSP_Constants.js'], function (record, constants) {
    function recordLog(options) {
        var header = options.header,
            body = options.body,
            transaction = options.transaction,
            status = options.status,
            logFields = constants.Fields.VarConnectLog;

        var recLog = record.create({
            type: constants.Records.VC_LOG
        });

        recLog.setValue({
            fieldId: logFields.APPLICATION,
            value: constants.LOG_APPLICATION
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
