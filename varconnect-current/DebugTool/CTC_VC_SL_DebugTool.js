/**
 * Copyright (c) 2024 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType Suitelet
 */
define(function (require) {
    const LogTitle = 'DebugTool';

    let vc2_util = require('../Services/lib/ctc_lib_utils');
    let ns_ui = require('N/ui/serverWidget'),
        ns_runtime = require('N/runtime'),
        ns_search = require('N/search'),
        ns_url = require('N/url'),
        ns_file = require('N/file');

    var DebugUI = {
        Form: null,
        viewDebug: function (option) {
            var logTitle = [LogTitle, 'viewDebug'].join('::'),
                returnValue;

            var Form = ns_ui.createForm({ title: 'VAR Connect | Debug Tool' });
            // Form.clientScriptModulePath = './CTC_VC_DebugTool_CS.js';

            // add the group
            Form.addTab({ id: 'tab_orderstatus', label: 'Order Status' });
            Form.addTab({ id: 'tab_debugpo', label: 'PO Timeline' });

            // global fields
            Helper.renderField({ id: 'vctask', displayType: 'HIDDEN' }, Form);
            Helper.renderField({ id: 'vcponum', displayType: 'HIDDEN' }, Form);

            Form.addButton({
                id: 'custpage_btnsubmit',
                label: 'Display Data',
                functionName: 'showResults'
            });

            /// VENDOR DEBUG ////
            Helper.renderField({
                id: 'custpage_vendor',
                type: ns_ui.FieldType.SELECT,
                label: 'Select Vendor Config',
                container: 'tab_orderstatus',
                Form: Form,
                breakType: ns_ui.FieldBreakType.STARTCOL,
                selectOptions: (function () {
                    var optionValues = [];
                    var arrActiveVendors = Helper.getActiveVendors();
                    arrActiveVendors.forEach(function (vendorEntry) {
                        if (!vc2_util.isEmpty(Current.vendorConfigId)) {
                            vendorEntry.isSelected = Current.vendorConfigId == vendorEntry.value;
                        }
                        optionValues.push(vendorEntry);
                        return true;
                    });

                    return optionValues;
                })()
            });
            Helper.renderField({
                id: 'custpage_postatus',
                label: 'PO Num',
                breakType: 'STARTROW',
                Form: Form
            });

            Helper.renderField({
                Form: Form,
                id: 'custpage_orderstatus',
                label: 'Order Status Content',
                type: ns_ui.FieldType.INLINEHTML,
                defaultValue: (function () {
                    var loaderCSS =
                            'display: none;font-weight:bold; font-size: 1.2em; margin: 10px 0;',
                        textareaCSS =
                            'display: none;padding: 5px 10px; margin: 5px; border:1px solid #CCC !important;' +
                            'background-color: #EEE; color: #363636 !important;';

                    return [
                        '<div class="uir-field-wrapper uir-long-text" ',
                        '       data-field-type="textarea" id="vcdebug_container"',
                        '       style="width: 100%; height: 720px;">',
                        '   <div id="custpage_xml__loader" style="' + loaderCSS + '">',
                        '       <span>Please wait...</span>',
                        '   </div>',

                        '   <textarea cols="250" rows="30" disabled="true" id="vcdebugcontent" ',
                        '               style="' + textareaCSS + '">Your PO</textarea>',

                        '<iframe id="custpage_xml_viewer_frame" width="100%" height="100%" srcdoc="',
                        '<html>',
                        '   <head></head>',
                        '   <body>',

                        '   <pre id="custpage_xml__viewer" lang="xml">',
                        '       <code id="custpage_xml__viewer_content" class="language-xml" /></pre>',
                        '   <pre id="custpage_json__viewer" lang="custpage_json__viewer" style="display:none;">',
                        '       <code id="custpage_json__viewer_content" class="language-json" /></pre>',

                        '   </body>',
                        '</html>',

                        '" scrolling=yes allowTransparency="true" ></iframe>', // #endtag: iframe

                        '</div>' // #endtag:uir-field-wrapper
                    ].join('');
                })()
            });

            /// PO DEBUG ////

            return returnValue;
        },
        resultsDebug: function (option) {
            var logTitle = [LogTitle, 'viewDebugAPI'].join('::'),
                returnValue;

            return returnValue;
        },
        resultsTimeline: function (option) {
            var logTitle = [LogTitle, 'viewDebugAPI'].join('::'),
                returnValue;

            return returnValue;
        }
    };

    var SUITELET = {
        onRequest: function (scriptContext) {
            var logTitle = [LogTitle, 'onRequest'].join('::');

            Current = {
                page: scriptContext.request.parameters.vctask || 'viewDebug',
                vendorId: scriptContext.request.parameters.vcvendor,
                poNum: scriptContext.request.parameters.vcponum,
                method: scriptContext.request.method.toUpperCase()
            };
            log.debug(logTitle, '>> Params: ' + JSON.stringify(Current));

            try {
                if (Current.method != 'GET') throw 'POST action is not allowed';
                if (!DebugUI[Current.page] || typeof DebugUI[Current.page] != 'function')
                    throw 'Unable to load the current page: ' + Current.page;

                DebugUI[Current.page].call(DebugUI);
            } catch (error) {
                scriptContext.write({
                    output:
                        ' ' +
                        ('<h1>Error Found: ' + vc2_util.extractError(error) + '</h1> ') +
                        '<p><strong>Details</strong><br/> ' +
                        JSON.stringify(error)
                });
            }

            return true;
        }
    };

    var Helper = {
        ctrFld: 0,
        ctrFG: 0,
        renderField: function (option, Form) {
            var logTitle = [LogTitle, 'RenderField'].join('::');
            this.ctrFld++;

            var fieldOption = {
                id: option.id || ['custpage_fld', new Date().getTime(), this.ctrFld].join('_'),
                label: option.label || 'Field #' + this.ctrFld,
                type: option.type || ns_ui.FieldType.TEXT,
                container: option.container || null
            };

            vc2_util.log(logTitle, '// fieldOption: ', fieldOption);

            Form = Form || option.Form || Current.Form;
            if (!Form) return false;

            /////////////////////////
            var fld = Form.addField(fieldOption);
            /////////////////////////

            if (option.displayType) fld.updateDisplayType({ displayType: option.displayType });
            if (option.breakType) fld.updateBreakType({ breakType: option.breakType });
            if (option.layoutType) fld.updateLayoutType({ layoutType: option.layoutType });
            if (option.displaySize) fld.updateDisplaySize(option.displaySize);

            vc2_util.log(logTitle, '// option: ', option);

            if (!vc2_util.isEmpty(option.defaultValue)) fld.defaultValue = option.defaultValue;

            // set the selections
            var selectOptions = option.selectOptions;
            if (option.type == ns_ui.FieldType.SELECT && !vc2_util.isEmpty(selectOptions)) {
                selectOptions.forEach(function (selOpt) {
                    fld.addSelectOption(selOpt);
                    return true;
                });
            }

            return fld;
        },
        renderFieldGroup: function (option, Form) {
            Form = Form || option.Form || Current.Form;
            if (!Form) return false;

            var fldGroup = Form.addFieldGroup({
                id: option.id || ['fldgroup', this.ctrFG++].join('_'),
                label: option.label
            });
            if (option.isSingleColumn) fldGroup.isSingleColumn = true;
            if (option.isBorderHidden) fldGroup.isBorderHidden = true;

            return fldGroup;
        },
        getActiveVendors: function () {
            var arrSeachResults = vc2_util.searchAllPaged({
                type: 'customrecord_ctc_vc_vendor_config',
                filterExpression: [['isinactive', 'is', 'F']],
                columns: [
                    'name',
                    'internalid',
                    ns_search.createColumn({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        sort: ns_search.Sort.ASC
                    })
                ]
            });

            var arrReturnValue = [];
            arrSeachResults.forEach(function (result) {
                var optionTextValue = [
                    result.getValue('name'),
                    ' [' + result.getText('custrecord_ctc_vc_xml_vendor') + '] '
                ].join('');
                arrReturnValue.push({
                    value: result.getValue('internalid'),
                    text: optionTextValue,
                    isSelected: !arrReturnValue.length
                });
                return true;
            });

            return arrReturnValue;
        }
    };

    return SUITELET;
});
