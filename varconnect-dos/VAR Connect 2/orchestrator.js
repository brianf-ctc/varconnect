/**
 * @copyright 2021 Catalyst Technology Corporation
 * @author Shawn Blackburn <shawnblackburn@gmail.com>
 * 
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public 
 * @NAmdConfig  ./libconfig.json
 * 
 */

define([
        'N/https',
        'N/search',
        'N/runtime',
        'N/error',
        'ctc'
    ],

    function(
        https,
        search,
        runtime,
        error,
        ctc
    ) {

        function getInputData() {


            var licenseResponse = https.requestRestlet({
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'GET',
                scriptId: 'customscript_vc_lic_validator',
                deploymentId: 'customdeploy1'
            });

            log.debug('licenseResponse', licenseResponse);

            var license = {};

            if (licenseResponse.code == 200){

                license = JSON.parse(licenseResponse.body);

            } else {

                log.audit('Licensing', 'Unable to contact license server.  Shutting down.')
                return license;
            }


            return search.create({
                type: "purchaseorder",
                filters: [
                    ["type", "anyof", "PurchOrd"],
                    "AND", ["vendor.custentity_ctc_vc2_config", "noneof", "@NONE@"],
                    "AND", ["status", "anyof", "PurchOrd:D", "PurchOrd:F", "PurchOrd:E", "PurchOrd:B"],
                    "AND", ["mainline", "is", "T"]
                ],
                columns: [
                    search.createColumn({
                        name: "entity"
                    }),
                    search.createColumn({
                        name: "tranid"
                    }),
                    search.createColumn({
                        name: "status"
                    }),
                    search.createColumn({
                        name: "custentity_ctc_vc2_config",
                        join: "vendor"
                    })
                ]
            });
        }

        function map(context) {

            ctc.log.debug('map', 'context', context, runtime, true);

            let s = JSON.parse(context.value);
            let k = s.id;
            var v = {};

            v.entity = s.values.entity.value;
            v.tranid = s.values.tranid;
            v.status = s.values.status.value;
            v.custentity_ctc_vc2_config = s.values['custentity_ctc_vc2_config.vendor'].value;

            context.write({
                key: k,
                value: v
            });

            ctc.log.info('map', 'v', v, runtime, true);
        }

        function reduce(context) {

            let k = context.key;
            var v = JSON.parse(context.values);

            ctc.log.info('reduce', k, v, runtime, true);

            // start working through the natural progression of 
            // a purchase order lifecycle

            // send po
            v.status = refreshPurchaseOrderStatus(k);

            // get acknowledgement
            v.status = refreshPurchaseOrderStatus(k);

            // fulfill
            v.status = refreshPurchaseOrderStatus(k);

            // create serials

            // create vendor billing

            // create customer invoice

            // pass info about reduce to summary
            context.write({
                key: context.key,
                value: context.values.length
            });

            return;
        }

        function summarize(summary) {

            handleErrorIfAny(summary);
            createSummaryRecord(summary);
        }

        return {

            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

        function refreshPurchaseOrderStatus(nsid) {

            return search.lookupFields({
                type: search.Type.PURCHASE_ORDER,
                id: nsid,
                columns: ['status']
            }).status.value;
        }

        function createSummaryRecord(summary) {

            try {

                var s = '';

                s += 'seconds = ' + summary.seconds + ' ';
                s += 'usage = ' + summary.usage + ' ';
                s += 'yields = ' + summary.yields;

                ctc.log.info('createSummaryRecord', 'Summary', s, runtime, true);

            } catch (e) {

                handleErrorAndSendNotification(e, 'summarize');

            }
        }

        function handleErrorAndSendNotification(e, stage, errorMsg) {

            ctc.log.error(stage, 'error', e, runtime, true);
            ctc.log.error(stage, 'ERROR_RUNNING_SCRIPT', errorMsg, runtime, true);

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
                handleErrorAndSendNotification(e, 'getInputData');
            }

            handleErrorInStage('map', mapSummary);
            handleErrorInStage('reduce', reduceSummary);
        }

        function handleErrorInStage(stage, summary) {

            ctc.log.info(stage, 'summary', summary, runtime, true);

            var errorMsg = [];
            summary.errors.iterator().each(function(key, value) {
                var msg = 'Error processing Purchase Order: ' + key + ' Error was: ' + JSON.parse(value).message + '\n';
                errorMsg.push(msg);
                return true;
            });
            if (errorMsg.length > 0) {
                var e = error.create({
                    name: 'ERROR_RUNNING_SCRIPT',
                    message: JSON.stringify(errorMsg)
                });

                handleErrorAndSendNotification(e, stage, errorMsg);
            }
        }

    });