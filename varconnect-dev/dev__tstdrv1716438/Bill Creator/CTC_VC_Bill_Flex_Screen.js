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
    './../CTC_VC_Constants',
    './../CTC_Util',
    'N/ui/serverWidget',
    'N/ui/message',
    'N/record',
    'N/redirect',
    'N/search',
    'N/url',
    'N/runtime',
    'N/task'
], function (
    VC_Constants,
    CTC_Util,
    serverWidget,
    message,
    record,
    redirect,
    search,
    url,
    runtime,
    task
) {
    var LOG_TITLE = 'FlexScreen',
        BILL_CREATOR = VC_Constants.Bill_Creator;

    var Helper = {
            CACHE: {},
            extractError: function (option) {
                var errorMessage = util.isString(option)
                    ? option
                    : option.message || option.error || JSON.stringify(option);

                if (!errorMessage || !util.isString(errorMessage))
                    errorMessage = 'Unexpected Error occurred';

                return errorMessage;
            },
            processBill: function () {
                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_ctc_vc_process_bills',
                    params: {
                        custscript_ctc_vc_bc_bill_fileid: Param.RecordId
                    }
                });
                mrTask.submit();
                redirect.redirect({
                    url: '/app/common/scripting/mapreducescriptstatus.nl?daterange=TODAY&scripttype=&primarykey=&sortcol=dateCreated&sortdir=DESC'
                });
                return false;
            },
            getItemName: function (itemId) {
                if (!itemId) return '';

                var cacheKey = ['item', itemId].join(':');
                if (!Helper.CACHE.hasOwnProperty(cacheKey)) {
                    try {
                        var itemLookup = CTC_Util.flatLookup({
                            type: 'item',
                            id: itemId,
                            columns: ['name']
                        });
                        Helper.CACHE[cacheKey] = itemLookup.name;
                        log.audit(
                            'getItemName',
                            '## Helper.CACHE[cacheKey] ##' + JSON.stringify(Helper.CACHE[cacheKey])
                        );
                    } catch (err) {
                        Helper.CACHE[cacheKey] = false;
                        log.audit('getItemName', '## ERROR ##' + JSON.stringify(err));
                    }
                }

                return Helper.CACHE[cacheKey];
            },
            isCalcActive: function () {
                var returnValue = false;

                if (
                    CTC_Util.inArray(Current.BILLFILE_DATA.status, [
                        BILL_CREATOR.Status.PENDING,
                        BILL_CREATOR.Status.VARIANCE
                    ]) &&
                    !Current.BILLFILE_DATA.billLink
                ) {
                    returnValue = true;
                }

                return returnValue;
            },
            isBillable: function () {
                var returnValue = true;
                if (!Current.PO_DATA) return false;

                if (
                    Current.PO_DATA &&
                    CTC_Util.inArray(Current.PO_DATA.statusRef, [
                        'fullyBilled',
                        'pendingReceipt',
                        'closed'
                    ])
                ) {
                    // Current.WarnMessage.push(
                    //     'Unable to create Vendor Bill due to - ' + Current.PO_DATA.statusText
                    // );
                    Current.WarnMessage.push(
                        'Purchase Order is not ready for billing: ' + Current.PO_DATA.statusText
                    );
                    returnValue = false;
                }

                if (returnValue) {
                    if (Current.PO_REC && !Current.BILLFILE_DATA.billLink) {
                        try {
                            Current.BILL_REC = record.transform({
                                fromType: 'purchaseorder',
                                fromId: Current.PO_ID,
                                toType: 'vendorbill',
                                isDynamic: true
                            });
                        } catch (bill_err) {
                            returnValue = false;
                            log.audit(
                                'isBillable',
                                '>> ERROR Generating Bill Record: ' + Helper.extractError(bill_err)
                            );
                            Current.ErrorMessage =
                                'Unable to create Vendor Bill due to - ' +
                                Helper.extractError(bill_err);
                        }
                    }
                }

                return returnValue;
            },
            isEditActive: function () {
                var returnValue = false;
                if (!Current.BILLFILE_DATA) return false; // no bill file, return false;

                if (
                    CTC_Util.inArray(Current.BILLFILE_DATA.status, [
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
                        !Current.IS_BILLABLE ||
                        // bill file is already closed, but
                        (!Current.BILLFILE_DATA.billLink &&
                            Current.BILLFILE_DATA.status == BILL_CREATOR.Status.CLOSED)
                    ) {
                        returnValue = false;
                    }
                }

                return returnValue;
            },
            addFields: function (fieldInfo) {
                var logTitle = [logTitle, 'addFields'].join('::');
                // log.audit(logTitle, '>> fieldInfo: ' + JSON.stringify(fieldInfo));

                var fld = Current.Form.addField(fieldInfo);

                if (fieldInfo.displayType)
                    fld.updateDisplayType({
                        displayType: fieldInfo.displayType
                    });

                if (fieldInfo.breakType) fld.updateBreakType({ breakType: fieldInfo.breakType });

                fld.defaultValue = fieldInfo.defaultValue;

                if (fieldInfo.selectOptions && fieldInfo.selectOptions.length) {
                    fieldInfo.selectOptions.forEach(function (selOpt) {
                        fld.addSelectOption(selOpt);
                        return true;
                    });
                }

                return fld;
            },
            addSublistFields: function (colField, sublistObj) {
                var fld = sublistObj.addField(colField);
                if (colField.displayType)
                    fld.updateDisplayType({
                        displayType: colField.displayType
                    });

                if (colField.totallingField) {
                    sublistObj.updateTotallingFieldId({ id: colField.id });
                }

                if (colField.selectOptions && colField.selectOptions.length) {
                    colField.selectOptions.forEach(function (selOpt) {
                        // log.audit('addSublistFields', '# select option: ' + JSON.stringify(selOpt));
                        fld.addSelectOption(selOpt);
                        return true;
                    });
                }
                return sublistObj;
            },
            getFormFields: function (groupName, values) {
                var FormFields = {};
                //////////  FIELD GROUP: ACTION /////////////////////
                FormFields.ACTION = function (values) {
                    var arrFields = [
                        {
                            id: 'custpage_action',
                            type: serverWidget.FieldType.SELECT,
                            label: 'Action',
                            container: 'fg_action',
                            selectOptions: [
                                {
                                    value: 'save',
                                    text: 'Save',
                                    default: true
                                }
                            ]
                        },
                        {
                            id: 'custpage_hold',
                            type: serverWidget.FieldType.SELECT,
                            source: 'customlist_ctc_vc_bill_hold_rsns',
                            container: 'fg_action',
                            label: 'Hold Reason',
                            defaultValue: values.custpage_hold,
                            displayType: !Current.IS_ACTIVE_EDIT
                                ? serverWidget.FieldDisplayType.INLINE
                                : false
                        },
                        {
                            id: 'custpage_processing_notes',
                            type: serverWidget.FieldType.TEXTAREA,
                            container: 'fg_action',
                            label: 'Notes',
                            defaultValue: values.custpage_processing_notes ///Current.BILLFILE_DATA.notes
                        },
                        {
                            id: 'custpage_integration',
                            type: serverWidget.FieldType.SELECT,
                            source: 'customrecord_vc_bill_vendor_config',
                            container: 'fg_action',
                            label: 'Integration',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            breakType: serverWidget.FieldBreakType.STARTCOL,
                            defaultValue: values.custpage_integration //Current.BILLFILE_DATA.integration
                        },
                        {
                            id: 'custpage_status',
                            type: serverWidget.FieldType.SELECT,
                            source: 'customlist_ctc_vc_bill_statuses',
                            container: 'fg_action',
                            label: 'Status',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_status //Current.BILLFILE_DATA.status
                        },
                        {
                            id: 'custpage_bill_file',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_action',
                            label: 'Bill File',
                            displayType: serverWidget.FieldDisplayType.HIDDEN,
                            defaultValue: values.custpage_bill_file //Current.RecordUrl
                            // '<a href="' +
                            // Current.RecordUrl +
                            // '" target="_blank">' +
                            // Current.BILLFILE_REC.getValue({ fieldId: 'name' }) +
                            // '</a>'
                        },
                        {
                            id: 'custpage_suitelet_url',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_action',
                            label: 'Process Bill',
                            displayType: serverWidget.FieldDisplayType.HIDDEN,
                            defaultValue: values.custpage_suitelet_url //Current.SuiteletUrl + '&taskact=processbill'
                        },
                        {
                            id: 'custpage_processing_logs',
                            type: serverWidget.FieldType.LONGTEXT,
                            container: 'fg_action',
                            label: 'Processing Logs',
                            // breakType: serverWidget.FieldBreakType.STARTCOL,
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_processing_logs //Current.BILLFILE_DATA.processLog
                        }
                    ];

                    if (
                        !Current.BILLFILE_DATA.billLink &&
                        CTC_Util.inArray(Current.BILLFILE_DATA.status, Current.ActiveStatus)
                    ) {
                        if (Current.BILLFILE_DATA.status == BILL_CREATOR.Status.CLOSED) {
                            arrFields[0].selectOptions.push({
                                value: 'renew',
                                text: 'Save & Renew'
                            });

                            if (
                                CTC_Util.inArray(Current.PO_DATA.statusRef, [
                                    'partiallyReceived',
                                    'pendingBillPartReceived',
                                    'pendingBilling'
                                ])
                            ) {
                                arrFields[0].selectOptions.push({
                                    value: 'manual',
                                    text: 'Save & Process Manually'
                                });
                            }
                        } else if (
                            !CTC_Util.isEmpty(Current.PO_DATA) &&
                            CTC_Util.inArray(Current.PO_DATA.statusRef, ['fullyBilled'])
                        ) {
                            arrFields[0].selectOptions.push({
                                text: 'Save & Close',
                                value: 'close'
                            });

                            // var msg = message
                        } else if (Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE) {
                            arrFields[0].selectOptions.push(
                                {
                                    text: 'Submit & Process Variance',
                                    value: 'reprocess_hasvar'
                                },
                                {
                                    text: 'Submit & Ignore Variance',
                                    value: 'reprocess_novar'
                                },
                                {
                                    text: 'Save & Close',
                                    value: 'close'
                                }
                            );
                        } else {
                            arrFields[0].selectOptions.push(
                                {
                                    text: 'Save & Close',
                                    value: 'close'
                                },
                                {
                                    text: 'Submit & Reprocess',
                                    value: 'reprocess'
                                }
                            );
                        }
                    }

                    return arrFields;
                };
                /////////////////////////////////////////////////////

                //////////  FIELD GROUP: PURCH_ORDER /////////////////////
                FormFields.PURCH_ORDER = function (values) {
                    var arrFields = [
                        {
                            id: 'custpage_ponum',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_po',
                            label: 'PO #',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_ponum
                        },
                        {
                            id: 'record_id',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Record ID',
                            container: 'fg_po',
                            displayType: serverWidget.FieldDisplayType.HIDDEN,
                            defaultValue: values.record_id
                        },
                        {
                            id: 'custpage_polink',
                            type: serverWidget.FieldType.SELECT,
                            label: 'PO Link',
                            source: 'transaction',
                            container: 'fg_po',
                            displayType: Current.BILLFILE_DATA.linkedPO
                                ? serverWidget.FieldDisplayType.INLINE
                                : false,
                            defaultValue: values.custpage_polink
                        },
                        {
                            id: 'custpage_vendor',
                            type: serverWidget.FieldType.SELECT,
                            source: 'vendor',
                            container: 'fg_po',
                            label: 'Vendor',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_vendor
                        },
                        {
                            id: 'custpage_polocation',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_po',
                            label: 'Location',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_polocation
                        },
                        {
                            id: 'custpage_postatus',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_po',
                            label: 'Status',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_postatus
                        },
                        {
                            id: 'custpage_pototal',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_po',
                            label: 'Total',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_pototal
                        }
                        // {
                        //     id: 'custpage_potaxtotal',
                        //     type: serverWidget.FieldType.CURRENCY,
                        //     container: 'fg_po',
                        //     label: 'Tax Total (PO)',
                        //     displayType: serverWidget.FieldDisplayType.INLINE,
                        //     defaultValue: values.custpage_potaxtotal
                        // },
                    ];
                    return arrFields;
                };
                /////////////////////////////////////////////////////

                //////////  FIELD GROUP: TOTALS /////////////////////
                FormFields.TOTALS = function (values) {
                    var arrFields = [
                        {
                            id: 'custpage_calctotal',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_calc',
                            label: 'Total Bill Amount',
                            breakType: serverWidget.FieldBreakType.STARTCOL,
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_calctotal
                        },
                        {
                            id: 'custpage_linetotal',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_calc',
                            label: 'Total Amount (Lines)',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_poshiptotal
                        },
                        {
                            id: 'custpage_polinetaxtotal',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_calc',
                            label: 'Total Tax (Lines)',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_polinetaxtotal
                        },

                        {
                            id: 'custpage_poshiptotal',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_calc',
                            label: 'Shipping Total',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_poshiptotal
                        }
                    ];

                    return arrFields;
                };
                /////////////////////////////////////////////////////

                //////////  FIELD GROUP: INVOICE /////////////////////
                FormFields.INVOICE = function (values) {
                    var arrFields = [
                        {
                            id: 'custpage_inv',
                            type: serverWidget.FieldType.TEXT,
                            container: 'fg_bill',
                            label: 'Invoice #',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_inv
                        },
                        {
                            id: 'custpage_bill_link',
                            type: serverWidget.FieldType.SELECT,
                            source: 'transaction',
                            container: 'fg_bill',
                            label: 'Bill Link',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_bill_link
                            // //Current.BILLFILE_REC.getValue(
                            //     'custrecord_ctc_vc_bill_linked_bill'
                            // )
                        },
                        {
                            id: 'custpage_date',
                            type: serverWidget.FieldType.DATE,
                            container: 'fg_bill',
                            label: 'Invoice Date',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_date
                            // Current.BILLFILE_REC.getValue(
                            //     'custrecord_ctc_vc_bill_date'
                            // )
                        },
                        {
                            id: 'custpage_duedate',
                            type: serverWidget.FieldType.DATE,
                            container: 'fg_bill',
                            label: 'Due Date',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_duedate
                            // Current.BILLFILE_REC.getValue(
                            //     'custrecord_ctc_vc_bill_due_date'
                            // )
                        },
                        {
                            id: 'custpage_duefromfile',
                            type: serverWidget.FieldType.CHECKBOX,
                            container: 'fg_bill',
                            label: 'Due Date from File',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_duefromfile

                            // BOOLMAP[
                            //     Current.BILLFILE_REC.getValue(
                            //         'custrecord_ctc_vc_bill_due_date_f_file'
                            //     )
                            // ]
                        },
                        {
                            id: 'custpage_total',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_bill',
                            label: 'Invoice Total',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            breakType: serverWidget.FieldBreakType.STARTCOL,
                            defaultValue: values.custpage_total //Current.BILL_DATA.total
                        },
                        {
                            id: 'custpage_tax',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_bill',
                            label: 'Tax Total',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_tax //Current.BILL_DATA.charges.tax
                        },
                        {
                            id: 'custpage_shipping',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_bill',
                            label: 'Shipping',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_shipping //Current.BILL_DATA.charges.shipping
                        },
                        {
                            id: 'custpage_other',
                            type: serverWidget.FieldType.CURRENCY,
                            container: 'fg_bill',
                            label: 'Other Charges',
                            displayType: serverWidget.FieldDisplayType.INLINE,
                            defaultValue: values.custpage_other //Current.BILL_DATA.charges.other
                        }
                    ];

                    return arrFields;
                };
                /////////////////////////////////////////////////////

                return FormFields[groupName].call(FormFields, values);
            },
            getLineItems: function (record, filter) {
                if (!record) return false;
                var lineCount = record.getLineCount('item');

                var objLineItems = {},
                    lineFields = {
                        line: 'int',
                        item: 'list',
                        quantity: 'int',
                        rate: 'currency',
                        amount: 'currency',
                        quantityreceived: 'int',
                        quantitybilled: 'int',
                        taxrate1: 'currency',
                        taxrate2: 'currency'
                    };

                for (var line = 0; line < lineCount; line++) {
                    var lineData = {},
                        isSkipped = false;

                    for (var field in lineFields) {
                        isSkipped = false;

                        if (field == 'line') {
                            lineData[field] = line;
                        } else {
                            lineData[field] = record.getSublistValue({
                                sublistId: 'item',
                                fieldId: field,
                                line: line
                            });
                        }

                        if (lineFields[field] == 'list') {
                            lineData[field + '_text'] = record.getSublistText({
                                sublistId: 'item',
                                fieldId: field,
                                line: line
                            });
                        } else if (lineFields[field] == 'int') {
                            lineData[field] = parseInt(lineData[field], 10);
                            // lineData[field] = lineData[field].toFixed(0);
                        } else if (lineFields[field] == 'currency') {
                            lineData[field] = parseFloat(lineData[field]);
                        }

                        if (!CTC_Util.isEmpty(filter) && filter.hasOwnProperty(field)) {
                            if (filter[field] != lineData[field]) {
                                isSkipped = true;
                                break;
                            }
                        }
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

                    objLineItems[lineItem].amount = CTC_Util.roundOff(
                        objLineItems[lineItem].amount
                    );
                    objLineItems[lineItem].taxAmount = Helper.calculateLineTax(
                        objLineItems[lineItem]
                    );
                }

                log.audit('getLineItems', '>> objLineItems: ' + JSON.stringify(objLineItems));

                return objLineItems;
            },
            calculateLineTax: function (option) {
                var amount = option.amount,
                    taxRate1 = option.taxrate1 || false,
                    taxRate2 = option.taxrate2 || false;

                var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
                taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

                return CTC_Util.roundOff(taxAmount) || 0;
            },
            collectTaxItems: function (objLineItems, itemId) {
                if (!Current.listTaxItems) Current.listTaxItems = {};
                if (!objLineItems || CTC_Util.isEmpty(objLineItems)) return false;

                log.audit('collectTaxItems', '>> items: ' + JSON.stringify([objLineItems, itemId]));

                if (itemId) objLineItems[itemId] = objLineItems;

                for (var lineItem in objLineItems) {
                    if (Current.listTaxItems.hasOwnProperty(lineItem)) continue;

                    var taxData = {};

                    if (objLineItems[lineItem].taxrate || objLineItems[lineItem].taxrate1) {
                        taxData.taxrate1 =
                            objLineItems[lineItem].taxrate || objLineItems[lineItem].taxrate1;
                    }

                    if (objLineItems[lineItem].taxrate2) {
                        taxData.taxrate1 = objLineItems[lineItem].taxrate2;
                    }

                    if (!CTC_Util.isEmpty(taxData)) {
                        Current.listTaxItems[lineItem] = taxData;
                    }
                }

                return Current.listTaxItems;
            },
            addLineItem: function (record, lineData) {
                log.audit('addLineItem', '>> lineData: ' + JSON.stringify(lineData));
                if (!lineData.item) return false;
                record.selectNewLine({
                    sublistId: 'item'
                });
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: lineData.item
                });
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: lineData.quantity || 1
                });
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: Math.abs(lineData.rate || 0.0)
                });
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    value: Math.abs((lineData.quantity || 1) * (lineData.rate || 0.0))
                });
                record.commitLine({ sublistId: 'item' });
                var lineCount = record.getLineCount('item');
                var lineDataNew = Helper.getLineItems(record, {
                    line: lineCount - 1
                });

                log.audit('addLineItem', '>> lineDataNew: ' + JSON.stringify(lineDataNew));
                return lineDataNew[lineData.item];
            },
            getSublistFields: function (sublistName) {
                var SublistFields = {};

                SublistFields.InvoiceLines = function () {
                    var objItemLines = Helper.getLineItems(Current.PO_REC);
                    var arrItemOptions = [{ text: ' ', value: '' }];

                    log.audit('SublistFields.InvoiceLines', JSON.stringify(objItemLines));

                    if (!CTC_Util.isEmpty(objItemLines)) {
                        for (var lineItem in objItemLines) {
                            var lineData = objItemLines[lineItem];
                            arrItemOptions.push({
                                value: lineData.item,
                                text: lineData.item_text
                            });
                        }
                    }

                    return [
                        {
                            id: 'fitem',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Item'
                        },
                        {
                            id: 'nsitem',
                            type: serverWidget.FieldType.SELECT,
                            label: 'NS Item',
                            displayType: Current.IS_ACTIVE_EDIT
                                ? serverWidget.FieldDisplayType.ENTRY
                                : serverWidget.FieldDisplayType.INLINE,
                            selectOptions: arrItemOptions
                        },
                        {
                            id: 'fqty',
                            label: 'Bill Quantity',
                            type: serverWidget.FieldType.CURRENCY,
                            displayType:
                                Current.IS_ACTIVE_EDIT &&
                                Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE
                                    ? serverWidget.FieldDisplayType.ENTRY
                                    : serverWidget.FieldDisplayType.INLINE
                        },
                        {
                            id: 'nsqty',
                            label: 'NS QUANTITY',
                            type: serverWidget.FieldType.CURRENCY
                        },
                        {
                            id: 'nsrcvd',
                            label: 'NS RECEIVED',
                            type: serverWidget.FieldType.CURRENCY
                        },
                        {
                            id: 'nsbilled',
                            label: 'NS BILLED',
                            type: serverWidget.FieldType.CURRENCY
                        },
                        {
                            id: 'frate',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Bill Rate',
                            displayType:
                                Current.IS_ACTIVE_EDIT &&
                                Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE
                                    ? serverWidget.FieldDisplayType.ENTRY
                                    : serverWidget.FieldDisplayType.INLINE
                        },
                        {
                            id: 'billrate',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Bill Rate',
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        },

                        {
                            id: 'nsrate',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'NS Rate'
                        },
                        {
                            id: 'famt',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Bill Amount',
                            totallingField: true
                        },
                        {
                            id: 'nstaxamt',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Calc. Tax'
                        },
                        {
                            id: 'fdesc',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Description'
                        }
                    ];
                };

                SublistFields.Variance = function () {
                    var objItemLines = Helper.getLineItems(Current.PO_REC);
                    var arrItemOptions = [{ text: ' ', value: ' ' }];

                    log.audit('SublistFields.Variance', JSON.stringify(objItemLines));
                    if (!CTC_Util.isEmpty(objItemLines)) {
                        for (var lineItem in objItemLines) {
                            var lineData = objItemLines[lineItem];
                            arrItemOptions.push({
                                value: lineData.item,
                                text: lineData.item_text
                            });
                        }
                    }

                    if (Variance.Config.taxItem2) {
                        arrItemOptions.push({
                            value: Variance.Config.taxItem2,
                            text: Helper.getItemName(Variance.Config.taxItem2)
                        });
                    }

                    return [
                        {
                            id: 'applied',
                            type: serverWidget.FieldType.CHECKBOX,
                            displayType:
                                Current.IS_ACTIVE_EDIT &&
                                Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE
                                    ? serverWidget.FieldDisplayType.ENTRY
                                    : serverWidget.FieldDisplayType.INLINE,
                            label: 'Apply'
                        },
                        {
                            id: 'type',
                            type: serverWidget.FieldType.TEXT,
                            displayType: serverWidget.FieldDisplayType.HIDDEN,
                            label: 'Variance Type'
                        },
                        {
                            id: 'varname',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Type'
                        },
                        {
                            id: 'itemname',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Item'
                        },
                        {
                            id: 'description',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Description'
                        },
                        {
                            id: 'nsitem',
                            type: serverWidget.FieldType.SELECT,
                            label: 'PO Item',
                            displayType:
                                Current.IS_ACTIVE_EDIT &&
                                Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE
                                    ? serverWidget.FieldDisplayType.ENTRY
                                    : serverWidget.FieldDisplayType.INLINE,
                            selectOptions: arrItemOptions
                        },
                        {
                            id: 'itemid',
                            type: serverWidget.FieldType.TEXT,
                            displayType: serverWidget.FieldDisplayType.HIDDEN,
                            label: 'Item'
                        },
                        {
                            id: 'amount',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Amount',
                            totallingField: true,
                            displayType:
                                Current.IS_ACTIVE_EDIT &&
                                Current.BILLFILE_DATA.status == BILL_CREATOR.Status.VARIANCE
                                    ? serverWidget.FieldDisplayType.ENTRY
                                    : serverWidget.FieldDisplayType.INLINE
                        },
                        {
                            id: 'amounttax',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Applied Tax',
                            displayType: serverWidget.FieldDisplayType.INLINE
                        },
                        {
                            id: 'amountfixed',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Amount (fixed)',
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        }
                    ];
                };

                return SublistFields[sublistName].call(SublistFields);
            },
            processInvoiceLines: function () {},
            processVariance: function (option) {
                var logTitle = [LOG_TITLE, 'processVariance'].join('::');

                var varianceOption = option,
                    varianceLineValues = {};

                ///////////////////////////
                // VARIANCE INITIALIZE
                // var varianceValues = {
                //         tax: { applied: false, amount: 0, item: Variance.Config.taxItem },
                //         shipping: { applied: false, amount: 0, item: Variance.Config.shipItem },
                //         other: { applied: false, amount: 0, item: Variance.Config.otherItem },
                //         adjustment: { applied: false, amount: 0, item: Variance.Config.otherItem }
                //     },
                //     varLineData = {},
                //     varianceLineValues = {},
                //     arrVarianceLines = [];

                return {
                    loadValues: function () {
                        // if (CTC_Util.isEmpty(Current.BILL_DATA.varianceLines)) return false;

                        var lineValues = {};
                        if (!CTC_Util.isEmpty(Current.BILL_DATA.varianceLines)) {
                            Current.BILL_DATA.varianceLines.forEach(function (varianceValue) {
                                if (varianceValue.type == 'miscCharges') {
                                    if (!lineValues[varianceValue.type])
                                        lineValues[varianceValue.type] = {};

                                    lineValues[varianceValue.type][varianceValue.description] =
                                        varianceValue;
                                } else {
                                    lineValues[varianceValue.type] = varianceValue;
                                }
                                return true;
                            });
                            varianceLineValues = lineValues;
                        }
                        return lineValues;
                    },

                    /// SHIPPING CHARGES //////////////
                    shippingCharge: function (values, listVariance) {
                        var shipVariance = varianceOption.shipping;

                        if (Variance.Config.applyShip) {
                            if (values) {
                                shipVariance.applied = true;
                                shipVariance.nsitem = values.item;
                                // shipVariance.item = values.item;
                                shipVariance.amount = Current.IS_ACTIVE_RECALC
                                    ? Total.deltaShip || 0
                                    : parseFloat(values.rate || '0');
                            } else {
                                shipVariance.applied = Total.deltaShip != 0;
                                shipVariance.amount = Total.deltaShip || 0;
                            }

                            shipVariance.itemname = Helper.getItemName(shipVariance.item);
                        }

                        log.audit(logTitle, '>> shipVariance: ' + JSON.stringify(shipVariance));

                        if (Current.BILL_REC && shipVariance.item) {
                            var varLineData = Helper.addLineItem(Current.BILL_REC, {
                                label: 'SHIPPING',
                                item: shipVariance.nsitem || shipVariance.item,
                                rate: shipVariance.amount
                            });
                            log.audit(logTitle, '>> shipping line: ' + JSON.stringify(varLineData));

                            if (varLineData) {
                                shipVariance.taxAmount = varLineData.taxAmount || 0;
                                // Total.lineTax += varLineData.taxAmount || 0;
                            }
                        }
                        util.extend(shipVariance, {
                            type: 'shipping',
                            varname: 'Shipping',
                            applied: shipVariance.applied === true ? 'T' : 'F',
                            description: 'VC | Shipping Variance',
                            itemid: shipVariance.item,
                            amount: shipVariance.amount || 0,
                            amounttax: shipVariance.taxAmount
                        });

                        log.audit(logTitle, '>> shipVariance (2): ' + JSON.stringify(shipVariance));

                        if (shipVariance.taxAmount) Total.lineTax += shipVariance.taxAmount;

                        listVariance.push(shipVariance);

                        return shipVariance;
                        /////////////////////////////////
                    },
                    /// OTHER CHARGES //////////////
                    otherCharge: function (values, listVariance) {
                        var otherVariance = varianceOption.other;

                        if (Variance.Config.applyOther) {
                            if (values) {
                                otherVariance.applied = true;
                                otherVariance.nsitem = values.item;
                                // otherVariance.item = values.item;
                                otherVariance.amount = Current.IS_ACTIVE_RECALC
                                    ? Current.BILL_DATA.charges.other
                                    : parseFloat(values.rate || '0');
                            } else {
                                otherVariance.applied = Current.BILL_DATA.charges.other != 0;
                                otherVariance.amount = Current.BILL_DATA.charges.other;
                            }

                            otherVariance.itemname = Helper.getItemName(otherVariance.item);
                        }

                        if (Current.BILL_REC && otherVariance.item) {
                            var varLineData = Helper.addLineItem(Current.BILL_REC, {
                                label: 'OTHER CHARGES',
                                item: otherVariance.nsitem || otherVariance.item,
                                rate: otherVariance.amount
                            });

                            if (varLineData) {
                                otherVariance.taxAmount = varLineData.taxAmount || 0;
                                // Total.lineTax += varLineData.taxAmount || 0;
                            }
                        }

                        util.extend(otherVariance, {
                            applied: otherVariance.applied === true ? 'T' : 'F',
                            type: 'other',
                            varname: 'Other Charges',
                            description: 'VC | Other Charges',
                            itemid: otherVariance.item,
                            amounttax: otherVariance.taxAmount
                        });

                        if (otherVariance.taxAmount) Total.lineTax += otherVariance.taxAmount;
                        Total.miscAmount += otherVariance.amount;
                        listVariance.push(otherVariance);

                        return otherVariance;
                        /////////////////////////////////
                    },
                    /// MISC CHARGES //////////////
                    miscCharge: function (values, listVariance) {
                        var arrMiscCharges = Current.BILL_DATA.charges.miscCharges || [];

                        // misc charges
                        arrMiscCharges.forEach(function (miscCharge) {
                            var miscChargeLine = {
                                    item: Variance.Config.otherItem,
                                    applied: 'T',
                                    type: 'miscCharges',
                                    varname: 'Misc Charges'
                                },
                                miscChgLineData = {};

                            if (values && values[miscCharge.description]) {
                                var savedMiscCharge = values[miscCharge.description];
                                miscChargeLine.nsitem = savedMiscCharge.item;
                                // miscChargeLine.item = values.item;

                                miscChargeLine.amount = Current.IS_ACTIVE_RECALC
                                    ? parseFloat(miscCharge.amount)
                                    : parseFloat(savedMiscCharge.rate || '0');

                                miscChargeLine.itemname = Helper.getItemName(miscChargeLine.item);
                            }

                            if (Current.BILL_REC && miscChargeLine.item) {
                                miscChgLineData = Helper.addLineItem(Current.BILL_REC, {
                                    label: 'MISC CHARGES - ' + miscCharge.description,
                                    item: miscChargeLine.nsitem || miscChargeLine.item,
                                    rate: parseFloat(miscChargeLine.amount)
                                });
                            }

                            util.extend(miscChargeLine, {
                                description: miscCharge.description,
                                amount: parseFloat(miscCharge.amount),
                                itemid: miscChargeLine.item,
                                itemname: Helper.getItemName(miscChargeLine.item),
                                amounttax: miscChgLineData.taxAmount || 0
                            });

                            if (miscChargeLine.taxAmount) Total.lineTax += miscChargeLine.taxAmount;
                            Total.miscAmount += miscChargeLine.amount;
                            listVariance.push(miscChargeLine);

                            return true;
                        });

                        return true;
                        /////////////////////////////////
                    },
                    taxCharge: function (values, listVariance) {
                        var taxVariance = varianceOption.tax;

                        if (Variance.Config.applyTax) {
                            if (values) {
                                taxVariance.applied = true;
                                taxVariance.nsitem = values.item;
                                taxVariance.amount = Current.IS_ACTIVE_RECALC
                                    ? Total.deltaTax
                                    : parseFloat(values.rate);
                            } else {
                                taxVariance.applied = Total.deltaTax != 0;
                                taxVariance.amount = Total.deltaTax;
                            }
                            taxVariance.itemname = Helper.getItemName(taxVariance.item);
                        }
                        if (Current.BILL_REC && taxVariance.item) {
                            var varLineData = Helper.addLineItem(Current.BILL_REC, {
                                label: 'TAX CHARGES',
                                item: taxVariance.nsitem || taxVariance.item,
                                rate: taxVariance.amount
                            });

                            if (varLineData) {
                                taxVariance.taxAmount = varLineData.taxAmount || 0;
                            }
                        }

                        util.extend(taxVariance, {
                            applied: taxVariance.applied === true ? 'T' : 'F',
                            type: 'tax',
                            varname: 'Tax',
                            amount: taxVariance.amount || 0,
                            amounttax: taxVariance.taxAmount,
                            description: 'VC | Tax Variance',
                            itemid: taxVariance.item
                        });

                        if (taxVariance.taxAmount) Total.lineTax += taxVariance.taxAmount;

                        listVariance.unshift(taxVariance);
                    },
                    adjustmentCharge: function (values, listVariance) {
                        var adjustmentVariance = varianceOption.adjustment;

                        if (Total.Adjustment) {
                            if (values) {
                                adjustmentVariance.applied = true;
                                adjustmentVariance.amount = parseFloat(values.rate);
                                adjustmentVariance.nsitem = values.item;
                            } else {
                                adjustmentVariance.applied = Total.Adjustment != 0;
                                adjustmentVariance.amount = Total.Adjustment;
                            }
                        }
                        adjustmentVariance.itemname = Helper.getItemName(adjustmentVariance.item);

                        if (Current.BILL_REC && adjustmentVariance.item) {
                            varLineData = Helper.addLineItem(Current.BILL_REC, {
                                label: 'ADJUSTMENT',
                                item: adjustmentVariance.nsitem || adjustmentVariance.item,
                                rate: adjustmentVariance.amount
                            });
                            adjustmentVariance.taxAmount = varLineData.taxAmount;
                            log.debug(
                                logTitle,
                                '>> adjustment line: ' + JSON.stringify(varLineData)
                            );
                            // Total.lineTax += varianceValues.tax.lineData.taxAmount;
                        }

                        util.extend(adjustmentVariance, {
                            applied: adjustmentVariance.applied === true ? 'T' : 'F',
                            type: 'adjustment',
                            varname: 'Adjustment',
                            description: 'VC | Adjustment',
                            itemid: adjustmentVariance.item,
                            amounttax: adjustmentVariance.taxAmount
                        });
                        listVariance.push(adjustmentVariance);
                        //////////////////////////////////////
                    },
                    addVarianceLine: function (lineData, index) {}
                };
            }
        },
        Param = {
            RecordId: null,
            TaskId: null
        },
        Variance = {},
        Total = {
            lineTax: 0,
            lineShip: 0,
            lineAmount: 0,
            Amount: 0,
            deltaTax: 0,
            deltaShip: 0,
            miscAmount: 0
        },
        Current = {
            Method: null,
            PO_ID: null,
            PO_REC: null,
            Script: null,
            PO_DATA: null,
            BILL_DATA: null,
            BILL_REC: null,
            Form: null,
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

    function onRequest(context) {
        /// initlaize data ///
        Param.RecordId = context.request.parameters.record_id;
        Param.TaskId = context.request.parameters.taskact;
        Current.Method = context.request.method.toUpperCase();

        var logTitle = [LOG_TITLE, Current.Method, Param.RecordId].join('::');
        Current.Script = runtime.getCurrentScript();

        log.debug(
            logTitle,
            '****** START ****** :  ' + JSON.stringify({ method: Current.Method, param: Param })
        );

        Variance.Config = {
            applyTax: Current.Script.getParameter({ name: 'custscript_ctc_bc_tax_var' }),
            applyShip: Current.Script.getParameter({ name: 'custscript_ctc_bc_ship_var' }),
            applyOther: Current.Script.getParameter({ name: 'custscript_ctc_bc_other_var' }),
            taxItem: Current.Script.getParameter({ name: 'custscript_ctc_bc_tax_item' }),
            taxItem2: Current.Script.getParameter({ name: 'custscript_ctc_bc_tax_item2' }),
            shipItem: Current.Script.getParameter({ name: 'custscript_ctc_bc_ship_item' }),
            otherItem: Current.Script.getParameter({ name: 'custscript_ctc_bc_other_item' })
        };
        log.debug(logTitle, '>> Variance.Config : ' + JSON.stringify(Variance.Config));

        Current.BILLFILE_REC = record.load({
            type: 'customrecord_ctc_vc_bills',
            id: Param.RecordId,
            isDynamic: false
        });

        Current.RecordUrl = url.resolveRecord({
            recordType: 'customrecord_ctc_vc_bills',
            recordId: Current.BILLFILE_REC.id
        });
        Current.SuiteletUrl = url.resolveScript({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            params: {
                record_id: Param.RecordId
            }
        });

        Current.PO_ID = Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_linked_po');
        Current.PO_DATA = {};

        if (Current.PO_ID) {
            Current.PO_REC = record.load({
                type: 'purchaseorder',
                id: Current.PO_ID,
                isDynamic: false
            });

            Current.PO_DATA = {
                PO_ID: Current.PO_ID,
                statusText: Current.PO_REC.getText({ fieldId: 'status' }),
                statusRef: Current.PO_REC.getValue({ fieldId: 'statusRef' }),
                status: Current.PO_REC.getValue({ fieldId: 'status' }),
                location: Current.PO_REC.getValue({ fieldId: 'location' }),
                locationText: Current.PO_REC.getText({ fieldId: 'location' }),
                totalTax:
                    parseFloat(Current.PO_REC.getValue('tax2total') || '0') +
                    parseFloat(Current.PO_REC.getValue('taxtotal') || '0'),
                totalShipping: 0,
                entity: Current.PO_REC.getValue('entity'),
                total: Current.PO_REC.getValue('total')
            };

            log.debug(logTitle, '>> PO Info: ' + JSON.stringify(Current.PO_DATA));
        }

        Current.BILLFILE_DATA = {
            status: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_proc_status'),
            billLink: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_linked_bill'),
            linkedPO: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_linked_po'),
            billJson: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_json'),
            holdReason: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_hold_rsn'),
            notes: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_notes'),
            integration: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_integration'),
            billPO: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_po'),
            processLog: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_log')
        };

        Current.BILL_DATA = JSON.parse(Current.BILLFILE_DATA.billJson);
        ['shipping', 'other', 'tax'].forEach(function (chargeType) {
            Current.BILL_DATA.charges[chargeType] = parseFloat(
                Current.BILL_DATA.charges[chargeType] || '0.00'
            );
            return true;
        });

        /////////////////////////////////////////////////////////
        if (Current.Method === 'GET' && Param.TaskId == 'processbill') {
            return Helper.processBill();
        }
        /////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////
        if (Current.Method === 'GET') {
            // CREATE FORM
            Current.Form = serverWidget.createForm({ title: 'Flex Screen' });
            Current.Form.clientScriptModulePath = './Libraries/CTC_VC_Lib_Suitelet_Client_Script';

            /// BUTTONS //////////////////////
            Current.Form.addSubmitButton({ label: 'Submit' });
            Current.Form.addResetButton({ label: 'Reset' });
            Current.Form.addButton({
                id: 'btnBillFile',
                label: 'Go To Bill File Record',
                functionName: 'goToBillFile'
            });

            if (
                CTC_Util.inArray(Current.BILLFILE_DATA.status, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.REPROCESS
                ])
            ) {
                Current.Form.addButton({
                    id: 'btnProcessBill',
                    label: 'Process Bill File',
                    functionName: 'goToProcessBill'
                });
            }
            //////////////////////////

            ///////////////////////////
            if (Current.BILLFILE_DATA.status) {
                Current.BILLFILE_DATA.status = parseInt(Current.BILLFILE_DATA.status);
            }

            log.debug(
                logTitle,
                '>> Current.BILLFILE_DATA: ' + JSON.stringify(Current.BILLFILE_DATA)
            );
            ////////////////////////////////////

            // fieldgroups
            Current.Form.addFieldGroup({ id: 'fg_action', label: 'Actions' });
            Current.Form.addFieldGroup({ id: 'fg_bill', label: 'Bill File' });
            Current.Form.addFieldGroup({
                id: 'fg_po',
                label: 'Purchase Order'
            }).isSingleColumn = true;
            Current.Form.addFieldGroup({
                id: 'fg_calc',
                label: 'Calculated Totals'
            }).isSingleColumn = true;

            ///////////////////////////
            Current.ErrorMessage = '';
            Current.IS_BILLABLE = Helper.isBillable();
            Current.IS_ACTIVE_EDIT = Helper.isEditActive();
            Current.IS_ACTIVE_RECALC = Helper.isCalcActive();

            log.debug(logTitle, '>> IS_BILLABLE: ' + JSON.stringify(Current.IS_BILLABLE));
            log.debug(logTitle, '>> IS_ACTIVE_EDIT: ' + JSON.stringify(Current.IS_ACTIVE_EDIT));
            log.debug(logTitle, '>> IS_ACTIVE_RECALC: ' + JSON.stringify(Current.IS_ACTIVE_RECALC));

            ///////////////////////////
            /// ACTION FIELDS ////////
            Helper.getFormFields('ACTION', {
                custpage_hold: Current.BILLFILE_DATA.holdReason,
                custpage_processing_notes: Current.BILLFILE_DATA.notes,
                custpage_integration: Current.BILLFILE_DATA.integration,
                custpage_status: Current.BILLFILE_DATA.status,
                custpage_bill_file: Current.RecordUrl,
                custpage_suitelet_url: Current.SuiteletUrl + '&taskact=processbill',
                custpage_processing_logs: Current.BILLFILE_DATA.processLog
            }).forEach(Helper.addFields);

            ///////////////////////////
            /// PO  FIELDS ////////
            Helper.getFormFields('PURCH_ORDER', {
                custpage_ponum: Current.BILLFILE_DATA.billPO || '',
                record_id: Param.RecordId || '',
                custpage_polink: Current.BILLFILE_DATA.linkedPO || '',
                custpage_vendor: Current.PO_DATA.entity || '',
                custpage_polocation: Current.PO_DATA.locationText || '',
                custpage_postatus: Current.PO_DATA.status || '',
                custpage_pototal: Current.PO_DATA.total || '',
                custpage_potaxtotal: Current.PO_DATA.totalTax || '',
                custpage_poshiptotal: 0,
                custpage_polinetaxtotal: 0,
                custpage_calctotal: Current.BILL_DATA.total || ''
            }).forEach(Helper.addFields);

            ///////////////////////////
            /// TOTALS  ////////
            Helper.getFormFields('TOTALS', {
                custpage_total: 0,
                custpage_calctotal: 0,
                custpage_linetotal: 0,
                custpage_polinetaxtotal: 0,
                custpage_poshiptotal: 0
            }).forEach(Helper.addFields);

            ///////////////////////////
            /// INVOICE  FIELDS ////////
            Helper.getFormFields('INVOICE', {
                custpage_inv: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_number'),
                custpage_bill_link: Current.BILLFILE_REC.getValue(
                    'custrecord_ctc_vc_bill_linked_bill'
                ),
                custpage_date: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_date'),
                custpage_duedate: Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_due_date'),
                custpage_duefromfile:
                    BOOLMAP[
                        Current.BILLFILE_REC.getValue('custrecord_ctc_vc_bill_due_date_f_file')
                    ],

                custpage_total: Current.BILL_DATA.total,
                custpage_tax: Current.BILL_DATA.charges.tax,
                custpage_shipping: Current.BILL_DATA.charges.shipping,
                custpage_other: Current.BILL_DATA.charges.other
            }).forEach(Helper.addFields);

            ///////////////////////////
            /// ITEM SUBLIST //////////
            var i, j;
            var sublistItem = Current.Form.addSublist({
                id: 'item',
                label: 'Invoice Lines',
                type: serverWidget.SublistType.LIST
            });

            Current.listTaxItems = {};
            Helper.getSublistFields('InvoiceLines').forEach(function (colField) {
                Helper.addSublistFields(colField, sublistItem);
                return true;
            });

            for (i = 0, j = Current.BILL_DATA.lines.length; i < j; i++) {
                var billLineData = Current.BILL_DATA.lines[i];

                var lineData = {
                    fitem: billLineData.ITEMNO,
                    nsitem: billLineData.NSITEM,
                    fqty: billLineData.QUANTITY,
                    fdesc: billLineData.DESCRIPTION,
                    frate: billLineData.BILLRATE || billLineData.PRICE,
                    famt: billLineData.QUANTITY * (billLineData.BILLRATE || billLineData.PRICE)
                };

                if (billLineData.NSITEM && Current.BILL_REC) {
                    // find the line
                    var lineNo = Current.BILL_REC.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: billLineData.NSITEM
                    });
                    // log.debug(logTitle, '>> lineNo:  ' + JSON.stringify(lineNo));

                    if (lineNo >= 0) {
                        Current.BILL_REC.selectLine({
                            sublistId: 'item',
                            line: lineNo
                        });
                        Current.BILL_REC.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: lineData.frate,
                            ignoreFieldChange: true
                        });
                        Current.BILL_REC.commitLine({
                            sublistId: 'item'
                        });
                    }

                    var objBillLines = Helper.getLineItems(Current.BILL_REC, {
                        item: billLineData.NSITEM
                    });

                    // Helper.collectTaxItems(objBillLines);

                    if (!CTC_Util.isEmpty(objBillLines) && objBillLines[billLineData.NSITEM]) {
                        if (!lineData.hasOwnProperty('nstaxamt')) lineData.nstaxamt = 0;

                        lineData.nstaxamt = objBillLines[billLineData.NSITEM].taxAmount;
                        Total.lineTax += lineData.nstaxamt;
                    }

                    // arrBillLines.forEach(function (billLine) {});
                    log.debug(logTitle, '>> bill lines: ' + JSON.stringify(objBillLines));
                }

                if (billLineData.NSITEM && Current.PO_REC) {
                    var objOrderLines = Helper.getLineItems(Current.PO_REC);
                    log.debug(logTitle, '>> order lines: ' + JSON.stringify(objOrderLines));

                    if (!CTC_Util.isEmpty(objOrderLines)) {
                        for (var lineItem in objOrderLines) {
                            var orderLine = objOrderLines[lineItem];

                            if (orderLine.item_text.match(/shipping/gi)) {
                                Total.lineShip += orderLine.amount;
                                continue;
                            }

                            // skip non matching lines
                            if (orderLine.item != billLineData.NSITEM) continue;

                            if (!lineData.hasOwnProperty('nsrate'))
                                lineData.nsrate = orderLine.rate;

                            if (!lineData.hasOwnProperty('nsqty')) lineData.nsqty = 0;
                            lineData.nsqty += orderLine.quantity;

                            if (!lineData.hasOwnProperty('nsrcvd')) lineData.nsrcvd = 0;
                            lineData.nsrcvd += orderLine.quantityreceived;

                            if (!lineData.hasOwnProperty('nsbilled')) lineData.nsbilled = 0;
                            lineData.nsbilled += orderLine.quantitybilled;

                            // if (!lineData.hasOwnProperty('nstaxamt')) lineData.nstaxamt = 0;

                            // if (orderLine.taxrate1 || orderLine.taxrate2) {
                            //     lineData.nstaxamt = orderLine.taxAmount;
                            //     Total.lineTax += lineData.nstaxamt;
                            // }
                        }
                    }
                }
                Total.lineAmount += CTC_Util.roundOff(lineData.frate * lineData.fqty);

                // log.debug(logTitle, '## lineData : ' + JSON.stringify(lineData));

                for (var fieldId in lineData) {
                    if (!CTC_Util.isEmpty(lineData[fieldId])) {
                        // log.debug(logTitle,'## setting line field : ' + JSON.stringify([fieldId, lineData[fieldId]]) );
                        sublistItem.setSublistValue({
                            id: fieldId,
                            value: lineData[fieldId],
                            line: i
                        });
                    }
                }
            }

            /////////////////////////////////////////////////////////////////
            /// P R O C E S S    V A R I A N C E
            var processVariance = Helper.processVariance({
                tax: { applied: false, amount: 0, item: Variance.Config.taxItem },
                shipping: { applied: false, amount: 0, item: Variance.Config.shipItem },
                other: { applied: false, amount: 0, item: Variance.Config.otherItem },
                adjustment: { applied: false, amount: 0, item: Variance.Config.otherItem }
            });

            var ignoreVariance = false;
            if (
                Current.BILL_DATA.hasOwnProperty('ignoreVariance') &&
                Current.BILL_DATA.ignoreVariance == 'T'
            ) {
                ignoreVariance = true;
            }

            var varianceValues = processVariance.loadValues();
            log.debug(logTitle, '>> varianceValues : ' + JSON.stringify(varianceValues));

            Total.lineShip = CTC_Util.roundOff(Total.lineShip) || 0;
            Total.deltaShip = Current.BILL_DATA.charges.shipping - Total.lineShip;
            Total.deltaShip = CTC_Util.roundOff(Total.deltaShip);

            var arrVarianceLines = [];
            processVariance.shippingCharge(varianceValues.shipping, arrVarianceLines);
            processVariance.otherCharge(varianceValues.other, arrVarianceLines);
            processVariance.miscCharge(varianceValues.miscCharges, arrVarianceLines);

            /// RECALCULATE THE TAX ///////////////
            Total.lineTax = CTC_Util.roundOff(Total.lineTax) || 0;
            Total.deltaTax = Current.BILL_DATA.charges.tax - Total.lineTax;
            Total.Amount = Total.lineAmount + Total.lineTax + Total.deltaShip + Total.miscAmount;
            Total.Amount = CTC_Util.roundOff(Total.Amount);

            if (Current.BILL_DATA.charges.tax) {
                Total.deltaTax = Current.BILL_DATA.charges.tax - Total.lineTax;
                Total.Adjustment = Current.BILL_DATA.total - (Total.Amount + Total.deltaTax);
            } else {
                Total.deltaTax = Current.BILL_DATA.total - Total.Amount;
                Total.Adjustment = 0;
            }
            Total.deltaTax = CTC_Util.roundOff(Total.deltaTax);
            Total.Adjustment = CTC_Util.roundOff(Total.Adjustment);

            log.debug(logTitle, '## Totals : ' + JSON.stringify(Total));
            log.debug(logTitle, '## Charges : ' + JSON.stringify(Current.BILL_DATA.charges));
            Current.Form.getField({ id: 'custpage_calctotal' }).defaultValue = Total.Amount;
            Current.Form.getField({ id: 'custpage_linetotal' }).defaultValue = Total.lineAmount;
            Current.Form.getField({ id: 'custpage_polinetaxtotal' }).defaultValue = Total.lineTax;
            Current.Form.getField({ id: 'custpage_poshiptotal' }).defaultValue = Total.lineShip;

            processVariance.taxCharge(varianceValues.tax, arrVarianceLines);
            processVariance.adjustmentCharge(varianceValues.adjustment, arrVarianceLines);

            // varianceLines.misc = processVariance.miscCharge(varianceValues.misc);
            //////////////////////////////////////

            // // log.debug(logTitle, '## varianceValues : ' + JSON.stringify(varianceValues));
            // log.debug(logTitle, '## arrVarianceLines : ' + JSON.stringify(arrVarianceLines));

            /// VARIANCE SUBLIST //////
            var sublistVar = Current.Form.addSublist({
                id: 'variance',
                label: 'Variance Lines',
                type: serverWidget.SublistType.LIST
            });

            Helper.getSublistFields('Variance').forEach(function (colField) {
                Helper.addSublistFields(colField, sublistVar);
                return true;
            });

            arrVarianceLines.forEach(function (lineData, index) {
                lineData.amountfixed = lineData.amount;
                if (ignoreVariance) lineData.applied = 'F';

                log.debug(logTitle, '>>>> lineData ' + JSON.stringify(lineData));

                for (var fieldId in lineData) {
                    // log.debug(
                    //     logTitle,
                    //     '>> setting field: ' + JSON.stringify([fieldId, lineData[fieldId]])
                    // );

                    if (!CTC_Util.isEmpty(lineData[fieldId])) {
                        sublistVar.setSublistValue({
                            id: fieldId,
                            value: lineData[fieldId],
                            line: index
                        });
                    }
                }
                return true;
            });

            /////////////////////////////////////////////////
            if (!CTC_Util.isEmpty(Current.ErrorMessage)) {
                log.debug(logTitle, '>> ErrorMessage: ' + JSON.stringify(Current.ErrorMessage));
                Current.Form.addPageInitMessage({
                    title: 'Error',
                    message: Current.ErrorMessage,
                    type: message.Type.WARNING
                });
            }

            if (
                !CTC_Util.isEmpty(Current.WarnMessage) &&
                CTC_Util.inArray(Current.BILLFILE_DATA.status, [
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.ERROR,
                    // BILL_CREATOR.Status.CLOSED,
                    BILL_CREATOR.Status.HOLD,
                    BILL_CREATOR.Status.VARIANCE
                ])
            ) {
                log.debug(logTitle, '>> WarnMessage: ' + JSON.stringify(Current.WarnMessage));

                // only show warn message if in edit mode
                Current.Form.addPageInitMessage({
                    title: 'Warning',
                    message: Current.WarnMessage,
                    type: message.Type.WARNING
                });
            }

            context.response.writePage(Current.Form);
            /////////////////////////////////////////////////////////
        } else {
            //
            // POST
            /////////////////////////////////////////////////////////

            var params = JSON.parse(JSON.stringify(context.request.parameters));

            log.debug(logTitle, 'custpage_action = ' + params.custpage_action);
            // log.debug(logTitle, 'params = ' + JSON.stringify(params) );

            var updateValues = {},
                ignoreVariance = params.custpage_action == 'reprocess_novar';

            // first treat every submission as a "Save"
            for (var i = 0; i < Current.BILL_DATA.lines.length; i++) {
                Current.BILL_DATA.lines[i].NSITEM =
                    context.request.getSublistValue({
                        group: 'item',
                        name: 'nsitem',
                        line: i
                    }) * 1;

                if (!ignoreVariance) {
                    Current.BILL_DATA.lines[i].PRICE =
                        context.request.getSublistValue({
                            group: 'item',
                            name: 'frate',
                            line: i
                        }) * 1;

                    Current.BILL_DATA.lines[i].BILLRATE =
                        context.request.getSublistValue({
                            group: 'item',
                            name: 'billrate',
                            line: i
                        }) * 1;

                    Current.BILL_DATA.lines[i].QUANTITY =
                        context.request.getSublistValue({
                            group: 'item',
                            name: 'fqty',
                            line: i
                        }) * 1;
                }
            }

            var varianceLines = [];
            var lineCount = context.request.getLineCount({ group: 'variance' });
            for (var line = 0; line < lineCount; line++) {
                var varLineData = {
                    type: context.request.getSublistValue({
                        group: 'variance',
                        name: 'type',
                        line: line
                    }),
                    apply: context.request.getSublistValue({
                        group: 'variance',
                        name: 'applied',
                        line: line
                    }),
                    amount: context.request.getSublistValue({
                        group: 'variance',
                        name: 'amount',
                        line: line
                    }),
                    item: context.request.getSublistValue({
                        group: 'variance',
                        name: 'itemid',
                        line: line
                    }),
                    desc: context.request.getSublistValue({
                        group: 'variance',
                        name: 'description',
                        line: line
                    }),
                    name: context.request.getSublistValue({
                        group: 'variance',
                        name: 'varname',
                        line: line
                    }),
                    nsitem: context.request.getSublistValue({
                        group: 'variance',
                        name: 'nsitem',
                        line: line
                    })
                };
                varLineData.itemid =
                    varLineData.nsitem && varLineData.nsitem.trim()
                        ? varLineData.nsitem
                        : varLineData.item;

                if (ignoreVariance) varLineData.apply = 'F';

                if (varLineData.apply == 'T')
                    varianceLines.push({
                        type: varLineData.type,
                        item: varLineData.itemid,
                        name: varLineData.name,
                        description: varLineData.desc,
                        rate: varLineData.amount,
                        quantity: 1
                    });
            }
            context.response.writeLine({ output: JSON.stringify(varianceLines) });

            // // process the variance values
            // Variance.Values = {
            //     applyTax: params.custpage_variance_tax_apply,
            //     tax: params.custpage_variance_tax,
            //     applyShip: params.custpage_variance_ship_apply,
            //     shipping: params.custpage_variance_shipping,
            //     applyOther: params.custpage_variance_other_apply,
            //     other: params.custpage_variance_other,
            //     applyAdjustment: params.custpage_variance_adjustment_apply,
            //     adjustment: params.custpage_variance_adjustment
            // };
            // log.debug(logTitle, 'Variance.Values = ' + JSON.stringify(Variance.Values));

            if (params.custpage_hold && params.custpage_status !== BILL_CREATOR.Status.REPROCESS) {
                log.debug('custpage_hold', params.custpage_hold);
                params.custpage_action = 'fldHold';
            } else if (
                !params.custpage_hold &&
                params.custpage_status == BILL_CREATOR.Status.REPROCESS
            ) {
                params.custpage_action = 'renew';
            }

            log.debug('fldAction', params.custpage_action);
            updateValues = {
                custrecord_ctc_vc_bill_notes: params.custpage_processing_notes,
                custrecord_ctc_vc_bill_hold_rsn: params.custpage_hold,
                custrecord_ctc_vc_bill_linked_po: params.custpage_polink
            };

            var redirectToPO = false;

            // then do any other fldAction
            switch (params.custpage_action) {
                case 'reprocess_hasvar':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.REPROCESS;
                    updateValues.custrecord_ctc_vc_bill_proc_variance = 'T';
                    log.debug(logTitle, '>> reprocess_hasvar ' + JSON.stringify(updateValues));
                    break;
                case 'reprocess_novar':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.REPROCESS;
                    updateValues.custrecord_ctc_vc_bill_proc_variance = 'F';
                    Current.BILL_DATA.ignoreVariance = 'T';
                    log.debug(logTitle, '>> reprocess_novar ' + JSON.stringify(updateValues));
                    break;
                case 'reprocess':
                case 'renew':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.REPROCESS;
                    break;

                case 'close':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.CLOSED;
                    break;

                case 'manual':
                    log.debug('redirecting to', Current.PO_ID);
                    redirectToPO = true;
                    break;
                case 'fldHold':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.HOLD;
                    break;
            }
            log.debug(logTitle, '>> Update Values: ' + JSON.stringify(updateValues));

            Current.BILL_DATA.varianceLines = varianceLines;
            updateValues.custrecord_ctc_vc_bill_json = JSON.stringify(Current.BILL_DATA);

            context.response.writeLine({
                output: JSON.stringify(Current.BILL_DATA)
            });

            context.response.writeLine({
                output: JSON.stringify(updateValues)
            });

            record.submitFields({
                type: 'customrecord_ctc_vc_bills',
                id: Param.RecordId,
                values: updateValues
            });

            if (redirectToPO) {
                redirect.toRecordTransform({
                    fromId: Current.PO_ID,
                    fromType: record.Type.PURCHASE_ORDER,
                    toType: record.Type.VENDOR_BILL
                });
            } else {
                redirect.toSuitelet({
                    scriptId: 'customscript_ctc_vc_bill_flex_screen',
                    deploymentId: '1',
                    parameters: {
                        record_id: Param.RecordId
                    }
                });
            }
        }
    }

    var BOOLMAP = {
        true: 'T',
        false: 'F',
        T: true,
        F: false
    };

    return {
        onRequest: onRequest
    };
});
