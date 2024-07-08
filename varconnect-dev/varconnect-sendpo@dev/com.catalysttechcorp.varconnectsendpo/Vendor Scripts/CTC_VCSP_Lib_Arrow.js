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
 * @description Library File for Arrow PO Creation
 */

/**
 * Project Number:
 * Script Name: CTC VCSP Lib Arrow
 * Author: john.ramonel
 */
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/log',
    'N/https',
    '../VO/CTC_VCSP_Response',
    '../Library/CTC_VCSP_Lib_Log',
    '../Library/CTC_VCSP_Constants'
], function (search, record, runtime, log, https, response, vcLog, constants) {
    'use strict';

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns string
     **/
    function generateToken(obj) {
        if (!obj) var obj = {};
        //obj.apiKey = '8e88d6d7-5f9d-4614-9f10-28a6f725c69d';
        //obj.apiSecret = '4a95b3a7-02c3-4be7-9761-9e8ee12d2957';
        obj.grantType = 'client_credentials';
        //obj.accessEndPoint = 'https://qaecsoag.arrow.com/api/oauth/token';

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        var jsonBody = {
            client_id: obj.apiKey,
            client_secret: obj.apiSecret,
            grant_type: obj.grantType
        };

        var body = convertToXWWW(jsonBody);

        var response = https.post({
            url: obj.accessEndPoint,
            body: body,
            headers: headers
        });

        if (response) {
            var responseBody = JSON.parse(response.body);

            log.debug({
                title: 'Response Body',
                details: response.body
            });

            if (response.code == 200) {
                log.debug({
                    title: 'Token Generated',
                    details: responseBody.access_token
                });
                return responseBody.access_token;
            } else {
                // retry 1 more time
                var response = https.post({
                    url: obj.url,
                    body: body,
                    headers: headers
                });
                if (response.code == 200) {
                    log.debug({
                        title: 'Token Generated',
                        details: responseBody.access_token
                    });
                    return responseBody.access_token;
                } else {
                    log.error({
                        title: 'generateToken Failure',
                        details: response
                    });
                    return null;
                }
            }
        }
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object}
     * @description obj.poObj = contains the Actual PO obj from NetSuite, obj.vendorConfig = VAR Connect Vendor Config Fields
     * @returns object
     **/
    function generateRequest(obj) {
        var reqBody = {};
        var poDetails = {};
        var soldTo = {};
        var billTo = {};
        var shipTo = {};
        var endUser = {};
        var poLines = []; // array of poLine objects
        var poObj = obj.poObj; // NS Purchase Order Obj
        var vendorConfig = obj.vendorConfig;

        log.emergency({ title: 'generateRequest', details: obj });

        // Header Rec Object
        var headerRec = {};
        headerRec.TransactionType = 'RESELLER_PO_CREATE'; // constant
        headerRec.SourceTransactionKeyID = null;
        headerRec.RequestTimestamp = null;
        headerRec.Region = 'NORTH_AMERICAS'; // constant
        headerRec.Country = 'US'; // constant
        headerRec.PartnerID = vendorConfig.customerNo;

        // PO Details Object
        //var poTypeObj = formatArrowPOType(poObj.getValue({fieldId: 'custbody_ctc_po_link_type'}));
        poDetails.CustPoNumber = poObj.tranId;
        poDetails.TotalPOPrice = poObj.total;
        poDetails.Comments = poObj.memo || null;
        poDetails.PoDate = formatArrowDate(poObj.trandate);
        poDetails.CustPoType = 'DS'; // Constant -- values are DS for Dropship, SA for standard
        poDetails.FobCode = 'ORIGIN'; // constant -- values are ORIGIN for Dropship, DESTINATION for standard
        poDetails.ShipViaCode = 'ZZ'; // constant for arrow
        poDetails.ShipViaDescription = 'ELECTRONIC DISTRIBUTION'; // constant for arrow
        poDetails.PoCurrency = 'USD'; // constant -- for Arrow US
        poDetails.ArrowQuote = {};
        poDetails.ArrowQuote.ArrowQuoteNumber = poObj.items[0].quotenumber.toString();

        var billToObj = getBillingInfo(poObj);
        //    	var shipToObj = getShippingInfo(poObj);

        // soldTo Object
        soldTo.SoldToName = vendorConfig.Bill.addressee || null;
        soldTo.SoldToAddrLine1 = vendorConfig.Bill.address1 || null;
        soldTo.SoldToAddrLine2 = vendorConfig.Bill.address2 || null;
        soldTo.SoldToCity = vendorConfig.Bill.city || null;
        soldTo.SoldToState = vendorConfig.Bill.state || null;
        soldTo.SoldToZip = vendorConfig.Bill.zip || null;
        soldTo.SoldToCountry = vendorConfig.Bill.country || 'US';
        soldTo.SoldToContactName = vendorConfig.Bill.addressee || null;
        soldTo.SoldToContactPhone = billToObj.phone || null;
        soldTo.SoldToContactEmail = billToObj.email || null;

        // billTo Object
        billTo.BillToName = vendorConfig.Bill.addressee || null;
        billTo.BillToAddrLine1 = vendorConfig.Bill.address1 || null;
        billTo.BillToAddrLine2 = vendorConfig.Bill.address2 || null;
        billTo.BillToCity = vendorConfig.Bill.city || null;
        billTo.BillToState = vendorConfig.Bill.state || null;
        billTo.BillToZip = vendorConfig.Bill.zip || null;
        billTo.BillToCountry = vendorConfig.Bill.country || 'US';
        billTo.BillToContactName = vendorConfig.Bill.addressee || null;
        billTo.BillToContactPhone = billToObj.phone || null;
        billTo.BillToContactEmail = billToObj.email || null;

        // shipTo Object
        shipTo.ShipToName = poObj.shipAddressee || null;
        shipTo.ShipToAddrLine1 = poObj.shipAddr1 || null;
        shipTo.ShipToAddrLine2 = poObj.shipAddr2 || null;
        shipTo.ShipToCity = poObj.shipCity || null;
        shipTo.ShipToState = poObj.shipState || null;
        shipTo.ShipToZip = poObj.shipZip || null;
        shipTo.ShipToCountry = poObj.shipCountry || 'US';
        shipTo.ShipToContactName = poObj.shipAddressee || null;
        shipTo.ShipToContactPhone = poObj.shipPhone || null;
        shipTo.ShipToContactEmail = poObj.shipEmail || null;

        // endUser Object
        endUser.EndUserName = poObj.shipAddressee || null;
        endUser.EndUserAddrLine1 = poObj.shipAddr1 || null;
        endUser.EndUserAddrLine2 = poObj.shipAddr2 || null;
        endUser.EndUserCity = poObj.shipCity || null;
        endUser.EndUserState = poObj.shipState || null;
        endUser.EndUserZip = poObj.shipZip || null;
        endUser.EndUserCountry = poObj.shipCountry || 'US';
        endUser.EndUserContactName = poObj.shipAddressee || null;
        endUser.EndUserContactPhone = poObj.shipPhone || null;
        endUser.EndUserContactEmail = poObj.shipEmail || null;

        // poLines Object
        var lineCount = poObj.items.length;
        if (lineCount) {
            for (var i = 0; i < lineCount; i++) {
                var poLine = {};
                poLine.CustPoLineItemNbr = i + 1;
                poLine.VendorPartNum = poObj.items[i].item;
                poLine.PartDescription = poObj.items[i].description || null;
                poLine.QtyRequested = poObj.items[i].quantity || null;
                poLine.UnitPrice = poObj.items[i].rate || 0;
                poLine.TotalPoLinePrice = poObj.items[i].amount || 0;
                poLine.MfgName = poObj.items[i].manufacturer || null;
                poLine.UnitOfMeasure = 'EA';
                poLine.EndUserPoNumber = poObj.tranId;
                poLines.push(poLine);
            }
        }

        // formation of Actual Req Data to be sent to Arrow
        var purchaseOrder = {};
        purchaseOrder.HeaderRec = headerRec;
        purchaseOrder.poDetails = poDetails;
        purchaseOrder.poDetails.SoldTo = soldTo;
        purchaseOrder.poDetails.BillTo = billTo;
        purchaseOrder.poDetails.ShipTo = shipTo;
        purchaseOrder.poDetails.EndUser = endUser;
        purchaseOrder.poDetails.poLines = poLines;

        reqBody.PurchaseOrder = purchaseOrder;

        vcLog.recordLog({
            header: 'Request',
            body: JSON.stringify(reqBody),
            transaction: poObj.id
        });

        return reqBody;
    }

    function getBillingInfo(obj) {
        var billToObj = {};
        //
        //    	var subrec = obj.getSubrecord({
        //    		fieldId: 'billingaddress'
        //    	});
        //
        //    	billToObj.country = subrec.getValue({fieldId: 'country'}) || 'US'; //default to US
        //    	billToObj.addr1 = subrec.getValue({fieldId: 'addr1'}) || null;
        //    	billToObj.addr2 = subrec.getValue({fieldId: 'addr2'}) || null;
        //    	billToObj.city = subrec.getValue({fieldId: 'city'}) || null;
        //    	billToObj.state = subrec.getValue({fieldId: 'state'}) || null;
        //    	billToObj.zip = subrec.getValue({fieldId: 'zip'}) || null;
        //    	billToObj.addressee = subrec.getValue({fieldId: 'addressee'}) || null;
        //
        var vendorInfo = search.lookupFields({
            type: search.Type.VENDOR,
            id: obj.entity,
            columns: ['email', 'phone']
        });

        billToObj.phone = vendorInfo.phone || null;
        billToObj.email = vendorInfo.email || null;

        return billToObj;
    }

    function getShippingInfo(obj) {
        var shipToObj = {};

        var subrec = obj.getSubrecord({
            fieldId: 'shippingaddress'
        });

        shipToObj.country = subrec.getValue({ fieldId: 'country' }) || 'US'; //default to US
        shipToObj.addr1 = subrec.getValue({ fieldId: 'addr1' }) || null;
        shipToObj.addr2 = subrec.getValue({ fieldId: 'addr2' }) || null;
        shipToObj.city = subrec.getValue({ fieldId: 'city' }) || null;
        shipToObj.state = subrec.getValue({ fieldId: 'state' }) || null;
        shipToObj.zip = subrec.getValue({ fieldId: 'zip' }) || null;
        shipToObj.addressee = subrec.getValue({ fieldId: 'addressee' }) || null;

        var customerInfo = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: obj.getValue({ fieldId: 'shipto' }),
            columns: ['email', 'phone']
        });

        shipToObj.phone = customerInfo.phone || null;
        shipToObj.email = customerInfo.email || null;

        return shipToObj;
    }

    function formatArrowPOType(strPoType) {
        var obj = {};
        if (strPoType == 'Drop Shipment') {
            obj.poType = 'DS';
            obj.fobCode = 'ORIGIN';
        } else {
            obj.poType = 'SA';
            obj.fobCode = 'DESTINATION';
        }

        return obj;
    }

    function formatArrowDate(strDate) {
        var arrDate = strDate.split('/');
        if (arrDate) {
            var strMonth = padDigits(arrDate[0], 2);
            var strDay = padDigits(arrDate[1], 2);
            return arrDate[2] + strMonth + strDay;
        }
        return '';
    }

    function padDigits(number, digits) {
        return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {
        //if(!obj)
        //	var obj = {};
        //obj.vendorConfig.url = 'https://qaecsoag.arrow.com/ArrowECS/SalesOrder_RS/Status';
        //obj.partnerId = '81e07b92-a53a-459b-a1fe-92537ab1abcijk'

        var token = generateToken(obj.vendorConfig);
        var headers = {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        };
        log.emergency({ title: 'Arrow poObj', details: obj.poObj });

        var responseObj = https.post({
            url: obj.vendorConfig.endPoint,
            body: JSON.stringify(obj.poObj),
            headers: headers
        });

        vcLog.recordLog({
            header: 'Response',
            body: JSON.stringify(responseObj),
            transaction: obj.recPO.id
        });

        return responseObj;
        //    	if(responseObj){
        //    		log.debug({title: 'Response', details: response});
        //    		var responseBody = JSON.parse(response.body);
        //    		log.debug({ title: 'Response Body', details: responseBody});
        //   		return responseBody;
        //    	}
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function processResponse(obj) {
        var objBody = obj.responseBody;
        var orderDate = null;
        return objBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Arrow
     * @param {object} obj
     * @returns object
     **/
    function convertToXWWW(json) {
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

    function process(options) {
        log.emergency({ title: 'Inside Arrow Library PROCESS', details: options });
        var poObj = options.recPO,
            vendorConfig = options.recVendorConfig,
            resp = null;

        var requestBody = generateRequest({
            poObj: poObj,
            vendorConfig: vendorConfig
        });

        var responseObj = processRequest({
            poObj: requestBody,
            vendorConfig: vendorConfig,
            recPO: poObj
        });

        if (responseObj) {
            resp = new response({
                code: responseObj.code,
                message: responseObj.body
            });

            var responseBody = JSON.parse(responseObj.body);

            if (resp.code == 200) {
                if (responseBody.hasOwnProperty('TransactionKeyID')) {
                    var arrowTransactionID = responseBody.TransactionKeyID;
                    var values = {};
                    values[constants.Fields.Transaction.VENDOR_PO_NUMBER] = arrowTransactionID;
                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: poObj.id,
                        values: values
                    });
                    resp.message = null;
                }
            }
        }
        log.debug({ title: 'resp', details: resp });
        log.emergency({ title: 'responseObj', details: responseObj.body });
        return resp;
    }

    return {
        process: process
    };
});
