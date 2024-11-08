/**
 * Copyright (c) 2024  sCatalyst Tech Corp
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
 */
define([
    'N/search',
    'N/record',
    './lib/moment.js',
    '../CTC_VC2_Lib_Utils.js',
    '../CTC_VC2_Lib_Record.js',
    '../CTC_VC2_Constants.js'
], function (ns_search, ns_record, moment, vc2_util, vc2_record, vc2_constant) {
    var LogTitle = 'SVC:VCProcess',
        LOG_APP = 'VCProcess';

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var Helper = {
        parseDate: function () {},
        searchOrderLine: function (option) {
            var logTitle = [LogTitle, 'searchOrderLine'].join(':'),
                returnValue,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD;

            var poId = option.poId,
                vendorLines = option.vendorLines;

            var OrdLineFields = ['internalid'];
            for (var fld in ORDLINE_FLD) OrdLineFields.push(ORDLINE_FLD[fld]);

            try {
                // prep the search option
                var searchOption = {
                    type: ORDLINE_REC.ID,
                    columns: OrdLineFields,
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        [ORDLINE_FLD.TXN_LINK, 'anyof', poId]
                    ]
                };

                // vc2_util.log(logTitle, ' # search Option: ', searchOption);

                var ordLineSearch = ns_search.create(searchOption);
                if (!ordLineSearch.runPaged().count) throw 'No Orderlines for PO ID: ' + poId;

                var OrderLineResults = [];

                ordLineSearch.run().each(function (searchRow) {
                    var ordLineData = { ID: searchRow.id };
                    for (var fld in ORDLINE_FLD)
                        ordLineData[fld] = searchRow.getValue({ name: ORDLINE_FLD[fld] });

                    OrderLineResults.push(ordLineData);
                    return true;
                });

                vendorLines.forEach(function (vendorLine) {
                    var matchingOrderLine =
                        vc2_util.findMatching({
                            list: OrderLineResults,
                            filter: {
                                ITEM: vendorLine.item_num,
                                ORDER_NUM: vendorLine.order_num,
                                LINE_NO: vendorLine.line_num
                            }
                        }) ||
                        vc2_util.findMatching({
                            list: OrderLineResults,
                            filter: {
                                ITEM: vendorLine.item_num,
                                ORDER_NUM: vendorLine.order_num
                            }
                        });

                    vc2_util.log(logTitle, '.. matching orderline: ', matchingOrderLine);

                    vendorLine.ORDERLINE_ID = matchingOrderLine.ID || null;
                });
                vc2_util.log(logTitle, '// VendorLines: ', vendorLines);

                // choose to load all the orderlines of a given PO
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return {
        processSerials: function (option) {
            var logTitle = [LogTitle, 'processSerials'].join(':'),
                returnValue,
                SERIAL_REC = vc2_constant.RECORD.SERIALS;

            var recordValues = {},
                arrSearchCols = ['internalid', 'name'],
                arrSerialFilters = [],
                arrSerials = option.serials;

            if (vc2_util.isEmpty(arrSerials)) return false;

            // make the list unique
            arrSerials = vc2_util.uniqueArray(arrSerials);

            vc2_util.log(logTitle, '// Total serials: ', arrSerials.length);

            for (var fld in SERIAL_REC.FIELD) {
                if (option[fld] == null) continue;
                recordValues[SERIAL_REC.FIELD[fld]] = option[fld];
                arrSearchCols.push(SERIAL_REC.FIELD[fld]);
            }
            vc2_util.log(logTitle, '>> record data: ', recordValues);

            // search if serials are already existing
            var searchOption = {
                type: SERIAL_REC.ID,
                filters: [['isinactive', 'is', 'F']],
                columns: arrSearchCols
            };

            arrSerials.forEach(function (serial) {
                if (arrSerialFilters.length) arrSerialFilters.push('OR');
                arrSerialFilters.push(['name', 'is', serial]);
                return true;
            });

            searchOption.filters.push(
                'AND',
                arrSerialFilters.length > 1 ? arrSerialFilters : arrSerialFilters.shift()
            );

            // vc2_util.log(logTitle, '>> searchOption: ', searchOption);
            var serialSarchObj = ns_search.create(searchOption);
            vc2_util.log(logTitle, '>> Total existing serials: ', serialSarchObj.runPaged().count);

            // prepare serials creation/update
            var arrUpdatedSerial = [],
                arrAddedSerial = [],
                arrProcessedSerial = [];

            // First update the existing ones
            serialSarchObj.run().each(function (searchRow) {
                var serialNum = searchRow.getValue({ name: 'name' });
                ns_record.submitFields({
                    type: SERIAL_REC.ID,
                    id: searchRow.id,
                    values: recordValues,
                    options: { enablesourcing: true }
                });
                arrUpdatedSerial.push(serialNum);
                arrProcessedSerial.push(serialNum);

                vc2_util.log(logTitle, '>> Updated Serial: ', [serialNum, searchRow.id]);
                return true;
            });

            // then create the remainin
            arrSerials.forEach(function (serial) {
                if (vc2_util.inArray(serial, arrUpdatedSerial)) return;

                var recSerial = ns_record.create({ type: SERIAL_REC.ID });
                recSerial.setValue({ fieldId: 'name', value: serial });

                for (var fld in recordValues) {
                    recSerial.setValue({ fieldId: fld, value: recordValues[fld] });
                }
                var serialId = recSerial.save();

                vc2_util.log(logTitle, '>> New Serial ID: ', [serial, recordValues, serialId]);

                arrAddedSerial.push(serial);
                arrProcessedSerial.push(serial);
            });

            vc2_util.log(logTitle, '...total processed serials: ', {
                recordValues: recordValues,
                processed: arrProcessedSerial.length,
                added: arrAddedSerial.length,
                updated: arrUpdatedSerial.length
            });

            return true;
        },
        processOrderLines: function (option) {
            var logTitle = [LogTitle, 'processOrderLines'].join(':'),
                returnValue,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD,
                ORDLINE_STATUS = vc2_constant.LIST.ORDER_STATUS;

            var vendorLines = option.vendorLines,
                xmlVendor = option.xmlVendor,
                poId = option.poId || option.purchaseOrderId;

            if (vc2_util.isEmpty(vendorLines) || !util.isArray(vendorLines)) return false;
            if (vc2_util.isEmpty(poId)) return false;

            Helper.searchOrderLine({
                poId: poId,
                vendorLines: vendorLines
            });

            vendorLines.forEach(function (vendorLine) {
                var orderLine = vendorLine.MATCHED_ORDERLINE || {};
                var OrderlineValue = {
                    VENDOR: xmlVendor,
                    TXN_LINK: poId,
                    ORDER_NUM: vendorLine.order_num,
                    ORDER_STATUS: vendorLine.order_status,
                    LINE_STATUS: vendorLine.line_status,
                    ITEM: vendorLine.item_num,
                    ITEM_LINK: orderLine.item,
                    SKU: vendorLine.vendorSKU || vendorLine.item_num_alt,
                    LINE_NO: vendorLine.line_num,
                    POLINE_UNIQKEY: orderLine.line,
                    QTY: vendorLine.ship_qty,
                    PO_QTY: orderLine.quantity,
                    ORDER_DATE: vc2_util.momentParseToNSDate(vendorLine.order_date),
                    SHIPPED_DATE: vc2_util.momentParseToNSDate(vendorLine.ship_date),
                    ETA_DATE: vc2_util.momentParseToNSDate(vendorLine.order_eta),
                    ETD_DATE: vc2_util.momentParseToNSDate(vendorLine.eta_delivery_date),
                    CARRIER: vendorLine.carrier,
                    TRACKING: vendorLine.tracking_num,
                    SERIALNUM: vendorLine.serial_num,
                    ORDER_DATA: '',
                    LINE_DATA: vendorLine.vendorData
                };
                OrderlineValue.RECKEY = [OrderlineValue.TXN_LINK, OrderlineValue.ORDER_NUM];

                var fnOrderStatus = {
                    PENDING: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^pending/gi);
                    },
                    SHIPPED: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^shipped/gi);
                    },
                    INVOICED: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^invoiced/gi);
                    },
                    PARTIALLY_SHIPPED: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^partially.*shipped/gi);
                    },
                    SCHEDULED: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^scheduled/gi);
                    },
                    BACKORDERED: function (orderStatus, lineStatus) {
                        return orderStatus.match(/^backordered/gi);
                    },
                    IN_PROGRESS: function (orderStatus, lineStatus) {
                        return lineStatus.match(/in\sprogress/gi);
                    }
                };

                for (var status in fnOrderStatus) {
                    var statusResult = fnOrderStatus[status].call(
                        OrderlineValue,
                        OrderlineValue.ORDER_STATUS,
                        OrderlineValue.LINE_STATUS
                    );

                    if (statusResult) {
                        OrderlineValue.STATUS = ORDLINE_STATUS[status];
                        break;
                    }
                }

                var OrdLineFieldValues = {};
                for (var fld in OrderlineValue) {
                    if (!vc2_util.isEmpty(OrderlineValue[fld]))
                        OrdLineFieldValues[ORDLINE_FLD[fld]] = OrderlineValue[fld];
                }
                vc2_util.log(logTitle, '---  order line values: ', [
                    OrderlineValue,
                    OrdLineFieldValues
                ]);

                if (vendorLine.ORDERLINE_ID) {
                    ns_record.submitFields({
                        type: ORDLINE_REC.ID,
                        id: vendorLine.ORDERLINE_ID,
                        values: OrdLineFieldValues
                    });
                    vc2_util.log(logTitle, '** Update Order Line ** ', [vendorLine.ORDERLINE_ID]);
                } else {
                    var recordOrdLine = ns_record.create({ type: ORDLINE_REC.ID });

                    for (var fld in OrdLineFieldValues) {
                        vc2_record.setRecordValue({
                            record: recordOrdLine,
                            fieldId: fld,
                            value: OrdLineFieldValues[fld]
                        });
                    }

                    var ID = recordOrdLine.save();
                    vc2_util.log(logTitle, '** Create Order Line ** ', [ID]);
                }

                return true;
            });

            return returnValue;
        },
        searchOrderLines: function (option) {
            var logTitle = [LogTitle, 'searchOrderLine'].join(':'),
                returnValue,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD;

            var poId = option.poId,
                orderNum = option.orderNum,
                orderKey = option.orderKey;

            try {
                var OrdLineFields = ['internalid'];
                for (var fld in ORDLINE_FLD) OrdLineFields.push(ORDLINE_FLD[fld]);

                var searchOption = {
                        type: ORDLINE_REC.ID,
                        columns: OrdLineFields,
                        filters: [
                            ['isinactive', 'is', 'F']
                            // 'AND',
                            // [ORDLINE_FLD.TXN_LINK, 'anyof', poId]
                        ]
                    },
                    OrderLineResults = [];

                if (poId) searchOption.filters.push('AND', [ORDLINE_FLD.TXN_LINK, 'anyof', poId]);
                if (orderNum)
                    searchOption.filters.push('AND', [ORDLINE_FLD.ORDER_NUM, 'is', orderNum]);
                if (orderKey)
                    searchOption.filters.push('AND', [ORDLINE_FLD.RECKEY, 'is', orderKey]);

                vc2_util.log(logTitle, '// search Option: ', searchOption);

                var ordLineSearch = ns_search.create(searchOption);
                if (!ordLineSearch.runPaged().count) throw 'No Orderlines for PO ID: ' + poId;
                vc2_util.log(logTitle, '// total count: : ', ordLineSearch.runPaged().count);

                ordLineSearch.run().each(function (searchRow) {
                    var ordLineData = { ID: searchRow.id };
                    for (var fld in ORDLINE_FLD)
                        ordLineData[fld] = searchRow.getValue({ name: ORDLINE_FLD[fld] });

                    OrderLineResults.push(ordLineData);
                    return true;
                });

                returnValue = OrderLineResults;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };
});
