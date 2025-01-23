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
 * @NScriptType MapReduceScript
 * @Description Syncs D&H Item information for use with VAR Connect
 */
/**
 * Project Number: TODO-001225
 * Script Name: CTC MR DandH Item Request
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jan 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.01		Oct 25, 2022	christian@nscatalyst.com	Support non-inventory type
 */
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/https',
    'N/xml',
    './../CTC_VC2_Lib_Utils.js',
    './../CTC_VC2_Constants.js',
    './../Services/ctc_svclib_configlib.js',
    './../Services/ctc_svclib_webservice-v1.js'
], function (
    ns_search,
    ns_record,
    ns_runtime,
    ns_https,
    ns_xml,
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

    var MAP_REDUCE = {};

    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join(':');

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

        return searchObj;
    };

    MAP_REDUCE.map = function (mapContext) {
        var logTitle = [LogTitle, 'map'].join(':');

        try {
            vc2_util.logDebug(logTitle, '###### START: MAP ######');
            var searchResult = JSON.parse(mapContext.value);
            // vc2_util.log(logTitle, 'searchResult=', searchResult);

            var currentData = {
                poId: searchResult.id,
                itemId: searchResult.values.item.value,
                itemName: searchResult.values.item.text,
                itemType: searchResult.values['type.item'].value,
                upcCode: searchResult.values['upccode.item'],
                vendor: searchResult.values['internalid.vendor'].value,
                subsidiary: searchResult.values.subsidiary.value
            };
            vc2_util.log(logTitle, '/// currentData: ', currentData);

            // use the item id as key
            mapContext.write(currentData.itemId, currentData);
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw error;
        } finally {
            vc2_util.logDebug(logTitle, '###### END: MAP ###### ');
        }
    };

    MAP_REDUCE.reduce = function (reduceContext) {
        var logTitle = [LogTitle, 'reduce'].join(':');
        try {
            vc2_util.logDebug(logTitle, '###### START: REDUCE ######');
            var searchResult = JSON.parse(reduceContext.values[0]);
            vc2_util.log(logTitle, '// searchResult: ', searchResult);

            var itemDetails = vcs_websvcLib.DandHItemFetch({
                poId: searchResult.poId,
                itemId: searchResult.itemId,
                subsidiary: searchResult.subsidiary,
                vendor: searchResult.vendor
            });

            if (!itemDetails || !itemDetails.dnh || !itemDetails.dnhValue) {
                vc2_util.log(logTitle, '## ERROR: Failed to fetch item details', itemDetails);
                return true;
            }
            vc2_util.log(logTitle, '... Updating item:', itemDetails);

            var updateValue = {};
            updateValue[vc2_constant.FIELD.ITEM.DH_MPN] = itemDetails.dnhValue;

            var itemId = ns_record.submitFields({
                type: itemDetails.item.recordtype,
                id: searchResult.itemId,
                values: updateValue
            });

            // send report to summarize
            reduceContext.write({
                updatedItem: itemId,
                itemName: itemDetails.item.itemName,
                dnhValue: itemDetails.dnhValue
            });
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw error;
        } finally {
            vc2_util.logDebug(logTitle, '###### END: REDUCE ###### ');
        }
    };

    MAP_REDUCE.summarize = function (summaryContext) {
        var logTitle = [LogTitle, 'summarize'].join(':');

        vc2_util.logDebug(logTitle, '###### START: SUMMARIZE ######');

        // report how many items were updated
        var totalUpdatedItems = 0;
        var updatedItems = [];
        summaryContext.output.iterator().each(function (key, value) {
            totalUpdatedItems++;
            updatedItems.push(value);
            return true;
        });

        vc2_util.log(logTitle, 'Total updated items:', totalUpdatedItems);
        vc2_util.log(logTitle, 'Updated Items:', updatedItems);

        vc2_util.logDebug(logTitle, '###### END: SUMMARIZE ######');
    };

    return MAP_REDUCE;
});
