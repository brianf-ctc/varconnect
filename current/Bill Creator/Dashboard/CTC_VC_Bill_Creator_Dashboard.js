/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
define(['N/search', 'N/file', '../Libraries/mustache', '../../CTC_VC2_Lib_Utils'], function (
    ns_search,
    ns_file,
    Mustache,
    vc2_util
) {
    var dashboardVersion = '-whit', // v20230709
        dashboardHtmlFilename = ['dashboard', dashboardVersion, '.html'].join(''); // dashboard-whit.html
    function onRequest(context) {
        var logTitle = 'BillCreator Dashboard';
        var data = {};

        // data.block_one_value = '12'
        // data.block_two_value = '24'
        // data.block_three_value = '77'
        // data.block_four_value = '354'

        //var s;

        var s1 = ns_search.load({
            id: 'customsearch_vc_bc_not_proc_due_soon',
            type: 'customrecord_ctc_vc_bills'
        });
        data.alert_due = s1.runPaged().count;

        //To Be Processed - Errors
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

        var s3 = ns_search.load({
            id: 'customsearch_vc_bc_missing_po_link',
            type: 'customrecord_ctc_vc_bills'
        });
        data.no_po_cnt = s3.runPaged().count;

        var s4 = ns_search.load({
            id: 'customsearch_vc_bc_non_processed_bc_hold',
            type: 'customrecord_ctc_vc_bills'
        });
        data.on_hold_cnt = s4.runPaged().count;

        var s5 = ns_search.load({
            id: 'customsearch_vc_bc_pending_receipt_tr',
            type: 'customrecord_ctc_vc_bills'
        });
        data.pend_rcpt_cnt = s5.runPaged().count;

        //To Be Processed - ALL
        var s6 = ns_search.load({
            type: 'customrecord_ctc_vc_bills',
            id: 'customsearch_vc_bc_non_processed_bc_all'
        });
        data.to_be_proc_cnt = s6.runPaged().count;

        //To Be Processed - Variance
        var s7 = ns_search.load({
            type: 'customrecord_ctc_vc_bills',
            id: 'customsearch_vc_bc_non_processed_bcd_var'
        });
        data.variance_cnt = s7.runPaged().count;

        //To Be Processed - Pending
        var s8 = ns_search.load({
            type: 'customrecord_ctc_vc_bills',
            id: 'customsearch_vc_bc_non_processed_bcd_pen'
        });
        data.pending_cnt = s8.runPaged().count;

        //To Be Processed - Reprocess
        var s9 = ns_search.load({
            type: 'customrecord_ctc_vc_bills',
            id: 'customsearch_vc_bc_non_processed_bcd_rep'
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
