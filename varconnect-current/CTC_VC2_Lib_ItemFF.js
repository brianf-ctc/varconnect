/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType MapReduceScript
 */

define(function (require) {
    var ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_record = require('N/record');

    var LogTitle = 'LIB_ItemFF',
        LogPrefix = '',
        Current = {};

    var vc2_constant = require('./CTC_VC2_Constants.js'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js'),
        vc_record = require('./CTC_VC_Lib_Record.js'),
        vc2_record = require('./CTC_VC2_Lib_Record.js');

    var ERROR_MSG = vc2_constant.ERRORMSG;

    var Helper = {
        sortLineData: function (lineData) {
            var sort_by = function (field, reverse, primer) {
                var key = primer
                    ? function (x) {
                          return primer(x[field]);
                      }
                    : function (x) {
                          return x[field];
                      };

                reverse = !reverse ? 1 : -1;

                return function (a, b) {
                    return (a = key(a)), (b = key(b)), reverse * ((a > b) - (b > a));
                };
            };

            lineData.sort(
                sort_by('order_num', false, function (a) {
                    return a.toUpperCase();
                })
            );

            return lineData;
        },
        initializeFeatures: function () {
            return Current;
        }
    };

    var VC_ItemFF = {
        intialize: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue;

            try {
                Helper.initializeFeatures();

                Current.Features = {
                    MULTISHIPTO: ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' }),
                    MULTILOCINVT: ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })
                };

                Current.MainCFG = option.mainConfig;
                Current.VendorCFG = option.vendorConfig;
                Current.PO_ID = option.poId || option.recPurchOrd.id;
                Current.SO_ID = option.soId || option.recSalesOrd.id;
                Current.Vendor = option.vendor;

                LogPrefix = '[purchaseorder:' + Current.PO_ID + '] ';
                vc2_util.LogPrefix = LogPrefix;

                Current.OrderLines = option.lineData;
                Current.SO_REC = option.recSalesOrd;
                Current.PO_REC = option.recPurchOrd;

                //////////////////////
                if (!Current.MainCFG) throw ERROR_MSG.MISSING_CONFIG;
                if (!Current.VendorCFG) throw ERROR_MSG.MISSING_VENDORCFG;
                if (!Current.PO_ID) throw ERROR_MSG.MISSING_PO;
                if (vc2_util.isEmpty(Current.OrderLines)) throw ERROR_MSG.MISSING_LINES;
                // if (!Helper.validateDate()) throw ERROR_MSG.INVALID_PODATE;

                Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;
                if (!Current.NumPrefix) throw ERROR_MSG.MISSING_PREFIX;
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        extractUniqueOrders: function (option) {
            var logTitle = [LogTitle, 'extractUniqueOrders'].join('::'),
                returnValue;

            try {
                var OrderLines = Helper.sortLineData(option.orderLines);

                OrderLines.forEach(function (orderLine) {
                    try {
                        if (!orderLine.order_num || orderLine.order_num == 'NA')
                            throw ERROR_MSG.MISSING_ORDERNUM;

                        if (
                            orderLine.hasOwnProperty('is_shipped') &&
                            orderLine.is_shipped === false
                        )
                            throw ERROR_MSG.NOT_YET_SHIPPED;

                        if (orderLine.hasOwnProperty('ns_record') && orderLine.ns_record)
                            throw ERROR_MSG.ORDER_EXISTS;

                        orderLine.ship_qty = parseInt(orderLine.ship_qty || '0', 10);
                        if (orderLine.ship_qty == 0) throw ERROR_MSG.NO_SHIP_QTY;

                        orderLine.vendorOrderNum = Current.NumPrefix + orderLine.order_num;
                        orderLine.RESULT = 'ADDED';

                        var orderNum = orderLine.order_num,
                            vendorOrderNum = Current.NumPrefix + orderNum;

                        if (!OrderLinesByNum[orderNum]) OrderLinesByNum[orderNum] = [];

                        OrderLinesByNum[orderNum].push(orderLine);

                        if (!vc2_util.inArray(orderNum, arrOrderNums)) {
                            arrOrderNums.push(orderNum);
                            arrVendorOrderNums.push(vendorOrderNum);
                        }
                    } catch (order_error) {
                        orderLine.RESULT = vc2_util.extractError(order_error);
                        Helper.logError(
                            {
                                message: JSON.stringify(orderLine),
                                logStatus:
                                    order_error.logStatus || vc2_constant.LIST.VC_LOG_STATUS.WARN
                            },
                            vc2_util.extractError(order_error)
                        );
                        return;
                    }

                    return true;
                });
            } catch (error) {
                throw error;
            }

            return returnValue;
        },

        processOrderLine: function (option) {},
        process: function (option) {
            var logTitle = [LogTitle, 'process'].join('::'),
                returnValue;

            vc2_util.log(logTitle, '########### ITEM CREATION: START ##############');

            try {
                Helper.initializeFeatures();

                vc2_util.log(logTitle, '// OrderLines: ', Current.OrderLines);
            } catch (error) {
                throw error;
            } finally {
                vc2_util.log(logTitle, '########### ITEM CREATION: END ##############');
            }
            return returnValue;
        }
    };

    return VC_ItemFF;
});
