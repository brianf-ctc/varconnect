/**
 * Copyright (c) 2024 Catalyst Tech Corp
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

define(['N/xml', './../CTC_VC2_Constants.js', './../CTC_VC2_Lib_Utils.js', './moment'], function (
    ns_xml,
    vc2_constant,
    vc2_util,
    moment
) {
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

    var CURRENT = {};

    var SynnexOrders = {
        EndPoint: {},
        LIST: [],
        ORDERS: {},
        RESULT: {}
    };

    var LibSynnexAPI = {
        SkippedStatus: ['NOTFOUND', 'NOT FOUND', 'REJECTED', 'DELETED'],
        ShippedStatus: ['SHIPPED', 'INVOICED'],
        //ACCEPTED, SHIPPED, DELETED, NOT FOUND, REJECTED

        initialize: function (option) {
            var logTitle = [LogTitle, 'initialize'].join('::'),
                returnValue;

            CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
            CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

            vc2_util.LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';

            if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

            return returnValue;
        },
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue;
            option = option || {};

            SynnexOrders.EndPoint.search = CURRENT.orderConfig.endPoint;

            try {
                var respOrderStatus = vc2_util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    method: 'post',
                    isXML: true,
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

                vc2_util.log(logTitle, '// respOrderStatus: ', respOrderStatus);

                vc2_util.handleXMLResponse(respOrderStatus);
                this.handleResponse(respOrderStatus);

                returnValue = respOrderStatus.RESPONSE.body;
                if (!returnValue) throw 'Unable to fetch server response';
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                throw ['Order Search', this.evaluateErrors(errorMsg)].join('| ');
            }

            return returnValue;
        },
        handleResponse: function (option) {
            if (!option.RESPONSE || !option.RESPONSE.body) throw 'Invalid or missing XML response';

            var xmlDoc = ns_xml.Parser.fromString({ text: option.RESPONSE.body });
            var respErrorDetail = vc2_util.getNodeContent(
                ns_xml.XPath.select({ node: xmlDoc, xpath: '//BizError/detail' })
            );
            vc2_util.log('handleResponse', respErrorDetail);
            if (respErrorDetail) throw respErrorDetail;

            // if (respErrorDetail) throw respErrorDetail;
            // return true;
        },
        processItem: function (option) {
            var logTitle = [LogTitle, 'processItem'].join('::');

            var itemNode = option.node || option.itemNode;
            var itemObj = {};

            try {
                itemObj = {
                    line_num: itemNode.getAttribute({ name: 'lineNumber' }) || 'NA',
                    item_num: Helper.getNodeValue(itemNode, 'MfgPN') || 'NA',
                    vendorSKU: Helper.getNodeValue(itemNode, 'SKU') || 'NA',
                    order_num: Helper.getNodeValue(itemNode, 'OrderNumber') || 'NA',
                    order_status:
                        Helper.getNodeValue(itemNode.parentNode.parentNode, 'Code') || 'NA',
                    line_status: Helper.getNodeValue(itemNode, 'Code') || 'NA',
                    order_date:
                        Helper.getNodeValue(itemNode.parentNode.parentNode, 'PODatetime') || 'NA',
                    order_eta: Helper.getNodeValue(itemNode, 'EstimatedShipDate') || 'NA',
                    order_delivery_eta:
                        Helper.getNodeValue(itemNode, 'EstimatedDeliveryDate') ||
                        Helper.getNodeValue(itemNode, 'EstimateDeliveryDate') ||
                        'NA',
                    ship_date: Helper.getNodeValue(itemNode, 'ShipDatetime') || 'NA',
                    ship_qty: Helper.getNodeValue(itemNode, 'ShipQuantity') || 'NA',
                    carrier: Helper.getNodeValue(itemNode, 'ShipMethodDescription') || 'NA',
                    unitprice: vc2_util.parseFloat(
                        Helper.getNodeValue(itemNode, 'UnitPrice') || ''
                    ),
                    tracking_num: 'NA',
                    serial_num: 'NA',
                    is_shipped: false
                };
                vc2_util.log(logTitle, '/// itemObj: ', itemObj);

                //// Filter: Order Status
                if (
                    !itemObj.order_status ||
                    vc2_util.inArray(itemObj.order_status.toUpperCase(), LibSynnexAPI.SkippedStatus)
                )
                    throw 'Skipped Order Status: ' + itemObj.order_status;

                //// Filter: Line Status
                if (
                    !itemObj.line_status ||
                    vc2_util.inArray(itemObj.line_status.toUpperCase(), LibSynnexAPI.SkippedStatus)
                )
                    throw 'Skipped Line Status: ' + itemObj.line_status;

                //// Extract SerialNums/Tracking Nums
                var packageNodeValue = this.extractPackageContent(option);
                vc2_util.log(logTitle, '.... (tracking/serials) ', packageNodeValue);
                if (packageNodeValue) {
                    itemObj.tracking_num = packageNodeValue.tracking_num;
                    itemObj.serial_num = packageNodeValue.serial_num;
                }
            } catch (err) {
                itemObj.SKIPPED = vc2_util.extractError(err);
                vc2_util.logError(logTitle, err);
            }

            return itemObj;
        },
        extractPackageContent: function (option) {
            var logTitle = [LogTitle, 'extractSerials'].join('::');

            var itemNode = option.node || option.itemNode;

            var itemObj = {};

            var packagesNode = ns_xml.XPath.select({
                node: itemNode,
                xpath: 'Packages/Package'
            });

            vc2_util.log(logTitle, '.... packagesNode: ', packagesNode.length);

            var trackingList = [],
                serialNumList = [];

            if (!packagesNode || !packagesNode.length) return false;

            // loop through packagesNode
            for (var i = 0; i < packagesNode.length; i++) {
                var packageNode = packagesNode[i];

                var trackingNo = Helper.getNodeValue(packageNode, 'TrackingNumber');

                if (trackingNo && trackingNo != 'NA' && !vc2_util.inArray(trackingNo, trackingList))
                    trackingList.push(trackingNo);

                var serialNodes = ns_xml.XPath.select({ node: packageNode, xpath: 'SerialNo' });

                (serialNodes || []).forEach(function (serialNode) {
                    var serialNo = vc2_util.getNodeTextContent(serialNode);

                    if (serialNo && serialNo != 'NA' && !vc2_util.inArray(serialNo, serialNumList))
                        serialNumList.push(serialNo);

                    return true;
                });
            }

            return {
                tracking_num: trackingList && trackingList.length ? trackingList.join(',') : 'NA',
                serial_num: serialNumList && serialNumList.length ? serialNumList.join(',') : 'NA'
            };
        },
        evaluateErrors: function (errorMsg) {
            // if (errorMsg.match(/^Invalid client identifier/gi)) {
            //     return 'Invalid credentials';
            // } else return errorMsg;
            return errorMsg;
        }
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                LibSynnexAPI.initialize(option);
                var response = this.processRequest(option);

                var xmlDoc = ns_xml.Parser.fromString({ text: response }),
                    itemArray = [];
                if (!xmlDoc) throw 'Unable to parse XML';

                var OrderData = {
                    Status: vc2_util.getNodeContent(
                        ns_xml.XPath.select({ node: xmlDoc, xpath: '//Code' })
                    ),
                    OrderNum: vc2_util.getNodeContent(
                        ns_xml.XPath.select({ node: xmlDoc, xpath: '//CustomerNumber' })
                    ),
                    Reason: vc2_util.getNodeContent(
                        ns_xml.XPath.select({ node: xmlDoc, xpath: '//Reason' })
                    )
                };

                // Check for Order Not Fou
                if (!OrderData.Status) throw 'Missing order status';
                if (OrderData.Status.toUpperCase() == 'NOTFOUND') throw 'Order is not found';
                if (vc2_util.inArray(OrderData.Status.toUpperCase(), LibSynnexAPI.SkippedStatus))
                    throw 'SKIPPED Order Status: ' + OrderData.Status;

                // get the initial code
                var arrItemsNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//Item' });
                if (!arrItemsNode || !arrItemsNode.length) throw 'XML: Missing Item Details';

                for (var ii = 0, jj = arrItemsNode.length; ii < jj; ii++) {
                    var itemNode = arrItemsNode[ii];

                    var itemObj = LibSynnexAPI.processItem({ node: itemNode });

                    // check if there's a duplicate item already
                    var dupLine = vc2_util.findMatching({
                        list: itemArray,
                        findAll: true,
                        filter: {
                            line_num: itemObj.line_num,
                            item_num: itemObj.item_num,
                            vendorSKU: itemObj.vendorSKU,
                            order_num: itemObj.order_num,
                            order_status: itemObj.order_status,
                            line_status: itemObj.line_status,
                            ship_qty: itemObj.ship_qty,
                            tracking_num: itemObj.tracking_num,
                            serial_num: itemObj.serial_num
                        }
                    });

                    vc2_util.log(logTitle, '... has dup?', [dupLine]);
                    if (dupLine) continue;
                    itemArray.push(itemObj);
                }

                util.extend(returnValue, {
                    Orders: [OrderData],
                    Lines: itemArray
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                util.extend(returnValue, {
                    HasError: true,
                    ErrorMsg: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue;
            option = option || {};

            try {
                LibSynnexAPI.initialize(option);
                returnValue = LibSynnexAPI.getOrderStatus(option);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }
            return returnValue;
        }
    };
});
