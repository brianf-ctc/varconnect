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
    };

    var IngramOrders = {
        EndPoint: {},
        LIST: [],
        ORDERS: {},
        RESULT: {}
    };

    var DateFields = [
        'ship_date',
        'order_date',
        'estdeliv_date',
        'order_eta_ship',
        'order_eta',
        'eta_delivery_date'
    ];

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
                    // doRetry: true,
                    // maxRetry: 3,
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
                var errorMsg = vc2_util.extractError(error);
                throw ['Generate Token', this.evaluateErrors(errorMsg)].join('| ');
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
                            'IM-CountryCode': CURRENT.orderConfig.country,
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    },
                    recordId: CURRENT.recordId
                });

                vc2_util.handleJSONResponse(respOrderSearch);
                if (!respOrderSearch.PARSED_RESPONSE) throw 'Unable to fetch server response';

                var parsedOrders = respOrderSearch.PARSED_RESPONSE.orders;
                if (vc2_util.isEmpty(parsedOrders)) throw 'Order not found';

                returnValue = parsedOrders;
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                throw ['Order Search', this.evaluateErrors(errorMsg)].join('| ');
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
                if (respOrderDetails.isError) throw respOrderDetails.errorMsg;
                vc2_util.handleJSONResponse(respOrderDetails);
                if (!respOrderDetails.PARSED_RESPONSE) throw 'Unable to fetch server response';

                returnValue = respOrderDetails.PARSED_RESPONSE;
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                throw ['Order Details', this.evaluateErrors(errorMsg)].join('| ');
            }

            return returnValue;
        },

        evaluateErrors: function (errorMsg) {
            if (errorMsg.match(/^Invalid client identifier/gi)) {
                return 'Invalid credentials';
            } else return errorMsg;
        }

        // evalErrors: function (errorMsg) {
        //     var ErrorTypes = {
        //         INVALID_CREDENTIALS: {
        //             trigger: [
        //                 function (errormsg) {
        //                     return errormsg.match(/^Invalid client identifier/gi);
        //                 }
        //             ],
        //             message: 'Invalid credentials'
        //         }
        //     };

        //     for (var errorCode in ErrorTypes) {
        //         var errType = ErrorTypes[errorCode];

        //         if (errType && errType.trigger) {
        //             var hasMatch = false;
        //             errType.trigger.forEach(function (errTrigger) {
        //                 if (!hasMatch && typeof errTrigger == 'function') {
        //                     hasMatch = errTrigger.call(this, errorMsg);
        //                 }
        //                 return true;
        //             });
        //             if (hasMatch) return errType.message;
        //         }
        //     }
        // }
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
                LibIngramAPI.EndPointV61 = endPoint;
                LibIngramAPI.EndPointV6 = endPoint.replace('/v6.1/', '/v6/');
            } else {
                LibIngramAPI.EndPointV6 = endPoint;
                LibIngramAPI.EndPointV61 = endPoint.replace('/v6/', '/v6.1/');
            }

            vc2_util.LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';

            return returnValue;
        },
        getTokenCache: function () {
            var accessToken = vc2_util.getNSCache({
                key: [
                    CURRENT.TokenName,
                    CURRENT.orderConfig.apiKey,
                    CURRENT.orderConfig.apiSecret
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

            //loop through ingramOrders
            for (var i = 0; i < orderResults.length; i++) {
                var orderResult = orderResults[i],
                    orderData = {
                        OrderNum: orderResult.ingramOrderNumber,
                        OrderDate: orderResult.ingramOrderDate,
                        customerOrderNum: orderResult.customerOrderNumber,
                        Status: orderResult.orderStatus,
                        Total: orderResult.orderTotal
                    };
                try {
                    if (!orderResult.orderStatus) throw 'MISSING OrderStatus';

                    if (vc2_util.inArray(orderResult.orderStatus, LibIngramAPI.SkippedStatus))
                        throw 'SKIPPED OrderStatus - ' + orderResult.orderStatus;

                    if (vc2_util.isEmpty(orderResult.subOrders)) throw 'MISSING subOrders';

                    orderResult.subOrders.forEach(function (subOrderData) {
                        var subOrderNumber = subOrderData.subOrderNumber;
                        vc2_util.log(logTitle, '... added valid order: ', subOrderNumber);
                        IngramOrders.ORDERS[subOrderNumber] = { info: orderResult };
                    });

                    arrValidOrders.push(orderResult);
                } catch (e) {
                    vc2_util.log(logTitle, '*** SKIPPED ORDER: ', [
                        vc2_util.extractError(e),
                        orderResult
                    ]);
                    orderData.ERROR = vc2_util.extractError(e);
                    continue;
                } finally {
                    IngramOrders.LIST.push(orderData);
                }
            }

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
                    order_eta_ship: shipmentDetail.estimatedDeliveryDate
                });

                if (vc2_util.isEmpty(shipmentDetail.carrierDetails)) continue;

                shipData.carrier = shipmentDetail.carrierDetails.carrierName;

                if (vc2_util.isEmpty(shipmentDetail.carrierDetails.trackingDetails)) continue;
                var trackingDetails = shipmentDetail.carrierDetails.trackingDetails;

                var serialNos = this.extractSerialNos(trackingDetails),
                    trackingNos = this.extractTrackingNos(trackingDetails);
                shipData.serialNos = shipData.serialNos.concat(serialNos);
                shipData.trackingNos = shipData.trackingNos.concat(trackingNos);
            }

            shipData.serialNos = vc2_util.uniqueArray(shipData.serialNos);
            shipData.trackingNos = vc2_util.uniqueArray(shipData.trackingNos);

            vc2_util.log(logTitle, '// shipment details: ', shipData);

            return shipData;
        },
        extractTrackingNos: function (trackingDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractTrackingNos'].join('::');

            vc2_util.log(logTitle, '.... trackingDetails: ', trackingDetails);
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
            var logTitle = [LogTitle, 'LibOrderStatus::extractSerialNos'].join('::');

            vc2_util.log(logTitle, '.... trackingDetails: ', trackingDetails);
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

            vc2_util.log(logTitle, '... estimated dates: ', estimatedDates);

            return estimatedDates;
        },
        extractLineData: function (ingramLine, orderDetails) {
            var logTitle = [LogTitle, 'LibOrderStatus::extractLineData'].join('::');

            vc2_util.log(logTitle, '** Ingram Line: ', ingramLine);

            var lineData = {
                line_num: ingramLine.customerLineNumber || ingramLine.ingramOrderLineNumber || 'NA',
                item_num: ingramLine.vendorPartNumber || 'NA',
                item_num_alt: ingramLine.ingramPartNumber || 'NA',
                vendorSKU: ingramLine.ingramPartNumber || 'NA',
                // order_num: ingramSubOrderNum || 'NA',
                line_status: ingramLine.lineStatus || 'NA',
                order_date: orderDetails.ingramOrderDate || 'NA',
                order_status: orderDetails.orderStatus || 'NA',
                ship_qty:
                    ingramLine.hasOwnProperty('quantityConfirmed') &&
                    !vc2_util.isEmpty(ingramLine.quantityConfirmed)
                        ? ingramLine.quantityConfirmed
                        : ingramLine.hasOwnProperty('quantityOrdered') &&
                          !vc2_util.isEmpty(ingramLine.quantityOrdered)
                        ? ingramLine.quantityOrdered
                        : 'NA'
            };
            lineData.line_no = vc2_util.parseFloat(lineData.line_num);
            vc2_util.log(logTitle, '** Ingram Line(2) : ', lineData);

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
            ['serviceContractInfo'].forEach(function (nodeData) {
                if (ingramLine[nodeData] && !vc2_util.isEmpty(ingramLine[nodeData])) {
                    addLineData[nodeData] = ingramLine[nodeData];
                }
                return true;
            });

            if (!vc2_util.isEmpty(addLineData)) {
                lineData.vendorData = JSON.stringify(addLineData);
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
                if (vc2_util.isEmpty(arrIngramOrders) || vc2_util.isEmpty(arrIngramOrders.ORDERS))
                    throw 'Order not found';

                vc2_util.log(logTitle, '*** Total Orders: ', arrIngramOrders.LIST);

                var orderLines = [];

                // process the orders
                for (var orderNum in arrIngramOrders.ORDERS) {
                    vc2_util.log(logTitle, '** ORDER NUM[' + orderNum + ']');

                    var orderInfo = arrIngramOrders.ORDERS[orderNum].info,
                        orderDetails = arrIngramOrders.ORDERS[orderNum].details;

                    for (var i = 0, j = orderDetails.lines.length; i < j; i++) {
                        var ingramLine = orderDetails.lines[i];

                        var lineData = LibOrderStatus.extractLineData(ingramLine, orderDetails);

                        vc2_util.log(logTitle, '..... ', lineData);

                        util.extend(lineData, {
                            order_num: orderNum || 'NA',
                            is_shipped: vc2_util.inArray(
                                lineData.order_status.toUpperCase(),
                                LibIngramAPI.ValidShippedStatus
                            )
                        });

                        //set the ddate fields to YYYY-MM-DD
                        DateFields.forEach(function (dateField) {
                            lineData[dateField] = vc2_util.parseFormatDate(
                                lineData[dateField],
                                'YYYY-MM-DD'
                            );
                        });

                        orderLines.push(lineData);
                    }
                }

                util.extend(returnValue, {
                    Orders: IngramOrders.LIST,
                    Lines: orderLines
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                util.extend(returnValue, {
                    HasError: true,
                    ErrorMsg: vc2_util.extractError(error)
                });
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
                vc2_util.log(logTitle, '// order results:  ', orderSearchResults);

                if (vc2_util.isEmpty(orderSearchResults)) throw 'Order not found';

                vc2_util.log(logTitle, '## Total Orders: ', orderSearchResults.length);

                IngramOrders.RESULT = orderSearchResults;

                // Extract valid orders
                LibOrderStatus.extractValidOrders(orderSearchResults);

                // get all the order details
                for (var orderNum in IngramOrders.ORDERS) {
                    var logPrefix = '[' + orderNum + '] ';
                    var orderDetails = LibIngramAPI.orderDetails({ orderNum: orderNum });
                    // // extract line data
                    IngramOrders.ORDERS[orderNum].details = orderDetails;
                }

                return IngramOrders;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
