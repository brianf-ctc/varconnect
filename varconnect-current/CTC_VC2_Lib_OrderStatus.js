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
 */

define(function (require) {
    var ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_record = requrie('N/record');

    var LogTitle = 'LIB_ItemFF',
        LogPrefix = '',
        Current = {};

    var OrderStatusLib = {
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::');

            try {
                Current.Script = ns_runtime.getCurrentScript();
                Current.Features = {
                    MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                    MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })
                };
                Current.PO_ID = option.poId || option.purchaseOrderId;
                Current.SO_ID = option.soId || option.salesOrderId;

                LogPrefix = '[purchaseorder:' + Current.PO_ID + ']';
            } catch (error) {
                var errorMsg = vc2_util.extractError(error);
                log.error(
                    logTitle,
                    vc2_util.getUsage() +
                        (LogPrefix + '## ERROR:  ') +
                        (errorMsg + '| Details: ' + JSON.stringify(error))
                );
                Helper.logMsg({ title: logTitle + ':: Error', error: error });
                throw error;
                return false;
            } finally {
            }
        }
    };

    return OrderStatusLib;
});
