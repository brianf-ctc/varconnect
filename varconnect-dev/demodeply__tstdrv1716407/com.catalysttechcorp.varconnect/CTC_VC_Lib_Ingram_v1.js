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
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (NS_Search, VC_Global, VC_Log, VC_Util, moment) {
    'use strict';
    var LogTitle = 'WS:IngramAPI',
        LogPrefix;

    var CURRENT = {};
    var LibIngramAPI = {
        ValidOrderStatus: ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'],
        ValidLineStatus: ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'],
        ValidShippedStatus: ['SHIPPED'],
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = VC_Util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.vendorConfig.accessEndPoint,
                        body: VC_Util.convertToQuery({
                            client_id: CURRENT.vendorConfig.apiKey,
                            client_secret: CURRENT.vendorConfig.apiSecret,
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });

                if (tokenReq.isError) throw tokenReq.errorMsg;
                var tokenResp = VC_Util.safeParse(tokenReq.RESPONSE);
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                returnValue = false;
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> Access Token: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getValidOrders: function (option) {
            var logTitle = [LogTitle, 'getValidOrders'].join('::'),
                returnValue;
            try {
                var reqValidOrders = VC_Util.sendRequest({
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

                if (reqValidOrders.isError) throw reqValidOrders.errorMsg;
                var respIngramOrders = VC_Util.safeParse(reqValidOrders.RESPONSE);
                if (!respIngramOrders) throw 'Unable to fetch server response';

                var arrOrderDetails = [];
                if (!respIngramOrders.orders) throw 'Orders are not found';

                for (var i = 0, j = respIngramOrders.orders.length; i < j; i++) {
                    var ingramOrder = respIngramOrders.orders[i];

                    if (!ingramOrder.orderStatus) continue;
                    if (VC_Util.inArray(ingramOrder.orderStatus, ['CANCELLED'])) continue;

                    arrOrderDetails.push(ingramOrder);
                }

                returnValue = arrOrderDetails;
            } catch (error) {
                var errorMsg = VC_Util.extractError(error);
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);

                VC_Util.vcLog({
                    title: LogTitle + ' Orders Search : Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw errorMsg;
                returnValue = false;
            } finally {
                log.audit(logTitle, LogPrefix + '>> valid orders: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
                returnValue;

            try {
                var ingramOrder = option.ingramOrder;
                if (!ingramOrder) throw 'Ingram Order is required';

                var reqOrderDetails = VC_Util.sendRequest({
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

                if (reqOrderDetails.isError) throw reqOrderDetails.errorMsg;
                var respOrderDetail = VC_Util.safeParse(reqOrderDetails.RESPONSE);
                if (!respOrderDetail) throw 'Unable to fetch server response';

                returnValue = respOrderDetail;
            } catch (error) {
                var errorMsg = VC_Util.extractError(error);
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
                VC_Util.vcLog({
                    title: LogTitle + ' Order Details:  Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                returnValue = false;
            } finally {
                log.audit(logTitle, LogPrefix + '>> order details: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getItemAvailability: function (option) {
            var logTitle = [LogTitle, 'getItemAvailability'].join('::'),
                returnValue;

            try {
                var respOrderDetail = option.orderDetails;
                if (VC_Util.isEmpty(respOrderDetail)) throw 'Missing order details';

                var arrLineItems = [];

                for (var i = 0, j = respOrderDetail.lines.length; i < j; i++) {
                    var orderLine = respOrderDetail.lines[i];

                    var lineData = null;
                    for (var ii = 0, jj = arrLineItems.length; ii < jj; ii++) {
                        if (arrLineItems[ii].ingramPartNumber == orderLine.ingramPartNumber) {
                            lineData = arrLineItems[ii];
                            break;
                        }
                    }

                    if (!lineData) {
                        arrLineItems.push({
                            ingramPartNumber: orderLine.ingramPartNumber,
                            customerPartNumber: orderLine.ingramPartNumber,
                            vendorPartNumber: orderLine.vendorPartNumber,
                            upc: orderLine.upcCode,
                            quantityRequested: orderLine.quantityOrdered
                        });
                    } else {
                        lineData.quantityRequested += parseInt(orderLine.quantityOrdered);
                    }
                }

                log.audit(logTitle, LogPrefix + '>> arrLineItems: ' + JSON.stringify(arrLineItems));

                var reqItemAvail = VC_Util.sendRequest({
                    header: [LogTitle, 'Item Availability'].join(' : '),
                    method: 'post',
                    query: {
                        url:
                            CURRENT.vendorConfig.endPoint.replace(
                                /orders\/$/gi,
                                'catalog/priceandavailability?'
                            ) +
                            'includeAvailability=true&includePricing=true&includeProductAttributes=true',
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.vendorConfig.customerNo,
                            'IM-CountryCode': CURRENT.vendorConfig.country,
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        },
                        body: JSON.stringify({
                            showAvailableDiscounts: true,
                            showReserveInventoryDetails: true,
                            specialBidNumber: '',
                            products: arrLineItems
                        })
                    },
                    recordId: CURRENT.recordId
                });
                if (reqItemAvail.isError) throw reqItemAvail.errorMsg;
                var respItemAvail = VC_Util.safeParse(reqItemAvail.RESPONSE);
                if (!respItemAvail) throw 'Unable to retrieve the item availability';

                returnValue = respItemAvail;
            } catch (error) {
                var errorMsg = VC_Util.extractError(error);
                VC_Util.vcLog({
                    title: LogTitle + ' Item Availability:  Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
                returnValue = [];
            } finally {
                log.audit(
                    logTitle,
                    LogPrefix + '>> item availability: ' + JSON.stringify(returnValue)
                );
            }
            return returnValue;
        },
        extractItemAvailability: function (option) {
            var logTitle = [LogTitle, 'extractItemAvailability'].join('::');

            var lineDetail = option.lineDetail,
                respItemAvail = option.itemAvailability,
                itemLocations = null;

            // look for the item availability
            for (var i = 0, j = respItemAvail.length; i < j; i++) {
                var itemAvail = respItemAvail[i];

                if (
                    itemAvail.ingramPartNumber != lineDetail.ingramPartNumber ||
                    itemAvail.upc != lineDetail.upcCode ||
                    itemAvail.vendorPartNumber != lineDetail.vendorPartNumber
                )
                    continue;

                if (itemAvail.availability && itemAvail.availability.availabilityByWarehouse) {
                    itemLocations = itemAvail.availability.availabilityByWarehouse;
                    break;
                }
            }
            if (!itemLocations) return;

            var arrDateBackOrderd = [];
            for (var ii = 0, jj = itemLocations.length; ii < jj; ii++) {
                var location = itemLocations[ii];
                var dateBackOrderd = location.quantityBackorderedEta;
                if (!dateBackOrderd) continue;

                arrDateBackOrderd.push({
                    dateStr: dateBackOrderd,
                    dateObj: moment(dateBackOrderd).toDate()
                });
            }

            log.audit(
                logTitle,
                LogPrefix + '>> arrDateBackOrderd: ' + JSON.stringify(arrDateBackOrderd)
            );

            if (VC_Util.isEmpty(arrDateBackOrderd)) return;

            var nearestDate = arrDateBackOrderd.sort(function (a, b) {
                return a.dateObj - b.dateObj;
            });
            log.audit(logTitle, LogPrefix + '>> nearestDate: ' + JSON.stringify(nearestDate));

            return nearestDate.shift();
        },
        extractOrderShipmentDetails: function (option) {
            var logTitle = [LogTitle, 'extractOrderShipmentDetails'].join('::');

            var shipmentDetails = option.shipmentDetails;
            if (VC_Util.isEmpty(shipmentDetails)) return false;

            var shipData = {
                quantity: 0,
                serials: [],
                trackingNumbers: []
            };

            for (var i = 0, j = shipmentDetails.length; i < j; i++) {
                var shipment = shipmentDetails[i];
                shipData.detail = shipment;
                shipData.quantity += parseFloat(shipment.quantity);
                shipData.order_date = shipment.invoiceDate;
                shipData.ship_date = shipment.shippedDate;
                shipData.order_eta = shipment.estimatedDeliveryDate || '';
                shipData.order_eta_ship = shipment.estimatedDeliveryDate;

                if (shipment.carrierDetails) {
                    shipData.carrier = shipment.carrierDetails.carrierName;

                    if (shipment.carrierDetails.trackingDetails) {
                        var trackingDetails = shipment.carrierDetails.trackingDetails;
                        for (var ii = 0, jj = trackingDetails.length; ii < jj; ii++) {
                            if (trackingDetails[ii].trackingNumber) {
                                // var trackingNumber = trackingDetails[ii].trackingNumber.split(/\s/gi);

                                shipData.trackingNumbers = shipData.trackingNumbers.concat(
                                    trackingDetails[ii].trackingNumber.split(/[\W\D]+/g)
                                );

                                // shipData.trackingNumbers.push(trackingDetails[ii].trackingNumber);
                            }

                            if (trackingDetails[ii].SerialNumbers) {
                                var serialNumbers = trackingDetails[ii].SerialNumbers;

                                for (var iii = 0, jjj = serialNumbers.length; iii < jjj; iii++) {
                                    if (serialNumbers[iii].serialNumber)
                                        shipData.serials.push(serialNumbers[iii].serialNumber);
                                }
                            }
                        }
                    }
                }
            }

            shipData.serials = VC_Util.uniqueArray(shipData.serials);
            shipData.trackingNumbers = VC_Util.uniqueArray(shipData.trackingNumbers);

            log.audit(logTitle, LogPrefix + '>> Ship Data: ' + JSON.stringify(shipData));
            return shipData;
        },
        buildOutputArray: function (option) {
            var logTitle = [LogTitle, 'buildOutputArray'].join('::'),
                returnValue;
            try {
                var respOrderDetails = option.orderDetails,
                    respItemAvail = option.itemAvailability;

                var arrLineData = [];

                for (var i = 0, j = respOrderDetails.lines.length; i < j; i++) {
                    var lineDetail = respOrderDetails.lines[i];

                    var lineData = {
                        detail: lineDetail,
                        availabilityDate: LibIngramAPI.extractItemAvailability({
                            lineDetail: lineDetail,
                            itemAvailability: respItemAvail
                        }),
                        status: (lineDetail.lineStatus || '').toUpperCase()
                    };

                    if (!VC_Util.inArray(lineData.status, LibIngramAPI.ValidLineStatus)) {
                        log.audit(
                            logTitle,
                            '.... skipping line, invalid status :  [' + lineData.status + ']'
                        );
                        continue;
                    }

                    if (lineDetail.shipmentDetails) {
                        lineData.shipmentDetails = LibIngramAPI.extractOrderShipmentDetails({
                            shipmentDetails: lineDetail.shipmentDetails
                        });
                    }

                    arrLineData.push(lineData);
                }

                returnValue = arrLineData;
            } catch (error) {
                log.audit(
                    logTitle,
                    LogPrefix +
                        ('## ERROR ## ' + VC_Util.extractError(error)) +
                        ('\n' + JSON.stringify(error))
                );
                returnValue = false;
            } finally {
                log.audit(logTitle, LogPrefix + '>> output array: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getNSRecord: function (option) {
            var logTitle = [LogTitle, 'getNSRecord'].join('::'),
                returnValue;

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
            // log.audit(logTitle, LogPrefix + '>> searchOPtion: ' + JSON.stringify(searchOption));

            var nsItemFF;
            NS_Search.create(searchOption)
                .run()
                .each(function (row) {
                    nsItemFF = row.id;
                    return true;
                });

            returnValue = nsItemFF;
            log.audit(logTitle, LogPrefix + '>> nsItemFF: ' + JSON.stringify(nsItemFF));

            return returnValue;
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

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                // generate the
                LibIngramAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                // get all the valid orders
                var arrValidOrders = LibIngramAPI.getValidOrders();
                var arrResponse = [];

                for (var i = 0, j = arrValidOrders.length; i < j; i++) {
                    var validOrder = arrValidOrders[i];
                    LogPrefix =
                        '' +
                        ('[purchaseorder:' + CURRENT.recordId + '][') +
                        (validOrder.ingramOrderNumber + '] ');

                    log.audit(
                        logTitle,
                        LogPrefix + '>> Ingram Order: ' + JSON.stringify(validOrder)
                    );

                    var respOrderDetails = LibIngramAPI.getOrderDetails({
                        ingramOrder: validOrder
                    });

                    var respItemAvail = LibIngramAPI.getItemAvailability({
                        orderDetails: respOrderDetails
                    });

                    arrResponse.push({
                        orderInfo: validOrder,
                        orderDetails: respOrderDetails,
                        itemAvailability: respItemAvail
                    });
                }
                returnValue = arrResponse;
            } catch (error) {
                var errorMsg = VC_Util.extractError(error);
                VC_Util.vcLog({
                    title: LogTitle + ': Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw errorMsg;
            }

            return returnValue;
        },

        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum;
                CURRENT.vendorConfig = option.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                log.audit(logTitle, LogPrefix + '>> CURRENT: ' + JSON.stringify(CURRENT));

                var arrOrderResponse = this.processRequest(option),
                    arrLineOutput = [],
                    allSerials = {};

                for (var i = 0, j = arrOrderResponse.length; i < j; i++) {
                    var orderResponse = arrOrderResponse[i];

                    var validOrder = orderResponse.orderInfo;
                    LogPrefix =
                        '' +
                        ('[purchaseorder:' + CURRENT.recordId + '][') +
                        (validOrder.ingramOrderNumber + '] ');

                    var ingramOrderDate = validOrder.ingramOrderDate;
                    var defaultETA = {
                        date: moment(ingramOrderDate).add(1, 'day').toDate(),
                        text: moment(ingramOrderDate).add(1, 'day').format('YYYY-MM-DD')
                    };
                    log.audit(logTitle, 'defaultETA : ' + JSON.stringify(defaultETA));

                    var arrLines = LibIngramAPI.buildOutputArray(orderResponse);

                    for (var ii = 0, jj = arrLines.length; ii < jj; ii++) {
                        var itemDetail = arrLines[ii].detail,
                            shipment = arrLines[ii].shipmentDetails,
                            lineStatus = arrLines[ii].status;

                        var outputLineData = {
                            line_num: itemDetail.customerLineNumber,
                            item_num: itemDetail.vendorPartNumber,
                            item_num_alt: itemDetail.ingramPartNumber,
                            is_shipped: VC_Util.inArray(
                                lineStatus,
                                LibIngramAPI.ValidShippedStatus
                            ),
                            line_status: lineStatus,
                            ship_qty: shipment.quantity,
                            order_num: itemDetail.subOrderNumber,
                            order_date: shipment.detail.invoiceDate,
                            ship_date: shipment.detail.shippedDate,
                            order_eta: shipment.detail.estimatedDeliveryDate || defaultETA.text,
                            order_eta_ship: shipment.detail.estimatedDeliveryDate,
                            carrier: shipment.carrier
                            // tracking_num: shipment.trackingNumbers.length
                            //     ? shipment.trackingNumbers.join(',')
                            //     : 'NA',
                            // serial_num: shipment.serials.length ? shipment.serials.join(',') : 'NA'
                        };

                        //// SERIALS / TRACKING //////////////////////
                        if (!allSerials[outputLineData.item_num])
                            allSerials[outputLineData.item_num] = [];

                        if (!VC_Util.isEmpty(shipment.serials)) {
                            // add the shipment serials
                            allSerials[outputLineData.item_num] = VC_Util.uniqueArray(
                                allSerials[outputLineData.item_num].concat(shipment.serials)
                            );

                            outputLineData.serial_num = allSerials[outputLineData.item_num]
                                .splice(0, outputLineData.ship_qty)
                                .join(',');
                        } else {
                            outputLineData.serial_num = 'NA';
                        }

                        if (!VC_Util.isEmpty(shipment.trackingNumbers)) {
                            outputLineData.tracking_num = shipment.trackingNumbers.join(',');
                        } else {
                            outputLineData.tracking_num = 'NA';
                        }
                        /////////////////////////////////////////////

                        // check if fulfillment is
                        var nsItemFF = LibIngramAPI.getNSRecord({
                            ingramOrderNumber: outputLineData.order_num
                        });

                        if (nsItemFF) {
                            outputLineData.ns_record = nsItemFF;
                        }

                        log.audit(
                            logTitle,
                            LogPrefix + '>> Line Data: ' + JSON.stringify(outputLineData)
                        );

                        arrLineOutput.push(outputLineData);
                    }
                }

                returnValue = arrLineOutput;
            } catch (error) {
                var errorMsg = VC_Util.extractError(error);
                VC_Util.vcLog({
                    title: LogTitle + ': Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw errorMsg;
            } finally {
                log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));

                VC_Util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !VC_Util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: VC_Global.Lists.VC_LOG_STATUS.INFO
                });
            }

            return returnValue;
        }
    };
});
