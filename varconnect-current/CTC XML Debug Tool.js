/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/search'], function (serverWidget, search) {
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
            subject.layoutType = serverWidget.FieldLayoutType.NORMAL;
            subject.breakType = serverWidget.FieldBreakType.STARTCOL;
            subject.isMandatory = true;

            var country = form.addField({
                id: 'country',
                type: serverWidget.FieldType.SELECT,
                source: 'customlist_ctc_vc_debug_country',
                label: 'Select Country'
            });
            subject.layoutType = serverWidget.FieldLayoutType.NORMAL;
            subject.breakType = serverWidget.FieldBreakType.STARTCOL;
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
            xmlViewer.defaultValue =
                '<span class="smallgraytextnolink">RETRIEVED ORDER STATUS</span><iframe id="custpage_xml_viewer_frame" src="/c.TSTDRV1716438/suiteapp/com.catalysttechcorp.varconnect/highlight/xmlViewer.html" width=100% height=720px scrolling=yes allowTransparency="true" />';
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
