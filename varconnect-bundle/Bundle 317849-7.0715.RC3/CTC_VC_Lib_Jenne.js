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
 * @description Helper file for Jenne to Get PO Status
 */

/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Jenne
 * Author: shawn.blackburn
 */
define([
    'N/https',
    './CTC_VC_Lib_Log.js',
    'N/xml',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_https, vcLog, ns_xml, vc2_util, moment) {
    'use strict';

    var LogTitle = 'WS:Jenne',
        LogPrefix;

    var CURRENT = {};

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
                        url: option.vendorConfig.endPoint,
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
                            ('<email>' + option.vendorConfig.user + '</email>') +
                            ('<password>' + option.vendorConfig.password + '</password>') +
                            ('<poNumber>' + option.poNum + '</poNumber>') +
                            '<startDate></startDate>' +
                            '<endDate></endDate>' +
                            '</AdvanceShipNoticeGet_v2>' +
                            '</soap:Body>' +
                            '</soap:Envelope>'
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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = libJenneAPI.AdvanceShipNoticeGet(option);
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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    jsonResp = Helper.xml2json(xmlDoc) || 'no-value',
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML response';
                if (!jsonResp) throw 'Unable to parse XML to JSON';

                vcLog.recordLog({
                    header: 'Jenne RESULTS',
                    body: JSON.stringify(jsonResp),
                    transaction: CURRENT.recordId
                });

                CURRENT.results =
                    jsonResp['soap:Envelope'][
                        'soap:Body'
                    ].AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result.AdvanceShipNotices;

                if (!CURRENT.results) throw 'Missing API results';

                vcLog.recordLog({
                    header: 'Jenne ASN RESULTS',
                    body: JSON.stringify(CURRENT.results),
                    transaction: CURRENT.recordId
                });

                var itemArray = [];

                // check for any errors
                if (CURRENT.results.Error && CURRENT.results.Error.ErrorDescription) {
                    throw CURRENT.results || 'Undetermined error on results';
                }

                var arrResultOrders = CURRENT.results.AdvanceShipNotice_v2;
                if (!arrResultOrders) throw 'Missing order details';

                // if not array, force into an array
                if (!util.isArray(arrResultOrders)) arrResultOrders = [arrResultOrders];

                vc2_util.log(logTitle, 'Total orders: ', arrResultOrders.length);

                for (var i = 0, j = arrResultOrders.length; i < j; i++) {
                    vc2_util.log(logTitle, '>> order: ', arrResultOrders[i]);
                    var orderData = libJenneAPI.extractOrder(arrResultOrders[i], itemArray);
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
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                vc2_util.LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var xmlResponse = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: xmlResponse });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        }
    };

    // /**
    //  * @memberOf CTC_VC_Lib_Ingram_v1
    //  * @param {object} option
    //  * @returns object
    //  **/
    // function processRequest(option) {
    //     var headers = {
    //         SOAPAction: 'http://WebService.jenne.com/AdvanceShipNoticeGet_v2',
    //         'Content-Type': 'text/xml'
    //     };

    //     var body =
    //         '<?xml version="1.0" encoding="utf-8"?>' +
    //         ' <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
    //         '  xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
    //         '  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    //         '  <soap:Body>' +
    //         '   <AdvanceShipNoticeGet_v2' +
    //         '    xmlns="http://WebService.jenne.com">' +
    //         '    <email>' +
    //         option.vendorConfig.user +
    //         '</email>' +
    //         '    <password>' +
    //         option.vendorConfig.password +
    //         '</password>' +
    //         '    <poNumber>' +
    //         option.poNum +
    //         '</poNumber>' +
    //         '    <startDate></startDate>' +
    //         '    <endDate></endDate>' +
    //         '   </AdvanceShipNoticeGet_v2>' +
    //         '  </soap:Body>' +
    //         ' </soap:Envelope>';

    //     log.audit({
    //         title: 'request body',
    //         details: body
    //     });

    //     vcLog.recordLog({
    //         header: 'Jenne Get PO Request',
    //         body: JSON.stringify(body),
    //         transaction: option.poId,
    //         isDebugMode: option.fromDebug
    //     });

    //     var response = ns_https.post({
    //         url: option.vendorConfig.endPoint,
    //         body: body,
    //         headers: headers
    //     });

    //     vcLog.recordLog({
    //         header: 'Jenne Get PO Response',
    //         body: JSON.stringify(response),
    //         transaction: option.poId,
    //         isDebugMode: option.fromDebug
    //     });

    //     if (response) {
    //         log.debug({
    //             title: 'Response',
    //             details: response
    //         });

    //         var x = ns_xml.Parser.fromString(response.body);

    //         var j = xmlToJson(x.documentElement);

    //         log.debug({
    //             title: 'XML Converted to JSON',
    //             details: j
    //         });

    //         var responseBody =
    //             j['soap:Body'].AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result;

    //         log.debug({
    //             title: 'Response Body',
    //             details: responseBody
    //         });

    //         return responseBody;
    //     }
    // }

    // outputObj = {
    //   order_date: "",
    //   order_num: "",
    //   line_num: "",
    //   item_num: "",
    //   ship_qty: "",
    //   ship_date: "",
    //   order_eta: "",
    //   carrier: "",
    //   tracking_num: "1Z1..,1Z2...,1Z3... ",
    //   serials: "123,456,789"
    // }

    // function processResponse(obj) {
    //     log.debug('processResponse', JSON.stringify(obj));

    //     var outputArray = [];

    //     if (obj.responseBody.Error) {
    //         var errorNumber = obj.responseBody.Error.ErrorNumber['#text'];
    //         var errorDescription = obj.responseBody.Error.ErrorDescription['#text'];
    //         if (errorNumber || errorDescription) {
    //             throw '(' + errorNumber + ') ' + errorDescription;
    //         }
    //     }

    //     var shipments = obj.responseBody.AdvanceShipNotices.AdvanceShipNotice_v2;

    //     if (util.isArray(shipments))
    //         shipments.forEach(function (asn) {
    //             outputArray = _processASN({
    //                 asn: asn,
    //                 outputArray: outputArray
    //             });
    //         });
    //     else
    //         outputArray = _processASN({
    //             asn: shipments,
    //             outputArray: outputArray
    //         });

    //     log.audit({
    //         title: 'outputArray',
    //         details: outputArray
    //     });

    //     return outputArray;
    // }

    // function _processASN(options) {
    //     var asn = options.asn,
    //         outputArray = options.outputArray;

    //     log.debug('entered asn', asn);

    //     if (JSON.stringify(asn).length > 2) {
    //         log.debug('entered', 'has own property');

    //         var carton = asn.ASNcartons.ASNcarton_v2;

    //         // still sorting this out but sometimes asn.ASNcartons.ASNcarton_v2 is an array and ASNcartonDetails.ASNcartonDetail_v2 is an object
    //         // but sometimes it's the other way around.  since these are nested objects writing two different version of the same code seems to be
    //         // the best way to handle it.

    //         //            if (Array.isArray(carton) == true) {
    //         if (util.isArray(carton)) {
    //             carton.forEach(function (cartonDetail) {
    //                 _processCarton({
    //                     asn: asn,
    //                     carton: cartonDetail,
    //                     outputArray: outputArray
    //                 });
    //             });
    //         } else {
    //             var cartonDetail = carton.ASNcartonDetails.ASNcartonDetail_v2;
    //             _processCarton({
    //                 asn: asn,
    //                 carton: carton,
    //                 outputArray: outputArray
    //             });
    //         }
    //     }

    //     return outputArray;
    // }

    // function _processCarton(options) {
    //     var asn = options.asn,
    //         carton = options.carton,
    //         outputArray = options.outputArray;

    //     var cartonDetail = carton.ASNcartonDetails.ASNcartonDetail_v2;

    //     if (util.isArray(cartonDetail)) {
    //         cartonDetail.forEach(function (cartonDetails) {
    //             _processCartonDetails({
    //                 asn: asn,
    //                 carton: carton,
    //                 cartonDetails: cartonDetails,
    //                 outputArray: outputArray
    //             });
    //         });
    //     } else {
    //         _processCartonDetails({
    //             asn: asn,
    //             carton: carton,
    //             cartonDetails: cartonDetail,
    //             outputArray: outputArray
    //         });
    //     }
    // }

    // function _processCartonDetails(options) {
    //     var asn = options.asn,
    //         carton = options.carton,
    //         cartonDetails = options.cartonDetails,
    //         outputArray = options.outputArray;

    //     var o = {};

    //     // change date format
    //     // from YYYY-MM-DD to MM/DD/YYYY
    //     log.debug('mapping', 'odate');
    //     var odate = asn.OrderDate['#text'];
    //     o.ship_date = odate.slice(5, 7) + '/' + odate.slice(8, 10) + '/' + odate.slice(0, 4);

    //     log.debug('mapping', 'order_num');
    //     o.order_num = asn.OrderNumber['#text'];
    //     log.debug('mapping', 'line_num');
    //     o.line_num = asn.ASNcartons.ASNcarton_v2.CartonNo['#text'];
    //     log.debug('mapping', 'item_num');
    //     o.item_num = cartonDetails.PartNumber['#text'];
    //     log.debug('mapping', 'ship_qty');
    //     o.ship_qty = parseInt(cartonDetails.QtyShipped['#text']);

    //     // change date format
    //     // from YYYY-MM-DD to MM/DD/YYYY
    //     log.debug('mapping', 'sdate');
    //     var sdate = carton.DateShipped['#text'];
    //     o.ship_date = sdate.slice(5, 7) + '/' + sdate.slice(8, 10) + '/' + sdate.slice(0, 4);

    //     o.order_eta = '';
    //     log.debug('mapping', 'carrier');
    //     o.carrier = carton.ShipVia['#text'];
    //     log.debug('mapping', 'tracking');
    //     o.tracking_num = carton.TrackingNo['#text'];
    //     log.debug('mapping', 'serial');
    //     o.serial_num = cartonDetails.SerialNumber['#text'];

    //     outputArray.push(o);
    // }

    // function xmlToJson(xmlNode, parentName) {
    //     var logTitle = [LogTitle, 'xmlToJson'].join('::'),
    //         returnValue = [];

    //     // Create the return object
    //     var obj = {}; //Object.create(null);
    //     var elemName = (parentName || '') + '/' + xmlNode.nodeName;

    //     try {
    //         vc2_util.log(logTitle, elemName + ': ', [
    //             xmlNode.nodeValue,
    //             xmlNode.nodeType,
    //             xmlNode.hasChildNodes(),
    //             xmlNode.childNodes.length
    //         ]);

    //         if (xmlNode.nodeType == ns_xml.NodeType.ELEMENT_NODE) {
    //             if (xmlNode.hasAttributes()) {
    //                 obj['@attributes'] = {}; //Object.create(null);
    //                 for (var attr in xmlNode.attributes) {
    //                     if (xmlNode.hasAttribute({ name: attr })) {
    //                         obj['@attributes'][attr] = xmlNode.getAttribute({ name: attr });
    //                     }
    //                 }
    //             }
    //         } else if (xmlNode.nodeType == ns_xml.NodeType.TEXT_NODE) {
    //             // text
    //             obj = xmlNode.nodeValue;
    //         }

    //         // do children
    //         if (xmlNode.hasChildNodes()) {
    //             for (var i = 0, j = xmlNode.childNodes.length; i < j; i++) {
    //                 var childItem = xmlNode.childNodes[i];
    //                 var nodeName = childItem.nodeName;

    //                 if (nodeName in obj) {
    //                     if (!Array.isArray(obj[nodeName])) {
    //                         obj[nodeName] = [obj[nodeName]];
    //                     }
    //                     obj[nodeName].push(xmlToJson(childItem, elemName));
    //                 } else {
    //                     obj[nodeName] = xmlToJson(childItem, elemName);
    //                 }
    //             }
    //         }
    //     } catch (error) {
    //         vc2_util.logError(logTitle, error);
    //     }

    //     return obj;
    // }

    // function dumpJson(jsonObj, prefx) {
    //     var logTitle = [LogTitle, 'dumpJson'].join('::');

    //     for (var fld in jsonObj) {
    //         if (typeof jsonObj[fld] == 'object') {
    //             dumpJson(jsonObj[fld], (prefx || '') + '___');
    //         } else if (util.isArray(jsonObj[fld])) {
    //             jsonObj[fld].forEach(function (value) {
    //                 dumpJson(value, prefx + '--');
    //                 return true;
    //             });
    //         } else {
    //             vc2_util.log(logTitle, fld + ': ', jsonObj[fld]);
    //         }
    //     }
    //     return true;
    // }

    // function process(options) {
    //     log.audit({
    //         title: 'options',
    //         details: options
    //     });
    //     var outputArray = null;

    //     var responseBody = processRequest({
    //         poNum: options.poNum,
    //         vendorConfig: options.vendorConfig,
    //         poId: options.poId
    //     });

    //     if (responseBody) {
    //         outputArray = processResponse({
    //             vendorConfig: options.vendorConfig,
    //             responseBody: responseBody
    //         });
    //     }
    //     log.audit({
    //         title: 'outputArray',
    //         details: outputArray
    //     });
    //     return outputArray;
    // }

    // return {
    //     process: process,
    //     processRequest: processRequest
    // };
});
