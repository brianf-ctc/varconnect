/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Vendor Configuration
 *
 */ /**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/xml',
    'N/https',
    './VC_Globals.js',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Utilities.js',
    './CTC_VC_Lib_Log.js'
], function (search, runtime, r, xml, https, vcGlobals, constants, util, vcLog) {
    var LogTitle = 'WS:Synnex';

    function processRequest(options) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            customerNo = vendorConfig.customerNo;

        var orderXMLLineData = [];

        var xmlorderStatus =
            '<?xml version="1.0" encoding="UTF-8" ?>' +
            '<SynnexB2B version="2.2">' +
            '<Credential>' +
            ('<UserID>' + userName + '</UserID>') +
            ('<Password>' + password + '</Password>') +
            '</Credential>' +
            '<OrderStatusRequest>' +
            ('<CustomerNumber>' + customerNo + '</CustomerNumber>') +
            ('<PONumber>' + poNum + '</PONumber>') +
            '</OrderStatusRequest>' +
            '</SynnexB2B>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        vcLog.recordLog({
            header: 'Synnex OrderStatus:Request',
            body: JSON.stringify({
                URL: requestURL,
                Header: headers,
                Body: xmlorderStatus
            }),
            transaction: poId,
            status: constants.Lists.VC_LOG_STATUS.INFO
        });

        var responseXML;
        // log.debug('prerequest ' + poNum);
        try {
            var response = https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            });
            responseXML = response.body;

            vcLog.recordLog({
                header: 'Synnex OrderStatus:Response',
                body: JSON.stringify(responseXML),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.SUCCESS
            });

            // log.debug({
            //     title: 'Synnex Scheduled',
            //     details: 'length of response ' + responseXML.length
            // });
        } catch (err) {
            vcLog.recordLog({
                header: 'Synnex OrderStatus:Error',
                body: JSON.stringify({
                    error: util.extractError(err),
                    details: JSON.stringify(err)
                }),
                transaction: poId,
                status: constants.Lists.VC_LOG_STATUS.ERROR
            });
            log.error(logTitle + '::ERROR', '!! ERROR !! ' + util.extractError(err));
            responseXML = null;
        }

        return responseXML;
    }

    function processResponse(options) {
        var logTitle = [LogTitle, 'processResponse'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var xmlString = options.responseXML;
        // log.audit('parseSynnex', xmlString);
        var itemArray = [];

        try {
            var xmlDoc = xml.Parser.fromString({
                text: xmlString
            });

            var itemNodesArray = xmlDoc.getElementsByTagName({ tagName: 'Item' });
            var orderDateTime = xmlDoc.getElementsByTagName({ tagName: 'PODatetime' });

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
                    serial_num: 'NA'
                };
                var itemCode = '';

                var itemNode = itemNodesArray[i];

                itemRow.line_num = itemNode.getAttribute({ name: 'lineNumber' });
                itemRow.order_date = orderDateTime[0].textContent;

                var itemChildNodes = itemNode.childNodes;
                var packageNodes;
                for (var j = 0; j < itemChildNodes.length; j++) {
                    switch (itemChildNodes[j].nodeName) {
                        case 'Code':
                            itemCode = itemChildNodes[j].textContent;
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

                // ignore items unles they have been invoiced or accepted
                if (['invoiced', 'accepted'].indexOf(itemCode) >= 0) {
                    itemArray.push(itemRow);
                }
                // if (itemCode == 'invoiced') {
                //     itemArray.push(itemRow);
                // }
            }
        } catch (err) {
            log.error(logTitle + '::ERROR', '!! ERROR !! ' + util.extractError(err));
        }
        log.debug('exiting Parse Synnex', itemArray);
        return itemArray;
    }

    function process(options) {
        var logTitle = [LogTitle, 'process'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(options));

        var poNum = options.poNum,
            poId = options.poId,
            vendorConfig = options.vendorConfig,
            outputArray = null;
        var responseXML = processRequest({
            poNum: poNum,
            vendorConfig: vendorConfig
        });

        // vcLog.recordLog({
        //     header: 'Response',
        //     body: responseXML,
        //     transaction: poId
        // });

        // log.debug('process responseXML ' + poNum, responseXML);
        if (responseXML)
            outputArray = processResponse({
                vendorConfig: vendorConfig,
                responseXML: responseXML
            });

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
