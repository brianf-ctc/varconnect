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
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType ClientScript
 */
define([
    'N/currentRecord',
    'N/format',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Constants'
], function (NS_CurrentRecord, NS_Format, CTC_Util, VCSP_Global) {
    let Script = {};
    /** Convert vendor value value to its NetSuite equivalent  */
    Script.parseVendorValue = function (option) {
        let returnValue = option.value,
            apiVendor = option.apiVendor + '',
            type = option.type;
        if (!CTC_Util.isEmpty(returnValue)) {
            switch (type) {
                case 'DATETIME':
                case 'DATE':
                    switch (apiVendor) {
                        case VCSP_Global.Lists.API_VENDOR.SYNNEX:
                            returnValue = CTC_Util.parseFromSynnexDate(returnValue);
                            break;
                        case VCSP_Global.Lists.API_VENDOR.DANDH:
                        case VCSP_Global.Lists.API_VENDOR.INGRAM:
                            returnValue = CTC_Util.parseFromXMLDate(returnValue);
                            break;
                        default:
                            break;
                    }
                    break;
                case 'CHECKBOX':
                    returnValue = !(returnValue === 'F' || returnValue === false);
                    break;
                default:
                    break;
            }
        }
        return returnValue;
    };
    /** Convert NetSuite field value to vendor format.  */
    Script.formatToVendorValue = function (option) {
        let returnValue = option.value, // return the vendor-equivalent value
            apiVendor = option.apiVendor + '',
            type = option.type;
        if (!CTC_Util.isEmpty(returnValue)) {
            switch (type) {
                case 'DATE':
                    let dateValue = NS_Format.parse({
                        value: returnValue,
                        type: NS_Format.Type.DATE
                    });
                    switch (apiVendor) {
                        case VCSP_Global.Lists.API_VENDOR.SYNNEX:
                            returnValue = CTC_Util.formatToSynnexDate(dateValue);
                            break;
                        case VCSP_Global.Lists.API_VENDOR.DANDH:
                        case VCSP_Global.Lists.API_VENDOR.INGRAM:
                            returnValue = CTC_Util.formatToXMLDate(dateValue);
                            break;
                        default:
                            break;
                    }
                    break;
                case 'CHECKBOX':
                    returnValue = !(returnValue === 'F' || returnValue === false);
                    break;
                default:
                    break;
            }
        }
        return returnValue;
    };
    Script.pageInit = function (scriptContext) {
        let record = scriptContext.currentRecord;
        if (record.getValue('custpage_vcsp_ctc_ispopup') === true) {
            let line = record.getValue('custpage_vcsp_ctc_line');
            window.opener.require(['N/currentRecord'], function (parentRecord) {
                try {
                    purchaseOrder = parentRecord.get();
                    let vendorDetailValuesStr = purchaseOrder.getValue(
                        VCSP_Global.Fields.Transaction.VENDOR_DETAILS
                    );
                    let vendorDetailValues = vendorDetailValuesStr
                        ? CTC_Util.safeParse(vendorDetailValuesStr)
                        : {};
                    if (line) {
                        let orderLine = purchaseOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'line',
                            line: line
                        });
                        vendorDetailValues = vendorDetailValues[orderLine] || {};
                    }
                    let fieldsListStr = record.getValue('custpage_vcsp_ctc_fieldslist');
                    let fieldMapping = null;
                    let sublistFields = [];
                    if (fieldsListStr) {
                        fieldMapping = JSON.parse(fieldsListStr);
                    }
                    let apiVendor = record.getValue('custpage_vcsp_ctc_apivendor');
                    if (fieldMapping) {
                        for (let suiteletFieldId in fieldMapping) {
                            try {
                                let key = fieldMapping[suiteletFieldId].name;
                                let fieldType = fieldMapping[suiteletFieldId].type;
                                let sublist = fieldMapping[suiteletFieldId].sublist;
                                let splitValues = fieldMapping[suiteletFieldId].split;
                                let value = vendorDetailValues[key];
                                if (sublist) {
                                    sublistFields.push(suiteletFieldId);
                                }
                                value = Script.parseVendorValue({
                                    value: value,
                                    type: fieldType,
                                    apiVendor: apiVendor
                                });
                                if (!CTC_Util.isEmpty(value)) {
                                    if (splitValues && util.isArray(value)) {
                                        value = value.join('\r\n');
                                    }
                                    record.setValue({
                                        fieldId: suiteletFieldId,
                                        value: value
                                    });
                                }
                            } catch (setFieldErr) {
                                console.log(
                                    'Init error= ' + setFieldErr.name + ': ' + setFieldErr.message
                                );
                            }
                        }
                    }
                    if (sublistFields.length) {
                        for (
                            let x = 0, lines = purchaseOrder.getLineCount('item');
                            x < lines;
                            x += 1
                        ) {
                            try {
                                record.selectLine({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    line: x
                                });
                                record.setCurrentSublistValue({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_item',
                                    value: purchaseOrder.getSublistText({
                                        sublistId: 'item',
                                        fieldId: 'item',
                                        line: x
                                    })
                                });
                                record.setCurrentSublistValue({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_rate',
                                    value: purchaseOrder.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        line: x
                                    })
                                });
                                record.setCurrentSublistValue({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_desc',
                                    value: purchaseOrder.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'description',
                                        line: x
                                    })
                                });
                                record.getSublistField({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_item',
                                    line: x
                                }).isDisabled = true;
                                record.getSublistField({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_desc',
                                    line: x
                                }).isDisabled = true;
                                record.getSublistField({
                                    sublistId: 'custpage_vscp_ctc_sublist',
                                    fieldId: 'custpage_vscp_ctc_item_rate',
                                    line: x
                                });
                                if (fieldMapping) {
                                    for (let y = 0, rows = sublistFields.length; y < rows; y += 1) {
                                        let suiteletFieldId = sublistFields[y];
                                        let key = fieldMapping[suiteletFieldId].name;
                                        let fieldType = fieldMapping[suiteletFieldId].type;
                                        let lineValues = vendorDetailValues[key];
                                        let value = null;
                                        if (lineValues && lineValues[x]) {
                                            value = Script.parseVendorValue({
                                                value: lineValues[x],
                                                type: fieldType,
                                                apiVendor: apiVendor
                                            });
                                        }
                                        if (!CTC_Util.isEmpty(value)) {
                                            record.setCurrentSublistValue({
                                                sublistId: 'custpage_vscp_ctc_sublist',
                                                fieldId: suiteletFieldId,
                                                value: value
                                            });
                                        }
                                    }
                                }
                            } catch (setLineErr) {
                                console.log(
                                    'Init error= ' + setLineErr.name + ': ' + setLineErr.message
                                );
                            }
                        }
                    }
                } finally {
                    window.ischanged = false;
                    jQuery('#vcsp_ctc_loader').css('display', 'none');
                }
            });
        }
    };
    Script.saveRecord = function (scriptContext) {
        jQuery('#vcsp_ctc_loader__msg').text('Saving');
        jQuery('#vcsp_ctc_loader').css('display', 'flex');
        return true;
    };
    Script.submit = function (options) {
        let line = options.line,
            record = NS_CurrentRecord.get(),
            fieldsListStr = record.getValue('custpage_vcsp_ctc_fieldslist'),
            fieldMapping = null,
            returnValue = null;
        if (fieldsListStr) {
            fieldMapping = JSON.parse(fieldsListStr);
        }
        let apiVendor = record.getValue('custpage_vcsp_ctc_apivendor');
        if (fieldMapping) {
            let values = {};
            for (let suiteletFieldId in fieldMapping) {
                let key = fieldMapping[suiteletFieldId].name;
                let fieldType = fieldMapping[suiteletFieldId].type;
                let sublist = fieldMapping[suiteletFieldId].sublist;
                let splitValues = fieldMapping[suiteletFieldId].split;
                let value = null;
                if (sublist) {
                    value = [];
                    for (
                        let i = 0, len = record.getLineCount('custpage_vscp_ctc_sublist');
                        i < len;
                        i += 1
                    ) {
                        let lineValue = Script.formatToVendorValue({
                            value: record.getSublistValue({
                                sublistId: 'custpage_vscp_ctc_sublist',
                                fieldId: suiteletFieldId,
                                line: i
                            }),
                            type: fieldType,
                            apiVendor: apiVendor
                        });
                        if (lineValue) {
                            value.push(lineValue);
                        }
                        // set PO rates
                        let lineRate = record.getSublistValue({
                            sublistId: 'custpage_vscp_ctc_sublist',
                            fieldId: 'custpage_vscp_ctc_item_rate',
                            line: i
                        });
                        let j = i + 1;
                        window.opener.nlapiSetLineItemValue('item', 'rate', j, lineRate);
                        window.opener.nlapiSetLineItemValue(
                            'item',
                            'amount',
                            j,
                            lineRate * window.opener.nlapiGetLineItemValue('item', 'quantity', j)
                        );
                    }
                    if (value.length) {
                        window.opener.nlapiRefreshLineItems('item'); // repaint item sublist
                    }
                    values[key] = value;
                } else {
                    value = Script.formatToVendorValue({
                        value: record.getValue(suiteletFieldId),
                        type: fieldType,
                        apiVendor: apiVendor
                    });
                    if (value) {
                        if (splitValues) {
                            value = value.split(/[\s,]+/);
                        }
                        values[key] = value;
                    }
                }
            }
            window.opener.require(['N/currentRecord'], function (parentRecord) {
                let order = parentRecord.get();
                if (line) {
                    let currentValue = order.getValue({
                        fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS
                    });
                    if (currentValue) {
                        currentValue = CTC_Util.safeParse(currentValue);
                    } else {
                        currentValue = {};
                    }
                    let orderLine = order.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        line: line
                    });
                    currentValue[orderLine] = values;
                    values = currentValue;
                }
                order.setValue({
                    fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS,
                    value: JSON.stringify(values)
                });
                window.ischanged = false;
                window.close();
            });
        }
    };
    Script.back = function () {
        history.back();
    };
    Script.close = function () {
        window.close();
    };
    return Script;
});
