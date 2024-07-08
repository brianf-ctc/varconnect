/**
 * @copyright 2024 Catalyst Tech Corp
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
 *
 **/

/*jshint esversion: 9 */
define((require) => {
    const VCSP_Global = require('../Library/CTC_VCSP_Constants');
    const CTC_Util = require('../Library/CTC_Lib_Utils');
    const ns_url = require('N/url');
    const ns_error = require('N/error');
    const ns_search = require('N/search');

    const EntryPoint = {};
    const Helper = {};
    let LogTitle = 'WS:Carahsoft';

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
                record: poObj,
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
        let record = option.transaction,
            itemLength = record.getLineCount('item');

        let objSalesRep = getSalesRep(record);

        let objBody = {};
        objBody.Details = {
            PurchaseOrderNumber: record.getValue('tranid'),
            Date: record.getValue('trandate'),
            OrderType: record.getValue('custbody_ctc_po_link_type'),
            OrderAmount: record.getValue('total'),
            SalesRep: objSalesRep.name,
            SalesRepEmail: objSalesRep.email,
            Quote_ID: getQuoteWithValue(option.purchaseOrder.items),
            EndUserPoNumber: record.getValue('tranid'),
            Notes: record.getValue('memo')
        };

        //get shipping address
        let shipSubRec = record.getSubrecord({ fieldId: 'shippingaddress' });
        let objShippingAddress = {
            ContactName: record.getText('entity'),
            CompanyName: shipSubRec.getValue('attention'),
            AddressLine1: shipSubRec.getValue('addr1'),
            AddressLine2: shipSubRec.getValue('addr2'),
            City: shipSubRec.getValue('city'),
            State: shipSubRec.getValue('state'),
            Zip: shipSubRec.getValue('zip'),
            Country: shipSubRec.getValue('country'),
            Phone: shipSubRec.getValue('addrphone'),
            Type: 'ShipTo',
            Email: shipSubRec.getValue('custrecord_ctc_vc_addr_email')
        };

        //get billing address
        let billSubRec = record.getSubrecord({ fieldId: 'billingaddress' });
        let objBillingAddress = {
            ContactName: record.getText('entity'),
            CompanyName: billSubRec.getValue('attention'),
            AddressLine1: billSubRec.getValue('addr1'),
            AddressLine2: billSubRec.getValue('addr2'),
            City: billSubRec.getValue('city'),
            State: billSubRec.getValue('state'),
            Zip: billSubRec.getValue('zip'),
            Country: billSubRec.getValue('country'),
            Phone: billSubRec.getValue('addrphone'),
            Type: 'BillTo',
            Email: billSubRec.getValue('custrecord_ctc_vc_addr_email')
        };

        objBody.Addresses = [objShippingAddress, objBillingAddress];

        objBody.Lines = (() => {
            let arrLines = [];
            for (let i = 0; i < itemLength; i++) {
                let objSublist = { sublistId: 'item', line: i };

                let lineNum = record.getSublistValue({ fieldId: 'line', ...objSublist });
                lineNum = CTC_Util.forceInt(lineNum) + 1;

                let itemName = record.getSublistText({ fieldId: 'item', ...objSublist });
                let itemDesc = record.getSublistValue({ fieldId: 'description', ...objSublist });

                arrLines.push({
                    LineNumber: lineNum,
                    ManufacturerPartNumber: itemName,
                    Quantity: record.getSublistValue({ fieldId: 'quantity', ...objSublist }),
                    UnitPrice: record.getSublistValue({ fieldId: 'rate', ...objSublist }),
                    ProductDesc: itemDesc || itemName,
                    TotalPrice: record.getSublistValue({ fieldId: 'amount', ...objSublist })
                });
            }
            return arrLines;
        })();

        log.debug('body', objBody);

        return objBody;
    };

    const postData = (objBody, option) => {
        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let objHeaders = {
            Authorization: getToken(option),
            'Content-Type': 'application/json',
            'X-Account': vendorConfig.customerNo
        };

        //get url
        let stUrl = ns_url.format({
            domain: vendorConfig.endPoint + '/odata/v1/PurchaseOrder/Validate'
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
                /*
				get error message inside response body for Carahsoft only.
				Sample response with error
					{
					    "error": {
					        "code": "400",
					        "message": "Quote has expired",
					        "target": "PO Number: B311605"
					    }
					}
				*/
                returnValue.errorMsg = responseBody.error.message || JSON.stringify(responseBody);
            }
            if (responseBody) {
                if (responseBody.OrderReceived === false) {
                    returnValue.isError = true;
                    returnValue.message = 'Send PO failed.';
                    returnValue.errorMsg =
                        responseBody.message || 'Carahsoft failed to receive the order.';
                }
                if (responseBody.Errors && responseBody.Errors.length) {
                    let collectedErrorMessages = [];
                    for (
                        let errCtr = 0, errCount = responseBody.Errors.length;
                        errCtr < errCount;
                        errCtr += 1
                    ) {
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

    const getSalesRep = (record) => {
        let soId = record.getValue('createdfrom');
        let objSalesRep = {};
        if (!CTC_Util.isEmpty(soId)) {
            let objLookUpSo = ns_search.lookupFields({
                type: ns_search.Type.SALES_ORDER,
                id: soId,
                columns: ['salesrep', 'salesrep.email']
            });
            if (!CTC_Util.isEmpty(objLookUpSo)) {
                let arrSalesRep = objLookUpSo.salesrep;
                if (
                    Array.isArray(arrSalesRep) &&
                    typeof arrSalesRep[0] !== 'undefined' &&
                    typeof arrSalesRep[0] === 'object'
                ) {
                    objSalesRep.name = arrSalesRep[0].text;
                }
                objSalesRep.email = objLookUpSo['salesrep.email'];
            }
        }
        return objSalesRep;
    };

    const getToken = (option) => {
        let poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig;

        let logTitle = [LogTitle, 'getToken'].join('::');
        let tokenReq = CTC_Util.sendRequest({
            header: [LogTitle, 'getToken'].join(' : '),
            method: 'post',
            recordId: poObj.id,
            query: {
                body: {
                    grant_type: 'client_credentials',
                    client_id: vendorConfig.apiKey,
                    client_secret: vendorConfig.apiSecret,
                    audience: vendorConfig.endPoint
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                url: vendorConfig.accessEndPoint
            }
        });
        Helper.throwIfErrorResponse(tokenReq);

        let tokenResp = CTC_Util.safeParse(tokenReq.RESPONSE);
        log.audit(LogTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        if (!tokenResp || !tokenResp.access_token) {
            throw 'Unable to generate token';
        }

        let bearerToken = [tokenResp.token_type, tokenResp.access_token].join(' ');
        return bearerToken;
    };

    const getQuoteWithValue = (arrItems) => {
        let stReturn = '';
        if (Array.isArray(arrItems)) {
            let objItem = arrItems.find((objData) => objData.quotenumber != '');
            if (!CTC_Util.isEmpty(objItem)) {
                stReturn = objItem.quotenumber;
            }
        }
        if (CTC_Util.isEmpty(stReturn)) {
            log.error(
                'getQuoteWithValue',
                `Quote number is empty. Items: ${JSON.stringify(arrItems)}`
            );
        }
        return stReturn;
    };

    Helper.throwIfErrorResponse = (tokenResponse) => {
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
    };

    return EntryPoint;
});
