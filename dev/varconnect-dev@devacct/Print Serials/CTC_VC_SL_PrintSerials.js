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
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Suitelet
 */

/**
 * Project Number: 001225
 * Script Name: CTC SL Print Serials
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */
define([
    'N/render',
    'N/record',
    'N/search',
    './../CTC_VC2_Constants.js',
    './../Services/ctc_svclib_configlib.js'
], function (ns_render, ns_record, ns_search, vc2_constant, vcs_configLib) {
    var PARAMS = {
            RECORD_TYPE: 'custscript_ctc_vc_serials_rectype',
            RECORD_ID: 'custscript_ctc_vc_serials_recid'
        },
        TEMPLATES = {
            PACKING: 'CUSTTMPL_113_3320682_SB1_951'
        },
        pdfFileName = 'PDFTemplate';

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    function _searchSerials(recType, recId) {
        var name =
                recType == ns_record.Type.INVOICE
                    ? 'custrecordserialinvoice'
                    : 'custrecorditemfulfillment',
            filters = [
                {
                    name: name,
                    operator: 'anyof',
                    values: recId
                },
                {
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                }
            ],
            columns = [
                { name: 'name' },
                { name: 'custrecordserialsales' },
                { name: 'custrecorditemfulfillment' },
                { name: 'custrecordserialitem', sort: ns_search.Sort.ASC }
            ];

        var searchObj = ns_search.create({
            type: 'customrecordserialnum',
            filters: filters,
            columns: columns
        });

        log.audit('_searchSerials', searchObj.filters);

        return searchObj.run().getRange(0, 1000);
    }

    function _addSalesOrder(options) {
        var recType = options.recType,
            recId = options.recId,
            renderer = options.renderer;

        if (recType == ns_record.Type.ITEM_FULFILLMENT) {
            var lookup = ns_search.lookupFields({
                type: recType,
                id: recId,
                columns: ['createdfrom']
            });

            log.debug('createdfrom', lookup);

            var salesOrder;
            if (lookup && lookup.createdfrom[0] && lookup.createdfrom[0].value)
                salesOrder = ns_record.load({
                    type: ns_record.Type.SALES_ORDER,
                    id: lookup.createdfrom[0].value
                });
            else
                salesOrder = ns_record.load({
                    type: recType,
                    id: recId
                });

            renderer.addRecord({
                templateName: 'salesorder',
                record: salesOrder
            });
        }
    }

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        log.debug('request method', context.request.method);
        var recType = context.request.parameters[PARAMS.RECORD_TYPE],
            recId = context.request.parameters[PARAMS.RECORD_ID];

        log.debug(PARAMS.RECORD_TYPE, recType);
        log.debug(PARAMS.RECORD_ID, recId);

        if (context.request.method === 'GET') {
            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            var MainCFG = vcs_configLib.mainConfig();

            if (MainCFG.invPrintSerials) {
                var rec = ns_record.load({
                        type: recType,
                        id: recId
                    }),
                    scriptId =
                        recType == ns_record.Type.INVOICE
                            ? MainCFG.printSerialsTemplate
                            : TEMPLATES.PACKING,
                    sublistId =
                        recType == ns_record.Type.INVOICE
                            ? 'recmachcustrecordserialinvoice'
                            : 'recmachcustrecorditemfulfillment';
                var renderer = ns_render.create();

                if (scriptId && scriptId[0].value) {
                    renderer.setTemplateById(scriptId[0].value);
                } else {
                    renderer.setTemplateByScriptId(scriptId);
                }
                renderer.addRecord({
                    templateName: 'record',
                    record: rec
                });

                var serials = { list: [] },
                    sublistId = sublistId,
                    serialsLen = rec.getLineCount({ sublistId: sublistId });
                log.debug('sublists', rec.getSublists());
                log.debug(
                    'sublist',
                    JSON.stringify(rec.getSublistFields({ sublistId: sublistId }))
                );

                for (var i = 0; i < serialsLen; i++) {
                    serials.list.push({
                        index: i,
                        custrecordserialitem: rec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: 'custrecordserialitem',
                            line: i
                        })
                    });
                }

                log.debug('serials', serials);

                var res = _searchSerials(recType, recId);
                log.debug('res', res);
                renderer.addSearchResults({
                    templateName: 'serials',
                    searchResult: res
                });
                _addSalesOrder({
                    recType: recType,
                    recId: recId,
                    renderer: renderer
                });
                renderer.addCustomDataSource({
                    alias: 'fromSuitelet',
                    data: { fromSuitelet: true },
                    format: ns_render.DataSource.OBJECT
                });

                context.response.setHeader({
                    name: 'Content-Type:',
                    value: 'application/pdf'
                });
                context.response.setHeader({
                    name: 'Content-Disposition',
                    value: 'inline; filename="' + pdfFileName + '_' + recId + '.pdf"'
                });
                context.response.writePage(renderer.renderAsPdf());
                //    		context.response.write(renderer.renderAsString());
            }
        }
    }

    return {
        onRequest: onRequest
    };
});
