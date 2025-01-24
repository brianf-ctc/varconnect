/**
 * Copyright (c) 2025 Catalyst Tech Corp
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

    var vc2_util = require('./CTC_VC2_Lib_Utils'),
        vc2_constant = require('./CTC_VC2_Constants.js'),
        vc_itemfflib = require('./CTC_VC_Lib_Fulfillment'),
        vc_itemrcpt = require('./CTC_VC_Lib_ItemReceipt'),
        vc_nslib = require('./CTC_VC_Lib_Record.js'),
        vc2_record = require('./CTC_VC2_Lib_Record'),
        vcs_configLib = require('./Services/ctc_svclib_configlib.js'),
        vcs_processLib = require('./Services/ctc_svclib_process-v1.js'),
        vcs_websvcLib = require('./Services/ctc_svclib_webservice-v1');

    var LogTitle = 'MR_OrderStatus',
        VCLOG_APPNAME = 'VAR Connect | OrderStatus';
    var LogPrefix = '';
    var ScriptParam = {},
        Current = {};

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var PO_COLS = {
        poNum: 'tranid',
        tranDate: 'trandate',
        vendorId: 'entity',
        createdFrom: 'createdfrom',
        poLinkType: 'custbody_ctc_po_link_type',
        isDropShip: 'custbody_isdropshippo',
        isBypassVC: 'custbody_ctc_bypass_vc',
        subsidiary: vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES ? 'subsidiary' : null,
        overridePO: vc2_constant.FIELD.TRANSACTION.OVERRIDE_PONUM
    };

    /////////////////////////////////////////////////////////
    var MAP_REDUCE = {};

    /**
     *   Get the list of PO to process from a saved search
     */
    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join('::');
        vc2_util.logDebug(logTitle, '###### START OF SCRIPT ######');

        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var returnValue;

        try {
            ScriptParam = Helper.getParameters();

            var license = vcs_configLib.validateLicense();
            if (license.hasError) throw ERROR_MSG.INVALID_LICENSE;

            Current.MainCFG = vcs_configLib.mainConfig();
            if (!Current.MainCFG) throw ERROR_MSG.MISSING_CONFIG;

            if (!Current.MainCFG.processDropships && !Current.MainCFG.processSpecialOrders)
                throw ERROR_MSG.NO_PROCESS_DROPSHIP_SPECIALORD;

            if (!ScriptParam.searchId) throw ERROR_MSG.MISSING_ORDERSTATUS_SEARCHID;

            var searchRec = ns_search.load({ id: ScriptParam.searchId }),
                searchNew,
                searchCols = (function () {
                    var arrCols = [];
                    for (var col in PO_COLS) if (PO_COLS[col]) arrCols.push(PO_COLS[col]);
                    return arrCols;
                })();

            searchCols.push(
                ns_search.createColumn({
                    name: 'internalid',
                    join: 'vendor'
                }),
                ns_search.createColumn({
                    name: 'datecreated',
                    sort: ns_search.Sort.DESC
                })
            );

            if (ScriptParam.internalid) {
                searchNew = ns_search.create({
                    type: searchRec.searchType,
                    filters: [
                        ns_search.createFilter({ name: 'mainline', operator: 'is', values: 'T' })
                    ],
                    columns: searchCols
                });

                searchNew.filters.push(
                    ns_search.createFilter({
                        name: 'internalid',
                        operator: 'anyof',
                        values: ScriptParam.internalid
                    })
                );
            } else {
                var activeVendors = Helper.fetchActiveVendors();
                searchNew = ns_search.create({
                    type: searchRec.searchType,
                    filters: searchRec.filters,
                    columns: searchCols
                });
                searchNew.filters.push();

                var vendorFilterFormula = [];
                for (var i = 0, j = activeVendors.length; i < j; i++) {
                    if (
                        ScriptParam.vendorId &&
                        !vc2_util.inArray(ScriptParam.vendorId, activeVendors[i].vendor)
                    )
                        continue;

                    vc2_util.log(logTitle, '>> vendor Ids: ', activeVendors[i].vendor);

                    var vendorIds = activeVendors[i].vendor
                        .map(function (id) {
                            return '{vendor.internalid}=' + id;
                        })
                        .join(' OR ');

                    vendorFilterFormula.push(
                        '(' +
                            ('(' + vendorIds + ')') +
                            // ('{vendor.internalid}=' + activeVendors[i].vendor) +
                            (" AND {trandate}>='" + activeVendors[i].startDate + "')")
                    );
                }
                var vendorFormula =
                    'CASE WHEN ' + vendorFilterFormula.join(' OR ') + ' THEN 1 ELSE 0 END';

                vc2_util.log(logTitle, '... active vendor: ', {
                    activeVendors: activeVendors,
                    formula: vendorFormula
                });

                searchNew.filters.push(
                    ns_search.createFilter({
                        name: 'formulanumeric',
                        operator: ns_search.Operator.EQUALTO,
                        values: [1],
                        formula: vendorFormula
                    })
                );

                // searchNew.isPublic = true;
                // searchNew.title = 'CTC VC Reports | Open POs for Order Status';
                // // searchNew.id = searchRec.id;
                // searchNew.save();
            }

            vc2_util.log(logTitle, '// search params: ', searchNew.filters);

            returnValue = searchNew;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw vc2_util.extractError(error);
        }

        var totalResults = returnValue.runPaged().count;

        vc2_util.log(
            logTitle,
            { type: 'debug', msg: '>> Total Orders to Process: ' },
            totalResults
        );

        vc2_util.vcLog({
            title: 'VAR Connect START',
            body:
                'VAR Connect START' +
                ('\n\nTotal Orders: ' + totalResults) +
                ('\nParameters: ' + JSON.stringify(ScriptParam))
        });

        return returnValue;
    };

    MAP_REDUCE.map = function (mapContext) {
        var logTitle = [LogTitle, 'map', mapContext.key].join('::');
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        try {
            var outputObj;
            var searchResult = JSON.parse(mapContext.value);
            LogPrefix = '[purchaseorder:' + searchResult.id + '] MAP | ';
            vc2_util.LogPrefix = LogPrefix;

            var poUpdateValue = {};

            vc2_util.logDebug(logTitle, '###### START: MAP ######');

            Helper.getParameters();
            Current.poId = searchResult.id;
            for (var colName in PO_COLS) {
                var colField = PO_COLS[colName];
                Current[colName] = searchResult.values[colField];
            }
            vc2_util.log(logTitle, '..current: ', Current);

            if (vc2_util.isTrue(Current.isBypassVC)) throw ERROR_MSG.BYPASS_VARCONNECT;

            Current.MainCFG = vcs_configLib.mainConfig();
            Current.OrderCFG = vcs_configLib.loadConfig({
                poId: Current.poId,
                configType: vcs_configLib.ConfigType.ORDER
            });
            if (!Current.OrderCFG) throw ERROR_MSG.MISSING_VENDORCFG;

            /// OVERRIDE ///
            if (Current.MainCFG.overridePONum) {
                var tempPONum = Current.overridePO;
                if (tempPONum) {
                    Current.poNum = tempPONum;
                    vc2_util.log(logTitle, '**** TEMP PO NUM: ' + tempPONum + ' ****');
                }
            }

            /// ORDER STATUS ///
            outputObj = vcs_websvcLib.OrderStatus({ poNum: Current.poNum, poId: Current.poId });

            // check for errors
            if (outputObj.hasError) throw outputObj;
            else if (vc2_util.isEmpty(outputObj.Orders) || vc2_util.isEmpty(outputObj.Lines))
                throw util.extend(ERROR_MSG.NO_LINES_TO_PROCESS, {
                    details: outputObj.message || 'No lines to process'
                });
            else {
                poUpdateValue['custbody_ctc_vc_order_status'] = (outputObj.Orders || [])
                    .map(function (order) {
                        return [
                            order.VendorOrderNum,
                            order.Status || 'NA',
                            order.OrderDate || 'NA'
                        ].join(',');
                    })
                    .join('||');
            }

            vc2_util.vcLog({
                title: 'MR Order Status | Output ',
                recordId: Current.poId,
                message: vc2_util.extractError(outputObj.Lines)
            });

            // send them in one go
            vc2_util.log(logTitle, '/// Order Data: ', outputObj.Orders);
            vc2_util.serviceRequest({
                moduleName: 'processV1',
                action: 'bulkProcessOrderStatusLines',
                parameters: {
                    Orders: outputObj.Orders || [],
                    ConfigRec: outputObj.ConfigRec,
                    poId: Current.poId,
                    poNum: Current.poNum
                }
            });

            // send the orders one by one
            // (outputObj.Orders || []).forEach(function (orderNumData) {
            //     vc2_util.log(logTitle, '/// Order Data: ', orderNumData);
            //     vc2_util.serviceRequest({
            //         moduleName: 'processV1',
            //         action: 'processOrderStatusLines',
            //         parameters: util.extend(orderNumData, {
            //             ConfigRec: outputObj.ConfigRec,
            //             poId: Current.poId,
            //             poNum: Current.poNum
            //         })
            //     });
            //     // vcs_processLib.processOrderStatusLines(
            //     //     util.extend(orderNumData, {
            //     //         ConfigRec: outputObj.ConfigRec,
            //     //         poId: Current.poId,
            //     //         poNum: Current.poNum
            //     //     })
            //     // );

            //     return true;
            // });

            mapContext.write(Current.poId, util.extend(Current, { OrderData: outputObj }));
        } catch (error) {
            vc2_util.logError(logTitle, error);
            vc2_util.vcLog({
                title: 'MR Order Status | Unsuccessful',
                recordId: Current.poId,
                message: vc2_util.extractError(error),
                details: error.details,
                status: error.status || error.logStatus || LOG_STATUS.ERROR
            });

            poUpdateValue['custbody_ctc_vc_order_status'] =
                'ERROR: ' +
                error.message +
                (error.message != error.details ? ' - ' + error.details : '');
        } finally {
            ns_record.submitFields({
                type: 'purchaseorder',
                id: searchResult.id,
                values: poUpdateValue
            });

            vc2_util.logDebug(logTitle, '###### END: MAP ###### ');
        }
    };

    MAP_REDUCE.reduce = function (context) {
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var logTitle = [LogTitle, 'reduce'].join('::');
        LogPrefix = 'REDUCE [purchaseorder:' + context.key + ' ] ';
        vc2_util.LogPrefix = LogPrefix;

        try {
            vc2_util.logDebug(logTitle, '###### START: REDUCE ###### ');
            ScriptParam = Helper.getParameters();

            Current.poId = context.key;
            util.extend(Current, JSON.parse(context.values[0]));

            vc2_util.dumpLog(logTitle, Current.OrderData, '// Order Data');

            var PO_REC = vc2_record.load({
                type: 'purchaseorder',
                id: Current.poId,
                isDynamic: true
            });

            Current.isDropPO =
                PO_REC.getValue({ fieldId: 'dropshipso' }) ||
                PO_REC.getValue({
                    fieldId: 'custbody_ctc_po_link_type'
                }) == 'Drop Shipment' ||
                PO_REC.getValue({ fieldId: 'custbody_isdropshippo' });

            var updateStatus = vc_nslib.updatepo({
                mainConfig: Current.MainCFG,
                orderConfig: Current.OrderCFG,
                po_record: PO_REC,
                poNum: Current.poId,
                lineData: vc2_util.clone(Current.OrderData.Lines),
                orderData: Current.OrderData.Orders,
                isDropPO: Current.isDropPO
            });
            vc2_util.log(logTitle, '... result: ', updateStatus);

            // Add the PO LInes //

            var SO_REC = null,
                SO_DATA;

            try {
                SO_REC = ns_record.load({
                    type: ns_record.Type.SALES_ORDER,
                    id: Current.createdFrom.value
                });

                SO_DATA = vc2_record.extractValues({
                    record: SO_REC,
                    fields: ['entity']
                });
                Current.customerId = SO_REC.getValue('entity');
            } catch (so_error) {
                vc2_util.log(logTitle, '// Error loading the Sales Order');
            }
            vc2_util.log(logTitle, '... SO_DATA: ', SO_DATA);

            var fulfillmentResponse = {};
            if (Current.isDropPO) {
                fulfillmentResponse = Helper.processItemFulfillment({
                    orderLines: Current.OrderData.Lines,
                    poRec: PO_REC,
                    soRec: SO_REC
                });
            } else {
                fulfillmentResponse = Helper.processItemReceipt({
                    orderLines: Current.OrderData.Lines,
                    poRec: PO_REC,
                    soRec: SO_REC
                });
            }
            vc2_util.log(logTitle, '## fulfillmentResponse: ', fulfillmentResponse);

            // update the order status

            vc2_util.log(logTitle, '..settings:  ', {
                isDropPO: Current.isDropPO,
                dropShip: Current.MainCFG.createSerialDropship,
                specialOrder: Current.MainCFG.createSerialSpecialOrder
            });

            if (
                (Current.isDropPO && Current.MainCFG.createSerialDropship) ||
                (!Current.isDropPO && Current.MainCFG.createSerialSpecialOrder)
            ) {
                Current.NumPrefix = Current.OrderCFG.fulfillmentPrefix;
                // matched vendor lines
                vc2_util.log(logTitle, '>> line items: ', Current.outputItems);

                // look for serial nums for all the order num
                var orderNumSerials = Helper.serialNumsPerOrderNum({
                    vendorLines: Current.OrderData.Lines
                });

                vc2_util.log(logTitle, '>> serial nums: ', orderNumSerials);
                var itemAltNameColId =
                        Current.OrderCFG.itemColumnIdToMatch || Current.MainCFG.itemColumnIdToMatch,
                    itemAltMPNColId =
                        Current.OrderCFG.itemMPNColumnIdToMatch ||
                        Current.MainCFG.itemMPNColumnIdToMatch,
                    poColumns = [
                        'item',
                        'quantity',
                        'rate',
                        'amount',
                        vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                        vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                        vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY
                    ];
                if (itemAltNameColId) poColumns.push(itemAltNameColId);
                if (itemAltMPNColId) poColumns.push(itemAltMPNColId);

                // try to extract the items from the POs
                var arrOrderLines = vc2_record.extractRecordLines({
                    mainConfig: Current.MainCFG,
                    orderConfig: Current.OrderCFG,
                    record: PO_REC,
                    findAll: true,
                    columns: poColumns
                });
                // vc2_util.log(logTitle, '>> arrOrderLines: ', arrOrderLines);

                // get matched order line for each

                Current.OrderData.Lines.forEach(function (vendorLine) {
                    var matchedOrderLine = vc2_record.findMatchingOrderLine({
                        mainConfig: Current.MainCFG,
                        orderConfig: Current.OrderCFG,
                        vendorLine: vendorLine,
                        orderLines: arrOrderLines
                    });
                    var arrSerial =
                        vendorLine.serial_num && vendorLine.serial_num !== 'NA'
                            ? vendorLine.serial_num.split(/,/g)
                            : false;
                    var fulfillData = orderNumSerials[vendorLine.vendorOrderNum];
                    vc2_util.log(logTitle, ' **** orderNumSerials:', fulfillData);
                    if (fulfillData && fulfillData.length) fulfillData = fulfillData[0];
                    vc2_util.log(logTitle, ' **** orderNumSerials:', fulfillData);

                    // if (!matchedOrderLine) return;
                    if (!arrSerial) return;

                    Helper.processSerials({
                        serials: arrSerial,
                        ITEM: matchedOrderLine ? matchedOrderLine.item : null,
                        CUSTOMER: SO_DATA.entity,
                        PURCHASE_ORDER: Current.poId,
                        SALES_ORDER: Current.createdFrom.value,
                        ITEM_FULFILLMENT:
                            fulfillData && fulfillData.type == 'fulfillment'
                                ? fulfillData.id
                                : null,
                        ITEM_RECEIPT:
                            fulfillData && fulfillData.type == 'itemreceipt' ? fulfillData.id : null
                    });

                    return true;
                });
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);
            vc2_util.vcLog({
                title: 'MR Order Status | Unsuccessful',
                recordId: Current.poId,
                message: vc2_util.extractError(error),
                details: error.details,
                status: error.status || error.logStatus || LOG_STATUS.ERROR
            });
        } finally {
            vc2_util.logDebug(logTitle, '###### END: REDUCE ###### ');
        }
    };

    MAP_REDUCE.summarize = function (summary) {
        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        //any errors that happen in the above methods are thrown here so they should be handled
        //log stuff that we care about, like number of serial numbers
        var logTitle = [LogTitle, 'summarize'].join('::');

        vc2_util.logDebug(logTitle, '###### START: SUMMARY ###### ');

        summary.reduceSummary.errors.iterator().each(function (key, error) {
            vc2_util.logError(logTitle, [key, error]);
            return true;
        });
        var reduceKeys = [];
        summary.reduceSummary.keys.iterator().each(function (key) {
            reduceKeys.push(key);
            return true;
        });
        vc2_util.log(logTitle, 'REDUCE keys processed', reduceKeys);

        vc2_util.log(logTitle, '**** SUMMARY ****', {
            'Total Usage': summary.usage,
            'No of Queues': summary.concurrency,
            'Total Time (sec)': summary.seconds,
            Yields: summary.yields
        });

        vc2_util.vcLog({
            title: 'VAR Connect END',
            message:
                'VAR Connect END' +
                ('\n\nTotal Usage: ' + summary.usage) +
                ('\nTotal Time (sec): ' + summary.seconds)
        });

        vc2_util.logDebug(logTitle, '###### END OF SCRIPT ###### ');
    };

    var Helper = {
        getParameters: function () {
            var logTitle = [LogTitle, 'getParameters'].join('::');
            var currentScript = ns_runtime.getCurrentScript();

            ScriptParam = {
                searchId: currentScript.getParameter('custscript_orderstatus_searchid'),
                vendorId: currentScript.getParameter('custscript_orderstatus_vendorid'),
                internalid: currentScript.getParameter('custscript_orderstatus_orderid'),
                use_fulfill_rl: currentScript.getParameter('custscript_orderstatus_restletif')
            };
            vc2_util.log(logTitle, { type: 'debug', msg: '/// Params ' }, ScriptParam);

            return ScriptParam;
        },
        fetchActiveVendors: function () {
            var logTitle = [LogTitle, 'fetchActiveVendors'].join('::');

            var objVendorSearch = ns_search.create({
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [['isinactive', 'is', 'F']],
                columns: [
                    'custrecord_ctc_vc_vendor',
                    'custrecord_ctc_vc_vendor_start',
                    'custrecord_ctc_vc_xml_vendor'
                ]
            });

            var arrVendors = [];
            objVendorSearch.run().each(function (result) {
                var vendorList = result.getValue({
                        name: 'custrecord_ctc_vc_vendor'
                    }),
                    startDate = result.getValue({
                        name: 'custrecord_ctc_vc_vendor_start'
                    });

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                }

                return true;
            });

            return arrVendors;
        },
        processItemFulfillment: function (option) {
            var logTitle = [LogTitle, 'processItemFulfillment'].join('::'),
                fulfillmentData,
                returnValue;

            try {
                Current.allowItemFF =
                    Current.MainCFG.processDropships &&
                    Current.OrderCFG.processDropships &&
                    Current.MainCFG.createIF;

                if (!Current.allowItemFF) throw ERROR_MSG.FULFILLMENT_NOT_ENABLED;

                // look for the SALES ORDER
                if (!option.soRec) throw ERROR_MSG.MISSING_SALESORDER;

                // // check if the PO is fulfillable
                var poValues = vc2_record.extractValues({
                    record: option.poRec,
                    fields: ['orderstatus', 'status', 'statusRef']
                });
                vc2_util.log(logTitle, '... poValues: ', poValues);

                // if (vc2_util.inArray(poValues.statusRef.toLowerCase(), ['closed', 'fullybilled']))
                //     throw ERROR_MSG.PO_CLOSED;

                // if (vc2_util.inArray(poValues.statusRef.toLowerCase(), ['pendingbilling']))
                //     throw ERROR_MSG.PO_FULLYFULFILLED;

                fulfillmentData = vc_itemfflib.updateItemFulfillments({
                    mainConfig: Current.MainCFG,
                    orderConfig: Current.OrderCFG,
                    poId: Current.poId,
                    lineData: option.lineData || option.orderLines,
                    vendor: Current.vendor,
                    recSalesOrd: option.soRec,
                    recPurchOrd: option.poRec
                });

                vc2_util.log(logTitle, '// fulfillmentData:', fulfillmentData);
                returnValue = fulfillmentData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                vc2_util.vcLog({
                    title: 'Fulfillment Creation | Error',
                    error: error,
                    recordId: Current.poId
                });
                returnValue = error;

                // Update the Order Status Records
                Helper.updateOrderNumNotes({
                    poRec: option.poRec,
                    poId: Current.poId,
                    orderLines: option.lineData || option.orderLines,
                    notes: error.message
                });
            }

            return returnValue;
        },
        processItemReceipt: function (option) {
            var logTitle = [LogTitle, 'processItemReceipt'].join('::'),
                receiptData,
                returnValue;

            try {
                Current.allowItemRcpt =
                    Current.MainCFG.processSpecialOrders &&
                    Current.OrderCFG.processSpecialOrders &&
                    Current.MainCFG.createIR;

                if (!Current.allowItemRcpt) throw ERROR_MSG.ITEMRECEIPT_NOT_ENABLED;
                if (!option.soRec) throw ERROR_MSG.MISSING_SALESORDER;

                // // check if the PO is fulfillable
                // var poValues = vc2_record.extractValues({
                //     record: option.poRec,
                //     fields: ['orderstatus', 'status', 'statusRef']
                // });
                // vc2_util.log(logTitle, '... poValues: ', poValues);

                // if (vc2_util.inArray(poValues.statusRef.toLowerCase(), ['closed', 'fullybilled']))
                //     throw ERROR_MSG.PO_CLOSED;

                // if (vc2_util.inArray(poValues.statusRef.toLowerCase(), ['pendingbilling']))
                //     throw ERROR_MSG.PO_FULLYFULFILLED;

                receiptData = vc_itemrcpt.updateIR({
                    mainConfig: Current.MainCFG,
                    orderConfig: Current.OrderCFG,
                    poId: Current.poId,
                    lineData: option.lineData || option.orderLines,
                    vendor: Current.vendor
                });
                returnValue = receiptData;

                vc2_util.log(logTitle, '// receiptData:', receiptData);
            } catch (error) {
                vc2_util.logError(logTitle, error);

                vc2_util.vcLog({
                    title: 'Item Receipt Creation | Error',
                    error: error,
                    transaction: Current.poId
                });

                // Update the Order Status Records
                Helper.updateOrderNumNotes({
                    poRec: option.poRec,
                    poId: Current.poId,
                    orderLines: option.lineData || option.orderLines,
                    notes: error.message
                });

                returnValue = error;
            }

            return returnValue;
        },
        updateOrderNumNotes: function (option) {
            var logTitle = [LogTitle, 'updateOrderStatus'].join('::'),
                returnValue;

            try {
                var poRec = option.poRec,
                    poId = option.poId,
                    orderLines = option.orderLines,
                    orderNumNotes = option.notes;

                // either poRec or poId is required
                if (!poRec && !poId) throw 'Missing PO Record or PO ID';
                // orderLines and orderNumNotes are required
                if (!orderLines || !orderNumNotes) throw 'Missing Order Lines or Order Notes';

                // group the order lines by order number
                var orderNumLines = {};
                orderLines.forEach(function (line) {
                    if (!orderNumLines[line.order_num]) orderNumLines[line.order_num] = [];
                    orderNumLines[line.order_num].push(line);
                    return true;
                });

                // loop thru the order numbers
                for (var orderNum in orderNumLines) {
                    vcs_processLib.updateOrderNum({
                        vendorNum: orderNum,
                        poId: poId || poRec.id,
                        orderNumValues: {
                            NOTE: orderNumNotes,
                            DETAILS: ' '
                        }
                    });
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = error;
            }

            return returnValue;
        },
        serialNumsPerOrderNum: function (option) {
            var logTitle = [LogTitle, 'serialNumsPerOrderNum'].join('::'),
                returnValue;

            try {
                var arrVendorLines = option.vendorLines;
                if (!arrVendorLines || !arrVendorLines.length) return false;
                var orderNumSerials = {}, //{fulfillments: [], itemreciepts: []},
                    arrFulfillments = Helper.fetchFulfillments(),
                    arrReceipts = Helper.fetchReceipts();

                // loop thru the vendor lines
                arrVendorLines.forEach(function (vendorLine) {
                    var serialArray =
                        vendorLine.serial_num && util.isString(vendorLine.serial_num)
                            ? vendorLine.serial_num !== 'NA'
                                ? vendorLine.serial_num.split(/,/gi)
                                : false
                            : false;
                    if (!serialArray) return;
                    var vendorOrderMatch = Current.NumPrefix + vendorLine.order_num;

                    if (arrFulfillments[vendorOrderMatch]) {
                        if (!orderNumSerials[vendorOrderMatch])
                            orderNumSerials[vendorOrderMatch] = [];

                        orderNumSerials[vendorOrderMatch].push(
                            util.extend(arrFulfillments[vendorOrderMatch], { serials: serialArray })
                        );
                    }

                    if (arrReceipts[vendorOrderMatch]) {
                        if (!orderNumSerials[vendorOrderMatch])
                            orderNumSerials[vendorOrderMatch] = [];

                        orderNumSerials[vendorOrderMatch].push(
                            util.extend(arrReceipts[vendorOrderMatch], { serials: serialArray })
                        );
                    }

                    vc2_util.log(logTitle, '** order serials: ', {
                        orderNum: vendorOrderMatch,
                        list: orderNumSerials[vendorOrderMatch]
                    });

                    return true;
                });

                returnValue = orderNumSerials;
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        processSerials: function (option) {
            var logTitle = [LogTitle, 'Helper.processSerial'].join('::'),
                returnValue,
                SERIAL_REC = vc2_constant.RECORD.SERIALS;

            try {
                var recordValues = {},
                    arrSearchCols = ['internalid', 'name'],
                    arrSerialFilters = [],
                    arrSerials = option.serials;

                if (vc2_util.isEmpty(arrSerials)) return false;

                // make the list unique
                arrSerials = vc2_util.uniqueArray(arrSerials);
                vc2_util.log(logTitle, '// Total serials: ', arrSerials.length);

                if (arrSerials.length > 250) {
                    var arrSerialsChunks = Helper.sliceArrayIntoChunks(arrSerials, 250);

                    arrSerialsChunks.forEach(function (chunkSerials) {
                        var chunkOption = option;
                        chunkOption.serials = chunkSerials;

                        vc2_util.serviceRequest({
                            moduleName: 'processV1',
                            action: 'processSerials',
                            parameters: chunkOption
                        });
                    });
                } else {
                    vcs_processLib.processSerials(option);
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return true;
        },
        sliceArrayIntoChunks: function (array, chunkSize) {
            var chunks = [];
            for (var i = 0; i < array.length; i += chunkSize) {
                var chunk = array.slice(i, i + chunkSize);
                chunks.push(chunk);
            }
            return chunks;
        },
        fetchFulfillments: function (option) {
            var logTitle = [LogTitle, 'fetchFulfillments'].join('::'),
                returnValue;

            try {
                //search for the fulfillments with same prefix
                var searchObj = ns_search.create({
                    type: 'itemfulfillment',
                    filters: [
                        ['custbody_ctc_if_vendor_order_match', 'STARTSWITH', Current.NumPrefix],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['internalid', 'tranid', 'custbody_ctc_if_vendor_order_match']
                });
                vc2_util.log(logTitle, '.. search filters: ', searchObj.filters);

                var arrResults = vc2_util.searchAllPaged({ searchObj: searchObj });

                var itemFFResults = {};

                arrResults.forEach(function (result) {
                    var vendorOrder = result.getValue({
                            name: 'custbody_ctc_if_vendor_order_match'
                        }),
                        tranId = result.getValue({ name: 'tranid' });

                    itemFFResults[vendorOrder] = {
                        id: result.id,
                        name: tranId,
                        type: 'fulfillment'
                    };
                    return true;
                });
                returnValue = itemFFResults;
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }
            return returnValue;
        },
        fetchReceipts: function (option) {
            var logTitle = [LogTitle, 'fetchReceipts'].join('::'),
                returnValue;

            try {
                //search for the fulfillments with same prefix
                var searchObj = ns_search.create({
                    type: 'itemreceipt',
                    filters: [
                        ['custbody_ctc_if_vendor_order_match', 'STARTSWITH', Current.NumPrefix],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['internalid', 'tranid', 'custbody_ctc_if_vendor_order_match']
                });
                vc2_util.log(logTitle, '.. search filters: ', searchObj.filters);

                var arrResults = vc2_util.searchAllPaged({ searchObj: searchObj });

                var itemResults = {};

                arrResults.forEach(function (result) {
                    var vendorOrder = result.getValue({
                            name: 'custbody_ctc_if_vendor_order_match'
                        }),
                        tranId = result.getValue({ name: 'tranid' });

                    itemResults[vendorOrder] = { id: result.id, name: tranId, type: 'itemreceipt' };
                    return true;
                });
                returnValue = itemResults;
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }
            return returnValue;
        },
        processPOLines: function (option) {
            var logTitle = [LogTitle, 'processPOLines'].join('::'),
                returnValue;

            var poRec = option.record,
                vendorLines = option.vendorLines,
                orderData = option.orderData;

            if (vc2_util.isEmpty(poRec)) throw 'Record is required';
            if (vc2_util.isEmpty(vendorLines)) throw 'Vendor Lines is required';
            if (vc2_util.isEmpty(orderData)) throw 'Missing Order Data';

            var PO_LINES = vc2_record.extractRecordLines({
                record: poRec,
                findAll: true,
                columns: [
                    'line',
                    'linenumber',
                    'item',
                    'rate',
                    'quantity',
                    'amount',
                    'quantityreceived',
                    'quantitybilled'
                ],
                orderConfig: Current.OrderCFG,
                mainConfig: Current.MainCFG
            });

            (vendorLines || []).forEach(function (vendorLine) {
                util.extend(billfileLine, {
                    quantity: billfileLine.QUANTITY,
                    itemId: (billfileLine.NSITEM || '').toString(),
                    rate: billfileLine.BILLRATE || billfileLine.PRICE,

                    item: (billfileLine.NSITEM || '').toString(),
                    itemName: billfileLine.ITEMNO,
                    description: billfileLine.DESCRIPTION,
                    quantity: billfileLine.QUANTITY
                });
            });

            // {
            //     line_num: "001",
            //     item_num: "SFP-10G-LR=",
            //     item_num_alt: "06UR72",
            //     vendorSKU: "06UR72",
            //     line_status: "Shipped",
            //     order_date: "NA",
            //     order_status: "Shipped",
            //     ship_qty: 1,
            //     line_no: 1,
            //     ship_date: "NA",
            //     order_eta: "NA",
            //     carrier: "NA",
            //     order_eta_ship: "NA",
            //     eta_delivery_date: "NA",
            //     serial_num: "NA",
            //     tracking_num: "NA",
            //     order_num: "60-FJY15-31",
            //     is_shipped: true
            //  }

            vc2_util.dumpLog(logTitle, PO_LINES, '// PO Lines');
        }
    };

    return MAP_REDUCE;
});
