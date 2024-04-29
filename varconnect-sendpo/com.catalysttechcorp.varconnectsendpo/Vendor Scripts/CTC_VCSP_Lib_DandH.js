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
 */

define([
    'N/format',
    'N/error',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_Lib_Utils'
], function (NS_Format, NS_Error, VCSP_Global, CTC_Util) {
    const LogTitle = 'WS:DandH';
    let errorMessages = {
        STATUS_401:
            'Authorization information is invalid. Please check Send PO Vendor configuration.',
        STATUS_404: 'URL not found. Please check Send PO Vendor configuration.'
    };

    let Helper = {
        formatFromISODateString: function (option) {
            let logTitle = [LogTitle, 'Helper', 'formatFromISODateString'].join('::'),
                dateStrToParse = option,
                formattedDate = null;
            if (dateStrToParse) {
                try {
                    let parsedDate = CTC_Util.parseISODateString(dateStrToParse);
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
        let tokenResp = tokenReq.PARSED_RESPONSE,
            errorMessage = null;
        if (tokenReq.isError) {
            errorMessage = tokenReq.errorMsg;
        }
        if (tokenResp && tokenResp.error_description) {
            errorMessage = tokenResp.error_description;
        }
        if (errorMessage) {
            throw NS_Error.create({
                message: 'Generate Token Error - ' + errorMessage,
                name: 'TOKEN_ERR'
            });
        }
        if (!tokenResp || !tokenResp.access_token) {
            throw NS_Error.create({
                message: 'Unable to generate token',
                name: 'TOKEN_ERR'
            });
        }
        log.audit(logTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));
        return tokenResp;
    }

    function sendPOToDAndH(option) {
        let logTitle = [LogTitle, 'sendPOToDAndH'].join('::'),
            objPO = option.objPO,
            vendorConfig = option.vendorConfig,
            body = option.body,
            dnhTokenRequestQuery = {
                poId: objPO.id,
                apiKey: vendorConfig.apiKey,
                apiSecret: vendorConfig.apiSecret,
                url: vendorConfig.accessEndPoint
            };
        if (vendorConfig.testRequest) {
            dnhTokenRequestQuery.apiKey = vendorConfig.qaApiKey;
            dnhTokenRequestQuery.apiSecret = vendorConfig.qaApiSecret;
            dnhTokenRequestQuery.url = vendorConfig.qaAccessEndPoint;
        }
        let dnhToken = generateToken(dnhTokenRequestQuery);
        let bearerToken = [dnhToken.token_type, dnhToken.access_token].join(' ');
        let dnhTenant = 'dhus';
        switch (vendorConfig.country) {
            case 'US':
                dnhTenant = 'dhus';
                break;
            case 'CA':
                dnhTenant = 'dhca';
                break;
            default:
                dnhTenant = 'dsc';
                break;
        }
        let headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: bearerToken,
            'dandh-tenant': dnhTenant,
            accountNumber: vendorConfig.customerNo
        };
        let stBody = JSON.stringify(body);
        let dnhResponse = CTC_Util.sendRequest({
            header: [LogTitle, 'sendPOToDAndH'].join(' : '),
            method: 'post',
            recordId: objPO.id,
            query: {
                url: vendorConfig.testRequest ? vendorConfig.qaEndPoint : vendorConfig.endPoint,
                headers: headers,
                body: stBody
            }
        });
        log.audit(logTitle, '>> D&H: ' + JSON.stringify(dnhResponse));
        return dnhResponse;
    }

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::'),
            vendorConfig = option.vendorConfig,
            record = option.objPO,
            additionalVendorDetails = {},
            dnhTemplate = '';

        let arrLines = record.items.map(function (item) {
            let objLine = {
                // unitPrice: item.rate,
                item: item.dandhPartNumber || item.item,
                externalLineNumber: item.lineuniquekey,
                orderQuantity: item.quantity
                // clientReferenceData: {}, // any additional data to be stored with the order
            };
            return objLine;
        });

        dnhTemplate = {
            customerPurchaseOrder: record.custPO || record.tranId, // Required
            shipping: {
                // serviceType: objPO.shipMethod, // Enum: [pickup, ground, nextDay, secondDay, nextDaySaturdayDelivery, firstClassMail, priorityMail]
                // carrier: objPO.shipMethod, // Enum: [pickup, ups, fedex, usps, upsm, upss, fxsp, purolator]
                allowPartialShipment: true,
                allowBackOrder: true
            },
            endUserData: {
                // electronicSoftwareDistributionEmail: '',
                // dateOfSale: '',
                address: {
                    // All fields in address are often required if customer has no default address setup with D&H
                    attention: vendorConfig.Bill.attention,
                    country: vendorConfig.Bill.country,
                    city: vendorConfig.Bill.city,
                    street: [vendorConfig.Bill.address1, vendorConfig.Bill.address2].join('\r\n'),
                    postalCode: vendorConfig.Bill.zip,
                    region: vendorConfig.Bill.state
                },
                // serialNumbers: '', // []
                // reseller: {
                //     phone: '',
                //     accountNumber: '',
                //     email: '',
                // },
                // userName: '',
                // masterContractNumber: '',
                // authorizationNumber: '',
                // domain: {
                //     domainName: '',
                //     domainAdministratorEmailAddress: '',
                // },
                // contact: {
                //     phone: '',
                //     fax: '',
                //     email: '',
                // },
                purchaseOrderNumber: record.tranid
                // organization: '',
                // modelNumber: '',
                // department: '',
                // supportPlan: {
                //     supportStartDate: '',
                //     updateType: '',
                //     warrantySKU: '',
                // },
                // cisco: {
                //     ccoId: '',
                // },
            },
            deliveryAddress: {
                address: {
                    // All fields in address are required
                    country: record.shipCountry,
                    city: record.shipCity,
                    street: [record.shipAddr1, record.shipAddr2].join('\r\n'),
                    postalCode: record.shipZip,
                    region: record.shipState
                },
                attention: record.shipAttention,
                deliveryName: record.shipAddressee
            },
            specialInstructions: record.memo,
            // freightBillingAccount: '',
            // flooringAuthorizationNumber: '',
            shipments: [
                {
                    // clientReferenceData: {}, // any additional data to be stored with the order
                    lines: arrLines
                    // branch: '',
                }
            ]
            // clientReferenceData: {}, // any additional data to be stored with the order
        };
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
                let fieldContainer = dnhTemplate;
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
                                    case 'requestUnitPrice':
                                        if (additionalVendorDetails[fieldId][j] == 'T') {
                                            lineObj.unitPrice = record.items[j].rate;
                                        }
                                        break;
                                    default:
                                        lineObj[fieldIdComponent] =
                                            additionalVendorDetails[fieldId][j];
                                        break;
                                }
                            }
                        } else {
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
        let dtTranDate = NS_Format.parse({
            value: record.tranDate,
            type: NS_Format.Type.DATE
        });
        log.debug(logTitle, 'dtTranDate=' + dtTranDate);
        if (dtTranDate) {
            let tranDateISOStr = dtTranDate.toISOString();
            dnhTemplate.endUserData.dateOfSale = tranDateISOStr;
            log.debug(logTitle, 'tranDateISOStr=' + tranDateISOStr);
        }
        if (dnhTemplate.customerOrganizationId) {
            dnhTemplate.enrollDevices = true;
        }
        return dnhTemplate;
    }

    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            record = option.record,
            returnValue = option.returnResponse,
            responseBody = option.responseBody || returnValue.responseBody,
            orderStatus = {},
            lineUniqueKeys = [];
        if (responseBody) {
            orderStatus.ponumber = responseBody.orderNumber;
            orderStatus.errorMessage = null;
            orderStatus.errorDetail = null;
            orderStatus.items = [];
            orderStatus.successLines = [];
            orderStatus.errorLines = [];
            orderStatus.lineNotes = [];
            if (responseBody) {
                for (let i = 0, itemCount = record.items.length; i < itemCount; i += 1) {
                    lineUniqueKeys.push(record.items[i].lineuniquekey);
                }
                let shippingDetails = responseBody.shipping || {};
                let endUserDataDetails = responseBody.endUserData || {};
                if (responseBody.shipments && responseBody.shipments.length) {
                    for (
                        let orderCtr = 0, orderCount = responseBody.shipments.length;
                        orderCtr < orderCount;
                        orderCtr += 1
                    ) {
                        let shipmentDetails = responseBody.shipments[orderCtr],
                            itemJsonData = JSON.parse(JSON.stringify(responseBody));
                        if (shipmentDetails.lines && shipmentDetails.lines.length) {
                            // valid lines
                            for (
                                let line = 0, lineCount = shipmentDetails.lines.length;
                                line < lineCount;
                                line += 1
                            ) {
                                log.audit(
                                    logTitle,
                                    'shipment line=' + JSON.stringify(shipmentDetails.lines)
                                );
                                let lineDetails = shipmentDetails.lines[line];
                                delete itemJsonData.shipments;
                                itemJsonData.shipments = JSON.parse(
                                    JSON.stringify(shipmentDetails)
                                );
                                delete itemJsonData.shipments.lines;
                                itemJsonData.shipments.line = lineDetails;
                                let itemJsonDataStr = JSON.stringify(itemJsonData).replace(
                                    /,/g,
                                    ',<br>'
                                );
                                if (itemJsonDataStr == '{}') itemJsonDataStr = 'NA';
                                let itemDetails = {
                                    line_unique_key: lineDetails.externalLineNumber,
                                    line_number:
                                        lineUniqueKeys.indexOf(lineDetails.externalLineNumber) + 1,
                                    vendor_line: 'NA',
                                    order_status: 'accepted',
                                    order_type: 'NA',
                                    vendor_order_number: responseBody.orderNumber || 'NA',
                                    customer_order_number:
                                        responseBody.customerPurchaseOrder || 'NA',
                                    order_date:
                                        Helper.formatFromISODateString(
                                            endUserDataDetails.dateOfSale
                                        ) || 'NA',
                                    vendor_sku: lineDetails.item || 'NA',
                                    item_number: 'NA',
                                    note: responseBody.specialInstructions,
                                    quantity: lineDetails.orderQuantity || 'NA',
                                    rate: lineDetails.unitPrice || 'NA',
                                    ship_date: 'NA',
                                    ship_qty: 'NA',
                                    ship_from: shipmentDetails.branch || 'NA',
                                    ship_method: shippingDetails.serviceType || 'NA',
                                    carrier: shippingDetails.carrier || 'NA',
                                    eta_date: 'NA',
                                    serial_num: 'NA',
                                    tracking_num: 'NA',
                                    internal_reference_num: 'NA',
                                    json_data: itemJsonDataStr
                                };
                                if (
                                    endUserDataDetails.serialNumbers &&
                                    endUserDataDetails.serialNumbers.length
                                ) {
                                    itemDetails.serial_num =
                                        endUserDataDetails.serialNumbers.join('\n');
                                }
                                if (lineDetails.clientReferenceData) {
                                    itemDetails.internal_reference_num = JSON.stringify(
                                        lineDetails.clientReferenceData
                                    );
                                }
                                orderStatus.items.push(itemDetails);
                                orderStatus.successLines.push(itemDetails);
                            }
                        }
                    }
                    log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
                    returnValue.transactionNum = orderStatus.ponumber;
                }
            }
            if (option.returnResponse.responseCode >= 300) {
                switch (option.returnResponse.responseCode) {
                    case 401:
                        returnValue.message += 'Send PO failed. ' + errorMessages.STATUS_401;
                        break;
                    case 404:
                        returnValue.message += 'Send PO failed. ' + errorMessages.STATUS_404;
                        break;
                    default:
                        returnValue.message = 'Send PO failed';
                        break;
                }
            } else {
                returnValue.message = 'Send PO successful';
                if (orderStatus.successLines.length && orderStatus.errorLines.length) {
                    returnValue.message =
                        'Send PO partially successful with ' +
                        orderStatus.successLines.length +
                        ' line item(s) and ' +
                        orderStatus.errorLines.length +
                        ' failed line(s)';
                    if (orderStatus.lineNotes.length)
                        returnValue.message += ':\n' + orderStatus.lineNotes.join('\n');
                } else if (orderStatus.errorLines.length) {
                    returnValue.message = 'Send PO failed.\n' + orderStatus.lineNotes.join('\n');
                } else {
                    returnValue.message =
                        'Send PO successful with ' +
                        orderStatus.successLines.length +
                        ' line item(s).';
                }
                returnValue.orderStatus = orderStatus;
            }
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            vendorConfig = option.recVendorConfig,
            customerNo = vendorConfig.customerNo,
            record = option.record || option.recPO;
        log.audit(logTitle, '>> record : ' + JSON.stringify(record));
        let returnResponse = {
            transactionNum: record.tranId,
            transactionId: record.id
        };
        let dnhResponse;
        try {
            let sendPOBody = generateBody({
                objPO: record,
                customerNo: customerNo,
                vendorConfig: vendorConfig
            });
            dnhResponse = sendPOToDAndH({
                objPO: record,
                vendorConfig: vendorConfig,
                body: sendPOBody
            });

            returnResponse = {
                transactionNum: record.tranId,
                transactionId: record.id,
                logId: dnhResponse.logId,
                responseBody: dnhResponse.PARSED_RESPONSE || dnhResponse.RESPONSE.body,
                responseCode: dnhResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: record.id,
                errorName: null,
                errorMsg: null
            };

            if (returnResponse.responseBody && returnResponse.responseBody.errorName) {
                returnResponse.isError = true;
                let sendError = returnResponse.responseBody || {};
                returnResponse.error = sendError;
                returnResponse.errorId = sendError.debugId;
                returnResponse.errorName = sendError.errorName;
                returnResponse.errorMsg = sendError.message;
            } else {
                returnResponse = processResponse({
                    record: record,
                    responseBody: returnResponse.responseBody,
                    returnResponse: returnResponse
                });
            }

            log.debug(logTitle, '>> RESPONSE ERROR: ' + returnResponse.isError);
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
            if (dnhResponse) {
                returnResponse.logId = dnhResponse.logId || null;
                returnResponse.responseBody = dnhResponse.PARSED_RESPONSE;
                if (dnhResponse.RESPONSE) {
                    if (!returnResponse.responseBody) {
                        returnResponse.responseBody = dnhResponse.RESPONSE.body || null;
                    }
                    returnResponse.responseCode = dnhResponse.RESPONSE.code || null;
                }
            }
        }

        return returnResponse;
    }

    return {
        process: process
    };
});
