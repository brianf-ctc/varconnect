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
    './CTC_VC_Lib_Utilities.js',
    './CTC_VC_Lib_Log.js'
], function (search, runtime, r, xml, https, vcGlobals, constants, util, vcLog) {
    var LogTitle = 'WS:TechData';
    var Helper = {
        logMsg: function (option) {
            option = option || {};

            var logOption = {
                transaction: option.tranId || option.transactionId,
                header: [LogTitle, option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? util.extractError(option.error) : option.errorMsg),
                status:
                    option.status ||
                    option.error ||
                    (option.isError
                        ? constants.Lists.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? constants.Lists.VC_LOG_STATUS.SUCCESS
                        : constants.Lists.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, '::' + JSON.stringify(logOption));
            vcLog.recordLog(logOption);
            return true;
        }
    };

    function processRequest(options) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password;

        var xmlInvoiceByPOStatus;

        // var responseVersion = '1.8';
        // var orderXMLLineData = [];

        xmlInvoiceByPOStatus =
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
            '</XML_InvoiceDetailByPO_Submit>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        var responseXML;
        try {
            Helper.logMsg({
                tranId: poId,
                title: 'XML_InvoiceDetailByPO_Submit:Request',
                message: [
                    'URL=' + requestURL,
                    'Headers=' + JSON.stringify(headers),
                    '==Body==',
                    xmlInvoiceByPOStatus
                ].join('\n')
            });

            var response = https.post({
                url: requestURL,
                body: xmlInvoiceByPOStatus,
                headers: headers
            });
            responseXML = response.body;

            log.audit(logTitle, '>> response length: ' + responseXML.length);

            // Remove first two lines of XML response
            responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);
            responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);

            Helper.logMsg({
                tranId: poId,
                title: 'XML_InvoiceDetailByPO_Submit:Response',
                message: [responseXML].join('\n')
            });
        } catch (err) {
            Helper.logMsg({
                tranId: poId,
                title: 'XML_InvoiceDetailByPO_Submit:Error',
                error: err
            });

            // log.error({
            //     title: 'Tech Data Scheduled',
            //     details: 'error = ' + err.message
            // });
            responseXML = null;
        }

        return responseXML;
    }

    function processResponse(options) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var xmlString = options.responseXML;
        // log.debug({
        //     title: 'Tech Data Scheduled',
        //     details: 'parseTechData'
        // });

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemArray = [];
        var xmlDoc = xml.Parser.fromString({
            text: xmlString
        });

        if (xmlDoc == null) {
            Helper.logMsg({ tranId: options.poId, title: 'Request Error', error: err });
            return itemArray;
        }

        var itemInfoNodes = xml.XPath.select({
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
                serial_num: 'NA'
            };

            var orderInfoNode = itemInfoNodes[j].parentNode.parentNode;

            var orderNum = util.getNodeTextContent(
                xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'InvoiceNbr'
                })[0]
            );
            //var orderNum = util.getNodeTextContent(xml.XPath.select({node:orderInfoNode, xpath:'OrderNbr'})[0]);
            if (orderNum != null && orderNum.length > 0) {
                xml_items.order_num = orderNum;
            }

            var orderDate = util.getNodeTextContent(
                xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'OrderDate'
                })[0]
            );
            if (orderDate != null && orderDate.length > 0) {
                xml_items.order_date = orderDate;
            }

            var eta = util.getNodeTextContent(
                xml.XPath.select({
                    node: orderInfoNode,
                    xpath: 'EstShipDate'
                })[0]
            );
            if (eta != null && eta.length > 0) {
                xml_items.order_eta = eta;
            }

            // Goto ItemInfo parent (ContainerInfo) to get particular data
            var containerInfoNode = itemInfoNodes[j].parentNode;
            var containerID = util.getNodeTextContent(
                xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'ContainerID'
                })[0]
            );
            if (containerID != null && containerID.length > 0) {
                xml_items.tracking_num = containerID;
            }

            var dateShipped = util.getNodeTextContent(
                xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'DateShipped'
                })[0]
            );
            if (dateShipped != null && dateShipped.length > 0) {
                xml_items.ship_date = dateShipped;
            }

            var warehouse = util.getNodeTextContent(
                xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'WhseDesc'
                })[0]
            );
            if (warehouse != null && warehouse == 'VENDOR SUPPLIED') {
                xml_items.carrier = 'VENDOR SUPPLIED';
            }

            var carrier = util.getNodeTextContent(
                xml.XPath.select({
                    node: containerInfoNode,
                    xpath: 'ShipViaDesc'
                })[0]
            );
            if (carrier != null && carrier.length > 0) {
                xml_items.carrier = carrier;
            }

            var orderLineNumber = util.getNodeTextContent(
                xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'OrderLineNbr'
                })[0]
            );
            // Tech data not consistent in returning order line numbers
            var itemNumber = util.getNodeTextContent(
                xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'MfgItemNbr'
                })[0]
            );
            if (itemNumber != null && itemNumber.length > 0) {
                xml_items.item_num = itemNumber;
            }
            var vendorSKU = util.getNodeTextContent(
                xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'TechDataItemNbr'
                })[0]
            );
            if (vendorSKU != null && vendorSKU.length > 0) {
                xml_items.vendorSKU = vendorSKU;
            }

            var shipQty = util.getNodeTextContent(
                xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'QtyShipped'
                })[0]
            );
            if (shipQty != null && shipQty.length > 0) {
                xml_items.ship_qty = shipQty;
            }

            var serialNumberInfo = util.getNodeTextContent(
                xml.XPath.select({
                    node: itemInfoNodes[j],
                    xpath: 'SerialNbrInd'
                })[0]
            );
            //if (serialNumberInfo != null && serialNumberInfo =='Y') {

            var serialNumberInfoNode = xml.XPath.select({
                node: itemInfoNodes[j],
                xpath: 'SerialNbrInfo'
            });
            if (serialNumberInfoNode != null && serialNumberInfoNode.length > 0) {
                var serialNumberNodes = xml.XPath.select({
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

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
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
        Helper.logMsg({
            tranId: options.poId,
            title: logTitle,
            message: JSON.stringify(outputArray)
        });
        /// log it //////////

        return outputArray;
    }

    function _orderStatusDetails(options) {
        var logTitle = [LogTitle, 'orderStatusDetails'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            outputArray = options.outputArray;

        var xmlRequestStr =
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
            '</XML_OrderStatus_Submit>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        var responseXML;
        try {
            Helper.logMsg({
                tranId: poId,
                title: 'XML_OrderStatus_Submit:Request',
                message: [
                    'URL=' + requestURL,
                    'Headers=' + JSON.stringify(headers),
                    '==Body==',
                    xmlRequestStr
                ].join('\n')
            });

            var response = https.post({
                url: requestURL,
                body: xmlRequestStr,
                headers: headers
            });
            responseXML = response.body;

            log.audit(logTitle, '>> response length: ' + responseXML.length);

            // Remove first two lines of XML response
            responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);
            responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);

            Helper.logMsg({
                tranId: poId,
                title: 'XML_OrderStatus_Submit:Response',
                message: [responseXML].join('\n')
            });
        } catch (request_err) {
            Helper.logMsg({
                tranId: poId,
                title: 'XML_OrderStatus_Submit: Error',
                error: request_err
            });
            responseXML = null;
        }

        if (responseXML) {
            try {
                var itemArray = [];
                var xmlDoc = xml.Parser.fromString({
                    text: responseXML
                });

                if (xmlDoc == null) throw 'Invalid XML Document';

                var lineInfoNodes = xml.XPath.select({
                    node: xmlDoc,
                    xpath: '//LineInfo'
                });

                if (lineInfoNodes == null) throw 'Empty LineInfo Nodes...';

                for (var j = 0; j < lineInfoNodes.length; j++) {
                    var xmlLineInfo = {
                        item_num: util.getNodeTextContent(
                            xml.XPath.select({
                                node: lineInfoNodes[j],
                                xpath: 'ProductID2'
                            })[0]
                        ),
                        vendorSKU: util.getNodeTextContent(
                            xml.XPath.select({
                                node: lineInfoNodes[j],
                                xpath: 'ProductID'
                            })[0]
                        ),
                        bo_qty: util.getNodeTextContent(
                            xml.XPath.select({
                                node: lineInfoNodes[j],
                                xpath: 'QtyBackordered'
                            })[0]
                        ),
                        order_eta: util.getNodeTextContent(
                            xml.XPath.select({
                                node: lineInfoNodes[j],
                                xpath: 'ItemEstimatedShipDate'
                            })[0]
                        ),
                        order_eta_parent: util.getNodeTextContent(
                            xml.XPath.select({
                                node: lineInfoNodes[j].parentNode,
                                xpath: 'EstimatedShipDate'
                            })[0]
                        ),
                    };
                    log.audit(logTitle, '>> xml line info: ' + JSON.stringify(xmlLineInfo));

                    if (!xmlLineInfo.order_eta) {
                        xmlLineInfo.order_eta = xmlLineInfo.order_eta_parent;
                    }
                    
                    // check if backordered
                    if (!xmlLineInfo.bo_qty) continue;

                    Helper.logMsg({
                        tranId: options.poId,
                        title: 'XML_OrderStatus_Submit::Line',
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
            } catch (response_err) {
                Helper.logMsg({
                    tranId: options.poId,
                    title: [logTitle, 'Response Error'].join('::'),
                    error: response_err
                });
            }
        }

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
