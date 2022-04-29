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
        safeParse: function (response) {
            var logTitle = [LogTitle, 'safeParse'].join('::'),
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
        sendRequest: function (option) {
            var logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue;
            log.audit(logTitle, option);

            var ValidMethods = ['post', 'get'];

            var method = (option.method || 'get').toLowerCase();
            method = vc2Utils.inArray(method, ValidMethods) ? method : 'get';

            var queryOption = option.query || option.queryOption;
            if (!queryOption || vc2Utils.isEmpty(queryOption)) throw 'Missing query option';

            var response, responseBody;

            var paramFlags = {
                noLogs: option.hasOwnProperty('noLogs') ? option.noLogs : false,
                doRetry: option.hasOwnProperty('doRetry') ? option.doRetry : false,
                maxRetry: option.hasOwnProperty('maxRetry')
                    ? option.maxRetry
                    : Config.NumRetries || 0,
                countRetry: option.hasOwnProperty('retryCount') ? option.retryCount : 0
            };

            log.audit(logTitle, '>> paramFlags: ' + JSON.stringify(paramFlags));

            try {
                if (option.doLogRequest || !paramFlags.noLogs) {
                    vcLog.recordLog({
                        header: [option.header || LogTitle, 'Request'].join(' - '),
                        body: JSON.stringify(queryOption),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.INFO
                    });
                }

                log.audit(logTitle, '>> REQUEST: ' + JSON.stringify(queryOption));

                //// SEND THE REQUEST //////
                response = ns_https[method](queryOption);
                responseBody = Helper.safeParse(response.body);

                if (!response.code || response.code != 200) {
                    throw 'Failed Response Found';
                }
                if (!response || !response.body) {
                    throw 'Empty or Missing Response !';
                }

                ////////////////////////////

                returnValue = responseBody;
            } catch (error) {
                if (!paramFlags.doRetry || paramFlags.maxRetry >= paramFlags.countRetry) {
                    var errorMsg = vc2Utils.extractError(error);
                    vcLog.recordLog({
                        header: [(option.header || LogTitle) + ': Error', errorMsg].join(' - '),
                        body: JSON.stringify(error),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.ERROR
                    });

                    throw error;
                }

                option.retryCount = paramFlags.countRetry + 1;
                vc2Utils.waitMs(Config.WaitMS);

                returnValue = Helper.sendRequest(option);
            } finally {
                log.audit(
                    logTitle,
                    '>> RESPONSE ' +
                        JSON.stringify({
                            code: response.code || '-no response-',
                            body: responseBody || response.body || '-empty response-'
                        })
                );
                if (option.doLogResponse || !paramFlags.noLogs) {
                    vcLog.recordLog({
                        header: [option.header || LogTitle, 'Response'].join(' - '),
                        body: JSON.stringify(responseBody || response),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.INFO
                    });
                }
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
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var queryOption = {},
                response;

            response = Helper.sendRequest({
                header: [LogTitle, 'GenerateToken'].join(' : '),
                method: 'POST',
                query: {
                    url: option.vendorConfig.accessEndPoint,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: Helper.convertToQuery({
                        client_id: option.vendorConfig.apiKey,
                        client_secret: option.vendorConfig.apiSecret,
                        grant_type: 'client_credentials'
                    })
                },
                recordId: option.recordId,
                doRetry: true,
                maxRetry: 3
            });
            log.audit(logTitle, response);

            if (!response || !response.access_token) throw 'Unable to generate token';
            return response.access_token;
        },

        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var responseBody, orderLines;

            responseBody = this.processRequest({
                poNum: option.poNum,
                poId: option.poId,
                vendorConfig: option.vendorConfig
            });

            if (responseBody) {
                orderLines = this.processResponse({
                    responseBody: responseBody,
                    poNum: option.poNum,
                    poId: option.poId,
                    vendorConfig: option.vendorConfig
                });

                log.audit(logTitle, '>> orderLines: ' + JSON.stringify(orderLines));
            }

            if (!orderLines || vc2Utils.isEmpty(orderLines)) throw 'No lines to processed';
            returnValue = orderLines;

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
                tokenId = this.generateToken({
                    vendorConfig: option.vendorConfig,
                    recordId: option.poId
                });
                if (!tokenId) throw 'Unable to generate token for authentication';

                response = Helper.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' : '),
                    method: 'post',
                    query: {
                        url: option.vendorConfig.endPoint,
                        headers: {
                            Authorization: 'Bearer ' + tokenId,
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            searchParameter: [
                                {
                                    key: 'po_numbers',
                                    values: [option.poNum]
                                }
                            ]
                        })
                    },
                    recordId: option.poId
                });

                if (!response) throw 'Unable to fetch Order Status';

                option.responseBody = response;
                returnValue = response;
            } catch (error) {
                var errorMsg = vc2Utils.extractError(error);
                vcLog.recordLog({
                    header: [LogTitle + ': Error', errorMsg].join(' - '),
                    body: JSON.stringify(error),
                    transaction: option.poId,
                    status: vcGlobal.Lists.VC_LOG_STATUS.ERROR
                });
            } finally {
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue;
            log.audit(logTitle, option);

            var validOrderStatus = ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'];
            var validLineStatus = ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'];
            var validShippedStatus = ['SHIPPED','DELIVERED'];

            try {
                if (vc2Utils.isEmpty(option.responseBody)) throw 'Empty or Invalid response body';
                if (vc2Utils.isEmpty(option.responseBody.purchaseOrderDetails))
                    throw 'Missing Purchase Order Details';

                var arrPODetails = option.responseBody.purchaseOrderDetails;

                var orderLines = [];

                arrPODetails.forEach(function (poDetails) {
                    if (vc2Utils.isEmpty(poDetails.dellOrders)) return false;
                    poDetails.dellOrders.forEach(function (dellOrder) {
                        log.audit(logTitle, '>> dell order: ' + JSON.stringify(dellOrder));

                        var orderStatus = dellOrder.orderStatus.toUpperCase();
                        if (vc2Utils.inArray(orderStatus, validShippedStatus)) {
                            var lineData = {};

                            /// get the lines
                            dellOrder.productInfo.forEach(function (prodInfo, prodIdx) {
                                lineData = {
                                    line_num: prodIdx+1,
                                    item_num: prodInfo.skuNumber,
                                    ship_qty:
                                        (lineData.ship_qty || 0) + parseInt(prodInfo.itemQuantity),
                                    serial_num: prodInfo.serviceTags && prodInfo.serviceTags.length ?
                                        prodInfo.serviceTags.join(',') : ''
                                };

                                return true;
                            });

                            lineData.order_num = dellOrder.orderNumber;
                            lineData.order_date = poDetails.purchaseOrderDate;
                            lineData.ship_date = dellOrder.actualShipmentDate;
                            lineData.order_eta = dellOrder.estimatedDeliveryDate;
                            lineData.carrier = dellOrder.carrierName;
                            lineData.serial_num =
                                dellOrder.waybills && dellOrder.waybills.length
                                    ? dellOrder.waybills.join(',')
                                    : '';

                            log.audit(logTitle, '>> lineData: ' + JSON.stringify(lineData));
                            orderLines.push(lineData);
                        }

                        return true;
                    });

                    return true;
                });

                log.audit(logTitle, '>> order lines: ' + JSON.stringify(orderLines));
                returnValue = orderLines;
            } catch (error) {
                log.error(logTitle, '>> ERROR: ' + JSON.stringify(error));

                vcLog.recordLog({
                    header: [LogTitle, 'Processing'].join(' | ') + ' - ERROR',
                    body: vc2Utils.extractError(error),
                    transaction: option.poId,
                    status: vcGlobal.Lists.VC_LOG_STATUS.ERROR
                });
    
            } finally {
            }

            return returnValue;
        }
    };

    return WS_Dell;
});
