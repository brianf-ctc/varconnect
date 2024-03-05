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
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Restlet
 */
define(function (require) {
    var LogTitle = 'VC_SERV',
        LogPrefix = '';

    var vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js');

    const SERVICES_MAP = {
        processV1: {
            lib: require('./ctc_svclib_process-v1.js')
        },
        webserviceLibV1: {
            lib: require('./ctc_svclib_webservice-v1.js')
        },
        recordsLib: {
            lib: require('./ctc_svclib_records'),
            actions: ['itemSearch', 'fetchItemsPO', 'searchPO']
        },
        configLib: {
            lib: require('./ctc_svclib_configlib.js')
        },
        billcreateLib: {
            lib: require('./ctc_svclib_billcreate')
        }
    };

    var Helper = {
        fetchModuleName: function (action) {
            var moduleName;

            for (var mod in SERVICES_MAP) {
                if (vc2_util.inArray(action, SERVICES_MAP[mod].actions)) moduleName = mod;
                if (moduleName) break;
            }
            return moduleName;
        }
    };

    return {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            try {
                log.audit(logTitle, '>> scriptContext:  ' + JSON.stringify(context));

                // validate the action
                if (!context || !util.isObject(context)) throw 'Invalid request';

                var actionName = context.action,
                    moduleName = context.moduleName || Helper.fetchModuleName(actionName);

                vc2_util.log(logTitle, 'action/module', [actionName, moduleName]);

                if (!actionName) throw 'Missing action - ' + actionName;
                if (!moduleName) throw 'Unregistered action or missing module - ' + actionName;

                var moduleLib = SERVICES_MAP[moduleName].lib;

                if (!moduleLib[actionName]) throw 'Missing or Invalid method name - ' + actionName;

                returnObj = moduleLib[actionName].call(null, context.parameters || {});

                // look for service module
            } catch (error) {
                log.error(logTitle, error);

                returnObj = {
                    status: 'error',
                    isError: true,
                    message: vc2_util.extractError(error),
                    details: error
                };
            } finally {
                log.audit(logTitle, '/// returnObj:  ' + JSON.stringify(returnObj));
            }

            return returnObj;
        },
        get: function (context) {
            var logTitle = [LogTitle, 'GET'].join('::'),
                returnValue = {};

            try {
            } catch (error) {
            } finally {
            }

            return returnValue;
        }
    };
});
