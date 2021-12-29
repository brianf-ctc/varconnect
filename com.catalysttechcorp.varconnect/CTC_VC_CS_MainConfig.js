/**
 * Copyright (c) 2017 Catalyst Tech Corp
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
 * 1.00		July 25, 2019	paolodl		Enables and disables fields depending on current selection
 * 
 */

/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['./CTC_VC_Constants'],

function(constants) {
	function _disableAndClearFields(options) {
		var currentRecord = options.currentRecord,
			fields = options.fields;
		
		for (var field in fields) {
			currentRecord.setValue({
				fieldId: fields[field],
				value: false
			});
			var field = currentRecord.getField({ fieldId: fields[field] });
			field.isDisabled = true;
		}
	}
	
	function _enableFields(options) {
		var currentRecord = options.currentRecord,
		fields = options.fields;
	
		for (var field in fields) {
			var field = currentRecord.getField({ fieldId: fields[field] });
			field.isDisabled = false;
		}
	}
	
	function _toggleFields(options) {
		var isEnabled = options.isEnabled;
		
		if (isEnabled)
			_enableFields(options);
		else
			_disableAndClearFields(options);
	}
    
    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {
    	var currentRecord = scriptContext.currentRecord,
    		fieldId = scriptContext.fieldId,
    		fields;
    	
    	switch (fieldId) {
    		case constants.Fields.MainConfig.PROCESS_DROPSHIPS:
    			fields = [constants.Fields.MainConfig.CREATE_ITEM_FULFILLMENTS,
    			          constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_DROPSHIPS,
    			          constants.Fields.MainConfig.CREATE_SERIAL_DROPSHIPS];
    			break;
    		case constants.Fields.MainConfig.PROCESS_SPECIAL_ORDERS:
    			fields = [constants.Fields.MainConfig.CREATE_ITEM_RECEIPTS, 
    			          constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS,
    			          constants.Fields.MainConfig.CREATE_SERIAL_SPECIAL_ORDERS];
    			break;
    	}
    	
    	if (fields)
			_toggleFields({
				currentRecord: currentRecord,
				fields: fields,
				isEnabled: currentRecord.getValue({ fieldId: fieldId })
			});

    }

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {

    }

    return {
        fieldChanged: fieldChanged,
//        saveRecord: saveRecord
    };
    
});
