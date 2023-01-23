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
 * @description Helper file for Arrow Get PO Status
 */
/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Arrow
 * Author: john.ramonel
 */
define([
    'N/search',
    './CTC_VC_Lib_Log.js',
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js'
], function (ns_search, vc_log, vc_util, vc2_constant) {
    'use strict';

    var LogTitle = 'WS:Arrow',
        LogPrefix;

    var CURRENT = {};

    var LibArrowAPI = {
        generateToken: function (option) {
            var logTitle = [LogTitle, 'generateToken'].join('::'),
                returnValue;
            option = option || {};

            try {
                var tokenReq = vc_util.sendRequest({
                    header: [LogTitle, 'Generate Token'].join(' '),
                    method: 'post',
                    recordId: CURRENT.recordId,
                    doRetry: true,
                    maxRetry: 3,
                    query: {
                        url: CURRENT.vendorConfig.accessEndPoint,
                        body: vc_util.convertToQuery({
                            client_id: CURRENT.vendorConfig.apiKey,
                            client_secret: CURRENT.vendorConfig.apiSecret,
                            grant_type: 'client_credentials'
                        }),
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                });

                if (tokenReq.isError) throw tokenReq.errorMsg;
                var tokenResp = tokenReq.PARSED_RESPONSE;
                if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

                returnValue = tokenResp.access_token;
                CURRENT.accessToken = tokenResp.access_token;
            } catch (error) {
                returnValue = false;
                throw error;
            } finally {
                log.audit(logTitle, LogPrefix + '>> Access Token: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getOrderStatus: function (option) {
            var logTitle = [LogTitle, 'getOrderStatus'].join('::'),
                returnValue;
            option = option || {};

            try {
                var reqOrderStatus = vc_util.sendRequest({
                    header: [LogTitle, 'Order Status'].join(' '),
                    recordId: CURRENT.recordId,
                    method: 'post',
                    query: {
                        url: CURRENT.vendorConfig.endPoint,
                        body: JSON.stringify({
                            RequestHeader: {
                                TransactionType: 'RESELLER_ORDER_STATUS',
                                Region: 'NORTH_AMERICAS',
                                SourceTransactionKeyID: null,
                                RequestTimestamp: null,
                                Country: 'US',
                                PartnerID: CURRENT.vendorConfig.customerNo
                            },
                            OrderRequest: {
                                ResellerPOList: {
                                    ResellerPO: [
                                        {
                                            Number: CURRENT.recordNum,
                                            Line: [
                                                {
                                                    Number: null
                                                }
                                            ],
                                            PartNumber: [
                                                {
                                                    Number: null
                                                }
                                            ]
                                        }
                                    ]
                                },
                                IncludeCancelledOrders: 'N',
                                IncludeClosedOrders: 'Y'
                            }
                        }),
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }
                });

                if (reqOrderStatus.isError) throw reqOrderStatus.errorMsg;
                if (!reqOrderStatus.PARSED_RESPONSE)
                    throw 'Unable to fetch a valid server response';

                returnValue = reqOrderStatus.PARSED_RESPONSE;
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

                LibArrowAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                returnValue = LibArrowAPI.getOrderStatus();
            } catch (error) {
                vc_util.vcLog({
                    title: LogTitle + ': Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc_util.extractError(error);
            }

            return returnValue;
        },
        processResponse: function (option) {
            var logTitle = [LogTitle, 'processResponse'].join('::'),
                returnValue = [];
            option = option || {};

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var response = option.response,
                    itemArray = [];

                var objOrderResponse = response.OrderResponse;
                if (!objOrderResponse.OrderDetails.length) throw 'Missing order details';

                var orderResp = objOrderResponse.OrderDetails[0];
                var orderDate, arrowSONum;
                if (orderResp.hasOwnProperty('ArrowSONumber')) arrowSONum = orderResp.ArrowSONumber;
                if (orderResp.hasOwnProperty('Reseller')) {
                    orderDate = orderResp.Reseller.PODate;
                }

                if (orderResp.hasOwnProperty('OrderLinesList')) {
                    var orderLines = orderResp.OrderLinesList.OrderLines;

                    if (orderLines.length) {
                        for (var i = 0; i < orderLines.length; i++) {
                            var orderLineObj = orderLines[i];
                            // map here...
                            var outputObj = {
                                order_date: orderDate,
                                line_num: orderLineObj.ResellerPOLineNumber,
                                item_num: orderLineObj.MFGPartNumber,
                                vendorSKU: orderLineObj.VendorPartNumber,
                                order_num: orderLineObj.InvoiceNumber || arrowSONum,
                                ship_qty: parseInt(orderLineObj.ShippedQty || '0'),
                                carrier: orderLineObj.OracleShipViaCode
                            };

                            // shipping details
                            if (orderLineObj.hasOwnProperty('StatusInfoList')) {
                                var statusInfo = orderLineObj.StatusInfoList.StatusInfo;
                                if (statusInfo.length) {
                                    var statusInfoObj = statusInfo[0]; // only contains 1
                                    if (statusInfoObj.hasOwnProperty('EstimatedShipDate')) {
                                        outputObj.order_eta = statusInfoObj.EstimatedShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('ActualShipDate')) {
                                        outputObj.ship_date = statusInfoObj.ActualShipDate;
                                    }
                                    if (statusInfoObj.hasOwnProperty('TrackingNumber')) {
                                        outputObj.tracking_num = statusInfoObj.TrackingNumber;
                                    }
                                }
                            }

                            // serial number list
                            if (orderLineObj.hasOwnProperty('SerialNumberList')) {
                                var serialNumbers = [];
                                var serialNumObj = orderLineObj.SerialNumberList.SerialNumber;
                                log.debug('serialNumObj', serialNumObj);
                                if (serialNumObj.length) {
                                    for (var j = 0; j < serialNumObj.length; j++) {
                                        if (serialNumObj[j].hasOwnProperty('ID'))
                                            serialNumbers.push(serialNumObj[j].ID);
                                        else serialNumbers.push(JSON.stringify(serialNumObj[j]));
                                    }
                                    outputObj.serial_num = serialNumbers.join(',');
                                }
                            }
                            log.audit({ title: 'outputObj', details: outputObj });
                            itemArray.push(outputObj);
                        }
                    }
                }

                returnValue = itemArray;
            } catch (error) {
                vc_util.vcLog({
                    title: LogTitle + ': Process Response',
                    error: error,
                    recordId: CURRENT.recordId
                });

                throw vc_util.extractError(error);
            } finally {
                log.audit(logTitle, LogPrefix + '>> Output Lines: ' + JSON.stringify(returnValue));

                vc_util.vcLog({
                    title: [LogTitle + ' Lines'].join(' - '),
                    body: !vc_util.isEmpty(returnValue)
                        ? JSON.stringify(returnValue)
                        : '-no lines to process-',
                    recordId: CURRENT.recordId,
                    status: vc2_constant.LIST.VC_LOG_STATUS.INFO
                });
            }

            return returnValue;
        },
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];
            option = option || {};

            log.audit(logTitle, option);

            try {
                CURRENT.recordId = option.poId || option.recordId || CURRENT.recordId;
                CURRENT.recordNum = option.poNum || option.transactionNum || CURRENT.recordNum;
                CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;
                LogPrefix = '[purchaseorder:' + CURRENT.recordId + '] ';

                if (!CURRENT.vendorConfig) throw 'Missing vendor configuration!';

                var responseBody = this.processRequest();
                if (!responseBody) throw 'Unable to get response';

                returnValue = this.processResponse({ response: responseBody });
            } catch (error) {
                vc_util.vcLog({
                    title: LogTitle + ': Process Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc_util.extractError(error);
            }

            return returnValue;
        }
    };
});
