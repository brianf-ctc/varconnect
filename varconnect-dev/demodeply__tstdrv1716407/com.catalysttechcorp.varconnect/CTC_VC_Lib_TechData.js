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
 * Version    Date          Author        Remarks
 * 1.00       July 25, 2019 paolodl       Library for retrieving Vendor Configuration
 *
 */

define([
    'N/search',
    'N/xml',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_search, ns_xml, VC_Global, VC_Log, VC_Util, moment) {
    var LogTitle = 'WS:TechData';
    var Helper = {
        getNodeValue: function (node, xpath) {
            var logTitle = [LogTitle, 'getNodeValue'].join('::'),
            returnValue;

        try {
                var nodeValue = VC_Util.getNodeTextContent(
                    ns_xml.XPath.select({
                        node: node,
                        xpath: xpath
                    }).shift()
                );
                if (!nodeValue) throw 'Empty value';
                returnValue = nodeValue;
            } catch (error) {
                returnValue = false;
            } finally {
                // log.audit(logTitle, LogPrefix + '>> nodeValue: ' + JSON.stringify(nodeValue));
            }

            return returnValue;
        }
    };

    var CURRENT = {};
    var LibTechDataXML = {
        getInvoiceDetail: function (option) {
            var logTitle = [LogTitle, 'getInvoiceDetail'].join('::'),
                returnValue = [];
            option = option || {};
        try {
                var reqInvoiceDetail = VC_Util.sendRequest({
                    header: [LogTitle, 'Invoice Detail'].join(' : '),
                    recordId: CURRENT.recordId,
                method: 'post',
                    isXML: true,
                query: {
                        url: CURRENT.vendorConfig.endPoint,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'Content-Length': 'length'
                    },
                    body:
                        '<XML_InvoiceDetailByPO_Submit>' +
                        '<Header>' +
                            ('<UserName>' + CURRENT.vendorConfig.user + '</UserName>') +
                            ('<Password>' + CURRENT.vendorConfig.password + '</Password>') +
                        '</Header>' +
                        '<Detail>' +
                        '<POInfo>' +
                            ('<PONbr>' + CURRENT.recordNum + '</PONbr>') +
                        '</POInfo>' +
                        '</Detail>' +
                        '</XML_InvoiceDetailByPO_Submit>'
                    }
            });

                if (reqInvoiceDetail.isError) throw reqInvoiceDetail.errorMsg;
                var responseXML = reqInvoiceDetail.RESPONSE.body;
                if (!responseXML) throw 'Unable to fetch server response';

                responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);
                responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);

                returnValue = responseXML;
        } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ' Orders Status : Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                returnValue = VC_Util.extractError(error);
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> order status: ' + JSON.stringify(returnValue));
        }

        return returnValue;
    }
            };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

        try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = tranNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';


                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: respOrderStatus });
            } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ':Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw VC_Util.extractError(error);
            } finally {
                log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));

                VC_Util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !VC_Util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: VC_Global.Lists.VC_LOG_STATUS.INFO
        });
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = tranNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = LibTechDataXML.getInvoiceDetail(option);
            } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ':Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw VC_Util.extractError(error);
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML';

                var arrItemNodes = ns_xml.XPath.select({ node: xmlDoc, xpath: '//ItemInfo' });
                if (!arrItemNodes || !arrItemNodes.length) throw 'XML: Missing Item Details';

                for (var i = 0, j = arrItemNodes.length; i < j; i++) {
                    var orderInfo = arrItemNodes[i].parentNode.parentNode;
                    var containerInfo = arrItemNodes[i].parentNode;

                    var xml_items = {
                        line_num: 'NA',
                        item_num: Helper.getNodeValue(arrItemNodes[i], 'MfgItemNbr') || 'NA',
                        order_num: Helper.getNodeValue(orderInfo, 'InvoiceNbr') || 'NA',
                        order_date: Helper.getNodeValue(orderInfo, 'OrderDate') || 'NA',
                        order_eta: Helper.getNodeValue(orderInfo, 'EstShipDate') || 'NA',
                        ship_date: Helper.getNodeValue(containerInfo, 'DateShipped') || 'NA',
                        ship_qty: Helper.getNodeValue(arrItemNodes[i], 'QtyShipped') || 'NA',
                        tracking_num: Helper.getNodeValue(containerInfo, 'ContainerID') || 'NA',
                        vendorSKU: Helper.getNodeValue(arrItemNodes[i], 'TechDataItemNbr') || 'NA',
                        carrier:
                            Helper.getNodeValue(containerInfo, 'ShipViaDesc') ||
                            Helper.getNodeValue(containerInfo, 'WhseDesc') ||
                            'NA',
                        serial_num: 'NA'
                    };

            var serialNumberInfoNode = ns_xml.XPath.select({
                        node: arrItemNodes[i],
                xpath: 'SerialNbrInfo'
            });
            if (serialNumberInfoNode != null && serialNumberInfoNode.length > 0) {
                var serialNumberNodes = ns_xml.XPath.select({
                    node: serialNumberInfoNode[0],
                    xpath: 'SerialNbr'
                });

                        var arrSerialNum = [];
                        for (var ii = 0; ii < serialNumberNodes.length; ii++) {
                            var serialNumber = serialNumberNodes[ii].textContent;

                    if (serialNumber != null && serialNumber.substring(8).length > 0) {
                                arrSerialNum.push(serialNumber);
                }
            }

                        if (!VC_Util.isEmpty(arrSerialNum)) {
                            xml_items.serial_num = arrSerialNum.join(',');
        }
    }

                    log.audit(logTitle, LogPrefix + '... xml item: ' + JSON.stringify(xml_items));

                    itemArray.push(xml_items);
            }

                returnValue = itemArray;
        } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ': Response Error',
                    error: error,
                    recordId: CURRENT.recordId
            });
                throw VC_Util.extractError(error);
        }

        return returnValue;
    }

    };
});
