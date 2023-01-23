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
 * @NScriptType MapReduceScript
 */
define(function (request) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime');

    var vc2_util = require('./CTC_VC2_Lib_Utils'),
        vc2_main = require('./CTC_VC2_Lib_Main'),
        vc_websvc = require('./CTC_VC_Lib_WebService'),
        vc_record = require('./netsuitelibrary_v2'),
        util_record = require('./CTC_VC_Lib_Record'),
        vc_log = require('./CTC_VC_Lib_Log'),
        vc2_constant = require('./CTC_VC2_Constants');

    var LogTitle = 'RL_OrderStatus',
        LogPrefix = '',
        Current = {};

    var RESTLET = {
        post: function (scriptContext) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            try {
                util.extend(Current, {
                    poId: scriptContext.purchase_id || scriptContext.poId,
                    action: scriptContext.action
                });
                log.debug(logTitle, '##### START SCRIPT ##### ' + JSON.stringify(Current));
                LogPrefix = '[' + ['PO', Current.poId, Current.action].join(':') + '] ';

                if (!vc2_main.validateLicense()) return 'Invalid license';

                Current.MainCFG = vc2_main.loadMainConfig();
                if (!Current.MainCFG) throw 'Missing Main Config';

                // load the PO
                Current.recordPO = ns_record.load({
                    type: ns_record.Type.PURCHASE_ORDER,
                    id: Current.poId,
                    isDynamic: true
                });
                Current.poData = util_record.extractValues({
                    record: Current.recordPO,
                    fields: ['tranid', 'trandate', 'subsidiary', 'entity', 'dropshipso', 'custbody_ctc_po_link_type']
                });
                log.debug(logTitle, LogPrefix + Current.poData);

                Current.VendorCFG = vc2_main.loadVendorConfig({
                    vendor: Current.poData.entity,
                    subsidiary: Current.poData.subsidiary
                });
                if (!Current.VendorCFG) throw 'Missing Vendor Config';

                Current.isDropPO =
                    Current.poData.dropshipso || Current.poData.custbody_ctc_po_link_type == 'Drop Shipment';

                // TODO: create new websvc lib
                var outputObj = vc_websvc.process({
                    mainConfig: Current.MainCFG,
                    vendorConfig: Current.VendorCFG,
                    vendor: Current.poData.entity,
                    po_record: Current.recordPO,
                    poId: Current.poId,
                    poNum: Current.poData.tranid,
                    tranDate: Current.poData.trandate,
                    subsidiary: subsidiary,
                    countryCode: Current.VendorCFG.countryCode
                });

                log.debug(logTitle, LogPrefix + '>> Order Lines: ' + JSON.stringify(outputObj));

                // if there are no lines.. just exit the script
                if (!outputObj.itemArray || (!outputObj.itemArray.length && !outputObj.itemArray.header_info)) {
                    throw 'No line items to process';
                }

                // TODO: create update record
                var updateStatus = vc_record.updatepo({
                    po_record: Current.recordPO,
                    poNum: Current.poData.tranid,
                    lineData: outputObj.itemArray,
                    mainConfig: Current.MainCFG,
                    vendorConfig: Current.VendorCFG
                });
                log.debug(logTitle, LogPrefix + '>> Update status: ' + JSON.stringify(updateStatus));

                Current.soId = updateStatus && updateStatus.id;

                if (!updateStatus || updateStatus.error || updateStatus.lineuniquekey) {
                    // todo: move vc log to vc main lib
                    vc_log.recordLog({
                        header: 'PO Update | Error',
                        body: vc2_util.extractError(updateStatus.error),
                        transaction: docid,
                        transactionLineKey: updateStatus.lineuniquekey,
                        status: vc2_constant.Lists.VC_LOG_STATUS.ERROR
                    });
                }

                Current.recordSO = Current.soId
                    ? ns_record.load({
                          type: ns_record.Type.SALES_ORDER,
                          id: Current.soId
                      })
                    : null;

                Current.soData = Current.recordSO
                    ? util_record.extractValues({ record: Current.recordSO, fields: ['entity'] })
                    : null;
            } catch (error) {
                util.extend(returnObj, {
                    msg: error.msg || vc2_util.extractError(error),
                    details: returnObj.details || JSON.stringify(error),
                    isError: true
                });

                log.debug(logTitle, LogPrefix + '!! ERROR !! ' + JSON.stringify(error));
            } finally {
                log.debug(logTitle, '##### EXIT SCRIPT ##### ' + JSON.stringify(returnObj));
            }

            return returnObj;
        }
    };

    var Helper = {
        getSubsidiary: function (poId) {
            var logTitle = [LogTitle, 'getSubsidiary'].join('::');
            log.debug(logTitle, LogPrefix + '>> poId: ' + JSON.stringify(poId));

            var subsidiary = null;

            if (vc_global.ENABLE_SUBSIDIARIES) {
                var lookupObj = ns_search.lookupFields({
                    type: ns_search.Type.TRANSACTION,
                    id: poId,
                    columns: 'subsidiary'
                });
                subsidiary = lookupObj.subsidiary[0].value;
            }

            return subsidiary;
        }
    };

    return RESTLET;
});
