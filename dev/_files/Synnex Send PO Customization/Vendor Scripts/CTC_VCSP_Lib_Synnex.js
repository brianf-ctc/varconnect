/**
 * @copyright 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 *
 */

define([
    'N/search',
    'N/xml',
    '../Library/CTC_VCSP_Constants.js',
    '../Library/CTC_Lib_Utils.js'
], function (ns_search, ns_xml, constants, ctc_util) {
    var LogTitle = 'WS:Synnex';

    function processResponse(option) {
        var logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = option.returnResponse;
        var xmlDoc = ns_xml.Parser.fromString({
            text: option.responseBody
        });
        var responseNodesArray = xmlDoc.getElementsByTagName({ tagName: 'OrderResponse' });
        var orderStatus = {};
        if (
            responseNodesArray &&
            responseNodesArray.length &&
            responseNodesArray[0].hasChildNodes()
        ) {
            var orderResponseNodes = responseNodesArray[0].childNodes;
            for (var i = 0, len = orderResponseNodes.length, ctr = 0; i < len; i += 1) {
                switch (orderResponseNodes[i].nodeName) {
                    case 'PONumber':
                        orderStatus.ponumber = orderResponseNodes[i].textContent;
                        ctr += 1;
                        break;
                    case 'Code':
                        orderStatus.code = orderResponseNodes[i].textContent;
                        ctr += 1;
                        break;
                    case 'Reason':
                        orderStatus.reason = orderResponseNodes[i].textContent;
                        ctr += 1;
                        break;
                    case 'ErrorMessage':
                        orderStatus.errorMessage = orderResponseNodes[i].textContent;
                        ctr += 1;
                        break;
                    case 'ErrorDetail':
                        orderStatus.errorDetail = orderResponseNodes[i].textContent;
                        ctr += 1;
                        break;
                    default:
                        break;
                }
                if (ctr == 5) break;
            }

            var itemNodesArray = xmlDoc.getElementsByTagName({ tagName: 'Item' });
            if (itemNodesArray && itemNodesArray.length) {
                orderStatus.items = [];
                for (var x = 0, xlen = itemNodesArray.length; x < xlen; x += 1) {
                    var itemDetails = {};
                    var itemNode = itemNodesArray[x];
                    var itemChildNodes = itemNode.childNodes;
                    for (var y = 0, ylen = itemChildNodes.length, ctr = 0; y < ylen; y += 1) {
                        switch (itemChildNodes[y].nodeName) {
                            case 'SKU':
                                itemDetails.sku = itemChildNodes[y].textContent;
                                ctr += 1;
                                break;
                            case 'OrderQuantity':
                                itemDetails.quantity = itemChildNodes[y].textContent;
                                ctr += 1;
                                break;
                            case 'Code':
                                itemDetails.code = itemChildNodes[y].textContent;
                                ctr += 1;
                                break;
                            case 'Reason':
                                itemDetails.reason = itemChildNodes[y].textContent;
                                ctr += 1;
                                break;
                            default:
                                break;
                        }
                        if (ctr == 4) break;
                    }
                    orderStatus.items.push(itemDetails);
                }
            }
        }
        log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
        returnValue.transactionNum = orderStatus.ponumber;
        if (orderStatus.errorMessage || orderStatus.errorDetail) {
            var errorMessage = [];
            if (orderStatus.errorDetail) {
                errorMessage.push(orderStatus.errorMessage);
            }
            if (orderStatus.errorDetail) {
                errorMessage.push(orderStatus.errorDetail);
            }
            throw 'Send PO Error - ' + errorMessage.join(': ');
        }
        returnValue.message = 'Send PO successful';
        if (orderStatus.reason) {
            if (orderStatus.code != 'accepted') {
                throw 'Send PO Error - ' + orderStatus.code + ': ' + orderStatus.reason;
            } else {
                throw (
                    'Send PO Successful but with unexpected reply from Synnex: ' +
                    orderStatus.reason
                );
            }
        }
        orderStatus.successLines = [];
        orderStatus.errorLines = [];
        orderStatus.lineReasons = [];
        orderStatus.items.forEach(function (itemDetail) {
            if (itemDetail.code == 'accepted') {
                orderStatus.successLines.push(itemDetail);
            } else {
                orderStatus.errorLines.push(itemDetail);
                orderStatus.lineReasons.push(itemDetail.code + ': ' + itemDetail.reason);
            }
        });
        if (orderStatus.errorLines.length) {
            throw (
                'Send PO successful with ' +
                orderStatus.successLines.length +
                ' line item(s) and ' +
                orderStatus.errorLines.length +
                ' failed line(s):<br />' +
                orderStatus.lineReasons.join('<br />')
            );
        }
        returnValue.message =
            'Send PO successful with ' + orderStatus.successLines.length + ' line item(s).';
        return returnValue;
    }

    function generateBody(option) {
        var logTitle = [LogTitle, 'generateBody'].join('::'),
            returnValue = '';

        var record = option.record,
            customerNo = option.customerNo,
            vendorConfig = option.vendorConfig,
            testRequest = option.testRequest,
            credentials = {
                UserID: vendorConfig.user,
                Password: vendorConfig.password
            };

        var requestDetails = {
            Credential: credentials,
            OrderRequest: {
                CustomerNumber: customerNo,
                PONumber: record.tranId,
                DropShipFlag: record.dropShipPO ? 'Y' : 'N',
                EndUserPONumber: record.tranId,
                Comment: record.memo,
                Shipment: {
                    ShipFromWarehouse: record.shipFromSynnexWarehouse || 'ANY',
                    ShipTo: {
                        AddressName1: record.shipAttention,
                        AddressName2: record.shipAddressee,
                        AddressLine1: record.shipAddr1,
                        AddressLine2: record.shipAddr2,
                        City: record.shipCity,
                        State: record.shipState,
                        ZipCode: record.shipZip,
                        Country: record.shipCountry
                    },
                    ShipToContact: {
                        ContactName: record.shipAddressee,
                        PhoneNumber: record.shipPhone,
                        EmailAddress: record.shipEmail
                    },
                    ShipMethod: (function (option) {
                        var record = option.record,
                            vcid = option.vendorConfigId,
                            shipMethodCode = {
                                Code: record.shipMethodCode
                            };
                        if (!shipMethodCode.Code) {
                            var shipMethod = record.shipMethod;
                            if (shipMethod) {
                                var shipMethodCodeResults = ns_search
                                    .create({
                                        type: constants.Records.VENDOR_SHIPMETHOD,
                                        filters: [
                                            [
                                                constants.Fields.VendorShipMethod.VENDOR_CONFIG,
                                                'anyof',
                                                vcid
                                            ],
                                            'and',
                                            [
                                                constants.Fields.VendorShipMethod.SHIP_METHOD,
                                                'anyof',
                                                shipMethod
                                            ]
                                        ],
                                        columns: [constants.Fields.VendorShipMethod.CODE]
                                    })
                                    .run()
                                    .getRange(0, 1);
                                if (shipMethodCodeResults && shipMethodCodeResults.length) {
                                    shipMethodCode.Code = shipMethodCodeResults[0].getValue(
                                        constants.Fields.VendorShipMethod.CODE
                                    );
                                }
                            }
                            if (!shipMethod || !shipMethodCode.Code) {
                                shipMethodCode = undefined;
                            }
                        }
                        return shipMethodCode;
                    })({ record: record, vendorConfigId: vendorConfig.id })
                },
                Payment: {
                    BillTo: {
                        '/attributes': {
                            code: customerNo
                        }
                    }
                },
                Items: (function (record) {
                    var items = [];
                    for (var i = 0, itemCount = record.items.length; i < itemCount; i += 1) {
                        var lineItem = {
                            Item: {
                                '/attributes': {
                                    lineNumber: record.items[i].lineuniquekey
                                },
                                SKU: record.items[i].synnexSKU,
                                ManufacturerPartNumber: record.items[i].item,
                                UnitPrice: record.items[i].rate,
                                OrderQuantity: record.items[i].quantity
                            }
                        };
                        items.push(lineItem);
                    }
                    return items;
                })(record)
            },
            _toXmlAttributes: function (object) {
                var xmlBody = '';
                for (var property in object) {
                    xmlBody += ' ' + property + '="' + object[property] + '"';
                }
                return xmlBody;
            },
            _toXml: function (object) {
                var xmlBody = [];
                for (var property in object) {
                    var propertyIsArray = object[property] instanceof Array;
                    if (propertyIsArray) {
                        var arrayTag = '<' + property;
                        var arrayAttributes = object[property]['/attributes'];
                        arrayTag += this._toXmlAttributes(arrayAttributes);
                        arrayTag += '>';
                        xmlBody.push(arrayTag);
                        for (var i = 0, len = object[property].length; i < len; i += 1) {
                            xmlBody.push(this._toXml(object[property][i]));
                        }
                        xmlBody.push('</' + property + '>');
                    } else if (typeof object[property] == 'object') {
                        var isAttributesObject = property.indexOf('/') == 0;
                        if (!isAttributesObject) {
                            var objectTag = '<' + property;
                            var objectAttributes = object[property]['/attributes'];
                            objectTag += this._toXmlAttributes(objectAttributes);
                            objectTag += '>';
                            xmlBody.push(objectTag);
                            xmlBody.push(this._toXml(object[property]));
                            xmlBody.push('</' + property + '>');
                        }
                    } else if (object[property] !== undefined) {
                        xmlBody.push(
                            ['<' + property + '>', object[property], '</' + property + '>'].join('')
                        );
                    }
                }
                return xmlBody.join('\n');
            },
            toXml: function () {
                var xmlBody = [
                    '<?xml version="1.0" encoding="UTF-8" ?>',
                    '<SynnexB2B>',
                    '<Credential>',
                    this._toXml(this.Credential),
                    '</Credential>',
                    '<OrderRequest>',
                    this._toXml(this.OrderRequest),
                    '</OrderRequest>',
                    '</SynnexB2B>'
                ].join('\n');
                return xmlBody;
            }
        };
        log.audit(logTitle, 'Order Request: ' + JSON.stringify(requestDetails.OrderRequest));
        returnValue = requestDetails.toXml();
        return returnValue;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::'),
            vendorConfig = option.recVendorConfig,
            customerNo = vendorConfig.customerNo,
            url = vendorConfig.endPoint,
            record = option.record || option.recPO,
            testRequest = vendorConfig.testRequest;
        log.audit(logTitle, '>> record : ' + JSON.stringify(record));
        var returnResponse = {
            transactionNum: record.tranId,
            transactionId: record.id
        };
        var sendPOBody = generateBody({
            record: record,
            customerNo: customerNo,
            vendorConfig: vendorConfig,
            testRequest: testRequest
        });
        log.debug(logTitle, sendPOBody);
        ctc_util.vcLog({
            title: [LogTitle, 'PO Details'].join(' - '),
            content: sendPOBody,
            transaction: record.id
        });
        if (!sendPOBody) throw 'Unable to generate PO Body Request';
        try {
            var sendPOReq = ctc_util.sendRequest({
                header: [LogTitle, 'Send PO'].join(' : '),
                method: 'post',
                recordId: record.id,
                query: {
                    url: url,
                    headers: {
                        'Content-Type': 'application/xml',
                        'Content-Length': sendPOBody.length,
                        Host: url.match(/(?:\w+\.)+\w+/)[0]
                    },
                    body: sendPOBody
                }
            });
            returnResponse.responseBody = sendPOReq.PARSED_RESPONSE || sendPOReq.RESPONSE.body;
            returnResponse.responseCode = sendPOReq.RESPONSE.code;
            var sendPoResp = returnResponse.responseBody;
            if (sendPOReq.isError || !sendPoResp) {
                throw 'Send PO Error - ' + sendPOReq.errorMsg;
            } else {
                returnResponse = processResponse({
                    responseBody: sendPoResp,
                    returnResponse: returnResponse
                });
            }
        } catch (error) {
            var errorMsg = ctc_util.extractError(error);
            returnResponse.isError = true;
            returnResponse.message = errorMsg;
        } finally {
            log.audit(logTitle, '>> sendPoResp: ' + JSON.stringify(returnResponse));
        }
        return returnResponse;
    }

    return {
        process: process
    };
});
