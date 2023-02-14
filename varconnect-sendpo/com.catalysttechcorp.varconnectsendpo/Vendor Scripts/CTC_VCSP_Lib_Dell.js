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

        var poObj = option.record,
            recPO = option.nativeRecPO,
            customerNo = option.customerNo,
            vendorConfig = option.config,
            itemLength = poObj.items.length,
            testRequest = option.testRequest;

        log.audit(logTitle, '// poObj: ' + JSON.stringify(poObj));

        var field_mapping = ctc_util.safeParse(vendorConfig.fieldmap) || {};

        var bodyContentJSON = {
            isTestPayload: !!testRequest,
            correlationId: '',
            poNumber: poObj.tranId,
            endCustomerPONumber: poObj.custPO || '',
            profileId: customerNo,
            profilePwd: '',
            requestedDeliveryDate: (function () {
                var deliveryDate = null;
                for (var i = 0; i < itemLength; i++) {
                    if (deliveryDate) break;
                    var expectedReceiptDate = poObj.items[i].expectedReceiptDate;
                    if (expectedReceiptDate) deliveryDate = expectedReceiptDate;
                }
                return deliveryDate || '';
            })(),
            // orderContact: (function () {
            //     var contactId = recPO.getValue({ fieldId: 'custbody_ctc_quote_contact' });

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
                var logTitle = [LogTitle, 'GenerateBody', 'shippingContact'].join('::');

                var shipSubRec = recPO.getSubrecord({ fieldId: 'shippingaddress' });
                log.audit(logTitle, '// shipSubRec: ' + JSON.stringify(shipSubRec));

                var poData = {
                    shipto: recPO.getValue({ fieldId: 'shipto' }),
                    createdfrom: recPO.getValue({ fieldId: 'createdfrom' }),
                    primaryContact: recPO.getValue({ fieldId: 'custbody_ctc_vcsp_primary_contact' })
                };
                log.audit(logTitle, '// poData: ' + JSON.stringify(poData));

                var arrAddressFields = [
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

                var addrInfo = {};
                arrAddressFields.forEach(function (fld) {
                    addrInfo[fld] = {
                        value: shipSubRec.getValue({ fieldId: fld }),
                        text: shipSubRec.getText({ fieldId: fld })
                    };
                });
                log.audit(logTitle, '// addrInfo: ' + JSON.stringify(addrInfo));
                if (ctc_util.isEmpty(addrInfo)) throw 'Missing Shipping Address Info';

                // get the customer from 'shipto' or SO's entity
                var customerId = poData.shipto;
                if (!customerId) {
                    var salesOrderSearch = ns_search.create({
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
                var ContactRoles = { PRIMARY: '-10', ALTERNATE: '-20' };

                var contactSearchObj = ns_search.create({
                    type: 'contact',
                    filters: [
                        ['company', 'anyof', customerId],
                        'AND',
                        ['role', 'anyof', ContactRoles.PRIMARY, ContactRoles.ALTERNATE] // PRIMARY(-10)| ALTERNATE
                    ],
                    columns: ['entityid', 'email', 'phone', 'contactrole']
                });

                var contactNames = {};
                contactSearchObj.run().each(function (result) {
                    var contactRole = {
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

                var contactInfo =
                    contactNames[ContactRoles.PRIMARY] &&
                    contactNames[ContactRoles.PRIMARY].entityid
                        ? contactNames[ContactRoles.PRIMARY]
                        : contactNames[ContactRoles.ALTERNATE];
                log.audit(logTitle, '// contactInfo: ' + JSON.stringify(contactInfo));

                if (ctc_util.isEmpty(contactInfo)) {
                    // try to get data from custbody_ctc_vcsp_primary_contact
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
                log.audit(logTitle, '// contactInfo: ' + JSON.stringify(contactInfo));

                if (ctc_util.isEmpty(contactInfo)) throw 'Missing Contact Info';

                var shippingContactObj = {
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

                    for (var fld in field_mapping.shippingContact) {
                        if (!field_mapping.shippingContact[fld]) continue;
                        var mappedvalue = recPO.getValue({
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
                var logTitle = [LogTitle, 'GenerateBody', 'orderDetails'].join('::');

                var arrItemList = [];

                log.audit(logTitle, '** Order Details: ' + JSON.stringify(poObj.items));

                for (var i = 0, j = itemLength; i < j; i++) {
                    var itemData = poObj.items[i];

                    var itemDetails = {
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

                    var itemDataIdx = -1;
                    for (var ii = 0, jj = arrItemList.length; ii < jj; ii++) {
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
                var logTitle = [LogTitle, 'GenerateBody', 'CustomFields'].join('::');

                var arr = [];

                if (field_mapping && field_mapping.CUSTOM) {
                    log.audit(
                        logTitle,
                        '>> field_mapping.CUSTOM: ' + JSON.stringify(field_mapping.CUSTOM)
                    );

                    var mappedValues = {};

                    for (var fld in field_mapping.CUSTOM) {
                        if (!field_mapping.CUSTOM[fld]) continue;

                        var mappedvalue = recPO.getValue({ fieldId: field_mapping.CUSTOM[fld] });
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
                // var createdfrom = poObj.createdFrom;

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
                log.audit(logTitle, '>> shipmethod' + JSON.stringify(shipMethod));
                if (!shipMethod) return {};

                var searchShipMethodMap = ns_search.create({
                    type: 'customrecord_ctc_vcsp_vendor_shipping',
                    filters: [['custrecord_ctc_vcsp_ship_shipmethodmap', 'anyof', shipMethod]],
                    columns: [
                        'name',
                        'custrecord_ctc_vcsp_ship_vendorconfg',
                        'custrecord_ctc_vcsp_ship_shipmethod',
                        'custrecord_ctc_vcsp_ship_shipmethodmap'
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
                            name: 'custrecord_ctc_vcsp_ship_shipmethod'
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

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');

        var recVendorConfig = option.recVendorConfig,
            key = recVendorConfig.apiKey,
            secret = recVendorConfig.apiSecret,
            url = recVendorConfig.endPoint,
            accessUrl = recVendorConfig.accessEndPoint,
            testRequest = recVendorConfig.testRequest,
            customerNo = recVendorConfig.customerNo,
            poObj = option.record || option.recPO,
            recPO = option.nativePO;

        log.audit(logTitle, '>> record : ' + JSON.stringify(poObj));

        var returnResponse = {
            transactionNum: poObj.tranId,
            transactionId: poObj.id
        };

        try {
            var token = generateToken({
                key: key,
                secret: secret,
                url: accessUrl,
                poId: poObj.id
            });
            if (!token) throw 'Missing token for authentication.';

            // build the request body
            var sendPOBody = generateBody({
                record: poObj,
                nativeRecPO: recPO,
                customerNo: customerNo,
                config: recVendorConfig,
                testRequest: testRequest
            });
            log.audit(logTitle, sendPOBody);

            ctc_util.vcLog({
                title: [LogTitle, 'PO Payload'].join(' - '),
                content: sendPOBody,
                transaction: poObj.id
            });

            if (!sendPOBody) throw 'Unable to generate PO Body Request';


            var sendPOReq = ctc_util.sendRequest({
                header: [LogTitle, 'Send PO'].join(' : '),
                method: 'post',
                recordId: poObj.id,
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
            if (sendPOReq.isError) {
                var errorMesg = sendPOReq.errorMsg;

                if (sendPOReq.PARSED_RESPONSE) {
                    if (
                        sendPOReq.PARSED_RESPONSE.statusCode &&
                        sendPOReq.PARSED_RESPONSE.statusMessage
                    ) {
                        errorMesg = util.isArray(sendPOReq.PARSED_RESPONSE.statusMessage)
                            ? sendPOReq.PARSED_RESPONSE.statusMessage.join('\n')
                            : sendPOReq.PARSED_RESPONSE.statusMessage;
                    }
                }
                throw errorMesg;
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
