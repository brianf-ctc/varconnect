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
 * @description Helper file for Arrow Get PO Status
 */
/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Arrow
 * Author: john.ramonel
 */
define(['N/search', 'N/record', 'N/runtime', 'N/log', 'N/https', './CTC_VC_Lib_Log.js'], function (
    search,
    record,
    runtime,
    log,
    https,
    vcLog
) {
    'use strict';

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns string
     **/
    function generateToken(obj) {
        if (!obj) var obj = {};
        //obj.apiKey = '8e88d6d7-5f9d-4614-9f10-28a6f725c69d';
        //obj.apiSecret = '4a95b3a7-02c3-4be7-9761-9e8ee12d2957';
        obj.grantType = 'client_credentials';
        //obj.tokenURL = 'https://qaecsoag.arrow.com/api/oauth/token';

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var jsonBody = {
            client_id: obj.apiKey,
            client_secret: obj.apiSecret,
            grant_type: obj.grantType
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
                var response = https.post({
                    url: obj.accessEndPoint,
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
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {
        //if(!obj)
        //	var obj = {};
        //obj.url = 'https://qaecsoag.arrow.com/ArrowECS/SalesOrder_RS/Status';
        //obj.partnerId = '81e07b92-a53a-459b-a1fe-92537ab1abcijk'

        var token = generateToken(obj.vendorConfig);
        var headers = {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        };

        var body = {};
        var requestHeader = {};
        var orderRequest = {};
        var poNumber = {
            Number: obj.poNum,
            Line: [{ Number: null }],
            PartNumber: [{ Number: null }]
        };

        requestHeader.TransactionType = 'RESELLER_ORDER_STATUS';
        requestHeader.Region = 'NORTH_AMERICAS';
        requestHeader.SourceTransactionKeyID = null;
        requestHeader.RequestTimestamp = null;
        requestHeader.Country = 'US';
        requestHeader.PartnerID = obj.vendorConfig.customerNo;

        orderRequest.ResellerPOList = {
            ResellerPO: [poNumber]
        };

        orderRequest.IncludeCancelledOrders = 'N';
        orderRequest.IncludeClosedOrders = 'Y';

        //form body here..
        body.RequestHeader = requestHeader;
        body.OrderRequest = orderRequest;
        log.audit({ title: 'request body', details: body });

        if (obj.poId)
            vcLog.recordLog({
                header: 'Arrow Get PO Request',
                body: JSON.stringify(body),
                transaction: obj.poId
            });

        var response = https.post({
            url: obj.vendorConfig.endPoint,
            body: JSON.stringify(body),
            headers: headers
        });

        if (obj.poId)
            vcLog.recordLog({
                header: 'Arrow Get PO Response',
                body: JSON.stringify(response),
                transaction: obj.poId
            });

        if (response) {
            log.debug({ title: 'Response', details: response });
            var responseBody = JSON.parse(response.body);
            log.debug({ title: 'Response', details: responseBody });
            return responseBody;
        }
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function processResponse(obj) {
        var outputArray = [];
        var objBody = obj.responseBody.OrderResponse;
        var orderDate = null;
        var arrowSONum;
        if (objBody.OrderDetails.length) {
            var orderResp = objBody.OrderDetails[0];
            if (orderResp.hasOwnProperty('ArrowSONumber')) arrowSONum = orderResp.ArrowSONumber;
            if (orderResp.hasOwnProperty('Reseller')) {
                orderDate = orderResp.Reseller.PODate;
            }

            if (orderResp.hasOwnProperty('OrderLinesList')) {
                var orderLines = orderResp.OrderLinesList.OrderLines;
                log.audit({ title: 'orderLines length', details: orderLines.length });
                if (orderLines.length) {
                    for (var i = 0; i < orderLines.length; i++) {
                        // map here...
                        var outputObj = { order_num: arrowSONum };
                        var orderLineObj = orderLines[i];
                        log.debug('orderLineObj', orderLineObj);
                        outputObj.order_date = orderDate;
                        if (orderLineObj.hasOwnProperty('ResellerPOLineNumber')) {
                            outputObj.line_num = orderLineObj.ResellerPOLineNumber;
                        }
                        if (orderLineObj.hasOwnProperty('MFGPartNumber')) {
                            outputObj.item_num = orderLineObj.MFGPartNumber;
                        }
                        if (orderLineObj.hasOwnProperty('VendorPartNumber')) {
                            outputObj.vendorSKU = orderLineObj.VendorPartNumber;
                        }
                        if (orderLineObj.hasOwnProperty('InvoiceNumber')) {
                            outputObj.order_num = orderLineObj.InvoiceNumber;
                        }
                        if (orderLineObj.hasOwnProperty('ShippedQty')) {
                            var qty = parseInt(orderLineObj.ShippedQty);
                            if (isNaN(qty) || qty < 1) continue;
                            outputObj.ship_qty = orderLineObj.ShippedQty;
                        }
                        if (orderLineObj.hasOwnProperty('OracleShipViaCode')) {
                            outputObj.carrier = orderLineObj.OracleShipViaCode;
                        }

                        // shipping details
                        if (orderLineObj.hasOwnProperty('StatusInfoList')) {
                            var statusInfo = orderLineObj.StatusInfoList.StatusInfo;
                            if (statusInfo.length) {
                                var statusInfoObj = statusInfo[0]; // only contains 1
                                if (statusInfoObj.hasOwnProperty('EstimatedShipDate')) {
                                    outputObj.order_eta = statusInfoObj.EstimatedShipDate;
                                }
                                if (statusInfoObj.hasOwnProperty('ActualShipDate')) {
                                    outputObj.ship_date = statusInfoObj.ActualShipDate;
                                }
                                if (statusInfoObj.hasOwnProperty('TrackingNumber')) {
                                    outputObj.tracking_num = statusInfoObj.TrackingNumber;
                                }
                            }
                        }

                        // serial number list
                        if (orderLineObj.hasOwnProperty('SerialNumberList')) {
                            var serialNumbers = [];
                            var serialNumObj = orderLineObj.SerialNumberList.SerialNumber;
                            log.debug('serialNumObj', serialNumObj);
                            if (serialNumObj.length) {
                                for (var j = 0; j < serialNumObj.length; j++) {
                                    if (serialNumObj[j].hasOwnProperty('ID'))
                                        serialNumbers.push(serialNumObj[j].ID);
                                    else serialNumbers.push(JSON.stringify(serialNumObj[j]));
                                }
                                outputObj.serial_num = serialNumbers.join(',');
                            }
                        }
                        log.audit({ title: 'outputObj', details: outputObj });
                        outputArray.push(outputObj);
                    } // end for-loop
                }
            }
        }
        return outputArray;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function convertToXWWW(json) {
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
        log.audit({ title: 'options', details: options });
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
        log.emergency({ title: 'outputArray', details: outputArray });
        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest
    };
});
