define(function (require) {
    var LogTitle = 'VCUT:OrderStatus';

    var lib_ut = require('./lib_unittest.js');

    var ns_runtime = require('N/runtime'),
        ns_search = require('N/search'),
        ns_record = require('N/record');

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var vcs_configLib = require('../Services/ctc_svclib_configlib.js'),
        vcs_webserviceLib = require('../Services/ctc_svclib_webservice-v1.js'),
        vcs_recordsLib = require('../Services/ctc_svclib_records.js');

    var Results = [],
        Current = {
            PO_LIST: [
                {
                    // ARROW|CHOICE
                    poNum: 'PO100075',
                    poId: 24148,
                    vendorConfigId: 2513,
                    vendorId: 290
                },
                {
                    // Carahsoft|BlueAlly
                    poNum: '23029094',
                    poId: 19817,
                    vendorConfigId: 1512,
                    vendorId: 173
                },
                {
                    // D&H|ACP
                    poNum: '364832',
                    poId: 17600,
                    vendorConfigId: 1613,
                    vendorId: 175
                },
                {
                    // Ingram|Aqueduct
                    poNum: '126074',
                    poId: 14190,
                    vendorConfigId: 505,
                    vendorId: 147
                },
                {
                    // Jenne|Highpoint
                    poNum: '8930',
                    poId: 5204,
                    vendorConfigId: 2713,
                    vendorId: 152
                },
                {
                    // Scansource|Highpoint
                    poNum: '17103',
                    poId: 5509,
                    vendorConfigId: 706,
                    vendorId: 154
                },
                {
                    // Synnex|AnnexPro
                    poNum: 'POC14824',
                    poId: 7016,
                    vendorConfigId: 906,
                    vendorId: 158
                },

                {
                    // TD Synnex|IntegraOne
                    poNum: '218902',
                    poId: 12074,
                    vendorConfigId: 1310,
                    vendorId: 165
                }

                // {
                //     //! ERROR -  Carahsoft|BlueAlly
                //     poNum: '230290941',
                //     poId: 19999,
                //     vendorConfigId: 11112,
                //     vendorId: 11113
                // }
            ]
        };

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        // function () {
        //     Current.mainConfig = vcs_configLib.mainConfig();

        //     Results.push(
        //         lib_ut.assertTrue(util.isObject(Current.mainConfig), 'MainConfig is an object')
        //     );
        // },

        // // load vendor config
        // function () {
        //     Current.PO_LIST.forEach(function (poTest) {
        //         // load the vendor config via configID

        //         var vendorConfig,
        //             testName = 'vendorConfig|' + poTest.vendorConfigId;

        //         vendorConfig = vcs_configLib.orderVendorConfig({
        //             configId: poTest.vendorConfigId
        //         });

        //         try {
        //             lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object');
        //             lib_ut.assertTrue(
        //                 vendorConfig.name && vendorConfig.id == poTest.vendorConfigId,
        //                 testName + ' is a valid config'
        //             );
        //             lib_ut.assertTrue(
        //                 vendorConfig.endPoint,
        //                 testName + ' contains correct endpoints'
        //             );
        //         } catch (e) {
        //             Results.push(e);
        //         }
        //     });
        // },

        // // load config from PO
        // function () {
        //     Current.PO_LIST.forEach(function (poTest) {
        //         var vendorConfig,
        //             testName = 'vendorConfig by POID|' + poTest.poId;

        //         vendorConfig = vcs_configLib.orderVendorConfig({
        //             poId: poTest.poId
        //         });

        //         try {
        //             lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object');
        //             lib_ut.assertTrue(
        //                 vendorConfig.name && vendorConfig.id == poTest.vendorConfigId,
        //                 testName + ' is a valid config'
        //             );
        //             lib_ut.assertTrue(
        //                 vendorConfig.endPoint,
        //                 testName + ' contains correct endpoints'
        //             );
        //         } catch (e) {
        //             Results.push(e);
        //         }
        //     });
        // },

        // // load config from PO
        // function () {
        //     Current.PO_LIST.forEach(function (poTest) {
        //         var vendorConfig,
        //             testName = 'vendorConfig by PONUM|' + poTest.poNum;

        //         vendorConfig = vcs_configLib.orderVendorConfig({
        //             poNum: poTest.poNum
        //         });

        //         try {
        //             lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object');
        //             lib_ut.assertTrue(
        //                 vendorConfig.name && vendorConfig.id == poTest.vendorConfigId,
        //                 testName + ' is a valid config'
        //             );
        //             lib_ut.assertTrue(
        //                 vendorConfig.endPoint,
        //                 testName + ' contains correct endpoints'
        //             );
        //         } catch (e) {
        //             Results.push(e);
        //         }
        //     });
        // },

        // order status PO
        function () {
            Current.PO_LIST.forEach(function (poTest) {
                var poStatus,
                    testName = 'orderStatus|' + poTest.poNum;

                poStatus = vcs_webserviceLib.OrderStatus({
                    poNum: poTest.poNum
                });

                try {
                    lib_ut.assertTrue(util.isObject(poStatus), testName + ' is an object');
                    lib_ut.assertTrue(
                        poStatus.Orders && poStatus.Lines,
                        testName + ' is a valid Status'
                    );
                } catch (e) {
                    Results.push(e);
                }
            });
        }
    ];

    return {
        run: function (context) {
            var LogTitle = 'VC:UnitTesting';

            // run all the tests
            TESTING.forEach(function (runTest) {
                runTest();
            });

            return Results;
        }
    };
});
