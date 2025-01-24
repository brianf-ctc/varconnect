/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define([
    'N/search',
    'N/runtime',
    'N/error',
    'N/log',
    'N/sftp',
    './Libraries/moment',
    './Libraries/CTC_VC_Lib_Create_Bill_Files',
    './Libraries/CTC_VC_Lib_Vendor_Map'
], function (search, runtime, error, log, sftp, moment, vp, vm) {
    function getInputData() {
        // since we would have to update this code anyway to support a new vendor config the nsid's
        // are hard coded here instead of doing a search

        return [2, 5, 6]; //[DH, WF, SYNNEX]

        // return [2, 5];

        //return [2];
    }

    function map(context) {
        //get the vendor config details

        log.debug('context.value', context.value);

        var vendorConfig = search.lookupFields({
            type: 'customrecord_vc_bill_vendor_config',
            id: context.value,
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
            id: context.value,
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

        log.debug('configObj', configObj);

        var connection = sftp.createConnection({
            username: configObj.user_id,
            passwordGuid: configObj.user_pass,
            url: configObj.url,
            directory: configObj.res_path,
            hostKey: configObj.host_key
        });

        var list = connection.list();

        // create an array of files created in the last 90 days
        // if we already know about the file we'll ignore it in
        // the next step

        var s = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [['created', 'onorafter', 'daysago90']],
            columns: [
                search.createColumn({
                    name: 'name',
                    summary: 'GROUP',
                    sort: search.Sort.ASC
                })
            ]
        });

        var pagedData = s.runPaged({
            pageSize: 1000
        });

        var existingFiles = [];

        for (var i = 0; i < pagedData.pageRanges.length; i++) {
            var currentPage = pagedData.fetch(i);

            currentPage.data.forEach(function (result) {
                existingFiles.push(
                    result.getValue({
                        name: 'name',
                        summary: 'GROUP'
                    })
                );
            });
        }

        for (var i = 0; i < list.length; i++) {
            //for (var i = 0; i < 50; i++) {

            if (
                list[i].directory == false &&
                moment(list[i].lastModified).isSameOrAfter(moment().subtract(90, 'days'), 'day')
            ) {
                if (configObj.id == 2) {
                    //D&H
                    if (list[i].name == '..' || list[i].name.slice(-3) !== 'txt') {
                        continue;
                    }
                } else if (configObj.id == 5) {
                    //Wells Fargo
                    // process all files
                } else if (configObj.id == 6) {
                    //Synnex
                    if (list[i].name == '..' || list[i].name.slice(-3) !== 'xml') {
                        continue;
                    }
                }

                // check to see if we've already downloaded this file and if so skip
                // loading it to the array so we don't download it again.

                var found = false;

                for (var e = 0; e < existingFiles.length; e++) {
                    if (list[i].name == existingFiles[e]) {
                        found = true;
                        continue;
                    }
                }

                if (found == true) {
                    continue;
                }

                // if we've made it through all the traps, then write the file to the
                // context so we can process it in the next step.

                log.debug('adding file', list[i].name);

                context.write({
                    key: list[i].name,
                    value: JSON.stringify(configObj)
                });
            }
        }
    }

    function reduce(context) {
        //log.debug(context.key, context.values[0]);

        var configObj = JSON.parse(context.values[0]);

        try {
            var entryFunction = configObj.entry_function;

            var myArr = [];

            switch (entryFunction) {
                case 'dh_sftp':
                    myArr = vm.dh_sftp(context.key, configObj);
                    break;
                case 'wellsfargo_sftp':
                    myArr = vm.wellsfargo_sftp(context.key, configObj);
                    break;
                case 'synnex_sftp':
                    myArr = vm.synnex_sftp(context.key, configObj);
                    break;
            }

            //log.debug(context.key, myArr);

            log.audit('calling vp.process');

            vp.process(configObj, myArr, context.key);

            log.audit('vp.process finished');
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
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
