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
define(['N/log', 'N/https', './CTC_VC_Lib_Log.js', 'N/xml', 'N/email'], function (log, https, vcLog, xml, email) {
    'use strict';

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {
        var headers = {
            SOAPAction: 'http://WebService.jenne.com/AdvanceShipNoticeGet_v2',
            'Content-Type': 'text/xml'
        };

        var body =
            '<?xml version="1.0" encoding="utf-8"?>' +
            ' <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
            '  xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
            '  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
            '  <soap:Body>' +
            '   <AdvanceShipNoticeGet_v2' +
            '    xmlns="http://WebService.jenne.com">' +
            '    <email>' +
            obj.vendorConfig.user +
            '</email>' +
            '    <password>' +
            obj.vendorConfig.password +
            '</password>' +
            '    <poNumber>' +
            obj.poNum +
            '</poNumber>' +
            '    <startDate></startDate>' +
            '    <endDate></endDate>' +
            '   </AdvanceShipNoticeGet_v2>' +
            '  </soap:Body>' +
            ' </soap:Envelope>';

        log.audit({
            title: 'request body',
            details: body
        });

        vcLog.recordLog({
            header: 'Jenne Get PO Request',
            body: JSON.stringify(body),
            transaction: obj.poId,
            isDebugMode: obj.fromDebug
        });

        var response = https.post({
            url: obj.vendorConfig.endPoint,
            body: body,
            headers: headers
        });

        vcLog.recordLog({
            header: 'Jenne Get PO Response',
            body: JSON.stringify(response),
            transaction: obj.poId,
            isDebugMode: obj.fromDebug
        });

        if (response) {
            log.debug({
                title: 'Response',
                details: response
            });

            var x = xml.Parser.fromString(response.body);

            var j = xmlToJson(x.documentElement);

            log.debug({
                title: 'XML Converted to JSON',
                details: j
            });

            var responseBody =
                j['soap:Body'].AdvanceShipNoticeGet_v2Response.AdvanceShipNoticeGet_v2Result.AdvanceShipNotices
                    .AdvanceShipNotice_v2;

            log.debug({
                title: 'Response Body',
                details: responseBody
            });

            return responseBody;
        }
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/

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

    function processResponse(obj) {
        log.debug('processResponse', JSON.stringify(obj));

        var outputArray = [];

        var shipments = obj.responseBody;

        if (util.isArray(shipments))
            shipments.forEach(function (asn) {
                outputArray = _processASN({
                    asn: asn,
                    outputArray: outputArray
                });
            });
        else
            outputArray = _processASN({
                asn: shipments,
                outputArray: outputArray
            });

        log.audit({
            title: 'outputArray',
            details: outputArray
        });

        return outputArray;
    }

    function _processASN(options) {
        var asn = options.asn,
            outputArray = options.outputArray;

        log.debug('entered asn', asn);

        if (JSON.stringify(asn).length > 2) {
            log.debug('entered', 'has own property');

            var carton = asn.ASNcartons.ASNcarton_v2;

            // still sorting this out but sometimes asn.ASNcartons.ASNcarton_v2 is an array and ASNcartonDetails.ASNcartonDetail_v2 is an object
            // but sometimes it's the other way around.  since these are nested objects writing two different version of the same code seems to be
            // the best way to handle it.

            //            if (Array.isArray(carton) == true) {
            if (util.isArray(carton)) {
                carton.forEach(function (cartonDetail) {
                    _processCarton({
                        asn: asn,
                        carton: cartonDetail,
                        outputArray: outputArray
                    });
                });
            } else {
                var cartonDetail = carton.ASNcartonDetails.ASNcartonDetail_v2;
                _processCarton({
                    asn: asn,
                    carton: carton,
                    outputArray: outputArray
                });
            }
        }

        return outputArray;
    }

    function _processCarton(options) {
        var asn = options.asn,
            carton = options.carton,
            outputArray = options.outputArray;

        var cartonDetail = carton.ASNcartonDetails.ASNcartonDetail_v2;

        if (util.isArray(cartonDetail)) {
            cartonDetail.forEach(function (cartonDetails) {
                _processCartonDetails({
                    asn: asn,
                    carton: carton,
                    cartonDetails: cartonDetails,
                    outputArray: outputArray
                });
            });
        } else {
            _processCartonDetails({
                asn: asn,
                carton: carton,
                cartonDetails: cartonDetail,
                outputArray: outputArray
            });
        }
    }

    function _processCartonDetails(options) {
        var asn = options.asn,
            carton = options.carton,
            cartonDetails = options.cartonDetails,
            outputArray = options.outputArray;

        var o = {};

        // change date format
        // from YYYY-MM-DD to MM/DD/YYYY
        log.debug('mapping', 'odate');
        var odate = asn.OrderDate['#text'];
        o.ship_date = odate.slice(5, 7) + '/' + odate.slice(8, 10) + '/' + odate.slice(0, 4);

        log.debug('mapping', 'order_num');
        o.order_num = asn.OrderNumber['#text'];
        log.debug('mapping', 'line_num');
        o.line_num = asn.ASNcartons.ASNcarton_v2.CartonNo['#text'];
        log.debug('mapping', 'item_num');
        o.item_num = cartonDetails.PartNumber['#text'];
        log.debug('mapping', 'ship_qty');
        o.ship_qty = parseInt(cartonDetails.QtyShipped['#text']);

        // change date format
        // from YYYY-MM-DD to MM/DD/YYYY
        log.debug('mapping', 'sdate');
        var sdate = carton.DateShipped['#text'];
        o.ship_date = sdate.slice(5, 7) + '/' + sdate.slice(8, 10) + '/' + sdate.slice(0, 4);

        o.order_eta = '';
        log.debug('mapping', 'carrier');
        o.carrier = carton.ShipVia['#text'];
        log.debug('mapping', 'tracking');
        o.tracking_num = carton.TrackingNo['#text'];
        log.debug('mapping', 'serial');
        o.serial_num = cartonDetails.SerialNumber['#text'];

        outputArray.push(o);
    }

    function xmlToJson(xmlNode) {
        // Create the return object
        var obj = Object.create(null);

        if (xmlNode.nodeType == xml.NodeType.ELEMENT_NODE) {
            // element
            // do attributes
            if (xmlNode.hasAttributes()) {
                obj['@attributes'] = Object.create(null);
                for (var j in xmlNode.attributes) {
                    if (
                        xmlNode.hasAttribute({
                            name: j
                        })
                    ) {
                        obj['@attributes'][j] = xmlNode.getAttribute({
                            name: j
                        });
                    }
                }
            }
        } else if (xmlNode.nodeType == xml.NodeType.TEXT_NODE) {
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
                    obj[nodeName].push(xmlToJson(childItem));
                } else {
                    obj[nodeName] = xmlToJson(childItem);
                }
            }
        }

        return obj;
    }

    function process(options) {
        log.audit({
            title: 'options',
            details: options
        });
        var outputArray = null;

        var responseBody = processRequest({
            poNum: options.poNum,
            vendorConfig: options.vendorConfig,
            poId: options.poId
        });

        if (responseBody) {
            outputArray = processResponse({
                vendorConfig: options.vendorConfig,
                responseBody: responseBody
            });
        }
        log.emergency({
            title: 'outputArray',
            details: outputArray
        });
        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest
    };
});
