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

        if (tokenReq.isError) throw ['Generate Token Error - ', tokenReq.errorMsg].join('');

        var tokenResp = ctc_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        log.audit(logTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        return tokenResp;
    }

    function _getRequestedDeliveryDate(option) {
        var logTitle = [LogTitle, 'getRequestedDeliveryDate'].join('::');

        var record = option.record,
            itemCount = record.items.length,
            deliveryDate;

        for (var i = 0; i < itemCount; i++) {
            var expectedReceiptDate = record.items[i].expectedReceiptDate;
            if (!deliveryDate && expectedReceiptDate) deliveryDate = expectedReceiptDate;
        }

        return deliveryDate;
    }

    function _buildOrderDetails(option) {
        var logTitle = [LogTitle, 'buildOrderDetails'].join('::');

        var record = option.record,
            itemCount = record.items.length,
            itemNum = '',
            orderDetails = [];

        for (var i = 0; i < itemCount; i++) {
            if (itemNum != record.items[i].item || itemNum == '') {
                var orderDetail = {
                    lineItemNum: i + 1,
                    lineItemDescription: record.items[i].description,
                    supplierPartId: record.items[i].item,
                    supplierPartIdExt: record.items[i].item,
                    quantity: record.items[i].quantity,
                    unitPrice: record.items[i].rate,
                    currency: record.currency
                    //TODO: Need to populate from SO?
                    //				endUser: {
                    //					 company: '',
                    //					 contactName: '',
                    //					 email: '',
                    //					 telephone: '',
                    //					 address: {
                    //						 address1: '',
                    //						 address2: '',
                    //						 city: '',
                    //						 stateOrProvince: '',
                    //						 postalCode: '',
                    //						 country: ''
                    //					 }
                    //				}
                };

                if (record.items[i].quotenumber)
                    orderDetail.supplierPartId = record.items[i].quotenumber;

                orderDetails.push(orderDetail);

                itemNum = record.items[i].item;
            } else {
                orderDetails[orderDetails.length - 1].quantity = 1;
                break;
            }
        }

        return orderDetails;
    }

    function _buildCustomFields(option) {
        var record = option.record;
        var arr = [];

        var shipCode = undefined,
            dellShipCode = record.dellShippingCode;
        if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.TWO_DAY) {
            shipCode = '2D';
        } else if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.NEXT_DAY) {
            shipCode = 'ND';
        } else {
            shipCode = 'LC';
        }
        var createdfrom = record.createdFrom;

        arr.push({
            name: 'EU_PO_NUMBER',
            type: 'string',
            value: _getEndUserPO({ createdfrom: createdfrom })
        });
        arr.push({
            name: 'SHIPPING_CODE',
            type: 'string',
            value: shipCode
        });
        //only for shippingCode = DC, i.e., FEDEX, UPS
        arr.push({
            name: 'SHIPPING_CARRIER_NAME',
            type: 'string',
            value: ''
        });
        //only for shippingCode = dc, carrier acct no
        arr.push({
            name: 'SHIPPING_CARRIER_ACCT_NU',
            type: 'string',
            value: ''
        });

        return arr;
    }

    function _getEndUserPO(option) {
        var createdfrom = option.createdfrom,
            endUserPO = '';

        if (createdfrom) {
            var lkup = ns_search.lookupFields({
                type: ns_search.Type.TRANSACTION,
                id: createdfrom,
                columns: ['recordtype', 'otherrefnum']
            });

            if (lkup && lkup.recordtype === 'salesorder') {
                endUserPO = lkup.otherrefnum;
            }
        }

        return endUserPO;
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
            PoNumber: record.tranId,
            ProfileId: customerNo,
            isTestPayload: testRequest.toString(),
            RequestedDeliveryDate: (function () {
                var deliveryDate = null;
                for (var i = 0; i < itemLength; i++) {
                    if (deliveryDate) break;
                    var expectedReceiptDate = record.items[i].expectedReceiptDate;
                    if (expectedReceiptDate) deliveryDate = expectedReceiptDate;
                }
                return deliveryDate || "null";
            })(),
            OrderContact: {
                Company: config.Bill.addressee,
                ContactName: config.Bill.attention,
                Email: config.Bill.email,
                Telephone: '',
                Address: {
                    Address1: config.Bill.address1,
                    Address2: config.Bill.address2,
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
                Telephone: '',
                Address: {
                    Address1: config.Bill.address1,
                    Address2: config.Bill.address2,
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
                Telephone: '',
                Address: {
                    Address1: config.Bill.address1,
                    Address2: config.Bill.address2,
                    City: config.Bill.city,
                    StateOrProvince: config.Bill.state,
                    PostalCode: config.Bill.zip,
                    Country: config.Bill.country
                }
            },
            // Payment: {
            //     // PaymentMean: 'Other',
            //     // PaymentMeanOther: 'FP',
            //     PaymentTerm: record.terms
            // },
            OrderDetails: (function () {
                var arrItemList = [];

                for (var i = 0, j = itemLength; i < j; i++) {
                    var itemData = record.items[i];

                    var itemDetails = {
                        LineItemNum: (i + 1).toString(),
                        SupplierPartId: itemData.quotenumber,
                        SupplierPartIdExt: itemData.quotenumber,
                        lineItemDescription: 'null',
                        Quantity: (itemData.quantity).toString(),
                        UnitPrice: (itemData.rate).toString(),
                        Currency: record.currency,
                        FinalRecipient: {
                            Company: config.Bill.addressee,
                            ContactName: config.Bill.attention,
                            Email: config.Bill.email,
                            Telephone: '',
                            Address: {
                                Address1: config.Bill.address1,
                                Address2: config.Bill.address2,
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

                    var itemDataIdx=-1;
                    for (var ii=0, jj=arrItemList.length; ii <jj; ii++) {
                        if (itemDetails.SupplierPartId ==arrItemList[ii].SupplierPartId ) {
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
            })(),
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
                title: [LogTitle, 'PO Details'].join(' - '),
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

            returnResponse.responseBody = sendPOReq.PARSED_RESPONSE || sendPOReq.RESPONSE.body;
            returnResponse.responseCode = sendPOReq.RESPONSE.code;

            var sendPoResp = sendPOReq.PARSED_RESPONSE;
            if (sendPOReq.isError || !sendPoResp) {
                throw 'Send PO Error - ' + sendPOReq.errorMsg;
            } else {
                returnResponse.message = 'Success';
            }
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
