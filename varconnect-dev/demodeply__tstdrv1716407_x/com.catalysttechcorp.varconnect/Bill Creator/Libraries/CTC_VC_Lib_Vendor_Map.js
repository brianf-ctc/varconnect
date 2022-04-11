/**
 * vendor_map.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define([
    '../Vendors/dh_sftp',
    '../Vendors/dh_sftp_ack',
    '../Vendors/wellsfargo_sftp',
    '../Vendors/arrow_api',
    '../Vendors/ingram_api',
    '../Vendors/techdata_api',
    '../Vendors/synnex_sftp'
], function (DH, DH2, WELLS, ARROW, INGRAM, TECHDATA, SYNNEX) {
    function dh_sftp(input, config) {
        return DH.processXml(input, config);
    }

    function dh_sftp_ack(input, config, billId) {
        return DH2.sendAck(input, config, billId);
    }

    function wellsfargo_sftp(input, config) {
        return WELLS.processXml(input, config);
    }

    function arrow_api(input, config) {
        return ARROW.processXml(input, config);
    }

    function ingram_api(input, config) {
        return INGRAM.processXml(input, config);
    }

    function techdata_api(input, config) {
        return TECHDATA.processXml(input, config);
    }

    function synnex_sftp(input, config) {
        return SYNNEX.processXml(input, config);
    }

    // Add the return statement that identifies the entry point function.
    return {
        dh_sftp: dh_sftp,
        dh_sftp_ack: dh_sftp_ack,
        wellsfargo_sftp: wellsfargo_sftp,
        arrow_api: arrow_api,
        ingram_api: ingram_api,
        techdata_api: techdata_api,
        synnex_sftp: synnex_sftp
    };
});
