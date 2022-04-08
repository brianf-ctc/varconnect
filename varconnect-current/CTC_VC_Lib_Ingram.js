/**
 * Copyright (c) 2017 Catalyst Tech Corp
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
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 * 2.00		May 5, 2021		paolodl		Country code added for Canada
 *
 */ /**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/xml',
    'N/https',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Utilities.js'
], function (search, runtime, r, xml, https, vcGlobals, constants, util) {
    function processRequest(options) {
        var poNum = options.poNum,
            vendorConfig = options.vendorConfig,
            country = options.country,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            customerNo = vendorConfig.customerNo;

        log.debug({
            title: 'Ingram Micro Scheduled',
            details: 'requestIngramMicro'
        });

        var xmlorderStatus;

        var poNum = poNum;
        var branchOrderNumber = '';

        var countryCode = 'MD';
        if (country) {
            if (country == constants.Lists.COUNTRY.CANADA) countryCode = 'FT';
        } else if (vcGlobals.COUNTRY == 'CA') countryCode = 'FT';

        log.debug({
            title: 'Ingram Micro Scheduled',
            details: 'poNum = ' + poNum
        });

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        //get branch order number
        xmlorderStatus =
            '<OrderStatusRequest>' +
            '<Version>2.0</Version>' +
            '<TransactionHeader>' +
            '<SenderID>123456789</SenderID>' +
            '<ReceiverID>987654321</ReceiverID>' +
            '<CountryCode>' +
            countryCode +
            '</CountryCode>' +
            '<LoginID>' +
            userName +
            '</LoginID>' +
            '<Password>' +
            password +
            '</Password>' +
            '<TransactionID>54321</TransactionID>' +
            '</TransactionHeader>' +
            '<OrderHeaderInfo>' +
            '<CustomerPO>' +
            poNum +
            '</CustomerPO>' +
            '</OrderHeaderInfo>' +
            '</OrderStatusRequest>';
        try {
            var orderNumberResponse = https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            });
            var orderNumberXML = xml.Parser.fromString({
                text: orderNumberResponse.body
            });
            log.debug('orderNumberResponse', orderNumberResponse);
            log.debug('orderNumberXML', orderNumberXML);

            branchOrderNumber = xml.XPath.select({
                node: orderNumberXML,
                xpath: '//BranchOrderNumber'
            })[0].textContent;
        } catch (err) {
            log.debug({
                title: 'Ingram Micro Scheduled',
                details:
                    'requestIngramMicro could not retrieve branchOrderNumber error = ' + err.message
            });
            branchOrderNumber = null;
        }

        if (branchOrderNumber != null) {
            var orderXMLLineData = [];

            var xmlorderDetailStatus =
                '<OrderDetailRequest>' +
                '<Version>2.0</Version>' +
                '<TransactionHeader>' +
                '<SenderID>123456789</SenderID>' +
                '<ReceiverID>987654321</ReceiverID>' +
                '<CountryCode>MD</CountryCode>' +
                '<LoginID>' +
                userName +
                '</LoginID>' +
                '<Password>' +
                password +
                '</Password>' +
                '<TransactionID>54321</TransactionID>' +
                '</TransactionHeader>' +
                '<OrderHeaderInfo>' +
                '<BranchOrderNumber>' +
                branchOrderNumber +
                '</BranchOrderNumber>' +
                '<OrderSuffix/>' +
                '<CustomerPO>' +
                poNum +
                '</CustomerPO>' +
                '</OrderHeaderInfo>' +
                '<ShowDetail>2</ShowDetail>' +
                '</OrderDetailRequest>';

            var orderTrackingRequest =
                '<OrderTrackingRequest>' +
                '<Version>2.0</Version>' +
                '<TransactionHeader>' +
                '<SenderID>123456789</SenderID>' +
                '<ReceiverID>987654321</ReceiverID>' +
                '<CountryCode>MD</CountryCode>' +
                '<LoginID>' +
                userName +
                '</LoginID>' +
                '<Password>' +
                password +
                '</Password>' +
                '<TransactionID>54321</TransactionID>' +
                '</TransactionHeader>' +
                '<TrackingRequestHeader>' +
                '<BranchOrderNumber>' +
                branchOrderNumber +
                '</BranchOrderNumber>' +
                '<OrderSuffix/>' +
                '<CustomerPO>' +
                poNum +
                '</CustomerPO>' +
                '</TrackingRequestHeader>' +
                '<ShowDetail>2</ShowDetail>' +
                '</OrderTrackingRequest>';

            var responseXML;
            var trackingXML;
            try {
                var response = https.post({
                    url: requestURL,
                    body: xmlorderDetailStatus,
                    headers: headers
                });
                responseXML = response.body;

                trackingXML = https.post({
                    url: requestURL,
                    body: orderTrackingRequest,
                    headers: headers
                }).body;

                log.debug({
                    title: 'Ingram Micro Scheduled',
                    details: 'Ingram Micro response length ' + responseXML.length
                });
                log.debug({
                    title: 'Ingram Micro Scheduled',
                    details: 'Ingram Micro tracking length ' + trackingXML.length
                });
            } catch (err) {
                log.debug({
                    title: 'Ingram Micro Scheduled',
                    details: 'requestIngramMicro error = ' + err.message
                });

                responseXML = null;
                trackingXML = null;
            }
            return { detailxml: responseXML, trackxml: trackingXML };
        }

        return { detailxml: null, trackxml: null };
    }

    function processResponse(options) {
        var xmlString = options.responseXML;
        log.debug({
            title: 'Ingram Micro Scheduled',
            details: 'parseIngramMicro'
        });

        var xmlTextIN = xmlString.detailxml;
        var trackingXMLIN = xmlString.trackxml;

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var xmlDoc = xml.Parser.fromString({
            text: xmlTextIN
        });
        var trackingXML = xml.Parser.fromString({
            text: trackingXMLIN
        });

        var lineData = [];
        var trackingLineData = [];

        //from this point down, make sure things that are being used as nodes are actually nodes
        if (trackingXML != null) {
            var skuNodes = xml.XPath.select({ node: trackingXML, xpath: '//SKU' });
            for (var j = 0; j < skuNodes.length; j++) {
                var trackingInfo = { sku_num: 'NA', tracking_num: 'NA', order_num: 'NA' };

                var skuNum = util.getNodeTextContent(skuNodes[j]);
                trackingInfo.sku_num = skuNum;

                var packageNode = skuNodes[j].parentNode.parentNode.parentNode;
                var orderNode = packageNode.parentNode;

                trackingInfo.tracking_num = packageNode.getAttribute({ name: 'ID' });
                trackingInfo.order_num = orderNode.getAttribute({ name: 'SuffixNumber' });
                trackingLineData.push(trackingInfo);
            }
        }
        if (xmlDoc != null) {
            var itemNodes = xml.XPath.select({ node: xmlDoc, xpath: '//ProductLine' });
            var orderDateTime = util.getNodeTextContent(
                xml.XPath.select({ node: xmlDoc, xpath: '//OrderEntryDate' })[0]
            );
            var orderNum = util.getNodeTextContent(
                xml.XPath.select({ node: xmlDoc, xpath: '//BranchOrderNumber' })[0]
            );

            for (var i = 0; i < itemNodes.length; i++) {
                var xml_items = {
                    line_num: 'NA',
                    item_num: 'NA',
                    order_num: 'NA',
                    order_date: 'NA',
                    order_eta: 'NA',
                    ship_date: 'NA',
                    ship_qty: 'NA',
                    tracking_num: 'NA',
                    vendorSKU: 'NA',
                    carrier: 'NA',
                    serial_num: 'NA',
                    order_status: 'NA'
                };

                var itemLineNode = itemNodes[i];

                // Goto itemLineNode grand parent (OrderSuffix) to get Carrier & Ship Date
                var orderSuffixNode = itemLineNode.parentNode.parentNode;
                var orderSuffixID = orderSuffixNode.getAttribute({ name: 'ID' });

                if (orderNum != null && orderNum.length > 0) {
                    xml_items.order_num = orderNum + '-' + orderSuffixID;
                }
                if (orderDateTime != null && orderDateTime.length > 0) {
                    xml_items.order_date = orderDateTime;
                }

                // Ingram Micro line nums start at 000?  Ingram Micro not returning PO Line Numnbers
                var itemNum = util.getNodeTextContent(
                    xml.XPath.select({ node: itemLineNode, xpath: 'ManufacturerPartNumber' })[0]
                );
                if (itemNum != null && itemNum.length > 0) {
                    xml_items.item_num = itemNum;
                }

                var vendorSKU = util.getNodeTextContent(
                    xml.XPath.select({ node: itemLineNode, xpath: 'SKU' })[0]
                );
                if (vendorSKU != null && vendorSKU.length > 0) {
                    xml_items.vendorSKU = vendorSKU;
                }

                var shipQty = util.getNodeTextContent(
                    xml.XPath.select({ node: itemLineNode, xpath: 'ShipQuantity' })[0]
                );
                if (shipQty != null && shipQty.length > 0) {
                    xml_items.ship_qty = shipQty;
                }

                //                log.debug('xml_items.ship_qty', xml_items.ship_qty);
                var orderStatus = util.getNodeTextContent(
                    xml.XPath.select({ node: orderSuffixNode, xpath: 'OrderStatus' })[0]
                );
                if (orderStatus != null && orderStatus.length > 0) {
                    xml_items.order_status = orderStatus;
                }
                log.debug('xml_items.order_status', xml_items.order_status);

                var carrier = util.getNodeTextContent(
                    xml.XPath.select({ node: orderSuffixNode, xpath: 'Carrier' })[0]
                );
                if (carrier != null && carrier.length > 0) {
                    xml_items.carrier = carrier;
                }

                var shipDate = util.getNodeTextContent(
                    xml.XPath.select({ node: orderSuffixNode, xpath: 'OrderShipDate' })[0]
                );
                if (shipDate != null && shipDate.length > 0) {
                    xml_items.ship_date = shipDate;
                }

                var serialNumberNodes = xml.XPath.select({
                    node: itemLineNode,
                    xpath: 'SkuSerialNumber'
                });
                if (serialNumberNodes != null && serialNumberNodes.length > 0) {
                    var serialChildrenNodes = xml.XPath.select({
                        node: serialNumberNodes[0],
                        xpath: 'SerialNumber'
                    });
                    for (var x = 0; x < serialChildrenNodes.length; x++) {
                        if (serialChildrenNodes[x].firstChild != null) {
                            var serialNum = String(serialChildrenNodes[x].firstChild.textContent);

                            //						Sometimes Ingram returns serial nums with a prefix: 'SER#: '
                            //						For now we're just going to grab the whole serail num field
                            //						serialNum = serialNum.substring(6, serialNum.length);
                        } else var serialNum = null;
                        if (serialNum != null && serialNum.length > 0) {
                            if (xml_items.serial_num === 'NA') xml_items.serial_num = serialNum;
                            else xml_items.serial_num += ',' + serialNum;
                        }
                    }
                }

                var currentSKUNum = util.getNodeTextContent(
                    xml.XPath.select({ node: itemLineNode, xpath: 'SKU' })[0]
                );

                if (currentSKUNum != null && currentSKUNum.length > 0) {
                    if (trackingLineData != null && trackingLineData.length > 0) {
                        for (var y = 0; y < trackingLineData.length; y++) {
                            if (
                                currentSKUNum === trackingLineData[y].sku_num &&
                                orderSuffixID == trackingLineData[y].order_num
                            ) {
                                if (xml_items.tracking_num === 'NA')
                                    xml_items.tracking_num = trackingLineData[y].tracking_num;
                                else {
                                    if (
                                        xml_items.tracking_num.indexOf(
                                            trackingLineData[y].tracking_num
                                        ) < 0
                                    ) {
                                        xml_items.tracking_num +=
                                            ',' + trackingLineData[y].tracking_num;
                                        log.debug({
                                            title: 'Ingram Micro Scheduled',
                                            details:
                                                'xml_items.tracking_num = ' + xml_items.tracking_num
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                //Only process if order status is either Invoiced, Shipped, Billed, or Paid
                if (['Invoiced', 'Shipped', 'Billed', 'Paid'].indexOf(xml_items.order_status) < 0) {
                    log.audit(
                        'skipping line due to status',
                        'itemNum: ' + xml_items.item_num + ' | sku: ' + xml_items.vendorSKU
                    );
                    continue;
                }

                lineData.push(xml_items);
            }
        }
        return lineData;
    }

    function process(options) {
        var poNum = options.poNum,
            vendorConfig = options.vendorConfig,
            outputArray = null;
        var responseXML = processRequest({
            poNum: poNum,
            vendorConfig: vendorConfig
        });

        log.debug('process responseXML ' + poNum, responseXML);
        if (responseXML.detailxml)
            outputArray = processResponse({
                vendorConfig: vendorConfig,
                responseXML: responseXML
            });

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
