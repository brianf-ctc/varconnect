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
 */
define(['N/ui/serverWidget', './CTC_VC2_Lib_Utils'], function (ns_ui, vc2_util) {
    var LogTitle = 'FormHelper';
    var showLogs = true;

    /// FORM HELPER ///////////////
    var UI = {
        FORM: null,
        FIELDS: {
            SPACER: {
                type: ns_ui.FieldType.INLINEHTML,
                label: 'Spacer',
                defaultValue: '<br />'
            },
            HEADER: {
                type: ns_ui.FieldType.INLINEHTML,
                label: 'Header',
                defaultValue: ' '
            }
        },
        SUBLIST: {}
    };

    var FormHelper = {
        Form: null,
        fieldCounter: 0,
        Fields: {},
        Sublists: {},
        setUI: function (option) {
            if (option.form) UI.FORM = option.form;
            if (option.fields) util.extend(UI.FIELDS, option.fields);
            if (option.sublist) UI.SUBLIST = option.sublist;
        },

        renderField: function (fieldInfo, containerId) {
            var logTitle = [LogTitle, 'renderField'].join('::');
            this.fieldCounter++;

            vc2_util.log(logTitle, '// fieldInfo: ', [fieldInfo]);
            var fieldOption = {};

            if (util.isString(fieldInfo) && fieldInfo.match(/:/g)) {
                var cmd = fieldInfo.split(/:/g);

                if (cmd[0] == 'H1') {
                    util.extend(fieldOption, UI.FIELDS.HEADER);
                    fieldOption.defaultValue =
                        '<div class="fgroup_title">' + cmd[1].toUpperCase() + '</div>';
                } else if (cmd[0] == 'SPACER') {
                    util.extend(fieldOption, UI.FIELDS.SPACER);
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

            vc2_util.log(logTitle, '// fieldOption: ', fieldOption);
            // vc2_util.log(logTitle, '// UI.FORM: ', [UI.FORM]);

            if (containerId) fieldOption.container = containerId;

            /////////////////////////
            var fld = UI.FORM.addField(fieldOption);
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
            var logTitle = [LogTitle, 'renderFieldList'].join('::');
            for (var i = 0, j = fieldList.length; i < j; i++) {
                var fieldName = fieldList[i];

                var fieldInfo = UI.FIELDS[fieldName];

                if (fieldInfo) {
                    UI.FIELDS[fieldName].fldObj = FormHelper.renderField(fieldInfo, containerId);
                } else {
                    FormHelper.renderField(fieldName, containerId);
                }
            }
        },
        renderFieldGroup: function (groupInfo) {
            var logTitle = [LogTitle, 'renderFieldGroup'].join('::');

            if (!groupInfo.id) {
                groupInfo.id = ['custpage_fg', new Date().getTime()].join('_');
            }

            // vc2_util.log(logTitle, groupInfo);
            var fgObj = UI.FORM.addFieldGroup({
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
            //     var fieldInfo = UI.FIELDS[fieldName];

            //     vc2_util.log(logTitle, '>> field: ', [fieldName, fieldInfo]);

            //     if (fieldInfo) {
            //         UI.FIELDS[fieldName].fldObj = FormHelper.renderField(
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
            var logTitle = [LogTitle, 'renderSublist'].join('::');

            /// ADD SUBLIST ////////////
            var sublistObj = UI.FORM.addSublist(sublistInfo);
            /////////////////////////////

            for (var fieldId in sublistInfo.fields) {
                var fieldInfo = sublistInfo.fields[fieldId];

                if (!fieldInfo) continue;

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
            var fieldObj = UI.FIELDS[fieldName] ? UI.FIELDS[fieldName].fldObj : false;

            if (!fieldObj)
                fieldObj = UI.FORM.getField({
                    id: UI.FIELDS[fieldName].id
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
                    vc2_util.log(logTitle, '## ERROR ## ', [line_err, field, lineData[field]]);
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

    return FormHelper;
});
