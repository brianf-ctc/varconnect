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
    'N/search',
    'N/xml',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js'
], function (ns_search, ns_xml, vc_log, vc2_util, vc2_constant) {
    var LogTitle = 'WS:TechData';
    var Helper = {
        getNodeValue: function (node, xpath) {
            var logTitle = [LogTitle, 'getNodeValue'].join('::'),
                returnValue;

            try {
                var nodeValue = vc2_util.getNodeTextContent(
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
                var reqInvoiceDetail = vc2_util.sendRequest({
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
                vc2_util.vcLog({
                    title: LogTitle + ' Orders Status : Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                returnValue = vc2_util.extractError(error);
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> order status: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        responseError: function (xmlDoc) {
            var logTitle = [LogTitle, 'responseError'].join('::'),
                returnValue = null;

            try {
                var errMsgNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//ErrorMsg' });
                vc2_util.log(logTitle, 'errMsgNode: ', errMsgNode);
                returnValue = errMsgNode[0].textContent;
            } catch (err) {
                vc2_util.logError(logTitle, err);
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
                CURRENT.recordNum = tranNum =
                    option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                if (CURRENT.recordNum == '216747') {
                    vc2_util.log(logTitle, '**** FOR TESTING ONLY *****');
                    returnValue = [
                        {
                            line_num: '000100',
                            item_num: 'CON-ECMU-VMWVS6FN',
                            order_num: '8042852039-1',
                            order_date: '01/09/23',
                            order_eta: '01/12/23',
                            order_status: 'SHIPPED',
                            ship_date: '01/12/23',
                            ship_qty: '1',
                            tracking_num: '0000000000',
                            vendorSKU: '12225647',
                            carrier: 'VENDOR SUPPLIED',
                            serial_num: 'TSTSER001',
                            line_no: 1
                        },
                        {
                            line_num: '000300',
                            item_num: 'CON-SNTP-ISR4321V',
                            order_num: '8042852039',
                            order_date: '01/09/23',
                            order_eta: '01/12/23',
                            order_status: 'SHIPPED',
                            ship_date: '01/12/23',
                            ship_qty: '3',
                            tracking_num: '0000000004,0000000006,0000000012',
                            vendorSKU: '11707781',
                            carrier: 'VENDOR SUPPLIED',
                            serial_num: 'TSTSER003,TSTSER004, TSTSER005',
                            line_no: 3
                        },
                        {
                            line_num: '000200',
                            item_num: 'CON-ECMU-VMWVS6FN',
                            order_num: '8042852039',
                            order_date: '01/09/23',
                            order_eta: '01/12/23',
                            order_status: 'SHIPPED',
                            ship_date: '01/12/23',
                            ship_qty: '1',
                            tracking_num: '0000000008',
                            vendorSKU: '12225647',
                            carrier: 'VENDOR SUPPLIED',
                            serial_num: 'TSTSER006',
                            line_no: 2
                        },
                        // {
                        //     line_num: '000400',
                        //     item_num: 'CON-SNT-VG45XK14',
                        //     order_num: '8042852039',
                        //     order_date: '01/09/23',
                        //     order_eta: '01/12/23',
                        //     order_status: 'SHIPPED',
                        //     ship_date: '01/12/23',
                        //     ship_qty: '2',
                        //     tracking_num: '0000000000',
                        //     vendorSKU: '13510081',
                        //     carrier: 'VENDOR SUPPLIED',
                        //     serial_num: 'NA',
                        //     line_no: 4
                        // },
                        // {
                        //     line_num: '000500',
                        //     item_num: 'CON-SNTP-BE7MM4K9',
                        //     order_num: '8042852039',
                        //     order_date: '01/09/23',
                        //     order_eta: '01/12/23',
                        //     order_status: 'SHIPPED',
                        //     ship_date: '01/12/23',
                        //     ship_qty: '2',
                        //     tracking_num: '0000000000',
                        //     vendorSKU: '11678908',
                        //     carrier: 'VENDOR SUPPLIED',
                        //     serial_num: 'NA',
                        //     line_no: 5
                        // },
                        // {
                        //     line_num: '000600',
                        //     item_num: 'CON-SNT-VG35014',
                        //     order_num: '8042852039',
                        //     order_date: '01/09/23',
                        //     order_eta: '01/12/23',
                        //     order_status: 'SHIPPED',
                        //     ship_date: '01/12/23',
                        //     ship_qty: '15',
                        //     tracking_num: '0000000005',
                        //     vendorSKU: '11032588',
                        //     carrier: 'VENDOR SUPPLIED',
                        //     serial_num: 'NA',
                        //     line_no: 6
                        // },
                        // {
                        //     line_num: '000700',
                        //     item_num: 'CON-SNT-VG320ICV',
                        //     order_num: '8042852039',
                        //     order_date: '01/09/23',
                        //     order_eta: '01/12/23',
                        //     order_status: 'SHIPPED',
                        //     ship_date: '01/12/23',
                        //     ship_qty: '6',
                        //     tracking_num: '0000000005',
                        //     vendorSKU: '11603272',
                        //     carrier: 'VENDOR SUPPLIED',
                        //     serial_num: 'NA',
                        //     line_no: 7
                        // }
                    ];
                } else {
                    var respOrderStatus = this.processRequest(option);
                    returnValue = this.processResponse({ xmlResponse: respOrderStatus });
                    // log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));
                }
            } catch (error) {
                vc2_util.vcLog({
                    title: LogTitle + ':Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc2_util.extractError(error);
            } finally {
                vc2_util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !vc2_util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
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
                CURRENT.recordNum = tranNum =
                    option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = LibTechDataXML.getInvoiceDetail(option);
            } catch (error) {
                vc2_util.vcLog({
                    title: LogTitle + ':Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc2_util.extractError(error);
            } finally {
                vc2_util.log(logTitle, returnValue);
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
                        line_num: Helper.getNodeValue(arrItemNodes[i], 'OrderLineNbr') || 'NA',
                        item_num: Helper.getNodeValue(arrItemNodes[i], 'MfgItemNbr') || 'NA',
                        order_num: Helper.getNodeValue(orderInfo, 'InvoiceNbr') || 'NA',
                        order_date: Helper.getNodeValue(orderInfo, 'OrderDate') || 'NA',
                        order_eta: Helper.getNodeValue(orderInfo, 'EstShipDate') || 'NA',
                        order_status: Helper.getNodeValue(orderInfo, 'OrderStatus') || 'NA',
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

                        if (!vc2_util.isEmpty(arrSerialNum)) {
                            xml_items.serial_num = arrSerialNum.join(',');
                        }
                    }

                    if (!vc2_util.isEmpty(xml_items.line_num)) {
                        xml_items.line_no = vc2_util.parseFloat(xml_items.line_num);

                        if (
                            !vc2_util.isEmpty(xml_items.line_no) &&
                            xml_items.line_no &&
                            xml_items.line_no % 100 == 0
                        )
                            xml_items.line_no = xml_items.line_no / 100;
                    }

                    log.audit(logTitle, LogPrefix + '... item found: ' + JSON.stringify(xml_items));

                    itemArray.push(xml_items);
                }

                returnValue = itemArray;
            } catch (error) {
                // extract the error
                var errMsg = LibTechDataXML.responseError(xmlDoc);
                vc2_util.vcLog({
                    title: LogTitle + ': Response Error',
                    error: errMsg || error,
                    recordId: CURRENT.recordId
                });
                throw errMsg || vc2_util.extractError(error);
            }

            return returnValue;
        }
    };
});
