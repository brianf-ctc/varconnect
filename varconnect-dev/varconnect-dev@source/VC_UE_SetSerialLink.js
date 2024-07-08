/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 * Var Connect v2, Adds a standard link for serial numbers to transaction lines
 *
 *
 * Version	Date            Author		Remarks
 * 1.00		Feb 7, 2019    ocorrea
 *
 */

/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

define([
    'N/record',
    'N/runtime',
    'N/error',
    'N/config',
    'N/search',
    'N/url',
    './VC_Globals.js',
    './CTC_VC_Lib_Utilities.js',
    './CTC_VC_Constants.js'
], function (record, runtime, error, config, search, url, vcGlobals, util, constants) {
    //        vcGlobals.SN_LINE_FIELD_LINK_ID
    var LogTitle = 'SetSerialLink';

    function beforeLoad(context) {
        var logTitle = 'beforeLoad';
        var form = context.form;

        try {
            if (context.type != context.UserEventType.VIEW) return false;
            if (context.newRecord.type != record.Type.ITEM_FULFILLMENT) return false;

            var lineCount = context.newRecord.getLineCount({ sublistId: 'item' });
            log.debug(logTitle, '>> Total lines: ' + lineCount);

            var sublistItem = context.form.getSublist({ id: 'item' });
            log.debug(logTitle, sublistItem);

            sublistItem.addField({
                id: 'custpage_custom_serial_link',
                label: 'Serial Link',
                type: 'text'
            });
            for (var line = 0; line < lineCount; line++) {
                var serialLink = context.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_ctc_xml_serial_num_link',
                    line: line
                });

                log.debug(logTitle, JSON.stringify({ line: line, serialLink: serialLink }));

                if (!serialLink) continue;
                // context.newRecord.setSublistValue({
                //     sublistId: 'item',
                //     fieldId: 'custcol_ctc_xml_serial_num_link',
                //     line: line,
                //     value: '<a href="' + serialLink + '" target="_blank">Serial Link</a>'
                // });

                sublistItem.setSublistValue({
                    id: 'custpage_custom_serial_link',
                    line: line,
                    value:
                        '<span class="uir-field"><a class="dottedlink" href="' +
                        serialLink +
                        '" target="_blank">Serial Number Link</a></span>'
                });

                // context.form.addSub
            }

            var fldLink = sublistItem.getField({
                id: 'custcol_ctc_xml_serial_num_link'
            });
            fldLink.updateDisplayType({
                displayType: 'HIDDEN'
            });
        } catch (error) {
            log.audit(logTitle, error);
        }

        return true;
    }

    function beforeSubmit(context) {
        if (context.type == context.UserEventType.EDIT) {
            var current_rec = context.newRecord;
            var currentID = current_rec.id;
            var currentType = current_rec.type;
            log.debug({
                title: 'Running for ' + currentType + ' - ' + currentID
            });
            // var companyObj = config.load({
            //     type: config.Type.COMPANY_INFORMATION
            // });
            // var accountId = companyObj.getValue('companyid')

            var lineCount = current_rec.getLineCount({ sublistId: 'item' });
            if (lineCount > 900) return;
            for (var i = 0; i < lineCount; i++) {
                var itemId = current_rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                var itemType = current_rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: i
                });
                log.debug('itemtype', itemType);
                if (itemType == 'EndGroup') continue;

                /**  OLD Version
                var itemTxtField = currentType == record.Type.ITEM_FULFILLMENT ? 'itemname' : 'item';
                var itemName = encodeURIComponent(current_rec.getSublistText({
                    sublistId: 'item',
                    fieldId: itemTxtField,
                    line: i
                }));
**/
                var fieldLookUp = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['itemid']
                });
                var itemName = encodeURIComponent(fieldLookUp.itemid);

                // + '&compid='+accountId
                //                var lineLinkUrl = vcGlobals.SN_VIEW_SL_URL  + '&transType='+currentType + '&transId='+currentID + '&itemId='+itemId + '&itemName='+itemName
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
        } else {
            return;
        }
    }

    function afterSubmit(context) {
        if (context.type == context.UserEventType.CREATE) {
            var currentID = context.newRecord.id;
            var currentType = context.newRecord.type;

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
                var itemType = current_rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: i
                });
                log.debug('itemtype', itemType);
                if (itemType == 'EndGroup') continue;
                var fieldLookUp = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['itemid']
                });
                var itemName = encodeURIComponent(fieldLookUp.itemid);

                // + '&compid='+accountId
                //                var lineLinkUrl = vcGlobals.SN_VIEW_SL_URL  + '&transType='+currentType + '&transId='+currentID + '&itemId='+itemId + '&itemName='+itemName
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
            current_rec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });
        } else {
            return;
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
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});
