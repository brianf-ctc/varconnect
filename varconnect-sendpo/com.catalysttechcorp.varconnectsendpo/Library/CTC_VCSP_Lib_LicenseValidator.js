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
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.01		Mar 20, 2023	christian	Library for license validation
 *
 */
define(['N/url', 'N/https', './CTC_VCSP_Constants'], function (NS_Url, NS_Https, VCSP_Global) {
    function callValidationSuitelet(options) {
        let license = options.license,
            external = options.external ? true : null,
            params = { custparam_license: license },
            protocol = 'https://',
            domain = NS_Url.resolveDomain({
                hostType: NS_Url.HostType.APPLICATION
            }),
            linkUrl = NS_Url.resolveScript({
                scriptId: VCSP_Global.Scripts.Script.LICENSE_VALIDATOR_SL,
                deploymentId: VCSP_Global.Scripts.Deployment.LICENSE_VALIDATOR_SL,
                params: params,
                returnExternalUrl: external
            }),
            link = external ? linkUrl : protocol + domain + linkUrl;

        let res = NS_Https.get({
            url: link
        });

        let result = res.body;

        return result;
    }

    function isLicenseValid(options) {
        let mainConfig = options.mainConfig,
            license = mainConfig.license,
            result = true,
            response = callValidationSuitelet({
                license: license,
                external: true
            });

        // if (response == 'valid') result = true;

        return result;
    }

    return {
        callValidationSuitelet: callValidationSuitelet,
        isLicenseValid: isLicenseValid
    };
});
