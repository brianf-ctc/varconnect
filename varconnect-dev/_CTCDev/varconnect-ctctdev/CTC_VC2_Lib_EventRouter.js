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
 */
define(['N/record', 'N/runtime', 'N/url', 'N/redirect'], function (
    ns_record,
    ns_runtime,
    ns_url,
    ns_redir
) {
    // --------- Helper Functions --------- //
    var Helper = {
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
        }
    };

    var EventRouter = {
        // Define the types of user events this router can handle
        Type: {
            BEFORE_LOAD: 'onBeforeLoad',
            BEFORE_SUBMIT: 'onBeforeSubmit',
            AFTER_SUBMIT: 'onAfterSubmit',
            CUSTOM: 'Custom'
        },
        // Query parameter name for custom actions
        ParamStr: 'routeract',
        // Store information about the current event being processed
        Current: {},
        // Store the script context
        ScriptContext: null,
        // Dictionary to hold event handler functions for each record type, custom actions
        Action: {},
        // Initialize the router with event context
        initialize: function (scriptContext) {
            var Current = {
                eventType: scriptContext.type,
                execType: ns_runtime.executionContext,
                recordType: scriptContext.newRecord.type,
                recordId: scriptContext.newRecord.id
            };
            if (Current.recordId) {
                Current.recordUrl = ns_url.resolveRecord({
                    recordType: Current.recordType,
                    recordId: Current.recordId
                });
            }
            // log.audit('EventRouter.intialize', Current);
            this.scriptContext = scriptContext;
            this.Current = Current;

            return Current;
        },

        // Main function to route and execute event handlers
        execute: function (eventType) {
            if (!eventType) return; // exit

            var Current = this.Current,
                scriptContext = this.scriptContext,
                UserEventType = scriptContext.UserEventType,
                ContextType = ns_runtime.ContextType,
                RouterEventFn,
                result;

            // Handle custom actions triggered by URL parameters
            if (eventType == this.Type.CUSTOM) {
                // check if there is
                if (!this.Action[eventType]) return;
                if (!Helper.inArray(Current.execType, [ContextType.USER_INTERFACE])) return;
                if (!Helper.inArray(Current.eventType, [UserEventType.VIEW, UserEventType.EDIT]))
                    return;

                var paramAction = scriptContext.request.parameters[this.ParamStr];
                RouterEventFn = this.Action[eventType][paramAction];

                if (!paramAction || !RouterEventFn) return;
                if (!util.isFunction(RouterEventFn)) return;

                result = RouterEventFn.call(EventRouter, scriptContext, Current);

                if (result) {
                    ns_redir.toRecord({
                        type: Current.recordType,
                        id: Current.recordId
                    });
                }
            }
            // Handle standard user events (beforeLoad, etc.)
            else if (this.Action[Current.recordType]) {
                var RouterAction = this.Action[Current.recordType];

                // force an array
                RouterAction = util.isArray(RouterAction) ? RouterAction : [RouterAction];

                for (var i = 0, j = RouterAction.length; i < j; i++) {
                    RouterEventFn = RouterAction[i][eventType];
                    if (!util.isFunction(RouterEventFn)) continue;

                    result = RouterEventFn.call(EventRouter, scriptContext, Current);
                    // if (!result) break; // event must return true to continue
                }

                return result;
            }
        },
        // Generate a URL to trigger a custom action
        addActionURL: function (name) {
            return [this.Current.recordUrl, '&', this.ParamStr, '=', name].join('');
        }
    };

    return EventRouter;
});
