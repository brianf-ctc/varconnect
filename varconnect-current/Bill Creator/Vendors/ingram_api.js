/**
 * ingram_api.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define([
    'N/log',
    'N/https',
    '../Libraries/moment',
    '../Libraries/lodash',
    'N/search',
    'N/runtime'
], function (log, https, moment, lodash, search, runtime) {
    'use strict';

    function processXml(input, config) {
        //var config = JSON.parse(configStr)

        var tranNsid = input;

        log.debug('im: input', tranNsid);

        var findDocumentNumber = search.lookupFields({
            type: search.Type.PURCHASE_ORDER,
            id: tranNsid,
            columns: ['tranid']
        });

        var docNum = findDocumentNumber.tranid;

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var baseUrl = config.url;

        var authUrl = '/oauth/oauth20/token';

        //var url = 'https://api.ingrammicro.com:443/oauth/oauth20/token';

        log.debug('im: headers', input + ': ' + JSON.stringify(headers));

        var authBody = {
            grant_type: 'client_credentials',
            client_id: config.user_id,
            client_secret: config.user_pass
        };

        log.debug('im: authBody', input + ': ' + JSON.stringify(authBody));

        var lastCall = new Date().getTime();

        var authResponse = https.post({
            url: baseUrl + authUrl,
            headers: headers,
            body: convertToXWWW(authBody)
        });

        log.debug('im: authResponse', input + ': ' + JSON.stringify(authResponse));

        var authJson = JSON.parse(authResponse.body);

        log.debug('im: token', input + ': ' + authJson.access_token);

        var countryCode = 'US';
        if (runtime.country == 'CA') countryCode = 'CA';

        log.debug(
            'runtime.country',
            JSON.stringify([runtime.country, countryCode, runtime.country == 'CA'])
        );

        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
        headers['Authorization'] = 'Bearer ' + authJson.access_token;
        headers['IM-CustomerNumber'] = config.partner_id;
        headers['customerNumber'] = config.partner_id;
        headers['IM-CountryCode'] = countryCode;
        headers['IM-CorrelationID'] = tranNsid;

        //docNum = '81936560.0';

        var pageNum = 1,
            pageSize = 10,
            totalRecords = 0,
            pageComplete = false;
        var myArr = [];
        var imOrders = [],
            imOrderNums = [];

        while (!pageComplete) {
            var searchUrl =
                '/resellers/v6/orders/search?' +
                ['&customerNumber', config.partner_id].join('=') +
                ['&isoCountryCode', countryCode].join('=') +
                ['&customerOrderNumber', docNum].join('=') +
                ['&pageNumber', pageNum].join('=') +
                ['&pageSize', pageSize].join('=');

            log.debug('im: searchRequest url', baseUrl + searchUrl);

            sleep(lastCall, 1050);
            lastCall = new Date().getTime();

            var searchResponse = https.get({
                url: baseUrl + searchUrl,
                headers: headers
            });

            log.debug('im: searchResponse', input + ': ' + JSON.stringify(searchResponse.body));

            var searchBody = JSON.parse(searchResponse.body);

            if (searchResponse.code !== 200) {
                log.debug('im: ' + searchResponse.code, input + ': ' + 'No Records Returned');
                return myArr;
            }

            //      var searchOrders = searchBody.serviceresponse.ordesearchresponse.orders;
            var searchOrders = searchBody.orders;
            totalRecords = totalRecords + searchBody.pageSize;

            for (var i = 0; i < searchOrders.length; i++) {
                for (var s = 0; s < searchOrders[i].subOrders.length; s++) {
                    for (var l = 0; l < searchOrders[i].subOrders[s].links.length; l++) {
                        if (searchOrders[i].subOrders[s].links[l].topic == 'invoices') {
                            imOrders.push(searchOrders[i].subOrders[s].links[l].href);

                            imOrderNums.push(searchOrders[i].ingramOrderNumber);
                        }
                    }
                }
            }

            log.audit(
                'total records >>',
                JSON.stringify({
                    totalRecords: totalRecords,
                    pageSize: pageSize,
                    pageNum: pageNum,
                    recordsFound: searchBody.recordsFound
                })
            );

            if (totalRecords >= searchBody.recordsFound) {
                pageComplete = true;
                break;
            } else {
                pageNum++;
            }
        }

        log.debug('im: Orders', input + ': ' + JSON.stringify(imOrders));

        var orderMiscCharges = {};
        for (var ii = 0; ii < imOrderNums.length; ii++) {
            util.extend(
                orderMiscCharges,
                _getMiscCharges(config, authJson, countryCode, tranNsid, imOrderNums[ii])
            );
        }

        log.debug('im: orderMiscCharges', JSON.stringify(orderMiscCharges));

        for (var o = 0; o < imOrders.length; o++) {
            try {
                var invoiceUrl =
                    imOrders[o] +
                    '?customerNumber=' +
                    config.partner_id +
                    '&isoCountryCode=' +
                    countryCode;

                var invoiceResponse = https.get({
                    url: baseUrl + invoiceUrl,
                    headers: headers
                });

                var xmlObj = JSON.parse(invoiceResponse.body);
                log.debug('im: invoice response', input + ': ' + JSON.stringify(xmlObj));

                var myObj = {};
                myObj.po = docNum;

                var invDetail = xmlObj.serviceresponse.invoicedetailresponse;

                //			myObj.date = moment(invDetail.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY');
                //ingram always provides an orderdate value but doesn't alway provide an invoicedate key:value
                //using changed mapping to use orderdate instead.
                if (invDetail.hasOwnProperty('invoicedate')) {
                    myObj.date = moment(invDetail.invoicedate, 'YYYY-MM-DD').format('MM/DD/YYYY');
                } else {
                    // use the current date
                    myObj.date = moment().format('MM/DD/YYYY');
                }

                // myObj.invoice = invDetail.invoicenumber;
                // changed invoice mapping per request on 12/9/20
                //			myObj.invoice = invDetail.globalorderid;
                // changed back to globalorderid @bfeliciano 23Sept2021
                myObj.invoice = invDetail.globalorderid;
                myObj.total = invDetail.totalamount * 1;

                myObj.charges = {};

                myObj.charges.tax = invDetail.totaltaxamount * 1;
                myObj.charges.shipping =
                    invDetail.customerfreightamount * 1 + invDetail.customerforeignfrightamt * 1;

                myObj.charges.other = invDetail.discountamount * 1;

                // calculate the misc charges
                if (orderMiscCharges.hasOwnProperty(invDetail.globalorderid)) {
                    var miscCharge = orderMiscCharges[invDetail.globalorderid];

                    if (!myObj.charges.miscCharges) myObj.charges.miscCharges = [];
                    // if (!myObj.charges.hasOwnProperty('other')) {
                    //     myObj.charges.other = 0;
                    // }

                    for (ii = 0; ii < miscCharge.length; ii++) {
                        myObj.charges.miscCharges.push(miscCharge[ii]);
                        // myObj.charges.other += parseFloat(miscCharge[ii].amount);
                    }
                }

                // // applies only for: Aqueduct
                // if (invDetail.hasOwnProperty('weight')) {
                //     myObj.weight = invDetail.weight;
                //     if (parseFloat(myObj.weight) > 150) {
                //         myObj.charges.shipping = parseFloat(myObj.charges.shipping) + 2;
                //     }
                // }

                myObj.lines = [];

                for (var i = 0; i < invDetail.lines.length; i++) {
                    var item = invDetail.lines[i].vendorpartnumber;

                    if (!item || item == '' || item == null) {
                        continue;
                    }

                    var itemIdx = lodash.findIndex(myObj.lines, {
                        ITEMNO: item
                    });

                    if (itemIdx !== -1) {
                        myObj.lines[itemIdx].QUANTITY += invDetail.lines[i].shippedquantity * 1;
                    } else {
                        var lineObj = {};

                        lineObj.processed = false;
                        lineObj.ITEMNO = item;
                        lineObj.PRICE = invDetail.lines[i].unitprice * 1;
                        lineObj.QUANTITY = invDetail.lines[i].shippedquantity * 1;
                        lineObj.DESCRIPTION = invDetail.lines[i].partdescription;

                        myObj.lines.push(lineObj);
                    }
                }

                //return myObj;

                var returnObj = {};
                returnObj.ordObj = myObj;
                returnObj.xmlStr = xmlObj;
                myArr.push(returnObj);
            } catch (e) {
                log.error('Error parsing invoice', e);
            }
        }

        return myArr;
    }

    function _getMiscCharges(config, authJson, countryCode, tranNsid, imOrderNum) {
        var logTitle = 'getMiscCharges',
            returnValue = false,
            miscCharges;

        try {
            var orderStatusUrl = config.url + '/resellers/v6/orders/' + imOrderNum;

            var orderStatusResp = https.get({
                url: orderStatusUrl,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: 'Bearer ' + authJson.access_token,
                    'IM-CustomerNumber': config.partner_id,
                    customerNumber: config.partner_id,
                    'IM-CountryCode': countryCode,
                    'IM-CorrelationID': tranNsid
                }
            });

            // log.debug('im: miscCharges', '>> orderStatusResp: ' + JSON.stringify(orderStatusResp));
            var orderStatus = JSON.parse(orderStatusResp.body);

            // log.debug('im: miscCharges', '>> orderStatus: ' + JSON.stringify(orderStatus));
            if (orderStatus.hasOwnProperty('miscellaneousCharges')) {
                returnValue = {};

                for (var i = 0, j = orderStatus.miscellaneousCharges.length; i < j; i++) {
                    miscCharges = orderStatus.miscellaneousCharges[i];

                    log.debug('im: miscCharges', '>> miscCharges: ' + JSON.stringify(miscCharges));

                    if (!returnValue.hasOwnProperty(miscCharges.subOrderNumber)) {
                        returnValue[miscCharges.subOrderNumber] = [];
                    }

                    returnValue[miscCharges.subOrderNumber].push({
                        description: miscCharges.chargeDescription,
                        amount: miscCharges.chargeAmount
                    });
                }
            }

            log.debug('im: miscCharges', JSON.stringify(returnValue));
        } catch (error) {
            log.error('Error parsing order', JSON.stringify(error));
        }

        return returnValue;
    }

    function convertToXWWW(json) {
        //log.debug('convertToXWWW', JSON.stringify(json));
        if (typeof json !== 'object') {
            return null;
        }
        var u = encodeURIComponent;
        var urljson = '';
        var keys = Object.keys(json);
        for (var i = 0; i < keys.length; i++) {
            urljson += u(keys[i]) + '=' + u(json[keys[i]]);
            if (i < keys.length - 1) urljson += '&';
        }
        return urljson;
    }

    function sleep(startTime, milliseconds) {
        // add delay between API calls so that we
        // don't get hit by ingrams 60 calls per minute governance.

        https.get({
            url:
                'https://us-east4-rapid-booking-320617.cloudfunctions.net/netsuite-sleep-function?delay=' +
                milliseconds
        });

        // for (var i = 0; i < 1e7; i++) {
        //   if ((new Date().getTime() - startTime) > milliseconds){
        //     log.debug('slept for', (new Date().getTime() - startTime) + ' ms');
        //     log.debug('required', i + ' iterations');
        //     break;
        //   }
        // }
    }

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
