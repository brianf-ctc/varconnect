/**
 * Copyright (c) 2025 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author ajdeleon
 * @clickUpId CPDT-2135
 */

/*jshint esversion: 9 */
define(function (require) {
    var search = require('N/search'),
        record = require('N/record'),
        runtime = require('N/runtime'),
        vcs_configLib = require('./Services/ctc_svclib_configlib.js'),
        vc2_constant = require('./CTC_VC2_Constants.js'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js'),
        EntryPoint = {},
        ScriptParam = {};

    var PO_COLS = {
        poNum: 'tranid',
        tranDate: 'trandate',
        vendorId: 'entity',
        createdFrom: 'createdfrom',
        poLinkType: 'custbody_ctc_po_link_type',
        isDropShip: 'custbody_isdropshippo',
        isBypassVC: 'custbody_ctc_bypass_vc',
        subsidiary: vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES ? 'subsidiary' : null,
        overridePO: vc2_constant.FIELD.TRANSACTION.OVERRIDE_PONUM,
        internalid: 'internalid',
        item: 'item'
    };

    EntryPoint.getInputData = function () {
        var logTitle = 'Auto Fulfill Lines | Get Input Data';
        var ERROR_MSG = vc2_constant.ERRORMSG;

        var license = vcs_configLib.validateLicense();
        if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

        var mainConfig = vcs_configLib.mainConfig();
        if (!mainConfig.autofulfillZeroAmtLines) throw ERROR_MSG.MISSING_CONFIG;

        ScriptParam = Helper.getParameters();
        if (!ScriptParam.searchId) throw 'Missing saved search script parameter';

        var searchRec = search.load({ id: ScriptParam.searchId });

        var searchCols = (function () {
            var arrCols = [];
            for (var col in PO_COLS) if (PO_COLS[col]) arrCols.push(PO_COLS[col]);
            return arrCols;
        })();

        var activeVendors = Helper.fetchActiveVendors();
        var searchNew = search.create({
            type: searchRec.searchType,
            filters: searchRec.filters,
            columns: searchCols
        });
        searchNew.filters.push();

        var vendorFilterFormula = [];
        for (var i = 0, j = activeVendors.length; i < j; i++) {
            if (
                ScriptParam.vendorId &&
                !vc2_util.inArray(ScriptParam.vendorId, activeVendors[i].vendor)
            )
                continue;

            var vendorIds = activeVendors[i].vendor
                .map(function (id) {
                    return '{vendor.internalid}=' + id;
                })
                .join(' OR ');

            vendorFilterFormula.push(
                '(' +
                    ('(' + vendorIds + ')') +
                    // ('{vendor.internalid}=' + activeVendors[i].vendor) +
                    (" AND {trandate}>='" + activeVendors[i].startDate + "')")
            );
        }
        var vendorFormula = 'CASE WHEN ' + vendorFilterFormula.join(' OR ') + ' THEN 1 ELSE 0 END';

        vc2_util.log(logTitle, '... active vendor: ', {
            activeVendors: activeVendors,
            formula: vendorFormula
        });

        searchNew.filters.push(
            search.createFilter({
                name: 'formulanumeric',
                operator: search.Operator.EQUALTO,
                values: [1],
                formula: vendorFormula
            })
        );
        // return search.load({
        // 	id:"customsearch_ctc_vc_auto_fulfill_lines",
        // 	type:"purchaseorder"
        // });

        var totalResults = searchNew.runPaged().count;
        vc2_util.log(logTitle, { type: 'debug', msg: '>> Total Orders to Process:' }, totalResults);

        return searchNew;
    };

    EntryPoint.map = function (context) {
        log.debug('map context', context);
        var objValue = JSON.parse(context.value);
        var objValues = objValue.values;

        var itemId = objValues.item.value;
        var soId = objValues.createdfrom.value;

        var itemFulfilled = isItemFulfilled(itemId, soId);
        log.debug(
            'map | isItemFulfilled: ' + itemFulfilled,
            'item ID: ' + itemId + ' | So ID:' + soId
        );

        if (itemFulfilled === false) {
            context.write({
                key: soId,
                value: objValues
            });
        }
    };

    EntryPoint.reduce = function (context) {
        var arrValues = context.values;
        arrValues = arrValues.map(JSON.parse);
        var stSoId = context.key;
        var logTitle = 'Auto Fulfill Lines';

        try {
            var objRec = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: stSoId,
                toType: record.Type.ITEM_FULFILLMENT,
                isDynamic: true,
                ignoreMandatoryFields: true
            });
            //temporary
            objRec.setValue({
                fieldId: 'custbody_cust_priority',
                value: 1
            });

            objRec.setValue({
                fieldId: 'shipstatus',
                value: 'C'
            });

            var stSublistId = 'item';
            for (var i = 0; i < objRec.getLineCount(stSublistId); i++) {
                objRec.selectLine({ sublistId: stSublistId, line: i });

                var itemId = objRec.getCurrentSublistValue({
                    sublistId: stSublistId,
                    fieldId: 'item'
                });

                //if fulfillment's item found in array
                var arrItem = arrValues.filter(function (objData) {
                    return objData.item.value === itemId;
                });

                if (arrItem.length <= 0 || Helper.isEmpty(arrItem)) {
                    objRec.setCurrentSublistValue({
                        sublistId: stSublistId,
                        fieldId: 'itemreceive',
                        value: false
                    });
                }

                objRec.commitLine({ sublistId: stSublistId });
            }

            var ifId = objRec.save();
            createRecordVcLog({
                custrecord_ctc_vcsp_log_transaction: arrValues[0].internalid.value,
                custrecord_ctc_vcsp_log_status: 1,
                custrecord_ctc_vcsp_log_header: logTitle + ' | Record Transform',
                custrecord_ctc_vcsp_log_app: 'Var Connect',
                custrecord_ctc_vcsp_log_date: new Date(),
                custrecord_ctc_vcsp_log_body: 'successfully created IF ID: ' + ifId
            });
        } catch (ex) {
            createRecordVcLog({
                custrecord_ctc_vcsp_log_transaction: arrValues[0].internalid.value,
                custrecord_ctc_vcsp_log_status: 5,
                custrecord_ctc_vcsp_log_header: logTitle + ' | Record Transform',
                custrecord_ctc_vcsp_log_app: 'Var Connect',
                custrecord_ctc_vcsp_log_date: new Date(),
                custrecord_ctc_vcsp_log_body: ex.message || ex.toString()
            });
        }
    };

    EntryPoint.summarize = function (summary) {
        var type = summary.toString();
        log.audit(
            '[Summarize] ' + type,
            'Usage Consumed: ' +
                summary.usage +
                ' | Number of Queues: ' +
                summary.concurrency +
                ' | Number of Yields: ' +
                summary.yields
        );
        summary.output.iterator().each(function (key, value) {
            log.debug('summary', 'key: ' + key + ' | value: ' + value);
            return true;
        });
        logErrorIfAny(summary);
    };

    function logErrorIfAny(summary) {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
        //get input data error
        if (inputSummary.error) {
            log.error('input error', inputSummary.error);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    }

    function handleErrorInStage(stage, summary) {
        var errorMsg = [];
        summary.errors.iterator().each(function (key, value) {
            var msg = 'SCRIPT FAILURE: ' + key + '. Error was:' + JSON.parse(value).message;
            errorMsg.push(msg);
            return true;
        });
        if (errorMsg.length > 0) {
            log.error(stage, JSON.stringify(errorMsg));
        }
    }

    function isItemFulfilled(itemId, soId) {
        var objIfSearch = search.create({
            type: 'itemfulfillment',
            filters: [
                ['type', 'anyof', 'ItemShip'],
                'AND',
                ['item', 'anyof', itemId],
                'AND',
                ['createdfrom', 'anyof', soId]
            ],
            columns: ['internalid', 'statusref']
        });
        var searchCount = objIfSearch.runPaged().count;
        if (searchCount >= 1) {
            return true;
        }
        return false;
    }

    function createRecordVcLog(objFieldValue) {
        var objLogRec = record.create({
            type: 'customrecord_ctc_vcsp_log'
        });

        for (var fieldIdKey in objFieldValue) {
            if (objFieldValue[fieldIdKey]) {
                objLogRec.setValue({
                    fieldId: fieldIdKey,
                    value: objFieldValue[fieldIdKey]
                });
            }
        }
        objLogRec.save();
    }

    var Helper = {
        getParameters: function () {
            var currentScript = runtime.getCurrentScript();
            ScriptParam = {
                searchId: currentScript.getParameter('custscript_ctc_autofulfill_searchid')
            };
            return ScriptParam;
        },
        fetchActiveVendors: function () {
            var objVendorSearch = search.create({
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [['isinactive', 'is', 'F']],
                columns: [
                    'custrecord_ctc_vc_vendor',
                    'custrecord_ctc_vc_vendor_start',
                    'custrecord_ctc_vc_xml_vendor'
                ]
            });
            var arrVendors = [];
            objVendorSearch.run().each(function (result) {
                var vendorList = result.getValue({
                        name: 'custrecord_ctc_vc_vendor'
                    }),
                    startDate = result.getValue({
                        name: 'custrecord_ctc_vc_vendor_start'
                    });

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                    // arrVendors = arrVendors.concat(vendorList);
                }

                return true;
            });
            return arrVendors;
        },
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue === null ||
                stValue === undefined ||
                (stValue.constructor === Array && stValue.length === 0) ||
                (stValue.constructor === Object &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        }
    };

    return EntryPoint;
});
