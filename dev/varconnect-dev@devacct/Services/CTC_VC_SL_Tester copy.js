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
 * @NScriptType Suitelet
 */
define(function (require) {
    var LogTitle = 'VCSERV_TESTER',
        LogPrefix = '';

    var nsSearch = require('N/search'),
        ns_https = require('N/https'),
        ns_ui = require('N/ui/serverWidget'),
        vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js');

    const RL_SERVICES = {
        scriptId: 'customscript_ctc_vc_rl_services',
        deploymentId: 'customdeploy_ctc_rl_services'
    };

    var SAMPLE_REQ = {
        vendorws: [
            {
                module: 'vendorws',
                action: 'orderstatus',
                paramater: {
                    poId: 123423,
                    poNum: 'asdfaf'
                }
            }
        ],
        records: [
            {
                action: 'itemSearchs',
                parameters: {
                    sku: 'PWR-C1-350WAC-P='
                }
            },
            {
                action: 'fetchItemsPO',
                parameters: {
                    poId: '4095'
                }
            },
            {
                action: 'searchPO',
                parameters: {
                    poNum: '12607x4'
                }
            },
            {
                moduleName: 'billcreateLib',
                action: 'linkPOItems',
                parameters: {
                    // poNum: '126074',
                    billfileId: '5304'
                }
            },
            {
                moduleName: 'billcreateLib',
                action: 'addProcessLog',
                parameters: {
                    billFileLogs: 'this is a sample log'
                    // billFileId: 'XX5304'
                }
            }
        ]
    };

    return {
        onRequest: function (context) {
            var logTitle = [LogTitle, 'Request'].join('::'),
                returnValue = {};

            try {
                var requestOption = vc2_util.extend(RL_SERVICES, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(SAMPLE_REQ.records[4])
                });

                vc2_util.log(logTitle, '>> request-option: ', requestOption);

                var response = ns_https.requestRestlet(requestOption);

                returnValue = {
                    request: requestOption,
                    response:
                        response && response.body
                            ? vc2_util.safeParse(response.body)
                            : '- no body content - '
                };
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnVale = vc2_util.extractError(error);
            } finally {
                returnValue = returnValue ? JSON.stringify(returnValue) : '-no response-';
                context.response.write({ output: returnValue });
                vc2_util.log(logTitle, '>> returnValue: ', returnValue);
            }

            return returnValue;
        }
    };
});
