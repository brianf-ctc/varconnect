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

define(['N/xml', './CTC_VC2_Constants.js', './CTC_VC2_Lib_Utils.js'], function (
    ns_xml,
    vc2_constant,
    vc2_util
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
        }
    };

    var CURRENT = {},
        ERROR_MSG = vc2_constant.ERRORMSG,
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ];

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
                // vc2_util.log(logTitle, '// respOrderStatus: ', respOrderStatus);
                if (respOrderStatus.isError)
                    if (!respOrderStatus.PARSED_RESPONSE) throw respOrderStatus.errorMsg;

                vc2_util.handleXMLResponse(respOrderStatus);
                this.handleResponse(respOrderStatus);

                returnValue = respOrderStatus.RESPONSE.body;
                if (!returnValue) throw 'Unable to fetch server response';
            } catch (error) {
                throw this.evaluateErrors(error);
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
                    order_num: Helper.getNodeValue(itemNode, 'OrderNumber') || 'NA',
                    order_status:
                        Helper.getNodeValue(itemNode.parentNode.parentNode, 'Code') || 'NA',
                    order_date:
                        Helper.getNodeValue(itemNode.parentNode.parentNode, 'PODatetime') || 'NA',
                    order_eta: Helper.getNodeValue(itemNode, 'EstimatedShipDate') || 'NA',
                    order_delivery_eta:
                        Helper.getNodeValue(itemNode, 'EstimatedDeliveryDate') ||
                        Helper.getNodeValue(itemNode, 'EstimateDeliveryDate') ||
                        'NA',
                    deliv_date: 'NA',
                    prom_date: 'NA',

                    item_num: Helper.getNodeValue(itemNode, 'MfgPN') || 'NA',
                    vendorSKU: Helper.getNodeValue(itemNode, 'SKU') || 'NA',
                    item_sku: Helper.getNodeValue(itemNode, 'SKU') || 'NA',
                    item_altnum: 'NA',

                    line_num: itemNode.getAttribute({ name: 'lineNumber' }) || 'NA',
                    line_status: Helper.getNodeValue(itemNode, 'Code') || 'NA',
                    unitprice: vc2_util.parseFloat(
                        Helper.getNodeValue(itemNode, 'UnitPrice') || ''
                    ),
                    line_price: 'NA',

                    ship_qty: Helper.getNodeValue(itemNode, 'ShipQuantity') || 'NA',
                    ship_date: Helper.getNodeValue(itemNode, 'ShipDatetime') || 'NA',
                    carrier: Helper.getNodeValue(itemNode, 'ShipMethodDescription') || 'NA',
                    tracking_num: 'NA',
                    serial_num: 'NA',

                    is_shipped: false
                };
                util.extend(itemObj, {
                    deliv_date: itemObj.order_delivery_eta,
                    line_price: itemObj.unitprice
                });
                DATE_FIELDS.forEach(function (dateField) {
                    if (itemObj[dateField] && itemObj[dateField] != 'NA') {
                        itemObj[dateField] = vc2_util.parseFormatDate(
                            itemObj[dateField],
                            'YYYY-MM-DD'
                        );
                    }
                });
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
            var errorCodeList = {
                INVALID_CREDENTIALS: [
                    new RegExp(/Login failed/gi),
                    new RegExp(/The customer# .+? you provided does not exist in our system/gi)
                ],
                INVALID_ACCESSPOINT: [],
                ENDPOINT_URL_ERROR: [
                    new RegExp(/Resource not found/gi),
                    new RegExp(/The host you requested .+? is unknown or cannot be found/gi)
                ],
                INVALID_ACCESS_TOKEN: [new RegExp(/Invalid or missing authorization token/gi)]
            };

            var matchedErrorCode = null;

            for (var errorCode in errorCodeList) {
                for (var i = 0, j = errorCodeList[errorCode].length; i < j; i++) {
                    var regStr = errorCodeList[errorCode][i];
                    if (errorMsg.match(regStr)) {
                        matchedErrorCode = errorCode;
                        break;
                    }
                }
                if (matchedErrorCode) break;
            }

            var returnValue = matchedErrorCode
                ? vc2_util.extend(ERROR_MSG[matchedErrorCode], { details: errorMsg })
                : { message: 'Unexpected error', details: errorMsg };
            // vc2_util.logError('evalError', [matchedErrorCode, returnValue, errorMsg]);

            return returnValue;
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
                    itemArray = [],
                    orderList = [];

                if (!xmlDoc) throw 'Unable to parse XML';

                var orderInfo = {
                    Status:
                        vc2_util.getNodeContent(
                            ns_xml.XPath.select({ node: xmlDoc, xpath: '//Code' })
                        ) || 'NA',
                    OrderNum:
                        vc2_util.getNodeContent(
                            ns_xml.XPath.select({ node: xmlDoc, xpath: '//PONumber' })
                        ) || 'NA',
                    VendorOrderNum:
                        vc2_util.getNodeContent(
                            ns_xml.XPath.select({ node: xmlDoc, xpath: '//CustomerNumber' })
                        ) || 'NA',
                    OrderDate:
                        vc2_util.getNodeContent(
                            ns_xml.XPath.select({ node: xmlDoc, xpath: '//PODatetime' })
                        ) || 'NA',
                    Total: 'NA',
                    InvoiceNo: 'NA'
                };
                if (orderInfo.OrderDate && orderInfo.OrderDate !== 'NA') {
                    orderInfo.OrderDate = vc2_util.parseFormatDate(
                        orderInfo.OrderDate,
                        'YYYY-MM-DD'
                    );
                }

                // Check for Order Not Fou
                if (!orderInfo.Status) throw 'Missing order status';
                if (orderInfo.Status.toUpperCase() == 'NOTFOUND') throw 'Order is not found';
                if (vc2_util.inArray(orderInfo.Status.toUpperCase(), LibSynnexAPI.SkippedStatus))
                    throw 'SKIPPED Order Status: ' + orderInfo.Status;

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

                    var orderData = util.extend(vc2_util.clone(orderInfo), {
                        VendorOrderNum: itemObj.order_num
                    });

                    var duplOrderData = vc2_util.findMatching({
                        list: orderList,
                        filter: { VendorOrderNum: orderData.VendorOrderNum }
                    });
                    if (!duplOrderData) orderList.push(orderData);
                }

                util.extend(returnValue, {
                    Orders: orderList,
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
