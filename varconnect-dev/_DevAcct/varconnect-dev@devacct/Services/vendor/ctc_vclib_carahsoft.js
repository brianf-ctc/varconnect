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
 *
 *
 */

define(function (require) {
    var LogTitle = 'WS:CarasoftAPI';

    var vc2_util = require('../../CTC_VC2_Lib_Utils'),
        vc2_constant = require('../../CTC_VC2_Constants');

    var CURRENT = {
            TokenName: 'VC_CARAHSOFT_TOKEN'
        },
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ],
        ERROR_MSG = vc2_constant.ERRORMSG;

    var LibCarasoft = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            try {
                var respToken = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
                    query: {
                        url: CURRENT.orderConfig.accessEndPoint,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: {
                            client_id: CURRENT.orderConfig.apiKey,
                            client_secret: CURRENT.orderConfig.apiSecret,
                            audience: CURRENT.orderConfig.oauthScope,
                            grant_type: 'client_credentials'
                        }
                    }
                });
                vc2_util.handleJSONResponse(respToken);

                if (!respToken.PARSED_RESPONSE) throw 'Unable to generate token';
                returnValue = respToken.PARSED_RESPONSE.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getTokenCache: function (option) {
            var logTitle = [LogTitle, 'getTokenCache'].join('::'),
                returnValue;

            var tokenKey = [
                CURRENT.TokenName,
                CURRENT.orderConfig.customerNo,
                CURRENT.orderConfig.apiKey,
                CURRENT.orderConfig.subsidiary,
                vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
            ].join('|');

            var accessToken = vc2_util.getNSCache({ key: tokenKey });

            if (vc2_util.isEmpty(accessToken)) {
                accessToken = LibCarasoft.generateToken();
            }

            if (!vc2_util.isEmpty(accessToken)) {
                CURRENT.accessToken = accessToken;
                vc2_util.setNSCache({ key: tokenKey, value: accessToken, cacheTTL: 3600 });
            }

            returnValue = accessToken;

            return returnValue;
        },
        extractOrders: function (option) {
            var logTitle = [LogTitle, 'extractOrders'].join('::'),
                returnValue;

            try {
                var respOrderSearch = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Search'].join(' '),
                    query: {
                        url:
                            CURRENT.orderConfig.endPoint +
                            '?' +
                            ("$filter=CustomerPO eq '" + CURRENT.recordNum + "'"),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-Account': CURRENT.orderConfig.customerNo
                        }
                    }
                });
                vc2_util.log(logTitle, '// resp obj: ', respOrderSearch);
                if (respOrderSearch.isError) throw respOrderSearch.errorMsg;

                vc2_util.handleJSONResponse(respOrderSearch);
                if (!respOrderSearch.PARSED_RESPONSE) throw 'Unable to fetch server response';

                var parsedOrders = respOrderSearch.PARSED_RESPONSE.value;
                if (vc2_util.isEmpty(parsedOrders)) throw 'Order not found';

                returnValue = parsedOrders;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        extractOrderDetails: function (option) {
            var logTitle = [LogTitle, 'extractOrderDetails'].join('::'),
                returnValue;

            vc2_util.log(logTitle, '... // option: ', option);

            try {
                var orderId = option.orderId;

                var respOrderSearch = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Detail'].join(' '),
                    query: {
                        url:
                            CURRENT.orderConfig.endPoint.replace(/\/$/, '') +
                            ('(' + orderId + ')?') +
                            '$expand=Details($expand=LineItems)',
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-Account': CURRENT.orderConfig.customerNo
                        }
                    }
                });
                if (respOrderSearch.isError) throw respOrderSearch.errorMsg;

                vc2_util.handleJSONResponse(respOrderSearch);
                if (!respOrderSearch.PARSED_RESPONSE) throw 'Unable to fetch server response';

                var parsedOrders = respOrderSearch.PARSED_RESPONSE;
                vc2_util.log(logTitle, '// PARSED content: ', parsedOrders);

                if (vc2_util.isEmpty(parsedOrders)) throw 'Order not found';

                returnValue = parsedOrders;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
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
                vc2_util.LogPrefix =
                    '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

                var arrOrders = this.processRequest(option);
                if (vc2_util.isEmpty(arrOrders)) throw 'Order not found';

                if (option.debugMode) {
                    if (!option.showLines) return arrOrders;
                }

                var itemArray = [],
                    orderList = [];

                arrOrders.forEach(function (orderInfo) {
                    var orderData = {
                        OrderNum: orderInfo.CustomerPO,
                        OrderDate: vc2_util.parseFormatDate(orderInfo.DateBooked),
                        Status: orderInfo.Status,
                        Total: orderInfo.TotalOrder,
                        VendorOrderNum: orderInfo.Order_ID
                        // Source: orderInfo,
                        // Lines: []
                    };

                    (orderInfo.Details || []).forEach(function (orderDetail) {
                        util.extend(orderData, {
                            VendorOrderNum: orderDetail.OrderDetail_ID
                        });

                        orderList.push(vc2_util.clone(orderData));

                        (orderDetail.LineItems || []).forEach(function (lineInfo) {
                            var lineData = {
                                order_num: lineInfo.OrderDetail_ID || 'NA',
                                order_status: orderInfo.Status || 'NA',

                                order_date: orderInfo.DateBooked || 'NA',
                                order_eta: 'NA',
                                deliv_date: 'NA',
                                prom_date: 'NA',

                                item_num: lineInfo.Item || 'NA',
                                item_sku: 'NA',

                                line_num: lineInfo.LineNumber || 'NA',
                                line_status: 'NA',
                                unitprice: lineInfo.Price
                                    ? vc2_util.parseFloat(lineInfo.Price)
                                    : 'NA',

                                ship_qty: lineInfo.Quantity
                                    ? vc2_util.forceInt(lineInfo.Quantity)
                                    : 'NA',
                                ship_date: 'NA',
                                carrier: 'NA',
                                tracking_num: lineInfo.TrackingNumber || 'NA',
                                serial_num: 'NA',
                                is_shipped: false
                            };

                            itemArray.push(lineData);

                            return true;
                        });

                        return true;
                    });

                    return true;
                });

                // run through itemArray and check for DATE_FIELDS
                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;

                        itemObj[dateField] = vc2_util.parseFormatDate(itemObj[dateField]);
                    });
                });

                util.extend(returnValue, {
                    Orders: orderList,
                    Lines: itemArray,
                    Source: arrOrders
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }
            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue;
            option = option || {};
            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.orderConfig = option.orderConfig;
                vc2_util.LogPrefix =
                    '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

                // get token cache
                LibCarasoft.getTokenCache(option);
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                // search for the Order First
                var orderResult = LibCarasoft.extractOrders();
                if (vc2_util.isEmpty(orderResult)) throw 'Order not found';

                var arrOrders = [];
                if (!util.isArray(orderResult)) orderResult = [orderResult];

                orderResult.forEach(function (result) {
                    var orderId = result.Order_ID ? vc2_util.forceInt(result.Order_ID) : null;

                    vc2_util.log(logTitle, '.. order Id: ', orderId);
                    if (!orderId) return;

                    var orderDetails = LibCarasoft.extractOrderDetails({ orderId: orderId });
                    arrOrders.push(orderDetails);
                    vc2_util.log(logTitle, '.. arrOrders(length): ', arrOrders.length);

                    return true;
                });

                returnValue = arrOrders;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }
            return returnValue;
        }
    };

    return EntryPoint;
});
