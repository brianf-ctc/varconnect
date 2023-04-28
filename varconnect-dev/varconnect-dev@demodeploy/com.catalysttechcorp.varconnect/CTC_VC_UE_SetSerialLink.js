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
    'N/search',
    'N/url',
    './CTC_VC2_Constants',
    './CTC_VC2_Lib_Utils'
], function (ns_record, ns_runtime, ns_search, ns_url, vc2_global, vc2_util) {
    //        vcGlobals.SN_LINE_FIELD_LINK_ID
    var LogTitle = 'SetSerialLink';

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;

            vc2_util.log(logTitle, '*** START: ', [
                scriptContext.type,
                ns_runtime.executionContext,
                scriptContext.newRecord ? scriptContext.newRecord.type : ''
            ]);

            try {
                if (scriptContext.type != scriptContext.UserEventType.VIEW) return false;

                var currentRecord = scriptContext.newRecord;
                if (!currentRecord) return;

                // generate the link
                var Current = {
                    transType: currentRecord.type,
                    transId: currentRecord.id
                };

                vc2_util.log(logTitle, '>> Current Record: ', Current);

                var fixSerialLinkJS = [
                    '<script type="text/javascript">',
                    'jQuery(document).ready(function () {',
                    'console.log("**** Code: Serial Link Fix **** ");',
                    '(function (jq) {',
                    'var serialLnks = jq("a").filter(function(idx, elem) {return elem.text == "Serial Number Link"});',
                    'serialLnks.each(function (id, elem) {',
                    'var url = elem.href.replace("&transId=&", "&");',
                    'url+="&transId=' + Current.transId + '";',
                    'elem.href=url;return true;})',
                    '})(jQuery);',
                    '})',
                    '</script>'
                ];

                var fixSerialLinkFld = scriptContext.form.addField({
                    id: 'custpage_ctc_fixserial_links',
                    label: 'Fix Serial Lnks',
                    type: 'inlinehtml'
                });
                fixSerialLinkFld.defaultValue = fixSerialLinkJS.join('');
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        },
        beforeSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeSubmit'].join('::'),
                returnValue = null;

            var LogPrefix = [
                ns_runtime.executionContext,
                scriptContext.type,
                scriptContext.newRecord ? scriptContext.newRecord.type : '',
                scriptContext.newRecord ? scriptContext.newRecord.id : ''
            ];
            vc2_util.log(logTitle, '*** START: ', LogPrefix);
            vc2_util.LogPrefix = LogPrefix.join(':');

            try {
                if (
                    !vc2_util.inArray(scriptContext.type, [
                        scriptContext.UserEventType.CREATE,
                        scriptContext.UserEventType.COPY,
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ])
                )
                    return;

                var currentRecord = scriptContext.newRecord;
                if (!currentRecord) return;

                var Current = {
                    transType: currentRecord.type,
                    transId: currentRecord.id,
                    createdFrom: currentRecord.getValue('createdfrom')
                };

                vc2_util.log(logTitle, '... Current: ', Current);

                if (!Current.createdFrom) return; // no sales order, we can't handle

                // try to update serial record lines
                var lineCount = currentRecord.getLineCount({ sublistId: 'item' });
                vc2_util.log(logTitle, '... lineCount: ', lineCount);

                for (var line = 0; line < lineCount; line++) {
                    util.extend(Current, {
                        itemId: currentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: line
                        })
                        // itemName: currentRecord.getSublistText({
                        //     sublistId: 'item',
                        //     fieldId: 'item',
                        //     line: line
                        // })
                    });

                    var itemType = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemtype',
                        line: line
                    });
                    Current.itemName = encodeURIComponent(Current.itemName);
                    vc2_util.log(logTitle, '// Current: ', [Current, itemType]);

                    if (itemType == 'EndGroup') continue;

                    var serialLinkUrl = vc2_util.generateSerialLink(Current);
                    vc2_util.log(logTitle, '// SerialLink: ', serialLinkUrl);

                    currentRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_global.GLOBAL.SN_LINE_FIELD_LINK_ID,
                        line: line,
                        value: serialLinkUrl
                    });
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        }
    };

    return USER_EVENT;
});
