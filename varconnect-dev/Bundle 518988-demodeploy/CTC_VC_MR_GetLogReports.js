/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
**/

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author ajdeleon
**/

/*jshint esversion: 9 */ 
define((require) => {

	const ns_search 	= require('N/search');
	const ns_error 		= require('N/error');
	const ns_runtime 	= require('N/runtime');
	const ns_https 		= require('N/https');
	const ns_url 		= require('N/url');
	const ns_record 	= require('N/record');
	const ns_format 	= require('N/format');
	const oauth 		= require('./oauth');

	const EntryPoint = {};
	const SCRIPT_PARAMETER_NAMES = {
	    'date':{optional:false, id:'custscript_vc_date'},
	    'additionalParams':{optional:true, id:'custscript_vc_addtlparams'},
	};

	const RECORD = {
		VCLOGREP: {
			ID: 'customrecord_ctc_vcsp_log_summary',
			FIELD: {
				APPLICATION: 'custrecord_ctc_vclog_application',
				CATEGORY: 'custrecord_ctc_vclog_category',
				COUNT: 'custrecord_ctc_vclog_count',
				DATE: 'custrecord_ctc_vclog_date',
				TYPE: 'custrecord_ctc_vclog_type',
				VENDOR: 'custrecord_ctc_vclog_vendorconfig',
				TRANSACTION:'custrecord_ctc_vclog_transaction',
				AMOUNT: 'custrecord_ctc_vclog_amount',
				LOGKEY: 'custrecord_ctc_vclog_key',
				COMPANYNAME:'custrecord_ctc_vclog_compname',
				ACCOUNTID:'custrecord_ctc_vclog_account',
			}
		}
	};

	const VCLog_Report = {
		addLogReport:(arrValues,reportKey)=>{
		    try{
		    	var logReportId = VCLog_Report.searchLogReport(reportKey);

		        var VCLOGREP_REC = RECORD.VCLOGREP;

		        var recLogReport = logReportId
		            ? ns_record.load({ type: VCLOGREP_REC.ID, id: logReportId })
		            : ns_record.create({ type: VCLOGREP_REC.ID });

		        // process the values
		        var vcLogRepValues = {};
		        for (let fldKey in VCLOGREP_REC.FIELD) {
		            vcLogRepValues[VCLOGREP_REC.FIELD[fldKey]] = arrValues[0][VCLOGREP_REC.FIELD[fldKey]];
		        }

		        if(!Helper.isEmpty(vcLogRepValues[VCLOGREP_REC.FIELD.DATE])){
		        	vcLogRepValues[VCLOGREP_REC.FIELD.DATE] = ns_format.parse({
		        	    value: new Date(vcLogRepValues[VCLOGREP_REC.FIELD.DATE]),
		        	    type: ns_format.Type.DATE
		        	});
		        }

		        log.debug('.. vcLogRepValues: ', vcLogRepValues);

		        // set the values
		        for (var fld in vcLogRepValues) {
		            var val = vcLogRepValues[fld];
		            if (!val) continue;
		            recLogReport.setValue({ fieldId: fld, value: val });
		        }
		        var recId = recLogReport.save();
		        log.audit('success',`Added log report id: ${recId}`);
		    }catch (error) {
		    	log.error('addLogReport',error);
		    }

		    return true;
		},
		searchLogReport:(reportKey) => {
			if (!reportKey) return false;
		    var VCLOGREP_REC = RECORD.VCLOGREP;
		    var logReportSearch = ns_search.create({
		        type: VCLOGREP_REC.ID,
		        filters: [[VCLOGREP_REC.FIELD.LOGKEY, 'is', reportKey]],
		        columns: ['internalid']
		    });
		    var logReportId = null;
		    logReportSearch.run().each((searchRow) => {
		        logReportId = searchRow.getValue({ name: 'internalid' });
		    });
		    return logReportId;
		}
	};


	EntryPoint.getInputData=()=>{
		return ns_search.create({
			type: "customrecord_ctc_vcsp_reportscred",
			filters:[
				["isinactive","is","F"]
			],
			columns:[
				"name",
				"custrecord_ctc_vclog_accountid",
				"custrecord_ctc_vclog_clientid",
				"custrecord_ctc_vclog_clientsecret",
				"custrecord_ctc_vclog_tokenid",
				"custrecord_ctc_vclog_tokensecret",
				"custrecord_ctc_vclog_url",
				"custrecord_ctc_vclog_scriptid",
				"custrecord_ctc_vclog_deploymentid"
			]
		});
	};

	EntryPoint.map=(context)=>{
		let objValue = JSON.parse(context.value);
		let objValues = objValue.values;

		//fetch the ns_url with parameters
		let objParams = Helper.getScriptParameters();
		let stUrl = ns_url.format({
			domain: objValues.custrecord_ctc_vclog_url,
			params: {
				script:objValues.custrecord_ctc_vclog_scriptid,
				deploy:objValues.custrecord_ctc_vclog_deploymentid,
				// date:`${objParams.date}&${objParams.additionalParams}`
			}
		});
		stUrl = `${stUrl}&date=${objParams.date}${objParams.additionalParams||''}`;

		//get the headers
		let objHeaders = oauth.getHeaders({
        	url:stUrl,
            method:'GET',
            tokenKey: objValues.custrecord_ctc_vclog_tokenid,
            tokenSecret: objValues.custrecord_ctc_vclog_tokensecret,
            realm:objValues.custrecord_ctc_vclog_accountid,
            consumer:{
            	key: objValues.custrecord_ctc_vclog_clientid,
            	secret: objValues.custrecord_ctc_vclog_clientsecret
            }
        });
        log.debug('objHeaders',objHeaders);

        //send request
        let stResponse = ns_https.get({
			url:stUrl,
			headers:objHeaders
		});

        if(!Helper.isJsonParsable(stResponse.body)){
        	log.error('response body',stResponse.body);
        }
        else{
        	let objBody = JSON.parse(stResponse.body);
        	for(let i=0; i<objBody.data.length; i++){
        		let logKey = objBody.data[i].custrecord_ctc_vclog_key;
        		let accountId = objBody.data[i].custrecord_ctc_vclog_account;
        		context.write({key:`${logKey}_${accountId}`,value:objBody.data[i]});
        	}
        }
	};

	EntryPoint.reduce=(context)=>{
		log.debug('reduce',context);
		let arrValues = context.values;
		arrValues = arrValues.map(JSON.parse);
		let logReportKey = arrValues[0][RECORD.VCLOGREP.FIELD.LOGKEY];
		VCLog_Report.addLogReport(arrValues,logReportKey);
	};

	EntryPoint.summarize=(summary)=>{
	    let type = summary.toString();
	    log.audit('[Summarize] '+type, 'Usage Consumed: '+summary.usage+' | Number of Queues: '+summary.concurrency+' | Number of Yields: '+summary.yields);
	    summary.output.iterator().each(function(key, value) {
	        return true;
	    });
	    logErrorIfAny(summary);
	};

	const logErrorIfAny=(summary)=>{
	    let inputSummary = summary.inputSummary;
	    let mapSummary = summary.mapSummary;
	    let reduceSummary = summary.reduceSummary;
	    //get input data ns_error
	    if (inputSummary.error){
	        let e = ns_error.create({
	            name: 'Error on Get Input Data',
	            message: inputSummary.error
	        });
	        log.error('Input Data',e.message);
	    }
	    handleErrorInStage('map', mapSummary);
	    handleErrorInStage('reduce', reduceSummary);
	};

	const handleErrorInStage=(stage, summary)=>{
	    let errorMsg = [];
	    summary.errors.iterator().each(function(key, value) {
	        let msg = 'SCRIPT FAILURE: ' + key + '. Error was:' + JSON.parse(value).message;
	        errorMsg.push(msg);
	        return true;
	    });
	    if (errorMsg.length > 0) {
	        log.error(stage,JSON.stringify(errorMsg));
	    }
	};

	const Helper = {
		isJsonParsable:(stValue)=>{
			try{JSON.parse(stValue); return true; }
			catch(error){ return false; }
		},
		getScriptParameters:()=>{
			var stLogTitle = 'getScriptParameters';
			var parametersMap = {};
			var scriptContext = ns_runtime.getCurrentScript();
			var obj;
			var value;
			var optional;
			var id;
			var arrMissingParams = [];
			
			for ( let key in SCRIPT_PARAMETER_NAMES)
			{
			    if (SCRIPT_PARAMETER_NAMES.hasOwnProperty(key))
			    {
			        obj = SCRIPT_PARAMETER_NAMES[key];
			        if (typeof obj === 'string')
			        {
			            value = scriptContext.getParameter(obj);
			        }
			        else
			        {
			            id = obj.id;
			            optional = obj.optional;
			            value = scriptContext.getParameter(id);
			        }
			        if (value || value === false || value === 0)
			        {
			            parametersMap[key] = value;
			        }
			        else if (!optional)
			        {
			            arrMissingParams.push(key + '[' + id + ']');
			        }
			    }
			}
			
			if (arrMissingParams && arrMissingParams.length)
			{
			    var objError = {};
			    objError.name = 'Missing Script Parameter Values';
			    objError.message = 'The following script parameters are empty: ' + arrMissingParams.join(', ');
			    objError = ns_error.create(objError);
			    for ( let key in parametersMap)
			    {
			        if (parametersMap.hasOwnProperty(key))
			        {
			            objError[key] = parametersMap[key];
			        }
			    }
			    throw objError;
			}
			log.audit(stLogTitle, parametersMap);
			return parametersMap;
		},
		isEmpty: (stValue) => {
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
		                for (let k in v) return false;
		                return true;
		            })(stValue))
		    );
		},
	};
	return EntryPoint;
});