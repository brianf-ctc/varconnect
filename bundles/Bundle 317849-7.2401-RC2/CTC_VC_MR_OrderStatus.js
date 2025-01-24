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

    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_WebService',

    './CTC_VC_Lib_LicenseValidator'
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
    vc_maincfg,
    vc_vendorcfg,
    vc_websvclib,
    vc_license
) {
    var LogTitle = 'MR_OrderStatus',
        VCLOG_APPNAME = 'VAR Connect | OrderStatus';
    var LogPrefix = '';
    var Params = {},
        Current = {};

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

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
            Params = {
                searchId: ns_runtime.getCurrentScript().getParameter('custscript_searchid2'),
                vendorId: ns_runtime.getCurrentScript().getParameter('custscript_vendor2'),
                internalid: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_orderstatus_tranid'),
                use_fulfill_rl: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_fulfillcreate_restlet')
            };
            vc2_util.log(logTitle, { type: 'debug', msg: '/// Params ' }, Params);

            Current.MainCFG = Helper.loadMainConfig();
            // vc2_util.log(logTitle, { type: 'debug', msg: '.... Main Config ' }, Current.MainCFG);

            Helper.validateLicense({ mainConfig: Current.MainCFG });

            if (!Current.MainCFG.processDropships && !Current.MainCFG.processSpecialOrders)
                throw ERROR_MSG.NO_PROCESS_DROPSHIP_SPECIALORD;

            if (!Params.searchId) throw ERROR_MSG.MISSING_ORDERSTATUS_SEARCHID;

            var searchRec = ns_search.load({ id: Params.searchId }),
                searchNew;

            if (Params.internalid) {
                searchNew = ns_search.create({
                    type: searchRec.searchType,
                    filters: searchRec.filters,
                    columns: searchRec.columns
                });

                searchNew.filters.push(
                    ns_search.createFilter({
                        name: 'internalid',
                        operator: 'anyof',
                        values: Params.internalid
                    })
                );

                // add the override column
                searchNew.columns.push(
                    ns_search.createColumn({
                        name: vc2_constant.FIELD.TRANSACTION.OVERRIDE_PONUM
                    })
                );
                // add the override column
                searchNew.columns.push(
                    ns_search.createColumn({
                        name: 'custbody_ctc_bypass_vc'
                    })
                );
            } else {
                var activeVendors = Helper.fetchActiveVendors();
                var searchOption = {
                    type: 'purchaseorder',
                    filters: [
                        ['mainline', 'is', 'T'],
                        'AND',
                        ['type', 'anyof', 'PurchOrd'],
                        'AND',
                        [
                            'status',
                            'noneof',
                            'PurchOrd:C',
                            'PurchOrd:G',
                            'PurchOrd:H',
                            'PurchOrd:F'
                        ],
                        'AND',
                        ['custbody_ctc_bypass_vc', 'is', 'F']
                    ],
                    columns: [
                        'trandate',
                        'type',
                        'tranid',
                        'entity',
                        'account',
                        'statusref',
                        'amount',
                        'incoterm',
                        'custbody_ctc_po_link_type',
                        'custbody_isdropshippo',
                        vc2_constant.FIELD.TRANSACTION.OVERRIDE_PONUM, // add the override column
                        ns_search.createColumn({
                            name: 'internalid',
                            join: 'vendor'
                        }),
                        ns_search.createColumn({
                            name: 'datecreated',
                            sort: ns_search.Sort.DESC
                        })
                    ]
                };

                var vendorFilter = [];
                for (var i = 0, j = activeVendors.length; i < j; i++) {
                    if (
                        Params.vendorId &&
                        !vc2_util.inArray(Params.vendorId, activeVendors[i].vendor)
                    )
                        continue;

                    if (vendorFilter.length) vendorFilter.push('OR');
                    vendorFilter.push([
                        ['name', 'anyof', activeVendors[i].vendor],
                        'AND',
                        ['trandate', 'onorafter', activeVendors[i].startDate]
                    ]);
                }
                searchOption.filters.push('AND', vendorFilter);

                vc2_util.log(logTitle, '... search option: ', searchOption);

                searchNew = ns_search.create(searchOption);
            }

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
                ('\n\nParameters: ' + JSON.stringify(Params))
        });

        return returnValue;
    };

    MAP_REDUCE.map = function (mapContext) {
        var logTitle = [LogTitle, 'map'].join('::');

        vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

        var outputObj;
        try {
            // for each search result, the map function is called in parallel. It will handle the request write out the requestXML
            vc2_util.logDebug(logTitle, '###### START: MAP ######');

            Params = {
                searchId: ns_runtime.getCurrentScript().getParameter('custscript_searchid2'),
                vendorId: ns_runtime.getCurrentScript().getParameter('custscript_vendor2'),
                internalid: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_orderstatus_tranid'),
                use_fulfill_rl: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_fulfillcreate_restlet')
            };
            vc2_util.log(logTitle, '// Params: ', Params);

            var searchResult = JSON.parse(mapContext.value);
            Current.poId = searchResult.id;
            Current.poNum = searchResult.values.tranid;
            Current.tranDate = searchResult.values.trandate;
            Current.vendor = searchResult.values.entity.value;

            Current.byPassVC = searchResult.values.custbody_ctc_bypass_vc;

            Current.subsidiary = Helper.getSubsidiary(Current.poId);

            LogPrefix = 'MAP [purchaseorder:' + Current.poId + '] ';

            vc2_util.LogPrefix = LogPrefix;

            vc2_util.log(logTitle, '..current: ', Current);

            if (Current.byPassVC == 'T' || Current.byPassVC === true)
                throw ERROR_MSG.BYPASS_VARCONNECT;

            Current.MainCFG = Helper.loadMainConfig();
            Current.VendorCFG = Helper.loadVendorConfig({
                vendor: Current.vendor,
                vendorName: searchResult.values.entity.text,
                subsidiary: Current.subsidiary
            });
            if (!Current.VendorCFG) throw ERROR_MSG.MISSING_VENDORCFG;

            ///// OVERRIDE /////
            if (Current.MainCFG.overridePONum) {
                var tempPONum = searchResult.values[vc2_constant.FIELD.TRANSACTION.OVERRIDE_PONUM];
                if (tempPONum) {
                    Current.poNum = tempPONum;
                    vc2_util.log(logTitle, '**** TEMP PO NUM: ' + tempPONum + ' ****');
                }
            }
            ////////////////

            // looup the country
            var countryCode = Current.VendorCFG.countryCode;
            Current.PO_REC = ns_record.load({
                type: 'purchaseorder',
                id: Current.poId,
                isDynamic: true
            });

            // vc2_util.log(
            //     logTitle,
            //     '*** ADHOC FIELD VALUES ***',
            //     Current.PO_REC.getValue({ fieldId: 'custbody_ctc_vc_helper_field' })
            // );

            Current.isDropPO =
                Current.PO_REC.getValue({ fieldId: 'dropshipso' }) ||
                Current.PO_REC.getValue({
                    fieldId: 'custbody_ctc_po_link_type'
                }) == 'Drop Shipment' ||
                Current.PO_REC.getValue({ fieldId: 'custbody_isdropshippo' });

            ////////////////////////////////////////////////
            vc2_util.log(logTitle, '///// Initiating library webservice ....');

            outputObj = vc_websvclib.process({
                mainConfig: Current.MainCFG,
                vendorConfig: Current.VendorCFG,
                vendor: Current.vendor,
                po_record: Current.PO_REC,
                poId: Current.poId,
                poNum: Current.poNum,
                tranDate: Current.tranDate,
                subsidiary: Current.subsidiary,
                countryCode: countryCode
            });

            vc2_util.log(logTitle, '...  outputObj: ', outputObj);
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

            // throw '** EXIT **';

            ////////////////////////////////////////////////
            /// UPDATE PO //////
            vc2_util.log(logTitle, '///// Initiating update order ....');

            var updateStatus = vc_nslib.updatepo({
                po_record: Current.PO_REC,
                poNum: Current.poId,
                lineData: vc2_util.clone(outputObj.itemArray),
                mainConfig: Current.MainCFG,
                vendorConfig: Current.VendorCFG,
                isDropPO: Current.isDropPO
            });
            vc2_util.log(logTitle, '... result: ', updateStatus);

            if (updateStatus) {
                Current.soId = updateStatus.id;
                if (updateStatus.error && updateStatus.lineuniquekey) {
                    vc2_util.vcLog({
                        title: 'PO Update | Error',
                        error: updateStatus.error,
                        recordId: Current.poId
                    });
                }
            }
            vc2_util.log(logTitle, '... so_ID: ', Current.soId);
            ////////////////////////////////////////////////

            if (!vc2_util.isEmpty(Current.soId)) {
                Current.SO_REC = ns_record.load({
                    type: ns_record.Type.SALES_ORDER,
                    id: Current.soId
                });
                Current.customerId = Current.SO_REC.getValue('entity');
            }

            Current.allowItemFF =
                Current.MainCFG.processDropships &&
                Current.VendorCFG.processDropships &&
                Current.MainCFG.createIF;

            Current.allowItemRcpt =
                Current.MainCFG.processSpecialOrders &&
                Current.VendorCFG.processSpecialOrders &&
                Current.MainCFG.createIR;

            if (Current.isDropPO) {
                if (!Current.allowItemFF) throw ERROR_MSG.FULFILLMENT_NOT_ENABLED;

                if (Params.use_fulfill_rl === true || Params.use_fulfill_rl == 'T') {
                    // Helper.processItemFulfillment_restlet({ orderLines: outputObj.itemArray });
                    Helper.processItemFulfillment({ orderLines: outputObj.itemArray });
                } else {
                    Helper.processItemFulfillment({ orderLines: outputObj.itemArray });
                }
            } else {
                if (!Current.allowItemRcpt) throw ERROR_MSG.ITEMRECEIPT_NOT_ENABLED;

                Helper.processItemReceipt({ orderLines: outputObj.itemArray });
            }

            //Logic for retrieving information and creating list of serials to be created
            if (
                (Current.isDropPO && Current.MainCFG.createSerialDropship) ||
                (!Current.isDropPO && Current.MainCFG.createSerialSpecialOrder)
            ) {
                Current.NumPrefix = Current.VendorCFG.fulfillmentPrefix;

                // Move the searches outside of the for loop for governance issues
                /// IF SEARCH ///////////////
                var arrFulfillments = [];
                var objSearchIF = ns_search.load({ id: 'customsearch_ctc_if_vendor_orders' });
                objSearchIF.filters.push(
                    ns_search.createFilter({
                        name: 'custbody_ctc_if_vendor_order_match',
                        operator: ns_search.Operator.STARTSWITH,
                        values: Current.NumPrefix
                    })
                );

                var ItemFFSearchAll = vc2_util.searchAllPaged({ searchObj: objSearchIF });
                vc2_util.log(logTitle, '>> Total Results [IF]: ', ItemFFSearchAll.length);

                ItemFFSearchAll.forEach(function (result) {
                    arrFulfillments.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });

                vc2_util.log(logTitle, '>> fulfillments: ', arrFulfillments.length);
                //////////////////////////////////////////////////

                /// IR SEARCH /////////////////
                var arrReceipts = [];
                var objSearchIR = ns_search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
                objSearchIR.filters.push(
                    ns_search.createFilter({
                        name: 'custbody_ctc_if_vendor_order_match',
                        operator: ns_search.Operator.STARTSWITH,
                        values: Current.NumPrefix
                    })
                );
                var ItemRcptSearchAll = vc2_util.searchAllPaged({ searchObj: objSearchIR });

                ItemRcptSearchAll.forEach(function (result) {
                    arrReceipts.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });
                vc2_util.log(logTitle, '>> receipts: ', arrReceipts.length);
                //////////////////////////////////////////////////

                vc2_util.log(logTitle, '>> lineData: ', outputObj.itemArray.length);

                for (var i = 0; i < outputObj.itemArray.length; i++) {
                    var lineData = outputObj.itemArray[i];
                    if (!lineData) continue;

                    vc2_util.log(logTitle, '... line data: ', lineData);

                    var serialArray =
                        lineData.serial_num && util.isString(lineData.serial_num)
                            ? lineData.serial_num.split(/,/gi)
                            : false;

                    if (!serialArray || !serialArray.length) continue;

                    vc2_util.log(logTitle, '... serialArray: ', serialArray);

                    var fulfillmentNum = null,
                        receiptNum = null,
                        ii;

                    if (Current.isDropPO && Current.MainCFG.processDropships) {
                        for (ii = 0; ii < arrFulfillments.length; ii++) {
                            if (arrFulfillments[ii].num == Current.NumPrefix + lineData.order_num) {
                                fulfillmentNum = arrFulfillments[ii].id;
                                break;
                            }
                        }

                        vc2_util.log(logTitle, '... matching fulfillment', [
                            lineData.order_num,
                            fulfillmentNum
                        ]);
                    } else if (!Current.isDropPO && Current.MainCFG.processSpecialOrders) {
                        for (ii = 0; ii < arrReceipts.length; ii++) {
                            if (arrReceipts[ii].num == Current.NumPrefix + lineData.order_num) {
                                receiptNum = arrReceipts[ii].id;
                                break;
                            }
                        }

                        vc2_util.log(logTitle, '... matching fulfillment', [
                            lineData.order_num,
                            receiptNum
                        ]);
                    }

                    for (var iii = 0; iii < serialArray.length; iii++) {
                        if (serialArray[iii] == '') continue;

                        mapContext.write(serialArray[iii], {
                            poId: Current.poId,
                            itemnum: lineData.item_num,
                            lineData: lineData,
                            custid: Current.customerId,
                            orderNum: fulfillmentNum,
                            receiptNum: receiptNum,
                            linenum: lineData.line_num,
                            mainConfig: Current.MainCFG,
                            vendorConfig: Current.VendorCFG,
                            subsidiary: Current.subsidiary
                        });
                    }
                }
            }
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

        // reduce runs on each serial number to save it
        // each instance of reduce has 5000 unit and this way there will be a new one for each line
        var logTitle = [LogTitle, 'reduce'].join('::');
        vc2_util.logDebug(logTitle, '###### START: REDUCE ###### ');

        var serial = context.key;
        var currentData = JSON.parse(context.values[0]);
        LogPrefix = 'REDUCE [purchaseorder:' + currentData.poId + '|serial:' + serial + ' ] ';
        vc2_util.LogPrefix = LogPrefix;

        if (serial == 'NA') return;

        if (!currentData.mainConfig) currentData.mainConfig = Helper.loadMainConfig();
        if (!currentData.subsidiary)
            currentData.subsidiary = Helper.getSubsidiary(currentData.poId);
        // if (!currentData.vendorConfig) currentData.subsidiary = Helper.getSubsidiary(currentData.poId);

        vc2_util.log(logTitle, '/// current data: ', currentData);

        var po_record = ns_record.load({
            type: 'purchaseorder',
            id: currentData.poId,
            isDynamic: true
        });
        if (!po_record) throw 'Unable to load purchase order';

        if (!currentData.vendorConfig) {
            var vendor = po_record.getValue({ fieldId: 'entity' });
            var subsidiaryId = null;
            if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES)
                subsidiaryId = po_record.getValue({ fieldId: 'subsidiary' });

            currentData.vendorConfig =
                currentData.vendorConfig ||
                Helper.loadVendorConfig({
                    vendor: vendor,
                    vendorName: po_record.getText({ fieldId: 'entity' }),
                    subsidiary: currentData.subsidiary
                });
        }

        if (!currentData.mainConfig) throw 'Main Configuration not found';
        if (!currentData.vendorConfig) throw 'Vendor Config not found';

        var itemAltNameColId =
                currentData.vendorConfig.itemColumnIdToMatch ||
                currentData.mainConfig.itemColumnIdToMatch,
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
        if (itemAltNameColId) {
            poColumns.push(itemAltNameColId);
        }
        var arrOrderLines = vc2_record.extractRecordLines({
            record: po_record,
            findAll: true,
            mainConfig: currentData.mainConfig,
            vendorConfig: currentData.vendorConfig,
            columns: poColumns
        });

        var matchedOrderLine = vc2_record.findMatchingOrderLine({
            record: po_record,
            mainConfig: currentData.mainConfig,
            vendorConfig: currentData.vendorConfig,
            vendorLine: currentData.lineData,
            orderLines: arrOrderLines
        });

        vc2_util.log(logTitle, '>> matchedOrderLine', matchedOrderLine);

        if (matchedOrderLine) {
            currentData.lineNum = matchedOrderLine.line;
        }

        // currentData.lineNum = vc_nslib.validateLineNumber({
        //     po_record: po_record,
        //     lineData: currentData.lineData,
        //     ingramHashSpace: currentData.mainConfig.ingramHashSpace,
        //     xmlVendor: currentData.vendorConfig.xmlVendor
        // });

        vc2_util.log(logTitle, '... lineNum:  ', currentData.lineNum);

        if (currentData.lineNum != null) {
            currentData.itemId = po_record.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: currentData.lineNum
            });
        }

        currentData.soId = po_record.getValue({ fieldId: 'createdfrom' });
        vc2_util.logDebug(logTitle, '>> SalesOrder Id: ', currentData.soId);

        if (currentData.soId) {
            var customerInfo = vc2_util.flatLookup({
                type: ns_record.Type.SALES_ORDER,
                id: currentData.soId,
                columns: ['entity']
            });
            vc2_util.logDebug(logTitle, '... customerInfo: ', customerInfo);

            currentData.customerId =
                customerInfo.entity && customerInfo.entity.value ? customerInfo.entity.value : null;
        }

        //create or update serial record.
        Helper.processSerial({
            serial: serial,
            currentData: currentData
        });

        return true;
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

        vc2_util.vcLog({
            title: 'VAR Connect END',
            message: 'VAR Connect END'
        });

        vc2_util.logDebug(logTitle, '###### END OF SCRIPT ###### ');
    };

    // var ERROR_MSG = {
    //     ORDER_EXISTS: 'Order already exists',
    //     NO_LINES_TO_FULFILL: 'No lines to fulfill'
    // };

    var Helper = {
        getUsage: function () {
            Current.REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[rem-usage:' + Current.REMUSAGE + ']';
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');

            var mainConfig = option.mainConfig,
                license = mainConfig.license,
                response = vc_license.callValidationSuitelet({
                    license: license,
                    external: true
                });

            if (response == 'invalid') throw ERROR_MSG.INVALID_LICENSE;
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

                vc2_util.log(logTitle, '.. vendor/start date', [vendorList, startDate]);

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                    // arrVendors = arrVendors.concat(vendorList);
                }

                return true;
            });

            vc2_util.log(logTitle, '... vendor list', arrVendors);

            return arrVendors;
        },
        loadMainConfig: function () {
            var logTitle = [LogTitle, 'loadMainConfig'].join('::');

            var mainConfig = vc_maincfg.getMainConfiguration();
            if (!mainConfig) {
                vc2_util.logError(logTitle, 'No Configuration available');
                throw new Error('No Configuration available');
            } else return mainConfig;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary,
                vendorConfig = vc_vendorcfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                vc2_util.log(
                    logTitle,
                    'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName
                );
            }

            return vendorConfig;
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
                if (!Current.VendorCFG) throw ERROR_MSG.MISSING_VENDORCFG;

                var searchObj = ns_search.load({ id: Params.searchId });

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
                        values: Current.VendorCFG.startDate
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
            var logTitle = [LogTitle, 'processItemFulfillment'].join('::'),
                returnValue;

            try {
                vc2_util.logDebug(logTitle, '**** FULFILLMENT PROCESSING: RESTLET ***** ');

                if (!Helper.validateDate()) throw 'Invalid PO Date';
                var OrderLines = option.orderLines;

                var numPrefix = Current.VendorCFG.fulfillmentPrefix;
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
                returnValue;

            try {
                fulfillmentData = vc_itemfflib.updateItemFulfillments({
                    mainConfig: Current.MainCFG,
                    vendorConfig: Current.VendorCFG,
                    poId: Current.poId,
                    lineData: option.lineData || option.orderLines,
                    vendor: Current.vendor,
                    recSalesOrd: Current.SO_REC,
                    recPurchOrd: Current.PO_REC
                });
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
                returnValue;

            try {
                fulfillmentData = vc_itemrcpt.updateIR({
                    mainConfig: Current.MainCFG,
                    vendorConfig: Current.VendorCFG,
                    poId: Current.poId,
                    lineData: option.lineData || option.orderLines,
                    vendor: Current.vendor
                });
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
        processSerial: function (option) {
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
        }
    };

    return MAP_REDUCE;
});
