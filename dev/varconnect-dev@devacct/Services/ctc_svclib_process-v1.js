/**
 * Copyright (c) 2025  sCatalyst Tech Corp
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
define(function (require) {
    var LogTitle = 'SVC:VCProcess',
        LOG_APP = 'VCProcess';

    var ns_search = require('N/search'),
        ns_record = require('N/record');
    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var vcs_configLib = require('./ctc_svclib_configlib'),
        vcs_recordLib = require('./ctc_svclib_records');

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var Helper = {
        addOrderNumRec: function (option) {
            var logTitle = [LogTitle, 'addOrderNumRec'].join(':'),
                returnValue,
                ORDNUM_REC = vc2_constant.RECORD.ORDER_NUM,
                ORDNUM_FLD = ORDNUM_REC.FIELD;

            try {
                var poId = option.poId,
                    poNum = option.poNum,
                    recordData = option.recordData,
                    orderNumRec = option.orderNumRec;

                vc2_util.log(logTitle, '### ADD ORDERNUM Record ### ', [poId, poNum, orderNumRec]);

                //search the existing order number record
                if (!recordData) {
                    recordData = vcs_recordLib.searchTransaction({
                        poNum: poNum,
                        poId: poId
                    });
                    if (vc2_util.isEmpty(recordData))
                        throw 'No record data found for PO ID: ' + poId || poNum;
                }

                // prep the ordernumvalues
                var recordValues = {
                    TXN_LINK: recordData.id,
                    ORDER_NUM: poNum || recordData.tranid,
                    VENDOR_NUM: option.VendorOrderNum,
                    ORDER_DATE: vc2_util.momentParse(option.OrderDate),
                    TOTAL: vc2_util.parseFloat(option.Total == 'NA' ? 0 : option.Total),
                    SOURCE: !util.isString(option.Source)
                        ? JSON.stringify(option.Source)
                        : option.Source,
                    ORDER_STATUS: option.Status,
                    LINES: JSON.stringify(option.Lines),
                    VENDOR: option.ConfigRec ? option.ConfigRec.xmlVendor : null,
                    VENDOR_CFG: option.ConfigRec ? option.ConfigRec.id : null
                };
                vc2_util.log(logTitle, '-- Record Values:', recordValues);
                vc2_util.log(logTitle, '-- orderNumRec:', orderNumRec);

                if (!orderNumRec) {
                    // create new order number record
                    var recOrderNum = ns_record.create({ type: ORDNUM_REC.ID });
                    // set the values
                    for (var fld in recordValues) {
                        recOrderNum.setValue({
                            fieldId: ORDNUM_FLD[fld],
                            value: recordValues[fld]
                        });
                    }
                    recOrderNum.setValue({ fieldId: 'name', value: recordValues.VENDOR_NUM });

                    var orderNumRecID = recOrderNum.save();
                    orderNumRec = util.extend(recordValues, { ID: orderNumRecID });
                    vc2_util.log(logTitle, '/// Created new record --', orderNumRec);
                } else {
                    // update the vendor order number record using submitFields
                    var submitRecOption = {
                        type: ORDNUM_REC.ID,
                        id: orderNumRec.ID,
                        values: (function () {
                            var fldValues = {};
                            for (var fld in recordValues)
                                fldValues[ORDNUM_FLD[fld]] = recordValues[fld];
                            return fldValues;
                        })()
                    };
                    ns_record.submitFields(submitRecOption);
                    vc2_util.log(logTitle, '/// Updated record -- ', submitRecOption);
                }
                returnValue = orderNumRec;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        addOrderLineRec: function (option) {
            var logTitle = [LogTitle, 'addOrderLineRec'].join(':'),
                returnValue,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD;

            try {
                var poId = option.poId,
                    poNum = option.poNum,
                    orderLineData = option.orderLineData,
                    orderNumRec = option.orderNumRec,
                    orderLineRec = option.orderLineRec;

                vc2_util.log(logTitle, '### ADD ORDER LINE  ### ', [poId, poNum, orderLineData]);

                var recordLineValues = {
                    ORDNUM_LINK: orderNumRec.ID,
                    VENDOR: orderNumRec.VENDOR,
                    TXN_LINK: orderNumRec.TXN_LINK,
                    ORDER_NUM: orderLineData.order_num,
                    ORDER_STATUS: orderLineData.order_status,
                    LINE_STATUS: orderLineData.line_status,
                    ITEM: orderLineData.item_num,
                    SKU: orderLineData.vendorSKU,
                    LINE_NO: orderLineData.line_num,
                    QTY: orderLineData.ship_qty,
                    ORDER_DATE: vc2_util.momentParse(orderLineData.order_date),
                    SHIPPED_DATE: vc2_util.momentParse(orderLineData.ship_date),
                    ETA_DATE: vc2_util.momentParse(orderLineData.order_eta),
                    ETD_DATE: vc2_util.momentParse(orderLineData.eta_delivery_date),
                    PROMISED_DATE: vc2_util.momentParse(orderLineData.promised_date),
                    CARRIER: orderLineData.carrier,
                    SHIP_METHOD: orderLineData.ship_method,
                    TRACKING: orderLineData.tracking_num,
                    SERIALNUM: orderLineData.serial_num,
                    ORDER_DATA: orderLineData.order_data,
                    SHIP_STATUS: (function () {
                        return orderLineData.is_shipped
                            ? 'SHIPPED'
                            : orderLineData.SKIPPED || orderLineData.NOTSHIPPED;
                    })()

                    // these are setup later
                    // STATUS: 'custrecord_ctc_vc_orderline_orderstatus',
                    // ITEM_LINK: 'custrecord_ctc_vc_orderline_itemlink',
                    // POLINE_UNIQKEY: 'custrecord_ctc_vc_orderline_polinekey',
                    // PO_QTY: 'custrecord_ctc_vc_orderline_poqty',

                    // ORDER_DATA: 'custrecord_ctc_vc_orderline_vndorderdata',
                    // LINE_DATA: 'custrecord_ctc_vc_orderline_vndlinedata',
                    // ITEMFF_LINK: 'custrecord_ctc_vc_orderline_itemfflink',
                    // VB_LINK: 'custrecord_ctc_vc_orderline_vblink',
                    // BILLFILE_LINK: 'custrecord_ctc_vc_orderline_billfile'
                };
                recordLineValues.RECKEY = [
                    recordLineValues.TXN_LINK,
                    recordLineValues.VENDOR,
                    recordLineValues.ORDER_NUM
                ].join('_');

                vc2_util.log(logTitle, '-- Record LineValues: ', [orderLineRec, recordLineValues]);

                if (!orderLineRec || vc2_util.isEmpty(orderLineRec)) {
                    // create new order line record
                    var recOrderLine = ns_record.create({ type: ORDLINE_REC.ID });

                    // set the values
                    for (var fld in recordLineValues) {
                        recOrderLine.setValue({
                            fieldId: ORDLINE_FLD[fld],
                            value: recordLineValues[fld]
                        });
                    }
                    recOrderLine.setValue({ fieldId: 'name', value: recordLineValues.LINE_NO });
                    returnValue = recOrderLine.save();

                    vc2_util.log(logTitle, '/// Created new record.');
                } else {
                    // update the vendor order number record using submitFields
                    var submitRecOption = {
                        type: ORDLINE_REC.ID,
                        id: orderLineRec.ID,
                        values: (function () {
                            var fldValues = {};
                            for (var fld in recordLineValues)
                                fldValues[ORDLINE_FLD[fld]] = recordLineValues[fld];
                            return fldValues;
                        })()
                    };
                    returnValue = ns_record.submitFields(submitRecOption);

                    vc2_util.log(logTitle, '/// Updated record: ', submitRecOption);
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        searchOrderNum: function (option) {
            var logTitle = [LogTitle, 'searchOrderNum'].join(':'),
                returnValue,
                ORDNUM_REC = vc2_constant.RECORD.ORDER_NUM,
                ORDNUM_FLD = ORDNUM_REC.FIELD;

            try {
                var poId = option.poId,
                    poNum = option.poNum,
                    vendorNum = option.vendorNum,
                    orderNumRecId = option.orderNumRecId;

                if (!poId && !poNum) throw 'No PO ID or PO Number provided';

                // search for the existing order number record
                var searchOption = {
                    type: ORDNUM_REC.ID,
                    filters: (function () {
                        var fltr = [['isinactive', 'is', 'F']];
                        if (poId) fltr.push('AND', [ORDNUM_FLD.TXN_LINK, 'anyof', poId]);
                        if (poNum) fltr.push('AND', [ORDNUM_FLD.ORDER_NUM, 'is', poNum]);
                        if (vendorNum) fltr.push('AND', [ORDNUM_FLD.VENDOR_NUM, 'is', vendorNum]);
                        if (orderNumRecId) fltr.push('AND', ['internalid', 'anyof', orderNumRecId]);
                        return fltr;
                    })(),
                    columns: (function () {
                        var cols = ['internalid', 'name'];
                        for (var fld in ORDNUM_FLD) cols.push(ORDNUM_FLD[fld]);
                        return cols;
                    })()
                };
                // vc2_util.log(logTitle, '>> searchOption: ', searchOption);

                var OrderNumSearch = ns_search.create(searchOption);

                // if no records are found, return immediately
                if (!OrderNumSearch.runPaged().count) throw 'No OrderNum record found';

                var OrderNumData = {};
                OrderNumSearch.run().each(function (searchRow) {
                    OrderNumData.ID = searchRow.id;
                    OrderNumData.NAME = searchRow.getValue({ name: 'name' });
                    for (var fld in ORDNUM_FLD) {
                        var value = searchRow.getValue({ name: ORDNUM_FLD[fld] }),
                            textValue = searchRow.getText({ name: ORDNUM_FLD[fld] });

                        OrderNumData[fld] = value;
                        if (textValue && textValue != value)
                            OrderNumData[fld + '_text'] = textValue;
                    }
                    return true;
                });

                // vc2_util.log(logTitle, '-- OrderNum Data: ', OrderNumData);
                returnValue = OrderNumData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '### SEARCH ORDER NUM ### ', [option, returnValue]);
            }

            return returnValue;
        },
        searchOrderLines: function (option) {
            var logTitle = [LogTitle, 'searchOrderLines'].join(':'),
                returnValue,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD;

            try {
                var poId = option.poId,
                    poNum = option.poNum,
                    vendorNum = option.vendorNum,
                    orderNumRecId = option.orderNumRecId;

                // vc2_util.log(logTitle, '### SEARCH ORDER LINES ### ', option);
                if (!poId && !poNum) throw 'No PO ID or PO Number provided';

                // search for the existing order line records
                var searchOption = {
                    type: ORDLINE_REC.ID,
                    filters: (function () {
                        var fltr = [['isinactive', 'is', 'F']];
                        if (poId) fltr.push('AND', [ORDLINE_FLD.TXN_LINK, 'anyof', poId]);
                        // if (poNum) fltr.push('AND', [ORDLINE_FLD.ORDER_NUM, 'is', poNum]);
                        if (vendorNum) fltr.push('AND', [ORDLINE_FLD.ORDER_NUM, 'is', vendorNum]);
                        if (orderNumRecId)
                            fltr.push('AND', [ORDLINE_FLD.ORDNUM_LINK, 'anyof', orderNumRecId]);
                        return fltr;
                    })(),
                    columns: (function () {
                        var cols = ['internalid'];
                        for (var fld in ORDLINE_FLD) cols.push(ORDLINE_FLD[fld]);
                        return cols;
                    })()
                };
                // vc2_util.log(logTitle, '>> searchOption: ', searchOption);

                var OrderLineSearch = ns_search.create(searchOption);

                // if no records are found, return immediately
                if (!OrderLineSearch.runPaged().count) throw 'No OrderLine records found';

                var OrderLineData = [];
                OrderLineSearch.run().each(function (searchRow) {
                    var orderLine = {
                        ID: searchRow.id,
                        NAME: searchRow.getValue({ name: 'name' })
                    };
                    for (var fld in ORDLINE_FLD) {
                        var value = searchRow.getValue({ name: ORDLINE_FLD[fld] }),
                            textValue = searchRow.getText({ name: ORDLINE_FLD[fld] });

                        orderLine[fld] = value;
                        if (textValue && textValue != value) orderLine[fld + '_text'] = textValue;
                    }
                    OrderLineData.push(orderLine);
                    return true;
                });

                // vc2_util.log(logTitle, '-- OrderLine Data: ', OrderLineData);
                returnValue = OrderLineData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '### SEARCH ORDER LINES ### ', [option, returnValue]);
            }

            return returnValue;
        },
        cleanupOrderNum: function (option) {
            var logTitle = [LogTitle, 'Helper:cleanupOrderNum'].join(':'),
                returnValue;

            try {
                var orderNum =
                        option.orderNum ||
                        option.VendorOrderNum ||
                        !vc2_util.isEmpty(option.orderNumRec)
                            ? option.orderNumRec.NAME || option.orderNumRec.VENDOR_NUM
                            : null,
                    orderNumID =
                        option.orderNumID ||
                        option.orderNumRecID ||
                        option.id ||
                        !vc2_util.isEmpty(option.orderNumRec)
                            ? option.orderNumRec.ID
                            : null;

                if (!orderNumID && !orderNum) throw 'No OrderNum record provided.';
                vc2_util.log(logTitle, '### CLEANUP ORDER NUM ### ', [orderNum, orderNumID]);

                if (!orderNumID) {
                    // search for the ordernumn record
                    var orderNumRec = Helper.searchOrderNum({
                        poId: option.poId,
                        poNum: option.poNum,
                        vendorNum: orderNum
                    });
                    orderNumID = orderNumRec.ID;
                }
                if (!orderNumID) throw 'No OrderNum record found.';

                //////////// CLEANUP ORDER LINES ////////////
                var orderLines = Helper.searchOrderLines({
                    orderNumRecId: option.orderNumRec.ID,
                    vendorNum: orderNum,
                    poId: option.poId,
                    poNum: option.poNum
                });

                // loop thru each order line and set to inactive
                (orderLines || []).forEach(function (orderLine) {
                    Helper.cleanupOrderLine({ orderLineId: orderLine.ID });
                });

                //////////// CLEANUP ORDER NUM ////////////
                /// update the ordernum record
                var submitRecOption = {
                    type: vc2_constant.RECORD.ORDER_NUM.ID,
                    id: orderNumID,
                    values: (function () {
                        var updateValues = { isinactive: true };
                        updateValues[vc2_constant.RECORD.ORDER_NUM.FIELD.ORDER_STATUS] = 'DELETED';
                        return updateValues;
                    })()
                };
                ns_record.submitFields(submitRecOption);
                vc2_util.log(
                    logTitle,
                    '/// OrderNum record status set to DELETED -- ',
                    submitRecOption
                );
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        cleanupOrderLine: function (option) {
            var logTitle = [LogTitle, 'Helper:cleanupOrderLine'].join(':'),
                returnValue;

            try {
                vc2_util.log(logTitle, '### CLEANUP ORDER LINES ### ', option);

                var orderLineID = option.orderLineId || option.orderLineRecID || option.id;
                if (!vc2_util.isEmpty(option.orderLineRec)) orderLineID = option.orderLineRec.ID;
                if (!orderLineID) throw 'No OrderLine record provided.';

                var submitRecOption = {
                    type: vc2_constant.RECORD.ORDER_LINE.ID,
                    id: orderLineID,
                    values: (function () {
                        var updateValues = { isinactive: true };
                        updateValues[vc2_constant.RECORD.ORDER_LINE.FIELD.LINE_STATUS] = 'DELETED';
                        return updateValues;
                    })()
                };
                ns_record.submitFields(submitRecOption);
                vc2_util.log(
                    logTitle,
                    '/// OrderLine record status set to DELETED -- ',
                    submitRecOption
                );
                returnValue = true;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    var LibProcess = {};

    /// SERIALS PROCESSING ///
    util.extend(LibProcess, {
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
            var cnt = 0;
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

                vc2_util.log(logTitle, '>> Updated Serial: ', [
                    [cnt++, arrSerials.length].join('/'),
                    serialNum,
                    searchRow.id,
                    recordValues
                ]);
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

                vc2_util.log(logTitle, '>> New Serial ID: ', [
                    [cnt++, arrSerials.length].join('/'),
                    serial,
                    recordValues,
                    serialId
                ]);

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
        }
    });

    /// ORDER NUMS / LINES ///
    util.extend(LibProcess, {
        searchOrderLines: function (option) {
            var logTitle = [LogTitle, 'searchOrderLines'].join(':'),
                returnValue,
                ORDNUM_REC = vc2_constant.RECORD.ORDER_NUM,
                ORDNUM_FLD = ORDNUM_REC.FIELD,
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD;

            try {
                var vendorNum = option.vendorNum || option.VendorOrderNum,
                    orderNumRecId = option.id || option.orderNumRecID,
                    poId = option.poId || option.purchaseOrderId,
                    orderKey = option.orderKey,
                    poNum = option.poNum || option.tranid;

                vc2_util.log(logTitle, '### SEARCH ORDER LINES ### ', option);

                if (!(vendorNum && (poId || poNum)) && !orderKey && !orderNumRecId)
                    throw 'No Vendor Number or Order Key provided';

                var OrderNumData = Helper.searchOrderNum({
                    poId: poId,
                    poNum: poNum,
                    vendorNum: vendorNum,
                    orderNumRecId: orderNumRecId
                });
                if (!OrderNumData) throw 'No OrderNum Data found.';

                //// Search for Order Lines
                OrderNumData.LINES = Helper.searchOrderLines({
                    orderNumRecId: OrderNumData.ID,
                    vendorNum: vendorNum,
                    poId: poId,
                    poNum: poNum
                });

                returnValue = OrderNumData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        searchOrderLine: function (option) {
            var logTitle = [LogTitle, 'searchOrderLine'].join(':'),
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD,
                returnValue;

            try {
                var poId = option.poId,
                    vendorLine = option.vendorLine;

                /// search the existing order lines, with values from the vendor lines
                var searchOption = {
                    type: ORDLINE_REC.ID,
                    filters: (function () {
                        var fltr = [['isinactive', 'is', 'F']];
                        if (poId) fltr.push('AND', [ORDLINE_FLD.TXN_LINK, 'anyof', poId]);
                        if (vendorLine) {
                            if (vendorLine.item_num)
                                fltr.push('AND', [ORDLINE_FLD.ITEM, 'is', vendorLine.item_num]);
                            if (vendorLine.order_num)
                                fltr.push('AND', [
                                    ORDLINE_FLD.ORDER_NUM,
                                    'is',
                                    vendorLine.order_num
                                ]);
                        }
                        return fltr;
                    })(),
                    columns: (function () {
                        var cols = ['internalid'];
                        for (var fld in ORDLINE_FLD) cols.push(ORDLINE_FLD[fld]);
                        return cols;
                    })()
                };

                var OrderLineSearch = ns_search.create(searchOption);

                if (!OrderLineSearch.runPaged().count)
                    throw (
                        'No OrderStatusLine : ' +
                        [poId, vendorLine.item_num, vendorLine.order_num].join(' | ')
                    );

                var OrderLineData = {};
                OrderLineSearch.run().each(function (searchRow) {
                    OrderLineData.ID = searchRow.id;
                    for (var fld in ORDLINE_FLD)
                        OrderLineData[fld] = searchRow.getValue({ name: ORDLINE_FLD[fld] });

                    return true;
                });

                return OrderLineData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        searchOrderNums: function (option) {
            var logTitle = [LogTitle, 'searchOrderNums'].join(':'),
                returnValue,
                ORDNUM_REC = vc2_constant.RECORD.ORDER_NUM,
                ORDNUM_FLD = ORDNUM_REC.FIELD;

            try {
                var vendorNum = option.vendorNum || option.VendorOrderNum,
                    poId = option.poId || option.purchaseOrderId,
                    poNum = option.poNum || option.tranid;

                vc2_util.log(logTitle, '### SEARCH ORDER NUMS ### ', option);

                // no poId or poNum, return immediately
                if (!(poId || poNum)) throw 'No PO ID or PO Number provided';

                // search for the existing order number records
                var searchOption = {
                    type: ORDNUM_REC.ID,
                    filters: (function () {
                        var fltr = [['isinactive', 'is', 'F']];
                        if (vendorNum) fltr.push('AND', [ORDNUM_FLD.VENDOR_NUM, 'is', vendorNum]);
                        if (poId) fltr.push('AND', [ORDNUM_FLD.TXN_LINK, 'anyof', poId]);
                        if (poNum) fltr.push('AND', [ORDNUM_FLD.ORDER_NUM, 'is', poNum]);
                        return fltr;
                    })(),
                    columns: (function () {
                        var cols = ['internalid', 'name'];
                        for (var fld in ORDNUM_FLD) cols.push(ORDNUM_FLD[fld]);
                        return cols;
                    })()
                };
                vc2_util.log(logTitle, '>> searchOption: ', searchOption);

                var OrderNumSearch = ns_search.create(searchOption);

                // if no records are found, return immediately
                if (!OrderNumSearch.runPaged().count) throw 'No OrderNum records found';

                var OrderNumData = [];
                OrderNumSearch.run().each(function (searchRow) {
                    var orderNum = { ID: searchRow.id, NAME: searchRow.getValue({ name: 'name' }) };
                    for (var fld in ORDNUM_FLD) {
                        var value = searchRow.getValue({ name: ORDNUM_FLD[fld] }),
                            textValue = searchRow.getText({ name: ORDNUM_FLD[fld] });

                        orderNum[fld] = value;
                        if (textValue && textValue != value) orderNum[fld + '_text'] = textValue;
                    }
                    OrderNumData.push(orderNum);
                    return true;
                });

                vc2_util.log(logTitle, '-- OrderNum Data: ', OrderNumData);
                returnValue = OrderNumData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        processOrderStatusLines: function (option) {
            var logTitle = [LogTitle, 'processOrderStatusLines'].join(':'),
                returnValue;

            try {
                vc2_util.log(logTitle, '#### PROCESS ORDER LINES: START ####', option);

                if (!option.recordData) {
                    option.recordData = vcs_recordLib.searchTransaction({
                        poNum: option.poNum,
                        poId: option.poId
                    });
                }

                // search for existing order Num record
                var orderNumRecord = LibProcess.searchOrderLines({
                    vendorNum: option.VendorOrderNum,
                    poId: option.poId,
                    poNum: option.poNum
                });

                // create or edit the order number record
                orderNumRecord = Helper.addOrderNumRec(
                    util.extend(option, { orderNumRec: orderNumRecord })
                );

                /// run through all the Order Lines
                var arrMatchedOrderLines = [];

                for (var i = 0, j = option.Lines.length; i < j; i++) {
                    var orderLine = option.Lines[i],
                        matchedOrderLine = {};

                    if (orderNumRecord && orderNumRecord.LINES) {
                        matchedOrderLine = vc2_util.findMatching({
                            list: orderNumRecord.LINES,
                            filter: {
                                ITEM: orderLine.item_num,
                                ORDER_NUM: orderLine.order_num,
                                LINE_NO: orderLine.line_num
                            }
                        });

                        if (matchedOrderLine) arrMatchedOrderLines.push(matchedOrderLine);
                    }
                    vc2_util.log(logTitle, '>> matched order line: ', matchedOrderLine);
                    Helper.addOrderLineRec({
                        orderLineData: orderLine,
                        orderNumRec: orderNumRecord,
                        orderLineRec: matchedOrderLine,
                        recordData: option.recordData
                    });
                }

                vc2_util.log(logTitle, '>> Matched Order Lines: ', [
                    arrMatchedOrderLines,
                    orderNumRecord
                ]);

                // loop thru orderNumRecord.LINES and removed not matched
                if (orderNumRecord && orderNumRecord.LINES && util.isArray(orderNumRecord.LINES)) {
                    orderNumRecord.LINES.forEach(function (orderLine) {
                        if (!vc2_util.inArray(orderLine, arrMatchedOrderLines)) {
                            Helper.cleanupOrderLine({ orderLineId: orderLine.ID });
                        }
                    });
                }

                returnValue = orderNumRecord;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        bulkProcessOrderStatusLines: function (option) {
            var logTitle = [LogTitle, 'bulkProcessOrderStatusLines'].join(':'),
                returnValue;

            try {
                vc2_util.log(logTitle, '#### BULK PROCESS ORDER LINES: START ####');
                // vc2_util.dumpLog(logTitle, option, '[ option ]');

                if (!option.recordData) {
                    option.recordData = vcs_recordLib.searchTransaction({
                        poNum: option.poNum,
                        poId: option.poId
                    });
                }
                if (
                    !option.Orders ||
                    vc2_util.isEmpty(option.Orders) ||
                    !util.isArray(option.Orders)
                )
                    throw 'No Orders to process.';

                /// process each orders
                var arrOrders = option.Orders,
                    arrOrderNums = [],
                    processedOrders = [];

                arrOrders.forEach(function (orderData) {
                    vc2_util.dumpLog(logTitle, orderData, '[ orderData ]');

                    var orderNumRec = LibProcess.processOrderStatusLines(
                        util.extend(orderData, {
                            ConfigRec: option.ConfigRec,
                            poId: option.poId,
                            poNum: option.poNum
                        })
                    );
                    processedOrders.push(orderNumRec);
                    arrOrderNums.push(orderData.VendorOrderNum);
                });
                vc2_util.log(logTitle, '>> Processed Orders: ', arrOrderNums);

                // cleanup the rest of the order numbers
                var arrVendorNumRecs = LibProcess.searchOrderNums({
                    poId: option.poId,
                    poNum: option.poNum
                });

                //loop thru each order number record
                arrVendorNumRecs.forEach(function (orderNumRec) {
                    if (!vc2_util.inArray(orderNumRec.VENDOR_NUM, arrOrderNums)) {
                        Helper.cleanupOrderNum({
                            poId: option.poId,
                            poNum: option.poNum,
                            orderNumRec: orderNumRec
                        });
                    }
                });

                returnValue = processedOrders;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        updateOrderNum: function (option) {
            var logTitle = [LogTitle, 'updateOrderNum'].join(':'),
                ORDNUM_REC = vc2_constant.RECORD.ORDER_NUM,
                ORDNUM_FLD = ORDNUM_REC.FIELD,
                returnValue;

            try {
                vc2_util.log(logTitle, '#### UPDATE ORDER STATUS: START ####', option);

                var poId = option.poId,
                    vendorNum = option.vendorNum,
                    orderNumRec = option.orderNumRec,
                    orderNumValues = option.orderNumValues;

                var orderNumData = LibProcess.searchOrderLines({
                    vendorNum: option.vendorOrderNum || option.vendorNum || option.VendorOrderNum,
                    poId: option.poId,
                    poNum: option.poNum
                });
                if (!orderNumData) throw 'No Order Num found.';

                var submitRecOption = {
                    type: ORDNUM_REC.ID,
                    id: orderNumData.ID,
                    values: (function () {
                        var fldValues = {};
                        for (var fld in orderNumValues) {
                            fldValues[ORDNUM_FLD[fld]] = orderNumValues[fld];
                        }
                        return fldValues;
                    })()
                };
                vc2_util.log(logTitle, '>> submitRecOption: ', submitRecOption);

                returnValue = ns_record.submitFields(submitRecOption);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        updateMatchedLine: function (option) {
            var logTitle = [LogTitle, 'updateOrderLines'].join(':'),
                ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                ORDLINE_FLD = ORDLINE_REC.FIELD,
                returnValue;

            try {
                vc2_util.log(logTitle, '#### UPDATE MATCHED ORDER LINES: START ####', option);

                var poId = option.poId,
                    vendorLine = option.vendorLine,
                    orderLine = option.orderLine;

                var orderLineData = LibProcess.searchOrderLine(option);
                if (!orderLineData) throw 'No Order Line found.';

                var submitRecOption = {
                    type: ORDLINE_REC.ID,
                    id: orderLineData.ID,
                    values: (function () {
                        var fldValues = {};
                        fldValues[ORDLINE_FLD.ITEM_LINK] = orderLine.item;
                        fldValues[ORDLINE_FLD.PO_QTY] = orderLine.quantity;
                        return fldValues;
                    })()
                };
                // vc2_util.log(logTitle, '>> submitRecOption: ', submitRecOption);

                returnValue = ns_record.submitFields(submitRecOption);
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    });

    return LibProcess;
});
/**
 * USAGE:
 * 
{
  "moduleName": "processV1",
  "action": "OrderStatusDebug",
  "parameters": {
    "poNum": "124640",
    "vendorConfigId": "505",
    "showLines": true
  }
}
 */
