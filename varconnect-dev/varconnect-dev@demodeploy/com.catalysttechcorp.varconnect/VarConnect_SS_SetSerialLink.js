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
 * @NScriptType ScheduledScript
 */
/**
 * Module Description
 * Scheduled script that will send an email summary of the days shipments to recipients listed in a body field on the SO
 */
define([
    'N/search',
    'N/email',
    'N/record',
    'N/runtime',
    'N/render',
    'N/url',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js'
], function (ns_search, ns_email, ns_record, ns_runtime, ns_render, ns_url, vc2_util, vc2_constant) {
    function execute() {
        log.audit({ title: 'Scheduled set serial Script', details: 'STARTING' });

        var currentID = ns_runtime.getCurrentScript().getParameter('custscript_ss_seriallink_id');
        var currentType = ns_runtime.getCurrentScript().getParameter('custscript_ss_seriallink_type');

        var current_rec = ns_record.load({
            type: currentType,
            id: currentID,
            isDynamic: false
        });

        log.debug({
            title: 'Running for ' + currentType + ' - ' + currentID
        });
        // var companyObj = config.load({
        //     type: config.Type.COMPANY_INFORMATION
        // });
        // var accountId = companyObj.getValue('companyid')

        var lineCount = current_rec.getLineCount({ sublistId: 'item' });
        for (var i = 0; i < lineCount; i++) {
            var itemId = current_rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });

            var fieldLookUp = ns_search.lookupFields({
                type: ns_search.Type.ITEM,
                id: itemId,
                columns: ['itemid']
            });
            var itemName = encodeURIComponent(fieldLookUp.itemid);

            // + '&compid='+accountId
            //            var lineLinkUrl = vcGlobals.SN_VIEW_SL_URL  + '&transType='+currentType + '&transId='+currentID + '&itemId='+itemId + '&itemName='+itemName
            var lineLinkUrl = vc2_util.generateSerialLink({
                transType: currentType,
                transId: currentID,
                itemId: itemId,
                itemName: itemName
            });

            log.debug({
                title: 'Setting line ' + i,
                details: lineLinkUrl
            });
            current_rec.setSublistValue({
                sublistId: 'item',
                fieldId: vc2_constant.GLOBAL.SN_LINE_FIELD_LINK_ID,
                line: i,
                value: lineLinkUrl
            });
        }
        current_rec.save();
    }

    function isEmpty(stValue) {
        if (stValue === '' || stValue == null || stValue == undefined) {
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
        execute: execute
    };
});
