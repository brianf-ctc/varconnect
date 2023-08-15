/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
 * @NScriptType Suitelet
 */
define([
    'N/search',
    'N/file',
    '../Libraries/mustache',
    '../../CTC_VC2_Lib_Utils'
], function (ns_search, ns_file, Mustache, vc2_util) {
    var dashboardVersion = '-whit', // v20230709
        dashboardHtmlFilename = ['dashboard', dashboardVersion, '.html'].join(
            ''
        ); // dashboard-whit.html
    function onRequest(context) {
        var logTitle = 'BillCreator Dashboard';
        var data = {};

        // data.block_one_value = '12'
        // data.block_two_value = '24'
        // data.block_three_value = '77'
        // data.block_four_value = '354'

        //var s;

        var s1 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                [
                    'custrecord_ctc_vc_bill_due_date',
                    'onorbefore',
                    'weeksfromnow1'
                ],
                'AND',
                [
                    'custrecord_ctc_vc_bill_proc_status',
                    'anyof',
                    '1',
                    '2',
                    '4',
                    '6',
                    '7'
                ],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.alert_due = s1.runPaged().count;

        var s2 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '2'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.alert_error = s2.runPaged().count;

        var s3 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'noneof', '5'],
                'AND',
                ['custrecord_ctc_vc_bill_linked_po', 'anyof', '@NONE@'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.no_po_cnt = s3.runPaged().count;

        var s4 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '6'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.on_hold_cnt = s4.runPaged().count;

        var s5 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                [
                    'custrecord_ctc_vc_bill_linked_po.status',
                    'anyof',
                    'PurchOrd:B'
                ],
                'AND',
                ['custrecord_ctc_vc_bill_linked_po.mainline', 'is', 'T'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.pend_rcpt_cnt = s5.runPaged().count;

        var s6 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                [
                    'custrecord_ctc_vc_bill_proc_status',
                    'anyof',
                    '1',
                    '2',
                    '4',
                    '7'
                ],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.to_be_proc_cnt = s6.runPaged().count;

        var s7 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '7'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.variance_cnt = s7.runPaged().count;

        var s8 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '1'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.pending_cnt = s8.runPaged().count;

        var s9 = ns_search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '4'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.reprocess_cnt = s9.runPaged().count;

        var s10 = ns_search.create({
            type: 'customrecordtype',
            filters: [['scriptid', 'is', 'customrecord_vc_bill_vendor_config']]
        });
        s10.run(0, 1).each(function (result) {
            data.vendconfig_rectype_id = result.id;
            return false;
        });

        //search for the file first
        var fileSearch = vc2_util.searchFile({
            name: dashboardHtmlFilename,
            folder: -15 // Suitescripts folder
        });
        vc2_util.log(logTitle, 'fileSearch >> ', fileSearch);

        if (!fileSearch) {
            var dashboardFile = vc2_util.searchFile({
                name: 'dashboard-sample.html'
            });
            vc2_util.log(logTitle, 'dashboardFile >> ', dashboardFile);

            if (!dashboardFile) throw 'Unable to find dashboard file';

            // create the file
            var newFileObj = ns_file.create({
                name: dashboardHtmlFilename,
                fileType: ns_file.Type.PLAINTEXT,
                contents: vc2_util.getFileContent({
                    fileId: dashboardFile.id
                }),
                description: 'Bill Creator Dashboard file',
                encoding: ns_file.Encoding.UTF8,
                folder: -15 // suitescript folder
            });

            newFileObj.save();
        }

        var html = ns_file
            .load({ id: ['SuiteScripts/', dashboardHtmlFilename].join('') })
            .getContents();
        context.response.write(Mustache.render(html, data));
    }

    return {
        onRequest: onRequest
    };
});
