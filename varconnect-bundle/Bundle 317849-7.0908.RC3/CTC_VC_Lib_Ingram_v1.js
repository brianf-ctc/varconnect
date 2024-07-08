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
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js',
    './Bill Creator/Libraries/moment'
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

    var LibIngramAPI = {
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
        ValidShippedStatus: ['SHIPPED', 'INVOICED', 'DELIVERED'],

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
        getValidOrders: function (option) {
            var logTitle = [LogTitle, 'getValidOrders'].join('::'),
                returnValue;
            try {
                vc2_util.log(logTitle, '///// GET VALID ORDERS:', option);

                var reqValidOrders = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    query: {
                        url:
                            CURRENT.vendorConfig.endPoint +
                            '/search?customerOrderNumber=' +
                            CURRENT.recordNum,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.vendorConfig.customerNo,
                            'IM-CountryCode': CURRENT.vendorConfig.country,
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

                vc2_util.log(logTitle, '//// GET ORDER DETAILS:', ingramOrder.ingramOrderNumber);

                var reqOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    recordId: CURRENT.recordId,
                    query: {
                        url: CURRENT.vendorConfig.endPoint + '/' + ingramOrder.ingramOrderNumber,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.vendorConfig.customerNo,
                            'IM-CountryCode': CURRENT.vendorConfig.country,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    }
                });
                vc2_util.handleJSONResponse(reqOrderDetails);

                returnValue = reqOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = vc2_util.extractError(error);
            }

            return returnValue;
        },
        getNSRecord: function (option) {
            var logTitle = [LogTitle, 'getNSRecord'].join('::'),
                returnValue;

            return false;

            var orderNumber = option.ingramOrderNumber;
            orderNumber = orderNumber.replace(/[^a-z0-9]/gi, '');
            orderNumber = [CURRENT.vendorConfig.fulfillmentPrefix, orderNumber].join('');

            var searchOption = {
                type: 'itemfulfillment',
                filters: [
                    ['type', 'anyof', 'ItemShip'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    [
                        "formulatext: REGEXP_REPLACE({custbody_ctc_if_vendor_order_match}, '[^a-zA-Z0-9]', '')",
                        'is',
                        orderNumber
                    ]
                ],
                columns: ['internalid', 'transactionnumber', 'custbody_ctc_if_vendor_order_match']
            };

            var nsItemFF = null;
            ns_search
                .create(searchOption)
                .run()
                .each(function (row) {
                    nsItemFF = row.id;
                    return true;
                });

            returnValue = nsItemFF;

            vc2_util.log(logTitle, '/// nsitemff: ', nsItemFF);
            return returnValue;
        },
        extractLineData: function (respLineData) {
            var logTitle = [LogTitle, 'extractLineData'].join('::'),
                returnValue;

            try {
                vc2_util.log(logTitle, '// EXTRACT line data...', respLineData);

                // initialize the line data
                var lineData = {
                    line_num: respLineData.customerLineNumber
                        ? respLineData.customerLineNumber
                        : 'NA',
                    item_num: respLineData.vendorPartNumber ? respLineData.vendorPartNumber : 'NA',
                    item_num_alt: respLineData.ingramPartNumber
                        ? respLineData.ingramPartNumber
                        : 'NA',
                    vendorSKU: respLineData.ingramPartNumber ? respLineData.ingramPartNumber : 'NA',
                    order_num: respLineData.subOrderNumber ? respLineData.subOrderNumber : 'NA',
                    line_status: respLineData.lineStatus ? respLineData.lineStatus : 'NA',
                    // promised_date: respLineData.promisedDeliveryDate || 'NA',
                    ship_qty:
                        respLineData.hasOwnProperty('quantityConfirmed') &&
                        !vc2_util.isEmpty(respLineData.quantityConfirmed)
                            ? respLineData.quantityConfirmed
                            : respLineData.quantityOrdered
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
                        order_eta: shipmentDetail.estimatedDeliveryDate || '',
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
                        order_date: shipmentDetail.invoiceDate || shipData.order_date,
                        ship_date: shipmentDetail.shippedDate || shipData.ship_date,
                        order_eta: shipmentDetail.estimatedDeliveryDate || shipData.order_eta || '',
                        order_eta_ship:
                            shipmentDetail.estimatedDeliveryDate || shipData.order_eta_ship
                    });

                    if (!shipmentDetail.carrierDetails) continue;
                    for (var ii = 0, jj = shipmentDetail.carrierDetails.length; ii < jj; ii++) {
                        var carrierDetails = shipmentDetail.carrierDetails[ii];

                        // vc2_util.log(logTitle, '.... carrierDetails .... ', carrierDetails);

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
                var itemArray = [];

                // detect if v6.1 or v6.0
                if (
                    CURRENT.vendorConfig.endPoint &&
                    CURRENT.vendorConfig.endPoint.match(/\/v6.1\//)
                ) {
                    vc2_util.log(
                        logTitle,
                        '*** VER 6.1 Endpoint *** ',
                        CURRENT.vendorConfig.endPoint
                    );
                    CURRENT.apiver = APIVER.ver61;
                    LibIngramAPI = LibIngramAPIV61;
                }

                var arrResponse = this.processRequest(option),
                    arrValidOrders = arrResponse.Orders || [];

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i];

                    var logPrefix = '[' + validOrder.ingramOrderNumber + '] ';

                    vc2_util.log(logTitle, logPrefix + '**** Ingram Order: **** ', validOrder);

                    var ingramOrderDate = validOrder.ingramOrderDate;

                    var defaultETA = {
                        date: moment(ingramOrderDate).add(1, 'day').toDate(),
                        text: moment(ingramOrderDate).add(1, 'day').format('YYYY-MM-DD')
                    };

                    vc2_util.log(logTitle, logPrefix + '// defaultETA: ', defaultETA);

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
                        var orderItem = LibIngramAPI.extractLineData(respOrderDetails.lines[ii]);

                        util.extend(orderItem, {
                            order_status: validOrder.orderStatus,
                            is_shipped: vc2_util.inArray(
                                orderItem.line_status.toUpperCase(),
                                LibIngramAPI.ValidShippedStatus
                            ),
                            ns_record: null
                            // LibIngramAPI.getNSRecord({
                            //     ingramOrderNumber: lineData.order_num
                            // }) || null
                        });

                        if (!orderItem.order_eta || orderItem.order_eta == 'NA') {
                            orderItem.order_eta = defaultETA.text;
                        }

                        if (
                            !orderItem.is_shipped &&
                            orderItem.ship_date &&
                            orderItem.ship_date != 'NA' &&
                            orderItem.ship_qty &&
                            orderItem.ship_qty != 0
                        ) {
                            var shippedDate = moment(orderItem.ship_date, 'YYYY-MM-DD').toDate();

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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                // generate the
                LibIngramAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                var arrValidOrders = LibIngramAPI.getValidOrders(),
                    arrOrderDetails = {};

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i];

                    var respOrderDetails = LibIngramAPI.getOrderDetails({
                        ingramOrder: validOrder
                    });

                    arrOrderDetails[validOrder.ingramOrderNumber] = respOrderDetails;
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
});
