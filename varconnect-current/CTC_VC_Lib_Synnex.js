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
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([
    'N/xml',
    'N/https',
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_xml, ns_https, vcLog, vcGlobal, vc2Utils, moment) {
    var LogTitle = 'WS:Synnex';

    var Config = {
        AllowRetry: true,
        NumRetries: 3,
        WaitMS: 500,
        CountryCode: ''
    };

    var Helper = {
        sendRequest: function (option) {
            var logTitle = [LogTitle, 'sendRequest'].join('::'),
                returnValue;
            log.audit(logTitle, option);

            var ValidMethods = ['post', 'get'];

            var method = (option.method || 'get').toLowerCase();
            method = vc2Utils.inArray(method, ValidMethods) ? method : 'get';

            var queryOption = option.query || option.queryOption;
            if (!queryOption || vc2Utils.isEmpty(queryOption)) throw 'Missing query option';

            var response, responseBody;

            var paramFlags = {
                noLogs: option.hasOwnProperty('noLogs') ? option.noLogs : false,
                doRetry: option.hasOwnProperty('doRetry') ? option.doRetry : false,
                maxRetry: option.hasOwnProperty('maxRetry')
                    ? option.maxRetry
                    : Config.NumRetries || 0,
                countRetry: option.hasOwnProperty('retryCount') ? option.retryCount : 0
            };

            log.audit(logTitle, '>> paramFlags: ' + JSON.stringify(paramFlags));

            try {
                if (option.doLogRequest || !paramFlags.noLogs) {
                    vcLog.recordLog({
                        header: [option.header || LogTitle, 'Request'].join(' - '),
                        body: JSON.stringify(queryOption),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.INFO
                    });
                }

                log.audit(logTitle, '>> REQUEST: ' + JSON.stringify(queryOption));

                //// SEND THE REQUEST //////
                response = ns_https[method](queryOption);
                responseBody = response.body; //Helper.safeParse(response.body);

                if (!response.code || response.code != 200) {
                    throw 'Failed Response Found';
                }
                if (!response || !response.body) {
                    throw 'Empty or Missing Response !';
                }
                ////////////////////////////

                returnValue = response;
            } catch (error) {
                if (!paramFlags.doRetry || paramFlags.maxRetry >= paramFlags.countRetry) {
                    var errorMsg = vc2Utils.extractError(error);
                    vcLog.recordLog({
                        header: [(option.header || LogTitle) + ': Error', errorMsg].join(' - '),
                        body: JSON.stringify(error),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.ERROR
                    });

                    throw error;
                }

                option.retryCount = paramFlags.countRetry + 1;
                vc2Utils.waitMs(Config.WaitMS);

                returnValue = Helper.sendRequest(option);
            } finally {
                log.audit(
                    logTitle,
                    '>> RESPONSE ' +
                        JSON.stringify({
                            code: response.code || '-no response-',
                            body: responseBody || response.body || '-empty response-'
                        })
                );
                if (option.doLogResponse || !paramFlags.noLogs) {
                    vcLog.recordLog({
                        header: [option.header || LogTitle, 'Response'].join(' - '),
                        body: JSON.stringify(responseBody || response),
                        transaction: option.internalId || option.transactionId || option.recordId,
                        status: vcGlobal.Lists.VC_LOG_STATUS.INFO
                    });
                }
            }

            return returnValue;
        },
        safeParse: function (response) {
            var logTitle = [LogTitle, 'safeParse'].join('::'),
                returnValue;

            log.audit(logTitle, response);
            try {
                returnValue = JSON.parse(response.body || response);
            } catch (error) {
                log.error(logTitle, '## ERROR ##' + vc2Utils.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },
        convertToQuery: function (json) {
            if (typeof json !== 'object') return;

            var qry = [];
            for (var key in json) {
                var qryVal = encodeURIComponent(json[key]);
                var qryKey = encodeURIComponent(key);
                qry.push([qryKey, qryVal].join('='));
            }

            return qry.join('&');
        }
    };

    function processRequest(option) {
        var logTitle = [LogTitle, 'processRequest'].join('::');
        log.audit(logTitle, '>> option: ' + JSON.stringify(option));

        var poNum = option.poNum,
            poId = option.poId,
            vendorConfig = option.vendorConfig,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password,
            customerNo = vendorConfig.customerNo;

        var orderXMLLineData = [],
            responseXml,
            response;

        response = Helper.sendRequest({
            header: [LogTitle, 'Order Status'].join(':'),
            method: 'post',
            doRetry: false,
            recordId: poId,
            query: {
                url: requestURL,
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'Content-Length': 'length'
                },
                body:
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
                    '</SynnexB2B>'
            }
        });

        if (!response || !response.body) throw 'Unable to retrieve response';
        responseXml = response.body;

        return responseXml;
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

                // for (let childNode of itemChildNodes) {
                //     log.audit(logTitle, '>> childNode: ' + JSON.stringify(childNode));
                // }

                for (var j = 0; j < itemChildNodes.length; j++) {
                    // log.audit(logTitle, '>> itemChildNodes: ' + JSON.stringify(itemChildNodes[j]));

                    switch (itemChildNodes[j].nodeName) {
                        case 'Code':
                            itemCode = itemChildNodes[j].textContent;
                            itemRow.statusCode = itemCode;
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
                if (!parseInt(itemRow.ship_qty, 10) ) {
                    itemRow.is_shipped = false;
                }

                if (itemCode == 'invoiced') {
                    itemRow.is_shipped = true;
                } else {
                    itemRow.is_shipped = false;
                }

                // ignore items unles they have been invoiced or accepted
                if (['invoiced', 'accepted'].indexOf(itemCode) >= 0) {
                    itemArray.push(itemRow);
                }
            }
        } catch (err) {
            log.error(logTitle + '::ERROR', '!! ERROR !! ' + vc2Utils.extractError(err));
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
            body: !vc2Utils.isEmpty(outputArray)
                ? JSON.stringify(outputArray)
                : '-no lines to process-',
            transaction: poId,
            status: vcGlobal.Lists.VC_LOG_STATUS.INFO
        });

        return outputArray;
    }

    return {
        process: process,
        processRequest: processRequest,
        processResponse: processResponse
    };
});
