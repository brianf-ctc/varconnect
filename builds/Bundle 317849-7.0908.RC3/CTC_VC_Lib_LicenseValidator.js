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

define(['N/url', 'N/https', './CTC_VC2_Constants.js'], function (ns_url, ns_https, vc2_constant) {
    function callValidationSuitelet(options) {
        var license = options.license,
            external = options.external ? true : null,
            params = { custparam_license: license },
            protocol = 'https://',
            domain = ns_url.resolveDomain({
                hostType: ns_url.HostType.APPLICATION
            }),
            linkUrl = ns_url.resolveScript({
                scriptId: vc2_constant.SCRIPT.LICENSE_VALIDATOR_SL,
                deploymentId: vc2_constant.DEPLOYMENT.LICENSE_VALIDATOR_SL,
                params: params,
                returnExternalUrl: external
            }),
            link = protocol + domain + linkUrl;

        if (external) link = linkUrl;

        var res = ns_https.get({
            url: link
        });

        var result = res.body;

        return result;
    }

    return {
        callValidationSuitelet: callValidationSuitelet
    };
});
