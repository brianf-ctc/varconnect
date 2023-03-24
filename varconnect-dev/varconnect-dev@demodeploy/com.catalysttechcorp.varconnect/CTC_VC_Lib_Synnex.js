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
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils.js'
], function (ns_xml, vc_log, vc2_constant, vc2_util) {
    var LogTitle = 'WS:Synnex';

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
    var LibSynnexAPI = {
        SkippedStatus: ['NOTFOUND', 'NOT FOUND', 'REJECTED', 'DELETED'],
        ShippedStatus: ['SHIPPED', 'INVOICED'],

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
                        url: CURRENT.vendorConfig.endPoint,
                        body:
                            '<?xml version="1.0" encoding="UTF-8" ?>' +
                            '<SynnexB2B version="2.2">' +
                            '<Credential>' +
                            ('<UserID>' + CURRENT.vendorConfig.user + '</UserID>') +
                            ('<Password>' + CURRENT.vendorConfig.password + '</Password>') +
                            '</Credential>' +
                            '<OrderStatusRequest>' +
                            ('<CustomerNumber>' +
                                CURRENT.vendorConfig.customerNo +
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

                this.handleResponse(reqOrderStatus);
                // if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';
                returnValue = respOrderStatus;
            } catch (error) {
                returnValue = false;
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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: respOrderStatus });

                vc2_util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !vc2_util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : CURRENT.errorMessage,
                    recordId: CURRENT.recordId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
                });
            } catch (error) {
                CURRENT.errorMessage = vc2_util.extractError(error);
                throw CURRENT.errorMessage;
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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = LibSynnexAPI.getOrderStatus(option);
            } catch (error) {
                throw vc2_util.extractError(error);
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

                var arrItemsNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//Item' });
                if (!arrItemsNode || !arrItemsNode.length) throw 'XML: Missing Item Details';

                for (var i = 0, j = arrItemsNode.length; i < j; i++) {
                    var itemNode = arrItemsNode[i];

                    var itemRow = {
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
                        order_eta: Helper.getNodeValue(itemNode, 'ETADate') || 'NA',
                        ship_date: Helper.getNodeValue(itemNode, 'ShipDatetime') || 'NA',
                        ship_qty: Helper.getNodeValue(itemNode, 'ShipQuantity') || 'NA',
                        carrier: Helper.getNodeValue(itemNode, 'ShipMethodDescription') || 'NA',
                        tracking_num: 'NA',
                        serial_num: 'NA'
                    };
                    vc2_util.log(logTitle, '// item Row: ', itemRow);

                    if (
                        !itemRow.order_status ||
                        vc2_util.inArray(
                            itemRow.order_status.toUpperCase(),
                            LibSynnexAPI.SkippedStatus
                        )
                    ) {
                        // skip this order status
                        vc2_util.log(
                            logTitle,
                            '** SKIPPED: OrderStatus:' + itemRow.order_status,
                            itemRow
                        );

                        continue;
                    }

                    if (
                        !itemRow.line_status ||
                        vc2_util.inArray(
                            itemRow.line_status.toUpperCase(),
                            LibSynnexAPI.SkippedStatus
                        )
                    ) {
                        // skip this order status
                        vc2_util.log(
                            logTitle,
                            '** SKIPPED: LineStatus:' + itemRow.line_status,
                            itemRow
                        );
                        continue;
                    }

                    var shipQty = parseFloat(itemRow.ship_qty);
                    if (!shipQty || shipQty < 1) {
                        // skip this order status
                        vc2_util.log(logTitle, '** SKIPPED: Ship Qty:' + itemRow.ship_qty, [
                            parseFloat(itemRow.ship_qty),
                            vc2_util.parseFloat(itemRow.ship_qty),
                            vc2_util.forceFloat(itemRow.ship_qty),
                            shipQty,
                            !shipQty,
                            shipQty < 1
                        ]);
                        continue;
                    }
                    // do the Packages
                    var packagesNode = ns_xml.XPath.select({
                        node: itemNode,
                        xpath: 'Packages/Package'
                    });

                    // vc2_util.log(logTitle, '// packagesNode: ', packagesNode);

                    var trackingNumList = [],
                        serialNumList = [];

                    for (var ii = 0, jj = packagesNode.length; ii < jj; ii++) {
                        var trackingNo = Helper.getNodeValue(packagesNode[ii], 'TrackingNumber'),
                            serialNo = Helper.getNodeValue(packagesNode[ii], 'SerialNo');

                        // vc2_util.log(logTitle, '// trackingNo: ', trackingNo);
                        // vc2_util.log(logTitle, '// serialNo: ', serialNo);

                        if (
                            trackingNo &&
                            trackingNo != 'NA' &&
                            !vc2_util.inArray(trackingNo, trackingNumList)
                        )
                            trackingNumList.push(trackingNo);

                        if (
                            serialNo &&
                            serialNo != 'NA' &&
                            !vc2_util.inArray(serialNo, serialNumList)
                        )
                            serialNumList.push(serialNo);
                    }

                    if (trackingNumList && trackingNumList.length)
                        itemRow.tracking_num = trackingNumList.join(',');

                    if (serialNumList && serialNumList.length)
                        itemRow.serial_num = serialNumList.join(',');

                    vc2_util.log(logTitle, '// item Row: ', itemRow);
                    itemArray.push(itemRow);
                }

                returnValue = itemArray;
            } catch (error) {
                throw vc2_util.extractError(error);
            }

            return returnValue;
        }
    };
});
