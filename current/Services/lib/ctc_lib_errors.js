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
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
/** 
 * USAGE 
 *
 * 1. Log Error (with error level):
 *    logError('ProcessName', 'Error message')
 *    logError('ProcessName', { code: 'MISSING_PARAMETER', details: 'itemId' })
 *    logError('ProcessName', { code: 'CUSTOM_ERROR' }, { CUSTOM_ERROR: { message: 'Custom message' } })
 *
 * 2. Log Warning (with audit level):
 *    logWarn('ProcessName', 'Warning message')
 *    logWarn('ProcessName', { code: 'LOW_STOCK', details: 'Item123' })
 *
 * 3. Extract Error Message:
 *    extractError('Simple message')
 *    extractError({ code: 'MISSING_PARAMETER', details: 'itemId' })
 *    extractError({ type: 'error.SuiteScriptError', name: 'RCRD_DSNT_EXIST' })

 */
define(function (require) {
    var vc2_util = require('./../../CTC_VC2_Lib_Utils.js');

    var ERROR_MSG = {
        UNEXPECTED_ERROR: {
            code: 'UNEXPECTED_ERROR',
            message: 'An unexpected error occurred',
            throwError: true
        },
        MISSING_PARAMETER: {
            code: 'MISSING_PARAMETER',
            message: 'Missing parameter'
        },
        FEATURE_NOT_ENABLED: {
            code: 'FEATURE_NOT_ENABLED',
            message: 'The following feature is not enabled'
        }
    };

    var Helper = {
        // Converts various error formats into a standardized error object
        extractErrorObject: function (option, errMessages) {
            var option = option || {};
            if (vc2_util.isEmpty(option)) return ERROR_MSG.UNEXPECTED_ERROR;
            ERROR_MSG = util.extend(ERROR_MSG, errMessages || {});

            var errorObj;
            if (util.isString(option)) {
                errorObj = ERROR_MSG[option] || { message: option };
            } else if (option.code) {
                errorObj = ERROR_MSG[option.code] || util.extend(option, { message: option.code });
            } else {
                var message = '';
                if (option.type) {
                    message = [option.name || option.type, option.message].join(' - ');
                    message += option.type ? ' (' + option.type + ')' : '';
                } else if (option.name) {
                    message = option.name + ' - ' + option.message;
                } else {
                    message = option.message || option.code;
                }
                errorObj = { message: message };
            }

            var detail =
                option.details ||
                option.detail ||
                (option.type && option.type == 'error.SuiteScriptError'
                    ? { type: option.type, name: option.name, id: option.id }
                    : null);

            if (detail) {
                errorObj.detail = util.isArray(detail)
                    ? detail.join(', ')
                    : util.isObject(detail)
                    ? JSON.stringify(detail)
                    : detail;
            }

            return errorObj;
        }
    };

    return {
        ERROR_MSG: ERROR_MSG,

        // Logs error messages with error level and returns formatted error message
        logError: function (logTitle, option, errMessages) {
            var option = option || {};
            var errorObj = Helper.extractErrorObject(option, errMessages);
            var errorMsg = errorObj.detail
                ? [errorObj.message, errorObj.detail].join(' - ')
                : errorObj.message;
            log.error(logTitle || '[ERROR]', '[ERROR] ' + errorMsg);
            return true;
        },

        // Logs warning messages with audit level and returns formatted message
        logWarn: function (logTitle, option, errMessages) {
            var option = option || {};
            var errorObj = Helper.extractErrorObject(option, errMessages);
            var errorMsg = errorObj.detail
                ? [errorObj.message, errorObj.detail].join(' - ')
                : errorObj.message;
            log.audit(logTitle || '[WARNING]', '[WARNING] ' + errorMsg);
            return true;
        },

        // Extracts formatted error message without logging
        extractError: function (option, errMessages) {
            var option = option || {};
            var errorObj = Helper.extractErrorObject(option, errMessages);
            return errorObj.detail
                ? [errorObj.message, errorObj.detail].join(' - ')
                : errorObj.message;
        }
    };
});
