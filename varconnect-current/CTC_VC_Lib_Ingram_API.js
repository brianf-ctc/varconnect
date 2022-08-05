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
 * @description Helper file for Ingram Micro V1 (Cisco) to Get PO Status
 */

/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Ingram_v1
 * Author: shawn.blackburn
 */
define([
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (vcLog, VC_Global, VC2_Utils, moment) {
    'use strict';
    var LogTitle = 'WS:IngramAPI';

    var LibIngramAPI = {
        CACHE: {},
        ACCESS_TOKEN: null,

        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            try {
                var tokenReq = VC2_Utils.sendRequest({
                    header: [LogTitle, 'GenerateToken'].join(' '),
                    method: 'post',
                    recordId: option.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: option.vendorConfig.accessEndPoint,
                        body: VC2_Utils.convertToQuery({
                            client_id: option.vendorConfig.apiKey,
                            client_secret: option.vendorConfig.apiSecret,
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });

                if (tokenReq.isError) throw tokenReq.errorMsg;
                var tokenResp = VC2_Utils.safeParse(tokenReq.RESPONSE);

                // todo: add error response from ingram
                if (!tokenResp || !tokenResp.access_token)
                    throw (
                        'Unable to generate access token!' +
                        '\n Details: ' +
                        JSON.stringify(tokenResp)
                    );

                LibIngramAPI.ACCESS_TOKEN = tokenResp.access_token;
                returnValue = tokenResp.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::');

            if (!LibIngramAPI.ACCESS_TOKEN) LibIngramAPI.generateToken(option);

            var cacheKey = [LogTitle, 'OrderStatus', option.tranId].join('-');
            var response = VC2_Utils.getCache(cacheKey);

            if (response == null) {
                var orderStatusReq = VC2_Utils.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' : '),
                    recordId: option.recordId,
                    query: {
                        url:
                            option.vendorConfig.endPoint +
                            '/search?customerOrderNumber=' +
                            option.tranId,
                        headers: {
                            Authorization: 'Bearer ' + token,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': option.vendorConfig.customerNo,
                            'IM-CountryCode': option.vendorConfig.country,
                            'IM-CustomerOrderNumber': option.tranId,
                            'IM-CorrelationID': [option.tranId, option.recordId].join('-')
                        }
                    }
                });
                if (orderStatusReq.isError) throw orderStatusReq.errorMsg;
                response = VC2_Utils.safeParse(orderStatusReq.RESPONSE);
                VC2_Utils.setCache(cacheKey, response);
            }

            var arrValidOrders = [],
                ingramOrders = response.orders;

            if (VC2_Utils.isEmpty(ingramOrders)) throw 'Unable to receive orders';

            for (var i = 0, j = ingramOrders.length; i < j; i++) {
                var ingramOrder = ingramOrders[i];
                if (VC2_Utils.inArray(ingramOrder.orderStatus, ['CANCELLED'])) continue; //skip this

                arrValidOrders.push(ingramOrder);
            }

            log.audit(logTitle, '>> Valid Orders: ' + JSON.stringify(arrValidOrders));

            return arrValidOrders;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getOrderDetails'].join('::');
            var arrLineData = [];

            log.audit(logTitle, '>> orderNum: ' + JSON.stringify(option.orderNum));

            try {
                var cacheKey = [LogTitle, 'OrderDetails', option.orderNum].join('-');
                var orderDetails = VC2_Utils.getCache(cacheKey);

                if (orderDetails == null) {
                    var orderDetailReq = VC2_Utils.sendRequest({
                        header: [LogTitle, 'OrderDetails'].join(' '),
                        recordId: recordId,
                        query: {
                            url: vendorConfig.endPoint + '/' + option.orderNum,
                            headers: {
                                Authorization: 'Bearer ' + token,
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                                'IM-CustomerNumber': option.vendorConfig.customerNo,
                                'IM-CountryCode': option.vendorConfig.country,
                                'IM-CorrelationID': [option.tranId, option.recordId].join('-')
                            }
                        }
                    });

                    if (orderDetailReq.isError) throw orderDetailReq.errorMsg;
                    orderDetails = VC2_Utils.safeParse(orderDetailReq.RESPONSE);
                    if (!orderDetailse) throw 'Unable to fetch order details';

                    VC2_Utils.setCache(cacheKey, orderDetails);
                }

                if (VC2_Utils.isEmpty(orderDetails.lines)) throw 'Order has no lines';

                var ingramOrderDate = orderDetails.ingramOrderDate;
                var defaultETA = {
                    date: moment(ingramOrderDate).add(1, 'day').toDate(),
                    text: moment(ingramOrderDate).add(1, 'day').format('YYYY-MM-DD')
                };
                log.audit(logTitle, 'defaultETA : ' + JSON.stringify(defaultETA));

                for (var i = 0, j = orderDetails.lines.length; i < j; i++) {
                    var orderLine = orderDetails.lines[i];
                    log.audit(logTitle, '>> orderLine: ' + JSON.stringify(orderLine));

                    // get item availability call
                    
                }
            } catch (error) {
            } finally {
            }

            return arrLineData;
        },
        getItemAvailability: function (option) {},

        getMiscCharges: function (option) {},

        fetchOrderLines: function (option) {}
    };

    var WS_Lib = {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                arrayLines = [];
            option = option || {};

            try {
                option.recordId = option.poId || option.recordId;
                option.tranId = option.poNum || option.tranId;

                if (!option.vendorConfig) throw 'Vendor Config is missing';
                if (!option.recordId || !option.tranId) throw 'Missing poId or poNum';

                // try to login first
                LibIngramAPI.generateToken(option);
                if (!LibIngramAPI.ACCESS_TOKEN) throw 'Unable to generate access token';

                // get valid orders
                var validOrders = LibIngramAPI.getOrderStatus(option);
                if (!VC2_Utils.isEmpty(validOrders)) throw 'Unable to find valid orders.';

                for (var i = 0, j = validOrders.length; i < j; i++) {
                    var validOrder = validOrders[i];

                    var orderLines = LibIngramAPI.getOrderDetails({
                        recordId: option.recordId,
                        tranId: option.tranId,
                        vendorConfig: option.vendorConfig,
                        orderNum: validOrder.ingramOrderNumber
                    });
                    if (VC2_Utils.isEmpty(orderLines)) continue;

                    arrayLines = arrayLines.concat(orderLines);
                }

                // fetch the order status
            } catch (error) {
                var errorMessage = VC2_Utils.extractError(error);
                throw error;
            } finally {
                vcLog.recordLog({
                    header: [LogTitle, ' Lines'].join(' - '),
                    body: [
                        vc2Utils.isEmpty(arrayLines)
                            ? ' - No lines to process - '
                            : arrayLines.length,
                        JSON.stringify(arrayLines)
                    ].join(' -- '),
                    transaction: option.poId,
                    status: VC_Global.Lists.VC_LOG_STATUS.INFO,
                    isDebugMode: option.fromDebug
                });
            }

            return arrayLines;
        }
    };

    return WS_Lib;
});
