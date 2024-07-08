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
 * @NScriptType Suitelet
 */
define(['N/redirect', 'N/log'], function (redirect, log) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            redirect.toRecord({
                id: 1,
                type: 'customrecord_vc_config'
            });
        }
    }
    return {
        onRequest: onRequest
    };
});
