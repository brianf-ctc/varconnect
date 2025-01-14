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
    './CTC_VC2_Constants.js',
    './Bill Creator/Libraries/moment'
], function (ns_runtime, vc_log, vc2_util, vc2_constant, moment) {
    'use strict';
    var LogTitle = 'WS:Dellv2';

    var CURRENT = {
            TokeName: 'VC_DELL_TOKEN'
        },
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ];
    var LibDellAPI = {
        ValidShippedStatus: ['SHIPPED', 'INVOICED', 'DELIVERED'],
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'POST',
                    recordId: CURRENT.recordId,
                    query: {
                        url: CURRENT.orderConfig.accessEndPoint,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.orderConfig.apiKey,
                            client_secret: CURRENT.orderConfig.apiSecret,
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
        getTokenCache: function () {
            var token = vc2_util.getNSCache({
                key: [
                    CURRENT.TokeName,
                    CURRENT.orderConfig.apiKey,
                    CURRENT.orderConfig.subsidiary,
                    vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
                ].join('|')
            });
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: 'VC_DELL_TOKEN',
                    cacheTTL: 14400,
                    value: token
                });
                CURRENT.accessToken = token;
            }
            return token;
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
                        url: CURRENT.orderConfig.endPoint,
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

                vc2_util.log(logTitle, '>> Search PO: ', reqSearchPO);

                vc2_util.handleJSONResponse(reqSearchPO);
                returnValue = reqSearchPO.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        extractOrderDetails: function (orderDetail) {}
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.orderConfig = option.orderConfig;

                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';
                var itemArray = [],
                    orderDataList = [];

                var arrResponse = this.processRequest(option);

                if (!arrResponse || !arrResponse.purchaseOrderDetails)
                    throw 'Missing purchase order details';

                if (option.debugMode) {
                    if (!option.showLines) return arrResponse;
                }

                arrResponse.purchaseOrderDetails.forEach(function (orderDetail) {
                    if (!orderDetail || !orderDetail.dellOrders) throw 'Missing Dell Order info';
                    var OrderData = {
                        OrderNum: orderDetail.purchaseOrderNumber,
                        OrderDate: vc2_util.parseFormatDate(orderDetail.purchaseOrderDate),
                        Status: orderDetail.purchaseOrderStatus
                    };

                    for (var i = 0, j = orderDetail.dellOrders.length; i < j; i++) {
                        var dellOrder = orderDetail.dellOrders[i],
                            orderItem = {
                                ship_qty: 0
                            };

                        util.extend(OrderData, {
                            Status: dellOrder.orderStatus,
                            VendorOrderNum: dellOrder.orderNumber,
                            InvoiceNum: dellOrder.invoiceNumber,
                            Source: dellOrder
                        });

                        if (dellOrder.purchaseOrderLines) {
                            dellOrder.purchaseOrderLines.forEach(function (lineData) {
                                orderItem.item_num = lineData.buyerPartNumber;
                                orderItem.vendorSKU = lineData.buyerPartNumber;
                                orderItem.ship_qty += parseFloat(lineData.quantityOrdered);
                                orderItem.line_status = lineData.lineStatus;
                            });
                        }

                        util.extend(orderItem, {
                            order_num: dellOrder.orderNumber || 'NA',
                            ship_date: dellOrder.actualShipmentDate || 'NA',
                            order_date: orderDetail.orderDetail || 'NA',
                            order_eta: dellOrder.estimatedDeliveryDate || 'NA',
                            carrier: dellOrder.carrierName || 'NA',
                            order_status: orderDetail.purchaseOrderStatus,
                            serial_num: 'NA',
                            tracking_num: 'NA'
                        });

                        if (
                            vc2_util.isEmpty(dellOrder.productInfo) &&
                            util.isArray(dellOrder.productInfo)
                        ) {
                            var arrSerials = [];

                            dellOrder.productInfo.forEach(function (productInfo) {
                                if (util.isArray(productInfo.serviceTags))
                                    arrSerials = arrSerials.concat(productInfo.serviceTags);
                                else arrSerials.push(productInfo.serviceTags);

                                return true;
                            });

                            if (!vc2_util.isEmpty(arrSerials))
                                orderItem.serial_num = arrSerials.join(',');
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

                                if (!orderItem.carrier || orderItem.carrier == 'NA') {
                                    orderItem.carrier = tracking.carrierName;
                                }

                                return true;
                            });

                            if (!vc2_util.isEmpty(arrTracking)) {
                                orderItem.tracking_num = arrTracking.join(',');
                            }
                        }

                        // check is_shipped from status
                        orderItem.is_shipped = orderItem.line_status
                            ? vc2_util.inArray(
                                  orderItem.line_status.toUpperCase(),
                                  LibDellAPI.ValidShippedStatus
                              )
                            : orderItem.order_status
                            ? vc2_util.inArray(
                                  orderItem.order_status.toUpperCase(),
                                  LibDellAPI.ValidShippedStatus
                              )
                            : false;

                        // check is_shipped from shipped date
                        // if (
                        //     !orderItem.is_shipped &&
                        //     orderItem.ship_date &&
                        //     orderItem.ship_date != 'NA' &&
                        //     orderItem.ship_qty &&
                        //     orderItem.ship_qty != 0
                        // ) {
                        //     var shippedDate = moment(orderItem.ship_date).toDate();
                        //     vc2_util.log(logTitle, '**** shipped date: ****', [
                        //         shippedDate,
                        //         util.isDate(shippedDate),
                        //         shippedDate <= new Date()
                        //     ]);

                        //     if (
                        //         shippedDate &&
                        //         util.isDate(shippedDate) &&
                        //         shippedDate <= new Date()
                        //     )
                        //         orderItem.is_shipped = true;
                        // }

                        vc2_util.log(logTitle, '>> line data: ', orderItem);

                        itemArray.push(orderItem);
                        orderDataList.push(vc2_util.clone(OrderData));
                    }
                });

                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;
                        itemObj[dateField] = vc2_util.parseFormatDate(itemObj[dateField]);
                    });
                });

                util.extend(returnValue, {
                    Orders: orderDataList,
                    Lines: itemArray,
                    Source: arrResponse
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
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
                CURRENT.orderConfig = option.orderConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                LibDellAPI.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                returnValue = LibDellAPI.searchPO();
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
