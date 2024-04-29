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
 * @NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/record',
    'N/format',
    'N/redirect',
    'N/render',
    '../Library/CTC_VCSP_Lib_LicenseValidator',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_VCSP_Lib_VendorConfig',
    '../VO/CTC_VCSP_PO'
], function (
    NS_ServerWidget,
    NS_Record,
    NS_Format,
    NS_Redirect,
    NS_Render,
    libLicenseValidator,
    CTC_Util,
    VCSP_Global,
    libVendorConfig,
    PO
) {
    let LogTitle = 'VCSP:FormPopup';
    let Helper = {};
    Helper.parseVendorValue = function (option) {
        let logTitle = [LogTitle, 'parseVendorValue'].join(':'),
            returnValue = option.value, // return the NetSuite-equivalent value
            apiVendor = option.apiVendor,
            type = option.type;
        log.debug(logTitle, JSON.stringify(option));
        if (!CTC_Util.isEmpty(returnValue)) {
            let dateFormat = null;
            switch (type) {
                case 'DATETIME':
                    dateFormat = NS_Format.Type.DATETIME;
                case 'DATE':
                    dateFormat = dateFormat || NS_Format.Type.DATE;
                    let dateValue = null;
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
                    if (!CTC_Util.isEmpty(dateValue)) {
                        returnValue = NS_Format.format({
                            value: dateValue,
                            type: dateFormat
                        });
                    }
                    break;
                case 'CHECKBOX':
                    returnValue = returnValue === false || returnValue === 'F' ? 'F' : 'T';
                    break;
                default:
                    break;
            }
        }
        return returnValue;
    };
    Helper.formatToVendorValue = function (option) {
        let returnValue = option.value, // return the vendor-equivalent value
            apiVendor = option.apiVendor,
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
                            returnValue = CTC_Util.formatToXMLDate(dateValue);
                            break;
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
    Helper.addFields = function (option) {
        let logTitle = [LogTitle, 'addFields'].join(':'),
            form = option.form,
            fields = option.fields,
            defaultValues = option.defaultValues || {},
            filterValues = option.filterValues || {},
            containerName = option.containerName,
            fieldIdMapping = option.fieldIdMapping || {
                _containers: []
            },
            record = option.record,
            sublist = option.sublist,
            lineCount = option.lineCount;
        CTC_Util.log('DEBUG', logTitle, JSON.stringify(fieldIdMapping));
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
                    fieldIdMapping = Helper.addFields({
                        form: form,
                        fields: poField.fields,
                        defaultValues: defaultValues,
                        filterValues: filterValues,
                        containerName: poField.fieldGroup,
                        fieldIdMapping: fieldIdMapping,
                        record: record,
                        sublist: sublist,
                        lineCount: lineCount
                    });
                } else {
                    let parent = form;
                    let fieldDetails = {};
                    fieldDetails.label = poField.label;
                    fieldDetails.type = poField.type;
                    if (fieldDetails.type == 'RESETBUTTON') {
                        fieldDetails.type = 'INLINEHTML';
                        poField.isResetButton = true;
                    }
                    if (poField.source) {
                        fieldDetails.source = poField.source;
                    }
                    let containerIndex = -1;
                    if (containerName && !poField.sublist) {
                        containerIndex = fieldIdMapping._containers.indexOf(containerName);
                        if (containerIndex == -1) {
                            containerId =
                                'custpage_vcsp_ctc_fldgrp' +
                                (fieldIdMapping._containers.length + 1);
                            let fldGroupObj = form.addFieldGroup({
                                id: containerId,
                                label: containerName
                            });
                            containerIndex = fieldIdMapping._containers.push(containerName) - 1;
                        }
                        if (containerId) {
                            fieldDetails.container = containerId;
                        }
                    }
                    fieldDetails.id = ['custpage_vcsp_ctc_fld', containerIndex + 1, x + 1].join(
                        '_'
                    );
                    poField.fieldGroup = containerName;
                    if (poField.name) {
                        fieldIdMapping[fieldDetails.id] = poField;
                    }
                    if (poField.sublist) {
                        if (!sublist) {
                            let columnDisplayType = NS_ServerWidget.FieldDisplayType.ENTRY;
                            if (record) columnDisplayType = NS_ServerWidget.FieldDisplayType.INLINE;
                            sublist = form.addSublist({
                                id: 'custpage_vcsp_ctc_sublist',
                                label: 'Items',
                                type: NS_ServerWidget.SublistType.LIST
                            });
                            let itemColumn = sublist.addField({
                                id: 'custpage_vcsp_ctc_item_item',
                                label: 'Item',
                                type: NS_ServerWidget.FieldType.TEXT
                            });
                            let descriptionColumn = sublist.addField({
                                id: 'custpage_vcsp_ctc_item_desc',
                                label: 'Description',
                                type: NS_ServerWidget.FieldType.TEXTAREA
                            });
                            let rateColumn = sublist.addField({
                                id: 'custpage_vcsp_ctc_item_rate',
                                label: 'Rate',
                                type: NS_ServerWidget.FieldType.CURRENCY
                            });
                            if (columnDisplayType) {
                                itemColumn.updateDisplayType({
                                    displayType: columnDisplayType
                                });
                                itemColumn.maxLength = 20;
                                descriptionColumn.updateDisplayType({
                                    displayType: columnDisplayType
                                });
                            }
                            rateColumn.updateDisplayType({
                                displayType: NS_ServerWidget.FieldDisplayType.ENTRY
                            });
                            if (record) {
                                for (
                                    let i = 0, len = record.getLineCount('item');
                                    i < len;
                                    i += 1
                                ) {
                                    let item = record.getSublistText({
                                            sublistId: 'item',
                                            fieldId: 'item',
                                            line: i
                                        }),
                                        rate = record.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'rate',
                                            line: i
                                        }),
                                        description = record.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'description',
                                            line: i
                                        });
                                    if (item) {
                                        sublist.setSublistValue({
                                            id: 'custpage_vcsp_ctc_item_item',
                                            line: i,
                                            value: item
                                        });
                                        if (rate) {
                                            sublist.setSublistValue({
                                                id: 'custpage_vcsp_ctc_item_rate',
                                                line: i,
                                                value: rate
                                            });
                                        }
                                        if (description) {
                                            sublist.setSublistValue({
                                                id: 'custpage_vcsp_ctc_item_desc',
                                                line: i,
                                                value: description
                                            });
                                        }
                                    }
                                }
                            } else if (lineCount) {
                                // initialize the same number of lines
                                for (let i = 0; i < lineCount; i += 1) {
                                    sublist.setSublistValue({
                                        id: 'custpage_vcsp_ctc_item_desc',
                                        line: i,
                                        value: ' '
                                    });
                                }
                            }
                        }
                        parent = sublist;
                    }
                    log.debug(
                        logTitle,
                        ['Adding', poField.name, 'field ~', JSON.stringify(fieldDetails)].join(' ')
                    );
                    let fieldObj = parent.addField(fieldDetails);
                    if (sublist) {
                        fieldObj.updateDisplayType({
                            displayType: NS_ServerWidget.FieldDisplayType.ENTRY
                        });
                    }
                    if (poField.defaultValue) {
                        let parsedValue = Helper.parseVendorValue({
                            type: fieldDetails.type,
                            apiVendor: filterValues.apiVendor,
                            value: poField.defaultValue
                        });
                        if (poField.sublist) {
                            for (let i = 0; i < lineCount; i += 1) {
                                sublist.setSublistValue({
                                    id: poField.id,
                                    line: i,
                                    value: parsedValue
                                });
                            }
                        } else {
                            fieldObj.defaultValue = parsedValue;
                        }
                    }
                    if (poField.isResetButton) {
                        fieldObj.defaultValue = `<span class="smallgraytext uir-label">
                                <span class="labelSpanEdit smallgraytextnolink">${poField.label}</span>&nbsp;&nbsp;
                                <span class='uir-field inputreadonly'>
                                    <a class='smalltext' href='#' title='Reset' onclick='require(["N/currentRecord"], function(ns_currentRecord) {
                                        let record = ns_currentRecord.get();
                                        let fieldsListStr = record.getValue("custpage_vcsp_ctc_fieldslist");
                                        let fieldMapping = null;
                                        if (fieldsListStr) {
                                            fieldMapping = JSON.parse(fieldsListStr);
                                        }
                                        for (let suiteletFieldId in fieldMapping) {
                                            let fieldGroup = fieldMapping[suiteletFieldId].fieldGroup;
                                            if (fieldGroup == "${containerName}") {
                                                let sublist = fieldMapping[suiteletFieldId].sublist;
                                                if (sublist) {
                                                    for (let i = 0, len = record.getLineCount("custpage_vscp_ctc_sublist"); i < len; i += 1) {
                                                        let newValue = null;
                                                        switch (record.getSublistField({
                                                            sublistId: "custpage_vscp_ctc_sublist",
                                                            fieldId: suiteletFieldId,
                                                            line: 0
                                                        }).type) {
                                                            case "${NS_Format.Type.CHECKBOX}":
                                                                newValue = false;
                                                                break;
                                                            case "${NS_Format.Type.CURRENCY}":
                                                                newValue = "";
                                                                break;
                                                            default:
                                                                break;
                                                        }
                                                        record.setSublistValue({
                                                            sublistId: "custpage_vscp_ctc_sublist",
                                                            fieldId: suiteletFieldId,
                                                            line: i,
                                                            value: newValue
                                                        });
                                                    }
                                                } else {
                                                    let newValue = null;
                                                    switch (record.getField({ fieldId: suiteletFieldId }).type) {
                                                        case "${NS_Format.Type.CHECKBOX}":
                                                            newValue = false;
                                                            break;
                                                        case "${NS_Format.Type.CURRENCY}":
                                                            newValue = "";
                                                            break;
                                                        default:
                                                            break;
                                                    }
                                                    record.setValue({
                                                        fieldId: suiteletFieldId,
                                                        value: newValue
                                                    });
                                                }
                                            }
                                        }
                                    });
                                    return false'>Clear ${containerName} Fields</a></span></span>`;
                    }
                    if (poField.help) {
                        fieldObj.setHelpText({ help: poField.help });
                    }
                    let vendorDtlValue = defaultValues[poField.name];
                    switch (fieldDetails.type) {
                        case NS_ServerWidget.FieldType.LABEL:
                            fieldObj.updateLayoutType({
                                layoutType: NS_ServerWidget.FieldLayoutType.OUTSIDEABOVE
                            });
                        case NS_ServerWidget.FieldType.INLINEHTML:
                            fieldObj.updateLayoutType({
                                layoutType: NS_ServerWidget.FieldLayoutType.OUTSIDEABOVE
                            });
                            break;
                        default:
                            break;
                    }
                    if (!CTC_Util.isEmpty(vendorDtlValue)) {
                        if (poField.sublist) {
                            for (let i = 0, len = vendorDtlValue.length; i < len; i += 1) {
                                let parsedValue = Helper.parseVendorValue({
                                    type: fieldDetails.type,
                                    apiVendor: filterValues.apiVendor,
                                    value: vendorDtlValue[i]
                                });
                                sublist.setSublistValue({
                                    id: fieldDetails.id,
                                    line: i,
                                    value: parsedValue
                                });
                            }
                        } else {
                            if (poField.split && util.isArray(vendorDtlValue)) {
                                vendorDtlValue = vendorDtlValue.join('\r\n');
                            } else {
                                vendorDtlValue = Helper.parseVendorValue({
                                    type: fieldDetails.type,
                                    apiVendor: filterValues.apiVendor,
                                    value: vendorDtlValue
                                });
                            }
                            fieldObj.defaultValue = vendorDtlValue;
                        }
                    }
                    if (
                        fieldDetails.type == NS_ServerWidget.FieldType.SELECT &&
                        poField.options &&
                        poField.options.length
                    ) {
                        for (
                            let y = 0, dropdownCount = poField.options.length;
                            y < dropdownCount;
                            y += 1
                        ) {
                            let selectOption = poField.options[y];
                            if (
                                selectOption.text !== undefined &&
                                selectOption.value !== undefined
                            ) {
                                if (vendorDtlValue) {
                                    selectOption.isSelected = false;
                                }
                                if (vendorDtlValue == selectOption.value) {
                                    selectOption.isSelected = true;
                                }
                                fieldObj.addSelectOption(selectOption);
                            }
                        }
                    }
                }
            }
        }
        return fieldIdMapping;
    };
    let SuiteletScript = {
        onRequest: function (context) {
            let logTitle = [LogTitle, 'onRequest'].join(':'),
                vendorConfigId =
                    context.request.parameters.vendorConfigId ||
                    context.request.parameters.custpage_vcsp_ctc_vendorconfigid,
                subsidiaryId =
                    context.request.parameters.subsidiaryId ||
                    context.request.parameters.custpage_vcsp_ctc_subsidiary,
                vendorId =
                    context.request.parameters.vendorId ||
                    context.request.parameters.custpage_vcsp_ctc_vendor,
                title =
                    context.request.parameters.title ||
                    context.request.parameters.custpage_vcsp_ctc_title,
                poid =
                    context.request.parameters.poid ||
                    context.request.parameters.custpage_vcsp_ctc_poid,
                linesStr =
                    context.request.parameters.lines ||
                    context.request.parameters.custpage_vcsp_ctc_lines,
                arrLines = null,
                lineCount = context.request.parameters.lineCount,
                line = context.request.parameters.custpage_vcsp_ctc_line,
                prompt = context.request.parameters.prompt,
                record = null,
                vendorDetailValues = null,
                closeWindow = true,
                vendorConfig = libVendorConfig.getVendorAdditionalPOFields({
                    vendorConfig: vendorConfigId,
                    vendor: vendorId,
                    subsidiary: subsidiaryId
                });
            CTC_Util.log('AUDIT', logTitle, 'Vendor=' + JSON.stringify(vendorConfig));
            // check for valid license
            if (!libLicenseValidator.isLicenseValid()) {
                log.audit(logTitle, 'Inactive license key.');
                return;
            }
            if (linesStr) {
                arrLines = CTC_Util.safeParse(linesStr);
                lineCount = arrLines.length;
            }
            if (vendorConfig) {
                if (context.request.method == 'POST' && poid) {
                    record = NS_Record.load({
                        type: NS_Record.Type.PURCHASE_ORDER,
                        id: poid,
                        isDynamic: false
                    });
                    closeWindow = false;
                    let fieldsListStr = context.request.parameters.custpage_vcsp_ctc_fieldslist;
                    let fieldMapping = null;
                    if (fieldsListStr) {
                        fieldMapping = CTC_Util.safeParse(fieldsListStr);
                    }
                    if (fieldMapping) {
                        let values = {};
                        for (let suiteletFieldId in fieldMapping) {
                            let propertyName = fieldMapping[suiteletFieldId].name;
                            let fieldType = fieldMapping[suiteletFieldId].type;
                            let sublist = fieldMapping[suiteletFieldId].sublist;
                            let splitValues = fieldMapping[suiteletFieldId].split;
                            let value = null;
                            if (sublist) {
                                value = [];
                                log.debug(
                                    logTitle,
                                    'Sublist lines=' +
                                        context.request.getLineCount({
                                            group: 'custpage_vcsp_ctc_sublist'
                                        })
                                );
                                for (
                                    let i = 0,
                                        len = context.request.getLineCount({
                                            group: 'custpage_vcsp_ctc_sublist'
                                        });
                                    i < len;
                                    i += 1
                                ) {
                                    let lineValue = Helper.formatToVendorValue({
                                        value: context.request.getSublistValue({
                                            group: 'custpage_vcsp_ctc_sublist',
                                            line: i,
                                            name: suiteletFieldId
                                        }),
                                        type: fieldType,
                                        apiVendor: vendorConfig.apiVendor
                                    });
                                    value.push(lineValue);
                                    // set PO rates
                                    let lineRate = context.request.getSublistValue({
                                        group: 'custpage_vcsp_ctc_sublist',
                                        line: i,
                                        name: 'custpage_vcsp_ctc_item_rate'
                                    });
                                    log.debug(
                                        logTitle,
                                        '@' +
                                            i +
                                            ': rate, value=' +
                                            lineRate +
                                            ', ' +
                                            JSON.stringify(value)
                                    );
                                    record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        line: i,
                                        value: lineRate
                                    });
                                    record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'amount',
                                        line: i,
                                        value:
                                            lineRate *
                                            record.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'quantity',
                                                line: i
                                            })
                                    });
                                }
                                if (value.length) {
                                    values[propertyName] = value;
                                }
                            } else {
                                value = Helper.formatToVendorValue({
                                    value: context.request.parameters[suiteletFieldId],
                                    type: fieldType,
                                    apiVendor: vendorConfig.apiVendor
                                });
                                if (!CTC_Util.isEmpty(value)) {
                                    if (splitValues) {
                                        value = value.split(/[\s,]+/);
                                    }
                                    values[propertyName] = value;
                                }
                            }
                        }
                        let additionalFieldValues = JSON.stringify(values);
                        record.setValue({
                            fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS,
                            value: additionalFieldValues
                        });
                        CTC_Util.log(
                            'AUDIT',
                            logTitle,
                            [
                                'Submitted PO (id=',
                                record.save({
                                    enablesourcing: false,
                                    ignoreMandatoryFields: true
                                }),
                                ') with additional field values: ',
                                additionalFieldValues
                            ].join('')
                        );
                        NS_Redirect.toRecord({
                            isEditMode: false,
                            id: poid,
                            type: NS_Record.Type.PURCHASE_ORDER
                        });
                    }
                } else if (title) {
                    let form = NS_ServerWidget.createForm({
                        title: title,
                        hideNavBar: true
                    });
                    if (line && vendorId) {
                        form.addFieldGroup({
                            id: 'custpage_vcsp_ctc_selectioninfo',
                            label: 'Selected line and vendor'
                        });
                        if (lineCount) {
                            let lineFld = form.addField({
                                id: 'custpage_vcsp_ctc_line',
                                label: 'Line',
                                type: NS_ServerWidget.FieldType.SELECT,
                                container: 'custpage_vcsp_ctc_selectioninfo'
                            });
                            lineFld.addSelectOption({
                                text: ['Line ', +line + 1, ': ', arrLines[line]].join(''),
                                value: line,
                                isSelected: true
                            });
                            lineFld.updateDisplayType({
                                displayType: NS_ServerWidget.FieldDisplayType.INLINE
                            });
                        }
                        let vendorData = CTC_Util.flatLookup({
                            type: NS_Record.Type.VENDOR,
                            id: vendorId,
                            columns: ['entityid']
                        });
                        if (vendorData && vendorData.entityid) {
                            let vendorFld = form.addField({
                                id: 'custpage_vcsp_ctc_vendor',
                                label: 'Vendor',
                                type: NS_ServerWidget.FieldType.TEXT,
                                container: 'custpage_vcsp_ctc_selectioninfo'
                            });
                            vendorFld.defaultValue = vendorData.entityid;
                            vendorFld.updateDisplayType({
                                displayType: NS_ServerWidget.FieldDisplayType.INLINE
                            });
                        }
                    }
                    if (poid) {
                        try {
                            record = NS_Record.load({
                                type: NS_Record.Type.PURCHASE_ORDER,
                                id: poid,
                                isDynamic: false
                            });
                        } catch (poErr) {
                            NS_Redirect.toRecord({
                                isEditMode: false,
                                id: poid,
                                type: NS_Record.Type.PURCHASE_ORDER
                            });
                        }
                        if (record) {
                            let vendorDetailValuesStr = record.getValue(
                                VCSP_Global.Fields.Transaction.VENDOR_DETAILS
                            );
                            vendorDetailValues = vendorDetailValuesStr
                                ? CTC_Util.safeParse(vendorDetailValuesStr)
                                : null;
                            CTC_Util.log(
                                'AUDIT',
                                logTitle,
                                'Field values=' + JSON.stringify(vendorDetailValues)
                            );
                        }
                    } else {
                        let isPopupFld = form.addField({
                            id: 'custpage_vcsp_ctc_ispopup',
                            label: 'Pop-up',
                            type: NS_ServerWidget.FieldType.CHECKBOX
                        });
                        isPopupFld.defaultValue = 'T';
                        isPopupFld.updateDisplayType({
                            displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                        });
                    }
                    let apiVendorFld = form.addField({
                        id: 'custpage_vcsp_ctc_apivendor',
                        label: 'API Vendor',
                        type: NS_ServerWidget.FieldType.INTEGER
                    });
                    apiVendorFld.updateDisplayType({
                        displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                    });
                    apiVendorFld.defaultValue = vendorConfig.apiVendor;
                    let fieldsArrayFld = form.addField({
                        id: 'custpage_vcsp_ctc_fieldsarrstr',
                        label: 'Fields',
                        type: NS_ServerWidget.FieldType.LONGTEXT
                    });
                    fieldsArrayFld.updateDisplayType({
                        displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                    });
                    let fieldsArrayStr = vendorConfig.additionalPOFields;
                    CTC_Util.log('AUDIT', logTitle, 'Fields=' + fieldsArrayStr);
                    fieldsArrayFld.defaultValue = fieldsArrayStr;
                    if (fieldsArrayStr) {
                        if (record) {
                            var templateRenderer = NS_Render.create();
                            templateRenderer.templateContent = fieldsArrayStr;
                            templateRenderer.addCustomDataSource({
                                format: NS_Render.DataSource.OBJECT,
                                alias: 'record',
                                data: new PO(record)
                            });
                            fieldsArrayStr = templateRenderer.renderAsString();
                        }
                        let fieldsArr = CTC_Util.safeParse(fieldsArrayStr);
                        if (fieldsArr && fieldsArr.length) {
                            closeWindow = false;
                            let fieldIdMapping = Helper.addFields({
                                form: form,
                                fields: fieldsArr,
                                defaultValues: vendorDetailValues,
                                filterValues: {
                                    country: vendorConfig.country,
                                    apiVendor: vendorConfig.apiVendor
                                },
                                record: record,
                                lineCount: lineCount
                            });
                            CTC_Util.log(
                                'AUDIT',
                                logTitle,
                                'Field mapping=' + JSON.stringify(fieldIdMapping)
                            );
                            let fieldsListFld = form.addField({
                                id: 'custpage_vcsp_ctc_fieldslist',
                                label: 'List of Field IDs',
                                type: NS_ServerWidget.FieldType.LONGTEXT
                            });
                            fieldsListFld.defaultValue = JSON.stringify(fieldIdMapping);
                            fieldsListFld.updateDisplayType({
                                displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                            });
                            let vendorConfigFld = form.addField({
                                id: 'custpage_vcsp_ctc_vendorconfigid',
                                label: 'Vendor Config Id',
                                type: NS_ServerWidget.FieldType.TEXT
                            });
                            vendorConfigFld.defaultValue = vendorConfigId;
                            vendorConfigFld.updateDisplayType({
                                displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                            });
                            form.clientScriptModulePath = './CTC_VCSP_CS_FormPopup.js';
                            let customClientScriptFunctions = form.addField({
                                id: 'custpage_vcsp_clientscript',
                                label: ' ',
                                type: NS_ServerWidget.FieldType.INLINEHTML
                            });
                            let loaderFld = form.addField({
                                id: 'custpage_vcsp_ctc_loader',
                                label: 'Loading',
                                type: NS_ServerWidget.FieldType.INLINEHTML
                            });
                            if (poid) {
                                let poidFld = form.addField({
                                    id: 'custpage_vcsp_ctc_poid',
                                    label: 'Purchase Order Id',
                                    type: NS_ServerWidget.FieldType.TEXT
                                });
                                poidFld.defaultValue = poid;
                                poidFld.updateDisplayType({
                                    displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                                });
                                form.addSubmitButton({
                                    label: 'Submit'
                                });
                                form.addButton({
                                    id: 'custpage_vcsp_ctc_cancel',
                                    label: 'Cancel',
                                    functionName: 'back'
                                });
                                loaderFld.defaultValue = `<div id="vcsp_ctc_loader"
                                            style="display: none; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%;
                                            height: 100%; z-index: 900; overflow: hidden; text-align: center; background-color: rgba(255, 255, 255, 0.85);
                                            color: #006600; border-radius: 5px;">
                                        <div style="display: inline-flex; flex-direction: column; justify-content: center; align-items: center;">
                                            <div style="width: 32px; height: 32px; align-self: center;">
                                                <svg viewBox="-18 -18 36 36" role="img" aria-label="Loading"
                                                        style="-webkit-animation: spin 2s ease infinite; -moz-animation: spin 2s ease infinite; animation: spin 2s ease infinite;">
                                                    <circle fill="none" r="16" style="stroke: #dfe4eb; stroke-width: 3px;"></circle>
                                                    <circle fill="none" r="16" style="stroke: #998260; stroke-width: 3px; stroke-dashoffset: 75;"
                                                            transform="rotate(-135)" stroke-dasharray="100"></circle>
                                                </svg>
                                            </div>
                                            <span id="vcsp_ctc_loader__msg" data-message="0">Loading</span>
                                        </div>
                                    </div>`;
                            } else {
                                let submitOptions = {
                                    line: line
                                };
                                form.addButton({
                                    id: 'custpage_vcsp_ctc_save',
                                    label: 'Save',
                                    functionName: 'submit(' + JSON.stringify(submitOptions) + ')'
                                });
                                form.addButton({
                                    id: 'custpage_vcsp_ctc_cancel',
                                    label: 'Cancel',
                                    functionName: 'close'
                                });
                                loaderFld.defaultValue = `<div id="vcsp_ctc_loader"
                                            style="display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%;
                                            height: 100%; z-index: 900; overflow: hidden; text-align: center; background-color: rgba(255, 255, 255, 0.85);
                                            color: #006600; border-radius: 5px;">
                                        <div style="display: inline-flex; flex-direction: column; justify-content: center; align-items: center;">
                                            <div style="width: 32px; height: 32px; align-self: center;">
                                                <svg viewBox="-18 -18 36 36" role="img" aria-label="Loading"
                                                        style="-webkit-animation: spin 2s ease infinite; -moz-animation: spin 2s ease infinite; animation: spin 2s ease infinite;">
                                                    <circle fill="none" r="16" style="stroke: #dfe4eb; stroke-width: 3px;"></circle>
                                                    <circle fill="none" r="16" style="stroke: #998260; stroke-width: 3px; stroke-dashoffset: 75;"
                                                            transform="rotate(-135)" stroke-dasharray="100"></circle>
                                                </svg>
                                            </div>
                                            <span id="vcsp_ctc_loader__msg" data-message="0">Loading</span>
                                        </div>
                                    </div>`;
                            }
                            context.response.writePage(form);
                        }
                    }
                }
            } else if (prompt && title && subsidiaryId && linesStr) {
                closeWindow = false;
                let form = NS_ServerWidget.createForm({
                    title: prompt,
                    hideNavBar: true
                });
                let titleFld = form.addField({
                    id: 'custpage_vcsp_ctc_title',
                    label: 'Title',
                    type: NS_ServerWidget.FieldType.TEXT
                });
                titleFld.defaultValue = title;
                titleFld.updateDisplayType({
                    displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                });
                let subsidiaryFld = form.addField({
                    id: 'custpage_vcsp_ctc_subsidiary',
                    label: 'Subsidiary ID',
                    type: NS_ServerWidget.FieldType.INTEGER
                });
                subsidiaryFld.defaultValue = subsidiaryId;
                subsidiaryFld.updateDisplayType({
                    displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                });
                let linesFld = form.addField({
                    id: 'custpage_vcsp_ctc_lines',
                    label: 'Lines',
                    type: NS_ServerWidget.FieldType.LONGTEXT
                });
                linesFld.defaultValue = linesStr;
                linesFld.updateDisplayType({
                    displayType: NS_ServerWidget.FieldDisplayType.HIDDEN
                });
                let lineFld = form.addField({
                    id: 'custpage_vcsp_ctc_line',
                    label: 'Line',
                    type: NS_ServerWidget.FieldType.SELECT
                });
                for (let i = 0; i < lineCount; i += 1) {
                    lineFld.addSelectOption({
                        value: i,
                        text: ['Line ', i + 1, ': ', arrLines[i]].join('')
                    });
                }
                let vendorFld = form.addField({
                    id: 'custpage_vcsp_ctc_vendor',
                    label: 'Vendor',
                    type: NS_ServerWidget.FieldType.SELECT
                });
                let vendorList = libVendorConfig.getAvailableVendorList({
                    subsidiary: subsidiaryId
                });
                for (let i = 0, len = vendorList.length; i < len; i += 1) {
                    vendorFld.addSelectOption(vendorList[i]);
                }
                vendorFld
                    .updateLayoutType({
                        layoutType: NS_ServerWidget.FieldLayoutType.OUTSIDEBELOW
                    })
                    .updateBreakType({
                        breakType: NS_ServerWidget.FieldBreakType.STARTROW
                    });
                form.addButton({
                    id: 'custpage_vcsp_ctc_cancel',
                    label: 'Close',
                    functionName: 'window.close()'
                });
                form.addSubmitButton({
                    label: 'Select'
                });
                context.response.writePage(form);
            }
            if (closeWindow) {
                let form = NS_ServerWidget.createForm({
                    title: ' ',
                    hideNavBar: true
                });
                let jsTrigger = form.addField({
                    id: 'custpage_trigger_message',
                    label: ' ',
                    type: NS_ServerWidget.FieldType.INLINEHTML
                });
                jsTrigger.defaultValue = `<script type="text/javascript">
                    function displayMessage(title, text) {
                        require(['N/ui/message'], function(NS_Message) {
                            let message = NS_Message.create({
                                title: title,
                                message: text,
                                type: NS_Message.Type.INFORMATION
                            });
                            message.show();
                        });
                    }
                    displayMessage("VAR Connect", "No additional fields to set.");
                    </script>`;
                form.addButton({
                    id: 'custpage_vcsp_ctc_cancel',
                    label: poid ? 'Cancel' : 'Close',
                    functionName: poid ? 'history.back()' : 'window.close()'
                });
                context.response.writePage(form);
            }
        }
    };
    return SuiteletScript;
});
