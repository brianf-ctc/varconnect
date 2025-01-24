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
    'N/https',
    'N/url',
    './CTC_VC2_Lib_EventRouter',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants',
    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig'
], function (
    ns_runtime,
    ns_record,
    ns_https,
    ns_url,
    EventRouter,
    vc2_util,
    vc2_constant,
    vc_maincfg,
    vc_vendorcfg
) {
    var LogTitle = 'VC:BILLFILE';

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
                    if (!fldOrig || !fldOrig.defaultValue || fldOrig.defaultValue.length < 200)
                        return true;

                    var fldNew = form.addField({
                        id: ['custpage', fieldId].join('_'),
                        label: fldOrig.label,
                        type: 'inlinehtml'
                    });

                    log.audit('displayAsInlineTextarea', fldOrig);
                    log.audit('displayAsInlineTextarea', fldNew);

                    var strValue = fldOrig.defaultValue;

                    //test for JSON
                    try {
                        var jsonObj = JSON.parse(strValue);
                        strValue = JSON.stringify(jsonObj, null, '    ');
                    } catch (err) {
                        log.audit('json log test', vc2_util.extractError(err));
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
                } catch (errfld) {
                    log.audit('displayAsInlineTextarea', errfld);
                }
                return true;
            }); // end: arrFields.forEach
        }
    };

    /// SEND CONFIG ///
    var LibSendConfig = {
        PRODUCT_CODE: 2,
        sendData: function (option) {
            var logTitle = 'VC_LICENSE::sendConfig',
                logPrefix = '[SEND-CONFIG] ',
                response,
                returnValue = {};

            vc2_util.LogPrefix = logPrefix;
            var startTime = new Date();

            try {
                var configDef = option.config,
                    configId = option.id,
                    configName = option.configName,
                    SkippedFields = option.skippedFields;

                if (vc2_util.isEmpty(configDef) || vc2_util.isEmpty(configId))
                    throw 'Missing record config';

                // try to do look up of the search
                var configFields = ['name', 'isinactive', 'internalid'],
                    payloadData = [];

                configDef.FIELD['NAME'] = 'name';
                configDef.FIELD['INACTIVE'] = 'isinactive';
                configDef.FIELD['MODIFIED'] = 'lastmodified';
                configDef.FIELD['MODIFIED_BY'] = 'lastmodifiedby';

                for (var fieldName in configDef.FIELD) {
                    if (vc2_util.inArray(configDef.FIELD[fieldName], SkippedFields)) continue;
                    configFields.push(configDef.FIELD[fieldName]);
                }
                if (option.nameField) configFields.push(option.nameField);

                vc2_util.log(logTitle, '// configFields ', configFields);

                // Do the record lookup
                var results = vc2_util.flatLookup({
                    type: configDef.ID,
                    id: configId,
                    columns: configFields
                });
                vc2_util.log(logTitle, '// results ', results);

                if (results.name == results.internalid.value) {
                    if (option.nameValue) {
                        results.name = option.nameValue;

                        ns_record.submitFields({
                            type: configDef.ID,
                            id: configId,
                            values: { name: results.name }
                        });
                    } else if (option.nameField && results[option.nameField]) {
                        results.name = results[option.nameField].text || results[option.nameField];

                        ns_record.submitFields({
                            type: configDef.ID,
                            id: configId,
                            values: { name: results.name }
                        });
                    }
                    // update this record?
                }
                vc2_util.log(logTitle, '// results ', results);

                payloadData.push({
                    settingFieldId: '_config_name',
                    settingFieldName: 'CONFIG_NAME',
                    settingValue: configName
                });

                // build the paylod
                for (var fieldName in configDef.FIELD) {
                    var fieldId = configDef.FIELD[fieldName],
                        fieldValue =
                            results[fieldId] == null
                                ? 'null'
                                : results[fieldId] === true
                                ? 'T'
                                : results[fieldId] === false
                                ? 'F'
                                : results[fieldId];

                    var data = {
                        settingFieldId: fieldId,
                        settingFieldName: fieldName,
                        settingValue: fieldValue.value || fieldValue
                    };
                    if (
                        results.hasOwnProperty(fieldId) &&
                        fieldValue.text &&
                        fieldValue.text !== data.settingValue
                    ) {
                        data['settingFieldText'] = fieldValue.text;
                    }
                    payloadData.push(data);
                }
                // vc2_util.log(logTitle, '// Config Data: ', payloadData);

                var configURL =
                    'https://' +
                    ns_url.resolveDomain({
                        hostType: ns_url.HostType.APPLICATION,
                        accountId: ns_runtime.accountId
                    }) +
                    ns_url.resolveRecord({ recordType: configDef.ID, recordId: configId });

                vc2_util.log(logTitle, '// configURL: ', configURL);

                // prepare the payload
                var queryOption = {
                    method: ns_https.Method.POST,
                    url:
                        'https://nscatalystserver.azurewebsites.net/logconfig.php' +
                        '?' +
                        ('producttypeid=' + LibSendConfig.PRODUCT_CODE) +
                        ('&nsaccountid=' + ns_runtime.accountId) +
                        ('&settingsid=' + configId) +
                        ('&rectype=' + configDef.ID) +
                        ('&settingsurl=' + encodeURIComponent(configURL)),
                    body: JSON.stringify(payloadData)
                };
                //// SEND THE REQUEST ////
                vc2_util.log(logTitle, 'Send Request query: ', queryOption);
                response = ns_https.request(queryOption);
                vc2_util.log(logTitle, 'Response: ', response);

                if (!response || !response.body) throw 'Unable to get response';
                if (!response.code || response.code !== 200)
                    throw 'Received invalid response code - ' + response.code;

                returnValue = response.body;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = vc2_util.extractError(error);
            } finally {
                var durationSec = vc2_util.roundOff((new Date() - startTime) / 1000);
                vc2_util.log(logTitle, '# response time: ' + durationSec + 's');

                vc2_util.log(logTitle, '// returnValue ', returnValue);
            }

            returnValue;
        }
    };
    ///

    EventRouter.Action['customrecord_ctc_vc_bills'] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vc_bill_src',
                    'custrecord_ctc_vc_bill_json'
                ]);

                var flexScreenUrl =
                    '/app/site/hosting/scriptlet.nl?script=customscript_ctc_vc_bill_flex_screen&deploy=1&record_id=' +
                    Current.recordId;

                // add button to the flex screen
                scriptContext.form.addButton({
                    id: 'custpage_flexscreen',
                    label: 'Open Flex Screen',
                    functionName:
                        '(function(url){return window.open(url, "_blank");})("' +
                        flexScreenUrl +
                        '")'
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.BILLCREATE_CONFIG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                Helper.hideFields(scriptContext.form, ['custrecord_vc_bc_maincfg']);

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                Helper.displayAsInlineTextarea(scriptContext.form, ['custrecord_vc_bc_host_key']);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        },
        onAfterSubmit: function (scriptContext, Current) {
            try {
                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ])
                )
                    return;

                LibSendConfig.sendData({
                    config: vc2_constant.RECORD.BILLCREATE_CONFIG,
                    id: Current.recordId,
                    configName: 'BILLCREATE_CONFIG',
                    skippedFields: []
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.VENDOR_CONFIG.ID] = {
        onAfterSubmit: function (scriptContext, Current) {
            try {
                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ])
                )
                    return;

                LibSendConfig.sendData({
                    config: vc2_constant.RECORD.VENDOR_CONFIG,
                    id: Current.recordId,
                    configName: 'VENDOR_CONFIG',
                    nameField: 'custrecord_ctc_vc_xml_vendor',
                    skippedFields: ['custrecord_ctc_vc_xml_req']
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.MAIN_CONFIG.ID] = {
        onAfterSubmit: function (scriptContext, Current) {
            try {
                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.EDIT,
                        scriptContext.UserEventType.XEDIT
                    ])
                )
                    return;

                LibSendConfig.sendData({
                    config: vc2_constant.RECORD.MAIN_CONFIG,
                    id: Current.recordId,
                    configName: 'MAIN_CONFIG',
                    nameValue: 'MAIN_CONFIG',
                    skippedFields: ['custrecord_ctc_vc_license_text']
                });
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[vc2_constant.RECORD.VC_LOG.ID] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                if (Current.eventType !== scriptContext.UserEventType.VIEW) return;
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;

                Helper.displayAsInlineTextarea(scriptContext.form, [
                    'custrecord_ctc_vcsp_log_body'
                ]);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }
        }
    };

    EventRouter.Action[ns_record.Type.PURCHASE_ORDER] = {
        onBeforeLoad: function (scriptContext, Current) {
            var logTitle = [LogTitle, 'onBeforeLoad'].join('::');

            try {
                if (Current.execType !== ns_runtime.ContextType.USER_INTERFACE) return;
                if (
                    !vc2_util.inArray(Current.eventType, [
                        scriptContext.UserEventType.VIEW,
                        scriptContext.UserEventType.EDIT
                    ])
                )
                    return;

                log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));

                var mainCfg = vc_maincfg.getMainConfiguration();
                log.audit(logTitle, '// Main Confg: ' + JSON.stringify(mainCfg));
                if (!mainCfg) return;

                var currentRecord = scriptContext.newRecord;

                var vendorCfg = vc_vendorcfg.getVendorConfiguration({
                    vendor: currentRecord.getValue({ fieldId: 'entity' }),
                    subsidiary: currentRecord.getValue({
                        fieldId: 'subsidiary'
                    })
                });
                log.audit(logTitle, '// vendorCfg:  ' + JSON.stringify(vendorCfg));

                if (!mainCfg.overridePONum) {
                    Helper.hideFields(scriptContext.form, ['custbody_ctc_vc_override_ponum']);
                }

                // VENDOR LINE INFO /////
                var lineCount = currentRecord.getLineCount({
                        sublistId: 'item'
                    }),
                    hasVendorInfo = false;

                var fldVendorScr = scriptContext.form.addField({
                        id: 'custpage_ctc_povendor_scr',
                        label: 'Clear Vendor Info',
                        type: 'inlinehtml'
                    }),
                    sublistItem = scriptContext.form.getSublist({
                        id: 'item'
                    });

                var scriptVendorInfo = [
                    '<script type="text/javascript">',
                    'jQuery(document).ready(function () {',
                    'var jq=jQuery;',
                    'var fnVENDLINE=function(ln){',
                    'var tr=jq.find("table#item_splits tr")[ln], ',
                    'td=jq(tr).find("td[data-ns-tooltip=\'VENDOR LINE INFO\']")[0],',
                    'sp=jq(td).find("span")[0];',
                    'jq(sp).text("Details");',
                    'jq(td).empty().append(sp);',
                    '};'
                ];

                for (var line = 0; line < lineCount; line++) {
                    var vendorInfoJSON = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_vc_vendor_info',
                        line: line
                    });
                    if (!vendorInfoJSON) continue;
                    hasVendorInfo = true;
                    scriptVendorInfo.push(
                        'try{ fnVENDLINE("' + (line + 1) + '"); } catch(e){console.log(e);}'
                    );
                }
                scriptVendorInfo.push('});</script>');
                fldVendorScr.defaultValue = scriptVendorInfo.join('');

                try {
                    if (!hasVendorInfo || Current.eventType == scriptContext.UserEventType.EDIT)
                        sublistItem
                            .getField({ id: 'custcol_ctc_vc_vendor_info' })
                            .updateDisplayType({ displayType: 'HIDDEN' });
                } catch (eer) {
                    vc2_util.logError(logTitle, eer);
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                return;
            }

            return true;
        }
    };

    EventRouter.Action['__ALL__'] = {
        onBeforeLoad: function (scriptContext, Current) {},
        onBeforeSubmit: function (scriptContext, Current) {},
        onAfterSubmit: function (scriptContext, Current) {}
    };

    EventRouter.Action[EventRouter.Type.CUSTOM] = {
        triggerOrderStatus: function (scriptContext, Current) {
            log.audit(logTitle, '>> Current: ' + JSON.stringify(Current));
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
        },
        beforeSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onBeforeSubmit'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            log.audit(logTitle, EventRouter.Type);
            try {
                EventRouter.execute(EventRouter.Type.BEFORE_SUBMIT);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw error;
            }

            return returnValue;
        },
        afterSubmit: function (scriptContext) {
            var logTitle = [LogTitle || '', 'onAfterSubmit'].join('::'),
                returnValue = null;

            EventRouter.initialize(scriptContext);

            log.audit(logTitle, EventRouter.Type);
            try {
                EventRouter.execute(EventRouter.Type.AFTER_SUBMIT);
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
