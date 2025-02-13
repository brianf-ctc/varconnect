define(function (require) {
    var LogTitle = 'UnitTesting:ConfigLib';

    var lib_ut = require('../lib/ctc_vclib_unittest.js'),
        lib_testdata = require('./testdata.js');

    var vcs_configLib = require('../ctc_svclib_configlib.js');
    var Results = [];

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        function () {
            var mainConfig = vcs_configLib.mainConfig();
            [
                lib_ut.assertTrue(util.isObject(mainConfig), 'MainConfig is an object', Results)
            ].forEach(function (result) {
                if (result) Results.push(result);
            });
        },

        // load vendor config
        function () {
            var PO_LIST = lib_testdata.PO_LIST;
            PO_LIST.forEach(function (testData) {
                var testTitle = 'VendorConfigLoad';
                // load the vendor config via configID

                var vendorConfig,
                    testName = [LogTitle, testTitle, testData.name].join('|');

                vendorConfig = vcs_configLib.orderVendorConfig({
                    configId: testData.vendorConfigId
                });

                try {
                    [
                        lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object'),
                        lib_ut.assertTrue(
                            vendorConfig.name && vendorConfig.id == testData.vendorConfigId,
                            testName + ' is a valid config'
                        ),
                        lib_ut.assertTrue(
                            vendorConfig.endPoint,
                            testName + ' contains correct endpoints'
                        )
                    ].forEach(function (result) {
                        if (result) Results.push(result);
                    });
                } catch (e) {
                    Results.push(e);
                }
            });
        },

        // load config from PO
        function () {
            var PO_LIST = lib_testdata.PO_LIST;

            PO_LIST.forEach(function (poTest) {
                var testTitle = 'VendorConfigLoadByPOId';

                var vendorConfig,
                    testName = [LogTitle, testTitle, testData.name].join('|');

                var vendorConfig,
                    testName = 'vendorConfig by POID|' + poTest.poId;

                vendorConfig = vcs_configLib.orderVendorConfig({
                    poId: poTest.poId
                });

                try {
                    [
                        lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object'),
                        lib_ut.assertTrue(
                            vendorConfig.name && vendorConfig.id == poTest.vendorConfigId,
                            testName + ' is a valid config'
                        ),
                        lib_ut.assertTrue(
                            vendorConfig.endPoint,
                            testName + ' contains correct endpoints'
                        )
                    ].forEach(function (result) {
                        if (result) Results.push(result);
                    });
                } catch (e) {
                    Results.push(e);
                }
            });
        },

        // load config from PO
        function () {
            var PO_LIST = lib_testdata.PO_LIST;

            PO_LIST.forEach(function (poTest) {
                var testTitle = 'VendorConfigLoadByPONUM';

                var vendorConfig,
                    testName = [LogTitle, testTitle, testData.name].join('|');

                vendorConfig = vcs_configLib.orderVendorConfig({
                    poNum: poTest.poNum
                });

                try {
                    lib_ut.assertTrue(util.isObject(vendorConfig), testName + ' is an object');
                    lib_ut.assertTrue(
                        vendorConfig.name && vendorConfig.id == poTest.vendorConfigId,
                        testName + ' is a valid config'
                    );
                    lib_ut.assertTrue(
                        vendorConfig.endPoint,
                        testName + ' contains correct endpoints'
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
