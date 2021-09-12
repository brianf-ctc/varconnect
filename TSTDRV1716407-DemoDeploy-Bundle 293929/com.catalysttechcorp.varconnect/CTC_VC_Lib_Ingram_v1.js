/**
 * Project Number:
 * Script Name: CTC_VC_Lib_Ingram_v1
 * Author: shawn.blackburn
 * @NApiVersion 2.x
 * @description Helper file for Ingram Micro V1 (Cisco) to Get PO Status
 */
define([
    'N/search', 
    'N/record', 
    'N/runtime', 
    'N/log', 
    'N/https', 
    './CTC_VC_Lib_Log.js',
    './CTC_VC_Constants.js'
  ],
  function(
    search, 
    record, 
    runtime, 
    log, 
    https, 
    vcLog,
    constants
  ) {
    'use strict';
    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns string
     **/
    function generateToken(obj) {

      var headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      var jsonBody = {
        "client_id": obj.apiKey,
        "client_secret": obj.apiSecret,
        "grant_type": 'client_credentials'
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
        } else { // retry 1 more time
          response = https.post({
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
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function processRequest(obj) {

      var token = generateToken(obj.vendorConfig);
      
      //for debugging
      if (!obj.poId)
    	  obj.poId = obj.poNum;
      
      var countryCode = 'US';
      if (runtime.country == 'CA')
    	  countryCode = 'CA';
    	  
      var headers = {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'IM-CustomerNumber': obj.vendorConfig.customerNo,
        'IM-CountryCode': countryCode,
        'IM-CustomerOrderNumber': obj.poNum,
        'IM-CorrelationID': obj.poId
      };

//      var body = {};
//      body['IM-CustomerNumber'] = obj.vendorConfig.customerNo;
//      body['IM-CountryCode'] = "US";
//      body.customerOrderNumber = obj.poNum;
//      body['IM-CorrelationID'] = '2938db67-620b-4b51-8ef484df4114ab44'//obj.poId;
      
	  //https://api.ingrammicro.com:443/resellers/v6/orders/orderstatus
      var url = obj.vendorConfig.endPoint + '/search?customerOrderNumber='+obj.poNum;

      log.audit({
        title: 'search request header ',
        details: headers
      });

      vcLog.recordLog({
        header: 'Ingram V1 (Cisco) Search PO Request',
        body: 'header ' + JSON.stringify(headers),
        transaction: obj.poId,
        status: constants.Lists.VC_LOG_STATUS.INFO
      });

      var response = https.get({
        url: url,
//        body: JSON.stringify(body),
        headers: headers
      });

      vcLog.recordLog({
        header: 'Ingram V1 (Cisco) Search PO Response',
        body: JSON.stringify(response),
        transaction: obj.poId,
        status: constants.Lists.VC_LOG_STATUS.SUCCESS
      });

      if (response) {
        log.debug({
          title: 'Search Response',
          details: response
        });
        var responseBody = JSON.parse(response.body);

        responseBody = _getOrderDetail({ 
        	responseBody: responseBody,
        	token: token,
        	vendorConfig: obj.vendorConfig,
        	poId: obj.poId
    	});
        
        log.debug({
          title: 'Return Response Body',
          details: responseBody
        });
        return responseBody;
      }
    }
    
    function _getOrderDetail(options) {
    	var response = options.responseBody,
    		vendorConfig = options.vendorConfig,
    		token = options.token,
    		poId = options.poId,
    		responseBody;
    	
    	var orders = response.orders;
    	log.debug('response body', response);
    	log.debug('orders', orders);
    	if (orders && orders.length > 0) {
			var ingramOrderNumber = orders[0].ingramOrderNumber;
			log.debug('ingramOrderNumber', ingramOrderNumber);
    		
	      var countryCode = 'US';
	      if (runtime.country == 'CA')
	    	  countryCode = 'CA';
	    	  
    	    var headers = {
				'Authorization': 'Bearer ' + token,
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'IM-CustomerNumber': vendorConfig.customerNo,
				'IM-CountryCode': countryCode,
				'IM-CorrelationID': poId,
//				'IM-SenderID': vendorConfig.customerNo
			};
    	    
    	    var url = vendorConfig.endPoint + '/' +ingramOrderNumber;
    	    
    	    log.debug('requestUrl: ' + url, 'headers ' + JSON.stringify(headers));

	        vcLog.recordLog({
	          header: 'Ingram V6 PO Details Request',
	          body: JSON.stringify(headers),
	          transaction: poId,
	          status: constants.Lists.VC_LOG_STATUS.INFO
	        });

	        var response = https.get({
	          url: url,
	          headers: headers
	        });

	        vcLog.recordLog({
	          header: 'Ingram V6 PO Details Response',
	          body: JSON.stringify(response),
	          transaction: poId,
	          status: constants.Lists.VC_LOG_STATUS.SUCCESS
	        });

	        if (response) {
	            log.debug({
	              title: 'Details Response',
	              details: response
	            });
	            var responseBody = JSON.parse(response.body);
	        }
    	}
    	
    	return responseBody;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function processResponse(obj) {
      log.debug('processResponse', JSON.stringify(obj));
      var outputArray = [];
      
      if (obj.responseBody === null) {
    	  return outputArray;
      }
      
      var objBody = obj.responseBody;
      log.debug('objBody', objBody);
      if (objBody) {
    	  var status = objBody.orderStatus;
    	  
    	  var validStatus = ['Shipped', 'Processing', 'Delivered', 'Backordered'];
    	  if (['Shipped', 'Processing', 'Delivered', 'Backordered'].indexOf(status)>=0) {
	    	  for (var i=0; i<objBody.lines.length; i++) {
	    		  var orderLine = objBody.lines[i];
	    		  log.debug('line ' + i, JSON.stringify(orderLine));
	    		  
	    		  if (['Shipped', 'Delivered', 'Backordered'].indexOf(orderLine.lineStatus)>=0) {
		    		  var outputObj = {};

		              // get line details from order lines
		              outputObj.line_num = orderLine.customerLineNumber;
		              outputObj.item_num = orderLine.vendorPartNumber; //orderLine.ingramPartNumber
		              
		              //add shipment details
		              outputObj.ship_qty = 0;
	            	  var trackingNum = [];
	            	  var serials = [];
		              for (var shipLine = 0; shipLine < orderLine.shipmentDetails.length; shipLine++) {
		            	  var shipment = orderLine.shipmentDetails[shipLine];
		            	  
		            	  outputObj.ship_qty+= parseInt(shipment.quantity);
			              outputObj.order_num = shipment.invoiceNumber;
		            	  outputObj.order_date = shipment.invoiceDate;
		            	  outputObj.ship_date = shipment.shippedDate;
		            	  outputObj.order_eta = shipment.estimatedShipDate;	//not being populated right now
//		            	  outputObj.order_eta = orderLine.promisedDeliveryDate;
		            	  
		            	  //add carrier details
//		            	  for (var carrierLine = 0; carrierLine < shipment.carrierDetails.length; carrierLine++) {
		            		  var carrier = shipment.carrierDetails;
		            		  
		            		  if (!outputObj.carrier)
		            			  outputObj.carrier = carrier.carrierName;
		            		  
		            		  //add tracking details
		            		  if(carrier.trackingDetails) {
			            		  for (var trackingLine = 0; trackingLine < carrier.trackingDetails.length; trackingLine++) {
			            			  var tracking = carrier.trackingDetails[trackingLine];
			            			  
			            			  if (tracking.trackingNumber)
			            				  trackingNum.push(tracking.trackingNumber);
			            			  
			            			  //add serials
			            			  if (tracking.SerialNumbers)
			            			  for (var serialLine=0; serialLine < tracking.SerialNumbers.length; serialLine++) {
			            				  var serial = tracking.SerialNumbers[serialLine];
			            				  
			            				  if (serial.serialNumber)
			            					  serials.push(serial.serialNumber);
			            			  }
			            		  }
		            		  }
//		            	  }
		              }
		              outputObj.tracking_num = trackingNum.join(',');
		              outputObj.serial_num = serials.join(',');
		              log.debug('adding', JSON.stringify(outputObj));
		              outputArray.push(outputObj);
	    		  }
	    	  }
    	  }
      }
      log.audit({
        title: 'outputArray',
        details: outputArray
      });
      return outputArray;
    }

    /**
     * @memberOf CTC_VC_Lib_Ingram_v1
     * @param {object} obj
     * @returns object
     **/
    function convertToXWWW(json) {
      log.debug('convertToXWWW', JSON.stringify(json));
      if (typeof json !== "object") {
        return null;
      }
      var u = encodeURIComponent;
      var urljson = "";
      var keys = Object.keys(json);
      for (var i = 0; i < keys.length; i++) {
        urljson += u(keys[i]) + "=" + u(json[keys[i]]);
        if (i < (keys.length - 1))
          urljson += "&";
      }
      return urljson;
    }

    function process(options) {
      log.audit({
        title: 'options',
        details: options
      });
      var outputArray = null;

      var responseBody = processRequest({
        poNum: options.poNum,
        vendorConfig: options.vendorConfig,
        poId: options.poId
      });

      if (responseBody) {
        outputArray = processResponse({
          vendorConfig: options.vendorConfig,
          responseBody: responseBody
        });
      }
      log.emergency({
        title: 'outputArray',
        details: outputArray
      });
      return outputArray;
    }

    return {
      process: process,
      processRequest: processRequest
    };
  });
