/**
 * synnex_sftp.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/xml', 'N/sftp', '../Libraries/moment'], function (ns_xml, ns_sftp, moment) {
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

    function processXml(input, config) {
        // establish connection to remote FTP server

        var connection = ns_sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.res_path,
            hostKey: config.host_key
        });

        var downloadedFile = connection.download({
            filename: input
        });

        var xmlStr = downloadedFile.getContents();
        var returnArr = [];

        var xmlObj = ns_xml.Parser.fromString(xmlStr);
        var xmlInvoice = ns_xml.XPath.select({
            node: xmlObj,
            xpath: '//SynnexB2B/Invoice'
        });

        for (var i = 0; i < xmlInvoice.length; i++) {
            var jsonObj = Helper.xml2json(xmlInvoice[i], '');
            var invoiceData = jsonObj && jsonObj.Invoice ? jsonObj.Invoice : {};

            var myObj = {
                po: invoiceData.CustomerPONumber,
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

        log.debug('returnArr', returnArr);
        return returnArr;
    }

    function processXml_old(input, config) {
        // establish connection to remote FTP server

        var connection = ns_sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.res_path,
            hostKey: config.host_key
        });

        var downloadedFile = connection.download({
            filename: input
        });

        var xmlStr = downloadedFile.getContents();

        var xmlArr = [];

        // Parse the file and break up individual bills

        var xmlKey = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';

        do {
            if (xmlStr.indexOf(xmlKey, xmlKey.length) == -1) {
                xmlArr.push(xmlStr);
                xmlStr = '';
            } else {
                xmlArr.push(xmlStr.slice(0, xmlStr.indexOf(xmlKey, xmlKey.length)));
                xmlStr = xmlStr.slice(xmlStr.indexOf(xmlKey, xmlKey.length), xmlStr.length);
            }

            log.debug('xmlStr', JSON.stringify(xmlStr));
        } while (xmlStr.indexOf(xmlKey) == 0);

        var returnArr = [];

        for (f = 0; f < xmlArr.length; f++) {
            var returnObj = {};
            returnObj.xmlStr = xmlArr[f];

            var xmlObj = ns_xml.Parser.fromString(xmlArr[f]);

            var myObj = {};

            myObj.po = ns_xml.XPath.select({
                node: xmlObj,
                xpath: '/SynnexB2B/Invoice/CustomerPONumber'
            })[0].textContent;

            myObj.charges = {};

            //XML XPath Tool https://xmlgrid.net/

            var rawDate = ns_xml.XPath.select({
                //12/16/16
                node: xmlObj,
                xpath: '/SynnexB2B/Invoice/InvoiceDate'
            })[0].textContent;

            myObj.date = moment(rawDate, 'YYYY-MM-DD').format('MM/DD/YYYY');

            myObj.invoice = ns_xml.XPath.select({
                node: xmlObj,
                xpath: '/SynnexB2B/Invoice/InvoiceNumber'
            })[0].textContent;

            myObj.charges.tax =
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/SalesTax'
                })[0].textContent * 1;

            // myObj.charges.other = ns_xml.XPath.select({
            //   node: xmlObj,
            //   xpath: '/SynnexB2B/Invoice/Summary/ExpenseTotal'
            // })[0].textContent * 1;

            myObj.charges.other =
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/MinOrderFee'
                })[0].textContent * 1;

            myObj.charges.other +=
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/ProcessingFee'
                })[0].textContent * 1;

            myObj.charges.other +=
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/BoxCharge'
                })[0].textContent * 1;

            myObj.charges.shipping =
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/Freight'
                })[0].textContent * 1;

            myObj.total =
                ns_xml.XPath.select({
                    node: xmlObj,
                    xpath: '/SynnexB2B/Invoice/Summary/TotalInvoiceAmount'
                })[0].textContent * 1;

            myObj.lines = [];

            var lineItem = ns_xml.XPath.select({
                node: xmlObj,
                xpath: '/SynnexB2B/Invoice/Items/Item'
            });

            log.debug('sx: lines', lineItem.length);
            log.debug('sx: lineItem', lineItem);

            for (var i = 0; i < lineItem.length; i++) {
                var lineObj = {};

                lineObj.processed = false;

                lineObj.ITEMNO = lineItem[i].getElementsByTagName({
                    tagName: 'ManuafacturerPartNumber'
                })[0].textContent;

                lineObj.PRICE =
                    lineItem[i].getElementsByTagName({
                        tagName: 'UnitPrice'
                    })[0].textContent * 1;

                lineObj.QUANTITY =
                    lineItem[i].getElementsByTagName({
                        tagName: 'ShipQuantity'
                    })[0].textContent * 1;

                lineObj.DESCRIPTION = lineItem[i].getElementsByTagName({
                    tagName: 'ProductDescription'
                })[0].textContent;

                myObj.lines.push(lineObj);
            }

            returnObj.ordObj = myObj;

            returnArr.push(returnObj);
        }

        log.debug('returnArr', returnArr);

        return returnArr;
    }

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
