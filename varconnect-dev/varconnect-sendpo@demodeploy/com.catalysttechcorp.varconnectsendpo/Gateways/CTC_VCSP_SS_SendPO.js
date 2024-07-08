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
 * @NScriptType ScheduledScript
 */
define([
    'N/record',
    'N/runtime',
    './../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Lib_Main'
], function (NS_Record, NS_Runtime, CTC_Util, LibMain) {
    var LogTitle = 'VCSP_SendPO';

    var CURRENT = {},
        PARAM_CONFIG = {
            PO_ID: 'custscript_ctc_vcsp_sendpo_poid'
        };

    return {
        execute: function (context) {
            var logTitle = [LogTitle, 'execute'].join('::'),
                returnValue = {};

            try {
                var currentScript = NS_Runtime.getCurrentScript();
                for (var param in PARAM_CONFIG) {
                    CURRENT[param] = currentScript.getParameter(PARAM_CONFIG[param]);
                }
                log.audit(logTitle, '/// PARAMS: ' + JSON.stringify([PARAM_CONFIG, CURRENT]));

                if (!CURRENT.PO_ID) throw 'Missing PO Id';

                returnValue = LibMain.sendPO({ purchaseOrderId: CURRENT.PO_ID });
            } catch (error) {
                var errorMsg = CTC_Util.extractError(error);
                CTC_Util.logError(logTitle, errorMsg);

                returnValue = {
                    isError: true,
                    error: errorMsg
                };
            } finally {
                returnValue = util.isString(returnValue)
                    ? returnValue
                    : JSON.stringify(returnValue);

                CTC_Util.log('AUDIT', logTitle, '// RESPONSE: ' + returnValue);
                CTC_Util.setNSCache({
                    key: 'sendpo-response:' + CURRENT.PO_ID,
                    value: returnValue
                });
            }

            return true;
        }
    };
});
