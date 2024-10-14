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

    var LogTitle = 'WS:ScanSource';

    EntryPoint.getInvoice = function (input, config) {
        TransId = input;
        var responseBody = getInvoiceList(config);
        var arrData = formatJson(responseBody);
        return arrData;
    };

    function getInvoiceList(config) {
        var stLogTitle = 'scansource_api:getInvoiceList';

        var respInvoiceList = vc2_util.sendRequest({
            header: [LogTitle, 'Invoice List'].join(' '),
            method: 'get',
            recordId: TransId,
            query: {
                url:
                    config.url +
                    ('/list?customerNumber=' + config.partner_id + '&poNumber=' + config.poNum),
                headers: {
            'Ocp-Apim-Subscription-Key': config.subscription_key,
            Authorization: getTokenCache(config),
            'Content-Type': 'application/json'
                }
            }
        });

        return respInvoiceList.PARSED_RESPONSE;
    }

    function getToken(config) {
        var stLogTitle = 'scansource_api:getToken';
        var objBody = {};
        log.debug(TransId + ' | ' + stLogTitle + ' | objBody', objBody);

        var respToken = vc2_util.sendRequest({
            header: [LogTitle, 'Generate Token'].join(' '),
            method: 'get',
            recordId: TransId,
            doRetry: true,
            maxRetry: 3,
            query: {
                url: config.token_url,
                headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Ocp-Apim-Subscription-Key': config.subscription_key
                },
                body: {
            client_id: config.user_id,
            client_secret: config.user_pass,
            grant_type: 'client_credentials',
            scope: config.scope
                }
            }
        });

        vc2_util.handleJSONResponse(respToken);
        var responseBody = respToken.PARSED_RESPONSE;
        return 'Bearer ' + responseBody.access_token;
    }

    function getTokenCache(config) {
        var extraParams = vc2_util.extractValues({
            source: config,
            params: ['id', 'subsidiary', 'host_key', 'partner_id', 'user_id', 'user_pass']
        });
        var cacheKey = 'SCANSOURCE_TOKEN-' + vc2_util.convertToQuery(extraParams),
            token = vc2_util.getNSCache({ key: cacheKey });

        vc2_util.log(LogTitle, '// cacheKey: ', [extraParams, cacheKey]);
        if (vc2_util.isEmpty(token)) token = getToken(config);

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: cacheKey,
                cacheTTL: 3500,
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
