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
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @description Library File for Arrow PO Creation
 */

/**
 * Project Number:
 * Script Name: CTC VCSP Lib Arrow
 * Author: john.ramonel
 */
define(['N/format', '../Library/CTC_VCSP_Constants', '../Library/CTC_Lib_Utils'], function (
    NS_Format,
    VCSP_Global,
    CTC_Util
) {
    'use strict';

    const LogTitle = 'WS:Arrow';
    let CURRENT = {};

    let LibArrowAPI = {
        generateToken: function (option) {
            let logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            let Config = CURRENT.Config,
                url = Config.accessEndPoint,
                apiKey = Config.apiKey,
                apiSecret = Config.apiSecret;
            if (Config.testRequest) {
                url = Config.qaAccessEndPoint;
                apiKey = Config.qaApiKey;
                apiSecret = Config.qaApiSecret;
            }

            let tokenReq = CTC_Util.sendRequest({
                header: [LogTitle, 'Generate Token'].join(' '),
                method: 'post',
                recordId: CURRENT.recordId,
                doRetry: true,
                maxRetry: 3,
                query: {
                    url: url,
                    body: CTC_Util.convertToQuery({
                        client_id: apiKey,
                        client_secret: apiSecret,
                        scope: ['api://', apiKey, '/.default'].join(''),
                        grant_type: 'client_credentials'
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            });

            CTC_Util.handleJSONResponse(tokenReq);
            let tokenResp = tokenReq.PARSED_RESPONSE;
            if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

            returnValue = tokenResp.access_token;
            CURRENT.accessToken = tokenResp.access_token;

            return returnValue;
        },
        sendOrder: function (option) {
            let logTitle = [LogTitle, 'sendOrder'].join('::');
            option = option || {};

            let sendPOResponse = CTC_Util.sendRequest({
                header: [LogTitle, 'Send Order'].join(' '),
                method: 'post',
                recordId: CURRENT.recordId,
                query: {
                    url: CURRENT.Config.testRequest
                        ? CURRENT.Config.qaEndPoint
                        : CURRENT.Config.endPoint,
                    body: JSON.stringify(CURRENT.payloadObj),
                    headers: {
                        Authorization: 'Bearer ' + CURRENT.accessToken,
                        Accept: 'application/json',
                        'Ocp-Apim-Subscription-Key': CURRENT.Config.testRequest
                            ? CURRENT.Config.qaSubscriptionKey
                            : CURRENT.Config.subscriptionKey,
                        'Content-Type': 'application/json'
                    }
                }
            });
            log.audit(logTitle, '>> Arrow: ' + JSON.stringify(sendPOResponse));
            return sendPOResponse;
        },
        validateResponse: function (parsedResponse) {
            if (!parsedResponse) throw 'Unable to read the response';
            let hasErrors, errorMsgs;

            if (!parsedResponse.TransactionStatus || parsedResponse.TransactionStatus == 'ERROR') {
                hasErrors = true;
                errorMsgs = parsedResponse.TransactionMessage;
            }

            if (hasErrors && errorMsgs) throw errorMsgs;
            return true;
        }
    };

    var Helper = {
        generateAddress: function (poObj, mapping) {
            var returnValue = {};

            for (var fld in mapping) {
                returnValue[mapping[fld]] = poObj[fld] || null;
            }

            return returnValue;
        },
        formatToArrowDate: function (dateToFormat) {
            let logTitle = [LogTitle, 'formatToArrowDate'].join('::'),
                formattedDate = '';
            if (dateToFormat && dateToFormat instanceof Date) {
                // yyyymmdd
                formattedDate = [
                    Helper.padDigits(dateToFormat.getFullYear(), 2),
                    Helper.padDigits(dateToFormat.getMonth() + 1, 2),
                    Helper.padDigits(dateToFormat.getDate(), 2)
                ].join('');
            }
            return formattedDate;
        },

        padDigits: function (number, digits) {
            return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
        },

        formatArrowPOType: function (strPoType) {
            let logTitle = [LogTitle, 'formatArrowPOType'].join('::');
            let option = {};
            if (strPoType == 'Drop Shipment') {
                option.poType = 'DS';
                option.fobCode = 'ORIGIN';
            } else {
                option.poType = 'SA';
                option.fobCode = 'DESTINATION';
            }

            return option;
        }
    };

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object}
     * @description option.poObj = contains the Actual PO option from NetSuite, option.vendorConfig = VAR Connect Vendor Config Fields
     * @returns object
     **/

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::');

        let poObj = option.purchaseOrder;

        var requestBody = {
            PurchaseOrder: {
                HeaderRec: {
                    TransactionType: 'RESELLER_PO_CREATE',
                    SourceTransactionKeyID: null,
                    RequestTimestamp: null, // '3/22/2023 8:18:49 PM',
                    Region: 'NORTH_AMERICAS',
                    Country: 'US', // TODO: get data from subsidiary
                    PartnerID: CURRENT.Config.customerNo
                    // PartnerName: null, // 'PartnerName7',
                    // OrgID: 'OrgID8',
                    // BatchID: 'BatchID9',
                    // FlowID: 'FlowID10',
                    // SourceSystem: 'System Name',
                    // AFS: 'EBS'
                },
                poDetails: [
                    {
                        CustPoNumber: poObj.tranId,
                        ArrowQuote: {
                            ArrowQuoteNumber: (function () {
                                var returnValue;
                                if (!CURRENT.Config.quoteColumn) return false;
                                if (CURRENT.Config.quoteColumn.match(/^custbody/gi)) {
                                    // get the header content
                                    returnValue = CURRENT.Record.getValue({
                                        fieldId: CURRENT.Config.quoteColumn
                                    });
                                } else if (CURRENT.Config.quoteColumn.match(/^custcol/gi)) {
                                    // get the value from the first line
                                    returnValue = CURRENT.Record.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: CURRENT.Config.quoteColumn,
                                        line: 0
                                    });
                                }
                                return returnValue;
                            })()
                            // ArrowQuoteVersion: 'ArrowQuoteVersion15',
                            // ArrowQuoteLineNum: 'ArrowQuoteLineNum16'
                        },
                        CustPoType: 'DS',
                        PoDate: Helper.formatToArrowDate(
                            NS_Format.parse({
                                value: poObj.tranDate,
                                type: NS_Format.Type.DATE
                            })
                        ),
                        Comments: (CURRENT.Config.testRequest ? 'TEST:' : '') + (poObj.memo || ''),
                        TotalPOPrice: poObj.total,
                        PoCurrency: 'USD',
                        FobCode: 'ORIGIN',
                        ShipViaCode: 'ZZ',
                        ShipViaDescription: 'ELECTRONIC DISTRIBUTION',

                        SoldTo: Helper.generateAddress(poObj, {
                            billAddressee: 'SoldToName',
                            billAddr1: 'SoldToAddrLine1',
                            billAddr2: 'SoldToAddrLine2',
                            billCity: 'SoldToCity',
                            billState: 'SoldToState',
                            billZip: 'SoldToZip',
                            billCountry: 'SoldToCountry',
                            billContact: 'SoldToContactName',
                            billPhone: 'SoldToContactPhone',
                            billEmail: 'SoldToContactEmail'
                        }),
                        BillTo: Helper.generateAddress(poObj, {
                            billAddressee: 'BillToName',
                            billAddr1: 'BillToAddrLine1',
                            billAddr2: 'BillToAddrLine2',
                            billCity: 'BillToCity',
                            billState: 'BillToState',
                            billZip: 'BillToZip',
                            billCountry: 'BillToCountry',
                            billContact: 'BillToContactName',
                            billPhone: 'BillToContactPhone',
                            billEmail: 'BillToContactEmail'
                        }),
                        ShipTo: Helper.generateAddress(poObj, {
                            shipAddressee: 'ShipToName',
                            shipAddr1: 'ShipToAddrLine1',
                            shipAddr2: 'ShipToAddrLine2',
                            shipCity: 'ShipToCity',
                            shipState: 'ShipToState',
                            shipZip: 'ShipToZip',
                            shipCountry: 'ShipToCountry',
                            shipAddressee: 'ShipToContactName',
                            shipPhone: 'ShipToContactPhone',
                            shipEmail: 'ShipToContactEmail'
                        }),
                        EndUser: Helper.generateAddress(poObj, {
                            shipAddressee: 'EndUserName',
                            shipAddr1: 'EndUserAddrLine1',
                            shipAddr2: 'EndUserAddrLine2',
                            shipCity: 'EndUserCity',
                            shipState: 'EndUserState',
                            shipZip: 'EndUserZip',
                            shipCountry: 'EndUserCountry',
                            shipAddressee: 'EndUserContactName',
                            shipPhone: 'EndUserContactPhone',
                            shipEmail: 'EndUserContactEmail'
                        }),

                        poLines: (function () {
                            var poLines = [];
                            for (let i = 0, j = poObj.items.length; i < j; i++) {
                                var lineData = poObj.items[i];

                                log.audit(logTitle, '// line data: ' + JSON.stringify(lineData));

                                poLines.push({
                                    CustPoLineItemNbr: i + 1,
                                    VendorPartNum: lineData.item || null,
                                    PartDescription: lineData.description || null,
                                    QtyRequested: lineData.quantity || null,
                                    UnitPrice: lineData.rate || 0,
                                    TotalPoLinePrice: lineData.amount || 0,
                                    MfgName: lineData.manufacturer || null,
                                    UnitOfMeasure: 'EA',
                                    EndUserPoNumber: poObj.tranId
                                });
                            }

                            return poLines;
                        })()
                    }
                ]
            }
        };

        log.debug(logTitle, '>> Arrow Template Object: ' + JSON.stringify(requestBody));
        CTC_Util.vcLog({
            title: [LogTitle, 'Order Request Values'].join(' - '),
            content: requestBody,
            transaction: poObj.id
        });

        return requestBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} option
     * @returns object
     **/
    function processRequest(option) {
        let logTitle = [LogTitle, 'processRequest'].join('::');

        LibArrowAPI.generateToken();
        if (!CURRENT.accessToken) throw 'Unable to generate access token';

        let sendPOResponse = LibArrowAPI.sendOrder(option);

        if (sendPOResponse.isError) throw sendPOResponse.errorMsg;
        CTC_Util.handleJSONResponse(sendPOResponse);
        LibArrowAPI.validateResponse(sendPOResponse.PARSED_RESPONSE);

        return sendPOResponse;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} option
     * @returns object
     **/
    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = option.returnResponse,
            responseBody = option.responseBody || returnValue.responseBody;
        if (responseBody) {
            returnValue.message = 'Send PO successful';
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let sendPOResponse,
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id
            };

        try {
            CURRENT.recordId = poObj.id;
            CURRENT.Config = vendorConfig;
            CURRENT.Record = option.transaction;

            let requestBody = generateBody({
                purchaseOrder: poObj,
                vendorConfig: vendorConfig
            });
            CURRENT.payloadObj = requestBody;

            sendPOResponse = processRequest({
                payload: requestBody,
                vendorConfig: vendorConfig,
                purchaseOrder: poObj
            });

            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id,
                logId: sendPOResponse.logId,
                responseBody: sendPOResponse.PARSED_RESPONSE || sendPOResponse.RESPONSE.body,
                responseCode: sendPOResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: poObj.id,
                errorName: null,
                errorMsg: null
            };

            returnResponse = processResponse({
                purchaseOrder: poObj,
                responseBody: returnResponse.responseBody,
                returnResponse: returnResponse
            });
        } catch (e) {
            log.error(logTitle, 'FATAL ERROR:: ' + e.name + ': ' + e.message);
            returnResponse = returnResponse || {};
            returnResponse.isError = true;
            returnResponse.error = e;
            returnResponse.errorId = poObj.id;
            returnResponse.errorName = e.name;
            returnResponse.errorMsg = e.message;
            if (sendPOResponse) {
                returnResponse.logId = sendPOResponse.logId || null;
                returnResponse.responseBody = sendPOResponse.PARSED_RESPONSE;
                if (sendPOResponse.RESPONSE) {
                    if (!returnResponse.responseBody) {
                        returnResponse.responseBody = sendPOResponse.RESPONSE.body || null;
                    }
                    returnResponse.responseCode = sendPOResponse.RESPONSE.code || null;
                }
            }
        } finally {
            log.audit(logTitle, '>> sendPoResp: ' + JSON.stringify(returnResponse));
        }
        return returnResponse;
    }

    return {
        process: process
    };
});
