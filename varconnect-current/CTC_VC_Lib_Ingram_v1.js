
/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Ingram_v1
 * Author: shawn.blackburn
 * @NApiVersion 2.x
 * @description Helper file for Ingram Micro V1 (Cisco) to Get PO Status
 */
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/log',
    'N/https',
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './Bill Creator/Libraries/moment'
], function (search, record, runtime, log, https, vcLog, constants, moment) {
    'use strict';
    var LogTitle = 'WS:IngramV1';

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns string
     **/
    function generateToken(obj) {
        var logTitle = [LogTitle, 'generateToken'].join('::');
        log.audit(logTitle, obj);

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var jsonBody = {
            client_id: obj.apiKey,
            client_secret: obj.apiSecret,
            grant_type: 'client_credentials'
        };

        var body = convertToXWWW(jsonBody);

        var response = https.post({
            url: obj.accessEndPoint,
            body: body,
            headers: headers
        });

        if (response) {
            var responseBody = JSON.parse(response.body);
            log.audit(logTitle, '>> response body: ' + JSON.stringify(responseBody));

            if (response.code == 200) {
                log.audit(
                    logTitle,
                    '>> Token generated: ' + JSON.stringify(responseBody.access_token)
                );

                return responseBody.access_token;
            } else {
                // retry 1 more time
                response = https.post({
                    url: obj.accessEndPoint,
                    body: body,
                    headers: headers
                });
                responseBody = JSON.parse(response.body);

                if (response.code == 200) {
                    log.audit(
                        logTitle,
                        '>> Token generated: ' + JSON.stringify(responseBody.access_token)
                    );
                    return responseBody.access_token;
                } else {
                    log.error(logTitle, '>> generateToken Failure: ' + JSON.stringify(response));
                    return null;
                }
            }
        }
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, obj);


        var token = generateToken(obj.vendorConfig);

        //for debugging
        if (!obj.poId) obj.poId = obj.poNum;

        var countryCode = 'US';
        if (runtime.country == 'CA') countryCode = 'CA';
        if (obj.countryCode) countryCode = obj.countryCode;


        var headers = {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'IM-CustomerNumber': obj.vendorConfig.customerNo,
            'IM-CountryCode': countryCode,
            'IM-CustomerOrderNumber': obj.poNum,
            'IM-CorrelationID': obj.poId
        };

        //https://api.ingrammicro.com:443/resellers/v6/orders/orderstatus
        var url = obj.vendorConfig.endPoint + '/search?customerOrderNumber=' + obj.poNum;

        try {
            vcLog.recordLog({
                header: 'Ingram V1 OrderStatus PO Request',
                body: JSON.stringify({
                    URL: url,
                    HEADERS: headers
                }),
                transaction: obj.poId,
                status: constants.Lists.VC_LOG_STATUS.INFO
            });
        } catch (e) {
            log.error(logTitle, e);
        }

        var response = https.get({
            url: url,
            headers: headers
        });

        try {
            vcLog.recordLog({
                header: 'Ingram V1 OrderStatus Response',
                body: JSON.stringify(response),
                transaction: obj.poId,
                status: constants.Lists.VC_LOG_STATUS.SUCCESS
            });
        } catch (e) {
            log.error(logTitle, e);
        }

        if (response) {
            var responseBody = JSON.parse(response.body);
            responseBody = _getOrderDetail({
                responseBody: responseBody,
                token: token,
                vendorConfig: obj.vendorConfig,
                poId: obj.poId
            });

            /// PRICE & AVAILABILITY /////
            if (responseBody) {
                _getItemAvailability({
                    responseBody: responseBody,
                    token: token,
                    vendorConfig: obj.vendorConfig,
                    poId: obj.poId || obj.poNum,
                    poNum: obj.poNum
                });
            }

            return responseBody;
        }
    }

    function _getOrderDetail(options) {
        var logTitle = [LogTitle, '_getOrderDetail'].join('::');
        log.audit(logTitle, options);

        var response = options.responseBody,
            vendorConfig = options.vendorConfig,
            token = options.token,
            poId = options.poId,
            responseBody;

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

            // TODO: send the correct country code
            var countryCode = 'US';
            if (runtime.country == 'CA') countryCode = 'CA';

            var headers = {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'IM-CustomerNumber': vendorConfig.customerNo,
                'IM-CountryCode': countryCode,
                'IM-CorrelationID': poId
                //				'IM-SenderID': vendorConfig.customerNo
            };

            var url = vendorConfig.endPoint + '/' + ingramOrderNumber;

            try {
                vcLog.recordLog({
                    header: 'Ingram V6 PO Details Request',
                    body: JSON.stringify(headers),
                    transaction: poId,
                    status: constants.Lists.VC_LOG_STATUS.INFO
                });
            } catch (e) {
                log.error(logTitle, e);
            }

            response = https.get({
                url: url,
                headers: headers
            });

            try {
                vcLog.recordLog({
                    header: 'Ingram V6 PO Details Response',
                    body: JSON.stringify(response),
                    transaction: poId,
                    status: constants.Lists.VC_LOG_STATUS.SUCCESS
                });
            } catch (e) {
                log.error(logTitle, e);
            }

            if (response) {
                log.audit({
                    title: 'Details Response',
                    details: response
                });
                responseBody = JSON.parse(response.body);
            }
        }

        return responseBody;
    }

    function _getItemAvailability(options) {
        var logTitle = [LogTitle, '_getItemAvailability'].join('::');
        log.audit(logTitle, options);

        var responseBody = options.responseBody,
            vendorConfig = options.vendorConfig,
            token = options.token,
            poId = options.poId,
            poNum = options.poNum;

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
        var requestOption = {};
        requestOption.headers = {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'IM-CustomerNumber': vendorConfig.customerNo,
            'IM-CountryCode': runtime.country == 'CA' ? 'CA' : 'US',
            'IM-CustomerOrderNumber': poNum,
            'IM-CorrelationID': poId
        };

        requestOption.body = {
            showAvailableDiscounts: true,
            showReserveInventoryDetails: true,
            specialBidNumber: '',
            products: arrItems
        };

        var url =
            vendorConfig.endPoint.replace(/orders\/$/gi, 'catalog/priceandavailability?') +
            '/includeAvailability=true&includePricing=true&includeProductAttributes=true';

        log.audit(logTitle, 'requestUrl: ' + url);
        log.audit(logTitle, 'requestOption ' + JSON.stringify(requestOption));

        requestOption.url = url;

        try {
            vcLog.recordLog({
                header: 'Ingram V6 Item Availability (Request)',
                body: JSON.stringify(requestOption),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.INFO
            });
        } catch (e) {
            log.error(logTitle, e);
        }

        requestOption.body = JSON.stringify(requestOption.body);

        var responseETA = https.post(requestOption);

        try {
            vcLog.recordLog({
                header: 'Ingram V6 Item Availability (Response)',
                body: JSON.stringify(responseETA),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.SUCCESS
            });
        } catch (e) {
            log.error(logTitle, e);
        }

        if (responseETA.body) {
            var responseBodyETA = JSON.parse(responseETA.body);

            for (i = 0, j = orderLines.length; i < j; i++) {
                orderLine = orderLines[i];

                for (ii = 0, jj = responseBodyETA.length; ii < jj; ii++) {
                    var respLine = responseBodyETA[i];
                    log.audit(logTitle, '>> respLine: ' + JSON.stringify(respLine));

                    if (
                        respLine.ingramPartNumber != orderLine.ingramPartNumber ||
                        respLine.upc != orderLine.upcCode ||
                        respLine.vendorPartNumber != orderLine.vendorPartNumber
                    )
                        continue;

                    // search for location
                    if (!respLine.availability) continue;

                    var locationList = respLine.availability
                        ? respLine.availability.availabilityByWarehouse || false
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
        }

        return responseBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function processResponse(obj) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, obj);

        var outputArray = [];

        if (obj.responseBody === null) {
            return outputArray;
        }

        var objBody = obj.responseBody;
        log.audit('objBody', objBody);
        if (objBody) {
            var status = objBody.orderStatus;

            var validStatus = ['Shipped', 'Processing', 'Delivered', 'Backordered'];
            if (validStatus.indexOf(status) >= 0) {
                for (var i = 0; i < objBody.lines.length; i++) {
                    var orderLine = objBody.lines[i];
                    log.audit(logTitle, '>> line ' + i + ': ' + JSON.stringify(orderLine));

                    if (validStatus.indexOf(orderLine.lineStatus) >= 0) {
                        var outputObj = {};

                        // get line details from order lines
                        outputObj.line_num = orderLine.customerLineNumber;
                        outputObj.item_num = orderLine.ingramPartNumber;//orderLine.vendorPartNumber; //

                        //add shipment details
                        outputObj.ship_qty = 0;
                        var trackingNum = [];
                        var serials = [];
                        for (
                            var shipLine = 0;
                            shipLine < orderLine.shipmentDetails.length;
                            shipLine++
                        ) {
                            var shipment = orderLine.shipmentDetails[shipLine];

                            outputObj.ship_qty += parseInt(shipment.quantity);
                            outputObj.order_num = orderLine.subOrderNumber; //shipment.invoiceNumber;
                            outputObj.order_date = shipment.invoiceDate;
                            outputObj.ship_date = shipment.shippedDate;
                            outputObj.order_eta = shipment.estimatedDeliveryDate || '';

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

                                    if (tracking.trackingNumber)
                                        trackingNum.push(tracking.trackingNumber);

                                    //add serials
                                    if (tracking.SerialNumbers)
                                        for (
                                            var serialLine = 0;
                                            serialLine < tracking.SerialNumbers.length;
                                            serialLine++
                                        ) {
                                            var serial = tracking.SerialNumbers[serialLine];

                                            if (serial.serialNumber)
                                                serials.push(serial.serialNumber);
                                        }
                                }
                            }
                            //		            	  }
                        }
                        outputObj.tracking_num = trackingNum.join(',');
                        outputObj.serial_num = serials.join(',');
                        log.audit(logTitle, '>> adding: ' + JSON.stringify(outputObj));
                        outputArray.push(outputObj);
                    }
                }
            }
        }
        log.audit({
            title: 'outputArray',
            details: outputArray
        });
        return outputArray;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function convertToXWWW(json) {
        // log.audit('convertToXWWW', JSON.stringify(json));
        if (typeof json !== 'object') {
            return null;
        }
        var u = encodeURIComponent;
        var urljson = '';
        var keys = Object.keys(json);
        for (var i = 0; i < keys.length; i++) {
            urljson += u(keys[i]) + '=' + u(json[keys[i]]);
            if (i < keys.length - 1) urljson += '&';
        }
        return urljson;
    }

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, options);

        var outputArray = null;

        var responseBody = processRequest({
            poNum: options.poNum,
            vendorConfig: options.vendorConfig,
            poId: options.poId, 
            countryCode: options.countryCode
        });

        if (responseBody) {
            outputArray = processResponse({
                vendorConfig: options.vendorConfig,
                responseBody: responseBody
            });
        }
        log.audit(logTitle, '>> outputArray: ' + JSON.stringify(outputArray));

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest
    };
});
