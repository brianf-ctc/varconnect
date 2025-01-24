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
                        url: CURRENT.vendorConfig.accessEndPoint,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.vendorConfig.apiKey,
                            client_secret: CURRENT.vendorConfig.apiSecret,
                            scope: ['api://', CURRENT.vendorConfig.apiKey, '/.default'].join(''),
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
            var token = vc2_util.getNSCache({ key: 'VC_ARROW_TOKEN' });
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
                        url: CURRENT.vendorConfig.endPoint,
                        body: JSON.stringify({
                            RequestHeader: {
                                TransactionType: 'RESELLER_ORDER_STATUS',
                                Region: 'NORTH_AMERICAS',
                                SourceTransactionKeyID: null,
                                RequestTimestamp: null,
                                Country: 'US',
                                PartnerID: CURRENT.vendorConfig.customerNo
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
                            'Ocp-Apim-Subscription-Key': CURRENT.vendorConfig.oauthScope
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
        }
    };

    return {
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var response = option.response,
                    itemArray = [];

                var objOrderResponse = response.OrderResponse;
                if (
                    !objOrderResponse ||
                    !objOrderResponse.OrderDetails ||
                    !objOrderResponse.OrderDetails.length
                )
                    throw 'Missing order details';

                var orderResp = objOrderResponse.OrderDetails[0];
                var orderDate, arrowSONum;

                // validate the response)

                if (!orderResp || !orderResp.Status || orderResp.Status !== 'SUCCESS') {
                    throw orderResp && orderResp.Message ? orderResp.Message : 'Order Not Found';
                }

                if (orderResp.hasOwnProperty('ArrowSONumber')) arrowSONum = orderResp.ArrowSONumber;
                if (orderResp.hasOwnProperty('Reseller')) {
                    orderDate = orderResp.Reseller.PODate;
                }

                if (orderResp.hasOwnProperty('OrderLinesList')) {
                    var orderLines = orderResp.OrderLinesList.OrderLines;

                    if (orderLines.length) {
                        for (var i = 0; i < orderLines.length; i++) {
                            var orderLineObj = orderLines[i];
                            // map here...
                            var orderItem = {
                                order_date: orderDate || 'NA',
                                line_num: orderLineObj.ResellerPOLineNumber || 'NA',
                                item_num: orderLineObj.MFGPartNumber || 'NA',
                                vendorSKU: orderLineObj.VendorPartNumber || 'NA',
                                order_num: orderLineObj.InvoiceNumber || arrowSONum || 'NA',
                                ship_qty: parseInt(orderLineObj.ShippedQty || '0'),
                                carrier: orderLineObj.OracleShipViaCode || 'NA',
                                order_status: orderLineObj.ItemStatusOracle || 'NA',
                                order_eta: 'NA',
                                ship_date: 'NA',
                                tracking_num: 'NA',
                                serial_num: 'NA'
                            };
                            // check for is shipped based on status
                            orderItem.is_shipped = vc2_util.inArray(
                                orderItem.order_status.toUpperCase(),
                                LibArrowAPI.ValidShippedStatus
                            );

                            // shipping details
                            if (orderLineObj.hasOwnProperty('StatusInfoList')) {
                                var statusInfo = orderLineObj.StatusInfoList.StatusInfo;
                                if (statusInfo.length) {
                                    var statusInfoObj = statusInfo[0]; // only contains 1
                                    if (statusInfoObj.hasOwnProperty('EstimatedShipDate')) {
                                        orderItem.order_eta = statusInfoObj.EstimatedShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('ActualShipDate')) {
                                        orderItem.ship_date = statusInfoObj.ActualShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('TrackingNumber')) {
                                        orderItem.tracking_num = statusInfoObj.TrackingNumber;
                                    }
                                }
                            }

                            // serial number list
                            if (orderLineObj.hasOwnProperty('SerialNumberList')) {
                                var serialNumbers = [];
                                var serialNumObj = orderLineObj.SerialNumberList.SerialNumber;
                                log.debug('serialNumObj', serialNumObj);
                                if (serialNumObj.length) {
                                    for (var j = 0; j < serialNumObj.length; j++) {
                                        if (serialNumObj[j].hasOwnProperty('ID'))
                                            serialNumbers.push(serialNumObj[j].ID);
                                        else serialNumbers.push(JSON.stringify(serialNumObj[j]));
                                    }
                                    orderItem.serial_num = serialNumbers.join(',');
                                }
                            }

                            // check for is_shipped, based on ship_date
                            if (
                                !orderItem.is_shipped &&
                                orderItem.ship_date &&
                                orderItem.ship_date != 'NA' &&
                                orderItem.ship_qty &&
                                orderItem.ship_qty != 0
                            ) {
                                var shippedDate = moment(orderItem.ship_date).toDate();
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
                                    orderItem.is_shipped = true;
                            }

                            vc2_util.log(logTitle, '>> line data: ', orderItem);

                            itemArray.push(orderItem);
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
                returnValue = [];
            option = option || {};

            log.audit(logTitle, option);

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var responseBody = this.processRequest();
                if (!responseBody) throw 'Unable to get response';

                returnValue = this.processResponse({ response: responseBody });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
