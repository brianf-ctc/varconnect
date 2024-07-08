/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * Project Number: <insert TODO here>
 * Script Name: <put NS script name here>
 * Author: <email>
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @Description <Put some here..>
 *
 * CHANGELOGS
 *
 */
define(function (require) {
    let ns_runtime = require('N/runtime'),
        ns_url = require('N/url'),
        ns_search = require('N/search'),
        ns_ui = require('N/ui/serverWidget');

    let lib_UI = require('./ctc_lib_uihelper'),
        ctc_util = require('./ctc_util');

    let LogTitle = 'VC-LogReports';

    var CONFIG = {
        FILTER_PROCESSING: false,
        // CLIENTJS: './ctc_gps_cs_stagingrec_client.js',
        // DEPLOYMENT: {
        //     PRODUCT: 'customdeploy_ctc_gps_stagerec_product',
        //     CUSTOMER: 'customdeploy_ctc_gps_stagerec_customer'
        // },
        // PARAM: {
        //     DEFAULT_PAGE: 'custscript_ctc_gps_reclist_defaultpage',
        //     DEFAULT_SEARCH: '',
        //     SEARCH_PROCESSD: 'custscript_ctc_gps_processedrecs_search',
        //     SEARCH_PENDING: 'custscript_ctc_gps_pendingrecs_search'
        // },
        SESSION: {
            ResultMsg: 'resultMessage',
            ErrorMsg: 'errorMessage'
        },
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

    var Helper = {
        sessionGet: function (sessionName) {
            var sessValue = ns_runtime.getCurrentSession().get({ name: sessionName });
            if (!ctc_util.isEmpty(sessValue)) {
                try {
                    sessValue = JSON.parse(sessValue);
                } catch (err) {
                    sessValue = sessValue;
                }
            }
            return sessValue;
        },
        sessionSet: function (sessionName, sessionValue) {
            sessionValue = util.isString(sessionValue)
                ? sessionValue
                : JSON.stringify(sessionValue);
            ns_runtime.getCurrentSession().set({ name: sessionName, value: sessionValue });
        },
        sessionClear: function (sessionName) {
            return ns_runtime.getCurrentSession().set({ name: sessionName, value: null });
        },
        initMessage: function (option) {
            if (!option.sessionName || !option.form) return;

            var msgValue = Helper.sessionGet(option.sessionName);
            if (ctc_util.isEmpty(msgValue)) return;

            option.form.addPageInitMessage({
                message: msgValue,
                title: option.msgTitle,
                type: option.msgType
            });

            Helper.sessionClear(option.sessionName);
            return true;
        },
        handleInitMessages: function (option) {
            var initMsg = {
                resultMsg: Helper.sessionGet(CONFIG.SESSION.ResultMsg),
                errorMsg: Helper.sessionGet(CONFIG.SESSION.ErrorMsg)
            };
            if (initMsg.resultMsg) {
                Form.addPageInitMessage({
                    message: initMsg.resultMsg,
                    title: 'Successful',
                    type: NS_Msg.Type.CONFIRMATION
                });
                Helper.sessionClear(CONFIG.SESSION.ResultMsg);
            }
            if (initMsg.errorMsg) {
                Form.addPageInitMessage({
                    message: initMsg.errorMsg,
                    title: 'Error Encountered',
                    type: NS_Msg.Type.ERROR
                });
                Helper.sessionClear(CONFIG.SESSION.ErrorMsg);
            }

            return true;
        }
    };

    let VCLogReport = {
        Sublist: {
            listall: function (option) {
                var logTitle = [LogTitle, 'Sublist.listAll'].join('::');

                var REC_LOGREP = CONFIG.VCLOGREP;

                var summaryCols = {
                    GROUP: [
                        {
                            name: REC_LOGREP.FIELD.COMPANYNAME,
                            label: 'CompanyName'
                        },
                        {
                            name: REC_LOGREP.FIELD.VENDOR,
                            label: 'Vendor'
                        }
                    ],
                    SUM: [
                        {
                            name: 'itemffcnt',
                            fieldid: 'itemffcnt',
                            label: 'IF Count',
                            formula:
                                "CASE WHEN {custrecord_ctc_vclog_category} = 'Fulfillment Created' " +
                                'THEN {custrecord_ctc_vclog_count} ELSE 0 END'
                        },

                        {
                            name: 'billcnt',
                            fieldid: 'billcnt',
                            label: 'Bills Count',
                            formula:
                                "CASE WHEN {custrecord_ctc_vclog_category} = 'Bill Created' " +
                                'THEN {custrecord_ctc_vclog_count} ELSE 0 END'
                        }
                    ]
                };

                var columnsDef = {},
                    searchObj,
                    sublistOption = {
                        id: 'custpage_sublist_all',
                        label: 'All Data (This year)',
                        form: option.form,
                        pageSize: 4000
                    },
                    searchOption = {
                        type: REC_LOGREP.ID,
                        filters: [[REC_LOGREP.FIELD.DATE, 'within', 'thisyear']],
                        columns: []
                    };

                var fldCnt = 0;

                // process the GROUPings
                summaryCols.GROUP.forEach(function (colData) {
                    columnsDef[colData.name] = util.extend(colData, {
                        summary: 'GROUP'
                    });

                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: colData.name,
                            summary: 'GROUP'
                        })
                    );

                    fldCnt++;

                    return true;
                });

                // process the SUM fields
                summaryCols.SUM.forEach(function (colData, idx) {
                    columnsDef['formulanumeric_' + fldCnt] = {
                        label: colData.label,
                        colname: 'formulanumeric',
                        summary: 'SUM'
                    };

                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: 'formulanumeric',
                            summary: 'SUM',
                            formula: colData.formula
                        })
                    );
                    fldCnt++;

                    return true;
                });

                var searchObj = ns_search.create(searchOption);
                sublistObj = lib_UI.PaginatedSublist(
                    util.extend(sublistOption, {
                        searchObj: searchObj,
                        columnsDef: columnsDef
                    })
                );

                return sublistObj;
            }
        },
        Filters: {},
        Page: {
            AllData: {
                onGet: function (option) {
                    var logTitle = [LogTitle, 'AllData.GET'].join('::'),
                        Request = lib_UI.Request,
                        Response = lib_UI.Response;

                    // log.debug(logTitle, '## START ##' + JSON.stringify)
                    var Form = ns_ui.createForm({
                        title: ['VAR Connect Log Summary Reports'].join(' | ')
                    });

                    lib_UI.setForm(Form);

                    // Form.addField({
                    //     id: 'custpage_test',
                    //     type: ns_ui.FieldType.LONGTEXT,
                    //     label: 'Test Long tExt'
                    // });

                    VCLogReport.Sublist.listall.call(VCLogReport, { form: Form });

                    return Response.writePage({ pageObject: Form });
                }
            }
        }
    };

    return {
        onRequest: function (context) {
            var logTitle = [LogTitle, 'onRequest'].join('::'),
                returnValue;

            try {
                var currentScript = ns_runtime.getCurrentScript();
                // var paramPage = currentScript.getParameter({ name: CONFIG.PARAM.DEFAULT_PAGE });
                // log.debug(logTitle, '>> param page: ' + paramPage);

                lib_UI.initialize(context, {
                    pages: VCLogReport.Page,
                    defaultPage: 'AllData'
                });

                lib_UI = util.extend(lib_UI, {
                    Method: context.request.method.toUpperCase(),
                    Request: context.request || null,
                    Response: context.response || null
                });

                lib_UI.loadCurrentPage();

                return true;
            } catch (error) {
                throw error;
            }

            return true;
        }
    };
});
