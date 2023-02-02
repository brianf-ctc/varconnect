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
    'N/encode',
    'N/search',
    '../Library/CTC_VCSP_Constants.js',
    '../Library/CTC_VCSP_Lib_Log.js',
    '../Library/CTC_Lib_Utils'
], function (ns_encode, ns_search, constants, vcLog, ctc_util) {
    var LogTitle = 'WS:Dell';

    function generateToken(option) {
        var logTitle = [LogTitle, 'generateToken'].join('::');

        var authkey = ns_encode.convert({
            string: option.key + ':' + option.secret,
            inputEncoding: ns_encode.Encoding.UTF_8,
            outputEncoding: ns_encode.Encoding.BASE_64_URL_SAFE
        });
        log.audit(logTitle, '>> auth-key: ' + JSON.stringify(authkey));

        var tokenReq = ctc_util.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' : '),
            method: 'post',
            recordId: option.poId,
            query: {
                url: option.url,
                headers: {
                    authorization: 'Basic ' + authkey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: {
                    grant_type: 'client_credentials'
                }
            }
        });

        if (tokenReq.isError) {
            // try to parse anything
            var errorMessage = tokenReq.errorMsg;
            if (tokenReq.PARSED_RESPONSE && tokenReq.PARSED_RESPONSE.error_description) {
                errorMessage = tokenReq.PARSED_RESPONSE.error_description;
            }
            throw 'Generate Token Error - ' + errorMessage;
        }

        var tokenResp = ctc_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        log.audit(logTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        return tokenResp;
    }

    function generateBody(option) {
        var logTitle = [LogTitle, 'generateBody'].join('::'),
            returnValue = '';

        var record = option.record,
            customerNo = option.customerNo,
            config = option.config,
            itemLength = record.items.length,
            testRequest = option.testRequest;

        var bodyContentJSON = {
            isTestPayload: !!testRequest,
            CorrelationId: '',
            PoNumber: record.tranId,
            EndCustomerPONumber: record.custPO,
            ProfileId: customerNo,
            RequestedDeliveryDate: (function () {
                var deliveryDate = null;
                for (var i = 0; i < itemLength; i++) {
                    if (deliveryDate) break;
                    var expectedReceiptDate = record.items[i].expectedReceiptDate;
                    if (expectedReceiptDate) deliveryDate = expectedReceiptDate;
                }
                return deliveryDate || 'null';
            })(),
            OrderContact: {
                Company: config.Bill.addressee,
                ContactName: config.Bill.attention,
                Email: config.Bill.email,
                Telephone: config.Bill.phoneno,
                Address: {
                    Address1: config.Bill.address1,
                    Address2: record.custPO, //config.Bill.address2,
                    City: config.Bill.city,
                    StateOrProvince: config.Bill.state,
                    PostalCode: config.Bill.zip,
                    Country: config.Bill.country
                }
            },
            ShippingContact: {
                Company: config.Bill.addressee,
                ContactName: config.Bill.attention,
                Email: config.Bill.email,
                Telephone: config.Bill.phoneno,
                Address: {
                    Address1: config.Bill.address1,
                    Address2: record.custPO, //config.Bill.address2,
                    City: config.Bill.city,
                    StateOrProvince: config.Bill.state,
                    PostalCode: config.Bill.zip,
                    Country: config.Bill.country
                }
            },
            BillingContact: {
                Company: config.Bill.addressee,
                ContactName: config.Bill.attention,
                Email: config.Bill.email,
                Telephone: config.Bill.phoneno,
                Address: {
                    Address1: config.Bill.address1,
                    Address2: record.custPO, //config.Bill.address2,config.Bill.address2,
                    City: config.Bill.city,
                    StateOrProvince: config.Bill.state,
                    PostalCode: config.Bill.zip,
                    Country: config.Bill.country
                }
            },
            payment: {
                PaymentMean: config.paymentMean,
                PaymentMeanOther: config.paymentOther,
                PaymentTerm: config.paymentTerm
            },
            orderDetails: (function () {
                var arrItemList = [];

                for (var i = 0, j = itemLength; i < j; i++) {
                    var itemData = record.items[i];

                    var itemDetails = {
                        LineItemNum: (i + 1).toString(),
                        lineItemDescription: 'null',
                        SupplierPartId: itemData.quotenumber,
                        SupplierPartIdExt: itemData.quotenumber,
                        Quantity: itemData.quantity.toString(),
                        UnitPrice: itemData.rate.toString(),
                        Currency: record.currency,
                        FinalRecipient: {
                            Company: config.Bill.addressee,
                            ContactName: config.Bill.attention,
                            Email: config.Bill.email,
                            Telephone: config.Bill.phoneno,
                            Address: {
                                Address1: config.Bill.address1,
                                Address2: record.custPO, //config.Bill.address2,config.Bill.address2,
                                City: config.Bill.city,
                                StateOrProvince: config.Bill.state,
                                PostalCode: config.Bill.zip,
                                Country: config.Bill.country
                            }
                        }
                    };
                    // skip the item if no quote number
                    if (!itemDetails.SupplierPartId) continue;
                    log.audit(logTitle, '>> item Data: ' + JSON.stringify(itemData));
                    log.audit(logTitle, '>> item Details: ' + JSON.stringify(itemDetails));

                    var itemDataIdx = -1;
                    for (var ii = 0, jj = arrItemList.length; ii < jj; ii++) {
                        if (itemDetails.SupplierPartId == arrItemList[ii].SupplierPartId) {
                            itemDataIdx = ii;
                            break;
                        }
                    }

                    log.audit(logTitle, '>> itemDataIdx: ' + itemDataIdx);

                    // if( itemDataIdx >= 0 ) {
                    //     arrItemList[ii].Quantity+=itemDetails.Quantity;
                    // } else {
                    arrItemList.push(itemDetails);
                    // }
                }

                return arrItemList;
            })()
            // CustomFields: (function () {
            //     var arr = [],
            //         shipCode,
            //         dellShipCode = record.dellShippingCode;

            //     if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.TWO_DAY) {
            //         shipCode = '2D';
            //     } else if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.NEXT_DAY) {
            //         shipCode = 'ND';
            //     } else {
            //         shipCode = 'LC';
            //     }
            //     var createdfrom = record.createdFrom;

            //     arr.push({
            //         name: 'EU_PO_NUMBER',
            //         type: 'string',
            //         value: _getEndUserPO({ createdfrom: createdfrom })
            //     });
            //     arr.push({
            //         name: 'SHIPPING_CODE',
            //         type: 'string',
            //         value: shipCode
            //     });
            //     //only for shippingCode = DC, i.e., FEDEX, UPS
            //     arr.push({
            //         name: 'SHIPPING_CARRIER_NAME',
            //         type: 'string',
            //         value: ''
            //     });
            //     //only for shippingCode = dc, carrier acct no
            //     arr.push({
            //         name: 'SHIPPING_CARRIER_ACCT_NU',
            //         type: 'string',
            //         value: ''
            //     });

            //     return arr;
            // })()
        };

        returnValue = bodyContentJSON; //JSON.stringify(bodyContentJSON);
        return returnValue;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');

        var recVendorConfig = option.recVendorConfig,
            key = recVendorConfig.apiKey,
            secret = recVendorConfig.apiSecret,
            url = recVendorConfig.endPoint,
            accessUrl = recVendorConfig.accessEndPoint,
            testRequest = recVendorConfig.testRequest,
            customerNo = recVendorConfig.customerNo,
            record = option.record || option.recPO;

        log.audit(logTitle, '>> record : ' + JSON.stringify(record));

        var returnResponse = {
            transactionNum: record.tranId,
            transactionId: record.id
        };

        try {
            var token = generateToken({
                key: key,
                secret: secret,
                url: accessUrl,
                poId: record.id
            });
            if (!token) throw 'Missing token for authentication.';

            // build the request body
            var sendPOBody = generateBody({
                record: record,
                customerNo: customerNo,
                config: recVendorConfig,
                testRequest: testRequest
            });
            log.audit(logTitle, sendPOBody);

            ctc_util.vcLog({
                title: [LogTitle, 'PO Payload'].join(' - '),
                content: sendPOBody,
                transaction: record.id
            });

            if (!sendPOBody) throw 'Unable to generate PO Body Request';

            var sendPOReq = ctc_util.sendRequest({
                header: [LogTitle, 'Send PO'].join(' : '),
                method: 'post',
                recordId: record.id,
                query: {
                    url: url,
                    headers: {
                        Authorization: token.token_type + ' ' + token.access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sendPOBody)
                }
            });
            if (sendPOReq.isError) {
                var errorMesg = sendPOReq.errorMsg;

                if (sendPOReq.PARSED_RESPONSE) {
                    if (
                        sendPOReq.PARSED_RESPONSE.Fault &&
                        sendPOReq.PARSED_RESPONSE.Fault.faultstring
                    ) {
                        errorMesg = sendPOReq.PARSED_RESPONSE.Fault.faultstring;
                    }
                }

                throw 'Send PO Error - ' + errorMesg;
            }

            returnResponse.responseBody = sendPOReq.PARSED_RESPONSE || sendPOReq.RESPONSE.body;
            returnResponse.responseCode = sendPOReq.RESPONSE.code;
            returnResponse.message = 'Success';
        } catch (error) {
            var errorMsg = ctc_util.extractError(error);

            returnResponse.isError = true;
            returnResponse.message = errorMsg;
        } finally {
            log.audit(logTitle, '>> sendPoResp: ' + JSON.stringify(returnResponse));
        }

        return returnResponse;
    }

    return {
        // authenticate: generateToken,
        // send: send,
        process: process
    };
});
