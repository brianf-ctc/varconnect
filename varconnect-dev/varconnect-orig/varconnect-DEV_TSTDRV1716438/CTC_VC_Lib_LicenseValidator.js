define(['N/url', 'N/https', './CTC_VC_Constants.js'], function (url, https, constants) {
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
