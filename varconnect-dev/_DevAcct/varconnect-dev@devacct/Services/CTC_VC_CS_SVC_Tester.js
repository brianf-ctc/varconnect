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
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType ClientScript
 */
define(['N/search', 'N/https', 'N/ui/serverWidget', './../CTC_VC2_Lib_Utils.js'], function (
    ns_search,
    ns_https,
    ns_ui,
    vc2_util
) {
    var LogTitle = 'VCSERV_TESTER',
        LogPrefix = '';

    const RL_SERVICES = {
        scriptId: 'customscript_ctc_vc_rl_services',
        deploymentId: 'customdeploy_ctc_rl_services'
    };

    function processJson(jsonText) {
        var logTitle = LogTitle + 'processJson';

        var requestOption = vc2_util.extend(RL_SERVICES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonText
        });

        vc2_util.log(logTitle, '>> request-option: ', requestOption);
        var response = ns_https.requestRestlet(requestOption);
        return response.body;
    }

    return {
        sendServicesRequest: function (context) {
            var currRecord = context.currentRecord;
            var jsonInput = currRecord.getValue({ fieldId: 'custpage_json_input' });
            console.log('jsonInput', jsonInput);
            var result = processJson(jsonInput);
            currRecord.setValue({ fieldId: 'custpage_result', value: result });
        }
    };
});
