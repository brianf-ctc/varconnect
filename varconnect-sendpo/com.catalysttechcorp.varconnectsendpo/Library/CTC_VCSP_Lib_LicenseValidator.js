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
define(['N/url', 'N/https', './CTC_VCSP_Constants'], function (url, https, constants) {
    function callValidationSuitelet(options) {
        var license = options.license,
            external = options.external ? true : null,
            params = { custparam_license: license },
            protocol = 'https://',
            domain = url.resolveDomain({
                hostType: url.HostType.APPLICATION
            }),
            linkUrl = url.resolveScript({
                scriptId: constants.Scripts.Script.LICENSE_VALIDATOR_SL,
                deploymentId: constants.Scripts.Deployment.LICENSE_VALIDATOR_SL,
                params: params,
                returnExternalUrl: external
            }),
            link = protocol + domain + linkUrl;

        if (external) link = linkUrl;

        // log.debug('link', link);

        var res = https.get({
            url: link
        });

        var result = res.body;

        return result;
    }

    return {
        callValidationSuitelet: callValidationSuitelet
    };
});
