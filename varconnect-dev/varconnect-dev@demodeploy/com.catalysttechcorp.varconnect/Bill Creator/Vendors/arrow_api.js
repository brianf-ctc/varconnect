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
 */

define(['N/https', 'N/search', '../Libraries/moment', '../Libraries/lodash'], function (
    ns_https,
    ns_search,
    moment,
    lodash
) {
    function processXml(input, config) {
        //var config = JSON.parse(configStr)

        //log.debug('arrow config', config.user_id);

        var tranNsid = input;

        log.debug('ar: input', tranNsid);

        var findDocumentNumber = ns_search.lookupFields({
            type: ns_search.Type.PURCHASE_ORDER,
            id: tranNsid,
            columns: ['tranid']
        });

        var docNum = findDocumentNumber.tranid;

        log.debug('ar: docNum', input + ': ' + docNum);

        var headers = {};

        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Accept'] = '*/*';

        var baseUrl = config.url;

        var authUrl = '/api/oauth/token';

        var authBody = {
            grant_type: 'client_credentials',
            client_id: config.user_id,
            client_secret: config.user_pass
        };

        var authResponse = ns_https.post({
            url: baseUrl + authUrl,
            headers: headers,
            body: authBody
        });

        log.debug('ar: authBody', input + ': ' + JSON.stringify(authBody));

        log.debug('ar: authResponse', input + ': ' + JSON.stringify(authResponse));

        var authJson = JSON.parse(authResponse.body);

        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
        headers['Authorization'] = 'Bearer ' + authJson.access_token;

        var searchUrl = '/ArrowECS/Invoice_RS/Status';

        var searchBody = {
            Header: {
                TransactionType: 'RESELLER_INV_SEARCH',
                Region: 'NORTH_AMERICAS',
                Country: 'US',
                PartnerID: config.partner_id
            },
            InvoiceRequest: {
                CUSTPONUMBERS: {
                    CustPONumbers: [
                        {
                            PONumber: docNum
                        }
                    ]
                }
            }
        };

        var invoiceResponse = ns_https.post({
            url: baseUrl + searchUrl,
            headers: headers,
            body: JSON.stringify(searchBody)
        });

        var invBody = JSON.parse(invoiceResponse.body);

        log.debug('ar: invoiceBody', input + ': ' + invoiceResponse.body);

        var myArr = [];

        if (!invBody.ResponseHeader.hasOwnProperty('TotalPages') || invoiceResponse.code !== 200) {
            log.debug('ar: ' + invoiceResponse.code, input + ': ' + 'No Records Returned');
            return myArr;
        }

        for (var r = 0; r < invBody.InvoiceResponse.length; r++) {
            for (var d = 0; d < invBody.InvoiceResponse[r].InvoiceDetails.length; d++) {
                var xmlObj = invBody.InvoiceResponse[r].InvoiceDetails[d];

                log.debug('ar: invoice reponse', input + ': ' + JSON.stringify(xmlObj));

                var myObj = {};
                myObj.po = docNum;

                myObj.date = moment(xmlObj.InvoiceDate, 'DD-MMM-YY').format('MM/DD/YYYY');
                log.debug('ar: date', myObj.date);
                myObj.invoice = xmlObj.InvoiceNumber;
                myObj.total = xmlObj.TotalInvAmount * 1;

                myObj.charges = {};

                myObj.charges.tax = xmlObj.TotalTaxAmount * 1;
                myObj.charges.shipping = xmlObj.TotalFrieghtAmt * 1;
                myObj.charges.other = xmlObj.TotalPSTAmount * 1 + xmlObj.TotalHSTAmount * 1 + xmlObj.TotalGSTAmount * 1;

                myObj.lines = [];

                for (var i = 0; i < xmlObj.LineDetails.DetailRecord.length; i++) {
                    //xmlObj.LineDetails.DetailRecord[i]
                    var item = xmlObj.LineDetails.DetailRecord[i].CustPartNumber;
                    if (!item || item == '' || item == null) {
                        continue;
                    }

                    var lineObj = {
                        processed: false,
                        ITEMNO: item,
                        PRICE: xmlObj.LineDetails.DetailRecord[i].UnitPrice * 1,
                        QUANTITY: xmlObj.LineDetails.DetailRecord[i].QuantityShipped * 1,
                        DESCRIPTION: xmlObj.LineDetails.DetailRecord[i].PartDescription
                    };

                    var itemIdx = lodash.findIndex(myObj.lines, {
                        ITEMNO: item,
                        PRICE: lineObj.PRICE
                    });

                    if (itemIdx !== -1) {
                        myObj.lines[itemIdx].QUANTITY += lineObj.QUANTITY;
                    } else {
                        myObj.lines.push(lineObj);
                    }
                }

                var returnObj = {};
                returnObj.ordObj = myObj;
                returnObj.xmlStr = xmlObj;

                //return myObj;
                myArr.push(returnObj);
            }
        }

        return myArr;
    }

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
