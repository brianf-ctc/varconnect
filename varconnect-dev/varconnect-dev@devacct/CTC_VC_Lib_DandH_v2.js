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

define(['N/url', './CTC_VC2_Lib_Utils.js', './Bill Creator/Libraries/moment'], function (
    ns_url,
    vc2_util,
    moment
) {

    var Helper = {};
    var EntryPoint = {};

    EntryPoint.process=function(option){
        var LogTitle = ['CTC_VC_Lib_DandH_v2', 'process'].join('::');

        try{
            option.recordId = option.poId || option.recordId;
            option.recordNum = option.poNum || option.transactionNum;

            var responseBody = getRequest(option);
            var returnValue = formatJson(responseBody);

            log.debug(LogTitle+' | returnValue',returnValue);
            return returnValue;
        }
        catch(ex){
            vc2_util.logError(LogTitle, ex);
            throw ex;
        }
    };

    function getRequest(config){
        var LogTitle = ['CTC_VC_Lib_DandH_v2', 'getRequest'].join('::');

        //set headers
        var headers = {
            'Accept':'application/json',
            'Content-Type':'application/json',
            'Authorization':getTokenCache(config),
            'dandh-tenant':Helper.getTenant(config),
            'accountNumber':config.vendorConfig.customerNo,
        };

        log.debug(LogTitle+' | headers',headers);

        //get url 
        var stUrl = ns_url.format({
            domain: config.vendorConfig.endPoint,
            params: {
                purchaseOrderNumber:config.recordNum
            }
        });

        log.debug(LogTitle+' | url',stUrl);

        //get request
        var objResponse = vc2_util.sendRequest({
            header: [LogTitle, 'getRequest'].join(' : '),
            method: 'get',
            recordId: config.recordId,
            query: {
                url: stUrl,
                headers: headers,
            },
        });

        if (objResponse.isError){
        	throw objResponse.errorMsg;
        }

        log.debug(LogTitle+' | objResponse.RESPONSE.body', objResponse.RESPONSE.body);
        return objResponse.RESPONSE.body;
    }

    function getTokenCache(config){
        var token = vc2_util.getNSCache({key:'VC_DANDH_TOKEN'});
        if(vc2_util.isEmpty(token)){
            token = generateToken(config);
            vc2_util.setNSCache({
                key:'VC_DANDH_TOKEN',
                value: token
            });
        }
        return token;
    }

    function generateToken(config) {
        var LogTitle = ['CTC_VC_Lib_DandH_v2', 'generateToken'].join('::');

        var tokenReq = vc2_util.sendRequest({
            header: [LogTitle, 'GenerateToken'].join(' : '),
            method: 'post',
            recordId: config.recordId,
            query: {
                body: {
                    grant_type: 'client_credentials',
                    client_id: config.vendorConfig.apiKey,
                    client_secret: config.vendorConfig.apiSecret,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                url: config.vendorConfig.accessEndPoint,
            },
        });
        if (tokenReq.isError) {
            // try to parse anything
            var errorMessage = tokenReq.errorMsg;
            if (tokenReq.PARSED_RESPONSE && tokenReq.PARSED_RESPONSE.error_description) {
                errorMessage = tokenReq.PARSED_RESPONSE.error_description;
            }
            throw 'Generate Token Error - ' + errorMessage;
        }
        var tokenResp = vc2_util.safeParse(tokenReq.RESPONSE);
        if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';
        log.audit(LogTitle, '>> tokenResp: ' + JSON.stringify(tokenResp));

        var bearerToken = [ tokenResp.token_type, tokenResp.access_token ].join(' ');
        return bearerToken;
    }

    function formatJson(responseBody){
        var LogTitle = ['CTC_VC_Lib_DandH_v2', 'formatJson'].join('::');

        responseBody = JSON.parse(responseBody);

        var itemArray = [];
        if(!Array.isArray(responseBody.elements) || !responseBody){
            log.error(LogTitle,'Invalid response');
            return;
        }

        for(var i=0; i<responseBody.elements.length; i++){
            var objElements = responseBody.elements[i];

            var orderItem = {};

            //set values to order item
            orderItem.order_num = objElements.orderNumber;
            orderItem.order_date = objElements.orderDate;
            orderItem.customer_order_number = objElements.customerPurchaseOrder;
            orderItem.note = objElements.specialInstructions;
            orderItem.order_status = objElements.orderStatus;

            orderItem.line_num = 'NA';
            orderItem.item_num = 'NA';
            orderItem.item_id = 'NA';
            orderItem.vendor_id = 'NA';
            orderItem.ship_qty = 'NA';
            orderItem.vendorSKU = 'NA';
            orderItem.serial_num = 'NA';
            orderItem.order_eta = 'NA';
            orderItem.ship_date = 'NA';
            orderItem.tracking_num = 'NA';
            orderItem.manifest_carrier = 'NA';

            orderItem.is_shipped = false;

            //==== get shipments ==== 
            var arrShipments = objElements.shipments;
            for(var s=0; s<arrShipments.length; s++){

            	//set values to order item for shipping details
            	orderItem.branch = (arrShipments[s].branch)?arrShipments[s].branch:'NA';
            	orderItem.ship_method = (arrShipments[s].serviceType)?arrShipments[s].serviceType:'NA';
            	orderItem.carrier = (arrShipments[s].carrier)?arrShipments[s].carrier:'NA';

                //==== get manifest ==== 
                var arrManifest = arrShipments[s].manifests;
                for(var m=0; m<arrManifest.length; m++){
                    var objPackaging = arrManifest[m].packaging;

                    var shipmentDate = (arrManifest[m].shipmentDate)?arrManifest[m].shipmentDate:'NA';
                    var trackingNum = arrManifest[m].trackingNumber;
                    var carrier = arrManifest[m].carrier;
                    var etaDate = arrManifest[m].etaDate;

                    //set values to order item
                    orderItem.order_eta = etaDate;
                    orderItem.ship_date = shipmentDate.split(/,/g)[0];
                    orderItem.tracking_num = trackingNum;
                    orderItem.manifest_carrier = carrier;

                    //get packages
                    var arrPackages = objPackaging.packages;
                    for(var p=0; p<arrPackages.length; p++){

                        //get items
                        var arrItems = arrPackages[p].items;
                        for(var t=0; t<arrItems.length; t++){

                            var arrSerial = arrItems[t].serialNumbers;

                            //set values to order item with item details
                            orderItem.line_num = Helper.getLineNum(arrItems[t].lineNumber);
                            orderItem.item_id = arrItems[t].itemId;
                            orderItem.vendor_id = arrItems[t].vendorItemId;
                            orderItem.serial_num = arrSerial.join(',');
                            orderItem.is_shipped = Helper.getIsShippedValue(orderItem);
                            // orderItem.line_manifest_json_data = JSON.stringify(arrItems[t]);
                            
                            itemArray.push(orderItem);
                        }

                    }
                }

                //==== get lines ====
                var arrLines = arrShipments[s].lines;
                for(var l=0; l<arrLines.length; l++){

                    var item = arrLines[l].item;
                    var lineNum = Helper.getLineNum(arrLines[l].lineNumber);
                    var shipQty = arrLines[l].shippableQuantity;
                    var orderQty = arrLines[l].orderQuantity;
                    var unitPrice = arrLines[l].unitPrice;
                    var externalLineNumber = arrLines[l].externalLineNumber;
                    
                    /* get the object from item array and add order quantity 
                    from lines data */
                    var arrItem = itemArray.filter(function(objData) {
                        return (objData.line_num === lineNum);
                    });

                    //if line number is the same, add the ship qty from lines data
                    if(arrItem.length>=1){
                        for(var c=0; c<arrItem.length; c++){
                        	arrItem[c].line_unique_key = externalLineNumber;
                        	arrItem[c].item = item;
                        	arrItem[c].order_qty = orderQty;
                            arrItem[c].ship_qty = shipQty;
                            arrItem[c].rate = unitPrice;
                            // arrItem[c].line_json_data = JSON.stringify(arrLines[l]);
                        }
                    }
                    //add data that does not exist in manifest
                    else{

                    	orderItem.line_unique_key = externalLineNumber;
                    	orderItem.item_num = item;
                    	orderItem.line_num = lineNum;
                    	orderItem.order_qty = orderQty;
                    	orderItem.ship_qty = shipQty;
                    	orderItem.rate = unitPrice;
                        orderItem.is_shipped = Helper.getIsShippedValue(orderItem);
                    	// orderItem.line_json_data = JSON.stringify(arrLines[l]);

                    	itemArray.push(orderItem);
                    }
                }

            }
        }

        return itemArray;
    }
    
    Helper.getIsShippedValue=function(orderItem){
        var LogTitle = 'CTC_VC_Lib_DandH_v2 | getIsShippedValue';

        var returnValue = false;

        if (
            orderItem.ship_date &&
            orderItem.ship_date != 'NA' &&
            orderItem.ship_qty &&
            orderItem.ship_qty != 0
        ){
            var shippedDate = moment(orderItem.ship_date, 'MM/DD/YY').toDate();
            vc2_util.log(LogTitle, '**** shipped date: ****', [
                shippedDate,
                util.isDate(shippedDate),
                shippedDate <= new Date()
            ]);

            if (shippedDate && util.isDate(shippedDate) && shippedDate <= new Date()){
                returnValue = true;
            }
            else{
                returnValue = false;
            }
        }
        return returnValue;
    };

    Helper.getTenant=function(config){
        var dnhTenant = 'dhus';
        switch (config.vendorConfig.country) {
            case 'US':
                dnhTenant = 'dhus';
                break;
            case 'CA':
                dnhTenant = 'dhca';
                break;
            default:
                dnhTenant = 'dsc';
                break;
        }
        return dnhTenant;
    };

    Helper.getLineNum=function(lineNum){
        var intNum = vc2_util.forceInt(lineNum);

        var line = (intNum-1);
        if(line<0){
            line = 0;
        }
        return line;
    };

    return EntryPoint;
});