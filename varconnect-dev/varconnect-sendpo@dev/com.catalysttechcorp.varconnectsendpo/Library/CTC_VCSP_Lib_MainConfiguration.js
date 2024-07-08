/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Mar 09, 2020	paolodl		Library for retrieving Main Configuration record
 *
 */
define(['N/search', './CTC_VCSP_Constants'], function (
    NS_Search,
    VCSP_Global
) {
    let  mainConfigFields = [
        VCSP_Global.Fields.MainConfig.ID, //0
        VCSP_Global.Fields.MainConfig.LICENSE //1
    ];

    function _generateMainConfig(recLookup) {
        return {
            id: recLookup[mainConfigFields[0]],
            license: recLookup[mainConfigFields[1]]
        };
    }

    function getMainConfiguration() {
        let  result = {};

        let  recLookup = NS_Search.lookupFields({
            type: VCSP_Global.Records.MAIN_CONFIG,
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
