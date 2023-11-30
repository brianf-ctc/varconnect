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

define(['../Library/CTC_Lib_Utils'], function (CTC_Util) {
    const LogTitle = 'WS:Ingram';

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
        let ingramToken = generateToken({
            poId: objPO.id,
            apiKey: vendorConfig.apiKey,
            apiSecret: vendorConfig.apiSecret,
            url: vendorConfig.accessEndPoint
        });
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
                url: vendorConfig.endPoint,
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
            ingramTemplate = '';

        let arrLines = record.items.map(function (item) {
            let objLine = {
                customerLineNumber: item.lineuniquekey,
                ingramPartNumber: item.ingramSKU || item.item,
                quantity: item.quantity
                // specialBidNumber: 'NA',
                // notes: 'NA',
                // unitPrice: 'NA',
                // additionalAttributes: [{}], // SAP field
                // warrantyInfo: [],
                // endUserInfo: [{}], // SAP field
            };
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
                companyName: record.billAttention,
                contact: record.billAddressee,
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
                contact: record.shipAddressee,
                companyName: record.shipAttention,
                name1: record.shipAttention,
                name2: record.shipAddressee,
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

        log.debug(logTitle, '>> Ingram Template Object: ' + JSON.stringify(ingramTemplate));

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
            orderStatus.successLines = [];
            orderStatus.errorLines = [];
            orderStatus.lineNotes = [];
            if (responseBody.orders && responseBody.orders.length) {
                for (
                    let orderCtr = 0, orderCount = responseBody.orders.length;
                    orderCtr < orderCount;
                    orderCtr += 1
                ) {
                    let orderDetails = responseBody.orders[orderCtr];
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
                                order_date: orderDetails.ingramOrderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                rate: lineDetails.unitPrice || 'NA',
                                ship_qty: 'NA',
                                ship_date: 'NA',
                                ship_method: shipmentDetails.carrierCode || 'NA',
                                ship_from: shipmentDetails.shipFromLocation || 'NA',
                                carrier: shipmentDetails.carrierName || 'NA',
                                eta_date: 'NA',
                                tracking_num: 'NA',
                                serial_num: 'NA',
                                order_status: lineDetails.lineStatus,
                                note: lineDetails.notes
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.successLines.push(itemDetails);
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
                                line_number: 'NA',
                                order_number: orderDetails.ingramOrderNumber || 'NA',
                                order_date: orderDetails.ingramOrderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                ship_qty: 'NA',
                                ship_date: 'NA',
                                ship_method: 'NA',
                                ship_from: 'NA',
                                carrier: 'NA',
                                eta_date: 'NA',
                                tracking_num: 'NA',
                                serial_num: 'NA',
                                order_status: 'Rejected',
                                note: [lineDetails.rejectCode, lineDetails.rejectReason].join(': ')
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.errorLines.push(itemDetails);
                            orderStatus.lineNotes.push(
                                itemDetails.order_status + ': ' + itemDetails.note
                            );
                        }
                    }
                }
                log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
                returnValue.transactionNum = orderStatus.ponumber;
            }
            returnValue.message = 'Send PO successful';
            if (orderStatus.errorLines.length) {
                returnValue.message =
                    'Send PO successful with ' +
                    orderStatus.successLines.length +
                    ' line item(s) and ' +
                    orderStatus.errorLines.length +
                    ' failed line(s):<br />' +
                    orderStatus.lineNotes.join('<br />');
            } else {
                returnValue.message =
                    'Send PO successful with ' + orderStatus.successLines.length + ' line item(s).';
            }
            returnValue.orderStatus = orderStatus;
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            vendorConfig = option.recVendorConfig,
            customerNo = vendorConfig.customerNo,
            objPO = option.record || option.recPO,
            testRequest = vendorConfig.testRequest;
        log.audit(logTitle, '>> record : ' + JSON.stringify(objPO));
        let returnResponse = {
            transactionNum: objPO.tranId,
            transactionId: objPO.id
        };
        try {
            let sendPOBody = generateBody({
                objPO: objPO,
                customerNo: customerNo,
                vendorConfig: vendorConfig,
                testRequest: testRequest
            });

            let imResponse = sendPOToIngram({
                objPO: objPO,
                vendorConfig: vendorConfig,
                body: sendPOBody
            });

            returnResponse = {
                transactionNum: objPO.tranId,
                transactionId: objPO.id,
                logId: imResponse.logId,
                responseBody: imResponse.PARSED_RESPONSE || imResponse.RESPONSE.body,
                responseCode: imResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: objPO.id,
                errorName: null,
                errorMsg: null
            };

            if (returnResponse.responseBody && returnResponse.responseBody.errors) {
                returnResponse.isError = true;
                let sendError = returnResponse.responseBody.errors[0] || {};
                returnResponse.error = sendError;
                returnResponse.errorId = sendError.id || returnResponse.errorId;
                returnResponse.errorName = sendError.type;
                returnResponse.errorMsg =
                    sendError.message || JSON.stringify(returnResponse.responseBody.errors);
            } else {
                returnResponse = processResponse({
                    responseBody: returnResponse.responseBody,
                    returnResponse: returnResponse
                });
            }

            log.debug(logTitle, '>> RESPONSE ERROR: ' + returnResponse.isError);
        } catch (e) {
            log.error(logTitle, 'FATAL ERROR:: ' + e.name + ': ' + e.message);
        }

        return returnResponse;
    }

    return {
        process: process
    };
});
