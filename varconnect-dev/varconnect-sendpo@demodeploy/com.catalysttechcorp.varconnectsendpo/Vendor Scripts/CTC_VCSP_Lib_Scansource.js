/**
 * @copyright 2023 Catalyst Tech Corp
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
 **/

/*jshint esversion: 9 */
define((require) => {
    const VCSP_Global = require('../Library/CTC_VCSP_Constants');
    const CTC_Util = require('../Library/CTC_Lib_Utils');
    const ns_url = require('N/url');
    const ns_error = require('N/error');

    var EntryPoint = {};
    var Helper = {};
    var LogTitle = 'WS:Scansource';

    EntryPoint.process = (option) => {
        let logTitle = [LogTitle, 'process'].join('::');

        //get object from parameter
        let poObj = option.purchaseOrder;

        //set return response
        let sendPOResponse,
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id
            };

        try {
            let objBody = generateBody(option);
            sendPOResponse = postData(objBody, option);
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
            returnResponse = returnResponse || {
                transactionNum: poObj.tranId,
                transactionId: poObj.id,
                isError: true,
                error: e,
                errorId: poObj.id,
                errorName: e.name,
                errorMsg: e.message
            };
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
    };

    const generateBody = (option) => {
        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let objBody = {};
        // objBody.PayerId = 'NA';
        objBody.BusinessUnit = Helper.getBusinessUnit(vendorConfig.businessUnit);
        objBody.ReferenceNumber = poObj.id + '';
        objBody.PONumber = poObj.tranId;
        objBody.EndUserPO = poObj.custPO;
        objBody.ManufacturerDropShip = poObj.isDropShip;
        // objBody.RequestedDeliveryDate = 'NA';
        objBody.EnteredByEmailAddress = poObj.billEmail;
        objBody.Memo = poObj.memo;
        objBody.ShippingInfo = {
            ShipMethodServiceLevelCode: getServiceLevelCode(option),
            ShipComplete: poObj.shipComplete,
            DeliveryPhoneNumber: poObj.shipPhone,
            ShippingAddress: (() => {
                let objShippingAddress = {
                    Name: poObj.shipAddressee || poObj.shipAttention,
                    Attn: poObj.shipAttention,
                    Street1: poObj.shipAddr1,
                    Street2: poObj.shipAddr2,
                    City: poObj.shipCity,
                    State: poObj.shipState,
                    PostalCode: poObj.shipZip,
                    Country: poObj.shipCountry
                };
                return objShippingAddress;
            })()
        };
        // objBody.DealIds = 'NA';
        // objBody.ContractStartDate = 'NA';
        // objBody.ContractEndDate = 'NA';
        // objBody.ExtendedData = 'NA';
        // objBody.VRD = 'NA';
        objBody.Lines = (() => {
            let arrLines = poObj.items.map(function (item) {
                let objLine = {};
                // objLine.POLineNumber = 'NA';
                objLine.ReferenceLineNumber = +item.lineuniquekey;
                objLine.Quantity = item.quantity;
                objLine.PartNumber = item.item;
                objLine.Memo = item.memo;
                return objLine;
            });
            return arrLines;
        })();
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
        cleanUpJSON({ obj: objBody });
        return objBody;
    };

    const postData = (objBody, option) => {
        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let objHeaders = {
            'Ocp-Apim-Subscription-Key': vendorConfig.subscriptionKey,
            Authorization: getToken(option),
            'Content-Type': 'application/json'
        };

        log.debug(`${LogTitle} | postData - objHeaders`, objHeaders);
        log.debug(`${LogTitle} | postData - objBody`, objBody);

        //get url
        let endPoint = vendorConfig.endPoint;
        if (vendorConfig.testRequest) {
            endPoint = vendorConfig.qaEndPoint;
            objHeaders['Ocp-Apim-Subscription-Key'] = vendorConfig.qaSubscriptionKey;
        }
        let stUrl = ns_url.format({
            domain: endPoint + '/createAsync',
            params: {
                customerNumber: vendorConfig.customerNo
            }
        });

        //post request
        let sendPOReq = CTC_Util.sendRequest({
            header: [LogTitle, 'postData'].join(' : '),
            method: 'post',
            recordId: poObj.id,
            query: {
                body: JSON.stringify(objBody),
                headers: objHeaders,
                url: stUrl
            }
        });
        return sendPOReq;
    };

    var bearerToken = null;
    const getToken = (option) => {
        if (!bearerToken) {
            let poObj = option.purchaseOrder,
                vendorConfig = option.vendorConfig;

            let tokenReqQuery = {
                body: {
                    client_id: vendorConfig.apiKey,
                    client_secret: vendorConfig.apiSecret,
                    grant_type: 'client_credentials',
                    scope: vendorConfig.oauthScope
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                url: vendorConfig.accessEndPoint
            };
            if (vendorConfig.testRequest) {
                tokenReqQuery.body.client_id = vendorConfig.qaApiKey;
                tokenReqQuery.body.client_secret = vendorConfig.qaApiSecret;
                tokenReqQuery.body.scope = vendorConfig.qaOauthScope;
                tokenReqQuery.url = vendorConfig.qaAccessEndPoint;
            }
            let tokenResponse = CTC_Util.sendRequest({
                header: [LogTitle, 'getToken'].join(' : '),
                method: 'post',
                recordId: poObj.id,
                query: tokenReqQuery
            });

            if (
                tokenResponse.isError ||
                !tokenResponse.PARSED_RESPONSE ||
                !tokenResponse.PARSED_RESPONSE.access_token ||
                tokenResponse.PARSED_RESPONSE.error ||
                tokenResponse.PARSED_RESPONSE.error_description
            ) {
                // try to parse anything
                let errorName,
                    errorMessage = tokenResponse.errorMsg;
                if (tokenResponse.PARSED_RESPONSE) {
                    if (tokenResponse.PARSED_RESPONSE.error_description) {
                        errorMessage = tokenResponse.PARSED_RESPONSE.error_description;
                    }
                    if (tokenResponse.PARSED_RESPONSE.error) {
                        if (errorMessage) {
                            errorName = tokenResponse.PARSED_RESPONSE.error;
                        } else {
                            errorMessage = tokenResponse.PARSED_RESPONSE.error;
                        }
                    }
                }
                throw ns_error.create({
                    name: errorName || 'TOKEN_ERR',
                    message: errorMessage || 'Unable to generate token'
                });
            }

            log.audit(LogTitle, '>> tokenResp: ' + JSON.stringify(tokenResponse.PARSED_RESPONSE));

            bearerToken = [tokenResponse.PARSED_RESPONSE.token_type, tokenResponse.PARSED_RESPONSE.access_token].join(
                ' '
            );
        }
        return bearerToken;
    };

    const getServiceLevelCode = (option) => {
        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        //set body
        let objBody = {};
        objBody.BusinessUnit = Helper.getBusinessUnit(vendorConfig.businessUnit);
        objBody.ShipToPostalCode = poObj.shipZip;
        objBody.ShipToCountryCode = poObj.shipCountry;
        objBody.Lines = (() => {
            let arrLines = poObj.items.map(function (item) {
                let objLine = {};
                objLine.ItemNumber = item.item;
                objLine.Quantity = item.quantity;
                return objLine;
            });
            return arrLines;
        })();

        //set headers
        let objHeaders = {
            'Ocp-Apim-Subscription-Key': vendorConfig.subscriptionKey,
            Authorization: getToken(option),
            'Content-Type': 'application/json'
        };

        log.debug(`${LogTitle} | getServiceLevelCode - objHeaders`, objHeaders);
        log.debug(`${LogTitle} | getServiceLevelCode - objBody`, objBody);

        //get url
        let endPoint = vendorConfig.endPoint;
        if (vendorConfig.testRequest) {
            endPoint = vendorConfig.qaEndPoint;
            objHeaders['Ocp-Apim-Subscription-Key'] = vendorConfig.qaSubscriptionKey;
        }
        let stUrl = ns_url.format({
            domain: endPoint + '/shipquote',
            params: {
                customerNumber: vendorConfig.customerNo
            }
        });

        //post request
        let objResponse = CTC_Util.sendRequest({
            header: [LogTitle, 'getServiceLevelCode'].join(' : '),
            method: 'post',
            recordId: poObj.id,
            query: {
                body: JSON.stringify(objBody),
                headers: objHeaders,
                url: stUrl
            }
        });

        log.debug(`${LogTitle} | getServiceLevelCode -  objResponse`, objResponse);
        let responseBody = objResponse.PARSED_RESPONSE;
        let serviceCode = '';

        if (responseBody && responseBody.Errors && responseBody.Errors.length) {
            let collectedErrorMessages = [];
            for (let errCtr = 0, errCount = responseBody.Errors.length; errCtr < errCount; errCtr += 1) {
                let errorResponse = responseBody.Errors[errCtr],
                    errorMessage = null,
                    errorCode = null;
                if (errorResponse) {
                    if (errorResponse.ErrorCode) {
                        errorCode = errorResponse.ErrorCode;
                        errorMessage = 'Error code ' + errorCode;
                    }
                    if (errorResponse.ErrorMessage) {
                        errorMessage = errorCode
                            ? '(' + errorCode + ') ' + errorResponse.ErrorMessage
                            : errorResponse.ErrorMessage;
                    }
                }
                if (errorMessage) {
                    collectedErrorMessages.push(errorMessage);
                }
            }
            if (collectedErrorMessages.length) {
                throw ns_error.create({
                    name: 'SERVICE_LEVEL_CODE_RETRIEVAL_ERR',
                    message: 'ShipQuote failed=' + collectedErrorMessages.join('; ')
                });
            }
        } else if (!responseBody || !responseBody.Items) {
            throw ns_error.create({
                name: 'SS_SERVICE_LEVEL_CODE_RETRIEVAL_ERR',
                message: 'Unexpected ShipQuote response.'
            });
        }

        let arrItems = responseBody.Items;
        if (Array.isArray(arrItems) && typeof arrItems[0] !== 'undefined') {
            serviceCode = arrItems[0].ServiceLevelCode;
        }
        if (!serviceCode) {
            throw ns_error.create({
                name: 'SS_SERVICE_LEVEL_CODE_RETRIEVAL_ERR',
                message: 'Unable to parse the ShipQuote response.'
            });
        }
        log.debug(`${LogTitle} | getServiceLevelCode -  serviceCode`, serviceCode);

        return serviceCode;
    };

    const processResponse = (option) => {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = option.returnResponse,
            responseBody = option.responseBody || returnValue.responseBody,
            orderStatus = {};
        if (responseBody) {
            orderStatus.errorMessage = null;
            orderStatus.errorDetail = null;
            orderStatus.items = [];
            orderStatus.successLines = [];
            orderStatus.errorLines = [];
            orderStatus.lineNotes = [];
            returnValue.message = 'Send PO successful';
            if (
                returnValue.isError ||
                !returnValue.responseCode ||
                returnValue.responseCode < 200 ||
                returnValue.responseCode >= 300
            ) {
                returnValue.isError = true;
                returnValue.message = 'Send PO failed.';
                returnValue.errorMsg = responseBody.message;
            }
            if (responseBody) {
                if (responseBody.OrderReceived === false) {
                    returnValue.isError = true;
                    returnValue.message = 'Send PO failed.';
                    returnValue.errorMsg = responseBody.message || 'ScanSource failed to receive the order.';
                }
                if (responseBody.Errors && responseBody.Errors.length) {
                    let collectedErrorMessages = [];
                    for (let errCtr = 0, errCount = responseBody.Errors.length; errCtr < errCount; errCtr += 1) {
                        let errorResponse = responseBody.Errors[errCtr],
                            errorMessage = null,
                            errorCode = null;
                        if (errorResponse) {
                            if (errorResponse.ErrorCode) {
                                errorCode = errorResponse.ErrorCode;
                                errorMessage = 'Error code ' + errorCode;
                            }
                            if (errorResponse.ErrorMessage) {
                                errorMessage = errorCode
                                    ? '(' + errorCode + ') ' + errorResponse.ErrorMessage
                                    : errorResponse.ErrorMessage;
                            }
                        }
                        if (errorMessage) {
                            collectedErrorMessages.push(errorMessage);
                        }
                    }
                    if (collectedErrorMessages.length) {
                        returnValue.isError = true;
                        returnValue.message = 'Send PO failed.';
                        returnValue.errorMsg = collectedErrorMessages.join('; ');
                    }
                }
            }
            returnValue.orderStatus = orderStatus;
        }
        return returnValue;
    };

    Helper.getBusinessUnit = (stBusinessUnit) => {
        let arrText = stBusinessUnit.split(' ');
        let intBusinessUnit = '';
        if (Array.isArray(arrText) && typeof arrText[0] !== 'undefined') {
            intBusinessUnit = CTC_Util.forceInt(arrText[0]);
        }
        return intBusinessUnit;
    };

    return EntryPoint;
});
