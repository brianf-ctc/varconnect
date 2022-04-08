/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define([
        'N/search',
        'N/runtime',
        'N/record',
        'N/log',
        'N/xml',
        'N/https',
        './CTC_Create_Item_Fulfillment',
//        './vendorlibrary_v2.js',
        './netsuitelibrary_v2.js',
        './VC_Globals',
        './CTC_Create_Item_Receipt',
        './CTC_VC_Lib_MainConfiguration',
        './CTC_VC_Lib_VendorConfig',
        './CTC_VC_Lib_WebService',
        './CTC_VC_Lib_LicenseValidator',
//        './CTC_VC_Lib_LineSerials.js',
        './CTC_VC_Constants.js',
        './CTC_VC_Lib_Log.js'
        ],
function(
		search,
		runtime,
		r,
		log,
		xml,
		https,
		createIF,
//		vendorlib,
		libcode,
		vcGlobals,
		createIR,
		libMainConfig,
		libVendorConfig,
		libWebService,
		libLicenseValidator,
//		libLineSerials,
		constants,
		vcLog) {

	var LogTitle = 'MR_OrderStatus';

	function _validateLicense(options) {
		var mainConfig = options.mainConfig,
			license = mainConfig.license,
			response = libLicenseValidator.callValidationSuitelet({ license: license,
				external: true});

		if (response == 'invalid')
			throw new Error('License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.');
	}

	function _loadMainConfig() {
		var mainConfig = libMainConfig.getMainConfiguration();

		if (!mainConfig) {
			log.error('No Coniguration available');
			throw new Error('No Coniguration available');
		} else return mainConfig;
	}

	function _loadVendorConfig(options) {
		var vendor = options.vendor,
			subsidiary = options.subsidiary,
			vendorConfig = libVendorConfig.getVendorConfiguration({
				vendor: vendor,
				subsidiary: subsidiary
			});

		if (!vendorConfig) {
			log.debug('No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary);
		} else return vendorConfig;
	}

	function _processDropshipsAndSpecialOrders(options) {
		var mainConfig = options.mainConfig,
			vendorConfig = options.vendorConfig,
			isDropPO = options.isDropPO,
			docid = options.docid,
			so_ID = options.soID,
			itemArray = options.itemArray,
			vendor = options.vendor,
			fulfillmentData;

		log.debug('xml app v2: options', JSON.stringify(options));

		try {
			if (mainConfig.processDropships &&
					vendorConfig.processDropships &&
					mainConfig.createIF &&
					isDropPO) {
				fulfillmentData = createIF.updateIF({
					mainConfig: mainConfig,
					vendorConfig: vendorConfig,
					poId: docid,
					soId: so_ID,
					lineData: itemArray,
					vendor: vendor});
			} else if (mainConfig.processSpecialOrders &&
					vendorConfig.processSpecialOrders &&
					mainConfig.createIR &&
					!isDropPO) {
				fulfillmentData = createIR.updateIR({
					mainConfig: mainConfig,
					vendorConfig: vendorConfig,
					poId: docid,
					lineData: itemArray,
					vendor: vendor});
			}
		} catch (e) {
			log.error('Error creating fulfillment/receipt', e);
		}

		return fulfillmentData;
	}

	function _getSubsidiary(poId) {
		var subsidiary = null;

		if (vcGlobals.ENABLE_SUBSIDIARIES) {
			var lookupObj = search.lookupFields({
				type: search.Type.TRANSACTION,
				id: poId,
				columns: 'subsidiary'
			});
			subsidiary = lookupObj.subsidiary[0].value;
		}

		return subsidiary;
	}

	function getInputData() {
		var logTitle = [LogTitle, 'getInputData'].join('::');
		log.debug(logTitle, '### START ### ');

		//return saved search for company to get list of purchase orders
		vcLog.recordLog({
			header: 'VAR Connect START',
			body: 'VAR Connect START',
			status: constants.Lists.VC_LOG_STATUS.INFO
		});
		var searchId = runtime.getCurrentScript().getParameter("custscript_searchid2");
		var vendor = runtime.getCurrentScript().getParameter("custscript_vendor2");

		var mainConfig = _loadMainConfig();
		log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));

		_validateLicense({ mainConfig: mainConfig });
		// log.audit("input vendor", vendor);
		// log.audit("input searchId", searchId);
		// log.audit("mainConfig", JSON.stringify(mainConfig));

		if (mainConfig.processDropships || mainConfig.processSpecialOrders)
			if ((searchId != null)){
				return search.load({
					id: searchId
				});
			} else {
				return "";
			}
	}

	function map(contextM) {
		var logTitle = [LogTitle, 'map'].join('::');

		try {
			// for each search result, the map function is called in parallel. It will handle the request write out the requestXML
			log.debug(logTitle, '### START: map ## ' + JSON.stringify(contextM) );

			var searchResult = JSON.parse(contextM.value);
			var docid = searchResult.id;
			var docnum = searchResult.values.tranid;
			var tranDate = searchResult.values.trandate;
			var isDropPO = (searchResult.values.custbody_isdropshippo == 'F' || !searchResult.values.custbody_isdropshippo)? false : true;
			var vendor = searchResult.values.entity.value;

			var outputObj = "";
			var custID = "";

			log.debug(logTitle, '>> data: ' + JSON.stringify({
				docid: docid,
				docnum: docnum,
				tranDate: tranDate,
				isDropPO: isDropPO,
				vendor: vendor
			}) );


			var subsidiary = _getSubsidiary(docid);
			var mainConfig = _loadMainConfig();
			var vendorConfig = _loadVendorConfig({
				vendor: vendor,
				subsidiary: subsidiary
			});

			log.debug(logTitle, '>> subsidiary: ' + JSON.stringify(subsidiary));
			log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
			log.debug(logTitle, '>> vendorConfig: ' + JSON.stringify(vendorConfig));

			if (vendorConfig) {
				var po_record = r.load({
					type : "purchaseorder",
					id: docid,
					isDynamic: true
				});

	//			var isDropPO = po_record.getValue({ fieldId: 'custbody_ctc_po_link_type '}) == 'Drop Shipment';

				log.debug(logTitle, '>> Initiating library webservice ....');
				outputObj = libWebService.process({
					mainConfig: mainConfig,
					vendorConfig: vendorConfig,
					vendor: vendor,
					poId: docid,
					poNum: docnum,
					tranDate: tranDate,
					subsidiary: subsidiary
				});
				log.debug(logTitle, '>> outputObj: ' + JSON.stringify(outputObj));

				so_ID = libcode.updatepo({
					po_record: po_record,
					poNum: docid,
					lineData: outputObj.itemArray,
					mainConfig: mainConfig,
					vendorConfig: vendorConfig
				});

				log.debug(logTitle, '>> so_ID: ' + JSON.stringify(so_ID));

				if (so_ID != null && so_ID != undefined){

					var so_rec = r.load({
						type: r.Type.SALES_ORDER,
						id: so_ID
					});
					custID = so_rec.getValue('entity');
					var params = {
						mainConfig: mainConfig,
						vendorConfig: vendorConfig,
						isDropPO: isDropPO,
						docid: docid,
						soID: so_ID,
						itemArray: outputObj.itemArray,
						vendor: vendor
					};

					var fulfillmentData = _processDropshipsAndSpecialOrders(params);
					log.debug('xml app v2: fulfillmentData', fulfillmentData)
				}
				logXML(outputObj.xmlString);
				logRowObjects(outputObj.itemArray);

				//Logic for retrieving information and creating list of serials to be created
				if ((isDropPO && mainConfig.createSerialDropship) ||
						(!isDropPO && mainConfig.createSerialSpecialOrder)) {
					var numPrefix = vendorConfig.fulfillmentPrefix;

					var lineData = outputObj.itemArray;
					log.debug("xml app v2: MAP lineData length", lineData.length);


			        // Move the searches outside of the for loop for governance issues
			        var arrFulfillments = [];
			        var ifSearch = search.load({ id: 'customsearch_ctc_if_vendor_orders' });
			        var ifFilters = search.createFilter({
			            name: 'custbody_ctc_if_vendor_order_match',
			            operator: search.Operator.STARTSWITH,
			            values: numPrefix
			        });
			        ifSearch.filters.push(ifFilters);
			        ifSearch.run().each(function(result) {
			            arrFulfillments.push({
			                    id :result.id,
			                    num : result.getValue('custbody_ctc_if_vendor_order_match')
			                })
			            return true;
			        });
			        log.debug('arrFulfillments',arrFulfillments);

			        var arrReceipts = [];
			        var ifSearch = search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
			        var ifFilters = search.createFilter({
			            name: 'custbody_ctc_if_vendor_order_match',
			            operator: search.Operator.STARTSWITH,
			            values: numPrefix
			        });
			        ifSearch.filters.push(ifFilters);
			        ifSearch.run().each(function(result) {
			            arrReceipts.push({
			                    id :result.id,
			                    num : result.getValue('custbody_ctc_if_vendor_order_match')
			                })
			            return true;
			        });
			        log.debug('arrReceipts',arrReceipts);

			        log.debug('lineData', lineData);
			        for (var i = 0; i < lineData.length; i++) {
			        	if (lineData) {
							var serialStr = lineData[i].serial_num;
							var serialArray = serialStr;
							if (typeof serialArray == 'string' && serialArray.length>0)
								serialArray = serialStr.split(',');
							log.debug("xml app v2: serial array", serialArray);
							var fulfillmentNum = null, receiptNum = null;


							if (isDropPO && mainConfig.processDropships) {
				                for ( var x = 0; x < arrFulfillments.length; x++) {
				                    if (arrFulfillments[x].num == numPrefix+lineData[i].order_num) {
				                        fulfillmentNum = arrFulfillments[x].id;
				                        break;
				                    }
				                }
				                log.debug('xml app v2: fulfillmentNum', fulfillmentNum)

							}
							else if (!isDropPO && mainConfig.processSpecialOrders) {
				                for ( var x = 0; x < arrReceipts.length; x++) {
				                    if (arrReceipts[x].num == numPrefix+lineData[i].order_num) {
				                        receiptNum = arrReceipts[x].id;
				                        break;
				                    }
				                }
				                log.debug('xml app v2: receiptNum', receiptNum)


							}

							if (serialArray) {
								for (var j = 0; j<serialArray.length; j++) {
									if (serialArray[j] == "") continue;
									var key = 'IF'+fulfillmentNum+'|IR'+receiptNum+'|IT'+lineData[i].item_num;
									//line serials
//									contextM.write(key, {'docid': docid, 'itemnum': lineData[i].item_num, 'custid':custID, 'orderNum': fulfillmentNum, 'receiptNum': receiptNum, serial: serialArray[j]});
									//old
									contextM.write(serialArray[j],
											{'docid': docid,
												'itemnum': lineData[i].item_num,
												'custid':custID,
												'orderNum': fulfillmentNum,
												'receiptNum': receiptNum,
												'linenum': lineData[i].line_num});
								}
							}
			        	}
					}
				}
			}
		} catch (e) {
			log.error('Error encountered in map', e);
		}
	}

	//line serials
//	function reduce(context) {
//		// reduce runs on each serial number to save it
//		// each instance of reduce has 5000 unit and this way there will be a new one for each line
//		var keyParams = context.key;
////		var itemNum = data.itemnum;
//		var data = JSON.parse(context.values[0]);
//		var poId = data.docid;
//		var serials = _extractSerials({ values: context.values });
//
//		var extractKeys = _extractKeys({ keyParams: keyParams });
//		var orderNum = extractKeys.fulfillment;
//		var itemNum = extractKeys.item;
//		var receiptNum = extractKeys.receipt;
//
//		log.debug("xml app v2: reduce serial key", extractKeys);
//		log.debug("xml app v2: reduce serial data", data);
//		log.debug('serials', serials);
//
//		var po_record = r.load({
//			type : "purchaseorder",
//			id: poId,
//			isDynamic : true
//		});
//		if (po_record != null){
//
//			var itemId = _getItemId({
//				po_record: po_record,
//				itemNum: itemNum
//			});
//
//			var soId = "";
//			var soId = po_record.getValue({
//				fieldId : "createdfrom"
//			});
//
//			log.debug('xml app v2: Reduce SalesOrder Id', soId);
//
//			var transactionListAndIds = _generateTransactionListAndId({
//				poId: poId,
//				soId: soId,
//				data: data
//			});
//			log.debug('transactionListAndIds', JSON.stringify(transactionListAndIds));
//
//			libLineSerials.processSerials({
//				serialsToCreate: serials,
//				item: itemId,
//				txnList: transactionListAndIds.txnList,
//				txnIds: transactionListAndIds.txnIds
//			});
//		}
//	}
//
//	function _extractKeys(options) {
//		var keyParams = options.keyParams,
//			fulfillment, receipt, item;
//
//		var splitKey = keyParams.split('|');
//		for (var i=0 ; i<splitKey.length;i++) {
//			var checkKey = splitKey[i];
//			log.debug('checkKey', checkKey);
//			if (checkKey.indexOf('IF')==0)
//				fulfillment = checkKey.substring(2);
//			else if (checkKey.indexOf('IR')==0)
//				receipt = checkKey.substring(2);
//			else if (checkKey.indexOf('IT')==0)
//				item = checkKey.substring(2);
//		}
//
//		return {
//			fulfillment: fulfillment,
//			receipt: receipt,
//			item: item
//		};
//	}
//
//	function _extractSerials(options) {
//		var values = options.values,
//			serials = [];
//
//		log.debug('values', values);
//		for (var i=0; i<values.length; i++) {
//			var value = JSON.parse(values[i]),
//				serial = value.serial;
//
//			if (serial)
//				serials.push(serial);
//		}
//
//		return serials;
//	}
//
//	function _getItemId(options) {
//		var
//			po_record = options.po_record,
//			itemNum = options.itemNum,
//			itemId;
//
//		var vendor = po_record.getValue({ fieldId: 'entity' });
//		var subsidiary = null;
//		if (vcGlobals.ENABLE_SUBSIDIARIES)
//			subsidiary = po_record.getValue({ fieldId: 'subsidiary' });
//
//		var mainConfig = _loadMainConfig();
//		var vendorConfig = _loadVendorConfig({
//			vendor: vendor,
//			subsidiary: subsidiary
//		});
//
//		var lineNum = libcode.validateline(po_record, itemNum, null, mainConfig.ingramHashSpace, vendorConfig.xmlVendor);
//		log.debug('_getItemId : itemNum ' + itemNum+ ' linenum', lineNum);
//		if (lineNum != null) {
//			itemId = po_record.getSublistValue({
//				sublistId: 'item',
//				fieldId: 'item',
//				line: lineNum
//			});
//		}
//
//		return itemId;
//	}
//
//	function _generateTransactionListAndId(options) {
//		var poId = options.poId,
//			soId = options.soId,
//			data = options.data,
//			txnList = [],
//			txnIds = {};
//
//		if (poId != null) {
//			txnList.push(r.Type.PURCHASE_ORDER);
//			txnIds[r.Type.PURCHASE_ORDER] = poId;
//		}
//		if (soId != null) {
//			txnList.push(r.Type.SALES_ORDER);
//			txnIds[r.Type.SALES_ORDER] = soId;
//		}
//		if (data) {
//			if (data.orderNum != null) {
//				txnList.push(r.Type.ITEM_FULFILLMENT);
//				txnIds[r.Type.ITEM_FULFILLMENT] = data.orderNum;
//			}
//			if (data.receiptNum != null) {
//				txnList.push(r.Type.ITEM_RECEIPT);
//				txnIds[r.Type.ITEM_RECEIPT] = data.receiptNum;
//			}
//		}
//
//		return {
//			txnList: txnList,
//			txnIds: txnIds
//		};
//	}

	//old
	function reduce(context) {
		// reduce runs on each serial number to save it
		// each instance of reduce has 5000 unit and this way there will be a new one for each line

		var serial = context.key;
		var data = JSON.parse(context.values[0]);
		var poId = data.docid;
		var itemNum = data.itemnum;
		var line = data.line;

		log.debug("xml app v2: reduce serial data", data);
		//log.debug("reduce poId", poId);
		//log.debug("reduce itemNum", itemNum);

		var po_record = r.load({
				type : "purchaseorder",
				id: poId,
				isDynamic : true
			});
		if (po_record != null){

			var itemId = "";
			var vendor = po_record.getValue({ fieldId: 'entity' });
			var subsidiary = null;
			if (vcGlobals.ENABLE_SUBSIDIARIES)
				subsidiary = po_record.getValue({ fieldId: 'subsidiary' });

			var mainConfig = _loadMainConfig();
			var vendorConfig = _loadVendorConfig({
				vendor: vendor,
				subsidiary: subsidiary
			});

			var lineNum = libcode.validateline(po_record, itemNum, null, mainConfig.ingramHashSpace, vendorConfig.xmlVendor)
			if (lineNum != null) {
				var itemId = po_record.getSublistValue({
					sublistId: 'item',
					fieldId: 'item',
					line: lineNum
				});

			}
			//log.debug('Reduce ItemId', itemId);

			var soId = "";
			var soId = po_record.getValue({
				fieldId : "createdfrom"
			});

			log.debug('xml app v2: Reduce SalesOrder Id', soId);

			var rs = search.global({ keywords: serial});
			//log.debug("Global search result", rs);

			if (rs.length == 0) {
				log.debug("xml app v2: saveSerial", serial);
				var sn_record = r.create({
					type: 'customrecordserialnum'
				});
				sn_record.setValue({
					fieldId: 'name',
					value: serial
				});
				if (poId != null) {
					sn_record.setValue({
						fieldId: 'custrecordserialpurchase',
						value: poId
					});
				}
				if (data.itemNum != null) {
					sn_record.setValue({
						fieldId: 'custrecordserialitem',
						value: data.itemNum
					});
				}
				if (soId != null) {
					sn_record.setValue({
						fieldId: 'custrecordserialsales',
						value: soId
					});
				}
				if (data.receiptNum != null) {
					sn_record.setValue({
						fieldId: 'custrecordcustomer',
						value: data.custid
					});
				}
				if (data.orderNum != null) {
					sn_record.setValue({
						fieldId: 'custrecorditemfulfillment',
						value: data.orderNum
					});
				}
				if (data.receiptNum != null) {
						sn_record.setValue({
						fieldId: 'custrecorditemreceipt',
						value: data.receiptNum
					});
				}
				if(itemId) {
	                sn_record.setValue({
	                    fieldId: 'custrecordserialitem',
	                    value: itemId
	                })
				}

				var sc = sn_record.save();
				log.debug("xml app v2: New serial id",sc);
			} else if (rs.length == 1) {
				//log.debug("Matching serial found");
			}
			else {
				log.debug('xml app v2: error duplicates')
			}

		}
	}

	function summarize(summary) {
		//any errors that happen in the above methods are thrown here so they should be handled
		//log stuff that we care about, like number of serial numbers
		log.audit("summarize");
		summary.reduceSummary.errors.iterator().each(function (key, error)
		{
			log.error('Reduce Error for key: ' + key, error);
			return true;
		});
		var reduceKeys = [];
			summary.reduceSummary.keys.iterator().each(function (key)
				{
					reduceKeys.push(key);
					return true;
			});
		log.audit('REDUCE keys processed', reduceKeys);
		vcLog.recordLog({
			header: 'VAR Connect END',
			body: 'VAR Connect END',
			status: constants.Lists.VC_LOG_STATUS.INFO
		});
	}

	//****************************************************************
	//** Debugging Code
	//****************************************************************
	function logXML(xmlString) {
		//log.debug("logXML");

		if (xml == "") {log.debug("logXML", "No xml passed"); return;}
		log.debug("logXML code =", xmlString);

	}
	function logRowObjects(itemArray) {
		//log.debug("logRowObjects");
		if (itemArray == "") {log.debug("logRowObjects", "No array present"); return;}
		log.debug("logRowObjects array =", JSON.stringify(itemArray));

	}

	return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
});
