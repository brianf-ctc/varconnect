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
define(['N/url', './CTC_VC_Constants.js'], function (url, vc_constant) {
    var Util = {
        isEmpty: function (stValue) {
            if (stValue == '' || stValue == null || stValue == undefined) {
                return true;
            } else {
                if (typeof stValue == 'string') {
                    if (stValue == '') {
                        return true;
                    }
                } else if (typeof stValue == 'object') {
                    if (stValue.length == 0 || stValue.length == 'undefined') {
                        return true;
                    }
                }

                return false;
            }
        },
        getNodeTextContent: function (node) {
            // log.debug('node', node);
            if (!Util.isUndefined(node)) return node.textContent;
            else return null;
        },
        generateSerialLink: function (params) {
            var protocol = 'https://';
            var domain = url.resolveDomain({
                hostType: url.HostType.APPLICATION
            });
            var linkUrl = url.resolveScript({
                scriptId: vc_constant.Scripts.Script.VIEW_SERIALS_SL,
                deploymentId: vc_constant.Scripts.Deployment.VIEW_SERIALS_SL,
                params: params
            });

            return protocol + domain + linkUrl;
        },
        isUndefined: function (value) {
            // Obtain `undefined` value that's guaranteed to not have been re-assigned
            var undefined = void 0;
            return value === undefined;
        },
        extractError: function (option) {
            option = option || {};
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        }
    };

    return Util;
});
