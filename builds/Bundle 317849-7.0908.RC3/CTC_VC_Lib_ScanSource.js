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
        LogStatus = vc2_constant.LIST.VC_LOG_STATUS;

    var LibScansource = {
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
                            grant_type: 'client_credentials',
                            scope: CURRENT.vendorConfig.oauthScope
                        }),
                        headers: {
                            'Ocp-Apim-Subscription-Key': '4c83c3da-f5e5-4901-954f-399ef8175603', // add this to the config record
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
                            CURRENT.vendorConfig.endPoint +
                            ('/list?customerNumber=' + CURRENT.vendorConfig.customerNo) +
                            ('&poNumber=' + CURRENT.recordNum),
                        headers: CURRENT.Headers
                    }
                });
                vc2_util.handleJSONResponse(reqOrderList);
                if (!reqOrderList.PARSED_RESPONSE) throw 'Unable to fetch server response';

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
                            CURRENT.vendorConfig.endPoint +
                            ('/detail?salesOrderNumber=' +
                                option.OrderNumber +
                                '&customerNumber=') +
                            (CURRENT.vendorConfig.customerNo + '&excludeSerialTracking=false'),
                        headers: CURRENT.Headers
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

    var EntryPoint = {};

    EntryPoint.process = function (option) {
        var logTitle = [LogTitle, 'process'].join('::'),
            returnValue = [];
        option = option || {};

        try {
            var arrResponse = this.processRequest(option);
            if (!arrResponse) throw 'Empty response';

            returnValue = this.processResponse(arrResponse);
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw error;
        }

        return returnValue;
    };

    EntryPoint.processRequest = function (option) {
        var logTitle = [LogTitle, 'processRequest'].join('::'),
            returnValue = [];
        option = option || {};

        try {
            CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
            CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
            vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

            if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

            LibScansource.generateToken();
            if (!CURRENT.accessToken) throw 'Unable to generate access token';

            CURRENT.Headers = {
                Authorization: 'Bearer ' + CURRENT.accessToken,
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': '4c83c3da-f5e5-4901-954f-399ef8175603' // add this to the config record
            };

            var arrPOResponse = LibScansource.getOrders();
            if (!arrPOResponse) throw 'Unable to get transaction lists for PO';

            var arrReturnResp = [];
            arrPOResponse.forEach(function (orderData) {
                var respDetails = LibScansource.getOrderDetails(orderData);

                respDetails.DateEntered = orderData.DateEntered;
                if (respDetails) arrReturnResp.push(respDetails);
            });

            returnValue = arrReturnResp;
        } catch (error) {
            throw error;
        }

        return returnValue;
    };
    EntryPoint.processResponse = function (orderDetails) {
        var logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = [];

        try {
            var outputArray = [];

            orderDetails.forEach(function (orderDetail) {
                vc2_util.log(logTitle, '>> Order Detail: ', orderDetail);
                var itemArray = [],
                    deliveryArray = [];

                (orderDetail.SalesOrderLines || []).forEach(function (orderLine) {
                    var lineData = {
                        order_date: moment(orderDetail.DateEntered).format('MM/DD/YYYY'),
                        order_num: orderDetail.SalesOrderNumber,
                        vendorSKU: orderLine.ItemNumber,
                        item_num: orderLine.ProductMfrPart,
                        ship_qty: parseInt(orderLine.Shipped, 10),
                        line_num: orderLine.LineNumber
                    };
                    itemArray.push(lineData);
                    return true;
                });
                vc2_util.log(logTitle, '// Item Array: ', itemArray);

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
                            order_date: moment(orderDetail.DateEntered).format('MM/DD/YYYY'),
                            order_num: orderDetail.SalesOrderNumber,
                            line_num:
                                Math.floor(
                                    deliveryLine.DeliveryDocumentNumber +
                                        ('.' + lineItem.DeliveryDocumentLineNumber)
                                ) * 1,
                            vendorSKU: lineItem.ItemNumber,
                            ship_qty: parseInt(lineItem.QuantityShipped),
                            ship_date: moment(deliveryLine.ShippedDate).format('MM/DD/YYYY'),
                            order_eta: '',
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
                        deliveryArray.push(orderItem);
                    });

                    return true;
                });
                vc2_util.log(logTitle, '// Delivery Array:', deliveryArray);

                itemArray.forEach(function (itemData) {
                    var matchingItems = vc2_util.findMatching({
                        list: deliveryArray,
                        findAll: true,
                        filter: { vendorSKU: itemData.vendorSKU }
                    });
                    vc2_util.log(logTitle, '// matching sku: ', [itemData, matchingItems]);

                    var outputItem = util.extend({}, itemData);

                    if (matchingItems && matchingItems.length) {
                        matchingItems.forEach(function (itemMatch) {
                            util.extend(outputItem, itemMatch);
                            util.extend(
                                outputItem,
                                vc2_util.extractValues({
                                    source: itemData,
                                    params: ['line_num', 'ship_qty']
                                })
                            );
                        });
                    }

                    outputArray.push(outputItem);
                    return true;
                });
                vc2_util.log(logTitle, '// Output Array: ', outputArray);
            });
            returnValue = outputArray;
        } catch (error) {
            throw error;
        }

        return returnValue;
    };

    return EntryPoint;
});
