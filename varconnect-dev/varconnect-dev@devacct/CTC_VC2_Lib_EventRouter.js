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
            for (var i = arrValue.length - 1; i >= 0; i--)
                if (stValue == arrValue[i]) break;
            return i > -1;
        }
    };

    var EventRouter = {
        Type: {
            BEFORE_LOAD: 'onBeforeLoad',
            BEFORE_SUBMIT: 'onBeforeSubmit',
            AFTER_SUBMIT: 'onAfterSubmit',
            CUSTOM: 'Custom'
        },
        ParamStr: 'routeract',
        Current: {},
        ScriptContext: null,
        Action: {},
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
            log.audit('EventRouter.intialize', Current);
            this.scriptContext = scriptContext;
            this.Current = Current;

            return Current;
        },
        execute: function (eventType) {
            if (!eventType) return; // exit

            var Current = this.Current,
                scriptContext = this.scriptContext,
                UserEventType = scriptContext.UserEventType,
                ContextType = ns_runtime.ContextType,
                RouterEventFn,
                result;

            if (eventType == this.Type.CUSTOM) {
                if (!this.Action[eventType]) return;
                if (
                    !Helper.inArray(Current.execType, [
                        ContextType.USER_INTERFACE
                    ])
                )
                    return;
                if (
                    !Helper.inArray(Current.eventType, [
                        UserEventType.VIEW,
                        UserEventType.EDIT
                    ])
                )
                    return;

                var paramAction =
                    scriptContext.request.parameters[this.ParamStr];
                RouterEventFn = this.Action[eventType][paramAction];

                if (!paramAction || !RouterEventFn) return;
                if (!util.isFunction(RouterEventFn)) return;

                result = RouterEventFn.call(
                    EventRouter,
                    scriptContext,
                    Current
                );

                if (result) {
                    ns_redir.toRecord({
                        type: Current.recordType,
                        id: Current.recordId
                    });
                }
            } else if (this.Action[Current.recordType]) {
                RouterEventFn = this.Action[Current.recordType][eventType];
                if (!util.isFunction(RouterEventFn)) return;

                result = RouterEventFn.call(
                    EventRouter,
                    scriptContext,
                    Current
                );
                return result;
            }
        },
        addActionURL: function (name) {
            return [this.Current.recordUrl, '&', this.ParamStr, '=', name].join(
                ''
            );
        }
    };

    return EventRouter;
});
