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
define(function (request) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime');

    var vc_util = require('./CTC_VC2_Lib_Utils'),
        vc_constants = require('./CTC_VC2_Constants');

    var LogTitle = 'RL_OrderStatus',
        LogPrefix = '',
        Current = {};

    var RESTLET = {
        post: function (scriptContext) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            try {
                log.debug(logTitle, '##### START SCRIPT ##### ' + JSON.stringify(returnObj));
            } catch (error) {
                util.extend(returnObj, {
                    msg: error.msg || vc_util.extractError(error),
                    details: returnObj.details || JSON.stringify(error),
                    isError: true
                });

                log.debug(logTitle, LogPrefix + '!! ERROR !! ' + JSON.stringify(error));
            } finally {
                log.debug(logTitle, '##### EXIT SCRIPT ##### ' + JSON.stringify(returnObj));
            }

            return returnObj;
        }
    };

    return RESTLET;
});
