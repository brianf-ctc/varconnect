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
    '../Library/CTC_VCSP_Constants',
    '../VO/CTC_VCSP_PO'
], function (NS_CurrentRecord, NS_Format, CTC_Util, VCSP_Global, PO) {
    let Script = {};
    /** Convert vendor value value to its NetSuite equivalent  */
    Script.parseVendorValue = function (options) {
        let returnValue = options.value, // return the NetSuite-equivalent value
            apiVendor = options.apiVendor,
            type = options.type;
        if (!CTC_Util.isEmpty(returnValue)) {
            switch (type) {
                case 'DATETIME':
                case 'DATE':
                    dateValue = null;
                    switch (apiVendor) {
                        case VCSP_Global.Lists.API_VENDOR.SYNNEX:
                            dateValue = CTC_Util.parseFromSynnexDate(returnValue);
                            break;
                        case VCSP_Global.Lists.API_VENDOR.DANDH:
                            dateValue = CTC_Util.parseFromXMLDate(returnValue);
                            break;
                        case VCSP_Global.Lists.API_VENDOR.INGRAM:
                            dateValue = CTC_Util.parseFromXMLDate(returnValue);
                            break;
                        default:
                            break;
                    }
                    returnValue = dateValue;
                    break;
                case 'CHECKBOX':
                    returnValue = returnValue === false || returnValue === 'F' ? false : true;
                    break;
                default:
                    break;
            }
        }
        return returnValue;
    };
    /** Convert NetSuite field value to vendor format.  */
    Script.formatToVendorValue = function (options) {
        let returnValue = options.value, // return the vendor-equivalent value
            apiVendor = options.apiVendor + '',
            type = options.type;
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
    Script.setDefaultFieldValues = function (options) {
        let fields = options.fields,
            filterValues = options.filterValues || {},
            containerName = options.containerName,
            fieldIdMapping = options.fieldIdMapping || {
                _containers: []
            },
            record = options.record,
            purchaseOrder = options.purchaseOrder;
        let containerId = null;
        for (let x = 0, fieldCount = fields.length; x < fieldCount; x += 1) {
            let poField = fields[x],
                ignoreField = false;
            if (poField.filter) {
                for (let filterProperty in poField.filter) {
                    if (poField.filter[filterProperty] != filterValues[filterProperty]) {
                        ignoreField = true;
                        break;
                    }
                }
            }
            if (!ignoreField) {
                if (poField.fieldGroup) {
                    fieldIdMapping = Script.setDefaultFieldValues({
                        fields: poField.fields,
                        filterValues: filterValues,
                        containerName: poField.fieldGroup,
                        fieldIdMapping: fieldIdMapping,
                        record: record,
                        purchaseOrder: purchaseOrder
                    });
                } else {
                    let fieldDetails = {};
                    let containerIndex = -1;
                    if (containerName && !poField.sublist) {
                        containerIndex = fieldIdMapping._containers.indexOf(containerName);
                        if (containerIndex == -1) {
                            containerId = 'custpage_vcsp_ctc_fldgrp' + (fieldIdMapping._containers.length + 1);
                            containerIndex = fieldIdMapping._containers.push(containerName) - 1;
                        }
                    }
                    fieldDetails.id = ['custpage_vcsp_ctc_fld', containerIndex + 1, x + 1].join('_');
                    poField.fieldGroup = containerName;
                    if (poField.name) {
                        fieldIdMapping[fieldDetails.id] = poField;
                    }
                    if (
                        poField.defaultValue &&
                        typeof poField.defaultValue == 'string' &&
                        poField.defaultValue.indexOf('${record.') == 0
                    ) {
                        let fieldToRetrieve = poField.defaultValue.slice(9, -1);
                        if (fieldToRetrieve) {
                            let retrievedValue = purchaseOrder[fieldToRetrieve];
                            if (retrievedValue) {
                                let parsedValue = Script.parseVendorValue({
                                    type: fieldDetails.type,
                                    apiVendor: filterValues.apiVendor,
                                    value: retrievedValue
                                });
                                if (parsedValue) {
                                    record.setValue({
                                        fieldId: fieldDetails.id,
                                        value: parsedValue
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        return fieldIdMapping;
    };
    Script.pageInit = function (scriptContext) {
        let record = scriptContext.currentRecord;
        if (record.getValue('custpage_vcsp_ctc_ispopup') === true) {
            let line = record.getValue('custpage_vcsp_ctc_line');
            window.opener.require(
                ['N/currentRecord', '../Library/CTC_VCSP_Lib_VendorConfig'],
                function (parentRecord, libVendorConfig) {
                    try {
                        purchaseOrder = parentRecord.get();
                        let vendorDetailValuesStr = purchaseOrder.getValue(
                            VCSP_Global.Fields.Transaction.VENDOR_DETAILS
                        );
                        let vendorDetailValues = vendorDetailValuesStr ? CTC_Util.safeParse(vendorDetailValuesStr) : {};
                        if (line) {
                            let orderLine = purchaseOrder.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'line',
                                line: line
                            });
                            vendorDetailValues = vendorDetailValues[orderLine] || {};
                        }
                        let fieldsArrayStr = record.getValue('custpage_vcsp_ctc_fieldsarrstr');
                        let fieldsArr = CTC_Util.safeParse(fieldsArrayStr);
                        if (fieldsArr && fieldsArr.length) {
                            let vendorConfigId = record.getValue('custpage_vcsp_ctc_vendorconfigid'),
                                subsidiaryId = record.getValue('custpage_vcsp_ctc_subsidiary'),
                                vendorId = record.getValue('custpage_vcsp_ctc_vendor');
                            let vendorConfig = libVendorConfig.getVendorAdditionalPOFields({
                                vendorConfig: vendorConfigId,
                                vendor: vendorId,
                                subsidiary: subsidiaryId
                            });
                            let poObj = new PO(record);
                            poObj = CTC_Util.extendPO({
                                purchaseOrder: poObj,
                                vendorConfig: vendorConfig,
                                transaction: record
                            });
                            Script.setDefaultFieldValues({
                                fields: fieldsArr,
                                filterValues: {
                                    country: record.getValue('custpage_vcsp_ctc_apivendorcountry'),
                                    apiVendor: record.getValue('custpage_vcsp_ctc_apivendor')
                                },
                                record: record,
                                purchaseOrder: poObj
                            });
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
                                        continue;
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
                                    console.log('Init error= ' + setFieldErr.name + ': ' + setFieldErr.message);
                                }
                            }
                        }
                        if (sublistFields.length) {
                            for (let x = 0, lines = purchaseOrder.getLineCount('item'); x < lines; x += 1) {
                                try {
                                    if (x < record.getLineCount({ sublistId: 'custpage_vscp_ctc_sublist' })) {
                                        record.selectLine({
                                            sublistId: 'custpage_vscp_ctc_sublist',
                                            line: x
                                        });
                                    } else {
                                        record.selectNewLine({
                                            sublistId: 'custpage_vscp_ctc_sublist'
                                        });
                                    }
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
                                    console.log('Init error= ' + setLineErr.name + ': ' + setLineErr.message);
                                }
                            }
                        }
                    } finally {
                        window.ischanged = false;
                        jQuery('#vcsp_ctc_loader').css('display', 'none');
                    }
                }
            );
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
                    for (let i = 0, len = record.getLineCount('custpage_vscp_ctc_sublist'); i < len; i += 1) {
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
