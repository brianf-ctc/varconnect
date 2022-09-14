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

define(['N/ui/serverWidget', 'N/search', 'N/file'], function (serverWidget, search, file) {
    var logTitle = 'CTC XML Debug Tool';
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
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var request = context.request;
            var form = serverWidget.createForm({
                title: 'XML Debug Tool 2'
            });
            form.clientScriptModulePath = './CTC_VC_Lib_Debug_Tool.js';

            var vendors = form.addField({
                id: 'vendors',
                type: serverWidget.FieldType.SELECT,
                label: 'Select a Vendor'
            });
            vendors.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });
            vendors.isMandatory = true;
            var activeVendors = searchUtil.getAllResults(
                search.create({
                    type: 'customrecord_ctc_vc_vendor_config',
                    filters: [['isinactive', 'is', 'F']],
                    columns: [
                        search.createColumn({
                            name: 'custrecord_ctc_vc_xml_vendor',
                            summary: search.Summary.GROUP,
                            sort: search.Sort.ASC
                        })
                    ]
                })
            );
            for (var i = 0, len = activeVendors.length; i < len; i += 1) {
                vendors.addSelectOption({
                    value: activeVendors[i].getValue({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: search.Summary.GROUP
                    }),
                    text: activeVendors[i].getText({
                        name: 'custrecord_ctc_vc_xml_vendor',
                        summary: search.Summary.GROUP
                    }),
                    isSelected: i == 0
                });
            }
            var subject = form.addField({
                id: 'ponum',
                type: serverWidget.FieldType.TEXT,
                label: 'Enter PO Number'
            });
            subject.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTROW
            });
            subject.isMandatory = true;
            form.addTab({
                id: 'custpage_xml_tab',
                label: 'XML Viewer'
            });
            var xmlViewer = form.addField({
                id: 'custpage_xml_viewer',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'XML Viewer',
                container: 'custpage_xml_tab'
            });
            var xmlViewerStylesheet = {
                url: ''
            };
            try {
                xmlViewerStylesheet = file.load({
                    id: './highlight/styles/github.min.css'
                });
            } catch (fileLoadErr) {
                // VC might not recognize folders not in the original bundle
                try {
                    xmlViewerStylesheet = file.load({
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
                breakType: serverWidget.FieldBreakType.STARTROW
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
                functionName: 'showVendorName'
            });

            context.response.writePage(form);
        } else {
            context.response.write('Vendor Selected: ' + selectedVendor);
        }
    }
    return {
        onRequest: onRequest
    };
});
