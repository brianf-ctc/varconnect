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

            let config = CURRENT.config,
                url = config.accessEndPoint,
                apiKey = config.apiKey,
                apiSecret = config.apiSecret;
            if (config.testRequest) {
                url = config.qaAccessEndPoint;
                apiKey = config.qaApiKey;
                apiSecret = config.qaApiSecret;
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
                    url: CURRENT.config.testRequest
                        ? CURRENT.config.qaEndPoint
                        : CURRENT.config.endPoint,
                    body: JSON.stringify(CURRENT.payloadObj),
                    headers: {
                        Authorization: 'Bearer ' + CURRENT.accessToken,
                        Accept: 'application/json',
                        'Ocp-Apim-Subscription-Key': CURRENT.config.testRequest
                            ? CURRENT.config.qaSubscriptionKey
                            : CURRENT.config.subscriptionKey,
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

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object}
     * @description option.poObj = contains the Actual PO option from NetSuite, option.vendorConfig = VAR Connect Vendor Config Fields
     * @returns object
     **/
    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::');

        let reqBody = {};
        let poDetails = {};
        let soldTo = {};
        let billTo = {};
        let shipTo = {};
        let endUser = {};
        let poLines = []; // array of poLine objects
        let poObj = option.purchaseOrder;
        let vendorConfig = option.vendorConfig;

        // Header Rec Object
        let headerRec = {};
        headerRec.TransactionType = 'RESELLER_PO_CREATE'; // constant
        headerRec.SourceTransactionKeyID = null;
        headerRec.RequestTimestamp = null;
        headerRec.Region = 'NORTH_AMERICAS'; // constant
        headerRec.Country = 'US'; // constant
        headerRec.PartnerID = vendorConfig.customerNo;

        // PO Details Object
        // let poTypeObj = formatArrowPOType(poObj.getValue({fieldId: 'custbody_ctc_po_link_type'}));
        poDetails.CustPoNumber = poObj.tranId;
        poDetails.TotalPOPrice = poObj.total;
        poDetails.Comments = poObj.memo || null;
        poDetails.PoDate = formatToArrowDate(
            NS_Format.parse({
                value: poObj.tranDate,
                type: NS_Format.Type.DATE
            })
        );
        poDetails.CustPoType = 'DS'; // Constant -- values are DS for Dropship, SA for standard
        poDetails.FobCode = 'ORIGIN'; // constant -- values are ORIGIN for Dropship, DESTINATION for standard
        poDetails.ShipViaCode = 'ZZ'; // constant for arrow
        poDetails.ShipViaDescription = 'ELECTRONIC DISTRIBUTION'; // constant for arrow
        poDetails.PoCurrency = 'USD'; // constant -- for Arrow US
        poDetails.ArrowQuote = {};
        poDetails.ArrowQuote.ArrowQuoteNumber = poObj.items[0].quotenumber
            ? poObj.items[0].quotenumber.toString()
            : null;

        // soldTo Object
        soldTo.SoldToName = poObj.billAddressee || null;
        soldTo.SoldToAddrLine1 = poObj.billAddr1 || null;
        soldTo.SoldToAddrLine2 = poObj.billAddr2 || null;
        soldTo.SoldToCity = poObj.billCity || null;
        soldTo.SoldToState = poObj.billState || null;
        soldTo.SoldToZip = poObj.billZip || null;
        soldTo.SoldToCountry = poObj.billCountry || 'US';
        soldTo.SoldToContactName = poObj.billContact || null;
        soldTo.SoldToContactPhone = poObj.billPhone || null;
        soldTo.SoldToContactEmail = poObj.billEmail || null;

        // billTo Object
        billTo.BillToName = poObj.billAddressee || null;
        billTo.BillToAddrLine1 = poObj.billAddr1 || null;
        billTo.BillToAddrLine2 = poObj.billAddr2 || null;
        billTo.BillToCity = poObj.billCity || null;
        billTo.BillToState = poObj.billState || null;
        billTo.BillToZip = poObj.billZip || null;
        billTo.BillToCountry = poObj.billCountry || 'US';
        billTo.BillToContactName = poObj.billContact || null;
        billTo.BillToContactPhone = poObj.billPhone || null;
        billTo.BillToContactEmail = poObj.billEmail || null;

        // shipTo Object
        shipTo.ShipToName = poObj.shipAddressee || null;
        shipTo.ShipToAddrLine1 = poObj.shipAddr1 || null;
        shipTo.ShipToAddrLine2 = poObj.shipAddr2 || null;
        shipTo.ShipToCity = poObj.shipCity || null;
        shipTo.ShipToState = poObj.shipState || null;
        shipTo.ShipToZip = poObj.shipZip || null;
        shipTo.ShipToCountry = poObj.shipCountry || 'US';
        shipTo.ShipToContactName = poObj.shipAddressee || null;
        shipTo.ShipToContactPhone = poObj.shipPhone || null;
        shipTo.ShipToContactEmail = poObj.shipEmail || null;

        // endUser Object
        endUser.EndUserName = poObj.shipAddressee || null;
        endUser.EndUserAddrLine1 = poObj.shipAddr1 || null;
        endUser.EndUserAddrLine2 = poObj.shipAddr2 || null;
        endUser.EndUserCity = poObj.shipCity || null;
        endUser.EndUserState = poObj.shipState || null;
        endUser.EndUserZip = poObj.shipZip || null;
        endUser.EndUserCountry = poObj.shipCountry || 'US';
        endUser.EndUserContactName = poObj.shipAddressee || null;
        endUser.EndUserContactPhone = poObj.shipPhone || null;
        endUser.EndUserContactEmail = poObj.shipEmail || null;

        // poLines Object
        let lineCount = poObj.items.length;
        if (lineCount) {
            for (let i = 0; i < lineCount; i++) {
                let poLine = {};
                poLine.CustPoLineItemNbr = i + 1;
                poLine.VendorPartNum = poObj.items[i].item;
                poLine.PartDescription = poObj.items[i].description || null;
                poLine.QtyRequested = poObj.items[i].quantity || null;
                poLine.UnitPrice = poObj.items[i].rate || 0;
                poLine.TotalPoLinePrice = poObj.items[i].amount || 0;
                poLine.MfgName = poObj.items[i].manufacturer || null;
                poLine.UnitOfMeasure = 'EA';
                poLine.EndUserPoNumber = poObj.tranId;
                poLines.push(poLine);
            }
        }

        // formation of Actual Req Data to be sent to Arrow
        let purchaseOrder = {};
        purchaseOrder.HeaderRec = headerRec;
        purchaseOrder.poDetails = poDetails;
        purchaseOrder.poDetails.SoldTo = soldTo;
        purchaseOrder.poDetails.BillTo = billTo;
        purchaseOrder.poDetails.ShipTo = shipTo;
        purchaseOrder.poDetails.EndUser = endUser;
        purchaseOrder.poDetails.poLines = poLines;

        reqBody.PurchaseOrder = purchaseOrder;

        let cleanUpJSON = function (option) {
            let objConstructor = option.objConstructor || {}.constructor,
                obj = option.obj;
            for (let key in obj) {
                if (obj[key] === null || obj[key] === '' || obj[key] === undefined) {
                    delete obj[key];
                } else if (obj[key].constructor === objConstructor) {
                    cleanUpJSON({
                        obj: obj[key],
                        objConstructor: objConstructor
                    });
                }
            }
        };
        cleanUpJSON({ obj: reqBody });
        log.debug(logTitle, '>> Arrow Template Object: ' + JSON.stringify(reqBody));
        CTC_Util.vcLog({
            title: [LogTitle, 'Order Request Values'].join(' - '),
            content: reqBody,
            transaction: poObj.id
        });

        return reqBody;
    }

    function formatArrowPOType(strPoType) {
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

    function formatToArrowDate(dateToFormat) {
        let logTitle = [LogTitle, 'formatToArrowDate'].join('::'),
            formattedDate = '';
        if (dateToFormat && dateToFormat instanceof Date) {
            // yyyymmdd
            formattedDate = [
                padDigits(dateToFormat.getFullYear(), 2),
                padDigits(dateToFormat.getMonth() + 1, 2),
                padDigits(dateToFormat.getDate(), 2)
            ].join('');
        }
        return formattedDate;
    }

    function padDigits(number, digits) {
        return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
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
        log.audit(logTitle, '>> record : ' + JSON.stringify(poObj));
        let sendPOResponse,
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id
            };
        try {
            CURRENT.recordId = poObj.id;
            CURRENT.config = vendorConfig;

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
