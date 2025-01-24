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
 * @description Helper file for Jenne to Get PO Status
 */

/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Jenne
 * Author: shawn.blackburn
 */
define([
    'N/https',
    'N/xml',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_https, ns_xml, vcLog, vc2_util, moment) {
    'use strict';

    var LogTitle = 'WS:Jenne',
        LogPrefix;

    var CURRENT = {},
        DATE_FIELDS = [
            'order_date',
            'order_eta',
            'order_delivery_eta',
            'deliv_date',
            'prom_date',
            'ship_date'
        ];

    var NodeType = {
        ELEMENT: ns_xml.NodeType.ELEMENT_NODE, //1
        TEXT: ns_xml.NodeType.TEXT_NODE, //3
        CDATA: ns_xml.NodeType.CDATA_SECTION_NODE, //4
        DOCUMENT: ns_xml.NodeType.DOCUMENT_NODE //9
    };

    var Helper = {
        xml2json: function (xml) {
            var X = {
                toObj: function (xml) {
                    var o = {};
                    if (xml.nodeType == NodeType.ELEMENT) {
                        // element node ..
                        if (xml.attributes.length)
                            // element with attributes  ..
                            for (var i = 0; i < xml.attributes.length; i++)
                                o['@' + xml.attributes[i].nodeName] = (
                                    xml.attributes[i].nodeValue || ''
                                ).toString();
                        if (xml.firstChild) {
                            // element has child nodes ..
                            var textChild = 0,
                                cdataChild = 0,
                                hasElementChild = false;
                            for (var n = xml.firstChild; n; n = n.nextSibling) {
                                if (n.nodeType == NodeType.ELEMENT) hasElementChild = true;
                                else if (
                                    n.nodeType == NodeType.TEXT &&
                                    n.nodeValue.match(/[^ \f\n\r\t\v]/)
                                )
                                    textChild++;
                                // non-whitespace text
                                else if (n.nodeType == NodeType.CDATA) cdataChild++; // cdata section node
                            }
                            if (hasElementChild) {
                                if (textChild < 2 && cdataChild < 2) {
                                    // structured element with evtl. a single text or/and cdata node ..
                                    X.removeWhite(xml);
                                    for (var n = xml.firstChild; n; n = n.nextSibling) {
                                        if (n.nodeType == NodeType.TEXT)
                                            // text node
                                            o['#text'] = X.escape(n.nodeValue);
                                        else if (n.nodeType == NodeType.CDATA)
                                            // cdata node
                                            o['#cdata'] = X.escape(n.nodeValue);
                                        else if (o[n.nodeName]) {
                                            // multiple occurence of element ..
                                            if (o[n.nodeName] instanceof Array)
                                                o[n.nodeName][o[n.nodeName].length] = X.toObj(n);
                                            else o[n.nodeName] = [o[n.nodeName], X.toObj(n)];
                                        } // first occurence of element..
                                        else o[n.nodeName] = X.toObj(n);
                                    }
                                } else {
                                    // mixed content
                                    if (!xml.attributes.length) o = X.escape(X.innerXml(xml));
                                    else o['#text'] = X.escape(X.innerXml(xml));
                                }
                            } else if (textChild) {
                                // pure text
                                if (!xml.attributes.length) o = X.escape(X.innerXml(xml));
                                else o['#text'] = X.escape(X.innerXml(xml));
                            } else if (cdataChild) {
                                // cdata
                                if (cdataChild > 1) o = X.escape(X.innerXml(xml));
                                else
                                    for (var n = xml.firstChild; n; n = n.nextSibling)
                                        o['#cdata'] = X.escape(n.nodeValue);
                            }
                        }
                        if (!xml.attributes.length && !xml.firstChild) o = null;
                    } else if (xml.nodeType == NodeType.DOCUMENT) {
                        // document.node
                        o = X.toObj(xml.documentElement);
                    } else log.debug('xml2json', 'unhandled node type: ' + xml.nodeType);
                    return o;
                },
                toJson: function (o, name, ind) {
                    var json = name ? '"' + name + '"' : '';
                    if (o instanceof Array) {
                        for (var i = 0, n = o.length; i < n; i++)
                            o[i] = X.toJson(o[i], '', ind + '');
                        json +=
                            (name ? ':[' : '[') +
                            (o.length > 1
                                ? '' + ind + '' + o.join(',' + ind + '') + '' + ind
                                : o.join('')) +
                            ']';
                    } else if (o == null) json += (name && ':') + 'null';
                    else if (typeof o == 'object') {
                        var arr = [];
                        for (var m in o) arr[arr.length] = X.toJson(o[m], m, ind + '');
                        json +=
                            (name ? ':{' : '{') +
                            (arr.length > 1
                                ? '' + ind + '' + arr.join(',' + ind + '') + '' + ind
                                : arr.join('')) +
                            '}';
                    } else if (typeof o == 'string')
                        json += (name && ':') + '"' + o.toString() + '"';
                    else json += (name && ':') + o.toString();
                    return json;
                },
                innerXml: function (node) {
                    var s = '';
                    if ('innerHTML' in node) s = node.innerHTML;
                    else {
                        var asXml = function (n) {
                            var s = '';
                            if (n.nodeType == NodeType.ELEMENT) {
                                s += '<' + n.nodeName;
                                for (var i = 0; i < n.attributes.length; i++)
                                    s +=
                                        ' ' +
                                        n.attributes[i].nodeName +
                                        '="' +
                                        (n.attributes[i].nodeValue || '').toString() +
                                        '"';
                                if (n.firstChild) {
                                    s += '>';
                                    for (var c = n.firstChild; c; c = c.nextSibling) s += asXml(c);
                                    s += '</' + n.nodeName + '>';
                                } else s += '/>';
                            } else if (n.nodeType == NodeType.TEXT) s += n.nodeValue;
                            else if (n.nodeType == NodeType.CDATA)
                                s += '<![CDATA[' + n.nodeValue + ']]>';
                            return s;
                        };
                        for (var c = node.firstChild; c; c = c.nextSibling) s += asXml(c);
                    }
                    return s;
                },
                escape: function (txt) {
                    return (
                        txt &&
                        txt
                            .replace(/[\\]/g, '\\\\')
                            .replace(/[\"]/g, '\\"')
                            .replace(/[\n]/g, '\\n')
                            .replace(/[\r]/g, '\\r')
                    );
                },
                removeWhite: function (e) {
                    e.normalize();
                    for (var n = e.firstChild; n; ) {
                        if (n.nodeType == NodeType.TEXT) {
                            // text node
                            if (n.nodeValue && !n.nodeValue.match(/[^ \f\n\r\t\v]/)) {
                                // pure whitespace text node
                                var nxt = n.nextSibling;
                                e.removeChild(n);
                                n = nxt;
                            } else n = n.nextSibling;
                        } else if (n.nodeType == NodeType.ELEMENT) {
                            // element node
                            X.removeWhite(n);
                            n = n.nextSibling;
                        } // any other node
                        else n = n.nextSibling;
                    }
                    return e;
                }
            };
            if (xml.nodeType == NodeType.DOCUMENT)
                // document node
                xml = xml.documentElement;
            var json = X.toJson(X.toObj(X.removeWhite(xml)), xml.nodeName, '');
            var jsonText = '{' + json.replace(/\t|\n/g, '') + '}';
            jsonText = jsonText
                .replace(/\b&\b/gm, '&amp;')
                .replace(/\\t|\t/gm, '    ')
                .replace(/\\n|\n/gm, '');
            return JSON.parse(jsonText);
        }
    };

    var libJenneAPI = {
        AdvanceShipNoticeGet: function (option) {
            var logTitle = [LogTitle, 'AdvanceShipNoticeGet'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqOrderStatus = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' '),
                    recordId: CURRENT.recordId,
                    method: 'post',
                    query: {
                        url: option.orderConfig.endPoint,

                        headers: {
                            SOAPAction: 'http://WebService.jenne.com/AdvanceShipNoticeGet_v2',
                            'Content-Type': 'text/xml'
                        },
                        body:
                            '<?xml version="1.0" encoding="utf-8"?>' +
                            '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
                            ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
                            ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                            '<soap:Body>' +
                            '<AdvanceShipNoticeGet_v2 xmlns="http://WebService.jenne.com">' +
                            ('<email>' + option.orderConfig.user + '</email>') +
                            ('<password>' + option.orderConfig.password + '</password>') +
                            ('<poNumber>' + option.poNum + '</poNumber>') +
                            '<startDate></startDate>' +
                            '<endDate></endDate>' +
                            '</AdvanceShipNoticeGet_v2>' +
                            '</soap:Body>' +
                            '</soap:Envelope>'
                    }
                });
                vc2_util.handleXMLResponse(reqOrderStatus);
                vc2_util.log(logTitle, 'response: ', reqOrderStatus);

                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';

                returnValue = respOrderStatus;
            } catch (error) {
                throw error;
            } finally {
                vc2_util.log(logTitle, '... returnValue: ', returnValue);
            }

            return returnValue;
        },
        extractOrder: function (orderNode, itemArray) {
            var logTitle = [LogTitle, 'extractOrder'].join('::'),
                returnValue;

            try {
                var orderInfo = {};
                vc2_util.log(logTitle, 'orderNode: ', orderNode);
                if (!orderNode) return;

                util.extend(orderInfo, {
                    order_num: orderNode.OrderNumber,
                    order_date: moment(orderNode.OrderDate, 'YYYY-MM-DD'),
                    ship_date: moment(orderNode.DateShipped, 'MM/DD/YYYY'),
                    carrier: 'NA',
                    line_num: 'NA',
                    item_num: 'NA',
                    vendorSKU: 'NA',
                    line_status: 'NA',
                    order_status: 'NA',
                    ship_qty: 'NA',
                    serial_num: 'NA',
                    tracking_num: 'NA'
                });

                // process cartons
                var shipNode =
                    orderNode.ASNcartons && orderNode.ASNcartons.ASNcarton_v2
                        ? orderNode.ASNcartons.ASNcarton_v2
                        : null;

                if (vc2_util.isEmpty(shipNode)) return false;
                if (!util.isArray(shipNode)) shipNode = [shipNode];

                shipNode.forEach(function (ship) {
                    libJenneAPI.extractShipping(ship, orderInfo, itemArray);
                    return true;
                });

                returnValue = orderInfo;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },
        extractShipping: function (shipNode, orderInfo, itemArray) {
            var logTitle = [LogTitle, 'extractShipping'].join('::'),
                returnValue;

            try {
                vc2_util.log(logTitle, 'shipNode: ', shipNode);
                vc2_util.log(logTitle, 'orderInfo: ', orderInfo);

                var shipData = orderInfo || {};

                util.extend(shipData, {
                    carrier: shipNode.ShipVia,
                    tracking: shipNode.TrackingNo,
                    ship_date: moment(shipNode.DateShipped)
                });

                var shipDetails =
                    shipNode.ASNcartonDetails && shipNode.ASNcartonDetails.ASNcartonDetail_v2
                        ? shipNode.ASNcartonDetails.ASNcartonDetail_v2
                        : null;

                if (!vc2_util.isEmpty(shipDetails)) {
                    if (!util.isArray(shipDetails)) shipDetails = [shipDetails];

                    shipDetails.forEach(function (shipDetail) {
                        // clone the shipData
                        var itemData = vc2_util.extend(shipData, {
                            item_num: shipDetail.PartNumber,
                            line_num: shipDetail.OrderLineNumber,
                            ship_qty: shipDetail.QtyShipped,
                            serial_num: shipDetail.SerialNumber
                        });

                        itemArray.push(itemData);
                        return true;
                    });
                }
            } catch (error) {
                throw error;
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
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;

                LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                returnValue = libJenneAPI.AdvanceShipNoticeGet(option);
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
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.orderConfig = option.orderConfig || CURRENT.orderConfig;
                LogPrefix = '[purchaseorder:' + (CURRENT.recordId || CURRENT.recordNum) + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.orderConfig) throw 'Missing vendor configuration!';

                var xmlResponse = this.processRequest(option),
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    jsonResp = Helper.xml2json(xmlDoc) || 'no-value',
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML response';
                if (!jsonResp) throw 'Unable to parse XML to JSON';

                if (option.debugMode) {
                    if (!option.showLines) return xmlResponse;
                }

                var responseBody = jsonResp['soap:Envelope']
                    ? jsonResp['soap:Envelope']['soap:Body']
                    : null;
                if (!responseBody) throw 'Response body is not found';

                var responseError =
                    responseBody.AdvanceShipNoticeGet_v2Response &&
                    responseBody.AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result
                        ? responseBody.AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result
                              .Error
                        : null;

                if (
                    !vc2_util.isEmpty(responseError) &&
                    responseError.ErrorNumber &&
                    responseError.ErrorDescription
                ) {
                    throw responseError.ErrorDescription || 'Unexpected error detected.';
                }

                var responseResult =
                    responseBody.AdvanceShipNoticeGet_v2Response &&
                    responseBody.AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result
                        ? responseBody.AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result
                              .AdvanceShipNotices
                        : null;
                if (!responseResult) throw 'Advanced Ship Notices is not found';

                var itemArray = [],
                    orderList = [];

                var arrOrderResults = responseResult.AdvanceShipNotice_v2;
                if (vc2_util.isEmpty(arrOrderResults)) throw 'Missing order results';
                if (!util.isArray(arrOrderResults)) arrOrderResults = [arrOrderResults];

                vc2_util.log(logTitle, '.. arrOrderResults: ', arrOrderResults);

                arrOrderResults.forEach(function (orderResult) {
                    if (!orderResult) return;
                    vc2_util.log(logTitle, '.. orderResult: ', orderResult);

                    var orderData = {
                            OrderNum: orderResult.PONumber,
                            OrderDate: vc2_util.parseFormatDate(
                                orderResult.OrderDate,
                                'YYYY-MM-DD'
                            ),
                            VendorOrderNum: orderResult.OrderNumber,
                            Lines: [],
                            Source: orderResult
                        },
                        itemObj = {
                            order_num: orderResult.OrderNumber,
                            order_date: orderResult.OrderDate || 'NA',
                            ship_date: orderResult.DateShipped || 'NA',
                            carrier: 'NA',
                            line_num: 'NA',
                            item_num: 'NA',
                            vendorSKU: 'NA',
                            line_status: 'NA',
                            order_status: 'NA',
                            ship_qty: 'NA',
                            serial_num: 'NA',
                            tracking_num: 'NA'
                        };

                    var arrShipNode = orderResult.ASNcartons
                        ? orderResult.ASNcartons.ASNcarton_v2
                        : null;

                    if (vc2_util.isEmpty(arrShipNode)) return;
                    if (!util.isArray(arrShipNode)) arrShipNode = [arrShipNode];

                    arrShipNode.forEach(function (shipNode) {
                        util.extend(itemObj, {
                            carrier: shipNode.ShipVia,
                            tracking: shipNode.TrackingNo,
                            ship_date: shipNode.DateShipped || 'NA'
                        });

                        var shipDetails = shipNode.ASNcartonDetails
                            ? shipNode.ASNcartonDetails.ASNcartonDetail_v2
                            : null;
                        if (!shipDetails) return;
                        if (!util.isArray(shipDetails)) shipDetails = [shipDetails];

                        shipDetails.forEach(function (shipDetail) {
                            var itemData = vc2_util.clone(itemObj);
                            util.extend(itemData, {
                                item_num: shipDetail.PartNumber,
                                line_num: shipDetail.OrderLineNumber,
                                ship_qty: shipDetail.QtyShipped,
                                serial_num: shipDetail.SerialNumber
                            });
                            itemArray.push(itemData);
                            orderData.Lines.push(itemData);
                        });
                    });

                    orderList.push(orderData);
                });

                // run through itemArray and check for DATE_FIELDS
                vc2_util.log(logTitle, 'itemArray: ', itemArray);
                itemArray.forEach(function (itemObj) {
                    DATE_FIELDS.forEach(function (dateField) {
                        if (!itemObj[dateField] || itemObj[dateField] == 'NA') return;

                        itemObj[dateField] = vc2_util.parseFormatDate(
                            itemObj[dateField],
                            'YYYY-MM-DD'
                        );
                    });
                });

                util.extend(returnValue, {
                    Orders: orderList,
                    Lines: itemArray,
                    Source: xmlResponse
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };
});
