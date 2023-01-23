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
define(['N/runtime', './CTC_VC_Lib_Log.js', './CTC_VC2_Lib_Utils.js', './CTC_VC2_Constants.js'], function (
    ns_runtime,
    vc_log,
    vc2_util,
    vc2_constant
) {
    'use strict';
    var LogTitle = 'WS:Dellv2';

    var WS_Dell = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            log.audit(logTitle, option);

            var tokenReq = vc2_util.sendRequest({
                header: [LogTitle, 'GenerateToken'].join(' '),
                method: 'POST',
                query: {
                    url: option.vendorConfig.accessEndPoint,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: vc2_util.convertToQuery({
                        client_id: option.vendorConfig.apiKey,
                        client_secret: option.vendorConfig.apiSecret,
                        grant_type: 'client_credentials'
                    })
                },
                recordId: option.recordId,
                doRetry: true,
                maxRetry: 3
            });

            if (tokenReq.isError && tokenReq.errorMsg) throw tokenReq.errorMsg;
            var tokenResp = vc2_util.safeParse(tokenReq.RESPONSE);

            if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';
            return tokenResp.access_token;
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

            if (!orderLines || vc2_util.isEmpty(orderLines)) throw 'No lines to processed';
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
                if (!tokenId) throw 'Missing token for authentication';

                var orderStatusReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' '),
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

                if (orderStatusReq.isError) throw orderStatusReq.errorMsg;

                var orderStatusResp = vc2_util.safeParse(orderStatusReq.RESPONSE);
                if (!orderStatusResp) throw 'Unable to fetch Order Status';

                option.responseBody = orderStatusResp;
                returnValue = orderStatusResp;
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);

                vc_log.recordLog({
                    header: [LogTitle + ': Error', errorMsg].join(' - '),
                    body: JSON.stringify(error),
                    transaction: option.poId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.ERROR,
                    isDebugMode: option.fromDebug
                });
                if (!returnValue) returnValue = errorMsg;
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
            var validShippedStatus = ['SHIPPED', 'DELIVERED'];

            try {
                if (vc2_util.isEmpty(option.responseBody)) throw 'Empty or Invalid response body';
                if (vc2_util.isEmpty(option.responseBody.purchaseOrderDetails)) throw 'Missing Purchase Order Details';

                var arrPODetails = option.responseBody.purchaseOrderDetails;

                var orderLines = [];

                arrPODetails.forEach(function (poDetails) {
                    if (vc2_util.isEmpty(poDetails.dellOrders)) return false;
                    poDetails.dellOrders.forEach(function (dellOrder) {
                        log.audit(logTitle, '>> dell order: ' + JSON.stringify(dellOrder));

                        var orderStatus = dellOrder.orderStatus.toUpperCase();
                        if (vc2_util.inArray(orderStatus, validShippedStatus)) {
                            var lineData = {};

                            /// get the lines
                            dellOrder.productInfo.forEach(function (prodInfo, prodIdx) {
                                lineData = {
                                    line_num: prodIdx + 1,
                                    item_num: prodInfo.skuNumber,
                                    ship_qty: (lineData.ship_qty || 0) + parseInt(prodInfo.itemQuantity),
                                    serial_num:
                                        prodInfo.serviceTags && prodInfo.serviceTags.length
                                            ? prodInfo.serviceTags.join(',')
                                            : ''
                                };

                                return true;
                            });

                            lineData.order_num = dellOrder.orderNumber;
                            lineData.order_date = poDetails.purchaseOrderDate;
                            lineData.ship_date = dellOrder.actualShipmentDate;
                            lineData.order_eta = dellOrder.estimatedDeliveryDate;
                            lineData.carrier = dellOrder.carrierName;
                            lineData.serial_num =
                                dellOrder.waybills && dellOrder.waybills.length ? dellOrder.waybills.join(',') : '';

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

                vc_log.recordLog({
                    header: [LogTitle, 'Processing'].join(' | ') + ' - ERROR',
                    body: vc2_util.extractError(error),
                    transaction: option.poId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.ERROR,
                    isDebugMode: option.fromDebug
                });
            } finally {
            }

            return returnValue;
        }
    };

    return WS_Dell;
});
