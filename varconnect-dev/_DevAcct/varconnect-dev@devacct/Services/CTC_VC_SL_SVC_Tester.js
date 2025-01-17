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
 * @NScriptType Suitelet
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

    var Helper = {
        processJson: function (jsonText) {
            var logTitle = LogTitle + 'processJson';
            var cookieValue =
                'NS_VER=2024.2; JSESSIONID=Vc5W5-lwZHLrX6xuGLeX-L3NRQCgJgHvMMgL63QF2uJbmMScPHYw-a-QxWEscpQt3XV95Dr-9Udf7ieL4-0YfN9yKZBFW6VEI1g0HnVW9X3Hn8ecRtLyb4Op8WCgFizp!-1603644508;';

            var requestOption = vc2_util.extend(RL_SERVICES, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: cookieValue, // Set the cookie value
                    'Set-Cookie': cookieValue // Set the cookie value
                },
                body: jsonText
            });

            vc2_util.log(logTitle, '>> request-option: ', requestOption);
            var response = ns_https.requestRestlet(requestOption);

            try {
                var jsonResponse = JSON.parse(response.body);
                return JSON.stringify(jsonResponse, null, '\t'); // Format JSON with indentation
            } catch (e) {
                return response.body; // Return as is if not a valid JSON
            }
        }
    };

    return {
        onRequest: function (context) {
            var form = ns_ui.createForm({ title: 'JSON Input Form' });
            form.clientScriptModulePath = './CTC_VC_CS_SVC_Tester.js';

            // Move jsonField to its own field group
            // form.addFieldGroup({ id: 'input_group', label: 'JSON Input', isSingleColumn: true });
            var jsonField = form.addField({
                id: 'custpage_json_input',
                type: ns_ui.FieldType.TEXTAREA,
                label: 'JSON Input'
                // container: 'input_group'
            });
            jsonField.updateDisplaySize({ height: 10, width: 100 });

            // Move resultField to the next line
            // form.addFieldGroup({ id: 'result_group', label: 'Result', isSingleColumn: true });
            var resultField = form.addField({
                id: 'custpage_result',
                type: ns_ui.FieldType.LONGTEXT,
                label: 'Result'
                // container: 'result_group'
            });
            // resultField.updateDisplayType({
            //     displayType: ns_ui.FieldDisplayType.DISABLED
            // });
            resultField.updateDisplaySize({ height: 40, width: 150 });

            // resultField.updateDisplayType({
            //     displayType: ns_ui.FieldDisplayType.INLINE
            // });

            // Add client script reference
            form.addButton({
                id: 'custpage_btn_sendrequest',
                label: 'Send Request',
                functionName: 'sendServicesRequest'
            });

            // form.addSubmitButton({
            //     label: 'Submit'
            // });
            // if (context.request.method === 'POST') {
            //     var jsonInput = context.request.parameters.custpage_json_input;
            //     var result = Helper.processJson(jsonInput); // Assume processJson is a function that processes the JSON input
            //     resultField.defaultValue = result;
            //     jsonField.defaultValue = jsonInput;
            // }

            context.response.writePage(form);
        }
    };
});
