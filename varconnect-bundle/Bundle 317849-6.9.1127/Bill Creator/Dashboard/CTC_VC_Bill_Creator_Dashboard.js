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
 * @NScriptType Suitelet
 */
define(['N/search', 'N/file', '../Libraries/mustache'], function (search, file, Mustache) {
    function onRequest(context) {
        var data = {};

        // data.block_one_value = '12'
        // data.block_two_value = '24'
        // data.block_three_value = '77'
        // data.block_four_value = '354'

        //var s;

        var s1 = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_due_date', 'onorbefore', 'weeksfromnow1'],
                'AND',
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '1', '2', '4', '6', '7'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.alert_due = s1.runPaged().count;

        var s2 = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '2'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.alert_error = s2.runPaged().count;

        var s3 = search.create({
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

        var s4 = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '6'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.on_hold_cnt = s4.runPaged().count;

        var s5 = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_linked_po.status', 'anyof', 'PurchOrd:B'],
                'AND',
                ['custrecord_ctc_vc_bill_linked_po.mainline', 'is', 'T'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.pend_rcpt_cnt = s5.runPaged().count;

        var s6 = search.create({
            type: 'customrecord_ctc_vc_bills',
            filters: [
                ['custrecord_ctc_vc_bill_proc_status', 'anyof', '1', '2', '4', '7'],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        data.to_be_proc_cnt = s6.runPaged().count;

        var html = file.load({ id: 'SuiteScripts/dashboard.html' }).getContents();

        context.response.write(Mustache.render(html, data));
    }

    return {
        onRequest: onRequest
    };
});
