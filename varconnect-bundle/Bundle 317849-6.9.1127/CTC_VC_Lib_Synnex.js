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
 * @NModuleScope Public
 */

define([
    'N/xml',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './Bill Creator/Libraries/moment'
], function (ns_xml, VC_Global, VC_Log, VC_Util, moment) {
    var LogTitle = 'WS:Synnex';

    var CURRENT = {};
    var LibSynnexAPI = {
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqOrderStatus = VC_Util.sendRequest({
                    header: [LogTitle, 'Orders Search'].join(' : '),
                    method: 'post',
                    isXML: true,
                    doRetry: true, 
                    query: {
                        url: CURRENT.vendorConfig.endPoint,
                        body:
                            '<?xml version="1.0" encoding="UTF-8" ?>' +
                            '<SynnexB2B version="2.2">' +
                            '<Credential>' +
                            ('<UserID>' + CURRENT.vendorConfig.user + '</UserID>') +
                            ('<Password>' + CURRENT.vendorConfig.password + '</Password>') +
                            '</Credential>' +
                            '<OrderStatusRequest>' +
                            ('<CustomerNumber>' +
                                CURRENT.vendorConfig.customerNo +
                                '</CustomerNumber>') +
                            ('<PONumber>' + CURRENT.recordNum + '</PONumber>') +
                            '</OrderStatusRequest>' +
                            '</SynnexB2B>',
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                            'Content-Length': 'length'
                        }
                    },
                    recordId: CURRENT.recordId
                });

                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                var respOrderStatus = reqOrderStatus.RESPONSE.body;
                if (!respOrderStatus) throw 'Unable to fetch server response';

                returnValue = respOrderStatus;
            } catch (error) {
                returnValue = false;
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> Access Token: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        }
    };

    return {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';
                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var respOrderStatus = this.processRequest(option);
                returnValue = this.processResponse({ xmlResponse: respOrderStatus });
            } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ': Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw VC_Util.extractError(error);
            } finally {
                log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));

                VC_Util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !VC_Util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: VC_Global.Lists.VC_LOG_STATUS.INFO
                });
            }

            return returnValue;
        },
        processRequest: function (option) {
            var logTitle = [LogTitle, 'processRequest'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                returnValue = LibSynnexAPI.getOrderStatus(option);
            } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ': Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw VC_Util.extractError(error);
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue = [];
            option = option || {};
            try {
                var xmlResponse = option.xmlResponse,
                    xmlDoc = ns_xml.Parser.fromString({ text: xmlResponse }),
                    itemArray = [];

                if (!xmlDoc) throw 'Unable to parse XML';

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
                }

                returnValue = itemArray;
            } catch (error) {
                VC_Util.vcLog({
                    title: LogTitle + ': Response Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw VC_Util.extractError(error);
                returnValue = errorMsg;
            }

            return returnValue;
        }
    };
});
