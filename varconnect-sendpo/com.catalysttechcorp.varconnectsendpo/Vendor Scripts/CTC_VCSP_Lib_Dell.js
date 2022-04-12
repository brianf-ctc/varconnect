define([
    'N/https',
    'N/encode',
    'N/search',
    '../Library/CTC_VCSP_Constants.js',
    '../Library/CTC_VCSP_Lib_Log.js',
    '../VO/CTC_VCSP_Response.js'
], function (https, encode, search, constants, vcLog, response) {
    function authenticate(options) {
        var key = options.key,
            secret = options.secret,
            url = options.url,
            grantType = options.grantType;

        //		var token = btoa(key+':'+secret);
        var token = encode.convert({
            string: key + ':' + secret,
            inputEncoding: encode.Encoding.UTF_8,
            outputEncoding: encode.Encoding.BASE_64_URL_SAFE
        });

        var headers = {
                authorization: 'Basic ' + token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body = {
                grant_type: 'client_credentials'
            };

        log.debug('auth headers', headers);
        log.debug('auth body', body);

        var responseObj = https.post({
            url: url,
            headers: headers,
            body: body
        });

        return JSON.parse(responseObj.body);
    }

    function _getRequestedDeliveryDate(options) {
        var recPO = options.recPO,
            itemCount = recPO.items.length,
            deliveryDate = undefined;

        for (var i = 0; i < itemCount; i++) {
            var expectedReceiptDate = recPO.items[i].expectedReceiptDate;
            if (!deliveryDate && expectedReceiptDate) deliveryDate = expectedReceiptDate;
        }

        return deliveryDate;
    }

    function _buildOrderDetails(options) {
        var recPO = options.recPO,
            itemCount = recPO.items.length,
            itemNum = '',
            orderDetails = [];

        for (var i = 0; i < itemCount; i++) {
            if (itemNum != recPO.items[i].item || itemNum == '') {
                var orderDetail = {
                    lineItemNum: i + 1,
                    lineItemDescription: recPO.items[i].description,
                    supplierPartId: recPO.items[i].item,
                    supplierPartIdExt: recPO.items[i].item,
                    quantity: recPO.items[i].quantity,
                    unitPrice: recPO.items[i].rate,
                    currency: recPO.currency
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

                if (recPO.items[i].quotenumber)
                    orderDetail.supplierPartId = recPO.items[i].quotenumber;

                orderDetails.push(orderDetail);

                itemNum = recPO.items[i].item;
            } else {
                orderDetails[orderDetails.length - 1].quantity = 1;
                break;
            }
        }

        return orderDetails;
    }

    function _buildCustomFields(options) {
        var recPO = options.recPO;
        var arr = [];

        var shipCode = undefined,
            dellShipCode = recPO.dellShippingCode;
        if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.TWO_DAY) {
            shipCode = '2D';
        } else if (dellShipCode == constants.Lists.DELL_SHIPPING_CODE.NEXT_DAY) {
            shipCode = 'ND';
        } else {
            shipCode = 'LC';
        }
        var createdfrom = recPO.createdFrom;

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

    function _getEndUserPO(options) {
        var createdfrom = options.createdfrom,
            endUserPO = '';

        if (createdfrom) {
            var lkup = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: createdfrom,
                columns: ['recordtype', 'otherrefnum']
            });

            if (lkup && lkup.recordtype === 'salesorder') {
                endUserPO = lkup.otherrefnum;
            }
        }

        return endUserPO;
    }

    function _generateBody(options) {
        var recPO = options.recPO,
            customerNo = options.customerNo,
            testRequest = options.testRequest;
        log.debug('recPO', recPO);
        var body = {
            poNumber: recPO.tranId,
            profileId: customerNo,
            isTestPayload: testRequest,
            requestedDeliveryDate: _getRequestedDeliveryDate({ recPO: recPO }),
            //TODO: Who to put here
            //				 orderContact: {
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
            //				 },
            shippingContact: {
                //					 company: recPO.shipAttention,
                //					 contactName: recPO.shipAddressee,
                company: recPO.shipAddressee,
                contactName: recPO.shipAttention,
                email: recPO.shipEmail,
                telephone: recPO.shipPhone,
                address: {
                    address1: recPO.shipAddr1,
                    address2: recPO.shipAddr2,
                    city: recPO.shipCity,
                    stateOrProvince: recPO.shipState,
                    postalCode: recPO.shipZip,
                    country: recPO.shipCountry
                }
            },
            billingContact: {
                //					 company: recPO.billAttention,
                //					 contactName: recPO.billAddressee,
                company: recPO.billAddressee,
                contactName: recPO.billAttention,
                email: recPO.billEmail,
                telephone: recPO.billPhone,
                address: {
                    address1: recPO.billAddr1,
                    address2: recPO.billAddr2,
                    city: recPO.billCity,
                    stateOrProvince: recPO.billState,
                    postalCode: recPO.billZip,
                    country: recPO.billCountry
                }
            },
            //TODO What to put here
            payment: {
                //					 cardInfo: {
                //						 cardNumber: '',
                //						 cardAuthCode: '',
                //						 cardRefNumber: '',
                //						 cardExpirationDate: '',
                //						 cardType: '',
                //						 cardTypeOther: '',
                //						 cardHolderName: ''
                //					 },
                //					 paymentMean: '',
                //					 paymentMeanOther: '',
                paymentTerm: recPO.terms
            },
            orderDetails: _buildOrderDetails({ recPO: recPO }),
            customFields: _buildCustomFields({ recPO: recPO })
        };

        log.debug('body', JSON.stringify(body));

        return body;
    }

    function send(options) {
        var auth = options.auth,
            recPO = options.recPO,
            url = options.url,
            customerNo = options.customerNo,
            testRequest = options.testRequest,
            tokenType = auth.token_type,
            accessToken = auth.access_token,
            body = _generateBody({
                recPO: recPO,
                customerNo: customerNo,
                testRequest: testRequest
            });

        vcLog.recordLog({
            header: 'Request',
            body: JSON.stringify(body),
            transaction: recPO.id
        });
        var responseObj = https.post({
            url: url,
            headers: {
                Authorization: tokenType + ' ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        return responseObj;
    }

    function process(options) {
        var recVendorConfig = options.recVendorConfig,
            key = recVendorConfig.apiKey,
            secret = recVendorConfig.apiSecret,
            url = recVendorConfig.endPoint,
            accessUrl = recVendorConfig.accessEndPoint,
            grantType = recVendorConfig.grantType,
            testRequest = recVendorConfig.testRequest,
            customerNo = recVendorConfig.customerNo,
            recPO = options.recPO;
        responseObj;

        var auth = authenticate({
            key: key,
            secret: secret,
            url: accessUrl,
            grabtType: grantType
        });
        log.debug('auth', auth);
        try {
            var responseObj = send({
                auth: auth,
                recPO: recPO,
                url: url,
                customerNo: customerNo,
                testRequest: testRequest
            });

            vcLog.recordLog({
                header: 'Response',
                body: JSON.stringify(responseObj),
                transaction: recPO.id,
                status: constants.Lists.VC_LOG_STATUS.SUCCESS
            });
        } catch (err) {
            log.error({
                title: 'Send PO to Dell',
                details: 'Could not send PO ' + recPO.tranId + ' error = ' + err.message
            });
            vcLog.recordLog({
                header: 'Error when sending to Dell',
                body: 'Could not send PO ' + recPO.tranId + ' error = ' + err.message,
                transaction: recPO.id
            });
            responseObj = {
                code: 400,
                body: 'Could not send PO ' + recPO.tranId + ' error = ' + err.message
            };
        }
        var resp = new response({
            code: responseObj.code,
            message: responseObj.body
        });

        if (resp.code == 200) resp.message = null;

        log.debug('resp', JSON.stringify(resp));

        return resp;
    }

    return {
        authenticate: authenticate,
        send: send,
        process: process
    };
});
