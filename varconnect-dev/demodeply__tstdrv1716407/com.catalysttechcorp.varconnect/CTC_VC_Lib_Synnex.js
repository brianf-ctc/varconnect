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
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 * 1.10		April 19, 2022	christian	Updated library to new standards/ Updated logs
 * 1.11		May 17, 2022	christian	Add shipped status
 *
 */

define([
    'N/xml',
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils.js'
], function (ns_xml, vcLog, VC_Global, VC2_Utils) {
    var LogTitle = 'WS:Synnex';

    function processRequest(option) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            returnValue;

        try {
            var orderStatusReq = VC2_Utils.sendRequest({
                header: [LogTitle, 'Order Status'].join(':'),
                method: 'post',
                recordId: poId,
                query: {
                    url: vendorConfig.endPoint,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'Content-Length': 'length'
                    },
                    body:
                        '<?xml version="1.0" encoding="UTF-8" ?>' +
                        '<SynnexB2B version="2.2">' +
                        '<Credential>' +
                        ('<UserID>' + vendorConfig.user + '</UserID>') +
                        ('<Password>' + vendorConfig.password + '</Password>') +
                        '</Credential>' +
                        '<OrderStatusRequest>' +
                        ('<CustomerNumber>' + vendorConfig.customerNo + '</CustomerNumber>') +
                        ('<PONumber>' + poNum + '</PONumber>') +
                        '</OrderStatusRequest>' +
                        '</SynnexB2B>'
                }
            });

            if (orderStatusReq.isError) throw orderStatusReq.errorMsg;
            if (!orderStatusReq.RESPONSE.body) throw 'Unable to fetch server response';

            returnValue = orderStatusReq.RESPONSE.body;
        } catch (error) {
            var errorMsg = VC2_Utils.extractError(error);
            vcLog.recordLog({
                header: [LogTitle + ': Error', errorMsg].join(' - '),
                body: JSON.stringify(error),
                transaction: option.poId,
                status: VC_Global.Lists.VC_LOG_STATUS.ERROR,
                isDebugMode: option.fromDebug
            });
        }

        // if (!response || !response.body) throw 'Unable to retrieve response';
        // responseXml = response.body;

        return returnValue;
    }

    function processResponse(option) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var xmlString = option.responseXML;
        // log.audit('parseSynnex', xmlString);
        var itemArray = [];

        try {
            var xmlDoc = ns_xml.Parser.fromString({
                text: xmlString
            });

            var itemNodesArray = xmlDoc.getElementsByTagName({ tagName: 'Item' });
            var orderDateTime = xmlDoc.getElementsByTagName({ tagName: 'PODatetime' });
            var orderCodes = xmlDoc.getElementsByTagName({ tagName: 'Code' });
            if (orderCodes && orderCodes.length) {
                itemArray.header_info = {
                    order_status: orderCodes[0].textContent
                };
            }

            for (var i = 0; i < itemNodesArray.length; i++) {
                var itemRow = {
                    line_num: 'NA',
                    item_num: 'NA',
                    order_num: 'NA',
                    order_date: 'NA',
                    order_eta: 'NA',
                    ship_qty: 'NA',
                    ship_date: 'NA',
                    tracking_num: 'NA',
                    vendorSKU: 'NA',
                    carrier: 'NA',
                    serial_num: 'NA',
                    order_status: 'NA'
                };
                var itemCode = '';

                var itemNode = itemNodesArray[i];

                itemRow.line_num = itemNode.getAttribute({ name: 'lineNumber' });
                itemRow.order_date = orderDateTime[0].textContent;

                var itemChildNodes = itemNode.childNodes;

                var packageNodes;

                // for (let childNode of itemChildNodes) {
                //     log.audit(logTitle, '>> childNode: ' + JSON.stringify(childNode));
                // }

                for (var j = 0; j < itemChildNodes.length; j++) {
                    // log.audit(logTitle, '>> itemChildNodes: ' + JSON.stringify(itemChildNodes[j]));

                    switch (itemChildNodes[j].nodeName) {
                        case 'Code':
                            itemCode = itemChildNodes[j].textContent;
                            itemRow.order_status = itemCode;
                            break;
                        case 'OrderNumber':
                            itemRow.order_num = itemChildNodes[j].textContent;
                            break;
                        case 'MfgPN':
                            itemRow.item_num = itemChildNodes[j].textContent;
                            break;
                        case 'ShipDatetime':
                            itemRow.ship_date = itemChildNodes[j].textContent;
                            break;
                        case 'SKU':
                            itemRow.vendorSKU = itemChildNodes[j].textContent;
                            break;
                        case 'ShipMethodDescription':
                            itemRow.carrier = itemChildNodes[j].textContent;
                            break;
                        case 'ShipQuantity':
                            itemRow.ship_qty = itemChildNodes[j].textContent;
                            break;
                        case 'ETADate':
                            itemRow.order_eta = itemChildNodes[j].textContent;
                            break;
                        case 'Packages':
                            packageNodes = itemChildNodes[j].childNodes;
                            // itemRow.tracking_num = '';
                            for (var x = 0; x < packageNodes.length; x++) {
                                if (packageNodes[x].nodeName == 'Package') {
                                    var packageChildNodes = packageNodes[x].childNodes;
                                    for (var z = 0; z < packageChildNodes.length; z++) {
                                        switch (packageChildNodes[z].nodeName) {
                                            case 'TrackingNumber':
                                                if (itemRow.tracking_num === 'NA')
                                                    itemRow.tracking_num =
                                                        packageChildNodes[z].textContent;
                                                else
                                                    itemRow.tracking_num +=
                                                        ',' + packageChildNodes[z].textContent;
                                                break;
                                            case 'SerialNo':
                                                if (itemRow.serial_num === 'NA')
                                                    itemRow.serial_num =
                                                        packageChildNodes[z].textContent;
                                                else
                                                    itemRow.serial_num +=
                                                        ',' + packageChildNodes[z].textContent;
                                                break;
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }

                // ShipQuantity //
                if (!parseInt(itemRow.ship_qty, 10)) {
                    itemRow.is_shipped = false;
                }

                if (itemRow.is_shipped) {
                    itemRow.is_shipped = VC2_Utils.inArray(itemCode, ['invoiced', 'shipped']);
                }

                // ignore items unles they have been invoiced or accepted or shipped
                if (VC2_Utils.inArray(itemCode, ['invoiced', 'accepted', 'shipped'])) {
                    itemArray.push(itemRow);
                }
            }
        } catch (err) {
            log.error(logTitle + '::ERROR', '!! ERROR !! ' + VC2_Utils.extractError(err));
        }

        // log.debug(logTitle, itemArray);
        return itemArray;
    }

    function process(option) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            outputArray = null;

        var responseXML = processRequest({
            poNum: poNum,
            poId: poId,
            vendorConfig: vendorConfig
        });

        if (responseXML)
            outputArray = processResponse({
                poNum: poNum,
                poId: poId,
                vendorConfig: vendorConfig,
                responseXML: responseXML
            });

        log.audit(logTitle, '>> outputArray: ' + JSON.stringify(outputArray));

        vcLog.recordLog({
            header: [LogTitle, 'Lines'].join(' - '),
            body: !VC2_Utils.isEmpty(outputArray)
                ? JSON.stringify(outputArray)
                : '-no lines to process-',
            transaction: poId,
            status: VC_Global.Lists.VC_LOG_STATUS.INFO,
            isDebugMode: option.fromDebug
        });

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
