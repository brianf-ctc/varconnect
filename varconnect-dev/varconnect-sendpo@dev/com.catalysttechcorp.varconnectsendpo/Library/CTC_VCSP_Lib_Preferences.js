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
 * 1.00		Jan 9, 2020		paolodl		Library for Account Preferences
 *
 */
define(['N/runtime'], function (runtime) {
    return {
        ENABLE_SUBSIDIARIES: runtime.isFeatureInEffect({ feature: 'subsidiaries' }),
        PICK_PACK_SHIP: runtime.isFeatureInEffect({ feature: 'pickpackship' })
    };
});
