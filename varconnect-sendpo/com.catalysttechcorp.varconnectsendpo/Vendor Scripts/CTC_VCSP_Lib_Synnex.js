/**
 * Copyright (c) 2020 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Mar 2, 2020		pjlee		Library for Synnex Send PO
 *
 */ /**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */

define([
    'N/https',
    'N/record',
    '../Library/CTC_VCSP_Lib_Log.js',
    '../VO/CTC_VCSP_Response.js',
    'N/xml'
], function (https, record, vcLog, response, xmlModule) {
    function getSynnexResponse(xmlString) {
        var returnObject = {};
        returnObject.poid = '';
        returnObject.reason = 'Incomplete PO Details';
        returnObject.code = 'Error';

        try {
            var xmlDoc = xmlModule.Parser.fromString({
                text: xmlString
            });

            //PO ID Element Tag on XML
            var poIDElement = xmlDoc.getElementsByTagName({ tagName: 'PONumber' });
            if (poIDElement) {
                if (poIDElement.length > 0) {
                    returnObject.poid = poIDElement[0].textContent;
                    log.debug('Synnex Send PO PONumber', returnObject.poid);
                }
            }

            //Reason Element Tag on XML
            var reasonIDElement = xmlDoc.getElementsByTagName({ tagName: 'Reason' });
            if (reasonIDElement) {
                if (reasonIDElement.length > 0) {
                    returnObject.reason = reasonIDElement[0].textContent;
                    log.debug('Synnex Send PO Reason', returnObject.reason);
                }
            }

            //Code Element Tag on XML
            var codeIDElement = xmlDoc.getElementsByTagName({ tagName: 'Code' });
            if (codeIDElement) {
                if (codeIDElement.length > 0) {
                    returnObject.code = codeIDElement[0].textContent;
                    log.debug('Synnex Send PO Code', returnObject.code);
                }
            }
        } catch (err) {
            log.error({
                title: 'Synnex Send PO Error',
                details: 'error = ' + err.message
            });
        }

        return returnObject;
    }

    function process(options) {
        try {
            var recVendorConfig = options.recVendorConfig,
                userName = recVendorConfig.user,
                password = recVendorConfig.password,
                customerNo = recVendorConfig.customerNo,
                tempURL = recVendorConfig.endPoint,
                recPO = options.recPO;

            var dropShipFlag = '';
            var shipFromWarehouse = '';
            var shipAddressLabel = '';
            var shipAddressLine1 = '';
            var shipAddressLine2 = '';
            var shipAddressCity = '';
            var shipAddressState = '';
            var shipAddressZipCode = '';
            var shipAddressCountryCode = '';
            var endUserPONumber = '';
            var shipToContact = '';
            var shipToPhone = '';
            var shipToEmail = '';
            var shipMethodCode = '';
            var poMemo = '';

            var requestURL = tempURL.replace('Status', ''); //remove "Status" at the url so that this will be a submit PO endpoint URL
            var poNumber = recPO.id;
            log.debug('PO ID ' + poNumber);
            var poRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poNumber,
                isDynamic: true
            });
            log.debug('PO Transaction ', poRecord);
            //log.debug('PO Tran Fields', poRecord.getFields());
            //log.debug('PO Tran Length', poRecord.toString().length);
            //log.debug('PO Tran #2', poRecord.toString().substr(3996, poRecord.toString().length));

            dropShipFlag = 'N'; //default is N, Y is True, N is False //TODO: Need to determine
            shipFromWarehouse = '2'; //default is 2 //TODO: Need to determine mapping
            shipMethodCode = 'FX'; //TODO: determine mapping
            shipToEmail = '';

            // GET PO’s subrecord
            var shipAddress = poRecord.getSubrecord({
                fieldId: 'shippingaddress'
            });
            log.debug('PO Address Record', shipAddress);

            shipAddressLabel = poRecord.getText({
                fieldId: 'shipto'
            });
            log.debug('shipto', shipAddressLabel);

            shipToContact = shipAddress.getValue({
                fieldId: 'addressee'
            });

            shipToPhone = shipAddress.getValue({
                fieldId: 'addrphone'
            });

            shipAddressLine1 = shipAddress.getValue({
                fieldId: 'addr1'
            });

            var shipAddressLine2 = shipAddress.getValue({
                fieldId: 'addr2'
            });

            var shipAddressCity = shipAddress.getValue({
                fieldId: 'city'
            });

            log.debug('shipcity', shipAddressCity);
            shipAddressState = shipAddress.getValue({
                fieldId: 'state'
            });

            log.debug('shipstate', shipAddressState);
            shipAddressZipCode = shipAddress.getValue({
                fieldId: 'zip'
            });
            log.debug('shipzip', shipAddressZipCode);
            shipAddressCountryCode = shipAddress.getValue({
                fieldId: 'country'
            });
            log.debug('shipcountry', shipAddressCountryCode);

            endUserPONumber = poRecord.getValue({
                fieldId: 'tranid'
            });

            poMemo = poRecord.getValue({
                fieldId: 'memo'
            });

            //XML Query parts
            var xmlHeader = '';
            var xmlBody = '';
            var xmlLineItems = '';
            var xmlFooter = '';
            var responseXML;
            var responseMessage;
            var xmlSendPO;

            var headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'Content-Length': 'length'
            };

            //traverse PO line items
            var poLineArray = [];
            var poLineCount = poRecord.getLineCount({
                sublistId: 'item'
            });

            log.debug('poline count', poLineCount);

            for (var i = 0; i < poLineCount; i++) {
                var poLine = new Object();
                poLine.item = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                poLine.quantity = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
                poLine.rate = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                });
                poLine.synnexsku = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ctc_vcsp_sku_dell',
                    line: i
                });
                log.debug('synnex sku', poLine.synnexsku);
                poLineArray.push(poLine);
            }

            if (poLineArray) {
                for (var i = 0; i < poLineArray.length; i++) {
                    xmlLineItems +=
                        '<Items>' +
                        '<Item lineNumber="' +
                        Number(i + 1) +
                        '">' +
                        '<SKU>' +
                        poLineArray[i].item +
                        '</SKU>' + //change to custom field SKU for Synnex on item record
                        '<UnitPrice>' +
                        poLineArray[i].rate +
                        '</UnitPrice>' +
                        '<OrderQuantity>' +
                        poLineArray[i].quantity +
                        '</OrderQuantity>' +
                        '</Item>' +
                        '</Items>';
                }
            }

            xmlHeader =
                '<?xml version="1.0" encoding="UTF-8" ?>' +
                '<SynnexB2B>' +
                '<Credential>' +
                '<UserID>' +
                userName +
                '</UserID>' +
                '<Password>' +
                password +
                '</Password>' +
                '</Credential>';

            xmlBody =
                '<OrderRequest>' +
                '<CustomerNumber>' +
                customerNo +
                '</CustomerNumber>' +
                '<PONumber>' +
                endUserPONumber +
                '</PONumber>' +
                '<DropShipFlag>' +
                dropShipFlag +
                '</DropShipFlag>' +
                '<Shipment>' +
                '<ShipFromWarehouse>' +
                shipFromWarehouse +
                '</ShipFromWarehouse>' +
                '<ShipTo>' +
                '<AddressName1>' +
                shipAddressLabel +
                '</AddressName1>' +
                '<AddressName2 />' +
                '<AddressLine1>' +
                shipAddressLine1 +
                '</AddressLine1>' +
                '<AddressLine2>' +
                shipAddressLine2 +
                '</AddressLine2>' +
                '<City>' +
                shipAddressCity +
                '</City>' +
                '<State>' +
                shipAddressState +
                '</State>' +
                '<ZipCode>' +
                shipAddressZipCode +
                '</ZipCode>' +
                '<Country>' +
                shipAddressCountryCode +
                '</Country>' +
                '</ShipTo>' +
                '<ShipToContact>' +
                '<ContactName>' +
                shipToContact +
                '</ContactName>' +
                '<PhoneNumber>' +
                shipToPhone +
                '</PhoneNumber>' +
                '<EmailAddress>' +
                shipToEmail +
                '</EmailAddress>' +
                '</ShipToContact>' +
                '<ShipMethod>' +
                '<Code>' +
                shipMethodCode +
                '</Code>' +
                '</ShipMethod>' +
                '</Shipment>' +
                '<Payment>' +
                '<BillTo code="' +
                customerNo +
                '"></BillTo>' +
                '</Payment>' +
                '<EndUserPONumber>' +
                endUserPONumber +
                '</EndUserPONumber>' +
                '<Comment>' +
                poMemo +
                '</Comment>' +
                xmlLineItems +
                '</OrderRequest>';

            xmlFooter = '</SynnexB2B>';

            xmlSendPO = xmlHeader + xmlBody + xmlFooter;

            log.debug('Synnex Send PO XML String', xmlSendPO);

            vcLog.recordLog({
                header: 'Request',
                body: xmlSendPO,
                transaction: recPO.id
            });

            try {
                var http_response = https.post({
                    url: requestURL,
                    body: xmlSendPO,
                    headers: headers
                });
                responseXML = http_response.body;
                log.debug({
                    title: 'Synnex Send PO Response',
                    details: 'length of response ' + responseXML.length
                });
            } catch (err) {
                log.error({
                    title: 'Synnex Send PO Error',
                    details: 'error = ' + err.message
                });
                responseXML = null;
            }

            //Simulate dummy response
            // responseXML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            //     '<SynnexB2B>\n' +
            //     '   <OrderResponse>\n' +
            //     '      <CustomerNumber>539916</CustomerNumber>\n' +
            //     '      <PONumber>18904</PONumber>\n' +
            //     '      <Code>accepted</Code>\n' +
            //     '      <ResponseDateTime>2020-04-15T13:00:43</ResponseDateTime>\n' +
            //     '      <ResponseElapsedTime>2.17s</ResponseElapsedTime>\n' +
            //     '      <Items>\n' +
            //     '         <Item lineNumber="1">\n' +
            //     '            <SKU>50253</SKU>\n' +
            //     '            <OrderQuantity>5</OrderQuantity>\n' +
            //     '            <Code>accepted</Code>\n' +
            //     '            <OrderNumber>98187620</OrderNumber>\n' +
            //     '            <OrderType>99</OrderType>\n' +
            //     '            <ShipFromWarehouse />\n' +
            //     '            <SynnexInternalReference>POLINEQC,A-SALESPND---SKUERR,A-SALESPND</SynnexInternalReference>\n' +
            //     '         </Item>\n' +
            //     '      </Items>\n' +
            //     '   </OrderResponse>\n' +
            //     '</SynnexB2B>';

            var responseObj = { code: null, body: 'null' };

            var synnexResponseData;
            synnexResponseData = getSynnexResponse(responseXML);

            //TODO: put response code here for success and fail or duplicate message, also include PO ID posted on Synnex system
            if (synnexResponseData.code == 'accepted') {
                //success
                responseObj.code = 200;
                //responseObj.body = 'Status: ' + synnexResponseData.code + ' New PO Number: ' + synnexResponseData.poid;
                responseObj.body = null; //null message apparently means there's no error message, this is how the API is used
            } else {
                //failed
                responseObj.code = 400;
                responseObj.body =
                    'Status: ' + synnexResponseData.code + ' Reason: ' + synnexResponseData.reason;
            }

            responseMessage = new response({
                code: responseObj.code,
                message: responseObj.body
            });

            //Update NS Field custbody_ctc_vcsp_transaction_num with Synnex PO ID
            poRecord.setValue({
                fieldId: 'custbody_ctc_vcsp_transaction_num',
                value: synnexResponseData.poid
            });

            poRecord.save();

            log.debug('Synnex Send PO HTTP Response', responseXML);
        } catch (mainerr) {
            log.error({
                title: 'Synnex CRITCAL Send PO Error',
                details: 'error = ' + mainerr.message
            });
        }

        return responseMessage;
    }

    return {
        process: process
    };
});
