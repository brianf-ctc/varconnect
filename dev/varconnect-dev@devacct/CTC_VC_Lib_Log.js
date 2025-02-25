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
define(['N/record', 'N/format', './CTC_VC2_Constants.js'], function (
    ns_record,
    ns_format,
    vc2_constant
) {
    var REC_VCLOG = vc2_constant.RECORD.VC_LOG;

    function _getCurrentTime() {
        var /*companyConfig = config.load(config.Type.COMPANY_INFORMATION),
			timezone = companyConfig.getValue({ fieldId: 'timezone' }),*/
            date = ns_format.format({
                value: new Date(),
                type: ns_format.Type.DATETIME
            });

        return new Date();
    }

    function recordLog(options) {
        var header = options.header,
            body = options.body,
            transaction = options.transaction,
            transactionLineKey = options.transactionLineKey,
            status = options.status,
            logFields = REC_VCLOG.FIELD,
            isDebugMode = options.isDebugMode;

        if (isDebugMode) return;

        var recLog = ns_record.create({
            type: REC_VCLOG.ID
        });

        recLog.setValue({
            fieldId: logFields.APPLICATION,
            value: options.logApp || vc2_constant.LOG_APPLICATION
        });

        recLog.setValue({
            fieldId: logFields.HEADER,
            value: header ? (header.length > 300 ? header.substr(0, 300) : header) : ''
        });
        
        recLog.setValue({
            fieldId: logFields.BODY,
            value: body || ''
        });
        if (transaction)
            recLog.setValue({
                fieldId: logFields.TRANSACTION,
                value: transaction
            });
        if (transactionLineKey)
            recLog.setValue({
                fieldId: logFields.TRANSACTION_LINEKEY,
                value: transactionLineKey
            });
        recLog.setValue({
            fieldId: logFields.STATUS,
            value: status || vc2_constant.LIST.VC_LOG_STATUS.INFO
        });
        recLog.setValue({
            fieldId: logFields.DATE,
            value: _getCurrentTime()
        });

        recLog.save();
    }

    return {
        recordLog: recordLog,
        add: recordLog
    };
});
