/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
 */

define(['N/format', '../Library/CTC_Lib_Utils'], function (NS_Format, CTC_Util) {
    const LogTitle = 'WS:Ingram';

    let Helper = {
        // YYYY-MM-DD
        formatFromIngramDate: function (dateStr) {
            let formattedDate = null;
            if (dateStr) {
                try {
                    let dateComponents = dateStr.split(/\D+/),
                        parsedDate = new Date(
                            dateComponents[0],
                            dateComponents[1],
                            dateComponents[2]
                        );
                    if (parsedDate) {
                        formattedDate = NS_Format.format({
                            value: parsedDate,
                            type: NS_Format.Type.DATETIME
                        });
                    }
                } catch (formatErr) {
                    // do nothing
                }
            }
            return formattedDate;
        }
    };

    function generateToken(option) {
        let logTitle = [LogTitle, 'generateToken'].join('::');

        let tokenReq = CTC_Util.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' : '),
            method: 'post',
            recordId: option.poId,
            query: {
                body: {
                    grant_type: 'client_credentials',
                    client_id: option.apiKey,
                    client_secret: option.apiSecret
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                url: option.url
            }
        });

        if (tokenReq.isError) {
            // try to parse anything
            let errorMessage = tokenReq.errorMsg;
            if (tokenReq.PARSED_RESPONSE && tokenReq.PARSED_RESPONSE.error_description) {
                errorMessage = tokenReq.PARSED_RESPONSE.error_description;
            }
            throw 'Generate Token Error - ' + errorMessage;
        }

        let tokenResp = CTC_Util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        log.audit(logTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        return tokenResp;
    }

    function sendPOToIngram(option) {
        let logTitle = [LogTitle, 'sendPOToIngram'].join('::'),
            objPO = option.objPO,
            vendorConfig = option.vendorConfig,
            body = option.body;
        let ingramTokenRequestQuery = {
            poId: objPO.id,
            apiKey: vendorConfig.apiKey,
            apiSecret: vendorConfig.apiSecret,
            url: vendorConfig.accessEndPoint
        };
        if (vendorConfig.testRequest) {
            ingramTokenRequestQuery.apiKey = vendorConfig.qaApiKey;
            ingramTokenRequestQuery.apiSecret = vendorConfig.qaApiSecret;
            ingramTokenRequestQuery.url = vendorConfig.qaAccessEndPoint;
        }
        let ingramToken = generateToken(ingramTokenRequestQuery);
        let bearerToken = [ingramToken.token_type, ingramToken.access_token].join(' ');
        let headers = {
            Accept: 'application/json',
            'IM-CustomerNumber': vendorConfig.customerNo,
            'IM-CountryCode': vendorConfig.country,
            'IM-SenderID': 'NS_CATALYST',
            'IM-CorrelationID': objPO.tranId,
            'Content-Type': 'application/json',
            Authorization: bearerToken
        };

        let stBody = JSON.stringify(body);
        let imResponse = CTC_Util.sendRequest({
            header: [LogTitle, 'sendPOToIngram'].join(' : '),
            method: 'post',
            recordId: objPO.id,
            query: {
                url: vendorConfig.testRequest ? vendorConfig.qaEndPoint : vendorConfig.endPoint,
                headers: headers,
                body: stBody
            }
        });

        log.audit(logTitle, '>> Ingram: ' + JSON.stringify(imResponse));

        return imResponse;
    }

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::'),
            vendorConfig = option.vendorConfig,
            record = option.objPO,
            additionalVendorDetails = {},
            ingramTemplate = '';

        let arrLines = record.items.map(function (item) {
            let objLine = {};
            objLine.customerLineNumber = item.lineuniquekey;
            objLine.quantity = item.quantity;
            objLine.endUserPrice = item.rate;
            // objLine.specialBidNumber = 'NA';
            // objLine.notes = 'NA';
            // objLine.unitPrice = 'NA';
            // objLine.additionalAttributes = [{}]; // SAP field
            // objLine.warrantyInfo = [];
            // objLine.endUserInfo = [{}]; // SAP field
            if (item.ingramPartNumber) {
                objLine.ingramPartNumber = item.ingramPartNumber;
            } else if (vendorConfig.isSpecialItemName) {
                objLine.ingramPartNumber = item.item;
            } else {
                objLine.vendorPartNumber = item.item;
            }
            log.debug(logTitle, item);
            return objLine;
        });

        ingramTemplate = {
            customerOrderNumber: record.tranId,
            endCustomerOrderNumber: record.custPO || record.tranId,
            // specialBidNumber: 'NA',
            notes: record.memo,
            acceptBackOrder: true,
            resellerInfo: {
                resellerId: vendorConfig.customerNo,
                contact: record.billAttention,
                companyName: record.billAddressee,
                addressLine1: record.billAddr1,
                addressLine2: record.billAddr2,
                city: record.billCity,
                state: record.billState,
                postalCode: record.billZip,
                countryCode: record.billCountry,
                phoneNumber: record.billPhone,
                email: record.billEmail
            },
            // vmf: {
            //     vendAuthNumber: 'NA',
            // },
            shipToInfo: {
                // addressId: 'NA',
                contact: record.shipContact,
                companyName: record.shipAddressee || record.shipAttention,
                name1: record.shipAddrName1,
                name2: record.shipAddrName2,
                addressLine1: record.shipAddr1,
                addressLine2: record.shipAddr2,
                city: record.shipCity,
                state: record.shipState,
                postalCode: record.shipZip,
                countryCode: record.shipCountry,
                phoneNumber: record.shipPhone,
                email: record.shipEmail
            },
            // endUserInfo: {
            //     endUserId: 'NA',
            //     contact: 'NA',
            //     companyName: 'NA',
            //     name1: 'NA',
            //     name2: 'NA',
            //     addressLine1: 'NA',
            //     addressLine2: 'NA',
            //     city: 'NA',
            //     state: 'NA',
            //     postalCode: 'NA',
            //     countryCode: 'NA',
            //     phoneNumber: 'NA',
            //     email: 'NA'
            // },
            lines: arrLines,
            shipmentDetails: {
                // carrierCode: 'NA',
                // freightAccountNumber: 'NA',
                shipComplete: record.shipComplete
                // requestedDeliveryDate: 'NA',
                // signatureRequired: 'NA',
                // shippingInstructions: 'NA',
            },
            additionalAttributes: [
                {
                    attributeName: 'allowDuplicateCustomerOrderNumber',
                    attributeValue: true
                },
                {
                    attributeName: 'allowPartialOrder',
                    attributeValue: false // setting to true allows ingram to create 0-line orders
                }
            ]
        };
        if (vendorConfig.Bill.id) {
            ingramTemplate.billToAddressId = vendorConfig.Bill.id;
        }
        if (record.additionalVendorDetails) {
            additionalVendorDetails = CTC_Util.safeParse(record.additionalVendorDetails);
        } else if (vendorConfig.additionalPOFields) {
            additionalVendorDetails = CTC_Util.getVendorAdditionalPOFieldDefaultValues({
                fields: CTC_Util.safeParse(vendorConfig.additionalPOFields)
            });
        }
        if (additionalVendorDetails) {
            for (let fieldId in additionalVendorDetails) {
                let fieldHierarchy = fieldId.split('.');
                let fieldContainer = ingramTemplate;
                for (
                    let i = 0, len = fieldHierarchy.length, fieldIdIndex = len - 1;
                    i < len;
                    i += 1
                ) {
                    let fieldIdComponent = fieldHierarchy[i];
                    if (i == fieldIdIndex) {
                        // container is an array, distribute values across container elements
                        if (
                            fieldIdComponent.indexOf('__') == 0 &&
                            util.isArray(additionalVendorDetails[fieldId]) &&
                            util.isArray(fieldContainer)
                        ) {
                            fieldIdComponent = fieldIdComponent.slice(2);
                            for (let j = 0, lines = fieldContainer.length; j < lines; j += 1) {
                                let lineObj = fieldContainer[j];
                                switch (fieldIdComponent) {
                                    default:
                                        if (
                                            !CTC_Util.isEmpty(additionalVendorDetails[fieldId][j])
                                        ) {
                                            lineObj[fieldIdComponent] =
                                                additionalVendorDetails[fieldId][j];
                                        }
                                        break;
                                }
                            }
                        } else if (!CTC_Util.isEmpty(additionalVendorDetails[fieldId])) {
                            fieldContainer[fieldIdComponent] = additionalVendorDetails[fieldId];
                        }
                    } else {
                        // container is an array, reference as is
                        if (fieldIdComponent.indexOf('__') == 0) {
                            fieldIdComponent = fieldIdComponent.slice(2);
                            if (
                                fieldContainer[fieldIdComponent] &&
                                util.isArray(fieldContainer[fieldIdComponent])
                            ) {
                                fieldContainer = fieldContainer[fieldIdComponent];
                            } else {
                                fieldContainer[fieldIdComponent] = [];
                                fieldContainer = fieldContainer[fieldIdComponent];
                            }
                            // container is an array, reference first element
                        } else if (fieldIdComponent.indexOf('_') == 0) {
                            fieldIdComponent = fieldIdComponent.slice(1);
                            if (
                                fieldContainer[fieldIdComponent] &&
                                util.isArray(fieldContainer[fieldIdComponent])
                            ) {
                                fieldContainer = fieldContainer[fieldIdComponent][0];
                            } else {
                                fieldContainer[fieldIdComponent] = [{}];
                                fieldContainer = fieldContainer[fieldIdComponent][0];
                            }
                        } else if (!fieldContainer[fieldIdComponent]) {
                            fieldContainer[fieldIdComponent] = {};
                            fieldContainer = fieldContainer[fieldIdComponent];
                        } else {
                            fieldContainer = fieldContainer[fieldIdComponent];
                        }
                    }
                }
                log.audit(logTitle, 'Order Request: ' + JSON.stringify(fieldContainer));
            }
        }
        let cleanUpJSON = function (options) {
            let objConstructor = options.objConstructor || {}.constructor,
                obj = options.obj;
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
        cleanUpJSON({ obj: ingramTemplate });
        log.debug(logTitle, '>> Ingram Template Object: ' + JSON.stringify(ingramTemplate));
        CTC_Util.vcLog({
            title: [LogTitle, 'Order Request Values'].join(' - '),
            content: ingramTemplate,
            transaction: record.id
        });

        return ingramTemplate;
    }

    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = option.returnResponse,
            responseBody = option.responseBody || returnValue.responseBody,
            orderStatus = {};
        if (responseBody) {
            orderStatus.ponumber = responseBody.ingramOrderNumber;
            orderStatus.errorMessage = null;
            orderStatus.errorDetail = null;
            orderStatus.items = [];
            orderStatus.numSuccessfulLines = 0;
            orderStatus.numFailedLines = 0;
            let lineNotes = [];
            if (responseBody.orders && responseBody.orders.length) {
                for (
                    let orderCtr = 0, orderCount = responseBody.orders.length;
                    orderCtr < orderCount;
                    orderCtr += 1
                ) {
                    let orderDetails = responseBody.orders[orderCtr],
                        orderDate = Helper.formatFromIngramDate(orderDetails.ingramOrderDate);
                    if (orderDetails.notes) {
                        orderStatus.notes = orderDetails.notes;
                    }
                    if (orderDetails.lines && orderDetails.lines.length) {
                        // valid lines
                        for (
                            let line = 0, lineCount = orderDetails.lines.length;
                            line < lineCount;
                            line += 1
                        ) {
                            let lineDetails = orderDetails.lines[line],
                                shipmentDetails = {};
                            if (lineDetails) {
                                shipmentDetails = lineDetails.shipmentDetails;
                            }
                            let itemDetails = {
                                line_number: lineDetails.ingramLineNumber || 'NA',
                                order_number: lineDetails.subOrderNumber || 'NA',
                                order_date: orderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                ship_method: shipmentDetails.carrierCode || 'NA',
                                ship_from: shipmentDetails.shipFromLocation || 'NA',
                                carrier: shipmentDetails.carrierName || 'NA',
                                order_status: lineDetails.lineStatus,
                                note: lineDetails.notes
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.numSuccessfulLines += 1;
                        }
                    }
                    if (orderDetails.rejectedLineItems && orderDetails.rejectedLineItems.length) {
                        // rejected lines
                        for (
                            let line = 0, lineCount = orderDetails.rejectedLineItems.length;
                            line < lineCount;
                            line += 1
                        ) {
                            let lineDetails = orderDetails.rejectedLineItems[line];
                            let itemDetails = {
                                order_number: orderDetails.ingramOrderNumber || 'NA',
                                order_date: orderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                order_status: 'Rejected',
                                note: [lineDetails.rejectCode, lineDetails.rejectReason].join(': ')
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.numFailedLines += 1;
                            lineNotes.push(itemDetails.note);
                        }
                    }
                }
                log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
                returnValue.transactionNum = orderStatus.ponumber;
            }
            returnValue.message = 'Send PO successful';
            if (responseBody.errors && responseBody.errors.length) {
                let errMessage = [];
                for (
                    let errCtr = 0, errCount = responseBody.errors.length;
                    errCtr < errCount;
                    errCtr += 1
                ) {
                    let errorResponse = responseBody.errors[errCtr];
                    if (errorResponse && errorResponse.message) {
                        errMessage.push(errorResponse.message);
                    }
                }
                returnValue.isError = true;
                returnValue.message = 'Send PO failed.';
                returnValue.errorMsg = errMessage.join('; ');
            } else if (orderStatus.numFailedLines) {
                returnValue.message =
                    'Send PO successful with ' +
                    orderStatus.numSuccessfulLines +
                    ' line item(s) and ' +
                    orderStatus.numFailedLines +
                    ' failed line(s):<br />' +
                    lineNotes.join('<br />');
            } else {
                returnValue.message =
                    'Send PO successful with ' + orderStatus.numSuccessfulLines + ' line item(s).';
            }
            returnValue.orderStatus = orderStatus;
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            vendorConfig = option.recVendorConfig,
            customerNo = vendorConfig.customerNo,
            record = option.record || option.recPO;
        log.audit(logTitle, '>> record : ' + JSON.stringify(record));
        let sendPOResponse,
            returnResponse = {
                transactionNum: record.tranId,
                transactionId: record.id
            };
        try {
            let sendPOBody = generateBody({
                objPO: record,
                customerNo: customerNo,
                vendorConfig: vendorConfig
            });

            sendPOResponse = sendPOToIngram({
                objPO: record,
                vendorConfig: vendorConfig,
                body: sendPOBody
            });

            returnResponse = {
                transactionNum: record.tranId,
                transactionId: record.id,
                logId: sendPOResponse.logId,
                responseBody: sendPOResponse.PARSED_RESPONSE || sendPOResponse.RESPONSE.body,
                responseCode: sendPOResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: record.id,
                errorName: null,
                errorMsg: null
            };

            returnResponse = processResponse({
                record: record,
                responseBody: returnResponse.responseBody,
                returnResponse: returnResponse
            });
        } catch (e) {
            log.error(logTitle, 'FATAL ERROR:: ' + e.name + ': ' + e.message);
            returnResponse = returnResponse || {
                transactionNum: record.tranId,
                transactionId: record.id,
                isError: true,
                error: e,
                errorId: record.id,
                errorName: e.name,
                errorMsg: e.message
            };
            returnResponse.isError = true;
            returnResponse.error = e;
            returnResponse.errorId = record.id;
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
