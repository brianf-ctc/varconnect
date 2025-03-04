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
 * @description Helper file for Arrow Get PO Status
 */
define(function (require) {
    var vc2_util = require('../../CTC_VC2_Lib_Utils'),
        vc2_constant = require('../../CTC_VC2_Constants');

    var LogTitle = 'WS:Arrow',
        LogPrefix;

    var CURRENT = {
            TokenName: 'VC_ARROW_TOKEN'
        },
        ERROR_MSG = vc2_constant.ERRORMSG,
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ];

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
                var tokenResp = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
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
                if (tokenResp.isError) if (!tokenResp.PARSED_RESPONSE) throw tokenResp.errorMsg;

                vc2_util.handleJSONResponse(tokenResp);
                var tokenResp = tokenResp.PARSED_RESPONSE;
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getTokenCache: function () {
            var tokenKey = [
                CURRENT.TokenName,
                CURRENT.orderConfig.apiKey,
                CURRENT.orderConfig.apiSecret,
                CURRENT.orderConfig.subsidiary,
                vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
            ].join('|');

            var token = vc2_util.getNSCache({ key: tokenKey });
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: tokenKey,
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
                vc2_util.dumpLog(logTitle, reqOrderStatus);
                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;

                vc2_util.handleJSONResponse(reqOrderStatus);
                LibArrowAPI.validateResponse(reqOrderStatus.PARSED_RESPONSE);

                returnValue = reqOrderStatus.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getInvoice: function (option) {
            var logTitle = [LogTitle, 'getInvoice'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqInvoice = vc2_util.sendRequest({
                    header: [LogTitle, 'Get Invoice'].join(' '),
                    recordId: CURRENT.recordId,
                    method: 'post',
                    query: {
                        url: CURRENT.orderConfig.endPoint,
                        body: JSON.stringify({
                            RequestHeader: {
                                TransactionType: 'RESELLER_INVOICE_STATUS',
                                Region: 'NORTH_AMERICAS',
                                SourceTransactionKeyID: null,
                                RequestTimestamp: null,
                                Country: 'US',
                                PartnerID: CURRENT.orderConfig.customerNo
                            },
                            InvoiceRequest: {
                                InvoiceNumber: CURRENT.recordNum
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
                vc2_util.dumpLog(logTitle, reqInvoice);
                if (reqInvoice.isError) throw reqInvoice.errorMsg;

                vc2_util.handleJSONResponse(reqInvoice);
                LibArrowAPI.validateResponse(reqInvoice.PARSED_RESPONSE);

                returnValue = reqInvoice.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        validateResponse: function (parsedResponse) {
            if (!parsedResponse) throw 'Unable to read the response';
            var respHeader = parsedResponse.ResponseHeader,
                orderResponse = parsedResponse.OrderResponse;

            // if (!respHeader || !util.isArray(respHeader)) throw 'Missing or Invalid ResponseHeader';
            if (!respHeader) throw 'Missing or Invalid ResponseHeader';
            if (!util.isArray(respHeader)) respHeader = [respHeader];
            var hasErrors,
                errorMsgs = [];

            respHeader.forEach(function (header) {
                // check for general error
                if (!header.TransactionStatus || header.TransactionStatus == 'ERROR') {
                    hasErrors = true;
                    errorMsgs.push(header.TransactionMessage);
                }
            });

            if (orderResponse && orderResponse.OrderDetails) {
                // check for query error
                (orderResponse.OrderDetails || []).forEach(function (orderDetail) {
                    if (!orderDetail || !orderDetail.Status || orderDetail.Status !== 'SUCCESS') {
                        hasErrors = true;
                        errorMsgs.push(orderDetail.Message);
                    }
                });
            }
            vc2_util.log('validateResponse', 'hasErrors: ', [hasErrors, errorMsgs]);
            if (hasErrors && errorMsgs.length) throw errorMsgs.join(', ');
            return true;
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
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            vc2_util.log(logTitle, '>> option: ', option);

            try {
                LibArrowAPI.initialize(option);

                var response = this.processRequest();
                if (!response) throw 'Unable to get response';

                if (option.debugMode) {
                    if (!option.showLines) return response;
                }

                var itemArray = [],
                    orderList = [];

                var objOrderResponse = response.OrderResponse;
                if (
                    !objOrderResponse ||
                    !objOrderResponse.OrderDetails ||
                    !objOrderResponse.OrderDetails.length
                )
                    throw 'Missing order details';

                // for (var i = 0, j = objOrderResponse.OrderDetails.length; i < j; i++) {
                (objOrderResponse.OrderDetails || []).forEach(function (OrderDetail) {
                    // var OrderDetail = objOrderResponse.OrderDetails[i];

                    try {
                        if (
                            !OrderDetail ||
                            !OrderDetail.Status ||
                            OrderDetail.Status !== 'SUCCESS'
                        ) {
                            throw OrderDetail && OrderDetail.Message
                                ? OrderDetail.Message
                                : 'Order Not Found';
                        }

                        /// ORDER DATA /////
                        var orderData = {
                            Status: OrderDetail.OrderStatusDescription,
                            OrderNum: OrderDetail.Reseller ? OrderDetail.Reseller.PONumber : null,
                            VendorOrderNum: OrderDetail.ArrowSONumber,
                            OrderDate: vc2_util.parseFormatDate(
                                OrderDetail.ArrowSODate,
                                'MM/DD/YYYY'
                            ),
                            Total: OrderDetail.OrderTotalAmount,
                            InvoiceNo: 'NA'
                        };

                        orderList.push(orderData);
                        /////////////

                        var orderLines = OrderDetail.OrderLinesList
                            ? OrderDetail.OrderLinesList.OrderLines
                            : null;

                        if (!util.isArray(orderLines) || vc2_util.isEmpty(orderLines))
                            throw 'Missing item lines';

                        // for (var ii = 0, jj = orderLines.length; ii < jj; ii++) {
                        (orderLines || []).forEach(function (lineInfo) {
                            // var itemObj = LibArrowAPI.extractLineData(lineDetail, OrderDetail);

                            var itemObj = {
                                order_num: orderData.VendorOrderNum || 'NA',
                                order_status: orderData.Status || 'NA',
                                order_date: orderData.OrderDate || 'NA',
                                order_eta: 'NA',
                                deliv_date: 'NA',
                                prom_date: 'NA',

                                item_num: lineInfo.MFGPartNumber || 'NA',
                                item_sku: lineInfo.VendorPartNumber || 'NA',
                                vendorSKU: lineInfo.VendorPartNumber || 'NA',
                                item_altnum: 'NA',

                                line_num: lineInfo.ResellerPOLineNumber || 'NA',
                                line_status: lineInfo.ItemStatusOracle || 'NA',
                                line_price: lineInfo.UnitPrice || 'NA',

                                ship_qty: parseInt(lineInfo.ShippedQty || '0'),
                                ship_date: 'NA',
                                carrier: lineInfo.OracleShipViaCode || 'NA',
                                tracking_num: 'NA',
                                serial_num: 'NA',
                                is_shipped: false
                            };
                            itemObj.is_shipped = vc2_util.inArray(
                                itemObj.line_status,
                                LibArrowAPI.ValidShippedStatus
                            );

                            /// Process Serials
                            var serialsList = [],
                                serialNumList = lineInfo.SerialNumberList
                                    ? lineInfo.SerialNumberList.SerialNumber
                                    : null;
                            (serialNumList || []).forEach(function (serialNum) {
                                if (
                                    !vc2_util.isEmpty(serialNum.ID) &&
                                    !vc2_util.inArray(serialNum.ID, serialsList)
                                )
                                    serialsList.push(serialNum.ID);

                                return true;
                            });
                            if (!vc2_util.isEmpty(serialsList))
                                itemObj.serial_num = serialsList.join(',');

                            //// PROCESS Tracking, ETA,
                            var shipInfo = {
                                    eta: [],
                                    shipped: [],
                                    tracking: [],
                                    carrier: []
                                },
                                statusInfoList = lineInfo.StatusInfoList
                                    ? lineInfo.StatusInfoList.StatusInfo
                                    : null;
                            (statusInfoList || []).forEach(function (statusInfo) {
                                if (
                                    statusInfo.EstimatedShipDate &&
                                    !vc2_util.inArray(statusInfo.EstimatedShipDate, shipInfo.eta)
                                )
                                    shipInfo.eta.push(statusInfo.EstimatedShipDate);

                                if (
                                    statusInfo.ActualShipDate &&
                                    !vc2_util.inArray(statusInfo.ActualShipDate, shipInfo.shipped)
                                )
                                    shipInfo.shipped.push(statusInfo.ActualShipDate);

                                if (
                                    statusInfo.TrackingNumber &&
                                    !vc2_util.inArray(statusInfo.TrackingNumber, shipInfo.tracking)
                                )
                                    shipInfo.tracking.push(statusInfo.TrackingNumber);

                                if (
                                    statusInfo.CarrierName &&
                                    !vc2_util.inArray(statusInfo.CarrierName, shipInfo.carrier)
                                )
                                    shipInfo.carrier.push(statusInfo.CarrierName);
                                return true;
                            });

                            if (!vc2_util.isEmpty(shipInfo.eta))
                                itemObj.order_eta = shipInfo.eta.shift();
                            if (!vc2_util.isEmpty(shipInfo.shipped))
                                itemObj.ship_date = shipInfo.shipped.shift();
                            if (!vc2_util.isEmpty(shipInfo.tracking))
                                itemObj.tracking_num = shipInfo.tracking.join(',');
                            if (!vc2_util.isEmpty(shipInfo.carrier))
                                itemObj.carrier = shipInfo.carrier.shift();

                            itemArray.push(itemObj);
                        });
                    } catch (order_error) {
                        vc2_util.logError(logTitle, order_error);
                        throw order_error;
                    }
                });
                // run through itemArray and check for DATE_FIELDS
                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;

                        itemObj[dateField] = vc2_util.parseFormatDate(
                            itemObj[dateField],
                            'MM/DD/YYYY'
                        );
                    });
                });

                util.extend(returnValue, {
                    Orders: orderList,
                    Lines: itemArray,
                    Source: response
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        processBills: function (option) {
            // var logTitle = [LogTitle, 'processBills'].join('::'),
            //     returnValue = {};
            // option = option || {};
            // vc2_util.log(logTitle, '>> option: ', option);
            // try {
            //     LibArrowAPI.initialize(option);
            //     var response = this.processRequest();
            //     if (!response) throw 'Unable to get response';
            //     if (option.debugMode) {
            //         if (!option.showLines) return response;
            //     }
            //     var itemArray = [],
            //         orderList = [];
            //     var objOrderResponse = response.OrderResponse;
            //     if (
            //         !objOrderResponse ||
            //         !objOrderResponse.OrderDetails ||
            //         !objOrderResponse.OrderDetails.length
            //     )
            //         throw 'Missing order details';
            //     // for (var i = 0, j = objOrderResponse.OrderDetails.length; i < j; i++) {
            //     (objOrderResponse.OrderDetails || []).forEach(function (OrderDetail) {
            //         // var OrderDetail = objOrderResponse.OrderDetails[i];
            //         try {
            //             if (
            //                 !OrderDetail ||
            //                 !OrderDetail.Status ||
            //                 OrderDetail.Status !== 'SUCCESS'
            //             ) {
            //                 throw OrderDetail && OrderDetail.Message
            //                     ? OrderDetail.Message
            //                     : 'Order Not Found';
            //             }
            //             /// ORDER DATA /////
            //             var orderData = {
            //                 Status: OrderDetail.OrderStatusDescription,
            //                 OrderNum: OrderDetail.Reseller ? OrderDetail.Reseller.PONumber : null,
            //                 VendorOrderNum: OrderDetail.ArrowSONumber,
            //                 OrderDate: vc2_util.parseFormatDate(
            //                     OrderDetail.ArrowSODate,
            //                     'MM/DD/YYYY'
            //                 ),
            //                 Total: OrderDetail.OrderTotalAmount,
            //                 InvoiceNo: 'NA'
            //             };
            //             orderList.push(orderData);
            //             /////////////
            //             var orderLines = OrderDetail.OrderLinesList
            //                 ? OrderDetail.OrderLinesList.OrderLines
            //                 : null;
            //             if (!util.isArray(orderLines) || vc2_util.isEmpty(orderLines))
            //                 throw 'Missing item lines';
            //             // for (var ii = 0, jj = orderLines.length; ii < jj; ii++) {
            //             (orderLines || []).forEach(function (lineInfo) {
            //                 // var itemObj = LibArrowAPI.extractLineData(lineDetail, OrderDetail);
            //                 var itemObj = {
            //                     order_num: orderData.VendorOrderNum || 'NA',
            //                     order_status: orderData.Status || 'NA',
            //                     order_date
        }
    };
});
