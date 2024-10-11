/**
 * Copyright (c) 2021 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * Script Name: CTC VC | VAR Connect Logs Search
 * Author: brianf@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @Description <Put some here..>
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    Remarks
 * 1.00		Jun 15, 2020	    brianff	Initial Build
 *
 */

define([
    'N/runtime',
    'N/ui/serverWidget',
    'N/url',

    'N/ui/message',
    'N/search',
    'N/record',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils'
], function (ns_runtime, ns_ui, ns_url, ns_msg, ns_search, ns_record, vc2_constant, vc2_util) {
    'use strict';

    var LogTitle = 'VC|LogSearchTool';

    var Pages = {
        entry: function (option) {
            var logTitle = [LogTitle, 'Pages.entry'].join('::'),
                returnValue;
            var Form = ns_ui.createForm({ title: 'VAR Connect | VC Log Search' });

            log.audit(logTitle, option);

            /// VC LOG SEARCH ID ///
            var VCLogSearchId = 'customsearch_ctc_vc_logs';

            // load the search
            var searchObj = ns_search.load({ id: VCLogSearchId });

            Form.addField({
                id: 'custpage_dumpdata',
                label: 'Search Data',
                type: ns_ui.FieldType.INLINEHTML
            }).defaultValue = JSON.stringify({
                totalCount: searchObj.runPaged().count,
                columns: searchObj.columns
            });

            // create the sublist
            UIHelper.PaginatedSublist({
                id: 'vclogs',
                label: 'VC Logs',
                form: Form,
                searchObj: searchObj,
                recordsPerPage: 200
            });

            option.Response.writePage({ pageObject: Form });
            return returnValue;
        }
    };

    var UIHelper = {
        Current: {},
        initialize: function (context) {
            util.extend(this.Current, {
                Method: context.request.method.toUpperCase(),
                Request: context.request,
                Response: context.response,
                Params: context.request.parameters
            });

            return this.Current;
        },
        loadPage: function (option) {
            var logTitle = [LogTitle, 'UIHelper.loadPage'].join('::'),
                returnValue;

            var currentPage = option.page;
            if (!currentPage) throw 'Unable to load page';

            var pageFn;
            if (this.Current.Method == 'POST' && currentPage.onPost) {
                pageFn = currentPage.onPost;
            } else if (this.Current.Method == 'GET') {
                pageFn = currentPage.onGet || currentPage;
            }

            if (!pageFn || !util.isFunction(pageFn)) throw 'Unable to load current page';

            pageFn.call(UIHelper, this.Current);

            return returnValue;
        },
        loadSearch: function (option) {}
    };

    UIHelper.PaginatedSublist = function (option) {
        var logTitle = [LogTitle, 'UIHelper.PaginatedSublist'].join('::');

        var Form = option.form || option.Form || UIHelper.Current.Form;
        if (!Form) throw 'Missing FORM!';

        // create the sublist
        var SublistInfo = {
            id: option.sublistId || option.id,
            label: option.sublistLabel || option.label,
            currentPage: option.currentPage || 1,
            hasCheckbox: option.hasCheckbox,
            selectedValues: option.selectedIds || option.selectedValues || [],
            selectedField: option.selectedField,
            columns: []
        };

        if (!option.searchObj) throw 'Missing search object';
        log.audit(logTitle, '>> searchObj:  ' + JSON.stringify(option.searchObj.searchType));

        var searchOption = {
                type: option.searchObj.searchType,
                filters: option.searchObj.filters,
                columns: []
            },
            ColumnsSort = option.sortCols || [],
            ColumnsDef = option.columnsDef || {};

        log.audit(logTitle, '>> searchOption:  ' + JSON.stringify(searchOption));

        var SortColumns = {};

        // var SearchObj = option.searchObj, ColumnsDef = option.columnsDef || {};
        SublistInfo.totalRecords = option.searchObj.runPaged().count;

        //// Extract Search Columns //////////////
        option.searchObj.columns.forEach(function (searchCol, idx) {
            var colData = {
                id: searchCol.name,
                fieldId: searchCol.name
            };
            util.extend(colData, ColumnsDef[searchCol.name]);

            if (!colData.type) colData.type = ns_ui.FieldType.TEXT;
            if (!colData.label)
                colData.label = searchCol.label || searchCol.name || 'Column #' + idx;

            var colSearch = { name: searchCol.name };
            if (searchCol.join) colSearch.join = searchCol.join;
            if (searchCol.summary) colSearch.summary = searchCol.summary;
            if (searchCol.formula) colSearch.formula = searchCol.formula;

            searchOption.columns.push(ns_search.createColumn(colSearch));

            if (ColumnsSort.length && vc2_util.inArray(searchCol.name, ColumnsSort)) {
                SortColumns[colData.label] = colData.id;
            }

            SublistInfo.columns.push(colData);
            return true;
        });
        SortColumns['Recently Created'] = 'created';
        SortColumns['Recently Modified'] = 'lastmodified';
        //////////////////////////////////////////

        log.audit(logTitle, '>> ColumnsSort:  ' + JSON.stringify(ColumnsSort));
        log.audit(logTitle, '>> SortColumns:  ' + JSON.stringify(SortColumns));

        /// Create the Sublist //////////////////
        var randomStr = vc2_util.randomStr(5);
        var sublistOption = {
            id: SublistInfo.id || ['sublist', randomStr].join('_'),
            label: SublistInfo.label || ['Sublist #', randomStr].join(''),
            type: ns_ui.SublistType.LIST
        };
        var tabOption = {
            id: ['tab_', sublistOption.id].join(''),
            label: option.tabLabel || sublistOption.label
        };

        sublistOption.tab = tabOption.id;

        if (!vc2_util.isEmpty(SublistInfo.selectedValues)) {
            sublistOption.label = [
                sublistOption.label,
                ' (selected: ' + SublistInfo.selectedValues.length + ') '
            ].join('');
        }

        // log.debug(logTitle, '>> sublist : ' + JSON.stringify(sublistOption));

        // create the field
        SublistInfo.Tab = Form.addTab(tabOption);
        SublistInfo.Field = Form.addSublist(sublistOption);

        ////////////////////////////////////////
        if (SublistInfo.hasCheckbox) {
            SublistInfo.Field.addButton({
                id: 'btn_markall',
                label: 'Mark All',
                functionName: 'actionMarkAll("' + SublistInfo.id + '");'
            });
            SublistInfo.Field.addButton({
                id: 'btn_markall',
                label: 'Unmark All',
                functionName: 'actionUnmarkAll("' + SublistInfo.id + '");'
            });
            SublistInfo.Field.addField({
                id: 'check',
                label: 'Select',
                type: ns_ui.FieldType.CHECKBOX
            });
            SublistInfo.Field.addField({
                id: 'recordid',
                label: 'ID',
                type: ns_ui.FieldType.TEXT
            }).updateDisplayType({
                displayType: ns_ui.FieldDisplayType.HIDDEN
            });

            ////////////////////////////////////////
            // add storage of selected items
            if (!option.selectedField) {
                SublistInfo.selectedItems = Form.addField({
                    id: ['custpage_selected_', sublistOption.id].join(''),
                    type: ns_ui.FieldType.LONGTEXT,
                    label: 'Selected Field',
                    container: sublistOption.tab || null
                });
                SublistInfo.selectedItems.updateDisplayType({
                    displayType: ns_ui.FieldDisplayType.HIDDEN
                });
                SublistInfo.selectedField = ['custpage_selected_', sublistOption.id].join('');
            }

            ////////////////////////////////////////
        }
        ////////////////////////////////////////

        // add the view/edit column /////////////
        SublistInfo.Field.addField({
            id: 'viewedit',
            label: 'View/Edit',
            type: ns_ui.FieldType.TEXT
        });

        /// Add sublist columns ////////////////
        var showColumns = option.showColumns || option.columnsOnly || option.columns || [];
        SublistInfo.columns.forEach(function (sublistCol) {
            if (!vc2_util.isEmpty(showColumns) && !vc2_util.inArray(sublistCol.id, showColumns))
                return true;

            var sublistOption = {};
            util.extend(sublistOption, sublistCol);

            if (sublistOption.type == 'SELECT') {
                sublistOption.type = ns_ui.FieldType.TEXT;
            }

            SublistInfo.Field.addField(sublistOption);
            return true;
        });
        ////////////////////////////////////////

        /// Add the sublist data ///////////////
        log.audit(logTitle, '>> searchOption:  ' + JSON.stringify(searchOption));
        var SearchObj = ns_search.create(searchOption);

        if (SublistInfo.totalRecords && SearchObj) {
            log.audit(logTitle, '>> quicksort:  ' + JSON.stringify(SublistInfo.currentSort));

            if (SublistInfo.currentSort && SublistInfo.currentSort != 'none') {
                log.audit(logTitle, '>> quicksort:  ' + JSON.stringify(SublistInfo.currentSort));

                SearchObj.columns.push(
                    ns_search.createColumn({
                        name: SublistInfo.currentSort,
                        sort: vc2_util.inArray(SublistInfo.currentSort, ['created', 'lastmodified'])
                            ? ns_search.Sort.DESC
                            : ns_search.Sort.ASC
                    })
                );
            } else {
                SearchObj.columns.push(
                    ns_search.createColumn({
                        name: 'created',
                        sort: ns_search.Sort.DESC
                    })
                );
                SearchObj.columns.push(
                    ns_search.createColumn({
                        name: 'lastmodified',
                        sort: ns_search.Sort.DESC
                    })
                );
            }

            var pagedResults = SearchObj.runPaged({
                pageSize: option.pageSize || option.recordsPerPage || 50
            });

            ////////////////////////////////////////
            // create the paginator
            if (pagedResults.pageRanges.length > 1) {
                SublistInfo.quickSorter = Form.addField({
                    id: ['custpage_quicksort_', sublistOption.id].join(''),
                    type: ns_ui.FieldType.SELECT,
                    label: 'Quick Sort ',
                    container: sublistOption.tab || null
                });
                SublistInfo.quickSorter.addSelectOption({
                    value: 'none',
                    text: '',
                    isSelected: !SublistInfo.currentSort || SublistInfo.currentSort == 'none'
                });
                for (var sortLabel in SortColumns) {
                    SublistInfo.quickSorter.addSelectOption({
                        value: SortColumns[sortLabel],
                        text: sortLabel,
                        isSelected: SublistInfo.currentSort == SortColumns[sortLabel]
                    });
                }

                SublistInfo.paginator = Form.addField({
                    id: ['custpage_pager_', sublistOption.id].join(''),
                    type: ns_ui.FieldType.SELECT,
                    label: 'Total Records: ' + SublistInfo.totalRecords,
                    container: sublistOption.tab || null
                });
                SublistInfo.paginator.updateBreakType({
                    breakType: ns_ui.FieldBreakType.STARTCOL
                });

                pagedResults.pageRanges.forEach(function (pageRow) {
                    SublistInfo.paginator.addSelectOption({
                        value: pageRow.index + 1,
                        text: ['Page ', pageRow.index + 1, ' | ', pageRow.compoundLabel].join(''),
                        isSelected: pageRow.index + 1 == SublistInfo.currentPage
                    });

                    return true;
                });

                var hackField = Form.addField({
                    id: ['custpage_hack_', sublistOption.id].join(''),
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Move Field',
                    container: sublistOption.tab || null
                });
                hackField.defaultValue = [
                    '<script type="text/javascript">',
                    'jQuery(document).ready(function(){',
                    'var paginator = jQuery("#',
                    SublistInfo.paginator.id,
                    '_fs_lbl").parents("form").get(0);',
                    'var container = jQuery("#',
                    sublistOption.id,
                    '_layer .uir-list-control-bar table").get(0);',
                    'console.log(paginator, container);',
                    'jQuery(paginator).appendTo(jQuery("<td></td>").prependTo(container));',
                    'jQuery("#',
                    SublistInfo.paginator.id,
                    '_fs_lbl").parents("table").css({width:"auto"});',
                    '});',
                    '</script>'
                ].join('');
            }
            ////////////////////////////////////////

            if (SublistInfo.hasCheckbox) {
                SublistInfo.selectedItemsCount = Form.addField({
                    id: ['custpage_selectedcount_', sublistOption.id].join(''),
                    type: ns_ui.FieldType.INLINEHTML,
                    label: 'Selected IDs',
                    container: sublistOption.tab || null
                });
                SublistInfo.selectedItemsCount.defaultValue = '&nbsp;';
            }

            /// add the sublist rows ///////////////
            var currentPageResults = pagedResults.fetch({ index: SublistInfo.currentPage - 1 });
            currentPageResults.data.forEach(function (result, lineNo) {
                if (SublistInfo.hasCheckbox) {
                    if (vc2_util.inArray(result.id, SublistInfo.selectedValues)) {
                        SublistInfo.Field.setSublistValue({
                            id: 'check',
                            line: lineNo,
                            value: 'T'
                        });
                    }

                    SublistInfo.Field.setSublistValue({
                        id: 'recordid',
                        line: lineNo,
                        value: result.id
                    });
                }

                var recordUrl = {
                    view: ns_url.resolveRecord({
                        recordType: result.recordType,
                        recordId: result.id
                    }),
                    edit: ns_url.resolveRecord({
                        recordType: result.recordType,
                        recordId: result.id,
                        isEditMode: true
                    })
                };

                SublistInfo.Field.setSublistValue({
                    id: 'viewedit',
                    line: lineNo,
                    value: [
                        '<a href="' +
                            recordUrl.view +
                            '" target="_blank" class="dottedlink viewitem">View</a>',
                        '<a href="' +
                            recordUrl.edit +
                            '" target="_blank" class="dottedlink edititem">Edit</a>'
                    ].join(' | ')
                });

                SublistInfo.columns.forEach(function (sublistCol) {
                    var columnValue =
                        result.getText({ name: sublistCol.fieldId }) ||
                        result.getValue({ name: sublistCol.fieldId }) ||
                        '';

                    if (!columnValue) return;
                    if (columnValue.length > 250) columnValue = columnValue.substr(0, 250) + '...';

                    if (sublistCol.type == 'SELECT' && sublistCol.recordType) {
                        columnValue = [
                            '<a href="',
                            ns_url.resolveRecord({
                                recordType: sublistCol.recordType,
                                recordId: result.getValue({ name: sublistCol.fieldId })
                            }),
                            '" target="_blank">',
                            columnValue,
                            '</a>'
                        ].join('');
                    }

                    SublistInfo.Field.setSublistValue({
                        id: sublistCol.id,
                        line: lineNo,
                        value: '<span style="font-size:12px;">' + columnValue + '</a>'
                    });

                    return true;
                });

                return true;
            });
            ////////////////////////////////////////
        }
        ////////////////////////////////////////

        var sublistInfoField = Form.addField({
            id: ['custpage_sublistinfo_', sublistOption.id].join(''),
            type: ns_ui.FieldType.INLINEHTML,
            label: 'SublistInfo',
            container: sublistOption.tab || null
        });
        sublistInfoField.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
        sublistInfoField.defaultValue = JSON.stringify(SublistInfo);

        var sublistInfoIframe = Form.addField({
            id: ['custpage_iframe_', sublistOption.id].join(''),
            type: ns_ui.FieldType.INLINEHTML,
            label: 'Sublist_Iframe',
            container: sublistOption.tab || null
        });
        // sublistInfoIframe.updateDisplayType({displayType: ns_ui.FieldDisplayType.HIDDEN});

        sublistInfoIframe.defaultValue = [
            '<iframe name="iframe_',
            sublistOption.id,
            '" src=""',
            ' style="display: none;width:1px;height:1px;"></iframe> '
        ].join('');

        SublistInfo.iframe = 'iframe_' + sublistOption.id;

        // UIHelper.LIST_Sublist.push(SublistInfo);

        return SublistInfo;
    };

    return {
        onRequest: function (context) {
            var logTitle = [LogTitle, 'onRequest'].join('::'),
                returnValue;

            UIHelper.initialize(context);
            UIHelper.loadPage({ page: Pages.entry });

            // context.response.writePage({ pageObject: form });
        }
    };
});
