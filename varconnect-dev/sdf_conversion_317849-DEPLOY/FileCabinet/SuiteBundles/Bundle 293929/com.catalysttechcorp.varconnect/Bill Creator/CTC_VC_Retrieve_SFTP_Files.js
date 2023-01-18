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

    var LogTitle = 'MR_BillFiles-SFTP';

                function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join(':');

                    // since we would have to update this code anyway to support a new vendor config the nsid's
                    // are hard coded here instead of doing a search
        // return [2, 5, 6]; //[DH, WF, SYNNEX]
        var CONNECT_TYPE = {
                API: 1,
                SFTP: 2
            },
            validVendorCfg = [];

        var vendorConfigSearch = search.create({
            type: 'customrecord_vc_bill_vendor_config',
            filters: [['custrecord_vc_bc_connect_type', 'anyof', CONNECT_TYPE.SFTP]],
            columns: ['internalid']
        });

        vendorConfigSearch.run().each(function (result) {
            validVendorCfg.push(result.id);
            return true;
        });

        log.debug(logTitle, '>> Valid SFTP Configs : ' + JSON.stringify(validVendorCfg) );

        return validVendorCfg;
                }

                function map(context) {
        var logTitle = [LogTitle, 'map'].join(':');

                    //get the vendor config details
        log.audit(logTitle, '>> context.value: ' + JSON.stringify(context.value));

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
        log.audit(logTitle, '>> configObj: ' + JSON.stringify(configObj));

                    var connection = sftp.createConnection({
                        username: configObj.user_id,
                        passwordGuid: configObj.user_pass,
                        url: configObj.url,
                        directory: configObj.res_path,
            hostKey: configObj.host_key
                    });

                    var list = connection.list();
        log.audit(logTitle, '>> connectionList: ' + JSON.stringify(list.length));
                    
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

        var pagedData = s.runPaged({pageSize: 1000});

                    var existingFiles = [];


                    for (var i = 0; i < pagedData.pageRanges.length; i++) {

                        var currentPage = pagedData.fetch(i);

                        currentPage.data.forEach(function(result) {
                existingFiles.push(
                    result.getValue({
                        name: 'name',
                        summary: 'GROUP'
                    })
                );
                        });
                    }
        log.audit(logTitle, '>> ..existing Files: ' + JSON.stringify(existingFiles.length));

                    for (var i = 0; i < list.length; i++) {

            log.audit(logTitle, '>>> Current File <<< ' + JSON.stringify(list[i]) );

            if (list[i].directory) {
                log.audit(logTitle, '>>> ...skipping directories. ');
                                    continue;
                                }

            var is90days = moment(list[i].lastModified).isSameOrAfter(
                moment().subtract(90, 'days'),
                'day'
            );
            log.audit(logTitle, '>>> is 90 days old? ' + JSON.stringify(is90days) );

            if (!is90days) {
                log.audit(logTitle, '>>> ...skipping older than 90 days. ');
                continue;
            }

            if ( configObj.entry_function == 'synnex_sftp') {
                                if (list[i].name == '..' || list[i].name.slice(-3) !== 'xml') {
                    log.audit(logTitle, '>>> ...skipping non xml files. ');
                                    continue;
                                }
            } else if ( configObj.entry_function == 'dh_sftp') {
                if ( list[i].name == '..' || list[i].name.slice(-3) !== 'txt' ) {
                    log.audit(logTitle, '>>> ...skipping non txt files. ');
                    continue;
                }
                            }

            var isAlreadyProcessed = false;
                            for (var e = 0; e < existingFiles.length; e++) {
                                if (list[i].name == existingFiles[e]) {
                    isAlreadyProcessed = true;
                    break;
                                }
                            }
            if ( isAlreadyProcessed ) {
                log.audit(
                    logTitle,
                    '... skipping, already processed. ' +
                        JSON.stringify([list[i].name, existingFiles[e]])
                );
                                continue;
                            }

            log.audit(logTitle, '>>> adding file: ' + JSON.stringify(list[i].name));
                            context.write({
                                key: list[i].name,
                value: JSON.stringify(configObj)
                            });

                        }
                }

                function reduce(context) {
        var logTitle = [LogTitle, 'reduce'].join(':');
                    //log.debug(context.key, context.values[0]);

                    var configObj = JSON.parse(context.values[0]);
        log.audit(logTitle, '>> ## configObj: ' + JSON.stringify(configObj) );

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
            log.audit(logTitle, '>> ## myArr: ' + JSON.stringify(myArr) );

                        vp.process(configObj, myArr, context.key);

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

                    summary.errors.iterator().each(function(key, value) {
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
