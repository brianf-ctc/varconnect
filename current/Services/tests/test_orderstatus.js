define(function (require) {
    var LogTitle = 'UnitTesting:OrderStatus';

    var lib_ut = require('../lib/ctc_vclib_unittest.js'),
        lib_testdata = require('./testdata.js');

    var vcs_webserviceLib = require('../ctc_svclib_webservice-v1.js');

    var Results = [];

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        // order status PO
        function () {
            var PO_LIST = lib_testdata.PO_LIST;
            PO_LIST.forEach(function (testData) {
                var testName = [LogTitle, 'orderStatus', testData.name].join('|');

                var orderStatus = vcs_webserviceLib.OrderStatusDebug({
                    poNum: testData.poNum,
                    vendorConfigId: testData.vendorConfigId,
                    debugMode: false,
                    showLines: true
                });

                try {
                    [
                        lib_ut.assertTrue(util.isObject(orderStatus), testName + ' is an object'),
                        lib_ut.assertTrue(
                            orderStatus.Orders && orderStatus.Lines,
                            testName + ' is a valid Status'
                        )
                    ].forEach(function (result) {
                        if (result) Results.push(result);
                    });
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
