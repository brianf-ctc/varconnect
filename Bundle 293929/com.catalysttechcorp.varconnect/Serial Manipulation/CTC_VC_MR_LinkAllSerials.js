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
 * Script Name: VAR Connect Link All SO Serial MR
 * Author: paolodl@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @Description Links all serial numbers from the createdfrom SO to the new Invoice 
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 * 1.20		Apr 2, 2021		paolodl@nscatalyst.com	Only process unlinked serials
 * 
 */
define(['N/record', 
        'N/search',
        'N/runtime',
        '../CTC_VC_Constants.js',
        '../CTC_VC_Lib_MainConfiguration.js',
        '../CTC_VC_Lib_LicenseValidator'],

function(record, 
		search,
		runtime,
		constants,
		libMainConfig,
		libLicenseValidator) {
	
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
	
	function _updateTransaction() {
    	var recType = runtime.getCurrentScript().getParameter("custscript_vc_all_type"),
    		recId = runtime.getCurrentScript().getParameter("custscript_vc_all_id");
    	
    	if(recType == record.Type.INVOICE) {
    	    var rec = record.load({
		    	type: recType,
		    	id: recId
		    });
    	    rec.save();
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
    	log.debug('getInputData');
    	var recType = runtime.getCurrentScript().getParameter("custscript_vc_all_type"),
    		recId = runtime.getCurrentScript().getParameter("custscript_vc_all_id"),
    		mainConfig = _loadMainConfig();
    	
    	_validateLicense({ mainConfig: mainConfig });
    	
    	if (!mainConfig || !mainConfig.copySerialsInv) {
    		//Terminate if Copy Serials functionality is not set
    		log.audit('Copy Serials functionality is not set');
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
        	itemList = [],
        	soId = '',
        	ifId = '',
        	returnObj = [];
        
        for (var itemCounter=0; itemCounter<itemLen; itemCounter++) {
        	var itemNum = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: 'item',
        		line: itemCounter
        	});
        	var updateSerialString = rec.getSublistValue({
        		sublistId: 'item',
        		fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
        		line: itemCounter
        	});
        	
        	
        	if (!updateSerialString || updateSerialString.trim().length < 1)
        		itemList.push(itemNum);
        }
        
        if (recordType == 'itemfulfillment') {
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
        } else if (recordType == 'invoice') {
        	soId = createdFrom;
        }
        
        if (!soId)
        	throw new Error('No source Sales Order');
        
		var filters = [{
				name: 'custrecordserialsales',
				operator: 'anyof',
				values: soId
			},
			{
				name: 'custrecordserialitem',
				operator: 'anyof',
				values: itemList
			}];
		
		if (recType == record.Type.ITEM_FULFILLMENT) {
			filters.push({
				name: 'custrecorditemfulfillment',
				operator: 'isempty'
			});
		} else if (recType == record.Type.INVOICE) {
			filters.push({
				name: 'custrecordserialinvoice',
				operator: 'isempty'
			});
		}
			
		return search.create({
			type: 'customrecordserialnum',
			filters: filters,
			columns: ['internalid']
		});
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
    	var sc;
    	try {
	    	log.debug("reduce");
	    	
	    	var data = JSON.parse(context.values[0]);
	    	
	    	if (data) {
	    		var serialId = data.id,
		    		recType = runtime.getCurrentScript().getParameter("custscript_vc_all_type"),
		    		recId = runtime.getCurrentScript().getParameter("custscript_vc_all_id"),
		        	val = {},
		        	field;
	    		
	    		if (recType == record.Type.ITEM_FULFILLMENT) {
	    			field = 'custrecorditemfulfillment';
		        	val[field] = recId;
	    		} else if (recType == record.Type.INVOICE) {
	    			field = 'custrecordserialinvoice';
		        	val[field] = recId;
	    		}
	    		
	    		if (field)
	            	sc = record.submitFields({
	            		type: 'customrecordserialnum',
	            		id: serialId,
	            		values: val
	            	});
	    	}
    	} catch (e) {
    		log.error('reduce', e.message);
    	}
    	
    	return sc ? sc : "";
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
        if (reduceKeys && reduceKeys.length > 0)
        	_updateTransaction();
        log.audit('REDUCE keys processed', reduceKeys);
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
