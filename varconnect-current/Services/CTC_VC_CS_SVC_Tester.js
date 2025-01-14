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
define(['N/https', 'N/url', 'N/currentRecord'], function (ns_https, ns_url, ns_currentRecord) {
    var LogTitle = 'VCSERV_TESTER',
        LogPrefix = '';

    var RL_SERVICES = {
        scriptId: 'customscript_ctc_vc_rl_services',
        deploymentId: 'customdeploy_ctc_rl_services'
    };

    function processJson(jsonText) {
        var logTitle = LogTitle + 'processJson';

        var restletUrl = ns_url.resolveScript({
            scriptId: RL_SERVICES.scriptId,
            deploymentId: RL_SERVICES.deploymentId
        });

        var requestOption = {
            url: restletUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonText
        };

        var currRecord = ns_currentRecord.get();
        currRecord.setValue({
            fieldId: 'custpage_result',
            value: 'Please wait while processing the request...'
        });

        console.log('>> request-option: ', JSON.stringify(requestOption));

        ns_https.post.promise(requestOption).then(function (response) {
            var jsonResponse = JSON.parse(response.body);
            console.log('>> response', jsonResponse);

            currRecord.setValue({
                fieldId: 'custpage_result',
                value: JSON.stringify(jsonResponse, null, 4)
            });

            return true;
        }).catch(function (error) {
            console.error('>> error', error);
            currRecord.setValue({
                fieldId: 'custpage_result',
                value: JSON.stringify(error, null, 4)
            });

            return false;
        });
    }

    return {
        pageInit: function (context) {
            return;
        },
        sendServicesRequest: function (context) {
            var currRecord = ns_currentRecord.get();
            var jsonInput = currRecord.getValue({ fieldId: 'custpage_json_input' });
            console.log('>> sendServicesRequest', currRecord, jsonInput);
            var result = processJson(jsonInput);
            currRecord.setValue({ fieldId: 'custpage_result', value: result });

            return true;
        }
    };
});
