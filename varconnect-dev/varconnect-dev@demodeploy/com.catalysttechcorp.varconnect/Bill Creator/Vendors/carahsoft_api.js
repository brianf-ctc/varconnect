/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @author ajdeleon
 **/

define(function (require) {
    var vc2_util = require('../../CTC_VC2_Lib_Utils');
    var LogTitle = 'WS:CarashsoftAPI',
        EntryPoint = {},
        TransId = '';

    EntryPoint.getInvoice = function (recordId, config) {
        TransId = recordId;

        //get invoice details and normalize the data
        var responseBody = getInvoiceDetails(config);
        var arrInvoiceData = formatInvoiceJson(responseBody);

        //get the item details from order and merge with the invoice data
        var responseBodyorder = getOrderDetails(config);
        var arrData = formatOrderJson(responseBodyorder, arrInvoiceData);

        return arrData;
    };

    function getInvoiceDetails(config) {
        var logTitle = [LogTitle, 'getInvoiceDetails'].join('::');

        var objHeaders = {
            Authorization: getTokenCache(config),
            'Content-Type': 'application/json'
        };

        // var invoiceListUrl = config.url+'/Invoice(DocNumber={keyDocNumber},Order_ID={keyOrder_ID})';
        var invoiceListUrl = config.url + '/Invoice';

        var objResponse = vc2_util.sendRequest({
            header: logTitle,
            recordId: TransId,
            query: {
                url: invoiceListUrl,
                headers: objHeaders
            }
        });
        vc2_util.handleJSONResponse(objResponse);

        var searchOrderResp = objResponse.PARSED_RESPONSE || objResponse.RESPONSE || {};
        if (objResponse.isError || vc2_util.isEmpty(searchOrderResp)) {
            throw (
                objResponse.errorMsg +
                (objResponse.details ? '\n' + JSON.stringify(objResponse.details) : '')
            );
        }
        return searchOrderResp;
    }

    function getOrderDetails(config) {
        var logTitle = [LogTitle, 'getOrderDetails'].join('::');

        var objHeaders = {
            Authorization: getTokenCache(config),
            'Content-Type': 'application/json'
        };

        // var orderListUrl = config.url+'/Order({key})';
        var orderListUrl = config.url + '/Order';

        var objResponse = vc2_util.sendRequest({
            header: logTitle,
            recordId: TransId,
            query: {
                url: orderListUrl,
                headers: objHeaders
            }
        });
        vc2_util.handleJSONResponse(objResponse);

        var searchOrderResp = objResponse.PARSED_RESPONSE || objResponse.RESPONSE || {};
        if (objResponse.isError || vc2_util.isEmpty(searchOrderResp)) {
            throw (
                objResponse.errorMsg +
                (objResponse.details ? '\n' + JSON.stringify(objResponse.details) : '')
            );
        }
        return searchOrderResp;
    }

    function formatInvoiceJson(responseBody) {
        if (!responseBody) {
            return;
        }

        if (!vc2_util.isEmpty(responseBody.Queryable)) {
            responseBody = responseBody.Queryable;
        }

        var arrInvoiceData = [];
        if (Array.isArray(responseBody)) {
            for (var i = 0; i < responseBody.length; i++) {
                var objInvoice = responseBody[i];
                var objData = {};

                objData.po = objInvoice.Order_ID;
                objData.date = objInvoice.DocDate;
                objData.invoice = objInvoice.Invoice_ID;
                objData.total = objInvoice.Total;

                //additional info
                objData.docnumber = objInvoice.DocNumber;
                objData.datepaid = objInvoice.DatePaid;
                objData.balance = objInvoice.Balance;
                objData.orderid = objInvoice.Order_ID;

                arrInvoiceData.push({ ordObj: objData });
            }
        }
        return arrInvoiceData;
    }

    function formatOrderJson(responseBody, arrInvoiceData) {
        if (!responseBody) {
            return;
        }

        if (!vc2_util.isEmpty(responseBody.Queryable)) {
            responseBody = responseBody.Queryable;
        }

        var arrData = [];
        if (Array.isArray(responseBody)) {
            for (var i = 0; i < responseBody.length; i++) {
                var objOrder = responseBody[i];

                //get order ID from order response
                var orderId = objOrder.Order_ID;

                //find the object from invoice data with the same order id from order response
                var arrItem = arrInvoiceData.filter(function (objData) {
                    if (objData.ordObj !== undefined) {
                        return objData.ordObj.orderid === orderId;
                    }
                });

                if (vc2_util.isEmpty(arrItem) || arrItem.length <= 0) {
                    continue;
                }

                var objInvoiceData = arrItem[0];

                //set lines key for line item
                objInvoiceData.ordObj.lines = [];

                //get order lines from order response
                var arrDetails = objOrder.Details;
                for (var d = 0; d < arrDetails.length; d++) {
                    //get line items
                    var arrItems = arrDetails[d].LineItems;
                    for (var n = 0; n < arrItems.length; n++) {
                        //add data to invoice object
                        objInvoiceData.ordObj.lines.push({
                            ITEMNO: arrItems[n].Item,
                            PRICE: arrItems[n].Price,
                            QUANTITY: arrItems[n].Quantity,
                            DESCRIPTION: arrItems[n].Description
                        });
                    }
                }

                arrData.push({ ordObj: objInvoiceData.ordObj });
            }
        }
        return arrData;
    }

    function getToken(config) {
        var logTitle = [LogTitle, 'getToken'].join('::');

        var objHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        var objBody = {
            grant_type: 'client_credentials',
            client_id: config.user_id,
            client_secret: config.user_pass,
            audience: config.scope
        };

        var tokenReq = vc2_util.sendRequest({
            header: logTitle,
            method: 'post',
            recordId: TransId,
            doRetry: true,
            maxRetry: 3,
            query: {
                url: config.token_url,
                body: vc2_util.convertToQuery(objBody),
                headers: objHeaders
            }
        });

        vc2_util.handleJSONResponse(tokenReq);

        var tokenResp = tokenReq.PARSED_RESPONSE;
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        return 'Bearer ' + tokenResp.access_token;
    }

    function getTokenCache(config) {
        var token = vc2_util.getNSCache({ key: 'VC_BC_CARAHSOFT_TOKEN' });
        if (vc2_util.isEmpty(token)) token = getToken(config);

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: 'VC_BC_CARAHSOFT_TOKEN',
                cacheTTL: 250,
                value: token
            });
        }
        return token;
    }

    return EntryPoint;
});
