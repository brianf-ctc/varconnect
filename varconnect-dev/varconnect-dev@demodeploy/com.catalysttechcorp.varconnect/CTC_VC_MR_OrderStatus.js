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

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/https',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Record',
    './CTC_VC_Lib_Fulfillment',
    './CTC_VC_Lib_ItemReceipt',
    './CTC_VC_Lib_Record.js',
    './CTC_VC_Lib_WebService',
    './Services/ctc_svclib_configlib.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    ns_https,
    vc2_util,
    vc2_constant,
    vc2_record,
    vc_itemfflib,
    vc_itemrcpt,
    vc_nslib,
    vc_websvclib,
    vcs_configLib
) {
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

        var outputObj;
        var searchResult = JSON.parse(mapContext.value);
        LogPrefix = '[purchaseorder:' + searchResult.id + '] MAP | ';
        vc2_util.LogPrefix = LogPrefix;
        try {
            vc2_util.logDebug(logTitle, '###### START: MAP ######');

            Helper.getParameters();
            Current.poId = searchResult.id;
            for (var colName in PO_COLS) {
                var colField = PO_COLS[colName];
                Current[colName] = searchResult.values[colField];
            }
            vc2_util.log(logTitle, '..current: ', Current);

            if (Current.isBypassVC == 'T' || Current.isBypassVC === true)
                throw ERROR_MSG.BYPASS_VARCONNECT;

            Current.MainCFG = vcs_configLib.mainConfig();
            Current.OrderCFG = vcs_configLib.orderVendorConfig({ poId: Current.poId });

            if (!Current.OrderCFG) throw ERROR_MSG.MISSING_VENDORCFG;

            /// OVERRIDE ///
            if (Current.MainCFG.overridePONum) {
                var tempPONum = Current.overridePO;
                if (tempPONum) {
                    Current.poNum = tempPONum;
                    vc2_util.log(logTitle, '**** TEMP PO NUM: ' + tempPONum + ' ****');
                }
            }
            /// ========== ///

            // looup the country
            var countryCode = Current.OrderCFG.countryCode;
            var PO_REC = ns_record.load({
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

            ////////////////////////////////////////////////
            vc2_util.log(logTitle, '///// Initiating library webservice ....');

            outputObj = vc_websvclib.process({
                mainConfig: Current.MainCFG,
                orderConfig: Current.OrderCFG,
                vendor: Current.vendorId.value,
                poId: Current.poId,
                poNum: Current.poNum,
                tranDate: Current.tranDate,
                subsidiary: Current.subsidiary.value,
                countryCode: countryCode
            });

            vc2_util.log(logTitle, '...  vendor data: ', outputObj);
            ////////////////////////////////////////////////

            ////////////////////////////////////////////////
            // if there are no lines.. just exit the script
            if (
                !outputObj.itemArray ||
                (!outputObj.itemArray.length && !outputObj.itemArray.header_info)
            ) {
                throw outputObj.isError && outputObj.errorMessage
                    ? { message: outputObj.errorMessage, logStatus: LOG_STATUS.WS_ERROR }
                    : util.extend(ERROR_MSG.NO_LINES_TO_PROCESS, {
                          details: outputObj
                      });
            }

            // vc2_util.log(logTitle, '** CURRENT **', Current);
            mapContext.write(Current.poId, util.extend(Current, { outputItems: outputObj }));
        } catch (error) {
            vc2_util.logError(logTitle, error);

            vc2_util.vcLog({
                title: 'MR Order Status | Error',
                error: error,
                recordId: Current.poId,
                status: LOG_STATUS.ERROR
            });
        } finally {
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

            vc2_util.log(logTitle, '>>> PO Lines: ', Current.outputItems);
            var PO_REC = ns_record.load({
                type: 'purchaseorder',
                id: Current.poId,
                isDynamic: true
            });

            var updateStatus = vc_nslib.updatepo({
                po_record: PO_REC,
                poNum: Current.poId,
                lineData: vc2_util.clone(Current.outputItems.itemArray),
                mainConfig: Current.MainCFG,
                orderConfig: Current.OrderCFG,
                isDropPO: Current.isDropPO
            });
            vc2_util.log(logTitle, '... result: ', updateStatus);

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

            if (Current.isDropPO) {
                Helper.processItemFulfillment({
                    orderLines: Current.outputItems.itemArray,
                    poRec: PO_REC,
                    soRec: SO_REC
                });
            } else {
                Helper.processItemReceipt({
                    orderLines: Current.outputItems.itemArray,
                    poRec: PO_REC,
                    soRec: SO_REC
                });
            }

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
                    vendorLines: Current.outputItems.itemArray
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
                Current.outputItems.itemArray.forEach(function (vendorLine) {
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

    // var ERROR_MSG = {
    //     ORDER_EXISTS: 'Order already exists',
    //     NO_LINES_TO_FULFILL: 'No lines to fulfill'
    // };

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
        getUsage: function () {
            Current.REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[rem:' + Current.REMUSAGE + ']';
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

                // vc2_util.log(logTitle, '.. vendor/start date', [vendorList, startDate]);

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                    // arrVendors = arrVendors.concat(vendorList);
                }

                return true;
            });

            // vc2_util.log(logTitle, '... vendor list', arrVendors);

            return arrVendors;
        },
        getSubsidiary: function (poId) {
            var logTitle = [LogTitle, 'getSubsidiary'].join('::');

            var subsidiary = null;

            vc2_util.log(logTitle, '.. po id', poId);

            if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES) {
                var lookupObj = ns_search.lookupFields({
                    type: ns_search.Type.TRANSACTION,
                    id: poId,
                    columns: 'subsidiary'
                });
                subsidiary = lookupObj.subsidiary[0].value;
            }

            return subsidiary;
        },
        validateDate: function (option) {
            var logTitle = [LogTitle, 'validateDate'].join('::'),
                logPrefix = LogPrefix + ' validateDate || ',
                returnValue;
            option = option || {};

            try {
                if (!Current.poId) throw ERROR_MSG.MISSING_PO;
                if (!Current.OrderCFG) throw ERROR_MSG.MISSING_VENDORCFG;

                var searchObj = ns_search.load({ id: ScriptParam.searchId });

                searchObj.filters.push(
                    ns_search.createFilter({
                        name: 'internalid',
                        operator: ns_search.Operator.IS,
                        values: Current.poId
                    })
                );
                searchObj.filters.push(
                    ns_search.createFilter({
                        name: 'trandate',
                        operator: ns_search.Operator.ONORAFTER,
                        values: Current.OrderCFG.startDate
                    })
                );

                returnValue = !!searchObj.runPaged().count;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
                throw vc2_util.extractError(error);
            } finally {
                vc2_util.log(logTitle, '.. returnvalue: ', returnValue);
            }

            return returnValue;
        },
        sortByOrderNum: function (orderLines) {
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

            orderLines.sort(
                sort_by('order_num', false, function (a) {
                    return a.toUpperCase();
                })
            );

            return orderLines;
        },
        searchExistingIFs: function (option) {
            var logTitle = [LogTitle, 'searchExistingIFs'].join('::'),
                logPrefix = LogPrefix + ' searchExistingIFs || ',
                returnValue;
            option = option || {};

            try {
                var listOrderNum = option.vendorOrderNums || option.orderNums;
                if (vc2_util.isEmpty(listOrderNum)) return false;

                var searchOption = {
                    type: 'itemfulfillment',
                    filters: [['type', 'anyof', 'ItemShip'], 'AND', ['mainline', 'is', 'T']],
                    columns: [
                        'mainline',
                        'internalid',
                        'trandate',
                        'tranid',
                        'entity',
                        'custbody_ctc_if_vendor_order_match'
                    ]
                };

                searchOption.filters.push('AND');
                var orderNumFilter = [];
                listOrderNum.forEach(function (orderNum) {
                    if (orderNumFilter.length) orderNumFilter.push('OR');
                    orderNumFilter.push([
                        'custbody_ctc_if_vendor_order_match',
                        ns_search.Operator.IS,
                        orderNum
                    ]);
                    return true;
                });
                searchOption.filters.push(orderNumFilter);

                vc2_util.log(logTitle, '.. searchOption', searchOption);

                var arrResults = [];
                var searchResults = vc2_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                searchResults.forEach(function (result) {
                    var orderNum = result.getValue({
                        name: 'custbody_ctc_if_vendor_order_match'
                    });
                    if (!vc2_util.inArray(orderNum, arrResults)) arrResults.push(orderNum);
                    return true;
                });

                returnValue = arrResults;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
                throw Helper.extractError(error);
            }

            return returnValue;
        },
        processItemFulfillment_restlet: function (option) {
            var logTitle = [LogTitle, 'processItemFulfillment_restlet'].join('::'),
                returnValue;

            try {
                vc2_util.logDebug(logTitle, '**** FULFILLMENT PROCESSING: RESTLET ***** ');

                if (!Helper.validateDate()) throw 'Invalid PO Date';
                var OrderLines = option.orderLines;

                var numPrefix = Current.OrderCFG.fulfillmentPrefix;
                if (!numPrefix) throw 'Config Error: Missing Fulfillment Prefix';

                OrderLines = Helper.sortByOrderNum(OrderLines);

                // find unique orders
                var arrOrderNums = [],
                    arrVendorOrderNums = [],
                    i,
                    ii;
                for (i = 0; i < OrderLines.length; i++) {
                    vc2_util.log(
                        logTitle,
                        '... processing ' + '[' + OrderLines[i].order_num + '] .....'
                    );

                    if (vc2_util.inArray(OrderLines[i].order_num, arrOrderNums)) {
                        continue;
                    }

                    if (!OrderLines[i].order_num || OrderLines[i].order_num == 'NA') {
                        vc2_util.log(logTitle, '......skipped: no item order num');
                        continue;
                    }

                    if (
                        OrderLines[i].hasOwnProperty('is_shipped') &&
                        OrderLines[i].is_shipped === false
                    ) {
                        vc2_util.log(logTitle, '......skipped: not yet shipped');
                        continue;
                    }

                    if (OrderLines[i].hasOwnProperty('ns_record') && OrderLines[i].ns_record) {
                        vc2_util.log(logTitle, '......skipped: fulfillment already exists.');
                        continue;
                    }

                    OrderLines[i].ship_qty = parseInt(OrderLines[i].ship_qty || '0', 10);
                    OrderLines[i].vendorOrderNum = numPrefix + OrderLines[i].order_num;

                    arrOrderNums.push(OrderLines[i].order_num);
                    arrVendorOrderNums.push(OrderLines[i].vendorOrderNum);
                }

                vc2_util.log(logTitle, '/// OrderNums: ', [arrOrderNums, arrVendorOrderNums]);

                var arrExistingIFS = Helper.searchExistingIFs({
                    orderNums: arrVendorOrderNums
                });

                vc2_util.log(logTitle, '... arrExistingIFS: ');

                /// run through all the ordernums
                for (i = 0; i < arrOrderNums.length; i++) {
                    var orderNum = arrOrderNums[i],
                        vendorOrderNum = numPrefix + orderNum;

                    var logPrefix = LogPrefix + ' [' + vendorOrderNum + ']  ';

                    vc2_util.log(logTitle, logPrefix + '***** Processing order', vendorOrderNum);

                    try {
                        if (vc2_util.inArray(vendorOrderNum, arrExistingIFS)) throw 'ORDER_EXISTS';

                        // get the lineData;
                        var fulfillLine = [];
                        for (ii = 0; ii < OrderLines.length; ii++) {
                            if (orderNum != OrderLines[ii].order_num) continue;
                            fulfillLine.push(OrderLines[ii]);
                        }

                        if (vc2_util.isEmpty(fulfillLine)) throw 'NO_LINES_TO_FULFILL';

                        vc2_util.log(logTitle, logPrefix + '// sending lines... ', fulfillLine);

                        /////////////////////////////////////////
                        // CREATE ITEM FULFILLMENT
                        var itemffResponse = ns_https.requestRestlet({
                            headers: { 'Content-Type': 'application/json' },
                            scriptId: 'customscript_ctc_vc_rl_itemff',
                            deploymentId: 'customdeploy_ctc_vc_rl_itemff',
                            method: 'POST',
                            body: JSON.stringify({
                                poId: Current.poId,
                                soId: Current.soId,
                                orderLine: fulfillLine
                            })
                        });

                        var respBody = JSON.parse(itemffResponse.body);
                        vc2_util.log(logTitle, logPrefix + '>> responseBody: ', respBody);

                        for (var noteId in respBody) {
                            var respdata = respBody[noteId];

                            if (respdata.msg) {
                                vc2_util.vcLog({
                                    title: 'Fulfillment Creation | Notes',
                                    message:
                                        noteId +
                                        ' - ' +
                                        (util.isArray(respdata.msg)
                                            ? respdata.msg.join('\r\n')
                                            : respdata.msg),
                                    recordId: Current.poId
                                });
                            }
                            if (respdata.error) {
                                vc2_util.vcLog({
                                    title: 'Fulfillment Creation | Error',
                                    message:
                                        noteId + ' - ' + util.isArray(respdata.error)
                                            ? respdata.error.join('\r\n')
                                            : respdata.error,
                                    recordId: Current.poId
                                });
                            }
                        }

                        /////////////////////////////////////////
                    } catch (order_error) {
                        var orderMsg = vc2_util.extractError(order_error);

                        if (ERROR_MSG[orderMsg]) {
                            vc2_util.log(logTitle, logPrefix + '//Skipped: ', ERROR_MSG[orderMsg]);
                        } else {
                            // unknown error, must report
                            throw order_error;
                        }

                        continue;
                    }
                }
            } catch (error) {
                vc2_util.logError(logTitle, error);

                vc2_util.vcLog({
                    title: 'Fulfillment Creation | Error',
                    error: error,
                    recordId: Current.poId
                });
            }

            return returnValue;
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

                for (var fld in SERIAL_REC.FIELD) {
                    if (option[fld] == null) continue;
                    recordValues[SERIAL_REC.FIELD[fld]] = option[fld];
                    arrSearchCols.push(SERIAL_REC.FIELD[fld]);
                }
                vc2_util.log(logTitle, '>> record data: ', recordValues);

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

                // update the existing serials
                var arrUpdatedSerial = [],
                    arrAddedSerial = [],
                    arrProcessedSerial = [];

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
                // vc2_util.log(logTitle, '...updated serials: ', arrUpdatedSerial);

                // add the remaining
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
                // vc2_util.log(logTitle, '...added serials: ', arrAddedSerial);
                vc2_util.log(logTitle, '...total processed serials: ', {
                    recordValues: recordValues,
                    processed: arrProcessedSerial.length,
                    added: arrAddedSerial.length,
                    updated: arrUpdatedSerial.length
                });
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return true;
        },

        processSerialXX: function (option) {
            var logTitle = 'helper.processSerial';

            var serial = option.serial;
            var currentData = option.currentData;

            if (vc2_util.isEmpty(serial)) {
                vc2_util.vcLog({
                    title: logTitle + ' | Error',
                    error: 'Empty Serial',
                    transaction: currentData.poId || ''
                });
                return;
            }

            //search for serial
            var objSerialSearch = ns_search.create({
                type: 'customrecordserialnum',
                filters: [['name', 'is', serial], 'AND', ['isinactive', 'is', 'F']],
                columns: [
                    ns_search.createColumn({
                        name: 'internalid',
                        sort: ns_search.Sort.DESC
                    })
                ]
            });

            //range search
            var resultSet = objSerialSearch.run();
            var arrResult = resultSet.getRange({ start: 0, end: 1 });

            /** ===== remove null values ===== **/
            var serialValues = vc2_util.removeNullValues({
                name: serial,
                custrecordserialpurchase: currentData.poId || null,
                custrecordserialitem: currentData.itemId || null,
                custrecordserialsales: currentData.soId || null,
                custrecorditemfulfillment: currentData.orderNum || null,
                custrecorditemreceipt: currentData.receiptNum || null,
                custrecordcustomer: currentData.customerId
            });
            vc2_util.logDebug(logTitle, '... serialValues: ', serialValues);

            /** ===== update serial ===== **/
            if (Array.isArray(arrResult) && typeof arrResult[0] !== 'undefined') {
                vc2_util.logDebug(logTitle, ' >> Matching serial found : ', arrResult);

                ns_record.submitFields({
                    type: 'customrecordserialnum',
                    id: arrResult[0].getValue('internalid'),
                    values: serialValues,
                    options: { enablesourcing: true }
                });
            } else {
                /** ===== create serial ===== **/
                var recordSerial = ns_record.create({ type: 'customrecordserialnum' });
                for (var fld in serialValues) {
                    recordSerial.setValue({
                        fieldId: fld,
                        value: serialValues[fld]
                    });
                }
                var serialId = recordSerial.save();
                vc2_util.logDebug(logTitle, '>> New Serial ID: ', serialId);
            }
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
        }
    };

    return MAP_REDUCE;
});
