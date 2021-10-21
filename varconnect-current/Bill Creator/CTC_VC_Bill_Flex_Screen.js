/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define([
    './../CTC_VC_Constants',
    'N/ui/serverWidget',
    'N/record',
    'N/redirect',
    'N/search',
    'N/url',
    'N/runtime'
], function (VC_Constants, serverWidget, record, redirect, search, url, runtime) {
    var LOG_TITLE = 'VC_FLEX_SL',
        BILL_CREATOR = VC_Constants.Bill_Creator;

    /**
     * TODO:
     *  o   add button to process the bill record immediately
     */

    var Helper = {
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            return arrValue.indexOf(stValue) > -1;
        },
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return false;

            return Math.round(flValue * 100) / 100;
        }
    };

    function onRequest(context) {
        var record_id = context.request.parameters.record_id;
        var recBillFile = record.load({
            type: 'customrecord_ctc_vc_bills',
            id: record_id,
            isDynamic: false
        });
        var logTitle = [LOG_TITLE, 'FlexScreen', record_id].join('::');

        log.debug(
            logTitle,
            '*** START *** ' +
                JSON.stringify({
                    method: context.request.method
                })
        );

        var poId = recBillFile.getValue('custrecord_ctc_vc_bill_linked_po');
        var recPO,
            dataPO = {};

        if (poId) {
            recPO = record.load({
                type: 'purchaseorder',
                id: poId,
                isDynamic: false
            });

            dataPO = {
                poId: poId,
                status: recPO.getText({ fieldId: 'status' }),
                statusRef: recPO.getValue({ fieldId: 'statusRef' }),
                totalTax:
                    parseFloat(recPO.getValue('tax2total') || '0') +
                    parseFloat(recPO.getValue('taxtotal') || '0'),
                totalShipping: 0
            };

            log.debug(logTitle, '>> PO Info: ' + JSON.stringify(dataPO));
        }

        var parsedBillData = JSON.parse(
            recBillFile.getValue({
                fieldId: 'custrecord_ctc_vc_bill_json'
            })
        );

        /////////////////////////////////////////////////////////
        if (context.request.method === 'GET') {
            var flexForm = serverWidget.createForm({
                title: 'Flex Screen'
            });
            flexForm.clientScriptModulePath = './Libraries/CTC_VC_Lib_Suitelet_Client_Script';

            // SUBMIT BUTTON
            flexForm.addSubmitButton({ label: 'Submit' });
            flexForm.addResetButton({ label: 'Reset' });

            ///////////////////////////
            var dataBill = {
                status: recBillFile.getValue('custrecord_ctc_vc_bill_proc_status'),
                billLink: recBillFile.getValue('custrecord_ctc_vc_bill_linked_bill'),
                linkedPO: recBillFile.getValue('custrecord_ctc_vc_bill_linked_po')
            };
            if (dataBill.status) {
                dataBill.status = parseInt(dataBill.status);
            }

            log.debug(logTitle, 'dataBill: ' + JSON.stringify(dataBill));
            ////////////////////////////////////

            // fieldgroups
            flexForm.addFieldGroup({ id: 'fg_action', label: 'Actions' }); //.isSingleColumn = true;
            flexForm.addFieldGroup({ id: 'fg_variance', label: 'Variance' }).isSingleColumn = true;
            flexForm.addFieldGroup({ id: 'fg_bill', label: 'Bill File' }).isSingleColumn = true;
            flexForm.addFieldGroup({ id: 'fg_po', label: 'Purchase Order' }).isSingleColumn = true;

            ///////////////////////////
            var fnIsActive = function () {
                var returnValue = false;

                if (
                    Helper.inArray(dataBill.status, [
                        BILL_CREATOR.Status.PENDING,
                        BILL_CREATOR.Status.ERROR,
                        BILL_CREATOR.Status.CLOSED,
                        BILL_CREATOR.Status.HOLD,
                        BILL_CREATOR.Status.VARIANCE
                    ])
                ) {
                    returnValue = true;
                    if (!dataBill.billLink) {
                        if (dataBill.status == BILL_CREATOR.Status.CLOSED) returnValue = false;
                    } else {
                        returnValue = false;
                    }
                }

                return returnValue;
            };

            var fnAddFields = function (fieldInfo) {
                var fld = flexForm.addField(fieldInfo);
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
            };
            ///////////////////////////

            var ACT_Fields = [
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
                }
            ];

            var arrActiveStatus = [
                BILL_CREATOR.Status.PENDING,
                BILL_CREATOR.Status.ERROR,
                BILL_CREATOR.Status.HOLD,
                BILL_CREATOR.Status.CLOSED,
                BILL_CREATOR.Status.VARIANCE
            ];

            if (!dataBill.billLink && Helper.inArray(dataBill.status, arrActiveStatus)) {
                if (dataBill.status == BILL_CREATOR.Status.CLOSED) {
                    ACT_Fields[0].selectOptions.push({
                        value: 'renew',
                        text: 'Save & Renew'
                    });

                    if (
                        Helper.inArray(dataPO.statusRef, [
                            'partiallyReceived',
                            'pendingBillPartReceived',
                            'pendingBilling'
                        ])
                    ) {
                        ACT_Fields[0].selectOptions.push({
                            value: 'manual',
                            text: 'Save & Process Manually'
                        });
                    }
                } else if (dataBill.status == BILL_CREATOR.Status.VARIANCE) {
                    ACT_Fields[0].selectOptions.push(
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
                    ACT_Fields[0].selectOptions.push(
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

            var billFileUrl = url.resolveRecord({
                recordType: 'customrecord_ctc_vc_bills',
                recordId: recBillFile.id
            });

            flexForm.addButton({
                id: 'btnBillFile',
                label: 'Go To Bill File Record',
                functionName: 'goToBillFile'
            });

            ACT_Fields.push(
                // {
                //     id: 'custpage_proc_variance',
                //     type: serverWidget.FieldType.CHECKBOX,
                //     source: 'customlist_ctc_vc_bill_statuses',
                //     container: 'fg_action',
                //     label: 'Process Variance',
                //     defaultValue: BOOLMAP[recBillFile.getValue('custrecord_ctc_vc_bill_proc_variance')],
                //     displayType:
                //         dataBill.status !== BILL_CREATOR.Status.VARIANCE
                //             ? serverWidget.FieldDisplayType.DISABLED
                //             : false
                // },
                {
                    id: 'custpage_integration',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customrecord_vc_bill_vendor_config',
                    container: 'fg_action',
                    label: 'Integration',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    breakType: serverWidget.FieldBreakType.STARTCOL,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_integration')
                },
                {
                    id: 'custpage_status',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_statuses',
                    container: 'fg_action',
                    label: 'Status',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_proc_status')
                },
                {
                    id: 'custpage_bill_file',
                    type: serverWidget.FieldType.TEXT,
                    container: 'fg_action',
                    label: 'Bill File',
                    displayType: serverWidget.FieldDisplayType.HIDDEN,

                    defaultValue: billFileUrl
                    // '<a href="' +
                    // billFileUrl +
                    // '" target="_blank">' +
                    // recBillFile.getValue({ fieldId: 'name' }) +
                    // '</a>'
                },
                {
                    id: 'custpage_hold',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_hold_rsns',
                    container: 'fg_action',
                    label: 'Hold Reason',
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_hold_rsn'),
                    displayType: !fnIsActive() ? serverWidget.FieldDisplayType.INLINE : false
                },
                {
                    id: 'custpage_processing_notes',
                    type: serverWidget.FieldType.TEXTAREA,
                    container: 'fg_action',
                    label: 'Notes',
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_notes')
                },
                {
                    id: 'custpage_processing_logs',
                    type: serverWidget.FieldType.LONGTEXT,
                    container: 'fg_action',
                    label: 'Processing Logs',
                    breakType: serverWidget.FieldBreakType.STARTCOL,
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_log')
                }
            );

            ///////////////

            ////////////////////////
            ACT_Fields.forEach(fnAddFields);

            /// PO Info
            ///////////////////
            var PO_Fields = [
                {
                    id: 'custpage_ponum',
                    type: serverWidget.FieldType.TEXT,
                    container: 'fg_po',
                    label: 'PO #',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_po')
                },
                {
                    id: 'record_id',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Record ID',
                    container: 'fg_po',
                    displayType: serverWidget.FieldDisplayType.HIDDEN,
                    defaultValue: record_id
                },
                {
                    id: 'custpage_polink',
                    type: serverWidget.FieldType.SELECT,
                    label: 'PO Link',
                    source: 'transaction',
                    container: 'fg_po',
                    displayType: dataBill.linkedPO ? serverWidget.FieldDisplayType.INLINE : false,
                    defaultValue: dataBill.linkedPO
                }
            ];
            if (!Helper.isEmpty(recPO)) {
                PO_Fields.push({
                    id: 'custpage_vendor',
                    type: serverWidget.FieldType.SELECT,
                    source: 'vendor',
                    container: 'fg_po',
                    label: 'Vendor',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recPO.getValue('entity')
                });
                PO_Fields.push({
                    id: 'custpage_polocation',
                    type: serverWidget.FieldType.TEXT,
                    container: 'fg_po',
                    label: 'Location',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recPO.getText('location')
                });
                PO_Fields.push({
                    id: 'custpage_postatus',
                    type: serverWidget.FieldType.TEXT,
                    container: 'fg_po',
                    label: 'Status',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recPO.getValue('status')
                });
                PO_Fields.push({
                    id: 'custpage_pototal',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_po',
                    label: 'Total',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recPO.getValue('total')
                });
                PO_Fields.push({
                    id: 'custpage_potaxtotal',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_po',
                    label: 'Tax Total (PO)',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue:
                        parseFloat(recPO.getValue('tax2total') || '0') +
                        parseFloat(recPO.getValue('taxtotal') || '0')
                });
                PO_Fields.push({
                    id: 'custpage_polinetaxtotal',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_po',
                    label: 'Tax Total (Lines)',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: 0 //parseFloat(recPO.getValue('tax2total') || '0') + parseFloat(recPO.getValue('taxtotal') || '0')
                });
                // PO_Fields.push({
                //     id: 'custpage_calctotal',
                //     type: serverWidget.FieldType.CURRENCY,
                //     container: 'fg_bill',
                //     label: 'Calculated Total',
                //     displayType: serverWidget.FieldDisplayType.INLINE,
                //     defaultValue: parsedBillData.total
                // });
            }
            PO_Fields.forEach(fnAddFields);

            /// Invoice Info
            ///////////////////
            var INV_Fields = [
                {
                    id: 'custpage_inv',
                    type: serverWidget.FieldType.TEXT,
                    container: 'fg_bill',
                    label: 'Invoice #',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_number')
                },
                {
                    id: 'custpage_bill_link',
                    type: serverWidget.FieldType.SELECT,
                    source: 'transaction',
                    container: 'fg_bill',
                    label: 'Bill Link',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_linked_bill')
                },
                {
                    id: 'custpage_date',
                    type: serverWidget.FieldType.DATE,
                    container: 'fg_bill',
                    label: 'Invoice Date',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_date')
                },
                {
                    id: 'custpage_duedate',
                    type: serverWidget.FieldType.DATE,
                    container: 'fg_bill',
                    label: 'Due Date',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: recBillFile.getValue('custrecord_ctc_vc_bill_due_date')
                },
                {
                    id: 'custpage_duefromfile',
                    type: serverWidget.FieldType.CHECKBOX,
                    container: 'fg_bill',
                    label: 'Due Date from File',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue:
                        BOOLMAP[recBillFile.getValue('custrecord_ctc_vc_bill_due_date_f_file')]
                },
                {
                    id: 'custpage_total',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_bill',
                    label: 'Invoice Total',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: parsedBillData.total
                },
                {
                    id: 'custpage_calctotal',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_bill',
                    label: 'Calculated Total',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: parsedBillData.total
                },
                {
                    id: 'custpage_tax',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_bill',
                    label: 'Tax Total',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: parsedBillData.charges.tax
                },
                {
                    id: 'custpage_shipping',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_bill',
                    label: 'Shipping',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: parsedBillData.charges.shipping
                },
                {
                    id: 'custpage_other',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_bill',
                    label: 'Other Charges',
                    displayType: serverWidget.FieldDisplayType.INLINE,
                    defaultValue: parsedBillData.charges.other
                }
            ];
            INV_Fields.forEach(fnAddFields);


            var varianceConfig = {
                applyTax: runtime.getCurrentScript().getParameter({ name: 'custscript_ctc_bc_tax_var' }),// ? 'T': 'F',
                applyShip: runtime.getCurrentScript().getParameter({ name: 'custscript_ctc_bc_ship_var' }),//? 'T': 'F',
                applyOther: runtime.getCurrentScript().getParameter({ name: 'custscript_ctc_bc_other_var' }) //? 'T': 'F'

            };
            log.debug(logTitle, 'varianceConfig : ' + JSON.stringify(varianceConfig));

            var billDataVariance = parsedBillData.variance || {};
            var varianceValues = {
                applyTax: billDataVariance.hasOwnProperty('applyTax') && billDataVariance.applyTax == 'T',
                tax: parseFloat(billDataVariance.tax || '0'), 

                applyShip: billDataVariance.hasOwnProperty('applyShip') && billDataVariance.applyShip == 'T',
                shipping: parseFloat(billDataVariance.shipping || '0'), 

                applyOther: billDataVariance.hasOwnProperty('applyOther') && billDataVariance.applyOther == 'T',
                other: parseFloat(billDataVariance.other || '0'), 

                applyAdjustment: billDataVariance.hasOwnProperty('applyAdjustment') && billDataVariance.applyAdjustment == 'T',
                adjustment: parseFloat(billDataVariance.adjustment || '0'), 

            };
            log.debug(logTitle, 'varianceValues : ' + JSON.stringify(parsedBillData.variance));

            var ignoreVariance =
                parsedBillData.hasOwnProperty('ignoreVariance') &&
                parsedBillData.ignoreVariance == 'T';

            var VAR_Fields = [
                {
                    id: 'custpage_variance_tax_apply',
                    type: serverWidget.FieldType.CHECKBOX,
                    container: 'fg_variance',
                    label: Helper.inArray(dataBill.status, [
                        BILL_CREATOR.Status.CLOSED,
                        BILL_CREATOR.Status.PROCESSED
                    ])
                        ? 'Applied Tax'
                        : 'Apply Tax',
                    // defaultValue: applyTax && (varianceVals.tax || deltaAmount.tax) ? 'T' : 'F',                    
                    displayType: !fnIsActive()
                        ? serverWidget.FieldDisplayType.INLINE
                        : dataBill.status != BILL_CREATOR.Status.VARIANCE
                        ? serverWidget.FieldDisplayType.HIDDEN
                        : false
                },
                {
                    id: 'custpage_variance_tax',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_variance',
                    label: 'Tax',
                    displayType:
                        !fnIsActive() || dataBill.status != BILL_CREATOR.Status.VARIANCE
                            ? serverWidget.FieldDisplayType.INLINE
                            : false,
                    // defaultValue: varianceVals.tax || deltaAmount.tax
                },
                {
                    id: 'custpage_variance_ship_apply',
                    type: serverWidget.FieldType.CHECKBOX,
                    container: 'fg_variance',
                    label: Helper.inArray(dataBill.status, [
                        BILL_CREATOR.Status.CLOSED,
                        BILL_CREATOR.Status.PROCESSED
                    ])
                        ? 'Applied Shipping'
                        : 'Apply Shipping',

                    // defaultValue:
                    //     applyShip && (varianceVals.shipping || deltaAmount.shipping) ? 'T' : 'F',
                    displayType: !fnIsActive()
                        ? serverWidget.FieldDisplayType.INLINE
                        : dataBill.status != BILL_CREATOR.Status.VARIANCE
                        ? serverWidget.FieldDisplayType.HIDDEN
                        : false
                },
                {
                    id: 'custpage_variance_shipping',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_variance',
                    label: 'Shipping',
                    displayType:
                        !fnIsActive() || dataBill.status != BILL_CREATOR.Status.VARIANCE
                            ? serverWidget.FieldDisplayType.INLINE
                            : false,
                    // defaultValue: varianceVals.shipping || deltaAmount.shipping || 0.0
                },

                {
                    id: 'custpage_variance_other_apply',
                    type: serverWidget.FieldType.CHECKBOX,
                    container: 'fg_variance',
                    label: Helper.inArray(dataBill.status, [
                        BILL_CREATOR.Status.CLOSED,
                        BILL_CREATOR.Status.PROCESSED
                    ])
                        ? 'Applied Other Charge'
                        : 'Apply Other Charge',

                    // defaultValue:
                    //     applyOther && (varianceVals.other || deltaAmount.other) ? 'T' : 'F',
                    displayType: !fnIsActive()
                        ? serverWidget.FieldDisplayType.DISABLED
                        : dataBill.status != BILL_CREATOR.Status.VARIANCE
                        ? serverWidget.FieldDisplayType.HIDDEN
                        : false
                },
                {
                    id: 'custpage_variance_other',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_variance',
                    label: 'Other Charges',
                    displayType:
                        !fnIsActive() || dataBill.status != BILL_CREATOR.Status.VARIANCE
                            ? serverWidget.FieldDisplayType.INLINE
                            : false,
                    // defaultValue: varianceVals.other || deltaAmount.other || 0.0
                },

                {
                    id: 'custpage_variance_adjustment_apply',
                    type: serverWidget.FieldType.CHECKBOX,
                    container: 'fg_variance',
                    label: Helper.inArray(dataBill.status, [
                        BILL_CREATOR.Status.CLOSED,
                        BILL_CREATOR.Status.PROCESSED
                    ])
                        ? 'Applied Adjustment'
                        : 'Apply Adjustment',

                    // defaultValue:
                    //     applyOther && (varianceVals.other || deltaAmount.other) ? 'T' : 'F',
                    displayType: !fnIsActive()
                        ? serverWidget.FieldDisplayType.DISABLED
                        : dataBill.status != BILL_CREATOR.Status.VARIANCE
                        ? serverWidget.FieldDisplayType.HIDDEN
                        : false
                },
                {
                    id: 'custpage_variance_adjustment',
                    type: serverWidget.FieldType.CURRENCY,
                    container: 'fg_variance',
                    label: 'Adjustments',
                    displayType:
                        !fnIsActive() || dataBill.status != BILL_CREATOR.Status.VARIANCE
                            ? serverWidget.FieldDisplayType.INLINE
                            : false,
                    // defaultValue: varianceVals.other || deltaAmount.other || 0.0
                }

            ];
            log.debug(logTitle, 'VAR_Fields: ' + JSON.stringify(VAR_Fields));
            VAR_Fields.forEach(fnAddFields);

            /// LINES //////////////
            var sublistLines = flexForm.addSublist({
                id: 'sublist',
                label: 'Invoice Lines',
                type: serverWidget.SublistType.LIST
            });
            var lineTaxTotal = 0,
                lineAmountTotal = 0;

            var subListFields = [
                {
                    id: 'fitem',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                }
            ];

            var applicableItems = [];

            if (!Helper.isEmpty(recPO)) {
                var fldcolItem = {
                    id: 'nsitem',
                    type: serverWidget.FieldType.SELECT,
                    label: 'NS Item',
                    displayType: fnIsActive()
                        ? serverWidget.FieldDisplayType.ENTRY
                        : serverWidget.FieldDisplayType.INLINE,
                    selectOptions: [{ value: '', text: '' }]
                };

                for (var it = 0; it < recPO.getLineCount('item'); it++) {
                    var lineItem = {
                        text: recPO.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: it
                        }),
                        value: recPO.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: it
                        })
                    };

                    fldcolItem.selectOptions.push(lineItem);
                    applicableItems.push(lineItem);
                }

                subListFields.push(fldcolItem);
            }

            subListFields.push(
                {
                    id: 'fqty',
                    label: 'Bill Quantity',
                    type: serverWidget.FieldType.CURRENCY,
                    displayType:
                        dataBill.status == BILL_CREATOR.Status.VARIANCE
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
                    id: 'frate',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Bill Rate',
                    displayType:
                        dataBill.status == BILL_CREATOR.Status.VARIANCE
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
            );

            subListFields.forEach(function (colField) {
                var fld = sublistLines.addField(colField);
                if (colField.displayType)
                    fld.updateDisplayType({
                        displayType: colField.displayType
                    });

                if (colField.totallingField) {
                    sublistLines.updateTotallingFieldId({ id: colField.id });
                }

                if (colField.selectOptions && colField.selectOptions.length) {
                    colField.selectOptions.forEach(function (selOpt) {
                        fld.addSelectOption(selOpt);
                        return true;
                    });
                }
                return true;
            });
            log.debug(logTitle, '>>> lines: ' + JSON.stringify(parsedBillData.lines));

            for (var i = 0; i < parsedBillData.lines.length; i++) {
                var linePo = {
                    amount: 0,
                    qty: 0,
                    rcv: 0
                };

                var lineValues = {
                    fitem: parsedBillData.lines[i].ITEMNO
                };

                if (parsedBillData.lines[i].NSITEM) {
                    lineValues.nsitem = parsedBillData.lines[i].NSITEM;
                }
                //
                if (lineValues.nsitem && !Helper.isEmpty(recPO)) {
                    for (var it = 0; it < recPO.getLineCount('item'); it++) {
                        var poLineData = {
                            item: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: it
                            }),
                            qty: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: it
                            }),
                            rate: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                line: it
                            }),
                            rcv: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantityreceived',
                                line: it
                            }),
                            amount: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'amount',
                                line: it
                            }),
                            taxrate1: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'taxrate1',
                                line: it
                            }),
                            taxrate2: recPO.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'taxrate2',
                                line: it
                            })
                        };
                        if (lineValues.nsitem != poLineData.item) continue;

                        poLineData.rate = parseFloat(poLineData.rate);
                        poLineData.amount = parseFloat(poLineData.amount);
                        poLineData.taxrate1 = parseFloat(poLineData.taxrate1);
                        poLineData.taxrate2 = parseFloat(poLineData.taxrate2);
                        poLineData.qty = parseInt(poLineData.qty, 10);

                        log.audit(logTitle, '>>> poLineData: ' + JSON.stringify(poLineData));

                        linePo.qty += poLineData.qty;
                        lineValues.nsqty = parseInt(linePo.qty);

                        linePo.rcv += poLineData.rcv;
                        lineValues.nsrcvd = parseInt(linePo.rcv);

                        linePo.amount += poLineData.amount;
                        lineValues.nsrate = poLineData.rate;

                        // calculate the tax
                        lineValues.nstaxamt = 0;
                        if (poLineData.taxrate1 || poLineData.taxrate2) {
                            lineValues.nstaxamt = Helper.roundOff(
                                (poLineData.taxrate1
                                    ? (poLineData.taxrate1 / 100) * poLineData.amount
                                    : 0) +
                                    (poLineData.taxrate2
                                        ? (poLineData.taxrate2 / 100) * poLineData.amount
                                        : 0)
                            );
                        }

                        lineTaxTotal += lineValues.nstaxamt;
                        lineAmountTotal +=
                            parseFloat(parsedBillData.lines[i].PRICE) *
                            parseFloat(parsedBillData.lines[i].QUANTITY);

                            // poLineData.rate * parseFloat(parsedBillData.lines[i].QUANTITY);
                    }
                }
                //
                lineValues.fqty = parsedBillData.lines[i].QUANTITY;
                lineValues.fdesc = parsedBillData.lines[i].DESCRIPTION;
                lineValues.frate = parsedBillData.lines[i].PRICE;
                lineValues.billrate = parsedBillData.lines[i].BILLRATE || parsedBillData.lines[i].PRICE;
                lineValues.famt = lineValues.frate * lineValues.fqty;

                log.debug(logTitle, '>>>>> lineValues: ' + JSON.stringify(lineValues));

                for (var fieldId in lineValues) {
                    sublistLines.setSublistValue({
                        id: fieldId,
                        value: lineValues[fieldId],
                        line: i
                    });
                }
            }

            // calculate the totals
            if (!Helper.isEmpty(recPO)) {
                var totalInvoiceAmt =
                    lineAmountTotal +
                    lineTaxTotal +
                    parsedBillData.charges.shipping +
                    parsedBillData.charges.other;

                var deltaAmount = {
                    tax: 0,
                    shipping: 0,
                    other: 0,
                    adjustment: 0
                };


                // update the totals 
                flexForm.getField({ id: 'custpage_polinetaxtotal' }).defaultValue = lineTaxTotal;
                flexForm.getField({ id: 'custpage_calctotal' }).defaultValue = totalInvoiceAmt;

                deltaAmount.tax = Helper.roundOff(
                    parseFloat(parsedBillData.charges.tax) - lineTaxTotal
                );

                // calculate the adjustment
                var totalBillAmount = parseFloat(parsedBillData.total);
                deltaAmount.adjustment = Helper.roundOff(totalBillAmount - totalInvoiceAmt);

                var varianceFields = {
                    tax: {
                        apply: flexForm.getField({ id: 'custpage_variance_tax_apply' }),
                        amount: flexForm.getField({ id: 'custpage_variance_tax' })
                    },
                    shipping: {
                        apply: flexForm.getField({ id: 'custpage_variance_ship_apply' }),
                        amount: flexForm.getField({ id: 'custpage_variance_shipping' })
                    },
                    other: {
                        apply: flexForm.getField({ id: 'custpage_variance_other_apply' }),
                        amount: flexForm.getField({ id: 'custpage_variance_other' })
                    },
                    adjustment: {
                        apply: flexForm.getField({ id: 'custpage_variance_adjustment_apply' }),
                        amount: flexForm.getField({ id: 'custpage_variance_adjustment' })
                    }
                };

                var arrNoEditStatus = [
                    BILL_CREATOR.Status.CLOSED,
                    BILL_CREATOR.Status.PROCESSED,
                    BILL_CREATOR.Status.PENDING,
                    BILL_CREATOR.Status.REPROCESS
                ];

                // apply the tax
                if (!varianceConfig.applyTax) {
                    varianceFields.tax.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    varianceFields.tax.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = 0;
                } else if (Helper.inArray(dataBill.status, arrNoEditStatus)) {
                    varianceFields.tax.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.applyTax ? 'T' : 'F';

                    varianceFields.tax.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.tax || deltaAmount.tax || 0; //varianceValues.tax;
                    
                } else {
                    // variance can be edited //
                    var amountTax = varianceValues.tax || deltaAmount.tax || 0;
                    varianceFields.tax.apply.defaultValue =
                        varianceValues.applyTax || amountTax != 0 ? 'T' : 'F';
                    varianceFields.tax.amount.defaultValue = amountTax;
                }

                if (!varianceConfig.applyShip) {
                    varianceFields.shipping.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    varianceFields.shipping.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = 0;
                } else if (Helper.inArray(dataBill.status, arrNoEditStatus)) {
                    varianceFields.shipping.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.applyShip ? 'T' : 'F';

                    varianceFields.shipping.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.shipping || deltaAmount.shipping || 0;//varianceValues.shipping;
                } else {
                    // variance can be edited //
                    var amountShip = varianceValues.shipping || deltaAmount.shipping || 0;
                    varianceFields.shipping.apply.defaultValue =
                        varianceValues.applyShip || amountShip != 0 ? 'T' : 'F';
                    varianceFields.shipping.amount.defaultValue = amountShip;
                }

                if (!varianceConfig.applyOther) {
                    varianceFields.other.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    varianceFields.other.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = 0;
                } else if (Helper.inArray(dataBill.status, arrNoEditStatus)) {
                    varianceFields.other.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.applyOther ? 'T' : 'F';

                    varianceFields.other.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.other || deltaAmount.other || 0;//varianceValues.other;
                } else {
                    // variance can be edited //
                    var amountOther = varianceValues.other || deltaAmount.other || 0;
                    varianceFields.other.apply.defaultValue =
                        varianceValues.applyOther || amountOther != 0 ? 'T' : 'F';
                    varianceFields.other.amount.defaultValue = amountOther;
                }

                if (Helper.inArray(dataBill.status, arrNoEditStatus)) {

                    varianceFields.adjustment.apply.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.applyAdjustment ? 'T' : 'F';
    
                    varianceFields.adjustment.amount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = varianceValues.adjustment || deltaAmount.adjustment || 0;//varianceValues.adjustment;

                } else {
                    // variance can be edited //
                    var amountAdjustment = varianceValues.adjustment || deltaAmount.adjustment || 0;
                    varianceFields.adjustment.apply.defaultValue =
                        varianceValues.applyAdjustment || amountAdjustment!=0 ? 'T' : 'F';

                    varianceFields.adjustment.amount.defaultValue = amountAdjustment;
                }
            }


            context.response.writePage(flexForm);
            /////////////////////////////////////////////////////////
        } else {
            //
            // POST
            /////////////////////////////////////////////////////////

            var params = JSON.parse(JSON.stringify(context.request.parameters));

            log.debug(logTitle, 'custpage_action = ' + params.custpage_action);
            // log.debug(logTitle, 'params = ' + JSON.stringify(params) );

            var updateValues = {};

            // first treat every submission as a "Save"
            for (var i = 0; i < parsedBillData.lines.length; i++) {
                parsedBillData.lines[i].NSITEM =
                    context.request.getSublistValue({
                        group: 'sublist',
                        name: 'nsitem',
                        line: i
                    }) * 1;

                parsedBillData.lines[i].PRICE =
                    context.request.getSublistValue({
                        group: 'sublist',
                        name: 'frate',
                        line: i
                    }) * 1;

                parsedBillData.lines[i].BILLRATE =
                    context.request.getSublistValue({
                        group: 'sublist',
                        name: 'billrate',
                        line: i
                    }) * 1;

                parsedBillData.lines[i].QUANTITY =
                    context.request.getSublistValue({
                        group: 'sublist',
                        name: 'fqty',
                        line: i
                    }) * 1;
            }

            // process the variance values
            var varianceValues = {
                applyTax: params.custpage_variance_tax_apply,
                tax: params.custpage_variance_tax,
                applyShip: params.custpage_variance_ship_apply,
                shipping: params.custpage_variance_shipping,
                applyOther: params.custpage_variance_other_apply,
                other: params.custpage_variance_other, 
                applyAdjustment: params.custpage_variance_adjustment_apply,
                adjustment: params.custpage_variance_adjustment, 
            };
            log.debug(logTitle, 'varianceValues = ' + JSON.stringify(varianceValues));

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
                    updateValues.custrecord_ctc_vc_bill_proc_variance = 'T';
                    varianceValues.applyTax = 'F';
                    varianceValues.applyShip = 'F';
                    varianceValues.applyOther = 'F';
                    // varianceValues.applyAdjustment = 'F';

                    parsedBillData.ignoreVariance = 'T';
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
                    log.debug('redirecting to', poId);
                    redirectToPO = true;
                    break;
                case 'fldHold':
                    updateValues.custrecord_ctc_vc_bill_proc_status = BILL_CREATOR.Status.HOLD;
                    break;
            }
            log.debug(logTitle, '>> Update Values: ' + JSON.stringify(updateValues));

            parsedBillData.variance = varianceValues;
            updateValues.custrecord_ctc_vc_bill_json = JSON.stringify(parsedBillData);

            record.submitFields({
                type: 'customrecord_ctc_vc_bills',
                id: record_id,
                values: updateValues
            });

            if (redirectToPO) {
                redirect.toRecordTransform({
                    fromId: poId,
                    fromType: record.Type.PURCHASE_ORDER,
                    toType: record.Type.VENDOR_BILL
                });
            } else {
                redirect.toSuitelet({
                    scriptId: 'customscript_ctc_vc_bill_flex_screen',
                    deploymentId: '1',
                    parameters: {
                        record_id: record_id
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
