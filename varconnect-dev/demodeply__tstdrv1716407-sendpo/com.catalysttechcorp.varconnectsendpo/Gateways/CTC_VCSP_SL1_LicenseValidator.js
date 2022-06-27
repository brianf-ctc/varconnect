/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
var PRODUCT_CODE = 4, //VAR Connect Send PO
    LICENSE_AES_SECRET = '636174616C79737434615870300B0B0B';

function _decryptLicense(options) {
    var license = options.license,
        product,
        expiryDate,
        accountId;

    try {
        var decryptedLicenseKey = nlapiDecrypt(license, 'aes', LICENSE_AES_SECRET);
        //		nlapiLogExecution('debug','decryptedLicenseKey', decryptedLicenseKey);
        if (decryptedLicenseKey) {
            var resultArray = decryptedLicenseKey.split('|'),
                product = resultArray[0],
                expiryDate = nlapiStringToDate(resultArray[1]),
                accountId = resultArray[2];
        }
    } catch (e) {}

    return {
        product: product,
        expiryDate: expiryDate,
        accountId: accountId
    };
}

function _validateLicenseParams(options) {
    var licenseParams = options.licenseParams,
        licenseProduct = licenseParams.product,
        licenseExpiryDate = licenseParams.expiryDate,
        licenseAccountId = licenseParams.accountId,
        dateToday = new Date(),
        accountId = nlapiGetContext().getCompany(),
        result = 'valid';

    if (licenseProduct != PRODUCT_CODE) {
        nlapiLogExecution(
            'ERROR',
            'Invalid License Key - TERMINATING SCRIPT',
            'Reason: Mismatch Product ID. Are you sure this license is for the correct catalyst product? License Product ID: ' +
                licenseProduct +
                '  Current Product ID: ' +
                PRODUCT_CODE
        );
        result = 'invalid';
    } else if (
        licenseAccountId &&
        accountId &&
        licenseAccountId.toLowerCase() != accountId.toLowerCase()
    ) {
        nlapiLogExecution(
            'ERROR',
            'Invalid License Key - TERMINATING SCRIPT',
            'Reason: Mismatch Netsuite Account. Are you sure this license is for this customer? License Account ID: ' +
                licenseAccountId +
                '  Current Account ID: ' +
                accountId
        );
        result = 'invalid';
    } else {
        var dateDifference = date_difference(dateToday, licenseExpiryDate);
        if (dateDifference < 0) {
            nlapiLogExecution(
                'ERROR',
                'Invalid License Key - TERMINATING SCRIPT',
                'Reason: License has expired, please renew. Expiration Date: ' +
                    licenseExpiryDate +
                    ' Current Date: ' +
                    dateToday
            );
            result = 'invalid';
        }
    }

    return result;
}

function date_difference(date1, date2) {
    //if 0 or positive number, then date is still within expiration period, if negative then license is expired
    var timeDiff = date2.getTime() - date1.getTime();
    var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Get 1 day in milliseconds
    return diffDays;
}

function processLicense(request, response) {
    var result = false;

    if (request.getMethod() == 'GET') {
        var license = request.getParameter('custparam_license');

        if (license) {
            var licenseParams = _decryptLicense({ license: license });

            result = _validateLicenseParams({ licenseParams: licenseParams });
        }
    }

    nlapiLogExecution('debug', 'result', result);

    response.write(result);
}
