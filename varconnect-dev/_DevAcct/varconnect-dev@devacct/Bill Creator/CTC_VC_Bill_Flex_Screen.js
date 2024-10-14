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

define([
    'N/ui/serverWidget',
    'N/ui/message',
    'N/record',
    'N/search',
    'N/redirect',
    'N/url',
    'N/runtime',
    'N/task',
    'N/format',
    './Libraries/CTC_VC_Lib_BillProcess',
    './../CTC_VC_Lib_FormHelper',
    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record',
    './../Services/ctc_svclib_configlib'
], function (
    ns_ui,
    ns_msg,
    ns_record,
    ns_search,
    ns_redirect,
    ns_url,
    ns_runtime,
    ns_task,
    ns_format,
    vc_billprocess,
    vc_uihelper,
    vc2_constant,
    vc2_util,
    vc2_recordlib,
    vcs_configLib
) {
    var LogTitle = 'FlexScreen',
        BILL_CREATOR = vc2_constant.Bill_Creator;

    var DEBUG_MODE = false;

    var Current = {
            UI: {
                Method: null,
                Task: null,
                Script: null,
                IsActiveEdit: true,
                IsFulfillable: false,
                IsBillable: false
            },
            CFG: {
                MainCFG: {},
                BillCFG: {},
                OrderCFG: {},
                ChargesDEF: {}
            },
            PO: {
                ID: null,
                REC: null,
                DATA: {},
                LINES: []
            },
            BILL: {
                REC: null,
                DATA: {},
                LINES: []
            },
            BILLFILE: {
                REC: null,
                DATA: {},
                JSON: {},
                LINES: []
            },
            TOTAL: {},
            URL: {
                record: null,
                suitelet: null
            },
            MSG: {
                warning: [],
                error: [],
                info: []
            }
        },
        BILLPROC = {};

    var ACTIVE_STATUS = [
            BILL_CREATOR.Status.PENDING,
            BILL_CREATOR.Status.ERROR,
            BILL_CREATOR.Status.HOLD,
            BILL_CREATOR.Status.CLOSED,
            BILL_CREATOR.Status.VARIANCE
        ],
        FLEXFORM_ACTION = {
            SAVE: { value: 'save', text: 'Save', default: true },
            RENEW: { value: 'renew', text: 'Save & Renew' },
            MANUAL: { value: 'manual', text: 'Save & Process Manually' },
            CLOSE: { value: 'close', text: 'Save & Close' },
            REPROCESS_HASVAR: {
                value: 'reprocess_hasvar',
                text: 'Submit & Process Variance'
            },
            REPROCESS_NOVAR: {
                value: 'reprocess_novar',
                text: 'Submit & Ignore Variance'
            },
            REPROCESS: { value: 'reprocess', text: 'Submit & Reprocess' },
            HOLD: { value: 'hold', text: 'Hold' }
        },
        LINE_ERROR_MSG = {
            UNMATCHED_ITEMS: {
                col: 'erroritem',
                msg: 'Unmatched Item'
            },
            ITEMS_ALREADY_BILLED: {
                col: 'errorbilled',
                msg: 'Already billed'
            },
            NOT_BILLABLE: {
                col: 'errorbillable',
                msg: 'Not billable'
            },
            INSUFFICIENT_QUANTITY: {
                col: 'errorqty',
                msg: 'Insufficient quantity'
            },
            Price: {
                col: 'errorprice',
                msg: 'Mismatched rates'
            }
        };

    var FORM_DEF = {
        FIELDS: {},
        SUBLIST: {},

        initialize: function () {
            var logTitle = [LogTitle, 'FORM_DEF::initialize'].join('::'),
                returnValue;

            var ChargesDEF = BILLPROC.CFG.ChargesDEF,
                Charges = BILLPROC.CHARGES,
                IsBillable = BILLPROC.PO.DATA && BILLPROC.PO.DATA.isBillable,
                Status = BILLPROC.STATUS,
                Total = BILLPROC.TOTAL,
                arrLineErrors = [];

            // Collect all the errors
            (BILLPROC.BILLFILE.LINES || []).forEach(function (billfile) {
                arrLineErrors = arrLineErrors.concat(billfile.Errors || []);
                arrLineErrors = arrLineErrors.concat(billfile.Variance || []);
            });
            arrLineErrors = vc2_util.uniqueArray(arrLineErrors);

            // get the line errors

            // INITIALIZE OUR FIELDS ///
            FORM_DEF.FIELDS = {
                SPACER: {
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Spacer',
                    defaultValue: '<br />'
                },
                HEADER: {
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Header',
                    defaultValue: ' '
                },
                SUITELET_URL: {
                    id: 'custpage_suitelet_url',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Suitelet URL',
                    defaultValue: Current.UI.Url
                },
                BILLFILE_URL: {
                    id: 'custpage_bill_file',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Bill File',
                    defaultValue: Current.BILLFILE.Url
                },
                TASK: {
                    id: 'taskact',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Task',
                    defaultValue: Current.UI.Task
                },
                BILLFILE_ID: {
                    id: 'record_id',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Task',
                    defaultValue: Current.BILLFILE.ID
                }
            };
            /// MAIN ACTIONS ///
            util.extend(FORM_DEF.FIELDS, {
                ACTION: {
                    id: 'custpage_action',
                    type: ns_ui.FieldType.SELECT,
                    label: 'Action',
                    selectOptions: (function (billStatus) {
                        var selectElems = [FLEXFORM_ACTION.SAVE];

                        if (billStatus == BILL_CREATOR.Status.CLOSED) {
                            selectElems.push(FLEXFORM_ACTION.RENEW);

                            if (BILLPROC.STATUS.IsReceivable || BILLPROC.STATUS.IsBillable)
                                selectElems.push(FLEXFORM_ACTION.MANUAL);
                        } else if (BILLPROC.STATUS.IsFullyBilled) {
                            selectElems.push(FLEXFORM_ACTION.CLOSE);
                        } else if (BILLPROC.STATUS.HasVariance) {
                            selectElems.push(
                                FLEXFORM_ACTION.REPROCESS_HASVAR,
                                FLEXFORM_ACTION.REPROCESS_NOVAR,
                                FLEXFORM_ACTION.CLOSE
                            );
                        } else {
                            selectElems.push(FLEXFORM_ACTION.CLOSE, FLEXFORM_ACTION.REPROCESS);
                        }

                        return selectElems;
                    })(BILLPROC.BILLFILE.DATA.STATUS)
                },
                ACTIVE_EDIT: {
                    id: 'custpage_chk_activedit',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'IS Active Edit',
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    defaultValue: Current.UI.IsActiveEdit ? 'T' : 'F'
                },
                PROCESS_VARIANCE: {
                    id: 'custpage_chk_variance',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Process Variance',
                    displayType: BILLPROC.STATUS.AllowVariance
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: BILLPROC.BILLFILE.DATA.PROC_VARIANCE ? 'T' : 'F'
                },
                IGNORE_VARIANCE: {
                    id: 'custpage_chk_ignorevariance',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Ignore Variance',
                    displayType: BILLPROC.STATUS.IgnoreVariance
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: BILLPROC.BILLFILE.JSON.ignoreVariance
                },
                IS_RCVBLE: {
                    id: 'custpage_chk_isreceivable',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Is Receivable',
                    displayType: BILLPROC.STATUS.AllowToReceive
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: BILLPROC.BILLFILE.DATA.IS_RCVBLE ? 'T' : 'F'
                }
            });

            // BILL FILE INFO ///
            util.extend(FORM_DEF.FIELDS, {
                INTEGRATION: {
                    id: 'custpage_integration',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customrecord_vc_bill_vendor_config',
                    label: 'Integration',
                    // breakType: ns_ui.FieldBreakType.STARTCOL,
                    defaultValue: BILLPROC.BILLFILE.DATA.INTEGRATION
                },
                STATUS: {
                    id: 'custpage_status',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_statuses',
                    label: 'Status',
                    defaultValue: BILLPROC.BILLFILE.DATA.STATUS
                },
                PROCESS_LOG_TOP: {
                    id: 'custpage_logs_top',
                    type: ns_ui.FieldType.TEXTAREA,
                    label: 'Latest Log Message',

                    defaultValue: (function (data) {
                        var content = data;
                        try {
                            content = JSON.parse(data);
                            content = JSON.stringify(content, null, '\t');
                        } catch (err) {
                            content = data || '';
                        }
                        return [
                            '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea" style="width:20%;">',
                            '<textarea cols="50" rows="3" disabled="true" ',
                            'style="border:none; color: #333 !important; background-color: #FFF !important;">',
                            content.split(/\n/g).pop(),
                            '</textarea>',
                            '</div>'
                        ].join(' ');
                    })(BILLPROC.BILLFILE.DATA.PROCESS_LOG)
                    // defaultValue: (function (logs) {
                    //     return logs.split(/\n/g).pop();
                    // })(BILLPROC.BILLFILE.DATA.PROCESS_LOG)
                },
                BILL_FILE_LINK: {
                    id: 'custpage_bill_file_link',
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Bill File Link',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue:
                        '<span class="smallgraytextnolink uir-label" style="width:80%;">' +
                        '<span class="smallgraytextnolink">Bill File</span>' +
                        '</span>' +
                        '<span class="uir-field inputreadonly">' +
                        '<span class="inputreadonly">' +
                        ('<a class="dottedlink" href="' +
                            Current.BILLFILE.Url +
                            '" target="_blank">' +
                            (function (str, max) {
                                return str.length > max ? str.substr(0, max) + '...' : str;
                            })(BILLPROC.BILLFILE.DATA.NAME, 50) +
                            '</a>') +
                        '</span>' +
                        '</span>'
                },
                PROCESS_LOGS: {
                    id: 'custpage_logs',
                    type: ns_ui.FieldType.LONGTEXT,
                    label: 'Processing Logs',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: BILLPROC.BILLFILE.DATA.PROCESS_LOG
                },
                BILLFILE_SOURCE: {
                    id: 'custpage_payload',
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'SOURCE DATA',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: (function (data) {
                        var content = data;
                        try {
                            content = JSON.parse(data);
                            content = JSON.stringify(content, null, '\t');
                        } catch (err) {
                            content = data;
                        }
                        return [
                            '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                            '<span class="smallgraytextnolink uir-label">',
                            '<span class="smallgraytextnolink">',
                            '<a class="smallgraytextnolink">SOURCE DATA</a>',
                            '</span></span>',
                            '<textarea cols="60" rows="10" disabled="true" ',
                            'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                            content,
                            '</textarea>',
                            '</div>'
                        ].join(' ');
                    })(BILLPROC.BILLFILE.DATA.SOURCE)
                },
                BILLFILE_JSON: {
                    id: 'custpage_json',
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'JSON DATA',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: (function (data) {
                        var content = data;
                        try {
                            content = JSON.parse(data);
                            content = JSON.stringify(content, null, '\t');
                        } catch (err) {
                            content = data;
                        }
                        return [
                            '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                            '<span class="smallgraytextnolink uir-label">',
                            '<span class="smallgraytextnolink">',
                            '<a class="smallgraytextnolink">CONVERTED DATA</a>',
                            '</span></span>',
                            '<textarea cols="60" rows="10" disabled="true" ',
                            'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                            content,
                            '</textarea>',
                            '</div>'
                        ].join(' ');
                    })(BILLPROC.BILLFILE.DATA.JSON)
                },
                HOLD_REASON: {
                    id: 'custpage_hold_reason',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_hold_rsns',
                    label: 'Hold Reason',
                    displayType: Current.UI.IsActiveEdit
                        ? ns_ui.FieldDisplayType.NORMAL
                        : ns_ui.FieldDisplayType.INLINE,
                    defaultValue: BILLPROC.BILLFILE.DATA.HOLD_REASON
                },
                NOTES: {
                    id: 'custpage_processing_notes',
                    type: ns_ui.FieldType.TEXTAREA,
                    label: 'Notes',
                    displayType: ns_ui.FieldDisplayType.NORMAL,
                    defaultValue: BILLPROC.BILLFILE.DATA.NOTES
                },
                INV_NUM: {
                    id: 'custpage_invnum',
                    type: ns_ui.FieldType.TEXT,
                    label: 'Invoice #',
                    defaultValue: BILLPROC.BILLFILE.DATA.BILL_NUM
                },
                INV_LINK: {
                    id: 'custpage_invlink',
                    type: ns_ui.FieldType.SELECT,
                    source: 'transaction',
                    label: 'Bill Link',
                    defaultValue: BILLPROC.BILLFILE.DATA.BILL_LINK
                },
                INV_DATE: {
                    id: 'custpage_invdate',
                    type: ns_ui.FieldType.DATE,
                    label: 'Invoice Date',
                    defaultValue: BILLPROC.BILLFILE.DATA.DATE
                },
                INV_DUEDATE: {
                    id: 'custpage_invduedate',
                    type: ns_ui.FieldType.DATE,
                    label: 'Due Date',
                    defaultValue: BILLPROC.BILLFILE.DATA.DUEDATE
                },
                INV_DUEDATE_FILE: {
                    id: 'custpage_invddatefile',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Due Date From File',
                    defaultValue: BILLPROC.BILLFILE.DATA.DDATE_INFILE
                },
                INV_TOTAL: {
                    id: 'custpage_invtotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Invoice Total',
                    defaultValue: BILLPROC.BILLFILE.JSON.total
                },
                INV_TAX: {
                    id: 'custpage_invtax',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Tax)',
                    displayType: ChargesDEF.tax.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Charges.tax
                },
                INV_SHIPPING: {
                    id: 'custpage_invshipping',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Shipping)',
                    displayType: ChargesDEF.shipping.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Charges.shipping
                },
                INV_OTHER: {
                    id: 'custpage_invothercharge',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Other)',
                    displayType: ChargesDEF.other.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Charges.other
                },
                INV_MISCCHARGE: {
                    id: 'custpage_invmisccharge',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Misc)',
                    displayType: ChargesDEF.miscCharges
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,

                    defaultValue: (function (charges) {
                        var chargeAmt = 0;
                        if (!charges) return chargeAmt;
                        charges.forEach(function (charge) {
                            chargeAmt = (chargeAmt || 0) + vc2_util.parseFloat(charge.amount);
                            return true;
                        });
                        return chargeAmt;
                    })(Charges.miscCharges)
                }
            });

            // PO FIELDS ////
            util.extend(FORM_DEF.FIELDS, {
                PO_NUM: {
                    id: 'custpage_ponum',
                    type: ns_ui.FieldType.TEXT,
                    label: 'PO #',
                    defaultValue: BILLPROC.BILLFILE.DATA.POID
                },
                PO_LINK: {
                    id: 'custpage_polink',
                    type: ns_ui.FieldType.SELECT,
                    label: 'PO Link',
                    source: 'transaction',
                    defaultValue: BILLPROC.BILLFILE.DATA.PO_LINK
                },
                PO_VENDOR: {
                    id: 'custpage_povendor',
                    type: ns_ui.FieldType.SELECT,
                    source: 'vendor',
                    label: 'Vendor',
                    defaultValue: BILLPROC.PO.DATA ? BILLPROC.PO.DATA.entity : ''
                },
                PO_LOCATION: {
                    id: 'custpage_polocation',
                    type: ns_ui.FieldType.TEXT,
                    label: 'Location',
                    defaultValue: BILLPROC.PO.DATA ? BILLPROC.PO.DATA.location : ''
                },
                PO_STATUS: {
                    id: 'custpage_postatus',
                    type: ns_ui.FieldType.TEXT,
                    label: 'PO Status',
                    defaultValue: BILLPROC.PO.DATA ? BILLPROC.PO.DATA.status : ''
                },
                PO_TOTAL: {
                    id: 'custpage_pototal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'PO Total',
                    defaultValue: BILLPROC.PO.DATA ? BILLPROC.PO.DATA.total : ''
                }
            });

            util.extend(FORM_DEF.FIELDS, {
                CALC_TOTAL: {
                    id: 'custpage_calctotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Calc. Bill Amount',
                    displayType: IsBillable
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Total.BILL_TOTAL || ''
                },
                CALC_TAXTOTAL: {
                    id: 'custpage_polinetaxtotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Calc. Tax',
                    displayType: IsBillable
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Total.BILL_TAX
                },
                CALC_SHIPTOTAL: {
                    id: 'custpage_poshiptotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Calc. Shipping ',
                    displayType: IsBillable
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Total.SHIPPING
                },
                CALC_VARIANCETOTAL: {
                    id: 'custpage_variancetotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Calc. Variance',
                    displayType: IsBillable
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Total.VARIANCE
                }
            });

            // INTIIALIZE SUBLSIT-ITEMS ////
            FORM_DEF.SUBLIST.ITEM = {
                id: 'item',
                label: 'Bill Lines',
                type: ns_ui.SublistType.LIST,
                fields: {
                    item: { type: ns_ui.FieldType.TEXT, label: 'Item' },
                    nsitem: {
                        type: ns_ui.FieldType.SELECT,
                        label: 'NS Item',
                        displayType: Current.UI.IsActiveEdit
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE,
                        // select options -- get all items from PO
                        selectOptions: (function (recordLines) {
                            var arrOptions = [{ text: ' ', value: '' }];
                            if (vc2_util.isEmpty(recordLines)) return arrOptions;

                            var itemColl = {};

                            recordLines.forEach(function (lineData) {
                                if (!itemColl[lineData.item]) {
                                    itemColl[lineData.item] = lineData;
                                    arrOptions.push({
                                        value: lineData.item,
                                        text: lineData.item_text
                                    });
                                }
                            });
                            return arrOptions;
                        })(BILLPROC.PO.LINES)
                    },
                    erroritem: vc2_util.inArray('UNMATCHED_ITEMS', arrLineErrors)
                        ? {
                              type: ns_ui.FieldType.TEXT,
                              size: { w: 3, h: 100 },
                              label: ' '
                          }
                        : null,
                    quantity: {
                        label: 'Bill Qty',
                        type: ns_ui.FieldType.CURRENCY,
                        displayType: Current.UI.IsActiveEdit
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE,
                        size: { w: 5, h: 100 }
                    },
                    nsqty: {
                        label: 'NS Qty',
                        type: ns_ui.FieldType.CURRENCY,
                        align: ns_ui.LayoutJustification.CENTER
                    },
                    nsrcvd: {
                        label: 'Rcvd',
                        // displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },
                    errorbillable: vc2_util.inArray('NOT_BILLABLE', arrLineErrors)
                        ? {
                              type: ns_ui.FieldType.TEXT,
                              size: { w: 3, h: 100 },
                              label: ' '
                          }
                        : null,
                    nsbilled: {
                        label: 'Billed',
                        // displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },
                    errorbilled: vc2_util.inArray('ITEMS_ALREADY_BILLED', arrLineErrors)
                        ? {
                              type: ns_ui.FieldType.TEXT,
                              size: { w: 3, h: 100 },
                              label: ' '
                          }
                        : null,
                    remainingqty: {
                        label: 'Avail Qty',
                        displayType: Current.UI.IsActiveEdit
                            ? ns_ui.FieldDisplayType.INLINE
                            : ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },
                    errorqty: vc2_util.inArray('INSUFFICIENT_QUANTITY', arrLineErrors)
                        ? {
                              type: ns_ui.FieldType.TEXT,
                              size: { w: 3, h: 100 },
                              label: ' '
                          }
                        : null,
                    rate: {
                        label: 'Bill Rate',
                        type: ns_ui.FieldType.CURRENCY,
                        size: { w: 10, h: 100 },
                        displayType: Current.UI.IsActiveEdit
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE
                    },
                    nsrate: {
                        label: 'NS Rate',
                        type: ns_ui.FieldType.CURRENCY
                    },
                    errorprice: vc2_util.inArray('Price', arrLineErrors)
                        ? {
                              type: ns_ui.FieldType.TEXT,
                              size: { w: 3, h: 100 },
                              label: ' '
                          }
                        : null,
                    amount: {
                        label: 'Bill Amount',
                        type: ns_ui.FieldType.CURRENCY
                    },
                    calcamount: {
                        label: 'Calc Amount',
                        displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },
                    nstaxamt: {
                        label: 'Calc. Tax',
                        displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },
                    description: {
                        label: 'Description',
                        type: ns_ui.FieldType.TEXT
                    },
                    line_idx: {
                        label: 'LineIdx',
                        type: ns_ui.FieldType.TEXT,
                        displayType: DEBUG_MODE
                            ? ns_ui.FieldDisplayType.NORMAL
                            : ns_ui.FieldDisplayType.HIDDEN
                    },
                    matchedlines: {
                        label: 'Bill Lines',
                        type: ns_ui.FieldType.TEXT,
                        displayType: DEBUG_MODE
                            ? ns_ui.FieldDisplayType.NORMAL
                            : ns_ui.FieldDisplayType.HIDDEN
                    }
                }
            };

            // INTIIALIZE SUBLSIT-VARIANCE LINES ////
            FORM_DEF.SUBLIST.CHARGES = {
                id: 'charges_list',
                label: 'Charges',
                type: ns_ui.SublistType.LIST,
                fields: {
                    is_active: {
                        label: 'Enabled',
                        type: ns_ui.FieldType.CHECKBOX,
                        displayType: ns_ui.FieldDisplayType.INLINE
                        // Current.UI.isActiveEdit ||
                        // BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                        //     ? ns_ui.FieldDisplayType.ENTRY
                        //     :
                    },
                    applied: {
                        label: 'Apply',
                        type: ns_ui.FieldType.CHECKBOX,
                        displayType:
                            Current.UI.IsActiveEdit ||
                            BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                                ? ns_ui.FieldDisplayType.ENTRY
                                : ns_ui.FieldDisplayType.INLINE
                    },
                    type: {
                        label: 'Type',
                        type: ns_ui.FieldType.TEXT,
                        displayType: ns_ui.FieldDisplayType.HIDDEN
                    },
                    name: {
                        label: 'Type',
                        type: ns_ui.FieldType.TEXT
                    },
                    itemname: {
                        label: 'Item',
                        type: ns_ui.FieldType.TEXT
                    },
                    description: {
                        label: 'Description',
                        type: ns_ui.FieldType.TEXT
                    },
                    nsitem: {
                        label: 'PO Item',
                        type: ns_ui.FieldType.SELECT,
                        displayType:
                            Current.UI.IsActiveEdit ||
                            BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                                ? ns_ui.FieldDisplayType.ENTRY
                                : ns_ui.FieldDisplayType.INLINE,
                        selectOptions: (function (record) {
                            var arrOptions = [{ text: ' ', value: '' }];

                            for (var varianceType in BILLPROC.CFG.Charges) {
                                var varianceInfo = BILLPROC.CFG.Charges[varianceType];
                                if (varianceInfo.item) {
                                    arrOptions.push({
                                        value: varianceInfo.item,
                                        text: Helper.getItemName(varianceInfo.item)
                                    });
                                }
                            }

                            if (!record) return arrOptions;

                            var objItemLines = Helper.getLineItems(record);
                            if (!objItemLines) return arrOptions;

                            for (var lineItem in objItemLines) {
                                var lineData = objItemLines[lineItem];
                                arrOptions.push({
                                    value: lineData.item,
                                    text: lineData.item_text
                                });
                            }

                            return arrOptions;
                        })(BILLPROC.PO.REC)
                    },
                    autoprocess: {
                        label: ' ',
                        type: ns_ui.FieldType.TEXT,
                        displayType: ns_ui.FieldDisplayType.INLINE
                    },
                    amount: {
                        label: 'Amount',
                        type: ns_ui.FieldType.CURRENCY,
                        totallingField: true,
                        displayType:
                            Current.UI.IsActiveEdit ||
                            BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                                ? ns_ui.FieldDisplayType.ENTRY
                                : ns_ui.FieldDisplayType.INLINE
                    },
                    amounttax: {
                        label: 'Applied Tax',
                        type: ns_ui.FieldType.CURRENCY,
                        displayType: ns_ui.FieldDisplayType.HIDDEN
                    }
                }
            };

            return FORM_DEF.FIELDS;
        }
    };

    ////// MAIN SUITELET ///////
    var Suitelet = {
        onRequest: function (scriptContext) {
            var logTitle = [LogTitle, 'onRequest'].join('::');
            vc2_util.log(logTitle, '############################################');
            vc2_util.log(logTitle, '>> Params: ', scriptContext.request.parameters);
            try {
                FlexScreen_UI.initialize(scriptContext);
                logTitle = [LogTitle, Current.UI.Method, Current.BILLFILE.ID].join('::');

                Current.UI.Task = Current.UI.Task || 'loadingPage'; // default is loadingPage

                // set the Form
                vc_uihelper.Form = ns_ui.createForm({ title: 'Flex Screen' });
                vc_uihelper.Form.clientScriptModulePath =
                    './Libraries/CTC_VC_Lib_Suitelet_Client_Script';

                vc2_util.log(logTitle, '// CURRENT: ', Current);

                if (Current.UI.Method == 'GET') {
                    FlexScreen_UI[Current.UI.Task].call(FlexScreen_UI, scriptContext);
                } else {
                    FlexScreen_UI.postAction(scriptContext);
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                FlexScreen_UI.handleError(error);
            } finally {
                vc2_util.dumpLog(logTitle, Current.MSG);

                scriptContext.response.writePage(vc_uihelper.Form);
            }

            return true;
        }
    };
    ////////////////////////////

    /// FLEX SCREEN CONTROLLER ////
    ///////////////////////////////
    var FlexScreen_UI = {
        initialize: function (scriptContext) {
            var logTitle = [LogTitle, 'initialize'].join('::'),
                returnValue;

            Current.BILLFILE.ID = scriptContext.request.parameters.record_id;
            Current.UI.Task = scriptContext.request.parameters.taskact || '';
            Current.UI.Method = scriptContext.request.method.toUpperCase();
            Current.UI.Script = ns_runtime.getCurrentScript();

            /// LICENSE CHECK /////
            var license = vcs_configLib.validateLicense();

            // immediately exit, if the license is not valid
            if (license.hasError) {
                Current.MSG.error.push(vc2_constant.ERRORMSG.INVALID_LICENSE.message);
                Current.UI.IsActiveEdit = false;
                return false;
            }

            return returnValue;
        },
        preprocessBill: function (scriptContext) {
            var logTitle = [LogTitle, 'preprocessBill'].join('::'),
                returnValue;

            /// PRE LOAD THE BILL FILE ////
            BILLPROC = vc_billprocess.preprocessBill({ billFileId: Current.BILLFILE.ID });
            Current.BILLFILE.Url = ns_url.resolveRecord({
                recordType: 'customrecord_ctc_vc_bills',
                recordId: Current.BILLFILE.ID
            });
            Current.UI.Url = ns_url.resolveScript({
                scriptId: ns_runtime.getCurrentScript().id,
                deploymentId: ns_runtime.getCurrentScript().deploymentId,
                params: {
                    record_id: Current.BILLFILE.ID
                    // taskact: Current.UI.Task
                }
            });

            // CHECK for Active Edit
            if (
                vc2_util.inArray(BILLPROC.BILLFILE.DATA.STATUS, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.ERROR,
                    BILL_CREATOR.Status.HOLD,
                    BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                Current.UI.IsActiveEdit = true;
            }

            // SKip everythinkg if its already processed or fully billed
            if (BILLPROC.STATUS.IsProcessed || BILLPROC.STATUS.IsClosed) {
                Current.UI.IsActiveEdit = false;
                Current.MSG.info.push('This Bill is already processed or closed');
                return;
            }

            if (BILLPROC.IsFullyBilled) {
                Current.UI.IsActiveEdit = false;
                Current.MSG.warning.push('All the items are fully billed');
                return;
            }

            /// CHECK for the Errors
            if (BILLPROC.STATUS.HasErrors) {
                var arrErrorMsg = [];

                for (var errorCode in BILLPROC.Error) {
                    var errorMsg = BILL_CREATOR.Code[errorCode]
                        ? BILL_CREATOR.Code[errorCode].msg
                        : errorCode;
                    if (!vc2_util.isEmpty(BILLPROC.Error[errorCode]))
                        errorMsg +=
                            ' -- ' +
                            (util.isArray(BILLPROC.Error[errorCode])
                                ? BILLPROC.Error[errorCode].join(', ')
                                : BILLPROC.Error[errorCode]);
                    arrErrorMsg.push(errorMsg);
                }

                Current.MSG.error.push(arrErrorMsg.join('<br/>'));
            }
            if (BILLPROC.STATUS.HasVariance) {
                var varianceMsg = [],
                    exceedTHR = false,
                    withinTHR = false;

                BILLPROC.VarianceList.forEach(function (varCode) {
                    if (varCode == 'EXCEED_THRESHOLD') exceedTHR = true;
                    else if (varCode == 'WITHIN_THRESHOLD') withinTHR = true;
                    else varianceMsg.push(varCode);
                });
                Current.MSG.warning.push('Variance Detected - ' + varianceMsg.join(', '));
                if (exceedTHR || withinTHR) {
                    Current.MSG.warning.push(
                        BILL_CREATOR.Code[exceedTHR ? 'EXCEED_THRESHOLD' : 'WITHIN_THRESHOLD'].msg +
                            ' -- ' +
                            ns_format.format({
                                value: BILLPROC.CFG.MainCFG.allowedVarianceAmountThreshold,
                                type: ns_format.Type.CURRENCY
                            })
                    );
                }

                if (BILLPROC.STATUS.AllowVariance)
                    Current.MSG.error.push('Bill will be created, with the variances applied');
                if (BILLPROC.STATUS.IgnoreVariance)
                    Current.MSG.error.push('Bill will be created, *without* the variances');
            } else if (BILLPROC.STATUS.AllowToBill) {
                Current.MSG.info.push('PO is Ready for Billing');
            } else if (BILLPROC.STATUS.AllowToReceive) {
                Current.MSG.info.push('PO will be received before creating the bill');
            }
        },
        loadingPage: function (scriptContext) {
            var logTitle = [LogTitle, 'loadingPage'].join('::'),
                returnValue;

            vc_uihelper.renderField({
                type: ns_ui.FieldType.INLINEHTML,
                label: 'Loading',
                defaultValue: '<h2> Loading bill file...</h2>'
            });

            vc_uihelper.renderField({
                id: 'custpage_redir_url',
                type: ns_ui.FieldType.TEXT,
                displayType: ns_ui.FieldDisplayType.HIDDEN,
                label: 'Redir URL',
                defaultValue: ns_url.resolveScript({
                    scriptId: ns_runtime.getCurrentScript().id,
                    deploymentId: ns_runtime.getCurrentScript().deploymentId,
                    params: {
                        record_id: Current.BILLFILE.ID,
                        taskact: 'viewForm'
                    }
                })
            });

            return true;
        },
        viewForm: function (scriptContext) {
            var logTitle = [LogTitle, 'viewForm'].join('::'),
                returnValue;

            FlexScreen_UI.preprocessBill(scriptContext);

            // initialize the fields
            FORM_DEF.initialize();
            vc_uihelper.Fields = FORM_DEF.FIELDS;
            vc_uihelper.Sublists = FORM_DEF.SUBLIST;

            /// Buttons //////////////
            var Form = vc_uihelper.Form;
            Form.addSubmitButton({ label: 'Submit' });
            Form.addResetButton({ label: 'Reset' });

            Form.addButton({
                id: 'btnProcessBill',
                label: 'Process Bill File',
                functionName: 'goToProcessBill'
            }).isDisabled = !Current.UI.IsActiveEdit;

            // create the tabs
            Form.addTab({ id: 'tab_items', label: 'Bill Lines' });
            Form.addTab({ id: 'tab_charges', label: 'Charges' });
            Form.addTab({ id: 'tab_logs', label: 'Processing Logs' });
            Form.addTab({ id: 'tab_payload', label: 'Payload Data' });
            Form.addTab({ id: 'tab_notes', label: 'Notes' });

            // HIDDEN FIELDS //
            vc_uihelper.renderFieldList(['SUITELET_URL', 'BILLFILE_URL', 'TASK', 'BILLFILE_ID']);

            // Main Actions Fields
            vc_uihelper.renderFieldList([
                'H1: Actions',
                'ACTION',
                'ACTIVE_EDIT',
                'PROCESS_VARIANCE',
                'IGNORE_VARIANCE',
                'IS_RCVBLE',
                'HOLD_REASON',
                'BILL_FILE_LINK'
            ]);
            // BILL FILE INFO
            vc_uihelper.renderFieldList([
                'SPACER:STARTCOL',
                'H1: BILL INFO',
                'INTEGRATION',
                'STATUS',
                'INV_NUM',
                'INV_LINK',
                'INV_TOTAL',
                'INV_TAX',
                'INV_SHIPPING',
                'INV_OTHER',
                'SPACER'
            ]);

            // PO DATA
            vc_uihelper.renderFieldList([
                'SPACER:STARTCOL',
                'H1: PO DATA',
                'PO_NUM',
                'PO_LINK',
                'PO_STATUS',
                'PO_VENDOR',
                'PO_LOCATION',
                'PO_TOTAL'
            ]);

            // CALC TOTALS
            if (
                (BILLPROC.STATUS.IsProcessed ||
                    BILLPROC.STATUS.IsFullyBilled ||
                    BILLPROC.STATUS.IsClosed) &&
                BILLPROC.BILL &&
                BILLPROC.BILL.REC
            ) {
                vc_uihelper.renderFieldList([
                    'SPACER:STARTCOL',
                    'H1: BILL TOTAL',
                    'CALC_TOTAL',
                    'CALC_TAXTOTAL',
                    'CALC_SHIPTOTAL',
                    'CALC_VARIANCETOTAL'
                ]);
            } else {
                vc_uihelper.renderFieldList([
                    'SPACER:STARTCOL',
                    'H1: CALC TOTAL',
                    'CALC_TOTAL',
                    'CALC_TAXTOTAL',
                    'CALC_SHIPTOTAL',
                    'CALC_VARIANCETOTAL'
                ]);
            }

            vc_uihelper.renderField(
                vc2_util.extend(vc_uihelper.Fields.PROCESS_LOGS, { container: 'tab_logs' })
            );
            vc_uihelper.renderField(
                vc2_util.extend(vc_uihelper.Fields.BILLFILE_SOURCE, { container: 'tab_payload' })
            );
            vc_uihelper.renderField(
                vc2_util.extend(vc_uihelper.Fields.BILLFILE_JSON, { container: 'tab_payload' })
            );
            vc_uihelper.renderField(
                vc2_util.extend(vc_uihelper.Fields.NOTES, { container: 'tab_notes' })
            );

            // vc2_util.log(logTitle, '/// BILL FILE LINES: ', BILLPROC.BILLFILE.LINES);
            var itemSublist = vc_uihelper.renderSublist(
                vc2_util.extend({ tab: 'tab_items' }, FORM_DEF.SUBLIST.ITEM)
            );
            // add the bill lines
            (BILLPROC.BILLFILE.LINES || []).forEach(function (billLine, lineIdx) {
                var lineData = {
                    item: billLine.itemName,
                    nsitem: billLine.itemId,
                    quantity: billLine.quantity,
                    rate: billLine.rate,
                    amount: billLine.amount,
                    description: billLine.description,
                    line_idx: billLine.lineIdx,
                    calcamount: vc2_util.roundOff(billLine.quantity * billLine.rate)
                };

                if (!vc2_util.isEmpty(billLine.OrderLine)) {
                    util.extend(lineData, {
                        nsqty: billLine.OrderLine.quantity,
                        nsrcvd: billLine.OrderLine.quantityreceived,
                        nsbilled: billLine.OrderLine.quantitybilled,
                        nsrate: billLine.OrderLine.rate,
                        remainingqty: billLine.OrderLine.BILLABLE
                            ? billLine.OrderLine.BILLABLE
                            : billLine.OrderLine.RECEIVABLE || ''
                    });
                }

                vc2_util.log(logTitle, '// bill line: ', billLine);
                var arrLineErrors = [];
                if (!vc2_util.isEmpty(billLine.Errors))
                    arrLineErrors = arrLineErrors.concat(billLine.Errors);

                if (!vc2_util.isEmpty(billLine.Variance))
                    arrLineErrors = arrLineErrors.concat(billLine.Variance);

                vc2_util.log(logTitle, '... line errors: ', arrLineErrors);

                arrLineErrors.forEach(function (errorCode) {
                    if (!Current.UI.IsActiveEdit) return false;

                    // if (!LINE_ERROR_MSG[errorCode]) return;
                    var lineError = LINE_ERROR_MSG[errorCode];
                    if (!lineError) return false;

                    var css = [
                        'text-decoration:none;',
                        'color:red;',
                        'background-color:#faf1f1;',
                        'padding:0'
                        // 'margin:2px 2px 0 0;'
                    ].join('');

                    lineData[lineError.col] =
                        '<div style="font-weight:bold; color:red;font-size:1.2em;text-align:left;margin:auto;width:100%;">' +
                        '<a href="javascript:void(0);" ' +
                        ('style="' + css + '"') +
                        (' title="' + lineError.msg + '">') +
                        '&nbsp ! &nbsp;' +
                        '</a></div>';

                    return true;
                });

                vc_uihelper.setSublistValues({
                    sublist: itemSublist,
                    line: lineIdx,
                    lineData: lineData
                });
            });

            var chargesSublist = vc_uihelper.renderSublist(
                vc2_util.extend({ tab: 'tab_items' }, FORM_DEF.SUBLIST.CHARGES)
            );

            (BILLPROC.VARLINES || []).forEach(function (chargeLine, idx) {
                util.extend(chargeLine, {
                    is_active: chargeLine.enabled ? 'T' : 'F',
                    applied: chargeLine.applied,
                    type: chargeLine.name,
                    itemname: Helper.getItemName(chargeLine.item),
                    nsitem: chargeLine.item,
                    autoprocess:
                        chargeLine.amount && chargeLine.autoProc
                            ? '<span style="color: red;font-size:1em;"> ** Auto Processed ** </span>'
                            : '',
                    amount: chargeLine.amount || '0.00'
                });

                vc_uihelper.setSublistValues({
                    sublist: chargesSublist,
                    line: idx,
                    lineData: chargeLine
                });

                return true;
            });

            // combine the errors and warnings
            var arrWarnError = (Current.MSG.warning || []).concat(Current.MSG.error || []);
            if (!vc2_util.isEmpty(arrWarnError)) {
                vc_uihelper.Form.addPageInitMessage({
                    title: 'Error detected',
                    message:
                        '<br />' +
                        (util.isArray(arrWarnError) ? arrWarnError.join('<br />') : arrWarnError),
                    type: ns_msg.Type.ERROR
                });
            }

            // if (!vc2_util.isEmpty(Current.MSG.error))
            //     vc_uihelper.Form.addPageInitMessage({
            //         title: 'Error',
            //         message:
            //             '<br />' +
            //             (util.isArray(Current.MSG.error)
            //                 ? Current.MSG.error.join('<br />')
            //                 : Current.MSG.error),
            //         type: ns_msg.Type.ERROR
            //     });

            // if (!vc2_util.isEmpty(Current.MSG.warning)) {
            //     vc_uihelper.Form.addPageInitMessage({
            //         title: 'Warning',
            //         message:
            //             '<br />' +
            //             (util.isArray(Current.MSG.warning)
            //                 ? Current.MSG.warning.join('<br />')
            //                 : Current.MSG.warning),
            //         type: ns_msg.Type.WARNING
            //     });
            // }
            if (!vc2_util.isEmpty(Current.MSG.info)) {
                vc_uihelper.Form.addPageInitMessage({
                    title: 'Information',
                    message:
                        '<br />' +
                        (util.isArray(Current.MSG.info)
                            ? Current.MSG.info.join('<br />')
                            : Current.MSG.info),
                    type: ns_msg.Type.INFORMATION
                });
            }

            return true;
        },
        postAction: function (scriptContext) {
            var logTitle = [LogTitle, 'postAction'].join('::'),
                requestObj = scriptContext.request,
                returnValue;

            BILLPROC = vc_billprocess.preprocessBill({
                billFileId: Current.BILLFILE.ID,
                noBill: true
            });
            FORM_DEF.initialize();

            vc2_util.log(logTitle, '// FField: ', FField);
            vc2_util.log(logTitle, '// FSublist: ', FSublist);
            var FField = FORM_DEF.FIELDS,
                FSublist = FORM_DEF.SUBLIST;
            var paramValues = {
                    billFileId: requestObj.parameters[FField.BILLFILE_ID.id],
                    poLink: requestObj.parameters[FField.PO_LINK.id],
                    action: requestObj.parameters[FField.ACTION.id],
                    notes: requestObj.parameters[FField.NOTES.id],
                    holdReason: requestObj.parameters[FField.HOLD_REASON.id],
                    itemLineCount: requestObj.getLineCount(FSublist.ITEM.id),
                    varianceLineCount: requestObj.getLineCount(FSublist.CHARGES.id)
                },
                updateValues = {};
            paramValues.processVariance = paramValues.action == 'reprocess_hasvar';
            paramValues.ignoreVariance = paramValues.action == 'reprocess_novar';
            vc2_util.log(logTitle, '// Param Values: ', paramValues);

            var JSON_DATA = vc2_util.safeParse(BILLPROC.BILLFILE.DATA.JSON);
            // update the item lines
            for (var line = 0; line < paramValues.itemLineCount; line++) {
                var lineData = vc_uihelper.extractLineValues({
                    record: requestObj,
                    groupId: FSublist.ITEM.id,
                    columns: ['nsitem', 'quantity', 'rate', 'nsqty', 'nsrate', 'line_idx'],
                    line: line
                });
                vc2_util.log(logTitle, '... lineData: ', [lineData, line]);

                util.extend(JSON_DATA.lines[line], {
                    NSITEM: lineData.nsitem,
                    PRICE: paramValues.ignoreVariance ? lineData.nsrate : lineData.rate,
                    BILLRATE: paramValues.ignoreVariance ? lineData.nsrate : lineData.rate
                });
            }

            // update the variance lines
            JSON_DATA.variance_lines = [];
            for (var line = 0; line < paramValues.varianceLineCount; line++) {
                var lineData = vc_uihelper.extractLineValues({
                    record: requestObj,
                    groupId: FSublist.CHARGES.id,
                    columns: [
                        'applied',
                        'type',
                        'name',
                        'nsitem',
                        'description',
                        'quantity',
                        'rate',
                        'amount'
                    ],
                    line: line
                });
                vc2_util.log(logTitle, '... lineData: ', lineData);
                if (lineData.rate == 0 || lineData.amount == 0) continue;

                JSON_DATA.variance_lines.push({
                    applied: paramValues.ignoreVariance ? 'F' : lineData.applied,
                    type: lineData.type,
                    item: lineData.nsitem,
                    name: lineData.name,
                    description: lineData.description,
                    rate: lineData.amount,
                    quantity: 1
                });
            }
            ////// UPDATE VALUES ///////////////
            var BILLFILE_FIELD = vc2_constant.RECORD.BILLFILE.FIELD;

            updateValues[BILLFILE_FIELD.NOTES] = paramValues.notes;
            updateValues[BILLFILE_FIELD.HOLD_REASON] = paramValues.holdReason;
            updateValues[BILLFILE_FIELD.PO_LINK] = paramValues.poLink;

            var redirectToPO = false;

            if (
                paramValues.holdReason &&
                BILLPROC.BILLFILE.DATA.STATUS != BILL_CREATOR.Status.REPROCESS
            ) {
                paramValues.action = FLEXFORM_ACTION.HOLD.value;
            }

            JSON_DATA.ignoreVariance = paramValues.ignoreVariance ? true : null;

            switch (paramValues.action) {
                case FLEXFORM_ACTION.REPROCESS_HASVAR.value:
                    updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.REPROCESS;
                    updateValues[BILLFILE_FIELD.PROC_VARIANCE] = 'T';

                    break;
                case FLEXFORM_ACTION.REPROCESS_NOVAR.value:
                    updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.REPROCESS;
                    updateValues[BILLFILE_FIELD.PROC_VARIANCE] = 'F';
                    JSON_DATA.ignoreVariance = 'T';

                    break;
                case FLEXFORM_ACTION.REPROCESS.value:
                case FLEXFORM_ACTION.RENEW.value:
                    updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.REPROCESS;
                    updateValues[BILLFILE_FIELD.PROC_VARIANCE] = '';
                    break;
                case FLEXFORM_ACTION.CLOSE.value:
                    updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.CLOSED;
                    break;
                case FLEXFORM_ACTION.MANUAL.value:
                    redirectToPO = true;
                    break;
                case FLEXFORM_ACTION.HOLD.value:
                    updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.HOLD;
                    break;
            }
            updateValues[BILLFILE_FIELD.JSON] = JSON.stringify(JSON_DATA);

            vc2_util.log(logTitle, '>>> updateValues: ', updateValues);
            ////////////////////////
            ns_record.submitFields({
                type: vc2_constant.RECORD.BILLFILE.ID,
                id: Current.BILLFILE.ID,
                values: updateValues
            });
            ////////////////////////

            if (redirectToPO) {
                ns_redirect.toRecordTransform({
                    fromId: BILLPROC.PO.ID,
                    fromType: ns_record.Type.PURCHASE_ORDER,
                    toType: ns_record.Type.VENDOR_BILL
                });
            } else {
                ns_redirect.toSuitelet({
                    scriptId: 'customscript_ctc_vc_bill_flex_screen',
                    deploymentId: '1',
                    parameters: {
                        record_id: Current.BILLFILE.ID
                    }
                });
            }
            return returnValue;
        },
        processbill: function (scriptContext) {
            var logTitle = [LogTitle, 'viewForm'].join('::'),
                returnValue;

            vc_uihelper.Form.addButton({
                id: 'btnBack',
                label: 'Return Back',
                functionName: 'returnBack'
            });

            var mrTask = ns_task.create({
                taskType: ns_task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_ctc_vc_process_bills',
                params: {
                    custscript_ctc_vc_bc_bill_fileid: Current.BILLFILE.ID
                }
            });
            mrTask.submit();
            vc2_util.waitMs(2000);

            ns_redirect.redirect({
                url: '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&sortcol=dateCreated&sortdir=DESC&scripttype=&primarykey=' //&scripttype=customscript_ctc_vc_process_bills'
            });

            return returnValue;
        },
        handleError: function (error) {
            var errorMessage = vc2_util.extractError(error);

            vc_uihelper.Form.addPageInitMessage({
                title: 'Error Found ', // + errorMessage,
                message: util.isString(error) ? error : JSON.stringify(error),
                type: ns_msg.Type.ERROR
            });

            // vc_formHelper.renderField({
            //     id: 'custpage_error_page',
            //     type: ns_ui.FieldType.INLINEHTML,
            //     label: 'Error Message',
            //     defaultValue:
            //         '<p><h1 class="errortextheading tasktitle"><h3>Error message: '+errorMessage+'</h1></p>' +
            //         '<p><div class="errortextheading" style="padding: 5px;">' +
            //         JSON.stringify(error) +
            //         '</div></p>'
            // });

            return true;
        }
    };
    ///////////////////////////////

    /// GENERAL HELPER //////////////
    var Helper = {
        CACHE: {},
        getItemName: function (itemId) {
            var logTitle = [LogTitle, 'getItemName'].join('::'),
                returnValue = '';
            if (!itemId) return returnValue;
            var cacheKey = ['item', itemId].join(':');

            if (!Helper.CACHE.hasOwnProperty(cacheKey)) {
                try {
                    var itemLookup = vc2_util.flatLookup({
                        type: 'item',
                        id: itemId,
                        columns: ['name']
                    });
                    Helper.CACHE[cacheKey] = itemLookup.name;
                } catch (err) {
                    Helper.CACHE[cacheKey] = false;
                    vc2_util.log(logTitle, '## ERROR ##', err);
                }

                // vc2_util.log(logTitle, '>> ITEM ID: ', [itemId, Helper.CACHE[cacheKey]]);
            }

            return Helper.CACHE[cacheKey];
        },
        isBillable: function () {
            var returnValue = true;

            Current.UI.IsBillable = false;
            Current.UI.IsFulfillable = false;
            Current.IS_FULLYBILLED = false;

            try {
                if (!BILLPROC.PO.DATA) throw 'MISSING: PO Data';

                /// If the BillFile is already CLOSED or PROCOSSED,
                ///     OR Bill is already linked, skip
                if (
                    vc2_util.inArray(BILLPROC.BILLFILE.DATA.STATUS, [
                        BILL_CREATOR.Status.PROCESSED,
                        BILL_CREATOR.Status.CLOSED
                    ]) ||
                    BILLPROC.BILLFILE.DATA.BILL_LINK
                )
                    throw 'SKIPPED: BILL FILE is CLOSED or PROCESSED';

                /// if the PO is already Fully Billed or Closed, skip
                if (vc2_util.inArray(BILLPROC.PO.DATA.statusRef, ['fullyBilled', 'closed'])) {
                    Current.MSG.warning.push(
                        'Purchase Order is already ' + BILLPROC.PO.DATA.status
                    );
                    Current.IS_FULLYBILLED = true;
                    throw 'PO is already CLOSED or BILLED';
                }

                if (
                    vc2_util.inArray(BILLPROC.PO.DATA.statusRef, [
                        'pendingReceipt',
                        'partiallyReceived'
                    ])
                ) {
                    // var arrMsg = ['Purchase Order is not ready for billing.'];
                    Current.UI.IsFulfillable =
                        BILLPROC.BILLFILE.DATA.IS_RCVBLE && BILLPROC.CFG.BillCFG.enableFulfillment;

                    if (BILLPROC.CFG.BillCFG.enableFulfillment) {
                        if (BILLPROC.BILLFILE.DATA.IS_RCVBLE) {
                            Current.MSG.info.push(
                                'Purchase Order is ready for fulfillment, then it will be billed'
                            );

                            throw 'Purchase Order is ready for fulfillment, then it will be billed';
                        } else {
                            Current.MSG.warning.push('Bill file is not receivable.');
                            throw 'Bill file is not receivable.';
                        }
                    } else {
                        Current.MSG.warning.push('Purchase Order is not ready for billing.');

                        throw 'Purchase Order is not ready for billing.';
                    }

                    return false;
                }

                /// if PO needs to be received (Pending Receipt, Partially Received)
                Current.UI.IsBillable = true;

                // try to load the BILL record
                if (BILLPROC.PO.REC) {
                    try {
                        Current.BILL.REC = vc2_recordlib.transform({
                            fromType: 'purchaseorder',
                            fromId: BILLPROC.PO.ID,
                            toType: 'vendorbill',
                            isDynamic: true
                        });
                    } catch (bill_err) {
                        returnValue = false;
                        vc2_util.logError(logTitle + '::isBillable?', bill_err);

                        Current.MSG.error.push(
                            'Unable to create Vendor Bill due to: ' +
                                vc2_util.extractError(bill_err)
                        );
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
            }

            return returnValue;
        },
        isEditActive: function () {
            var returnValue = false;

            if (!BILLPROC.BILLFILE.DATA) return false; // no bill file, return false;

            var license = vcs_configLib.validateLicense();

            if (license.hasError) {
                Current.MSG.error.push(vc2_constant.ERRORMSG.INVALID_LICENSE.message);
                Current.UI.IsActiveEdit = false;
                return false;
            }

            if (
                vc2_util.inArray(BILLPROC.BILLFILE.DATA.STATUS, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.ERROR,
                    // BILL_CREATOR.Status.CLOSED,
                    BILL_CREATOR.Status.HOLD,
                    BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                returnValue = true;

                // exception on edit mode:
                if (
                    // if the PO is already fully billed
                    Current.IS_FULLYBILLED ||
                    // bill file is already closed, but
                    (!BILLPROC.BILLFILE.DATA.BILL_LINK &&
                        BILLPROC.BILLFILE.DATA.status == BILL_CREATOR.Status.CLOSED)
                ) {
                    returnValue = false;
                }
            }

            if (
                vc2_util.inArray(BILLPROC.BILLFILE.DATA.STATUS, [
                    BILL_CREATOR.Status.ERROR,
                    BILL_CREATOR.Status.HOLD
                    // BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                Current.MSG.warning.push(
                    (BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                        ? 'VARIANCE Detected'
                        : BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.ERROR
                        ? 'ERROR Detected'
                        : BILLPROC.BILLFILE.DATA.STATUS == BILL_CREATOR.Status.HOLD
                        ? 'BILL IS ON HOLD'
                        : '') +
                        '\n\n' +
                        (function (logs) {
                            var str = logs.split(/\n/g).pop();
                            return str.replace(/^.*\d{1,2}\/\d{4}/gi, '');
                        })(BILLPROC.BILLFILE.DATA.PROCESS_LOG)
                );
            }

            // Current.UI.isActiveEdit = returnValue;
            Current.UI.IsActiveEdit = true;
            return returnValue;
        },
        getLineItems: function (record, filter) {
            if (vc2_util.isEmpty(record)) return false;
            var lineCount = record.getLineCount('item');
            var cacheKey = ['lineItem', record.id, record.type].join(':');
            var objLineItems = Helper.CACHE[cacheKey] || {};

            var DEF_LINEFIELDS = {
                number: ['line', 'item', 'quantity', 'quantityreceived', 'quantitybilled'],
                currency: ['rate', 'amount', 'taxrate1', 'taxrate2'],
                list: ['item']
            };

            if (!Helper.CACHE.hasOwnProperty(cacheKey)) {
                var lineFields = [
                    'item',
                    'rate',
                    'quantity',
                    'amount',
                    'quantityreceived',
                    'quantitybilled',
                    'taxrate1',
                    'taxrate2'
                ];

                for (var line = 0; line < lineCount; line++) {
                    var lineData = { line: line },
                        isSkipped = false;

                    for (var i = 0, j = lineFields.length; i < j; i++) {
                        var field = lineFields[i],
                            fieldValue = record.getSublistValue({
                                sublistId: 'item',
                                fieldId: field,
                                line: line
                            });

                        if (vc2_util.inArray(field, DEF_LINEFIELDS.number))
                            fieldValue = vc2_util.forceInt(fieldValue);
                        if (vc2_util.inArray(field, DEF_LINEFIELDS.currency))
                            fieldValue = vc2_util.parseFloat(fieldValue);
                        lineData[field] = fieldValue;

                        if (vc2_util.inArray(field, DEF_LINEFIELDS.list))
                            lineData[field + '_text'] = record.getSublistText({
                                sublistId: 'item',
                                fieldId: field,
                                line: line
                            });

                        //// FILTERS ///////////
                        if (!vc2_util.isEmpty(filter) && filter.hasOwnProperty(field)) {
                            if (filter[field] != fieldValue) {
                                isSkipped = true;
                                break;
                            }
                        }
                        ////////////////////////
                    }
                    if (isSkipped) continue;
                    if (!objLineItems[lineData.item]) {
                        objLineItems[lineData.item] = lineData;
                    } else {
                        objLineItems[lineData.item].quantity += lineData.quantity;
                        objLineItems[lineData.item].quantityreceived += lineData.quantityreceived;
                        objLineItems[lineData.item].quantitybilled += lineData.quantitybilled;
                    }
                }

                for (var lineItem in objLineItems) {
                    objLineItems[lineItem].amount =
                        objLineItems[lineItem].quantity * objLineItems[lineItem].rate;

                    objLineItems[lineItem].amount = vc2_util.roundOff(
                        objLineItems[lineItem].amount
                    );
                }

                Helper.CACHE[cacheKey] = objLineItems;
            }

            return objLineItems;
        },
        extractBillLineErrors: function (option) {
            var billLines = option.billLines || [];

            var arrLineErrors = [];
            billLines.forEach(function (billLine) {
                return true;
            });
        }
    };
    ///////////////////////////////

    return Suitelet;
});
