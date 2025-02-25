define(function (require) {
    var LogTitle = 'UnitTesting:ItemMatch';

    var ns_record = require('N/record');

    var vc2_util = require('../../CTC_VC2_Lib_Utils.js'),
        vc2_recordLib = require('../../CTC_VC2_Lib_Record.js');

    var lib_ut = require('../ctc_vclib_unittest.js'),
        lib_testdata = require('./testdata.js');

    var vcs_webserviceLib = require('../../Services/ctc_svclib_webservice-v1.js'),
        vcs_configLib = require('../../Services/ctc_svclib_configlib.js'),
        vcs_recordLib = require('../../Services/ctc_svclib_records.js'),
        vcs_itemmatch = require('../../Services/ctc_svclib_itemmatch.js');

    var Results = [];

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        // order status PO
        // function () {
        //     var testData = lib_testdata.VENDOR_LINES.ITEM_MATCH;

        //     var mainConfig = vcs_configLib.mainConfig(),
        //         vendorConfig = vcs_configLib.orderVendorConfig({ poNum: testData.PONUM });

        //     ['ITEM', 'ALTITEM_COL', 'ALTITEM_REC', 'MAPPING'].forEach(function (testType) {
        //         var testName = [LogTitle, testType].join('|'),
        //             vendorLines = testData[testType];

        //         vendorLines.forEach(function (line) {
        //             line.ITEMNAME = line.item_num;
        //             line.ITEMALT = line.item_sku || line.vendorSKU || line.ITEMNAME;
        //             line.QUANTITY = line.ship_qty;
        //             line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
        //             line.APPLIEDRATE = line.line_price;
        //         });

        //         var matchedLines = vcs_itemmatch.matchOrderLines({
        //             orderId: testData.POID,
        //             // poNum: testData.PONUM,
        //             vendorConfig: vendorConfig,
        //             mainConfig: mainConfig,
        //             vendorLines: vendorLines
        //         });

        //         try {
        //             [
        //                 lib_ut.assertTrue(util.isArray(matchedLines), testName + ' is an array'),
        //                 lib_ut.assertTrue(
        //                     (function () {
        //                         var hasNonMatched = false;
        //                         matchedLines.forEach(function (line) {
        //                             if (vc2_util.isEmpty(line.MATCHING)) hasNonMatched = true;
        //                         });
        //                         return !hasNonMatched;
        //                     })(),
        //                     testName + ' matched all lines'
        //                 ),
        //                 lib_ut.assertTrue(
        //                     (function () {
        //                         var hasNonMatched = false;
        //                         matchedLines.forEach(function (line) {
        //                             if (line.MATCHED_BY != testType) hasNonMatched = true;
        //                         });
        //                         return !hasNonMatched;
        //                     })(),
        //                     testName + ' matched all lines by type'
        //                 )
        //             ].forEach(function (result) {
        //                 if (result) Results.push(result);
        //             });
        //         } catch (error) {
        //             Results.push(error);
        //         }
        //     });

        //     ['NO_MATCH'].forEach(function (testType) {
        //         var testName = [LogTitle, testType].join('|'),
        //             vendorLines = lib_testdata.VENDOR_LINES.ITEM_MATCH[testType];

        //         vendorLines.forEach(function (line) {
        //             line.ITEMNAME = line.item_num;
        //             line.ITEMALT = line.item_sku || line.vendorSKU || line.ITEMNAME;
        //             line.QUANTITY = line.ship_qty;
        //             line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
        //             line.APPLIEDRATE = line.line_price;
        //         });

        //         var matchedLines = vcs_itemmatch.matchOrderLines({
        //             poId: testData.POID,
        //             poNum: testData.PONUM,
        //             vendorConfig: vendorConfig,
        //             mainConfig: mainConfig,
        //             vendorLines: vendorLines
        //         });

        //         try {
        //             [
        //                 lib_ut.assertTrue(util.isArray(matchedLines), testName + ' is an array'),
        //                 lib_ut.assertFalse(
        //                     (function () {
        //                         var hasNonMatched = false;
        //                         matchedLines.forEach(function (line) {
        //                             if (vc2_util.isEmpty(line.MATCHING)) hasNonMatched = true;
        //                         });
        //                         return !hasNonMatched;
        //                     })(),
        //                     testName + ' matched no lines'
        //                 )
        //             ].forEach(function (result) {
        //                 if (result) Results.push(result);
        //             });
        //         } catch (error) {
        //             Results.push(error);
        //         }
        //     });
        // },
        // function () {
        //     var testData = lib_testdata.VENDOR_LINES.ITEM_MATCH;

        //     var mainConfig = vcs_configLib.mainConfig(),
        //         vendorConfig = vcs_configLib.orderVendorConfig({ poNum: testData.PONUM });

        //     ['ITEM', 'ALTITEM_COL', 'ALTITEM_REC', 'MAPPING'].forEach(function (testType) {
        //         var testName = [LogTitle, testType, 'LOAD PO'].join('|'),
        //             vendorLines = testData[testType];

        //         vendorLines.forEach(function (line) {
        //             line.ITEMNAME = line.item_num;
        //             line.ITEMALT = line.item_sku || line.vendorSKU || line.ITEMNAME;
        //             line.QUANTITY = line.ship_qty;
        //             line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
        //             line.APPLIEDRATE = line.line_price;
        //         });

        //         var poRec = vc2_recordLib.load({
        //                 type: 'purchaseorder',
        //                 id: testData.POID
        //             }),
        //             poLines = vc2_recordLib.extractLineValues({
        //                 record: poRec,
        //                 fields: ['item', 'quantity', 'rate', 'custcol_item_sku', 'lineuniquekey']
        //             });

        //         var matchedLines = vcs_itemmatch.matchOrderLines({
        //             orderRec: poRec,
        //             poLines: poLines,
        //             vendorConfig: vendorConfig,
        //             mainConfig: mainConfig,
        //             vendorLines: vendorLines
        //         });

        //         try {
        //             [
        //                 lib_ut.assertTrue(util.isArray(matchedLines), testName + ' is an array'),
        //                 lib_ut.assertTrue(
        //                     (function () {
        //                         var hasNonMatched = false;
        //                         matchedLines.forEach(function (line) {
        //                             if (vc2_util.isEmpty(line.MATCHING)) hasNonMatched = true;
        //                         });
        //                         return !hasNonMatched;
        //                     })(),
        //                     testName + ' matched all lines'
        //                 ),
        //                 lib_ut.assertTrue(
        //                     (function () {
        //                         var hasNonMatched = false;
        //                         matchedLines.forEach(function (line) {
        //                             if (line.MATCHED_BY != testType) hasNonMatched = true;
        //                         });
        //                         return !hasNonMatched;
        //                     })(),
        //                     testName + ' matched all lines by type'
        //                 )
        //             ].forEach(function (result) {
        //                 if (result) Results.push(result);
        //             });
        //         } catch (error) {
        //             Results.push(error);
        //         }
        //     });
        // },
        function () {
            var testData = lib_testdata.VENDOR_LINES.ITEM_MATCH;

            var mainConfig = vcs_configLib.mainConfig(),
                vendorConfig = vcs_configLib.orderVendorConfig({ poNum: testData.PONUM });

            ['ITEM', 'ALTITEM_COL', 'ALTITEM_REC', 'MAPPING'].forEach(function (testType) {
                var testName = [LogTitle, testType, 'MATCH SO'].join('|'),
                    vendorLines = testData[testType];

                vendorLines.forEach(function (line) {
                    line.ITEMNAME = line.item_num;
                    line.ITEMALT = line.item_sku || line.vendorSKU || line.ITEMNAME;
                    line.QUANTITY = line.ship_qty;
                    line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
                    line.APPLIEDRATE = line.line_price;
                });

                var poData = vc2_util.flatLookup({
                    type: 'purchaseorder',
                    id: testData.POID,
                    columns: ['createdfrom']
                });

                var matchedLines = vcs_itemmatch.matchOrderLines({
                    orderId: poData.createdfrom
                        ? poData.createdfrom.value || poData.createdfrom
                        : null,
                    orderType: ns_record.Type.SALES_ORDER,
                    vendorConfig: vendorConfig,
                    mainConfig: mainConfig,
                    vendorLines: vendorLines
                });

                try {
                    [
                        lib_ut.assertTrue(util.isArray(matchedLines), testName + ' is an array'),
                        lib_ut.assertTrue(
                            (function () {
                                var hasNonMatched = false;
                                matchedLines.forEach(function (line) {
                                    if (vc2_util.isEmpty(line.MATCHING)) hasNonMatched = true;
                                });
                                return !hasNonMatched;
                            })(),
                            testName + ' matched all lines'
                        ),
                        lib_ut.assertTrue(
                            (function () {
                                var hasNonMatched = false;
                                matchedLines.forEach(function (line) {
                                    if (line.MATCHED_BY != testType) hasNonMatched = true;
                                });
                                return !hasNonMatched;
                            })(),
                            testName + ' matched all lines by type'
                        )
                    ].forEach(function (result) {
                        if (result) Results.push(result);
                    });
                } catch (error) {
                    Results.push(error);
                }
            });
        },

        function () {
            var testData = lib_testdata.VENDOR_LINES.FILL_LINES;

            var mainConfig = vcs_configLib.mainConfig(),
                vendorConfig = vcs_configLib.orderVendorConfig({ poNum: testData.PONUM });

            ['FULL_QTY', 'PARTIAL_QTY', 'FULLY_SPLIT', 'EXCEED_QTY', 'EXCEED_QTY_SPLIT'].forEach(
                function (testType) {
                    var testName = [LogTitle, testType].join('|'),
                        vendorLines = testData[testType];

                    vendorLines.forEach(function (line) {
                        line.ITEMNAME = line.item_num;
                        line.ITEMALT = line.item_sku || line.vendorSKU || line.ITEMNAME;
                        line.QUANTITY = line.ship_qty;
                        line.SERIALS = line.serial_num ? line.serial_num.split(',') : [];
                        line.APPLIEDRATE = line.line_price;
                    });

                    var matchedLines = vcs_itemmatch.matchOrderLines({
                        poId: testData.POID,
                        poNum: testData.PONUM,
                        vendorConfig: vendorConfig,
                        mainConfig: mainConfig,
                        vendorLines: vendorLines
                    });

                    try {
                        [
                            lib_ut.assertTrue(
                                util.isArray(matchedLines),
                                testName + ' is an array'
                            ),
                            lib_ut.assertTrue(
                                (function () {
                                    var hasNonMatched = false;
                                    matchedLines.forEach(function (line) {
                                        if (vc2_util.isEmpty(line.MATCHING)) hasNonMatched = true;
                                    });
                                    return !hasNonMatched;
                                })(),
                                testName + ' matched all lines'
                            ),

                            vc2_util.inArray(testType, ['FULL_QTY', 'PARTIAL_QTY', 'FULLY_SPLIT'])
                                ? lib_ut.assertTrue(
                                      (function () {
                                          var isFullyMatched = true;
                                          matchedLines.forEach(function (line) {
                                              if (
                                                  line.AVAILQTY > 0 ||
                                                  line.APPLIEDQTY != line.QUANTITY
                                              )
                                                  isFullyMatched = false;
                                          });
                                          return isFullyMatched;
                                      })(),
                                      testName + ' fully matched all lines'
                                  )
                                : testType == 'EXCEED_QTY'
                                ? lib_ut.assertTrue(
                                      (function () {
                                          var isPartiallyMatched = false;
                                          matchedLines.forEach(function (line) {
                                              if (
                                                  line.AVAILQTY > 0 ||
                                                  line.APPLIEDQTY == line.QUANTITY
                                              )
                                                  isPartiallyMatched = true;
                                          });
                                          return isPartiallyMatched;
                                      })(),
                                      testName + ' partially matched all lines'
                                  )
                                : false
                        ].forEach(function (result) {
                            if (result) Results.push(result);
                        });
                    } catch (error) {
                        Results.push(error);
                    }
                }
            );
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
