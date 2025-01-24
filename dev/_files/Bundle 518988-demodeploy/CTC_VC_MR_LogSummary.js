/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of Catalyst Tech Corp. ('Confidential Information").
 * You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license
 * agreement you entered into with Catalyst Tech Corp.
 **/

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author ajdeleon
 **/

/*jshint esversion: 9 */
define((require) => {
    const ns_search = require('N/search');
    const ns_record = require('N/record');
    const ns_error = require('N/error');
    const ns_runtime = require('N/runtime');
    const ns_format = require('N/format');
    const ns_cache = require('N/cache');
    const ns_config = require('N/config');

    var LOG_TITLE = 'VCLogReports',
        LOG_PREFIX = '';

    var CACHE = {},
        MAX_CHUNK = 300;

    const SCRIPT_PARAMETER_NAMES = {
            // vcLogsSearchId: { optional: true, id: 'custscript_ctc_logrep_vclogsearch' },
            // vcBillFileSearch: { optional: true, id: 'custscript_ctc_logrep_billfilesearch' },
            fromDate: { optional: true, id: 'custscript_ctc_logrep_fromdate' },
            toDate: { optional: true, id: 'custscript_ctc_logrep_todate' }
        },
        LIST = {
            CATEGORY: {
                FULFILLMENT: 'Fulfillment Created',
                ORDERLINE: 'PO Line',
                BILLFILE_CREATED: 'BillFile Created',
                BILL_CREATED: 'Bill Created',
                PO_COUNT: 'PO Count',
                POLINE_COUNT: 'PO Line Count',
                PO_PROCESSED: 'PO Processed',
                POLINE_PROCESSD: 'PO Processed Line',
                POLINE_SHIPPED: 'PO Line Shipped',
                POLINE_BILLED: 'PO Line Billed',

                MISSING_ORDERNUM: 'Missing Order',
                INVALID_LOGIN: 'Invalid Login',
                INVALID_HOST: 'Invalid Host',
                INVALID_XML_RESP: 'Invalid XML Response'
            },
            TYPE: {
                SUCCESS: 'SUCCESS',
                ERROR: 'ERROR'
            }
        },
        RECORD = {
            VCLOGREP: {
                ID: 'customrecord_ctc_vcsp_log_summary',
                FIELD: {
                    APPLICATION: 'custrecord_ctc_vclog_application',
                    CATEGORY: 'custrecord_ctc_vclog_category',
                    COUNT: 'custrecord_ctc_vclog_count',
                    DATE: 'custrecord_ctc_vclog_date',
                    TYPE: 'custrecord_ctc_vclog_type',
                    VENDOR: 'custrecord_ctc_vclog_vendorconfig',
                    AMOUNT: 'custrecord_ctc_vclog_amount',
                    LOGKEY: 'custrecord_ctc_vclog_key',
                    COMPANYNAME: 'custrecord_ctc_vclog_compname',
                    ACCOUNTID: 'custrecord_ctc_vclog_account'
                }
            },
            VCLOG: {
                ID: 'customrecord_ctc_vcsp_log',
                FIELD: {
                    // ID: 'internalid',
                    APPLICATION: 'custrecord_ctc_vcsp_log_app',
                    HEADER: 'custrecord_ctc_vcsp_log_header',
                    BODY: 'custrecord_ctc_vcsp_log_body',
                    TRANSACTION: 'custrecord_ctc_vcsp_log_transaction',
                    STATUS: 'custrecord_ctc_vcsp_log_status',
                    DATE: 'custrecord_ctc_vcsp_log_date'
                }
            },
            BILLFILE: {
                ID: 'customrecord_ctc_vc_bills',
                FIELD: {
                    // ID: 'id',
                    // NAME: 'name',
                    POID: 'custrecord_ctc_vc_bill_po',
                    PO_LINK: 'custrecord_ctc_vc_bill_linked_po',
                    BILL_NUM: 'custrecord_ctc_vc_bill_number',
                    BILL_LINK: 'custrecord_ctc_vc_bill_linked_bill',
                    // DATE: 'custrecord_ctc_vc_bill_date',
                    // DUEDATE: 'custrecord_ctc_vc_bill_due_date',
                    // DDATE_INFILE: 'custrecord_ctc_vc_bill_due_date_f_file',
                    STATUS: 'custrecord_ctc_vc_bill_proc_status',
                    PROCESS_LOG: 'custrecord_ctc_vc_bill_log',
                    INTEGRATION: 'custrecord_ctc_vc_bill_integration',
                    // SOURCE: 'custrecord_ctc_vc_bill_src',
                    JSON: 'custrecord_ctc_vc_bill_json',
                    NOTES: 'custrecord_ctc_vc_bill_notes'
                    // HOLD_REASON: 'custrecord_ctc_vc_bill_hold_rsn',
                    // IS_RCVBLE: 'custrecord_ctc_vc_bill_is_recievable',
                    // PROC_VARIANCE: 'custrecord_ctc_vc_bill_proc_variance',
                    // FILEPOS: 'custrecord_ctc_vc_bill_file_position'
                }
            }
        },
        VCLOG_REC = {},
        VCLOGREP_REC = {};
    var SCRIPT_PARAM = {};

    const VCLog_Report = {
        VCLOGS: {
            search: (reportSetting) => {
                var logTitle = [LOG_TITLE, 'VCLOGS::Search'].join('::');
                Helper.log(logTitle, 'ReportSettings: ', reportSetting);

                var VCLOG_REC = RECORD.VCLOG;

                let fromDate = Helper.formatDate(SCRIPT_PARAM.fromDate),
                    toDate = Helper.formatDate(SCRIPT_PARAM.toDate);

                if (!SCRIPT_PARAM.fromDate) {
                    let newFromDate = SCRIPT_PARAM.toDate
                        ? ns_format.parse({
                              value: SCRIPT_PARAM.toDate,
                              type: ns_format.Type.DATE
                          })
                        : new Date();

                    newFromDate.setDate(newFromDate.getDate() - 1);

                    fromDate = ns_format.format({
                        value: newFromDate,
                        type: ns_format.Type.DATE
                    });
                }

                Helper.log(logTitle, '## search dates: ', [
                    SCRIPT_PARAM.fromDate,
                    SCRIPT_PARAM.toDate,
                    fromDate,
                    toDate
                ]);

                var searchObj = ns_search.create({
                    type: VCLOG_REC.ID,
                    filters: [[VCLOG_REC.FIELD.DATE, 'within', fromDate, toDate]],
                    columns: [
                        VCLOG_REC.FIELD.APPLICATION,
                        VCLOG_REC.FIELD.DATE,
                        VCLOG_REC.FIELD.STATUS,
                        VCLOG_REC.FIELD.HEADER,
                        VCLOG_REC.FIELD.BODY,
                        VCLOG_REC.FIELD.TRANSACTION
                    ]
                });
                return searchObj;
            },
            process: (reportSetting, context) => {
                var logTitle = [LOG_TITLE, 'VCLOGS:process'].join('::');
                var VCLOG_REC = RECORD.VCLOG,
                    VCLOGREP_REC = RECORD.VCLOGREP;
                // Helper.log(logTitle, 'ReportSettings: ', reportSetting);

                try {
                    var searchObj = VCLog_Report.VCLOGS.search(reportSetting);
                    if (!searchObj) return false;

                    var arrResults = searchObj
                        .run()
                        .getRange({ start: reportSetting.start, end: reportSetting.end });

                    Helper.log(logTitle, 'Total Results: ', arrResults.length);

                    arrResults.forEach((searchRow, idx) => {
                        var vcLogValues = {};
                        for (var logField in VCLOG_REC.FIELD) {
                            var rowValue = {
                                value: searchRow.getValue({ name: VCLOG_REC.FIELD[logField] }),
                                text: searchRow.getText({ name: VCLOG_REC.FIELD[logField] })
                            };
                            vcLogValues[logField] = rowValue.value;

                            // Helper.log(logTitle, '... rowValue: ', [logField, rowValue]);

                            if (rowValue.text && rowValue.value != rowValue.text) {
                                vcLogValues[logField] = rowValue;
                            }
                        }
                        vcLogValues.DATE = Helper.convertDate(vcLogValues.DATE);

                        if (vcLogValues.TRANSACTION && vcLogValues.TRANSACTION.value) {
                            vcLogValues.VENDOR = Helper.getVendorName({
                                poId: vcLogValues.TRANSACTION.value
                            });
                        }
                        // Helper.log(logTitle, '... vcLogValues: ', vcLogValues);

                        VCLog_Report.VCLOGS.mapping.forEach((fnVCLogAction) => {
                            let result = fnVCLogAction.call(null, vcLogValues);
                            if (result) {
                                context.write(result);
                                Helper.log(logTitle, '... ', {
                                    ii: idx,
                                    result: result
                                });
                            }
                            return true;
                        });

                        return true;
                    });
                } catch (error) {
                    log.error(logTitle, '>> error: ' + JSON.stringify(error));

                    Helper.logError(logTitle, error);
                }
            },
            mapping: [
                // FULFILLMENTS
                (logValues) => {
                    let logTitle = 'MAPPING:Fulfillment';
                    let reportObj = {
                            DATE: logValues.DATE,
                            APPLICATION: 'Order Status',
                            CATEGORY: LIST.CATEGORY.FULFILLMENT,
                            VENDOR: logValues.VENDOR
                        },
                        returnValue = null;
                    // log.audit(logTitle, '>> log values: ' + JSON.stringify(logValues));

                    var logKeyId = [
                        logValues.DATE,
                        logValues.VENDOR,
                        logValues.TRANSACTION.text || '-none-'
                    ];

                    try {
                        if (
                            /Fulfillment.*Successfully Created/i.test(logValues.HEADER) &&
                            /Success/i.test(logValues.STATUS.text)
                        ) {
                            // get the fulfillment id
                            var fulfillmentId = logValues.BODY.replace(
                                /^.*Created\sFulfillment.*\((.+?)\).*$/gs,
                                '$1'
                            );

                            logKeyId.push(fulfillmentId);
                            logKeyId.push(LIST.CATEGORY.FULFILLMENT);

                            util.extend(reportObj, {
                                CATEGORY: LIST.CATEGORY.FULFILLMENT,
                                TYPE: LIST.TYPE.SUCCESS
                            });

                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        } else if (/Fulfillment.*Order Lines/i.test(logValues.HEADER)) {
                            /// get the order num
                            var orderNum = logValues.HEADER.replace(/.*\[(.+?)\].*$/gs, '$1');

                            logKeyId.push(LIST.CATEGORY.ORDERLINE);
                            logKeyId.push(orderNum);

                            util.extend(reportObj, {
                                CATEGORY: LIST.CATEGORY.ORDERLINE,
                                TYPE: LIST.TYPE.SUCCESS
                            });

                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        } else if (/Fulfillment.*Missing Order Num/i.test(logValues.HEADER)) {
                            logKeyId.push(LIST.CATEGORY.MISSING_ORDERNUM);
                            util.extend(reportObj, {
                                CATEGORY: LIST.CATEGORY.MISSING_ORDERNUM,
                                TYPE: LIST.TYPE.ERROR
                            });

                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        }
                    } catch (error) {
                        Helper.logError(logTitle, error);
                        // } finally {
                        //     Helper.log(logTitle, '>> returnValue: ', returnValue);
                    }

                    return returnValue;
                },

                // INVALID LOGIN //
                (logValues) => {
                    let logTitle = 'MAPPING:InvalidLogin';

                    let reportObj = {
                            DATE: logValues.DATE,
                            APPLICATION: 'Order Status',
                            VENDOR: logValues.VENDOR
                        },
                        returnValue = null;
                    // log.audit(logTitle, '>> log values: ' + JSON.stringify(logValues));
                    var logKeyId = [logValues.DATE, logValues.VENDOR, logValues.TRANSACTION.value];
                    try {
                        if (
                            (/WebService Error/i.test(logValues.STATUS) &&
                                /Login failed/i.test(logValues.BODY)) ||
                            /XML services has not been registered/i.test(logValues.BODY) ||
                            /User not found/i.test(logValues.BODY) ||
                            /Client\.ValidateUser User not found/i.test(logValues.BODY) ||
                            /The login was invalid/i.test(logValues.BODY) ||
                            /Invalid client identifier/i.test(logValues.BODY)
                        ) {
                            logKeyId.push(LIST.CATEGORY.INVALID_LOGIN);
                            util.extend(reportObj, {
                                TYPE: LIST.TYPE.ERROR,
                                CATEGORY: LIST.CATEGORY.INVALID_LOGIN
                            });

                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        } else if (
                            /Received invalid response code/i.test(logValues.BODY) ||
                            /File or directory not found/i.test(logValues.BODY) ||
                            /Error 404/i.test(logValues.BODY)
                        ) {
                            logKeyId.push(LIST.CATEGORY.INVALID_HOST);
                            util.extend(reportObj, {
                                TYPE: LIST.TYPE.ERROR,
                                CATEGORY: LIST.CATEGORY.INVALID_HOST
                            });

                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        } else if (
                            /xml.Document: : Missing a required argument: xmldoc/i.test(
                                logValues.BODY
                            )
                        ) {
                            logKeyId.push(LIST.CATEGORY.INVALID_XML_RESP);
                            util.extend(reportObj, {
                                TYPE: LIST.TYPE.ERROR,
                                CATEGORY: LIST.CATEGORY.INVALID_XML_RESP
                            });
                            returnValue = {
                                key: logKeyId.join('_'),
                                value: reportObj
                            };
                        }
                    } catch (error) {
                        Helper.logError(logTitle, error);
                        // } finally {
                        //     Helper.log(logTitle, '>> returnValue: ', returnValue);
                    }

                    return returnValue;
                }
            ]
        },

        BILLFILE: {
            search: (reportSetting) => {
                var logTitle = [LOG_TITLE, 'BILLFILE::Search'].join('::');
                Helper.log(logTitle, 'ReportSettings: ', reportSetting);

                var BILLFILE_REC = RECORD.BILLFILE;

                let fromDate = Helper.formatDate(SCRIPT_PARAM.fromDate),
                    toDate = Helper.formatDate(SCRIPT_PARAM.toDate);

                if (!SCRIPT_PARAM.fromDate) {
                    let newFromDate = SCRIPT_PARAM.toDate
                        ? ns_format.parse({
                              value: SCRIPT_PARAM.toDate,
                              type: ns_format.Type.DATE
                          })
                        : new Date();

                    newFromDate.setDate(newFromDate.getDate() - 1);

                    fromDate = ns_format.format({
                        value: newFromDate,
                        type: ns_format.Type.DATE
                    });
                }

                Helper.log(logTitle, '## search dates: ', [
                    SCRIPT_PARAM.fromDate,
                    SCRIPT_PARAM.toDate,
                    fromDate,
                    toDate
                ]);

                var searchObj = ns_search.create({
                    type: BILLFILE_REC.ID,
                    filters: [
                        ['created', 'within', fromDate, toDate],
                        'OR',
                        ['lastmodified', 'within', fromDate, toDate],
                        'OR',
                        [
                            [
                                ['systemnotes.date', 'within', fromDate, toDate],
                                'AND',
                                ['systemnotes.type', 'is', 'F'],
                                'AND',
                                [
                                    'systemnotes.field',
                                    'anyof',
                                    'CUSTRECORD_CTC_VC_BILL_PROC_STATUS'
                                ],
                                // 'AND',
                                // [
                                //     ['systemnotes.oldvalue', 'isnot', 'Processed'],
                                //     'OR',
                                //     ['systemnotes.oldvalue', 'isnot', 'Closed']
                                // ],
                                'AND',
                                [
                                    ['systemnotes.newvalue', 'is', 'Processed'],
                                    'OR',
                                    ['systemnotes.newvalue', 'is', 'Closed'],
                                    'OR',
                                    ['systemnotes.newvalue', 'is', 'Error'],
                                    'OR',
                                    ['systemnotes.newvalue', 'is', 'Variance']
                                ]
                            ]
                        ]
                    ],
                    columns: [
                        'created',
                        'lastmodified',
                        'name',
                        BILLFILE_REC.FIELD.POID,
                        BILLFILE_REC.FIELD.PO_LINK,
                        BILLFILE_REC.FIELD.BILL_NUM,
                        BILLFILE_REC.FIELD.BILL_LINK,
                        BILLFILE_REC.FIELD.STATUS,
                        BILLFILE_REC.FIELD.INTEGRATION,
                        BILLFILE_REC.FIELD.PROCESS_LOG,
                        BILLFILE_REC.FIELD.JSON,
                        ns_search.createColumn({
                            name: 'date',
                            join: 'systemNotes'
                        }),
                        ns_search.createColumn({
                            name: 'field',
                            join: 'systemNotes'
                        }),
                        ns_search.createColumn({
                            name: 'oldvalue',
                            join: 'systemNotes'
                        }),
                        ns_search.createColumn({
                            name: 'newvalue',
                            join: 'systemNotes'
                        }),
                        ns_search.createColumn({
                            name: 'type',
                            join: 'systemNotes'
                        })
                    ]
                });

                return searchObj;
            },
            process: (reportSetting, context) => {
                var logTitle = [LOG_TITLE, 'LogReport:BILLFILE'].join('::');
                Helper.log(logTitle, 'Report setting: ', reportSetting);

                try {
                    var searchObj = VCLog_Report.BILLFILE.search(reportSetting);
                    if (!searchObj) return false;

                    var BILLFILE_REC = RECORD.BILLFILE;

                    var arrResults = searchObj
                        .run()
                        .getRange({ start: reportSetting.start, end: reportSetting.end });

                    Helper.log(logTitle, 'Total Results: ' + arrResults.length);
                    // if (!arrResults.length) return false;

                    arrResults.forEach((searchRow, idx) => {
                        // Helper.log(logTitle, '... idx: ', [idx, searchRow]);
                        var billValues = {};
                        for (var field in BILLFILE_REC.FIELD) {
                            var rowValue = {
                                value: searchRow.getValue({ name: BILLFILE_REC.FIELD[field] }),
                                text: searchRow.getText({ name: BILLFILE_REC.FIELD[field] })
                            };
                            if (!Helper.isEmpty(rowValue.value)) {
                                billValues[field] = rowValue.value;
                                if (rowValue.text && rowValue.value != rowValue.text) {
                                    billValues[field] = rowValue;
                                }
                            }
                        }
                        billValues.CREATED = searchRow.getValue({ name: 'created' });
                        billValues.MODIFIED = searchRow.getValue({ name: 'created' });
                        ['date', 'field', 'oldvalue', 'newvalue', 'type'].forEach((field) => {
                            billValues[`SYS_${field.toUpperCase()}`] = searchRow.getValue({
                                name: field,
                                join: 'systemNotes'
                            });
                        });
                        billValues.VENDOR = Helper.getVendorName({
                            vendorCfgId: billValues.INTEGRATION.value
                        });
                        billValues.CREATED = Helper.formatDate(billValues.CREATED);
                        billValues.MODIFIED = Helper.formatDate(billValues.MODIFIED);
                        billValues.SYS_DATE = Helper.formatDate(billValues.CREATED);

                        // Helper.log(logTitle, '.. bill values: ', billValues);

                        VCLog_Report.BILLFILE.mapping.forEach((fnMappedAction) => {
                            let result = fnMappedAction.call(null, billValues);
                            if (result) {
                                context.write(result);
                                Helper.log(logTitle, '... ', {
                                    ii: idx,
                                    result: result
                                });
                            }

                            return true;
                        });

                        return;
                    });
                } catch (error) {
                    Helper.logError(logTitle, error);
                }

                return;
            },
            mapping: [
                // CREATED BILL FILE
                (billValues) => {
                    let logTitle = 'MAPPING:BillCreated',
                        reportObj = {
                            APPLICATION: 'Bill Processing',
                            VENDOR: billValues.VENDOR
                        },
                        returnValue = null;

                    var logKeyId = [
                        billValues.CREATED,
                        billValues.VENDOR,
                        billValues.POID || '-none-',
                        LIST.CATEGORY.BILLFILE_CREATED
                    ];

                    //automatically add to BILL CREATED
                    util.extend(reportObj, {
                        DATE: billValues.CREATED,
                        CATEGORY: LIST.CATEGORY.BILLFILE_CREATED,
                        TYPE: LIST.TYPE.SUCCESS
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };

                    // Helper.log(logTitle, '>> bill values: ', [billValues, returnValue]);

                    return returnValue;
                },

                // PROCESSED BILL
                (billValues) => {
                    let logTitle = 'MAPPING:BillProcessed',
                        reportObj = {
                            APPLICATION: 'Bill Processing',
                            VENDOR: billValues.VENDOR
                        },
                        returnValue = null;

                    var logKeyId = [billValues.VENDOR, billValues.POID || '-none-'];

                    if (billValues.BILL_LINK) {
                        // parse the log
                        var arrMatches = billValues.PROCESS_LOG.match(
                            /(\d.+?\d\s-\s.+?)(\\r\\n|$)/gim
                        );
                        var dateBilled = null;

                        if (arrMatches && util.isArray(arrMatches) && arrMatches.length) {
                            arrMatches.forEach((mxStr) => {
                                if (dateBilled) return;
                                if (mxStr.match(/Created Vendor Bill/gi)) {
                                    dateBilled = mxStr.replace(/(\d.+?\d)\s-.*$/g, '$1');
                                    return true;
                                }
                            });
                        }

                        if (!dateBilled) return;
                        Helper.log(logTitle, '>> date: ', {
                            billed: dateBilled,
                            parsed: Helper.formatBillDate(dateBilled)
                        });
                        dateBilled = Helper.formatBillDate(dateBilled);

                        logKeyId.unshift(dateBilled);
                        logKeyId.push(LIST.CATEGORY.BILL_CREATED);

                        util.extend(reportObj, {
                            DATE: dateBilled,
                            CATEGORY: LIST.CATEGORY.BILL_CREATED,
                            TYPE: LIST.TYPE.SUCCESS
                        });

                        returnValue = {
                            key: logKeyId.join('_'),
                            value: reportObj
                        };

                        // Helper.log(logTitle, '>> bill values: ', [billValues, returnValue]);
                    }

                    return returnValue;
                }
            ]
        },

        POLINES: {
            search: (reportSetting) => {
                var logTitle = [LOG_TITLE, 'POLINES::Search'].join('::');
                Helper.log(logTitle, 'ReportSettings: ', reportSetting);

                let fromDate = Helper.formatDate(SCRIPT_PARAM.fromDate),
                    toDate = Helper.formatDate(SCRIPT_PARAM.toDate);

                if (!SCRIPT_PARAM.fromDate) {
                    let newFromDate = SCRIPT_PARAM.toDate
                        ? ns_format.parse({
                              value: SCRIPT_PARAM.toDate,
                              type: ns_format.Type.DATE
                          })
                        : new Date();

                    newFromDate.setDate(newFromDate.getDate() - 1);
                    fromDate = ns_format.format({
                        value: newFromDate,
                        type: ns_format.Type.DATE
                    });
                }
                Helper.log(logTitle, '## search dates: ', [
                    SCRIPT_PARAM.fromDate,
                    SCRIPT_PARAM.toDate,
                    fromDate,
                    toDate
                ]);

                var searchOption = {
                    type: 'purchaseorder',
                    filters: [
                        ['type', 'anyof', 'PurchOrd'],
                        'AND',
                        ['createdfrom', 'noneof', '@NONE@'],
                        'AND',
                        ['mainline', 'is', 'F'],
                        'AND',
                        ['custbody_ctc_bypass_vc', 'is', 'F'],
                        'AND',
                        [
                            ['datecreated', 'within', fromDate, toDate],
                            'OR',
                            ['lastmodifieddate', 'within', fromDate, toDate],
                            'OR',
                            ['linelastmodifieddate', 'within', fromDate, toDate]
                        ]
                    ],
                    columns: [
                        'name',
                        'trandate',
                        'datecreated',
                        'tranid',
                        'internalid',
                        'vendor.internalid',
                        'vendor.entityid',
                        'createdFrom.ordertype',
                        'statusref',
                        'createdfrom',
                        'amount',
                        'line',
                        'lineuniquekey',
                        'quantity',
                        'quantityshiprecv',
                        'quantitybilled',
                        // 'custcol_ctc_xml_date_order_placed',
                        'custcol_ctc_xml_dist_order_num',
                        'custcol_ctc_vc_vendor_info',
                        'custcol_ctc_xml_eta',
                        'custcol_ctc_vc_eta_date',
                        'custcol_ctc_xml_ship_date',
                        'custcol_ctc_xml_tracking_num',
                        'custcol_ctc_xml_ship_method',
                        'custcol_ctc_xml_serial_num_link',
                        'lastmodifieddate',
                        'linelastmodifieddate'
                    ]
                };
                var activeVendors = Helper.fetchActiveVendors(),
                    vendorFilter = [];
                activeVendors.forEach((activeVendor) => {
                    if (vendorFilter.length) vendorFilter.push('OR');
                    vendorFilter.push([
                        ['name', 'anyof', activeVendor.vendor],
                        'AND',
                        ['trandate', 'onorafter', activeVendor.startDate]
                    ]);
                    return true;
                });
                searchOption.filters.push('AND', vendorFilter);
                // Helper.log(logTitle, 'searchOption: ', searchOption);

                return ns_search.create(searchOption);
            },
            process: (reportSetting, context) => {
                var logTitle = [LOG_TITLE, 'POLINES:process'].join('::');
                Helper.log(logTitle, 'ReportSettings: ', reportSetting);

                try {
                    var searchObj = VCLog_Report.POLINES.search(reportSetting);
                    if (!searchObj) return false;

                    var arrResults = searchObj
                        .run()
                        .getRange({ start: reportSetting.start, end: reportSetting.end });

                    Helper.log(logTitle, 'Total Results: ', arrResults.length);

                    var MAPPED_FIELDS = {
                        POID: 'internalid',
                        LINEKEY: 'lineuniquekey',
                        LINEQTY: 'quantity',
                        STATUS: 'statusref',
                        QTYFULFILLED: 'quantityshiprecv',
                        QTYBILLED: 'quantitybilled',
                        VENDORINFO: 'custcol_ctc_vc_vendor_info',
                        ORDERNUM: 'custcol_ctc_xml_dist_order_num',
                        ETA: 'custcol_ctc_xml_eta',
                        DATEMODIFIED: 'lastmodifieddate',
                        DATELINEMOD: 'linelastmodifieddate',
                        DATECREATE: 'datecreated',
                        DATETRAN: 'trandate'
                    };

                    arrResults.forEach((searchRow, idx) => {
                        // Helper.log(logTitle, '...', searchRow);
                        var poLineValues = {};
                        for (let poField in MAPPED_FIELDS) {
                            var rowValue = {
                                value: searchRow.getValue({ name: MAPPED_FIELDS[poField] }),
                                text: searchRow.getText({ name: MAPPED_FIELDS[poField] })
                            };
                            poLineValues[poField] = rowValue.value;

                            if (rowValue.text && rowValue.value != rowValue.text) {
                                poLineValues[poField] = rowValue;
                            }
                        }
                        ['DATEMODIFIED', 'DATELINEMOD', 'DATECREATE'].forEach((dateField) => {
                            poLineValues[dateField] = Helper.convertDate(poLineValues[dateField]);
                        });
                        poLineValues.VENDOR = Helper.getVendorName({ poId: poLineValues.POID });

                        Helper.log(logTitle, 'PO Line Values..', poLineValues);

                        VCLog_Report.POLINES.mapping.forEach((fnVCLogAction) => {
                            let result = fnVCLogAction.call(null, poLineValues);

                            if (result) {
                                context.write(result);
                                Helper.log(logTitle, '... ', {
                                    ii: idx,
                                    result: result
                                });
                            }

                            return true;
                        });

                        return true;
                    });
                } catch (error) {
                    Helper.logError(logTitle, error);
                }

                return true;
            },
            mapping: [
                (poValues) => {
                    let logTitle = 'MAPPING:PO Count';
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.PO_COUNT,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATECREATE,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.PO_COUNT
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                },
                (poValues) => {
                    let logTitle = 'MAPPING:PO Line Count';
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.POLINE_COUNT,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATECREATE,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.POLINE_COUNT,
                        poValues.LINEKEY
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                },
                (poValues) => {
                    let logTitle = 'MAPPING:PO Processed Count';
                    if (Helper.isEmpty(poValues.VENDORINFO)) return false;
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.PO_PROCESSED,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATEMODIFIED,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.PO_PROCESSED
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                },
                (poValues) => {
                    let logTitle = 'MAPPING:PO Processed Line Count';
                    if (Helper.isEmpty(poValues.VENDORINFO)) return false;
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.POLINE_PROCESSD,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATELINEMOD,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.POLINE_PROCESSD,
                        poValues.LINEKEY
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                },
                (poValues) => {
                    let logTitle = 'MAPPING:PO Shipped';
                    if (Helper.isEmpty(poValues.VENDORINFO)) return false;
                    if (!parseInt(poValues.QTYFULFILLED)) return false;
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.POLINE_SHIPPED,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATELINEMOD,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.POLINE_SHIPPED,
                        poValues.LINEKEY,
                        poValues.QTYFULFILLED
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                },
                (poValues) => {
                    let logTitle = 'MAPPING:PO Billed';
                    if (Helper.isEmpty(poValues.VENDORINFO)) return false;
                    if (!parseInt(poValues.QTYBILLED)) return false;
                    let reportObj = {
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.POLINE_BILLED,
                        DATE: poValues.DATECREATE,
                        VENDOR: poValues.VENDOR,
                        TYPE: LIST.TYPE.SUCCESS
                    };
                    var logKeyId = [
                        // poValues.DATELINEMOD,
                        poValues.VENDOR,
                        poValues.POID,
                        LIST.CATEGORY.POLINE_BILLED,
                        poValues.LINEKEY,
                        poValues.QTYBILLED
                    ];
                    return {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                }
            ]
        },

        addLogReport: (arrValues, reportKey) => {
            var logTitle = [LOG_TITLE, 'addLogReport'].join('::');

            try {
                //get company info
                let objCompanyInfo = ns_config.load({ type: ns_config.Type.COMPANY_INFORMATION });

                var logReportId = VCLog_Report.searchLogReport(reportKey);

                var VCLOGREP_REC = RECORD.VCLOGREP;

                var recLogReport = logReportId
                    ? ns_record.load({ type: VCLOGREP_REC.ID, id: logReportId })
                    : ns_record.create({ type: VCLOGREP_REC.ID });

                // process the values
                var vcLogRepValues = {};
                for (let fldKey in VCLOGREP_REC.FIELD) {
                    vcLogRepValues[VCLOGREP_REC.FIELD[fldKey]] = arrValues[0][fldKey];
                }
                vcLogRepValues[VCLOGREP_REC.FIELD.COUNT] = 1; //arrValues.length;
                vcLogRepValues[VCLOGREP_REC.FIELD.LOGKEY] = reportKey;
                vcLogRepValues[VCLOGREP_REC.FIELD.DATE] = ns_format.parse({
                    value: vcLogRepValues[VCLOGREP_REC.FIELD.DATE],
                    type: ns_format.Type.DATE
                });
                vcLogRepValues[VCLOGREP_REC.FIELD.ACCOUNTID] = ns_runtime.accountId;
                vcLogRepValues[VCLOGREP_REC.FIELD.COMPANYNAME] =
                    objCompanyInfo.getValue('companyname');

                Helper.log(logTitle, '.. vcLogRepValues: ', vcLogRepValues);

                // set the values
                for (var fld in vcLogRepValues) {
                    var val = vcLogRepValues[fld];
                    if (!val) continue;
                    recLogReport.setValue({ fieldId: fld, value: val });
                }

                var recId = recLogReport.save();
                Helper.log(
                    logTitle,
                    (logReportId ? '## Updated ' : '## Added new ') +
                        (' VC Log Report [' + recId + ']')
                );
            } catch (error) {
                Helper.logError(logTitle, error);
            }

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

            // if (!logReportSearch.runPaged().count) return false;
            var logReportId = null;
            logReportSearch.run().each((searchRow) => {
                logReportId = searchRow.getValue({ name: 'internalid' });
            });

            Helper.log('searchLogReport', `... existing report? ${reportKey} = ${logReportId}`);

            return logReportId;
        }
    };

    const Helper = {
        getVendorName: (option) => {
            var logTitle = 'Helper::getVendorName';
            var vendorInfo = {};

            try {
                /// MAPPING ///
                var XML_VENDOR = {
                    TECH_DATA: { id: '1', name: 'TechData', entry: 'techdata_api' },
                    INGRAM_MICRO: { id: '2', name: 'IngramMicro', entry: 'ingram_api' },
                    SYNNEX: { id: '3', name: 'Synnex', entry: 'synnex_sftp' },
                    DandH: { id: '4', name: 'D&H', entry: 'dh_sftp' },
                    AVNET: { id: '5', name: 'AVNet', entry: '' },
                    WESTCON: { id: '6', name: 'WestCon', entry: '' },
                    ARROW: { id: '7', name: 'Arrow', entry: 'arrow_api' },
                    DELL: { id: '8', name: 'Dell', entry: '' },
                    SYNNEX_API: { id: '9', name: 'Synnex', entry: 'synnex_api' },
                    INGRAM_MICRO_API: { id: '10', name: 'IngramMicro', entry: '' },
                    INGRAM_MICRO_V_ONE: { id: '11', name: 'IngramMicro', entry: '' },
                    TECH_DATA_API: { id: '12', name: 'TechData', entry: '' },
                    JENNE: { id: '13', name: 'Jenne', entry: 'jenne_api' },
                    SCANSOURCE: { id: '14', name: 'ScanSource', entry: 'scansource_api' },
                    WEFI: { id: '16', name: 'WEFI', entry: 'wefi_api' }
                };

                // fetch the POs' vendor

                var poId = option.poId,
                    vendorId = option.vendorId,
                    vendorCfgId = option.vendorCfgId,
                    poData = {};

                // Helper.log(logTitle, '>> option: ', [option, poId, vendorId, vendorCfgId]);

                if (poId) {
                    poData = Helper.getCache({ name: `PURCHASE_ORDER:${poId}`, isJSON: true });
                    // if (!poData) {
                    if (Helper.isEmpty(poData)) {
                        poData = Helper.flatLookup({
                            type: ns_record.Type.PURCHASE_ORDER,
                            id: poId,
                            columns: ['entity', 'tranid', 'vendor.custentity_vc_bill_config']
                        });
                        if (!Helper.isEmpty(poData))
                            Helper.setCache({
                                name: `PURCHASE_ORDER:${poId}`,
                                value: poData
                            });
                    }

                    if (!Helper.isEmpty(poData)) {
                        if (
                            poData['vendor.custentity_vc_bill_config'] &&
                            poData['vendor.custentity_vc_bill_config'].value
                        ) {
                            vendorCfgId = poData['vendor.custentity_vc_bill_config'].value;
                        }
                        if (poData['entity'] && poData['entity'].value) {
                            vendorId = poData.entity.value;
                        }
                    }
                }

                /// BILL Config Data
                if (vendorCfgId) {
                    vendorInfo.BillConfig = { value: vendorCfgId };

                    var billConfigData = Helper.getCache({
                        name: `BILLCONFIG:${vendorInfo.BillConfig.value}`,
                        isJSON: true
                    });

                    if (!billConfigData) {
                        billConfigData = Helper.flatLookup({
                            type: 'customrecord_vc_bill_vendor_config',
                            id: vendorInfo.BillConfig.value,
                            columns: ['custrecord_vc_bc_entry']
                        });
                        if (!Helper.isEmpty(billConfigData))
                            Helper.setCache({
                                name: `BILLCONFIG:${vendorInfo.BillConfig.value}`,
                                value: billConfigData
                            });
                    }

                    // Helper.log(logTitle, 'billConfigData >> ', billConfigData);

                    if (billConfigData && billConfigData.custrecord_vc_bc_entry) {
                        vendorInfo.BillConfig.entry = billConfigData.custrecord_vc_bc_entry;
                    }
                }

                vendorInfo.OrderStatus = Helper.getCache({
                    name: `VENDORCFG:${vendorId}`,
                    isJSON: true
                });

                if (Helper.isEmpty(vendorInfo.OrderStatus)) {
                    if (vendorId) {
                        var vendorConfigSearch = ns_search.create({
                            type: 'customrecord_ctc_vc_vendor_config',
                            filters: [
                                ['isinactive', 'is', 'F'],
                                'AND',
                                ['custrecord_ctc_vc_vendor', 'anyof', vendorId]
                            ],
                            columns: ['custrecord_ctc_vc_xml_vendor', 'name']
                        });

                        vendorConfigSearch.run().each((searchRow) => {
                            vendorInfo.OrderStatus = {
                                value: searchRow.getValue({ name: 'custrecord_ctc_vc_xml_vendor' }),
                                text: searchRow.getText({ name: 'custrecord_ctc_vc_xml_vendor' })
                            };
                        });
                    }

                    if (!Helper.isEmpty(vendorInfo.OrderStatus))
                        Helper.setCache({
                            name: `VENDORCFG:${poData.entity.value}`,
                            value: vendorInfo.OrderStatus
                        });
                }

                // look for the vendor name
                for (var vendorName in XML_VENDOR) {
                    if (
                        vendorInfo.OrderStatus &&
                        vendorInfo.OrderStatus.value &&
                        vendorInfo.OrderStatus.value == XML_VENDOR[vendorName].id
                    ) {
                        vendorInfo.OrderStatus.vendorName = XML_VENDOR[vendorName].name;
                    }

                    if (
                        vendorInfo.BillConfig &&
                        vendorInfo.BillConfig.entry &&
                        XML_VENDOR[vendorName].entry &&
                        vendorInfo.BillConfig.entry == XML_VENDOR[vendorName].entry
                    ) {
                        vendorInfo.BillConfig.vendorName = XML_VENDOR[vendorName].name;
                    }
                }
                // Helper.log(logTitle, 'vendorInfo  >> ', vendorInfo);
            } catch (error) {
                Helper.logError(logTitle, JSON.stringify(error));
            }

            return vendorInfo.OrderStatus && vendorInfo.OrderStatus.vendorName
                ? vendorInfo.OrderStatus.vendorName
                : vendorInfo.BillConfig && vendorInfo.BillConfig.vendorName
                ? vendorInfo.BillConfig.vendorName
                : null;
        },
        fetchActiveVendors: function () {
            var logTitle = [LOG_TITLE, 'fetchActiveVendors'].join('::');

            var objVendorSearch = ns_search.create({
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [['isinactive', 'is', 'F']],
                columns: [
                    'custrecord_ctc_vc_vendor',
                    'custrecord_ctc_vc_vendor_start',
                    'custrecord_ctc_vc_xml_vendor'
                ]
            });

            var arrVendors = [];
            objVendorSearch.run().each(function (result) {
                // Helper.log(logTitle, '..search row: ', result);
                var vendorList = result.getValue({
                        name: 'custrecord_ctc_vc_vendor'
                    }),
                    startDate = result.getValue({
                        name: 'custrecord_ctc_vc_vendor_start'
                    });

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                    // arrVendors = arrVendors.concat(vendorList);
                }

                return true;
            });

            return arrVendors;
        },
        flatLookup: (option) => {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);
            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
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
        },
        getScriptParameters: () => {
            var stLogTitle = 'getScriptParameters';
            var parametersMap = {};
            var scriptContext = ns_runtime.getCurrentScript();
            var obj;
            var value;
            var optional;
            var id;
            var arrMissingParams = [];

            for (let key in SCRIPT_PARAMETER_NAMES) {
                if (SCRIPT_PARAMETER_NAMES.hasOwnProperty(key)) {
                    obj = SCRIPT_PARAMETER_NAMES[key];
                    if (typeof obj === 'string') {
                        value = scriptContext.getParameter(obj);
                    } else {
                        id = obj.id;
                        optional = obj.optional;
                        value = scriptContext.getParameter(id);
                    }
                    if (value || value === false || value === 0) {
                        parametersMap[key] = value;
                    } else if (!optional) {
                        arrMissingParams.push(key + '[' + id + ']');
                    }
                }
            }

            if (arrMissingParams && arrMissingParams.length) {
                var objError = {};
                objError.name = 'Missing Script Parameter Values';
                objError.message =
                    'The following script parameters are empty: ' + arrMissingParams.join(', ');
                objError = ns_error.create(objError);
                for (let key in parametersMap) {
                    if (parametersMap.hasOwnProperty(key)) {
                        objError[key] = parametersMap[key];
                    }
                }
                throw objError;
            }

            return parametersMap;
        },
        alphaNumOnly: (stValue) => {
            let stReturn = '';
            if (!Helper.isEmpty(stValue)) {
                stReturn = stValue.replace(/[^a-zA-Z0-9]/g, '');
            }
            return stReturn;
        },
        formatDate: (dateStr) => {
            var dateVal = dateStr
                ? ns_format.parse({ value: dateStr, type: ns_format.Type.DATE })
                : new Date();
            var newDateStr = ns_format.format({ value: dateVal, type: ns_format.Type.DATE });
            // Helper.log('formatDate', '>> date: ', [dateStr, dateVal, newDateStr]);
            return newDateStr;
        },
        convertDate: (dateVal) => {
            // try {
            let returnVal = '';
            if (dateVal) {
                var dateObj = ns_format.parse({
                    value: dateVal,
                    type: ns_format.Type.DATETIME
                });
                returnVal = ns_format.format({
                    value: dateObj,
                    type: ns_format.Type.DATE
                });
            }
            // } catch (error) {
            //     Helper.logError('DATE CONVERT', error);
            // }

            return returnVal;
        },
        formatBillDate: (dateStr) => {
            var parts = dateStr.split(/\//g);
            var dateObj = new Date(parts[2], parts[0], parts[1]);
            return ns_format.format({ value: dateObj, type: ns_format.Type.DATE });
        },
        getIdFromBody: (bodyLog) => {
            let stReturn = '';
            let match = bodyLog.match(/\((\d+)\)/);
            if (match) {
                stReturn = match[1];
            }
            return stReturn;
        },
        searchAllPaged: function (option) {
            var objSearch,
                arrResults = [],
                logTitle = [LOG_TITLE, 'searchAllPaged'].join('::');
            option = option || {};

            try {
                var searchId = option.id || option.searchId;
                var searchType = option.recordType || option.type;

                objSearch = option.searchObj
                    ? option.searchObj
                    : searchId
                    ? ns_search.load({
                          id: searchId
                      })
                    : searchType
                    ? ns_search.create({
                          type: searchType
                      })
                    : null;

                if (!objSearch) throw 'Invalid search identifier';
                if (!objSearch.filters) objSearch.filters = [];
                if (!objSearch.columns) objSearch.columns = [];

                if (option.filters) objSearch.filters = objSearch.filters.concat(option.filters);
                if (option.filterExpression) objSearch.filterExpression = option.filterExpression;
                if (option.columns) objSearch.columns = objSearch.columns.concat(option.columns);

                var maxResults = option.maxResults || 0;
                var pageSize = maxResults && maxResults <= 1000 ? maxResults : 1000;

                // run the search
                var objPagedResults = objSearch.runPaged({
                    pageSize: pageSize
                });
                // set the max results to the search length, if not defined;
                maxResults = maxResults || objPagedResults.count;

                Helper.log(logTitle, 'SEARCH: Total Results: ', [
                    maxResults,
                    objPagedResults.count
                ]);

                for (var i = 0, j = objPagedResults.pageRanges.length; i < j; i++) {
                    var pagedResults = objPagedResults.fetch({
                        index: objPagedResults.pageRanges[i].index
                    });
                    Helper.log(logTitle, 'SEARCH: ..results: ', arrResults.length);

                    // test if we need to get all the paged results,
                    // .. or just a slice, of maxResults is less than the pageSize
                    arrResults = arrResults.concat(
                        maxResults > pageSize
                            ? pagedResults.data
                            : pagedResults.data.slice(0, maxResults)
                    );

                    // reduce the max results
                    maxResults = maxResults - pageSize;
                    if (maxResults < 0) break;
                }
            } catch (error) {
                Helper.log(logTitle, '>> error: ', error);
                throw error.message;
            }

            return arrResults;
        },
        safeParse: function (response) {
            var logTitle = [LOG_TITLE, 'safeParse'].join('::'),
                returnValue;
            try {
                returnValue = JSON.parse(response.body || response);
            } catch (error) {
                Helper.logError(logTitle, error);
                returnValue = null;
            }

            return returnValue;
        },
        getUsage: function () {
            var REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[usage:' + REMUSAGE + '] ';
        },
        log: function (logTitle, msg, objvar) {
            var logMsg = msg,
                logType = 'audit',
                logPrefx = LOG_PREFIX || '';

            try {
                if (!util.isString(msg)) {
                    logMsg = msg.msg || msg.text || msg.content || '';
                    logPrefx = msg.prefix || msg.prfx || msg.pre || logPrefx;
                    logType = msg.type || 'audit';
                }

                log[logType || 'audit'](
                    logTitle,
                    this.getUsage() +
                        (logPrefx ? logPrefx + ' ' : '') +
                        logMsg +
                        (!this.isEmpty(objvar) ? JSON.stringify(objvar) : '')
                );
            } catch (error) {}

            return true;
        },
        logError: function (logTitle, errorMsg) {
            Helper.log(logTitle, { type: 'error', msg: '### ERROR: ' }, errorMsg);
            return;
        },
        CACHE_NAME: 'LOGREPCACHE.004',
        CACHE_KEY: 'VCLOG_20240208.01',
        CACHE_TTL: 86400, // 1 whole day
        getNSCache: function (option) {
            var returnValue;
            try {
                var cacheName = this.CACHE_NAME,
                    cacheTTL = option.cacheTTL || this.CACHE_TTL;

                var cacheKey = option.cacheKey || option.key || option.name || this.CACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheObj = ns_cache.getCache({
                    name: cacheName,
                    scope: ns_cache.Scope.PROTECTED
                });

                returnValue = cacheObj.get({ key: cacheKey, ttl: cacheTTL });
                if (option.isJSON && returnValue) returnValue = this.safeParse(returnValue);

                // this.log('## NS CACHE ##', '// CACHE fetch: ', [cacheName, cacheKey, cacheTTL]);
            } catch (error) {
                Helper.logError('getNSCache', error);
                returnValue = null;
            }

            return returnValue;
        },
        setNSCache: function (option) {
            try {
                var cacheName = this.CACHE_NAME,
                    cacheTTL = option.cacheTTL || this.CACHE_TTL;

                var cacheKey = option.cacheKey || option.key || option.name || this.CACHE_KEY;
                if (!cacheKey) throw 'Missing cacheKey!';

                var cacheValue = option.value || option.cacheValue;
                if (this.isEmpty(cacheValue)) throw 'Missing cache value!';
                if (!util.isString(cacheValue)) cacheValue = JSON.stringify(cacheValue);

                var cacheObj = ns_cache.getCache({
                    name: cacheName,
                    scope: ns_cache.Scope.PROTECTED
                });
                cacheObj.put({ key: cacheKey, value: cacheValue, ttl: cacheTTL });

                // this.log('## NS CACHE ##', '// CACHE stored: ', [
                //     cacheName,
                //     cacheKey,
                //     cacheTTL
                // ]);
            } catch (error) {
                Helper.logError('setNSCache', error);
            }
        },
        getCache: function (option) {
            var cacheName = option.name;

            if (!CACHE[cacheName]) CACHE[cacheName] = Helper.getNSCache(option);

            return CACHE[cacheName];
        },
        setCache: function (option) {
            var cacheName = option.name,
                cacheValue = option.value;

            if (cacheValue) Helper.setNSCache(option);
            CACHE[cacheName] = cacheValue;
        }
    };

    const handleErrorInStage = (stage, summary) => {
        let errorMsg = [];
        summary.errors.iterator().each(function (key, value) {
            let msg = 'SCRIPT FAILURE: ' + key + '. Error was:' + JSON.parse(value).message;
            errorMsg.push(msg);
            return true;
        });
        if (errorMsg.length > 0) {
            log.error(stage, JSON.stringify(errorMsg));
        }
    };

    const logErrorIfAny = (summary) => {
        let inputSummary = summary.inputSummary;
        let mapSummary = summary.mapSummary;
        let reduceSummary = summary.reduceSummary;
        //get input data error
        if (inputSummary.error) {
            let e = ns_error.create({
                name: 'Error on Get Input Data',
                message: inputSummary.error
            });
            log.error('Input Data', e.message);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    };

    var MAP_REDUCE = {
        getInputData: () => {
            var logTitle = [LOG_TITLE, 'getInputData'].join('::');

            Helper.log(logTitle, '### SCRIPT START #### ', SCRIPT_PARAM);

            var arrLogSearchParams = [],
                maxResults = MAX_CHUNK;
            ['VCLOGS', 'BILLFILE', 'POLINES']
                // ['VCLOGS']
                .forEach((LogKey) => {
                    if (!VCLog_Report[LogKey] || !VCLog_Report[LogKey].search) {
                        Helper.log(logTitle, '... search fn not found');
                        return;
                    }
                    SCRIPT_PARAM = Helper.getScriptParameters();

                    var reportSearchObj = VCLog_Report[LogKey].search();
                    if (!reportSearchObj) {
                        Helper.log(logTitle, '... search obj is null');
                        return;
                    }
                    var totalResults = reportSearchObj.runPaged().count,
                        currentCount = 0;

                    Helper.log(logTitle, 'Total results: ', [LogKey, totalResults]);

                    while (totalResults > currentCount) {
                        arrLogSearchParams.push({
                            type: LogKey,
                            start: currentCount,
                            end: currentCount + maxResults,
                            total: totalResults
                        });
                        currentCount = maxResults + currentCount;
                    }
                });

            // Helper.log(logTitle, `## Search Params: ${JSON.stringify(arrLogSearchParams)}`);
            return arrLogSearchParams;
        },
        map: (context) => {
            var logTitle = [LOG_TITLE, 'MAP'].join('::');
            var reportSetting = JSON.parse(context.value);
            SCRIPT_PARAM = Helper.getScriptParameters();

            try {
                Helper.log(logTitle, '### MAP START #### ', reportSetting);
                LOG_PREFIX = `[MAP${context.key}: ${reportSetting.type}:${reportSetting.start}-${reportSetting.end}] `;

                if (!VCLog_Report[reportSetting.type] || !VCLog_Report[reportSetting.type].process)
                    throw 'Missing log processing';

                // send the results
                VCLog_Report[reportSetting.type].process.call(
                    VCLog_Report[reportSetting.type],
                    reportSetting,
                    context
                );
            } catch (error) {
                Helper.logError(logTitle, error);
            }

            return true;
        },
        reduce: (context) => {
            var logTitle = [LOG_TITLE, 'REDUCE'].join('::');
            SCRIPT_PARAM = Helper.getScriptParameters();

            let arrValues = context.values;
            arrValues = arrValues.map(JSON.parse);

            Helper.log(logTitle, '### REDUCE START ####', arrValues);
            LOG_PREFIX = `[REDUCE: ${context.key}] `;

            if (!Helper.isEmpty(arrValues) && util.isArray(arrValues)) {
                VCLog_Report.addLogReport(arrValues, context.key);
            }

            return true;
        },
        summarize: (summary) => {
            let type = summary.toString();
            Helper.log(
                '[Summarize] ' + type,
                `Usage Consumed: ${summary.usage} | Number of Queues: ${summary.concurrency} | Number of Yields: ${summary.yields}`
            );
            summary.output.iterator().each(function (key, value) {
                return true;
            });
            logErrorIfAny(summary);
        }
    };

    return MAP_REDUCE;
});
