/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
define([
    'N/xml',
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js',
    './Bill Creator/Libraries/moment'
], function (ns_xml, vc2_util, vc2_constant, moment) {
    var LogTitle = 'WS:D&H';

    var CURRENT = {},
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ],
        ERROR_MSG = vc2_constant.ERRORMSG;

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

    var LibDnH = {
        SkippedStatus: ['CANCELLED', 'CANCELED', 'DELETED'],
        ShippedStatus: ['SHIPPED', 'INVOICED'],

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
                vc2_util.log(logTitle, 'reqOrderStatus: ', reqOrderStatus);
                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;

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

        getItemInquiry: function (option) {
            var logTitle = [LogTitle, 'getItemInquiry'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                var reqItemQuery = vc2_util.sendRequest({
                    header: [LogTitle, 'ItemInquirey-DH'].join(' : '),
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
                            '<REQUEST>itemInquiry</REQUEST>' +
                            '<LOGIN>' +
                            ('<USERID>' + CURRENT.orderConfig.user + '</USERID>') +
                            ('<PASSWORD>' + CURRENT.orderConfig.password + '</PASSWORD>') +
                            '</LOGIN>' +
                            ('<PARTNUM>' + option.itemName + '</PARTNUM>') +
                            ('<LOOKUPTYPE>' + option.lookupType + '</LOOKUPTYPE>') +
                            '</XMLFORMPOST>'
                    }
                });

                vc2_util.log(logTitle, 'reqItemQuery: ', reqItemQuery);
                if (reqItemQuery.isError) throw reqItemQuery.errorMsg;

                vc2_util.handleXMLResponse(reqItemQuery);

                if (reqItemQuery.isError) throw reqItemQuery.errorMsg;
                var respItemQuery = reqItemQuery.RESPONSE.body;
                if (!respItemQuery) throw 'Unable to fetch server response';

                returnValue = respItemQuery;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        processItem: function (option) {
            var logTitle = [LogTitle, 'processItem'].join('::');

            var itemNode = option.node || option.itemNode,
                parentNode = option.parent;
            var itemObj = {};
            try {
                itemObj = {
                    order_num: Helper.getNodeValue(parentNode, 'ORDERNUM') || 'NA',
                    order_status: Helper.getNodeValue(parentNode, 'MESSAGE') || 'NA',
                    order_date: Helper.getNodeValue(parentNode, 'DATE') || 'NA',
                    order_eta: Helper.getNodeValue(itemNode, 'ETA') || 'NA',
                    eta_delivery_date: 'NA',
                    deliv_date: 'NA',
                    prom_date: 'NA',

                    item_num: Helper.getNodeValue(itemNode, 'ITEMNO') || 'NA',
                    item_num_alt: 'NA',
                    vendorSKU: 'NA',
                    item_sku: 'NA',
                    item_altnum: 'NA',

                    line_num: 'NA',
                    line_status: 'NA',
                    unitprice: vc2_util.parseFloat(Helper.getNodeValue(itemNode, 'PRICE') || ''),
                    line_price: vc2_util.parseFloat(Helper.getNodeValue(itemNode, 'PRICE') || ''),

                    ship_date: 'NA',
                    ship_qty: Helper.getNodeValue(itemNode, 'QUANTITY') || 'NA',
                    carrier: 'NA',
                    tracking_num: 'NA',
                    serial_num: 'NA',
                    is_shipped: false
                };

                // validate order_status
                if (
                    !itemObj.order_status ||
                    itemObj.order_status == 'NA' ||
                    vc2_util.inArray(itemObj.order_status.toUpperCase(), LibDnH.SkippedStatus)
                )
                    throw 'Skipped Status - ' + itemObj.order_status;

                // check for any packages
                var itemPkgIndex = [itemObj.order_num, itemObj.item_num].join('::'),
                    itemPkgObj = CURRENT.PackagesList[itemPkgIndex];

                if (itemPkgObj) {
                    util.extend(itemObj, {
                        serial_num:
                            itemPkgObj.serials && !vc2_util.isEmpty(itemPkgObj.serials)
                                ? (function () {
                                      var serials = vc2_util.uniqueArray(itemPkgObj.serials);
                                      return serials.join(',');
                                  })()
                                : itemObj.serial_num,
                        carrier:
                            itemPkgObj.carriers && !vc2_util.isEmpty(itemPkgObj.carriers)
                                ? (function () {
                                      var carriers = vc2_util.uniqueArray(itemPkgObj.carriers);
                                      return carriers.join(',');
                                  })()
                                : itemObj.carrier,
                        tracking_num:
                            itemPkgObj.trackingNums && !vc2_util.isEmpty(itemPkgObj.trackingNums)
                                ? (function () {
                                      var trackingNums = vc2_util.uniqueArray(
                                          itemPkgObj.trackingNums
                                      );
                                      return trackingNums.join(',');
                                  })()
                                : itemObj.tracking_num,
                        ship_date:
                            itemPkgObj.dateshipped && !vc2_util.isEmpty(itemPkgObj.dateshipped)
                                ? (function () {
                                      var dateshipped = vc2_util.uniqueArray(
                                          itemPkgObj.dateshipped
                                      );
                                      return dateshipped.shift();
                                  })()
                                : itemObj.ship_date
                    });
                }

                // set initial shipped

                itemObj.is_shipped = vc2_util.inArray(itemObj.order_status, LibDnH.ShippedStatus)
                    ? true
                    : itemObj.is_shipped;
            } catch (err) {
                itemObj.SKIPPED = vc2_util.extractError(err);
                vc2_util.logError(logTitle, err);
            }

            return itemObj;
        },

        processPackages: function (option) {
            var logTitle = [LogTitle, 'processPackages'].join('::');

            var packagesNodes = option.nodes;
            if (!util.isArray(packagesNodes) || vc2_util.isEmpty(packagesNodes)) return false;

            var packagesList = {};

            for (var i = 0, j = packagesNodes.length; i < j; i++) {
                var itemPackageObj = {
                    carriers: [],
                    dateShipped: [],
                    trackingNums: [],
                    serialNums: []
                };
                var pkgNode = packagesNodes[i],
                    shipItemNodes = ns_xml.XPath.select({ node: pkgNode, xpath: 'SHIPITEM' });

                var packageObj = {
                    orderNum: Helper.getNodeValue(pkgNode.parentNode, 'ORDERNUM'),
                    carrier: Helper.getNodeValue(pkgNode, 'CARRIER'),
                    service: Helper.getNodeValue(pkgNode, 'SERVICE'),
                    trackNum: Helper.getNodeValue(pkgNode, 'TRACKNUM'),
                    dateShipped: Helper.getNodeValue(pkgNode, 'DATESHIPPED'),
                    isShipped: Helper.getNodeValue(pkgNode, 'SHIPPED')
                };

                if (!util.isArray(shipItemNodes) || vc2_util.isEmpty(shipItemNodes)) continue;

                for (var ii = 0, jj = shipItemNodes.length; ii < jj; ii++) {
                    var shipItemNode = shipItemNodes[ii],
                        shipItemNo = Helper.getNodeValue(shipItemNode, 'SHIPITEMNO'),
                        shipSerialNo = Helper.getNodeValue(shipItemNode, 'SERIALNO');

                    var pkgIndex = [packageObj.orderNum, shipItemNo].join('::');

                    if (!packagesList[pkgIndex])
                        packagesList[pkgIndex] = {
                            carriers: [],
                            carrierServices: [],
                            serials: [],
                            trackingNums: [],
                            dateshipped: []
                        };

                    if (shipSerialNo) packagesList[pkgIndex].serials.push(shipSerialNo);
                    packagesList[pkgIndex].carriers.push(packageObj.carrier);
                    packagesList[pkgIndex].carrierServices.push(packageObj.service);
                    packagesList[pkgIndex].trackingNums.push(packageObj.trackNum);
                    packagesList[pkgIndex].dateshipped.push(packageObj.dateShipped);
                }
            }

            return packagesList;
        }
    };

    return {
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                LibDnH.initialize(option);
                returnValue = LibDnH.getOrderStatus(option);
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                LibDnH.initialize(option);
                var xmlResponse = this.processRequest(option),
                    xmlResponseStr = xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse });

                if (!xmlDoc) throw 'Unable to parse XML';

                if (option.debugMode) {
                    if (!option.showLines) return xmlResponse;
                }
                // returnValue.Source = xmlResponseStr;

                var arrItemNodes = ns_xml.XPath.select({ node: xmlDoc, xpath: '//DETAILITEM' });

                // vc2_util.log(logTitle, '// Item Nodes: ', arrItemNodes);
                if (!util.isArray(arrItemNodes) || vc2_util.isEmpty(arrItemNodes))
                    throw 'XML: Missing Item Details';

                // retrieve the package nodes
                var arrPackageNodes = ns_xml.XPath.select({ node: xmlDoc, xpath: '//PACKAGE' });
                CURRENT.PackagesList = LibDnH.processPackages({ nodes: arrPackageNodes });

                // vc2_util.log(logTitle, '// Package List: ', CURRENT.PackagesList);

                var OrderList = {},
                    arrOrdersList = [],
                    itemArray = [];

                for (var i = 0; i < arrItemNodes.length; i++) {
                    var itemNode = arrItemNodes[i],
                        parentNode = itemNode.parentNode.parentNode;

                    var orderData = {
                        Status: Helper.getNodeValue(parentNode, 'MESSAGE') || 'NA',
                        OrderNum: Helper.getNodeValue(parentNode, 'PONUM') || 'NA',
                        VendorOrderNum: Helper.getNodeValue(parentNode, 'ORDERNUM') || 'NA',
                        OrderDate: vc2_util.parseFormatDate(
                            Helper.getNodeValue(parentNode, 'DATE') || 'NA',
                            'MM/DD/YY'
                        ),
                        Total: Helper.getNodeValue(parentNode, 'INVTOTAL') || 'NA',
                        InvoiceNo: Helper.getNodeValue(parentNode, 'INVOICE') || 'NA',
                        Source: itemNode.parentNode
                    };

                    if (!OrderList[orderData.OrderNum]) {
                        OrderList[orderData.OrderNum] = orderData;
                        arrOrdersList.push(orderData);
                    }

                    var itemObj = LibDnH.processItem({
                        node: itemNode,
                        parent: parentNode
                    });

                    itemArray.push(itemObj);
                }

                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;

                        itemObj[dateField] = vc2_util.parseFormatDate(
                            itemObj[dateField],
                            'MM/DD/YYYY'
                        );
                    });
                });

                util.extend(returnValue, {
                    Orders: arrOrdersList,
                    Lines: itemArray,
                    Source: xmlResponseStr
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        processItemInquiry: function (option) {
            var logTitle = [LogTitle, 'processItem'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                LibDnH.initialize(option);

                // first the do the MFR inquiry, then the DH item inquiry
                var xmlResponse = LibDnH.getItemInquiry(option);
                if (!xmlResponse) throw 'No response from D&H';

                var xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse });
                if (!xmlDoc) throw 'Unable to parse XML';

                var itemNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//ITEM' });
                if (!itemNode || itemNode.length < 1) throw 'No item details found';

                var itemObj = {
                    partNum: Helper.getNodeValue(itemNode[0], 'PARTNUM') || 'NA',
                    itemNum: Helper.getNodeValue(itemNode[0], 'VENDORITEMNO') || 'NA'
                };

                returnValue = itemObj;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };
});
