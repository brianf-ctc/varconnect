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
define(['N/xml', './CTC_VC2_Lib_Utils.js', './Bill Creator/Libraries/moment'], function (
    ns_xml,
    vc2_util,
    moment
) {
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
                        url: CURRENT.orderConfig.endPoint,

                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                            'Content-Length': 'length'
                        },
                        body:
                            '<XMLFORMPOST>' +
                            '<REQUEST>orderStatus</REQUEST>' +
                            '<LOGIN>' +
                            ('<USERID>' + CURRENT.orderConfig.user + '</USERID>') +
                            ('<PASSWORD>' + CURRENT.orderConfig.password + '</PASSWORD>') +
                            '</LOGIN>' +
                            '<STATUSREQUEST>' +
                            ('<PONUM>' + CURRENT.recordNum + '</PONUM>') +
                            '</STATUSREQUEST>' +
                            '</XMLFORMPOST>'
                    }
                });

                vc2_util.handleXMLResponse(reqOrderStatus);

                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';

                returnValue = respOrderStatus;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        parseToNSDate: function (dateStr) {
            var logTitle = [LogTitle, 'parseToNSDate'].join('::'),
                dateObj;

            try {
                dateObj = dateStr && dateStr !== 'NA' ? moment(dateStr, 'MM/DD/YY').toDate() : null;
            } catch (err) {}

            // vc2_util.log(logTitle, '// dateStr: ', {
            //     dateStr: dateStr,
            //     dateObj: dateObj,
            //     isDate: util.isDate(dateObj)
            // });

            return dateObj;
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
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                returnValue = LibDnH.getOrderStatus(option);
            } catch (error) {
                throw error;
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
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML';
                var arrItemNodes = ns_xml.XPath.select({ node: xmlDoc, xpath: '//DETAILITEM' });
                if (!arrItemNodes || !arrItemNodes.length) throw 'XML: Missing Item Details';

                for (var i = 0; i < arrItemNodes.length; i++) {
                    var itemNode = arrItemNodes[i],
                        orderStatusNode = itemNode.parentNode.parentNode;

                    var orderItem = {
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

                    orderItem.order_status =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: orderStatusNode,
                                xpath: 'MESSAGE'
                            })[0]
                        ) || 'NA';

                    if (!orderItem.order_status || orderItem.order_status.match(/CANCELLED/gi))
                        continue; // skip this order

                    orderItem.item_num =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: itemNode,
                                xpath: 'ITEMNO'
                            })[0]
                        ) || orderItem.item_num;

                    //D&H does not support a separate vendorSKU as of Jan 9 2019
                    orderItem.ship_qty =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: itemNode,
                                xpath: 'QUANTITY'
                            })[0]
                        ) || orderItem.ship_qty;

                    orderItem.order_eta =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: itemNode,
                                xpath: 'ETA'
                            })[0]
                        ) || orderItem.order_eta;

                    orderItem.order_num =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: orderStatusNode,
                                xpath: 'ORDERNUM'
                            })[0]
                        ) || orderItem.order_num;

                    orderItem.order_date =
                        vc2_util.getNodeTextContent(
                            ns_xml.XPath.select({
                                node: orderStatusNode,
                                xpath: 'DATE'
                            })[0]
                        ) || orderItem.order_date;

                    var packageNodes = ns_xml.XPath.select({
                        node: orderStatusNode,
                        xpath: 'PACKAGE'
                    });

                    if (packageNodes != null && packageNodes.length > 0) {
                        var carrierList = [],
                            trackingNumList = [],
                            dateShippedList = [],
                            serialNumList = [];

                        for (var ii = 0; ii < packageNodes.length; ii++) {
                            var packageNode = packageNodes[ii],
                                itemInPackage = false,
                                shipItemNodes = ns_xml.XPath.select({
                                    node: packageNode,
                                    xpath: 'SHIPITEM'
                                });

                            if (!shipItemNodes || !shipItemNodes.length) continue;

                            for (var iii = 0; iii < shipItemNodes.length; iii++) {
                                var shipItemNode = shipItemNodes[iii],
                                    shipItemNo = ns_xml.XPath.select({
                                        node: shipItemNode,
                                        xpath: 'SHIPITEMNO'
                                    });

                                shipItemNo =
                                    shipItemNo && shipItemNo[0] ? shipItemNo[0].textContent : null;

                                if (!shipItemNo || shipItemNo !== orderItem.item_num) continue;

                                var serialNum = vc2_util.getNodeTextContent(
                                        ns_xml.XPath.select({
                                            node: shipItemNode,
                                            xpath: 'SERIALNO'
                                        })[0]
                                    ),
                                    carrier = ns_xml.XPath.select({
                                        node: packageNode,
                                        xpath: 'CARRIER'
                                    }),
                                    carrierService = vc2_util.getNodeTextContent(
                                        ns_xml.XPath.select({
                                            node: packageNode,
                                            xpath: 'SERVICE'
                                        })[0]
                                    ),
                                    dateShipped = vc2_util.getNodeTextContent(
                                        ns_xml.XPath.select({
                                            node: packageNode,
                                            xpath: 'DATESHIPPED'
                                        })[0]
                                    );

                                if (!vc2_util.isEmpty(serialNum)) serialNumList.push(serialNum);

                                if (!vc2_util.isEmpty(carrier)) {
                                    carrier = carrier && carrier[0] ? carrier[0].textContent : null;

                                    carrierList.push(
                                        !vc2_util.isEmpty(carrierService)
                                            ? [carrier, carrierService].join(' - ')
                                            : carrier
                                    );
                                }

                                if (!vc2_util.isEmpty(dateShipped))
                                    dateShippedList.push(dateShipped);
                            }
                        }

                        if (serialNumList && serialNumList.length) {
                            serialNumList = vc2_util.uniqueArray(serialNumList);
                            orderItem.serial_num = serialNumList.join(',');
                        }

                        if (carrierList && carrierList.length) {
                            carrierList = vc2_util.uniqueArray(carrierList);
                            orderItem.carrier = carrierList.join(',');
                        }

                        if (trackingNumList && trackingNumList.length) {
                            trackingNumList = vc2_util.uniqueArray(trackingNumList);
                            orderItem.tracking_num = trackingNumList.join(',');
                        }

                        if (dateShippedList) {
                            dateShippedList = vc2_util.uniqueArray(dateShippedList);
                            orderItem.ship_date =
                                dateShippedList.length > 1
                                    ? dateShippedList.shift() /// TODO: find the latest value
                                    : dateShippedList.shift();
                        }
                    }

                    // if order status message is "IN PROCESS", then package/ship info is being waited on
                    if (
                        orderItem.order_status &&
                        orderItem.order_status.toUpperCase() !== 'IN PROCESS'
                    ) {
                        orderItem.is_shipped = false;
                    }

                    if (
                        !orderItem.is_shipped &&
                        orderItem.ship_date &&
                        orderItem.ship_date != 'NA' &&
                        orderItem.ship_qty &&
                        orderItem.ship_qty != 0
                    ) {
                        var shippedDate = moment(orderItem.ship_date, 'MM/DD/YY').toDate();
                        vc2_util.log(logTitle, '**** shipped date: ****', [
                            shippedDate,
                            util.isDate(shippedDate),
                            shippedDate <= new Date()
                        ]);

                        if (shippedDate && util.isDate(shippedDate) && shippedDate <= new Date())
                            orderItem.is_shipped = true;
                    }

                    orderItem.eta_nsdate = LibDnH.parseToNSDate(orderItem.order_eta);
                    orderItem.ship_nsdate = LibDnH.parseToNSDate(orderItem.ship_date);
                    orderItem.order_nsdate = LibDnH.parseToNSDate(orderItem.order_date);

                    vc2_util.log(logTitle, '>> line data: ', orderItem);

                    itemArray.push(orderItem);
                }

                returnValue = itemArray;
            } catch (error) {
                throw error;
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
                CURRENT.orderConfig = CURRENT.orderConfig || option.orderConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                vc2_util.log(logTitle, '// option: ', option);
                vc2_util.log(logTitle, '// CURRENT: ', CURRENT);

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({
                    xmlResponse: respOrderStatus
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
