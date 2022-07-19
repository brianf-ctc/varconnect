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
 * Project Number: 001657
 * Script Name: CTC MR Serialization
 * Author: paolodl
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @Description Async process to sync native serials to custom serialnumber record
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    Remarks
 * 1.00		Jan 1, 2020	    <author email>	Initial Build
 * 
 */
define(['N/record',
        'N/search',
        'N/url'],

function(record,
		search,
		url) {
	
	function _generateLink(options) {
		var recId = options.id;
    	var protocol = 'https://';
    	var domain = url.resolveDomain({
    	    hostType: url.HostType.APPLICATION
    	});
    	var linkUrl = url.resolveRecord({
    		recordType: record.Type.INVENTORY_NUMBER,
    		recordId: recId,
    		isEditMode: false
    	});
    	
    	return protocol + domain + linkUrl;
	}
	
	function _searchRelatedTransactions(options) {
		var id = options.id,
			filters = [],
			columns = [];
		
		filters.push(search.createFilter({
			name: 'inventorynumber',
			join: 'inventorydetail',
			operator: search.Operator.ANYOF,
			values: id
		}));
		filters.push(search.createFilter({
			name: 'type',
			operator: 'anyof',
			values: ['SalesOrd', 'PurchOrd']
		}));
		
		columns.push(search.createColumn({
			name: 'trandate',
			sort: search.Sort.DESC
		}));
		columns.push(search.createColumn({
			name: 'internalid'
		}));
		columns.push(search.createColumn({
			name: 'type'
		}));
		
		var soFound = false,
			poFound = false,
			txnSearch = search.create({
				type: search.Type.TRANSACTION,
				filters: filters,
				columns: columns
			});
		
		txnSearch.run().each(function(result) {
			var type = result.getValue('type');
			
			if (type == 'SalesOrd' && !soFound)
				soFound = result.id;
			else if (type == 'PurchOrd' && !poFound)
				poFound = result.id;
			
			if (soFound && poFound)
				return false;
			else return true;
		});
		
		return {so: soFound, po: poFound};
	}

	function _createCustomSerial(options) {
		var id = options.id,
			item = options.item,
			serial = options.serial,
			so = options.so,
			po = options.po;
    	
    	var newSerial = record.create({
    		type: 'customrecordserialnum',
    		isDynamic: true
    	});
    	
    	newSerial.setValue({
    		fieldId: 'name',
    		value:  serial
    	});
    	newSerial.setValue({
    		fieldId: 'custrecordserialitem',
    		value:  item
    	});
    	newSerial.setValue({
    		fieldId: 'custrecord_ctc_vc_inv_no',
    		value:  _generateLink({id: id})
    	});
    	if (so)
	    	newSerial.setValue({
	    		fieldId: 'custrecordserialsales',
	    		value:  so
	    	});
    	if (po)
	    	newSerial.setValue({
	    		fieldId: 'custrecordserialpurchase',
	    		value:  po
	    	});
    	
    	newSerial.save();
    }
	
	function _processCustomSerial(options) {
		var id = options.id,
			item = options.item,
			serial = options.serial,
			txns = _searchRelatedTransactions({id: id});
		
		_createCustomSerial({
			id: id, 
			item: item,
			serial: serial,
			so: txns.so,
			po: txns.po
		});
		
		record.submitFields({
			type: record.Type.INVENTORY_NUMBER,
			id: id,
			values: {custitemnumber_ctc_synced: true}
		});
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
		log.audit("getInputData");
		
		var filters = [],
			columns = ['inventorynumber', 'internalid', 'item'];
		
		filters.push(search.createFilter({
			name: 'custitemnumber_ctc_synced',
			operator: 'is',
			value: false
		}));
		
//		var srch = search.create({
//			type: search.Type.INVENTORY_NUMBER,
//			filters: filters,
//			columns: columns
//		});
//		
//		log.debug('search count', srch.runPaged().count);
//		
//		return search.create({
//			type: search.Type.INVENTORY_NUMBER,
//			filters: filters,
//			columns: columns
//		});
		
		var srch = search.load({id: 'customsearch107'});
		log.debug('search count', srch.runPaged().count);
		
		return srch;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
    	log.debug("serialization: Map key: " + context.key, context.value);
    	var searchResult = JSON.parse(context.value),
    		id = searchResult.id,
    		serial = searchResult.values.inventorynumber,
    		item = searchResult.values.item.value;
    	
    	log.debug('processing for serial ' +  serial);
    	
    	_processCustomSerial({
    		id: id,
    		item: item,
    		serial: serial
    	});
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
    	log.audit("summarize");
		summary.mapSummary.errors.iterator().each(function (key, error)
		{
			log.error('Reduce Error for key: ' + key, error);
			return true;
		});
		var mapKeys = [];
			summary.mapSummary.keys.iterator().each(function (key)
				{
					mapKeys.push(key);
					return true;
			});
		log.audit('REDUCE keys processed', mapKeys);		
	}

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
    
});
