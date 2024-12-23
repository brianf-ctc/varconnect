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
    './../CTC_VC_Lib_MainConfiguration',
    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record'
], function (
    ns_ui,
    ns_msg,
    ns_record,
    ns_search,
    ns_redirect,
    ns_url,
    ns_runtime,
    ns_task,
    vc_mainConfig,
    vc2_constant,
    vc2_util,
    vc_recordlib
) {
    var LogTitle = 'FlexScreen',
        BILL_CREATOR = vc2_constant.Bill_Creator;

    var DEBUG_MODE = false;

    var Current = {
        Method: null,
        PO_ID: null,

        PO_REC: null,
        BILLFILE_REC: null,
        POBILL_REC: null,
        JSON_SRC: '',

        PO_DATA: {},
        BILLFILE_DATA: {},
        BILL_DATA: {},
        JSON_DATA: {},
        TOTALS_DATA: {
            AMOUNT: 0,
            LINE_AMOUNT: 0,
            TAX_AMOUNT: 0,
            SHIPPING_AMT: 0,
            CHARGE_AMT: 0,
            VARIANCE_AMT: 0
        },

        Script: null,
        Form: null,
        IS_ACTIVE_EDIT: false,
        WarnMessage: [],
        ErrorMessage: [],
        ActiveStatus: [
            BILL_CREATOR.Status.PENDING,
            BILL_CREATOR.Status.ERROR,
            BILL_CREATOR.Status.HOLD,
            BILL_CREATOR.Status.CLOSED,
            BILL_CREATOR.Status.VARIANCE
        ]
    };

    var VARIANCE_DEF = {},
        VARIANCE_TYPE = {
            TAX: 'tax',
            SHIP: 'shipping',
            OTHER: 'other',
            MISC: 'miscCharges',
            ADJ: 'adjustment'
        };

    var FLEXFORM_ACTION = {
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
    };

    ////// MAIN SUITELET ///////
    var Suitelet = {
        onRequest: function (scriptContext) {
            var logTitle = [LogTitle, 'onRequest'].join('::');
            vc2_util.log(logTitle, '############################################');
            vc2_util.log(logTitle, '>> Params: ', scriptContext.request.parameters);

            try {
                FlexScreen_UI.initialize(scriptContext);
                logTitle = [LogTitle, Current.Method, Current.BillFileId].join('::');

                Current.Task = Current.Task || 'viewForm'; // default is viewForm

                if (Current.Method == 'GET') {
                    FlexScreen_UI[Current.Task].call(FlexScreen_UI, scriptContext);

                    if (!vc2_util.isEmpty(Current.ErrorMessage)) throw Current.ErrorMessage;
                    if (!vc2_util.isEmpty(Current.WarnMessage)) {
                        FormHelper.Form.addPageInitMessage({
                            title: 'Warning',
                            message:
                                '<br />' +
                                (util.isArray(Current.WarnMessage)
                                    ? Current.WarnMessage.join('<br />')
                                    : Current.WarnMessage),
                            type: ns_msg.Type.WARNING
                        });
                    }
                } else {
                    FlexScreen_UI.postAction(scriptContext);
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                FlexScreen_UI.handleError(error);
            } finally {
                scriptContext.response.writePage(FormHelper.Form);
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

            Current.BillFileId = scriptContext.request.parameters.record_id;
            Current.Task = scriptContext.request.parameters.taskact || '';
            Current.Method = scriptContext.request.method.toUpperCase();
            Current.Script = ns_runtime.getCurrentScript();

            FormHelper.Form = ns_ui.createForm({ title: 'Flex Screen' });
            FormHelper.Form.clientScriptModulePath =
                './Libraries/CTC_VC_Lib_Suitelet_Client_Script';

            Current.Config = Helper.loadBillingConfig();
            vc2_util.log(logTitle, '>> Current.Config : ', Current.Config);

            VARIANCE_DEF = {
                tax: {
                    name: 'Tax',
                    description: 'VC | Tax Charges',
                    item: Current.Config.taxItem,
                    applied: Current.Config.applyTax ? 'T' : 'F',
                    enabled: Current.Config.applyTax
                },
                shipping: {
                    name: 'Shipping',
                    description: 'VC | Shipping Charges',
                    item: Current.Config.shipItem,
                    applied: Current.Config.applyShip ? 'T' : 'F',
                    enabled: Current.Config.applyShip
                },
                other: {
                    name: 'Other Charges',
                    description: 'VC | Other Charges',
                    item: Current.Config.otherItem,
                    applied: Current.Config.applyOther ? 'T' : 'F',
                    enabled: Current.Config.applyOther
                },
                miscCharges: {
                    name: 'Misc Charges',
                    description: 'VC | Misc Charges',
                    item: Current.Config.otherItem,
                    applied: Current.Config.applyOther ? 'T' : 'F',
                    enabled: Current.Config.applyOther
                }
            };

            ////////// BILL FILE RECORD /////////////////////
            Current.BILLFILE_REC = vc_recordlib.load({
                type: vc2_constant.RECORD.BILLFILE.ID,
                id: Current.BillFileId,
                isDynamic: false
            });

            Current.BILLFILE_DATA = vc_recordlib.extractValues({
                record: Current.BILLFILE_REC,
                fields: vc2_constant.RECORD.BILLFILE.FIELD
            });
            vc2_util.log(logTitle, '>> Bill File: ', Current.BILLFILE_DATA);

            Current.JSON_DATA = vc2_util.safeParse(Current.BILLFILE_DATA.JSON);

            ['shipping', 'other', 'tax'].forEach(function (chargeType) {
                Current.JSON_DATA.charges[chargeType] = parseFloat(
                    Current.JSON_DATA.charges[chargeType] || '0'
                );
                return true;
            });
            vc2_util.log(logTitle, '>> JSON_DATA: ', Current.JSON_DATA);
            /////////////////////////////////////////////////

            Current.RecordUrl = ns_url.resolveRecord({
                recordType: 'customrecord_ctc_vc_bills',
                recordId: Current.BILLFILE_REC.id
            });
            Current.SuiteletUrl = ns_url.resolveScript({
                scriptId: ns_runtime.getCurrentScript().id,
                deploymentId: ns_runtime.getCurrentScript().deploymentId,
                params: {
                    record_id: Current.BillFileId
                    // taskact: Current.Task
                }
            });

            ////////// PO ID /////////////////////
            Current.PO_ID = Current.BILLFILE_DATA.PO_LINK;
            if (Current.PO_ID) {
                Current.PO_REC = vc_recordlib.load({
                    type: 'purchaseorder',
                    id: Current.PO_ID,
                    isDynamic: false
                });

                Current.PO_DATA = vc_recordlib.extractValues({
                    record: Current.PO_REC,
                    fields: [
                        'id',
                        'status',
                        'statusRef',
                        'location',
                        'taxtotal',
                        'tax2total',
                        'entity',
                        'total'
                    ]
                });

                vc2_util.log(logTitle, '>> PO Info: ', Current.PO_DATA);

                Current.VendorCFG = Helper.loadVendorConfig({
                    entity: Current.PO_DATA.entity
                });
                vc2_util.log(logTitle, '>> Vendor Config: ', Current.VendorCFG);
            }
            /////////////////////////////////////////////////

            return returnValue;
        },
        viewFormFields: [
            'H1: Actions',
            'ACTION',
            'SUITELET_URL',
            'BILLFILE_URL',
            'TASK',
            'BILLFILE_ID',
            'PROCESS_VARIANCE',
            'IGNORE_VARIANCE',
            'HOLD_REASON',
            'NOTES',
            'IS_RCVBLE',
            'SPACER',
            'SPACER',
            'STATUS',
            'PROCESS_LOG_TOP',
            'INTEGRATION',
            'BILL_FILE_LINK',
            'SPACER',

            'SPACER:STARTCOL',
            'H1: Transaction',
            'PO_NUM',
            'PO_LINK',
            'PO_STATUS',
            'PO_VENDOR',
            'PO_LOCATION',
            'PO_TOTAL',
            'INV_DATE',
            'INV_DUEDATE',
            // 'INV_DUEDATE_FILE',

            'SPACER:STARTCOL',
            'H1: Bill Info',
            'INV_NUM',
            'INV_LINK',
            'INV_TOTAL',
            'INV_TAX',
            'INV_SHIPPING',
            'INV_OTHER',
            'SPACER'
        ],
        viewForm: function (scriptContext) {
            var logTitle = [LogTitle, 'viewForm'].join('::'),
                returnValue;

            /// Buttons //////////////
            FormHelper.Form.addSubmitButton({ label: 'Submit' });
            FormHelper.Form.addResetButton({ label: 'Reset' });

            //////////////////////////
            Current.ErrorMessage = '';
            Helper.isBillable();
            Helper.isEditActive();

            if (
                // Current.IS_BILLABLE &&
                vc2_util.inArray(Current.BILLFILE_DATA.STATUS, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.REPROCESS
                ])
            ) {
                FormHelper.Form.addButton({
                    id: 'btnProcessBill',
                    label: 'Process Bill File',
                    functionName: 'goToProcessBill'
                });
            }

            vc2_util.log(logTitle, '>> settings', {
                IS_BILLABLE: Current.IS_BILLABLE,
                IS_FULFILLABLE: Current.IS_FULFILLABLE,
                IS_ACTIVE_EDIT: Current.IS_ACTIVE_EDIT
            });

            /// initiate form fields
            FormHelper.initializeFields();
            FormHelper.initializeSublistFields();

            /// RENDER the fields
            if (Current.IS_BILLABLE) {
                this.viewFormFields.push(
                    'SPACER:STARTCOL',
                    'H1: Calculated Totals',
                    'CALC_TOTAL',
                    'CALC_LINETOTAL',
                    'CALC_TAXTOTAL',
                    'CALC_SHIPTOTAL',
                    'CALC_VARIANCETOTAL'
                );
            }
            FormHelper.renderFieldList(this.viewFormFields);

            // create the tabs
            FormHelper.Form.addTab({ id: 'tab_lines', label: 'Invoice Lines' });
            FormHelper.Form.addTab({
                id: 'tab_variance',
                label: 'Variance lines'
            });
            FormHelper.Form.addTab({
                id: 'tab_logs',
                label: 'Processing Logs'
            });
            FormHelper.Form.addTab({
                id: 'tab_payload',
                label: 'Payload Data'
            });

            FormHelper.renderField(
                vc2_util.extend(FormHelper.Fields.PROCESS_LOGS, {
                    container: 'tab_logs'
                })
            );
            FormHelper.renderField(
                vc2_util.extend(FormHelper.Fields.BILLFILE_SOURCE, {
                    container: 'tab_payload'
                })
            );
            FormHelper.renderField(
                vc2_util.extend(FormHelper.Fields.BILLFILE_JSON, {
                    container: 'tab_payload'
                })
            );

            /// SUBLIST: Items ////////////////////////
            /// PRE PROCESS BILLDATA LINES
            vc2_util.log(logTitle, '//// PRE PROCESS BILLDATA LINES //////////');

            // get the PO Lines
            var arrPOLines = vc_recordlib.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: [
                    'item',
                    'rate',
                    'quantity',
                    'amount',
                    'quantityreceived',
                    'quantitybilled',
                    'taxrate',
                    'taxrate1',
                    'taxrate2'
                ]
            });
            arrPOLines.forEach(function (poLine) {
                poLine.AVAILQTY = poLine.quantity;
                poLine.APPLIEDQTY = 0;
                return true;
            });
            // //

            var arrLines = Helper.preprocessBillLines();

            // items sublist
            var itemSublist = FormHelper.renderSublist(
                vc2_util.extend({ tab: 'tab_lines' }, FormHelper.Sublists.ITEM)
            );

            vc2_util.log(logTitle, '//// WRITE BILL LINES //////////');
            arrLines.forEach(function (lineData, i) {
                vc2_util.log(logTitle, '>> line data: ', lineData);

                lineData.nstaxamt = 0;
                lineData.calcamount = 0;

                var matchingPOLine = Helper.findMatchingPOLine({
                    lineData: lineData,
                    poLines: arrPOLines
                })(lineData.matchingLines || []).forEach(function (matchedLine, ii) {
                    // for matched lines on the vbill
                    // apply the bill file rate, to get the amount
                    vc2_util.log(logTitle, '/// [matched line] : ', matchedLine);

                    vc_recordlib.updateLine({
                        record: Current.POBILL_REC,
                        lineData: {
                            line: matchedLine.line,
                            rate: lineData.rate,
                            quantity: ii == 0 ? lineData.quantity : 0 // only apply on the first matched line
                        }
                    });

                    var billLineData = vc_recordlib.extractLineValues({
                        record: Current.POBILL_REC,
                        line: matchedLine.line,
                        columns: ['amount', 'taxrate1', 'taxrate2']
                    });

                    vc2_util.log(logTitle, '/// [billLineData] : ', billLineData);

                    lineData.nstaxamt =
                        (lineData.nstaxamt || 0) + Helper.calculateLineTax(billLineData);
                    lineData.calcamount = (lineData.calcamount || 0) + billLineData.amount;
                });

                // expected bill is greater than available qty
                if (Current.IS_BILLABLE) {
                    if (lineData.billqty > lineData.nsqty)
                        lineData.varianceqty =
                            '<span style="font-weight:bold; color: red;font-size:1em;"> * </span> ';

                    if (lineData.nsrate != lineData.rate)
                        lineData.variancerate =
                            '<span style="font-weight:bold; color: red;font-size:1em;"> * </span> ';
                }

                /// SET THE LINE DATA /////////////
                FormHelper.setSublistValues({
                    sublist: itemSublist,
                    lineData: lineData,
                    line: i
                });
                //////////////////////////////////

                return true;
            });

            /// SUBLIST: Variance Lines ///////////////
            vc2_util.log(logTitle, '//// PRE PROCESS VARIANCE LINES //////////');
            var arrVarianceLines = Helper.preprocessVarianceLines();

            // variance sublist
            var varianceSublist = FormHelper.renderSublist(
                vc2_util.extend(FormHelper.Sublists.VARIANCE, {
                    tab: 'tab_variance'
                })
            );

            /// write the variance lines
            var totalVariance = 0,
                lineAdded = 0;
            for (i = 0, j = arrVarianceLines.length; i < j; i++) {
                var varianceLine = arrVarianceLines[i];
                if (!varianceLine.item) continue;

                lineData = vc2_util.extend(varianceLine, {
                    itemname: Helper.getItemName(varianceLine.item),
                    nsitem: varianceLine.item,
                    amount: varianceLine.amount || varianceLine.rate
                });

                if (lineData.applied == 'T' && lineData.rate == 0) {
                    lineData.applied = 'F';
                }

                ////////////////////
                try {
                    var newLine = vc_recordlib.addLine({
                        record: Current.POBILL_REC,
                        lineData: {
                            item: lineData.nsitem,
                            rate: lineData.amount || lineData.rate,
                            quantity: 1
                        }
                    });

                    billLineData = vc_recordlib.extractLineValues({
                        record: Current.POBILL_REC,
                        line: newLine,
                        columns: ['amount', 'taxrate1', 'taxrate2']
                    });

                    if (lineData.applied == 'T') {
                        lineData.amounttax =
                            (lineData.amounttax || 0) + Helper.calculateLineTax(billLineData);

                        if (lineData.amounttax) {
                            Current.TOTALS_DATA.TAX_AMOUNT += lineData.amounttax;
                        }
                    }
                } catch (line_err) {
                    vc2_util.logError(logTitle, line_err);
                    Current.WarnMessage.push(
                        'Unable to add variance item: ' +
                            varianceLine.name +
                            ('<br /> <b> Error: </b>' + vc2_util.extractError(line_err))
                    );
                }
                ////////////////////

                lineData.is_active = lineData.enabled ? 'T' : 'F';
                /// SET THE LINE DATA /////////////
                FormHelper.setSublistValues({
                    sublist: varianceSublist,
                    lineData: lineData,
                    line: lineAdded++
                });
            }

            ///////////////////////////////////////////
            // CALCULATE THE BILL TOTALS
            if (Current.IS_BILLABLE) Helper.calculateBillTotals(arrLines);
            ///////////////////////////////////////////

            ///////////////////////////////////////////
            if (Current.IS_BILLABLE) {
                // Current.TOTALS_DATA.VARIANCE_AMT = totalVariance;
                Helper.updateBillTotals();

                // check for adjustments
                var adjustmentTotal =
                    Current.JSON_DATA.total -
                    Current.TOTALS_DATA.AMOUNT -
                    Current.TOTALS_DATA.VARIANCE_AMT;

                adjustmentTotal = vc2_util.roundOff(adjustmentTotal);

                if (adjustmentTotal != 0) {
                    var adjustmentLine = vc2_util.extend(VARIANCE_DEF.miscCharges, {
                        applied: 'T',
                        description: 'VC | Adjustment',
                        type: 'adjustment',
                        name: 'Adjustment',
                        amount: adjustmentTotal,
                        itemname: Helper.getItemName(VARIANCE_DEF.miscCharges.item),
                        nsitem: VARIANCE_DEF.miscCharges.item,
                        is_active: 'T',
                        enabled: true
                    });

                    FormHelper.setSublistValues({
                        sublist: varianceSublist,
                        lineData: adjustmentLine,
                        line: varianceSublist.lineCount
                    });

                    // update the VARIANCE AMOUNT
                    Current.TOTALS_DATA.VARIANCE_AMT += adjustmentTotal;
                    Helper.updateBillTotals();
                }
            }

            return true;
        },
        postAction: function (scriptContext) {
            var logTitle = [LogTitle, 'postAction'].join('::'),
                requestObj = scriptContext.request,
                returnValue;

            /// initiate form fields
            FormHelper.initializeFields();
            FormHelper.initializeSublistFields();

            var JSON_DATA = Current.JSON_DATA,
                FormField = FormHelper.Fields;

            var param = {
                    action: requestObj.parameters[FormField.ACTION.id],
                    notes: requestObj.parameters[FormField.NOTES.id],
                    holdReason: requestObj.parameters[FormField.HOLD_REASON.id],
                    poLink: requestObj.parameters[FormField.PO_LINK.id]
                },
                updateValues = {};
            param.ignoreVariance = param.action == 'reprocess_novar';

            // get the ITEM lines
            var sublistItemOption, lineData, lineCount, line;

            sublistItemOption = { group: FormHelper.Sublists.ITEM.id };
            lineCount = requestObj.getLineCount(sublistItemOption);
            param.itemLineCount = lineCount;
            param.itemLines = [];

            for (line = 0; line < lineCount; line++) {
                lineData = FormHelper.extractLineValues({
                    record: requestObj,
                    groupId: sublistItemOption.group,
                    columns: ['nsitem', 'quantity', 'rate', 'nsqty', 'nsrate'],
                    line: line
                });
                JSON_DATA.lines[line].NSITEM = lineData.nsitem;
                util.extend(JSON_DATA.lines[line], {
                    PRICE: param.ignoreVariance ? lineData.nsrate : lineData.rate,
                    BILLRATE: param.ignoreVariance ? lineData.nsrate : lineData.rate,
                    QUANTITY: param.ignoreVariance ? lineData.nsqty : lineData.quantity
                });

                lineData.line = line;
                param.itemLines.push(lineData);
            }

            // get the VARIANCE lines
            sublistItemOption = { group: FormHelper.Sublists.VARIANCE.id };
            lineCount = requestObj.getLineCount(sublistItemOption);
            param.varianceLineCount = lineCount;
            param.varianceLines = [];
            JSON_DATA.varianceLines = [];

            for (line = 0; line < lineCount; line++) {
                lineData = FormHelper.extractLineValues({
                    record: requestObj,
                    groupId: sublistItemOption.group,
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

                JSON_DATA.varianceLines.push({
                    applied: param.ignoreVariance ? 'F' : lineData.applied,
                    type: lineData.type,
                    item: lineData.nsitem,
                    name: lineData.name,
                    description: lineData.description,
                    rate: lineData.amount,
                    quantity: 1
                });

                lineData.line = line;
                param.varianceLines.push(lineData);
            }
            //////////////////////////////////////////
            var BILLFILE_FIELD = vc2_constant.RECORD.BILLFILE.FIELD;

            updateValues[BILLFILE_FIELD.NOTES] = param.notes;
            updateValues[BILLFILE_FIELD.HOLD_REASON] = param.holdReason;
            updateValues[BILLFILE_FIELD.PO_LINK] = param.poLink;

            var redirectToPO = false;

            if (param.holdReason && Current.BILLFILE_DATA.STATUS != BILL_CREATOR.Status.REPROCESS) {
                param.action = FLEXFORM_ACTION.HOLD.value;
            } else if (
                !param.holdReason &&
                Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.REPROCESS
            ) {
                param.action = FLEXFORM_ACTION.RENEW.value;
            }

            vc2_util.log(logTitle, '>>> params: ', param);

            JSON_DATA.ignoreVariance = null;

            switch (param.action) {
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
                    // reset on reprocess
                    updateValues[BILLFILE_FIELD.PROC_VARIANCE] = '';
                    JSON_DATA.ignoreVariance = '';

                    // updateValues[BILLFILE_FIELD.STATUS] = BILL_CREATOR.Status.PENDING;
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
                default:
                    break;
            }

            updateValues[BILLFILE_FIELD.JSON] = JSON.stringify(JSON_DATA);

            vc2_util.log(logTitle, '>>> updateValues: ', updateValues);
            ////////////////////////
            ns_record.submitFields({
                type: vc2_constant.RECORD.BILLFILE.ID,
                id: Current.BillFileId,
                values: updateValues
            });
            ////////////////////////

            if (redirectToPO) {
                ns_redirect.toRecordTransform({
                    fromId: Current.PO_ID,
                    fromType: ns_record.Type.PURCHASE_ORDER,
                    toType: ns_record.Type.VENDOR_BILL
                });
            } else {
                ns_redirect.toSuitelet({
                    scriptId: 'customscript_ctc_vc_bill_flex_screen',
                    deploymentId: '1',
                    parameters: {
                        record_id: Current.BillFileId
                    }
                });
            }

            // FormHelper.renderField({
            //     type: ns_ui.FieldType.LONGTEXT,
            //     displayType: ns_ui.FieldDisplayType.INLINE,
            //     label: 'parameters',
            //     defaultValue: JSON.stringify(param, null, '\t\t')
            // });

            // FormHelper.renderField({
            //     type: ns_ui.FieldType.LONGTEXT,
            //     displayType: ns_ui.FieldDisplayType.INLINE,
            //     label: 'parameters',
            //     defaultValue: JSON.stringify(JSON_DATA, null, '___')
            // });

            return returnValue;
        },
        processbill: function (scriptContext) {
            var logTitle = [LogTitle, 'viewForm'].join('::'),
                returnValue;

            FormHelper.Form.addButton({
                id: 'btnBack',
                label: 'Return Back',
                functionName: 'returnBack'
            });

            var mrTask = ns_task.create({
                taskType: ns_task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_ctc_vc_process_bills',
                params: {
                    custscript_ctc_vc_bc_bill_fileid: Current.BillFileId
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

            FormHelper.Form.addPageInitMessage({
                title: 'Error ' + errorMessage,
                message: util.isString(error) ? error : JSON.stringify(error),
                type: ns_msg.Type.ERROR
            });

            // FormHelper.renderField({
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

                vc2_util.log(logTitle, '>> ITEM ID: ', [itemId, Helper.CACHE[cacheKey]]);
            }

            return Helper.CACHE[cacheKey];
        },
        isBillable: function () {
            var returnValue = true;

            if (!Current.PO_DATA) return false;

            Current.IS_BILLABLE = false;
            Current.IS_FULFILLABLE = false;

            /// If the BillFile is already CLOSED or PROCOSSED,
            ///     OR Bill is already linked, skip
            if (
                vc2_util.inArray(Current.BILLFILE_DATA.STATUS, [
                    BILL_CREATOR.Status.PROCESSED,
                    BILL_CREATOR.Status.CLOSED
                ]) ||
                Current.BILLFILE_DATA.BILL_LINK
            ) {
                returnValue = false;
            }

            /// if the PO is already Fully Billed or Closed, skip
            else if (vc2_util.inArray(Current.PO_DATA.statusRef, ['fullyBilled', 'closed'])) {
                Current.WarnMessage.push('Purchase Order is already ' + Current.PO_DATA.status);
                returnValue = false;
            }

            /// if PO needs to be received (Pending Receipt, Partially Received)
            else if (
                vc2_util.inArray(Current.PO_DATA.statusRef, ['pendingReceipt', 'partiallyReceived'])
            ) {
                var arrMsg = ['Purchase Order is not ready for billing.'];

                Current.IS_FULFILLABLE =
                    Current.BILLFILE_DATA.IS_RCVBLE && Current.VendorCFG.ENABLE_FULFILLLMENT;

                ///     if BillFile is Receivable, and Fulfillment is ENABLED
                if (Current.VendorCFG.ENABLE_FULFILLLMENT) {
                    if (!Current.BILLFILE_DATA.IS_RCVBLE)
                        arrMsg.push('Bill File is not receivable.');
                }

                Current.WarnMessage.push(arrMsg.join(' '));

                returnValue = false;
            } else {
                Current.IS_BILLABLE = true;

                // try to load the BILL record
                if (Current.PO_REC) {
                    try {
                        Current.POBILL_REC = vc_recordlib.transform({
                            fromType: 'purchaseorder',
                            fromId: Current.PO_ID,
                            toType: 'vendorbill',
                            isDynamic: true
                        });
                    } catch (bill_err) {
                        returnValue = false;
                        vc2_util.logError('isBillable', bill_err);

                        Current.ErrorMessage =
                            'Unable to create Vendor Bill due to - ' +
                            vc2_util.extractError(bill_err);
                    }
                }
            }

            return returnValue;
        },
        isEditActive: function () {
            var returnValue = false;

            if (!Current.BILLFILE_DATA) return false; // no bill file, return false;

            if (
                vc2_util.inArray(Current.BILLFILE_DATA.STATUS, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.ERROR,
                    BILL_CREATOR.Status.CLOSED,
                    BILL_CREATOR.Status.HOLD,
                    BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                returnValue = true;

                // exception on edit mode:
                if (
                    // if the PO is already fully billed
                    // !Current.IS_BILLABLE ||
                    // bill file is already closed, but
                    !Current.BILLFILE_DATA.BILL_LINK &&
                    Current.BILLFILE_DATA.status == BILL_CREATOR.Status.CLOSED
                ) {
                    returnValue = false;
                }
            }

            if (
                vc2_util.inArray(Current.BILLFILE_DATA.STATUS, [
                    BILL_CREATOR.Status.ERROR,
                    BILL_CREATOR.Status.HOLD,
                    BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                Current.WarnMessage.push(
                    (Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                        ? 'VARIANCE Detected'
                        : Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.ERROR
                        ? 'ERROR Detected'
                        : Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.HOLD
                        ? 'BILL IS ON HOLD'
                        : '') +
                        '\n\n' +
                        (function (logs) {
                            var str = logs.split(/\n/g).pop();
                            return str.replace(/^.*\d{1,2}\/\d{4}/gi, '');
                        })(Current.BILLFILE_DATA.PROCESS_LOG)
                );
            }

            Current.IS_ACTIVE_EDIT = returnValue;

            return returnValue;
        },
        getLineItems: function (record, filter) {
            if (!record) return false;
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
                            fieldValue = parseInt(fieldValue, 10);
                        if (vc2_util.inArray(field, DEF_LINEFIELDS.currency))
                            fieldValue = parseFloat(fieldValue);
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

                    // lineData.taxAmount = Helper.calculateLineTax(lineData);
                }

                for (var lineItem in objLineItems) {
                    objLineItems[lineItem].amount =
                        objLineItems[lineItem].quantity * objLineItems[lineItem].rate;

                    objLineItems[lineItem].amount = vc2_util.roundOff(
                        objLineItems[lineItem].amount
                    );
                    objLineItems[lineItem].taxAmount = Helper.calculateLineTax(
                        objLineItems[lineItem]
                    );
                }

                Helper.CACHE[cacheKey] = objLineItems;
            }

            return objLineItems;
        },
        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return vc2_util.roundOff(taxAmount) || 0;
        },
        loadBillingConfig: function () {
            var mainConfig = vc_mainConfig.getMainConfiguration();
            if (!mainConfig) {
                log.error('No Configuration available');
                throw new Error('No Configuration available');
            }
            return {
                applyTax: mainConfig.isVarianceOnTax,
                taxItem: mainConfig.defaultTaxItem,
                taxItem2: mainConfig.defaultTaxItem2,
                applyShip: mainConfig.isVarianceOnShipping,
                shipItem: mainConfig.defaultShipItem,
                applyOther: mainConfig.isVarianceOnOther,
                otherItem: mainConfig.defaultOtherItem
            };
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
                returnValue;
            var entityId = option.entity;
            var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

            try {
                var searchOption = {
                    type: 'vendor',
                    filters: [['internalid', 'anyof', entityId]],
                    columns: []
                };

                for (var field in BILLCREATE_CFG.FIELD) {
                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        })
                    );
                }

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count) throw 'No config available';

                returnValue = {};
                searchObj.run().each(function (row) {
                    for (var field in BILLCREATE_CFG.FIELD) {
                        returnValue[field] = row.getValue({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        });
                    }
                    return true;
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        calculateBillTotals: function (arrLines) {
            var logTitle = [LogTitle, 'calculateBillTotals'].join('::');

            if (!Current.POBILL_REC) return false;

            var shippingTotal = 0,
                lineTotal = 0,
                taxTotal = 0;

            arrLines.forEach(function (lineData) {
                if (!lineData.matchingLines) return;

                vc2_util.log(logTitle, '>> lineData : ', lineData);

                // calculate the tax and shipping, if its on the bill
                lineData.matchingLines.forEach(function (matchedLine) {
                    vc2_util.log(logTitle, '>> matchedLine : ', matchedLine);
                    if (
                        matchedLine.item_text.match(/shipping|freight/gi) ||
                        (matchedLine.description &&
                            matchedLine.description.match(/shipping|freight/gi))
                    ) {
                        shippingTotal += matchedLine.amount;
                        return;
                    }
                    return true;
                });

                lineTotal = (lineTotal || 0) + lineData.calcamount;
                taxTotal = (taxTotal || 0) + lineData.nstaxamt;

                return true;
            });

            Current.TOTALS_DATA.TAX_AMOUNT += taxTotal;
            Current.TOTALS_DATA.SHIPPING_AMT += shippingTotal;
            Current.TOTALS_DATA.LINE_AMOUNT += lineTotal;

            Current.TOTALS_DATA.AMOUNT =
                Current.TOTALS_DATA.LINE_AMOUNT +
                Current.TOTALS_DATA.TAX_AMOUNT +
                Current.TOTALS_DATA.SHIPPING_AMT;

            var chargesAmount = Current.JSON_DATA.charges || {};

            Current.TOTALS_DATA.VARIANCE_AMT =
                // tax variance
                (chargesAmount.tax || 0) -
                Current.TOTALS_DATA.TAX_AMOUNT +
                ((chargesAmount.shipping || 0) - Current.TOTALS_DATA.SHIPPING_AMT) +
                (chargesAmount.other || 0) +
                (chargesAmount.miscCharges || 0);

            // variance amount is charges - totals
            // Current.TOTALS_DATA.VARIANCE_AMT =

            // Current.JSON_DATA.total - Current.TOTALS_DATA.AMOUNT;

            vc2_util.log(logTitle, '>> totals : ', Current.TOTALS_DATA);

            this.updateBillTotals();

            return true;
        },
        updateBillTotals: function (option) {
            var logTitle = [LogTitle, 'updateBillTotals'].join('::');

            if (Current.IS_BILLABLE) {
                Current.TOTALS_DATA.AMOUNT =
                    Current.TOTALS_DATA.LINE_AMOUNT +
                    Current.TOTALS_DATA.TAX_AMOUNT +
                    Current.TOTALS_DATA.SHIPPING_AMT;
            }
            vc2_util.log(logTitle, '>> totals : ', [Current.IS_BILLABLE, Current.TOTALS_DATA]);

            FormHelper.updateFieldValue({
                name: 'CALC_TOTAL',
                value: Current.TOTALS_DATA.AMOUNT
            });

            FormHelper.updateFieldValue({
                name: 'CALC_LINETOTAL',
                value: Current.TOTALS_DATA.LINE_AMOUNT
            });

            FormHelper.updateFieldValue({
                name: 'CALC_TAXTOTAL',
                value: Current.TOTALS_DATA.TAX_AMOUNT
            });

            FormHelper.updateFieldValue({
                name: 'CALC_SHIPTOTAL',
                value: Current.TOTALS_DATA.SHIPPING_AMT
            });

            FormHelper.updateFieldValue({
                name: 'CALC_VARIANCETOTAL',
                value: Current.TOTALS_DATA.VARIANCE_AMT
            });
        },
        findMatchingLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingLine'].join('::');

            var lineData = option.lineData,
                dataSet = option.dataSet || [];

            dataSet.forEach(function (dataLine) {
                dataLine.APPLIEDQTY = 0;
                return true;
            });

            var matchingLine = {
                fullyMatched:
                    vc2_util.findMatching({
                        dataSet: option.dataSet,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem,
                            rate: lineData.billrate,
                            quantity: lineData.billqty
                            // APPLIEDQTY: function (value) {
                            //     return this.quantity > value;
                            // },
                        }
                    }) || [],
                itemRateMatch:
                    vc2_util.findMatching({
                        dataSet: option.dataSet,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem,
                            rate: lineData.billrate
                            //     APPLIEDQTY: function (value) {
                            //         return this.quantity > value;
                            //     },
                        }
                    }) || [],
                itemMatch:
                    vc2_util.findMatching({
                        dataSet: option.dataSet,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem
                            // APPLIEDQTY: function (value) {
                            //     return this.quantity > value;
                            // },
                        }
                    }) || []
            };

            var fnAppliedQty = function (matchedLine) {};

            return matchingLine;
        },
        findMatchingPOLine: function (option) {
            var logTitle = [LogTitle, 'findMatchingPOLine'].join('::');

            var lineData = option.lineData,
                poLines = option.poLines;

            var matchingLines = {
                fullyMatched:
                    vc2_util.findMatching({
                        dataSet: poLines,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem,
                            rate: lineData.billrate,
                            quantity: lineData.billqty
                            // availableqty: function (value) {
                            //     return value > 0;
                            // },
                        }
                    }) || [],
                itemRateMatch:
                    vc2_util.findMatching({
                        dataSet: poLines,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem,
                            rate: lineData.billrate
                            // availableqty: function (value) {
                            //     return value > 0;
                            // },
                        }
                    }) || [],
                itemMatch:
                    vc2_util.findMatching({
                        dataSet: poLines,
                        findAll: true,
                        filter: {
                            item: lineData.nsitem
                            // availableqty: function (value) {
                            //     return value > 0;
                            // },
                        }
                    }) || []
            };

            var fnExtractAppliedQty = function (matchedLine) {
                //
            };
        },
        preprocessBillLines_v2: function (option) {
            var logTitle = [LogTitle, 'preprocessBillLines'].join('::'),
                arrLines = [],
                logPrefix = '';

            var lineColumns = [
                'item',
                'rate',
                'quantity',
                'amount',
                'quantityreceived',
                'quantitybilled',
                'taxrate',
                'taxrate1',
                'taxrate2'
            ];

            var arrPOlines = vc_recordlib.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: lineColumns
            });
            arrPOlines.forEach(function (poLine) {
                poLine.AVAILQTY = poLine.quantity;
                poLine.availableqty = poLine.quantity;
                return true;
            });

            var arrBillLines = Current.POBILL_REC
                ? vc_recordlib.extractRecordLines({
                      record: Current.POBILL_REC,
                      findAll: true,
                      columns: lineColumns
                  })
                : [];

            arrBillLines.forEach(function (billLine) {
                billLine.AVAILQTY = billLine.quantity;
                billLine.availableqty = billLine.quantity;
                // billLine.appliedqty = billLine.appliedqty;
                return true;
            });
            var arrTxnLines = [];

            Current.JSON_DATA.lines.forEach(function (billFileLine, i) {
                logPrefix = '[' + [billFileLine.ITEMNO, i].join(':') + '] ';
                vc2_util.log(logTitle, logPrefix + '##############################');

                ///////////
                ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                    if (billFileLine.hasOwnProperty(field))
                        billFileLine[field] = vc2_util.forceFloat(billFileLine[field]);
                    return true;
                });
                billFileLine.QUANTITY = vc2_util.forceInt(billFileLine.QUANTITY);
                ///////////

                // var billLine = {};
                util.extend(billFileLine, {
                    // BILL INFO //
                    item: billFileLine.ITEMNO,
                    nsitem: (billFileLine.NSITEM || '').toString(),
                    quantity: billFileLine.QUANTITY,
                    rate: billFileLine.BILLRATE || billFileLine.PRICE,

                    amount: billFileLine.QUANTITY * (billFileLine.BILLRATE || billFileLine.PRICE),
                    description: billFileLine.DESCRIPTION,
                    ///////////////////

                    remainingqty: billFileLine.QUANTITY,
                    nsqty: 0,
                    billrate: billFileLine.BILLRATE || billFileLine.PRICE,
                    billqty: billFileLine.QUANTITY,
                    matchingLines: []
                });
                vc2_util.log(logTitle, logPrefix + '***** LineData: ', billFileLine);

                var matchingPOLines = Helper.findMatchingLine({
                    lineData: billFileLine,
                    dataSet: arrPOlines
                });

                var matchingBillLines = Helper.findMatchingLine({
                    lineData: billFileLine,
                    dataSet: arrBillLines
                });

                // var matchingLines = {
                //     fullyMatched:
                //         vc2_util.findMatching({
                //             dataSet: arrBillLines,
                //             findAll: true,
                //             filter: {
                //                 item: billFileLine.nsitem,
                //                 rate: billFileLine.billrate,
                //                 quantity: billFileLine.billqty,
                //                 availableqty: function (value) {
                //                     return value > 0;
                //                 },
                //             },
                //         }) || [],
                //     itemRateMatch:
                //         vc2_util.findMatching({
                //             dataSet: arrBillLines,
                //             findAll: true,
                //             filter: {
                //                 item: billFileLine.nsitem,
                //                 rate: billFileLine.billrate,
                //                 availableqty: function (value) {
                //                     return value > 0;
                //                 },
                //             },
                //         }) || [],
                //     itemMatch:
                //         vc2_util.findMatching({
                //             dataSet: arrBillLines,
                //             findAll: true,
                //             filter: {
                //                 item: billFileLine.nsitem,
                //                 availableqty: function (value) {
                //                     return value > 0;
                //                 },
                //             },
                //         }) || [],
                // };

                // var fnExtactBilledQty = function (matchedLine) {
                //     if (matchedLine.availableqty <= 0) return; // skip if no more available qty
                //     if (billFileLine.remainingqty <= 0) return; // skip if no more remaining qty

                //     var qtyToBill =
                //         matchedLine.availableqty >= billFileLine.remainingqty
                //             ? billFileLine.remainingqty // if the availqty can cover all the remqty
                //             : matchedLine.availableqty; // get enough availqt to cover remqty

                //     matchedLine.availableqty -= qtyToBill;
                //     billFileLine.remainingqty -= qtyToBill;

                //     billFileLine.nsqty =
                //         (billFileLine.nsqty || 0) + matchedLine.quantity;
                //     billFileLine.nsrate = matchedLine.rate; // (lineData.nsqty || 0) + matchedLine.quantity;

                //     vc2_util.log(
                //         logTitle,
                //         logPrefix + '... matched line: ',
                //         matchedLine
                //     );
                //     billFileLine.matchingLines.push(matchedLine);

                //     return true;
                // };

                // // try to match the quanties
                // matchingLines.fullyMatched.forEach(fnExtactBilledQty);
                // matchingLines.itemRateMatch.forEach(fnExtactBilledQty);
                // matchingLines.itemMatch.forEach(fnExtactBilledQty);

                // billFileLine.matchedlines = JSON.stringify(
                //     billFileLine.matchingLines
                // );

                arrLines.push(billFileLine);
                return true;
            });

            return arrLines;
        },
        preprocessBillLines: function (option) {
            var logTitle = [LogTitle, 'preprocessBillLines'].join('::'),
                arrLines = [],
                logPrefix = '';

            var lineColumns = [
                'item',
                'rate',
                'quantity',
                'amount',
                'quantityreceived',
                'quantitybilled',
                'taxrate',
                'taxrate1',
                'taxrate2'
            ];

            var arrBillLines = Current.POBILL_REC
                ? vc_recordlib.extractRecordLines({
                      record: Current.POBILL_REC,
                      findAll: true,
                      columns: lineColumns
                  })
                : [];

            var arrPOlines = vc_recordlib.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: lineColumns
            });
            arrPOlines.forEach(function (poLine) {
                poLine.AVAILQTY = poLine.quantity;
                poLine.availableqty = poLine.quantity;
                return true;
            });

            arrBillLines.forEach(function (billLine) {
                billLine.availableqty = billLine.quantity;
                billLine.appliedqty = billLine.appliedqty;
                return true;
            });
            vc2_util.log(logTitle, logPrefix + '// arrBillLines: ', arrBillLines);

            Current.JSON_DATA.lines.forEach(function (billLine, i) {
                logPrefix = '[' + [billLine.ITEMNO, i].join(':') + '] ';
                vc2_util.log(logTitle, logPrefix + '##############################');

                ///////////
                ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                    if (billLine.hasOwnProperty(field))
                        billLine[field] = vc2_util.forceFloat(billLine[field]);
                    return true;
                });
                billLine.QUANTITY = vc2_util.forceInt(billLine.QUANTITY);
                ///////////

                // var billLine = {};
                util.extend(billLine, {
                    // BILL INFO //
                    item: billLine.ITEMNO,
                    nsitem: (billLine.NSITEM || '').toString(),
                    quantity: billLine.QUANTITY,
                    rate: billLine.BILLRATE || billLine.PRICE,

                    amount: billLine.QUANTITY * (billLine.BILLRATE || billLine.PRICE),
                    description: billLine.DESCRIPTION,
                    ///////////////////

                    remainingqty: billLine.QUANTITY,
                    nsqty: 0,
                    billrate: billLine.BILLRATE || billLine.PRICE,
                    billqty: billLine.QUANTITY,
                    matchingLines: []
                });
                vc2_util.log(logTitle, logPrefix + '***** LineData: ', billLine);

                var matchingLines = {
                    fullyMatched:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.billrate,
                                quantity: billLine.billqty,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemRateMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.billrate,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || []
                };

                var fnExtactBilledQty = function (matchedLine) {
                    if (matchedLine.availableqty <= 0) return; // skip if no more available qty
                    if (billLine.remainingqty <= 0) return; // skip if no more remaining qty

                    var qtyToBill =
                        matchedLine.availableqty >= billLine.remainingqty
                            ? billLine.remainingqty // if the availqty can cover all the remqty
                            : matchedLine.availableqty; // get enough availqt to cover remqty

                    matchedLine.availableqty -= qtyToBill;
                    billLine.remainingqty -= qtyToBill;

                    billLine.nsqty = (billLine.nsqty || 0) + matchedLine.quantity;
                    billLine.nsrate = matchedLine.rate; // (lineData.nsqty || 0) + matchedLine.quantity;

                    vc2_util.log(logTitle, logPrefix + '... matched line: ', matchedLine);
                    billLine.matchingLines.push(matchedLine);

                    return true;
                };

                // try to match the quanties
                matchingLines.fullyMatched.forEach(fnExtactBilledQty);
                matchingLines.itemRateMatch.forEach(fnExtactBilledQty);
                matchingLines.itemMatch.forEach(fnExtactBilledQty);

                billLine.matchedlines = JSON.stringify(billLine.matchingLines);

                arrLines.push(billLine);
                return true;
            });

            return arrLines;
        },
        preprocessBillLines_orig: function (option) {
            var logTitle = [LogTitle, 'preprocessBillLines'].join('::'),
                arrLines = [],
                logPrefix = '';

            var lineColumns = [
                'item',
                'rate',
                'quantity',
                'amount',
                'quantityreceived',
                'quantitybilled',
                'taxrate',
                'taxrate1',
                'taxrate2'
            ];

            var arrBillLines =
                (Current.POBILL_REC
                    ? vc_recordlib.extractRecordLines({
                          record: Current.POBILL_REC,
                          findAll: true,
                          columns: lineColumns
                      })
                    : vc_recordlib.extractRecordLines({
                          record: Current.PO_REC,
                          findAll: true,
                          columns: lineColumns
                      })) || [];
            // vc2_util.log(logTitle, '>> arrBillLines: ', arrBillLines);

            arrBillLines.forEach(function (billLine) {
                billLine.availableqty = billLine.quantity;
                billLine.appliedqty = billLine.appliedqty;
                return true;
            });
            vc2_util.log(logTitle, logPrefix + '// arrBillLines: ', arrBillLines);

            Current.JSON_DATA.lines.forEach(function (billLine, i) {
                logPrefix = '[' + [billLine.ITEMNO, i].join(':') + '] ';
                vc2_util.log(logTitle, logPrefix + '##############################');

                ///////////
                ['BILLRATE', 'RATE', 'PRICE'].forEach(function (field) {
                    if (billLine.hasOwnProperty(field))
                        billLine[field] = vc2_util.forceFloat(billLine[field]);
                    return true;
                });
                billLine.QUANTITY = vc2_util.forceInt(billLine.QUANTITY);
                ///////////

                // var billLine = {};
                util.extend(billLine, {
                    // BILL INFO //
                    item: billLine.ITEMNO,
                    nsitem: (billLine.NSITEM || '').toString(),
                    quantity: billLine.QUANTITY,
                    rate: billLine.BILLRATE || billLine.PRICE,

                    amount: billLine.QUANTITY * (billLine.BILLRATE || billLine.PRICE),
                    description: billLine.DESCRIPTION,
                    ///////////////////

                    remainingqty: billLine.QUANTITY,
                    nsqty: 0,
                    billrate: billLine.BILLRATE || billLine.PRICE,
                    billqty: billLine.QUANTITY,
                    matchingLines: []
                });
                vc2_util.log(logTitle, logPrefix + '***** LineData: ', billLine);

                var matchingLines = {
                    fullyMatched:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.billrate,
                                quantity: billLine.billqty,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemRateMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                rate: billLine.billrate,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || [],
                    itemMatch:
                        vc2_util.findMatching({
                            dataSet: arrBillLines,
                            findAll: true,
                            filter: {
                                item: billLine.nsitem,
                                availableqty: function (value) {
                                    return value > 0;
                                }
                            }
                        }) || []
                };

                var fnExtactBilledQty = function (matchedLine) {
                    if (matchedLine.availableqty <= 0) return; // skip if no more available qty
                    if (billLine.remainingqty <= 0) return; // skip if no more remaining qty

                    var qtyToBill =
                        matchedLine.availableqty >= billLine.remainingqty
                            ? billLine.remainingqty // if the availqty can cover all the remqty
                            : matchedLine.availableqty; // get enough availqt to cover remqty

                    matchedLine.availableqty -= qtyToBill;
                    billLine.remainingqty -= qtyToBill;

                    billLine.nsqty = (billLine.nsqty || 0) + matchedLine.quantity;
                    billLine.nsrate = matchedLine.rate; // (lineData.nsqty || 0) + matchedLine.quantity;

                    vc2_util.log(logTitle, logPrefix + '... matched line: ', matchedLine);
                    billLine.matchingLines.push(matchedLine);

                    return true;
                };

                // try to match the quanties
                matchingLines.fullyMatched.forEach(fnExtactBilledQty);
                matchingLines.itemRateMatch.forEach(fnExtactBilledQty);
                matchingLines.itemMatch.forEach(fnExtactBilledQty);

                billLine.matchedlines = JSON.stringify(billLine.matchingLines);

                arrLines.push(billLine);
                return true;
            });

            return arrLines;
        },
        preprocessVarianceLines: function (option) {
            var logTitle = [LogTitle, 'preprocessVarianceLines'].join('::');

            // check for the variance lines
            var arrVarianceLines = [];
            for (var varTypeName in VARIANCE_TYPE) {
                var varType = VARIANCE_TYPE[varTypeName];

                var varianceInfo = VARIANCE_DEF[varType] || {},
                    chargedAmt = Current.JSON_DATA.charges[varType],
                    matchingVarianceLine = vc2_util.findMatching({
                        dataSet: Current.JSON_DATA.varianceLines,
                        filter: { type: varType }
                    });

                if (matchingVarianceLine.item) delete matchingVarianceLine.item;

                // if (!vc2_util.isEmpty(varianceInfo) && !varianceInfo.enabled) continue; // skip
                if (vc2_util.isEmpty(varianceInfo)) continue; // skip
                // if (!varianceInfo.enabled) continue; // skip
                varianceInfo.type = varType;

                switch (varType) {
                    case VARIANCE_TYPE.MISC:
                        (chargedAmt || []).forEach(function (miscCharge) {
                            // look for any existing varianceLine
                            var matchingMiscLine = vc2_util.findMatching({
                                dataSet: Current.JSON_DATA.varianceLines,
                                filter: {
                                    type: varType,
                                    description: miscCharge.description
                                }
                            });

                            // add it to our variance lines
                            arrVarianceLines.push(
                                vc2_util.extend(varianceInfo, matchingMiscLine || miscCharge)
                            );
                        });

                        break;
                    case VARIANCE_TYPE.TAX:
                        // get the diff from TAX TOTAL, and TAX CHARGES
                        util.extend(varianceInfo);

                        arrVarianceLines.push(
                            vc2_util.extend(
                                varianceInfo,
                                matchingVarianceLine || {
                                    rate: vc2_util.roundOff(
                                        chargedAmt - Current.TOTALS_DATA.TAX_AMOUNT
                                    ),
                                    amount: vc2_util.roundOff(
                                        chargedAmt - Current.TOTALS_DATA.TAX_AMOUNT
                                    )
                                }
                            )
                        );

                        break;
                    case VARIANCE_TYPE.SHIP:
                        arrVarianceLines.push(
                            vc2_util.extend(
                                varianceInfo,
                                matchingVarianceLine || {
                                    rate: vc2_util.roundOff(
                                        chargedAmt - Current.TOTALS_DATA.SHIPPING_AMT
                                    ),
                                    amount: vc2_util.roundOff(
                                        chargedAmt - Current.TOTALS_DATA.SHIPPING_AMT
                                    )
                                }
                            )
                        );

                        break;
                    case VARIANCE_TYPE.OTHER:
                    case VARIANCE_TYPE.ADJ:
                        arrVarianceLines.push(
                            vc2_util.extend(
                                varianceInfo,
                                matchingVarianceLine || {
                                    rate: chargedAmt,
                                    amount: chargedAmt
                                }
                            )
                        );

                        break;
                }
            }

            vc2_util.log(logTitle, '// arrVarianceLines: ', arrVarianceLines);

            return arrVarianceLines;
        }
    };
    ///////////////////////////////

    /// FORM HELPER ///////////////
    var FormHelper = {
        Form: null,
        fieldCounter: 0,
        Fields: {},
        Sublists: {},
        initializeFields: function (option) {
            var logTitle = [LogTitle, 'FormHelper:initFields'].join('::');
            var FormField = {
                SPACER: {
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Spacer',
                    defaultValue: '<br/ >'
                },
                HEADER: {
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Header',
                    defaultValue: '<br/ >'
                },
                SUITELET_URL: {
                    id: 'custpage_suitelet_url',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Suitelet URL',
                    defaultValue: Current.SuiteletUrl
                },
                BILLFILE_URL: {
                    id: 'custpage_bill_file',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Bill File',
                    defaultValue: Current.RecordUrl
                },
                TASK: {
                    id: 'taskact',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Task',
                    defaultValue: Current.Task
                },
                BILLFILE_ID: {
                    id: 'record_id',
                    type: ns_ui.FieldType.TEXT,
                    displayType: ns_ui.FieldDisplayType.HIDDEN,
                    label: 'Task',
                    defaultValue: Current.BillFileId
                }
            };

            // MAIN ACTIONS ////////
            util.extend(FormField, {
                ACTION: {
                    id: 'custpage_action',
                    type: ns_ui.FieldType.SELECT,
                    label: 'Action',
                    selectOptions: (function (billStatus) {
                        var selectElems = [FLEXFORM_ACTION.SAVE];

                        if (billStatus == BILL_CREATOR.Status.CLOSED) {
                            selectElems.push(FLEXFORM_ACTION.RENEW);

                            if (
                                Current.PO_DATA &&
                                Current.PO_DATA.statusRef &&
                                vc2_util.inArray(Current.PO_DATA.statusRef, [
                                    'partiallyReceived',
                                    'pendingBillPartReceived',
                                    'pendingBilling'
                                ])
                            ) {
                                selectElems.push(FLEXFORM_ACTION.MANUAL);
                            }
                        } else if (
                            Current.PO_DATA &&
                            Current.PO_DATA.statusRef &&
                            vc2_util.inArray(Current.PO_DATA.statusRef, ['fullyBilled'])
                        ) {
                            selectElems.push(FLEXFORM_ACTION.CLOSE);
                        } else if (billStatus == BILL_CREATOR.Status.VARIANCE) {
                            selectElems.push(
                                FLEXFORM_ACTION.REPROCESS_HASVAR,
                                FLEXFORM_ACTION.REPROCESS_NOVAR,
                                FLEXFORM_ACTION.CLOSE
                            );
                        } else {
                            selectElems.push(FLEXFORM_ACTION.CLOSE, FLEXFORM_ACTION.REPROCESS);
                        }

                        return selectElems;
                    })(Current.BILLFILE_DATA.STATUS)
                },
                ACTIVE_EDIT: {
                    id: 'custpage_chk_variance',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'IS Active Edit',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: Current.IS_ACTIVE_EDIT ? 'T' : 'F'
                },

                PROCESS_VARIANCE: {
                    id: 'custpage_chk_variance',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Process Variance',
                    displayType: Current.BILLFILE_DATA.PROC_VARIANCE
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.HIDDEN,
                    defaultValue: Current.BILLFILE_DATA.PROC_VARIANCE ? 'T' : 'F'
                },
                IGNORE_VARIANCE: {
                    id: 'custpage_chk_ignorevariance',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Ignore Variance',
                    displayType: Current.JSON_DATA.ignoreVariance
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.HIDDEN,

                    defaultValue: Current.JSON_DATA.ignoreVariance ? 'T' : 'F'
                },

                IS_RCVBLE: {
                    id: 'custpage_chk_isreceivable',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Is Receivable',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: Current.BILLFILE_DATA.IS_RCVBLE ? 'T' : 'F'
                },

                HOLD_REASON: {
                    id: 'custpage_hold_reason',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_hold_rsns',
                    label: 'Hold Reason',
                    displayType: Current.IS_ACTIVE_EDIT
                        ? ns_ui.FieldDisplayType.NORMAL
                        : ns_ui.FieldDisplayType.INLINE,
                    defaultValue: Current.BILLFILE_DATA.HOLD_REASON
                },
                NOTES: {
                    id: 'custpage_processing_notes',
                    type: ns_ui.FieldType.TEXTAREA,
                    label: 'Notes',
                    displayType: ns_ui.FieldDisplayType.NORMAL,
                    defaultValue: Current.BILLFILE_DATA.NOTES
                },
                INTEGRATION: {
                    id: 'custpage_integration',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customrecord_vc_bill_vendor_config',
                    label: 'Integration',
                    // breakType: ns_ui.FieldBreakType.STARTCOL,
                    defaultValue: Current.BILLFILE_DATA.INTEGRATION
                },
                STATUS: {
                    id: 'custpage_status',
                    type: ns_ui.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_statuses',
                    label: 'Status',
                    defaultValue: Current.BILLFILE_DATA.STATUS
                },
                PROCESS_LOG_TOP: {
                    id: 'custpage_logs_top',
                    type: ns_ui.FieldType.TEXTAREA,
                    label: 'Latest Log Message',
                    defaultValue: (function (logs) {
                        return logs.split(/\n/g).pop();
                    })(Current.BILLFILE_DATA.PROCESS_LOG)
                },
                BILL_FILE_LINK: {
                    id: 'custpage_bill_file_link',
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Bill File Link',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue:
                        '<span class="smallgraytextnolink uir-label ">' +
                        '<span class="smallgraytextnolink" >Bill File</span>' +
                        '</span>' +
                        '<span class="uir-field inputreadonly">' +
                        '<span class="inputreadonly">' +
                        ('<a class="dottedlink" href="' +
                            Current.RecordUrl +
                            '" target="_blank">' +
                            (function (str, max) {
                                return str.length > max ? str.substr(0, max) + '...' : str;
                            })(Current.BILLFILE_DATA.NAME, 50) +
                            // Current.BillFileId +
                            '</a>') +
                        '</span>' +
                        '</span>'
                },
                PROCESS_LOGS: {
                    id: 'custpage_logs',
                    type: ns_ui.FieldType.LONGTEXT,
                    label: 'Processing Logs',
                    displayType: ns_ui.FieldDisplayType.INLINE,
                    defaultValue: Current.BILLFILE_DATA.PROCESS_LOG
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
                    })(Current.BILLFILE_DATA.SOURCE)
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
                            '<a class="smallgraytextnolink">SOURCE DATA</a>',
                            '</span></span>',
                            '<textarea cols="60" rows="10" disabled="true" ',
                            'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                            content,
                            '</textarea>',
                            '</div>'
                        ].join(' ');
                    })(Current.BILLFILE_DATA.JSON)
                }
            });

            /// BILL FILE DATA /////
            util.extend(FormField, {
                INV_NUM: {
                    id: 'custpage_invnum',
                    type: ns_ui.FieldType.TEXT,
                    label: 'Invoice #',
                    defaultValue: Current.BILLFILE_DATA.BILL_NUM
                },
                INV_LINK: {
                    id: 'custpage_invlink',
                    type: ns_ui.FieldType.SELECT,
                    source: 'transaction',
                    label: 'Bill Link',
                    defaultValue: Current.BILLFILE_DATA.BILL_LINK
                },
                INV_DATE: {
                    id: 'custpage_invdate',
                    type: ns_ui.FieldType.DATE,
                    label: 'Invoice Date',
                    defaultValue: Current.BILLFILE_DATA.DATE
                },
                INV_DUEDATE: {
                    id: 'custpage_invduedate',
                    type: ns_ui.FieldType.DATE,
                    label: 'Due Date',
                    defaultValue: Current.BILLFILE_DATA.DUEDATE
                },
                INV_DUEDATE_FILE: {
                    id: 'custpage_invddatefile',
                    type: ns_ui.FieldType.CHECKBOX,
                    label: 'Due Date From File',
                    defaultValue: Current.BILLFILE_DATA.DDATE_INFILE
                },
                INV_TOTAL: {
                    id: 'custpage_invtotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Invoice Total',
                    defaultValue: Current.JSON_DATA.total
                },
                INV_TAX: {
                    id: 'custpage_invtax',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Tax)',
                    displayType: VARIANCE_DEF.tax.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,
                    defaultValue: Current.JSON_DATA.charges.tax
                },
                INV_SHIPPING: {
                    id: 'custpage_invshipping',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Shipping)',
                    displayType: VARIANCE_DEF.shipping.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,

                    defaultValue: Current.JSON_DATA.charges.shipping
                },
                INV_OTHER: {
                    id: 'custpage_invothercharge',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Other)',
                    displayType: VARIANCE_DEF.other.enabled
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,

                    defaultValue: Current.JSON_DATA.charges.other
                },
                INV_MISCCHARGE: {
                    id: 'custpage_invmisccharge',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Charges (Misc)',
                    displayType: VARIANCE_DEF.other.miscCharges
                        ? ns_ui.FieldDisplayType.INLINE
                        : ns_ui.FieldDisplayType.DISABLED,

                    defaultValue: (function (charges) {
                        var chargeAmt = 0;
                        if (!charges) return chargeAmt;
                        charges.forEach(function (charge) {
                            chargeAmt = (chargeAmt || 0) + parseFloat(charge.amount || '0');
                            return true;
                        });
                        return chargeAmt;
                    })(Current.JSON_DATA.charges.miscCharges)
                }
            });

            /// PO DATA //////////
            util.extend(FormField, {
                PO_NUM: {
                    id: 'custpage_ponum',
                    type: ns_ui.FieldType.TEXT,
                    label: 'PO #',
                    defaultValue: Current.BILLFILE_DATA.POID
                },
                PO_LINK: {
                    id: 'custpage_polink',
                    type: ns_ui.FieldType.SELECT,
                    label: 'PO Link',
                    source: 'transaction',
                    defaultValue: Current.BILLFILE_DATA.PO_LINK
                },
                PO_VENDOR: {
                    id: 'custpage_povendor',
                    type: ns_ui.FieldType.SELECT,
                    source: 'vendor',
                    label: 'Vendor',
                    defaultValue: Current.PO_DATA.entity
                },
                PO_LOCATION: {
                    id: 'custpage_polocation',
                    type: ns_ui.FieldType.TEXT,
                    label: 'Location',
                    defaultValue: Current.PO_DATA.location
                },
                PO_STATUS: {
                    id: 'custpage_postatus',
                    type: ns_ui.FieldType.TEXT,
                    label: 'PO Status',
                    defaultValue: Current.PO_DATA.status
                },
                PO_TOTAL: {
                    id: 'custpage_pototal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'PO Total',
                    defaultValue: Current.PO_DATA.total
                }
            });

            /// TOTALS ////////
            util.extend(FormField, {
                CALC_TOTAL: {
                    id: 'custpage_calctotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Total Bill Amount',
                    defaultValue: Current.TOTALS_DATA.AMOUNT || 0
                },
                CALC_LINETOTAL: {
                    id: 'custpage_linetotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Total Line Amount',
                    defaultValue: Current.TOTALS_DATA.LINE_AMOUNT || 0
                },
                CALC_TAXTOTAL: {
                    id: 'custpage_polinetaxtotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Total Tax',
                    defaultValue: Current.TOTALS_DATA.TAX_AMOUNT || 0
                },
                CALC_SHIPTOTAL: {
                    id: 'custpage_poshiptotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Total Shipping ',
                    defaultValue: Current.TOTALS_DATA.SHIPPING_AMT || 0
                },
                CALC_VARIANCETOTAL: {
                    id: 'custpage_variancetotal',
                    type: ns_ui.FieldType.CURRENCY,
                    label: 'Total Variance Amount',
                    defaultValue: Current.TOTALS_DATA.VARIANCE_AMT || 0
                }
            });

            FormHelper.Fields = FormField;
            return FormField;
        },
        initializeSublistFields: function (option) {
            var Sublists = {};

            Sublists.ITEM = {
                id: 'item',
                label: 'Invoice Lines',
                type: ns_ui.SublistType.LIST,
                fields: {
                    // BILL FILE:item value
                    item: { type: ns_ui.FieldType.TEXT, label: 'Item' },
                    // BILL FILE: nsitem value
                    nsitem: {
                        type: ns_ui.FieldType.SELECT,
                        label: 'NS Item',
                        displayType: Current.IS_ACTIVE_EDIT
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE,
                        // select options -- get all items from PO
                        selectOptions: (function (record) {
                            var arrOptions = [{ text: ' ', value: '' }];
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
                        })(Current.PO_REC)
                    },

                    // BILL FILE: line quantity
                    quantity: {
                        label: 'Bill Qty',
                        type: ns_ui.FieldType.CURRENCY,
                        displayType: Current.IS_ACTIVE_EDIT
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE,
                        size: { w: 5, h: 100 }
                    },

                    poqty: {
                        label: 'PO Qty',
                        type: ns_ui.FieldType.CURRENCY,
                        align: ns_ui.LayoutJustification.CENTER
                    },

                    // PO: quantity (all matching lines)
                    nsqty: {
                        label: 'NS Qty',
                        type: ns_ui.FieldType.CURRENCY,
                        align: ns_ui.LayoutJustification.CENTER
                    },

                    // PO: quantityreceived (all matching lines)
                    nsrcvd: {
                        label: 'NS Rcvd',
                        // displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // PO: quantityreceived (all matching lines)
                    remainingqty: {
                        label: 'NS Avail Qty',
                        // displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // variance indicator
                    varianceqty: {
                        type: ns_ui.FieldType.TEXT,
                        size: { w: 3, h: 100 },
                        label: ' '
                    },

                    // PO: quantitybilled (all matching lines)
                    billqty: {
                        label: 'NS Billed',
                        // displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // BILLFILE: rate value
                    rate: {
                        label: 'Bill Rate',
                        type: ns_ui.FieldType.CURRENCY,
                        size: { w: 10, h: 100 },
                        displayType: Current.IS_ACTIVE_EDIT
                            ? ns_ui.FieldDisplayType.ENTRY
                            : ns_ui.FieldDisplayType.INLINE
                    },
                    // PO: rate value
                    nsrate: {
                        label: 'NS Rate',
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // variance indicator
                    variancerate: {
                        type: ns_ui.FieldType.TEXT,
                        size: { w: 3, h: 100 },
                        label: ' '
                    },

                    // BILLFILE: quantity * rate
                    amount: {
                        label: 'Bill Amount',
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // BILL RECORD: native-calculated amount
                    calcamount: {
                        label: 'Calc Amount',
                        displayType: ns_ui.FieldDisplayType.HIDDEN,
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // BILL RECORD: native-calculated tax amount
                    nstaxamt: {
                        label: 'Calc. Tax',
                        type: ns_ui.FieldType.CURRENCY
                    },

                    // BILL FILE: description
                    description: {
                        label: 'Description',
                        type: ns_ui.FieldType.TEXT
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

            Sublists.VARIANCE = {
                id: 'variance',
                label: 'Variance Lines',
                type: ns_ui.SublistType.LIST,
                fields: {
                    is_active: {
                        label: 'Enabled',
                        type: ns_ui.FieldType.CHECKBOX,
                        displayType: ns_ui.FieldDisplayType.INLINE
                        // Current.IS_ACTIVE_EDIT ||
                        // Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                        //     ? ns_ui.FieldDisplayType.ENTRY
                        //     :
                    },
                    applied: {
                        label: 'Apply',
                        type: ns_ui.FieldType.CHECKBOX,
                        displayType:
                            Current.IS_ACTIVE_EDIT ||
                            Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.VARIANCE
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
                            Current.IS_ACTIVE_EDIT ||
                            Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                                ? ns_ui.FieldDisplayType.ENTRY
                                : ns_ui.FieldDisplayType.INLINE,
                        selectOptions: (function (record) {
                            var arrOptions = [{ text: ' ', value: '' }];

                            for (var varianceType in VARIANCE_DEF) {
                                var varianceInfo = VARIANCE_DEF[varianceType];
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
                        })(Current.PO_REC)
                    },
                    amount: {
                        label: 'Amount',
                        type: ns_ui.FieldType.CURRENCY,
                        totallingField: true,
                        displayType:
                            Current.IS_ACTIVE_EDIT ||
                            Current.BILLFILE_DATA.STATUS == BILL_CREATOR.Status.VARIANCE
                                ? ns_ui.FieldDisplayType.ENTRY
                                : ns_ui.FieldDisplayType.INLINE
                    },
                    amounttax: {
                        label: 'Applied Tax',
                        type: ns_ui.FieldType.CURRENCY,
                        displayType: ns_ui.FieldDisplayType.INLINE
                    }
                    // amountfixed: {
                    //     label: 'Amount (fixed)',
                    //     type: ns_ui.FieldType.CURRENCY,
                    //     displayType: ns_ui.FieldDisplayType.INLINE
                    // }
                }
            };

            FormHelper.Sublists = Sublists;
            return Sublists;
        },
        renderField: function (fieldInfo, containerId) {
            var logTitle = [LogTitle, 'FormHelper:renderField'].join('::');
            this.fieldCounter++;

            var fieldOption = {};

            if (util.isString(fieldInfo) && fieldInfo.match(/:/g)) {
                var cmd = fieldInfo.split(/:/g);

                if (cmd[0] == 'H1') {
                    util.extend(fieldOption, FormHelper.Fields.HEADER);
                    fieldOption.defaultValue =
                        '<div class="fgroup_title">' + cmd[1].toUpperCase() + '</div>';
                } else if (cmd[0] == 'SPACER') {
                    util.extend(fieldOption, FormHelper.Fields.SPACER);
                    fieldOption.defaultValue = '&nbsp;';
                    fieldOption.breakType = ns_ui.FieldBreakType[cmd[1]];
                }

                fieldOption.id = ['custpage_fld', this.fieldCounter].join('_');
            } else {
                util.extend(fieldOption, fieldInfo);
                fieldOption.id =
                    fieldInfo.id ||
                    ['custpage_fld', new Date().getTime(), this.fieldCounter].join('_');
            }

            if (vc2_util.isEmpty(fieldOption)) return;

            if (containerId) fieldOption.container = containerId;

            /////////////////////////
            var fld = FormHelper.Form.addField(fieldOption);
            /////////////////////////

            fld.defaultValue = fieldOption.defaultValue;

            // set the display type
            fld.updateDisplayType({
                displayType: fieldInfo.displayType || ns_ui.FieldDisplayType.INLINE
            });

            // set the breaktype
            if (fieldOption.breakType) fld.updateBreakType({ breakType: fieldOption.breakType });
            if (fieldOption.layoutType)
                fld.updateLayoutType({ layoutType: fieldOption.layoutType });

            // set the selections
            if (fieldInfo.type == ns_ui.FieldType.SELECT) {
                if (fieldInfo.selectOptions && fieldInfo.selectOptions.length) {
                    fld.updateDisplayType({
                        displayType: ns_ui.FieldDisplayType.NORMAL
                    });
                    fieldInfo.selectOptions.forEach(function (selOpt) {
                        fld.addSelectOption(selOpt);
                        return true;
                    });
                }
            }

            return fld;
        },
        renderFieldList: function (fieldList, containerId) {
            var logTitle = [LogTitle, 'FormHelper:renderFieldList'].join('::');
            for (var i = 0, j = fieldList.length; i < j; i++) {
                var fieldName = fieldList[i];

                var fieldInfo = FormHelper.Fields[fieldName];

                // vc2_util.log(logTitle, '>> field: ', [fieldName, fieldInfo]);

                if (fieldInfo) {
                    FormHelper.Fields[fieldName].fldObj = FormHelper.renderField(
                        fieldInfo,
                        containerId
                    );
                } else {
                    FormHelper.renderField(fieldName, containerId);
                }
            }
        },
        renderFieldGroup: function (groupInfo) {
            var logTitle = [LogTitle, 'FormHelper:renderFieldGroup'].join('::');

            if (!groupInfo.id) {
                groupInfo.id = ['custpage_fg', new Date().getTime()].join('_');
            }

            vc2_util.log(logTitle, groupInfo);
            var fgObj = FormHelper.Form.addFieldGroup({
                id: groupInfo.id,
                label: groupInfo.label || '-'
            });
            if (groupInfo.isSingleColumn) fgObj.isSingleColumn = true;
            if (groupInfo.isBorderHidden) fgObj.isBorderHidden = true;
            if (groupInfo.isCollapsible) fgObj.isCollapsible = true;
            if (groupInfo.isCollapsed) fgObj.isCollapsed = true;

            var arrGroupFields = util.isArray(groupInfo.fields)
                ? groupInfo.fields
                : [groupInfo.fields];

            this.renderFieldList(groupInfo.fields, groupInfo.id);

            // for (var i = 0, j = groupInfo.fields.length; i < j; i++) {
            //     var fieldName = groupInfo.fields[i];
            //     var fieldInfo = FormHelper.Fields[fieldName];

            //     vc2_util.log(logTitle, '>> field: ', [fieldName, fieldInfo]);

            //     if (fieldInfo) {
            //         FormHelper.Fields[fieldName].fldObj = FormHelper.renderField(
            //             fieldInfo,
            //             groupInfo.id
            //         );
            //     } else {
            //         FormHelper.renderField(fieldName, groupInfo.id);
            //     }
            // }

            return fgObj;
        },
        renderSublist: function (sublistInfo) {
            var logTitle = [LogTitle, 'FormHelper:renderSublist'].join('::');

            /// ADD SUBLIST ////////////
            var sublistObj = FormHelper.Form.addSublist(sublistInfo);
            /////////////////////////////

            for (var fieldId in sublistInfo.fields) {
                var fieldInfo = sublistInfo.fields[fieldId];
                fieldInfo.id = fieldId;

                //// ADD FIELD ///////////
                var fldObj = sublistObj.addField(fieldInfo);
                //////////////////////////

                if (fieldInfo.displayType)
                    fldObj.updateDisplayType({
                        displayType: fieldInfo.displayType
                    });

                if (fieldInfo.totallingField) {
                    sublistObj.updateTotallingFieldId({ id: fieldInfo.id });
                }

                if (fieldInfo.selectOptions && fieldInfo.selectOptions.length) {
                    fieldInfo.selectOptions.forEach(function (selOpt) {
                        fldObj.addSelectOption(selOpt);
                        return true;
                    });
                }

                if (fieldInfo.size) {
                    fldObj.updateDisplaySize({
                        width: fieldInfo.size.w,
                        height: fieldInfo.size.h
                    });
                }
            }

            // vc2_util.log(logTitle, '>>> render sublist: ', sublistInfo);

            sublistInfo.obj = sublistObj;
            return sublistObj;
        },
        renderSublistField: function (colField, sublistObj) {
            var fld = sublistObj.addField(colField);
            if (colField.displayType) fld.updateDisplayType({ displayType: colField.displayType });

            if (colField.totallingField) {
                sublistObj.updateTotallingFieldId({ id: colField.id });
            }

            if (colField.selectOptions && colField.selectOptions.length) {
                colField.selectOptions.forEach(function (selOpt) {
                    fld.addSelectOption(selOpt);
                    return true;
                });
            }
            return sublistObj;
        },
        updateFieldValue: function (option) {
            var fieldName = option.name;
            var fieldObj = FormHelper.Fields[fieldName]
                ? FormHelper.Fields[fieldName].fldObj
                : false;

            if (!fieldObj)
                fieldObj = FormHelper.Form.getField({
                    id: FormHelper.Fields[fieldName].id
                });

            if (!fieldObj) return;
            fieldObj.defaultValue = option.value;
            return true;
        },
        setSublistValues: function (option) {
            var logTitle = [LogTitle, 'setSublistValues'].join('::');
            var sublistObj = option.sublist,
                lineData = option.lineData,
                line = option.line;

            if (!sublistObj || !lineData || vc2_util.isEmpty(line)) return;

            for (var field in lineData) {
                if (vc2_util.isEmpty(lineData[field])) continue;
                if (util.isObject(lineData[field])) continue;

                try {
                    sublistObj.setSublistValue({
                        id: field,
                        value: lineData[field],
                        line: line
                    });
                } catch (line_err) {
                    vc2_util.log(logTitle, '## ERROR ## ', line_err);
                    vc2_util.log(logTitle, '## ERROR ## ', [field, lineData]);
                }
            }

            // if (!lineData.enabled) {
            //     sublistObj.

            // }
            return true;
        },
        extractLineValues: function (option) {
            var record = option.record,
                groupId = option.groupId,
                line = option.line,
                columns = option.columns;

            if (!record || !columns) return false;
            if (line == null || line < 0) return false;

            var lineData = {};
            for (var i = 0, j = columns.length; i < j; i++) {
                var lineOption = {
                    group: groupId,
                    name: columns[i],
                    line: line
                };
                var value = record.getSublistValue(lineOption);
                lineData[columns[i]] = value;
            }

            return lineData;
        }
    };
    ///////////////////////////////

    return Suitelet;
});
