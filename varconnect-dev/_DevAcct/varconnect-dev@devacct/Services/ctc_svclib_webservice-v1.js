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
        lib_dnh = require('../CTC_VC_Lib_DandH.js'),
        lib_ingram = require('../CTC_VC_Lib_Ingram'),
        lib_dell = require('../CTC_VC_Lib_Dell'),
        lib_arrow = require('../CTC_VC_Lib_Arrow'),
        lib_jenne = require('../CTC_VC_Lib_Jenne'),
        lib_scansource = require('../CTC_VC_Lib_ScanSource'),
        lib_wefi = require('../CTC_VC_Lib_WeFi.js'),
        lib_carahsoft = require('../CTC_VC_Lib_Carahsoft.js');

    var moment = require('./lib/moment');

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
        },
        validateShipped: function (lineData) {
            var logTitle = [LogTitle, 'Helper.isShipped'].join('::');

            var isShipped = false;
            var lineShipped = { is_shipped: true };

            try {
                vc2_util.log(logTitle, '// line data: ', lineData);
                if (lineData.is_shipped) return true; // its already shipped, based on status

                if (!lineData.ship_date || lineData.ship_date == 'NA') throw 'Missing ship_date';

                var shippedDate = moment(lineData.ship_date).toDate();

                if (!util.isDate(shippedDate)) throw 'Invalid or unrecognized shipped date format';

                if (vc2_util.isEmpty(lineData.ship_qty) || lineData.ship_qty == 0)
                    throw 'No shipped quantity declared';

                if (lineData.hasOwnProperty('unitprice')) {
                    if (vc2_util.isEmpty(lineData.unitprice) || lineData.unitprice == 0)
                        throw 'Skipped: Zero unit price';
                }

                if (shippedDate > new Date()) throw 'Not yet shipped date';

                isShipped = true;
            } catch (error) {
                vc2_util.logError(logTitle, 'NOT SHIPPED: ' + error);

                lineShipped.is_shipped = false;
                lineShipped.NOTSHIPPED = vc2_util.extractError(error);
            } finally {
                util.extend(lineData, lineShipped);
                vc2_util.log(logTitle, '/// SHIPPED? ', [lineShipped, lineData]);
            }

            return isShipped;
        }
    };

    return {
        OrderStatusDebug: function (option) {
            var logTitle = [LogTitle, 'OrderStatusDebug'].join(':'),
                returnValue;

            var poNum = option.poNum || option.tranid,
                vendoCfgId = option.vendorConfigId;

            vc2_util.log(logTitle, '>> input: ', [option, poNum, option.poNum || option.tranid]);

            var MainCFG = vcs_configLib.mainConfig();

            // load the configuration
            var ConfigRec = vcs_configLib.loadConfig({
                poNum: poNum,
                configId: vendoCfgId,
                configType: vcs_configLib.ConfigType.ORDER
            });
            vc2_util.log(logTitle, '>> ConfigRec: ', ConfigRec);

            // get the Vendor Library
            var vendorLib = Helper.getVendorLibrary(ConfigRec);

            var response = option.showLines
                ? vendorLib.process({
                      poNum: poNum,
                      orderConfig: ConfigRec
                  })
                : vendorLib.processRequest({
                      poNum: poNum,
                      orderConfig: ConfigRec
                  });

            if (option.showLines && !vc2_util.isEmpty(response.Lines)) {
                response.Lines.forEach(function (lineData, lineIdx) {
                    vc2_util.log(logTitle, '....', lineData);
                    lineData = Helper.validateShipped(lineData);
                });
            }

            vc2_util.log(logTitle, '/// response: ', response);

            return response;
        },
        orderStatus: function (option) {
            var logTitle = [LogTitle, 'orderStatus'].join(':'),
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

                var outputResp = vendorLib.process({
                    poNum: poNum,
                    poId: poId,
                    orderConfig: ConfigRec
                });
                vc2_util.dumpLog(logTitle, outputResp, ' outputResp: ');
                if (outputResp.HasError) throw outputResp.ErrorMsg;

                // check for
                (outputResp.Lines || []).forEach(function (lineData) {
                    Helper.validateShipped(lineData);
                    return true;
                });

                util.extend(returnValue, {
                    itemArray: outputResp.Lines,
                    orderInfo: outputResp.Orders
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
                var errorMsg = vc2_util.extractError(error);

                returnValue.isError = true;
                returnValue.errorMessage = errorMsg;
            } finally {
                vc2_util.log(logTitle, '##### WEBSERVICE | Return: #####', returnValue);
            }

            return returnValue;
        },
        orderStatusTest: function (option) {
            var returnValue = {};
            var outputResp = {
                Orders: [
                    {
                        OrderNum: '60-FJY15',
                        OrderDate: '2024-06-06T11:30:27-07:00',
                        customerOrderNum: '124638-EW',
                        Status: 'DELIVERED',
                        Total: 53.4
                    },
                    {
                        OrderNum: '60-CN4VL',
                        OrderDate: '2023-02-24T11:01:10-08:00',
                        customerOrderNum: '124638',
                        Status: 'SHIPPED',
                        Total: 0
                    },
                    {
                        OrderNum: '60-CDRFZ',
                        OrderDate: '2022-12-30T10:20:34-08:00',
                        customerOrderNum: '124638',
                        Status: 'SHIPPED',
                        Total: 180
                    },
                    {
                        OrderNum: '60-BZ2FR',
                        OrderDate: '2022-09-15T15:59:23-07:00',
                        customerOrderNum: '124638R',
                        Status: 'DELIVERED',
                        Total: 1806.4
                    },
                    {
                        OrderNum: '60-BYWFW',
                        OrderDate: '2022-09-14T16:01:17-07:00',
                        customerOrderNum: '124638R',
                        Status: 'CANCELLED',
                        Total: 11.72,
                        ERROR: 'SKIPPED OrderStatus - CANCELLED'
                    },
                    {
                        OrderNum: '60-BMLDK',
                        OrderDate: '2022-07-21T09:29:40-07:00',
                        customerOrderNum: '124638',
                        Status: 'DELIVERED',
                        Total: 95081.12
                    }
                ],
                Lines: [
                    {
                        line_num: '001',
                        item_num: 'SFP-10G-LR=',
                        item_num_alt: '06UR72',
                        vendorSKU: '06UR72',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 1,
                        line_no: 1,
                        ship_date: 'NA',
                        order_eta: 'NA',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-FJY15-31',
                        is_shipped: true
                    },
                    {
                        line_num: '002',
                        item_num: 'IM7248-2-DAC-LMV-US',
                        item_num_alt: '09AH34',
                        vendorSKU: '09AH34',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 1,
                        line_no: 2,
                        ship_date: 'NA',
                        order_eta: 'NA',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-FJY15-31',
                        is_shipped: true
                    },
                    {
                        line_num: '001',
                        item_num: 'CAB-C13-CBN=',
                        item_num_alt: '06UR79',
                        vendorSKU: '06UR79',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 8,
                        line_no: 1,
                        ship_date: 'NA',
                        order_eta: 'NA',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CN4VL-11',
                        is_shipped: true
                    },
                    {
                        line_num: '002',
                        item_num: 'INTEGRATION MLSVCSV1',
                        item_num_alt: '9CZ851',
                        vendorSKU: '9CZ851',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 2,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '003',
                        item_num: 'N9K-C93108TC-FX',
                        item_num_alt: '06UR68',
                        vendorSKU: '06UR68',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 3,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '004',
                        item_num: 'GLC-TE=',
                        item_num_alt: '06UR73',
                        vendorSKU: '06UR73',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 40,
                        line_no: 4,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '005',
                        item_num: 'SFP-10G-LR=',
                        item_num_alt: '06UR72',
                        vendorSKU: '06UR72',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 1,
                        line_no: 5,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '006',
                        item_num: 'SFP-H10GB-CU1M=',
                        item_num_alt: '06UR71',
                        vendorSKU: '06UR71',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 6,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '007',
                        item_num: 'SFP-H25G-CU1M=',
                        item_num_alt: '06UR70',
                        vendorSKU: '06UR70',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 7,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '008',
                        item_num: 'QSFP-100G-CU1M=',
                        item_num_alt: '06UR69',
                        vendorSKU: '06UR69',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 8,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '009',
                        item_num: 'N9K-C93180YC-FX',
                        item_num_alt: '06UR67',
                        vendorSKU: '06UR67',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 9,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '012',
                        item_num: 'QSFP-100G-CU5M=',
                        item_num_alt: '06UR78',
                        vendorSKU: '06UR78',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 12,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '013',
                        item_num: 'SFP-H10GB-CU3M=',
                        item_num_alt: '06UR77',
                        vendorSKU: '06UR77',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 6,
                        line_no: 13,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '014',
                        item_num: 'SFP-10G-AOC3M=',
                        item_num_alt: '06UR76',
                        vendorSKU: '06UR76',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 14,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '015',
                        item_num: 'SFP-10G-SR=',
                        item_num_alt: '06UR75',
                        vendorSKU: '06UR75',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 12,
                        line_no: 15,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '016',
                        item_num: 'GLC-LH-SMD=',
                        item_num_alt: '06UR74',
                        vendorSKU: '06UR74',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 6,
                        line_no: 16,
                        ship_date: 'NA',
                        order_eta: '2022-12-31',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-CDRFZ-11',
                        is_shipped: true
                    },
                    {
                        line_num: '001',
                        item_num: 'SFP-10G-LR=',
                        item_num_alt: 'U07239',
                        vendorSKU: 'U07239',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 1,
                        line_no: 1,
                        ship_date: 'NA',
                        order_eta: '2022-09-28',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BZ2FR-11',
                        is_shipped: true
                    },
                    {
                        line_num: '022',
                        item_num: 'QSFP-100G-CU1M=',
                        item_num_alt: '4L8441',
                        vendorSKU: '4L8441',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 22,
                        ship_date: 'NA',
                        order_eta: '2022-08-19',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-14',
                        is_shipped: true
                    },
                    {
                        line_num: '031',
                        item_num: 'QSFP-100G-CU5M=',
                        item_num_alt: '4T4075',
                        vendorSKU: '4T4075',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 31,
                        ship_date: 'NA',
                        order_eta: '2022-08-23',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-15',
                        is_shipped: true
                    },
                    {
                        line_num: '001',
                        item_num: 'N9K-C93180YC-FX',
                        item_num_alt: '9Y6790',
                        vendorSKU: '9Y6790',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 1,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '002',
                        item_num: 'CON-SSSNP-N93YCFX',
                        item_num_alt: '5RQ587',
                        vendorSKU: '5RQ587',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 2,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '023',
                        item_num: 'SFP-H25G-CU1M=',
                        item_num_alt: '4T8432',
                        vendorSKU: '4T8432',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 23,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '025',
                        item_num: 'SFP-10G-LR=',
                        item_num_alt: 'U07239',
                        vendorSKU: 'U07239',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 1,
                        line_no: 25,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '026',
                        item_num: 'GLC-TE=',
                        item_num_alt: '2U1906',
                        vendorSKU: '2U1906',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 40,
                        line_no: 26,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '027',
                        item_num: 'GLC-LH-SMD=',
                        item_num_alt: 'LB7752',
                        vendorSKU: 'LB7752',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 6,
                        line_no: 27,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '028',
                        item_num: 'SFP-10G-SR=',
                        item_num_alt: 'Q45408',
                        vendorSKU: 'Q45408',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 12,
                        line_no: 28,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '029',
                        item_num: 'SFP-10G-AOC3M=',
                        item_num_alt: 'TR5003',
                        vendorSKU: 'TR5003',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 29,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '032',
                        item_num: 'CAB-C13-CBN=',
                        item_num_alt: 'Y78770',
                        vendorSKU: 'Y78770',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 8,
                        line_no: 32,
                        ship_date: 'NA',
                        order_eta: '2022-07-29',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-12',
                        is_shipped: true
                    },
                    {
                        line_num: '024',
                        item_num: 'SFP-H10GB-CU1M=',
                        item_num_alt: 'R85936',
                        vendorSKU: 'R85936',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 4,
                        line_no: 24,
                        ship_date: 'NA',
                        order_eta: '2023-01-19',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-11',
                        is_shipped: true
                    },
                    {
                        line_num: '012',
                        item_num: 'N9K-C93108TC-FX',
                        item_num_alt: '2FG749',
                        vendorSKU: '2FG749',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 12,
                        ship_date: 'NA',
                        order_eta: '2022-11-15',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-17',
                        is_shipped: true
                    },
                    {
                        line_num: '013',
                        item_num: 'CON-SNT-N93TCFX',
                        item_num_alt: '2FG766',
                        vendorSKU: '2FG766',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 13,
                        ship_date: 'NA',
                        order_eta: '2022-11-15',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-17',
                        is_shipped: true
                    },
                    {
                        line_num: '010',
                        item_num: 'C1E1TN9300XF-3Y',
                        item_num_alt: '3BG224',
                        vendorSKU: '3BG224',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 2,
                        line_no: 10,
                        ship_date: 'NA',
                        order_eta: '2022-08-19',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-16',
                        is_shipped: true
                    },
                    {
                        line_num: '030',
                        item_num: 'SFP-H10GB-CU3M=',
                        item_num_alt: 'R85483',
                        vendorSKU: 'R85483',
                        line_status: 'Shipped',
                        order_date: 'NA',
                        order_status: 'Shipped',
                        ship_qty: 6,
                        line_no: 30,
                        ship_date: 'NA',
                        order_eta: '2022-09-15',
                        carrier: 'NA',
                        order_eta_ship: 'NA',
                        eta_delivery_date: 'NA',
                        serial_num: 'NA',
                        tracking_num: 'NA',
                        order_num: '60-BMLDK-13',
                        is_shipped: true
                    }
                ]
            };

            util.extend(returnValue, {
                itemArray: outputResp.Lines,
                orderInfo: outputResp.Orders
            });

            return returnValue;
        }
    };
});
/**
 * Line Data:
 
var OrderData = {
    Status: '{ORDER STATUS}',
    OrderNum: '{PO_NUM}',
    VendorOrderNum: '{VENDORs Order ID}',
    OrderDate: parseFormatDate('{ORDER DATE}'),
    Total: 'Total amount',
    InvoiceNo: ''
};

var itemObj = {
    order_num: '',
    order_status: '',
    order_date: '',
    order_eta: '',
    eta_delivery_date: '',
    deliv_date: '', // replacment: eta_delivery_date
    prom_date: '', // ingram

    item_num: '',
    item_num_alt: '',
    vendorSKU: '',
    item_sku: '', // replacementvendorSKU
    item_altnum: '', // replacement for item_num_alt

    item: '',
    line: '',
    quantity: '',
    unitprice: '',

    line_num: '',
    line_status: '',
    line_price: '', // replace unitprice

    ship_qty: '',
    ship_date: '',
    carrier: '',
    tracking_num: '',
    serial_num: '',
    is_shipped: false,

    vendorData: ''
};
*/
