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
 * 
 *//**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/runtime', 'N/record', 'N/xml','N/https', './VC_Globals.js', './CTC_VC_Constants.js', './CTC_VC_Lib_Utilities.js'],
function(search, runtime, r, xml, https, vcGlobals, constants, util) {
	function processRequest(options) {
		var poNum = options.poNum,
			vendorConfig = options.vendorConfig,
			requestURL = vendorConfig.endPoint,
			userName = vendorConfig.user,
			password = vendorConfig.password;
        log.debug("request d and h");

        var xmlorderStatus;
        var xmlInvoiceByPOStatus;

        var orderXMLLineData = [];

        xmlorderStatus =
            '<XMLFORMPOST>' +
            '<REQUEST>orderStatus</REQUEST>' +
            '<LOGIN>' +
            '<USERID>' + userName + '</USERID>' +
            '<PASSWORD>' + password + '</PASSWORD>' +
            '</LOGIN>' +
            '<STATUSREQUEST>' +
            '<PONUM>' + poNum + '</PONUM>' +
            '</STATUSREQUEST>' +
            '</XMLFORMPOST>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        var responseXML;
        try {
            var response = https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers

            });
            responseXML = response.body ;
            log.debug({
                title: 'D and H Scheduled',
                details: 'DandH response length '+responseXML.length
            });

        }
        catch (err) {
            log.debug({
                title: 'D and H Scheduled',
                details: 'DandH scheduled error = '+err.message
            });
            responseXML = null;
        }

        return responseXML;
	}
	
	function processResponse(options) {
        var xmlString = options.responseXML;
        log.debug({
            title: 'D and H Scheduled',
            details: 'ParseDandH'
        });

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemArray = [];
        var xmlDoc = xml.Parser.fromString({
            text : xmlString
        });

        if (xmlDoc != null){
            var itemNodes = xml.XPath.select({node:xmlDoc, xpath:'//DETAILITEM'});
            if (itemNodes != null && itemNodes.length > 0) {
                for (var i = 0; i < itemNodes.length; i++) {
                    var xml_items = {line_num:"NA", item_num:"NA", order_num:"NA", order_date:"NA", order_eta:"NA", ship_date:"NA", ship_qty:"NA", tracking_num:"NA", vendorSKU: "NA", carrier:"NA", serial_num:"NA"};

                    var itemNum = util.getNodeTextContent(xml.XPath.select({node:itemNodes[i], xpath:'ITEMNO'})[0]);
                    if (itemNum != null && itemNum.length > 0) { xml_items.item_num = itemNum; }
                    
                    //D&H does not support a separate vendorSKU as of Jan 9 2019
                    
                    var shipQty = util.getNodeTextContent(xml.XPath.select({node:itemNodes[i], xpath:'QUANTITY'})[0]);
                    if (shipQty != null && shipQty.length > 0) { xml_items.ship_qty = shipQty; }

                    var orderStatusNode = itemNodes[i].parentNode.parentNode;

                    var orderNum = util.getNodeTextContent(xml.XPath.select({node:orderStatusNode, xpath:'ORDERNUM'})[0]);
                    if (orderNum != null && orderNum.length > 0) { xml_items.order_num = orderNum; }

                    var orderDateTime = util.getNodeTextContent(xml.XPath.select({node:orderStatusNode, xpath:'DATE'})[0]);
                    if (orderDateTime != null && orderDateTime.length > 0) { xml_items.order_date = orderDateTime; }

                    var packageNodes = xml.XPath.select({node:orderStatusNode, xpath:'PACKAGE'})
                    if (packageNodes != null && packageNodes.length > 0) {
                        for (var j = 0; j < packageNodes.length; j++) {
                            var itemInPackage = false;
                            var shipItemNodes = xml.XPath.select({node:packageNodes[j], xpath:'SHIPITEM'});
                            if (shipItemNodes != null && shipItemNodes.length > 0) {
                                for (var x = 0; x < shipItemNodes.length; x++) {
                                    if ( xml.XPath.select({node:shipItemNodes[x], xpath:'SHIPITEMNO'})[0].textContent == itemNum) {
                                        itemInPackage = true;
                                        var serialNum = util.getNodeTextContent(xml.XPath.select({node:shipItemNodes[x], xpath:'SERIALNO'})[0])
                                        if (serialNum != null && serialNum.length > 0) {
                                            if (xml_items.serial_num == 'NA')
                                                xml_items.serial_num = serialNum;
                                            else
                                                xml_items.serial_num += ',' + serialNum;
                                        }

                                    }
                                }
                            }
                            if (itemInPackage) {
                                var carrier = xml.XPath.select({node:packageNodes[j], xpath:'CARRIER'})[0].textContent;
                                if (carrier != null && carrier.length > 0) {
                                    var carrierService = util.getNodeTextContent(xml.XPath.select({node:packageNodes[j], xpath:'SERVICE'})[0]);
                                    if (carrierService != null && carrierService.length > 0) {
                                        if (xml_items.carrier == 'NA')
                                            xml_items.carrier = carrier + ' - ' + carrierService;
                                        else
                                            xml_items.carrier += ',' + carrier + ' - ' + carrierService;
                                    }
                                    else {
                                        if (xml_items.carrier == 'NA')
                                            xml_items.carrier = carrier;
                                        else
                                            xml_items.carrier += ',' + carrier;
                                    }
                                }
                                var trackingNum = util.getNodeTextContent(xml.XPath.select({node:packageNodes[j], xpath:'TRACKNUM'})[0]);
                                if (trackingNum != null && trackingNum.length > 0) {
                                    if (xml_items.tracking_num == 'NA')
                                        xml_items.tracking_num = trackingNum;
                                    else
                                        xml_items.tracking_num += ',' + trackingNum;
                                }

                                var dateShipped = util.getNodeTextContent(xml.XPath.select({node:packageNodes[j], xpath:'DATESHIPPED'})[0]);
                                if (dateShipped != null && dateShipped.length > 0) {
                                    if (xml_items.ship_date == 'NA')
                                        xml_items.ship_date = dateShipped;
                                    else
                                        xml_items.ship_date += ',' + dateShipped;
                                }
                            }
                        }
                    }
                    itemArray.push(xml_items);
                }
            }
        }

        return itemArray;
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
		if (responseXML)
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