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
 * @NScriptType UserEventScript
 */

/**
 * Project Number: 001225
 * Script Name: CTC UE Print Serials
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 *
 */
define([
    'N/record',
    'N/render',
    'N/search',
    './../CTC_VC2_Constants.js',
    './../Services/ctc_svclib_configlib.js'
], function (record, render, search, vc2_constant, vcs_configLib) {
    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var templateId = 'CUSTTMPL_209_5860676_557',
        fileName = '',
        folderPath = '';

    function _searchSerials(recType, recId) {
        var name = 'custrecordserialinvoice',
            filters = [
                {
                    name: name,
                    operator: 'anyof',
                    values: recId
                }
            ],
            columns = [
                'name',
                'custrecordserialsales',
                'custrecorditemfulfillment',
                'custrecordserialitem'
            ];

        var searchObj = search.create({
            type: 'customrecordserialnum',
            filters: filters,
            columns: columns
        });

        return searchObj.run().getRange(0, 1000);
    }

    function _generatePdf(options) {
        var newRec = options.newRec,
            MainCFG = options.mainConfig,
            renderer = render.create();
        //		renderer.setTemplateByScriptId({ scriptId: templateId });
        renderer.setTemplateById({ id: MainCFG.printSerialsTemplate });
        renderer.addRecord({
            templateName: 'record',
            record: newRec
        });

        var res = _searchSerials(newRec.type, newRec.id);
        log.debug('res', res);
        renderer.addSearchResults({
            templateName: 'serials',
            searchResult: res
        });
        renderer.addCustomDataSource({
            alias: 'fromSuitelet',
            data: 'true'
        });

        var fileObj = renderer.renderAsPdf();
        fileObj.name = fileName;
        fileObj.folder = folderPath;
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
        if (scriptContext.type == scriptContext.UserEventType.VIEW) {
            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            var MainCFG = vcs_configLib.mainConfig();

            if (MainCFG.invPrintSerials) {
                var form = scriptContext.form;

                //			form.clientScriptFileId = 204609;
                form.clientScriptModulePath = './CTC_VC_CS_PrintSerials.js';

                form.addButton({
                    id: 'custpage_ctc_print_serial',
                    label: 'Print with Serials',
                    functionName: 'printSerial'
                });
            }
        }
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(scriptContext) {
        if (scriptContext.type == scriptContext.UserEventType.CREATE) {
            var newRec = scriptContext.newRecord;
            if (newRec.type == record.Type.INVOICE) {
                var license = vcs_configLib.validateLicense();
                if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

                var MainCFG = vcs_configLib.mainConfig();

                if (MainCFG.invPrintSerials)
                    _generatePdf({
                        newRec: newRec,
                        mainConfig: MainCFG
                    });
            }
        }
    }

    return {
        beforeLoad: beforeLoad
        //        afterSubmit: afterSubmit
    };
});
