/**
 * Copyright (c) 2025 Catalyst Tech Corp
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

define([
    './../../CTC_VC2_Lib_Utils',
    './../../CTC_VC2_Constants',
    '../Vendors/dh_sftp',
    '../Vendors/dh_sftp_ack',
    '../Vendors/wellsfargo_sftp',
    '../Vendors/arrow_api',
    '../Vendors/ingram_api',
    '../Vendors/techdata_api',
    '../Vendors/synnex_sftp',
    '../Vendors/jenne_api',
    '../Vendors/scansource_api',
    '../Vendors/synnex_api',
    '../Vendors/carahsoft_api'
], function (
    vc2_util,
    vc2_constant,
    DH,
    DH2,
    WELLS,
    ARROW,
    INGRAM,
    TECHDATA,
    SYNNEX,
    JENNE,
    SCANSOURCE,
    SYNNEX_API,
    CARAHSOFT_API
) {
    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var LogTitle = 'LIB:VendorMap';

    function dh_sftp(input, config) {
        var returnValue;

        try {
            returnValue = DH.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'SFTP Bill File | D&H',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'SFTP Error',
                error: error,
                status: LOG_STATUS.SFTP_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function dh_sftp_ack(input, config, billId) {
        var returnValue;

        try {
            returnValue = DH2.sendAck(input, config, billId);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'SFTP Bill File | D&H Ack',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'SFTP Error',
                error: error,
                status: LOG_STATUS.SFTP_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function wellsfargo_sftp(input, config) {
        var returnValue;

        try {
            returnValue = WELLS.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'SFTP Bill File | Wells Fargo',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'SFTP Error',
                error: error,
                status: LOG_STATUS.SFTP_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function arrow_api(input, config) {
        var returnValue;

        try {
            returnValue = ARROW.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Arrow',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function ingram_api(input, config) {
        var logTitle = [LogTitle, 'ingram_api'].join(':');
        var returnValue;

        try {
            returnValue = INGRAM.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Ingram',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function techdata_api(input, config) {
        var returnValue;

        try {
            returnValue = TECHDATA.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Tech Data',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function synnex_sftp(input, config) {
        var returnValue;

        try {
            returnValue = SYNNEX.processXml(input, config);

            if (returnValue)
                vc2_util.vcLog({
                    title: 'SFTP Bill File | Synnex',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'SFTP Error',
                error: error,
                status: LOG_STATUS.SFTP_ERROR,
                details: config
            });
        }

        return returnValue;
    }

    function jenne_api(input, config) {
        var returnValue;
        try {
            returnValue = JENNE.processXml(input, config);
            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Jenne',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }
        return returnValue;
    }

    function scansource_api(input, config) {
        var returnValue;
        try {
            returnValue = SCANSOURCE.getInvoice(input, config);
            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Scansource',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }
        return returnValue;
    }

    function synnex_api(input, config) {
        var returnValue;
        try {
            returnValue = SYNNEX_API.processXml(input, config);
            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | Synnex API',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }
        return returnValue;
    }

    function carahsoft_api(input, config) {
        var returnValue;
        try {
            returnValue = CARAHSOFT_API.getInvoice(input, config);
            if (returnValue)
                vc2_util.vcLog({
                    title: 'API Bill File | CARAHSOFT API',
                    message: 'Downloaded file - ' + input,
                    details: returnValue,
                    status: LOG_STATUS.SUCCESS
                });
        } catch (error) {
            vc2_util.vcLog({
                title: 'API Error',
                error: error,
                status: LOG_STATUS.API_ERROR,
                details: config
            });
        }
        return returnValue;
    }

    // Add the return statement that identifies the entry point function.
    return {
        dh_sftp: dh_sftp,
        dh_sftp_ack: dh_sftp_ack,
        wellsfargo_sftp: wellsfargo_sftp,
        arrow_api: arrow_api,
        ingram_api: ingram_api,
        techdata_api: techdata_api,
        synnex_sftp: synnex_sftp,
        jenne_api: jenne_api,
        scansource_api: scansource_api,
        synnex_api: synnex_api,
        carahsoft_api: carahsoft_api
    };
});
