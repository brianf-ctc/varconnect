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
            ]
            // ORDERSTATUS_LIST: [
            //     // ARROW|ITI
            //     {
            //         name: 'ARROW|ITI',
            //         poNum: 'PO028962OL',
            //         vendorConfig: {
            //             xmlVendor: vc2_constant.LIST.XML_VENDOR.ARROW,
            //             endPoint:
            //                 'https://ecsapi.arrow.com/external/ArrowLink/ArrowECS/SalesOrder_RS/Status',
            //             accessEndPoint:
            //                 'https://login.microsoftonline.com/0beb0c35-9cbb-4feb-99e5-589e415c7944/oauth2/v2.0/token',
            //             apiKey: '52b08ae8-123a-4216-94b2-cc71ab1a7f5f',
            //             apiSecret: 'NYi8Q~bbJqWXo6CT5No4AuCfZe~YRjKw9vQTbc7X',
            //             customerNo: '1001863',
            //             oauthScope: 'c0362abb892149e397091da4d8afb2a1',
            //             subsidiary: '01'
            //         }
            //     },
            //     // CARAHSOFT|BlueAlly
            //     {
            //         name: 'Carahsoft|BlueAlly',
            //         poNum: 'PO4687',
            //         vendorConfig: {
            //             xmlVendor: vc2_constant.LIST.XML_VENDOR.CARAHSOFT,
            //             endPoint: 'https://api.carahsoft.com/odata/v1/Order/',
            //             accessEndPoint:
            //                 'https://login.carahsoft.com/auth/realms/carahsoft/protocol/openid-connect/token',
            //             apiKey: '7eb8d22e-2766-b2e8-8431-b82d2bb4ebee',
            //             apiSecret: 'RjXEcCQydVOARqQzIFj3jpt2Z1xl8jT2',
            //             customerNo: '58939881-cd64-466d-9824-1005229b9176',
            //             oauthScope: 'https://api.carahsoft.com',
            //             subsidiary: '01'
            //         }
            //     },
            //     // D&H|ITI
            //     {
            //         name: 'D&H|ITI',
            //         poNum: 'PO028956JR',
            //         vendorConfig: {
            //             xmlVendor: vc2_constant.LIST.XML_VENDOR.DandH,
            //             endPoint: 'https://www.dandh.ca/dhXML/xmlDispatch',
            //             user: '802608XML2',
            //             password: 'Xml*CwS2023!',
            //             subsidiary: '01'
            //         }
            //     },
            //     // DELL|ITI
            //     {
            //         name: 'DELL|ITI',
            //         poNum: 'PO028677MR',
            //         vendorConfig: {
            //             xmlVendor: vc2_constant.LIST.XML_VENDOR.DELL,
            //             endPoint: 'https://apigtwb2c.us.dell.com/PROD/order-status/api/search',
            //             accessEndPoint: 'https://apigtwb2c.us.dell.com/auth/oauth/v2/token',
            //             apiKey: 'l7fd8b126f16dc4ca28ab4e989bc87fc32',
            //             apiSecret: '46496f8e78f54029a4b736618d088a67',
            //             customerNo: 'ITI_API',
            //             subsidiary: '01'
            //         }
            //     },
            //     // INGRAM 6
            //     {},
            //     // INGRAM 6.1
            //     {},
            //     // JENNE
            //     {},
            //     // SCANSOURCE
            //     {},
            //     // SYNNEX
            //     {},
            //     // TECHDATA
            //     {},
            //     // WEFI
            //     {}
            // ]
        };

    // RUN ORDER STATUS FOR ALL VENDOR
    var TESTING = [
        // order status PO
        function () {
            Current.ORDERSTATUS_LIST.forEach(function (orderStatusTest) {
                var testName = 'orderStatus - ' + orderStatusTest.name;

                var orderStatus = vcs_webserviceLib.OrderStatusDebug({
                    poNum: orderStatusTest.poNum,
                    vendorConfig: orderStatusTest.vendorConfig,
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
