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
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (vcLog, VC_Global, VC2_Utils, moment) {
    'use strict';
    var LogTitle = 'WS:IngramV1';

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} option
     * @returns string
     **/
    function generateToken(option) {
        var logTitle = [LogTitle, 'generateToken'].join('::');
        log.audit(logTitle, option);

        var tokenReq = VC2_Utils.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' '),
            method: 'post',
            recordId: option.recordId,
            doRetry: true,
            maxRetry: 3,
            query: {
                url: option.vendorConfig.accessEndPoint,
                body: VC2_Utils.convertToQuery({
                    client_id: option.vendorConfig.apiKey,
                    client_secret: option.vendorConfig.apiSecret,
                    grant_type: 'client_credentials'
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        });

        if (tokenReq.isError) throw tokenReq.errorMsg;
        var tokenResp = VC2_Utils.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        return tokenResp.access_token;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} option
     * @returns object
     **/
    function processRequest(option) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, option);

        var returnVaue;

        try {
            var token = generateToken({
                vendorConfig: option.vendorConfig,
                recordId: option.poId
            });
            if (!token) throw 'Missing token for authentication.';

            var orderStatusReq = VC2_Utils.sendRequest({
                header: [LogTitle, 'Order Status'].join(' : '),
                method: 'get',
                query: {
                    url:
                        option.vendorConfig.endPoint +
                        '/search?customerOrderNumber=' +
                        option.poNum,
                    headers: {
                        Authorization: 'Bearer ' + token,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'IM-CustomerNumber': option.vendorConfig.customerNo,
                        'IM-CountryCode': option.vendorConfig.country,
                        'IM-CustomerOrderNumber': option.poNum,
                        'IM-CorrelationID': [option.poNum, option.poId].join('-')
                    }
                },
                recordId: option.poId
            });

            if (orderStatusReq.isError) throw orderStatusReq.errorMsg;
            var orderStatusResp = VC2_Utils.safeParse(orderStatusReq.RESPONSE);

            if (!orderStatusResp) throw 'Unable to fetch server response';

            // get the Order Details
            var orderDetails = _getOrderDetail({
                responseBody: orderStatusResp,
                token: token,
                vendorConfig: option.vendorConfig,
                poId: option.poId
            });

            if (!orderDetails) throw 'Unable to fetch order details';

            returnVaue = orderDetails;

            // get the itemavailability ///
            _getItemAvailability({
                responseBody: orderDetails,
                token: token,
                vendorConfig: option.vendorConfig,
                poId: option.poId || option.poNum,
                poNum: option.poNum
            });
        } catch (error) {
            var errorMsg = VC2_Utils.extractError(error);
            vcLog.recordLog({
                header: [LogTitle + ': Error', errorMsg].join(' - '),
                body: JSON.stringify(error),
                transaction: option.poId,
                status: VC_Global.Lists.VC_LOG_STATUS.ERROR,
                isDebugMode: option.fromDebug
            });
            if (!returnVaue) returnVaue = errorMsg;
        }
        return returnVaue;
    }

    function _getOrderDetail(option) {
        var logTitle = [LogTitle, '_getOrderDetail'].join('::');
        log.audit(logTitle, option);

        var response = option.responseBody,
            vendorConfig = option.vendorConfig,
            token = option.token,
            poId = option.poId,
            returnValue;

        var orders = response.orders;
        log.audit(logTitle, '>> orders = ' + JSON.stringify(orders));

        var validOrder;
        if (orders && orders.length) {
            if (orders.length == 1) validOrder = orders[0];
            else {
                for (var i = 0, j = orders.length; i < j; i++) {
                    if (orders[i].orderStatus != 'CANCELLED') {
                        validOrder = orders[i];
                        break;
                    }
                }
            }
        }
        log.audit(logTitle, '>> validOrder' + JSON.stringify(validOrder));
        if (!validOrder) validOrder = orders[0];

        if (validOrder || orders.length) {
            var ingramOrderNumber = validOrder.ingramOrderNumber;
            log.audit(logTitle, '>> ingramOrderNumber: ' + JSON.stringify(ingramOrderNumber));

            var orderDetailReq = VC2_Utils.sendRequest({
                header: [LogTitle, 'OrderDetails'].join(' '),
                method: 'get',
                doRetry: false,
                recordId: poId,
                query: {
                    url: vendorConfig.endPoint + '/' + ingramOrderNumber,
                    headers: {
                        Authorization: 'Bearer ' + token,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'IM-CustomerNumber': vendorConfig.customerNo,
                        'IM-CountryCode': vendorConfig.country,
                        'IM-CorrelationID': [option.poNum, option.poId].join('-')
                    }
                }
            });

            if (orderDetailReq.isError) throw orderDetailReq.errorMsg;
            var orderDetailRespBody = VC2_Utils.safeParse(orderDetailReq.RESPONSE);
            if (!orderDetailRespBody) throw 'Unable to fetch server response';

            returnValue = orderDetailRespBody;
        }

        return returnValue;
    }

    function _getItemAvailability(option) {
        var logTitle = [LogTitle, '_getItemAvailability'].join('::');
        log.audit(logTitle, option);

        var responseBody = option.responseBody,
            vendorConfig = option.vendorConfig,
            token = option.token,
            poId = option.poId,
            poNum = option.poNum;

        var orderLines = responseBody.lines;
        log.audit(logTitle, 'orderLines : ' + JSON.stringify(orderLines));

        if (!orderLines || !orderLines.length) return;

        /// update the default ETA ///
        var ingramOrderDate = responseBody.ingramOrderDate;
        var defaultETA = {
            date: moment(ingramOrderDate).add(1, 'day').toDate(),
            text: moment(ingramOrderDate).add(1, 'day').format('YYYY-MM-DD')
        };
        log.audit(logTitle, 'defaultETA : ' + JSON.stringify(defaultETA));

        var arrItems = [],
            shipLocation = {},
            i,
            ii,
            j,
            jj,
            orderLine;

        for (i = 0, j = orderLines.length; i < j; i++) {
            orderLine = orderLines[i];
            log.audit(logTitle, '>> orderLine: ' + JSON.stringify(orderLine));

            var lineData = {
                ingramPartNumber: orderLine.ingramPartNumber,
                customerPartNumber: orderLine.ingramPartNumber,
                vendorPartNumber: orderLine.vendorPartNumber,
                upc: orderLine.upcCode,
                quantityRequested: orderLine.quantityOrdered
            };

            if (orderLine.shipmentDetails) {
                if (!shipLocation[lineData.ingramPartNumber]) {
                    shipLocation[lineData.ingramPartNumber] = [];
                }

                for (ii = 0, jj = orderLine.shipmentDetails.length; ii < jj; ii++) {
                    shipLocation[lineData.ingramPartNumber].push({
                        warehouseId: orderLine.shipmentDetails[ii].shipFromWarehouseId,
                        warehouseLocation: orderLine.shipmentDetails[ii].shipFromLocation
                    });

                    // set the default ETA
                    orderLine.shipmentDetails[ii].estimatedDeliveryDate = defaultETA.text;
                }
            }

            log.audit(logTitle, '>>>> lineData: ' + JSON.stringify(lineData));
            arrItems.push(lineData);
        }

        log.audit(logTitle, '>> arrItems: ' + JSON.stringify(arrItems));
        log.audit(logTitle, '>> shipLocation: ' + JSON.stringify(shipLocation));

        // send the call
        var itemAvailReq = VC2_Utils.sendRequest({
            header: [LogTitle, 'Item Availability'].join(' : '),
            method: 'post',
            doRetry: false,
            query: {
                url:
                    vendorConfig.endPoint.replace(
                        /orders[\/]*$/gi,
                        'catalog/priceandavailability?'
                    ) +
                    'includeAvailability=true&includePricing=true&includeProductAttributes=true',
                headers: {
                    Authorization: 'Bearer ' + token,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'IM-CustomerNumber': vendorConfig.customerNo,
                    'IM-CountryCode': vendorConfig.country,
                    'IM-CustomerOrderNumber': poNum,
                    'IM-CorrelationID': [option.poNum, option.poId].join('-')
                },
                body: JSON.stringify({
                    showAvailableDiscounts: true,
                    showReserveInventoryDetails: true,
                    specialBidNumber: '',
                    products: arrItems
                })
            },
            recordId: poId
        });
        if (itemAvailReq.isError) throw itemAvailReq.errorMsg;
        var itemAvailRespBody = VC2_Utils.safeParse(itemAvailReq.RESPONSE);
        if (!itemAvailRespBody) throw 'Unable to retrieve the item availability';

        for (i = 0, j = orderLines.length; i < j; i++) {
            orderLine = orderLines[i];

            for (ii = 0, jj = itemAvailRespBody.length; ii < jj; ii++) {
                var itemAvailLine = itemAvailRespBody[i];
                log.audit(logTitle, '>> itemAvailLine: ' + JSON.stringify(itemAvailLine));

                if (
                    itemAvailLine.ingramPartNumber != orderLine.ingramPartNumber ||
                    itemAvailLine.upc != orderLine.upcCode ||
                    itemAvailLine.vendorPartNumber != orderLine.vendorPartNumber
                )
                    continue;

                // search for location
                if (!itemAvailLine.availability) continue;

                var locationList = itemAvailLine.availability
                    ? itemAvailLine.availability.availabilityByWarehouse || false
                    : false;

                log.audit(logTitle, '>> locationList: ' + JSON.stringify(locationList));

                var arrDates = [];
                for (var iii = 0, jjj = locationList.length; iii < jjj; iii++) {
                    var dateStr = locationList[iii].quantityBackorderedEta;
                    if (!dateStr) continue;
                    // arrDates.push( new Date(dateStr.replace(/(\d{4}).(\d{2}).(\d{2})/gi, "$2/$3/$1")) );
                    arrDates.push({
                        dateStr: dateStr,
                        dateObj: moment(dateStr).toDate() //new Date(dateStr.replace(/(\d{4}).(\d{2}).(\d{2})/gi, "$3/$2/$1"))
                    });
                }
                log.audit(logTitle, '>> arrDates: ' + JSON.stringify(arrDates));
                if (arrDates.length) {
                    var nearestDate = arrDates.sort(function (a, b) {
                        return a.dateObj - b.dateObj;
                    })[0];
                    for (
                        var shipLine = 0;
                        shipLine < responseBody.lines[i].shipmentDetails.length;
                        shipLine++
                    ) {
                        responseBody.lines[i].shipmentDetails[shipLine].estimatedDeliveryDate =
                            nearestDate.dateStr;
                    }
                }
            }
        }

        return responseBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} option
     * @returns object
     **/
    function processResponse(option) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, option);

        var outputArray = [],
            poId = option.poId;

        var validOrderStatus = ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'];
        var validLineStatus = ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'];
        var validShippedStatus = ['SHIPPED'];

        try {
            if (option.responseBody === null || !option.responseBody) {
                throw 'Missing or invalid responseBody';
            }
            var objBody = option.responseBody;

            log.audit(logTitle, '>> objBody : ' + JSON.stringify(objBody));

            var orderStatus = objBody.orderStatus;
            if (orderStatus) orderStatus = orderStatus.toUpperCase();
            log.audit(logTitle, '>> orderStatus : ' + JSON.stringify(orderStatus));

            if (!VC2_Utils.inArray(orderStatus, validOrderStatus)) {
                throw 'Skipping Order - ' + orderStatus;
            }

            for (var i = 0; i < objBody.lines.length; i++) {
                var orderLine = objBody.lines[i];
                var lineStatus = orderLine.lineStatus;
                if (lineStatus) lineStatus = lineStatus.toUpperCase();

                log.audit(logTitle, '>> orderLine #' + i + ': ' + JSON.stringify(orderLine));

                if (!VC2_Utils.inArray(lineStatus, validLineStatus)) {
                    log.audit(
                        logTitle,
                        '.... skipping line, invalid status :  [' + orderLine.lineStatus + ']'
                    );
                }

                var outputObj = {};

                // get line details from order lines
                outputObj.line_num = orderLine.customerLineNumber;
                outputObj.item_num = orderLine.vendorPartNumber; ////orderLine.ingramPartNumber;//
                outputObj.item_num_alt = orderLine.ingramPartNumber;
                outputObj.is_shipped = VC2_Utils.inArray(lineStatus, validShippedStatus);

                //add shipment details
                outputObj.ship_qty = 0;
                var trackingNum = [];
                var serials = [];
                for (var shipLine = 0; shipLine < orderLine.shipmentDetails.length; shipLine++) {
                    var shipment = orderLine.shipmentDetails[shipLine];

                    outputObj.ship_qty += parseInt(shipment.quantity);
                    outputObj.order_num = orderLine.subOrderNumber; //shipment.invoiceNumber;
                    outputObj.order_date = shipment.invoiceDate;
                    outputObj.ship_date = shipment.shippedDate;
                    outputObj.order_eta = shipment.estimatedDeliveryDate || '';
                    outputObj.order_eta_ship = shipment.estimatedDeliveryDate;

                    //add carrier details
                    //		            	  for (var carrierLine = 0; carrierLine < shipment.carrierDetails.length; carrierLine++) {
                    var carrier = shipment.carrierDetails;

                    if (!outputObj.carrier) outputObj.carrier = carrier.carrierName;

                    //add tracking details
                    if (carrier.trackingDetails) {
                        for (
                            var trackingLine = 0;
                            trackingLine < carrier.trackingDetails.length;
                            trackingLine++
                        ) {
                            var tracking = carrier.trackingDetails[trackingLine];

                            if (tracking.trackingNumber) trackingNum.push(tracking.trackingNumber);

                            //add serials
                            if (tracking.SerialNumbers)
                                for (
                                    var serialLine = 0;
                                    serialLine < tracking.SerialNumbers.length;
                                    serialLine++
                                ) {
                                    var serial = tracking.SerialNumbers[serialLine];

                                    if (serial.serialNumber) serials.push(serial.serialNumber);
                                }
                        }
                    }
                    //		            	  }
                }
                serials = VC2_Utils.uniqueArray(serials);
                outputObj.tracking_num = trackingNum.join(',');
                outputObj.serial_num = serials.join(',');
                log.audit(logTitle, '>> adding: ' + JSON.stringify(outputObj));
                outputArray.push(outputObj);
            }
        } catch (error) {
            log.error(logTitle, '>> ERROR: ' + JSON.stringify(error));

            vcLog.recordLog({
                header: 'Ingram Response Processing | ERROR',
                body: VC2_Utils.extractError(error),
                transaction: poId,
                status: VC_Global.Lists.VC_LOG_STATUS.ERROR,
                isDebugMode: option.fromDebug
            });
        }

        log.audit(logTitle, '>> output array: ' + JSON.stringify(outputArray));
        return outputArray;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, option);

        var outputArray = null;

        // outputArray = JSON.parse(
        //     '[{"line_num":"001","item_num":"DELL-WD19TBS","item_num_alt":"8VQ071","is_shipped":true,"ship_qty":9,"order_num":"40-09550-11","order_date":"2022-04-10","ship_date":"2022-04-10","order_eta":"2022-04-09","order_eta_ship":"2022-04-09","carrier":"FEDEX GROUND","tracking_num":"571966430395,571966430400","serial_num":"3PTRVK3,3THFVK3,68NRVK3,7RTRVK3,7WKQVK3,CMTRVK3,DFCSVK3,FQMRVK3,H60SVK3,3PTRVK3,3THFVK3,68NRVK3,7RTRVK3,7WKQVK3,CMTRVK3,DFCSVK3,FQMRVK3,H60SVK3"},{"line_num":"002","item_num":"DELL-WD19TBS","item_num_alt":"8VQ071","is_shipped":true,"ship_qty":1,"order_num":"40-09550-21","order_date":"2022-04-08","ship_date":"2022-04-08","order_eta":"2022-04-09","order_eta_ship":"2022-04-09","carrier":"FEDEX GROUND","tracking_num":"563221536625","serial_num":"J4NMVK3"}]'
        // );

        var responseBody = processRequest({
            poNum: option.poNum,
            vendorConfig: option.vendorConfig,
            poId: option.poId
        });

        if (responseBody) {
            outputArray = processResponse({
                poNum: option.poNum,
                poId: option.poId,
                vendorConfig: option.vendorConfig,
                responseBody: responseBody
            });
        }
        log.audit(logTitle, '>> outputArray: ' + JSON.stringify(outputArray));

        vcLog.recordLog({
            header: [LogTitle, 'Lines'].join(' - '),
            body: !VC2_Utils.isEmpty(outputArray)
                ? JSON.stringify(outputArray)
                : '-no lines to process-',
            transaction: option.poId,
            status: VC_Global.Lists.VC_LOG_STATUS.INFO,
            isDebugMode: option.fromDebug
        });

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest
    };
});
