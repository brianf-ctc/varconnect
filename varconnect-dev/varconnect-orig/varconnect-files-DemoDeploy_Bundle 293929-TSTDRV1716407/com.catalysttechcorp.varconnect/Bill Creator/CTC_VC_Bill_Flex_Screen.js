/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/log', 'N/redirect', 'N/search'],
    function(serverWidget, record, log, redirect, search) {
        function onRequest(context) {

            var record_id = context.request.parameters.record_id;

            log.debug('record_id', record_id);

            var rec = record.load({
                type: 'customrecord_ctc_vc_bills',
                id: record_id,
                isDynamic: false,
            });

            var poId = rec.getValue('custrecord_ctc_vc_bill_linked_po');

            var poRec = null;

            var poStatus = null;

            var receivedItems = [];

            if (poId) {

                poRec = record.load({
                    type: 'purchaseorder',
                    id: poId,
                    isDynamic: false,
                });

                var poStatus = poRec.getText('status');


            }

            log.debug('poId', poId);



            var data = JSON.parse(rec.getValue({
                fieldId: 'custrecord_ctc_vc_bill_json'
            }));

            if (context.request.method === 'GET') {

                var flexForm = buildForm(rec)

                context.response.writePage(flexForm);


            } else {

                //
                // POST
                //

                var params = JSON.parse(JSON.stringify(context.request.parameters));

                log.debug('custpage_action', params.custpage_action);

                // first treat every submission as a "Save"

                for (var i = 0; i < data.lines.length; i++) {
                    data.lines[i].NSITEM = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'nsitem',
                        line: i
                    }) * 1;

                    data.lines[i].PRICE = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'frate',
                        line: i
                    }) * 1;

                    data.lines[i].QUANTITY = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'fqty',
                        line: i
                    }) * 1;
                }

                // if (params.custpage_proc_variance == 'T'){
                //     data.PROCESS_VARIANCE = true;
                // }

                record.submitFields({
                    type: 'customrecord_ctc_vc_bills',
                    id: record_id,
                    values: {
                        'custrecord_ctc_vc_bill_json': JSON.stringify(data),
                        'custrecord_ctc_vc_bill_notes': params.custpage_processing_notes,
                        'custrecord_ctc_vc_bill_hold_rsn': params.custpage_hold,
                        'custrecord_ctc_vc_bill_linked_po': params.custpage_polink,
                        'custrecord_ctc_vc_bill_proc_variance': params.custpage_proc_variance
                    }
                });

                log.debug('action', params.custpage_action)

                if (params.custpage_hold && params.custpage_status !== '4') {
                    log.debug('custpage_hold', params.custpage_hold)
                    params.custpage_action = 'hold'
                } else if (!params.custpage_hold && params.custpage_status == '4') {
                    params.custpage_action = 'renew'
                }

                log.debug('action', params.custpage_action)

                // then do any other action

                switch (params.custpage_action) {

                    case 'reprocess':
                    case 'renew':

                        record.submitFields({
                            type: 'customrecord_ctc_vc_bills',
                            id: record_id,
                            values: {
                                'custrecord_ctc_vc_bill_proc_status': 4 // Reprocess
                            }
                        });
                        break;

                    case 'close':

                        record.submitFields({
                            type: 'customrecord_ctc_vc_bills',
                            id: record_id,
                            values: {
                                'custrecord_ctc_vc_bill_proc_status': 5 // Closed
                            }
                        });
                        break;

                    case 'manual':

                        log.debug('redirecting to', poId);

                        redirect.toRecordTransform({
                            fromId: poId,
                            fromType: record.Type.PURCHASE_ORDER,
                            toType: record.Type.VENDOR_BILL,
                        });

                        return;

                    case 'hold':

                        record.submitFields({
                            type: 'customrecord_ctc_vc_bills',
                            id: record_id,
                            values: {
                                'custrecord_ctc_vc_bill_proc_status': 6 // Hold
                            }
                        });
                        break;
                }

                redirect.toSuitelet({
                    scriptId: 'customscript_ctc_vc_bill_flex_screen',
                    deploymentId: '1',
                    parameters: {
                        'record_id': record_id
                    }
                });

            }

            function buildForm(rec) {

                var active = false;

                var form = serverWidget.createForm({
                    title: 'Flex Screen'
                });

                form.clientScriptModulePath = './Libraries/CTC_VC_Lib_Suitelet_Client_Script';

                var currentStatus = rec.getValue('custrecord_ctc_vc_bill_proc_status');
                var billLink = rec.getValue('custrecord_ctc_vc_bill_linked_bill');

                form.addSubmitButton({
                    label: 'Submit'
                });

                var action = form.addField({
                    id: 'custpage_action',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Action',
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });

                action.addSelectOption({
                    value: 'save',
                    text: 'Save',
                    default: true
                });

                if (currentStatus == '1' || currentStatus == '2' || currentStatus == '5' || currentStatus == '6' || currentStatus == '7') { // add actions if pending or error or closed or hold

                    active = true;

                    if (!billLink) {

                        switch (currentStatus) {

                            case '5': //closed

                                action.addSelectOption({
                                    value: 'renew',
                                    text: 'Save & Renew'
                                });

                                log.debug('poStatus', poStatus);

                                if (poStatus == 'Partially Received' || poStatus == 'Pending Billing/Partially Received' || poStatus == 'Pending Billing') {

                                    action.addSelectOption({
                                        value: 'manual',
                                        text: 'Save & Process Manually'
                                    });

                                }

                                active = false;
                                break;

                            default:

                                action.addSelectOption({
                                    value: 'close',
                                    text: 'Save & Close'
                                });

                                action.addSelectOption({
                                    value: 'reprocess',
                                    text: 'Save & Reprocess'
                                });
                        }

                    } else {
                        active = false;
                    }

                }

                form.addField({
                    id: 'custpage_ponum',
                    type: serverWidget.FieldType.TEXT,
                    label: 'PO #',
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_po');


                form.addField({
                    id: 'record_id',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Record ID'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                }).defaultValue = record_id;

                // position.layoutType = serverWidget.FieldLayoutType.NORMAL;


                var poLink = form.addField({
                    id: 'custpage_polink',
                    type: serverWidget.FieldType.SELECT,
                    source: 'transaction',
                    label: 'PO Link'
                });

                if (rec.getValue('custrecord_ctc_vc_bill_linked_po')) {

                    poLink.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    })
                }

                poLink.defaultValue = rec.getValue('custrecord_ctc_vc_bill_linked_po');

                if (poRec !== null) {

                    // source values from PO if one is linked

                    form.addField({
                        id: 'custpage_vendor',
                        type: serverWidget.FieldType.SELECT,
                        source: 'vendor',
                        label: 'PO Vendor',
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = poRec.getValue('entity');

                    form.addField({
                        id: 'custpage_postatus',
                        type: serverWidget.FieldType.TEXT,
                        label: 'PO Status',
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = poRec.getValue('status');

                    form.addField({
                        id: 'custpage_pototal',
                        type: serverWidget.FieldType.CURRENCY,
                        label: 'PO Total',
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = poRec.getValue('total');

                    form.addField({
                        id: 'custpage_polocation',
                        type: serverWidget.FieldType.TEXT,
                        label: 'PO Location',
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    }).defaultValue = poRec.getText('location');

                }

                form.addField({
                    id: 'custpage_inv',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Invoice #'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_number');

                form.addField({
                    id: 'custpage_bill_link',
                    type: serverWidget.FieldType.SELECT,
                    source: 'transaction',
                    label: 'Bill Link'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_linked_bill');

                form.addField({
                    id: 'custpage_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'Invoice Date'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_date');

                form.addField({
                    id: 'custpage_duedate',
                    type: serverWidget.FieldType.DATE,
                    label: 'Due Date'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_due_date');

                form.addField({
                    id: 'custpage_duefromfile',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Due Date from File'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = BOOLMAP[rec.getValue('custrecord_ctc_vc_bill_due_date_f_file')];

                form.addField({
                    id: 'custpage_total',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Invoice Total'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                }).defaultValue = data.total;

                form.addField({
                    id: 'custpage_tax',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Taxes'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = data.charges.tax;

                form.addField({
                    id: 'custpage_shipping',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Shipping'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = data.charges.shipping;

                form.addField({
                    id: 'custpage_other',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Other Charges'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = data.charges.other;

                form.addField({
                    id: 'custpage_status',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_statuses',
                    label: 'Status'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_proc_status');

                var processVariance = form.addField({
                    id: 'custpage_proc_variance',
                    type: serverWidget.FieldType.CHECKBOX,
                    source: 'customlist_ctc_vc_bill_statuses',
                    label: 'Process Variance'
                });

                if (currentStatus !== '7') {

                    processVariance.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.DISABLED
                    });

                };

                processVariance.defaultValue = BOOLMAP[rec.getValue('custrecord_ctc_vc_bill_proc_variance')];


                form.addField({
                    id: 'custpage_integration',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customrecord_vc_bill_vendor_config',
                    label: 'Integration'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_integration');

                var hold = form.addField({
                    id: 'custpage_hold',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customlist_ctc_vc_bill_hold_rsns',
                    label: 'Hold Reason'
                });

                if (active == false) {
                    hold.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    })
                }

                hold.defaultValue = rec.getValue('custrecord_ctc_vc_bill_hold_rsn')

                form.addField({
                    id: 'custpage_processing_notes',
                    type: serverWidget.FieldType.TEXTAREA,
                    label: 'Notes'
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_notes');

                form.addField({
                    id: 'custpage_processing_logs',
                    type: serverWidget.FieldType.LONGTEXT,
                    label: 'Processing Logs'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = rec.getValue('custrecord_ctc_vc_bill_log');

                //
                //
                // Start Sublist

                var lines = form.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Invoice Lines'
                });

                lines.addField({
                    id: 'fitem',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                });

                var applicableItems = [];

                if (poRec == null) {

                    // blocking this option for now.. should revisit

                    // lines.addField({
                    //     id: 'nitem',
                    //     type: serverWidget.FieldType.SELECT,
                    //     source: 'item',
                    //     label: 'NetSuite Item'
                    // }).updateDisplayType({
                    //     displayType: serverWidget.FieldDisplayType.ENTRY
                    // });

                } else {

                    var lineItem = lines.addField({
                        id: 'nsitem',
                        type: serverWidget.FieldType.SELECT,
                        label: 'NS Item'
                    })

                    if (active == true) {
                        lineItem.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.ENTRY
                        });
                    } else {
                        lineItem.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.INLINE
                        });
                    }

                    lineItem.addSelectOption({
                        value: '',
                        text: ''
                    });

                    for (var it = 0; it < poRec.getLineCount('item'); it++) {

                        var itemValue = poRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: it
                        });

                        var itemText = poRec.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: it
                        })

                        lineItem.addSelectOption({
                            value: poRec.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: it
                            }).toString(),
                            text: poRec.getSublistText({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: it
                            })
                        });

                        applicableItems.push({
                            value: itemValue,
                            text: itemText
                        });


                    }

                    log.debug('applicableItems', applicableItems);
                }



                var fQty = lines.addField({
                    id: 'fqty',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Quantity'
                });

                var nsQty = lines.addField({
                    id: 'nsqty',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'NS QUANTITY'
                });

                var recvQty = lines.addField({
                    id: 'nsrcvd',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'NS RECEIVED'
                });

                // var customQty = lines.addField({
                //     id: 'customqty',
                //     type: serverWidget.FieldType.INTEGER,
                //     label: 'Custom Quantity'
                // });

                lines.addField({
                    id: 'fdesc',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Description'
                });

                var fRate = lines.addField({
                    id: 'frate',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Rate'
                });

                var nsRate = lines.addField({
                    id: 'nsrate',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'NS Rate'
                });

                // var customRate = lines.addField({
                //     id: 'customrate',
                //     type: serverWidget.FieldType.CURRENCY,
                //     label: 'Custom Rate'
                // });

                lines.addField({
                    id: 'famt',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Amount'
                });

                lines.updateTotallingFieldId({
                    id: 'famt'
                });

                if (currentStatus == '7') { // variance
                    fQty.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.ENTRY
                    });
                    fRate.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.ENTRY
                    });

                } else {
                    fQty.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                    fRate.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });
                }


                for (var i = 0; i < data.lines.length; i++) {

                    var rate = 0;
                    var qty = 0;

                    var nsAmt = 0;
                    var nsQty = 0;
                    var nsRcv = 0;

                    lines.setSublistValue({
                        id: 'fitem',
                        value: data.lines[i].ITEMNO,
                        line: i
                    });

                    if (data.lines[i].hasOwnProperty('NSITEM') == true) {

                        if (data.lines[i].NSITEM !== '') {

                            lines.setSublistValue({
                                id: 'nsitem',
                                value: data.lines[i].NSITEM,
                                line: i
                            });
                        }
                    }

                    // if (data.lines[i].hasOwnProperty('CUSTOMQTY') == true) {

                    //     if (data.lines[i].CUSTOMQTY !== '') {

                    //         lines.setSublistValue({
                    //             id: 'customqty',
                    //             value: data.lines[i].CUSTOMQTY,
                    //             line: i
                    //         });
                    //     }
                    // }

                    // if (data.lines[i].hasOwnProperty('CUSTOMRATE') == true) {

                    //     if (data.lines[i].CUSTOMRATE !== '') {

                    //         lines.setSublistValue({
                    //             id: 'customrate',
                    //             value: data.lines[i].CUSTOMRATE,
                    //             line: i
                    //         });
                    //     }
                    // }

                    if (poRec !== null) {

                        log.debug('lineCount', poRec.getLineCount('item'))

                        for (var it = 0; it < poRec.getLineCount('item'); it++) {

                            if (data.lines[i].NSITEM !== '') {

                                var itId = poRec.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: it
                                });

                                if (itId == data.lines[i].NSITEM) {

                                    log.debug('matched item', data.lines[i].NSITEM)

                                    // var lineQty = poRec.getSublistValue({
                                    //     sublistId: 'item',
                                    //     fieldId: 'quantity',
                                    //     line: it
                                    // });

                                    nsQty += parseInt(poRec.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        line: it
                                    }));

                                    // lines.setSublistValue({
                                    //     id: 'nsqty',
                                    //     value: parseInt(lineQty),
                                    //     line: i
                                    // });

                                    lines.setSublistValue({
                                        id: 'nsqty',
                                        value: nsQty,
                                        line: i
                                    });

                                    nsRcv += parseInt(poRec.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantityreceived',
                                        line: it
                                    }));

                                    lines.setSublistValue({
                                        id: 'nsrcvd',
                                        value: parseInt(nsRcv || '0', 10),
                                        line: i
                                    });

                                    // var lineRate = poRec.getSublistValue({
                                    //     sublistId: 'item',
                                    //     fieldId: 'rate',
                                    //     line: it
                                    // });

                                    // lines.setSublistValue({
                                    //     id: 'nsrate',
                                    //     value: lineRate * 1,
                                    //     line: i
                                    // });

                                    var lineAmt = poRec.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'amount',
                                        line: it
                                    });

                                    nsAmt += lineAmt;

                                    lines.setSublistValue({
                                        id: 'nsrate',
                                        value: nsAmt / nsQty,
                                        line: i
                                    });

                                }
                            }
                        }

                    }

                    qty = data.lines[i].QUANTITY

                    lines.setSublistValue({
                        id: 'fqty',
                        value: qty.toFixed(0),
                        line: i
                    });

                    lines.setSublistValue({
                        id: 'fdesc',
                        value: data.lines[i].DESCRIPTION,
                        line: i
                    });

                    rate = data.lines[i].PRICE

                    lines.setSublistValue({
                        id: 'frate',
                        value: rate.toFixed(2),
                        line: i
                    });

                    lines.setSublistValue({
                        id: 'famt',
                        value: qty * rate,
                        line: i
                    });

                }

                return form;
            }
        }

        var BOOLMAP = {
            true: 'T',
            false: 'F',
            'T': true,
            'F': false
        };

        return {
            onRequest: onRequest
        };
    });