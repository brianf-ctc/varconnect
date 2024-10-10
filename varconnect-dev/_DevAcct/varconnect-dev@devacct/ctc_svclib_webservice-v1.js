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
    const LogTitle = 'SVC:WebSVC1',
        LOG_APP = 'WebSVC';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js'),
        vc_websvclib = require('../CTC_VC_Lib_WebService.js'),
        vcs_recordsLib = require('./ctc_svclib_records.js'),
        vcs_configLib = require('./ctc_svclib_configlib.js');

    // vendor libraries
    var lib_synnex = require('../CTC_VC_Lib_Synnex'),
        lib_techdata = require('../CTC_VC_Lib_TechData'),
        lib_dnh = require('../CTC_VC_Lib_DandH'),
        lib_ingram = require('../CTC_VC_Lib_Ingram'),
        lib_dell = require('../CTC_VC_Lib_Dell'),
        lib_arrow = require('../CTC_VC_Lib_Arrow'),
        lib_jenne = require('../CTC_VC_Lib_Jenne'),
        lib_scansource = require('../CTC_VC_Lib_ScanSource'),
        lib_wefi = require('../CTC_VC_Lib_WeFi.js'),
        lib_carahsoft = require('../CTC_VC_Lib_Carahsoft.js');

    var CACHE_TTL = 300; // store the data for 1mins
    var VendorList = vc2_constant.LIST.XML_VENDOR;

    var Helper = {
        getVendorLibrary: function (OrderCFG) {
            // VENDOR MAPPED  //
            var MAPPED_VENDORLIB = {
                TECH_DATA: lib_techdata,

                SYNNEX: lib_synnex,
                SYNNEX_API: lib_synnex,

                DandH: lib_dnh,

                INGRAM_MICRO: lib_ingram,
                INGRAM_MICRO_API: lib_ingram,
                INGRAM_MICRO_V_ONE: lib_ingram,

                DELL: lib_dell,

                AVNET: lib_arrow,
                WESTCON: lib_arrow,
                ARROW: lib_arrow,

                JENNE: lib_jenne,
                SCANSOURCE: lib_scansource,
                WEFI: lib_wefi,
                CARAHSOFT: lib_carahsoft
            };
            // get the vendor name from XML_VENDOR
            var vendorName;
            for (var name in VendorList) {
                if (VendorList[name] != OrderCFG.xmlVendor) continue;
                vendorName = name;
            }
            if (!vendorName) throw 'Missing vendor configuration';
            if (!MAPPED_VENDORLIB[vendorName]) throw 'Missing vendor library for ' + vendorNames;

            return MAPPED_VENDORLIB[vendorName];
        }
    };

    return {
        OrderStatusDebug: function (option) {
            var logTitle = [LogTitle, 'OrderStatusDebug'].join(':'),
                returnValue;

            var poNum = option.poNum || option.tranid,
                vendoCfgId = option.vendorConfigId;

            vc2_util.log(logTitle, '>> input: ', option);

            var MainCFG = vcs_configLib.mainConfig();

            // load the configuration
            var ConfigRec = vcs_configLib.loadConfig({
                // poNum: poNum,
                configId: vendoCfgId,
                configType: vcs_configLib.ConfigType.ORDER
            });
            vc2_util.log(logTitle, '>> ConfigRec: ', ConfigRec);

            // get the Vendor Library
            var vendorLib = Helper.getVendorLibrary(ConfigRec);

            var response = vendorLib.processRequest({
                poNum: poNum,
                orderConfig: ConfigRec
            });
            vc2_util.log(logTitle, '/// response: ', response);

            return response;
        },

        orderStatus: function (option) {
            var logTitle = [LogTitle, 'OrderStatusDebug'].join(':'),
                returnValue = {};

            var poNum = option.poNum || option.tranid,
                poId = option.poId,
                vendoCfgId = option.vendorConfigId;

            vc2_util.log(logTitle, '###### WEBSERVICE: OrderStatus: ######', option);
            try {
                // load the configuration
                var ConfigRec = vcs_configLib.loadConfig({
                    poId: poId,
                    configId: vendoCfgId,
                    configType: vcs_configLib.ConfigType.ORDER
                });

                returnValue.prefix = ConfigRec.fulfillmentPrefix;

                // get the Vendor Library
                var vendorLib = Helper.getVendorLibrary(ConfigRec);

                var response = vendorLib.process({
                    poNum: poNum,
                    poId: poId,
                    orderConfig: ConfigRec
                });
                vc2_util.log(logTitle, '/// response: ', response);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                var errorMsg = vc2_util.extractError(error);

                returnValue.isError = true;
                returnValue.errorMessage = errorMsg;
            } finally {
                vc2_util.log(logTitle, '#####  Return: #####', returnValue);
            }

            return returnValue;
        }
    };
});
