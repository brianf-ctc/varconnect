/**
 * Copyright (c) 2024  sCatalyst Tech Corp
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
define(function (require) {
    const LogTitle = 'SVC:VCProcess',
        LOG_APP = 'VCProcess';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js'),
        vcs_websvclib = require('./ctc_svclib_webservice-v1.js'),
        vcs_recordsLib = require('./ctc_svclib_records.js'),
        vcs_configLib = require('./ctc_svclib_configlib.js'),
        vc2_record = require('./../CTC_VC2_Lib_Record.js');

    var ns_search = require('N/search'),
        ns_record = require('N/record'),
        ns_error = require('N/error');

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    return {
        OrderStatus: function (option) {
            var logTitle = [LogTitle, 'OrderStatus'].join(':'),
                returnValue;

            var poNum = option.poNum || option.tranid,
                poId = option.poId || option.id;

            var poData = vcs_recordsLib.searchPO({ name: poNum, id: poId });
            if (vc2_util.isEmpty(poData)) throw 'Unable to find Purchase Order';

            // load the PO Record
            var PO_REC = vc2_record.load({
                type: 'purchaseorder',
                id: poData.id,
                isDynamic: true
            });

            poData.isDropPO =
                PO_REC.getValue({ fieldId: 'dropshipso' }) ||
                poData.custbody_ctc_po_link_type == 'Drop Shipment' ||
                poData.custbody_isdropshippo;

            vc2_util.log(logTitle, '>> PO Data: ', poData);

            // FILTER
            if (!option.forceOrderStatus) {
                if (poData.custbody_ctc_bypass_vc) throw ERROR_MSG.BYPASS_VARCONNECT;
                if (vc2_util.isEmpty(poData.createdfrom)) throw 'Missing Sales Order';
            }

            var vendor = poData.vendor
                    ? poData.vendor.value || poData.vendor
                    : poData.entityId
                    ? poData.entityId.value || poData.entityId
                    : null,
                subsidiary = poData.subsidiary || null,
                mainConfig = vcs_configLib.mainConfig(),
                vendorConfig = vcs_configLib.vendorConfig({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            // get the output lines
            var outputObj = vcs_websvclib.OrderStatus({
                poNum: poNum,
                poId: poId,
                po_record: PO_REC,
                configId: vendorConfig
            });

            // if there are no lines.. just exit the script
            if (
                !outputObj.itemArray ||
                (!outputObj.itemArray.length && !outputObj.itemArray.header_info)
            ) {
                throw outputObj.isError && outputObj.errorMessage
                    ? { message: outputObj.errorMessage, logStatus: LOG_STATUS.WS_ERROR }
                    : util.extend(ERROR_MSG.NO_LINES_TO_PROCESS, {
                          details: outputObj
                      });
            }

            // try to update the PO Lines

            returnValue = outputObj;
            return returnValue;
        }
    };
});
