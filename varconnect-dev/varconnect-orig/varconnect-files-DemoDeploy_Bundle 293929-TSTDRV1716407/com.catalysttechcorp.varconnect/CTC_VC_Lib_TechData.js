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
		
        log.debug({
            title: 'Tech Data Scheduled',
            details: 'requestTechData'
        });

        var xmlInvoiceByPOStatus;

        var responseVersion = "1.8";

        var orderXMLLineData = [];

        xmlInvoiceByPOStatus =
            "<XML_InvoiceDetailByPO_Submit>" +
            "<Header>" +
            "<UserName>"+userName+"</UserName>" +
            "<Password>"+password+"</Password>" +
            "</Header>" +
            "<Detail>" +
            "<POInfo>" +
            "<PONbr>" + poNum + "</PONbr>" +
            "</POInfo>" +
            "</Detail>" +
            "</XML_InvoiceDetailByPO_Submit>";

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        var responseXML;
        try {
            var response = https.post({
                url: requestURL,
                body: xmlInvoiceByPOStatus,
                headers: headers

            });
            responseXML = response.body ;
            log.debug({
                title: 'Tech Data Scheduled',
                details: 'length of response '+responseXML.length
            });

            // Remove first two lines of XML response
            responseXML = responseXML.substring(responseXML.indexOf("\n") + 1);
            responseXML = responseXML.substring(responseXML.indexOf("\n") + 1);

        }
        catch (err) {
            log.error({
                title: 'Tech Data Scheduled',
                details: 'error = '+err.message
            });
            responseXML = null;
        }

        return responseXML;
	}

	
	function processResponse(options) {
        var xmlString = options.responseXML;
        log.debug({
            title: 'Tech Data Scheduled',
            details: 'parseTechData'
        });
        
        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemArray = [];
        var xmlDoc = xml.Parser.fromString({
            text : xmlString
        });

        if (xmlDoc != null){
            var itemInfoNodes = xml.XPath.select({node:xmlDoc, xpath:'//ItemInfo'});

            if (itemInfoNodes != null) {
                // Loop through each item node, get XML data fields, store them in xml_items array
                for (var j = 0; j < itemInfoNodes.length; j++) {
                    // Create array to hold the xml line item info
                    var xml_items = {line_num:"NA", item_num:"NA", order_num:"NA", order_date:"NA", order_eta:"NA", ship_date:"NA", ship_qty:"NA", tracking_num:"NA", vendorSKU: "NA", carrier:"NA", serial_num:"NA"};

                    var orderInfoNode = itemInfoNodes[j].parentNode.parentNode;

                    var orderNum = util.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'InvoiceNbr'})[0]);
                    //var orderNum = util.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'OrderNbr'})[0]);
                    if (orderNum != null && orderNum.length > 0) { xml_items.order_num = orderNum; }
                    
                    var orderDate = util.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'OrderDate'})[0]);
                    if (orderDate != null && orderDate.length > 0) { xml_items.order_date = orderDate; }
                    
                    var eta = util.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'EstShipDate'})[0]);
                    if (eta != null && eta.length > 0) { xml_items.order_eta = eta; }

                    // Goto ItemInfo parent (ContainerInfo) to get particular data
                    var containerInfoNode = itemInfoNodes[j].parentNode;
                    var containerID = util.getNodeTextContent(xml.XPath.select({node:containerInfoNode, xpath:'ContainerID'})[0]);
                    if (containerID != null && containerID.length > 0) { xml_items.tracking_num = containerID; }

                    var dateShipped = util.getNodeTextContent(xml.XPath.select({node:containerInfoNode, xpath:'DateShipped'})[0]);
                    if (dateShipped != null && dateShipped.length > 0) { xml_items.ship_date = dateShipped; }

                    var warehouse = util.getNodeTextContent(xml.XPath.select({node:containerInfoNode, xpath:'WhseDesc'})[0]);
                    if (warehouse != null && warehouse == 'VENDOR SUPPLIED') { xml_items.carrier = 'VENDOR SUPPLIED'; }

                    var carrier = util.getNodeTextContent(xml.XPath.select({node:containerInfoNode, xpath:'ShipViaDesc'})[0]);
                    if (carrier != null && carrier.length > 0) { xml_items.carrier = carrier; }

                    var orderLineNumber = util.getNodeTextContent(xml.XPath.select({node:itemInfoNodes[j], xpath:'OrderLineNbr'})[0]);
                    // Tech data not consistent in returning order line numbers
                    var itemNumber = util.getNodeTextContent(xml.XPath.select({node:itemInfoNodes[j], xpath:'MfgItemNbr'})[0]);
                    if (itemNumber != null && itemNumber.length > 0) { xml_items.item_num = itemNumber; }
                    var vendorSKU = util.getNodeTextContent(xml.XPath.select({node:itemInfoNodes[j], xpath:'TechDataItemNbr'})[0]);
                    if (vendorSKU != null && vendorSKU.length > 0) { xml_items.vendorSKU = vendorSKU; }

                    var shipQty = util.getNodeTextContent(xml.XPath.select({node:itemInfoNodes[j], xpath:'QtyShipped'})[0]);
                    if (shipQty != null && shipQty.length > 0) { xml_items.ship_qty = shipQty; }


                    var serialNumberInfo = util.getNodeTextContent(xml.XPath.select({node:itemInfoNodes[j], xpath:'SerialNbrInd'})[0]);
                    //if (serialNumberInfo != null && serialNumberInfo =='Y') {

                        var serialNumberInfoNode = xml.XPath.select({node:itemInfoNodes[j], xpath:'SerialNbrInfo'});
                        if (serialNumberInfoNode != null && serialNumberInfoNode.length > 0) {
                            var serialNumberNodes = xml.XPath.select({node:serialNumberInfoNode[0], xpath:'SerialNbr'});

                            //log.debug('serialNumberNodes', serialNumberNodes);

                            for (var x = 0; x < serialNumberNodes.length; x++) {
                                //var serialNumber = new Array();
                                //serialNumber = String(serialNumberNodes[x].firstChild);
                                var serialNumber = serialNumberNodes[x].textContent

                                //if (serialNumber != null && serialNumber.substring(8).length > 0 )  {
                                if (serialNumber != null && serialNumber.substring(8).length > 0 )  {
                                    if (xml_items.serial_num === 'NA')
                                        xml_items.serial_num = serialNumber;
                                  //      xml_items.serial_num = serialNumber.substring(8);
                                    else
                                        xml_items.serial_num += ',' + serialNumber
                                    //    xml_items.serial_num += ',' + serialNumber.substring(8);
                                }
                            }
                        }
                    //}

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