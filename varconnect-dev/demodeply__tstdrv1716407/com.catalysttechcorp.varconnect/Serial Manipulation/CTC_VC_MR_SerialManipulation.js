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
 * Project Number: 001225
 * Script Name: CT MR Serial Manipulation
 * Author: paolodl@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @Description Creates and/or updates serial nunmbrs and associates them to the speicifed transaction/s 
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 * 
 */
define(['N/record', 
        'N/search', 
        'N/runtime',
        'N/email',
        '../CTC_VC_Constants.js',
        '../CTC_VC_Lib_MainConfiguration.js',
        '../CTC_VC_Lib_LicenseValidator'],

function(record, 
		search, 
		runtime,
		email,
		constants,
		libMainConfig,
		libLicenseValidator) {
	var EMAIL_SUBJECT = ' Serial Numbers need to be rechecked for ',
		EMAIL_BODY_DUP = 
			'Please double check transaction {txn} for the Serial Numbers to be processed. \n'+
			'The following Serial Numbers to be created are duplicates: \n{dup}\n\n',
		EMAIL_BODY_DNE = 
			'Please double check transaction {txn} for the Serial Numbers to be processed. \n'+
			'The following Serial numbers to be updated are not yet created: \n{dne}'
//		,CC_ITEM_RECEIPT = ['evasconcellos@myriad360.com', 'serials@myriad360.com'],
//		CC_ITEM_FULFILLMENT =['atief@myriad360.com', 'serials@myriad360.com']
	;
	
	function _validateLicense(options) {
		var mainConfig = options.mainConfig,
			license = mainConfig.license,
			response = libLicenseValidator.callValidationSuitelet({ license: license,
				external: true}),
			result = true;
		
		if (response == 'invalid') {
			log.error('License expired', 'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.');
			result = false;
		}
		
		return result;
	}
	
	function _loadMainConfig() {
		var mainConfig = libMainConfig.getMainConfiguration();
		
		if (!mainConfig) {
			log.error('No VAR Connect Main Coniguration available');
		} else return mainConfig;
	}

	//Copied over from SerialsLibrary. Currently having errors regarding module scope even if library is Public
    function _createSerial(serial, poId, itemId, soId, ifId, raId, vaId, irId) {
        var rs = search.global({ keywords: 'serial: '+serial});
        log.debug("Global search result", rs);

        if (rs.length == 0) {
            log.debug("saveSerial", serial);
            var sn_record = record.create({
                type: 'customrecordserialnum'
            })
            sn_record.setValue({
                fieldId: 'name',
                value: serial
            })
            sn_record.setValue({
                fieldId: 'custrecordserialpurchase',
                value: poId
            })
            sn_record.setValue({
                fieldId: 'custrecordserialitem',
                value: itemId
            })
            sn_record.setValue({
                fieldId: 'custrecordserialsales',
                value: soId
            })
            sn_record.setValue({
                fieldId: 'custrecorditemfulfillment',
                value: ifId
            });
            sn_record.setValue({
                fieldId: 'custrecorditemreceipt',
                value: irId
            });
            sn_record.setValue({
                fieldId: 'custrecordrmanumber',
                value: raId
            });
            sn_record.setValue({
                fieldId: 'custrecordvendorrma',
                value: vaId
            });
            var sc = sn_record.save();
            log.debug("New serial id",sc);
        } else {
            log.debug("Matching serial found");
        }

        return sc ? sc : ""
    }
    
    function _updateSerial(serial, recType, recId) {
        var rs = search.global({ keywords: 'serial: '+serial}),
        	sc;
        log.debug("Global search result", rs);

        if (rs.length == 1) {
        	var field = null;
        	
        	switch (recType) {
        		case record.Type.INVOICE:
        			field = 'custrecordserialinvoice';
        			break;
        		case record.Type.ITEM_FULFILLMENT:
        			field = 'custrecorditemfulfillment';
    				break;
        		case record.Type.ITEM_RECEIPT:
        			field ='custrecorditemreceipt';
    				break;
        		case record.Type.RETURN_AUTHORIZATION:
        			field = 'custrecordrmanumber';
    				break;
        		case record.Type.VENDOR_RETURN_AUTHORIZATION:
        			field = 'custrecordvendorrma';
    				break;
				default:
					return "";
        	}
        	
        	var val = {};
        	val[field] = recId;
        	
        	sc = record.submitFields({
        		type: 'customrecordserialnum',
        		id: rs[0].id,
        		values: val
        	});
        } else if (rs.length > 1) {
        	log.debug("Multiple serials found");
        } else {
            log.debug("Matching serial not found");
        }
        return sc ? sc : ""
    }
	
	//Splits the input string via comma, line break, or spaces
	function _split(inputString) {
		var result = [];
		
		if (inputString) {
			inputString = inputString.trim().replace(/[\r\n, ]/g,',');
			inputString = inputString.replace(/,(?=,)/g,'');
			var result = inputString.split(',');
		}
		
		return result;
	}
	
	/**
	 * Update transaction to mark serials as processed
	 */
	function _updateTransactionSerials(options) {
    	var recType = runtime.getCurrentScript().getParameter("custscript_vc_type"),
			recId = runtime.getCurrentScript().getParameter("custscript_vc_id")
			duplicateSerials = options.duplicateSerials,
			dneSerials = options.dneSerials;
    	
	    var rec = record.load({
		    	type: recType,
		    	id: recId
		    }),
		    itemLen = rec.getLineCount({ sublistId: 'item' });

	    for (var itemCounter=0; itemCounter<itemLen; itemCounter++) {
	    	var serialString = rec.getSublistValue({
		    		sublistId: 'item',
		    		fieldId: constants.Columns.SERIAL_NUMBER_SCAN,
		    		line: itemCounter
		    	}),
		    	serialUpdateString = rec.getSublistValue({
		    		sublistId: 'item',
		    		fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
		    		line: itemCounter
		    	}),
		    	newSerials = [],
		    	newDneSerials = [];
	    	
	    	var serialArray = _split(serialString),
	    		serialUpdateArray = _split(serialUpdateString);
	    	
	    	serialArray.forEach(function(serial) {
	    		if (serial && duplicateSerials.indexOf(serial) > -1)
	    			newSerials.push('DUP-FOUND-'+serial);
	    	});
	    	serialUpdateArray.forEach(function(serial) {
	    		if (serial && dneSerials.indexOf(serial) > -1)
	    			newDneSerials.push('DNE-'+serial);
	    	});
	    	
	    	rec.setSublistValue({
	    		sublistId: 'item',
	    		fieldId: constants.Columns.SERIAL_NUMBER_SCAN,
	    		line: itemCounter,
                value: newSerials.join('\n')
	    	});
	    	
	    	//Clear out serial update field
	    	rec.setSublistValue({
	    		sublistId: 'item',
	    		fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
	    		line: itemCounter,
                value: newDneSerials.join('\n')
	    	});
	    }
	    
	    rec.save();
	}
	
	/**
	 * Sends out an email notification to the user and corresponding email addresses if there are duplicate and/or DNE serial numbers 
	 */
	function _sendEmail(options) {
		var duplicate = options.duplicate,
			dne = options.dne,
			sender = runtime.getCurrentScript().getParameter("custscript_vc_sender"),
			recId = runtime.getCurrentScript().getParameter("custscript_vc_id"),
			recType = runtime.getCurrentScript().getParameter("custscript_vc_type"),
			txnNumber;
		
		var lookup = search.lookupFields({
			type: recType,
			id: recId,
			columns: ['tranid']
		});
		
		if (lookup &&
				lookup.tranid)
			txnNumber = lookup.tranid;
		
		var recipient = sender,
			cc = [sender];
		
		if (recType == record.Type.ITEM_RECEIPT)
			cc = cc.concat(CC_ITEM_RECEIPT);
		else if (recType == record.Type.ITEM_FULFILLMENT)
			cc = cc.concat(CC_ITEM_FULFILLMENT);
		
		if (duplicate && duplicate.length > 0) {
			log.debug('Sending email for duplicate serials');
			var subject = 'Duplicate' + EMAIL_SUBJECT + txnNumber,
				body = EMAIL_BODY_DUP.replace('{txn}', txnNumber)
					.replace('{dup}', duplicate.join(', '));
			
			email.send({
			    author: sender,
			    recipients: recipient,
			    cc: cc,
			    subject: subject,
			    body: body
			});
		} 
		if (dne && dne.length > 0) {
			log.debug('Sending email for dne serials');
			var subject = 'Non-existent' + EMAIL_SUBJECT + txnNumber,
				body = EMAIL_BODY_DNE.replace('{txn}', txnNumber)
					.replace('{dne}', dne.join(', '));
			
			email.send({
			    author: sender,
			    recipients: recipient,
			    cc: cc,
			    subject: subject,
			    body: body
			});
		}
	}
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
    	var recType = runtime.getCurrentScript().getParameter("custscript_vc_type"),
    		recId = runtime.getCurrentScript().getParameter("custscript_vc_id"),
    		mainConfig = _loadMainConfig();
    	
    	_validateLicense({ mainConfig: mainConfig });
        
    	if (!mainConfig || !mainConfig.serialScanUpdate) {
    		//Terminate if Serials Scan and Update functionality is not set
    		log.audit('Serials Scan and Update functionality is not set');
    		return;
    	}
        
        var rec = record.load({
        	type: recType,
        	id: recId
        });
        
        if (!rec)
        	log.error('Invalid record', 'Type: + ' + recType + ' | Id: ' + recId);
        
        var itemLen = rec.getLineCount({ sublistId: 'item' }),
        	createdFrom = rec.getValue({ fieldId: 'createdfrom' }),
        	recordType = rec.type,
        	poId = '',
        	soId = '',
        	ifId = '',
        	irId = '',
        	returnAuthId = '',
        	vendorAuthId = '',
        	returnObj = {};
        	returnObj = [];
        
        if (recordType == 'itemreceipt') {
        	irId = recId;
        	var usePO = true;
        	var lookup = search.lookupFields({
        		type: search.Type.TRANSACTION,
        		id: createdFrom,
        		columns: ['type', 'createdfrom']
        	});
        	
        	if (lookup) {
        		if (lookup.type &&
        				lookup.type.length > 0 &&
        				lookup.type[0].value == 'RtnAuth') {
        			returnAuthId = createdFrom;
        			usePO = false;
	        	} else if (lookup.createdfrom && lookup.createdfrom.length > 0) 
	    			soId = lookup.createdfrom[0].value;
	        }
        	
        	if (usePO)
        		poId = createdFrom;
        } else if (recordType == 'itemfulfillment') {
        	ifId = recId;
        	var useSO = true;
        	var lookup = search.lookupFields({
        		type: search.Type.TRANSACTION,
        		id: createdFrom,
        		columns: ['type']
        	});
        	
        	if (lookup) {
        		if (lookup.type &&
        				lookup.type.length > 0 &&
        				lookup.type[0].value == 'VendAuth') {
        			vendorAuthId = createdFrom;
        			useSO = false;
	        	}
        	}
        	
        	if (useSO)
        		soId = createdFrom;
        }
        
        for (var itemCounter=0; itemCounter<itemLen; itemCounter++) {
        	var itemNum = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'item',
        		line: itemCounter
        	});
        	var serialString = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: constants.Columns.SERIAL_NUMBER_SCAN,
        		line: itemCounter
        	});
        	var updateSerialString = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
        		line: itemCounter
        	});
        	var podoc = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'podoc',
        		line: itemCounter
        	});
        	if (podoc)
        		poId = podoc;
        	
        	var serialArray = _split(serialString);
        	var updateSerialArray = _split(updateSerialString);
        	
        	for (var i in serialArray)
//        		returnObj[serialArray[i]] = {
//        			serial: serialArray[i],
//        			itemNum: itemNum,
//        			ifId: recId,
//        			soId: soId,
//        			poId: poId};
        		returnObj.push({
        			command: 'create',
        			serial: serialArray[i],
        			itemNum: itemNum,
        			ifId: ifId,
        			irId: irId,
        			soId: soId,
        			poId: poId,
        			returnAuthId: returnAuthId,
        			vendAuthId: vendorAuthId});
        	
        	for (var i in updateSerialArray) {
        		if (serialArray.indexOf(updateSerialArray[i]) == -1) 
	        		returnObj.push({
	        			command: 'update',
	        			serial: updateSerialArray[i],
	        			recType: recType,
	        			recId: recId});
        	}
        }
        
        log.debug('returnObj', returnObj);
        
        return returnObj;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function reduce(context) {
    	var data = JSON.parse(context.values[0]),
    		command = data.command,
    		serial = data.serial,
    		ifId = data.ifId,
    		irId = data.irId,
    		itemId = data.itemNum,
    		soId = data.soId,
    		poId = data.poId,
    		raId = data.returnAuthId,
    		vaId = data.vendAuthId,
    		recType = data.recType,
    		recId = data.recId,
    		serialId;
    	
    	log.debug('data', data);
    	
		if (!!serial)
			if (command == 'create') serialId = _createSerial(serial, poId, itemId, soId, ifId, raId, vaId, irId);
			else if (command == 'update') serialId = _updateSerial(serial, recType, recId);
		
		if (serialId)
			context.write({
				key: 'success',
				value: serial
			});
		else {
			if (command == 'create')
				context.write({
					key: 'duplicate',
					value: serial
				});
			else if (command == 'update')
				context.write({
					key: 'dne',
					value: serial
				});
		}
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
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

        var duplicateSerials = [],
        	dneSerials = [];
        summary.output.iterator().each(function(key, value) {
        	if (key == 'duplicate')
        		duplicateSerials.push(value);
        	else if (key == 'dne')
        		dneSerials.push(value);
        	return true;
        });
        
        log.debug('duplicateSerials', duplicateSerials);
        log.debug('dneSerials', dneSerials);
        
        _updateTransactionSerials({
        	duplicateSerials: duplicateSerials,
        	dneSerials: dneSerials
        	});
        
        if (duplicateSerials.length > 0 ||
        		dneSerials.length > 0) {
        	_sendEmail({
        		duplicate: duplicateSerials,
        		dne: dneSerials
        	});
        }        	
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
    
});
