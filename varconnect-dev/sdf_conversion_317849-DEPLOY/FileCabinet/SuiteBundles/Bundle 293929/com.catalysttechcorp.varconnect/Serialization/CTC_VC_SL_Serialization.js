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
 * Project Number: 
 * Script Name: CTC VC SL Serialization
 * Author: paolodl@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @Description Provides a page to manually schedule the Serialization MR
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jul 9, 2020	    paolodl@nscatalyst.com	Initial Build
 * 
 */
define(['N/ui/serverWidget',
        'N/task',
        'N/url',
        'N/runtime'],

function(ui,
		task,
		url,
		runtime) {
	var SCRIPT_ID = 'customscript_ctc_vc_mr_serialization',
		DEPLOYMENT_ID = 'customdeploy_ctc_vc_mr_serialization_man';

	//Creates the form
	function _createForm(context) {
		var method = context.request.method;
        var form = ui.createForm({
            title: 'Proces Native Serial Numbers'
        });
        
        if (method === 'GET') {
        	form.addSubmitButton({ label: 'Process' });
        } else if (method === 'POST') {
        	var field = form.addField({
            	id: 'processing_text',
            	label: 'Processing',
            	type: ui.FieldType.INLINEHTML
            });
            field.updateLayoutType({
                layoutType: ui.FieldLayoutType.STARTROW
            });
        	field.defaultValue = 'Script is currently processing serial numbers';
        }
        
//        var domain = url.resolveDomain({
//        	hostType: url.HostType.APPLICATION,
//        	accountId: runtime.accountId
//        });
//        var field = form.addField({
//        	id: 'mapreduce_link',
//        	label: 'Processing',
//        	type: ui.FieldType.INLINEHTML
//        });
//        field.updateLayoutType({
//            layoutType: ui.FieldLayoutType.STARTROW
//        });
//        field.defaultValue = '<a href="https://'+domain+'/app/common/scripting/mapreducescriptstatus.nl">Processing Status</a>';
        
        return form;
	}
   
	//Executes the Serialization MR script
	function _callMapReduce(options) {
		try{
			var mrTask = task.create({
					taskType: task.TaskType.MAP_REDUCE,
					scriptId: SCRIPT_ID,
					deploymentId: DEPLOYMENT_ID
				});
			var mrTaskId = mrTask.submit();
			log.debug('MR script called');
		} catch (e) {
			log.debug('ERROR', 'Error encountered when calling script ' + e);
		}
	}
	
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
    	var form = _createForm(context);
    	
    	if (context.request.method === 'POST')
    		_callMapReduce();

		context.response.writePage(form);
    }

    return {
        onRequest: onRequest
    };
    
});
