/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
 * @NScriptType ClientScript
 */

define(['N/search', 'N/https', 'N/record', 'N/ui/dialog'], function (
    search,
    https,
    record,
    dialog
) {
    // Searches NS for first customer occurrence of provided email
    // If found return customer information, if not return null
    // Note if multiple occurrences are found, only the first result is returned
    function isNSCustomer(email) {
        if (!isEmpty(email)) {
            //                alert("in isNSCustomer email = "+email);

            var myFilters = [];
            myFilters.push(
                search.createFilter({
                    name: 'email',
                    operator: search.Operator.IS,
                    values: email
                })
            );
            myFilters.push(
                search.createFilter({
                    name: 'isinactive',
                    operator: search.Operator.IS,
                    values: 'F'
                })
            );
            var results = search
                .create({
                    type: search.Type.CUSTOMER,
                    columns: ['email', 'firstname', 'lastname'],
                    filters: myFilters
                })
                .run()
                .getRange({
                    start: 0,
                    end: 1
                });
            if (results != '') {
                return results[0].id;
            }
        }
        return null;
    }

    function pageInit(context) {
        console.log('page init');

        //alert('page init');
        //            jQuery('#tr_fg_donationgroup > :nth-child(2)').hide();
        //            jQuery('#tr_fg_donationgroup > :nth-child(3)').hide();
        // var rdoLabelField = context.currentRecord.getField('donationlabelfield')
        // var rdobehalfField = context.currentRecord.getField('rdoidentify')
        // try {
        // rdoLabelField.isDisplay = false;
        // rdobehalfField.isDisplay = false;
        // }
        // catch (err){
        // jQuery('#tr_fg_donationgroup > :nth-child(2)').hide();
        // jQuery('#tr_fg_donationgroup > :nth-child(3)').hide();
        // }
    }

    function fieldChanged(context) {
        console.log(context);
        //			alert ('field changed ' + context.fieldId)

        /*
            if (context.fieldId=='itemselectfield'){
                var itemValue = context.currentRecord.getValue({
                    fieldId: context.fieldId
                });
                //alert ('select value = '  + itemValue);
                jQuery("div [data-field-type='textarea']").hide()
                jQuery('span [id^="custpage_label_sncount"]').closest("div").hide()

                var tempStr = "custpage_label_sncount_"+itemValue;
                jQuery('span [id^='+tempStr+']').closest("div").show(500)
                jQuery('#custpage_currentsn_'+itemValue).closest("div").show(500);
                jQuery('#custpage_newsn_'+itemValue).closest("div").show(500);

            }
*/
    }

    function saveRecord(context) {
        console.log('Save Record');
        //			alert ('field changed ' + context.fieldId)

        var poNum = context.currentRecord.getValue({ fieldId: 'ponum' });
        if (isEmpty(poNum)) {
            alert('PO Number required');
            return false;
        }
        return true;
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
        saveRecord: saveRecord
    };
});
