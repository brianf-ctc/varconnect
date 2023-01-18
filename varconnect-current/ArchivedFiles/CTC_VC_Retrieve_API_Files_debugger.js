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
var VCFolder = '/SuiteScripts/VCFolder/Bundle 317849-current/Bill Creator';
require([
    'N/search',
    'N/runtime',
    'N/error',
    'N/log',
    VCFolder + '/Libraries/moment',
    VCFolder + '/Libraries/CTC_VC_Lib_Create_Bill_Files',
    VCFolder + '/Libraries/CTC_VC_Lib_Vendor_Map'
], function (search, runtime, error, log, moment, vp, vm) {
    var LogTitle = 'MR_BillFiles-API';

    function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join(':');

        var CONNECT_TYPE = {
                API: 1,
                SFTP: 2
            },
            validVendorCfg = [];

        var vendorConfigSearch = search.create({
            type: 'customrecord_vc_bill_vendor_config',
            filters: [['custrecord_vc_bc_connect_type', 'anyof', CONNECT_TYPE.API]],
            columns: ['internalid']
        });

        vendorConfigSearch.run().each(function (result) {
            validVendorCfg.push(result.id);
            return true;
        });

        log.debug(logTitle, '>> Valid API Configs : ' + JSON.stringify(validVendorCfg));

        return search.create({
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
                ['mainline', 'is', 'T'],
                'AND',
                ['internalid', 'anyof', 347630]
            ],
            columns: [
                'internalid',
                'tranid',
                search.createColumn({
                    name: 'custentity_vc_bill_config',
                    join: 'vendor'
                })
            ]
        });
    }

    function reduce(context) {
        var logTitle = [LogTitle, 'reduce'].join(':');
        //var scriptObj = runtime.getCurrentScript();

        var searchValues = JSON.parse(context.values);

        //var record_id = searchValues.id;
        log.audit(logTitle, '>> searchValues: ' + JSON.stringify(searchValues));

        var vendorConfig = search.lookupFields({
            type: 'customrecord_vc_bill_vendor_config',
            // id: searchValues.values['custentity_vc_bill_config.vendor'].value,
            id: searchValues.values['vendor.custentity_vc_bill_config'][0].value,
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
            // id: searchValues.values['custentity_vc_bill_config.vendor'].value,
            id: searchValues.values['vendor.custentity_vc_bill_config'][0].value,
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
        log.audit(logTitle, '>> ## configObj: ' + JSON.stringify(configObj));

        try {
            var entryFunction = configObj.entry_function;

            var myArr = [];

            switch (entryFunction) {
                case 'arrow_api':
                    myArr = vm.arrow_api(context.key, configObj);
                    break;
                case 'ingram_api':
                    myArr = vm.ingram_api(context.key, configObj);
                    break;
                case 'techdata_api':
                    myArr = vm.techdata_api(context.key, configObj);
                    break;
            }

            //log.debug(context.key, myArr);

            log.audit(logTitle, '>> ## myArr: ' + JSON.stringify(myArr));

            vp.process(configObj, myArr, moment().unix());
        } catch (e) {
            log.error(context.key + ': ' + 'Error encountered in reduce', e);
        }
    }

    function summarize(summary) {
        handleErrorIfAny(summary);
        createSummaryRecord(summary);
    }

    /////////////////////////////////
    var objSearch = getInputData(),
        arrResults = [];
    objSearch.run().each(function (result, idx) {
        arrResults.push(JSON.parse(JSON.stringify(result)));
        // map.call(this, {key: idx, value: JSON.stringify(result) });
        return true;
    });

    var arrReduceData = {};
    var contextWrite = function (key, value) {
        if (!arrReduceData[key]) arrReduceData[key] = [];
        arrReduceData[key].push(JSON.stringify(value));
    };
    arrResults.forEach(function (data, idx) {
        contextWrite(data.id, data);
    });

    for (var redkey in arrReduceData) {
        reduce.call(this, {
            key: redkey,
            values: arrReduceData[redkey]
        });
    }
    ///////////////////////////////

    function handleErrorIfAny(summary) {
        var inputSummary = summary.inputSummary;
        var mapSummary = summary.mapSummary;
        var reduceSummary = summary.reduceSummary;
        if (inputSummary.error) {
            var e = error.create({
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
                script: runtime.getCurrentScript().id,
                seconds: summary.seconds,
                usage: summary.usage,
                yields: summary.yields
            };

            log.audit('summary', summaryJson);
        } catch (e) {
            log.error('Stage: summary failed', e);
        }
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
