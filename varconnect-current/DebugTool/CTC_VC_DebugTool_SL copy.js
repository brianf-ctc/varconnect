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
 * @NScriptType Suitelet
 */

define([
    'N/ui/serverWidget',
    'N/ui/message',
    'N/runtime',
    'N/search',
    'N/url',
    'N/file',
    './../CTC_VC2_Lib_Utils'
], function (ns_ui, ns_msg, ns_runtime, ns_search, ns_url, ns_file, vc2_util) {
    var LogTitle = 'VC DebugTool';
    var Helper = {
        getActiveVendors: function () {
            var arrSeachResults = vc2_util.searchAllPaged({
                type: 'customrecord_ctc_vc_vendor_config',
                filterExpression: [['isinactive', 'is', 'F']],
                columns: ['name', 'internalid']
            });

            var arrReturnValue = [];
            arrSeachResults.forEach(function (result) {
                arrReturnValue.push({
                    value: result.getValue('internalid'),
                    text: result.getValue('name'),
                    // value: result.getValue({
                    //     name: 'custrecord_ctc_vc_xml_vendor',
                    //     summary: ns_search.Summary.GROUP
                    // }),
                    // text: result.getText({
                    //     name: 'custrecord_ctc_vc_xml_vendor',
                    //     summary: ns_search.Summary.GROUP
                    // }),
                    isSelected: !arrReturnValue.length
                });
                return true;
            });

            return arrReturnValue;
        }
    };

    var DebugTool_UI = {
        onRequest: function (scriptContext) {
            var logTitle = [LogTitle, 'onRequest'].join('::');
            log.debug(logTitle, '############################################');

            var Current = {
                task: scriptContext.request.parameters.vctask || 'viewForm',
                vendorId: scriptContext.request.parameters.vcvendor,
                poNum: scriptContext.request.parameters.vcponum,
                method: scriptContext.request.method.toUpperCase()
            };
            log.debug(logTitle, '>> Params: ' + JSON.stringify(Current));

            try {
                if (Current.method != 'GET') return;

                if (Current.task == 'viewForm') {
                    Current.Form = ns_ui.createForm({ title: 'VAR Connect | Debug Tool' });
                    Current.Form.clientScriptModulePath = './CTC_VC_DebugTool_CS.js';

                    var hiddenFields = {
                        suiteleturl: ns_url.resolveScript({
                            scriptId: ns_runtime.getCurrentScript().id,
                            deploymentId: ns_runtime.getCurrentScript().deploymentId
                        }),
                        currentfolder: vc2_util.getCurrentFolder()
                    };

                    ///// VENDOR CONFIG LIST ///////////////////////////////
                    var fldVendors = Current.Form.addField({
                        id: 'custpage_vendor',
                        type: ns_ui.FieldType.SELECT,
                        label: 'Select a Vendor Config'
                    });
                    fldVendors.updateBreakType({ breakType: ns_ui.FieldBreakType.STARTCOL });
                    fldVendors.isMandatory = true;

                    var arrActiveVendors = Helper.getActiveVendors();
                    arrActiveVendors.forEach(function (vendorEntry) {
                        if (!vc2_util.isEmpty(Current.vendorConfigId)) {
                            vendorEntry.isSelected = Current.vendorConfigId == vendorEntry.value;
                        }
                        fldVendors.addSelectOption(vendorEntry);
                        return true;
                    });

                    ////////////////////////////////////////////////////////

                    ///// PO NUM ///////////////////////////////////////////
                    var fldPONum = Current.Form.addField({
                        id: 'custpage_ponum',
                        type: ns_ui.FieldType.TEXT,
                        label: 'Enter PO Number'
                    });
                    fldPONum.isMandatory = true;
                    fldPONum.updateBreakType({ breakType: ns_ui.FieldBreakType.STARTROW });
                    if (Current.ponum) fldPONum.defaultValue = Current.ponum;
                    ////////////////////////////////////////////////////////

                    ////////////////////////////////////////
                    var fldContent = Current.Form.addField({
                        id: 'custpage_content',
                        label: 'Retrieved Order Status',
                        type: ns_ui.FieldType.INLINEHTML
                    });

                    fldContent.updateBreakType({ breakType: ns_ui.FieldBreakType.STARTROW });
                    fldContent.updateDisplaySize({ width: '250', height: '30' });

                    var cssHighlightStyle = '';
                    try {
                        cssHighlightStyle = ns_file.load({
                            id: './highlight/styles/github.min.css'
                        });
                    } catch (css_error) {
                        try {
                            cssHighlightStyle = ns_file.load({
                                id: 'SuiteScripts/VAR Connect/highlight/styles/github.min.css'
                            });
                        } catch (err) {}
                    }

                    fldContent.defaultValue = [
                        // '<span class="smallgraytextnolink">RETRIEVED ORDER STATUS</span>',

                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea" id="vcdebug_container" style="width: 100%; height: 720px;">',
                        '<div id="custpage_xml__loader" style="display: none;font-weight:bold; font-size: 1.2em; margin: 10px 0;"><span>Please wait...</span></div>',

                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">Retrieved Order Status</a>',
                        '</span></span>',

                        '<textarea cols="250" rows="30" disabled="true" id="vcdebugcontent" ',
                        'style="display: none;padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; background-color: #EEE; color: #363636 !important;">',
                        'Your PO',
                        '</textarea>',

                        '<iframe id="custpage_xml_viewer_frame" srcdoc="',
                        '<html>',
                        '<head>',
                        cssHighlightStyle.url
                            ? "<link rel='stylesheet' href='" + cssHighlightStyle.url + "'>"
                            : '',
                        '</head>',
                        '<body>',

                        "<pre id='custpage_xml__viewer' lang='xml'><code id='custpage_xml__viewer_content' class='language-xml' /></pre>",
                        "<pre id='custpage_json__viewer' lang='json' style='display:none;'><code id='custpage_json__viewer_content' class='language-json' /></pre>",

                        '</body>',
                        '</html>',
                        '" width=100% height=100% scrolling=yes allowTransparency="true" ></iframe>',
                        '</div>'
                    ].join('');

                    // fldContent.defaultValue = [
                    //     '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea" id="vcdebug_container">',
                    //     '<span class="smallgraytextnolink uir-label">',
                    //     '<span class="smallgraytextnolink">',
                    //     '<a class="smallgraytextnolink">Retrieved Order Status</a>',
                    //     '</span></span>',

                    //     '<textarea cols="250" rows="30" disabled="true" id="vcdebugcontent" ',
                    //     'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; background-color: #EEE; color: #363636 !important;">',
                    //     'Your PO',
                    //     '</textarea>',
                    //     '</div>'
                    // ].join('');

                    //////////////////////////////

                    for (var fld in hiddenFields) {
                        var fldObj = Current.Form.addField({
                            id: fld,
                            label: fld,
                            type: ns_ui.FieldType.LONGTEXT
                        });
                        fldObj.defaultValue = util.isString(hiddenFields[fld])
                            ? hiddenFields[fld]
                            : JSON.stringify(hiddenFields[fld]);
                        fldObj.updateDisplayType({ displayType: 'HIDDEN' });
                    }
                    ////////////////////////////////////////

                    Current.Form.addButton({
                        id: 'custpage_btnSubmit',
                        label: 'Display Data',
                        functionName: 'showResults'
                    });
                    scriptContext.response.writePage(Current.Form);
                } else {
                    scriptContext.response.write({ output: JSON.stringify(Current) });
                }
            } catch (error) {
                throw error;
            }
        }
    };

    return DebugTool_UI;
});
