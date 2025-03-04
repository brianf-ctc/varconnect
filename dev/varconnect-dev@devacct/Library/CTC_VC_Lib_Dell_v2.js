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
 * 1.00		Jan 1, 2020		paolodl		Initial Build
 * 2.00		May 25, 2021	paolodl		Include line numbers
 *
 */
define([
    'N/https',
    'N/runtime',
    './../CTC_VC_Lib_Log.js',
    './../CTC_VC2_Constants.js',
    './../CTC_VC2_Lib_Utils.js'
], function (ns_https, ns_runtime, vc_log, vc2_constant, vc2_util) {
    'use strict';
    var LogTitle = 'WS:Dellv2',
        Config = {
            AllowRetry: true,
            NumRetries: 3,
            WaitMS: 500
        },
        LogPrefix = '';

    var Helper = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var queryOption = {},
                response;

            try {
                queryOption.headers = {
                    'Content-Type': 'application/x-www-form-urlencoded'
                };
                queryOption.body = Helper.convertToQuery({
                    client_id: option.apiKey,
                    client_secret: option.apiSecret,
                    grant_type: 'client_credentials'
                });
                queryOption.url = option.accessEndPoint;

                log.audit(logTitle, '>> query : ' + JSON.stringify(queryOption));

                response = ns_https.post(queryOption);
                if (!response || !response.body) throw 'Empty response!!';

                var responseBody = JSON.parse(response.body),
                    responseCode = response.code;

                log.audit(
                    logTitle,
                    '>> response: ' +
                        JSON.stringify({
                            code: responseCode || '-no response-',
                            body: responseBody || '-empty response-'
                        })
                );

                if (!responseCode || responseCode != 200 || !responseBody.access_token) {
                    throw 'Unable to retrieve access token';
                }

                log.audit(
                    logTitle,
                    '>> Access Token: ' + JSON.stringify(responseBody.access_token)
                );
            } catch (error) {
                var retryCount = option.retryCount || 0;
                if (!Config.AllowRetry || !Config.NumRetries || retryCount >= Config.NumRetries)
                    throw error;

                option.retryCount = retryCount + 1;

                vc2_util.waitMs(Config.WaitMS);
                returnValue = Helper.generateToken(option);
            }

            return returnValue;
        },
        convertToQuery: function (json) {
            if (typeof json !== 'object') return;

            var qry = [];
            for (var key in json) {
                var qryVal = encodeURIComponent(json[key]);
                var qryKey = encodeURIComponent(key);
                qry.push([qryKey, qryVal].join('='));
            }

            return qry.join('&');
        }
    };

    var WS_Dell = {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var responseBody, orderLines;

            try {
                responseBody = this.processRequest({
                    poNum: option.poNum,
                    poId: option.poId,
                    vendorConfig: option.vendorConfig
                });

                if (!responseBody) throw 'Empty response';

                orderLines = this.processResponse({
                    responseBody: responseBody,
                    poNum: option.poNum,
                    poId: option.poId,
                    vendorConfig: option.vendorConfig
                });

                log.audit(logTitle, '>> orderLines: ' + JSON.stringify(orderLines));

                if (!orderLines || vc2_util.isEmpty(orderLines)) throw 'No lines to processed';
                returnValue = orderLines;
            } catch (error) {
                var errorMsg = vc2_util.extactError(error);
                throw errorMsg;
                // log.error(
                //     logTitle,
                //     '## ERROR ## ' + errorMsg + '\n>> Details:' + JSON.stringify(error)
                // );

                // vc_log.recordLog({
                //     header: LogTitle + ' Error | ' + errorMsg,
                //     body: JSON.stringify(error),
                //     transaction: option.poId,
                //     status: vc2_constant.LIST.VC_LOG_STATUS.ERROR,
                //     isDebugMode: option.fromDebug
                // });
                // returnValue = null;
            } finally {
                log.audit(logTitle, '<< ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            try {
            } catch (error) {
                throw error; //vc2Utils.extactError(error);
            } finally {
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            try {
            } catch (error) {
                throw error; //vc2Utils.extactError(error);
            } finally {
            }

            return returnValue;
        }
    };

    return WS_Dell;
});
