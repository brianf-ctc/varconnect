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
 */

define([
    'N/search',
    'N/runtime',
    'N/error',
    './Libraries/moment',
    '../CTC_VC2_Lib_Utils',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './Libraries/CTC_VC_Lib_Vendor_Map'
], function (ns_search, ns_runtime, ns_error, moment, vc2_util, VCLib_BillFile, VCLib_VendorMap) {
    var LogTitle = 'MR_BillFiles-API',
        LogPrefix = '';

    var MAP_REDUCE = {};

    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join(':');
        LogPrefix = '[getInputData] ';

        var CONNECT_TYPE = {
                API: 1,
                SFTP: 2
            },
            validVendorCfg = [],
            validVendorCfgName = [];

        var paramConfigID = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_vendor_api'
        });
        var paramOrderId = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_po_id'
        });

        if (paramOrderId) paramConfigID = null; // if purchase is specified, include all configurations

        if (paramConfigID) LogPrefix += '[ConfigID:' + paramConfigID + '] ';
        if (paramOrderId) LogPrefix += '[PO ID:' + paramOrderId + '] ';

        var vendorConfigSearch = ns_search.create({
            type: 'customrecord_vc_bill_vendor_config',
            filters: [
                ['custrecord_vc_bc_connect_type', 'anyof', CONNECT_TYPE.API],
                'AND',
                paramConfigID ? ['internalid', 'anyof', paramConfigID] : ['isinactive', 'is', 'F']
            ],
            columns: ['internalid', 'name', 'custrecord_vc_bc_connect_type']
        });

        vendorConfigSearch.run().each(function (result) {
            validVendorCfg.push(result.id);
            validVendorCfgName.push({
                name: result.getValue({ name: 'name' }),
                type: result.getText({ name: 'custrecord_vc_bc_connect_type' }),
                id: result.id
            });
            return true;
        });

        log.debug(
            logTitle,
            LogPrefix +
                '>> Valid API Configs : ' +
                JSON.stringify([validVendorCfgName, validVendorCfg])
        );

        // G = Fully Billed

        var searchOption = {
            type: 'purchaseorder',
            filters: [
                ['vendor.custentity_vc_bill_config', 'anyof', validVendorCfg],
                'AND',
                ['type', 'anyof', 'PurchOrd'],
                'AND',
                [
                    'status',
                    'anyof',
                    'PurchOrd:B', // PendingReceipt
                    'PurchOrd:D', // PartiallyReceived
                    'PurchOrd:E', // PendingBilling_PartiallyReceived
                    'PurchOrd:F' // PendingBill
                ],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: [
                'internalid',
                'tranid',
                'custbody_ctc_vc_override_ponum',
                // ns_search.createColumn({
                //     name: 'country',
                //     join: 'subsidiary'
                // }),
                ns_search.createColumn({
                    name: 'custentity_vc_bill_config',
                    join: 'vendor'
                })
            ]
        };
        if (paramOrderId) {
            searchOption.filters.push('AND');
            searchOption.filters.push(['internalid', 'anyof', paramOrderId]);
        }

        if (vc2_util.isOneWorld()) {
            searchOption.columns.push(
                ns_search.createColumn({
                    name: 'country',
                    join: 'subsidiary'
                })
            );
        }
        log.debug(logTitle, LogPrefix + '>> searchOption : ' + JSON.stringify(searchOption));

        var searchObj = ns_search.create(searchOption);
        var totalPending = searchObj.runPaged().count;
        log.audit(logTitle, LogPrefix + '>> Orders To Process: ' + totalPending);


        return searchObj;
    };

    MAP_REDUCE.reduce = function (context) {
        var logTitle = [LogTitle, 'reduce', context.key].join(':');
        
        var searchValues = vc2_util.safeParse(context.values.shift());

        log.audit(logTitle, LogPrefix + '>> context: ' + JSON.stringify(context));
        log.audit(
            logTitle,
            LogPrefix + '>> total to process: ' + JSON.stringify(context.values.length)
        );
        LogPrefix = ['[', searchValues.recordType, ':', searchValues.id, '] '].join('');
        //var record_id = searchValues.id;
        log.audit(logTitle, LogPrefix + '>> searchValues: ' + JSON.stringify(searchValues));

        var vendorConfig = ns_search.lookupFields({
            type: 'customrecord_vc_bill_vendor_config',
            id: searchValues.values['custentity_vc_bill_config.vendor'].value,
            columns: [
                'custrecord_vc_bc_ack',
                'custrecord_vc_bc_entry',
                'custrecord_vc_bc_user',
                'custrecord_vc_bc_pass',
                'custrecord_vc_bc_partner',
                'custrecord_vc_bc_connect_type',
                'custrecord_vc_bc_host_key',
                'custrecord_vc_bc_url',
                'custrecord_vc_bc_res_path',
                'custrecord_vc_bc_ack_path'
            ]
        });

        var configObj = {
            id: searchValues.values['custentity_vc_bill_config.vendor'].value,
            ack_function: vendorConfig.custrecord_vc_bc_ack,
            entry_function: vendorConfig.custrecord_vc_bc_entry,
            user_id: vendorConfig.custrecord_vc_bc_user,
            user_pass: vendorConfig.custrecord_vc_bc_pass,
            partner_id: vendorConfig.custrecord_vc_bc_partner,
            host_key: vendorConfig.custrecord_vc_bc_host_key,
            url: vendorConfig.custrecord_vc_bc_url,
            res_path: vendorConfig.custrecord_vc_bc_res_path,
            ack_path: vendorConfig.custrecord_vc_bc_ack_path
        };

        if (vc2_util.isOneWorld()) {
            configObj.country = searchValues.values['country.subsidiary'].value;
        } else {
            // get it from ns runtime
            configObj.country = ns_runtime.country;
        }
        log.audit(logTitle, LogPrefix + '>> ## configObj: ' + JSON.stringify(configObj));
        try {
            var entryFunction = configObj.entry_function;

            var myArr = [];
            switch (entryFunction) {
                case 'arrow_api':
                    myArr = VCLib_VendorMap.arrow_api(context.key, configObj);
                    break;
                case 'ingram_api':
                    myArr = VCLib_VendorMap.ingram_api(context.key, configObj);
                    break;
                case 'techdata_api':
                    myArr = VCLib_VendorMap.techdata_api(context.key, configObj);
                    break;
                case 'wefi_api':
                    myArr = VCLib_VendorMap.wefi(context.key, configObj);
                    break;
            }

            //log.debug(context.key, myArr);

            log.audit(logTitle, LogPrefix + '>> ## myArr: ' + JSON.stringify(myArr));

            VCLib_BillFile.process(configObj, myArr, moment().unix());
        } catch (e) {
            log.error(logTitle, LogPrefix + '## Error  ## ' + JSON.stringify(e));
        }
    };

    MAP_REDUCE.summarize = function (summary) {
        handleErrorIfAny(summary);
        createSummaryRecord(summary);
    };

    function handleErrorIfAny(summary) {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
        if (inputSummary.error) {
            var e = ns_error.create({
                name: 'INPUT_STAGE_FAILED',
                message: inputSummary.error
            });
            log.error('Stage: getInputData failed', e);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    }

    function handleErrorInStage(stage, summary) {
        summary.errors.iterator().each(function (key, value) {
            log.error(key, value);
            return true;
        });
    }

    function createSummaryRecord(summary) {
        try {
            var summaryJson = {
                script: ns_runtime.getCurrentScript().id,
                seconds: summary.seconds,
                usage: summary.usage,
                yields: summary.yields
            };

            log.audit('summary', summaryJson);
        } catch (e) {
            log.error('Stage: summary failed', e);
        }
    }

    return MAP_REDUCE;
});
