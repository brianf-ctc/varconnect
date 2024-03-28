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
], function (ns_https, ns_search, ns_runtime, vc2_util, moment, lodash) {
    'use strict';
    var LogTitle = 'WS:IngramAPI',
        LogPrefix,
        CURRENT = {};

    function processXml(recordId, config) {
        var logTitle = [LogTitle, 'processXml'].join('::'),
            returnValue;

        LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';
        vc2_util.LogPrefix = LogPrefix;
        vc2_util.log(logTitle, '>> current: ', [recordId, config]);

        // var recordData = vc2_util.flatLookup({
        //     type: ns_search.Type.PURCHASE_ORDER,
        //     id: recordId,
        //     columns: ['tranid', 'subsidiary']
        // });

        var token = getTokenCache({
            recordId: recordId,
            config: config,
            tranId: config.poNum
        });
        vc2_util.log(logTitle, '>> access token: ', token);

        var orderDetails = getOrderDetails({
            config: config,
            recordId: recordId,
            token: token
            // recordData: recordData
        });
        vc2_util.log(logTitle, '>> orderDetails: ', orderDetails);

        var invoiceDetails = getInvoiceDetails({
            config: config,
            recordId: recordId,
            token: token,
            // recordData: recordData,
            invoiceLinks: orderDetails.invoiceLinks,
            orderNumbers: orderDetails.orderNumbers
        });

        var arrInvoices = [];

        for (var orderKey in invoiceDetails) {
            vc2_util.log(logTitle, '>> invoice Id: ', orderKey);

            var invoiceData = invoiceDetails[orderKey];

            // check for misc charges
            if (orderDetails.miscCharges && orderDetails.miscCharges[orderKey]) {
                vc2_util.log(logTitle, '>> misc charge: ', orderDetails.miscCharges[orderKey]);

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
                            invoiceData.ordObj.charges.shipping += vc2_util.parseFloat(
                                chargeInfo.amount
                            );
                        } else {
                            invoiceData.ordObj.charges.other += vc2_util.parseFloat(
                                chargeInfo.amount
                            );
                        }
                    } else {
                        invoiceData.ordObj.charges.other += vc2_util.parseFloat(chargeInfo.amount);
                    }
                }
            }

            vc2_util.log(logTitle, '>> invoiceData: ', invoiceData);

            arrInvoices.push(invoiceData);
        }

        return arrInvoices;
    }

    function getOrderDetails(option) {
        var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
            returnValue = {};

        var config = option.config,
            // recordData = option.recordData,
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
                    vc2_util.convertToQuery({
                        customerNumber: config.partner_id,
                        isoCountryCode: config.country,
                        customerOrderNumber: config.poNum,
                        pageNumber: pageNum,
                        pageSize: pageSize
                    });
                searchUrl = config.url + searchUrl;
                vc2_util.log(logTitle, '>> searchUrl: ', searchUrl);

                // send the request
                var searchOrderReq = vc2_util.sendRequest({
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
                            'IM-CorrelationID': config.poNum
                        }
                    }
                });
                vc2_util.handleJSONResponse(searchOrderReq);

                var searchOrderResp =
                    searchOrderReq.PARSED_RESPONSE || searchOrderReq.RESPONSE || {};

                if (searchOrderReq.isError || vc2_util.isEmpty(searchOrderResp)) {
                    throw (
                        searchOrderReq.errorMsg +
                        (searchOrderReq.details
                            ? '\n' + JSON.stringify(searchOrderReq.details)
                            : '')
                    );
                }

                if (!searchOrderResp.recordsFound) {
                    vc2_util.log(logTitle, '!! No records found !!');

                    break;
                }

                var ordersResults = searchOrderResp.orders;
                recordsCount = recordsCount + (searchOrderResp.pageSize || 0);

                vc2_util.log(logTitle, '>> ', {
                    recordsCount: recordsCount,
                    recordsFound: searchOrderResp.recordsFound,
                    totalOrders: ordersResults.length,
                    currentPage: pageNum
                });

                if (vc2_util.isEmpty(ordersResults)) break;

                for (var i = 0, j = ordersResults.length; i < j; i++) {
                    var orderInfo = ordersResults[i];

                    for (var ii = 0, jj = orderInfo.subOrders.length; ii < jj; ii++) {
                        var subOrderInfo = orderInfo.subOrders[ii];

                        // auto skip cancelled orders
                        if (
                            subOrderInfo.subOrderStatus &&
                            vc2_util.inArray(subOrderInfo.subOrderStatus.toUpperCase(), [
                                'CANCELLED'
                            ])
                        ) {
                            continue;
                        }

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
                    vc2_util.waitMs(500);
                }
            }

            vc2_util.log(logTitle, '>> Invoice Links: ', arrInvoiceLinks);
            vc2_util.log(logTitle, '>> Order Numbers: ', arrOrderNums);

            arrInvoiceLinks = vc2_util.uniqueArray(arrInvoiceLinks);
            arrOrderNums = vc2_util.uniqueArray(arrOrderNums);

            vc2_util.log(logTitle, '>> Prep to fetch miscellaneous charges.... ');

            orderMiscCharges = getMiscCharges(
                util.extend(option, {
                    invoiceLinks: arrInvoiceLinks,
                    orderNums: arrOrderNums
                })
            );

            vc2_util.log(logTitle, '>> misc charges: ', orderMiscCharges);
        } catch (error) {
            vc2_util.logError(logTitle, error);
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

        vc2_util.log(logTitle, '>> option: ', option);

        var config = option.config,
            // recordData = option.recordData,
            token = option.token,
            recordId = option.recordId;

        var objMischCharges = {};

        try {
            if (vc2_util.isEmpty(option.orderNums)) throw 'Missing purchase order numbers';
            for (var i = 0, j = option.orderNums.length; i < j; i++) {
                var orderNum = option.orderNums[i];

                var orderDetailsReq = vc2_util.sendRequest({
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
                            'IM-CorrelationID': config.poNum
                        }
                    }
                });
                vc2_util.handleJSONResponse(orderDetailsReq);

                var orderDetailsResp =
                    orderDetailsReq.PARSED_RESPONSE || orderDetailsReq.RESPONSE || {};

                if (orderDetailsReq.isError || vc2_util.isEmpty(orderDetailsReq)) {
                    throw (
                        orderDetailsReq.errorMsg +
                        (orderDetailsReq.details
                            ? '\n' + JSON.stringify(orderDetailsReq.details)
                            : '')
                    );
                }

                if (!orderDetailsResp.hasOwnProperty('miscellaneousCharges')) continue;

                for (var ii = 0, jj = orderDetailsResp.miscellaneousCharges.length; ii < jj; ii++) {
                    var chargeInfo = orderDetailsResp.miscellaneousCharges[ii];
                    vc2_util.log(logTitle, '>> chargeInfo: ', chargeInfo);

                    if (!chargeInfo.subOrderNumber) continue;
                    if (!objMischCharges[chargeInfo.subOrderNumber])
                        objMischCharges[chargeInfo.subOrderNumber] = [];

                    objMischCharges[chargeInfo.subOrderNumber].push({
                        description: chargeInfo.chargeDescription,
                        amount: vc2_util.forceFloat(chargeInfo.chargeAmount)
                    });
                }

                vc2_util.waitMs(500);
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);
        } finally {
            returnValue = objMischCharges;
        }

        return returnValue;
    }

    function getInvoiceDetails(option) {
        var logTitle = [LogTitle, 'getInvoiceDetails'].join('::'),
            returnValue = {};

        vc2_util.log(logTitle, '>> option: ', option);

        var config = option.config,
            // recordData = option.recordData,
            token = option.token,
            recordId = option.recordId;

        var objInvoiceDetails = {};

        try {
            if (vc2_util.isEmpty(option.invoiceLinks)) throw 'Missing invoice links';

            for (var i = 0, j = option.invoiceLinks.length; i < j; i++) {
                var invoiceLink = option.invoiceLinks[i];

                if (invoiceLink.match(/v6\/invoices/gi)) {
                    invoiceLink = invoiceLink.replace(/v6\/invoices/gi, 'v5/invoices');
                }
                log.audit(logTitle, '// invoiceLink: ' + invoiceLink);

                var invoiceDetailsReq = vc2_util.sendRequest({
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
                            Accept: '*/*',
                            Authorization: 'Bearer ' + token,
                            'IM-CustomerNumber': config.partner_id,
                            // customerNumber: config.partner_id,
                            'IM-CountryCode': config.country,
                            'IM-CorrelationID': config.poNum,
                            'IM-ApplicationID': ns_runtime.accountId
                        }
                    }
                });
                vc2_util.handleJSONResponse(invoiceDetailsReq);
                vc2_util.log(logTitle, '>> response 2: ', invoiceDetailsReq.PARSED_RESPONSE);

                var invoiceDetailsResp =
                    invoiceDetailsReq.PARSED_RESPONSE || invoiceDetailsReq.RESPONSE || {};

                if (invoiceDetailsReq.isError || vc2_util.isEmpty(invoiceDetailsResp)) {
                    throw (
                        invoiceDetailsReq.errorMsg +
                        (invoiceDetailsReq.details
                            ? '\n' + JSON.stringify(invoiceDetailsReq.details)
                            : '')
                    );
                }

                if (
                    !invoiceDetailsResp.serviceresponse ||
                    !invoiceDetailsResp.serviceresponse.invoicedetailresponse
                )
                    continue;

                var invoiceInfo = invoiceDetailsResp.serviceresponse.invoicedetailresponse,
                    invoiceData = {
                        po: config.poNum,
                        date: invoiceInfo.hasOwnProperty('invoicedate')
                            ? moment(invoiceInfo.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                            : moment().format('MM/DD/YYYY'),
                        invoice: invoiceInfo.globalorderid,
                        total: vc2_util.parseFloat(invoiceInfo.totalamount),
                        charges: {
                            tax: vc2_util.parseFloat(invoiceInfo.totaltaxamount),
                            shipping:
                                vc2_util.parseFloat(invoiceInfo.customerfreightamount) +
                                vc2_util.parseFloat(invoiceInfo.customerforeignfrightamt),
                            other: vc2_util.parseFloat(invoiceInfo.discountamount)
                        },
                        carrier: invoiceInfo.carrier || '',
                        shipDate: invoiceInfo.hasOwnProperty('shipdate')
                            ? moment(invoiceInfo.shipdate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                            : 'NA',
                        lines: []
                    };

                vc2_util.log(logTitle, '>> Invoice Data (initial): ', invoiceData);
                vc2_util.log(
                    logTitle,
                    '>> Processing lines: ',
                    invoiceInfo && invoiceInfo.lines ? invoiceInfo.lines.length : 0
                );

                for (
                    var ii = 0, jj = invoiceInfo.lines ? invoiceInfo.lines.length : 0;
                    ii < jj;
                    ii++
                ) {
                    var lineInfo = invoiceInfo.lines[ii];
                    vc2_util.log(logTitle, '>> ...Line Info: ', lineInfo);

                    if (vc2_util.isEmpty(lineInfo.vendorpartnumber)) continue;

                    var lineData = {
                        ITEMNO: lineInfo.vendorpartnumber,
                        PRICE: vc2_util.parseFloat(lineInfo.unitprice),
                        QUANTITY: vc2_util.forceInt(lineInfo.shippedquantity),
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
                    vc2_util.log(logTitle, '>> ...lineIdx: ', lineIdx);

                    var lineItemRate = lodash.findIndex(invoiceData.lines, {
                        ITEMNO: lineData.ITEMNO,
                        PRICE: vc2_util.parseFloat(lineInfo.unitprice)
                    });

                    vc2_util.log(logTitle, '>> ...lineItemRate: ', lineItemRate);

                    if (lineItemRate >= 0) {
                        // increment the quantity
                        invoiceData.lines[lineIdx].QUANTITY += lineData.QUANTITY;

                        if (!vc2_util.isEmpty(lineData.SERIAL)) {
                            if (!invoiceData.lines[lineIdx].SERIAL)
                                invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL;
                            else
                                invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL.concat(
                                    invoiceData.lines[lineIdx].SERIAL
                                );
                            // trim unique serials
                            invoiceData.lines[lineIdx].SERIAL = vc2_util.uniqueArray(
                                invoiceData.lines[lineIdx].SERIAL
                            );
                        }

                        if (!vc2_util.isEmpty(lineData.TRACKING)) {
                            if (!invoiceData.lines[lineIdx].TRACKING)
                                invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING;
                            else
                                invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING.concat(
                                    invoiceData.lines[lineIdx].TRACKING
                                );
                            // trim unique tracking
                            invoiceData.lines[lineIdx].TRACKING = vc2_util.uniqueArray(
                                invoiceData.lines[lineIdx].TRACKING
                            );
                        }
                    } else {
                        invoiceData.lines.push(lineData);
                    }
                }
                vc2_util.log(logTitle, '>> Invoice Data: ', invoiceData);

                objInvoiceDetails[invoiceData.invoice] = {
                    ordObj: invoiceData,
                    xmlStr: JSON.stringify(invoiceDetailsResp)
                };

                // vc_util.waitMs(500);
            }
        } catch (error) {
            vc2_util.log(logTitle, '## ERROR ##', error);
        } finally {
            returnValue = objInvoiceDetails;
        }

        return returnValue;
    }

    function generateToken(option) {
        var logTitle = [LogTitle, 'generateToken'].join('::');

        var tokenReq = vc2_util.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' '),
            method: 'post',
            recordId: option.recordId,
            doRetry: true,
            maxRetry: 3,
            query: {
                url: option.config.url + '/oauth/oauth20/token',
                body: vc2_util.convertToQuery({
                    grant_type: 'client_credentials',
                    client_id: option.config.user_id,
                    client_secret: option.config.user_pass
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        });
        vc2_util.handleJSONResponse(tokenReq);

        var tokenResp = tokenReq.PARSED_RESPONSE;
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

        return tokenResp.access_token;
    }

    function getTokenCache(option) {
        var token = vc2_util.getNSCache({ key: 'VC_BC_INGRAM_TOKEN' });
        if (vc2_util.isEmpty(token)) token = generateToken(option);

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: 'VC_BC_INGRAM_TOKEN',
                cacheTTL: 14400,
                value: token
            });
            CURRENT.accessToken = token;
        }
        return token;
    }

    // // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
