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
 * @NScriptType Restlet
 * @author ajdeleon
 **/

/*jshint esversion: 9 */
define((require) => {
    const search = require('N/search');
    const format = require('N/format');

    const EntryPoint = {};
    const Helper = {};
    const PAGE_SIZE = 100;
    const PAGE_NUMBER = 1;
    let SCRIPT_LOGS = {};

    EntryPoint.get = (requestBody) => {
        try {
            let paramDate = requestBody.date;
            let paramCategory = requestBody.category;
            let paramPageSize = requestBody.pagesize || PAGE_SIZE;
            let paramPageNumber = requestBody.page || PAGE_NUMBER;

            validateParameters(requestBody);

            //get log summary
            let arrFilters = [];

            //add date to search filter
            if (!Helper.isEmpty(paramDate)) {
                paramDate = format.format({ value: new Date(paramDate), type: format.Type.DATE });
                arrFilters.push(['custrecord_ctc_vclog_date', 'on', paramDate]);
                arrFilters.push('AND');
            }

            //add category to search filter
            if (!Helper.isEmpty(paramCategory)) {
                arrFilters.push(['custrecord_ctc_vclog_category', 'is', paramCategory]);
                arrFilters.push('AND');
            }

            //remove extra 'and'
            if (arrFilters.length >= 2) {
                arrFilters.pop();
            }

            //run search
            let logReportsSearch = search.create({
                type: 'customrecord_ctc_vcsp_log_summary',
                filters: arrFilters,
                columns: [
                    'created',
                    'internalid',
                    'custrecord_ctc_vclog_amount',
                    'custrecord_ctc_vclog_application',
                    'custrecord_ctc_vclog_count',
                    'custrecord_ctc_vclog_date',
                    'custrecord_ctc_vclog_vendorconfig',
                    'custrecord_ctc_vclog_transaction',
                    'custrecord_ctc_vclog_type',
                    'custrecord_ctc_vclog_category',
                    'custrecord_ctc_vclog_key',
                    'custrecord_ctc_vclog_account',
                    'custrecord_ctc_vclog_compname'
                ]
            });

            //set the initial value for return
            let objReturn = {
                totalpage: 1,
                page: paramPageNumber,
                pagesize: paramPageSize,
                data: []
            };

            let logReportsPage = logReportsSearch.runPaged({ pageSize: paramPageSize });
            objReturn.totalpage = logReportsPage.pageRanges.length;
            SCRIPT_LOGS.objReturn = objReturn;

            if (logReportsPage.pageRanges.length > 0) {
                //fetch the current page data. page number starts at 0
                let logReportsData = logReportsPage.fetch(paramPageNumber - 1);

                //get rows for current page or index
                logReportsData.data.forEach((result) => {
                    objReturn.data.push({
                        internalid: result.getValue('internalid'),
                        custrecord_ctc_vclog_amount: result.getValue('custrecord_ctc_vclog_amount'),
                        custrecord_ctc_vclog_application: result.getValue(
                            'custrecord_ctc_vclog_application'
                        ),
                        custrecord_ctc_vclog_count: result.getValue('custrecord_ctc_vclog_count'),
                        custrecord_ctc_vclog_date: result.getValue('custrecord_ctc_vclog_date'),
                        custrecord_ctc_vclog_vendorconfig: result.getValue(
                            'custrecord_ctc_vclog_vendorconfig'
                        ),
                        custrecord_ctc_vclog_transaction: result.getValue(
                            'custrecord_ctc_vclog_transaction'
                        ),
                        custrecord_ctc_vclog_transaction_text: result.getText(
                            'custrecord_ctc_vclog_transaction'
                        ),
                        custrecord_ctc_vclog_type: result.getValue('custrecord_ctc_vclog_type'),
                        custrecord_ctc_vclog_category: result.getValue(
                            'custrecord_ctc_vclog_category'
                        ),
                        custrecord_ctc_vclog_key: result.getValue('custrecord_ctc_vclog_key'),
                        custrecord_ctc_vclog_account: result.getValue(
                            'custrecord_ctc_vclog_account'
                        ),
                        custrecord_ctc_vclog_compname: result.getValue(
                            'custrecord_ctc_vclog_compname'
                        )
                    });
                });
            }

            SCRIPT_LOGS.data_count = objReturn.data.length;
            return JSON.stringify(objReturn);
        } catch (ex) {
            throw ex;
        } finally {
            log.debug('SCRIPT_LOGS', SCRIPT_LOGS);
        }
    };

    const validateParameters = (requestBody) => {
        SCRIPT_LOGS.requestBody = requestBody;
        let paramDate = requestBody.date;
        let paramCategory = requestBody.category;
        let paramPageSize = requestBody.pagesize;
        let paramPageNumber = requestBody.page;

        //date
        if (Helper.isEmpty(paramDate)) {
            throw 'Date parameter is required';
        } else if (!isValidDateFormat(paramDate)) {
            throw 'Invalid date format. Please use mm/dd/yyyy (01/09/2024).';
        }
        //page size
        if (!Helper.isEmpty(paramPageSize)) {
            if (isNaN(paramPageSize)) {
                throw 'Page Size must be a valid number.';
            } else if (Helper.forceInt(paramPageSize) > 1000) {
                throw 'The maximum number allowed is 1000. Please read oracdocs.';
            } else if (Helper.forceInt(paramPageSize) < 5) {
                throw 'The minimum number allowed is 5. Please read oracdocs.';
            }
        }
        //page number
        if (!Helper.isEmpty(paramPageNumber)) {
            if (isNaN(paramPageNumber)) {
                throw 'Page must be a valid number.';
            }
        }
        if (!Helper.isEmpty(paramCategory)) {
            if (paramCategory.length > 1000) {
                throw 'Are you trying to break the script?';
            }
        }
    };

    const isValidDateFormat = (dateString) => {
        return !isNaN(new Date(dateString));
        /*
	    // Regular expression to match mm/dd/yyyy format
	    var dateFormat = /^\d{2}\/\d{2}\/\d{4}$/;
	    
	    // Check if the date string matches the format
	    if (!dateFormat.test(dateString)) {
	        return false;
	    }
	    
	    let parts = dateString.split('/');
	    let month = parseInt(parts[0], 10);
	    let day = parseInt(parts[1], 10);
	    let year = parseInt(parts[2], 10);

	    if (isNaN(month) || isNaN(day) || isNaN(year)) {
	        return false;
	    }
	    if (month < 1 || month > 12) {
	        return false;
	    }
	    let maxDays = new Date(year, month, 0).getDate();
	    if (day < 1 || day > maxDays) {
	        return false;
	    }
		return true;
		*/
    };

    Helper.convertDate = (dateVal) => {
        let returnVal = '';
        if (dateVal) {
            returnVal = format.parse({ value: dateVal, type: format.Type.DATE });
        }
        return returnVal;
    };

    Helper.forceInt = function (stValue) {
        var intValue = parseInt(stValue, 10);
        if (isNaN(intValue) || stValue == Infinity) {
            return 0;
        }
        return intValue;
    };

    Helper.isEmpty = (stValue) => {
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
    };

    return EntryPoint;
});
