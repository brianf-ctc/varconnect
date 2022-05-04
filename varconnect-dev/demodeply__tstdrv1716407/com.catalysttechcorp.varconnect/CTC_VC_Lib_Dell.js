/**
 * Copyright (c) 2020 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
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
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_https, ns_runtime, vcGlobal, vcLog, vc2Utils, libMoment) {
    'use strict';
    var LogTitle = 'WS:Dellv2',
        Config = {
            AllowRetry: true,
            NumRetries: 3,
            WaitMS: 500
        },
        LogPrefix;

    var Helper = {
        saveParse: function (response) {
            var logTitle = [LogTitle, 'parseResponse'].join('::'),
                returnValue;

            log.audit(logTitle, response);
            try {
                returnValue = JSON.parse(response.body || response);
            } catch (error) {
                log.error(logTitle, '## ERROR ##' + vc2Utils.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },
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
                log.audit(logTitle, response);

                if (!response.code || response.code != 200) {
                    throw 'Unable to retrieve access token';
                }
                if (!response || !response.body) {
                    throw 'Empty response!!';
                }

                var responseBody = Helper.saveParse(response.body);

                log.audit(
                    logTitle,
                    '>> response: ' +
                        JSON.stringify({
                            code: response.code || '-no response-',
                            body: responseBody || '-empty response-'
                        })
                );

                log.audit(
                    logTitle,
                    '>> Access Token: ' + JSON.stringify(responseBody.access_token)
                );

                returnValue = responseBody.access_token;
            } catch (error) {
                var retryCount = option.retryCount || 0;
                if (!Config.AllowRetry || !Config.NumRetries || retryCount >= Config.NumRetries)
                    throw error;

                option.retryCount = retryCount + 1;

                vc2Utils.waitMs(Config.WaitMS);
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

                if (!orderLines || vc2Utils.isEmpty(orderLines)) throw 'No lines to processed';
                returnValue = orderLines;
            } catch (error) {
                var errorMsg = vc2Utils.extractError(error);
                log.error(
                    logTitle,
                    '## ERROR ## ' + errorMsg + '\n>> Details:' + JSON.stringify(error)
                );

                vcLog.recordLog({
                    header: LogTitle + ' Error | ' + errorMsg,
                    body: JSON.stringify(error),
                    transaction: option.poId,
                    status: vcGlobal.Lists.VC_LOG_STATUS.ERROR
                });
                returnValue = null;
            } finally {
                log.audit(logTitle, '<< ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var tokenId,
                response,
                queryOption = {};

            try {
                tokenId = Helper.generateToken(option.vendorConfig);
                if (!tokenId) throw 'Unable to generate token for authentication';

                queryOption.headers = {
                    Authorization: 'Bearer ' + tokenId,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                };
                queryOption.url = option.vendorConfig.endPoint;
                queryOption.body = JSON.stringify({
                    searchParameter: [
                        {
                            key: 'po_numbers',
                            values: [option.poNum]
                        }
                    ]
                });

                log.audit(logTitle, '>> query option: ' + JSON.stringify(queryOption));


                // log the request //
                vcLog.recordLog({
                    header: [LogTitle, 'Order Status - Request'].join(' | '),
                    body: JSON.stringify(queryOption),
                    transaction: option.poId,
                    status: vcGlobal.Lists.VC_LOG_STATUS.INFO
                });

                /// SEND THE REQUEST ///////////
                response = ns_https.post(queryOption);
                /// SEND THE REQUEST ///////////

                log.audit(
                    logTitle,
                    '>> response: ' +
                        JSON.stringify({
                            code: response.code || '-no response-',
                            body: response.body || '-empty response-'
                        })
                );

                if (!response.code || response.code != 200) {
                    throw 'Unable to retrieve access token';
                }

                if (!response || !response.body) {
                    throw 'Empty response!!';
                }

                var responseBody = Helper.saveParse(response.body);

                option.responseBody = responseBody;

                returnValue = this.processResponse(option);

            } catch (error) {
                throw error; //vc2Utils.extractError(error);
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
                throw error; //vc2Utils.extractError(error);
            } finally {
            }

            return returnValue;
        }
    };

    return WS_Dell;
});
