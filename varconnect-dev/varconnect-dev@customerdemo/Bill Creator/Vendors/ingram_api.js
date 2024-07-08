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
                var orderMiscCharges = this.processMiscCharges(invoiceOrders);

                vc2_util.log(logTitle, '** Processing invoice links: ', invoiceOrders.links.length);

                // process the invoice details
                var invoiceDetailsList = [];
                for (var i = 0, j = invoiceOrders.links.length; i < j; i++) {
                    var invoiceLink = invoiceOrders.links[i];

                    vc2_util.log(logTitle, '... invoice link: ', invoiceLink);

                    var invoiceDetail = {};
                    invoiceDetail = this.processInvoiceDetails({ link: invoiceLink });
                    
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
                    var miscCharges = orderMiscCharges[invoiceNum] || [];
                    for (var ii = 0, jj = miscCharges.length; ii < jj; ii++) {
                        var miscCharge = miscCharges[ii];

                        if (miscCharge.description && miscCharge.description.match(/freight/gi)) {
                            invoiceData.charges.shipping += miscCharge.amount;
                        } else {
                            invoiceData.charges.other += miscCharge.amount;
                        }
                    }

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

    // function processXml(recordId, config) {
    //     var logTitle = [LogTitle, 'processXml'].join('::'),
    //         returnValue;

    //     LogPrefix = '[' + [ns_search.Type.PURCHASE_ORDER, recordId].join(':') + '] ';
    //     vc2_util.LogPrefix = LogPrefix;

    //     vc2_util.log(logTitle, '>> current: ', [recordId, config]);

    //     // var recordData = vc2_util.flatLookup({
    //     //     type: ns_search.Type.PURCHASE_ORDER,
    //     //     id: recordId,
    //     //     columns: ['tranid', 'subsidiary']
    //     // });

    //     var token = getTokenCache({
    //         recordId: recordId,
    //         config: config,
    //         tranId: config.poNum
    //     });
    //     vc2_util.log(logTitle, '>> access token: ', token);

    //     var orderDetails = getOrderDetails({
    //         config: config,
    //         recordId: recordId,
    //         token: token
    //         // recordData: recordData
    //     });
    //     vc2_util.log(logTitle, '>> orderDetails: ', orderDetails);

    //     var invoiceDetails = getInvoiceDetails({
    //         config: config,
    //         recordId: recordId,
    //         token: token,
    //         // recordData: recordData,
    //         invoiceLinks: orderDetails.invoiceLinks,
    //         orderNumbers: orderDetails.orderNumbers
    //     });

    //     vc2_util.log(logTitle, '>> invoiceDetails: ', invoiceDetails);

    //     var invoiceDetailsV6 = getInvoiceDetailsV6({
    //         config: config,
    //         recordId: recordId,
    //         token: token,
    //         // recordData: recordData,
    //         invoiceLinks: orderDetails.invoiceLinks,
    //         orderNumbers: orderDetails.orderNumbers
    //     });

    //     vc2_util.log(logTitle, '>> invoiceDetailsV6: ', invoiceDetailsV6);

    //     var arrInvoices = [];

    //     for (var orderKey in invoiceDetails) {
    //         vc2_util.log(logTitle, '>> invoice Id: ', orderKey);

    //         var invoiceData = invoiceDetails[orderKey];

    //         // check for misc charges
    //         if (orderDetails.miscCharges && orderDetails.miscCharges[orderKey]) {
    //             vc2_util.log(logTitle, '>> misc charge: ', orderDetails.miscCharges[orderKey]);

    //             invoiceData.xmlStr = JSON.stringify({
    //                 invoiceDetails: JSON.parse(invoiceData.xmlStr),
    //                 miscCharges: orderDetails.miscCharges[orderKey]
    //             });

    //             // add the misc charges ///
    //             for (var ii = 0, jj = orderDetails.miscCharges[orderKey].length; ii < jj; ii++) {
    //                 var chargeInfo = orderDetails.miscCharges[orderKey][ii];

    //                 if (chargeInfo.description) {
    //                     if (chargeInfo.description.match(/freight/gi)) {
    //                         // add it to as shipping charge
    //                         invoiceData.ordObj.charges.shipping += vc2_util.parseFloat(
    //                             chargeInfo.amount
    //                         );
    //                     } else {
    //                         invoiceData.ordObj.charges.other += vc2_util.parseFloat(
    //                             chargeInfo.amount
    //                         );
    //                     }
    //                 } else {
    //                     invoiceData.ordObj.charges.other += vc2_util.parseFloat(chargeInfo.amount);
    //                 }
    //             }
    //         }

    //         vc2_util.log(logTitle, '>> invoiceData: ', invoiceData);

    //         arrInvoices.push(invoiceData);
    //     }

    //     return arrInvoices;
    // }

    // function getOrderDetails(option) {
    //     var logTitle = [LogTitle, 'getOrderDetails'].join('::'),
    //         returnValue = {};

    //     var config = option.config,
    //         // recordData = option.recordData,
    //         token = option.token,
    //         recordId = option.recordId;

    //     var arrInvoiceLinks = [],
    //         arrOrderNums = [],
    //         orderMiscCharges;

    //     try {
    //         var pageNum = 1,
    //             pageSize = 10,
    //             recordsCount = 0,
    //             pageComplete = false;

    //         while (!pageComplete) {
    //             var searchUrl =
    //                 '/resellers/v6/orders/search?' +
    //                 vc2_util.convertToQuery({
    //                     customerNumber: config.partner_id,
    //                     isoCountryCode: config.country,
    //                     customerOrderNumber: config.poNum,
    //                     pageNumber: pageNum,
    //                     pageSize: pageSize
    //                 });
    //             searchUrl = config.url + searchUrl;
    //             vc2_util.log(logTitle, '>> searchUrl: ', searchUrl);

    //             // send the request
    //             var searchOrderReq = vc2_util.sendRequest({
    //                 header: [LogTitle, 'OrderSearch'].join(' '),
    //                 method: 'get',
    //                 recordId: recordId,
    //                 query: {
    //                     url: searchUrl,
    //                     headers: {
    //                         'Content-Type': 'application/json',
    //                         Accept: 'application/json',
    //                         Authorization: 'Bearer ' + token,
    //                         'IM-CustomerNumber': config.partner_id,
    //                         customerNumber: config.partner_id,
    //                         'IM-CountryCode': config.country,
    //                         'IM-CorrelationID': config.poNum
    //                     }
    //                 }
    //             });
    //             vc2_util.handleJSONResponse(searchOrderReq);

    //             var searchOrderResp =
    //                 searchOrderReq.PARSED_RESPONSE || searchOrderReq.RESPONSE || {};

    //             if (searchOrderReq.isError || vc2_util.isEmpty(searchOrderResp)) {
    //                 throw (
    //                     searchOrderReq.errorMsg +
    //                     (searchOrderReq.details
    //                         ? '\n' + JSON.stringify(searchOrderReq.details)
    //                         : '')
    //                 );
    //             }

    //             if (!searchOrderResp.recordsFound) {
    //                 vc2_util.log(logTitle, '!! No records found !!');

    //                 break;
    //             }

    //             var ordersResults = searchOrderResp.orders;
    //             recordsCount = recordsCount + (searchOrderResp.pageSize || 0);

    //             vc2_util.log(logTitle, '>> ', {
    //                 recordsCount: recordsCount,
    //                 recordsFound: searchOrderResp.recordsFound,
    //                 totalOrders: ordersResults.length,
    //                 currentPage: pageNum
    //             });

    //             if (vc2_util.isEmpty(ordersResults)) break;

    //             for (var i = 0, j = ordersResults.length; i < j; i++) {
    //                 var orderInfo = ordersResults[i];
    //                 vc2_util.log(logTitle, '..processing order: ', orderInfo.customerOrderNumber);

    //                 //skip not exact match
    //                 if (
    //                     !orderInfo ||
    //                     !orderInfo.customerOrderNumber ||
    //                     orderInfo.customerOrderNumber !== config.poNum
    //                 ) {
    //                     vc2_util.log(logTitle, '.....skipping order: ');
    //                     continue;
    //                 }

    //                 for (var ii = 0, jj = orderInfo.subOrders.length; ii < jj; ii++) {
    //                     var subOrderInfo = orderInfo.subOrders[ii];

    //                     // auto skip cancelled orders
    //                     if (
    //                         subOrderInfo.subOrderStatus &&
    //                         vc2_util.inArray(subOrderInfo.subOrderStatus.toUpperCase(), [
    //                             'CANCELLED'
    //                         ])
    //                     ) {
    //                         continue;
    //                     }

    //                     for (var iii = 0, jjj = subOrderInfo.links.length; iii < jjj; iii++) {
    //                         var subOrderLink = subOrderInfo.links[iii];

    //                         if (!subOrderLink.topic || subOrderLink.topic != 'invoices') continue;

    //                         arrInvoiceLinks.push(subOrderLink.href);
    //                         arrOrderNums.push(orderInfo.ingramOrderNumber);
    //                     }
    //                 }
    //             }

    //             // get the
    //             if (recordsCount >= searchOrderResp.recordsFound) {
    //                 pageComplete = true;
    //                 break;
    //             } else {
    //                 pageNum++;
    //                 vc2_util.waitMs(500);
    //             }
    //         }

    //         vc2_util.log(logTitle, '>> Invoice Links: ', arrInvoiceLinks);
    //         vc2_util.log(logTitle, '>> Order Numbers: ', arrOrderNums);

    //         arrInvoiceLinks = vc2_util.uniqueArray(arrInvoiceLinks);
    //         arrOrderNums = vc2_util.uniqueArray(arrOrderNums);

    //         vc2_util.log(logTitle, '>> Prep to fetch miscellaneous charges.... ');

    //         orderMiscCharges = getMiscCharges(
    //             util.extend(option, {
    //                 invoiceLinks: arrInvoiceLinks,
    //                 orderNums: arrOrderNums
    //             })
    //         );

    //         vc2_util.log(logTitle, '>> misc charges: ', orderMiscCharges);
    //     } catch (error) {
    //         vc2_util.logError(logTitle, error);
    //     } finally {
    //         returnValue = {
    //             invoiceLinks: arrInvoiceLinks || [],
    //             orderNumbers: arrOrderNums || [],
    //             miscCharges: orderMiscCharges
    //         };
    //     }

    //     return returnValue;
    // }

    // function getMiscCharges(option) {
    //     var logTitle = [LogTitle, 'getMiscCharges'].join('::'),
    //         returnValue = {};

    //     vc2_util.log(logTitle, '>> option: ', option);

    //     var config = option.config,
    //         // recordData = option.recordData,
    //         token = option.token,
    //         recordId = option.recordId;

    //     var objMischCharges = {};

    //     try {
    //         if (vc2_util.isEmpty(option.orderNums)) throw 'Missing purchase order numbers';
    //         for (var i = 0, j = option.orderNums.length; i < j; i++) {
    //             var orderNum = option.orderNums[i];

    //             var orderDetailsReq = vc2_util.sendRequest({
    //                 header: [LogTitle, 'Misc Charge'].join(' '),
    //                 method: 'get',
    //                 recordId: recordId,
    //                 query: {
    //                     url: config.url + '/resellers/v6/orders/' + orderNum,
    //                     headers: {
    //                         'Content-Type': 'application/json',
    //                         Accept: 'application/json',
    //                         Authorization: 'Bearer ' + token,
    //                         'IM-CustomerNumber': config.partner_id,
    //                         customerNumber: config.partner_id,
    //                         'IM-CountryCode': config.country,
    //                         'IM-CorrelationID': config.poNum
    //                     }
    //                 }
    //             });
    //             vc2_util.handleJSONResponse(orderDetailsReq);

    //             var orderDetailsResp =
    //                 orderDetailsReq.PARSED_RESPONSE || orderDetailsReq.RESPONSE || {};

    //             if (orderDetailsReq.isError || vc2_util.isEmpty(orderDetailsReq)) {
    //                 throw (
    //                     orderDetailsReq.errorMsg +
    //                     (orderDetailsReq.details
    //                         ? '\n' + JSON.stringify(orderDetailsReq.details)
    //                         : '')
    //                 );
    //             }

    //             if (!orderDetailsResp.hasOwnProperty('miscellaneousCharges')) continue;

    //             for (var ii = 0, jj = orderDetailsResp.miscellaneousCharges.length; ii < jj; ii++) {
    //                 var chargeInfo = orderDetailsResp.miscellaneousCharges[ii];
    //                 vc2_util.log(logTitle, '>> chargeInfo: ', chargeInfo);

    //                 if (!chargeInfo.subOrderNumber) continue;
    //                 if (!objMischCharges[chargeInfo.subOrderNumber])
    //                     objMischCharges[chargeInfo.subOrderNumber] = [];

    //                 objMischCharges[chargeInfo.subOrderNumber].push({
    //                     description: chargeInfo.chargeDescription,
    //                     amount: vc2_util.forceFloat(chargeInfo.chargeAmount)
    //                 });
    //             }

    //             vc2_util.waitMs(500);
    //         }
    //     } catch (error) {
    //         vc2_util.logError(logTitle, error);
    //     } finally {
    //         returnValue = objMischCharges;
    //     }

    //     return returnValue;
    // }

    // function getInvoiceDetails(option) {
    //     var logTitle = [LogTitle, 'getInvoiceDetails'].join('::'),
    //         returnValue = {};

    //     vc2_util.log(logTitle, '>> option: ', option);

    //     var config = option.config,
    //         // recordData = option.recordData,
    //         token = option.token,
    //         recordId = option.recordId;

    //     var objInvoiceDetails = {};

    //     try {
    //         if (vc2_util.isEmpty(option.invoiceLinks)) throw 'Missing invoice links';

    //         for (var i = 0, j = option.invoiceLinks.length; i < j; i++) {
    //             var invoiceLink = option.invoiceLinks[i];

    //             if (invoiceLink.match(/v6\/invoices/gi)) {
    //                 invoiceLink = invoiceLink.replace(/v6\/invoices/gi, 'v5/invoices');
    //             }
    //             log.audit(logTitle, '// invoiceLink: ' + invoiceLink);

    //             var invoiceDetailsReq = vc2_util.sendRequest({
    //                 header: [LogTitle, 'Invoice Details'].join(' '),
    //                 recordId: recordId,
    //                 query: {
    //                     url:
    //                         config.url +
    //                         invoiceLink +
    //                         ('?customerNumber=' + config.partner_id) +
    //                         ('&isoCountryCode=' + config.country),
    //                     headers: {
    //                         'Content-Type': 'application/json',
    //                         Accept: '*/*',
    //                         Authorization: 'Bearer ' + token,
    //                         'IM-CustomerNumber': config.partner_id,
    //                         // customerNumber: config.partner_id,
    //                         'IM-CountryCode': config.country,
    //                         'IM-CorrelationID': config.poNum,
    //                         'IM-ApplicationID': ns_runtime.accountId
    //                     }
    //                 }
    //             });
    //             vc2_util.handleJSONResponse(invoiceDetailsReq);
    //             vc2_util.log(logTitle, '>> response 2: ', invoiceDetailsReq.PARSED_RESPONSE);

    //             var invoiceDetailsResp =
    //                 invoiceDetailsReq.PARSED_RESPONSE || invoiceDetailsReq.RESPONSE || {};

    //             if (invoiceDetailsReq.isError || vc2_util.isEmpty(invoiceDetailsResp)) {
    //                 throw (
    //                     invoiceDetailsReq.errorMsg +
    //                     (invoiceDetailsReq.details
    //                         ? '\n' + JSON.stringify(invoiceDetailsReq.details)
    //                         : '')
    //                 );
    //             }

    //             if (
    //                 !invoiceDetailsResp.serviceresponse ||
    //                 !invoiceDetailsResp.serviceresponse.invoicedetailresponse
    //             )
    //                 continue;

    //             var invoiceInfo = invoiceDetailsResp.serviceresponse.invoicedetailresponse,
    //                 invoiceData = {
    //                     po: config.poNum,
    //                     date: invoiceInfo.hasOwnProperty('invoicedate')
    //                         ? moment(invoiceInfo.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY')
    //                         : moment().format('MM/DD/YYYY'),
    //                     invoice: invoiceInfo.globalorderid,
    //                     total: vc2_util.parseFloat(invoiceInfo.totalamount),
    //                     charges: {
    //                         tax: vc2_util.parseFloat(invoiceInfo.totaltaxamount),
    //                         shipping:
    //                             vc2_util.parseFloat(invoiceInfo.customerfreightamount) +
    //                             vc2_util.parseFloat(invoiceInfo.customerforeignfrightamt),
    //                         other: vc2_util.parseFloat(invoiceInfo.discountamount)
    //                     },
    //                     carrier: invoiceInfo.carrier || '',
    //                     shipDate: invoiceInfo.hasOwnProperty('shipdate')
    //                         ? moment(invoiceInfo.shipdate, 'YYYY-MM-DD').format('MM/DD/YYYY')
    //                         : 'NA',
    //                     lines: []
    //                 };

    //             vc2_util.log(logTitle, '>> Invoice Data (initial): ', invoiceData);
    //             vc2_util.log(
    //                 logTitle,
    //                 '>> Processing lines: ',
    //                 invoiceInfo && invoiceInfo.lines ? invoiceInfo.lines.length : 0
    //             );

    //             for (
    //                 var ii = 0, jj = invoiceInfo.lines ? invoiceInfo.lines.length : 0;
    //                 ii < jj;
    //                 ii++
    //             ) {
    //                 var lineInfo = invoiceInfo.lines[ii];
    //                 vc2_util.log(logTitle, '>> ...Line Info: ', lineInfo);

    //                 // if (vc2_util.isEmpty(lineInfo.vendorpartnumber)) continue;

    //                 var lineData = {
    //                     ITEMNO: lineInfo.vendorpartnumber || lineInfo.partnumber,
    //                     SKU: lineInfo.ingramPartNumber,
    //                     PRICE: vc2_util.parseFloat(lineInfo.unitprice),
    //                     QUANTITY: vc2_util.forceInt(lineInfo.shippedquantity),
    //                     DESCRIPTION: lineInfo.partdescription
    //                 };

    //                 var lineSerials = [];
    //                 // get the serial numbers
    //                 if (lineInfo.hasOwnProperty('serialnumberdetails')) {
    //                     lineInfo.serialnumberdetails.forEach(function (serial) {
    //                         if (serial.serialnumber) lineSerials.push(serial.serialnumber);
    //                         return true;
    //                     });
    //                     lineData.SERIAL = lineSerials;
    //                 }

    //                 var listTracking = [];
    //                 if (lineInfo.hasOwnProperty('trackingnumberdetails')) {
    //                     lineInfo.trackingnumberdetails.forEach(function (tracking) {
    //                         if (tracking.trackingnumber) listTracking.push(tracking.trackingnumber);
    //                         return true;
    //                     });
    //                     lineData.TRACKING = listTracking;
    //                 }

    //                 // look for the item
    //                 var lineIdx = lodash.findIndex(invoiceData.lines, {
    //                     ITEMNO: lineData.ITEMNO
    //                 });
    //                 vc2_util.log(logTitle, '>> ...lineIdx: ', lineIdx);

    //                 var lineItemRate = lodash.findIndex(invoiceData.lines, {
    //                     ITEMNO: lineData.ITEMNO,
    //                     PRICE: vc2_util.parseFloat(lineInfo.unitprice)
    //                 });

    //                 vc2_util.log(logTitle, '>> ...lineItemRate: ', lineItemRate);

    //                 if (lineItemRate >= 0) {
    //                     // increment the quantity
    //                     invoiceData.lines[lineIdx].QUANTITY += lineData.QUANTITY;

    //                     if (!vc2_util.isEmpty(lineData.SERIAL)) {
    //                         if (!invoiceData.lines[lineIdx].SERIAL)
    //                             invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL;
    //                         else
    //                             invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL.concat(
    //                                 invoiceData.lines[lineIdx].SERIAL
    //                             );
    //                         // trim unique serials
    //                         invoiceData.lines[lineIdx].SERIAL = vc2_util.uniqueArray(
    //                             invoiceData.lines[lineIdx].SERIAL
    //                         );
    //                     }

    //                     if (!vc2_util.isEmpty(lineData.TRACKING)) {
    //                         if (!invoiceData.lines[lineIdx].TRACKING)
    //                             invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING;
    //                         else
    //                             invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING.concat(
    //                                 invoiceData.lines[lineIdx].TRACKING
    //                             );
    //                         // trim unique tracking
    //                         invoiceData.lines[lineIdx].TRACKING = vc2_util.uniqueArray(
    //                             invoiceData.lines[lineIdx].TRACKING
    //                         );
    //                     }
    //                 } else {
    //                     invoiceData.lines.push(lineData);
    //                 }
    //             }
    //             vc2_util.log(logTitle, '>> Invoice Data: ', invoiceData);

    //             objInvoiceDetails[invoiceData.invoice] = {
    //                 ordObj: invoiceData,
    //                 xmlStr: JSON.stringify(invoiceDetailsResp)
    //             };

    //             // vc_util.waitMs(500);
    //         }
    //     } catch (error) {
    //         vc2_util.log(logTitle, '## ERROR ##', error);
    //     } finally {
    //         returnValue = objInvoiceDetails;
    //     }

    //     return returnValue;
    // }

    // function getInvoiceDetailsV6(option) {
    //     var logTitle = [LogTitle, 'getInvoiceDetails'].join('::'),
    //         returnValue = {};

    //     vc2_util.log(logTitle, '>> option: ', option);

    //     var config = option.config,
    //         // recordData = option.recordData,
    //         token = option.token,
    //         recordId = option.recordId;

    //     var objInvoiceDetails = {};

    //     try {
    //         if (vc2_util.isEmpty(option.invoiceLinks)) throw 'Missing invoice links';

    //         for (var i = 0, j = option.invoiceLinks.length; i < j; i++) {
    //             var invoiceLink = option.invoiceLinks[i];

    //             var invoiceDetailsReq = vc2_util.sendRequest({
    //                 header: [LogTitle, 'Invoice Details'].join(' '),
    //                 recordId: recordId,
    //                 query: {
    //                     url:
    //                         config.url +
    //                         invoiceLink +
    //                         ('?customerNumber=' + config.partner_id) +
    //                         ('&isoCountryCode=' + config.country),
    //                     headers: {
    //                         'Content-Type': 'application/json',
    //                         Accept: '*/*',
    //                         Authorization: 'Bearer ' + token,
    //                         'IM-CustomerNumber': config.partner_id,
    //                         // customerNumber: config.partner_id,
    //                         'IM-CountryCode': config.country,
    //                         'IM-CorrelationID': config.poNum,
    //                         'IM-ApplicationID': ns_runtime.accountId
    //                     }
    //                 }
    //             });
    //             vc2_util.handleJSONResponse(invoiceDetailsReq);
    //             vc2_util.log(logTitle, '>> response 2: ', invoiceDetailsReq.PARSED_RESPONSE);

    //             var invoiceInfo =
    //                 invoiceDetailsReq.PARSED_RESPONSE || invoiceDetailsReq.RESPONSE || {};

    //             if (invoiceDetailsReq.isError || vc2_util.isEmpty(invoiceInfo)) {
    //                 throw (
    //                     invoiceDetailsReq.errorMsg +
    //                     (invoiceDetailsReq.details
    //                         ? '\n' + JSON.stringify(invoiceDetailsReq.details)
    //                         : '')
    //                 );
    //             }

    //             // skip if there are lines
    //             if (!invoiceInfo.Lines || !invoiceInfo.Lines.length) continue;

    //             var invoiceInfo = invoiceInfo.serviceresponse.invoicedetailresponse,
    //                 invoiceSummary = invoiceInfo.Summary || {},
    //                 invoiceTotals = invoiceSummary.Totals || {},
    //                 invoiceData = {
    //                     po: config.poNum,
    //                     date: invoiceInfo.hasOwnProperty('InvoiceDate')
    //                         ? moment(invoiceInfo.InvoiceDate, 'YYYY-MM-DD').format('MM/DD/YYYY')
    //                         : moment().format('MM/DD/YYYY'),
    //                     invoice: invoiceInfo.InvoiceNumber,
    //                     total: vc2_util.parseFloat(invoiceTotals.InvoicedAmountDue),
    //                     charges: {
    //                         tax: vc2_util.parseFloat(invoiceTotals.TotalTaxAmount),
    //                         shipping: vc2_util.parseFloat(invoiceTotals.freightAmount),
    //                         other: vc2_util.parseFloat(invoiceTotals.DiscountAmount)
    //                     },
    //                     // carrier: invoiceInfo.carrier || '',
    //                     // shipDate: invoiceInfo.hasOwnProperty('shipdate')
    //                     //     ? moment(invoiceInfo.shipdate, 'YYYY-MM-DD').format('MM/DD/YYYY')
    //                     //     : 'NA',
    //                     lines: []
    //                 };

    //             vc2_util.log(logTitle, '>> Invoice Data (initial): ', invoiceData);
    //             vc2_util.log(
    //                 logTitle,
    //                 '>> Processing lines: ',
    //                 invoiceInfo && invoiceInfo.Lines ? invoiceInfo.Lines.length : 0
    //             );

    //             for (
    //                 var ii = 0, jj = invoiceInfo.Lines ? invoiceInfo.Lines.length : 0;
    //                 ii < jj;
    //                 ii++
    //             ) {
    //                 var lineInfo = invoiceInfo.Lines[ii];
    //                 vc2_util.log(logTitle, '>> ...Line Info: ', lineInfo);

    //                 // if (vc2_util.isEmpty(lineInfo.vendorpartnumber)) continue;

    //                 var lineData = {
    //                     ITEMNO: lineInfo.vendorpartnumber || lineInfo.partnumber,
    //                     SKU: lineInfo.ingramPartNumber,
    //                     PRICE: vc2_util.parseFloat(lineInfo.unitprice),
    //                     QUANTITY: vc2_util.forceInt(lineInfo.shippedquantity),
    //                     DESCRIPTION: lineInfo.partdescription
    //                 };

    //                 var lineSerials = [];
    //                 // get the serial numbers
    //                 if (lineInfo.hasOwnProperty('serialnumberdetails')) {
    //                     lineInfo.serialnumberdetails.forEach(function (serial) {
    //                         if (serial.serialnumber) lineSerials.push(serial.serialnumber);
    //                         return true;
    //                     });
    //                     lineData.SERIAL = lineSerials;
    //                 }

    //                 var listTracking = [];
    //                 if (lineInfo.hasOwnProperty('trackingnumberdetails')) {
    //                     lineInfo.trackingnumberdetails.forEach(function (tracking) {
    //                         if (tracking.trackingnumber) listTracking.push(tracking.trackingnumber);
    //                         return true;
    //                     });
    //                     lineData.TRACKING = listTracking;
    //                 }

    //                 // look for the item
    //                 var lineIdx = lodash.findIndex(invoiceData.lines, {
    //                     ITEMNO: lineData.ITEMNO
    //                 });
    //                 vc2_util.log(logTitle, '>> ...lineIdx: ', lineIdx);

    //                 var lineItemRate = lodash.findIndex(invoiceData.lines, {
    //                     ITEMNO: lineData.ITEMNO,
    //                     PRICE: vc2_util.parseFloat(lineInfo.unitprice)
    //                 });

    //                 vc2_util.log(logTitle, '>> ...lineItemRate: ', lineItemRate);

    //                 if (lineItemRate >= 0) {
    //                     // increment the quantity
    //                     invoiceData.lines[lineIdx].QUANTITY += lineData.QUANTITY;

    //                     if (!vc2_util.isEmpty(lineData.SERIAL)) {
    //                         if (!invoiceData.lines[lineIdx].SERIAL)
    //                             invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL;
    //                         else
    //                             invoiceData.lines[lineIdx].SERIAL = lineData.SERIAL.concat(
    //                                 invoiceData.lines[lineIdx].SERIAL
    //                             );
    //                         // trim unique serials
    //                         invoiceData.lines[lineIdx].SERIAL = vc2_util.uniqueArray(
    //                             invoiceData.lines[lineIdx].SERIAL
    //                         );
    //                     }

    //                     if (!vc2_util.isEmpty(lineData.TRACKING)) {
    //                         if (!invoiceData.lines[lineIdx].TRACKING)
    //                             invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING;
    //                         else
    //                             invoiceData.lines[lineIdx].TRACKING = lineData.TRACKING.concat(
    //                                 invoiceData.lines[lineIdx].TRACKING
    //                             );
    //                         // trim unique tracking
    //                         invoiceData.lines[lineIdx].TRACKING = vc2_util.uniqueArray(
    //                             invoiceData.lines[lineIdx].TRACKING
    //                         );
    //                     }
    //                 } else {
    //                     invoiceData.lines.push(lineData);
    //                 }
    //             }
    //             vc2_util.log(logTitle, '>> Invoice Data: ', invoiceData);

    //             objInvoiceDetails[invoiceData.invoice] = {
    //                 ordObj: invoiceData,
    //                 xmlStr: JSON.stringify(invoiceInfo)
    //             };

    //             // vc_util.waitMs(500);
    //         }
    //     } catch (error) {
    //         vc2_util.log(logTitle, '## ERROR ##', error);
    //     } finally {
    //         returnValue = objInvoiceDetails;
    //     }

    //     return returnValue;
    // }

    // function generateToken(option) {
    //     var logTitle = [LogTitle, 'generateToken'].join('::');

    //     var tokenReq = vc2_util.sendRequest({
    //         header: [LogTitle, 'GenerateToken'].join(' '),
    //         method: 'post',
    //         recordId: option.recordId,
    //         doRetry: true,
    //         maxRetry: 3,
    //         query: {
    //             url: option.config.url + '/oauth/oauth30/token',
    //             body: vc2_util.convertToQuery({
    //                 grant_type: 'client_credentials',
    //                 client_id: option.config.user_id,
    //                 client_secret: option.config.user_pass
    //             }),
    //             headers: {
    //                 'Content-Type': 'application/x-www-form-urlencoded'
    //             }
    //         }
    //     });
    //     vc2_util.handleJSONResponse(tokenReq);

    //     var tokenResp = tokenReq.PARSED_RESPONSE;
    //     if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

    //     return tokenResp.access_token;
    // }

    // function getTokenCache(option) {
    //     var extraParams = vc2_util.extractValues({
    //         source: option.config,
    //         params: ['id', 'subsidiary', 'entry_function', 'partner_id']
    //     });
    //     var cacheKey = 'INGRAM_TOKEN-' + vc2_util.convertToQuery(extraParams),
    //         token = vc2_util.getNSCache({ key: cacheKey });

    //     vc2_util.log(LogTitle, '// cacheKey: ', cacheKey);

    //     if (vc2_util.isEmpty(token)) token = generateToken(option);

    //     if (!vc2_util.isEmpty(token)) {
    //         vc2_util.setNSCache({
    //             key: cacheKey,
    //             cacheTTL: 14400,
    //             value: token
    //         });
    //         CURRENT.accessToken = token;
    //     }
    //     return token;
    // }

    // // // Add the return statement that identifies the entry point function.
    // return {
    //     processXml: processXml
    // };
});
