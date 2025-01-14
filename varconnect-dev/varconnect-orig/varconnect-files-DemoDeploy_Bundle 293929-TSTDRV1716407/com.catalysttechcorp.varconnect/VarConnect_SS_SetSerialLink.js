/**
 *
 * Module Description
 * Scheduled script that will send an email summary of the days shipments to recipients listed in a body field on the SO
 *
 *
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 */
define([
    'N/search',
    'N/email',
    'N/record',
    'N/log',
    'N/runtime',
    'N/render',
    'N/url',
    './VC_Globals.js',
    './CTC_VC_Lib_Utilities.js',
    './CTC_VC_Constants.js'
], function (search, email, record, log, runtime, render, url, vcGlobals, util, constants) {
    function execute() {
        log.audit({ title: 'Scheduled set serial Script', details: 'STARTING' });

        var currentID = runtime.getCurrentScript().getParameter('custscript_ss_seriallink_id');
        var currentType = runtime.getCurrentScript().getParameter('custscript_ss_seriallink_type');

        var current_rec = record.load({
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

            var fieldLookUp = search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: ['itemid']
            });
            var itemName = encodeURIComponent(fieldLookUp.itemid);

            // + '&compid='+accountId
            //            var lineLinkUrl = vcGlobals.SN_VIEW_SL_URL  + '&transType='+currentType + '&transId='+currentID + '&itemId='+itemId + '&itemName='+itemName
            var lineLinkUrl = util.generateSerialLink({
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
                fieldId: vcGlobals.SN_LINE_FIELD_LINK_ID,
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
