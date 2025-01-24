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
 * @NScriptType ClientScript
 */

/**
 * Project Number: 001225
 * Script Name: CTC CS Print Serials
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */
define(['N/url', 'N/currentRecord'], function (url, currentRecord) {
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {}

    function printSerial() {
        var rec = currentRecord.get();
        console.log({
            custscript_ctc_serials_rectype: rec.type,
            custscript_ctc_serials_recid: rec.id
        });

        var link = url.resolveScript({
            scriptId: 'customscript_ctc_vc_sl_print_serial',
            deploymentId: 'customdeploy_ctc_vc_sl_print_serial',
            returnExternalUrl: false,
            params: {
                custscript_ctc_vc_serials_rectype: rec.type,
                custscript_ctc_vc_serials_recid: rec.id
            }
        });

        window.open(link);
    }

    return {
        pageInit: pageInit,
        printSerial: printSerial
    };
});
