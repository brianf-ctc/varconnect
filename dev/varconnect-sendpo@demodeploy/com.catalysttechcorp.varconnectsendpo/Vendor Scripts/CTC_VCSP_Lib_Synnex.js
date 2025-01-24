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
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 */

define([
    'N/search',
    'N/xml',
    'N/format',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_Lib_Utils'
], function (NS_Search, NS_Xml, NS_Format, VCSP_Global, CTC_Util) {
    let LogTitle = 'WS:Synnex';

    let Helper = {};
    Helper.leftPadString = function (str, padding, len) {
        let tempStr = str + ''; // convert to string
        while (tempStr.length < len) {
            tempStr = padding + tempStr;
        }
        return tempStr.slice(len * -1);
    };
    Helper.formatToSynnexDate = function (option) {
        let logTitle = [LogTitle, 'Helper', 'formatToSynnexDate'].join('::'),
            dateToFormat = option.date || option,
            formattedDate = dateToFormat;
        if (dateToFormat && dateToFormat instanceof Date) {
            // CCYY-MM-DDTHH:MM:SS
            formattedDate = [
                [
                    dateToFormat.getFullYear(),
                    Helper.leftPadString(dateToFormat.getMonth() + 1, '0', 2),
                    Helper.leftPadString(dateToFormat.getDate(), '0', 2)
                ].join('-'),
                [
                    Helper.leftPadString(dateToFormat.getHours(), '0', 2),
                    Helper.leftPadString(dateToFormat.getMinutes(), '0', 2),
                    Helper.leftPadString(dateToFormat.getSeconds(), '0', 2)
                ].join(':')
            ].join('T');
        }
        return formattedDate;
    };
    Helper.formatFromSynnexDate = function (option) {
        let logTitle = [LogTitle, 'Helper', 'formatFromSynnexDate'].join('::'),
            dateStrToParse = option,
            formattedDate = null;
        if (dateStrToParse) {
            try {
                log.debug(logTitle, 'Parsing ' + dateStrToParse);
                dateComponents = dateStrToParse.split(/\D+/);
                let tempDate = null;
                if (dateComponents.length >= 3) {
                    tempDate = new Date();
                    tempDate.setUTCFullYear(dateComponents[0]);
                    tempDate.setUTCMonth(dateComponents[1] - 1);
                    tempDate.setUTCDate(dateComponents[2]);
                    if (dateComponents.length >= 6) {
                        tempDate.setUTCHours(+dateComponents[3] + 7); // manually offset output to GMT
                        tempDate.setUTCMinutes(dateComponents[4]);
                        tempDate.setUTCSeconds(dateComponents[5]);
                        if (dateComponents.length >= 7) {
                            tempDate.setUTCMilliseconds(dateComponents[6]);
                        } else {
                            tempDate.setUTCMilliseconds(0);
                        }
                    } else {
                        tempDate.setUTCHours(0);
                        tempDate.setUTCMinutes(0);
                        tempDate.setUTCSeconds(0);
                        tempDate.setUTCMilliseconds(0);
                    }
                }
                log.debug(logTitle, 'Parsed ' + dateStrToParse + ' as ' + tempDate);
                if (tempDate) {
                    formattedDate = NS_Format.format({
                        value: tempDate,
                        type: NS_Format.Type.DATETIME
                    });
                }
                log.debug(logTitle, 'Reformatted ' + tempDate + ' as ' + formattedDate);
            } catch (dateParseErr) {
                log.error(logTitle, '## ERROR ##' + CTC_Util.extractError(dateParseErr));
            }
        }
        return formattedDate;
    };

    function processResponse(option) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            poObj = option.purchaseOrder,
            returnValue = option.returnResponse,
            xmlDoc = NS_Xml.Parser.fromString({
                text: option.responseBody
            }),
            lineUniqueKeys = [];
        let responseNodesArray = xmlDoc.getElementsByTagName({ tagName: 'OrderResponse' });
        let orderStatus = {};
        let json_data = {};
        orderStatus.ponumber = null;
        orderStatus.errorMessage = null;
        orderStatus.errorDetail = null;
        orderStatus.items = [];
        orderStatus.successLines = [];
        orderStatus.errorLines = [];
        orderStatus.lineNotes = [];
        if (
            responseNodesArray &&
            responseNodesArray.length &&
            responseNodesArray[0].hasChildNodes()
        ) {
            let orderResponseNodes = responseNodesArray[0].childNodes;
            for (let i = 0, itemCount = poObj.items.length; i < itemCount; i += 1) {
                lineUniqueKeys.push(poObj.items[i].lineuniquekey);
            }
            for (let i = 0, len = orderResponseNodes.length; i < len; i += 1) {
                switch (orderResponseNodes[i].nodeName) {
                    case 'PONumber':
                        orderStatus.ponumber = orderResponseNodes[i].textContent;
                        break;
                    case 'Code':
                        orderStatus.order_status = orderResponseNodes[i].textContent;
                        break;
                    case 'Reason':
                        orderStatus.note = orderResponseNodes[i].textContent;
                        break;
                    case 'ResponseDateTime':
                        orderStatus.order_date = Helper.formatFromSynnexDate(
                            orderResponseNodes[i].textContent
                        );
                        break;
                    case 'ErrorMessage':
                        orderStatus.errorMessage = orderResponseNodes[i].textContent;
                        returnValue.errorName = orderStatus.errorMessage;
                        returnValue.errorId = poObj.id;
                        returnValue.isError = true;
                        break;
                    case 'ErrorDetail':
                        orderStatus.errorDetail = orderResponseNodes[i].textContent;
                        returnValue.errorMsg = orderStatus.errorDetail;
                        returnValue.errorId = poObj.id;
                        returnValue.isError = true;
                        break;
                    default:
                        break;
                }
                if (orderResponseNodes[i].nodeName !== 'Items') {
                    CTC_Util.xmlNodeToJson({
                        node: orderResponseNodes[i],
                        json: json_data
                    });
                    log.debug(
                        logTitle,
                        'Parsing ' +
                            orderResponseNodes[i].nodeName +
                            ': ' +
                            JSON.stringify(json_data)
                    );
                }
            }
            let itemNodesArray = xmlDoc.getElementsByTagName({ tagName: 'Item' });
            if (itemNodesArray && itemNodesArray.length) {
                orderStatus.items = [];
                for (let x = 0, xlen = itemNodesArray.length; x < xlen; x += 1) {
                    let itemNode = itemNodesArray[x],
                        lineUniqueKey = itemNode.getAttribute({ name: 'lineNumber' }),
                        itemJsonData = JSON.parse(JSON.stringify(json_data));
                    CTC_Util.xmlNodeToJson({
                        node: itemNode,
                        json: itemJsonData
                    });
                    let itemJsonDataStr = JSON.stringify(itemJsonData).replace(/,/g, ',<br>');
                    if (itemJsonDataStr == '{}') itemJsonDataStr = 'NA';
                    let itemDetails = {
                        line_unique_key: lineUniqueKey,
                        line_number: lineUniqueKeys.indexOf(lineUniqueKey) + 1,
                        vendor_line: itemNode.getAttribute({ name: 'lineNumber' }),
                        order_status: orderStatus.order_status || 'NA',
                        order_type: 'NA',
                        vendor_order_number: 'NA',
                        customer_order_number: orderStatus.ponumber || 'NA',
                        order_date: orderStatus.order_date || 'NA',
                        vendor_sku: 'NA',
                        item_number: 'NA',
                        note: 'NA',
                        quantity: 'NA',
                        rate: 'NA',
                        ship_date: 'NA',
                        ship_qty: 'NA',
                        ship_from: 'NA',
                        ship_method: 'NA',
                        carrier: 'NA',
                        eta_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        internal_reference_num: 'NA',
                        json_data: itemJsonDataStr
                    };
                    let itemChildNodes = itemNode.childNodes;
                    for (let y = 0, ylen = itemChildNodes.length; y < ylen; y += 1) {
                        switch (itemChildNodes[y].nodeName) {
                            case 'Code':
                                itemDetails.order_status = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'OrderType':
                                itemDetails.order_type = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'OrderNumber':
                                itemDetails.vendor_order_number =
                                    itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'SKU':
                                itemDetails.vendor_sku = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'Reason':
                                itemDetails.note = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'OrderQuantity':
                                itemDetails.quantity = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'ShipFromWarehouse':
                                itemDetails.ship_from = itemChildNodes[y].textContent || 'NA';
                                break;
                            case 'SynnexInternalReference':
                                itemDetails.internal_reference_num =
                                    itemChildNodes[y].textContent || 'NA';
                                break;
                            default:
                                break;
                        }
                    }
                    orderStatus.items.push(itemDetails);
                }
            }
        }
        returnValue.transactionNum = orderStatus.ponumber;
        returnValue.message = 'Send PO successful';
        if (!orderStatus.isError) {
            if (orderStatus.code < 200 || orderStatus.code >= 300) {
                returnValue.errorName = 'Unexpected Error';
                if (!orderStatus.note) {
                    returnValue.errorMsg = orderStatus.lineNotes.join('') || null;
                } else {
                    returnValue.errorMsg = orderStatus.note;
                }
                returnValue.errorId = poObj.id;
                returnValue.isError = true;
                returnValue.message = 'Send PO failed';
            } else {
                orderStatus.items.forEach((itemDetails) => {
                    if (itemDetails.order_status == 'accepted') {
                        orderStatus.successLines.push(itemDetails);
                    } else {
                        orderStatus.errorLines.push(itemDetails);
                        if (itemDetails.note && itemDetails.note != 'NA') {
                            orderStatus.lineNotes.push(
                                [
                                    itemDetails.order_status,
                                    '@',
                                    itemDetails.vendor_line,
                                    ': ',
                                    itemDetails.note
                                ].join('')
                            );
                        }
                    }
                });
                if (orderStatus.successLines.length && orderStatus.errorLines.length) {
                    returnValue.message =
                        'With partial errors: ' +
                        orderStatus.successLines.length +
                        ' line item(s) succeeded and ' +
                        orderStatus.errorLines.length +
                        ' failed';
                    if (orderStatus.lineNotes.length)
                        returnValue.message += ':\n' + orderStatus.lineNotes.join('\n');
                } else if (orderStatus.errorLines.length) {
                    returnValue.isError = true;
                    returnValue.message = 'Send PO failed.';
                    returnValue.errorMsg = orderStatus.note;
                    if (orderStatus.lineNotes.length) {
                        returnValue.errorName = orderStatus.note;
                        returnValue.errorMsg = orderStatus.lineNotes.join('\n');
                    }
                } else {
                    returnValue.message = orderStatus.successLines.length + ' line item(s) sent';
                }
            }
        } else {
            returnValue.message = 'Send PO failed';
        }
        orderStatus.itemCount = orderStatus.items.length;
        orderStatus.numFailedLines = orderStatus.errorLines.length;
        orderStatus.numSuccessfulLines = orderStatus.errorLines.length;
        log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
        returnValue.orderStatus = orderStatus;
        return returnValue;
    }

    function generateBody(option) {
        let logTitle = [LogTitle, 'generateBody'].join('::'),
            returnValue = '';

        let poObj = option.purchaseOrder,
            additionalVendorDetails = null,
            customerNo = option.customerNo,
            vendorConfig = option.vendorConfig,
            credentials = {
                UserID: vendorConfig.user,
                Password: vendorConfig.password
            };

        let requestDetails = {
            Credential: credentials,
            OrderRequest: {
                CustomerNumber: customerNo,
                PONumber: poObj.tranId,
                PODateTime: Helper.formatToSynnexDate(
                    NS_Format.parse({
                        value: poObj.createdDate,
                        type: NS_Format.Type.DATETIME
                    })
                ),
                XMLPOSubmitDateTime: Helper.formatToSynnexDate(new Date()),
                DropShipFlag: poObj.isDropShip ? 'Y' : 'N',
                ShipComplete: poObj.shipComplete ? 'Y' : 'N',
                EndUserPONumber: poObj.custPO || poObj.tranId,
                Comment: poObj.memo,
                Shipment: {
                    ShipFromWarehouse: 'ANY',
                    ShipTo: {
                        AddressName1: poObj.shipAddrName1,
                        AddressName2: poObj.shipAddrName2,
                        AddressLine1: poObj.shipAddr1,
                        AddressLine2: poObj.shipAddr2,
                        City: poObj.shipCity,
                        State: poObj.shipState,
                        ZipCode: poObj.shipZip,
                        Country: poObj.shipCountry
                    },
                    ShipToContact: {
                        ContactName: poObj.shipAddressee,
                        PhoneNumber: poObj.shipPhone,
                        EmailAddress: poObj.shipEmail
                    }
                    // ShipMethod: {
                    //     Code: 'NA',
                    // },
                },
                Payment: {
                    BillTo: {
                        '/attributes': {
                            code: customerNo
                        },
                        AddressName1: poObj.billAttention || poObj.billAddressee,
                        AddressName2: poObj.billAttention ? poObj.billAddressee : null,
                        AddressLine1: poObj.billAddr1,
                        AddressLine2: poObj.billAddr2,
                        City: poObj.billCity,
                        State: poObj.billState,
                        ZipCode: poObj.billZip,
                        Country: poObj.billCountry
                    }
                },
                Items: (function (record) {
                    let items = [];
                    for (let i = 0, itemCount = record.items.length; i < itemCount; i += 1) {
                        let lineItem = {
                            Item: {
                                '/attributes': {
                                    lineNumber: record.items[i].lineuniquekey
                                },
                                SKU: record.items[i].synnexSKU || record.items[i].vendorSKU,
                                ManufacturerPartNumber: record.items[i].item,
                                UnitPrice: record.items[i].rate,
                                OrderQuantity: record.items[i].quantity
                            }
                        };
                        // since SKU and MPN might conflict, prioritize one over the other
                        if (vendorConfig.prioritizeVendorSKU && lineItem.Item.SKU) {
                            delete lineItem.Item.ManufacturerPartNumber;
                        } else if (lineItem.Item.ManufacturerPartNumber) {
                            delete lineItem.Item.SKU;
                        }
                        items.push(lineItem);
                    }
                    return items;
                })(poObj)
            },
            _toXmlAttributes: function (object) {
                let xmlBody = '';
                for (let property in object) {
                    xmlBody += ' ' + property + '="' + object[property] + '"';
                }
                return xmlBody;
            },
            _toXml: function (object) {
                let xmlBody = [];
                for (let property in object) {
                    if (object[property]) {
                        let propertyIsArray = object[property] instanceof Array;
                        if (propertyIsArray) {
                            let arrayTag = '<' + property;
                            let arrayAttributes = object[property]['/attributes'];
                            arrayTag += this._toXmlAttributes(arrayAttributes);
                            arrayTag += '>';
                            xmlBody.push(arrayTag);
                            for (let i = 0, len = object[property].length; i < len; i += 1) {
                                xmlBody.push(this._toXml(object[property][i]));
                            }
                            xmlBody.push('</' + property + '>');
                        } else if (typeof object[property] == 'object') {
                            let isAttributesObject = property.indexOf('/') == 0;
                            if (!isAttributesObject) {
                                let objectTag = '<' + property;
                                let objectAttributes = object[property]['/attributes'];
                                objectTag += this._toXmlAttributes(objectAttributes);
                                objectTag += '>';
                                xmlBody.push(objectTag);
                                xmlBody.push(this._toXml(object[property]));
                                xmlBody.push('</' + property + '>');
                            }
                        } else if (object[property] !== undefined && object[property] !== null) {
                            xmlBody.push(
                                [
                                    '<' + property + '>',
                                    NS_Xml.escape({
                                        xmlText: object[property] + ''
                                    }),
                                    '</' + property + '>'
                                ].join('')
                            );
                        }
                    }
                }
                return xmlBody.join('');
            },
            toXml: function () {
                let xmlBody = [
                    '<?xml version="1.0" encoding="UTF-8" ?>',
                    '<SynnexB2B>',
                    '<Credential>',
                    this._toXml(this.Credential),
                    '</Credential>',
                    '<OrderRequest>',
                    this._toXml(this.OrderRequest),
                    '</OrderRequest>',
                    '</SynnexB2B>'
                ].join('');
                return xmlBody;
            }
        };
        if (poObj.additionalVendorDetails) {
            additionalVendorDetails = CTC_Util.safeParse(poObj.additionalVendorDetails);
        } else if (
            vendorConfig.additionalPOFields &&
            vendorConfig.includeAdditionalDetailsOnSubmit
        ) {
            additionalVendorDetails = CTC_Util.getVendorAdditionalPOFieldDefaultValues({
                fields: CTC_Util.safeParse(vendorConfig.additionalPOFields),
                filterValues: {
                    country: vendorConfig.country,
                    apiVendor: vendorConfig.apiVendor
                }
            });
            CTC_Util.log(
                'AUDIT',
                logTitle,
                'Additional vendor details to submit: ' + JSON.stringify(additionalVendorDetails)
            );
        }
        if (additionalVendorDetails) {
            for (let fieldId in additionalVendorDetails) {
                let fieldHierarchy = fieldId.split('.');
                let fieldContainer = requestDetails.OrderRequest;
                for (
                    let i = 0, len = fieldHierarchy.length, fieldIdIndex = len - 1;
                    i < len;
                    i += 1
                ) {
                    let fieldIdComponent = fieldHierarchy[i];
                    if (i == fieldIdIndex) {
                        let fieldValue = additionalVendorDetails[fieldId];
                        if (fieldValue === true) {
                            fieldContainer[fieldIdComponent] = 'Y';
                        } else if (fieldValue === false) {
                            fieldContainer[fieldIdComponent] = 'N';
                        } else {
                            fieldContainer[fieldIdComponent] = additionalVendorDetails[fieldId];
                        }
                    } else {
                        if (!fieldContainer[fieldIdComponent]) {
                            fieldContainer[fieldIdComponent] = {};
                        }
                        fieldContainer = fieldContainer[fieldIdComponent];
                    }
                }
                // log.debug(logTitle, 'Order Request: ' + JSON.stringify(fieldContainer));
            }
            // check if SoftWareLicense was intended to be included
            if (requestDetails.OrderRequest.SoftWareLicense) {
                let softWareLicenseKeys = Object.keys(requestDetails.OrderRequest.SoftWareLicense);
                if (
                    !softWareLicenseKeys ||
                    softWareLicenseKeys.length == 0 ||
                    (softWareLicenseKeys.length == 1 &&
                        softWareLicenseKeys[0] == 'ReOrder' &&
                        !requestDetails.OrderRequest.SoftWareLicense.ReOrder)
                ) {
                    delete requestDetails.OrderRequest.SoftWareLicense;
                }
            }
        }
        if (vendorConfig.testRequest) {
            requestDetails.OrderRequest.Comment =
                'TEST:' + (requestDetails.OrderRequest.Comment || '');
        }
        CTC_Util.cleanUpJSON(requestDetails.OrderRequest);
        log.audit(logTitle, 'Order Request: ' + JSON.stringify(requestDetails.OrderRequest));
        returnValue = requestDetails.toXml();
        CTC_Util.vcLog({
            title: [LogTitle, 'Order Request Values'].join(' - '),
            content: returnValue,
            transaction: poObj.id
        });
        return returnValue;
    }

    function sendPOToSynnex(option) {
        let logTitle = [LogTitle, 'sendPOToSynnex'].join('::'),
            poObj = option.purchaseOrder,
            vendorConfig = option.vendorConfig,
            body = option.body,
            synnexRequestQuery = {
                url: vendorConfig.endPoint,
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': body.length,
                    Host: vendorConfig.endPoint.match(/(?:\w+\.)+\w+/)[0]
                },
                body: body
            };
        if (vendorConfig.testRequest) {
            synnexRequestQuery.url = vendorConfig.qaEndPoint;
            synnexRequestQuery.headers.Host = vendorConfig.qaEndPoint.match(/(?:\w+\.)+\w+/)[0];
        }
        let sendPOResponse = CTC_Util.sendRequest({
            header: [LogTitle, 'Send PO'].join(' : '),
            method: 'post',
            recordId: poObj.id,
            isXML: true,
            query: synnexRequestQuery
        });
        log.audit(logTitle, '>> Synnex: ' + JSON.stringify(sendPOResponse));
        return sendPOResponse;
    }

    function process(option) {
        let logTitle = [LogTitle, 'process'].join('::'),
            vendorConfig = option.vendorConfig,
            customerNo = vendorConfig.customerNo,
            poObj = option.purchaseOrder;
        log.audit(logTitle, '>> record : ' + JSON.stringify(poObj));
        let sendPOResponse,
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id
            };
        try {
            let sendPOBody = generateBody({
                purchaseOrder: poObj,
                customerNo: customerNo,
                vendorConfig: vendorConfig
            });
            sendPOResponse = sendPOToSynnex({
                purchaseOrder: poObj,
                vendorConfig: vendorConfig,
                body: sendPOBody
            });
            returnResponse = {
                transactionNum: poObj.tranId,
                transactionId: poObj.id,
                logId: sendPOResponse.logId,
                responseBody: sendPOResponse.PARSED_RESPONSE || sendPOResponse.RESPONSE.body,
                responseCode: sendPOResponse.RESPONSE.code,
                isError: false,
                error: null,
                errorId: poObj.id,
                errorName: null,
                errorMsg: null
            };

            returnResponse = processResponse({
                purchaseOrder: poObj,
                responseBody: returnResponse.responseBody,
                returnResponse: returnResponse
            });
        } catch (e) {
            log.error(logTitle, 'FATAL ERROR:: ' + e.name + ': ' + e.message);
            returnResponse = returnResponse || {
                transactionNum: poObj.tranId,
                transactionId: poObj.id,
                isError: true,
                error: e,
                errorId: poObj.id,
                errorName: e.name,
                errorMsg: e.message
            };
            returnResponse.isError = true;
            returnResponse.error = e;
            returnResponse.errorId = poObj.id;
            returnResponse.errorName = e.name;
            returnResponse.errorMsg = e.message;
            if (sendPOResponse) {
                returnResponse.logId = sendPOResponse.logId || null;
                returnResponse.responseBody = sendPOResponse.PARSED_RESPONSE;
                if (sendPOResponse.RESPONSE) {
                    if (!returnResponse.responseBody) {
                        returnResponse.responseBody = sendPOResponse.RESPONSE.body || null;
                    }
                    returnResponse.responseCode = sendPOResponse.RESPONSE.code || null;
                }
            }
        } finally {
            log.audit(logTitle, '>> sendPoResp: ' + JSON.stringify(returnResponse));
        }
        return returnResponse;
    }

    return {
        process: process
    };
});
