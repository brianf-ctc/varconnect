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
 * @Description Helper file for ScanSource to Get PO Status
 */

/**
 * Project Number:
 * Script Name: CTC_VC_Lib_ScanSource
 * Author: shawn.blackburn
 */

define([
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js',
    './Bill Creator/Libraries/moment'
], function (vc2_util, vc2_constant, moment) {
    'use strict';

    var LogTitle = 'WS:ScanSource',
        LogPrefix,
        CURRENT = { accessToken: null },
        DATE_FIELDS = [
            // 'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ],
        ERROR_MSG = vc2_constant.ERRORMSG,
        LogStatus = vc2_constant.LIST.VC_LOG_STATUS;

    var DEFAULT_SUBSCRIPTION_KEY = '4c83c3da-f5e5-4901-954f-399ef8175603';

    var LibScansource = {
        SkippedStatus: ['CANCELLED', 'ON HOLD', 'QUOTATION/SALES'],
        ShippedStatus: ['COMPLETELY SHIPPED', 'PARTIALLY SHIPPED'],
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
                    query: {
                        url: CURRENT.orderConfig.accessEndPoint,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.orderConfig.apiKey,
                            client_secret: CURRENT.orderConfig.apiSecret,
                            grant_type: 'client_credentials',
                            scope: CURRENT.orderConfig.oauthScope
                        }),
                        headers: {
                            'Ocp-Apim-Subscription-Key':
                                CURRENT.orderConfig.subscriptionKey || DEFAULT_SUBSCRIPTION_KEY,
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
            } finally {
                vc2_util.log(logTitle, '>> Access Token: ', returnValue);
            }

            return returnValue;
        },
        getTokenCache: function () {
            var token = vc2_util.getNSCache({
                key: [
                    'VC_SCANSOURCE_TOKEN',
                    CURRENT.orderConfig.apiKey,
                    CURRENT.orderConfig.subscriptionKey,
                    CURRENT.orderConfig.subsidiary,
                    vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
                ].join('|')
            });
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: 'VC_SCANSOURCE_TOKEN_00',
                    cacheTTL: 3599,
                    value: token
                });
                CURRENT.accessToken = token;
            }
            return token;
        },
        getOrders: function (option) {
            var logTitle = [LogTitle, 'getOrders'].join('::'),
                returnValue;
            try {
                var reqOrderList = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders List'].join(' : '),
                    recordId: CURRENT.recordId,
                    method: 'get',
                    query: {
                        url:
                            CURRENT.orderConfig.endPoint +
                            ('/list?customerNumber=' + CURRENT.orderConfig.customerNo) +
                            ('&poNumber=' + CURRENT.recordNum),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            'Content-Type': 'application/json',
                            'Ocp-Apim-Subscription-Key':
                                CURRENT.orderConfig.subscriptionKey || DEFAULT_SUBSCRIPTION_KEY
                        }
                    }
                });
                vc2_util.handleJSONResponse(reqOrderList);
                if (!reqOrderList.PARSED_RESPONSE) throw 'Unable to fetch server response';

                if (vc2_util.isEmpty(reqOrderList.PARSED_RESPONSE))
                    throw 'No orders found for the PO';

                returnValue = reqOrderList.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }
            return returnValue;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
                returnValue;
            try {
                var reqOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' : '),
                    recordId: CURRENT.recordId,
                    method: 'get',
                    query: {
                        url:
                            CURRENT.orderConfig.endPoint +
                            ('/detail?salesOrderNumber=' +
                                option.OrderNumber +
                                '&customerNumber=') +
                            (CURRENT.orderConfig.customerNo + '&excludeSerialTracking=false'),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            'Content-Type': 'application/json',
                            'Ocp-Apim-Subscription-Key':
                                CURRENT.orderConfig.subscriptionKey || DEFAULT_SUBSCRIPTION_KEY
                        }
                    }
                });
                vc2_util.handleJSONResponse(reqOrderDetails);
                if (!reqOrderDetails.PARSED_RESPONSE) throw 'Unable to fetch server response';

                returnValue = reqOrderDetails.PARSED_RESPONSE;
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

            try {
                var arrResponse = this.processRequest(option);
                if (!arrResponse) throw 'Empty response';

                if (option.debugMode) {
                    if (!option.showLines) return arrResponse;
                }

                var itemInfoList = [],
                    deliveryInfoList = [],
                    itemArray = [],
                    orderList = [];

                arrResponse.forEach(function (orderDetail) {
                    var orderInfo = {
                        Status: orderDetail.Status || 'NA',
                        OrderNum: orderDetail.PONumber || 'NA',
                        VendorOrderNum:
                            orderDetail.EndUserPO || orderDetail.SalesOrderNumber || 'NA',
                        OrderDate: vc2_util.parseFormatDate(orderDetail.DateEntered || 'NA'),
                        Total: orderDetail.Total || 'NA',
                        InvoiceNo: 'NA',
                        Source: orderDetail
                    };

                    if (
                        vc2_util.inArray(
                            orderInfo.Status.toUpperCase(),
                            LibScansource.SkippedStatus
                        )
                    )
                        return true;

                    orderList.push(orderInfo);

                    (orderDetail.SalesOrderLines || []).forEach(function (orderLine) {
                        var itemObj = {
                            order_num: orderInfo.VendorOrderNum,
                            order_status: orderInfo.Status,
                            order_date: orderInfo.OrderDate, // this is already parsed date
                            order_eta: 'NA',
                            order_delivery_eta: 'NA',
                            deliv_date: 'NA',
                            prom_date: 'NA',

                            item_num: orderLine.ProductMfrPart,
                            vendorSKU: orderLine.ItemNumber,
                            item_sku: orderLine.ItemNumber,
                            item_altnum: 'NA',

                            line_num: orderLine.LineNumber || 'NA',
                            line_status: 'NA',
                            unitprice: vc2_util.parseFloat(orderLine.Price),
                            line_price: vc2_util.parseFloat(orderLine.Price),

                            ship_qty: orderLine.Shipped || 'NA',
                            ship_date: 'NA',
                            carrier: 'NA',
                            tracking_num: 'NA',
                            serial_num: 'NA',

                            is_shipped: vc2_util.inArray(
                                orderInfo.Status.toUpperCase(),
                                LibScansource.ShippedStatus
                            )
                        };

                        if (!vc2_util.isEmpty(orderLine.SerialNumbers))
                            itemObj.serial_num = orderLine.SerialNumbers.join(',');

                        (orderLine.ScheduleLines || []).forEach(function (scheduleLine) {
                            itemObj.order_eta = scheduleLine.EstimatedShipDate || 'NA';
                        });

                        vc2_util.log(logTitle, '...itemObj: ', itemObj);
                        itemArray.push(itemObj);
                    });
                    vc2_util.log(logTitle, '// itemInfoList:', itemInfoList);

                    // procedss the deliveries
                    (orderDetail.Deliveries || []).forEach(function (deliveryLine) {
                        var shipment = { tracking: [] };

                        (deliveryLine.Parcels || []).forEach(function (parcel) {
                            if (parcel.CarrierCode) shipment.carrier = parcel.CarrierCode;
                            if (
                                parcel.TrackingNumber &&
                                !vc2_util.inArray(parcel.TrackingNumber, shipment.tracking)
                            )
                                shipment.tracking.push(parcel.TrackingNumber);
                        });
                        vc2_util.log(logTitle, '...shipment:  ', shipment);

                        (deliveryLine.LineItems || []).forEach(function (lineItem) {
                            var orderItem = {
                                order_date: orderDetail.DateEntered || 'NA',
                                order_num: orderDetail.SalesOrderNumber,
                                line_num:
                                    Math.floor(
                                        deliveryLine.DeliveryDocumentNumber +
                                            ('.' + lineItem.DeliveryDocumentLineNumber)
                                    ) * 1,
                                vendorSKU: lineItem.ItemNumber,
                                ship_qty: parseInt(lineItem.QuantityShipped),
                                ship_date: deliveryLine.ShippedDate || 'NA',
                                carrier: shipment.carrier,
                                tracking_num: shipment.tracking.join(', ')
                            };

                            var arrSerials = [];
                            (lineItem.LineItemDetails || []).forEach(function (lineDetail) {
                                if (
                                    !vc2_util.isEmpty(lineDetail.SerialNumber) &&
                                    !vc2_util.inArray(lineDetail.SerialNumber, arrSerials)
                                )
                                    arrSerials.push(lineDetail.SerialNumber);
                            });
                            orderItem.serial_num = arrSerials.join(',');

                            vc2_util.log(logTitle, '...orderItem: ', orderItem);
                            deliveryInfoList.push(orderItem);
                        });

                        return true;
                    });
                });
                vc2_util.log(logTitle, '// Order List:', orderList);
                vc2_util.log(logTitle, '// Item Entries:', itemArray);
                vc2_util.log(logTitle, '// Delivery Info:', deliveryInfoList);

                // merge both itemARray and deliveryArray, using the itemArray.vendorSKU as the key
                (deliveryInfoList || []).forEach(function (deliveryItem) {
                    var matchedItems = vc2_util.findMatching({
                        list: itemArray,
                        findAll: true,
                        filter: { vendorSKU: deliveryItem.vendorSKU }
                    });

                    vc2_util.log(logTitle, '// matching sku: ', [deliveryItem, matchedItems]);
                    if (!matchedItems || !matchedItems.length) return true;

                    (matchedItems || []).forEach(function (itemMatch) {
                        util.extend(itemMatch, deliveryItem);
                    });
                });

                // run through itemArray and check for DATE_FIELDS
                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;

                        itemObj[dateField] = vc2_util.parseFormatDate(
                            itemObj[dateField],
                            'YYYY-MM-DD'
                        );
                    });
                });

                util.extend(returnValue, {
                    Orders: orderList,
                    Lines: itemArray,
                    Source: arrResponse
                });

                // return arr
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
                LibScansource.initialize(option);
                LibScansource.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                var arrPOResponse = LibScansource.getOrders();
                if (!arrPOResponse) throw 'Unable to get transaction lists for PO';

                vc2_util.log(logTitle, '>> Order List: ', arrPOResponse);

                var arrReturnResp = [];
                arrPOResponse.forEach(function (orderData) {
                    var respDetails = LibScansource.getOrderDetails(orderData);

                    respDetails.DateEntered = orderData.DateEntered;
                    if (respDetails) arrReturnResp.push(respDetails);
                });

                returnValue = arrReturnResp;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }
            return returnValue;
        }
    };
});
