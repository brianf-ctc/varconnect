/**
 * Copyright (c) 2020 Catalyst Tech Corp
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
 */
define([
    'N/runtime',
    'N/redirect',
    'N/url',
    'N/search',
    'N/ui/serverWidget',
    'N/ui/message'
], function (NS_Runtime, NS_Redir, NS_Url, NS_Search, NS_UI, NS_Msg) {
    var LogTitle = 'UIHelper',
        Helper = {
            isEmpty: function (stValue) {
                return (
                    stValue === '' ||
                    stValue == null ||
                    stValue == undefined ||
                    stValue == 'undefined' ||
                    stValue == 'null' ||
                    (util.isArray(stValue) && stValue.length == 0) ||
                    (util.isObject(stValue) &&
                        (function (v) {
                            for (var k in v) return false;
                            return true;
                        })(stValue))
                );
            },
            inArray: function (stValue, arrValue) {
                if (!stValue || !arrValue) return false;
                for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
                return i > -1;
            },
            randomStr: function (len) {
                len = len || 5;
                var str = new Date().getTime().toString();
                return str.substring(str.length - len, str.length);
            }
        },
        Lib_UIHelper = {
            Method: null,
            Request: null,
            Response: null,
            Form: null,
            ActionParam: 'sletact',
            Pages: {}
        };

    Lib_UIHelper.initialize = function (context, option) {
        var logTitle = [LogTitle, 'initialize'].join('::');
        option = option || {};

        log.debug(logTitle, '>> option: ' + JSON.stringify(option));
        log.debug(logTitle, '>> context: ' + JSON.stringify(context));
        log.debug(logTitle, '>> Lib_UIHelper: ' + JSON.stringify(Lib_UIHelper));

        Lib_UIHelper = util.extend(Lib_UIHelper, {
            Method: context.request.method.toUpperCase(),
            Request: context.request || null,
            Response: context.response || null,
            Pages: option.pages || null,
            defaultPage: option.defaultPage || null,
            Form: option.form || null
        });

        log.debug(logTitle, '>> Lib_UIHelper: ' + JSON.stringify(Lib_UIHelper));

        if (option.form) {
            Lib_UIHelper.setForm(option.form, option);
        }

        return Lib_UIHelper;
    };

    Lib_UIHelper.setForm = function (form, option) {
        var logTitle = [LogTitle, 'setForm'].join('::'),
            returnValue;
        option = option || {};

        if (!form) return false;
        var actionField = form.addField({
            id: Lib_UIHelper.ActionParam,
            type: NS_UI.FieldType.TEXT,
            label: '# Action Param'
        });

        actionField.defaultValue =
            option.actionParamValue || Lib_UIHelper.Request.parameters[Lib_UIHelper.ActionParam];
        actionField.updateDisplayType({ displayType: NS_UI.FieldDisplayType.HIDDEN });
        return actionField;
    };

    /// Pages ////////////////////////////
    Lib_UIHelper.loadPage = function (option) {
        var logTitle = [LogTitle, 'loadPage'].join('::'),
            returnValue;
        option = option || {};

        var pageName = option.pageName || option.page;
        if (!Lib_UIHelper.Pages || !pageName || !Lib_UIHelper.Pages[pageName]) {
            log.audit(
                logTitle,
                '## WARNING ## ' + 'Unable to load the requested page: ' + pageName
            );
            return false;
        }

        var pageFn;
        log.audit(logTitle, '>> [' + Lib_UIHelper.Method + ']  Loading page... [' + pageName + ']');
        if (Lib_UIHelper.Method == 'GET') {
            pageFn = Lib_UIHelper.Pages[pageName].onGet || Lib_UIHelper.Pages[pageName];
        } else {
            pageFn = Lib_UIHelper.Pages[pageName].onPost || Lib_UIHelper.Pages[pageName];
        }

        if (!pageFn || !util.isFunction(pageFn)) {
            log.audit(
                logTitle,
                '## WARNING ## ' + 'Unable to load the requested page: ' + pageName
            );
            return false;
        }

        Lib_UIHelper.currentPage = pageFn;

        ///////////
        pageFn.call(Lib_UIHelper, option);
        ///////////

        return true;
    };
    Lib_UIHelper.loadCurrentPage = function (option) {
        var logTitle = [LogTitle, 'loadCurrentPage'].join('::'),
            returnValue;
        option = option || {};

        var pageName =
            Lib_UIHelper.Request.parameters[Lib_UIHelper.ActionParam] ||
            option.defaultPage ||
            Lib_UIHelper.defaultPage;

        return Lib_UIHelper.loadPage({ pageName: pageName });
    };
    Lib_UIHelper.redirTo = function (option) {
        var logTitle = [LogTitle, 'redirTo'].join('::'),
            returnValue;
        option = option || {};

        var pageName = option.pageName || option.page;
        var params = option.params || {};
        params[Lib_UIHelper.ActionParam] = pageName;

        return NS_Redir.toSuitelet({
            scriptId: NS_Runtime.getCurrentScript().id,
            deploymentId: NS_Runtime.getCurrentScript().deploymentId,
            params: params
        });

        // return Lib_UIHelper.loadPage({pageName: pageName});
    };
    //////////////////////////////////////

    /// Paginated Sublist ///////////////
    Lib_UIHelper.LIST_Sublist = [];
    Lib_UIHelper.PaginatedSublist = function (option) {
        var logTitle = [LogTitle, 'PaginatedSublist'].join('::');

        var Form = option.form || option.Form || Lib_UIHelper.Form;
        if (!Form) return false;

        // create the sublist
        var SublistInfo = {
            id: option.sublistId || option.id,
            label: option.sublistLabel || option.label,
            currentPage: option.currentPage || 1,
            hasCheckbox: option.hasCheckbox,
            selectedValues: option.selectedIds || option.selectedValues || [],
            selectedField: option.selectedField,
            paramPager: option.paramPager || ['pg', Lib_UIHelper.LIST_Sublist.length + 1].join(''),
            paramSorter:
                option.paramSorter || ['qs', Lib_UIHelper.LIST_Sublist.length + 1].join(''),
            columns: []
        };

        // get the current page
        SublistInfo.currentPage = Lib_UIHelper.Request.parameters[SublistInfo.paramPager] || 1;
        SublistInfo.currentSort = Lib_UIHelper.Request.parameters[SublistInfo.paramSorter] || null;

        if (!option.searchObj) return false;
        log.audit(logTitle, '>> searchObj:  ' + JSON.stringify(option.searchObj.searchType));

        var searchOption = {
                type: option.searchObj.searchType,
                filters: option.searchObj.filters,
                columns: []
            },
            ColumnsSort = option.sortCols || [],
            ColumnsDef = option.columnsDef || {};

        log.audit(logTitle, '>> searchOption:  ' + JSON.stringify(searchOption));
        log.audit(logTitle, '>> ColumnsDef:  ' + JSON.stringify(ColumnsDef));

        var SortColumns = {};

        // var SearchObj = option.searchObj, ColumnsDef = option.columnsDef || {};
        SublistInfo.totalRecords = option.searchObj.runPaged().count;

        //// Extract Search Columns //////////////
        option.searchObj.columns.forEach(function (searchCol, idx) {
            var colData = {
                id: searchCol.name,
                fieldId: searchCol.name
            };

            if (colData.fieldId.match(/formula/i)) {
                colData.fieldId += '_' + idx;
                colData.id += '_' + idx;
            }

            util.extend(colData, ColumnsDef[colData.id]);

            if (!colData.type) colData.type = NS_UI.FieldType.TEXT;
            if (!colData.label)
                colData.label = searchCol.label || searchCol.name || 'Column #' + idx;

            var colSearch = { name: searchCol.name };
            if (searchCol.join) colSearch.join = searchCol.join;
            if (searchCol.summary) colSearch.summary = searchCol.summary;
            if (searchCol.formula) colSearch.formula = searchCol.formula;

            searchOption.columns.push(NS_Search.createColumn(colSearch));

            if (ColumnsSort.length && Helper.inArray(searchCol.name, ColumnsSort)) {
                SortColumns[colData.label] = colData.id;
            }

            log.audit(logTitle, '## colSearch: ' + JSON.stringify(colSearch));
            log.audit(logTitle, '## colData: ' + JSON.stringify(colData));
            SublistInfo.columns.push(colData);
            return true;
        });
        // SortColumns['Recently Created'] = 'created';
        // SortColumns['Recently Modified'] = 'lastmodified';
        //////////////////////////////////////////

        log.audit(logTitle, '>> ColumnsSort:  ' + JSON.stringify(ColumnsSort));
        log.audit(logTitle, '>> SortColumns:  ' + JSON.stringify(SortColumns));

        /// Create the Sublist //////////////////
        var randomStr = Helper.randomStr(5);
        var sublistOption = {
            id: SublistInfo.id || ['sublist', randomStr].join('_'),
            label: SublistInfo.label || ['Sublist #', randomStr].join(''),
            type: NS_UI.SublistType.LIST
        };
        var tabOption = {
            id: ['tab_', sublistOption.id].join(''),
            label: option.tabLabel || sublistOption.label
        };

        sublistOption.tab = tabOption.id;

        if (!Helper.isEmpty(SublistInfo.selectedValues)) {
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
                type: NS_UI.FieldType.CHECKBOX
            });
            SublistInfo.Field.addField({
                id: 'recordid',
                label: 'ID',
                type: NS_UI.FieldType.TEXT
            }).updateDisplayType({
                displayType: NS_UI.FieldDisplayType.HIDDEN
            });

            ////////////////////////////////////////
            // add storage of selected items
            if (!option.selectedField) {
                SublistInfo.selectedItems = Form.addField({
                    id: ['custpage_selected_', sublistOption.id].join(''),
                    type: NS_UI.FieldType.LONGTEXT,
                    label: 'Selected Field',
                    container: sublistOption.tab || null
                });
                SublistInfo.selectedItems.updateDisplayType({
                    displayType: NS_UI.FieldDisplayType.HIDDEN
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
            type: NS_UI.FieldType.TEXT
        });

        /// Add sublist columns ////////////////
        var showColumns = option.showColumns || option.columnsOnly || option.columns || [];
        SublistInfo.columns.forEach(function (sublistCol) {
            if (!Helper.isEmpty(showColumns) && !Helper.inArray(sublistCol.id, showColumns))
                return true;

            var sublistOption = {};
            util.extend(sublistOption, sublistCol);

            if (sublistOption.type == 'SELECT') {
                sublistOption.type = NS_UI.FieldType.TEXT;
            }

            SublistInfo.Field.addField(sublistOption);
            return true;
        });
        ////////////////////////////////////////

        /// Add the sublist data ///////////////
        log.audit(logTitle, '>> searchOption:  ' + JSON.stringify(searchOption));
        var SearchObj = NS_Search.create(searchOption);

        if (SublistInfo.totalRecords && SearchObj) {
            log.audit(logTitle, '>> quicksort:  ' + JSON.stringify(SublistInfo.currentSort));
            // if (SublistInfo.currentSort && SublistInfo.currentSort != 'none') {
            //     log.audit(logTitle, '>> quicksort:  ' + JSON.stringify(SublistInfo.currentSort));

            //     SearchObj.columns.push(
            //         NS_Search.createColumn({
            //             name: SublistInfo.currentSort,
            //             sort: Helper.inArray(SublistInfo.currentSort, ['created', 'lastmodified'])
            //                 ? NS_Search.Sort.DESC
            //                 : NS_Search.Sort.ASC
            //         })
            //     );
            // } else {
            //     SearchObj.columns.push(
            //         NS_Search.createColumn({
            //             name: 'created',
            //             sort: NS_Search.Sort.DESC
            //         })
            //     );
            //     SearchObj.columns.push(
            //         NS_Search.createColumn({
            //             name: 'lastmodified',
            //             sort: NS_Search.Sort.DESC
            //         })
            //     );
            // }

            var pagedResults = SearchObj.runPaged({
                pageSize: option.pageSize || option.recordsPerPage || 50
            });

            log.audit(logTitle, '>> total pages: ' + pagedResults.pageRanges.length);

            ////////////////////////////////////////
            // create the paginator
            // if (pagedResults.pageRanges.length > 1) {
            //     SublistInfo.quickSorter = Form.addField({
            //         id: ['custpage_quicksort_', sublistOption.id].join(''),
            //         type: NS_UI.FieldType.SELECT,
            //         label: 'Quick Sort ',
            //         container: sublistOption.tab || null
            //     });
            //     SublistInfo.quickSorter.addSelectOption({
            //         value: 'none',
            //         text: '',
            //         isSelected: !SublistInfo.currentSort || SublistInfo.currentSort == 'none'
            //     });
            //     for (var sortLabel in SortColumns) {
            //         SublistInfo.quickSorter.addSelectOption({
            //             value: SortColumns[sortLabel],
            //             text: sortLabel,
            //             isSelected: SublistInfo.currentSort == SortColumns[sortLabel]
            //         });
            //     }

            //     SublistInfo.paginator = Form.addField({
            //         id: ['custpage_pager_', sublistOption.id].join(''),
            //         type: NS_UI.FieldType.SELECT,
            //         label: 'Total Records: ' + SublistInfo.totalRecords,
            //         container: sublistOption.tab || null
            //     });
            //     SublistInfo.paginator.updateBreakType({
            //         breakType: NS_UI.FieldBreakType.STARTCOL
            //     });

            //     pagedResults.pageRanges.forEach(function (pageRow) {
            //         SublistInfo.paginator.addSelectOption({
            //             value: pageRow.index + 1,
            //             text: ['Page ', pageRow.index + 1, ' | ', pageRow.compoundLabel].join(''),
            //             isSelected: pageRow.index + 1 == SublistInfo.currentPage
            //         });

            //         return true;
            //     });

            //     var hackField = Form.addField({
            //         id: ['custpage_hack_', sublistOption.id].join(''),
            //         type: NS_UI.FieldType.INLINEHTML,
            //         label: 'Move Field',
            //         container: sublistOption.tab || null
            //     });
            //     hackField.defaultValue = [
            //         '<script type="text/javascript">',
            //         'jQuery(document).ready(function(){',
            //         'var paginator = jQuery("#',
            //         SublistInfo.paginator.id,
            //         '_fs_lbl").parents("form").get(0);',
            //         'var container = jQuery("#',
            //         sublistOption.id,
            //         '_layer .uir-list-control-bar table").get(0);',
            //         'console.log(paginator, container);',
            //         'jQuery(paginator).appendTo(jQuery("<td></td>").prependTo(container));',
            //         'jQuery("#',
            //         SublistInfo.paginator.id,
            //         '_fs_lbl").parents("table").css({width:"auto"});',
            //         '});',
            //         '</script>'
            //     ].join('');
            // }
            ////////////////////////////////////////

            // if (SublistInfo.hasCheckbox) {
            //     SublistInfo.selectedItemsCount = Form.addField({
            //         id: ['custpage_selectedcount_', sublistOption.id].join(''),
            //         type: NS_UI.FieldType.INLINEHTML,
            //         label: 'Selected IDs',
            //         container: sublistOption.tab || null
            //     });
            //     SublistInfo.selectedItemsCount.defaultValue = '&nbsp;';
            // }

            /// add the sublist rows ///////////////
            var currentPageResults = pagedResults.fetch({ index: SublistInfo.currentPage - 1 });

            log.audit(logTitle, '>>> results data: ' + JSON.stringify(currentPageResults.data));
            currentPageResults.data.forEach(function (result, lineNo) {
                log.audit(logTitle, '... results: ' + JSON.stringify(result));
                log.audit(
                    logTitle,
                    '... SublistInfo.columns: ' + JSON.stringify(SublistInfo.columns)
                );

                // if (SublistInfo.hasCheckbox) {
                //     if (Helper.inArray(result.id, SublistInfo.selectedValues)) {
                //         SublistInfo.Field.setSublistValue({
                //             id: 'check',
                //             line: lineNo,
                //             value: 'T'
                //         });
                //     }

                //     SublistInfo.Field.setSublistValue({
                //         id: 'recordid',
                //         line: lineNo,
                //         value: result.id
                //     });
                // }

                // var recordUrl = {
                //     view: NS_Url.resolveRecord({
                //         recordType: result.recordType,
                //         recordId: result.id
                //     }),
                //     edit: NS_Url.resolveRecord({
                //         recordType: result.recordType,
                //         recordId: result.id,
                //         isEditMode: true
                //     })
                // };

                // SublistInfo.Field.setSublistValue({
                //     id: 'viewedit',
                //     line: lineNo,
                //     value: [
                //         '<a href="' +
                //             recordUrl.view +
                //             '" target="_blank" class="dottedlink viewitem">View</a>',
                //         '<a href="' +
                //             recordUrl.edit +
                //             '" target="_blank" class="dottedlink edititem">Edit</a>'
                //     ].join(' | ')
                // });

                var cntFormula = 0;

                SublistInfo.columns.forEach(function (sublistCol) {
                    var colName = sublistCol.fieldId,
                        columnValue;

                    if (sublistCol.summary) {
                        // colName = [sublistCol.summary, '(', colName, ')'];
                        // if (sublistCol.colname == 'formulanumeric') {
                        //     if (cntFormula) colName += '_' + cntFormula;
                        //     cntFormula++;
                        // }

                        columnValue = result.getValue({
                            name: sublistCol.colname || sublistCol.fieldId,
                            summary: sublistCol.summary
                        });
                    } else {
                        columnValue =
                            result.getText({ name: sublistCol.fieldId }) ||
                            result.getValue({ name: sublistCol.fieldId }) ||
                            '';
                    }

                    log.audit(logTitle, '... value: ' + JSON.stringify(columnValue));
                    log.audit(logTitle, '... colName: ' + JSON.stringify(colName));

                    if (!columnValue) return;
                    if (columnValue.length > 250) columnValue = columnValue.substr(0, 250) + '...';

                    if (sublistCol.type == 'SELECT' && sublistCol.recordType) {
                        columnValue = [
                            '<a href="',
                            NS_Url.resolveRecord({
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
            type: NS_UI.FieldType.INLINEHTML,
            label: 'SublistInfo',
            container: sublistOption.tab || null
        });
        sublistInfoField.updateDisplayType({ displayType: NS_UI.FieldDisplayType.HIDDEN });
        sublistInfoField.defaultValue = JSON.stringify(SublistInfo);

        var sublistInfoIframe = Form.addField({
            id: ['custpage_iframe_', sublistOption.id].join(''),
            type: NS_UI.FieldType.INLINEHTML,
            label: 'Sublist_Iframe',
            container: sublistOption.tab || null
        });
        // sublistInfoIframe.updateDisplayType({displayType: NS_UI.FieldDisplayType.HIDDEN});

        sublistInfoIframe.defaultValue = [
            '<iframe name="iframe_',
            sublistOption.id,
            '" src=""',
            ' style="display: none;width:1px;height:1px;"></iframe> '
        ].join('');

        SublistInfo.iframe = 'iframe_' + sublistOption.id;

        Lib_UIHelper.LIST_Sublist.push(SublistInfo);

        return SublistInfo;
    };
    //////////////////////////////////////

    return Lib_UIHelper;
});
