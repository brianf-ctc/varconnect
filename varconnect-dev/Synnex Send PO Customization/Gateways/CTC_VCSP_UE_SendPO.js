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
 * @NScriptType UserEventScript
 */
define([
    'N/runtime',
    'N/record',
    'N/ui/message',
    '../Library/CTC_Lib_EventRouter',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Lib_VendorConfig',
    '../Library/CTC_VCSP_Lib_Main.js',
    '../Library/CTC_VCSP_Constants.js'
], function (
    NS_Runtime,
    NS_Record,
    NS_Msg,
    EventRouter,
    CTC_Util,
    libVendorConfig,
    libMain,
    VCSP_Global
) {
    var LogTitle = 'VC:SENDPO';

    EventRouter.Action[NS_Record.Type.PURCHASE_ORDER] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                /////////////////////////////////
                var sessionObj = NS_Runtime.getCurrentSession();
                var sessionData = {
                        result: sessionObj.get({ name: 'sendpo-success' }),
                        error: sessionObj.get({ name: 'sendpo-error' })
                    },
                    msgOption = {};
                log.audit(logTitle, '>> sessionData: ' + JSON.stringify(sessionData));

                if (sessionData.result) {
                    sessionObj.set({ name: 'sendpo-success', value: null });
                    msgOption = {
                        message: sessionData.result,
                        title: 'Send PO Successful',
                        type: NS_Msg.Type.CONFIRMATION
                    };
                }
                if (sessionData.error) {
                    sessionObj.set({ name: 'sendpo-error', value: null });
                    msgOption = {
                        message:
                            '<br/>Error encountered:  ' +
                            sessionData.error +
                            '<br/><br/> See the details at the VAR Connect Tab.',
                        title: 'Send PO Unsuccessful',
                        type: NS_Msg.Type.ERROR
                    };
                }
                if (msgOption.message) {
                    scriptContext.form.addPageInitMessage(msgOption);
                }
                /////////////////////////////////

                var recordData = {};
                if (scriptContext.newRecord) {
                    recordData.type = scriptContext.newRecord.type;
                    recordData.id = scriptContext.newRecord.id;
                }
                log.audit(logTitle, '>> Record Data: ' + JSON.stringify(recordData));

                var lookupData = CTC_Util.flatLookup({
                    type: recordData.type,
                    id: recordData.id,
                    columns: [
                        'subsidiary',
                        'entity',
                        VCSP_Global.Fields.Transaction.IS_PO_SENT,
                        VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP
                    ]
                });
                log.audit(logTitle, '>> lookupData: ' + JSON.stringify(lookupData));

                var vendorCfg = libVendorConfig.getVendorConfiguration({
                    vendor: lookupData.entity.value,
                    subsidiary: lookupData.subsidiary.value
                });
                log.audit(logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
                if (!vendorCfg) return;

                if (vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.MANUAL) {
                    scriptContext.form.addButton({
                        id: 'custpage_ctc_vcsp_sendpo',
                        label: 'Send PO to Vendor',
                        functionName:
                            '(function(url){window.location.href=url;})("' +
                            EventRouter.addActionURL('sendPO') +
                            '")'
                    }).isDisabled = !!lookupData[VCSP_Global.Fields.Transaction.IS_PO_SENT];
                } else {
                    if (lookupData[VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP]) {
                        scriptContext.form.addButton({
                            id: 'custpage_ctc_vcsp_sendpo',
                            label: 'Manually Send PO to Vendor',
                            functionName:
                                '(function(url){window.location.href=url;})("' +
                                EventRouter.addActionURL('sendPO') +
                                '")'
                        }).isDisabled = !!lookupData[VCSP_Global.Fields.Transaction.IS_PO_SENT];
                    }
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {
        sendPO: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'action.sendPO'].join('::');
            var sessObj = NS_Runtime.getCurrentSession();
            var response;

            try {
                response = libMain.sendPO({ recId: Current.recordId });
                log.audit(logTitle, response);

                if (response.isError) throw response.message;

                // add the session
                sessObj.set({
                    name: 'sendpo-success',
                    value: 'PO has been successfully sent to the vendor'
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                sessObj.set({
                    name: 'sendpo-error',
                    value: CTC_Util.extractError(error).replace('\n', '<br />')
                });

                // throw error;
            }

            return true;
        }
    };

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeLoad'].join('::'),
                returnValue = null;
            EventRouter.initialize(scriptContext);
            log.audit(logTitle, EventRouter.Type);
            try {
                EventRouter.execute(EventRouter.Type.CUSTOM);
                EventRouter.execute(EventRouter.Type.BEFORE_LOAD);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }
            return returnValue;
        }
    };

    return USER_EVENT;
});
