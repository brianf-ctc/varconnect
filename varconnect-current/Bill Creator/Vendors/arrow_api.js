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

define([
    'N/https',
    'N/search',
    '../../CTC_VC2_Lib_Utils',
    '../Libraries/moment',
    '../Libraries/lodash'
], function (ns_https, ns_search, vc2_util, moment, lodash) {
    'use strict';
    var LogTitle = 'WS:ArrowAPI',
        LogPrefix,
        CURRENT = {};

    function processXml(input, config) {
        //var config = JSON.parse(configStr)

        //log.debug('arrow config', config.user_id);

        var tranNsid = input;

        log.debug('ar: input', tranNsid);

        var docNum = config.poNum;
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
                myObj.charges.other =
                    xmlObj.TotalPSTAmount * 1 +
                    xmlObj.TotalHSTAmount * 1 +
                    xmlObj.TotalGSTAmount * 1;

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

    var LibArrowAPI = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: option.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: option.config.url + '/api/oauth/token',
                        body: vc2_util.convertToQuery({
                            client_id: option.config.user_id,
                            client_secret: option.config.user_pass,
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            Accept: '*/*'
                        }
                    }
                });

                // vc2_util.handleJSONResponse(tokenReq);
                var tokenResp = tokenReq.PARSED_RESPONSE;
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getTokenCache: function (option) {
            var token = vc2_util.getNSCache({ key: 'VC_ARROW_TOKEN' });
            if (vc2_util.isEmpty(token)) token = this.generateToken(option);

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: 'VC_ARROW_TOKEN',
                    cacheTTL: 14400,
                    value: token
                });
                CURRENT.accessToken = token;
            }
            return token;
        },
        getInvoiceDetails: function (option) {
            var logTitle = [LogTitle, 'getInvoiceDetails'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqInvoice = vc2_util.sendRequest({
                    header: [LogTitle, 'Invoice Details'].join(' '),
                    recordId: option.recordId,
                    method: 'post',
                    query: {
                        url: option.config.url + '/ArrowECS/Invoice_RS/Status',
                        body: JSON.stringify({
                            Header: {
                                TransactionType: 'RESELLER_INV_SEARCH',
                                Region: 'NORTH_AMERICAS',
                                Country: 'US',
                                PartnerID: option.config.partner_id
                            },
                            InvoiceRequest: {
                                CUSTPONUMBERS: {
                                    CustPONumbers: [
                                        {
                                            PONumber: option.config.poNum
                                        }
                                    ]
                                }
                            }
                        })
                    },
                    headers: {
                        Authorization: 'Bearer ' + option.accessToken,
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                vc2_util.handleJSONResponse(reqInvoice);
                LibArrowAPI.validateResponse(reqInvoice.PARSED_RESPONSE);

                returnValue = reqInvoice.PARSED_RESPONSE;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        validateResponse: function (parsedResponse) {
            if (!parsedResponse) throw 'Unable to read the response';
            var respHeader = parsedResponse.ResponseHeader;

            if (!respHeader || !util.isArray(respHeader)) throw 'Missing or Invalid ResponseHeader';
            var hasErrors,
                errorMsgs = [];

            respHeader.forEach(function (header) {
                if (!header.TransactionStatus || header.TransactionStatus == 'ERROR') {
                    hasErrors = true;
                    errorMsgs.push(header.TransactionMessage);
                }
                return true;
            });

            if (hasErrors && errorMsgs.length) throw errorMsgs.join(', ');
            return true;
        }
    };

    // // Add the return statement that identifies the entry point function.
    // return {
    //     processXml: processXml
    // };
    return {
        processXml: function (recordId, config) {
            var logTitle = [LogTitle, 'processXml'].join('::'),
                returnValue;

            LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';
            vc2_util.LogPrefix = LogPrefix;
            vc2_util.log(logTitle, '>> current: ', [recordId, config]);

            var accessToken = LibArrowAPI.getTokenCache({
                recordId: recordId,
                config: config,
                tranId: config.poNum
            });
            vc2_util.log(logTitle, '>> access token: ', token);
            if (!accessToken) throw 'Unable to generate access token';

            var parsedResponse = LibArrowAPI.getInvoiceDetails({
                recordId: recordId,
                config: config,
                poNum: config.poNum,
                accessToken: accessToken
            });
            if (!parsedResponse) throw 'Empty response';

            var arrEntries = [];

            for (var i = 0, j = parsedResponse.InvoiceResponse.length; i < j; i++) {
                var invoiceResp = parsedResponse.InvoiceResponse[i];

                for (var ii = 0, jj = invoiceResp.InvoiceDetails.length; ii < jj; ii++) {
                    var invDetail = invoiceResp.InvoiceDetails[ii];

                    vc2_util.log(logTitle, '>> Invoice Detail: ', invDetail);

                    var invoiceObj = {
                        po: config.poNum,
                        date: invDetail.InvoiceDate
                            ? moment(invDetail.InvoiceDate, 'DD-MMM-YY').format('MM/DD/YYYY')
                            : 'NA',

                        invoice: invDetail.InvoiceNumber || 'NA',
                        total: (invDetail.TotalInvAmount || 0) * 1,
                        charges: {
                            tax: (invDetail.TotalTaxAmount || 0) * 1,
                            shipping: (invDetail.TotalFrieghtAmt || 0) * 1,
                            other:
                                (invDetail.TotalPSTAmount || 0) * 1 +
                                (invDetail.TotalHSTAmount || 0) * 1 +
                                (invDetail.TotalGSTAmount || 0) * 1
                        },
                        lines: []
                    };
                    vc2_util.log(logTitle, '.. bill data: ', invoiceObj);

                    var arrLineDetails =
                        invDetail.LineDetails && invDetail.LineDetails.DetailRecord
                            ? invDetail.LineDetails.DetailRecord
                            : [];

                    for (var iii = 0, jjj = arrLineDetails.length; iii < jjj; iii++) {
                        var lineDetail = arrLineDetails[iii];

                        var lineObj = {
                            processed: false,
                            ITEMNO: lineDetail.CustPartNumber,
                            PRICE: (lineDetail.UnitPrice || 0) * 1,
                            QUANTITY: (lineDetail.QuantityShipped || 0) * 1,
                            DESCRIPTION: lineDetail.PartDescription
                        };

                        if (vc2_util.isEmpty(lineObj.ITEMNO)) continue;

                        // check if this already exists
                        var foundIndex = lodash.findIndex(invoiceObj.lines, {
                            ITEMNO: lineObj.ITEMNO,
                            PRICE: lineObj.PRICE
                        });

                        if (foundIndex > 0) {
                            invoiceObj.lines[foundIndex].QUANTITY += lineObj.QUANTITY;
                        } else {
                            invoiceObj.lines.push(lineObj);
                        }
                    }

                    arrEntries.push({
                        ordObj: invoiceObj,
                        xmlStr: invDetail
                    });
                }
            }

            return arrEntries;
        }
    };
});
