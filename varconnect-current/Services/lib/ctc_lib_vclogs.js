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
 * @NScriptType MapReduceScript
 */
define((require) => {
    var LogTitle = 'VC_LOG';

    let lib_util = require('./Services/lib/ctc_lib_utils'),
        lib_error = require('./Services/lib/ctc_lib_errors'),
        lib_constant = require('./Services/lib/ctc_lib_constants');

    let VC_LOG = lib_constant.RECORD.VC_LOG,
        LOG_STATUS = lib_constant.LIST.VC_LOG_STATUS;

    return {
        APP_NAME: 'VAR Connect',
        CURRENT_ID: '',
        /**
         * Creates a VC Log entry
         *
         * @param {*} option
         *      header/title
         *      content/body
         *      status/logType
         */
        sendLog: (option) => {
            var logTitle = [LogTitle, 'sendLog'].join('|'),
                returnValue;
            try {
                var logOption = {},
                    batchTransaction = option.batch,
                    isBatched = batchTransaction !== null;

                util.extend(logOption, {
                    DATE: new Date(),
                    APPLICATION: option.applicationName || option.appName || this.APP_NAME,
                    HEADER: option.title || option.header,
                    BODY: option.body || option.content,
                    STATUS:
                        option.logStatus ||
                        option.status ||
                        (option.isSuccess
                            ? LOG_STATUS.success
                            : option.isError
                            ? LOG_STATUS.ERROR
                            : LOG_STATUS.INFO),
                    TRANSACTION: option.currentId || option.transactionId || this.CURRENT_ID
                });

                if (option.error) {
                    logOption.BODY = lib_error.parseError(option.error);
                    option.details =
                        option.error.details || option.errorDetails || JSON.stringify(option.error);
                    logOption.STATUS = option.error.logStatus || option.status || LOG_STATUS.ERROR;
                }

                logOption.BODY = util.isString(logOption.BODY)
                    ? logOption.BODY
                    : JSON.stringify(logOption.BODY);

                if (option.details) {
                    logOption.BODY += '\n\n###\n' + JSON.stringify(option.details);
                }

                logOption.HEADER =
                    logOption.HEADER.length > 300
                        ? logOption.HEADER.substr(0, 295) + '...'
                        : logOption.HEADER;

                // create the log
                var recLog = ns_record.create({ type: VC_LOG.ID });
                for (var field in VC_LOG.FIELD) {
                    var fieldName = VC_LOG.FIELD[field];
                    recLog.setValue({
                        fieldId: fieldName,
                        value: logOption[field] || ''
                    });
                }
                recLog.save();
            } catch (error) {
                log.error(logTitle, '## ERROR ##', lib_error.parseError(error));
            }
            return returnValue;
        },
        success: (option) => {            
        },
        error: (option) => {},
        debug: (option) => {}
    };
});
