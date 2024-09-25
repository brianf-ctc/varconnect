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
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Mar 09, 2020	paolodl		Library for retrieving Main Configuration record
 *
 */
define(['N/search', './CTC_VCSP_Lib_Preferences', './CTC_VCSP_Constants.js'], function (
    search,
    pref,
    constants
) {
    var mainConfigFields = [
        constants.Fields.MainConfig.ID, //0
        constants.Fields.MainConfig.LICENSE //1
    ];

    function _generateMainConfig(recLookup) {
        return {
            id: recLookup[mainConfigFields[0]],
            license: recLookup[mainConfigFields[1]]
        };
    }

    function getMainConfiguration() {
        var result = {};

        var recLookup = search.lookupFields({
            type: constants.Records.MAIN_CONFIG,
            id: 1,
            columns: mainConfigFields
        });

        if (recLookup) {
            result = _generateMainConfig(recLookup);
        }

        return result;
    }

    return {
        getMainConfiguration: getMainConfiguration
    };
});
