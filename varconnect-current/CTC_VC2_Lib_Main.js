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

define(function (require) {
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime');

    var vc2_util = require('./CTC_VC2_Lib_Utils'),
        vc2_constant = require('./CTC_VC2_Constants'),
        vc2_record = require('./CTC_VC2_Lib_Record'),
        vc_license = require('./CTC_VC_Lib_LicenseValidator'),
        vc_maincfg = require('./CTC_VC_Lib_MainConfiguration'),
        vc_vendorcfg = require('./CTC_VC_Lib_VendorConfig');

    var vclib_websvc = require('./CTC_VC_Lib_WebService');

    var LogTitle = 'LIB_VCMain',
        LogPrefix = '',
        Current = {};

    Helper = {
        getOrderRecord: function (option) {
            var logTitle = [LogTitle, 'getOrderRecord'].join('::'),
                returnValue;

            var poId = option.poId || option.internalId || option.id || Current.PO_ID,
                poNum = option.poNum || option.tranid || Current.PO_NUM;

            if (!poId && !poNum) return false;

            if (!poId) {
                // search for the poid
                var tranSearchObj = search.create({
                    type: 'purchaseorder',
                    filters: [
                        ['type', 'anyof', 'PurchOrd'],
                        'AND',
                        ['number', 'equalto', poNum],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['internalid', 'tranid']
                });

                tranSearchObj.run().each(function (result) {
                    poId = result.getValue({ name: 'internalid' });
                    poNum = result.getValue({ name: 'tranid' });
                    return true;
                });

                Current.PO_ID = poId;
                Current.PO_NUM = poNum;
            }

            if (!Current.PO_ID) return false;

            Current.PO_REC = vc2_record.load({
                type: ns_record.Type.PURCHASE_ORDER,
                id: Current.PO_ID,
                isDynamic: true
            });

            return Current.PO_REC;
        }
    };

    var VC_Main = {
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');
            // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));
            // return true;

            var mainConfig = option.mainConfig || this.loadMainConfig(),
                license = mainConfig.license,
                response = vc_license.callValidationSuitelet({
                    license: license,
                    external: true
                });

            if (response == 'invalid')
                throw new Error(
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
        },
        loadMainConfig: function () {
            var logTitle = [LogTitle, 'loadMainConfig'].join('::');

            var mainConfig = vc_maincfg.getMainConfiguration();
            if (!mainConfig) {
                log.error(logTitle, 'No Configuration available');
                throw new Error('No Configuration available');
            }

            return mainConfig;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');
            // log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary;

            // get the vendor name
            if (!vendor || !subsidiary) {
                if (!Current.PO_REC) Helper.getOrderRecord();

                var poData = vc2_record.extractValues({
                    record: Current.PO_REC,
                    fields: ['tranid', 'entity', 'subsidiary']
                });
                vendor = poData.entity;
                vendorName = poData.entity_text;
                subsidiary = poData.subsidiary;
            }

            var vendorConfig = vc_vendorcfg.getVendorConfiguration({
                vendor: vendor,
                subsidiary: subsidiary
            });

            if (!vendorConfig) throw 'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName;

            // log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));

            return vendorConfig;
        }
    };

    //// ORDER STATUS /////////
    VC_Main.checkOrderStatus = function (option) {
        var logTitle = [LogTitle, 'checkOrderStatus'].join('::'),
            returnValue;

        // get the vendor record
        Current.MainCFG = option.mainConfig || this.loadMainConfig();

        Current.PO_NUM = option.poNum;
        Current.PO_ID = option.poId;
        Current.PO_REC = option.record || option.poRecord || Helper.getOrderRecord(option);

        if (!Current.PO_REC) throw 'Unable to load purchase order record';

        if (!Current.MainCFG) throw 'Unable to load the main configuration';

        Current.VendorCFG =
            option.vendorConfig ||
            this.loadVendorConfig({
                vendor: option.vendor
            });

        return returnValue;
    };

    VC_Main.findMatchingOrderLines = function (option) {
        var logTitle = [LogTitle, 'findMatchingOrderLines'].join('::'),
            returnValue;

        return returnValue;
    };

    ///////////////////////////

    return VC_Main;
});
