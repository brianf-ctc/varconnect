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
    // vcGlobals, constants, util) {
    var LogTitle = 'WS:D&H';

    var CURRENT = {};
    var LibDnH = {
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                var reqOrderStatus = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' : '),
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
                            '<XMLFORMPOST>' +
                            '<REQUEST>orderStatus</REQUEST>' +
                            '<LOGIN>' +
                            ('<USERID>' + CURRENT.vendorConfig.user + '</USERID>') +
                            ('<PASSWORD>' + CURRENT.vendorConfig.password + '</PASSWORD>') +
                            '</LOGIN>' +
                            '<STATUSREQUEST>' +
                            ('<PONUM>' + CURRENT.recordNum + '</PONUM>') +
                            '</STATUSREQUEST>' +
                            '</XMLFORMPOST>'
                    }
                });

                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';

                returnValue = respOrderStatus;
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);

                vc2_util.vcLog({
                    title: [LogTitle + ' Orders Status : Error', errorMsg].join(' - '),
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> order status: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        }
    };

    return {
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = LibDnH.getOrderStatus(option);
            } catch (error) {
                vc2_util.vcLog({
                    title: LogTitle + ': Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc2_util.extractError(error);
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML';
                var arrItemNodes = ns_xml.XPath.select({ node: xmlDoc, xpath: '//DETAILITEM' });
                if (!arrItemNodes || !arrItemNodes.length) throw 'XML: Missing Item Details';

                for (var i = 0; i < arrItemNodes.length; i++) {
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
                        is_shipped: false
                    };

                    var itemNum = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: arrItemNodes[i], xpath: 'ITEMNO' })[0]
                    );
                    if (itemNum != null && itemNum.length > 0) {
                        xml_items.item_num = itemNum;
                    }

                    //D&H does not support a separate vendorSKU as of Jan 9 2019

                    var shipQty = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: arrItemNodes[i], xpath: 'QUANTITY' })[0]
                    );
                    if (shipQty != null && shipQty.length > 0) {
                        xml_items.ship_qty = shipQty;
                    }

                    var etaDate = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: arrItemNodes[i], xpath: 'ETA' })[0]
                    );
                    if (etaDate != null && etaDate.length > 0) {
                        xml_items.order_eta = etaDate;
                    }

                    var orderStatusNode = arrItemNodes[i].parentNode.parentNode;

                    var orderNum = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: orderStatusNode, xpath: 'ORDERNUM' })[0]
                    );
                    if (orderNum != null && orderNum.length > 0) {
                        xml_items.order_num = orderNum;
                    }

                    var invoice = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: orderStatusNode, xpath: 'INVOICE' })[0]
                    );
                    var orderStatusMessage = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: orderStatusNode, xpath: 'MESSAGE' })[0]
                    );

                    var orderDateTime = vc2_util.getNodeTextContent(
                        ns_xml.XPath.select({ node: orderStatusNode, xpath: 'DATE' })[0]
                    );
                    if (orderDateTime != null && orderDateTime.length > 0) {
                        xml_items.order_date = orderDateTime;
                    }

                    var packageNodes = ns_xml.XPath.select({
                        node: orderStatusNode,
                        xpath: 'PACKAGE'
                    });
                    if (packageNodes != null && packageNodes.length > 0) {
                        for (var ii = 0; ii < packageNodes.length; ii++) {
                            var itemInPackage = false;
                            var shipItemNodes = ns_xml.XPath.select({
                                node: packageNodes[ii],
                                xpath: 'SHIPITEM'
                            });
                            if (shipItemNodes != null && shipItemNodes.length > 0) {
                                for (var iii = 0; iii < shipItemNodes.length; iii++) {
                                    if (
                                        ns_xml.XPath.select({
                                            node: shipItemNodes[iii],
                                            xpath: 'SHIPITEMNO'
                                        })[0].textContent == itemNum
                                    ) {
                                        itemInPackage = true;
                                        var serialNum = vc2_util.getNodeTextContent(
                                            ns_xml.XPath.select({
                                                node: shipItemNodes[iii],
                                                xpath: 'SERIALNO'
                                            })[0]
                                        );
                                        if (serialNum != null && serialNum.length > 0) {
                                            if (xml_items.serial_num == 'NA')
                                                xml_items.serial_num = serialNum;
                                            else xml_items.serial_num += ',' + serialNum;
                                        }
                                    }
                                }
                            }
                            if (itemInPackage) {
                                var carrier = ns_xml.XPath.select({
                                    node: packageNodes[ii],
                                    xpath: 'CARRIER'
                                })[0].textContent;
                                if (carrier != null && carrier.length > 0) {
                                    var carrierService = vc2_util.getNodeTextContent(
                                        ns_xml.XPath.select({
                                            node: packageNodes[ii],
                                            xpath: 'SERVICE'
                                        })[0]
                                    );
                                    if (carrierService != null && carrierService.length > 0) {
                                        if (xml_items.carrier == 'NA')
                                            xml_items.carrier = carrier + ' - ' + carrierService;
                                        else
                                            xml_items.carrier +=
                                                ',' + carrier + ' - ' + carrierService;
                                    } else {
                                        if (xml_items.carrier == 'NA') xml_items.carrier = carrier;
                                        else xml_items.carrier += ',' + carrier;
                                    }
                                }
                                var trackingNum = vc2_util.getNodeTextContent(
                                    ns_xml.XPath.select({
                                        node: packageNodes[ii],
                                        xpath: 'TRACKNUM'
                                    })[0]
                                );
                                if (trackingNum != null && trackingNum.length > 0) {
                                    if (xml_items.tracking_num == 'NA')
                                        xml_items.tracking_num = trackingNum;
                                    else xml_items.tracking_num += ',' + trackingNum;
                                }

                                var dateShipped = vc2_util.getNodeTextContent(
                                    ns_xml.XPath.select({
                                        node: packageNodes[ii],
                                        xpath: 'DATESHIPPED'
                                    })[0]
                                );
                                if (dateShipped != null && dateShipped.length > 0) {
                                    if (xml_items.ship_date == 'NA')
                                        xml_items.ship_date = dateShipped;
                                    else xml_items.ship_date += ',' + dateShipped;
                                }
                            }
                        }

                        // brianff 12/14
                        // use the same shipdate
                        if (xml_items.ship_date) {
                            xml_items.ship_date = xml_items.ship_date.split(/,/g)[0];
                            // assume everything without a shipdate has NOT shipped
                            xml_items.is_shipped = true;
                        }
                        // else, an order with no PACKAGE node but is invoiced will contain non-inventory items
                    } else if (
                        !!invoice &&
                        invoice.length > 0 &&
                        invoice.toUpperCase() !== 'IN PROCESS'
                    ) {
                        xml_items.is_shipped = true;
                    }
                    // if order status message is "IN PROCESS", then package/ship info is being waited on
                    if (orderStatusMessage && orderStatusMessage.toUpperCase() !== 'IN PROCESS') {
                        xml_items.is_shipped = false;
                    }

                    itemArray.push(xml_items);
                }

                returnValue = itemArray;
            } catch (error) {
                vc2_util.vcLog({
                    title: LogTitle + ': Response Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc2_util.extractError(error);
                returnValue = errorMsg;
            }

            return returnValue;
        },
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: respOrderStatus });
            } catch (error) {
                vc2_util.vcLog({
                    title: LogTitle + ': Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc2_util.extractError(error);
            } finally {
                log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));

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
        }
    };
});
