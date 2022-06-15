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

/**
 * Script Name: CTC | PDF Macro Serials (SL)
 * Author: brianf@nscatalyst.com
 */
define(['N/search', 'N/runtime', 'N/record'], function (NS_Search, NS_Runtime, NS_Record) {
    'use strict';
    var LogTitle = 'TPLMacro-Serials';

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
            return arrValue.indexOf(stValue) > -1;
        },
        cleanText: function (value) {
            // return value;
            return util.isString(value) && !Helper.isEmpty(value)
                ? value.replace(/&/gm, '&amp;')
                : value;
        },
        isSecured: function (context, reqData) {
            var logTitle = [LogTitle, '::securityCheck'].join('');
            var isAllowed = false;

            var userAgent = context.request.headers['user-agent'];
            log.debug(logTitle, '>> isSecured: ' + JSON.stringify(userAgent));

            if (userAgent && userAgent.match(/^java\//gi)) {
                isAllowed = true;
            }

            log.debug(logTitle, '>> isAllowed: ' + JSON.stringify(isAllowed));

            return isAllowed;
        }
    };

    // only registed macro datas are allowed for security purposes

    var VC_Helper = {
        searchSerials: function (option) {
            var recType = option.type || option.rectype || option.recType;
            var recId = option.id || option.recid || option.recId;

            var filters = [
                    {
                        name:
                            recType == NS_Record.Type.INVOICE
                                ? 'custrecordserialinvoice'
                                : 'custrecorditemfulfillment',
                        operator: 'anyof',
                        values: recId
                    }
                ],
                columns = [
                    { name: 'name' },
                    { name: 'custrecordserialsales' },
                    { name: 'custrecorditemfulfillment' },
                    { name: 'custrecordserialitem', sort: NS_Search.Sort.ASC }
                ];

            var searchObj = NS_Search.create({
                type: 'customrecordserialnum',
                filters: filters,
                columns: columns
            });

            return searchObj.run().getRange(0, 1000);
        }
    };

    //// ///////////////////
    var EndPoint = {
        onRequest: function (context) {
            var logTitle = [LogTitle, '::get'].join('');

            var requestData = {
                mkey: context.request.parameters.mkey,
                recid: context.request.parameters.recid,
                rectype: context.request.parameters.rectype,
                macroKeyParam: NS_Runtime.getCurrentScript().getParameter({
                    name: 'custscript_ctc_vc_pdfmacro_name'
                })
            };

            log.debug(logTitle, ' >> requestData:  ' + JSON.stringify(requestData));

            var macroData = { serials: {} };

            ///////////////////////////////////////////
            try {
                // Validate the macro request ///////////////////
                if (
                    Helper.isEmpty(requestData.mkey) ||
                    Helper.isEmpty(requestData.macroKeyParam) ||
                    requestData.mkey !== requestData.macroKeyParam ||
                    // Helper.isEmpty(MacroConfig[requestData.mkey]) ||
                    Helper.isEmpty(requestData.recid) ||
                    Helper.isEmpty(requestData.rectype) ||
                    !Helper.isSecured(context, requestData)
                ) {
                    throw 'Invalid or unauthorized connection request.';
                }
                ///////////////////////////////////////////

                var arrSerialsResults = VC_Helper.searchSerials(requestData);
                var arrItemSerials = [];

                if (!arrSerialsResults || !arrSerialsResults.length) throw 'Empty result set';

                for (var i = 0, j = arrSerialsResults.length; i < j; i++) {
                    arrItemSerials.push({
                        item: arrSerialsResults[i].getValue({ name: 'custrecordserialitem' }),
                        itemName: arrSerialsResults[i].getText({ name: 'custrecordserialitem' }),
                        serialno: arrSerialsResults[i].getValue({ name: 'name' })
                    });
                }

                macroData.serials = arrItemSerials;
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
            }
            ///////////////////////////////////////////

            log.debug(logTitle, '>> macroData: ' + JSON.stringify(macroData));
            var macroFld,
                macroValue,
                macroValues = [];

            //// LIST the MACRO VALUES ////////////////////////////
            for (macroFld in macroData) {
                macroValue = macroData[macroFld];

                if (util.isObject(macroValue) || util.isArray(macroValue)) {
                    macroValue = JSON.stringify(macroValue);
                    // } else if ( util.isArray(macroValue) ) {
                    //     macroValue = macroValue.join(', ');
                } else if (util.isString(macroValue)) {
                    macroValue = Helper.cleanText(macroValue);
                    // value.replace(/&/gm, '&amp;');
                }

                macroValues.push(['<#macro ', macroFld, '>', macroValue, '</#macro>'].join(''));
            }
            ///////////////////////////////////////////
            // log.debug(logTitle, '>> macroValues: ' + JSON.stringify(macroValues));

            var outputText = macroValues.join('\n') || '0';
            // log.debug(logTitle, '>> outputText: ' + JSON.stringify(outputText));

            context.response.write({ output: outputText });
            return true;
        }
    };
    //// ///////////////////

    return EndPoint;
});
