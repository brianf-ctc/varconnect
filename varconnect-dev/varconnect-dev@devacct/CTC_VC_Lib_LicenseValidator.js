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

define(['N/url', 'N/https', 'N/runtime', 'N/cache', './CTC_VC2_Constants.js'], function (
    ns_url,
    ns_https,
    ns_runtime,
    ns_cache,
    vc2_constant
) {
    function callValidationSuitelet_2(option) {
        var license = option.license,
            external = option.external ? true : null,
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

        var res = ns_https.get({ url: link });

        var result = res.body;

        return result;
    }

    var VC_LICENSE = {
        URL: 'https://nscatalystserver.azurewebsites.net/productauth.php',
        PRODUCT_CODE: 2,
        MAX_RETRY: 3,
        KEY: 'LICENSE_KEY__20231123',
        CACHE_NAME: 'VC_LICENSE',
        CACHE_TTL: 86400 // 24 hrs
    };

    var LibLicense = {
        fetchLicense: function (option) {
            var logTitle = 'VC_LICENSE::fetchLicense',
                logPrefix = '[LICENSE-CHECK] ',
                response,
                returnValue = {};

            var startTime = new Date();

            var doRetry = option.doRetry,
                maxRetry = doRetry ? option.maxRetry || VC_LICENSE.MAX_RETRY : 0,
                retryCount = option.retryCount || 1,
                retryWaitMS = option.retryWaitMS || option.retryWait || 2000;

            try {
                var queryOption = {
                    method: ns_https.Method.GET,
                    url:
                        VC_LICENSE.URL +
                        '?' +
                        ('producttypeid=' + VC_LICENSE.PRODUCT_CODE) +
                        ('&nsaccountid=' + ns_runtime.accountId)
                };
                log.audit(
                    logTitle,
                    logPrefix + 'Send Request query: ' + JSON.stringify(queryOption)
                );
                response = ns_https.request(queryOption);
                log.audit(logTitle, logPrefix + 'Response: ' + JSON.stringify(response));

                if (!response || !response.body) throw 'Unable to get response';
                if (!response.code || response.code !== 200)
                    throw 'Received invalid response code - ' + response.code;

                // turn off retry from this point, since we can confirm that we are able to connect
                doRetry = false;

                var parsedResp = LibLicense.safeParse(response.body);
                if (!parsedResp) throw 'Unable to parse response';

                returnValue = parsedResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = LibLicense.extractError(error);

                if (doRetry && maxRetry > retryCount) {
                    log.audit(logTitle, logPrefix + '... retry count : ' + retryCount);
                    option.retryCount = retryCount + 1;
                    LibLicense.waitMs(retryWaitMS); // wait before re-sending
                    LibLicense.fetchLicense(option);
                }
            } finally {
                var durationSec = LibLicense.roundOff((new Date() - startTime) / 1000);
                log.audit(logTitle, logPrefix + '# response time: ' + durationSec + 's');
            }

            return returnValue;
        },
        validate: function (option) {
            var logTitle = 'VC_LICENSE::validate',
                logPrefix = '[LICENSE-CHECK] ',
                returnValue = {};

            try {
                // prep the cache
                var vcCache = ns_cache.getCache({
                    name: VC_LICENSE.CACHE_NAME,
                    scope: ns_cache.Scope.PROTECTED
                });

                var vcLicenseResp = vcCache.get({
                    key: VC_LICENSE.KEY,
                    ttl: VC_LICENSE.CACHE_TTL
                });
                vcLicenseResp = this.safeParse(vcLicenseResp);

                if (!vcLicenseResp || vcLicenseResp.error) {
                    vcLicenseResp = LibLicense.fetchLicense(option);
                    vcCache.put({
                        key: VC_LICENSE.KEY,
                        value: vcLicenseResp,
                        ttl: VC_LICENSE.CACHE_TTL
                    });
                    log.audit(
                        logTitle,
                        logPrefix +
                            '// CACHE STORED: ' +
                            ('key: ' + VC_LICENSE.KEY) +
                            ('| ttl: ' + VC_LICENSE.CACHE_TTL + 's')
                    );
                } else {
                    log.audit(logTitle, logPrefix + '// CACHE RETRIEVED: key: ' + VC_LICENSE.KEY);
                }

                if (vcLicenseResp.error || vcLicenseResp.hasError)
                    throw vcLicenseResp.error || vcLicenseResp.errorMsg;

                if (!vcLicenseResp.status) throw 'Unable to fetch license status';
                if (vcLicenseResp.status != 'active') throw 'License is not active';

                returnValue = vcLicenseResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = LibLicense.extractError(error);
            }

            return returnValue;
        },
        safeParse: function (response) {
            var logTitle = 'JSONParse',
                returnValue;
            try {
                returnValue = response ? JSON.parse(response.body || response) : null;
            } catch (error) {
                log.audit(logTitle, '## ' + LibLicense.extractError(error));
                returnValue = null;
            }

            return returnValue;
        },
        waitMs: function (waitms) {
            var logTitle = 'WaitMS';
            waitms = waitms || 5000;

            log.audit(logTitle, '// Waiting for ' + waitms);

            var nowDate = new Date(),
                isDone = false;
            while (!isDone) {
                var deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitms;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }

            return true;
        },
        extractError: function (option) {
            option = option || {};
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        },
        roundOff: function (value) {
            var flValue = util.isNumber(value) ? value : this.forceFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        }
    };

    return {
        validate: function (option) {},

        /// LEGACY VAR CONNECT LEGACY ///
        callValidationSuitelet: function (option) {
            var logTitle = 'callValidationSuitelet',
                response,
                returnValue;

            try {
                response = LibLicense.validate({ doRetry: true, retryMax: 3 });
                log.audit(logTitle, response);
                if (response.hasError) throw response.errorMsg;

                returnValue = 'valid';
            } catch (error) {
                log.error(logTitle, error);
                returnValue = response.errorMsg;
            }

            return returnValue;
        }
    };
});
