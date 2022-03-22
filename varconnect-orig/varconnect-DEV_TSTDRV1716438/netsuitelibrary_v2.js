/**
 * Copyright (c) 2020 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 * @Description VAR Connect library for netsuit record handling
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jan 1, 2020	    <author email>			Initial Build
 * 2.00		Nov 2, 2020		paolodl@nscatalyst.com	Add hash conversion to space for Ingram
 * 3.00		Feb 8, 2021		paolodl@nscatalyst.com	Add popylation for new date columns
 * 4.00		Jun 3, 2021		paolodl@nscatalyst.com	Add get order line function
 * 4.01		Jul 21,2021		paolodl@nscatalyst.com	Dynamic date parse
 * 
 */

define(['N/search', 
        'N/runtime', 
        'N/record', 
        'N/config',
        'N/format',
        './VC_Globals.js',
        './CTC_VC_Constants.js'],
    function(search, 
    		runtime, 
    		r, 
    		config,
    		format,
    		vcGlobals,
    		constants) {
	var dateFormat;

	//***********************************************************************
	//** Update PO Fields with parsed XML data
	//***********************************************************************
//	function updatePOItemData(poNum, lineData) 
	function updatePOItemData(options)
	{
		/****** 
		lineData definition {	line_num:"NA", 
								item_num = "NA',
								order_num:"NA", 
								order_date:"NA",
								order_eta:"NA",
								ship_date:"NA", 
								ship_qty:"NA",
								tracking_num:"NA", 
								carrier:"NA", 
								serial_num:"NA"};
		***/
		var poNum = options.poNum,
			lineData = options.lineData,
			mainConfig = options.mainConfig,
			vendorConfig = options.vendorConfig,
			po_record = options.po_record;
		
		log.debug('mainConfig', mainConfig);
		log.debug('vendorConfig', vendorConfig);

		log.debug('netsuiteLibrary:start', 'poNum = '+poNum);
		//logRowObjects(lineData);
		
//		var po_record = r.load({
//				type : "purchaseorder", 
//				id: poNum,
//				isDynamic : true
//			});
		log.debug('netsuiteLibrary:afterLoadPO', 'poNum = '+poNum);
		var po_updated = false;
		var so_updated = false;
	
		if (po_record != null){
			var bypassVAR = po_record.getValue({
					fieldId : "custbody_ctc_bypass_vc"
				});
			if (bypassVAR) return null;

			var createdFromID = po_record.getValue({
					fieldId : "createdfrom"
				});
			var specialOrder = false;
			var isDropPO = po_record.getValue({
					fieldId: 'custbody_isdropshippo'
				});
//			var isDropPO = (po_record.getValue({
//				fieldId : "custbody_ctc_po_link_type"
//			})) == 'Drop Shipment';
			
/***  Code to supoort saving info to SO, not used at this time			
			if (!isEmpty(createdFromID)) {
				var so_record = record.load({
						type : "salesorder",
						id : createdFromID,
						isDynamic : false
				});

				if (so_record != null){
					var mySearchFilter = search.createFilter({
							name: 'internalid',
							operator: search.Operator.IS,
							values : poNum
					});
					var lineNumSearch = search.load({id: PO_SO_Line_Numbers});
					lineNumSearch.filters.push(mySearchFilter);
					var searchresults = lineNumSearch.run();

				}
			}
			else
				var so_record = null;
***/
			log.debug('netsuiteLibrary:beforeTry', 'createdFromID = '+createdFromID);

			try {
				checkForDuplicateItems (po_record);
				log.debug('netsuiteLibrary:afterCheckForDups', 'lineData.length = '+lineData.length);
				
				//4.01
				if (!dateFormat) {
					var generalPref = config.load({
					 	type: config.Type.COMPANY_PREFERENCES
					 });
					dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT'});
					log.debug('dateFormat', dateFormat);
				}

				for (var i = 0; i < lineData.length; i++) {
						// Find the line on the PO that matches the line data from the XML file
						var line_num = validateLineNumber (po_record, lineData[i].item_num, lineData[i].vendorSKU, mainConfig.ingramHashSpace, vendorConfig.xmlVendor);
						log.debug('netsuiteLibrary:afterCheckForDups', lineData);
		
						if (line_num != null) {
							
							po_updated = true;
							//Serial num link is created with a UE now
							var lineNum = po_record.selectLine({
								sublistId: 'item',
								line: line_num
							});

							updateField(po_record, 'custcol_ctc_xml_dist_order_num', lineData[i].order_num);
							updateField(po_record, 'custcol_ctc_xml_date_order_placed', lineData[i].order_date);
							updateField(po_record, 'custcol_ctc_xml_eta', lineData[i].order_eta);
							
							var nsDate = parseDate({ dateString: lineData[i].order_date });
							if (nsDate)
								updateField(po_record, 'custcol_ctc_vc_order_placed_date', nsDate);
							nsDate = parseDate({ dateString: lineData[i].order_eta });
							if (nsDate)
								updateField(po_record, 'custcol_ctc_vc_eta_date', nsDate);
							

							//  Don't use XML serial numbers on special order POs, warehouse will scan them in
							if (!specialOrder) {
								//Serials are viewed with a separate suitelet now
								//updateFieldList (lineData[i].serial_num, po_record, 'custcol_ctc_xml_serial_num', line_num);
							}

							updateFieldList (lineData[i].carrier, po_record, 'custcol_ctc_xml_carrier');				
							updateFieldList (lineData[i].ship_date, po_record, 'custcol_ctc_xml_ship_date');
							
							if (isDropPO || !mainConfig.useInboundTrackingNumbers)
								updateFieldList (lineData[i].tracking_num, po_record, 'custcol_ctc_xml_tracking_num');
							else 
								updateFieldList (lineData[i].tracking_num, po_record, 'custcol_ctc_xml_inb_tracking_num');
							
							po_record.commitLine ({
								sublistId: "item"
							});
						}
						else {
							log.error({
								title: 'CTC Update PO '+poNum,
								details: 'Could not find line number for item '+lineData[i].item_num
							});
						}
				} //end for
				log.debug('netsuiteLibrary:beforeSavePO', 'poNum = '+poNum);

				if (po_updated) {
					po_record.save({
						enableSourcing: false,
						ignoreMandatoryFields: true
					});
				}
				return createdFromID;
			}
			catch (err){
				log.error({
					title: 'Update PO line data ERROR',
					details: 'po ID = '+poNum+' updatePOItemData error = '+err.message
				});
				return null;  
			}
		}
		else {
			log.error({
				title: 'CTC Update PO '+poNum,
				details: 'Could not update PO'
			});
			return null;
		}
		
	}		
		
	/** 
	* Matches item number to PO line number
	* @param {obj} po_record the opened PO record
	* @param {str} itemNum the display item number to be matched
	* @param {*} vendorSKU optionally the vendorSKU if matching that instead of mpn
	* @returns {int} the line number of the matching item or null
	*/
	function validateLineNumber (po_record, itemNum, vendorSKU, hashSpace, xmlVendor) {
		var vendorList = constants.Lists.XML_VENDOR;
		var vendorSKU = vendorSKU || "";
		
		if (itemNum == null || itemNum.length == 0 || itemNum == 'NA') {
			log.error({
				title: 'CTC Update PO '+po_record.id,
				details: 'Could not find line number for item '+itemNum
			});
			return null;
		}
		else {
			var lineItemCount = po_record.getLineCount({
									sublistId: 'item'
								});
			if (lineItemCount > 0) {
				for (var i = 0; i < lineItemCount; i++) {
					var tempItemNum = po_record.getSublistText({
						sublistId: 'item',
						fieldId: vcGlobals.ITEM_ID_LOOKUP_COL,
						line: i
					});
//					log.debug('CTC Update PO line ' + i, tempItemNum + '=' + itemNum + ' | ' + tempVendorSKU + '=' + vendorSKU);

					if ((vcGlobals.VENDOR_SKU_LOOKUP_COL != null) && (vendorSKU != "")) {
						var tempVendorSKU = po_record.getSublistText({
							sublistId: 'item',
							fieldId: vcGlobals.VENDOR_SKU_LOOKUP_COL,
							line: i
						});

						if (tempVendorSKU == vendorSKU) {
						   log.debug('matched vendor sku for line '+i)
							return (i)
						}

						//Ingram Hash replacement
						if (hashSpace &&
								(xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
							xmlVendor == vendorList.INGRAM_MICRO)) {
							if (vendorSKU.replace('#', ' ') == tempVendorSKU) {
								log.debug('matched vendor sku for line '+i)
								return (i);
							}
						}
					}

					if (tempItemNum == itemNum)
						return (i)
						
					//Ingram Hash replacement
					if (hashSpace &&
						(xmlVendor == vendorList.INGRAM_MICRO_V_ONE ||
						xmlVendor == vendorList.INGRAM_MICRO)) {
						if (itemNum.replace('#', ' ') == tempItemNum)
							return (i);
					}
				}
				return null;
			}
			else
				return null;
		}	
	}		
		
		
	/** 
	* Sets column field value, appending if already set and not equal
	* @param {obj} po_record the opened PO record
	* @param {str} fieldID the internal id of the field to be updated
	* @param {str} xmlVal the value to be set in the field
	* @returns {*} void
	*/	
	function updateField (po_record, fieldID, xmlVal){
		var maxFieldLength = 290;  // free form text fields have max length of 300 chars
		log.debug('netsuiteLibrary:updateField', 'field='+fieldID + ' - xmlval='+xmlVal)
		var currentFieldValue = po_record.getCurrentSublistValue({
			sublistId: 'item',
			fieldId: fieldID
		});
		log.debug('netsuiteLibrary:updateField:currentFieldValue', currentFieldValue)
		
		if (currentFieldValue != null && currentFieldValue.length > 0 && currentFieldValue != 'NA'){
			if (currentFieldValue.indexOf(xmlVal) < 0 && currentFieldValue.length < maxFieldLength && xmlVal != 'NA'){
				currentFieldValue += '\n'+ xmlVal;
 
				po_record.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: fieldID,
					value: currentFieldValue
				});				

			}
		} else if (xmlVal &&
				xmlVal != null &&
				xmlVal != undefined){
			po_record.setCurrentSublistValue({
				sublistId: 'item',
				fieldId: fieldID,
				value: xmlVal
			});				
		}
	}		
		
	/** 
	* Sets column field list value, appending if already set and not equal
	* @param {str} xmlVal the comma separated values to be set in the field
	* @param {obj} po_record the opened PO record
	* @param {str} fieldID the internal id of the field to be updated
	* @returns {*} void
	*/	
	function updateFieldList (xmlNumbers, po_record, fieldID) {
		var errorMsg = "Maximum Field Length Exceeded";
		var errorFound = false;
		var maxFieldLength = 3950;
		log.debug('netsuiteLibrary:updateFieldList', 'field='+fieldID + ' - xmlval '+xmlNumbers)
		
		// split up the comma delimited line data into arrays for easier processing
		if (xmlNumbers &&
				xmlNumbers != null &&
				xmlNumbers != undefined ) {
			var scannedNums = new Array();
			if (typeof xmlNumbers == 'string')
				scannedNums = xmlNumbers.split(',');
			else 
				scannedNums = xmlNumbers;
			try {
				var currentNumbers = po_record.getCurrentSublistValue({
					sublistId: 'item',
					fieldId: fieldID
				});
				//log.debug('netsuiteLibrary:updateField:currentNumbers', currentNumbers)
	
				if (currentNumbers != null) {
					if ((currentNumbers == 'NA') || (currentNumbers.length = 0)){
						var newValue = xmlNumbers.replace(/[","]+/g, "\n");
	
						if (newValue &&
								newValue != null &&
								newValue != undefined)
						po_record.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: fieldID,
							value: newValue
						});				
						
						if (fieldID == 'custcol_ctc_xml_ship_date') { 
							var newDate = parseDate({ dateString: newValue });
							if (newDate &&
									newDate != null &&
									newDate != undefined)
								po_record.setCurrentSublistValue({
									sublistId: 'item',
									fieldId: 'custcol_ctc_vc_shipped_date',
									value: newDate
								});				
						}
					}
					else {
						/* remove \r chars */
						var newCurrent = currentNumbers.split('\r').join('');
	
						var newNumAdded = false;
						
						var currentNumbersList = Array();
						currentNumbersList = newCurrent.split('\n');
						
						/** check to see if the field already exceeds the max length **/
						if (currentNumbersList[currentNumbersList.length-1] === errorMsg)
							errorFound = true;
						
						if (!errorFound){
							for (var j = 0; j < scannedNums.length; j++) {
								var numFound = false;
								for (var x = 0; x < currentNumbersList.length; x++) {
									if (currentNumbersList[x] == scannedNums[j]) {
										numFound = true;
										break;
									}
								}
								if (!numFound && scannedNums[j] != 'NA') {
									/* OLD  newCurrent += ',' + scannedNums[j]; */
									newNumAdded = true;
									if ((newCurrent.length + scannedNums[j].length) < maxFieldLength) {
										newCurrent += '\n' + scannedNums[j];
										currentNumbersList.push(scannedNums[j])
									}
									else {
										newCurrent += '\n' + errorMsg;
										break;
									}
								}
							}
							if (newNumAdded &&
									newCurrent &&
									newCurrent != null &&
									newCurrent != undefined) {
								po_record.setCurrentSublistValue({
									sublistId: 'item',
									fieldId: fieldID,
									value: newCurrent
								});				
								if (fieldID == 'custcol_ctc_xml_ship_date') {
									var newDate = parseDate({ dateString: newCurrent });
									if (newDate &&
											newDate != null &&
											newDate != undefined)
										po_record.setCurrentSublistValue({
											sublistId: 'item',
											fieldId: 'custcol_ctc_vc_shipped_date',
											value: newDate
										});
								}
							} else if (fieldID == 'custcol_ctc_xml_ship_date') {
								var newDate = parseDate({ dateString: currentNumbers.split('\r').join('') });
								if (newDate &&
										newDate != null &&
										newDate != undefined)
									po_record.setCurrentSublistValue({
										sublistId: 'item',
										fieldId: 'custcol_ctc_vc_shipped_date',
										value: newDate
									});
							}
						}
					}
				}
				else {
					if (xmlNumbers.length <= maxFieldLength &&
							xmlNumbers != null &&
							xmlNumbers != undefined) {
						po_record.setCurrentSublistValue({
							sublistId: 'item',
							fieldId: fieldID,
							value: xmlNumbers.replace(/[","]+/g, "\n")
						});				
						if (fieldID == 'custcol_ctc_xml_ship_date') { 
							var newDate = parseDate({ dateString: xmlNumbers.replace(/[","]+/g, "\n") })
							if (newDate &&
									newDate != null &&
									newDate != undefined)
								po_record.setCurrentSublistValue({
									sublistId: 'item',
									fieldId: 'custcol_ctc_vc_shipped_date',
									value: newDate
								});				
						}
					}
					else {
						var newCurrent = "";
						for (var i = 0; i < scannedNums.length; i++) {
							if ((newCurrent.length + scannedNums[i].length) > maxFieldLength) {
								newCurrent += errorMsg;
								break;					
							} else
								newCurrent += scannedNums[i] + "\n";				
						}
						if (newCurrent &&
								newCurrent != null &&
								newCurrent != undefined) {
							po_record.setCurrentSublistValue({
								sublistId: 'item',
								fieldId: fieldID,
								value: newCurrent
							});				
							if (fieldID == 'custcol_ctc_xml_ship_date') {
								var newDate = parseDate({ dateString: newCurrent })
								if (newDate &&
										newDate != null &&
										newDate != undefined)
									po_record.setCurrentSublistValue({
										sublistId: 'item',
										fieldId: 'custcol_ctc_vc_shipped_date',
										value: newDate
									});				
							}
						}
					}
				}	
			}
			catch(err){
				log.error({
					title: 'CTC Update PO ',
					details: 'ERROR In updateFieldLIST '+fieldID+' = '+err.message
				});
			}
		}
	}		

	/** 
	* Checks for lines with duplicate items and sets the ctc fields in the duplicate lines to "Duplicate Item"
	* @param {obj} po_record the opened PO record
	* @returns {*} void
	*/	
	function checkForDuplicateItems (po_record){
		//log.audit('checkForDuplicateItems', JSON.stringify(po_record))
		var lineItemCount = po_record.getLineCount({
						sublistId: 'item'
					});
		var a = ['custcol_ctc_xml_dist_order_num', 'custcol_ctc_xml_date_order_placed', 'custcol_ctc_xml_eta', 'custcol_ctc_xml_serial_num', 'custcol_ctc_xml_carrier', 'custcol_ctc_xml_tracking_num', 'custcol_ctc_xml_ship_date'];
		
		if (lineItemCount > 0) {

			for (var i = 0; i < lineItemCount; i++) {

				var tempItem = po_record.getSublistText({
					sublistId: 'item',
					fieldId: 'item',
					line: i
				});

				for (var x=i+1; x < lineItemCount; x++){
					var tempSubItem = po_record.getSublistText({
						sublistId: 'item',
						fieldId: vcGlobals.ITEM_ID_LOOKUP_COL,
						line: x
					});

					if (tempItem == tempSubItem){
						//Update XML fields with word DUPLICATE
						var tempItemDupeTest = po_record.getSublistText({
							sublistId: 'item',
							fieldId: 'custcol_ctc_xml_eta',
							line: x
						});

						if (tempItemDupeTest !== 'Duplicate Item'){
							var lineNum = po_record.selectLine({
								sublistId: 'item',
								line: x
							});
							a.forEach(function(fieldID){
								po_record.setCurrentSublistValue({
									sublistId: 'item',
									fieldId: fieldID,
									value: 'Duplicate Item'
								});				
							})
							po_record.commitLine ({
								"sublistId": "item"
							});
						}
					}
				}	
					
			}
			
		}
	}	
	
	function parseDate(options) {
		var dateString = options.dateString,
			date = '';
		
		if (dateString && dateString.length > 0 && dateString != 'NA') {
			try {
				var stringToProcess = dateString.replace(/-/g,'/').replace(/\n/g,' ').split(' ');
				
				for (var i=0; i<stringToProcess.length; i++) {
					var singleString = stringToProcess[i];
					if (singleString) {
						var stringArr = singleString.split('T'); //handle timestamps with T
						singleString = stringArr[0];
						var convertedDate = new Date(singleString);
						
						if (!date || convertedDate>date)
							date = convertedDate;
					}
				}
			} catch (e) {
				log.error('Error parsing date ' + dateString, e);
			}
		}
		
		//Convert to string
		if (date) {
			//set date
			var year = date.getFullYear();
			if (year < 2000) {
				year += 100;
				date.setFullYear(year);
			}
			
			date = format.format({
				value: date,
				type: dateFormat? dateFormat : format.Type.DATE
			});
		}
		
		log.debug('---datestring ' + dateString, date);
			
		return date;
	}
	
	function getOrderLineNumbers(options) {
		var fulfillmentId = options.fulfillmentId,
			poLine = options.poLine,
			soLine, fulfillmentLine;
		
		var recFulfillment = record.load({
			type: record.Type.ITEM_FULFILLMENT,
			id: fulfillmentId
		});
		
		if (recFulfillment) {
			var lineCount = recFulfillment.getLineCount({
				sublistId: 'item'
			});
			
			for (var i=0; i<lineCount; i++) {
				var currPoLine = recFulfillment.getSublistValue({
					sublistId: 'item',
					fieldId: 'poline',
					line: i
				});
				
				if (!currPoLine!=poLine)
					continue;
				else {
					soLine = recFulfillment.getSublistValue({
						sublistId: 'item',
						fieldId: 'orderline',
						line: i
					});
					fulfillmentLine = recFulfillment.getSublistValue({
						sublistId: 'item',
						fieldId: 'line',
						line: i
					});
					break;
				}
			}
		}
		
		return {
			poLine: poLine,
			soLine: soLine,
			fulfillmentLine: fulfillmentLine
		}
	}

	return {
		updatepo : updatePOItemData,
		validateline : validateLineNumber,
		getOrderLineNumbers: getOrderLineNumbers
	}
});