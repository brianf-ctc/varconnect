/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 * 
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @author ajdeleon
*/

define(function (require) {
	var ns_message = require('N/ui/message');

	var VC_CONFIG_FIELDS = require('./CTC_VC_ConfigVendorFields');

	var EntryPoint 			= {},
	Helper 					= {},
	objMsg 					= {};

	EntryPoint.saveRecord=function(context){
		try{
			var isError = false;
			var objRec = context.currentRecord;

			var xmlVendorField = (objRec.type=='customrecord_ctc_vc_vendor_config')?'custrecord_ctc_vc_xml_vendor':'custrecord_vc_bc_xmlapi_vendor';
			var xmlVendor = objRec.getValue(xmlVendorField);

			if(Helper.isEmpty(xmlVendor)){
				highlightField(xmlVendorField,'#ffeaa7');
				isError = true;
			}

			var objFields = (objRec.type=='customrecord_ctc_vc_vendor_config')?VC_CONFIG_FIELDS.ORDER_STATUS[xmlVendor]:VC_CONFIG_FIELDS.BILL_CREATE[xmlVendor];

			if(!Helper.isEmpty(objFields)){
				for(var fieldId in objFields){
					var fieldVal = objRec.getValue(fieldId);
					if(Helper.isEmpty(fieldVal) || (Array.isArray(fieldVal) && Helper.isEmpty(fieldVal[0]))){
						highlightField(fieldId,'#ffeaa7');
						isError = true;
					}
					else{
						highlightField(fieldId,'');
					}
				}
				if(isError===true){
					displayError({title:'Please fill out the required fields.'});
					return false;
				}
			}
			return true;
		}
		catch(ex){
			log.error('saveRecord',ex);
			displayError({message:ex.toString()});
		}
	};

	EntryPoint.fieldChanged=function(context){
		try{
			var objRec = context.currentRecord;
			var field = context.fieldId;

			var xmlVendorField = (objRec.type=='customrecord_ctc_vc_vendor_config')?'custrecord_ctc_vc_xml_vendor':'custrecord_vc_bc_xmlapi_vendor';

			if(field==xmlVendorField){
				var xmlVendor = objRec.getValue(xmlVendorField);
				var objFields = (objRec.type=='customrecord_ctc_vc_vendor_config')?VC_CONFIG_FIELDS.ORDER_STATUS[xmlVendor]:VC_CONFIG_FIELDS.BILL_CREATE[xmlVendor];

				if(!Helper.isEmpty(objFields)){
					for(var fieldId in objFields){
						var currentFieldValue = objRec.getValue(fieldId);
						if(!Helper.isEmpty(objFields[fieldId])){
							objRec.setValue({
								fieldId:fieldId,
								value:objFields[fieldId]
							});
						}
					}
				}
			}
		}
		catch(ex){
			log.error('saveRecord',ex);
			displayError({message:ex.toString()});
		}
	};


	function highlightField(fieldId,bgcolor){
		var field = document.querySelector("[aria-labelledby='"+fieldId+"_fs_lbl']");
		console.log('field',fieldId+"_fs_lbl");
		var tbl = field.getElementsByTagName("table")[0];
		console.log('tbl',tbl);
		if(tbl){
			tbl.style.backgroundColor = bgcolor;
		}
		else{
			field.style.backgroundColor = bgcolor;
		}
	}

	function displayError(option){
		if(!Helper.isEmpty(objMsg)){ setTimeout(objMsg.hide, 10); }
		objMsg = ns_message.create({
			title: option.title||'Error',
			message: option.message||'',
			type: ns_message.Type.WARNING
		});
		objMsg.show();
	}

	Helper.isEmpty=function(stValue){
		return (
		    stValue === '' ||
		    stValue == null ||
		    stValue == undefined ||
		    stValue == 'undefined' ||
		    stValue == 'null' ||
		    (util.isString(stValue) && stValue.trim() === '') ||
		    (util.isArray(stValue) && stValue.length == 0) ||
		    (util.isObject(stValue) &&
		        (function (v) {
		            for (var k in v) return false;
		            return true;
		        })(stValue))
		);
	};

	return EntryPoint;
});