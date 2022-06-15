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

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 *
 */

define([
    'N/xml',
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils.js'
], function (ns_xml, VC_Log, VC_Global, VC2_Utils) {
    var LogTitle = 'WS:TechData';

    function processRequest(option) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, option);

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            returnValue;

        try {
            var invoiceDetailReq = VC2_Utils.sendRequest({
                header: [LogTitle, 'InvoiceDetailByPO'].join(' : '),
                method: 'post',
                query: {
                    url: requestURL,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'Content-Length': 'length'
                    },
                    body:
                        '<XML_InvoiceDetailByPO_Submit>' +
                        '<Header>' +
                        ('<UserName>' + userName + '</UserName>') +
                        ('<Password>' + password + '</Password>') +
                        '</Header>' +
                        '<Detail>' +
                        '<POInfo>' +
                        ('<PONbr>' + poNum + '</PONbr>') +
                        '</POInfo>' +
                        '</Detail>' +
                        '</XML_InvoiceDetailByPO_Submit>'
                },
                recordId: option.poId
            });

            if (invoiceDetailReq.isError) throw invoiceDetailReq.errorMsg;
            var invoiceDetailResp = invoiceDetailReq.RESPONSE.body;

            // Remove first two lines of XML response
            invoiceDetailResp = invoiceDetailResp.substring(invoiceDetailResp.indexOf('\n') + 1);
            invoiceDetailResp = invoiceDetailResp.substring(invoiceDetailResp.indexOf('\n') + 1);

            returnValue = invoiceDetailResp;
        } catch (error) {
            var errorMsg = VC2_Utils.extractError(error);
            VC_Log.recordLog({
                header: [LogTitle + ': Error', errorMsg].join(' - '),
                body: JSON.stringify(error),
                transaction: option.poId,
                status: VC_Global.Lists.VC_LOG_STATUS.ERROR
            });
        }

        return returnValue;
    }

    function processResponse(option) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var xmlString = option.responseXML;

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemArray = [];
        var xmlDoc = ns_xml.Parser.fromString({
            text: xmlString
        });

        if (xmlDoc == null) {
            VC2_Utils.vcLog({
                recordId: option.poId,
                title: [LogTitle, 'Request Error'].join('::'),
                error: err
            });
            return itemArray;
        }

        var itemInfoNodes = ns_xml.XPath.select({
            node: xmlDoc,
            xpath: '//ItemInfo'
        });

        if (itemInfoNodes == null) {
            log.error(logTitle, '>> Empty Item Notes ...');
            return itemArray;
        }

        // Loop through each item node, get XML data fields, store them in xml_items array
        for (var j = 0; j < itemInfoNodes.length; j++) {
            // Create array to hold the xml line item info
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
                status: 'NA'
            };

            var orderInfoNode = itemInfoNodes[j].parentNode.parentNode;

            var orderNum = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'InvoiceNbr'
                })[0]
            );
            //var orderNum = VC2_Utils.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'OrderNbr'})[0]);
            if (orderNum != null && orderNum.length > 0) {
                xml_items.order_num = orderNum;
            }

            var orderDate = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'OrderDate'
                })[0]
            );
            if (orderDate != null && orderDate.length > 0) {
                xml_items.order_date = orderDate;
            }

            var eta = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'EstShipDate'
                })[0]
            );
            if (eta != null && eta.length > 0) {
                xml_items.order_eta = eta;
            }

            // Goto ItemInfo parent (ContainerInfo) to get particular data
            var containerInfoNode = itemInfoNodes[j].parentNode;
            var containerID = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'ContainerID'
                })[0]
            );
            if (containerID != null && containerID.length > 0) {
                xml_items.tracking_num = containerID;
            }

            var dateShipped = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'DateShipped'
                })[0]
            );
            if (dateShipped != null && dateShipped.length > 0) {
                xml_items.ship_date = dateShipped;
            }

            var lineStatus = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'LineStatus'
                })[0]
            );
            xml_items.status = lineStatus || 'NA';
            
            if (lineStatus && VC2_Utils.inArray(lineStatus, ['SHIPPED']) ) {
                xml_items.is_shipped = true;
            }

            var warehouse = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'WhseDesc'
                })[0]
            );
            if (warehouse != null && warehouse == 'VENDOR SUPPLIED') {
                xml_items.carrier = 'VENDOR SUPPLIED';
            }

            var carrier = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'ShipViaDesc'
                })[0]
            );
            if (carrier != null && carrier.length > 0) {
                xml_items.carrier = carrier;
            }

            var orderLineNumber = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'OrderLineNbr'
                })[0]
            );
            // Tech data not consistent in returning order line numbers
            var itemNumber = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'MfgItemNbr'
                })[0]
            );
            if (itemNumber != null && itemNumber.length > 0) {
                xml_items.item_num = itemNumber;
            }
            var vendorSKU = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'TechDataItemNbr'
                })[0]
            );
            if (vendorSKU != null && vendorSKU.length > 0) {
                xml_items.vendorSKU = vendorSKU;
            }

            var shipQty = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'QtyShipped'
                })[0]
            );
            if (shipQty != null && shipQty.length > 0) {
                xml_items.ship_qty = shipQty;
            }

            var serialNumberInfo = VC2_Utils.getNodeTextContent(
                ns_xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'SerialNbrInd'
                })[0]
            );
            //if (serialNumberInfo != null && serialNumberInfo =='Y') {

            var serialNumberInfoNode = ns_xml.XPath.select({
                node: itemInfoNodes[j],
                xpath: 'SerialNbrInfo'
            });
            if (serialNumberInfoNode != null && serialNumberInfoNode.length > 0) {
                var serialNumberNodes = ns_xml.XPath.select({
                    node: serialNumberInfoNode[0],
                    xpath: 'SerialNbr'
                });

                //log.debug('serialNumberNodes', serialNumberNodes);

                for (var x = 0; x < serialNumberNodes.length; x++) {
                    //var serialNumber = new Array();
                    //serialNumber = String(serialNumberNodes[x].firstChild);
                    var serialNumber = serialNumberNodes[x].textContent;

                    //if (serialNumber != null && serialNumber.substring(8).length > 0 )  {
                    if (serialNumber != null && serialNumber.substring(8).length > 0) {
                        if (xml_items.serial_num === 'NA') xml_items.serial_num = serialNumber;
                        //      xml_items.serial_num = serialNumber.substring(8);
                        else xml_items.serial_num += ',' + serialNumber;
                        //    xml_items.serial_num += ',' + serialNumber.substring(8);
                    }
                }
            }
            //}

            itemArray.push(xml_items);
        }

        return itemArray;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            outputArray = null;

        var responseXML = processRequest({
            poNum: poNum,
            poId: poId,
            vendorConfig: vendorConfig
        });

        // log.debug('process responseXML ' + poNum, responseXML);
        if (responseXML)
            outputArray = processResponse({
                poId: poId,
                vendorConfig: vendorConfig,
                responseXML: responseXML
            });

        // try to add the orderStatusDetail
        outputArray = _orderStatusDetails({
            poNum: poNum,
            poId: poId,
            vendorConfig: vendorConfig,
            outputArray: outputArray
        });

        /// log it //////////
        VC2_Utils.vcLog({
            recordId: option.poId,
            title: [LogTitle, 'Line Items'].join('::'),
            message: JSON.stringify(outputArray)
        });
        /// log it //////////

        return outputArray;
    }

    function _orderStatusDetails(option) {
        var logTitle = [LogTitle, 'orderStatusDetails'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            outputArray = option.outputArray,
            returnValue;

        try {
            var orderStatusReq = VC2_Utils.sendRequest({
                header: [LogTitle, 'OrderStatus'].join(' : '),
                method: 'post',
                recordId: poId,
                query: {
                    url: requestURL,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'Content-Length': 'length'
                    },
                    body:
                        '<XML_OrderStatus_Submit>' +
                        '<Header>' +
                        ('<UserName>' + userName + '</UserName>') +
                        ('<Password>' + password + '</Password>') +
                        '<ResponseVersion>1.7</ResponseVersion>' +
                        '</Header>' +
                        '<Detail>' +
                        '<PurposeCode>01</PurposeCode>' +
                        '<RefInfo>' +
                        '<RefIDQual>PO</RefIDQual>' +
                        ('<RefID>' + poNum + '</RefID>') +
                        '</RefInfo>' +
                        '</Detail>' +
                        '</XML_OrderStatus_Submit>'
                }
            });

            if (orderStatusReq.isError) throw orderStatusReq.errorMsg;

            var orderStatusResp = orderStatusReq.RESPONSE.body;

            // Remove first two lines of XML response
            orderStatusResp = orderStatusResp.substring(orderStatusResp.indexOf('\n') + 1);
            orderStatusResp = orderStatusResp.substring(orderStatusResp.indexOf('\n') + 1);

            if (!orderStatusResp) throw 'Missing response content';

            ////////////////////////////
            var xmlDoc = ns_xml.Parser.fromString({
                text: orderStatusResp
            });

            if (!xmlDoc || xmlDoc == null) throw 'Invalid XML Document';

            var lineInfoNodes = ns_xml.XPath.select({
                node: xmlDoc,
                xpath: '//LineInfo'
            });

            if (lineInfoNodes == null) throw 'Empty LineInfo Nodes...';
            for (var j = 0; j < lineInfoNodes.length; j++) {
                var xmlLineInfo = {
                    item_num: VC2_Utils.getNodeTextContent(
                        ns_xml.XPath.select({
                            node: lineInfoNodes[j],
                            xpath: 'ProductID2'
                        })[0]
                    ),
                    vendorSKU: VC2_Utils.getNodeTextContent(
                        ns_xml.XPath.select({
                            node: lineInfoNodes[j],
                            xpath: 'ProductID'
                        })[0]
                    ),
                    bo_qty: VC2_Utils.getNodeTextContent(
                        ns_xml.XPath.select({
                            node: lineInfoNodes[j],
                            xpath: 'QtyBackordered'
                        })[0]
                    ),
                    order_eta: VC2_Utils.getNodeTextContent(
                        ns_xml.XPath.select({
                            node: lineInfoNodes[j],
                            xpath: 'ItemEstimatedShipDate'
                        })[0]
                    ),
                    order_eta_parent: VC2_Utils.getNodeTextContent(
                        ns_xml.XPath.select({
                            node: lineInfoNodes[j].parentNode,
                            xpath: 'EstimatedShipDate'
                        })[0]
                    )
                };
                log.audit(logTitle, '>> xml line info: ' + JSON.stringify(xmlLineInfo));

                if (!xmlLineInfo.order_eta) {
                    xmlLineInfo.order_eta = xmlLineInfo.order_eta_parent;
                }

                // check if backordered
                if (!xmlLineInfo.bo_qty) continue;

                VC2_Utils.vcLog({
                    recordId: option.poId,
                    title: [LogTitle, 'OrderStatus::Line'].join('::'),
                    message: JSON.stringify(xmlLineInfo)
                });

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
                    serial_num: 'NA'
                };

                for (var fld in xml_items) {
                    if (!xmlLineInfo.hasOwnProperty(fld) || xmlLineInfo[fld] == null) continue;
                    xml_items[fld] = xmlLineInfo[fld];
                }

                log.audit(logTitle, '>> xml_items: ' + JSON.stringify(xml_items));
                outputArray.push(xml_items);
            }

            returnValue = outputArray;
        } catch (error) {
            var errorMsg = VC2_Utils.extractError(error);
            VC_Log.recordLog({
                header: [LogTitle + ': Error', errorMsg].join(' - '),
                body: JSON.stringify(error),
                transaction: option.poId,
                status: VC_Global.Lists.VC_LOG_STATUS.ERROR
            });
        }

        return returnValue;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
