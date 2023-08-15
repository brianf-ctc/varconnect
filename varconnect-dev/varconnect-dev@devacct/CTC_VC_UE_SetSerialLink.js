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
    'N/runtime',
    'N/url',
    './CTC_VC2_Constants',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Lib_Record'
], function (ns_runtime, ns_url, vc2_constant, vc2_util, vc2_record) {
    //        vcGlobals.SN_LINE_FIELD_LINK_ID
    var LogTitle = 'SetSerialLink';

    function generateSerialLink(option) {
        // var ns_url = ns_url || vc2_util.loadModule('N/url') || vc2_util.loadModuleNS('N/url');

        var protocol = 'https://';
        var domain = ns_url.resolveDomain({
            hostType: ns_url.HostType.APPLICATION
        });
        var linkUrl = ns_url.resolveScript({
            scriptId: vc2_constant.SCRIPT.VIEW_SERIALS_SL,
            deploymentId: vc2_constant.DEPLOYMENT.VIEW_SERIALS_SL,
            params: option
        });

        return protocol + domain + linkUrl;
    }

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;

            try {
                if (scriptContext.type != scriptContext.UserEventType.VIEW)
                    return false;

                var currentRecord = scriptContext.newRecord;
                if (!currentRecord) return;

                vc2_util.LogPrefix =
                    '[' +
                    [currentRecord.type, currentRecord.id].join(':') +
                    '] ';

                vc2_util.log(logTitle, '*** START: ', [
                    scriptContext.type,
                    ns_runtime.executionContext,
                    scriptContext.newRecord ? scriptContext.newRecord.type : ''
                ]);

                // generate the link
                var Current = {
                    transType: currentRecord.type,
                    transId: currentRecord.id
                };

                var serialLinkUrl = ns_url.resolveScript({
                    scriptId: 'customscript_vc_view_serials',
                    deploymentId: 'customdeploy_vc_view_serials',
                    params: Current
                });
                vc2_util.log(logTitle, '>> SerialLink URL: ', serialLinkUrl);

                // try to update serial record lines
                var lineCount = currentRecord.getLineCount({
                    sublistId: 'item'
                });
                log.audit(logTitle, '... lineCount: ', lineCount);

                var fixSerialLinkFld = scriptContext.form.addField({
                        id: 'custpage_ctc_fixserial_links',
                        label: 'Fix Serial Lnks',
                        type: 'inlinehtml'
                    }),
                    lineFixJS = [];

                for (var line = 0; line < lineCount; line++) {
                    var lineData = vc2_record.extractLineValues({
                        record: currentRecord,
                        sublistId: 'item',
                        columns: [
                            'item',
                            'itemtype',
                            vc2_constant.GLOBAL.SN_LINE_FIELD_LINK_ID
                        ],
                        line: line
                    });
                    lineData.itemName = encodeURIComponent(
                        lineData.item_text || ''
                    );
                    vc2_util.log(logTitle, '>> lineData: ', [line, lineData]);

                    if (lineData.itemType == 'EndGroup') continue;

                    var lineSerialLink =
                        serialLinkUrl +
                        ('&itemName=' + lineData.itemName) +
                        ('&itemId=' + lineData.item);

                    lineFixJS.push(
                        '(function(){',
                        "var el = jq('div#item_layer tr:eq(" +
                            (line + 1 + ") a:contains(Serial Number Link)');"),
                        'if (! el || !el.length) return;',
                        'el.attr("href", "' + lineSerialLink + '");',
                        '})();'
                    );
                }

                var fixSerialLinkJS = [
                    '<script type="text/javascript">',
                    'jQuery(document).ready(function () {',
                    '(function (jq) {',
                    'console.log("**** Code: Serial Link Fix **** ");',
                    lineFixJS.join(''),
                    '})(jQuery);',
                    '})',
                    '</script>'
                ];
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
                var lineCount = currentRecord.getLineCount({
                    sublistId: 'item'
                });
                vc2_util.log(logTitle, '... lineCount: ', lineCount);

                for (var line = 0; line < lineCount; line++) {
                    var itemData = {
                        itemId: currentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: line
                        }),
                        itemType: currentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemtype',
                            line: line
                        })
                    };

                    vc2_util.log(logTitle, '// itemData: ', itemData);
                    if (itemData.itemType == 'EndGroup') continue;

                    Current.itemId = itemData.item || false;

                    var serialLinkUrl = generateSerialLink(Current);
                    vc2_util.log(logTitle, '// SerialLink: ', serialLinkUrl);

                    currentRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_constant.GLOBAL.SN_LINE_FIELD_LINK_ID,
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
