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
                log.audit(logTitle, LogPrefix + '>> Invoice Data (initial): ' + JSON.stringify(invoiceData));
                log.audit(logTitle, LogPrefix + '>> Processing lines: ' + JSON.stringify(invoiceInfo.lines.length));

                for (var ii = 0, jj = invoiceInfo.lines.length; ii < jj; ii++) {
                    var lineInfo = invoiceInfo.lines[ii];
                    log.audit(logTitle, LogPrefix + '>> ...Line Info: ' + JSON.stringify(lineInfo));

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
                    log.audit(logTitle, LogPrefix + '>> ...lineIdx: ' + JSON.stringify(lineIdx));

                    var lineItemRate = lodash.findIndex(invoiceData.lines, {
                        ITEMNO: lineData.ITEMNO,
                        PRICE: vc_util.parseFloat(lineInfo.unitprice)
                    });
                    log.audit(logTitle, LogPrefix + '>> ...lineItemRate: ' + JSON.stringify(lineItemRate));

                    if (lineItemRate >= 0) {
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

                // vc_util.waitMs(500);
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

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
