define(function (require) {
    var LogTitle = 'UT:TxnLib';

    var lib_ut = require('./../lib/ctc_vclib_unittest.js'),
        lib_testdata = require('./testdata.js');

    var ns_record = require('N/record'),
        ns_runtime = require('N/runtime'),
        ns_format = require('N/format');

    var moment = require('./../lib/moment.js');

    var vcs_configLib = require('./../ctc_svclib_configlib.js'),
        vcs_recordLib = require('./../ctc_svclib_records.js'),
        vcs_billCreateLib = require('./../ctc_svclib_billcreate.js'),
        vcs_processLib = require('./../ctc_svclib_process-v1.js'),
        vcs_txnLib = require('./../ctc_svclib_transaction.js');

    var vc2_util = require('./../../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../../CTC_VC2_Constants.js'),
        vclib_error = require('./../lib/ctc_lib_errors.js');

    var Results = [];

    var TESTING = [
        function () {
            vc2_util.log(LogTitle, '*** START Unit Testing: [' + ns_runtime.accountId + ']');

            var arrTestData = lib_testdata[ns_runtime.accountId];

            // get the data from the testdata.js
            arrTestData.BILLFILES.forEach(function (billFile) {
                try {
                    var testName = [LogTitle, 'createFulfillment:' + billFile.billFileId].join('|');

                    var billFileRec = vcs_billCreateLib.loadBillFile({
                        billFileId: billFile.billFileId
                    });
                    var poId = billFile.poId || billFileRec.PO_LINK;

                    var poRec = vcs_recordLib.load({
                            type: 'purchaseorder',
                            id: poId,
                            isDynamic: true
                        }),
                        poData = vcs_recordLib.extractValues({
                            record: poRec,
                            columns: [
                                'tranid',
                                'entity',
                                'dropshipso',
                                'status',
                                'statusRef',
                                'createdfrom',
                                'subsidiary',
                                'custbody_ctc_po_link_type',
                                'custbody_isdropshippo'
                            ]
                        });

                    var isDropPO =
                        poData.dropshipso ||
                        poData.custbody_ctc_po_link_type == 'Dropship' ||
                        poData.custbody_isdropshippo;

                    vc2_util.log(LogTitle, 'PO Data', [isDropPO, poData]);

                    var MainCFG = vcs_configLib.mainConfig(),
                        BillCFG = vcs_configLib.billVendorConfig({ poId: poId }),
                        OrderCFG = vcs_configLib.orderVendorConfig({ poId: poId });

                    // search for the bill file
                    var searchResults = vcs_recordLib.searchTransactions({
                        filters: [
                            ['externalid', 'is', 'ifir_' + billFileRec.BILL_NUM],
                            'AND',
                            ['type', 'anyof', 'ItemShip', 'ItemRcpt']
                        ]
                    });

                    if (searchResults.length > 0) throw 'Fulfillment already exists';

                    /// FULFILLMENT CREATION /////////////////////////
                    var itemffData = vcs_txnLib.createFulfillment({
                        poRec: poRec,
                        poId: poId,
                        mainConfig: MainCFG,
                        vendorConfig: OrderCFG,
                        billConfig: BillCFG,
                        headerValues: {
                            externalid: 'ifir_' + billFileRec.BILL_NUM,
                            tranid: billFileRec.BILL_NUM,
                            // shipstatus: 'C', // 'Shipped'
                            trandate: (function () {
                                var shipDate =
                                    billFileRec.JSON.shipDate && billFileRec.JSON.shipDate != 'NA'
                                        ? billFileRec.JSON.shipDate
                                        : billFileRec.JSON.date;

                                return ns_format.parse({
                                    value: moment(shipDate).toDate(),
                                    type: ns_format.Type.DATE
                                });
                            })(),
                            custbody_ctc_vc_createdby_vc: true
                        },
                        vendorLines: (function () {
                            /// prepare the lines for fulfillment
                            billFileRec.LINES.forEach(function (payloadLine) {
                                util.extend(payloadLine, {
                                    ORDER_NUM: '',
                                    ORDER_STATUS: '',
                                    ORDER_DATE: '',
                                    ORDER_ETA: '',
                                    ORDER_DELIV: '',
                                    SHIP_METHOD: billFileRec.JSON.carrier,
                                    SHIP_DATE: billFileRec.JSON.shipDate,
                                    CARRIER: billFileRec.JSON.carrier,
                                    TRACKING_NUMS: payloadLine.TRACKING,
                                    SERIAL_NUMS: payloadLine.SERIAL,
                                    ITEM_TEXT: payloadLine.ITEMNO,
                                    APPLIEDRATE: payloadLine.BILLRATE || payloadLine.PRICE
                                });

                                return true;
                            });

                            return billFileRec.LINES;
                        })()
                    });
                    //////////////////////////////////////////////////

                    if (!vc2_util.isEmpty(itemffData.Serials)) {
                        itemffData.Serials.forEach(function (serialData) {
                            vcs_processLib.processSerials(serialData);
                        });
                    }

                    try {
                        var fulfillmentRec, fulfillmentLines;
                        [
                            lib_ut.assertTrue(
                                vc2_util.isEmpty(itemffData) === false,
                                testName + ' is not empty'
                            ),

                            lib_ut.assertTrue(
                                (function () {
                                    fulfillmentRec = vcs_recordLib.load({
                                        type: 'itemfulfillment',
                                        id: itemffData.id,
                                        isDynamic: true
                                    });

                                    return vc2_util.isEmpty(fulfillmentRec) === false;
                                })(),
                                testName + ' is a valid fulfillment'
                            ),

                            lib_ut.assertTrue(
                                fulfillmentRec.getValue('externalid') ===
                                    'ifir_' + billFileRec.BILL_NUM,
                                testName + ' is a valid externalid'
                            ),

                            lib_ut.assertTrue(
                                fulfillmentRec.getValue('shipstatus') === 'C',
                                testName + ' is a valid shipstatus'
                            ),

                            // lib_ut.assertTrue(
                            //     fulfillmentRec.getValue('trandate') === poRec.getValue('trandate'),
                            //     testName + ' is a valid trandate'
                            // ),

                            lib_ut.assertTrue(
                                fulfillmentRec.getValue('custbody_ctc_vc_createdby_vc') === true,
                                testName + ' is a valid custbody_ctc_vc_createdby_vc'
                            ),

                            lib_ut.assertTrue(
                                (function () {
                                    // extract the line values from the fulfillment
                                    fulfillmentLines = vcs_recordLib.extractLineValues({
                                        record: fulfillmentRec,
                                        sublistId: 'item',
                                        additionalColumns: ['item', 'quantity', 'rate', 'amount']
                                    });

                                    return fulfillmentLines.length === billFileRec.LINES.length;
                                })(),
                                testName + ' has same number of lines'
                            ),

                            lib_ut.assertTrue(
                                (function () {
                                    // loop thru each fulfillment lines, and compare it wht
                                    // the bill file lines
                                    return fulfillmentLines.every(function (ffLine, index) {
                                        var billLine = billFileRec.LINES[index];

                                        return (
                                            ffLine.item == billLine.NSITEM &&
                                            ffLine.itemname == billLine.ITEM_TEXT &&
                                            ffLine.quantity == billLine.APPLIEDQTY
                                        );
                                    });
                                })(),
                                testName + ' has same line values'
                            )
                        ].forEach(function (result) {
                            if (result) Results.push(result);
                        });
                    } catch (test_error) {
                        Results.push(test_error);
                    }

                    // delete the fulfillment
                    try {
                        ns_record.delete({ type: 'itemfulfillment', id: itemffData.id });
                        vc2_util.log(LogTitle, 'Fulfillment Deleted', itemffData.id);
                    } catch (error) {
                        var errorMsg = vclib_error.extractError(error);
                        Results.push('Error deleting item fulfillment: ' + errorMsg);
                    }
                } catch (error) {
                    var errorMsg = vclib_error.extractError(error);
                }

                return true;
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
