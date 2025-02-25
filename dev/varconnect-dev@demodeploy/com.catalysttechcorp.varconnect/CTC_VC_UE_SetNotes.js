/**
 * Copyright (c) 2025 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * VAR Connect
 * Script Name: CTC VAR Connect Display PO Logs
 * Author: christian@nscatalyst.com
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @Description Gets and sets VC status for this transaction
 *
 * Change logs:
 * Version  Date            Author                      Remarks
 * 1.01     Jun 1, 2022     christian@nscatalyst.com    Gets and sets VC status for this transaction
 *
 **/
define([
    'N/record',
    'N/runtime',
    'N/search',
    'N/url',
    'N/ui/serverWidget',
    'N/format',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js'
], function (ns_record, ns_runtime, ns_search, ns_url, ns_ui, ns_format, vc2_util, vc2_constant) {
    var LogTitle = 'VC UE Set Status';

    var EventActionsHelper = {},
        EventRouter = {},
        ContextData = {},
        SUDO_ACTIONS = {};

    var VARConnect = {
        setVCLogStatus: function (ContextData, context) {
            var logTitle = [LogTitle, 'setVCLogStatus'].join('.'),
                EVENT_TYPE = context.UserEventType,
                FORM = context.form,
                recordId = context.newRecord.id,
                logFields = vc2_constant.RECORD.VC_LOG.FIELD,
                returnValue = true;
            // search logs related to PO
            var maxLogDate = null;
            var filters = [[logFields.TRANSACTION, 'anyof', [recordId]]];
            var columns = [
                ns_search.createColumn({
                    name: logFields.DATE,
                    summary: ns_search.Summary.MAX
                })
            ];
            var searchOptions = {
                type: vc2_constant.RECORD.VC_LOG.ID,
                filters: filters,
                columns: columns
            };
            var logDateSearch = ns_search.create(searchOptions);
            log.debug(
                logTitle,
                'Search date for latest log entries. ' + JSON.stringify(searchOptions)
            );
            var maxLogDateResults = logDateSearch.run().getRange(0, 1);
            if (maxLogDateResults && maxLogDateResults.length) {
                try {
                    maxLogDate = ns_format.parse({
                        value: maxLogDateResults[0].getValue(columns[0]),
                        type: ns_format.Type.DATETIME
                    });
                } catch (parseErr) {
                    // results did not return a valid date
                    // do nothing
                }
            }
            log.audit(logTitle, 'VC latest log entries were on ' + maxLogDate);
            if (maxLogDate) {
                filters = [
                    [logFields.TRANSACTION, 'anyof', recordId],
                    'and',
                    [
                        logFields.DATE,
                        'on',
                        ns_format.format({
                            value: maxLogDate,
                            type: ns_format.Type.DATE
                        })
                    ]
                ];
                columns = [
                    ns_search.createColumn({
                        name: 'internalid'
                    }),
                    ns_search.createColumn({
                        name: logFields.TRANSACTION_LINEKEY,
                        sort: ns_search.Sort.ASC
                    }),
                    ns_search.createColumn({
                        name: logFields.BODY
                    })
                ];
                searchOptions.filters = filters;
                searchOptions.columns = columns;
                var pagedLogSearch = ns_search.create(searchOptions);
                log.debug(logTitle, 'Search latest log entries. ' + JSON.stringify(searchOptions));
                var pagedLogResults = pagedLogSearch.runPaged({
                    pageSize: 1000
                });
                var arrLogResults = [];
                // go through search pages
                for (var i = 0, j = pagedLogResults.pageRanges.length; i < j; i++) {
                    var logPage = pagedLogResults.fetch({
                        index: pagedLogResults.pageRanges[i].index
                    });
                    arrLogResults = arrLogResults.concat(logPage.data.slice(0, 1000));
                    if (logPage.data.length < 1000) break;
                }
                // hand pick latest values
                arrLogResults = arrLogResults.reverse();
                var mapLogStatusMessage = {};
                for (var x = 0, y = arrLogResults.length; x < y; x++) {
                    var logResult = arrLogResults[x];
                    var statusMessage = logResult.getValue(logFields.BODY);
                    var lineKey = logResult.getValue(logFields.TRANSACTION_LINEKEY);
                    if (!lineKey) lineKey = 'main';
                    else lineKey = lineKey + '';
                    if (!mapLogStatusMessage.hasOwnProperty(lineKey)) {
                        mapLogStatusMessage[lineKey] = statusMessage;
                    }
                }
                log.debug(logTitle, 'VC log messages=' + JSON.stringify(mapLogStatusMessage));
                var lineKeys = Object.keys(mapLogStatusMessage);
                if (lineKeys.length) {
                    FORM.addField({
                        id: 'custpage_ctc_vc_log_message',
                        label: 'VC Notes',
                        type: ns_ui.FieldType.LONGTEXT,
                        container: 'custom186' // var connect tab
                    });
                    var itemSublist = FORM.getSublist({
                        id: 'item'
                    });
                    itemSublist.addField({
                        id: 'custpage_ctc_vc_log_col_message',
                        label: 'VC Notes',
                        type: ns_ui.FieldType.TEXTAREA
                    });
                    log.debug(logTitle, 'Added custom fields.');
                    var mapLineKeyToLine = {};
                    for (var lineUniqueKey in mapLogStatusMessage) {
                        if (lineUniqueKey == 'main') {
                            context.newRecord.setValue({
                                fieldId: 'custpage_ctc_vc_log_message',
                                value: mapLogStatusMessage[lineUniqueKey]
                            });
                            mapLineKeyToLine[lineUniqueKey] = 'header';
                        } else {
                            var line = context.newRecord.findSublistLineWithValue({
                                sublistId: 'item',
                                fieldId: 'lineuniquekey',
                                value: lineUniqueKey
                            });
                            if (line >= 0) {
                                context.newRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custpage_ctc_vc_log_col_message',
                                    value: mapLogStatusMessage[lineUniqueKey].substr(0, 4000),
                                    line: line
                                });
                            }
                            mapLineKeyToLine[lineUniqueKey] = line;
                        }
                    }
                    log.debug(logTitle, 'Custom fields set. ' + JSON.stringify(mapLineKeyToLine));
                }
            }
            return returnValue;
        }
    };

    //////////////////
    EventRouter[ns_record.Type.PURCHASE_ORDER] = {
        beforeLoad: function (ContextData, context) {
            var logTitle = LogTitle,
                EVENT_TYPE = context.UserEventType,
                returnValue = true;
            // functions which resubmit
            if ([EVENT_TYPE.VIEW].indexOf(ContextData.eventType) >= 0) {
                log.debug(logTitle, 'Execute:fn(VC.setVCLogStatus)');
                VARConnect.setVCLogStatus(ContextData, context);
            }
            return returnValue;
        }
    };

    ///////////////////////////////////// NO NEED TO TOUCH BELOW CODE {{
    EventActionsHelper = {
        initialize: function (context) {
            ContextData = {
                eventType: context.type,
                execType: ns_runtime.executionContext,
                recordType: context.newRecord.type,
                recordId: context.newRecord.id,
                form: context.form
            };

            if (ContextData.recordId) {
                ContextData.recordUrl = ns_url.resolveRecord({
                    recordType: ContextData.recordType,
                    recordId: ContextData.recordId
                });
            }
            ContextData.newRecord = context.newRecord;
            return ContextData;
        },
        executeSudo: function (context) {
            var EVENT_TYPE = context.UserEventType,
                FORM = context.form,
                CONTEXT_TYPE = ns_runtime.ContextType;

            /// SUDO ACTIONS /////////////////////////////////////////
            if (
                [EVENT_TYPE.VIEW, EVENT_TYPE.CREATE].indexOf(ContextData.eventType) >= 0 &&
                [CONTEXT_TYPE.USER_INTERFACE].indexOf(ContextData.execType) >= 0
            ) {
                var paramSudo = context.request.parameters.sudo;
                if (!vc2_util.isEmpty(paramSudo) && SUDO_ACTIONS[paramSudo]) {
                    var result = SUDO_ACTIONS[paramSudo].call(SUDO_ACTIONS, context);

                    if (result) {
                        redirect.toRecord({
                            type: ContextData.recordType,
                            id: ContextData.recordId
                        });
                    }

                    return true;
                }
            }
            ////////////////////////////////////////////////////
        },
        execute: function (eventName, context) {
            var returnValue = false;
            if (
                EventRouter[ContextData.recordType] &&
                EventRouter[ContextData.recordType][eventName] &&
                typeof EventRouter[ContextData.recordType][eventName] === 'function'
            ) {
                returnValue = EventRouter[ContextData.recordType][eventName].call(
                    EventRouter,
                    ContextData,
                    context
                );
            }

            return returnValue;
        }
    };
    ///////////////////////////////////// }} --NO NEED TO TOUCH ABOVE CODE

    var UserEvent = {
        beforeLoad: function (context) {
            LogTitle = [
                LogTitle,
                'beforeLoad',
                context.type,
                context.newRecord.type,
                context.newRecord.id
            ].join('::');
            var logTitle = LogTitle,
                returnValue = null;
            EventActionsHelper.initialize(context);
            try {
                EventActionsHelper.executeSudo(context);
                returnValue = EventActionsHelper.execute('beforeLoad', context);
            } catch (loadError) {
                returnValue = false;
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(loadError));
                throw loadError;
            }

            return returnValue;
        },
        beforeSubmit: function (context) {
            LogTitle = [
                LogTitle,
                'beforeSubmit',
                context.type,
                context.newRecord.type,
                context.newRecord.id
            ].join('::');
            var logTitle = LogTitle,
                returnValue = null;
            EventActionsHelper.initialize(context);
            try {
                returnValue = EventActionsHelper.execute('beforeSubmit', context);
            } catch (submitError) {
                returnValue = false;
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(submitError));
                throw submitError;
            }

            return returnValue;
        },
        afterSubmit: function (context) {
            LogTitle = [
                LogTitle,
                'afterSubmit',
                context.type,
                context.newRecord.type,
                context.newRecord.id
            ].join('::');
            var logTitle = LogTitle,
                returnValue = null;

            EventActionsHelper.initialize(context);
            try {
                returnValue = EventActionsHelper.execute('afterSubmit', context);
            } catch (postSubmitError) {
                returnValue = false;
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(postSubmitError));
                throw postSubmitError;
            }

            return returnValue;
        }
    };

    return {
        beforeLoad: UserEvent.beforeLoad
    };
});
