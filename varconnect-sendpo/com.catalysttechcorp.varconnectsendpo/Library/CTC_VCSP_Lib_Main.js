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
 */
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for main processing of VAR Connect Send PO
 */
define([
    'N/record',
    './CTC_VCSP_Lib_Preferences.js',
    './CTC_VCSP_Lib_WebService.js',
    '../VO/CTC_VCSP_PO.js'
], function (record, pref, libWebService, PO) {
    var LogTitle = 'VCSendPO';
    function _setTransactionNum(options) {
        var response = options.response,
            rec = options.rec;

        if (response) {
            var transactionNum = response.tranasctionNum;

            if (transactionNum) {
                record.submitFields({
                    type: rec.type,
                    id: rec.id,
                    values: {
                        custbody_ctc_vcsp_transaction_num: transactionNum
                    }
                });
            }
        }
    }

    function sendPO(options) {
        var logTitle = [LogTitle, 'sendPO'].join('::');

        var recId = options.recId,
            response;
        var rec = record.load({
            type: record.Type.PURCHASE_ORDER,
            id: recId,
            isDynamic: true
        });

        if (rec) {
            response = libWebService.process({
                nativePO: rec
            });

            log.audit(logTitle, '>> send PO response: ' + JSON.stringify(response));

            var updateValues = {
                custbody_ctc_vcsp_timestamp: new Date(),
                custbody_ctc_vcsp_is_po_sent: true,
                custbody_ctc_vcsp_vendor_rcpt: JSON.stringify(
                    {
                        code: response.responseCode,
                        message: response.message
                    },
                    null,
                    '\t'
                )
            };

            if (response.isError) {
                updateValues.custbody_ctc_vcsp_vendor_rcpt = JSON.stringify(response, null, '\t');
            }

            record.submitFields({
                type: record.Type.PURCHASE_ORDER,
                id: recId,
                values: updateValues,
                options: {
                    enablesourcing: false,
                    ignoreMandatoryFields: true
                }
            });
        }

        return response;
    }

    return {
        sendPO: sendPO
    };
});
