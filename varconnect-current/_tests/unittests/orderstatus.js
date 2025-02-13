define(function (require) {
    var LogTitle = 'VCUT:OrderStatus';

    var lib_unittest = require('../lib_unittest.js');

    var ns_runtime = require('N/runtime'),
        ns_search = require('N/search'),
        ns_record = require('N/record');

    var vc2_util = require('../../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../../CTC_VC2_Constants.js');

    var vcs_configLib = require('../../Services/ctc_svclib_configlib.js'),
        vcs_webserviceLib = require('../../Services/ctc_svclib_webservice-v1.js'),
        vcs_recordsLib = require('../../Services/ctc_svclib_records.js');

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
                }
            ]
        };

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        function () {
            Current.mainConfig = vcs_configLib.mainConfig();
            return lib_unittest.assertTrue(
                typeof Current.mainConfig == 'object',
                'mainConfig is an object'
            );
        },

        // load vendor config
        function () {
            Current.PO_LIST.forEach(function (poTest) {
                // load the vendor config via configID
                var vendorConfig = vcs_configLib.orderVendorConfig({
                    configId: poTest.vendorConfigId
                });

                return lib_unittest.assertFalse(
                    typeof vendorConfig == 'object',
                    'vendorConfig is an object'
                );
            });
        }
    ];

    return {
        run: function (context) {
            var LogTitle = 'VC:UnitTesting';

            // run all the tests
            TESTING.forEach(function (test) {
                var result;
                try {
                    result = test();
                } catch (e) {
                    result = e;
                }

                Results.push(result);
            });
            return Results;
        }
    };
});
