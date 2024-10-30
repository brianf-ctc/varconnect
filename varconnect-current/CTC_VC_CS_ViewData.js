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
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {
    return {
        refreshButton: function () {},
        triggerScript: function () {
            var curRec = currentRecord.get();
            var url = curRec.getValue({ fieldId: 'custpage_suitelet_url' });
            url += '&taskact=processbill';

            return window.open(url);

        }
    };
});
