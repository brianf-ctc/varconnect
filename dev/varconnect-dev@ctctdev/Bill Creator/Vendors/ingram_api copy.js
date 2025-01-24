/**
 * Copyright (c) 2025 Catalyst Tech Corp
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

    var PO_LOAD = {
        '60-DRQJ0-12':
            '{"serviceresponse":{"responsepreamble":{"responsestatus":"SUCCESS","statuscode":"200","responsemessage":"Invoice Found"},"invoicedetailresponse":{"invoicenumber":"DRQJ0-12","customerordernumber":"126074","totaltaxamount":"0","totalamount":"87329.58","shiptosuffix":null,"billtosuffix":"000","billto":{"name1":"AQUEDUCT TECHNOLOGIES INC","addressline1":"150 ROYALL ST","city":"CANTON","state":"MA","postalcode":"020211031","countrycode":"US"},"paymentterms":"600","orderdate":"2023-12-01","carrier":"GR","carrierdescription":"GRVL","discountamount":"0.00","enduserponumber":"10-CT254","freightforwardercode":null,"creditmemoreasoncode":null,"holdreason":null,"shipcomplete":null,"shipdate":"2023-12-26","companycurrency":"USD","currencycode":"USD","currencyrate":"1.000000","globalorderid":"60-DRQJ0-12","originalshipcode":null,"orderstatus":"I","shiptoaddress":{"attention":"EUGENE WOODS","name1":"INGRAM MICRO EXPRESS WAREHOUSING","addressline1":"12510 MICRO DR","addressline2":"PO# 10-CT254","city":"EASTVALE","state":"CA","postalcode":"917521024","countrycode":"US"},"totalsales":"87329.58","weight":"0.00","lines":[{"linenumber":"6","globallinenumber":"1","partnumber":"9BA946","vendorpartnumber":"ASF-CORE-TE-USERS","partdescription":"CISCO THOUSANDEYES             SVCS || IMPLEMENTATION SVC FOR USERS","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"1","backorderquantity":"1","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"5184.28","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || VIA:  NONE || VIA:  CUSTOMER-Default-Standard"}]},{"linenumber":"6","globallinenumber":"6","vendorpartnumber":null,"partdescription":"TRK#: Not Available || TRK#: NOTAVAILABLE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"0","backorderquantity":"0","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"0","unitofmeasure":null,"productextendedspecs":[{"attributename":"commenttext","attributevalue":"VIA:  FDEN-PARCEL-GROUND || TRK#: 640607195986 || TRK#: 640607196000"}]},{"linenumber":"7","globallinenumber":"2","partnumber":"9BA944","vendorpartnumber":"ASF-CORE-TE-UNITS","partdescription":"CISCO THOUSANDEYES             SVCS || IMPLEMENTATION SVC FOR UNITS","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"1","backorderquantity":"1","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"5184.28","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || VIA:  NONE"}]},{"linenumber":"8","globallinenumber":"8","partnumber":"8WD784","vendorpartnumber":"SVS-CDNA-T1-A3Y","partdescription":"3YR SOLUTION SUP FOR SW DNA    SVCS || ADVANTAGE CLOUD LICS T1","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"4","backorderquantity":"4","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"609.33","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:2023-10-29 2026-10-28 036MOS || VIA:  NONE"}]},{"linenumber":"9","globallinenumber":"9","partnumber":"8NC538","vendorpartnumber":"DNA-C-T1-A-3Y","partdescription":"3YR DNA ADVANTAGE CLD LICS UP  LICS || TO 100M AGGR 200M","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"4","backorderquantity":"4","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"0","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:2023-10-29 2026-10-28 036MOS || VIA:  NONE"}]},{"linenumber":"15","globallinenumber":"37","partnumber":"JF3704","vendorpartnumber":"CON-L1NOS-C8304T2X","partdescription":"NW RNW CXLVL1 8X5XNBDOS CISCO  DOWN || CATALYST C8300-1N1S-4T2X ROUTER","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"12","backorderquantity":"12","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"5215","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:                      036MOS || VIA:  NONE"}]},{"linenumber":"16","globallinenumber":"38","partnumber":"8NA728","vendorpartnumber":"C8300-1N1S-4T2X","partdescription":"CISCO CATALYST C8300-1N1S-4T2X PERP || ROUTER","shipfrombranch":"89","shippedquantity":"6","orderedquantity":"12","backorderquantity":"6","extendedprice":"37260.90","specialbidnumber":null,"ordersuffix":"12","unitprice":"6210.15","unitofmeasure":"EA","serialnumberdetails":[{"serialnumber":"FLM275110XC"},{"serialnumber":"FLM275110XG"},{"serialnumber":"FLM275110X7"},{"serialnumber":"FLM275110X9"}],"productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-003666230 DELAWARE LIFE INSURAN || MC#C || VIA:  CUSTOMER || RE 02 89-AKM20 016      6 1227 3122"}]},{"linenumber":"17","globallinenumber":"52","partnumber":"HW7113","vendorpartnumber":"CON-L14OS-C8304T2X","partdescription":"NW RNW CX LVL1 24X7X4OS CISCO  DOWN || CATALYST C8300-1N1S-4T2X ROUTER","shipfrombranch":"89","shippedquantity":"6","orderedquantity":"6","backorderquantity":"0","extendedprice":"50068.68","specialbidnumber":null,"ordersuffix":"12","unitprice":"8344.78","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:                      036MOS || VIA:  NONE"}]},{"linenumber":"17","globallinenumber":"17","vendorpartnumber":null,"partdescription":"RE 02 89-AKM20 017      6 1227 3122","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"0","backorderquantity":"0","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"0","unitofmeasure":null},{"linenumber":"18","globallinenumber":"53","partnumber":"8NA728","vendorpartnumber":"C8300-1N1S-4T2X","partdescription":"CISCO CATALYST C8300-1N1S-4T2X PERP || ROUTER","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"6","backorderquantity":"6","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"6210.15","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || VIA:  CUSTOMER || VIA:  FDEN-PARCEL-GROUND"}]},{"linenumber":"18","globallinenumber":"18","vendorpartnumber":null,"partdescription":"TRK#: 640607195986 || TRK#: 640607195975","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"0","backorderquantity":"0","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"0","unitofmeasure":null,"productextendedspecs":[{"attributename":"commenttext","attributevalue":"TRK#: 640607195997 || TRK#: 640607196000 || TRK#: 640607195964 || TRK#: 640607196011"}]},{"linenumber":"19","globallinenumber":"54","partnumber":"4T3915","vendorpartnumber":"GLC-TE","partdescription":"1000BASE-T SFP TRANSCEIVER MOD PERP || FOR CATEGORY 5 COPPER WIRE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"6","backorderquantity":"6","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"189.39","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || VIA:  CUSTOMER"}]},{"linenumber":"20","globallinenumber":"55","partnumber":"Q45379","vendorpartnumber":"SFP-10G-SR","partdescription":"10GBASESR SFP+ MODULE          PERP || EU#-004046111 DELAWARE LIFE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"4","backorderquantity":"4","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"378.36","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"MC#C || VIA:  CUSTOMER"}]},{"linenumber":"21","globallinenumber":"65","partnumber":"HW7106","vendorpartnumber":"CON-L14OS-C8500L8X","partdescription":"NW RNW CX LVL1 24X7X4OS CISCO  DOWN || CATALYST 8500 SERIES 4X SFP+ AND 8","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"2","backorderquantity":"2","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"14511.82","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:                      036MOS"}]},{"linenumber":"22","globallinenumber":"66","partnumber":"8WG949","vendorpartnumber":"C8500L-8S4X","partdescription":"CISCO CATALYST 8500 SERIES     PERP || 12PORT SFP+ 8X1GE 4X10GE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"2","backorderquantity":"2","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"13282.62","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || VIA:  CUSTOMER"}]},{"linenumber":"23","globallinenumber":"67","partnumber":"Q45379","vendorpartnumber":"SFP-10G-SR","partdescription":"10GBASESR SFP+ MODULE          PERP || EU#-004046111 DELAWARE LIFE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"8","backorderquantity":"8","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"378.36","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"MC#C || VIA:  CUSTOMER"}]},{"linenumber":"24","globallinenumber":"77","partnumber":"HW7115","vendorpartnumber":"CON-L14OS-C85012X5","partdescription":"NW RNW CX LVL1 24X7X4OS CISCO  DOWN || CATALYST 8500-12X EDGE PLATFORM","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"2","backorderquantity":"2","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"44098.19","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"EU#-004046111 DELAWARE LIFE || MC#C || TERMS:                      036MOS"}]},{"linenumber":"25","globallinenumber":"78","partnumber":"8NA975","vendorpartnumber":"C8500-12X","partdescription":"C8500-12X10GE SYST             PERP || EU#-004046111 DELAWARE LIFE","shipfrombranch":"89","shippedquantity":"0","orderedquantity":"2","backorderquantity":"2","extendedprice":"0.00","specialbidnumber":null,"ordersuffix":"12","unitprice":"38957.84","unitofmeasure":"EA","productextendedspecs":[{"attributename":"commenttext","attributevalue":"MC#C || VIA:  CUSTOMER"}]}],"extendedspecs":[{"attributename":"commenttext","attributevalue":"////ORDER COMMENTS"},{"attributename":"commenttext","attributevalue":"//DN-PROVISIONING"},{"attributename":"commenttext","attributevalue":"CONTACT: AQUEDUCTCSP@AQUEDUCTTECH.C"},{"attributename":"commenttext","attributevalue":"OM"},{"attributename":"commenttext","attributevalue":"SCOTT.WISHART@GROUP1001.COM"}]}}}'
    };

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

        var token = generateToken({
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

                var loadResponse = false;
                for (var invNum in PO_LOAD) {
                    var invNumRgx = new RegExp(invNum, 'i');

                    if (invoiceLink.match(invNumRgx)) {
                        loadResponse = vc2_util.safeParse(PO_LOAD[invNum]) || PO_LOAD[invNum];
                    }
                    vc2_util.log(logTitle, '// is matching??', [
                        invNum,
                        invoiceLink,
                        invNumRgx,
                        invoiceLink.match(invNumRgx),
                        !!loadResponse
                    ]);
                }

                var invoiceDetailsReq, invoiceDetailsResp;

                if (!loadResponse) {
                    invoiceDetailsReq = vc2_util.sendRequest({
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
                } else {
                    invoiceDetailsResp = loadResponse;
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
                        QUANTITY: vc2_util.forceInt(lineInfo.orderedquantity),
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

    // // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
