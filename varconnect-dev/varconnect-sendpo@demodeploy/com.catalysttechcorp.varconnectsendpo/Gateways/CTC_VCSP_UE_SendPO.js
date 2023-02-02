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
 * @NScriptType UserEventScript
 */
define([
    'N/runtime',
    'N/search',
    'N/record',
    'N/ui/message',
    'N/redirect',
    '../Library/CTC_Lib_EventRouter',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_VCSP_Lib_MainConfiguration',
    '../Library/CTC_VCSP_Lib_LicenseValidator',
    '../Library/CTC_VCSP_Lib_VendorConfig',
    '../Library/CTC_VCSP_Lib_Main.js',
    '../Library/CTC_VCSP_Constants.js'
], function (
    NS_Runtime,
    NS_Search,
    NS_Record,
    NS_Msg,
    NS_Redirect,
    EventRouter,
    CTC_Util,
    libMainConfig,
    libLicenseValidator,
    libVendorConfig,
    libMain,
    VCSP_Global
) {
    var LogTitle = 'VC:SENDPO';

    var Helper = {
        hideFields: function (form, arrFields) {
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            log.audit('displayAsInlineTextarea', arrFields);

            arrFields.forEach(function (fieldId) {
                var fldObj = form.getField({ id: fieldId });
                fldObj.updateDisplayType({ displayType: 'hidden' });
            });
        },
        displayAsInlineTextarea: function (form, arrFields) {
            if (!arrFields || !arrFields.length) return;
            arrFields = util.isArray(arrFields) ? arrFields : [arrFields];

            log.audit('displayAsInlineTextarea', arrFields);

            arrFields.forEach(function (fieldId) {
                log.audit('displayAsInlineTextarea', fieldId);
                if (!fieldId) return true;

                try {
                    var fldOrig = form.getField({ id: fieldId });
                    log.audit('displayAsInlineTextarea:orig', fldOrig);

                    if (!fldOrig || !fldOrig.defaultValue)
                        return true;

                    var fldNew = form.addField({
                        id: ['custpage', fieldId].join('_'),
                        label: fldOrig.label,
                        type: 'inlinehtml'
                    });
                    log.audit('displayAsInlineTextarea:new', fldNew);

                    var strValue = fldOrig.defaultValue;

                    //test for JSON
                    try {
                        var jsonObj = JSON.parse(strValue);
                        strValue = JSON.stringify(jsonObj, null, '    ');
                    } catch (err) {
                        log.audit('json log test', CTC_Util.extractError(err));
                    }

                    fldNew.defaultValue = [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">',
                        fldOrig.label,
                        '</a>',
                        '</span></span>',
                        '<textarea cols="60" rows="10" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        strValue,
                        '</textarea>',
                        '</div>'
                    ].join('');

                    form.insertField({ field: fldNew, nextfield: fldOrig.id });
                    fldOrig.updateDisplayType({ displayType: 'hidden' });
                } catch (error) {
                    log.audit('displayAsInlineTextarea', error);
                    throw error;
                }
                return true;
            }); // end: arrFields.forEach
        }
    };

    //Checks if catalyst license is valid
    function _validateLicense(options) {
        var logTitle = [LogTitle, '_validateLicense'].join('::');

        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            result = true,
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            });

        // log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
        // log.audit(logTitle, '>> license: ' + JSON.stringify(license));
        // log.audit(logTitle, '>> response: ' + JSON.stringify(response));

        // if (response == 'valid') result = true;

        return result;
    }

    EventRouter.Action[NS_Record.Type.PURCHASE_ORDER] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;

                switch (Current.eventType) {
                    case scriptContext.UserEventType.VIEW:
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
                                    // '<br/>Error encountered:  ' +
                                    sessionData.error +
                                    '<br/><br/> See the details at the bottom on the VAR Connect Tab &gt;&gt; VAR Connect Logs.',
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

                        // check for main config
                        var mainConfig = libMainConfig.getMainConfiguration();
                        log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                        if (!mainConfig) return;

                        // check for valid license
                        if (!_validateLicense({ mainConfig: mainConfig })) return;

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
                                }).isDisabled =
                                    !!lookupData[VCSP_Global.Fields.Transaction.IS_PO_SENT];
                            }
                        }
                        break;
                    case scriptContext.UserEventType.CREATE:
                    case scriptContext.UserEventType.COPY:
                        var fieldIdsToBlankOut = [
                            VCSP_Global.Fields.Transaction.VENDOR_PO_NUMBER,
                            VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP,
                            VCSP_Global.Fields.Transaction.VENDOR_RECEIPT
                        ];
                        fieldIdsToBlankOut.forEach(function (fieldId) {
                            log.debug(logTitle, 'Emptying ' + fieldId + '...');
                            scriptContext.newRecord.setValue({
                                fieldId: fieldId,
                                value: '',
                                ignoreFieldChange: true
                            });
                            return true;
                        });
                        scriptContext.newRecord.setValue({
                            fieldId: VCSP_Global.Fields.Transaction.IS_PO_SENT,
                            value: false,
                            ignoreFieldChange: true
                        });
                        break;
                    default:
                        break;
                }

                if (Current.eventType == scriptContext.UserEventType.VIEW) {
                    Helper.displayAsInlineTextarea(scriptContext.form, [
                        'custbody_ctc_vcsp_vendor_rcpt'
                    ]);
                }


            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        },
        onAfterSubmit: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onAfterSubmit'].join('::');
            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                var recordData = {};
                if (scriptContext.newRecord) {
                    recordData.type = scriptContext.newRecord.type;
                    recordData.id = scriptContext.newRecord.id;
                }
                log.audit(logTitle, '>> Record Data: ' + JSON.stringify(recordData));

                var createdFromRecTypeCol = {
                    name: 'recordtype',
                    join: 'createdFrom'
                };
                var searchResults = CTC_Util.searchAllPaged({
                    type: NS_Search.Type.TRANSACTION,
                    filterExpression: [
                        ['recordtype', NS_Search.Operator.IS, NS_Search.Type.PURCHASE_ORDER],
                        'AND',
                        ['internalid', NS_Search.Operator.ANYOF, recordData.id]
                    ],
                    columns: [
                        createdFromRecTypeCol,
                        'approvalstatus',
                        'subsidiary',
                        'entity',
                        VCSP_Global.Fields.Transaction.IS_PO_SENT,
                        VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP
                    ]
                });
                var lookupData = searchResults[0];
                log.audit(logTitle, '>> lookupData: ' + JSON.stringify(lookupData));

                // check for main config
                var mainConfig = libMainConfig.getMainConfiguration();
                log.audit(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
                if (!mainConfig) return;

                // check for valid license
                if (!_validateLicense({ mainConfig: mainConfig })) return;

                var vendorCfg = libVendorConfig.getVendorConfiguration({
                    vendor: lookupData.getValue('entity'),
                    subsidiary: lookupData.getValue('subsidiary')
                });
                log.audit(logTitle, '>> vendorCfg: ' + JSON.stringify(vendorCfg));
                if (!vendorCfg) return;

                // TODO: please test, currently untested
                var isPendingSendOnCreate;
                if (vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.ON_CREATE) {
                    var createEventTypes = [
                        scriptContext.UserEventType.CREATE,
                        scriptContext.UserEventType.COPY
                    ];
                    isPendingSendOnCreate = createEventTypes.indexOf(Current.eventType) >= 0;
                }
                if (
                    isPendingSendOnCreate ||
                    vendorCfg.eventType == VCSP_Global.Lists.PO_EVENT.ON_APPROVE
                ) {
                    var isToBeSent = !lookupData.getValue(
                        VCSP_Global.Fields.Transaction.IS_PO_SENT
                    );
                    var isCreatedFromSalesOrder =
                        lookupData.getValue(createdFromRecTypeCol) == NS_Record.Type.SALES_ORDER;
                    var isApproved = lookupData.getValue('approvalstatus') >= 2;
                    log.debug(
                        logTitle,
                        JSON.stringify({
                            isToBeSent: isToBeSent,
                            isPendingSendOnCreate: isPendingSendOnCreate,
                            isCreatedFromSalesOrder: isCreatedFromSalesOrder,
                            isApproved: isApproved
                        })
                    );
                    if (
                        isToBeSent &&
                        isCreatedFromSalesOrder &&
                        (isPendingSendOnCreate ||
                            (isPendingSendOnCreate === undefined && isApproved))
                    ) {
                        NS_Redirect.toRecord({
                            type: Current.recordType,
                            id: Current.recordId,
                            parameters: {
                                routeract: 'sendPO'
                            }
                        });
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
            }

            return true;
        }
    };
    EventRouter.Action[VCSP_Global.Records.VENDOR_CONFIG] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));
                if (Current.execType !== NS_Runtime.ContextType.USER_INTERFACE) return;
                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vcsp_fieldmapping'
                ]);

            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    var USER_EVENT = {
        beforeLoad: function (scriptContext) {
            LogTitle = [
                LogTitle,
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id
            ].join('::');
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
        },
        afterSubmit: function (scriptContext) {
            LogTitle = [
                LogTitle,
                scriptContext.type,
                scriptContext.newRecord.type,
                scriptContext.newRecord.id
            ].join('::');
            var logTitle = [LogTitle || '', 'onAfterSubmit'].join('::'),
                returnValue = null;
            EventRouter.initialize(scriptContext);
            try {
                returnValue = EventRouter.execute(EventRouter.Type.AFTER_SUBMIT);
            } catch (afterSubmitError) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(afterSubmitError));
                returnValue = false;
                throw afterSubmitError;
            }
            return returnValue;
        }
    };

    return USER_EVENT;
});
