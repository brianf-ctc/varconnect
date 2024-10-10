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
    'N/search',
    'N/runtime',
    '../../CTC_VC2_Lib_Utils',
    '../Libraries/moment',
    '../Libraries/lodash'
], function (ns_search, ns_runtime, vc2_util, moment, lodash) {
    'use strict';
    var LogTitle = 'WS:IngramAPI',
        LogPrefix,
        CURRENT = {};

    var LibIngramAPI = {
        getTokenCache: function () {
            var logTitle = [LogTitle, 'getTokenCache'].join('::'),
                returnValue;

            var extraParams = vc2_util.extractValues({
                source: CURRENT.billConfig,
                params: ['id', 'subsidiary', 'entry_function', 'partner_id']
            });
            var cacheKey = 'INGRAM_TOKEN-' + vc2_util.convertToQuery(extraParams),
                token = vc2_util.getNSCache({ key: cacheKey });

            vc2_util.log(LogTitle, '// cacheKey: ', cacheKey);
            if (vc2_util.isEmpty(token)) token = this.generateToken();

            if (!vc2_util.isEmpty(token)) {
                vc2_util.setNSCache({
                    key: cacheKey,
                    cacheTTL: 14400,
                    value: token
                });
                CURRENT.accessToken = token;
            }
            return token;
        },
        generateToken: function () {
            var logTitle = [LogTitle, 'generateToken'].join('::');

            var tokenReq = vc2_util.sendRequest({
                header: [LogTitle, 'GenerateToken'].join(' '),
                method: 'post',
                recordId: CURRENT.recordId,
                doRetry: true,
                maxRetry: 3,
                query: {
                    url: CURRENT.billConfig.url + '/oauth/oauth30/token',
                    body: vc2_util.convertToQuery({
                        grant_type: 'client_credentials',
                        client_id: CURRENT.billConfig.user_id,
                        client_secret: CURRENT.billConfig.user_pass
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            });
            vc2_util.handleJSONResponse(tokenReq);

            var tokenResp = tokenReq.PARSED_RESPONSE;
            if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

            CURRENT.accessToken = tokenResp.access_token;

            return CURRENT.accessToken;
        },
        searchOrders: function (option) {
            var logTitle = [LogTitle, 'searchOrders'].join('::'),
                returnValue = {};

            option = option || {};

            try {
                var config = CURRENT.billConfig;

                var searchUrl =
                    '/resellers/v6/orders/search?' +
                    vc2_util.convertToQuery({
                        customerNumber: config.partner_id,
                        isoCountryCode: config.country,
                        customerOrderNumber: config.poNum,
                        pageNumber: option.pageNum,
                        pageSize: option.pageSize
                    });

                searchUrl = config.url + searchUrl;
                vc2_util.log(logTitle, '>> searchUrl: ', searchUrl);

                var searchOrderReq = vc2_util.sendRequest({
                    header: [LogTitle, 'OrderSearch ', option.pageNum].join(' '),
                    method: 'get',
                    recordId: CURRENT.recordId,
                    query: {
                        url: searchUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + CURRENT.accessToken,
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

                returnValue = searchOrderResp;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        getOrderDetails: function (option) {
            var logTitle = [LogTitle, 'searchOrders'].join('::'),
                returnValue = {};

            option = option || {};

            try {
                var config = CURRENT.billConfig;

                var orderDetailsReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Order Details'].join(' '),
                    method: 'get',
                    recordId: CURRENT.recordId,
                    query: {
                        url: config.url + '/resellers/v6/orders/' + option.orderNum,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            Authorization: 'Bearer ' + CURRENT.accessToken,
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

                returnValue = orderDetailsResp;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        getInvoiceDetailsV5: function (option) {
            var logTitle = [LogTitle, 'getInvoiceDetailsV5'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                var config = CURRENT.billConfig;

                var invoiceDetailsReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Invoice Details V5'].join(' '),
                    recordId: CURRENT.recordId,
                    query: {
                        url:
                            config.url +
                            option.link +
                            ('?customerNumber=' + config.partner_id) +
                            ('&isoCountryCode=' + config.country),
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: '*/*',
                            Authorization: 'Bearer ' + CURRENT.accessToken,
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

                var serviceResponse = invoiceDetailsResp.serviceresponse;

                if (!serviceResponse || !serviceResponse.invoicedetailresponse) {
                    throw serviceResponse && serviceResponse.responsepreamble
                        ? serviceResponse.responsepreamble.responsemessage || 'Invoice Not Found'
                        : 'Missing invoice details';
                }

                returnValue = serviceResponse.invoicedetailresponse;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        getInvoiceDetailsV6: function (option) {
            var logTitle = [LogTitle, 'getInvoiceDetailsV6'].join('::'),
                returnValue = {};
            option = option || {};

            try {
                var config = CURRENT.billConfig;

                var invoiceDetailsReq = vc2_util.sendRequest({
                    header: [LogTitle, 'Invoice Details V6'].join(' '),
                    recordId: CURRENT.recordId,
                    query: {
                        url:
                            config.url +
                            option.link +
                            ('?customerNumber=' + config.partner_id) +
                            ('&isoCountryCode=' + config.country),
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: '*/*',
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            'IM-CustomerNumber': config.partner_id,
                            // customerNumber: config.partner_id,
                            'IM-CountryCode': config.country,
                            'IM-CorrelationID': config.poNum,
                            'IM-ApplicationID': ns_runtime.accountId
                        }
                    }
                });
                vc2_util.handleJSONResponse(invoiceDetailsReq);

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

                returnValue = invoiceDetailsResp;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return {
        processOrders: function (option) {
            var logTitle = [LogTitle, 'processOrders'].join('::'),
                returnValue = [];

            var orderDetails = {
                links: [],
                orderNums: []
            };
            try {
                var queue = {
                    pageNum: 1,
                    pageSize: 10,
                    count: 0,
                    isComplete: false
                };

                while (!queue.isComplete) {
                    var ordersResult = LibIngramAPI.searchOrders(queue);

                    if (!ordersResult.recordsFound) {
                        vc2_util.log(logTitle, '/// No Records Found');
                        break;
                    }

                    vc2_util.log(logTitle, '** Total Records :', ordersResult.recordsFound);

                    var ordersList = ordersResult.orders;
                    queue.count = queue.count + (ordersList.length || 0);

                    for (var i = 0, j = ordersList.length; i < j; i++) {
                        var orderInfo = ordersList[i],
                            customerOrderNum = orderInfo.customerOrderNumber,
                            ingramOrderNum = orderInfo.ingramOrderNumber,
                            subOrdersList = orderInfo.subOrders;

                        vc2_util.log(logTitle, '// processing order:', customerOrderNum);

                        if (
                            !orderInfo ||
                            !customerOrderNum ||
                            customerOrderNum != CURRENT.billConfig.poNum
                        ) {
                            vc2_util.log(logTitle, '... skipped ');
                            continue;
                        }
                        vc2_util.log(logTitle, '... total suborders:', subOrdersList.length);

                        for (var ii = 0, jj = subOrdersList.length; ii < jj; ii++) {
                            var subOrderInfo = subOrdersList[ii],
                                subOrderStatus = subOrderInfo.subOrderStatus,
                                orderLinksList = subOrderInfo.links;

                            vc2_util.log(logTitle, '... subOrderInfo: ', subOrderInfo);

                            if (!subOrderStatus || vc2_util.inArray(subOrderStatus, ['CANCELLED']))
                                continue;

                            // get the links
                            for (var iii = 0, jjj = orderLinksList.length; iii < jjj; iii++) {
                                var subOrderLink = orderLinksList[iii],
                                    linkTopic = subOrderLink.topic,
                                    linkURL = subOrderLink.href;

                                if (!linkTopic || !linkTopic.match(/\binvoices\b/gi)) continue;

                                vc2_util.log(logTitle, '.. added link: ', [
                                    subOrderLink,
                                    ingramOrderNum
                                ]);

                                if (!vc2_util.inArray(linkURL, orderDetails.links))
                                    orderDetails.links.push(linkURL);

                                if (!vc2_util.inArray(ingramOrderNum, orderDetails.orderNums))
                                    orderDetails.orderNums.push(ingramOrderNum);
                            }
                        }
                    }

                    vc2_util.log(logTitle, '... queue: ', queue);

                    if (queue.count >= ordersResult.recordsFound) {
                        queue.isComplete = true;
                        break;
                    } else {
                        queue.pageNum++;
                        vc2_util.waitMs(500);
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
            } finally {
                vc2_util.log(logTitle, '/// Order Details: ', orderDetails);

                returnValue = orderDetails;
            }

            return returnValue;
        },
        processMiscCharges: function (option) {
            var logTitle = [LogTitle, 'processMiscCharges'].join('::'),
                returnValue = [];

            var origLogPrefix = vc2_util.LogPrefix;
            try {
                if (vc2_util.isEmpty(option.orderNums)) throw 'Missing purchase order numberss';

                var orderMiscCharges = {};

                vc2_util.log(logTitle, '** Total orderNums: ', option.orderNums.length);

                for (var i = 0, j = option.orderNums.length; i < j; i++) {
                    var orderNum = option.orderNums[i];
                    vc2_util.LogPrefix = origLogPrefix + '[' + orderNum + '] ';

                    var respOrderDetails = LibIngramAPI.getOrderDetails({ orderNum: orderNum });

                    // vc2_util.log(logTitle, '... order details:', respOrderDetails);
                    if (!respOrderDetails) continue;

                    var miscChargeList = respOrderDetails.miscellaneousCharges;
                    vc2_util.log(logTitle, '... miscChargeList:', miscChargeList || '-none-');

                    if (!miscChargeList || !miscChargeList.length) continue;

                    for (var ii = 0, jj = miscChargeList.length; ii < jj; ii++) {
                        var miscCharge = miscChargeList[ii],
                            subOrderNum = miscCharge.subOrderNumber;

                        if (!subOrderNum) continue;

                        if (!orderMiscCharges[subOrderNum]) orderMiscCharges[subOrderNum] = [];

                        orderMiscCharges[subOrderNum].push({
                            description: miscCharge.chargeDescription,
                            amount: vc2_util.parseFloat(miscCharge.chargeAmount)
                        });
                    }

                    vc2_util.waitMs(100);
                }
                vc2_util.LogPrefix = origLogPrefix;

                returnValue = orderMiscCharges;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '/// Misc Charges: ', returnValue);
            }

            return returnValue;
        },
        processInvoiceDetails: function (option) {
            var logTitle = [LogTitle, 'processInvoiceDetails'].join('::'),
                returnValue = [];

            try {
                var invoiceLink = option.link;

                if (invoiceLink.match(/v6\/invoices/gi)) {
                    invoiceLink = invoiceLink.replace(/v6\/invoices/gi, 'v5/invoices');
                }
                vc2_util.log(logTitle, '// invoice link ', invoiceLink);
                var invoiceDetailsResp = LibIngramAPI.getInvoiceDetailsV5({ link: invoiceLink });
                // var invoiceDetailsResp = LibIngramAPI.getInvoiceDetailsV6({ link: invoiceLink });

                if (!invoiceDetailsResp) return false;

                var invoiceData = {
                    po: CURRENT.billConfig.poNum,
                    date: invoiceDetailsResp.invoicedate
                        ? moment(invoiceDetailsResp.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                        : moment().format('MM/DD/YYYY'),
                    invoice: invoiceDetailsResp.globalorderid,
                    total: vc2_util.parseFloat(invoiceDetailsResp.totalamount),
                    charges: {
                        tax: vc2_util.parseFloat(invoiceDetailsResp.totaltaxamount),
                        shipping:
                            vc2_util.parseFloat(invoiceDetailsResp.customerfreightamount) +
                            vc2_util.parseFloat(invoiceDetailsResp.customerforeignfrightamt),
                        other: vc2_util.parseFloat(invoiceDetailsResp.discountamount)
                    },
                    carrier: invoiceDetailsResp.carrier || '',
                    shipDate: invoiceDetailsResp.hasOwnProperty('shipdate')
                        ? moment(invoiceDetailsResp.shipdate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                        : 'NA',
                    lines: []
                };

                vc2_util.log(logTitle, '.. invoice data: ', invoiceData);

                if (!invoiceDetailsResp.lines || !invoiceDetailsResp.lines.length)
                    throw 'Missing invoice lines';

                vc2_util.log(logTitle, 'Processing lines: ', invoiceDetailsResp.lines.length);

                for (var i = 0, j = invoiceDetailsResp.lines.length; i < j; i++) {
                    var lineInfo = invoiceDetailsResp.lines[i];

                    var lineData = {
                        ITEMNO: lineInfo.vendorpartnumber || lineInfo.partnumber,
                        SKU: lineInfo.ingramPartNumber,
                        PRICE: vc2_util.parseFloat(lineInfo.unitprice),
                        QUANTITY: vc2_util.forceInt(lineInfo.shippedquantity),
                        DESCRIPTION: lineInfo.partdescription
                    };

                    vc2_util.log(logTitle, '... lineData: ', [lineData, lineInfo]);

                    // extract the serials
                    var lineSerials = [];
                    if (lineInfo.serialnumberdetails) {
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

                    // find for any matching existing lineData
                    var matchingLineItem = vc2_util.findMatching({
                            list: invoiceData.lines,
                            filter: {
                                ITEMNO: lineData.ITEMNO
                            }
                        }),
                        matchingLineItemRate = vc2_util.findMatching({
                            list: invoiceData.lines,
                            filter: {
                                ITEMNO: lineData.ITEMNO,
                                PRICE: lineData.PRICE
                            }
                        });

                    // no matching line item
                    if (!matchingLineItem) {
                        invoiceData.lines.push(lineData);
                    } else {
                        var matchingLine = matchingLineItemRate || matchingLineItem;
                        matchingLine.QUANTITY += lineData.QUANTITY;

                        if (!vc2_util.isEmpty(lineData.SERIAL)) {
                            if (vc2_util.isEmpty(matchingLine.SERIAL)) matchingLine.SERIAL = [];

                            matchingLine.SERIAL = matchingLine.SERIAL.concat(lineData.SERIAL);
                            matchingLine.SERIAL = vc2_util.uniqueArray(matchingLine.SERIAL);
                        }

                        if (!vc2_util.isEmpty(lineData.TRACKING)) {
                            if (vc2_util.isEmpty(matchingLine.TRACKING)) matchingLine.TRACKING = [];

                            matchingLine.TRACKING = matchingLine.TRACKING.concat(lineData.TRACKING);
                            matchingLine.TRACKING = vc2_util.uniqueArray(matchingLine.TRACKING);
                        }
                    }
                }

                returnValue = {
                    data: invoiceData,
                    source: invoiceDetailsResp
                };
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            }

            return returnValue;
        },
        processInvoiceDetailsV6: function (option) {
            var logTitle = [LogTitle, 'processInvoiceDetailsV6'].join('::'),
                returnValue = [];

            try {
                var invoiceLink = option.link;

                if (invoiceLink.match(/v5\/invoices/gi)) {
                    invoiceLink = invoiceLink.replace(/v5\/invoices/gi, 'v6/invoices');
                }
                vc2_util.log(logTitle, '// invoice link ', invoiceLink);

                var invoiceDetailsResp = LibIngramAPI.getInvoiceDetailsV6({ link: invoiceLink });
                if (!invoiceDetailsResp) return false;

                var invoiceSummary = invoiceDetailsResp.Summary || {},
                    invoiceTotals = invoiceSummary.Totals || {},
                    invoiceLines = invoiceDetailsResp.Lines || [];

                var invoiceData = {
                    po: CURRENT.billConfig.poNum,
                    date: invoiceDetailsResp.InvoiceDate
                        ? moment(invoiceDetailsResp.InvoiceDate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                        : moment().format('MM/DD/YYYY'),
                    invoice: invoiceDetailsResp.InvoiceNumber,
                    total: vc2_util.parseFloat(invoiceTotals.InvoicedAmountDue),
                    charges: {
                        tax: vc2_util.parseFloat(invoiceTotals.TotalTaxAmount),
                        shipping: vc2_util.parseFloat(invoiceTotals.freightAmount),
                        other: vc2_util.parseFloat(invoiceTotals.DiscountAmount)
                    },
                    // carrier: invoiceDetailsResp.carrier || '',
                    // shipDate: invoiceDetailsResp.hasOwnProperty('shipdate')
                    //     ? moment(invoiceDetailsResp.shipdate, 'YYYY-MM-DD').format('MM/DD/YYYY')
                    //     : 'NA',
                    lines: []
                };

                vc2_util.log(logTitle, '.. invoice data: ', invoiceData);

                if (!invoiceDetailsResp.Lines || !invoiceDetailsResp.Lines.length)
                    throw 'Missing invoice lines';

                vc2_util.log(logTitle, 'Processing lines: ', invoiceDetailsResp.Lines.length);

                for (var i = 0, j = invoiceDetailsResp.Lines.length; i < j; i++) {
                    var lineInfo = invoiceDetailsResp.Lines[i];

                    var lineData = {
                        ITEMNO: lineInfo.VendorPartNumber,
                        SKU: lineInfo.IngramPartNumber,
                        PRICE: vc2_util.parseFloat(lineInfo.UnitPrice),
                        QUANTITY: vc2_util.forceInt(lineInfo.Quantity),
                        DESCRIPTION: lineInfo.ProductDescription
                    };

                    // extract the serials
                    var lineSerials = [];
                    if (lineInfo.SerialNumbers) {
                        lineInfo.SerialNumbers.forEach(function (serial) {
                            if (serial.serialNumber) lineSerials.push(serial.serialNumber);
                            return true;
                        });
                        lineData.SERIAL = lineSerials;
                    }
                    var listTracking = [];

                    // find for any matching existing lineData
                    var matchingLineItem = vc2_util.findMatching({
                            list: invoiceData.lines,
                            filter: {
                                ITEMNO: lineData.ITEMNO
                            }
                        }),
                        matchingLineItemRate = vc2_util.findMatching({
                            list: invoiceData.lines,
                            filter: {
                                ITEMNO: lineData.ITEMNO,
                                PRICE: lineData.PRICE
                            }
                        });

                    vc2_util.log(logTitle, '... lineData: ', {
                        lineInfo: lineInfo,
                        lineData: lineData,
                        matching: [matchingLineItem, matchingLineItemRate]
                    });

                    if (!matchingLineItem) {
                        invoiceData.lines.push(lineData);
                    } else {
                        var matchingLine = matchingLineItemRate || matchingLineItem;
                        matchingLine.QUANTITY += lineData.QUANTITY;

                        if (!vc2_util.isEmpty(lineData.SERIAL)) {
                            if (vc2_util.isEmpty(matchingLine.SERIAL)) matchingLine.SERIAL = [];

                            matchingLine.SERIAL = matchingLine.SERIAL.concat(lineData.SERIAL);
                            matchingLine.SERIAL = vc2_util.uniqueArray(matchingLine.SERIAL);
                        }
                    }
                }

                returnValue = {
                    data: invoiceData,
                    source: invoiceDetailsResp
                };
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, 'Invoice Details: (V6) ', returnValue);
            }

            return returnValue;
        },

        // MAIN FUNCTION //
        processXml: function (recordId, configObj) {
            var logTitle = [LogTitle, 'processXml'].join('::'),
                returnValue = [];

            LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';
            vc2_util.LogPrefix = LogPrefix;

            try {
                CURRENT.recordId = recordId;
                CURRENT.billConfig = configObj;

                vc2_util.log(logTitle, '############ INGRAM INTEGRATION: START ############');

                LibIngramAPI.getTokenCache();
                if (!CURRENT.accessToken) throw 'Unable to generate access token';

                // search for orders
                var invoiceOrders = this.processOrders();
                // var orderMiscCharges = this.processMiscCharges(invoiceOrders);

                vc2_util.log(logTitle, '** Processing invoice links: ', invoiceOrders.links.length);

                // process the invoice details
                var invoiceDetailsList = [];
                for (var i = 0, j = invoiceOrders.links.length; i < j; i++) {
                    var invoiceLink = invoiceOrders.links[i];

                    vc2_util.log(logTitle, '... invoice link: ', invoiceLink);

                    var invoiceDetail = this.processInvoiceDetails({ link: invoiceLink });

                    // if (!invoiceDetail || !invoiceDetail.data || !invoiceDetail.data.lines) {
                    // invoiceDetail = this.processInvoiceDetailsV6({ link: invoiceLink });
                    // }

                    if (!invoiceDetail || !invoiceDetail.data || !invoiceDetail.data.lines) {
                        vc2_util.log(logTitle, '... missing invoice details');
                        continue;
                    }

                    var invoiceData = invoiceDetail.data,
                        invoiceNum = invoiceData.invoice;

                    // check for any misc orders
                    // var miscCharges = orderMiscCharges[invoiceNum] || [];
                    // for (var ii = 0, jj = miscCharges.length; ii < jj; ii++) {
                    //     var miscCharge = miscCharges[ii];

                    //     if (miscCharge.description && miscCharge.description.match(/freight/gi)) {
                    //         invoiceData.charges.shipping += miscCharge.amount;
                    //     } else {
                    //         invoiceData.charges.other += miscCharge.amount;
                    //     }
                    // }

                    invoiceDetailsList.push({
                        ordObj: invoiceDetail.data,
                        xmlStr: JSON.stringify(invoiceDetail.source)
                    });
                }

                return invoiceDetailsList;

                // process misc charges
            } catch (error) {
                vc2_util.logError(logTitle, error);
                throw error;
            } finally {
                vc2_util.log(logTitle, '############ INGRAM INTEGRATION: END ############');
            }

            return returnValue;
        }
        // ============== //
    };
});
