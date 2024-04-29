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
 */
define([
    'N/encode',
    'N/search',
    'N/error',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_VCSP_Lib_Log',
    '../Library/CTC_Lib_Utils'
], function (ns_encode, ns_search, ns_error, constants, vcLog, ctc_util) {
    let LogTitle = 'WS:Dell';

    function generateToken(option) {
        let logTitle = [LogTitle, 'generateToken'].join('::');

        let authkey = ns_encode.convert({
            string: option.key + ':' + option.secret,
            inputEncoding: ns_encode.Encoding.UTF_8,
            outputEncoding: ns_encode.Encoding.BASE_64_URL_SAFE
        });
        log.audit(logTitle, '>> auth-key: ' + JSON.stringify(authkey));

        let tokenReq = ctc_util.sendRequest({
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
            let errorMessage = tokenReq.errorMsg;
            if (tokenReq.PARSED_RESPONSE && tokenReq.PARSED_RESPONSE.error_description) {
                errorMessage = tokenReq.PARSED_RESPONSE.error_description;
            }
            throw ns_error.create({
                name: 'TOKEN_ERR',
                message: 'Generate Token Error - ' + errorMessage
            });
        }

        let tokenResp = ctc_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token)
            throw ns_error.create({
                name: 'TOKEN_ERR',
                message: 'Unable to retrieve token'
            });

        log.audit(logTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        return tokenResp;
    }

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::'),
            returnValue = '';

        let poObj = option.record,
            recPO = option.nativeRecPO,
            customerNo = option.customerNo,
            vendorConfig = option.config,
            itemLength = poObj.items.length,
            testRequest = option.testRequest;

        log.audit(logTitle, '// poObj: ' + JSON.stringify(poObj));

        let field_mapping = ctc_util.safeParse(vendorConfig.fieldMap) || {};

        let bodyContentJSON = {
            isTestPayload: !!testRequest,
            correlationId: '',
            poNumber: poObj.tranId,
            endCustomerPONumber: poObj.custPO || '',
            profileId: customerNo,
            profilePwd: '',
            requestedDeliveryDate: (function () {
                let deliveryDate = null;
                for (let i = 0; i < itemLength; i++) {
                    if (deliveryDate) break;
                    let expectedReceiptDate = poObj.items[i].expectedReceiptDate;
                    if (expectedReceiptDate) deliveryDate = expectedReceiptDate;
                }
                return deliveryDate || '';
            })(),
            // orderContact: (function () {
            //     let contactId = recPO.getValue({ fieldId: 'custbody_ctc_quote_contact' });

            // })(),
            orderContact: {
                company: vendorConfig.Bill.addressee,
                contactName: vendorConfig.Bill.attention,
                email: vendorConfig.Bill.email,
                telephone: vendorConfig.Bill.phoneno,
                address: {
                    address1: vendorConfig.Bill.address1,
                    address2: poObj.custPO, //config.Bill.address2,
                    city: vendorConfig.Bill.city,
                    stateOrProvince: vendorConfig.Bill.state,
                    postalCode: vendorConfig.Bill.zip,
                    country: vendorConfig.Bill.country
                }
            },
            shippingContact: (function () {
                let logTitle = [LogTitle, 'GenerateBody', 'shippingContact'].join('::');

                let shipSubRec = recPO.getSubrecord({ fieldId: 'shippingaddress' });
                log.audit(logTitle, '// shipSubRec: ' + JSON.stringify(shipSubRec));

                let poData = {
                    shipto: recPO.getValue({ fieldId: 'shipto' }),
                    createdfrom: recPO.getValue({ fieldId: 'createdfrom' }),
                    primaryContact: recPO.getValue({ fieldId: 'custbody_ctc_vcsp_primary_contact' })
                };
                log.audit(logTitle, '// poData: ' + JSON.stringify(poData));

                let arrAddressFields = [
                    'country',
                    'attention',
                    'addressee',
                    'addrphone',
                    'addr1',
                    'addr2',
                    'addr3',
                    'city',
                    'state',
                    'zip'
                ];

                let addrInfo = {};
                arrAddressFields.forEach(function (fld) {
                    addrInfo[fld] = {
                        value: shipSubRec.getValue({ fieldId: fld }),
                        text: shipSubRec.getText({ fieldId: fld })
                    };
                });
                log.audit(logTitle, '// addrInfo: ' + JSON.stringify(addrInfo));
                if (ctc_util.isEmpty(addrInfo))
                    throw ns_error.create({
                        name: 'MISSING_SHIP_ADDRESS',
                        message: 'Missing Shipping Address Info'
                    });

                // get the customer from 'shipto' or SO's entity
                let customerId = poData.shipto;
                if (!customerId) {
                    let salesOrderSearch = ns_search.create({
                        type: 'salesorder',
                        filters: [
                            ['type', 'anyof', 'SalesOrd'],
                            'AND',
                            ['internalid', 'anyof', poData.createdfrom],
                            'AND',
                            ['mainline', 'is', 'T']
                        ],
                        columns: ['entity']
                    });

                    salesOrderSearch.run().each(function (result) {
                        customerId = result.getValue({ name: 'entity' });
                        return true;
                    });
                }
                log.audit(logTitle, '// customerid: ' + customerId);

                // get the primary contact
                let ContactRoles = { PRIMARY: '-10', ALTERNATE: '-20' };

                let contactSearchObj = ns_search.create({
                    type: 'contact',
                    filters: [
                        ['company', 'anyof', customerId],
                        'AND',
                        ['role', 'anyof', ContactRoles.PRIMARY, ContactRoles.ALTERNATE] // PRIMARY(-10)| ALTERNATE
                    ],
                    columns: ['entityid', 'email', 'phone', 'contactrole']
                });

                let contactNames = {};
                contactSearchObj.run().each(function (result) {
                    let contactRole = {
                        value: result.getValue({ name: 'contactrole' }),
                        text: result.getText({ name: 'contactrole' })
                    };

                    contactNames[contactRole.value] = {
                        entityid: result.getValue({ name: 'entityid' }),
                        email: result.getValue({ name: 'email' }),
                        role: contactRole
                    };

                    return true;
                });

                let contactInfo =
                    contactNames[ContactRoles.PRIMARY] &&
                    contactNames[ContactRoles.PRIMARY].entityid
                        ? contactNames[ContactRoles.PRIMARY]
                        : contactNames[ContactRoles.ALTERNATE];
                log.audit(logTitle, '// contactInfo: ' + JSON.stringify(contactInfo));

                if (ctc_util.isEmpty(contactInfo)) {
                    // try to get data from custbody_ctc_vcsp_primary_contact
                    if (poData.primaryContact) {
                        contactSearchObj = ns_search.create({
                            type: 'contact',
                            filters: [['internalid', 'anyof', poData.primaryContact]],
                            columns: ['entityid', 'email', 'phone', 'contactrole']
                        });

                        contactSearchObj.run().each(function (result) {
                            contactInfo = {
                                entityid: result.getValue({ name: 'entityid' }),
                                email: result.getValue({ name: 'email' })
                            };
                            return true;
                        });
                    }
                }
                if (ctc_util.isEmpty(contactInfo)) {
                    contactInfo = {
                        entityid: poObj.shipAddressee,
                        email: poObj.shipEmail
                    };
                }
                log.audit(logTitle, '// contactInfo: ' + JSON.stringify(contactInfo));

                if (ctc_util.isEmpty(contactInfo))
                    throw ns_error.create({
                        name: 'MISSING_SHIP_CONTACT',
                        message: 'Missing Contact Info'
                    });

                let shippingContactObj = {
                    company: addrInfo.addressee.value,
                    contactName: contactInfo.entityid,
                    email: contactInfo.email,
                    telephone: addrInfo.addrphone.value,
                    address: {
                        address1: addrInfo.addr1.value,
                        address2: addrInfo.addr2.value,
                        city: addrInfo.city.value,
                        stateOrProvince: addrInfo.state.value,
                        postalCode: addrInfo.zip.value,
                        country: addrInfo.country.value
                    }
                };

                if (field_mapping && field_mapping.shippingContact) {
                    log.audit(
                        logTitle,
                        '>> field_mapping.shippingContact: ' +
                            JSON.stringify(field_mapping.shippingContact)
                    );

                    for (let fld in field_mapping.shippingContact) {
                        if (!field_mapping.shippingContact[fld]) continue;
                        let mappedvalue = recPO.getValue({
                            fieldId: field_mapping.shippingContact[fld]
                        });

                        log.audit(logTitle, '>> mappedvalue: ' + JSON.stringify(mappedvalue));
                        shippingContactObj[fld] = mappedvalue;
                    }
                }

                return shippingContactObj;
            })(),
            billingContact: {
                company: vendorConfig.Bill.addressee,
                contactName: vendorConfig.Bill.attention,
                email: vendorConfig.Bill.email,
                telephone: vendorConfig.Bill.phoneno,
                address: {
                    address1: vendorConfig.Bill.address1,
                    address2: poObj.custPO, //config.Bill.address2,config.Bill.address2,
                    city: vendorConfig.Bill.city,
                    stateOrProvince: vendorConfig.Bill.state,
                    postalCode: vendorConfig.Bill.zip,
                    country: vendorConfig.Bill.country
                }
            },
            payment: {
                PaymentMean: vendorConfig.paymentMean,
                PaymentMeanOther: vendorConfig.paymentOther,
                PaymentTerm: vendorConfig.paymentTerm
            },
            orderDetails: (function () {
                let logTitle = [LogTitle, 'GenerateBody', 'orderDetails'].join('::');

                let arrItemList = [];

                log.audit(logTitle, '** Order Details: ' + JSON.stringify(poObj.items));

                for (let i = 0, j = itemLength; i < j; i++) {
                    let itemData = poObj.items[i];

                    let itemDetails = {
                        lineItemNum: (i + 1).toString(),
                        lineItemDescription: itemData.description,
                        supplierPartId: itemData.quotenumber,
                        supplierPartIdExt: itemData.quotenumber,
                        quantity: itemData.quantity.toString(),
                        unitPrice: itemData.rate.toString(),
                        currency: poObj.currency
                        // ,
                        // finalRecipient: {
                        //     company: vendorConfig.Bill.addressee,
                        //     contactName: vendorConfig.Bill.attention,
                        //     email: vendorConfig.Bill.email,
                        //     telephone: vendorConfig.Bill.phoneno,
                        //     address: {
                        //         address1: vendorConfig.Bill.address1,
                        //         address2: poObj.custPO, //config.Bill.address2,config.Bill.address2,
                        //         city: vendorConfig.Bill.city,
                        //         stateOrProvince: vendorConfig.Bill.state,
                        //         postalCode: vendorConfig.Bill.zip,
                        //         country: vendorConfig.Bill.country
                        //     }
                        // }
                    };
                    // skip the item if no quote number

                    log.audit(logTitle, '>> item Data: ' + JSON.stringify(itemData));
                    log.audit(logTitle, '>> item Details: ' + JSON.stringify(itemDetails));

                    if (!itemDetails.supplierPartId) continue;

                    let itemDataIdx = -1;
                    for (let ii = 0, jj = arrItemList.length; ii < jj; ii++) {
                        if (itemDetails.supplierPartId == arrItemList[ii].supplierPartId) {
                            itemDataIdx = ii;
                            break;
                        }
                    }

                    log.audit(logTitle, '>> itemDataIdx: ' + itemDataIdx);
                    arrItemList.push(itemDetails);
                }

                log.audit(logTitle, '** arrItemList: ' + JSON.stringify(arrItemList));

                return arrItemList;
            })(),
            CustomFields: (function () {
                let logTitle = [LogTitle, 'GenerateBody', 'CustomFields'].join('::');

                let arr = [];

                if (field_mapping && field_mapping.CUSTOM) {
                    log.audit(
                        logTitle,
                        '>> field_mapping.CUSTOM: ' + JSON.stringify(field_mapping.CUSTOM)
                    );

                    let mappedValues = {};

                    for (let fld in field_mapping.CUSTOM) {
                        if (!field_mapping.CUSTOM[fld]) continue;

                        let mappedvalue = recPO.getValue({ fieldId: field_mapping.CUSTOM[fld] });
                        mappedValues[fld] = mappedvalue || '';

                        log.audit(logTitle, '>> mappedvalue: ' + JSON.stringify(mappedvalue));

                        arr.push({
                            name: fld,
                            type: 'string',
                            value: mappedvalue
                        });
                    }
                }

                // if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.TWO_DAY) {
                //     shipCode = '2D';
                // } else if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.NEXT_DAY) {
                //     shipCode = 'ND';
                // } else {
                //     shipCode = 'LC';
                // }
                // let createdfrom = poObj.createdFrom;

                // arr.push({
                //     name: 'SHIPPING_CODE',
                //     type: 'string',
                //     value: shipCode
                // });
                // //only for shippingCode = DC, i.e., FEDEX, UPS
                // arr.push({
                //     name: 'SHIPPING_CARRIER_NAME',
                //     type: 'string',
                //     value: ''
                // });
                // //only for shippingCode = dc, carrier acct no
                // arr.push({
                //     name: 'SHIPPING_CARRIER_ACCT_NU',
                //     type: 'string',
                //     value: ''
                // });

                return arr;
            })(),
            shippingMethod: (function () {
                var logTitle = [LogTitle, 'GenerateBody', 'shippingMethod'].join('::'),
                    returnValue = {};

                //shipmethod
                var shipMethod = recPO.getValue({ fieldId: 'shipmethod' });
                log.audit(logTitle, '>> shipmethod ' + JSON.stringify(shipMethod));
                if (!shipMethod) return {};

                var searchShipMethodMap = ns_search.create({
                    type: constants.Records.VENDOR_SHIPMETHOD,
                    filters: [
                        [constants.Fields.VendorShipMethod.SHIP_METHOD_MAP, 'anyof', shipMethod]
                    ],
                    columns: [
                        'name',
                        { name: constants.Fields.VendorShipMethod.VENDOR_CONFIG },
                        { name: constants.Fields.VendorShipMethod.SHIP_VALUE },
                        { name: constants.Fields.VendorShipMethod.SHIP_METHOD_MAP }
                    ]
                });

                log.audit(
                    logTitle,
                    '>> mapped shipping results: ' +
                        JSON.stringify(searchShipMethodMap.runPaged().count)
                );

                if (searchShipMethodMap.runPaged().count) {
                    var mappedShipMethod;
                    searchShipMethodMap.run().each(function (result) {
                        mappedShipMethod = result.getValue({
                            name: constants.Fields.VendorShipMethod.SHIP_VALUE
                        });
                        return true;
                    });

                    log.audit(logTitle, '>> mapped shipping: ' + JSON.stringify(mappedShipMethod));

                    if (mappedShipMethod) {
                        returnValue.shippingMethod = mappedShipMethod;
                    }
                }
                return returnValue;
            })()
        };
        returnValue = bodyContentJSON; //JSON.stringify(bodyContentJSON);

        return returnValue;
    }

    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            record = option.record,
            response = option.response,
            responseBody = option.responseBody,
            returnValue = option.returnResponse;
        if (
            (response && response.isError) ||
            (responseBody &&
                (responseBody.errors ||
                    responseBody.statusCode < 200 ||
                    responseBody.statusCode >= 300))
        ) {
            let errorMesg = response.errorMsg;
            returnValue.errorName = 'Unexpected Error';
            if (responseBody && responseBody.errors) {
                errorMesg = JSON.stringify(responseBody.errors);
            } else {
                errorMesg = util.isArray(responseBody.statusMessage)
                    ? responseBody.statusMessage.join('\n')
                    : responseBody.statusMessage;
            }
            returnValue.errorMsg = errorMesg;
            returnValue.message = 'Send PO failed';
            returnValue.errorId = record.id;
            returnValue.isError = true;
        } else {
            returnValue.message = 'Send PO successful';
            returnValue.orderStatus = {};
        }
        return returnValue;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::');

        let recVendorConfig = option.recVendorConfig,
            key = recVendorConfig.apiKey,
            secret = recVendorConfig.apiSecret,
            url = recVendorConfig.endPoint,
            accessUrl = recVendorConfig.accessEndPoint,
            testRequest = recVendorConfig.testRequest,
            customerNo = recVendorConfig.customerNo,
            record = option.record || option.recPO,
            recPO = option.nativePO;

        log.audit(logTitle, '>> record : ' + JSON.stringify(record));

        let sendPOResponse,
            returnResponse = {
                transactionNum: record.tranId,
                transactionId: record.id
            };

        try {
            let token = generateToken({
                key: key,
                secret: secret,
                url: accessUrl,
                poId: record.id
            });
            if (!token)
                throw ns_error.create({
                    name: 'MISSING_TOKEN',
                    message: 'Missing token for authentication.'
                });

            // build the request body
            let sendPOBody = generateBody({
                record: record,
                nativeRecPO: recPO,
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

            if (!sendPOBody)
                throw ns_error.create({
                    name: 'GENERATE_REQUEST_ERR',
                    message: 'Unable to generate PO Body Request'
                });

            sendPOResponse = ctc_util.sendRequest({
                header: [LogTitle, 'Send PO'].join(' : '),
                method: 'post',
                recordId: record.id,
                query: {
                    url: url,
                    headers: {
                        Authorization: token.token_type + ' ' + token.access_token,
                        'Content-Type': 'application/json',
                        'Accepts-Version': '2.0'
                    },
                    body: JSON.stringify(sendPOBody)
                }
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
                response: sendPOResponse,
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
        // authenticate: generateToken,
        // send: send,
        process: process
    };
});
