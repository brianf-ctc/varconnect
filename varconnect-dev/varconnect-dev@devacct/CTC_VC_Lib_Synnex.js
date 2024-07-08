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
 * @NModuleScope Public
 */

define([
    'N/xml',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_xml, vc2_constant, vc2_util, moment) {
    var LogTitle = 'WS:Synnex';

    var LOG_LEVEL = 0;
    // 0 - main input / output
    // 1 - function level
    // 2 - verbose / debug level

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
            }

            return returnValue;
        }
    };

    var CURRENT = {};
    var LibSynnexAPI = {
        SkippedStatus: ['NOTFOUND', 'NOT FOUND', 'REJECTED', 'DELETED'],
        ShippedStatus: ['SHIPPED', 'INVOICED'],
        //ACCEPTED, SHIPPED, DELETED, NOT FOUND, REJECTED

        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqOrderStatus = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    method: 'post',
                    isXML: true,
                    doRetry: true,
                    query: {
                        url: CURRENT.orderConfig.endPoint,
                        body:
                            '<?xml version="1.0" encoding="UTF-8" ?>' +
                            '<SynnexB2B version="2.7">' +
                            '<Credential>' +
                            ('<UserID>' + CURRENT.orderConfig.user + '</UserID>') +
                            ('<Password>' + CURRENT.orderConfig.password + '</Password>') +
                            '</Credential>' +
                            '<OrderStatusRequest>' +
                            ('<CustomerNumber>' +
                                CURRENT.orderConfig.customerNo +
                                '</CustomerNumber>') +
                            ('<PONumber>' + CURRENT.recordNum + '</PONumber>') +
                            '</OrderStatusRequest>' +
                            '</SynnexB2B>',
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                            'Content-Length': 'length'
                        }
                    },
                    recordId: CURRENT.recordId
                });

                // this.handleResponse(reqOrderStatus);
                vc2_util.handleXMLResponse(reqOrderStatus);

                // if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';
                returnValue = respOrderStatus;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        handleResponse: function (request) {
            var logTitle = [LogTitle, 'handleResponse'].join('::'),
                returnValue = true;

            if (
                request.isError ||
                !request.RESPONSE ||
                !request.RESPONSE.body ||
                request.RESPONSE.code != '200'
            )
                throw 'Unable to fetch server response';

            var xmlDoc = ns_xml.Parser.fromString({ text: request.RESPONSE.body });
            var errMsgNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//ErrorDetail' });
            if (!vc2_util.isEmpty(errMsgNode)) throw errMsgNode[0].textContent;

            return returnValue;
        },

        parseToNSDate: function (dateStr) {
            var logTitle = [LogTitle, 'parseToNSDate'].join('::'),
                dateObj;

            try {
                dateObj = dateStr && dateStr !== 'NA' ? moment(dateStr).toDate() : null;
            } catch (err) {}

            return dateObj;
        }
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] SYNNEX - ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: respOrderStatus });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] SYNNEX - ';
                vc2_util.LogPrefix = LogPrefix;

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                returnValue = LibSynnexAPI.getOrderStatus(option);
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
                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML';

                // get the initial code
                var orderCode = vc2_util.getNodeContent(
                    ns_xml.XPath.select({ node: xmlDoc, xpath: '//Code' })
                );

                if (vc2_util.inArray(orderCode.toUpperCase(), LibSynnexAPI.SkippedStatus))
                    throw 'Order is' + orderCode;

                var arrItemsNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//Item' });
                if (!arrItemsNode || !arrItemsNode.length) throw 'XML: Missing Item Details';

                for (var i = 0, j = arrItemsNode.length; i < j; i++) {
                    var itemNode = arrItemsNode[i];

                    var orderItem = {
                        line_num: itemNode.getAttribute({ name: 'lineNumber' }) || 'NA',
                        item_num: Helper.getNodeValue(itemNode, 'MfgPN') || 'NA',
                        vendorSKU: Helper.getNodeValue(itemNode, 'SKU') || 'NA',
                        order_num: Helper.getNodeValue(itemNode, 'OrderNumber') || 'NA',
                        order_status:
                            Helper.getNodeValue(itemNode.parentNode.parentNode, 'Code') || 'NA',
                        line_status: Helper.getNodeValue(itemNode, 'Code') || 'NA',
                        order_date:
                            Helper.getNodeValue(itemNode.parentNode.parentNode, 'PODatetime') ||
                            'NA',
                        order_eta: Helper.getNodeValue(itemNode, 'EstimatedShipDate') || 'NA',
                        order_delivery_eta: Helper.getNodeValue(itemNode, 'EstimatedDeliveryDate') || Helper.getNodeValue(itemNode, 'EstimateDeliveryDate') || 'NA',
                        ship_date: Helper.getNodeValue(itemNode, 'ShipDatetime') || 'NA',
                        ship_qty: Helper.getNodeValue(itemNode, 'ShipQuantity') || 'NA',
                        carrier: Helper.getNodeValue(itemNode, 'ShipMethodDescription') || 'NA',
                        is_shipped: false,
                        tracking_num: 'NA',
                        serial_num: 'NA'
                    };

                    // Filter: Order Status
                    if (
                        !orderItem.order_status ||
                        vc2_util.inArray(
                            orderItem.order_status.toUpperCase(),
                            LibSynnexAPI.SkippedStatus
                        )
                    ) {
                        // skip this order status
                        vc2_util.log(
                            logTitle,
                            '** SKIPPED: OrderStatus:' + orderItem.order_status,
                            orderItem
                        );

                        continue;
                    }

                    // Filter: Line Status
                    if (
                        !orderItem.line_status ||
                        vc2_util.inArray(
                            orderItem.line_status.toUpperCase(),
                            LibSynnexAPI.SkippedStatus
                        )
                    ) {
                        // skip this order status
                        vc2_util.log(
                            logTitle,
                            '** SKIPPED: LineStatus:' + orderItem.line_status,
                            orderItem
                        );
                        continue;
                    }

                    // do the Packages
                    var packagesNode = ns_xml.XPath.select({
                        node: itemNode,
                        xpath: 'Packages/Package'
                    });

                    vc2_util.log(logTitle, '// packagesNode: ', packagesNode);

                    var trackingNumList = [],
                        serialNumList = [];

                    for (var ii = 0, jj = packagesNode.length; ii < jj; ii++) {
                        var trackingNo = Helper.getNodeValue(packagesNode[ii], 'TrackingNumber');
                        // serialNo = Helper.getNodeValue(packagesNode[ii], 'SerialNo');
                        // vc2_util.log(logTitle, '// trackingNo: ', trackingNo);

                        if (
                            trackingNo &&
                            trackingNo != 'NA' &&
                            !vc2_util.inArray(trackingNo, trackingNumList)
                        )
                            trackingNumList.push(trackingNo);

                        var serialNodes = ns_xml.XPath.select({
                            node: packagesNode[ii],
                            xpath: 'SerialNo'
                        });

                        for (var iii = 0, jjj = serialNodes.length; iii < jjj; iii++) {
                            var serialNo = vc2_util.getNodeTextContent(serialNodes[iii]);
                            // vc2_util.log(logTitle, '// serialNo: ', serialNo);

                            serialNumList.push(serialNo);
                        }

                        // if (
                        //     serialNo &&
                        //     serialNo != 'NA' &&
                        //     !vc2_util.inArray(serialNo, serialNumList)
                        // )
                        //     serialNumList.push(serialNo);
                    }

                    if (trackingNumList && trackingNumList.length)
                        orderItem.tracking_num = trackingNumList.join(',');

                    if (serialNumList && serialNumList.length)
                        orderItem.serial_num = serialNumList.join(',');

                    if (
                        !orderItem.is_shipped &&
                        orderItem.ship_date &&
                        orderItem.ship_date != 'NA' &&
                        orderItem.ship_qty &&
                        orderItem.ship_qty != 0
                    ) {
                        var shippedDate = moment(orderItem.ship_date).toDate();

                        vc2_util.log(logTitle, '**** shipped date: ****', [
                            shippedDate,
                            util.isDate(shippedDate),
                            shippedDate <= new Date()
                        ]);

                        if (shippedDate && util.isDate(shippedDate) && shippedDate <= new Date())
                            orderItem.is_shipped = true;
                    }

                    vc2_util.log(logTitle, '>> line data: ', orderItem);

                    // check for any duplicates
                    var dupLinData = vc2_util.findMatching({
                        list: itemArray,
                        findAll: true,
                        filter: {
                            line_num: orderItem.line_num,
                            item_num: orderItem.item_num,
                            vendorSKU: orderItem.vendorSKU,
                            order_num: orderItem.order_num,
                            order_status: orderItem.order_status,
                            line_status: orderItem.line_status,
                            ship_qty: orderItem.ship_qty,
                            tracking_num: orderItem.tracking_num,
                            serial_num: orderItem.serial_num
                        }
                    });

                    vc2_util.log(logTitle, '.... has dup?: ', [
                        dupLinData,
                        vc2_util.isEmpty(dupLinData)
                    ]);

                    orderItem.ship_nsdate = LibSynnexAPI.parseToNSDate(orderItem.ship_date);
                    orderItem.eta_nsdate = LibSynnexAPI.parseToNSDate(orderItem.order_eta);
                    orderItem.ship_nsdate = LibSynnexAPI.parseToNSDate(orderItem.ship_date);
                    orderItem.order_nsdate = LibSynnexAPI.parseToNSDate(orderItem.order_date);

                    if (!dupLinData) itemArray.push(orderItem);
                }

                returnValue = itemArray;
            } catch (error) {
                throw error;
            }

            return returnValue;
        }
    };
});
