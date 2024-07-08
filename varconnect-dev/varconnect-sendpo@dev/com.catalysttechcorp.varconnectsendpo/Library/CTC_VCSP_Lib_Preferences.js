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
 * 1.00		Jan 9, 2020		paolodl		Library for Account Preferences
 *
 */
define(['N/runtime'], function (NS_Runtime) {
    return {
        isSubsidiariesEnabled: function() {
            return NS_Runtime.isFeatureInEffect({ feature: 'subsidiaries' });
        },
        isPickPackShip: function() {
            return NS_Runtime.isFeatureInEffect({ feature: 'pickpackship' });
        }
    };
});
