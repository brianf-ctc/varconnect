/**
 * Copyright (c) 2024 Catalyst Tech Corp
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
 */

define(['N/url', './CTC_VC2_Lib_Utils.js', './Bill Creator/Libraries/moment'], function (
    ns_url,
    vc2_util,
    moment
) {
    var EntryPoint = {};
    EntryPoint.process = function (option) {
        var LogTitle = ['CTC_VC_Lib_Carahsoft', 'process'].join('::');

        try {
            option.recordId = option.poId || option.recordId;
            option.recordNum = option.poNum || option.transactionNum;

            var responseBody = this.processRequest(option);
            var returnValue = this.processResponse(responseBody);

            log.debug(LogTitle + ' | returnValue', returnValue);
            return returnValue;
        } catch (ex) {
            vc2_util.logError(LogTitle, ex);
            throw ex;
        }
    };

    EntryPoint.processRequest = function (option) {
        var LogTitle = ['CTC_VC_Lib_Carahsoft', 'processRequest'].join('::');

        try {
            var objHeaders = {
                Authorization: getTokenCache(option),
                'Content-Type': 'application/json',
                'X-Account': option.vendorConfig.customerNo
            };

            var orderListUrl = option.vendorConfig.endPoint + '' + option.recordNum;
            // var orderListUrl = config.vendorConfig.endPoint+'/Order';

            var objResponse = vc2_util.sendRequest({
                header: LogTitle,
                method: 'get',
                recordId: option.recordId,
                query: {
                    url: orderListUrl,
                    headers: objHeaders
                }
            });

            if (objResponse.isError) {
                throw objResponse.errorMsg;
            }

            log.debug(LogTitle + ' | objResponse.RESPONSE.body', objResponse.RESPONSE.body);
            return objResponse.RESPONSE.body;
        } catch (ex) {
            vc2_util.logError(LogTitle, ex);
            throw ex;
        }
    };

    EntryPoint.processResponse = function (responseBody) {
        var LogTitle = ['CTC_VC_Lib_Carahsoft', 'processResponse'].join('::');

        if (!responseBody) {
            return;
        }
        responseBody = JSON.parse(responseBody);

        if (!vc2_util.isEmpty(responseBody.Queryable)) {
            responseBody = responseBody.Queryable;
        }

        var itemArray = [];

        if (Array.isArray(responseBody)) {
            for (var i = 0; i < responseBody.length; i++) {
                var objOrder = responseBody[i];

                //get order lines from order response
                var arrDetails = objOrder.Details;
                for (var d = 0; d < arrDetails.length; d++) {
                    //get line items
                    var arrItems = arrDetails[d].LineItems;
                    for (var n = 0; n < arrItems.length; n++) {
                        var orderItem = {};

                        //set values to order item
                        orderItem.order_id = objOrder.Order_ID;
                        orderItem.customer_name = objOrder.CustomerName;
                        // orderItem.order_num = objOrder.CustomerPO;
                        orderItem.order_num = objOrder.Order_ID;
                        orderItem.order_date = objOrder.DateBooked; //need to confirm
                        orderItem.order_status = objOrder.Status;

                        orderItem.line_num = 'NA';
                        orderItem.item_num = 'NA';
                        orderItem.item_id = 'NA';
                        orderItem.vendor_id = 'NA';
                        orderItem.ship_qty = 'NA';
                        orderItem.vendorSKU = 'NA';
                        orderItem.serial_num = 'NA';
                        orderItem.order_eta = 'NA';
                        orderItem.ship_date = 'NA';
                        orderItem.tracking_num = 'NA';
                        orderItem.carrier = 'NA';

                        orderItem.line_num = arrItems[n].LineNumber;
                        orderItem.item_id = arrItems[n].Item;
                        orderItem.item_num = arrItems[n].Item;
                        orderItem.item_description = arrItems[n].Description;
                        orderItem.tracking_num = arrItems[n].TrackingNumber;
                        orderItem.order_qty = arrItems[n].Quantity;
                        orderItem.rate = arrItems[n].Price;

                        orderItem.extended_price = arrItems[n].ExtendedPrice;
                        orderItem.license_keys = arrItems[n].LicenseKeys;

                        itemArray.push(orderItem);
                    }
                }
            }
        }
        return itemArray;
    };

    function generateToken(config) {
        var LogTitle = ['CTC_VC_Lib_Carahsoft', 'generateToken'].join('::');

        var objHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        var objBody = {
            grant_type: 'client_credentials',
            client_id: config.vendorConfig.apiKey,
            client_secret: config.vendorConfig.apiSecret,
            audience: config.vendorConfig.oauthScope
        };

        var tokenReq = vc2_util.sendRequest({
            header: LogTitle,
            method: 'post',
            recordId: config.recordId,
            query: {
                body: objBody,
                headers: objHeaders,
                url: config.vendorConfig.accessEndPoint
            }
        });
        if (tokenReq.isError) {
            // try to parse anything
            var errorMessage = tokenReq.errorMsg;
            if (tokenReq.PARSED_RESPONSE && tokenReq.PARSED_RESPONSE.error_description) {
                errorMessage = tokenReq.PARSED_RESPONSE.error_description;
            }
            throw 'Generate Token Error - ' + errorMessage;
        }
        var tokenResp = vc2_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';
        log.audit(LogTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        var bearerToken = [tokenResp.token_type, tokenResp.access_token].join(' ');
        return bearerToken;
    }

    function getTokenCache(config) {
        var token = vc2_util.getNSCache({ key: 'VC_CARAHSOFT_TOKEN' });
        if (vc2_util.isEmpty(token)) token = generateToken(config);

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: 'VC_CARAHSOFT_TOKEN',
                cacheTTL: 300,
                value: token
            });
        }
        return token;
    }

    return EntryPoint;
});
