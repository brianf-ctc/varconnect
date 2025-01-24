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
    'N/xml',
    '../Library/CTC_VCSP_Constants.js',
    '../Library/CTC_Lib_Utils.js',
    'N/https'
], function (ns_xml, constants, ctc_util, https) {
    var LogTitle = 'WS:DandH';

    var ns_search = require('N/search');

    // function getAccessToken (dataIn) {
    //   var objResponse = https.post({
    //     body: {
    //       grant_type: 'client_credentials',
    //       client_id: dataIn.apiKey,
    //       client_secret: dataIn.apiSecret
    //     },
    //     url: dataIn.accessEndPoint
    //   });

    //   var dataResponse = (objResponse.body) ? JSON.parse(objResponse.body) : { access_token: '' };

    //   return dataResponse.access_token;
    // }

    function sendPOToDH(dataIn) {
        var logTitle = [LogTitle, 'sendPOToDH'].join('::');
        // var bearerToken = 'Bearer ' + getAccessToken(dataIn.vendorConfig);
        var headers = {
            'dandh-tenant': '',
            accountNumber: ''
        };

        var stBody = JSON.stringify(dataIn.postBody);
        var imResponse = ctc_util.sendRequest({
            header: [LogTitle, 'sendPOToDH'].join(' : '),
            method: 'post',
            recordId: dataIn.objRecord.id,
            query: {
                url: dataIn.vendorConfig.endPoint,
                headers: headers,
                body: stBody
            }
        });

        log.audit(logTitle, '>> D and H Response: ' + JSON.stringify(imResponse));

        return imResponse;
    }

    function generatePostRequest(dataIn) {
        var logTitle = [LogTitle, 'generatePostBody'].join('::');
        // var objRecord = dataIn.objRecord;
        var dataOut = {};
        // var arrLines = objRecord.items.map(function (el) {
        //   var objLine = {
        //     customerLineNumber: el.lineuniquekey,
        //     item: el.item,
        //     quantity: el.quantity
        //   };
        //   return objLine;
        // });

        // var objTemplate = {
        //   customerOrderNumber: objRecord.tranId,
        //   notes: objRecord.memo,
        //   lines: arrLines,
        //   additionalAttributes: [{
        //     attributeName: 'allowDuplicateCustomerOrderNumber',
        //     attributeValue: true
        //   }]
        // };

        // log.debug(logTitle, '>>  Template Object: ' + objTemplate);

        dataOut = {
            customerPurchaseOrder: '', // Required
            deliveryAddress: {
                address: {
                    // All fields in address are required
                    city: '',
                    country: '',
                    postalCode: '',
                    region: '',
                    street: ''
                },
                attention: '',
                deliveryName: '' // Required
            },
            endUserData: {
                address: {
                    // All fields in address are required
                    city: '',
                    country: '',
                    postalCode: '',
                    region: '',
                    street: ''
                },
                attention: '',
                authorizationQuoteNumber: '',
                ccoId: '',
                customerAccountNumber: '', // 10 digit account number
                dateOffSale: '', // Date Object
                department: '',
                domain: '',
                domainAdministratorEmailAddress: '',
                email: '',
                endUserEmailAddress: '',
                fax: '',
                masterContactNumber: '',
                modelNumber: '',
                organization: '',
                phone: '',
                purchaseOrderNumber: '',
                resellerEmailAddress: '',
                resellerPhone: '',
                serialNumbers: '', // comma-delimited
                supportStartDate: '', // Date Object.  When update type is "Renewal" or "Upgrade", submit the SupportStart Date. Otherwise, leave empty
                updateType: '', // Enum: [New, Renewal, Upgrade]
                warrantySku: ''
            },
            freightBillingAccount: '',
            notes: '',
            shipments: [
                // Required
                {
                    branch: '', // Warehouse branch identifier - BR01 (Harrisburg, PA), BR03 (Toronto, CANADA), BR04 (Fresno, CA), BR05 (Chicago, IL), BR06 (Atlanta, GA), BR08 (Vancouver, CANADA)
                    lines: [
                        {
                            // Required
                            item: '',
                            orderQuantity: 0,
                            unitPrice: ''
                        }
                    ]
                }
            ],
            shipping: {
                // Required
                allowBackOrder: true,
                allowPartialShipment: true,
                carrier: '', // The name of the preferred shipping carrier. USPS (US Postal Service), UPSM (UPS MailInnovations), UPSS (UPS Surepost), and FXSP(FedEx SmartPost) are only available to select approved customers. These carriers must use service level 'Ground'. UPS is only available to select approved customers.
                dropShipPassword: '',
                onlyBranch: '',
                serviceType: '' // Enum: [pickup, ground, nextDay, secondDay, nextDaySaturdayDelivery, firstClassMail, priorityMail]
            }
        };

        return dataOut;
    }
    function process(option) {
        try {
            var logTitle = [LogTitle, 'process'].join('::');
            log.debug(logTitle, '>>Entry<<');
            var vendorConfig = option.recVendorConfig;
            var objRecord = option.record || option.recPO;
            var objData = generatePostRequest({
                objRecord: objRecord,
                vendorConfig: vendorConfig
            });
            var returnResponse = null;

            // var imResponse = sendPOToDH(objData);

            // var returnResponse = {
            //   transactionNum: objRecord.tranId,
            //   transactionId: objRecord.id,
            //   logId: imResponse.logId,
            //   responseBody: imResponse.PARSED_REPONSE || imResponse.RESPONSE.body,
            //   responseCode: imResponse.RESPONSE.code
            // };

            // if (imResponse.isError) {
            //   returnResponse.isError = true;
            //   returnResponse.message = imResponse.errorMsg;
            // }

            // log.debug(logTitle, '>> RESPONSE ERROR: ' + returnResponse.responseBody.isError);
        } catch (e) {
            log.error(logTitle, 'FATAL_ERROR');
        }

        return returnResponse;
    }

    return {
        process: process
    };
});
