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
 * @NScriptType ScheduledScript
 */
define([
    'N/search',
    'N/runtime',
    'N/record',
    './../CTC_VC2_Lib_Utils.js',
    './../CTC_VC2_Constants.js',
    './../Services/ctc_svclib_configlib.js',
    './../Services/ctc_svclib_webservice-v1.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    vc2_util,
    vc2_constant,
    vcs_configLib,
    vcs_websvcLib
) {
    var LogTitle = 'VC|D&H Item Request';
    var Current = {};

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var Helper = {
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
        checkDandHVendorConfig: function (option) {
            var logTitle = [LogTitle, '_checkDandHVendorConfig'].join(':');

            var searchOption = {
                type: vc2_constant.RECORD.VENDOR_CONFIG.ID,
                columns: ['internalid'],
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['custrecord_ctc_vc_xml_vendor', 'anyof', vc2_constant.LIST.XML_VENDOR.DandH]
                ]
            };

            var searchObj = ns_search.create(searchOption);
            var totalResults = searchObj.runPaged().count;

            if (!(totalResults > 0)) {
                vc2_util.log(logTitle, 'No D&H vendor configuration set up');
                return false;
            }

            return true;
        }
    };

    var SCHED_SCRIPT = {};
    SCHED_SCRIPT.execute = function (context) {
        var logTitle = [LogTitle, 'execute'].join(':');
        try {
            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            var MainCFG = vcs_configLib.mainConfig();
            if (!MainCFG) throw ERROR_MSG.MISSING_CONFIG;

            if (!Helper.checkDandHVendorConfig()) return;

            var searchId = ns_runtime
                .getCurrentScript()
                .getParameter('custscript_ctc_vc_dh_itemrequest_srch');
            if (!searchId) searchId = 'customsearch_ctc_vc_dh_itemrequest';

            vc2_util.log(logTitle, 'Search id=' + searchId);

            var searchObj = ns_search.load({ id: searchId });
            var totalResults = searchObj.runPaged().count;

            vc2_util.log(logTitle, totalResults + ' item(s) to process.');

            searchObj.run().each(function (result) {
                try {
                    var option = {
                        poId: result.id,
                        itemId: result.getValue({ name: 'item' }),
                        subsidiary: result.getValue({ name: 'subsidiary' }),
                        vendor: result.getValue({ name: 'internalid', join: 'vendor' })
                    };

                    vc2_util.log(logTitle, 'searchResult=', option);
                    var itemDetails = vcs_websvcLib.DandHItemFetch(option);
                    if (!itemDetails || !itemDetails.dnh || !itemDetails.dnhValue) {
                        vc2_util.log(
                            logTitle,
                            '## ERROR: Failed to fetch item details',
                            itemDetails
                        );
                        return true;
                    }

                    var updateValue = {};
                    updateValue[vc2_constant.FIELD.ITEM.DH_MPN] = itemDetails.dnhValue;

                    ns_record.submitFields({
                        type: itemDetails.item.recordtype,
                        id: option.itemId,
                        values: updateValue
                    });
                } catch (error) {
                    vc2_util.log(logTitle, '## ERROR: ' + JSON.stringify(error));
                }
                return true;
            });
        } catch (error) {
            vc2_util.log(logTitle, 'Error in execute: ' + error.message);
            throw error;
        }
    };

    return SCHED_SCRIPT;
});
