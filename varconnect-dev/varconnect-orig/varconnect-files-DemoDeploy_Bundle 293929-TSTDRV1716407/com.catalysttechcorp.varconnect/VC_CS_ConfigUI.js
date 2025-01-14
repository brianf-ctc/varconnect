/**
 *@NApiVersion 2.x
 * @NScriptType ClientScript
 *@NModuleScope Public
 */

define(['N/search', 'N/https', 'N/record'], function (search, https, record) {
    function pageInit(context) {
        console.log('page init');
        //alert('page init');
    }

    function fieldChanged(context) {
        console.log(context);

        if (context.fieldId == 'subsidiaryfield') {
            console.log(
                'opening credentials for subsidiary: ' +
                    context.currentRecord.getValue('subsidiaryfield')
            );
            // console.log('ischanged: '+ context.currentRecord.getValue('ischangedflag'))

            // var isChanged = context.currentRecord.getValue({
            // 	fieldId: 'ischangedflag'
            // })
            // if (isChanged == 'T' || isChanged == true) {
            // 	if (!confirm('You have unsaved changes. Do you want to proceed?')) return;
            // }

            var subsidiary = context.currentRecord.getValue('subsidiaryfield');
            var creds = {
                synnexUser: '',
                synnexPass: '',
                synnexCustNum: '',
                dandhUser: '',
                dandhPass: '',
                techdataUser: '',
                techdataPass: '',
                ingramUser: '',
                ingramPass: ''
            };
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
                console.log(results);
                credsObj = record.load({
                    type: 'customrecord_vc_config',
                    id: results[0].id
                });
                creds.synnexUser = credsObj.getValue('custrecord_vc_synnex_user');
                creds.synnexPass = credsObj.getValue('custrecord_vc_synnex_pass');
                creds.synnexCustNum = credsObj.getValue('custrecord_vc_synnex_customernum');
                creds.dandhUser = credsObj.getValue('custrecord_vc_dandh_user');
                creds.dandhPass = credsObj.getValue('custrecord_vc_dandh_pass');
                creds.techdataUser = credsObj.getValue('custrecord_vc_techdata_user');
                creds.techdataPass = credsObj.getValue('custrecord_vc_techdata_pass');
                creds.ingramUser = credsObj.getValue('custrecord_vc_ingrammicro_user');
                creds.ingramPass = credsObj.getValue('custrecord_vc_ingrammicro_pass');
            } else {
                alert(
                    'No existing credentials found for that subsidiary. You may enter a new set of credentials'
                );
            }

            context.currentRecord.setValue({
                fieldId: 'synnexuserfield',
                value: creds.synnexUser,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'synnexpassfield',
                value: creds.synnexPass,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'synnexcustnumfield',
                value: creds.synnexCustNum,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'dandhuserfield',
                value: creds.dandhUser,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'dandhpassfield',
                value: creds.dandhPass,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'techdatauserfield',
                value: creds.techdataUser,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'techdatapassfield',
                value: creds.techdataPass,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'ingramuserfield',
                value: creds.ingramUser,
                ignoreFieldChange: true
            });

            context.currentRecord.setValue({
                fieldId: 'ingrampassfield',
                value: creds.ingramPass,
                ignoreFieldChange: true
            });
            context.currentRecord.setValue({
                fieldId: 'ischangedflag',
                value: false,
                ignoreFieldChange: true
            });
        } else {
            //set isChanged
            context.currentRecord.setValue({
                fieldId: 'ischangedflag',
                value: true,
                ignoreFieldChange: true
            });
        }
    }

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

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };
});
