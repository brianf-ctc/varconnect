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
    'N/search',
    './../CTC_VC2_Lib_Utils.js',
    './../CTC_VC2_Constants.js',
    './moment'
], function (ns_search, vc2_util, vc2_constant, moment) {
    'use strict';
    var LogTitle = 'WS:IngramAPI',
        LogPrefix;

    var APIVER = {
        ver6: 'v6',
        ver61: 'v6.1'
    };

    var CURRENT = { apiver: APIVER.ver6 },
        LogStatus = vc2_constant.LIST.VC_LOG_STATUS;

    var HelperOld = {
        parseToNSDate: function (dateStr) {
            var logTitle = [LogTitle, 'parseToNSDate'].join('::'),
                dateObj;

            try {
                dateObj =
                    dateStr && dateStr !== 'NA' ? moment(dateStr, 'YYYY-MM-DD').toDate() : null;
            } catch (err) {}

            return dateObj;
        }
    };

    var LibIngramAPI_old = {
        ValidOrderStatus: [
            'SHIPPED',
            'PROCESSING',
            'DELIVERED',
            'BACKORDERED',
            'PARTIALLY DELIVERED',
            'PARTIALLY SHIPPED'
        ],
        ValidLineStatus: [
            'SHIPPED',
            'PROCESSING',
            'IN PROGRESS',
            'ON HOLD',
            'DELIVERED',
            'BACKORDERED',
            'ORDER NOT PRINTED'
        ],
        SkippedStatus: ['CANCELED', 'CANCELLED'],
        ValidShippedStatus: ['SHIPPED', 'INVOICED', 'DELIVERED', 'E-DELIVERED'],
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
            } finally {
                vc2_util.log(logTitle, '>> Access Token: ', returnValue);
            }

            return returnValue;
        },
        getTokenCache: function () {
            // Retrieve the token from the cache
            var token = vc2_util.getNSCache({ key: 'VC_INGRAM_TOKEN' });

            // If the token is not available in the cache, generate a new one
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            // If a token is available, store it in the cache
            if (token) {
                vc2_util.setNSCache({
                    key: 'VC_INGRAM_TOKEN',
                    cacheTTL: 14400, // Cache TTL is set to 4 hours (14400 seconds)
                    value: token
                });

                // Store the token in the CURRENT object for future use
                CURRENT.accessToken = token;
            }

            // Return the token
            return token;
        },
        getValidOrders: function (option) {
            var logTitle = [LogTitle, 'getValidOrders'].join('::'),
                returnValue;
            try {
                vc2_util.log(logTitle, '///// GET VALID ORDERS:', option);

                var reqValidOrders = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    query: {
                        url:
                            CURRENT.orderConfig.endPoint +
                            '/search?customerOrderNumber=' +
                            CURRENT.recordNum,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });
                vc2_util.handleJSONResponse(reqValidOrders);

                var respIngramOrders = reqValidOrders.PARSED_RESPONSE;
                if (!respIngramOrders) throw 'Unable to fetch server response';

                var arrOrderDetails = [];
                if (!respIngramOrders.orders) throw 'Orders are not found';

                for (var i = 0, j = respIngramOrders.orders.length; i < j; i++) {
                    var ingramOrder = respIngramOrders.orders[i];

                    if (!ingramOrder.orderStatus) continue;
                    if (
                        vc2_util.inArray(
                            ingramOrder.orderStatus.toUpperCase(),
                            LibIngramAPI.SkippedStatus
                        )
                    )
                        continue;

                    arrOrderDetails.push(ingramOrder);
                }

                returnValue = arrOrderDetails;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
                returnValue;

            try {
                var ingramOrder = option.ingramOrder;
                if (!ingramOrder) throw 'Ingram Order is required';

                vc2_util.log(logTitle, '/// GET ORDER DETAILS:', ingramOrder.ingramOrderNumber);
                if (!ingramOrder.ingramOrderNumber) throw 'Ingram Order is required';

                var reqOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    recordId: CURRENT.recordId,
                    query: {
                        url: CURRENT.orderConfig.endPoint + '/' + ingramOrder.ingramOrderNumber,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    }
                });
                vc2_util.handleJSONResponse(reqOrderDetails);

                returnValue = reqOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = vc2_util.extractError(error);
                // throw error;
            }

            return returnValue;
        },
        extractLineData: function (respLineData, orderDetails) {
            var logTitle = [LogTitle, 'extractLineData'].join('::'),
                returnValue;

            try {
                vc2_util.log(logTitle, '// EXTRACT line data...', respLineData);

                if (!respLineData) throw 'Missing line data information';

                // initialize the line data
                var lineData = {
                    line_num: respLineData.customerLineNumber || 'NA',
                    item_num: respLineData.vendorPartNumber || 'NA',
                    item_num_alt: respLineData.ingramPartNumber || 'NA',
                    vendorSKU: respLineData.ingramPartNumber || 'NA',
                    order_num: respLineData.subOrderNumber || 'NA',
                    line_status: respLineData.lineStatus || 'NA',
                    order_date: orderDetails.ingramOrderDate || 'NA',
                    ship_qty:
                        respLineData.hasOwnProperty('quantityConfirmed') &&
                        !vc2_util.isEmpty(respLineData.quantityConfirmed)
                            ? respLineData.quantityConfirmed
                            : respLineData.hasOwnProperty('quantityOrdered') &&
                              !vc2_util.isEmpty(respLineData.quantityOrdered)
                            ? respLineData.quantityOrdered
                            : 'NA'
                };
                lineData.line_no = vc2_util.parseFloat(lineData.line_num);

                /// extract serials, tracking
                var shipment = LibIngramAPI.extractShipmentDetails(
                    respLineData.shipmentDetails,
                    lineData
                );

                util.extend(lineData, {
                    ship_date: shipment.ship_date || 'NA',
                    order_date: shipment.order_date || 'NA',
                    order_eta: respLineData.promisedDeliveryDate || shipment.order_eta || 'NA',
                    carrier: shipment.carrier || 'NA',
                    order_eta_ship: shipment.order_eta_ship || 'NA',
                    eta_delivery_date: shipment.eta_delivery_date || 'NA',
                    serial_num:
                        shipment.serialNos && shipment.serialNos.length
                            ? shipment.serialNos.join(',')
                            : 'NA',
                    tracking_num:
                        shipment.trackingNos && shipment.trackingNos.length
                            ? shipment.trackingNos.join(',')
                            : 'NA'
                });

                var estimatedDates = this.extractEstimatedDates(respLineData.estimatedDates);
                if (estimatedDates)
                    util.extend(lineData, {
                        order_eta: estimatedDates.shipDate || lineData.order_eta,
                        eta_ship_desc: estimatedDates.shipDescription,
                        eta_ship_source: estimatedDates.shipSource,
                        eta_delivery_date: estimatedDates.deliveryDate
                    });

                returnValue = lineData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, '>> Line Data: ', returnValue);
            }

            return returnValue;
        },
        extractLineDataV61: function (respLineData, orderDetails) {},
        extractShipmentDetails: function (shipmentDetails, lineData) {
            var logTitle = [LogTitle, 'extractShipmentDetails'].join('::'),
                returnValue;

            try {
                var shipData = {
                    quantity: 0,
                    serialNos: [],
                    trackingNos: []
                };

                if (!shipmentDetails) return false;

                for (var i = 0, j = shipmentDetails.length; i < j; i++) {
                    var shipmentDetail = shipmentDetails[i];

                    util.extend(shipData, {
                        // detail: shipmentDetail,
                        quantity: shipData.quantity + parseFloat(shipmentDetail.quantity),
                        order_date: shipmentDetail.invoiceDate,
                        ship_date: shipmentDetail.shippedDate,
                        estdeliv_date: shipmentDetail.estimatedDeliveryDate,
                        order_eta_ship: shipmentDetail.estimatedDeliveryDate
                    });

                    if (!shipmentDetail.carrierDetails) continue;

                    shipData.carrier = shipmentDetail.carrierDetails.carrierName;

                    if (!shipmentDetail.carrierDetails.trackingDetails) continue;
                    var trackingDetails = shipmentDetail.carrierDetails.trackingDetails;

                    var serialNos = this.extractSerialNos(trackingDetails),
                        trackingNos = this.extractTrackingNos(trackingDetails);

                    shipData.serialNos = shipData.serialNos.concat(serialNos);
                    shipData.trackingNos = shipData.trackingNos.concat(trackingNos);
                }

                shipData.serialNos = vc2_util.uniqueArray(shipData.serialNos);
                shipData.trackingNos = vc2_util.uniqueArray(shipData.trackingNos);

                returnValue = shipData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, '// Shipment details: ', returnValue);
            }

            return returnValue;
        },
        extractTrackingNos: function (trackingDetails) {
            var logTitle = [LogTitle, 'extractTrackingNos'].join('::');

            // vc2_util.log(logTitle, '.... trackingDetails: ', trackingDetails);
            var trackingNos = [];

            for (var i = 0, j = trackingDetails.length; i < j; i++) {
                if (trackingDetails[i].trackingNumber) {
                    trackingNos = trackingNos.concat(
                        trackingDetails[i].trackingNumber.split(/[\W]+/g)
                    );
                }
            }

            vc2_util.log(logTitle, '//// trackingNos: ', trackingNos);

            return trackingNos;
        },
        extractSerialNos: function (trackingDetails) {
            var logTitle = [LogTitle, 'extractSerialNos'].join('::');

            // vc2_util.log(logTitle, '.... trackingDetails: ', trackingDetails);
            var serialNos = [];

            for (var i = 0, j = trackingDetails.length; i < j; i++) {
                var serialNums =
                    trackingDetails[i].serialNumbers ||
                    trackingDetails[i].SerialNumbers ||
                    trackingDetails[i].serialnumbers;

                if (serialNums) {
                    serialNums.forEach(function (serialNum) {
                        serialNos.push(serialNum.serialNumber);
                        return true;
                    });
                }
            }
            vc2_util.log(logTitle, '//// serialNos: ', serialNos);

            return serialNos;
        },
        extractEstimatedDates: function (estDateDetails) {
            var logTitle = [LogTitle, 'extractEstimatedDates'].join('::'),
                returnValue;

            try {
                var estimatedDates = {};
                if (!estDateDetails || !estDateDetails.length) return;

                for (var i = 0, j = estDateDetails.length; i < j; i++) {
                    var ship = estDateDetails[i].ship,
                        delivery = estDateDetails[i].delivery;

                    if (ship)
                        util.extend(estimatedDates, {
                            shipDate: ship.shipDate,
                            shipDesc: ship.shipDescription,
                            shipSource: ship.shipSource
                        });

                    if (delivery)
                        util.extend(estimatedDates, {
                            deliveryDate: delivery.deliveryDate
                        });
                }

                returnValue = estimatedDates;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, '// Shipment details: ', returnValue);
            }

            return returnValue;
        },
        getDefaultETA: function (ingramOrderDate) {
            var logTitle = [LogTitle, 'getDefaultETA'].join('::'),
                returnValue;
            // var ingramOrderDate = validOrder.ingramOrderDate;
            var defaultETA = {
                date: moment(ingramOrderDate).add(1, 'day').toDate(),
                text: moment(ingramOrderDate).add(1, 'day').format(vc2_constant.GLOBAL.DATE_FORMAT)
            };
            vc2_util.log(logTitle, '// defaultETA: ', defaultETA);

            returnValue = defaultETA.text;
            return returnValue;
        }
    };

    var LibIngramAPIV61 = vc2_util.extend(LibIngramAPI, {
        extractShipmentDetails: function (shipmentDetails, lineData) {
            var logTitle = [LogTitle, 'extractShipmentDetails.V61'].join('::'),
                returnValue;

            try {
                var shipData = {
                    quantity: 0,
                    serialNos: [],
                    trackingNos: []
                };

                if (!shipmentDetails) return false;

                for (var i = 0, j = shipmentDetails.length; i < j; i++) {
                    var shipmentDetail = shipmentDetails[i];

                    // vc2_util.log(logTitle, '**** Shipment Detail **** ', shipmentDetail);

                    // skip this shipment if its not shipped yet
                    var shippedQty = 0;
                    if (shipmentDetail.shippedDate) {
                        shippedQty = parseFloat(shipmentDetail.quantity);
                    }

                    util.extend(shipData, {
                        quantity: shipData.quantity + shippedQty,
                        order_date: shipmentDetail.invoiceDate,
                        ship_date: shipmentDetail.shippedDate,
                        order_eta: shipmentDetail.estimatedShipDate,
                        order_delivery_eta: shipmentDetail.estimatedDeliveryDate
                        // order_eta_ship: shipmentDetail.estimatedDeliveryDate
                    });

                    if (!shipmentDetail.carrierDetails) continue;
                    for (var ii = 0, jj = shipmentDetail.carrierDetails.length; ii < jj; ii++) {
                        var carrierDetails = shipmentDetail.carrierDetails[ii];
                        shipData.carrier = carrierDetails.carrierName;

                        if (!carrierDetails.trackingDetails) continue;
                        var trackingDetails = carrierDetails.trackingDetails;

                        var serialNos = this.extractSerialNos(trackingDetails),
                            trackingNos = this.extractTrackingNos(trackingDetails);

                        shipData.serialNos = shipData.serialNos.concat(serialNos);
                        shipData.trackingNos = shipData.trackingNos.concat(trackingNos);
                    }
                }

                shipData.serialNos = vc2_util.uniqueArray(shipData.serialNos);
                shipData.trackingNos = vc2_util.uniqueArray(shipData.trackingNos);

                returnValue = shipData;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    });

    var returnOld = {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.orderConfig = option.orderConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';
                var itemArray = [];

                // detect if v6.1 or v6.0
                if (
                    CURRENT.orderConfig.endPoint &&
                    CURRENT.orderConfig.endPoint.match(/\/v6.1\//)
                ) {
                    vc2_util.log(
                        logTitle,
                        '*** VER 6.1 Endpoint *** ',
                        CURRENT.orderConfig.endPoint
                    );
                    CURRENT.apiver = APIVER.ver61;
                    LibIngramAPI = LibIngramAPIV61;
                }

                var arrResponse = this.processRequest(option),
                    arrValidOrders = arrResponse.Orders || [];

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i];

                    var logPrefix = '[' + validOrder.ingramOrderNumber + '] ';

                    vc2_util.log(
                        logTitle,
                        logPrefix + '**** Ingram Order: **** ',
                        validOrder.ingramOrderNumber
                    );

                    var respOrderDetails = arrResponse.OrderDetails
                        ? arrResponse.OrderDetails[validOrder.ingramOrderNumber]
                        : null;

                    if (
                        !respOrderDetails ||
                        !respOrderDetails.lines ||
                        !respOrderDetails.lines.length
                    )
                        continue;

                    vc2_util.log(
                        logTitle,
                        logPrefix + '// Order Detail num lines: ',
                        respOrderDetails.lines.length
                    );

                    for (var ii = 0, jj = respOrderDetails.lines.length; ii < jj; ii++) {
                        var orderItem = LibIngramAPI.extractLineData(
                            respOrderDetails.lines[ii],
                            respOrderDetails
                        );

                        util.extend(orderItem, {
                            order_status: validOrder.orderStatus,
                            is_shipped: vc2_util.inArray(
                                orderItem.line_status.toUpperCase(),
                                LibIngramAPI.ValidShippedStatus
                            )
                        });

                        if (!orderItem.order_eta || orderItem.order_eta == 'NA') {
                            orderItem.order_eta = LibIngramAPI.getDefaultETA(
                                validOrder.ingramOrderDate
                            );
                        }

                        if (
                            !orderItem.is_shipped &&
                            orderItem.ship_date &&
                            orderItem.ship_date != 'NA' &&
                            orderItem.ship_qty &&
                            orderItem.ship_qty != 0
                        ) {
                            var shippedDate = LibIngramAPI.parseToNSDate(orderItem.ship_date);

                            vc2_util.log(logTitle, '**** shipped date: ****', [
                                orderItem.ship_date,
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

                        // orderItem.eta_nsdate = Helper.parseToNSDate(orderItem.order_eta);
                        // orderItem.ship_nsdate = Helper.parseToNSDate(orderItem.ship_date);
                        // orderItem.order_nsdate = Helper.parseToNSDate(orderItem.order_date);

                        vc2_util.log(logTitle, '>> line data: ', orderItem);
                        itemArray.push(orderItem);
                    }
                }

                returnValue = itemArray;
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
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                // generate the
                LibIngramAPI.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                var arrValidOrders = LibIngramAPI.getValidOrders(),
                    arrOrderDetails = {};

                vc2_util.log(logTitle, '...arrValidOrders: ', arrValidOrders);

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i];

                    var respOrderDetails = LibIngramAPI.getOrderDetails({
                        ingramOrder: validOrder
                    });

                    // arrOrderDetails[validOrder. ] = respOrderDetails;
                }

                returnValue = {
                    Orders: arrValidOrders,
                    OrderDetails: arrOrderDetails
                };
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    };

    var CURRENT = {};
    var Helper = {
        setCurrentValues: function (option) {
            CURRENT.recordId = option.poId || option.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum;
            CURRENT.orderConfig = option.orderConfig;

            if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

            // Detect the endpoints
            var endPoint = CURRENT.orderConfig.endPoint;
            if (!endPoint) throw 'Missing end point configuration';

            if (endPoint.match(/\/v6.1\//gi)) {
                LibIngramAPI.EndPointV61 = endPoint;
                LibIngramAPI.EndPointV6 = endPoint.replace('/v6.1/', '/v6/');
            } else {
                LibIngramAPI.EndPointV6 = endPoint;
                LibIngramAPI.EndPointV61 = endPoint.replace('/v6/', '/v6.1/');
            }

            vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
        },
        validate
    };

    var LibIngramAPI = {
        EndPointV61: '',
        EndPointV6: '',
        ValidOrderStatus: [
            'SHIPPED',
            'PROCESSING',
            'DELIVERED',
            'BACKORDERED',
            'PARTIALLY DELIVERED',
            'PARTIALLY SHIPPED'
        ],
        ValidLineStatus: [
            'SHIPPED',
            'PROCESSING',
            'IN PROGRESS',
            'ON HOLD',
            'DELIVERED',
            'BACKORDERED',
            'ORDER NOT PRINTED'
        ],
        CacheName: 'VC_INGRAM_TOKEN',
        SkippedStatus: ['CANCELED', 'CANCELLED'],
        ValidShippedStatus: ['SHIPPED', 'INVOICED', 'DELIVERED', 'E-DELIVERED'],

        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;

            try {
                vc2_util.log(logTitle, '**** Generate Access Token ****');

                var requestOption = {
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'POST',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.orderConfig.accessEndPoint,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.orderConfig.apiKey,
                            client_secret: CURRENT.orderConfig.apiSecret,
                            grant_type: 'client_credentials'
                        })
                    }
                };
                var tokenReq = vc2_util.sendRequest(requestOption);
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
            // retrieve it on the cache
            var tokenCache = vc2_util.getNSCache({ key: this.CacheName });

            if (vc2_util.isEmpty(tokenCache)) tokenCache = this.generateToken();
            if (!vc2_util.isEmpty(tokenCache)) {
                // save the cached token
                vc2_util.setNSCache({
                    key: this.CacheName,
                    value: tokenCache
                });
                CURRENT.accessToken = tokenCache;
            }

            return tokenCache;
        },

        fetchValidOrders: function () {
            var logTitle = [LogTitle, 'fetchValidOrders'].join('::'),
                returnValue;

            try {
                vc2_util.log(logTitle, '**** Fetch Valid Orders ****');

                var respOrderSearch = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' '),
                    query: {
                        url: [
                            LibIngramAPI.EndPointV6,
                            '/search?customerOrderNumber=',
                            CURRENT.recordNum
                        ].join(),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });
                vc2_util.handleJSONResponse(respOrderSearch);
                if (respOrderSearch.PARSED_RESPONSE) throw 'Unable to parse server response';

                var parsedResponse = respOrderSearch.PARSED_RESPONSE;
                if (!vc2_util.isEmpty(parsedResponse.orders)) throw 'Orders are not found';

                var arrOrderList = [];

                for (var i = 0; i < parsedResponse.orders.length; i++) {
                    var ingramOrder = parsedResponse.orders[i];
                    if (!ingramOrder.orderStatus) continue;

                    if (
                        vc2_util.inArray(
                            ingramOrder.orderStatus.toUpperCase(),
                            LibIngramAPI.SkippedStatus
                        )
                    )
                        continue;

                    arrOrderList.push(ingramOrder);
                }
                returnValue = arrOrderList;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        fetchOrderDetailsV61: function (ingramOrder) {
            var logTitle = [LogTitle, 'fetchorderdetailsV61'].join('::'),
                returnValue;

            try {
                if (!ingramOrder) throw 'Missing Ingram order information';
                var ingramOrderNum = ingramOrder.ingramOrderNumber;

                vc2_util.log(logTitle, '**** Fetch Order Details ****', ingramOrderNum);

                var respOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    query: {
                        url: [LibIngramAPI.EndPointV61, '/', ingramOrderNum].join(),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });

                vc2_util.handleJSONResponse(respOrderDetails);
                returnValue = respOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        fetchOrderDetailsV6: function (ingramOrder) {
            var logTitle = [LogTitle, 'fetchorderdetailsV6'].join('::'),
                returnValue;

            try {
                if (!ingramOrder) throw 'Missing Ingram order information';
                var ingramOrderNum = ingramOrder.ingramOrderNumber;

                vc2_util.log(logTitle, '**** Fetch Order Details ****', ingramOrderNum);

                var respOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    query: {
                        url: [LibIngramAPI.EndPointV6, '/', ingramOrderNum].join(),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });

                vc2_util.handleJSONResponse(respOrderDetails);
                returnValue = respOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    };

    return {
        sampleProcess: function (option) {
            var ingramOrder = new IngramAPI();
            var accessToken = ingramOrder.generateToken();

            var ingramNewOrder = new IngramAPI({ accessToken: accessToken });

            var arrValidOrders = ingramOrder.search({ orderNum: option.orderNum });

            // loop arrOrders using for
            for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                var validOrder = arrValidOrders[i];

                var orderDetailsV6 = ingramOrder.orderDetails({
                    ingramOrderNum: validOrder.ingramOrderNumber,
                    version: 6
                });
            }
        },
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                Helper.setCurrentValues(option);
                if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

                var arrIngramOrders = this.processRequest(option),
                    arrValidOrders = arrIngramOrders.Orders || [];

                if (vc2_util.isEmpty(arrValidOrders)) throw 'Order search returned empty';

                vc2_util.log(logTitle, '***  Total Orders: ', arrValidOrders.length);

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i],
                        ingramOrderNum = validOrder.ingramOrderNumber;
                    var logPrefix = '[' + ingramOrderNum + '] ';

                    vc2_util.log(
                        logTitle,
                        logPrefix + '/// PROCESSING Ingram Order: ',
                        ingramOrderNum
                    );

                    var orderDetailV61 = arrIngramOrders[ingramOrderNum].V61;
                }
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
                Helper.setCurrentValues(option);
                if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

                // Generate the token
                LibIngramAPI.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                var arrValidOrders = LibIngramAPI.fetchValidOrders(),
                    OrderDetails = {};

                // Process the orders
                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i],
                        ingramOrderNum = validOrder.ingramOrderNumber;

                    OrderDetails[ingramOrderNum] = {
                        V6: LibIngramAPI.fetchOrderDetailsV6(validOrder),
                        'V6.1': LibIngramAPI.fetchOrderDetailsV61(validOrder)
                    };
                }

                returnValue = {
                    Orders: arrValidOrders,
                    Detais: OrderDetails
                };
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }
            return returnValue;
        }
    };
});
