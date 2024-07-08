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

/*jshint esversion: 9 */
define(function (require) {
    //load modules
    var https = require('N/https');
    var vc2_util = require('../../CTC_VC2_Lib_Utils');

    //declare variables
    var TransId = '';
    var EntryPoint = {};

    EntryPoint.getInvoice = function (input, config) {
        TransId = input;
        var responseBody = getInvoiceList(config);
        var arrData = formatJson(responseBody);
        return arrData;
    };

    function getInvoiceList(config) {
        var stLogTitle = 'scansource_api:getInvoiceList';

        var objHeaders = {
            'Ocp-Apim-Subscription-Key': config.subscription_key,
            Authorization: getTokenCache(config),
            'Content-Type': 'application/json'
        };

        var invoiceListUrl =
            config.url + '/list?customerNumber=' + config.partner_id + '&poNumber=' + config.poNum;
        log.debug(TransId + ' | ' + stLogTitle + ' | invoiceListUrl', invoiceListUrl);

        var objResponse = https.get({
            url: invoiceListUrl,
            headers: objHeaders
        });
        log.debug(TransId + ' | ' + stLogTitle + ' | objResponse', objResponse);

        var responseBody = '';
        if (objResponse.body) {
            responseBody = JSON.parse(objResponse.body);
        }
        return responseBody;
    }

    function getToken(config) {
        var stLogTitle = 'scansource_api:getToken';

        var objHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Ocp-Apim-Subscription-Key': config.subscription_key
        };
        var objBody = {
            client_id: config.user_id,
            client_secret: config.user_pass,
            grant_type: 'client_credentials',
            scope: config.scope
        };
        log.debug(TransId + ' | ' + stLogTitle + ' | objHeaders', objHeaders);
        log.debug(TransId + ' | ' + stLogTitle + ' | objBody', objBody);

        var objResponse = https.post({
            url: config.token_url,
            headers: objHeaders,
            body: objBody
        });
        log.debug(TransId + ' | ' + stLogTitle + ' | objResponse', objResponse);

        var tokenResponse = '';
        if (objResponse.code == '200' || objResponse.code == 200) {
            var responseBody = objResponse.body;
            responseBody = JSON.parse(responseBody);
            tokenResponse = 'Bearer ' + responseBody.access_token;
        }

        log.debug(TransId + ' | ' + stLogTitle + ' | tokenResponse', tokenResponse);
        return tokenResponse;
    }

    function getTokenCache(config) {

        var extraParams = vc2_util.extractValues({
            source: config,
            params: ['id', 'subsidiary', 'entry_function', 'partner_id']
        });
        var cacheKey = 'SCANSOURCE_TOKEN-' + vc2_util.convertToQuery(extraParams),
            token = vc2_util.getNSCache({ key: cacheKey });

        vc2_util.log(LogTitle, '// cacheKey: ', [extraParams, cacheKey]);
        if (vc2_util.isEmpty(token)) token = getToken(config);

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: cacheKey,
                cacheTTL: 14400,
                value: token
            });
        }
        return token;
    }

    function formatJson(responseBody) {
        if (!responseBody) {
            return;
        }

        var arrData = [];

        if (Array.isArray(responseBody)) {
            for (var i = 0; i < responseBody.length; i++) {
                var objInvoice = responseBody[i];
                var objData = {};

                objData.po = objInvoice.PONumber;
                objData.date = objInvoice.ShipDate; //not scansource
                objData.invoice = objInvoice.InvoiceNumber;
                objData.total = vc2_util.parseFloat(objInvoice.Total);
                objData.charges = {
                    tax: vc2_util.parseFloat(objInvoice.TaxAmount),
                    shipping: vc2_util.parseFloat(objInvoice.FreightAmount),
                    other: vc2_util.parseFloat(objInvoice.InsuranceAmount)
                };

                objData.lines = [];
                var arrInvoiceLines = objInvoice.InvoiceLines;

                for (var n = 0; n < arrInvoiceLines.length; n++) {
                    objData.lines.push({
                        ITEMNO: arrInvoiceLines[n].ItemNumber,
                        PRICE: vc2_util.parseFloat(arrInvoiceLines[n].Price),
                        QUANTITY: vc2_util.parseFloat(arrInvoiceLines[n].Ordered),
                        DESCRIPTION: arrInvoiceLines[n].ItemDescription,
                        SERIAL: arrInvoiceLines[n].SerialNumbers
                    });
                } //end invoice line

                arrData.push({
                    ordObj: objData
                });
            } //end invoice
        } //end is array

        return arrData;
    }

    return EntryPoint;
});
