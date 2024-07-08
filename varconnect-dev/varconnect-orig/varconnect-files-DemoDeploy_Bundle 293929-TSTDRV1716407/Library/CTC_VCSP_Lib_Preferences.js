/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for Account Preferences
 * 
 *//**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
define(['N/runtime'],

function(runtime) {
    return {
        ENABLE_SUBSIDIARIES: runtime.isFeatureInEffect({ feature: 'subsidiaries' }),
        PICK_PACK_SHIP: runtime.isFeatureInEffect({ feature: 'pickpackship' })
    };
});
