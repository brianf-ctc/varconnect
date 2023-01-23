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

define([
    'N/https',
    'N/search',
    'N/runtime',
    '../../CTC_VC2_Lib_Utils',
    '../Libraries/moment',
    '../Libraries/lodash'
], function (ns_https, ns_search, ns_runtime, vc_util, moment, lodash) {
    'use strict';
    var LogTitle = 'WS:IngramAPI',
        LogPrefix;

    function processXml(recordId, config) {
        var logTitle = [LogTitle, 'processXml'].join('::'),
            returnValue;
        log.audit(logTitle, [recordId, config]);
        LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';

        var recordData = vc_util.flatLookup({
            type: ns_search.Type.PURCHASE_ORDER,
            id: recordId,
            columns: ['tranid']
        });

        var token = generateToken({
            recordId: recordId,
            config: config,
            tranId: recordData.tranid
        });
        log.audit(logTitle, LogPrefix + '>> access token: ' + JSON.stringify(token));

        var orderDetails = getOrderDetails({
            config: config,
            recordId: recordId,
            token: token,
            recordData: recordData
        });
        log.audit(logTitle, LogPrefix + '>> orderDetails: ' + JSON.stringify(orderDetails));

        var invoiceDetails = getInvoiceDetails({
            config: config,
            recordId: recordId,
            token: token,
            recordData: recordData,
            invoiceLinks: orderDetails.invoiceLinks,
            orderNumbers: orderDetails.orderNumbers
        });
        // log.audit(logTitle, LogPrefix + '>> invoiceDetails: ' + JSON.stringify(invoiceDetails));

        // for (orderId in orderDetails) {
        //     log.audit(logTitle, LogPrefix + '>> orderId: ' + orderId);
        //     log.audit(logTitle, LogPrefix + '>> order details: ' + JSON.stringify(orderDetails[orderId]));
        // }

        var arrInvoices = [];

        for (var orderKey in invoiceDetails) {
            log.audit(logTitle, LogPrefix + '>> invoice Id: ' + orderKey);

            var invoiceData = invoiceDetails[orderKey];

            // check for misc charges
            if (orderDetails.miscCharges && orderDetails.miscCharges[orderKey]) {
                log.audit(
                    logTitle,
                    LogPrefix + '>> misc charge: ' + JSON.stringify(orderDetails.miscCharges[orderKey])
                );

                invoiceData.xmlStr = JSON.stringify({
                    invoiceDetails: JSON.parse(invoiceData.xmlStr),
                    miscCharges: orderDetails.miscCharges[orderKey]
                });

                // add the misc charges ///
                for (var ii = 0, jj = orderDetails.miscCharges[orderKey].length; ii < jj; ii++) {
                    var chargeInfo = orderDetails.miscCharges[orderKey][ii];

                    if (chargeInfo.description) {
                        if (chargeInfo.description.match(/freight/gi)) {
                            // add it to as shipping charge
                            invoiceData.ordObj.charges.shipping += vc_util.parseFloat(chargeInfo.amount);
                        } else {
                            invoiceData.ordObj.charges.other += vc_util.parseFloat(chargeInfo.amount);
                        }
                    } else {
                        invoiceData.ordObj.charges.other += vc_util.parseFloat(chargeInfo.amount);
                    }
                }
            }

            log.audit(logTitle, LogPrefix + '>> invoiceData: ' + JSON.stringify(invoiceData));

            arrInvoices.push(invoiceData);
        }

        return arrInvoices;
    }

    function getOrderDetails(option) {
        var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
            returnValue = {};

        // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

        var config = option.config,
            recordData = option.recordData,
            token = option.token,
            recordId = option.recordId;

        var arrInvoiceLinks = [],
            arrOrderNums = [],
            orderMiscCharges;

        try {
            var pageNum = 1,
                pageSize = 10,
                recordsCount = 0,
                pageComplete = false;

            while (!pageComplete) {
                var searchUrl =
                    '/resellers/v6/orders/search?' +
                    vc_util.convertToQuery({
                        customerNumber: config.partner_id,
                        isoCountryCode: config.country,
                        customerOrderNumber: recordData.tranid,
                        pageNumber: pageNum,
                        pageSize: pageSize
                    });
                searchUrl = config.url + searchUrl;
                log.audit(logTitle, LogPrefix + '>> searchUrl: ' + searchUrl);

                // send the request
                var searchOrderReq = vc_util.sendRequest({
                    header: [LogTitle, 'OrderSearch'].join(' '),
                    method: 'get',
                    recordId: recordId,
                    query: {
                        url: searchUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + token,
                            'IM-CustomerNumber': config.partner_id,
                            customerNumber: config.partner_id,
                            'IM-CountryCode': config.country,
                            'IM-CorrelationID': recordData.tranid
                        }
                    }
                });

                var searchOrderResp = searchOrderReq.PARSED_RESPONSE || searchOrderReq.RESPONSE || {};

                if (searchOrderReq.isError || vc_util.isEmpty(searchOrderResp)) {
                    throw (
                        searchOrderReq.errorMsg +
                        (searchOrderReq.details ? '\n' + JSON.stringify(searchOrderReq.details) : '')
                    );
                }

                if (!searchOrderResp.recordsFound) {
                    log.audit(logTitle, LogPrefix + '!! No records found !!');
                    break;
                }

                var ordersResults = searchOrderResp.orders;
                recordsCount = recordsCount + (searchOrderResp.pageSize || 0);

                log.audit(
                    logTitle,
                    LogPrefix +
                        '>> ' +
                        JSON.stringify({
                            recordsCount: recordsCount,
                            recordsFound: searchOrderResp.recordsFound,
                            totalOrders: ordersResults.length,
                            currentPage: pageNum
                        })
                );

                if (vc_util.isEmpty(ordersResults)) break;

                for (var i = 0, j = ordersResults.length; i < j; i++) {
                    var orderInfo = ordersResults[i];

                    for (var ii = 0, jj = orderInfo.subOrders.length; ii < jj; ii++) {
                        var subOrderInfo = orderInfo.subOrders[ii];

                        for (var iii = 0, jjj = subOrderInfo.links.length; iii < jjj; iii++) {
                            var subOrderLink = subOrderInfo.links[iii];

                            if (!subOrderLink.topic || subOrderLink.topic != 'invoices') continue;

                            arrInvoiceLinks.push(subOrderLink.href);
                            arrOrderNums.push(orderInfo.ingramOrderNumber);
                        }
                    }
                }

                // get the
                if (recordsCount >= searchOrderResp.recordsFound) {
                    pageComplete = true;
                    break;
                } else {
                    pageNum++;
                    vc_util.waitMs(1000);
                }
            }

            log.audit(logTitle, LogPrefix + '>> Invoice Links: ' + JSON.stringify(arrInvoiceLinks));
            log.audit(logTitle, LogPrefix + '>> Order Numbers: ' + JSON.stringify(arrOrderNums));
            arrInvoiceLinks = vc_util.uniqueArray(arrInvoiceLinks);
            arrOrderNums = vc_util.uniqueArray(arrOrderNums);

            log.audit(logTitle, LogPrefix + '>> Prep to fetch miscellaneous charges.... ');
            orderMiscCharges = getMiscCharges(
                util.extend(option, {
                    invoiceLinks: arrInvoiceLinks,
                    orderNums: arrOrderNums
                })
            );
            log.audit(logTitle, LogPrefix + '>> misc charges: ' + JSON.stringify(orderMiscCharges));
        } catch (error) {
            var errorMsg = vc_util.extractError(error);
            log.error(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
        } finally {
            returnValue = {
                invoiceLinks: arrInvoiceLinks || [],
                orderNumbers: arrOrderNums || [],
                miscCharges: orderMiscCharges
            };
        }

        return returnValue;
    }

    function getMiscCharges(option) {
        var logTitle = [LogTitle, 'getMiscCharges'].join('::'),
            returnValue = {};

        log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

        var config = option.config,
            recordData = option.recordData,
            token = option.token,
            recordId = option.recordId;

        var objMischCharges = {};

        try {
            if (vc_util.isEmpty(option.orderNums)) throw 'Missing purchase order numbers';
            for (var i = 0, j = option.orderNums.length; i < j; i++) {
                var orderNum = option.orderNums[i];

                var orderDetailsReq = vc_util.sendRequest({
                    header: [LogTitle, 'Misc Charge'].join(' '),
                    method: 'get',
                    recordId: recordId,
                    query: {
                        url: config.url + '/resellers/v6/orders/' + orderNum,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + token,
                            'IM-CustomerNumber': config.partner_id,
                            customerNumber: config.partner_id,
                            'IM-CountryCode': config.country,
                            'IM-CorrelationID': recordData.tranid
                        }
                    }
                });

                var orderDetailsResp = orderDetailsReq.PARSED_RESPONSE || orderDetailsReq.RESPONSE || {};

                if (orderDetailsReq.isError || vc_util.isEmpty(orderDetailsReq)) {
                    throw (
                        orderDetailsReq.errorMsg +
                        (orderDetailsReq.details ? '\n' + JSON.stringify(orderDetailsReq.details) : '')
                    );
                }

                if (!orderDetailsResp.hasOwnProperty('miscellaneousCharges')) continue;

                for (var ii = 0, jj = orderDetailsResp.miscellaneousCharges.length; ii < jj; ii++) {
                    var chargeInfo = orderDetailsResp.miscellaneousCharges[ii];
                    log.audit(logTitle, LogPrefix + '>> chargeInfo: ' + JSON.stringify(chargeInfo));

                    if (!chargeInfo.subOrderNumber) continue;
                    if (!objMischCharges[chargeInfo.subOrderNumber]) objMischCharges[chargeInfo.subOrderNumber] = [];

                    objMischCharges[chargeInfo.subOrderNumber].push({
                        description: chargeInfo.chargeDescription,
                        amount: vc_util.forceFloat(chargeInfo.chargeAmount)
                    });
                }

                vc_util.waitMs(1200);
            }
        } catch (error) {
            var errorMsg = vc_util.extractError(error);
            log.error(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
        } finally {
            returnValue = objMischCharges;
        }

        return returnValue;
    }

    function getInvoiceDetails(option) {
        var logTitle = [LogTitle, 'getInvoiceDetails'].join('::'),
            returnValue = {};

        log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

        var config = option.config,
            recordData = option.recordData,
            token = option.token,
            recordId = option.recordId;

        var objInvoiceDetails = {};

        try {
            if (vc_util.isEmpty(option.invoiceLinks)) throw 'Missing invoice links';

            for (var i = 0, j = option.invoiceLinks.length; i < j; i++) {
                var invoiceLink = option.invoiceLinks[i];

                var invoiceDetailsReq = vc_util.sendRequest({
                    header: [LogTitle, 'Invoice Details'].join(' '),
                    recordId: recordId,
                    query: {
                        url:
                            config.url +
                            invoiceLink +
                            ('?customerNumber=' + config.partner_id) +
                            ('&isoCountryCode=' + config.country),
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + token,
                            'IM-CustomerNumber': config.partner_id,
                            customerNumber: config.partner_id,
                            'IM-CountryCode': config.country,
                            'IM-CorrelationID': recordData.tranid
                        }
                    }
                });

                var invoiceDetailsResp = invoiceDetailsReq.PARSED_RESPONSE || invoiceDetailsReq.RESPONSE || {};

                if (invoiceDetailsReq.isError || vc_util.isEmpty(invoiceDetailsResp)) {
                    throw (
                        invoiceDetailsReq.errorMsg +
                        (invoiceDetailsReq.details ? '\n' + JSON.stringify(invoiceDetailsReq.details) : '')
                    );
                }

                if (!invoiceDetailsResp.serviceresponse || !invoiceDetailsResp.serviceresponse.invoicedetailresponse)
                    continue;

                var invoiceInfo = invoiceDetailsResp.serviceresponse.invoicedetailresponse,
                    invoiceData = {
                        po: recordData.tranid,
                        date: invoiceInfo.hasOwnProperty('invoicedate')
                            ? moment(invoiceInfo.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                            : moment().format('MM/DD/YYYY'),
                        invoice: invoiceInfo.globalorderid,
                        total: vc_util.parseFloat(invoiceInfo.totalamount),
                        charges: {
                            tax: vc_util.parseFloat(invoiceInfo.totaltaxamount),
                            shipping:
                                vc_util.parseFloat(invoiceInfo.customerfreightamount) +
                                vc_util.parseFloat(invoiceInfo.customerforeignfrightamt),
                            other: vc_util.parseFloat(invoiceInfo.discountamount)
                        },
                        lines: []
                    };

                for (var ii = 0, jj = invoiceInfo.lines.length; ii < jj; ii++) {
                    var lineInfo = invoiceInfo.lines[ii];
                    if (vc_util.isEmpty(lineInfo.vendorpartnumber)) continue;

                    var lineData = {
                        ITEMNO: lineInfo.vendorpartnumber,
                        PRICE: vc_util.parseFloat(lineInfo.unitprice),
                        QUANTITY: vc_util.forceInt(lineInfo.shippedquantity),
                        DESCRIPTION: lineInfo.partdescription
                    };

                    var lineSerials = [];
                    // get the serial numbers
                    if (lineInfo.hasOwnProperty('serialnumberdetails')) {
                        lineInfo.serialnumberdetails.forEach(function (serial) {
                            if (serial.serialnumber) lineSerials.push(serial.serialnumber);
                            return true;
                        });
                        lineData.SERIAL = lineSerials;
                    }

                    var listTracking = [];
                    if (lineInfo.hasOwnProperty('trackingnumberdetails')) {
                        lineInfo.trackingnumberdetails.forEach(function (tracking) {
                            if (tracking.trackingnumber) listTracking.push(tracking.trackingnumber);
                            return true;
                        });
                        lineData.TRACKING = listTracking;
                    }

                    // look for the item
                    var lineIdx = lodash.findIndex(invoiceData.lines, {
                        ITEMNO: lineData.ITEMNO
                    });

                    if (lineIdx >= 0) {
                        // increment the quantity
                        invoiceData.lines[lineIdx].QUANTITY += lineData.QUANTITY;

                        if (!vc_util.isEmpty(lineData.SERIAL)) {
                            if (!invoiceData.lines[lineIdx].SERIAL) invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL;
                            else
                                invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL.concat(
                                    invoiceData.lines[lineIdx].SERIAL
                                );
                            // trim unique serials
                            invoiceData.lines[lineIdx].SERIAL = vc_util.uniqueArray(invoiceData.lines[lineIdx].SERIAL);
                        }

                        if (!vc_util.isEmpty(lineData.TRACKING)) {
                            if (!invoiceData.lines[lineIdx].TRACKING)
                                invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING;
                            else
                                invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING.concat(
                                    invoiceData.lines[lineIdx].TRACKING
                                );
                            // trim unique tracking
                            invoiceData.lines[lineIdx].TRACKING = vc_util.uniqueArray(
                                invoiceData.lines[lineIdx].TRACKING
                            );
                        }
                    } else {
                        invoiceData.lines.push(lineData);
                    }
                }
                log.audit(logTitle, LogPrefix + '>> Invoice Data: ' + JSON.stringify(invoiceData));

                objInvoiceDetails[invoiceData.invoice] = {
                    ordObj: invoiceData,
                    xmlStr: JSON.stringify(invoiceDetailsResp)
                };

                // vc2_utils.waitMs(500);
            }
        } catch (error) {
            var errorMsg = vc_util.extractError(error);
            log.error(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
        } finally {
            returnValue = objInvoiceDetails;
        }

        return returnValue;
    }

    function generateToken(option) {
        var logTitle = [LogTitle, 'generateToken'].join('::');
        // log.audit(logTitle, option);

        var tokenReq = vc_util.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' '),
            method: 'post',
            recordId: option.recordId,
            doRetry: true,
            maxRetry: 3,
            query: {
                url: option.config.url + '/oauth/oauth20/token',
                body: vc_util.convertToQuery({
                    grant_type: 'client_credentials',
                    client_id: option.config.user_id,
                    client_secret: option.config.user_pass
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        });

        if (tokenReq.isError) throw tokenReq.errorMsg;
        var tokenResp = vc_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        return tokenResp.access_token;
    }

    /////////////////////////////////////////////////////////////
    var CURRENT = {};
    var LibIngramAPI = {
        ValidOrderStatus: ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'],
        ValidLineStatus: ['SHIPPED', 'PROCESSING', 'DELIVERED', 'BACKORDERED'],
        ValidShippedStatus: ['SHIPPED'],
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
                        url: CURRENT.vendorConfig.url + '/oauth/oauth20/token',
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
                var tokenResp = vc_util.safeParse(tokenReq.RESPONSE);
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
        getValidOrders: function (option) {
            var logTitle = [LogTitle, 'getValidOrders'].join('::'),
                returnValue;
            try {
                var pageNum = 1,
                    pageSize = 10,
                    recordsCount = 0,
                    pageComplete = false;

                var arrInvoiceLinks = [],
                    arrOrderNums = [],
                    orderMiscCharges;

                while (!pageComplete) {
                    var searchUrl =
                        '/resellers/v6/orders/search?' +
                        vc_util.convertToQuery({
                            customerNumber: CURRENT.vendorConfig.partner_id,
                            isoCountryCode: CURRENT.vendorConfig.country,
                            customerOrderNumber: recordData.tranid,
                            pageNumber: pageNum,
                            pageSize: pageSize
                        });
                    searchUrl = CURRENT.vendorConfig.url + searchUrl;
                    log.audit(logTitle, LogPrefix + '>> searchUrl: ' + searchUrl);

                    var reqValidOrders = vc_util.sendRequest({
                        header: [LogTitle, 'Orders Search'].join(' : '),
                        query: {
                            url:
                                CURRENT.vendorConfig.url +
                                '/resellers/v6/orders/search?' +
                                vc_util.convertToQuery({
                                    customerNumber: CURRENT.vendorConfig.partner_id,
                                    isoCountryCode: CURRENT.vendorConfig.country,
                                    customerOrderNumber: recordData.tranid,
                                    pageNumber: pageNum,
                                    pageSize: pageSize
                                }),
                            headers: {
                                Authorization: 'Bearer ' + CURRENT.accessToken,
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                                'IM-CustomerNumber': CURRENT.vendorConfig.partner_id,
                                'IM-CountryCode': CURRENT.vendorConfig.country,
                                'IM-CustomerOrderNumber': CURRENT.recordNum,
                                'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                            }
                        },
                        recordId: CURRENT.recordId
                    });

                    if (reqValidOrders.isError) throw reqValidOrders.errorMsg;

                    var respIngramOrders = reqValidOrders.PARSED_RESPONSE;
                    if (!respIngramOrders) throw 'Unable to fetch server response';
                    if (!respIngramOrders.orders || !respIngramOrders.recordsFound) throw 'Orders are not found';

                    recordsCount = recordsCount + (respIngramOrders.pageSize || 0);

                    for (var i = 0, j = respIngramOrders.orders.length; i < j; i++) {
                        var ingramOrder = respIngramOrders.orders[i];

                        if (!ingramOrder.orderStatus) continue;
                        if (vc_util.inArray(ingramOrder.orderStatus, ['CANCELLED'])) continue;

                        for (var ii = 0, jj = ingramOrder.subOrders.length; ii < jj; ii++) {
                            var subOrderInfo = ingramOrder.subOrders[ii];

                            for (var iii = 0, jjj = subOrderInfo.links.length; iii < jjj; iii++) {
                                var subOrderLink = subOrderInfo.links[iii];

                                if (!subOrderLink.topic || subOrderLink.topic != 'invoices') continue;

                                arrInvoiceLinks.push(subOrderLink.href);
                                arrOrderNums.push(ingramOrder.ingramOrderNumber);
                            }
                        }

                        arrOrderDetails.push(ingramOrder);
                    }

                    if (recordsCount >= respIngramOrders.recordsFound) {
                        pageComplete = true;
                        break;
                    } else {
                        pageNum++;
                        vc_util.waitMs(1000);
                    }
                }

                arrInvoiceLinks = vc_util.uniqueArray(arrInvoiceLinks);
                arrOrderNums = vc_util.uniqueArray(arrOrderNums);
                log.audit(logTitle, LogPrefix + '>> Invoice Links: ' + JSON.stringify(arrInvoiceLinks));
                log.audit(logTitle, LogPrefix + '>> Order Numbers: ' + JSON.stringify(arrOrderNums));

                returnValue = {
                    invoices: arrInvoiceLinks,
                    orders: arrOrderNums
                };
            } catch (error) {
                var errorMsg = vc_util.extractError(error);
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);

                vc_util.vcLog({
                    title: LogTitle + ' Orders Search : Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw errorMsg;
            } finally {
                log.audit(logTitle, LogPrefix + '>> valid orders: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
                returnValue;

            try {
                var ingramOrder = option.ingramOrder || option.orderNum;
                if (!ingramOrder) throw 'Ingram Order is required';

                var reqOrderDetails = vc_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    recordId: CURRENT.recordId,
                    query: {
                        url: CURRENT.vendorConfig.url + '/resellers/v6/orders/' + CURRENT.recordNum,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.vendorConfig.partner_id,
                            'IM-CountryCode': CURRENT.vendorConfig.country,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        }
                    }
                });

                if (reqOrderDetails.isError) throw reqOrderDetails.errorMsg;
                var respOrderDetail = reqOrderDetails.PARSED_RESPONSE;
                if (!respOrderDetail) throw 'Unable to fetch server response';

                if (!respOrderDetail.hasOwnProperty('miscellaneousCharges')) throw 'No miscellaneous charges';

                var objMischCharges = {};

                for (var i = 0, j = respOrderDetail.miscellaneousCharges.length; i < j; i++) {
                    var chargeInfo = respOrderDetail.miscellaneousCharges[i];

                    log.audit(logTitle, LogPrefix + '>> chargeInfo: ' + JSON.stringify(chargeInfo));

                    if (!chargeInfo.subOrderNumber) continue;
                    if (!objMischCharges[chargeInfo.subOrderNumber]) objMischCharges[chargeInfo.subOrderNumber] = [];

                    objMischCharges[chargeInfo.subOrderNumber].push({
                        description: chargeInfo.chargeDescription,
                        amount: vc_util.forceFloat(chargeInfo.chargeAmount)
                    });
                }

                returnValue = objMischCharges;
            } catch (error) {
                var errorMsg = vc_util.extractError(error);
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
                vc_util.vcLog({
                    title: LogTitle + ' Order Details:  Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                returnValue = false;
            } finally {
                log.audit(logTitle, LogPrefix + '>> order details: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getItemAvailability: function (option) {
            var logTitle = [LogTitle, 'getItemAvailability'].join('::'),
                returnValue;

            try {
                var respOrderDetail = option.orderDetails;
                if (vc_util.isEmpty(respOrderDetail)) throw 'Missing order details';

                var arrLineItems = [];

                for (var i = 0, j = respOrderDetail.lines.length; i < j; i++) {
                    var orderLine = respOrderDetail.lines[i];

                    var lineData = null;
                    for (var ii = 0, jj = arrLineItems.length; ii < jj; ii++) {
                        if (arrLineItems[ii].ingramPartNumber == orderLine.ingramPartNumber) {
                            lineData = arrLineItems[ii];
                            break;
                        }
                    }

                    if (!lineData) {
                        arrLineItems.push({
                            ingramPartNumber: orderLine.ingramPartNumber,
                            customerPartNumber: orderLine.ingramPartNumber,
                            vendorPartNumber: orderLine.vendorPartNumber,
                            upc: orderLine.upcCode,
                            quantityRequested: orderLine.quantityOrdered
                        });
                    } else {
                        lineData.quantityRequested += parseInt(orderLine.quantityOrdered);
                    }
                }

                log.audit(logTitle, LogPrefix + '>> arrLineItems: ' + JSON.stringify(arrLineItems));

                var reqItemAvail = vc_util.sendRequest({
                    header: [LogTitle, 'Item Availability'].join(' : '),
                    method: 'post',
                    query: {
                        url:
                            CURRENT.vendorConfig.endPoint.replace(/orders.*$/gi, 'catalog/priceandavailability?') +
                            'includeAvailability=true&includePricing=true&includeProductAttributes=true',
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'IM-CustomerNumber': CURRENT.vendorConfig.customerNo,
                            'IM-CountryCode': CURRENT.vendorConfig.country,
                            'IM-CustomerOrderNumber': CURRENT.recordNum,
                            'IM-CorrelationID': [CURRENT.recordNum, CURRENT.recordId].join('-')
                        },
                        body: JSON.stringify({
                            showAvailableDiscounts: true,
                            showReserveInventoryDetails: true,
                            specialBidNumber: '',
                            products: arrLineItems
                        })
                    },
                    recordId: CURRENT.recordId
                });
                if (reqItemAvail.isError) throw reqItemAvail.errorMsg;
                var respItemAvail = vc_util.safeParse(reqItemAvail.RESPONSE);
                if (!respItemAvail) throw 'Unable to retrieve the item availability';

                returnValue = respItemAvail;
            } catch (error) {
                var errorMsg = vc_util.extractError(error);
                vc_util.vcLog({
                    title: LogTitle + ' Item Availability:  Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + errorMsg);
                returnValue = [];
            } finally {
                log.audit(logTitle, LogPrefix + '>> item availability: ' + JSON.stringify(returnValue));
            }
            return returnValue;
        },
        extractItemAvailability: function (option) {
            var logTitle = [LogTitle, 'extractItemAvailability'].join('::');

            var lineDetail = option.lineDetail,
                respItemAvail = option.itemAvailability,
                itemLocations = null;

            // look for the item availability
            for (var i = 0, j = respItemAvail.length; i < j; i++) {
                var itemAvail = respItemAvail[i];

                if (
                    itemAvail.ingramPartNumber != lineDetail.ingramPartNumber ||
                    itemAvail.upc != lineDetail.upcCode ||
                    itemAvail.vendorPartNumber != lineDetail.vendorPartNumber
                )
                    continue;

                if (itemAvail.availability && itemAvail.availability.availabilityByWarehouse) {
                    itemLocations = itemAvail.availability.availabilityByWarehouse;
                    break;
                }
            }
            if (!itemLocations) return;

            var arrDateBackOrderd = [];
            for (var ii = 0, jj = itemLocations.length; ii < jj; ii++) {
                var location = itemLocations[ii];
                var dateBackOrderd = location.quantityBackorderedEta;
                if (!dateBackOrderd) continue;

                arrDateBackOrderd.push({
                    dateStr: dateBackOrderd,
                    dateObj: moment(dateBackOrderd).toDate()
                });
            }

            log.audit(logTitle, LogPrefix + '>> arrDateBackOrderd: ' + JSON.stringify(arrDateBackOrderd));

            if (vc_util.isEmpty(arrDateBackOrderd)) return;

            var nearestDate = arrDateBackOrderd.sort(function (a, b) {
                return a.dateObj - b.dateObj;
            });
            log.audit(logTitle, LogPrefix + '>> nearestDate: ' + JSON.stringify(nearestDate));

            return nearestDate.shift();
        },
        extractOrderShipmentDetails: function (option) {
            var logTitle = [LogTitle, 'extractOrderShipmentDetails'].join('::');

            var shipmentDetails = option.shipmentDetails;
            if (vc_util.isEmpty(shipmentDetails)) return false;

            var shipData = {
                quantity: 0,
                serials: [],
                trackingNumbers: []
            };

            for (var i = 0, j = shipmentDetails.length; i < j; i++) {
                var shipment = shipmentDetails[i];
                shipData.detail = shipment;
                shipData.quantity += parseFloat(shipment.quantity);
                shipData.order_date = shipment.invoiceDate;
                shipData.ship_date = shipment.shippedDate;
                shipData.order_eta = shipment.estimatedDeliveryDate || '';
                shipData.order_eta_ship = shipment.estimatedDeliveryDate;

                if (shipment.carrierDetails) {
                    shipData.carrier = shipment.carrierDetails.carrierName;

                    if (shipment.carrierDetails.trackingDetails) {
                        var trackingDetails = shipment.carrierDetails.trackingDetails;
                        for (var ii = 0, jj = trackingDetails.length; ii < jj; ii++) {
                            if (trackingDetails[ii].trackingNumber) {
                                // var trackingNumber = trackingDetails[ii].trackingNumber.split(/\s/gi);

                                shipData.trackingNumbers = shipData.trackingNumbers.concat(
                                    trackingDetails[ii].trackingNumber.split(/[\W\D]+/g)
                                );

                                // shipData.trackingNumbers.push(trackingDetails[ii].trackingNumber);
                            }

                            if (trackingDetails[ii].SerialNumbers) {
                                var serialNumbers = trackingDetails[ii].SerialNumbers;

                                for (var iii = 0, jjj = serialNumbers.length; iii < jjj; iii++) {
                                    if (serialNumbers[iii].serialNumber)
                                        shipData.serials.push(serialNumbers[iii].serialNumber);
                                }
                            }
                        }
                    }
                }
            }

            shipData.serials = vc_util.uniqueArray(shipData.serials);
            shipData.trackingNumbers = vc_util.uniqueArray(shipData.trackingNumbers);

            log.audit(logTitle, LogPrefix + '>> Ship Data: ' + JSON.stringify(shipData));
            return shipData;
        },
        buildOutputArray: function (option) {
            var logTitle = [LogTitle, 'buildOutputArray'].join('::'),
                returnValue;
            try {
                var respOrderDetails = option.orderDetails,
                    respItemAvail = option.itemAvailability;

                var arrLineData = [];

                for (var i = 0, j = respOrderDetails.lines.length; i < j; i++) {
                    var lineDetail = respOrderDetails.lines[i];

                    var lineData = {
                        detail: lineDetail,
                        availabilityDate: LibIngramAPI.extractItemAvailability({
                            lineDetail: lineDetail,
                            itemAvailability: respItemAvail
                        }),
                        status: (lineDetail.lineStatus || '').toUpperCase()
                    };

                    if (!vc_util.inArray(lineData.status, LibIngramAPI.ValidLineStatus)) {
                        log.audit(logTitle, '.... skipping line, invalid status :  [' + lineData.status + ']');
                        continue;
                    }

                    if (lineDetail.shipmentDetails) {
                        lineData.shipmentDetails = LibIngramAPI.extractOrderShipmentDetails({
                            shipmentDetails: lineDetail.shipmentDetails
                        });
                    }

                    arrLineData.push(lineData);
                }

                returnValue = arrLineData;
            } catch (error) {
                log.audit(
                    logTitle,
                    LogPrefix + ('## ERROR ## ' + vc_util.extractError(error)) + ('\n' + JSON.stringify(error))
                );
                returnValue = false;
            } finally {
                log.audit(logTitle, LogPrefix + '>> output array: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        getNSRecord: function (option) {
            var logTitle = [LogTitle, 'getNSRecord'].join('::'),
                returnValue;

            var orderNumber = option.ingramOrderNumber;
            orderNumber = orderNumber.replace(/[^a-z0-9]/gi, '');
            orderNumber = [CURRENT.vendorConfig.fulfillmentPrefix, orderNumber].join('');

            var searchOption = {
                type: 'itemfulfillment',
                filters: [
                    ['type', 'anyof', 'ItemShip'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    [
                        "formulatext: REGEXP_REPLACE({custbody_ctc_if_vendor_order_match}, '[^a-zA-Z0-9]', '')",
                        'is',
                        orderNumber
                    ]
                ],
                columns: ['internalid', 'transactionnumber', 'custbody_ctc_if_vendor_order_match']
            };
            // log.audit(logTitle, LogPrefix + '>> searchOPtion: ' + JSON.stringify(searchOption));

            var nsItemFF;
            ns_search
                .create(searchOption)
                .run()
                .each(function (row) {
                    nsItemFF = row.id;
                    return true;
                });

            returnValue = nsItemFF;
            log.audit(logTitle, LogPrefix + '>> nsItemFF: ' + JSON.stringify(nsItemFF));

            return returnValue;
        }
    };

    return {
        processXml: function (recordId, config) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue = [];

            try {
                CURRENT.recordId = recordId;
                CURRENT.vendorConfig = config;
                var recordData = vc_util.flatLookup({
                    type: ns_search.Type.PURCHASE_ORDER,
                    id: recordId,
                    columns: ['tranid']
                });
                CURRENT.recordNum = recordData.tranid;
                LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';

                log.audit(logTitle, LogPrefix + '>> Process API <<' + JSON.stringify(CURRENT));

                LibIngramAPI.generateToken();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                // get all the valid orders
                var validOrders = LibIngramAPI.getValidOrders();
                for (var i = 0, j = validOrders.orders.length; i < j; i++) {
                    var orderNum = validOrders.orders[i];

                    var miscCharges = LibIngramAPI.getOrderDetails({
                        orderNum: orderNum
                    });

                    vc_util.waitMs(1200);
                }
            } catch (error) {
                vc_util.vcLog({
                    title: LogTitle + ': Request Error',
                    error: error,
                    recordId: CURRENT.recordId
                });
                throw vc_util.extractError(error);
            }

            return returnValue;
        }
    };
});
