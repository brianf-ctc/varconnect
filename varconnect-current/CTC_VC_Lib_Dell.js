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
 * 3.00     Mar 14, 2023    brianff     updated dell library
 *
 */
define([
    'N/runtime',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js'
], function (ns_runtime, vc_log, vc2_util, vc2_constant) {
    'use strict';
    var LogTitle = 'WS:Dellv2';

    var CURRENT = {};
    var LibDellAPI = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'POST',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.vendorConfig.accessEndPoint,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.vendorConfig.apiKey,
                            client_secret: CURRENT.vendorConfig.apiSecret,
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });
                var tokenResp = tokenReq.PARSED_RESPONSE;
                this.handleResponse(tokenReq);

                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                returnValue = false;
                throw error;
            } finally {
                vc2_util.log(logTitle, '>> Access Token: ', returnValue);
            }

            return returnValue;
        },
        handleResponse: function (request) {
            var returnValue = true;

            if (request.isError || !request.RESPONSE || request.RESPONSE.code != '200') {
                var faultStr = request.PARSED_RESPONSE
                    ? // check fault/faultString
                      (function (resp) {
                          return resp.Fault && resp.Fault.faultstring
                              ? resp.Fault.faultstring
                              : false;
                      })(request.PARSED_RESPONSE) ||
                      // check error/error_description
                      (function (resp) {
                          return resp.error && resp.error_description
                              ? resp.error_description
                              : false;
                      })(request.PARSED_RESPONSE) ||
                      request.errorMsg
                    : request.errorMsg;

                throw faultStr;
            }

            return returnValue;
        },
        searchPO: function (option) {
            var logTitle = [LogTitle, 'searchPO'].join('::'),
                returnValue;
            try {
                var bodyStr = JSON.stringify({
                    searchParameter: [
                        {
                            key: 'po_numbers',
                            values: [CURRENT.recordNum]
                        }
                    ]
                });

                var reqSearchPO = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    method: 'POST',
                    query: {
                        url: CURRENT.vendorConfig.endPoint,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'Accepts-Version': '2.0'
                        },
                        body: bodyStr
                    },
                    recordId: CURRENT.recordId
                });

                this.handleResponse(reqSearchPO);

                returnValue = reqSearchPO.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.vendorConfig = option.vendorConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';
                var arrLines = [];

                var arrResponse = this.processRequest(option);
                vc2_util.log(logTitle, '>> arrResponse: ', arrResponse);

                var arrLines = [];

                if (arrResponse.purchaseOrderDetails) {
                    var orderDetail = arrResponse.purchaseOrderDetails.shift();
                    if (orderDetail.dellOrders) {
                        for (var i = 0, j = orderDetail.dellOrders.length; i < j; i++) {
                            var dellOrder = orderDetail.dellOrders[i],
                                itemOrder = {
                                    ship_qty: 0
                                };

                            if (dellOrder.purchaseOrderLines) {
                                dellOrder.purchaseOrderLines.forEach(function (lineData) {
                                    (itemOrder.item_num = lineData.buyerPartNumber),
                                        (itemOrder.vendorSKU = lineData.buyerPartNumber),
                                        (itemOrder.ship_qty += parseFloat(
                                            lineData.quantityOrdered
                                        ));
                                    itemOrder.line_status = lineData.lineStatus;
                                });
                            }

                            util.extend(itemOrder, {
                                order_num: dellOrder.orderNumber || 'NA',
                                ship_date: dellOrder.actualShipmentDate || 'NA',
                                order_date: orderDetail.orderDetail || 'NA',
                                order_eta: dellOrder.estimatedDeliveryDate || 'NA',
                                carrier: dellOrder.carrierName || 'NA',
                                order_status: orderDetail.purchaseOrderStatus,
                                serial_num: 'NA',
                                tracking_num: 'NA'
                            });

                            if (dellOrder.productInfo && util.isArray(dellOrder.productInfo)) {
                                var arrSerials = [];

                                dellOrder.productInfo.forEach(function (productInfo) {
                                    if (util.isArray(productInfo.serviceTags))
                                        arrSerials = arrSerials.concat(productInfo.serviceTags);
                                    else arrSerials.push(productInfo.serviceTags);

                                    return true;
                                });

                                if (!vc2_util.isEmpty(arrSerials)) {
                                    itemOrder.serial_num = arrSerials.join(',');
                                }
                            }

                            if (
                                dellOrder.trackingInformation &&
                                util.isArray(dellOrder.trackingInformation)
                            ) {
                                var arrTracking = [];

                                dellOrder.trackingInformation.forEach(function (tracking) {
                                    if (vc2_util.isEmpty(tracking.waybill)) return false;
                                    if (!vc2_util.inArray(tracking.waybill, arrTracking))
                                        arrTracking.push(tracking.waybill);

                                    if (!itemOrder.carrier || itemOrder.carrier == 'NA') {
                                        itemOrder.carrier = tracking.carrierName;
                                    }

                                    return true;
                                });

                                if (!vc2_util.isEmpty(arrTracking)) {
                                    itemOrder.tracking_num = arrTracking.join(',');
                                }
                            }

                            arrLines.push(itemOrder);
                        }
                    }
                }

                returnValue = arrLines;
            } catch (error) {
                throw error;
            } finally {
                vc2_util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !vc2_util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
                });
            }
            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.vendorConfig = option.vendorConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                LibDellAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                returnValue = LibDellAPI.searchPO();
            } catch (error) {
                throw error;
            } finally {
                vc2_util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !vc2_util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
                });
            }

            return returnValue;
        }
    };
});
