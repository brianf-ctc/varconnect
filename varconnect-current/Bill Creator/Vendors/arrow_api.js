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

define(['../../CTC_VC2_Lib_Utils', '../Libraries/moment', '../Libraries/lodash'], function (vc2_util, moment, lodash) {
    var LogTitle = 'WS:ArrowAPI',
        LogPrefix,
        CURRENT = {};

    var LibArrowAPI = {
        ValidShippedStatus: ['SHIPPED'],
        SkippedStatus: ['CANCELLED'],
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.config.token_url,
                        body: vc2_util.convertToQuery({
                            client_id: CURRENT.config.user_id,
                            client_secret: CURRENT.config.user_pass,
                            scope: ['api://', CURRENT.config.user_id, '/.default'].join(''),
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });

                vc2_util.handleJSONResponse(tokenReq);
                var tokenResp = tokenReq.PARSED_RESPONSE;
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        getTokenCache: function () {
            var token = vc2_util.getNSCache({ key: 'VC_ARROW_TOKEN' });
            if (vc2_util.isEmpty(token)) token = this.generateToken();

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
        getInvoice: function (option) {
            var logTitle = [LogTitle, 'getInvoice'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqInvoice = vc2_util.sendRequest({
                    header: [LogTitle, 'Invoice Status'].join(' '),
                    recordId: CURRENT.recordId,
                    method: 'post',
                    query: {
                        url: CURRENT.config.url,
                        body: JSON.stringify({
                            Header: {
                                TransactionType: 'RESELLER_INV_SEARCH',
                                Region: 'NORTH_AMERICAS',
                                Country: 'US',
                                PartnerID: CURRENT.config.partner_id,
                                SourceTransactionKeyID: null,
                                RequestTimestamp: null
                            },
                            InvoiceRequest: {
                                CUSTPONUMBERS: {
                                    CustPONumbers: [
                                        {
                                            PONumber: CURRENT.poNum
                                        }
                                    ]
                                }
                            }
                        }),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'Ocp-Apim-Subscription-Key': CURRENT.config.host_key
                        }
                    }
                });

                if (reqInvoice.isError) throw reqInvoice.errorMsg;

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

            if (!respHeader || vc2_util.isEmpty(respHeader)) throw 'Missing or Invalid ResponseHeader';
            var hasErrors,
                errorMsgs = [];

            if (
                !respHeader.TransactionStatus ||
                respHeader.TransactionStatus == 'ERROR' ||
                !respHeader.hasOwnProperty('TotalPages')
            ) {
                hasErrors = true;
                errorMsgs.push(respHeader.TransactionMessage);
            }

            if (hasErrors) throw errorMsgs.join(', ');
            return true;
        }
    };

    // Add the return statement that identifies the entry point function.
    return {
        processXml: function (recordId, config, poNum) {
            var logTitle = [LogTitle, 'processXml'].join('::'),
                returnValue = [];

            try {
                CURRENT.config = config;
                CURRENT.poNum = config.poNum || poNum;
                CURRENT.recordId = recordId;

                vc2_util.log(logTitle, '// CURRENT: ', CURRENT);

                // get the tokens first
                LibArrowAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                var response = LibArrowAPI.getInvoice();
                vc2_util.log(logTitle, '// invoice response: ', response);

                var respHeader = response.ResponseHeader,
                    invoiceList = response.InvoiceResponse;

                if (vc2_util.isEmpty(invoiceList) || !util.isArray(invoiceList) || !invoiceList.length)
                    throw 'Empty Invoice List';

                var myArr = [];

                for (var i = 0; i < invoiceList.length; i++) {
                    for (var ii = 0; ii < invoiceList[i].InvoiceDetails.length; ii++) {
                        var invoiceDetail = invoiceList[i].InvoiceDetails[ii];

                        var myObj = {
                            po: CURRENT.poNum,
                            date: moment(invoiceDetail.InvoiceDate, 'DD-MMM-YY').format('MM/DD/YYYY'),
                            invoice: invoiceDetail.InvoiceNumber,
                            total: invoiceDetail.TotalInvAmount * 1,
                            charges: {
                                tax: invoiceDetail.TotalTaxAmount * 1,
                                shipping: invoiceDetail.TotalFrieghtAmt * 1,
                                other:
                                    invoiceDetail.TotalPSTAmount * 1 +
                                    invoiceDetail.TotalHSTAmount * 1 +
                                    invoiceDetail.TotalGSTAmount * 1
                            },
                            lines: []
                        };

                        myObj.lines = [];

                        for (var iii = 0; iii < invoiceDetail.LineDetails.DetailRecord.length; iii++) {
                            //xmlObj.LineDetails.DetailRecord[i]
                            var itemDetail = invoiceDetail.LineDetails.DetailRecord[iii],
                                itemPartNum = itemDetail.CustPartNumber;

                            var lineObj = {
                                processed: false,
                                ITEMNO: itemDetail.CustPartNumber,
                                PRICE: itemDetail.UnitPrice * 1,
                                QUANTITY: itemDetail.QuantityShipped * 1,
                                DESCRIPTION: itemDetail.PartDescription
                            };
                            if (vc2_util.isEmpty(lineObj.ITEMNO)) continue;

                            var itemIdx = lodash.findIndex(myObj.lines, {
                                ITEMNO: itemPartNum,
                                PRICE: lineObj.PRICE
                            });

                            if (itemIdx !== -1) {
                                myObj.lines[itemIdx].QUANTITY += lineObj.QUANTITY;
                            } else {
                                myObj.lines.push(lineObj);
                            }
                        }

                        myArr.push({
                            ordObj: myObj,
                            xmlStr: invoiceDetail
                        });
                    }
                }

                returnValue = myArr;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    };
});
