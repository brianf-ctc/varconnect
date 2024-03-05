/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType MapReduceScript
 * @Description Links all serial numbers from the createdfrom SO to the new Invoice
 */

/**
 * Project Number: 001225
 * Script Name: VAR Connect Link All SO Serial MR
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 * 1.20		Apr 2, 2021		paolodl@nscatalyst.com	Only process unlinked serials
 *
 */
define([
    'N/record',
    'N/search',
    'N/runtime',
    '../CTC_VC_Constants.js',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator'
], function (ns_record, ns_search, ns_runtime, constants, libMainConfig, libLicenseValidator) {
    var LogTitle = 'MR_LinkSerials',
        LogPrefix = '',
        PARAM = {};

    var MAP_REDUCE = {
        getInputData: function () {
            var logTitle = [LogTitle, 'getInputData'].join('::');

            try {
                var currentScript = ns_runtime.getCurrentScript();
                PARAM = {
                    recordType: currentScript.getParameter('custscript_vc_all_type'),
                    recordId: currentScript.getParameter('custscript_vc_all_id')
                };
                log.debug(logTitle, '>> PARAMS: ' + JSON.stringify(PARAM));
                LogPrefix = '[' + [PARAM.recordType, PARAM.recordId].join(':') + '] ';

                if (!PARAM.recordType || !PARAM.recordId) throw 'Missing record details';

                var mainConfig = Helper.loadMainConfig();
                log.debug(logTitle, LogPrefix + '>> mainConfig: ' + JSON.stringify(mainConfig));

                Helper.validateLicense({ mainConfig: mainConfig });

                if (!mainConfig || !mainConfig.copySerialsInv) {
                    //Terminate if Copy Serials functionality is not set
                    throw 'Copy serials functionality is not set';
                }

                // update the sync
                ns_record.submitFields({
                    type: PARAM.recordType,
                    id: PARAM.recordId,
                    values: {
                        custbody_ctc_vc_serialsync_done: false
                    }
                });

                var record = ns_record.load({ type: PARAM.recordType, id: PARAM.recordId });
                if (!record) throw 'Invalid record/record type';

                ///// GET RECORD INFO
                var recordData = {
                    createdfrom: record.getValue({ fieldId: 'createdfrom' }),
                    recordType: record.type,
                    salesOrderId: null
                };

                recordData.createdFromData = Helper.flatLookup({
                    type: 'transaction',
                    id: recordData.createdfrom,
                    columns: ['type', 'recordtype', 'createdfrom']
                });

                recordData.salesOrderId =
                    // actual sales order
                    PARAM.recordType == ns_record.Type.SALES_ORDER
                        ? PARAM.recordId
                        : // creatdfrom is SO
                        recordData.createdFromData.recordtype == ns_record.Type.SALES_ORDER
                        ? recordData.createdfrom
                        : // created from PO, and has createdfrom data
                        recordData.createdFromData.recordtype == ns_record.Type.PURCHASE_ORDER &&
                          recordData.createdFromData.createdfrom
                        ? recordData.createdFromData.createdfrom
                        : null;

                // skip non-sales order transaction
                if (!recordData.salesOrderId) throw 'No source Sales Order';

                log.audit(logTitle, LogPrefix + '// Record Data: ' + JSON.stringify(recordData));

                var lineCount = record.getLineCount({ sublistId: 'item' }),
                    itemList = {},
                    arrItems = [];

                for (var line = 0; line < lineCount; line++) {
                    var lineData = {
                        line: line,
                        item: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: line
                        }),
                        quantity: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: line
                        }),
                        serialsUpdate: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: constants.Columns.SERIAL_NUMBER_UPDATE,
                            line: line
                        }),
                        serialNums: []
                    };
                    lineData.quantity = Helper.parseFloat(lineData.quantity);

                    if (!lineData.quantity) continue; // skip items w/ no quantity

                    /////////////////////////////
                    // get the native inventory
                    try {
                        var subRec = record.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: line
                        });

                        if (subRec) {
                            var subLineCount = subRec.getLineCount({
                                sublistId: 'inventoryassignment'
                            });
                            log.audit(
                                logTitle,
                                LogPrefix + '....// subLineCount: ' + JSON.stringify(subLineCount)
                            );
                            for (var subline = 0; subline < subLineCount; subline++) {
                                var invData = {
                                    numRcpt: subRec.getSublistText({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'receiptinventorynumber',
                                        line: subline
                                    }),
                                    numIssue: subRec.getSublistText({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'issueinventorynumber',
                                        line: subline
                                    })
                                };
                                var serialNum = invData.numRcpt || invData.numIssue;
                                if (!Helper.inArray(serialNum, lineData.serialNums))
                                    lineData.serialNums.push(serialNum);
                            }
                        }
                    } catch (subrec_error) {
                        log.audit(
                            logTitle,
                            LogPrefix + JSON.stringify(subrec_error.message || subrec_error)
                        );
                    }
                    log.audit(logTitle, LogPrefix + '....// lineData: ' + JSON.stringify(lineData));

                    /////////////////////////

                    if (!lineData.serialsUpdate || !lineData.serialsUpdate.trim().length) {
                        arrItems.push(lineData.item);
                    }

                    if (!itemList[lineData.item]) itemList[lineData.item] = [];
                    itemList[lineData.item].push(lineData);

                    /** NOTE: need to identify which serials we need to update
                     */
                }
                log.audit(logTitle, LogPrefix + '// Item List: ' + JSON.stringify(arrItems));
                log.audit(logTitle, LogPrefix + '// Item List: ' + JSON.stringify(itemList));

                var SERIAL_FLD = constants.Fields.Serials;

                //// search for the serials
                var searchOption = {
                    type: constants.Records.SERIALS,
                    filters: [
                        {
                            name: 'isinactive',
                            operator: 'is',
                            values: 'F'
                        },
                        {
                            name: SERIAL_FLD.SALES_ORDER,
                            operator: 'anyof',
                            values: recordData.salesOrderId
                        },
                        {
                            name: SERIAL_FLD.ITEM,
                            operator: 'anyof',
                            values: arrItems
                        }
                    ],
                    columns: ['internalid', SERIAL_FLD.ITEM, SERIAL_FLD.NAME]
                };

                if (PARAM.recordType == ns_record.Type.ITEM_FULFILLMENT) {
                    searchOption.filters.push({
                        name: SERIAL_FLD.ITEM_FULFILLMENT,
                        operator: 'isempty'
                    });
                } else if (PARAM.recordType == ns_record.Type.INVOICE) {
                    // just include serials that has not yet invoice-tagged, but itemff-tagged
                    searchOption.filters.push({
                        name: SERIAL_FLD.ITEM_FULFILLMENT,
                        operator: 'isnotempty'
                    });

                    searchOption.filters.push({
                        name: SERIAL_FLD.INVOICE,
                        operator: 'isempty'
                    });
                }

                log.audit(
                    logTitle,
                    LogPrefix + '// Search Option: ' + JSON.stringify(searchOption)
                );

                var searchObj = ns_search.create(searchOption);
                var searchResults = Helper.searchAllPaged({ searchObj: searchObj });
                var returnResults = [];

                searchResults.forEach(function (result) {
                    var resultData = {
                        id: result.getValue({ name: 'internalid' }),
                        item: result.getValue({ name: SERIAL_FLD.ITEM }),
                        name: result.getValue({ name: SERIAL_FLD.NAME })
                    };
                    resultData.item = Helper.parseFloat(resultData.item);

                    if (itemList[resultData.item]) {
                        itemList[resultData.item].forEach(function (serialData) {
                            if (!serialData.quantity) return;

                            if (serialData.serialNums && serialData.serialNums.length) {
                                if (!Helper.inArray(resultData.name, serialData.serialNums)) return;
                            }

                            log.audit(
                                logTitle,
                                LogPrefix +
                                    ('...// add to serial data: ' + JSON.stringify(resultData))
                            );
                            returnResults.push(resultData);
                            serialData.quantity--;
                            return true;
                        });
                    }

                    return true;
                });

                log.audit(
                    logTitle,
                    '>> Total serials to update/create: ' + JSON.stringify(returnResults)
                );

                return returnResults;
            } catch (error) {
                log.audit(logTitle, LogPrefix + ' ## EXIT SCRIPT ## ' + JSON.stringify(error));
                return false;
            }
        },

        reduce: function (context) {
            var logTitle = [LogTitle, 'reduce'].join('::');

            var SERIAL_FLD = constants.Fields.Serials;
            var serialNumID;
            var currentScript = ns_runtime.getCurrentScript();
            PARAM = {
                recordType: currentScript.getParameter('custscript_vc_all_type'),
                recordId: currentScript.getParameter('custscript_vc_all_id')
            };
            LogPrefix = '[' + [PARAM.recordType, PARAM.recordId].join(':') + '] ';
            log.debug(logTitle, LogPrefix + '>> PARAMS: ' + JSON.stringify(PARAM));

            var currentData = JSON.parse(context.values[0]);
            log.debug(logTitle, LogPrefix + '>> currentData: ' + JSON.stringify(currentData));

            if (currentData) {
                var serialId = currentData.id,
                    updateValue = {};

                if (PARAM.recordType == ns_record.Type.ITEM_FULFILLMENT) {
                    updateValue[SERIAL_FLD.ITEM_FULFILLMENT] = PARAM.recordId;
                } else if (PARAM.recordType == ns_record.Type.INVOICE) {
                    updateValue[SERIAL_FLD.INVOICE] = PARAM.recordId;
                }

                if (!Helper.isEmpty(updateValue))
                    serialNumID = ns_record.submitFields({
                        type: constants.Records.SERIALS,
                        id: serialId,
                        values: updateValue
                    });
            }

            return serialNumID ? serialNumID : '';
        },

        summarize: function (summary) {
            var logTitle = [LogTitle, 'summarize'].join('::');

            var currentScript = ns_runtime.getCurrentScript();
            PARAM = {
                recordType: currentScript.getParameter('custscript_vc_all_type'),
                recordId: currentScript.getParameter('custscript_vc_all_id')
            };
            LogPrefix = '[' + [PARAM.recordType, PARAM.recordId].join(':') + '] ';
            log.debug(logTitle, LogPrefix + '>> PARAMS: ' + JSON.stringify(PARAM));

            summary.reduceSummary.errors.iterator().each(function (key, error) {
                log.error(logTitle, LogPrefix + 'Reduce Error for key: ' + key, error);
                return true;
            });
            var reduceKeys = [];
            summary.reduceSummary.keys.iterator().each(function (key) {
                reduceKeys.push(key);
                return true;
            });
            // if (reduceKeys && reduceKeys.length > 0) Helper.updateTransaction();
            log.audit(
                logTitle,
                LogPrefix + '// REDUCE keys processed' + JSON.stringify(reduceKeys)
            );

            // update the sync
            ns_record.submitFields({
                type: PARAM.recordType,
                id: PARAM.recordId,
                values: {
                    custbody_ctc_vc_serialsync_done: true
                }
            });
        }
    };

    var Helper = {
        validateLicense: function (options) {
            var mainConfig = options.mainConfig,
                license = mainConfig.license,
                response = libLicenseValidator.callValidationSuitelet({
                    license: license,
                    external: true
                }),
                result = true;

            if (response == 'invalid') {
                log.error(
                    'License expired',
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
                result = false;
            }

            return result;
        },

        loadMainConfig: function () {
            var mainConfig = libMainConfig.getMainConfiguration();

            if (!mainConfig) {
                log.error('No VAR Connect Main Coniguration available');
            } else return mainConfig;
        },
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },

        flatLookup: function (option) {
            var logTitle = [LogTitle, 'Helper.flatLookup'].join('::');

            log.audit(logTitle, LogPrefix + '// ' + JSON.stringify(option));
            var arrData = null,
                arrResults = null;
            arrResults = ns_search.lookupFields(option);
            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
        },
        searchAllPaged: function (option) {
            var objSearch,
                arrResults = [],
                logTitle = 'CTC_Utils:searchAllPaged';
            option = option || {};

            try {
                var searchId = option.id || option.searchId;
                var searchType = option.recordType || option.type;

                objSearch = option.searchObj
                    ? option.searchObj
                    : searchId
                    ? ns_search.load({
                          id: searchId
                      })
                    : searchType
                    ? ns_search.create({
                          type: searchType
                      })
                    : null;

                if (!objSearch) throw 'Invalid search identifier';
                if (!objSearch.filters) objSearch.filters = [];
                if (!objSearch.columns) objSearch.columns = [];

                if (option.filters) objSearch.filters = objSearch.filters.concat(option.filters);
                if (option.filterExpression) objSearch.filterExpression = option.filterExpression;
                if (option.columns) objSearch.columns = objSearch.columns.concat(option.columns);

                var maxResults = option.maxResults || 0;
                var pageSize = maxResults && maxResults <= 1000 ? maxResults : 1000;

                // run the search
                var objPagedResults = objSearch.runPaged({
                    pageSize: pageSize
                });
                // set the max results to the search length, if not defined;
                maxResults = maxResults || objPagedResults.count;

                for (var i = 0, j = objPagedResults.pageRanges.length; i < j; i++) {
                    var pagedResults = objPagedResults.fetch({
                        index: objPagedResults.pageRanges[i].index
                    });

                    // test if we need to get all the paged results,
                    // .. or just a slice, of maxResults is less than the pageSize
                    arrResults = arrResults.concat(
                        maxResults > pageSize
                            ? pagedResults.data
                            : pagedResults.data.slice(0, maxResults)
                    );

                    // reduce the max results
                    maxResults = maxResults - pageSize;
                    if (maxResults < 0) break;
                }
            } catch (e) {
                log.debug(logTitle, '>> error: ' + JSON.stringify(e));
                throw e.message;
            }

            return arrResults;
        },

        updateTransaction: function () {
            // var recType = ns_runtime.getCurrentScript().getParameter('custscript_vc_all_type'),
            //     recId = ns_runtime.getCurrentScript().getParameter('custscript_vc_all_id');
            // if (PARAM.recordType == ns_record.Type.INVOICE) {
            //     var rec = ns_record.load({
            //         type: PARAM.recordType,
            //         id: PARAM.recordId
            //     });
            //     rec.save();
            // }
        }
    };

    return MAP_REDUCE;
});
