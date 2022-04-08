/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define([
    'N/search',
    'N/runtime',
    'N/error',
    'N/log',
    './Libraries/moment',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './Libraries/CTC_VC_Lib_Vendor_Map'
], function (search, runtime, error, log, moment, vp, vm) {
    function getInputData() {
        // B = Pending Receipt
        // D = Partially Received
        // E = Pending Billing/Partially Received
        // F = Pending Bill
        // G = Fully Billed

        return search.create({
            type: 'purchaseorder',
            filters: [
                ['vendor.custentity_vc_bill_config', 'anyof', '1', '3', '4'], // Arrow, Ingram, TD
                'AND',
                ['type', 'anyof', 'PurchOrd'],
                'AND',
                ['status', 'anyof', 'PurchOrd:B', 'PurchOrd:D', 'PurchOrd:E', 'PurchOrd:F'],
                'AND',
                ['mainline', 'is', 'T']
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
        //var scriptObj = runtime.getCurrentScript();

        var searchValues = JSON.parse(context.values);

        //var record_id = searchValues.id;

        log.debug('values', searchValues);

        var vendorConfig = search.lookupFields({
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

            log.debug('myArr.length', myArr.length);

            log.debug('myArr', myArr);

            vp.process(configObj, myArr, moment().unix());
        } catch (e) {
            log.error(context.key + ': ' + 'Error encountered in reduce', e);
        }
    }

    function summarize(summary) {
        handleErrorIfAny(summary);
        createSummaryRecord(summary);
    }

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
