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
    './../CTC_VC2_Constants',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './Libraries/CTC_VC_Lib_Vendor_Map',
    './../Services/ctc_svclib_configlib'
], function (
    ns_search,
    ns_runtime,
    ns_error,
    moment,
    vc2_util,
    vc2_constant,
    VCLib_BillFile,
    VCLib_VendorMap,
    vcs_configLib
) {
    var LogTitle = 'MR_BillFiles-API',
        VCLOG_APPNAME = 'VAR Connect|Retrieve Bill (API)',
        LogPrefix = '';

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var MAP_REDUCE = {};

    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join(':');
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        LogPrefix = '[getInputData] ';

        var CONNECT_TYPE = { API: 1, SFTP: 2 },
            validVendorCfg = [],
            validVendorCfgName = [];

        var paramConfigID = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_vendor_api'
        });
        var paramOrderId = ns_runtime.getCurrentScript().getParameter({
            name: 'custscript_ctc_vc_bc_po_id'
        });

        var license = vcs_configLib.validateLicense();
        if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

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
                ['mainline', 'is', 'T'],
                'AND',
                ['custbody_ctc_bypass_vc', 'is', 'F']
            ],
            columns: [
                'internalid',
                'tranid',
                'custbody_ctc_vc_override_ponum',
                ns_search.createColumn({
                    name: 'custentity_vc_bill_config',
                    join: 'vendor'
                })
            ]
        };
        if (paramOrderId) {
            // searchOption.filters.push('AND');
            searchOption.filters = [['internalid', 'anyof', paramOrderId]];
        }

        if (vc2_util.isOneWorld()) {
            searchOption.columns.push(
                ns_search.createColumn({
                    name: 'subsidiary'
                })
            );
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
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var searchValue = vc2_util.safeParse(context.values.shift()),
            currentValue = searchValue.values;

        vc2_util.LogPrefix = ['[', searchValue.recordType, ':', searchValue.id, '] '].join('');

        vc2_util.log(logTitle, '>> Context: ', context);
        vc2_util.log(logTitle, '>> Values: ', searchValue);

        /// load the mainConfig
        var MainCFG = vcs_configLib.mainConfig();

        // load the billConfig
        var BillCFG = vcs_configLib.billVendorConfig({ poId: searchValue.id });
        BillCFG.poNum = MainCFG.overridePONum
            ? currentValue.custbody_ctc_vc_override_ponum || currentValue.tranid
            : currentValue.tranid;

        if (vc2_util.isOneWorld()) {
            BillCFG.subsidiary = currentValue.subsidiary.value || currentValue.subsidiary;
            BillCFG.country =
                currentValue['country.subsidiary'].value || currentValue['country.subsidiary'];

            ['subsidiary'].value;
        } else BillCFG.country = ns_runtime.country;

        try {
            var entryFunction = BillCFG.entry_function;
            var myArr = [];
            vc2_util.log(logTitle, '## Config Obj:entryFunction: ', entryFunction);

            switch (entryFunction) {
                case 'arrow_api':
                    myArr = VCLib_VendorMap.arrow_api(context.key, BillCFG);
                    break;
                case 'ingram_api':
                    myArr = VCLib_VendorMap.ingram_api(context.key, BillCFG);
                    break;
                case 'techdata_api':
                    myArr = VCLib_VendorMap.techdata_api(context.key, BillCFG);
                    break;
                case 'wefi_api':
                    myArr = VCLib_VendorMap.wefi(context.key, BillCFG);
                    break;
                case 'jenne_api':
                    myArr = VCLib_VendorMap.jenne_api(context.key, BillCFG);
                    break;
                case 'scansource_api':
                    myArr = VCLib_VendorMap.scansource_api(context.key, BillCFG);
                    break;
                case 'synnex_api':
                    myArr = VCLib_VendorMap.synnex_api(context.key, BillCFG);
                    break;
                case 'carahsoft_api':
                    myArr = VCLib_VendorMap.carahsoft_api(context.key, BillCFG);
                    break;
            }

            vc2_util.log(logTitle, '## output: ', myArr);
            VCLib_BillFile.process(BillCFG, myArr, moment().unix());
        } catch (error) {
            vc2_util.logError(logTitle, error);

            vc2_util.vcLog({
                title: 'MR Bills Retrieve API | Error',
                error: error,
                recordId: searchValue.id,
                status: LOG_STATUS.API_ERROR
            });
        }
    };

    MAP_REDUCE.summarize = function (summary) {
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

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
