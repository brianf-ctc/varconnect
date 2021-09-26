/**
 * Copyright (c) 2020 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 1, 2020		paolodl		Initial Build
 * 2.00		May 25, 2021	paolodl		Include line numbers
 *
 */
define(['N/https',
//        'N/encode',
        './CTC_VC_Constants.js',
        './CTC_VC_Lib_Log.js'],

function(https,
		encode,
		constants,
		vcLog) {
	function authenticate(options) {
		var key = options.key,
			secret = options.secret,
			url = options.url,
			grantType = options.grantType;
		log.debug('auth: options', options);
		
//		var token = btoa(key+':'+secret);
		var token = encode.convert({
			string: key+':'+secret,
			inputEncoding: encode.Encoding.UTF_8,
			outputEncoding: encode.Encoding.BASE_64_URL_SAFE
		});
		
		try {
			var responseObj = https.post({
				url: url,
				headers: {
					authorization: 'Basic ' + token,
				    'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: {
					grant_type: 'client_credentials'
				}
			});
			log.debug('auth', responseObj);
		} catch (e) {
			log.error('Error getting authorization', e);
		}
		
		return JSON.parse(responseObj.body);
	}
	
	function _generateURL(options) {
		var configUrl = options.url,
			partnerID = options.partnerID,
			poNum = options.poNum;
		
		return configUrl + '/' + partnerID + '/'+ poNum;
	}

	function _processRequest(options) {
		var auth = options.auth,
			url = options.url,
			partnerID = options.partnerId,
			poNum = options.poNum,
			poId = options.poId,
			apiKey = options.apiKey,
			tokenType = auth.token_type,
			accessToken = auth.access_token,
			url = _generateURL({
				url: options.url,
				partnerID: partnerID,
				poNum: poNum
			}),
			response;
		
		log.debug('Dell process request options', options);
		
		url += '?apikey='+apiKey;
		
		var responseObj = https.get({
			url: url,
			headers: {
				'Authorization': tokenType + ' ' + accessToken,
				'Content-Type': 'application/json'
			}
		});
		
		if (poId)
			vcLog.recordLog({
				header: 'Response',
				body: JSON.stringify(responseObj),
				transaction: poId,
				status: constants.Lists.VC_LOG_STATUS.SUCCESS
			});
		
		if (responseObj)
			response = JSON.parse(responseObj.body);
		
		return response;
	}
	
	function _getSampleResponse(options) {
		var sampleResponse = {
				PurchaseOrderNumber: 'PONum1',
				Dpids: ['Dpid1'],
				Status: 'Shipped',
				PurchaseOrderDate: '1/1/2020',
				ShipToInformation: {
					ShippingMethod: 'ShipMethod1',
					CompanyName: 'ShipComp1',
					ContactName: 'ShipCont1',
					ContactAddres: 'ShipAdd1',
					City: 'ShipCity1',
					PostalCode: 'ShipZip1',
					State: 'ShipState1'
				},
				Lines: [{
					LineNumber: '1',
					Status: 'Shipped',
					QuantityOrdered: 1,
					ProductOrdered: {
						ManufacturerPartNumber: '3070SFF',
						BuyerPartNumber: 'ProdOrdBuyPart1',
						UnitPrice: 1.0,
						Description: 'ProdOrdDesc1',
						BaseSku: 'ProdOrdBaseSku1',
						BaseSkuDescription: 'ProdOrdBaseSkuDesc1'
					},
					ManufacturerOrderStatus: [{
						OrderNumber: 'ManOrdNum1',
						Status: 'Shipped',
						EstimatedShipmentDate: 'ManOrdEstShipDate1',
						EstimatedDeliveryDate: 'ManOrdEstDelDate1',
						Waybills: ['ManOrdWayBill1', 'ManOrdWayBill2'],
						CarrierName: 'ManOrdCarrier1',
						ServiceTags: ['ManOrdSerTag1', 'ManOrdSerTag2']
					}]
				}]
			};
		
		return sampleResponse;
	}
	
	function _parseResponseLines(options) {
		var itemRow = options.itemRow,
			line = options.line;
		
		itemRow.line_num = line.LineNumber;		// 2.00
		itemRow.item_num = line.ProductOrdered.ManufacturerPartNumber;
		itemRow.ship_qty = line.QuantityOrdered;
		itemRow.vendorSKU = line.ProductOrdered.BaseSku;
		
		for (var i=0; i<line.ManufacturerOrderStatus.length; i++) {
			var mos = line.ManufacturerOrderStatus[i];
			
			if ((!itemRow.order_eta || itemRow.order_eta == 'NA') &&
					mos.EstimatedDelivertDate)
				itemRow.order_eta = mos.EstimatedDelivertDate;
			
			if ((!itemRow.ship_date || itemRow.ship_date == 'NA') &&
					mos.EstimatedShipmentDate)
				itemRow.ship_date = mos.EstimatedShipmentDate;
			
			if ((!itemRow.carrier || itemRow.carrier == 'NA') &&
					mos.CarrierName)
				itemRow.carrier = mos.CarrierName;
			
			if (mos.Waybills && mos.Waybills.length > 0) {
				if (!itemRow.tracking_num || itemRow.tracking_num == 'NA')
					itemRow.tracking_num = [];
				
				itemRow.tracking_num = itemRow.tracking_num.concat(mos.Waybills);
			}

			if (mos.ServiceTags && mos.ServiceTags.length > 0) {
				if (!itemRow.serial_num || itemRow.serial_num == 'NA')
					itemRow.serial_num = [];
				
				itemRow.serial_num = itemRow.serial_num.concat(mos.ServiceTags);
			}
		}
		
		return itemRow;
	}
	
	function _processResponse(options) {
		var jsonResponse = options.response,
			itemArray = [];
		
		log.debug('jsonResponse', jsonResponse);
		if (jsonResponse) {
			var orderNum = jsonResponse.PurchaseOrderNumber ? jsonResponse.PurchaseOrderNumber : 'NA',
				orderDate = jsonResponse.PurchaseOrderDate ? jsonResponse.PurchaseOrderDate : 'NA',
				status = jsonResponse.Status,
				lines = jsonResponse.Lines;
			
			log.debug('status', status);
			if (status == 'Shipped') {
				for (var i=0; i<lines.length; i++) {
					var itemRow = {line_num:"NA", item_num:"NA", order_num:orderNum, order_date:orderDate, order_eta:"NA", ship_qty:"NA", ship_date:"NA", tracking_num:"NA", vendorSKU: "NA", carrier:"NA", serial_num:"NA"};
					itemArray.push(_parseResponseLines({
						itemRow: itemRow,
						line: lines[i]
					}));
				}
			}
			log.debug('itemArray', itemArray);
		}
		
		return itemArray;
	}
	
	function processDebugRequest(options) {
		var recVendorConfig = options.vendorConfig,
			key = recVendorConfig.apiKey,
			secret = recVendorConfig.apiSecret,
			url = recVendorConfig.endPoint,
			accessUrl = recVendorConfig.accessEndPoint,
			grantType = recVendorConfig.grantType,
			partnerID = recVendorConfig.customerNo,
			poNum = options.poNum,
			poId;
		
		var auth = authenticate({
			key: key,
			secret: secret,
			url: accessUrl,
			grantType: grantType
		});
		
		var responseObj = _processRequest({
			auth: auth,
			url: url,
			partnerId: partnerID,
			poNum: poNum,
			apiKey: key
		});
		
//		var responseObj = _getSampleResponse();
		
		return responseObj;
	}

	function process(options) {
		var recVendorConfig = options.vendorConfig,
			key = recVendorConfig.apiKey,
			secret = recVendorConfig.apiSecret,
			url = recVendorConfig.endPoint,
			accessUrl = recVendorConfig.accessEndPoint,
			grantType = recVendorConfig.grantType,
			partnerID = recVendorConfig.customerNo,
			poNum = options.poNum,
			poId = options.poId,
			recPO = options.recPO;
		
		var auth = authenticate({
			key: key,
			secret: secret,
			url: accessUrl,
			grantType: grantType
		});
		
		log.debug('Dell auth', auth);
		
		var responseObj = _processRequest({
			auth: auth,
			url: url,
			partnerId: partnerID,
			poNum: poNum,
			poId: poId,
			apiKey: key
		});
		
//		var responseObj = _getSampleResponse();
		
		var outputArray = _processResponse({
			response: responseObj
		}); 
		
		return outputArray;
	}
   
    return {
    	authenticate: authenticate,
    	processRequest: processDebugRequest,
        process: process
    };
});
