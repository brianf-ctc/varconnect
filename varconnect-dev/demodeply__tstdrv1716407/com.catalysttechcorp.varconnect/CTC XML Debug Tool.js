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
    './CTC_VC2_Lib_Utils'
], function (ns_ui, ns_msg, ns_runtime, ns_search, ns_url, ns_file, vc_util) {
    var LogTitle = 'VC DebugTool';
    var searchUtil = {
        getAllResults: function (searchObject, maxResults) {
            var resultSet = null,
                isPagedRunFailed = false,
                allResults = [];
            try {
                resultSet = searchObject.runPaged({
                    pageSize: 1000
                });
            } catch (pageRunError) {
                log.error(logTitle, JSON.stringify(pageRunError));
                isPagedRunFailed = true;
                resultSet = searchObject.run();
            }
            for (
                var hasMore = true && resultSet.count !== 0,
                    ctr = 0,
                    i = 0,
                    count = resultSet.count || ctr + 1000;
                hasMore && ctr < count;
                i += 1, ctr += 1000
            ) {
                var results = null;
                if (!isPagedRunFailed) {
                    results = resultSet.fetch({
                        index: resultSet.pageRanges[i].index
                    });
                    if (maxResults && maxResults < ctr + 1000) {
                        allResults = allResults.concat(results.data.slice(0, maxResults));
                        hasMore = false;
                    } else {
                        allResults = allResults.concat(results.data);
                    }
                    if (results.data.length < 1000) hasMore = false;
                } else {
                    if (maxResults && maxResults < ctr + 1000) {
                        results = resultSet.getRange(ctr, maxResults);
                        hasMore = false;
                    } else {
                        results = resultSet.getRange(ctr, ctr + 1000);
                    }
                    allResults = allResults.concat(results);
                    if (results.length < 1000) hasMore = false;
                }
            }
            return allResults;
        }
    };

    var Helper = {
        getActiveVendors: function () {
            var arrSeachResults = vc_util.searchAllPaged({
                type: 'customrecord_ctc_vc_vendor_config',
                filterExpression: [['isinactive', 'is', 'F']],
                columns: [
                    ns_search.createColumn({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: ns_search.Summary.GROUP,
                        sort: ns_search.Sort.ASC
                    })
                ]
            });

            var arrReturnValue = [];
            arrSeachResults.forEach(function (result) {
                arrReturnValue.push({
                    value: result.getValue({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: ns_search.Summary.GROUP
                    }),
                    text: result.getText({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: ns_search.Summary.GROUP
                    }),
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
                    Current.Form.clientScriptModulePath = './CTC_VC_Lib_Debug_Tool.js';

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
                        if (!vc_util.isEmpty(Current.vendorConfigId)) {
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

                    fldContent.defaultValue = [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea" id="vcdebug_container">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">Retrieved Order Status</a>',
                        '</span></span>',
                        // LOADER  ////////////
                        '<textarea cols="250" rows="30" disabled="true" name="vcdebugcontent_loader" id="vcdebugcontent_loader" ',
                        'style="display:none;padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #000 !important; font-size: 1.5em;">',
                        'Please wait...',
                        '</textarea>',
                        // LOADER  ////////////

                        '<textarea cols="250" rows="30" disabled="true" id="vcdebugcontent" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; background-color: #EEE; color: #363636 !important;">',
                        'Your PO',
                        '</textarea>',
                        '</div>'
                    ].join('');

                    //////////////////////////////

                    var hiddenFields = {
                        suiteleturl: ns_url.resolveScript({
                            scriptId: ns_runtime.getCurrentScript().id,
                            deploymentId: ns_runtime.getCurrentScript().deploymentId
                        }),
                        currentfolder: JSON.stringify(vc_util.getCurrentFolder())
                    };

                    for (var fld in hiddenFields) {
                        var fldObj = Current.Form.addField({
                            id: fld,
                            label: fld,
                            type: ns_ui.FieldType.LONGTEXT
                        });
                        fldObj.defaultValue = hiddenFields[fld];
                        fldObj.updateDisplayType({ displayType: 'HIDDEN' });
                    }
                    ////////////////////////////////////////

                    Current.Form.addButton({
                        id: 'custpage_btnSubmit',
                        label: 'Display Data',
                        functionName: 'showVendorResults'
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

    function onRequest(context) {
        if (context.request.method === 'GET') {
            var request = context.request;
            var form = ns_ui.createForm({
                title: 'XML Debug Tool 2'
            });
            form.clientScriptModulePath = './CTC_VC_Lib_Debug_Tool.js';

            var vendors = form.addField({
                id: 'vendors',
                type: ns_ui.FieldType.SELECT,
                label: 'Select a Vendor'
            });
            vendors.updateBreakType({
                breakType: ns_ui.FieldBreakType.STARTCOL
            });
            vendors.isMandatory = true;
            var activeVendors = searchUtil.getAllResults(
                ns_search.create({
                    type: 'customrecord_ctc_vc_vendor_config',
                    filters: [['isinactive', 'is', 'F']],
                    columns: [
                        ns_search.createColumn({
                            name: 'custrecord_ctc_vc_xml_vendor',
                            summary: ns_search.Summary.GROUP,
                            sort: ns_search.Sort.ASC
                        })
                    ]
                })
            );
            for (var i = 0, len = activeVendors.length; i < len; i += 1) {
                vendors.addSelectOption({
                    value: activeVendors[i].getValue({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: ns_search.Summary.GROUP
                    }),
                    text: activeVendors[i].getText({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: ns_search.Summary.GROUP
                    }),
                    isSelected: i == 0
                });
            }
            var subject = form.addField({
                id: 'ponum',
                type: ns_ui.FieldType.TEXT,
                label: 'Enter PO Number'
            });
            subject.updateBreakType({
                breakType: ns_ui.FieldBreakType.STARTROW
            });
            subject.isMandatory = true;
            form.addTab({
                id: 'custpage_xml_tab',
                label: 'XML Viewer'
            });
            var xmlViewer = form.addField({
                id: 'custpage_xml_viewer',
                type: ns_ui.FieldType.INLINEHTML,
                label: 'XML Viewer',
                container: 'custpage_xml_tab'
            });
            var xmlViewerStylesheet = {
                url: ''
            };
            try {
                xmlViewerStylesheet = ns_file.load({
                    id: './highlight/styles/github.min.css'
                });
            } catch (fileLoadErr) {
                // VC might not recognize folders not in the original bundle
                try {
                    xmlViewerStylesheet = ns_file.load({
                        id: 'SuiteScripts/VAR Connect/highlight/styles/github.min.css'
                    });
                } catch (missingLibErr) {
                    log.error(logTitle, 'Failed to load css stylesheet for syntax highlighting.');
                }
            }
            xmlViewer.defaultValue = [
                '<span class="smallgraytextnolink">RETRIEVED ORDER STATUS</span>',
                '<div class="uir-field" style="width: 100%; height: 720px;">',
                "<div id='custpage_xml__loader' ",
                "style='display: none; justify-content: center; align-items: center; position: absolute; top: 0; left: 0; width: 100%; ",
                'height: 100%; z-index: 900; overflow: hidden; text-align: center; background-color: rgba(255, 255, 255, 0.85); ',
                "color: #666666; border-radius: 5px;'>",
                "<div style='display: inline-flex; flex-direction: column; justify-content: center; align-items: center;'>",
                "<div style='width: 32px; height: 32px; align-self: center;'>",
                "<svg viewBox='-18 -18 36 36' role='img' aria-label='Loading' ",
                "style='-webkit-animation: spin 2s ease infinite; -moz-animation: spin 2s ease infinite; animation: spin 2s ease infinite;'>",
                "<circle fill='none' r='16' style='stroke: #dfe4eb; stroke-width: 3px;'></circle>",
                "<circle fill='none' r='16' style='stroke: #607799; stroke-width: 3px; stroke-dashoffset: 75;' ",
                "transform='rotate(-135)' stroke-dasharray='100'></circle>",
                '</svg>',
                '</div>',
                "<span data-message='0'>Loading</span>",
                '</div>',
                '</div>',
                '<iframe id="custpage_xml_viewer_frame" srcdoc="',
                '<html>',
                '<head>',
                xmlViewerStylesheet.url
                    ? "<link rel='stylesheet' href='" + xmlViewerStylesheet.url + "'>"
                    : '',
                '</head>',
                '<body>',
                "<pre id='custpage_xml__viewer' lang='xml'><code id='custpage_xml__viewer_content' class='language-xml' /></pre>",
                "<pre id='custpage_json__viewer' lang='json' style='display:none;'><code id='custpage_json__viewer_content' class='language-json' /></pre>",
                '</body>',
                '</html>',
                '" width=100% height=100% scrolling=yes allowTransparency="true" ></iframe>'
            ].join('');
            xmlViewer.updateBreakType({
                breakType: ns_ui.FieldBreakType.STARTROW
            });
            form.updateDefaultValues({
                xmlViewer: '-',
                vendors: request.parameters.vendors,
                ponum: request.parameters.ponum,
                country: request.parameters.country
            });
            form.addButton({
                id: 'getxml',
                label: 'Display Data',
                functionName: 'showVendorResults'
            });

            context.response.writePage(form);
        } else {
            context.response.write('Vendor Selected: ' + selectedVendor);
        }
    }
    // return {
    //     onRequest: onRequest
    // };

    return DebugTool_UI;
});
