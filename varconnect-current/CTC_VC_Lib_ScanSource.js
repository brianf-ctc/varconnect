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

define(['N/log', 'N/https', './CTC_VC_Lib_Log.js'], function (log, https, vcLog) {
    'use strict';
    /**
     * @memberOf CTC_VC_Lib_ScanSource
     * @param {object} obj
     * @returns string
     **/
    function generateToken(obj) {
        log.debug('obj', obj);

        var headers = {
            'Ocp-Apim-Subscription-Key': '4c83c3da-f5e5-4901-954f-399ef8175603', // add this to the config record
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var jsonBody = {
            client_id: obj.apiKey,
            client_secret: obj.apiSecret,
            grant_type: 'client_credentials',
            scope: obj.oauthScope
        };

        var body = convertToXWWW(jsonBody);

        var response = https.post({
            url: obj.accessEndPoint,
            body: body,
            headers: headers
        });

        if (response) {
            var responseBody = JSON.parse(response.body);

            log.debug({
                title: 'Response Body',
                details: response.body
            });

            if (response.code == 200) {
                log.debug({
                    title: 'Token Generated',
                    details: responseBody.access_token
                });

                return responseBody.access_token;
            } else {
                // retry 1 more time

                response = https.post({
                    url: obj.url,
                    body: body,
                    headers: headers
                });

                if (response.code == 200) {
                    log.debug({
                        title: 'Token Generated',
                        details: responseBody.access_token
                    });

                    return responseBody.access_token;
                } else {
                    log.error({
                        title: 'generateToken Failure',
                        details: response
                    });

                    return null;
                }
            }
        }
    }

    /**
     * @memberOf CTC_VC_Lib_ScanSource
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {
        var token = generateToken(obj.vendorConfig);
        var headers = {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': '4c83c3da-f5e5-4901-954f-399ef8175603' // add this to the config record
        };

        var listResponse = https.get({
            url:
                obj.vendorConfig.endPoint +
                '/list?customerNumber=' +
                obj.vendorConfig.customerNo +
                '&poNumber=' +
                obj.poNum,
            headers: headers
        });

        vcLog.recordLog({
            header: 'ScanSource Get PO Response',
            body: JSON.stringify(listResponse),
            transaction: obj.poId,
            isDebugMode: obj.fromDebug
        });

        var returnArray = [];

        if (listResponse.code == 200) {
            var listResponseBody = JSON.parse(listResponse.body);

            log.debug({
                title: 'List Response Body',
                details: listResponseBody
            });

            listResponseBody.forEach(function (order) {
                var detailResponse = https.get({
                    url:
                        obj.vendorConfig.endPoint +
                        '/detail?salesOrderNumber=' +
                        order.OrderNumber +
                        '&customerNumber=' +
                        obj.vendorConfig.customerNo +
                        '&excludeSerialTracking=false',
                    headers: headers
                });

                if (detailResponse.code == 200) {
                    log.debug({
                        title: 'Detail Response Body',
                        details: detailResponse.body
                    });

                    var d = JSON.parse(detailResponse.body);
                    d.DateEntered = order.DateEntered;

                    returnArray.push(d);
                } else {
                    log.error({
                        title: 'Error Getting Transaction List for Order ' + order.OrderNumber,
                        details: listResponse
                    });
                }
            });
        } else {
            log.error({
                title: 'Error Getting Transaction List for PO ' + obj.poNum,
                details: listResponse
            });
            returnArray = listResponse;
        }

        return returnArray;
    }

    /**
     * @memberOf CTC_VC_Lib_ScanSource
     * @param {object} obj
     * @returns object
     **/
    function processResponse(obj) {
        log.debug('processResponse', JSON.stringify(obj));
        var outputArray = [];
        //
        //
        //
        //
        if (obj.responseBody.length == 0) {
            return outputArray;
        }

        // outputObj = {
        //   order_date: "",
        //   order_num: "",
        //   line_num: "",
        //   item_num: "",
        //   ship_qty: "",
        //   ship_date: "",
        //   order_eta: "",
        //   carrier: "",
        //   tracking_num: "1Z1..,1Z2...,1Z3... ",
        //   serials: "123,456,789"
        // }

        obj.responseBody.forEach(function (order) {
            var itemArray = [],
                deliveryArray = [];

            //create original item array which contains correct ship qty
            order.SalesOrderLines.forEach(function (itemLine) {
                var vendorSKU = itemLine.ItemNumber,
                    itemNum = itemLine.ProductMfrPart,
                    shippedQty = parseInt(itemLine.Shipped);
                //only include shipped items
                if (shippedQty > 0)
                    itemArray.push({
                        order_date: order.DateEntered,
                        order_num: order.SalesOrderNumber,
                        vendorSKU: vendorSKU,
                        item_num: itemNum,
                        ship_qty: shippedQty
                    });
            });

            order.Deliveries.forEach(function (delivery) {
                log.debug('delivery', JSON.stringify(delivery));

                var p = {};
                p.tracking = [];

                delivery.Parcels.forEach(function (parcel) {
                    p.carrier = parcel.CarrierCode;
                    p.tracking.push(parcel.TrackingNumber);
                });

                delivery.LineItems.forEach(function (line) {
                    var o = {};

                    // change date format
                    // from M/D/YYYY H:MM A to M/D/YYYY
                    var odate = order.DateEntered.split('/');
                    o.order_date = odate[0] + '/' + odate[1] + '/' + odate[2].slice(0, 4);

                    o.order_date = order.DateEntered;
                    o.order_num = order.SalesOrderNumber;
                    o.line_num =
                        Math.floor(delivery.DeliveryDocumentNumber + '.' + line.DeliveryDocumentLineNumber) * 1;
                    o.vendorSKU = line.ItemNumber;
                    o.ship_qty = parseInt(line.QuantityShipped);

                    // change date format
                    // from YYYY-MM-DD to MM/DD/YYYY
                    var sdate = delivery.ShippedDate;
                    o.ship_date = sdate.slice(5, 7) + '/' + sdate.slice(8, 10) + '/' + sdate.slice(0, 4);

                    o.order_eta = '';
                    o.carrier = p.carrier;
                    o.tracking_num = p.tracking.join(',');

                    var s = [];

                    line.LineItemDetails.forEach(function (lineDetail) {
                        if (lineDetail.SerialNumber !== null) {
                            s.push(lineDetail.SerialNumber);
                        }
                    });

                    o.serials = s.join(',');

                    deliveryArray.push(o);
                });
            });

            //match item array with delivery array
            itemArray.forEach(function (item) {
                var itemNum = item.item_num,
                    vendorSKU = item.vendorSKU,
                    shipQty = item.ship_qty,
                    outputObj = item;

                deliveryArray.some(function (d) {
                    if (d.vendorSKU != vendorSKU) return false;
                    else {
                        //if match, use delivery array for complete info but get ship qty
                        outputObj = d;
                        outputObj.ship_qty = shipQty;
                        outputObj.item_num = itemNum;
                        return true;
                    }
                });
                log.debug('outputObj', outputObj);

                outputArray.push(outputObj);
            });
        });

        log.audit({
            title: 'outputArray',
            details: outputArray
        });
        return outputArray;
    }

    /**
     * @memberOf CTC_VC_Lib_ScanSource
     * @param {object} obj
     * @returns object
     **/
    function convertToXWWW(json) {
        log.debug('convertToXWWW', JSON.stringify(json));
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
        log.audit({
            title: 'options',
            details: options
        });
        var outputArray = null;

        var responseBody = processRequest({
            poNum: options.poNum,
            vendorConfig: options.vendorConfig,
            poId: options.poId
        });

        if (responseBody) {
            outputArray = processResponse({
                vendorConfig: options.vendorConfig,
                responseBody: responseBody
            });
        }
        log.emergency({
            title: 'outputArray',
            details: outputArray
        });
        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest
    };
});
