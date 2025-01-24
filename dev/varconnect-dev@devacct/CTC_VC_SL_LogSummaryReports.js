/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author ajdeleon
**/

/*jshint esversion: 9 */ 
define((require) => {

	const SCRIPT_ID = 893;
	const DEPLOYMENT_ID = 'customdeploy_ctc_vc_sl_logsummaryreports';

	const serverWidget 	= require('N/ui/serverWidget'),
	query 				= require('N/query'),
	format 				= require('N/format'),
	https 				= require('N/https'),
	url 				= require('N/url'),
	EntryPoint 			= {},
	SCRIPT_LOGS 		= {};

	var objForm 		= {};

	EntryPoint.onRequest=(context)=>{
		let objRequest = context.request;
		let objResponse = context.response;

		try{
			let objParams = objRequest.parameters;
			// SCRIPT_LOGS.params = objParams;

			objForm = serverWidget.createForm({title: 'Log Summary Reports | Main Dashboard'});
            
            addButtons();
            addFields(objParams);

            if(objRequest.method == https.Method.POST){
            	showResults(objParams);
            }
            else{
            	let objSublist = addSublist();
            	populateSublist(objSublist,objRequest);
            }

            objResponse.writePage(objForm);
		}
		catch(ex){
			log.error('error',ex);
			objResponse.write({output:'Error <br/>'+ex.toString()});
		}
		finally{
		    log.debug('SCRIPT_LOGS',SCRIPT_LOGS);
		}
	};

	const addButtons=()=>{
	    objForm.addSubmitButton({label:'Submit'});

	    let stSuiteletUrl = url.resolveScript({
	        scriptId: SCRIPT_ID,
	        deploymentId: DEPLOYMENT_ID,
	        returnExternalUrl: false,
	    });
	    objForm.addButton({
            label   : 'Reset',
            id      : 'custpage_btn_reset',
            functionName : `(function(){
            	 window.onbeforeunload = function () {return null;};
            	 window.open("${stSuiteletUrl}", '_self');
            })();
            return false;`
        });
	};

	const addFields=(objParams)=>{
		//application ================
		let objAppField = objForm.addField({
		    id: 'custpage_application',
		    type: serverWidget.FieldType.SELECT,
		    label: 'Application',
		});
		addOptions({
			results:getResultGroupBy('custrecord_ctc_vclog_application'),
			field:objAppField,
			column:'custrecord_ctc_vclog_application'
		});
		log.debug('objParams.custpage_application',objParams.custpage_application);
		if(objParams.custpage_application!=='ORDER STATUS' && !Helper.isEmpty(objParams.custpage_application)){
			objAppField.defaultValue = objParams.custpage_application;
		}
		else{
			objAppField.defaultValue = 'ORDER STATUS';
		}

		//company name (account ID) ================
		let objLogCatField = objForm.addField({
		    id: 'custpage_compname',
		    type: serverWidget.FieldType.SELECT,
		    label: 'Company Name/Account ID',
		});
		addEmptyOption(objLogCatField);
		addOptions({
			results:getResultGroupBy('custrecord_ctc_vclog_compname'),
			field:objLogCatField,
			column:'custrecord_ctc_vclog_compname'
		});
		if(objParams.custpage_compname!=='-' && !Helper.isEmpty(objParams.custpage_compname)){
			objLogCatField.defaultValue = objParams.custpage_compname;
		}

		//vendor config ================
		let vendorLabel = 'Vendor Config';
		if(!Helper.isEmpty(objParams.custpage_compname) && objParams.custpage_compname !== '-'){
			vendorLabel = `Vendor Config for ${objParams.custpage_compname}`;
		}

		let objVendorConfigField = objForm.addField({
		    id: 'custpage_vendorconfig',
		    type: serverWidget.FieldType.SELECT,
		    label: vendorLabel,
		});

		addEmptyOption(objVendorConfigField);

		let vendorSqlWhere = '';
		if(objParams.custpage_compname!=='-' && !Helper.isEmpty(objParams.custpage_compname)){
			vendorSqlWhere = `WHERE UPPER(custrecord_ctc_vclog_compname) = UPPER('${objParams.custpage_compname}')`;
		}

		addOptions({
			results:getResultGroupBy('custrecord_ctc_vclog_vendorconfig',vendorSqlWhere),
			field:objVendorConfigField,
			column:'custrecord_ctc_vclog_vendorconfig'
		});
		if(objParams.custpage_vendorconfig!=='-' && !Helper.isEmpty(objParams.custpage_vendorconfig)){
			objVendorConfigField.defaultValue = objParams.custpage_vendorconfig;
		}

		//date ================
		let objDateField = objForm.addField({
		    id: 'custpage_date',
		    type: serverWidget.FieldType.SELECT,
		    label: 'Date',
		});
		addOptions({
			results:[
				{'filterdate':'By Day'},
				{'filterdate':'This Week'},
				{'filterdate':'Last Week'},
				{'filterdate':'This Month'},
				{'filterdate':'Last Month'},
				{'filterdate':'By Month'},
				{'filterdate':'By Quarter'},
			],
			field:objDateField,
			column:'filterdate'
		});
		if(objParams.custpage_date!=='-' && !Helper.isEmpty(objParams.custpage_date)){
			objDateField.defaultValue = objParams.custpage_date;
		}
	};

	const addOptions=(options)=>{
		let arrResults = options.results;
		let objField = options.field;
		let columnName = options.column;
		for(let i=0; i<arrResults.length; i++){
			let val =  arrResults[i][columnName]?arrResults[i][columnName]:'';
			//add option
		    objField.addSelectOption({
		        value:val.toUpperCase()||'-',
		        text: val||'-none-'
		    });
		}
	};

	const addEmptyOption=(objField)=>{
		objField.addSelectOption({
		    value: '-',
		    text:'&nbsp;'
		});
	};

	const getResultGroupBy=(columnName,whereQuery='')=>{
        let totalRows = getTotalRows();
        //get all rows more than the 5000 limit.
        let sql = `
			SELECT
				*
			FROM
				(
					SELECT
						ROWNUM AS RN,
						*
					FROM
						(
							SELECT 
								${columnName}
							FROM 
								customrecord_ctc_vcsp_log_summary
							${whereQuery}
							GROUP BY
								${columnName}
							ORDER BY
								${columnName} ASC
						)
				)
			WHERE
				( RN BETWEEN 0 AND ${totalRows} )
		`;
		log.debug('getResultGroupBy SQL',sql);
        let queryResults = query.runSuiteQL({query:sql});
		let arrResults = queryResults.asMappedResults();
		return arrResults;
	};

	const addSublist=()=>{
	    let objSublist = objForm.addSublist({
	        id : 'custpage_wip_sublist',
	        type : serverWidget.SublistType.LIST,
	        label : 'VAR Connect Log Summary',
	    });
	    objSublist.addField({
            id : 'custpage_line_date',
            label : 'Date',
            type : serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id : 'custpage_line_compname',
            label : 'Company (Account ID)',
            type : serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id : 'custpage_line_vendorconfig',
            label : 'Vendor Config',
            type : serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id : 'custpage_line_datecreated',
            label : 'Date Created',
            type : serverWidget.FieldType.TEXT
        });
	    objSublist.addRefreshButton();
	    return objSublist;
	};

	const populateSublist=(objSublist,objRequest)=>{
		let sql = `
		    SELECT 
		    	custrecord_ctc_vclog_date, 
		    	custrecord_ctc_vclog_compname, 
		    	custrecord_ctc_vclog_vendorconfig,
		    	created
		    FROM customrecord_ctc_vcsp_log_summary
		    WHERE RowNum <= 30
		    ORDER BY created DESC`;

	    
		let queryResults = query.runSuiteQL({query:sql});
		let arrResults = queryResults.asMappedResults();

		for(let i=0; i<arrResults.length; i++){
			objSublist.setSublistValue({
			    id:'custpage_line_date',
			    line:i,
			    value:arrResults[i].custrecord_ctc_vclog_date
			});
			objSublist.setSublistValue({
			    id:'custpage_line_compname',
			    line:i,
			    value:arrResults[i].custrecord_ctc_vclog_compname
			});
			objSublist.setSublistValue({
			    id:'custpage_line_vendorconfig',
			    line:i,
			    value:arrResults[i].custrecord_ctc_vclog_vendorconfig
			});
			objSublist.setSublistValue({
			    id:'custpage_line_datecreated',
			    line:i,
			    value:arrResults[i].created
			});
		}
	};

	const getAllRowsSql=(query)=>{
        let totalRows = getTotalRows();
        //get all rows more than the 5000 limit.
        let sql = `
			SELECT
				*
			FROM
				(
					SELECT
						ROWNUM AS RN,
						*
					FROM(${query})
				)
			WHERE
				( RN BETWEEN 0 AND ${totalRows} )
		`;

		return sql;
	};

    const getTotalRows=()=>{
        let sql = `
			SELECT 
				count(*) as count
			FROM 
				customrecord_ctc_vcsp_log_summary
			ORDER BY
				custrecord_ctc_vclog_date DESC
        	`;

        let queryResults = query.runSuiteQL({query:sql});
		let arrResults = queryResults.asMappedResults();
        return arrResults[0].count||0;
    };

    const showResults=(objParams)=>{

	    let objSublist = objForm.addSublist({
	        id : 'custpage_wip_sublist',
	        type : serverWidget.SublistType.LIST,
	        label : 'VAR Connect Log Summary',
	    });
        objSublist.addField({
            id : 'custpage_line_compname',
            label : 'Company (Account ID)',
            type : serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id : 'custpage_line_vendorconfig',
            label : 'Vendor Config',
            type : serverWidget.FieldType.TEXT
        });

        let orderQuery = '';
        let arrSelectQuery = [
        	'custrecord_ctc_vclog_category',
        	'SUM(custrecord_ctc_vclog_count) as a',
        	'custrecord_ctc_vclog_compname',
        	'custrecord_ctc_vclog_vendorconfig'
        ];
        let arrGroupQuery = [
        	'custrecord_ctc_vclog_category',
        	'custrecord_ctc_vclog_compname',
        	'custrecord_ctc_vclog_vendorconfig',
        ];
        let arrWhereQuery = [];

        if(objParams.custpage_date==='BY DAY' && !Helper.isEmpty(objParams.custpage_date)){
        	arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD') as d`);
        	arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD')`);

        	orderQuery = `ORDER BY d DESC`;
        }
       	else if(objParams.custpage_date==='THIS WEEK' && !Helper.isEmpty(objParams.custpage_date)){
       		arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD') as d`);
       		arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD')`);

       		arrWhereQuery.push(`custrecord_ctc_vclog_date >= trunc ( sysdate, 'iw' ) AND  custrecord_ctc_vclog_date  < trunc ( sysdate, 'iw' ) + 5`);
       		orderQuery = `ORDER BY d DESC`;

       	}
       	else if(objParams.custpage_date==='LAST WEEK' && !Helper.isEmpty(objParams.custpage_date)){
       		arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD') as d`);
       		arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM/DD')`);

       		arrWhereQuery.push(`custrecord_ctc_vclog_date >= next_day(trunc(sysdate), 'MONDAY') - 14 and custrecord_ctc_vclog_date < next_day(trunc(sysdate), 'MONDAY') - 7`);
       		orderQuery = `ORDER BY d DESC`;
       	}
       	else if(objParams.custpage_date==='THIS MONTH' && !Helper.isEmpty(objParams.custpage_date)){
       		arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM') as d`);
       		arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM')`);

       		arrWhereQuery.push(`custrecord_ctc_vclog_date BETWEEN trunc (sysdate, 'mm') AND SYSDATE`);
       		orderQuery = `ORDER BY d DESC`;
       	}
       	else if(objParams.custpage_date==='LAST MONTH' && !Helper.isEmpty(objParams.custpage_date)){
       		arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM') as d`);
       		arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM')`);

       		arrWhereQuery.push(`custrecord_ctc_vclog_date between add_months(trunc(sysdate,'mm'),-1) and last_day(add_months(trunc(sysdate,'mm'),-1))`);
       		orderQuery = `ORDER BY d DESC`;
       	}
        else if(objParams.custpage_date==='BY MONTH' && !Helper.isEmpty(objParams.custpage_date)){
        	arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM') as d`);
        	arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'YYYY/MM')`);

        	orderQuery = `ORDER BY d DESC`;
        }
        else if(objParams.custpage_date==='BY QUARTER' && !Helper.isEmpty(objParams.custpage_date)){
        	arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date, 'Q') as q`);
        	arrSelectQuery.push(`to_char(custrecord_ctc_vclog_date,'YYYY') as year`);

        	arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date, 'Q')`);
        	arrGroupQuery.push(`to_char(custrecord_ctc_vclog_date,'YYYY')`);

        	orderQuery = `ORDER BY year DESC, q DESC`;
        }

	    
	    if(objParams.custpage_application!='-' && !Helper.isEmpty(objParams.custpage_application)){
	    	arrWhereQuery.push(`(UPPER(custrecord_ctc_vclog_application) = UPPER('${objParams.custpage_application}'))`);
	    }

	   	if(objParams.custpage_compname!=='-' && !Helper.isEmpty(objParams.custpage_compname)){
	   		arrWhereQuery.push(`(UPPER(custrecord_ctc_vclog_compname) = UPPER('${objParams.custpage_compname}'))`);
	   	}

	   	if(objParams.custpage_vendorconfig!=='-' && !Helper.isEmpty(objParams.custpage_vendorconfig)){
	   		arrWhereQuery.push(`(UPPER(custrecord_ctc_vclog_vendorconfig) = UPPER('${objParams.custpage_vendorconfig}'))`);
	   	}

	    let sql = `
	        SELECT
	            ${arrSelectQuery.join(',')}
	        FROM 
	        	customrecord_ctc_vcsp_log_summary
	        WHERE
	        	${arrWhereQuery.join(' AND ')}
	        GROUP BY
	            ${arrGroupQuery.join(',')}
	            ${orderQuery}
	        `;

	    log.debug('sql',sql);

	    // sql = getAllRowsSql(sql);
	    let queryResults = query.runSuiteQL({query:sql});
	    let arrResults = queryResults.asMappedResults();

	    //group by log category
	    let arrLogCategories = [];
	    let objDates = {};

	    log.debug('arrResults.length',arrResults.length);

	    for(let i=0; i<arrResults.length; i++){

	    	let logCompany = arrResults[i].custrecord_ctc_vclog_compname||'-';
	    	let logVendorConfig = arrResults[i].custrecord_ctc_vclog_vendorconfig||'-';
	    	let logCategory = arrResults[i].custrecord_ctc_vclog_category||'-';
	    	let logCount = arrResults[i].a||0;
	    	let logDate = arrResults[i].d||'-';

	    	// if(objParams.custpage_date!=='BY DAY' && !Helper.isEmpty(objParams.custpage_date)){
	    	// 	logDate = arrResults[i].d||'-';
	    	// }
	    	if(objParams.custpage_date==='BY QUARTER' && !Helper.isEmpty(objParams.custpage_date)){
	    		logDate = `Q${arrResults[i].q||''} ${arrResults[i].year||''}`;
	    	}

	    	//remove all non alphanumeric for ID
	    	let logCatId = Helper.removeNonAlphaNum(logCategory);
	    	
	    	//find if cateogry ID exists in array
	    	let objLogCategory = arrLogCategories.find(objData => objData.categoryId === logCatId);

	    	//store to array if does not exist
	    	if(Helper.isEmpty(objLogCategory)){
	    		arrLogCategories.push({
	    			'text':logCategory,
	    			'categoryId':logCatId
	    		});
	    	}

	    	let key = `${logDate}_${logCompany}_${logVendorConfig}`;

	    	if(Helper.isEmpty(objDates[key])){
	    		objDates[key] = [];
	    	}

	    	objDates[key].push({
	    		company:logCompany,
	    		vendorConfig:logVendorConfig,
	    		categoryId:logCatId,
	    		count:logCount,
	    		date:logDate
	    	});
	    }

	    log.debug('objDates',objDates);


	    //add log category column
	    for(let i=0; i<arrLogCategories.length; i++){
	    	objSublist.addField({
	    	    id : 'custpage_line_'+arrLogCategories[i].categoryId,
	    	    label : arrLogCategories[i].text,
	    	    type : serverWidget.FieldType.TEXT
	    	});
	    }

	    //add date field - last column
	    objSublist.addField({
    	    id : 'custpage_line_date',
    	    label : 'Date',
    	    type : serverWidget.FieldType.TEXT
    	});

	    let lineNo = 0;
		for(let key in objDates){

			let arrData = objDates[key];
			for(let i=0; i<arrData.length; i++){
				
				objSublist.setSublistValue({
				    id:'custpage_line_compname',
				    line:lineNo,
				    value:arrData[i].company
				});
				objSublist.setSublistValue({
				    id:'custpage_line_vendorconfig',
				    line:lineNo,
				    value:arrData[i].vendorConfig
				});

				objSublist.setSublistValue({
				    id:'custpage_line_'+arrData[i].categoryId,
				    line:lineNo,
				    value:arrData[i].count||0
				});

				objSublist.setSublistValue({
				    id:'custpage_line_date',
				    line:lineNo,
				    value:arrData[i].date
				});
			}

			lineNo++;
		}

	};

    const Helper={
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
    	convertDate:(dateVal)=>{
			let returnVal='';
			if(dateVal){
				returnVal = format.parse({value:dateVal,type:format.Type.DATE});
			}
			return returnVal;
	    },
	    removeNonAlphaNum:(str)=>{
	    	return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0,10);
	    }
    };

	return EntryPoint;
});