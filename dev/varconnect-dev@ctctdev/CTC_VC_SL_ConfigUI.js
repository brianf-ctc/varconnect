/**
 * Copyright (c) 2025 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define([
    'N/ui/serverWidget',
    'N/email',
    'N/runtime',
    'N/log',
    'N/search',
    'N/record',
    'N/redirect'
], function (ui, email, runtime, log, search, record, redirect) {
    function isEmpty(stValue) {
        if (stValue == '' || stValue == null || stValue == undefined) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if (stValue == '') {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }

            return false;
        }
    }

    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = ui.createForm({
                title: 'VAR Connect Configuration'
            });

            var creds = record.load({
                type: 'customrecord_vc_config',
                id: 1
            });

            form.clientScriptModulePath = './VC_CS_ConfigUI.js';

            var selectgroup = form.addFieldGroup({
                id: 'selectgroup',
                label: 'Subsidiary Select'
            });

            var isChangedField = form.addField({
                id: 'ischangedflag',
                type: ui.FieldType.CHECKBOX,
                label: 'Is Changed',
                container: 'selectgroup'
            });
            isChangedField.defaultValue = 'F';
            isChangedField.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

            var subsidiarySelect = form.addField({
                id: 'subsidiaryfield',
                type: ui.FieldType.SELECT,
                label: 'Subsidiary',
                container: 'selectgroup'
            });
            subsidiarySelect.addSelectOption({
                value: -1,
                text: ''
            });
            var subsidiarySearchObj = search.create({
                type: 'subsidiary',
                filters: [],
                columns: [
                    search.createColumn({
                        name: 'name',
                        sort: search.Sort.ASC,
                        label: 'Name'
                    })
                ]
            });
            subsidiarySearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                subsidiarySelect.addSelectOption({
                    value: result.id,
                    text: result.getValue('name')
                });
                return true;
            });
            subsidiarySelect.defaultValue = creds.getValue('custrecord_vc_subsidiary');

            var synnexgroup = form.addFieldGroup({
                id: 'synnexgroup',
                label: 'Synnex'
            });
            var dandhgroup = form.addFieldGroup({
                id: 'dandhgroup',
                label: 'D&H'
            });
            var techdatagroup = form.addFieldGroup({
                id: 'techdatagroup',
                label: 'Tech Data'
            });
            var ingramgroup = form.addFieldGroup({
                id: 'ingramgroup',
                label: 'Ingram Micro'
            });

            var synnexUserField = form.addField({
                id: 'synnexuserfield',
                type: ui.FieldType.TEXT,
                label: 'Synnex User',
                container: 'synnexgroup'
            });
            synnexUserField.defaultValue = creds.getValue('custrecord_vc_synnex_user');

            var synnexPassField = form.addField({
                id: 'synnexpassfield',
                type: ui.FieldType.PASSWORD,
                label: 'Synnex Pass',
                container: 'synnexgroup'
            });
            synnexPassField.defaultValue = creds.getValue('custrecord_vc_synnex_pass');

            var synnexCustNumField = form.addField({
                id: 'synnexcustnumfield',
                type: ui.FieldType.TEXT,
                label: 'Synnex Customer Number',
                container: 'synnexgroup'
            });
            synnexCustNumField.defaultValue = creds.getValue('custrecord_vc_synnex_customernum');

            var dandhUserField = form.addField({
                id: 'dandhuserfield',
                type: ui.FieldType.TEXT,
                label: 'D&H User',
                container: 'dandhgroup'
            });
            dandhUserField.defaultValue = creds.getValue('custrecord_vc_dandh_user');

            var dandhPassField = form.addField({
                id: 'dandhpassfield',
                type: ui.FieldType.PASSWORD,
                label: 'D&H Pass',
                container: 'dandhgroup'
            });
            dandhPassField.defaultValue = creds.getValue('custrecord_vc_dandh_pass');

            var techdataUserField = form.addField({
                id: 'techdatauserfield',
                type: ui.FieldType.TEXT,
                label: 'Tech Data User',
                container: 'techdatagroup'
            });
            techdataUserField.defaultValue = creds.getValue('custrecord_vc_techdata_user');

            var techdataPassField = form.addField({
                id: 'techdatapassfield',
                type: ui.FieldType.PASSWORD,
                label: 'Tech Data Pass',
                container: 'techdatagroup'
            });
            techdataPassField.defaultValue = creds.getValue('custrecord_vc_techdata_pass');

            var ingramUserField = form.addField({
                id: 'ingramuserfield',
                type: ui.FieldType.TEXT,
                label: 'Ingram Micro User',
                container: 'ingramgroup'
            });
            ingramUserField.defaultValue = creds.getValue('custrecord_vc_ingrammicro_user');

            var ingramPassField = form.addField({
                id: 'ingrampassfield',
                type: ui.FieldType.PASSWORD,
                label: 'Ingram Micro Pass',
                container: 'ingramgroup'
            });
            ingramPassField.defaultValue = creds.getValue('custrecord_vc_ingrammicro_pass');

            form.addSubmitButton({
                label: 'Save'
            });

            context.response.writePage(form);
        }
        // ******************* POST / Submit Section
        else {
            //save credentials

            var subsidiary = context.request.parameters.subsidiaryfield;
            var myFilters = [];
            myFilters.push(
                search.createFilter({
                    name: 'custrecord_vc_subsidiary',
                    operator: search.Operator.IS,
                    values: subsidiary
                })
            );
            var results = search
                .create({
                    type: 'customrecord_vc_config',
                    filters: myFilters
                })
                .run()
                .getRange({
                    start: 0,
                    end: 1
                });
            if (results.length > 0) {
                //console.log(results)
                credsObj = record.load({
                    type: 'customrecord_vc_config',
                    id: results[0].id
                });
            } else {
                credsObj = record.create({
                    type: 'customrecord_vc_config'
                });
            }
            credsObj.setValue({
                fieldId: 'custrecord_vc_subsidiary',
                value: subsidiary
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_synnex_user',
                value: context.request.parameters.synnexuserfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_synnex_pass',
                value: context.request.parameters.synnexpassfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_synnex_customernum',
                value: context.request.parameters.synnexcustnumfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_dandh_user',
                value: context.request.parameters.dandhuserfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_dandh_pass',
                value: context.request.parameters.dandhpassfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_techdata_user',
                value: context.request.parameters.techdatauserfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_techdata_pass',
                value: context.request.parameters.techdatapassfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_ingrammicro_user',
                value: context.request.parameters.ingramuserfield
            });
            credsObj.setValue({
                fieldId: 'custrecord_vc_ingrammicro_pass',
                value: context.request.parameters.ingrampassfield
            });

            credsObj.save();

            redirect.toSuitelet({
                scriptId: runtime.getCurrentScript().id,
                deploymentId: 1
            });
        }
    }
    return {
        onRequest: onRequest
    };
});
