/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @author ajdeleon
 **/

/*jshint esversion: 9 */
define((require) => {
    const ns_search = require('N/search');
    const ns_record = require('N/record');
    const ns_format = require('N/format');

    const EntryPoint = {};
    const RECORD = {
        VCLOGREP: {
            ID: 'customrecord_ctc_vcsp_log_summary',
            FIELD: {
                APPLICATION: 'custrecord_ctc_vclog_application',
                CATEGORY: 'custrecord_ctc_vclog_category',
                COUNT: 'custrecord_ctc_vclog_count',
                DATE: 'custrecord_ctc_vclog_date',
                TYPE: 'custrecord_ctc_vclog_type',
                VENDOR: 'custrecord_ctc_vclog_vendorconfig',
                TRANSACTION: 'custrecord_ctc_vclog_transaction',
                AMOUNT: 'custrecord_ctc_vclog_amount',
                LOGKEY: 'custrecord_ctc_vclog_key',
                COMPANYNAME: 'custrecord_ctc_vclog_compname',
                ACCOUNTID: 'custrecord_ctc_vclog_account'
            }
        }
    };
    const VCLog_Report = {
        addLogReport: (objValues, reportKey) => {
            var logReportId = VCLog_Report.searchLogReport(reportKey);
            var VCLOGREP_REC = RECORD.VCLOGREP;
            var recLogReport = logReportId
                ? ns_record.load({ type: VCLOGREP_REC.ID, id: logReportId })
                : ns_record.create({ type: VCLOGREP_REC.ID });

            // process the values
            var vcLogRepValues = {};
            for (let fldKey in VCLOGREP_REC.FIELD) {
                vcLogRepValues[VCLOGREP_REC.FIELD[fldKey]] = objValues[VCLOGREP_REC.FIELD[fldKey]];
            }

            if (!Helper.isEmpty(vcLogRepValues[VCLOGREP_REC.FIELD.DATE])) {
                vcLogRepValues[VCLOGREP_REC.FIELD.DATE] = ns_format.parse({
                    value: new Date(vcLogRepValues[VCLOGREP_REC.FIELD.DATE]),
                    type: ns_format.Type.DATE
                });
            }
            log.debug('.. vcLogRepValues: ', vcLogRepValues);
            // set the values
            for (var fld in vcLogRepValues) {
                var val = vcLogRepValues[fld];
                if (!val) continue;
                recLogReport.setValue({ fieldId: fld, value: val });
            }
            var recId = recLogReport.save();
            log.audit('success', `Added log report id: ${recId}`);
            return true;
        },
        searchLogReport: (reportKey) => {
            if (!reportKey) return false;
            var VCLOGREP_REC = RECORD.VCLOGREP;
            var logReportSearch = ns_search.create({
                type: VCLOGREP_REC.ID,
                filters: [[VCLOGREP_REC.FIELD.LOGKEY, 'is', reportKey]],
                columns: ['internalid']
            });
            var logReportId = null;
            logReportSearch.run().each((searchRow) => {
                logReportId = searchRow.getValue({ name: 'internalid' });
            });
            return logReportId;
        }
    };

    EntryPoint.post = (context) => {
        try {
            if (!Helper.isJsonParsable(context)) {
                log.error('Invalid Request Body', context);
                throw 'Invalid Request Body';
            }

            let objBody = JSON.parse(context);
            log.debug('objBody', objBody);
            let arrValues = objBody.rows;

            for (let i = 0; i < arrValues.length; i++) {
                let logKey = arrValues[i].custrecord_ctc_vclog_key;
                VCLog_Report.addLogReport(arrValues[i], logKey);
            }

            return 'success';
        } catch (ex) {
            throw ex;
        }
    };

    const Helper = {
        isJsonParsable: (stValue) => {
            try {
                JSON.parse(stValue);
                return true;
            } catch (error) {
                return false;
            }
        },
        isEmpty: (stValue) => {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isString(stValue) && stValue.trim() === '') ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (let k in v) return false;
                        return true;
                    })(stValue))
            );
        }
    };

    return EntryPoint;
});
