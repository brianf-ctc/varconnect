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
    'N/search',
    'N/xml',
    '../Library/CTC_VCSP_Constants.js',
    '../Library/CTC_Lib_Utils.js',
    'N/https'
], function (ns_search, ns_xml, constants, ctc_util, https) {
    const LogTitle = 'WS:Ingram';

    function getAccessToken(dataIn) {
        var objResponse = https.post({
            body: {
                grant_type: 'client_credentials',
                client_id: dataIn.apiKey,
                client_secret: dataIn.apiSecret
            },
            url: dataIn.accessEndPoint
        });

        var dataResponse = objResponse.body ? JSON.parse(objResponse.body) : { access_token: '' };

        return dataResponse.access_token;
    }

    function sendPOToIngram(dataIn) {
        var logTitle = [LogTitle, 'sendPOToIngram'].join('::');
        var bearerToken = 'Bearer ' + getAccessToken(dataIn.vendorConfig);
        var headers = {
            Accept: 'application/json',
            'IM-CustomerNumber': dataIn.vendorConfig.customerNo,
            // 'IM-CustomerNumber': '20-222222', // sample customernumber. actual customerNo doesnt work
            'IM-CountryCode': 'US',
            'IM-SenderID': 'NS_CATALYST',
            'IM-CorrelationID': dataIn.objRecord.tranId,
            'Content-Type': 'application/json',
            Authorization: bearerToken
        };

        var stBody = JSON.stringify(dataIn.postBody);
        var imResponse = ctc_util.sendRequest({
            header: [LogTitle, 'sendPOToIngram'].join(' : '),
            method: 'post',
            recordId: dataIn.objRecord.id,
            query: {
                url: dataIn.vendorConfig.endPoint,
                headers: headers,
                body: stBody
            }
        });

        log.audit(logTitle, '>> Ingram: ' + JSON.stringify(imResponse));

        return imResponse;
    }

    function generatePostRequest(dataIn) {
        var logTitle = [LogTitle, 'generatePostBody'].join('::');
        var objRecord = dataIn.objRecord;
        var dataOut = {};
        var arrLines = objRecord.items.map(function (el) {
            var objLine = {
                customerLineNumber: el.lineuniquekey,
                ingramPartNumber: el.item,
                quantity: el.quantity
            };
            return objLine;
        });

        var objIngramTemplate = {
            customerOrderNumber: objRecord.tranId,
            notes: objRecord.memo,
            lines: arrLines,
            additionalAttributes: [
                {
                    attributeName: 'allowDuplicateCustomerOrderNumber',
                    attributeValue: true
                }
            ]
        };

        log.debug(logTitle, '>> Ingram Template Object: ' + objIngramTemplate);

        dataOut = {
            postBody: objIngramTemplate,
            vendorConfig: dataIn.vendorConfig,
            objRecord: dataIn.objRecord
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

            var imResponse = sendPOToIngram(objData);

            var returnResponse = {
                transactionNum: objRecord.tranId,
                transactionId: objRecord.id,
                logId: imResponse.logId,
                responseBody: imResponse.PARSED_REPONSE || imResponse.RESPONSE.body,
                responseCode: imResponse.RESPONSE.code
            };

            if (imResponse.isError) {
                returnResponse.isError = true;
                returnResponse.message = imResponse.errorMsg;
            }

            log.debug(logTitle, '>> RESPONSE ERROR: ' + returnResponse.responseBody.isError);
        } catch (e) {
            log.error(logTitle, 'FATAL_ERROR');
        }

        return returnResponse;
    }

    return {
        process: process
    };
});
