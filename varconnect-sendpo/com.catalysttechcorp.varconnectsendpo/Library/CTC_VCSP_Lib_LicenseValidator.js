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
define(['N/url', 'N/https', 'N/cache', 'N/runtime', './CTC_VCSP_Constants'], function (
    ns_url,
    ns_https,
    ns_cache,
    ns_runtime,
    VCSP_Global
) {
    let VC_LICENSE = {
        URL: 'https://nscatalystserver.azurewebsites.net/productauth.php',
        PRODUCT_CODE: 2, // unified license with VAR Connect Order Update
        MAX_RETRY: 3,
        KEY: 'LICENSE_KEY',
        CACHE_NAME: 'VCSP_LICENSE',
        CACHE_TTL: 86400 // 24 hrs
    };
    let LibLicense = {
        fetchLicense: function (option) {
            let logTitle = 'VC_LICENSE::fetchLicense',
                response,
                returnValue = {};
            let startTime = new Date();
            let doRetry = option.doRetry,
                maxRetry = doRetry ? option.maxRetry || VC_LICENSE.MAX_RETRY : 0,
                retryCount = option.retryCount || 1,
                retryWaitMS = option.retryWaitMS || option.retryWait || 2000;
            try {
                let queryOption = {
                    method: ns_https.Method.GET,
                    url:
                        VC_LICENSE.URL +
                        '?' +
                        ['producttypeid=' + VC_LICENSE.PRODUCT_CODE, 'nsaccountid=' + ns_runtime.accountId].join('&')
                };
                log.audit(logTitle, '#### Send Request query: ' + JSON.stringify(queryOption));
                response = ns_https.request(queryOption);
                log.audit(logTitle, '#### Response: ' + JSON.stringify(response));
                if (!response || !response.body) throw 'Unable to get response';
                if (!response.code || response.code !== 200) throw 'Received invalid response code - ' + response.code;
                // turn off retry from this point, since we can confirm that we are able to connect
                doRetry = false;
                let parsedResp = LibLicense.safeParse(response.body);
                if (!parsedResp) throw 'Unable to parse response';
                returnValue = parsedResp;
            } catch (error) {
                returnValue.hasError = true;
                returnValue.errorMsg = LibLicense.extractError(error);
                if (doRetry && maxRetry > retryCount) {
                    log.audit(logTitle, '// Retrying count : ' + retryCount);
                    option.retryCount = retryCount + 1;
                    LibLicense.waitMs(retryWaitMS); // wait before re-sending
                    LibLicense.fetchLicense(option);
                }
            } finally {
                let durationSec = LibLicense.roundOff((new Date() - startTime) / 1000);
                log.audit(logTitle, '// response time: ' + durationSec + 's');
            }
            return returnValue;
        },
        validate: function (option) {
            let logTitle = 'VC_LICENSE::validate',
                returnValue = {};
            try {
                // prep the cache
                let vcCache = ns_cache.getCache({
                    name: VC_LICENSE.CACHE_NAME,
                    scope: ns_cache.Scope.PROTECTED
                });
                let vcLicenseResp = vcCache.get({
                    key: VC_LICENSE.KEY,
                    ttl: VC_LICENSE.CACHE_TTL
                });
                vcLicenseResp = LibLicense.safeParse(vcLicenseResp);
                if (!vcLicenseResp || vcLicenseResp.error) {
                    vcLicenseResp = LibLicense.fetchLicense(option);
                    vcCache.put({
                        key: VC_LICENSE.KEY,
                        value: vcLicenseResp,
                        ttl: VC_LICENSE.CACHE_TTL
                    });
                    log.audit(
                        logTitle,
                        '// CACHE STORED: ' +
                            ['key: ' + VC_LICENSE.KEY, 'ttl: ' + VC_LICENSE.CACHE_TTL + 's'].join(', ')
                    );
                } else {
                    log.audit(logTitle, '// CACHE RETRIEVED: key: ' + VC_LICENSE.KEY);
                }
                if (vcLicenseResp.error || vcLicenseResp.hasError) throw vcLicenseResp.error || vcLicenseResp.errorMsg;
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
            let logTitle = 'JSONParse',
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
            let logTitle = 'WaitMS';
            waitms = waitms || 5000;
            log.audit(logTitle, '// Waiting for ' + waitms);
            let nowDate = new Date(),
                isDone = false;
            while (!isDone) {
                let deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitms;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }
            return true;
        },
        extractError: function (option) {
            option = option || {};
            let errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);
            if (!errorMessage || !util.isString(errorMessage)) errorMessage = 'Unexpected Error occurred';
            return errorMessage;
        },
        roundOff: function (value) {
            let flValue = util.isNumber(value) ? value : parseFloat(value) || 0;
            if (!flValue || isNaN(flValue)) return 0;
            return Math.round(flValue * 100) / 100;
        }
    };

    function isLicenseValid(option) {
        let returnValue = false,
            response = LibLicense.validate({
                doRetry: true
            });
        if (response && response.status == 'active') {
            returnValue = true;
        }
        return returnValue;
    }

    return {
        isLicenseValid: isLicenseValid
    };
});
