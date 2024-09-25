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
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/xml', 'N/record', 'N/search'], function (
    serverWidget,
    ns_xml,
    ns_record,
    ns_search
) {
    var LogTitle = 'XML Tester';

    var NodeType = {
        ELEMENT: ns_xml.NodeType.ELEMENT_NODE, //1
        TEXT: ns_xml.NodeType.TEXT_NODE, //3
        CDATA: ns_xml.NodeType.CDATA_SECTION_NODE, //4
        DOCUMENT: ns_xml.NodeType.DOCUMENT_NODE //9
    };

    var Helper = {
        xml2json: function (xml, tab) {
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
            // return '{\n' + tab + (tab ? json.replace(/\t/g, tab) : json.replace(/\t|\n/g, '')) + '\n}';
            var jsonText = '{' + json.replace(/\t|\n/g, '') + '}';
            jsonText = jsonText
                .replace(/\b&\b/gm, '&amp;')
                .replace(/\\t|\t/gm, '    ')
                .replace(/\\n|\n/gm, '');
            return JSON.parse(jsonText);
        },

        xmlToJson: function (xmlNode) {
            // Create the return object
            var obj = Object.create(null);

            if (xmlNode.nodeType == ns_xml.NodeType.ELEMENT_NODE) {
                // element
                // do attributes
                if (xmlNode.hasAttributes()) {
                    obj['@attributes'] = Object.create(null);
                    for (var j in xmlNode.attributes) {
                        if (xmlNode.hasAttribute({ name: j })) {
                            obj['@attributes'][j] = xmlNode.getAttribute({
                                name: j
                            });
                        }
                    }
                }
            } else if (xmlNode.nodeType == ns_xml.NodeType.TEXT_NODE) {
                // text
                obj = xmlNode.nodeValue;
            }

            // do children
            if (xmlNode.hasChildNodes()) {
                for (var i = 0, childLen = xmlNode.childNodes.length; i < childLen; i++) {
                    var childItem = xmlNode.childNodes[i];
                    var nodeName = childItem.nodeName;
                    if (nodeName in obj) {
                        if (!Array.isArray(obj[nodeName])) {
                            obj[nodeName] = [obj[nodeName]];
                        }
                        obj[nodeName].push(Helper.xmlToJson(childItem));
                    } else {
                        obj[nodeName] = Helper.xmlToJson(childItem);
                    }
                }
            }

            return obj;
        }
    };

    return {
        onRequest: function (context) {
            var billFileId = context.request.parameters.billfileid || 7072;

            var rec = ns_record.load({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId
            });

            var recData = ns_search.lookupFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                columns: ['custrecord_ctc_vc_bill_log']
            });

            context.response.writeLine({
                output: JSON.stringify(recData.custrecord_ctc_vc_bill_log)
            });
            var dataStr = recData.custrecord_ctc_vc_bill_log;
            dataStr =
                '4/29/2022 - You can not initialize vendorbill: invalid reference 501644.\r\n' +
                dataStr;
            dataStr =
                '4/30/2022 - You can not initialize vendorbill: invalid reference 501644.\r\n' +
                dataStr;

            var noteHelper = {
                splitByDate: function (allNotesStr) {
                    var arr = allNotesStr
                        .split(/(\d{1,2}\/\d{1,2}\/\d{4})\s-\s/gm)
                        .filter(function (str) {
                            return !!str;
                        });
                    var arrNotes = [];
                    while (arr.length) {
                        var dateStr = arr.shift();
                        if (!new Date(dateStr)) continue;

                        var note = {
                            date: dateStr,
                            dateVal: new Date(dateStr),
                            msg: arr.shift()
                        };
                        note.msg = note.msg.replace(/[\r\n]/gm, '');
                        arrNotes.push(note);
                    }
                    return arrNotes.sort(function (a, b) {
                        return b.dateVal - a.dateVal;
                    });
                },
                removeDuplicates: function (notesList) {
                    var arrNotes = [];
                    notesList.map(function (noteOut) {
                        var isFound = false;
                        arrNotes.forEach(function (noteIn) {
                            if (isFound) return false;
                            if (noteOut.date == noteIn.date && noteOut.msg == noteIn.msg) {
                                isFound = true;
                                return false;
                            }
                            return true;
                        });
                        if (!isFound) arrNotes.push(noteOut);
                    });
                    return arrNotes;
                },
                removeSameSucceedingLogs: function (notesList) {
                    var arrNotes = [];
                    notesList.map(function (note) {
                        var isSameNote = false;
                        if (arrNotes.length && arrNotes[arrNotes.length - 1]) {
                            var lastEntry = arrNotes[arrNotes.length - 1];
                            isSameNote = lastEntry.msg == note.msg;
                        }
                        if (!isSameNote) {
                            arrNotes.push(note);
                        }
                    });
                    return arrNotes;
                },
                flatten: function (notesList) {
                    return notesList.map(function (note) {
                        return [note.date, note.msg].join(' - ');
                    });
                }
            };

            var arrNotesList = noteHelper.splitByDate(dataStr);
            context.response.writeLine({ output: '===' });
            context.response.writeLine({
                output: JSON.stringify(arrNotesList)
            });

            arrNotesList = noteHelper.removeDuplicates(arrNotesList);
            context.response.writeLine({ output: '===' });
            context.response.writeLine({
                output: JSON.stringify(arrNotesList)
            });

            arrNotesList = noteHelper.removeSameSucceedingLogs(arrNotesList);
            context.response.writeLine({ output: '===' });
            context.response.writeLine({
                output: JSON.stringify(arrNotesList)
            });

            arrNotesList = noteHelper.flatten(arrNotesList);
            context.response.writeLine({ output: '===' });
            context.response.writeLine({
                output: JSON.stringify(arrNotesList)
            });
            context.response.writeLine({
                output: arrNotesList.join('\r\n\r\n')
            });

            return true;
        },

        onRequest_1: function (context) {
            var billFileId = context.request.parameters.billfileid || 6004;

            var rec = ns_record.load({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId
            });

            form = serverWidget.createForm({
                title: 'XML Tester: ' + rec.getValue({ fieldId: 'name' })
            });

            var xmlStr = rec.getValue({
                fieldId: 'custrecord_ctc_vc_bill_src'
            });

            // form.addField({
            //     id: 'custpage_xmlstr',
            //     label: 'XML String',
            //     type: serverWidget.FieldType.LONGTEXT
            // }).defaultValue = xmlStr;

            var xmlObj = ns_xml.Parser.fromString(xmlStr);

            // var jsonObj = Helper.xmlToJson(xmlObj);
            // context.response.writeLine({
            //     output: JSON.stringify(jsonObj)
            // });

            var xmlInvoice = ns_xml.XPath.select({
                node: xmlObj,
                xpath: '//SynnexB2B/Invoice'
            });

            context.response.writeLine({
                output: '<br/> string length: ' + xmlStr.length
            });
            context.response.writeLine({
                output: '<br/> nodes : ' + xmlInvoice.length
            });
            context.response.writeLine({
                output: '<br/> child nodes : ' + xmlInvoice[0].childNodes.length
            });

            context.response.writeLine({
                output: '<hr size="1"/>'
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

                context.response.writeLine({
                    output: JSON.stringify(myObj)
                });

                // returnArr.push(returnObj);
            }

            // context.response.writeLine({
            //     output: JSON.stringify(xmlInvoice)
            // });
            // context.response.writePage(form);
        }
    };
});
