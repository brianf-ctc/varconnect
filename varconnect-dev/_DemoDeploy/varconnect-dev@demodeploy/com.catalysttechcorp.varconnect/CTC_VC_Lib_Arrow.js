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
 * @description Helper file for Arrow Get PO Status
 */
/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Arrow
 * Author: john.ramonel
 */
define(['./CTC_VC2_Lib_Utils.js', './Bill Creator/Libraries/moment'], function (vc2_util, moment) {
    'use strict';

    var LogTitle = 'WS:Arrow',
        LogPrefix;

    var CURRENT = {};

    var LibArrowAPI = {
        ValidShippedStatus: ['SHIPPED'],
        SkippedStatus: ['CANCELLED'],
        initialize: function (option) {
            var logTitle = [LogTitle, 'initialize'].join('::'),
                returnValue;

            CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
            CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

            vc2_util.LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';
            if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

            return returnValue;
        },

        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.orderConfig.accessEndPoint,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.orderConfig.apiKey,
                            client_secret: CURRENT.orderConfig.apiSecret,
                            scope: ['api://', CURRENT.orderConfig.apiKey, '/.default'].join(''),
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });

                vc2_util.handleJSONResponse(tokenReq);
                var tokenResp = tokenReq.PARSED_RESPONSE;
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getTokenCache: function () {
            var token = vc2_util.getNSCache({
                key: [
                    'VC_ARROW_TOKEN',
                    CURRENT.orderConfig.apiKey,
                    CURRENT.orderConfig.apiSecret
                ].join('|')
            });
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: 'VC_ARROW_TOKEN',
                    cacheTTL: 3500,
                    value: token
                });
                CURRENT.accessToken = token;
            }
            return token;
        },
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqOrderStatus = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' '),
                    recordId: CURRENT.recordId,
                    method: 'post',
                    query: {
                        url: CURRENT.orderConfig.endPoint,
                        body: JSON.stringify({
                            RequestHeader: {
                                TransactionType: 'RESELLER_ORDER_STATUS',
                                Region: 'NORTH_AMERICAS',
                                SourceTransactionKeyID: null,
                                RequestTimestamp: null,
                                Country: 'US',
                                PartnerID: CURRENT.orderConfig.customerNo
                            },
                            OrderRequest: {
                                ResellerPOList: {
                                    ResellerPO: [
                                        {
                                            Number: CURRENT.recordNum,
                                            Line: [
                                                {
                                                    Number: null
                                                }
                                            ],
                                            PartNumber: [
                                                {
                                                    Number: null
                                                }
                                            ]
                                        }
                                    ]
                                },
                                IncludeCancelledOrders: 'N',
                                IncludeClosedOrders: 'Y'
                            }
                        }),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'Ocp-Apim-Subscription-Key': CURRENT.orderConfig.oauthScope
                        }
                    }
                });
                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;

                vc2_util.handleJSONResponse(reqOrderStatus);
                LibArrowAPI.validateResponse(reqOrderStatus.PARSED_RESPONSE);

                returnValue = reqOrderStatus.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        validateResponse: function (parsedResponse) {
            if (!parsedResponse) throw 'Unable to read the response';
            var respHeader = parsedResponse.ResponseHeader;

            if (!respHeader || !util.isArray(respHeader)) throw 'Missing or Invalid ResponseHeader';
            var hasErrors,
                errorMsgs = [];

            respHeader.forEach(function (header) {
                if (!header.TransactionStatus || header.TransactionStatus == 'ERROR') {
                    hasErrors = true;
                    errorMsgs.push(header.TransactionMessage);
                }
                return true;
            });

            if (hasErrors && errorMsgs.length) throw errorMsgs.join(', ');
            return true;
        },

        extractLineData: function (lineData, orderData) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractLineData'].join('::'),
                itemObj = {};

            try {
                itemObj = {
                    order_date: orderData.OrderDate || 'NA',
                    line_num: lineData.ResellerPOLineNumber || 'NA',
                    item_num: lineData.MFGPartNumber || 'NA',
                    vendorSKU: lineData.VendorPartNumber || 'NA',
                    order_num: lineData.InvoiceNumber || arrowSONum || 'NA',
                    ship_qty: parseInt(lineData.ShippedQty || '0'),
                    carrier: lineData.OracleShipViaCode || 'NA',
                    order_status: lineData.ItemStatusOracle || 'NA',
                    order_eta: 'NA',
                    ship_date: 'NA',
                    tracking_num: 'NA',
                    serial_num: 'NA'
                };
                itemObj.is_shipped = vc2_util.inArray(
                    itemObj.order_status,
                    LibArrowAPI.ValidShippedStatus
                );

                // shipping details
                if (lineData.StatusInfoList && lineData.StatusInfoList.StatusInfo) {
                    var statusInfo = lineData.StatusInfoList.StatusInfo,
                        shipmentInfo = { eta: [], ship: [], tracking: [] };

                    vc2_util.log(logTitle, '... status info:', statusInfo);

                    if (util.isArray(statusInfo) && !vc2_util.isEmpty(statusInfo)) {
                        for (var i = 0, j = statusInfo.length; i < j; i++) {
                            var statusInfoObj = statusInfo[i]; // only contains 1

                            if (statusInfoObj.EstimatedShipDate)
                                shipmentInfo.eta.push(statusInfoObj.EstimatedShipDate);

                            if (statusInfoObj.ActualShipDate)
                                shipmentInfo.ship.push(statusInfoObj.ActualShipDate);

                            if (statusInfoObj.TrackingNumber)
                                shipmentInfo.tracking.push(statusInfoObj.TrackingNumber);
                        }

                        shipmentInfo.eta = vc2_util.uniqueArray(shipmentInfo.eta || []);
                        shipmentInfo.ship = vc2_util.uniqueArray(shipmentInfo.ship || []);
                        shipmentInfo.tracking = vc2_util.uniqueArray(shipmentInfo.tracking || []);

                        itemObj.order_eta = shipmentInfo.eta.shift() || itemObj.order_eta;
                        itemObj.ship_date = shipmentInfo.ship.shift() || itemObj.ship_date;
                        itemObj.tracking_num = shipmentInfo.tracking.length
                            ? shipmentInfo.tracking.join(',')
                            : itemObj.tracking_num;
                    }
                }

                /// serials
                if (lineData.SerialNumberList) {
                    var serialNumObj = lineData.SerialNumberList.SerialNumber,
                        arrSerials = [];

                    if (util.isArray(serialNumObj) && !vc2_util.isEmpty(serialNumObj)) {
                        for (var ii = 0; ii < serialNumObj.length; ii++) {
                            if (serialNumObj[ii].hasOwnProperty('ID'))
                                arrSerials.push(serialNumObj[ii].ID);
                            else arrSerials.push(JSON.stringify(serialNumObj[ii]));
                        }
                    }
                    arrSerials = vc2_util.uniqueArray(arrSerials);

                    itemObj.serial_num = arrSerials.length
                        ? arrSerials.join(',')
                        : itemObj.serial_num;
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return itemObj;
        }
    };

    return {
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                LibArrowAPI.initialize(option);
                LibArrowAPI.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                returnValue = LibArrowAPI.getOrderStatus();
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                var response = option.response,
                    itemArray = [];

                // validate the response)

                if (orderResp.hasOwnProperty('ArrowSONumber')) arrowSONum = orderResp.ArrowSONumber;
                if (orderResp.hasOwnProperty('Reseller')) {
                    orderDate = orderResp.Reseller.PODate;
                }

                if (orderResp.hasOwnProperty('OrderLinesList')) {
                    var orderLines = orderResp.OrderLinesList.OrderLines;

                    if (orderLines.length) {
                        for (var i = 0; i < orderLines.length; i++) {
                            var lineData = orderLines[i];
                            // map here...
                            var itemObj = {
                                order_date: orderDate || 'NA',
                                line_num: lineData.ResellerPOLineNumber || 'NA',
                                item_num: lineData.MFGPartNumber || 'NA',
                                vendorSKU: lineData.VendorPartNumber || 'NA',
                                order_num: lineData.InvoiceNumber || arrowSONum || 'NA',
                                ship_qty: parseInt(lineData.ShippedQty || '0'),
                                carrier: lineData.OracleShipViaCode || 'NA',
                                order_status: lineData.ItemStatusOracle || 'NA',
                                order_eta: 'NA',
                                ship_date: 'NA',
                                tracking_num: 'NA',
                                serial_num: 'NA'
                            };
                            // check for is shipped based on status
                            itemObj.is_shipped = vc2_util.inArray(
                                itemObj.order_status.toUpperCase(),
                                LibArrowAPI.ValidShippedStatus
                            );

                            // shipping details
                            if (lineData.hasOwnProperty('StatusInfoList')) {
                                var statusInfo = lineData.StatusInfoList.StatusInfo;
                                if (statusInfo.length) {
                                    var statusInfoObj = statusInfo[0]; // only contains 1
                                    if (statusInfoObj.hasOwnProperty('EstimatedShipDate')) {
                                        itemObj.order_eta = statusInfoObj.EstimatedShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('ActualShipDate')) {
                                        itemObj.ship_date = statusInfoObj.ActualShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('TrackingNumber')) {
                                        itemObj.tracking_num = statusInfoObj.TrackingNumber;
                                    }
                                }
                            }

                            // serial number list
                            if (lineData.hasOwnProperty('SerialNumberList')) {
                                var serialNumbers = [];
                                var serialNumObj = lineData.SerialNumberList.SerialNumber;
                                log.debug('serialNumObj', serialNumObj);
                                if (serialNumObj.length) {
                                    for (var j = 0; j < serialNumObj.length; j++) {
                                        if (serialNumObj[j].hasOwnProperty('ID'))
                                            serialNumbers.push(serialNumObj[j].ID);
                                        else serialNumbers.push(JSON.stringify(serialNumObj[j]));
                                    }
                                    itemObj.serial_num = serialNumbers.join(',');
                                }
                            }

                            // check for is_shipped, based on ship_date
                            if (
                                !itemObj.is_shipped &&
                                itemObj.ship_date &&
                                itemObj.ship_date != 'NA' &&
                                itemObj.ship_qty &&
                                itemObj.ship_qty != 0
                            ) {
                                var shippedDate = moment(itemObj.ship_date).toDate();
                                vc2_util.log(logTitle, '**** shipped date: ****', [
                                    shippedDate,
                                    util.isDate(shippedDate),
                                    shippedDate <= new Date()
                                ]);

                                if (
                                    shippedDate &&
                                    util.isDate(shippedDate) &&
                                    shippedDate <= new Date()
                                )
                                    itemObj.is_shipped = true;
                            }

                            vc2_util.log(logTitle, '>> line data: ', itemObj);

                            itemArray.push(itemObj);
                        }
                    }
                }

                returnValue = itemArray;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                LibArrowAPI.initialize(option);

                var response = this.processRequest();
                if (!response) throw 'Unable to get response';

                var itemArray = [],
                    orderArray = [];

                var objOrderResponse = response.OrderResponse;
                if (
                    !objOrderResponse ||
                    !objOrderResponse.OrderDetails ||
                    !objOrderResponse.OrderDetails.length
                )
                    throw 'Missing order details';

                for (var i = 0, j = objOrderResponse.OrderDetails.length; i < j; i++) {
                    var orderDetails = objOrderResponse.OrderDetails[i];
                    var orderData = {},
                        orderDate,
                        arrowSONum;

                    try {
                        orderData = {
                            Status: orderDetails.OrderStatusDescription,
                            OrderNum: orderDetails.ArrowSONumber,
                            OrderDate: orderDetails.ArrowSODate,
                            Total: orderDetails.OrderTotalAmount
                        };

                        orderArray.push(orderData);

                        if (
                            !orderDetails ||
                            !orderDetails.Status ||
                            orderDetails.Status !== 'SUCCESS'
                        ) {
                            throw orderDetails && orderDetails.Message
                                ? orderDetails.Message
                                : 'Order Not Found';
                        }

                        var orderLines = orderDetails.OrderLinesList.OrderLines;

                        if (!util.isArray(orderLines) || vc2_util.isEmpty(orderLines))
                            throw 'Missing item lines';

                        for (var ii = 0, jj = orderLines.length; ii < jj; ii++) {
                            var orderLineData = orderLines[ii];
                            var itemObj = LibArrowAPI.extractLineData(orderLineData, orderData);

                            itemArray.push(itemObj);
                        }
                    } catch (order_error) {
                        vc2_util.logError(logTitle, order_error);
                    }
                }

                returnValue = {
                    Orders: orderArray,
                    Lines: itemArray
                };
            } catch (error) {
                vc2_util.logError(logTitle, error);

                util.extend(returnValue, {
                    HasError: true,
                    ErrorMsg: vc2_util.extractError(error)
                });
            }

            return returnValue;
        }
    };
});
