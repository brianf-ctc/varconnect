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
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js',
    './Bill Creator/Libraries/moment'
], function (vc2_util, vc2_constant, moment) {
    var LogTitle = 'WS:IngramAPI';

    var CURRENT = {
            TokenName: 'VC_INGRAM_TOKEN',
            CacheTTL: 43200 // 12 hrs cache
        },
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date',
            'order_eta_ship',
            'eta_delivery_date'
        ],
        ERROR_MSG = vc2_constant.ERRORMSG;

    var RESPONSE = {
            OrderSearch: {},
            OrderDetails: {}
        },
        OUTPUT = {
            OrdersList: [],
            Items: []
        };

    var IngramOrders = {
        EndPoint: {},
        LIST: [],
        ORDERS: {},
        RESULT: {}
    };

    var LibIngramAPI = {
        ValidShippedStatus: ['SHIPPED', 'INVOICED', 'DELIVERED', 'E-DELIVERED'],
        SkippedStatus: ['CANCELED', 'CANCELLED'],
        generateToken: function () {
            var logTitle = [LogTitle, 'LibIngramAPI::generateToken'].join('::'),
                returnValue;

            try {
                var respToken = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
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
                vc2_util.handleJSONResponse(respToken);

                if (!respToken.PARSED_RESPONSE) throw 'Unable to generate token';
                returnValue = respToken.PARSED_RESPONSE.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        orderSearch: function (option) {
            var logTitle = [LogTitle, 'LibIngramAPI::orderSearch'].join('::'),
                returnValue;

            try {
                IngramOrders.EndPoint.search = [
                    LibIngramAPI.EndPointV6,
                    '/search?customerOrderNumber=',
                    CURRENT.recordNum
                ].join('');

                var respOrderSearch = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Search'].join(' '),
                    query: {
                        url: IngramOrders.EndPoint.search,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country || 'US', // default to US
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });

                vc2_util.handleJSONResponse(respOrderSearch);
                if (!respOrderSearch.PARSED_RESPONSE) throw 'Unable to fetch server response';

                var parsedOrders = respOrderSearch.PARSED_RESPONSE.orders;
                if (vc2_util.isEmpty(parsedOrders)) throw ERROR_MSG.ORDER_NOT_FOUND;

                returnValue = parsedOrders;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        orderDetails: function (option) {
            var logTitle = [LogTitle, 'LibIngramAPI::orderDetails'].join('::'),
                returnValue;

            var ingramOrderNum = option.orderNum,
                endpointUrl = option.endpointUrl || CURRENT.orderConfig.endPoint;

            try {
                IngramOrders.EndPoint.orderDetails = endpointUrl;

                var respOrderDetails = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    query: {
                        url: [IngramOrders.EndPoint.orderDetails, ingramOrderNum].join('/'),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.orderConfig.customerNo,
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CorrelationID': ['CTC', CURRENT.recordNum, CURRENT.recordId].join(
                                '-'
                            )
                        }
                    },
                    recordId: CURRENT.recordId
                });
                if (respOrderDetails.isError)
                    if (!respOrderDetails.PARSED_RESPONSE) throw respOrderDetails.errorMsg;

                // vc2_util.log(logTitle, '>> response: ', respOrderDetails);

                vc2_util.handleJSONResponse(respOrderDetails);
                if (!respOrderDetails.PARSED_RESPONSE) throw 'Unable to fetch server response';

                // vc2_util.log(logTitle, '>> parsed response: ', respOrderDetails.PARSED_RESPONSE);

                returnValue = respOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                return vc2_util.extractError(error);
                // throw error;
            }

            return returnValue;
        }
    };

    var LibOrderStatus = {
        initialize: function (option) {
            var logTitle = [LogTitle, 'LibOrderStatus::initialize'].join('::'),
                returnValue;

            CURRENT.recordId = option.poId || option.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum;
            CURRENT.orderConfig = option.orderConfig;

            if (!CURRENT.orderConfig) throw 'Missing vendor configuration';

            // Detect the endpoints
            var endPoint = CURRENT.orderConfig.endPoint;
            if (!endPoint) throw 'Missing end point configuration';

            if (endPoint.match(/\/v6.1\//gi)) {
                CURRENT.isV61 = true;
                LibIngramAPI.EndPointV61 = endPoint;
                LibIngramAPI.EndPointV6 = endPoint.replace('/v6.1/', '/v6/');
            } else {
                CURRENT.isV61 = false;
                LibIngramAPI.EndPointV6 = endPoint;
                LibIngramAPI.EndPointV61 = endPoint.replace('/v6/', '/v6.1/');
            }

            CURRENT.hasV61Errors = false;

            vc2_util.LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';

            return returnValue;
        },
        getTokenCache: function () {
            var accessToken = vc2_util.getNSCache({
                key: [
                    CURRENT.TokenName,
                    CURRENT.orderConfig.apiKey,
                    CURRENT.orderConfig.subsidiary,
                    CURRENT.orderConfig.customerNo,
                    vc2_constant.IS_DEBUG_MODE ? new Date().getTime() : null
                ].join('|')
            });

            if (vc2_util.isEmpty(accessToken)) accessToken = LibIngramAPI.generateToken();

            if (!vc2_util.isEmpty(accessToken)) {
                vc2_util.setNSCache({
                    key: CURRENT.TokenName,
                    cacheTTL: CURRENT.CacheTTL,
                    value: accessToken
                });

                CURRENT.accessToken = accessToken;
            }

            return accessToken;
        },
        extractValidOrders: function (orderResults) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractValidOrders'].join('::');

            if (!util.isArray(orderResults) || vc2_util.isEmpty(orderResults)) return false;
            var arrValidOrders = [];

            (orderResults || []).forEach(function (orderResult) {
                var orderData = {
                    VendorOrderNum: orderResult.ingramOrderNumber,
                    OrderDate: vc2_util.parseFormatDate(orderResult.ingramOrderDate),
                    OrderNum: orderResult.customerOrderNumber,
                    Status: orderResult.orderStatus,
                    Total: orderResult.orderTotal
                };

                try {
                    if (!orderResult.orderStatus) throw 'MISSING OrderStatus';

                    // if (vc2_util.inArray(orderResult.orderStatus, LibIngramAPI.SkippedStatus))
                    //     throw 'SKIPPED OrderStatus - ' + orderResult.orderStatus;

                    if (vc2_util.isEmpty(orderResult.subOrders)) throw 'MISSING subOrders';

                    orderResult.subOrders.forEach(function (subOrderData) {
                        var subOrderNumber = subOrderData.subOrderNumber;
                        // vc2_util.log(logTitle, '... added valid order: ', subOrderNumber);

                        arrValidOrders.push(
                            vc2_util.extend(vc2_util.clone(orderData), {
                                VendorOrderNum: subOrderNumber,
                                Total: subOrderData.subOrderTotal,
                                Status: subOrderData.subOrderStatus || orderData.Status
                            })
                        );

                        // IngramOrders.ORDERS[subOrderNumber] = { info: orderResult };
                        // IngramOrders.LIST.push(vc2_util.clone(orderData));
                    });
                } catch (error) {
                    vc2_util.log(logTitle, '*** SKIPPED ORDER: ', [
                        vc2_util.extractError(error),
                        orderResult
                    ]);
                    orderData.ERROR = vc2_util.extractError(error);
                }
            });

            return arrValidOrders;
        },

        extractShipmentDetails: function (shipmentDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractShipmentDetails'].join('::');

            if (vc2_util.isEmpty(shipmentDetails)) return false;

            var shipData = {
                quantity: 0,
                serialNos: [],
                trackingNos: []
            };

            for (var i = 0, j = shipmentDetails.length; i < j; i++) {
                var shipmentDetail = shipmentDetails[i];

                util.extend(shipData, {
                    quantity: shipData.quantity + parseFloat(shipmentDetail.quantity),
                    order_date: shipmentDetail.invoiceDate,
                    ship_date: shipmentDetail.shippedDate,

                    estdeliv_date: shipmentDetail.estimatedDeliveryDate,
                    order_eta_ship: shipmentDetail.estimatedDeliveryDate,
                    order_eta: shipmentDetail.estimatedShipDate
                });

                if (vc2_util.isEmpty(shipmentDetail.carrierDetails)) continue;

                var carrierDetails = shipmentDetail.carrierDetails;
                if (vc2_util.isEmpty(carrierDetails)) continue;
                if (!util.isArray(carrierDetails)) carrierDetails = [carrierDetails];

                var carrierCodes = [],
                    carrierNames = [];

                carrierDetails.forEach(function (carrierDetail) {
                    if (!vc2_util.inArray(carrierDetail.carrierCode, carrierCodes))
                        carrierCodes.push(carrierDetail.carrierCode);
                    if (!vc2_util.inArray(carrierDetail.carrierName, carrierNames))
                        carrierNames.push(carrierDetail.carrierName);

                    if (!vc2_util.isEmpty(carrierDetail.trackingDetails)) {
                        var serialNos = LibOrderStatus.extractSerialNos(
                                carrierDetail.trackingDetails
                            ),
                            trackingNos = LibOrderStatus.extractTrackingNos(
                                carrierDetail.trackingDetails
                            );

                        shipData.serialNos = shipData.serialNos.concat(serialNos);
                        shipData.trackingNos = shipData.trackingNos.concat(trackingNos);
                    }
                });

                shipData.carrier =
                    carrierNames.length > 1 ? carrierNames.join(',') : carrierNames[0];
            }

            shipData.serialNos = vc2_util.uniqueArray(shipData.serialNos);
            shipData.trackingNos = vc2_util.uniqueArray(shipData.trackingNos);

            // vc2_util.log(logTitle, '// shipment details: ', shipData);

            return shipData;
        },
        extractTrackingNos: function (trackingDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractTrackingNos'].join('::');

            // vc2_util.log(logTitle, '.... trackingDetails: ', trackingDetails);
            var trackingNos = [];

            for (var i = 0, j = trackingDetails.length; i < j; i++) {
                if (trackingDetails[i].trackingNumber) {
                    trackingNos = trackingNos.concat(
                        trackingDetails[i].trackingNumber.split(/[\W]+/g)
                    );
                }
            }

            // vc2_util.log(logTitle, '//// trackingNos: ', trackingNos);

            return trackingNos;
        },
        extractSerialNos: function (trackingDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractSerialNos'].join('::');

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
            // vc2_util.log(logTitle, '//// serialNos: ', serialNos);

            return serialNos;
        },
        extractEstimatedDates: function (estDateDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractEstimatedDates'].join('::');

            if (vc2_util.isEmpty(estDateDetails)) return;
            var estimatedDates = {};

            for (var i = 0, j = estDateDetails.length; i < j; i++) {
                var ship = estDateDetails[i].ship,
                    delivery = estDateDetails[i].delivery;

                if (ship)
                    util.extend(estimatedDates, {
                        shipDate: ship.shipDate,
                        shipDesc: ship.shipDescription,
                        shipSource: ship.shipSource
                    });

                if (delivery) util.extend(estimatedDates, { deliveryDate: delivery.deliveryDate });
            }

            // vc2_util.log(logTitle, '... estimated dates: ', estimatedDates);

            return estimatedDates;
        },
        extractLineData: function (ingramLine, orderDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractLineData'].join('::');

            // vc2_util.log(logTitle, '** Ingram Line: ', ingramLine);

            var lineData = {
                order_num: ingramLine.subOrderNumber || 'NA',
                order_date: orderDetails.ingramOrderDate || 'NA',
                order_status: orderDetails.orderStatus || 'NA',
                order_date: 'NA',

                line_num: ingramLine.customerLineNumber || ingramLine.ingramOrderLineNumber || 'NA',

                item_num: ingramLine.vendorPartNumber || 'NA',
                item_num_alt: ingramLine.ingramPartNumber || 'NA',
                vendorSKU: ingramLine.ingramPartNumber || 'NA',
                line_status: ingramLine.lineStatus || 'NA',
                ship_qty:
                    ingramLine.hasOwnProperty('quantityConfirmed') &&
                    !vc2_util.isEmpty(ingramLine.quantityConfirmed)
                        ? ingramLine.quantityConfirmed
                        : ingramLine.hasOwnProperty('quantityOrdered') &&
                          !vc2_util.isEmpty(ingramLine.quantityOrdered)
                        ? ingramLine.quantityOrdered
                        : 'NA',
                order_data: 'NA'
            };
            lineData.line_no = vc2_util.parseFloat(lineData.line_num);

            var shipment = LibOrderStatus.extractShipmentDetails(ingramLine.shipmentDetails);
            util.extend(lineData, {
                ship_date: shipment.ship_date || 'NA',
                order_date: shipment.order_date || 'NA',
                order_eta: ingramLine.promisedDeliveryDate || shipment.order_eta || 'NA',
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

            var estimatedDates = this.extractEstimatedDates(ingramLine.estimatedDates);
            if (!vc2_util.isEmpty(estimatedDates)) {
                util.extend(lineData, {
                    order_eta: estimatedDates.shipDate || lineData.order_eta,
                    eta_ship_desc: estimatedDates.shipDescription,
                    eta_ship_source: estimatedDates.shipSource,
                    eta_delivery_date: estimatedDates.deliveryDate
                });
            }

            /// GET ADDITIONAL INFO ///
            var addLineData = {};
            ['serviceContractInfo', 'additionalAttributes'].forEach(function (nodeData) {
                if (ingramLine[nodeData] && !vc2_util.isEmpty(ingramLine[nodeData])) {
                    addLineData[nodeData] = ingramLine[nodeData];
                }
                return true;
            });

            if (!vc2_util.isEmpty(addLineData)) {
                lineData.order_data = JSON.stringify(addLineData);
            }

            return lineData;
        }
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                LibOrderStatus.initialize(option);

                // get the validOrders
                var arrIngramOrders = this.processRequest(option);
                // if (vc2_util.isEmpty(arrIngramOrders) || vc2_util.isEmpty(arrIngramOrders.ORDERS))
                //     throw ERROR_MSG.ORDER_NOT_FOUND;

                if (option.debugMode) {
                    if (!option.showLines) return RESPONSE;
                }
                vc2_util.log(logTitle, '*** Total Orders: ', OUTPUT.OrdersList);

                var logPrefix = '';

                // run through the orders and extract the line data
                for (var orderNum in RESPONSE.OrderDetails) {
                    var orderDetails = RESPONSE.OrderDetails[orderNum];

                    logPrefix = '[' + orderNum + '] ';

                    vc2_util.log(logTitle, logPrefix + ' ... Order Details: ', orderDetails);

                    if (vc2_util.isEmpty(orderDetails)) continue;

                    var orderLines = [];
                    if (!vc2_util.isEmpty(orderDetails.lines)) {
                        for (var i = 0, j = orderDetails.lines.length; i < j; i++) {
                            var ingramLine = orderDetails.lines[i];

                            var lineData = LibOrderStatus.extractLineData(ingramLine, orderDetails);
                            vc2_util.log(logTitle, logPrefix + ' ..... ', lineData);

                            util.extend(lineData, {
                                // order_num: orderNum || 'NA',
                                is_shipped: vc2_util.inArray(
                                    lineData.order_status.toUpperCase(),
                                    LibIngramAPI.ValidShippedStatus
                                )
                            });

                            orderLines.push(lineData);
                            OUTPUT.Items.push(lineData);
                        }
                    }

                    if (orderLines.length) {
                        util.extend(RESPONSE.OrderDetails[orderNum], { lines: orderLines });
                    }
                }

                // run through itemArray and check for DATE_FIELDS
                // vc2_util.dumpLog(logTitle, OUTPUT.Items, '-- Items : ');
                vc2_util.log(logTitle, '... Items: ', [OUTPUT.Items.length, OUTPUT.Items]);

                OUTPUT.Items.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;
                        itemObj[dateField] = vc2_util.parseFormatDate(itemObj[dateField]);
                    });
                });

                util.extend(returnValue, {
                    Orders: OUTPUT.OrdersList,
                    Lines: OUTPUT.Items,
                    Source: RESPONSE
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, '// Return', returnValue);
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};
            try {
                LibOrderStatus.initialize(option);

                LibOrderStatus.getTokenCache(option);
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                // get the validOrders
                var orderSearchResults = LibIngramAPI.orderSearch();
                RESPONSE.OrderSearch = orderSearchResults;

                // get the valid orders
                var arrValidOrders = LibOrderStatus.extractValidOrders(orderSearchResults);
                // vc2_util.log(logTitle, '... Valid Orders: ', arrValidOrders);

                OUTPUT.OrdersList = arrValidOrders;
                OUTPUT.Items = [];
                var errorV61 = '';

                if (CURRENT.isV61) {
                    // only one call needed for order details
                    arrValidOrders.forEach(function (orderResult) {
                        if (CURRENT.hasV61Errors) return;

                        var orderDetails = LibIngramAPI.orderDetails({
                            orderNum: orderResult.VendorOrderNum
                        });

                        if (
                            // check for orderDetails
                            (function () {
                                if (vc2_util.isEmpty(orderDetails)) {
                                    errorV61 = 'Missing order details';
                                    return true;
                                }
                                return false;
                            })() ||
                            // check for existence of lines
                            (function () {
                                if (vc2_util.isEmpty(orderDetails.lines)) {
                                    errorV61 = 'Missing order detail lines';
                                    return true;
                                }
                                return false;
                            })() ||
                            // check for subOrderNumber
                            (function () {
                                if (vc2_util.isEmpty(orderDetails.lines[0].subOrderNumber)) {
                                    errorV61 = 'Missing subOrderNumber';
                                    return true;
                                }
                                return false;
                            })()
                        ) {
                            CURRENT.hasV61Errors = true;
                            return;
                        }

                        RESPONSE.OrderDetails[orderResult.VendorOrderNum] = orderDetails;
                    });

                    // orderSearchResults.forEach(function (orderResult) {
                    //     // check if there were errors in the orderSearch
                    //     if (CURRENT.hasV61Errors) return;

                    //     var orderDetails = LibIngramAPI.orderDetails({
                    //         orderNum: orderResult.ingramOrderNumber
                    //     });
                    //     if (
                    //         // check for orderDetails
                    //         (function () {
                    //             if (vc2_util.isEmpty(orderDetails)) {
                    //                 errorV61 = 'Missing order details';
                    //                 return true;
                    //             }
                    //             return false;
                    //         })() ||
                    //         // check for existence of lines
                    //         (function () {
                    //             if (vc2_util.isEmpty(orderDetails.lines)) {
                    //                 errorV61 = 'Missing order detail lines';
                    //                 return true;
                    //             }
                    //             return false;
                    //         })() ||
                    //         // check for subOrderNumber
                    //         (function () {
                    //             if (vc2_util.isEmpty(orderDetails.lines[0].subOrderNumber)) {
                    //                 errorV61 = 'Missing subOrderNumber';
                    //                 return true;
                    //             }
                    //             return false;
                    //         })()
                    //     ) {
                    //         CURRENT.hasV61Errors = true;
                    //         return;
                    //     }

                    //     RESPONSE.OrderDetails[orderResult.ingramOrderNumber] = orderDetails;
                    // });
                }

                if (CURRENT.isV61 && CURRENT.hasV61Errors) {
                    if (CURRENT.hasV61Errors && errorV61)
                        vc2_util.log(logTitle, '***** [V6.1] Error: ', errorV61);

                    // loop thru the validOrdersList
                    arrValidOrders.forEach(function (orderResult) {
                        // vc2_util.log(logTitle, '... validOrder: ', orderResult);

                        var orderDetails = LibIngramAPI.orderDetails({
                            orderNum: orderResult.VendorOrderNum,
                            endpointUrl: LibIngramAPI.EndPointV6
                        });
                        if (vc2_util.isEmpty(orderDetails)) return;
                        RESPONSE.OrderDetails[orderResult.VendorOrderNum] = orderDetails;
                    });
                }

                returnValue = OUTPUT;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
