/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(function (require) {
    var LogTitle = 'UnitTesting: OrderStatus';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var vcs_configLib = require('../Services/ctc_svclib_configlib.js'),
        vcs_webserviceLib = require('../Services/ctc_svclib_webservice-v1.js'),
        vcs_recordsLib = require('../Services/ctc_svclib_records.js');

    var SVC_Queries = {
        mainConfig: {
            moduleName: 'configLib',
            action: 'mainConfig'
        },
        vendorConfig: {
            moduleName: 'configLib',
            action: 'orderVendorConfig',
            parameters: { poNum: '124640' }
        },
        billConfig: {
            moduleName: 'configLib',
            action: 'billVendorConfig',
            parameters: { poNum: '124641' }
        },
        orderStatus: {
            moduleName: 'webserviceLibV1',
            action: 'OrderStatus',
            parameters: { poNum: '124640', showLines: true }
        },
        matchOrderLines: {
            moduleName: 'recordsLib',
            action: 'matchOrderLines',
            parameters: {
                poNum: '218502',
                poId: '12179',
                vendorLines: [],
                mainConfig: {},
                vendorConfig: {}
            }
        }
    };

    var Tests = [
        // // MAIN CONFIG //
        // function () {
        //     // get the main config
        //     return vcs_configLib.mainConfig();
        // },
        // // VENDOR CONFIG //
        // function () {
        //     // get the vendor config
        //     return vcs_configLib.orderVendorConfig({ poNum: '124640' });
        // },
        // // BILL CONFIG //
        // function () {
        //     // get the bill config
        //     return vcs_configLib.billVendorConfig({ poNum: '124641' });
        // },
        // // ORDER STATUS //
        // function () {
        //     // get the order status
        //     return vcs_webserviceLib.OrderStatus({ poNum: 'PO100075', showLines: true });
        // },

        // FULL MATCH ITEM
        // function () {
        //     // get the MainConfig and OrderConfig
        //     var poNum = 'PO100075',
        //         poId = '24148';

        //     var mainConfig = vcs_configLib.mainConfig(),
        //         vendorConfig = vcs_configLib.orderVendorConfig({ poNum: poNum });

        //     var vendorLines = [
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             order_date: '07/18/2024',
        //             order_eta: '08/04/2024',
        //             deliv_date: 'NA',
        //             prom_date: 'NA',
        //             item_num: 'MSN2010-CB2FC',
        //             item_sku: 'MSN2010-CB2FC',
        //             vendorSKU: 'MSN2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '1',
        //             line_status: 'SHIPPED',
        //             line_price: '5378.64',
        //             ship_qty: 2,
        //             ship_date: '08/01/2024',
        //             carrier: 'FedEx',
        //             tracking_num: '735440187919,735440187920',
        //             serial_num: 'MT2253J09771',
        //             is_shipped: true
        //         },
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             order_date: '07/18/2024',
        //             order_eta: '08/04/2024',
        //             deliv_date: 'NA',
        //             prom_date: 'NA',
        //             item_num: 'MSN:2010-CB2FC',
        //             item_sku: 'MSN:2010-CB2FC',
        //             vendorSKU: 'MSN:2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '1',
        //             line_status: 'SHIPPED',
        //             line_price: '5378.64',
        //             ship_qty: 2,
        //             ship_date: '08/01/2024',
        //             carrier: 'FedEx',
        //             tracking_num: '735440187919,735440187920',
        //             serial_num: 'MT2253J09771',
        //             is_shipped: true
        //         },
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             order_date: '07/18/2024',
        //             order_eta: '08/06/2024',
        //             deliv_date: 'NA',
        //             prom_date: 'NA',
        //             item_num: '781-S2 1N0Z#P2CMI36',
        //             item_sku: '781-S2 1N0Z#P2CMI36',
        //             vendorSKU: '781-S2 1N0Z#P2CMI36',
        //             item_altnum: 'NA',
        //             line_num: '3',
        //             line_status: 'SHIPPED',
        //             line_price: '760.54',
        //             ship_qty: 2,
        //             ship_date: '12/20/2024',
        //             carrier: '000001_FedEx_R_94',
        //             tracking_num: 'NA',
        //             serial_num: 'NA',
        //             is_shipped: true,
        //             ITEMNAME: '781-S2 1N0Z#P2CMI36',
        //             ITEMALT: '781-S2 1N0Z#P2CMI36'
        //         }
        //     ];

        //     // normalize the vendor lines
        //     vendorLines.forEach(function (line) {
        //         line.ITEMNAME = line.item_num;
        //         line.ITEMALT = line.item_sku || line.vendorSKU;
        //         line.QUANTITY = line.ship_qty;
        //         line.APPLIEDRATE = line.line_price;
        //     });

        //     var matchedLines = vcs_recordsLib.matchOrderLines({
        //         poNum: poNum,
        //         poId: poId,
        //         mainConfig: mainConfig,
        //         vendorConfig: vendorConfig,
        //         vendorLines: vendorLines
        //     });

        //     return true;
        // },

        // function () {
        //     // get the MainConfig and OrderConfig
        //     var poNum = 'PO100075',
        //         poId = '24148';

        //     var mainConfig = vcs_configLib.mainConfig(),
        //         vendorConfig = vcs_configLib.orderVendorConfig({ poNum: poNum });

        //     var vendorLines = [
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             item_num: 'MSN2010-CB2FC',
        //             item_sku: 'MSN2010-CB2FC',
        //             vendorSKU: 'MSN2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '1',
        //             line_status: 'SHIPPED',
        //             line_price: '5378.64',
        //             ship_qty: 5,
        //             is_shipped: true
        //         },
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             item_num: 'MSN2010-CB2FC',
        //             item_sku: 'MSN2010-CB2FC',
        //             vendorSKU: 'MSN2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '2',
        //             line_status: 'SHIPPED',
        //             line_price: '5100.00',
        //             ship_qty: 5,
        //             is_shipped: true
        //         },
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             item_num: 'MSN2010-CB2FC',
        //             item_sku: 'MSN2010-CB2FC',
        //             vendorSKU: 'MSN2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '3',
        //             line_status: 'SHIPPED',
        //             line_price: '5378.64',
        //             ship_qty: 3,
        //             is_shipped: true
        //         },
        //         {
        //             order_num: '5045071',
        //             order_status: 'CLOSED',
        //             item_num: 'MSN2010-CB2FC',
        //             item_sku: 'MSN2010-CB2FC',
        //             vendorSKU: 'MSN2010-CB2FC',
        //             item_altnum: 'NA',
        //             line_num: '4',
        //             line_status: 'SHIPPED',
        //             line_price: '5378.64',
        //             ship_qty: 3,
        //             is_shipped: true
        //         }
        //     ];

        //     // normalize the vendor lines
        //     vendorLines.forEach(function (line) {
        //         line.ITEMNAME = line.item_num;
        //         line.ITEMALT = line.item_sku || line.vendorSKU;
        //         line.QUANTITY = line.ship_qty;
        //         line.APPLIEDRATE = line.line_price;
        //     });

        //     var matchedLines = vcs_recordsLib.matchOrderLines({
        //         poNum: poNum,
        //         poId: poId,
        //         mainConfig: mainConfig,
        //         vendorConfig: vendorConfig,
        //         vendorLines: vendorLines
        //     });

        //     return true;
        // },
        function () {
            // get the MainConfig and OrderConfig
            var poNum = '46321610',
                poId = '12987';

            var mainConfig = vcs_configLib.mainConfig(),
                vendorConfig = vcs_configLib.orderVendorConfig({ poNum: poNum });

            var vendorLines = [
                {
                    order_num: '146573225',
                    order_status: 'invoiced',
                    order_delivery_eta: 'NA',
                    item_num: 'C9300-48UN-EDU',
                    vendorSKU: '5533104',
                    item_sku: '5533104',
                    item_altnum: 'NA',
                    line_num: '47',
                    line_status: 'invoiced',
                    unitprice: 5766.56,
                    line_price: 5766.56,
                    ship_qty: '5',
                    ship_date: '12/14/2023',
                    carrier: 'Expeditors LTL Ground',
                    tracking_num: '116520673/1',
                    // serial_num:
                    //     'FJC27431QDS,FJC27431QLW,FJC27431QX8,FJC27431SQN,FJC27431SRW,FJC27431T3G,FJC27431T6F,FJC27431T6Z,FJC27431TER,FJC27431TFG',
                    is_shipped: true,
                    SHIPPED: 'has_shippeddate|has_shippedqty|has_unitprice|shippeddate_past'
                },
                {
                    order_num: '146573225',
                    order_status: 'invoiced',
                    order_delivery_eta: 'NA',
                    item_num: 'C9300-48UN-EDU',
                    vendorSKU: '5533104',
                    item_sku: '5533104',
                    item_altnum: 'NA',
                    line_num: '48',
                    line_status: 'invoiced',
                    unitprice: 5766.56,
                    line_price: 5766.56,
                    ship_qty: '35',
                    ship_date: '12/14/2023',
                    carrier: 'Expeditors LTL Ground',
                    tracking_num: '116520673/1',
                    // serial_num:
                    //     'FJC27431QDS,FJC27431QLW,FJC27431QX8,FJC27431SQN,FJC27431SRW,FJC27431T3G,FJC27431T6F,FJC27431T6Z,FJC27431TER,FJC27431TFG',
                    is_shipped: true,
                    SHIPPED: 'has_shippeddate|has_shippedqty|has_unitprice|shippeddate_past'
                }
            ];

            // normalize the vendor lines
            vendorLines.forEach(function (line) {
                line.ITEMNAME = line.item_num;
                line.ITEMALT = line.item_sku || line.vendorSKU;
                line.QUANTITY = line.ship_qty;
                line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
                line.APPLIEDRATE = line.line_price;
            });

            var matchedLines = vcs_recordsLib.matchOrderLines({
                poNum: poNum,
                poId: poId,
                mainConfig: mainConfig,
                vendorConfig: vendorConfig,
                vendorLines: vendorLines
            });

            return true;
        }
    ];

    function execute(context) {
        var logTitle = LogTitle + '::execute',
            returnValue;
        try {
            vc2_util.log(logTitle, 'Start');

            // run thru the tests
            for (var i = 0; i < Tests.length; i++) {
                vc2_util.log(logTitle, 'Test ' + (i + 1));
                returnValue = Tests[i]();
                vc2_util.log(logTitle, 'Result: ' + returnValue);
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);
        }
        return returnValue;
    }

    return {
        execute: execute
    };
});
