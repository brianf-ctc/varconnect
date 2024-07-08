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
 * 1.00		Sep 12, 2019	paolodl		Sets the is dropship flag depending
 * 
 */
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record',
        'N/search'],

function(record,
		search) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
		var newRecord = scriptContext.newRecord,
			createdFrom = newRecord.getValue({ fieldId: 'createdfrom' }),
			dropShipSO = newRecord.getValue({ fieldId: 'dropshipso' });
		
		log.debug('beforeLoad createdFrom', createdFrom);
		log.debug('beforeLoad dropShipSO', dropShipSO);
		
		if (createdFrom && dropShipSO){
			log.debug('beforeLoad dropshippo');
			newRecord.setValue({
				fieldId: 'custbody_isdropshippo',
				value: true
			});
		}
    }
    function beforeSubmit(scriptContext) {
    	if (scriptContext.type === scriptContext.UserEventType.CREATE ||
    			scriptContext.type === scriptContext.UserEventType.DROPSHIP) {
    		var newRecord = scriptContext.newRecord,
    			createdFrom = newRecord.getValue({ fieldId: 'createdfrom' }),
    			dropShipSO = newRecord.getValue({ fieldId: 'dropshipso' });
    		
    		log.debug('beforeSubmit createdFrom', createdFrom);
    		log.debug('beforeSubmit dropShipSO', dropShipSO);
    		
    		if (createdFrom && dropShipSO){
    			log.debug('beforeSubmit dropshippo');
    			newRecord.setValue({
    				fieldId: 'custbody_isdropshippo',
    				value: true
    			});
    		}
    	}
    }
    function afterSubmit(scriptContext) {
    	if (scriptContext.type === scriptContext.UserEventType.CREATE ||
    			scriptContext.type === scriptContext.UserEventType.DROPSHIP) {
    		var newRecord = scriptContext.newRecord,
    			createdFrom = newRecord.getValue({ fieldId: 'createdfrom' }),
    			dropShipSO = newRecord.getValue({ fieldId: 'dropshipso' });
    		
    		var newRec = record.load({
	    			type: newRecord.type,
	    			id: newRecord.id
    			}),
    			loadedDropShipSO = newRec.getValue({ fieldId: 'dropshipso' });
    		
    		log.debug('afterSubmit createdFrom', createdFrom);
    		log.debug('afterSubmit dropShipSO', dropShipSO);
    		log.debug('afterSubmit load dropShipSO', loadedDropShipSO);
    		
    		if (createdFrom && (dropShipSO || loadedDropShipSO)){
    			log.debug('afterSubmit dropshippo');
    			newRec.setValue({
    				fieldId: 'custbody_isdropshippo',
    				value: true
    			});
    			newRec.save();
    			var isDropShip = search.lookupFields({
    				type: newRecord.type,
    				id: newRecord.id,
    				columns: 'custbody_isdropshippo'
				});
    			log.debug('isDropShip', isDropShip.custbody_isdropshippo);
    			if (!isDropShip)
    				record.submitFields({
    					type: newRecord.type,
    					id: newRecord.id,
    					values: {
    						custbody_isdropshippo: true
    					},
    					ignoreMandatoryFields: true
    				});
    		}
    	}
    }

    return {
    	beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
