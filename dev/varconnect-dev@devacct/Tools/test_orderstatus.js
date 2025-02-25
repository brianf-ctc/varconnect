define(function (require) {
    var LogTitle = 'VCUT:OrderStatus';

    var lib_ut = require('./ctc_vclib_unittest.js');

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
                    // ARROW|ITI
                    name: 'ARROW|ITI',
                    poNum: 'PO100075',
                    poId: 24148,
                    vendorConfigId: 2513,
                    vendorId: 290
                },
                {
                    // Carahsoft|BlueAlly
                    name: 'Carahsoft|BlueAlly',
                    poNum: 'PO2872',
                    poId: 27152,
                    vendorConfigId: 1512,
                    vendorId: 173
                },
                {
                    // D&H|ACP
                    name: 'D&H|ACP',
                    poNum: '364832',
                    poId: 17600,
                    vendorConfigId: 1613,
                    vendorId: 175
                },
                {
                    // Ingram|Aqueduct
                    name: 'Ingram|Aqueduct',
                    poNum: '126074',
                    poId: 14190,
                    vendorConfigId: 505,
                    vendorId: 147
                },
                {
                    // Jenne|Highpoint
                    name: 'Jenne|Highpoint',
                    poNum: '8930',
                    poId: 5204,
                    vendorConfigId: 2713,
                    vendorId: 152
                },
                {
                    // Scansource|Highpoint
                    name: 'Scansource|Highpoint',
                    poNum: '17103',
                    poId: 5509,
                    vendorConfigId: 706,
                    vendorId: 154
                },
                {
                    // Synnex|AnnexPro
                    name: 'Synnex|AnnexPro',
                    poNum: 'POC14824',
                    poId: 7016,
                    vendorConfigId: 906,
                    vendorId: 158
                },

                {
                    // TD Synnex|AnnexPro
                    name: 'Synnex|AnnexPro',
                    poNum: 'POC15487',
                    poId: 7022,
                    vendorConfigId: 906,
                    vendorId: 158
                }
            ]
        };

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        // order status PO
        function () {
            Current.PO_LIST.forEach(function (testData) {
                var testName = [LogTitle, 'orderStatus', testData.name].join(':');

                var orderStatus = vcs_webserviceLib.OrderStatusDebug({
                    poNum: testData.poNum,
                    vendorConfigId: testData.vendorConfigId,
                    debugMode: false,
                    showLines: true
                });

                try {
                    lib_ut.assertTrue(util.isObject(orderStatus), testName + ' is an object');
                    lib_ut.assertTrue(
                        orderStatus.Orders && orderStatus.Lines,
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
