/**
 * Copyright (c) 2024 Catalyst Tech Corp
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
	const ns_format 	= require('N/format');
	const ns_email  	= require('N/email');
	const ns_config  	= require('N/config');
	const oauth 		= require('./CTC_VC_Oauth');

	const EntryPoint = {};
	const SCRIPT_PARAMETER_NAMES = {
	    'fromDate': {optional:true, id:'custscript_vc_fromdate'},
	    'toDate': 	{optional:true, id:'custscript_vc_todate'},
	};
	const CRED = {
		ACCOUNT_ID: 	'tstdrv1716407',
		CONSUMER_KEY: 	'a83a3a8edd891ba3390f75a74534e3674d9300141ae24faccd30079cb3da973a',
		CONSUMER_SECRET:'409713a8d36fbb5f1b1c7986cb2524b7e47ab419d8a1233774c14347d5bbe9bb',
		TOKEN_ID: 		'893101a49f97a1364f615f027b90599c34852fcd7d4d95efebaac47a53e13188',
		TOKEN_SECRET: 	'46bc083fca1f65e72ef63b297868cab3cf83f02bd7da6c80b07bf6e2f44251ed',
		SCRIPT_ID: 		'889',
		DEPLOYMENT_ID: 	'1',
		SCRIPT_URL: 	'https://tstdrv1716407.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
	};

	EntryPoint.getInputData=()=>{
		let objParams = Helper.getScriptParameters();

		//set date filter
		let arrFilters = [];
		if(!Helper.isEmpty(objParams.fromDate) && !Helper.isEmpty(objParams.toDate)){
			let fromDate = ns_format.format({
				value:new Date(objParams.fromDate),
				type:ns_format.Type.DATE
			});
			let toDate = ns_format.format({
				value:new Date(objParams.toDate),
				type:ns_format.Type.DATE
			});
			arrFilters.push(["custrecord_ctc_vclog_date","within",fromDate,toDate]);
		}
		else{
			arrFilters.push(["custrecord_ctc_vclog_date","on","today"]);
		}

		return ns_search.create({
			type: "customrecord_ctc_vcsp_log_summary",
			filters: arrFilters,
			columns:[
				"created",
				"internalid",
				"custrecord_ctc_vclog_amount",
				"custrecord_ctc_vclog_application",
				"custrecord_ctc_vclog_count",
				"custrecord_ctc_vclog_date",
				"custrecord_ctc_vclog_vendorconfig",
				"custrecord_ctc_vclog_transaction",
				"custrecord_ctc_vclog_type",
				"custrecord_ctc_vclog_category",
				"custrecord_ctc_vclog_key",
				"custrecord_ctc_vclog_account",
				"custrecord_ctc_vclog_compname"
			]
		});
	};

	EntryPoint.map=(context)=>{
		let objValue = JSON.parse(context.value);
		let objValues = objValue.values;

		//group by date
		context.write({
			key:objValues.custrecord_ctc_vclog_date,
			value:objValues
		});
	};

	EntryPoint.reduce=(context)=>{
		let arrValues = context.values;
		
		//get restlet url
		let stUrl = ns_url.format({
			domain: CRED.SCRIPT_URL,
			params: {
				script:CRED.SCRIPT_ID,
				deploy:CRED.DEPLOYMENT_ID,
			}
		});

		//set headers
		let objHeaders = oauth.getHeaders({
        	url:stUrl,
            method:'POST',
            tokenKey: CRED.TOKEN_ID,
            tokenSecret: CRED.TOKEN_SECRET,
            realm:CRED.ACCOUNT_ID,
            consumer:{
            	key: CRED.CONSUMER_KEY,
            	secret: CRED.CONSUMER_SECRET
            }
        });
		objHeaders['Content-Type'] = "text/plain";

		//set body
		arrValues = arrValues.map(JSON.parse);
		let objBody = {rows:arrValues};
		
		//post
        let stResponse = ns_https.post({
			url:stUrl,
			headers:objHeaders,
			body:JSON.stringify(objBody)
		});

		context.write({key:context.key,value:stResponse});
	};

	EntryPoint.summarize=(summary)=>{
	    let type = summary.toString();
	    log.audit('[Summarize] '+type, 'Usage Consumed: '+summary.usage+' | Number of Queues: '+summary.concurrency+' | Number of Yields: '+summary.yields);
	    summary.output.iterator().each(function(key, value){
	    	log.audit(`Response Key: ${key}`,value);
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
	        sendEmail(JSON.stringify(errorMsg));
	    }
	};

	const sendEmail=(emailMsg)=>{
		ns_email.send({
		    author:(()=>{
		    	let ss = ns_search.create({
		    		type: "script",
		    		filters:[["scriptid","is",ns_runtime.getCurrentScript().id]],
		    		columns:["owner"]
		    	});
		    	let resultSet = ss.run();
		    	let arrResult = resultSet.getRange({start:0,end:1});
		    	return arrResult[0].getValue('owner');
		    })(),
		    recipients: 'aj@nscatalyst.com',
		    subject:(()=>{
		    	let ci = ns_config.load({type:ns_config.Type.COMPANY_INFORMATION});
		    	return `Send Log Reports - ${ci.getValue('companyname')} | ${ci.getValue('companyid')}`;
		    })(),
		    body:emailMsg,
		});
	};

	const Helper = {
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