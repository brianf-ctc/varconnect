/**
 *@NApiVersion 2.x
 */
/**
 * Copyright (c) 2023
 * Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 *
 * Script Name: synnex_api.js
 *
 * Script Description:
 *
 *
 * Version    Date            Author           Remarks
 * 1.00       05/26/2023      raf               init
 * 2.0                        Aj                Fixed issues and changed the version
 */

define(function (require) {
    //Native modules
    var log = require('N/log');
    var util = require('N/util');
    var xml = require('N/xml');
    var https = require('N/https');
    var search = require('N/search');

    //Custom modules
    var vc2_util = require('./../../CTC_VC2_Lib_Utils');

    //Contants
    var LOG_TITLE = 'synnex_api.js';

    var NodeType = {
        ELEMENT: xml.NodeType.ELEMENT_NODE, //1
        TEXT: xml.NodeType.TEXT_NODE, //3
        CDATA: xml.NodeType.CDATA_SECTION_NODE, //4
        DOCUMENT: xml.NodeType.DOCUMENT_NODE //9
    };

    function _xml2json(xml) {
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
                    for (var i = 0, n = o.length; i < n; i++) o[i] = X.toJson(o[i], '', ind + '');
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
                } else if (typeof o == 'string') json += (name && ':') + '"' + o.toString() + '"';
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
    function _getHeader() {
        var headers = {
            Accept: '*/*',
            'Content-Type': 'application/xml'
        };
        return headers;
    }
    function _getInvoiceDetails(recordId, tranid, config) {
        var url = config.url;
        var user_id = config.user_id;
        var user_pass = config.user_pass;
        var partner_id = config.partner_id;

        var headers = _getHeader();
        var body = '<?xml version="1.0" encoding="UTF-8"?>';
        body += '<SynnexB2B version="2.2">';
        body += '<Credential>';
        body += '<UserID>' + user_id + '</UserID>';
        body += '<Password>' + user_pass + '</Password>';
        body += '</Credential>';
        body += '<InvoiceRequest>';
        body += '<CustomerNumber>' + partner_id + '</CustomerNumber>';
        body += '<PONumber>' + tranid + '</PONumber>';
        body += '</InvoiceRequest>';
        body += '</SynnexB2B>';
        var objResponse = https.post({
            url: url,
            headers: headers,
            body: body
        });
        log.debug('_getInvoiceDetails | response', objResponse);
        return objResponse.body;
    }

    function _extractInvoicesFromResponse(response) {
        log.debug('_extractInvoicesFromResponse | response', response);
        var returnArr = [];

        var xmlObj = xml.Parser.fromString(response);
        var xmlInvoice = xml.XPath.select({
            node: xmlObj,
            xpath: '//SynnexB2B/InvoiceResponse/Invoice'
        });

        var xmlInvoiceResponse = xml.XPath.select({
            node: xmlObj,
            xpath: '//SynnexB2B/InvoiceResponse'
        });

        var stPoNumber = '';
        if (Array.isArray(xmlInvoiceResponse) && typeof xmlInvoiceResponse[0] !== 'undefined') {
            var objInvoiceResponse = _xml2json(xmlInvoiceResponse[0]);
            stPoNumber = objInvoiceResponse['InvoiceResponse'].CustomerPONumber;
        }

        for (var i = 0; i < xmlInvoice.length; i++) {
            var jsonObj = _xml2json(xmlInvoice[i], '');
            var invoiceData = jsonObj && jsonObj.Invoice ? jsonObj.Invoice : {};

            var myObj = {
                po: invoiceData.CustomerPONumber || stPoNumber,
                date: invoiceData.InvoiceDate,
                invoice: invoiceData.InvoiceNumber,
                charges: {
                    tax: parseFloat(invoiceData.Summary.SalesTax),
                    other:
                        parseFloat(invoiceData.Summary.MinOrderFee) +
                        parseFloat(invoiceData.Summary.ProcessingFee) +
                        parseFloat(invoiceData.Summary.BoxCharge),
                    shipping: parseFloat(invoiceData.Summary.Freight)
                },
                total: parseFloat(invoiceData.Summary.TotalInvoiceAmount),
                lines: []
            };

            if (!util.isArray(invoiceData.Items.Item)) {
                invoiceData.Items.Item = [invoiceData.Items.Item];
            }
            for (var ii = 0, jj = invoiceData.Items.Item.length; ii < jj; ii++) {
                var itemData = invoiceData.Items.Item[ii];

                myObj.lines.push({
                    processed: false,
                    ITEMNO: itemData.ManuafacturerPartNumber,
                    PRICE: parseFloat(itemData.UnitPrice),
                    QUANTITY: parseFloat(itemData.ShipQuantity),
                    DESCRIPTION: itemData.ProductDescription
                });
            }

            returnArr.push({
                ordObj: myObj
            });
        }
        return returnArr;
    }
    function processXml(recordId, config) {
        log.debug(LOG_TITLE, 'processXml');
        log.debug('Synnex', 'getOrderStatus');
        var objPoRec = vc2_util.flatLookup({
            type: search.Type.PURCHASE_ORDER,
            id: recordId,
            columns: ['tranid']
        });
        var tranid = objPoRec.tranid;
        var response = _getInvoiceDetails(recordId, tranid, config);
        return _extractInvoicesFromResponse(response);
    }

    return {
        processXml: processXml
    };
});
