/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @author ajdeleon
 **/

/*jshint esversion: 9 */
define(function (require) {
    //load modules
    var xml = require('N/xml');
    var https = require('N/https');
    var vc2_util = require('../../CTC_VC2_Lib_Utils');

    //declare variables
    var headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://WebService.jenne.com/GetInvoices_v2'
    };
    var TransId = '';
    var Helper = {};
    var EntryPoint = {};

    EntryPoint.processXml = function (input, config) {
        TransId = input;
        var xmlContent = getInvoiceXml(config);
        var arrData = convertToJson(xmlContent);
        return arrData;
    };

    function getInvoiceXml(config) {
        var stLogTitle = 'jenne_api:getInvoiceXml';
        var body = '';
        body += '<?xml version="1.0" encoding="utf-8"?>';
        body +=
            '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">';
        body += '<soap:Body>';
        body += '<GetInvoices_v2 xmlns="http://WebService.jenne.com">';
        body += '<email>' + config.user_id + '</email>';
        body += '<password>' + config.user_pass + '</password>';
        body += '<poNumber>' + config.poNum + '</poNumber>';
        body += '</GetInvoices_v2>';
        body += '</soap:Body>';
        body += '</soap:Envelope>';
        var objResponse = https.post({
            url: config.url,
            headers: headers,
            body: body
        });
        log.debug(TransId + ' | ' + stLogTitle + ' | body', body);
        log.debug(TransId + ' | ' + stLogTitle + ' | objResponse', objResponse);
        return objResponse.body;
    }

    function convertToJson(xmlContent) {
        var stLogTitle = 'jenne_api:convertToJson';

        if (!xmlContent) {
            return;
        }

        //parse xml
        var objXmlData = xml.Parser.fromString(xmlContent);

        //get body
        var arrNodes = xml.XPath.select({
            node: objXmlData,
            xpath: '/soap:Envelope/soap:Body'
        });

        var arrData = [];

        //should only return 1 length.
        for (var i = 0; i < arrNodes.length; i++) {
            var objData = {};

            //get invoice tag
            var arrInvoices = arrNodes[i].getElementsByTagName({
                tagName: 'InvoiceV2'
            });

            //for each invoice child tag, get data
            for (var a = 0; a < arrInvoices.length; a++) {
                var invoiceChildNode = arrInvoices[a];

                //set values
                objData.po = Helper.getTagContent(invoiceChildNode, 'PONumber');
                objData.date = Helper.getTagContent(
                    invoiceChildNode,
                    'OrderDate'
                );
                objData.invoice = Helper.getTagContent(
                    invoiceChildNode,
                    'InvoiceNumber'
                );
                objData.total = vc2_util.parseFloat(
                    Helper.getTagContent(invoiceChildNode, 'InvoiceAmount')
                );
                objData.charges = {
                    tax: vc2_util.parseFloat(
                        Helper.getTagContent(invoiceChildNode, 'TaxAmount')
                    ),
                    shipping: vc2_util.parseFloat(
                        Helper.getTagContent(invoiceChildNode, 'FreightAmount')
                    ),
                    other: ''
                };

                //get item lines
                var arrLines = invoiceChildNode.getElementsByTagName({
                    tagName: 'InvoiceLineV2'
                });

                //set array for lines
                objData.lines = [];

                //for each invoice line, store the value
                for (var n = 0; n < arrLines.length; n++) {
                    var itemNode = arrLines[n];

                    //store data
                    objData.lines.push({
                        ITEMNO: Helper.getTagContent(itemNode, 'PartNumber'),
                        PRICE: vc2_util.parseFloat(
                            Helper.getTagContent(itemNode, 'UnitPrice')
                        ),
                        QUANTITY: vc2_util.parseFloat(
                            Helper.getTagContent(itemNode, 'QuantityOrdered')
                        ),
                        DESCRIPTION: Helper.getTagContent(
                            itemNode,
                            'PartDescription'
                        ),
                        //if serial has a value, split using ',' and then remove empty array value
                        SERIAL: Helper.getTagContent(itemNode, 'SerialNumbers')
                            ? Helper.getTagContent(itemNode, 'SerialNumbers')
                                  .split(',')
                                  .filter(Boolean)
                            : ''
                    });
                } //for each invoice line

                arrData.push({
                    ordObj: objData,
                    xmlStr: xmlContent
                });
            } //for each invoice
        } //body

        log.debug(TransId + ' | ' + stLogTitle, arrData);
        return arrData;
    }

    Helper.getTagContent = function (node, name) {
        var arrNode = node.getElementsByTagName({ tagName: name });
        if (Array.isArray(arrNode) && typeof arrNode[0] !== 'undefined') {
            return arrNode[0].textContent;
        }
    };

    return EntryPoint;
});
