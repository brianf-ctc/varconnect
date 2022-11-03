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
    './CTC_Create_Item_Fulfillment',
    './CTC_Create_Item_Receipt',
    './netsuitelibrary_v2.js',
    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_WebService',
    './CTC_VC_Lib_LicenseValidator',
    './CTC_VC2_Constants.js',
    './CTC_VC_Lib_Log.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    ns_https,
    vc_util,
    vc_itemfflib,
    vc_itemrcpt,
    vc_record,
    vc_maincfg,
    vc_vendorcfg,
    vc_websvclib,
    vc_license,
    vc_constants,
    vc_log
) {
    var LogTitle = 'MR_OrderStatus';
    var LogPrefix = '';
    var Params = {},
        Current = {};

    /////////////////////////////////////////////////////////
    var MAP_REDUCE = {};

    /**
     *   Get the list of PO to process from a saved search
     */
    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join('::');
        log.debug(logTitle, '###### START OF SCRIPT ######');
        var returnValue;

        try {
            Params = {
                searchId: ns_runtime.getCurrentScript().getParameter('custscript_searchid2'),
                vendorId: ns_runtime.getCurrentScript().getParameter('custscript_vendor2'),
                internalid: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_orderstatus_tranid')
            };
            log.debug(logTitle, '>> Params: ' + JSON.stringify(Params));

            Current.MainCFG = Helper.loadMainConfig();
            log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(Current.MainCFG));
            Helper.validateLicense({ mainConfig: Current.MainCFG });

            if (!Current.MainCFG.processDropships && !Current.MainCFG.processSpecialOrders) {
                throw 'Process DropShips and Process Special Orders is not enabled!';
            }

            if (!Params.searchId) {
                throw 'Missing Search: Open PO for Order Status processing';
            }

            log.debug(logTitle, '>> Params: ' + JSON.stringify(Params));

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
                        !vc_util.inArray(Params.vendorId, activeVendors[i].vendor)
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

                log.audit(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        '// search option: ' +
                        JSON.stringify(searchOption)
                );

                searchNew = ns_search.create(searchOption);
            }

            returnValue = searchNew;
        } catch (error) {
            log.error(
                logTitle,
                vc_util.getUsage() + LogPrefix + ' ## ERROR ## ' + JSON.stringify(error)
            );
            throw vc_util.extractError(error);
        }

        var totalResults = returnValue.runPaged().count;
        log.audit(logTitle, '>> Total Orders to Process: ' + totalResults);

        vc_log.recordLog({
            header: 'VAR Connect START',
            body:
                'VAR Connect START' +
                ('\n\nTotal Orders: ' + totalResults) +
                ('\n\nParameters: ' + JSON.stringify(Params)),
            status: vc_constants.LIST.VC_LOG_STATUS.INFO
        });

        return returnValue;
    };

    MAP_REDUCE.map = function (contextM) {
        var logTitle = [LogTitle, 'map'].join('::');

        var outputObj;
        try {
            // for each search result, the map function is called in parallel. It will handle the request write out the requestXML
            log.debug(logTitle, '###### START: MAP ###### ' + contextM.value);

            Params = {
                searchId: ns_runtime.getCurrentScript().getParameter('custscript_searchid2'),
                vendorId: ns_runtime.getCurrentScript().getParameter('custscript_vendor2'),
                internalid: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_orderstatus_tranid')
            };
            log.debug(logTitle, '>> Params: ' + JSON.stringify(Params));

            var searchResult = JSON.parse(contextM.value);
            Current.poId = searchResult.id;
            Current.poNum = searchResult.values.tranid;
            Current.tranDate = searchResult.values.trandate;
            Current.vendor = searchResult.values.entity.value;
            Current.subsidiary = Helper.getSubsidiary(Current.poId);

            LogPrefix = 'MAP [purchaseorder:' + Current.poId + '] ';
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> data: ' + JSON.stringify(Current)
            );

            Current.MainCFG = Helper.loadMainConfig();
            Current.VendorCFG = Helper.loadVendorConfig({
                vendor: Current.vendor,
                vendorName: searchResult.values.entity.text,
                subsidiary: Current.subsidiary
            });
            if (!Current.VendorCFG) return;

            // looup the country
            var countryCode = Current.VendorCFG.countryCode;
            Current.PO_REC = ns_record.load({
                type: 'purchaseorder',
                id: Current.poId,
                isDynamic: true
            });

            Current.isDropPO =
                Current.PO_REC.getValue({ fieldId: 'dropshipso' }) ||
                Current.PO_REC.getValue({
                    fieldId: 'custbody_ctc_po_link_type'
                }) == 'Drop Shipment';

            ////////////////////////////////////////////////
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '///// Initiating library webservice ....'
            );
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
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> Order Lines: ' + JSON.stringify(outputObj)
            );
            ////////////////////////////////////////////////

            ////////////////////////////////////////////////
            // if there are no lines.. just exit the script
            if (
                !outputObj.itemArray ||
                (!outputObj.itemArray.length && !outputObj.itemArray.header_info)
            )
                throw 'No lines to process.';

            ////////////////////////////////////////////////
            /// UPDATE PO //////
            var updateStatus = vc_record.updatepo({
                po_record: Current.PO_REC,
                poNum: Current.poId,
                lineData: outputObj.itemArray,
                mainConfig: Current.MainCFG,
                vendorConfig: Current.VendorCFG
            });

            if (updateStatus) {
                Current.soId = updateStatus.id;
                if (updateStatus.error && updateStatus.lineuniquekey) {
                    vc_log.recordLog({
                        header: 'PO Update | Error',
                        body: vc_util.extractError(updateStatus.error),
                        transaction: Current.poId,
                        transactionLineKey: updateStatus.lineuniquekey,
                        status: vc_constants.LIST.VC_LOG_STATUS.ERROR
                    });
                }
            }
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> so_ID: ' + JSON.stringify(Current.soId)
            );
            ////////////////////////////////////////////////

            if (!vc_util.isEmpty(Current.soId)) {
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
                if (!Current.allowItemFF) throw 'Item Fulfillment creation is not enabled.';
                Helper.processItemFulfillment({ orderLines: outputObj.itemArray });
            } else {
                if (!Current.allowItemRcpt) throw 'Item Receipt creation is not enabled.';
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

                var ItemFFSearchAll = vc_util.searchAllPaged({ searchObj: objSearchIF });
                log.debug(
                    logTitle,
                    vc_util.getUsage() +
                        (LogPrefix + '>> Total Results [IF]: ' + ItemFFSearchAll.length)
                );

                ItemFFSearchAll.forEach(function (result) {
                    arrFulfillments.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });
                log.debug(
                    logTitle,
                    vc_util.getUsage() +
                        (LogPrefix + '>> fulfillments: ' + JSON.stringify(arrFulfillments.length))
                );
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
                var ItemRcptSearchAll = vc_util.searchAllPaged({ searchObj: objSearchIR });

                ItemRcptSearchAll.forEach(function (result) {
                    arrReceipts.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });
                log.debug(
                    logTitle,
                    vc_util.getUsage() +
                        (LogPrefix + '>> receipts: ' + JSON.stringify(arrReceipts.length))
                );
                //////////////////////////////////////////////////

                log.debug(
                    logTitle,
                    vc_util.getUsage() + LogPrefix + '>> lineData: ' + outputObj.itemArray.length
                );

                for (var i = 0; i < outputObj.itemArray.length; i++) {
                    var lineData = outputObj.itemArray[i];
                    if (!lineData) continue;

                    log.audit(
                        logTitle,
                        vc_util.getUsage() +
                            (LogPrefix + '... line data: ' + JSON.stringify(lineData))
                    );

                    var serialArray =
                        lineData.serial_num && util.isString(lineData.serial_num)
                            ? lineData.serial_num.split(/,/gi)
                            : false;

                    if (!serialArray || !serialArray.length) continue;
                    log.audit(logTitle, '... serialArray: ' + JSON.stringify(serialArray));

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
                        log.audit(
                            logTitle,
                            '.... matching fulfillment: ' +
                                JSON.stringify([lineData.order_num, fulfillmentNum])
                        );
                    } else if (!Current.isDropPO && Current.MainCFG.processSpecialOrders) {
                        for (ii = 0; ii < arrReceipts.length; ii++) {
                            if (arrReceipts[ii].num == Current.NumPrefix + lineData.order_num) {
                                receiptNum = arrReceipts[ii].id;
                                break;
                            }
                        }
                        log.audit(
                            logTitle,
                            '... matching receipt: ' +
                                JSON.stringify([lineData.order_num, receiptNum])
                        );
                    }

                    for (var iii = 0; iii < serialArray.length; iii++) {
                        if (serialArray[iii] == '') continue;

                        contextM.write(serialArray[iii], {
                            docid: Current.poId,
                            itemnum: lineData.item_num,
                            lineData: lineData,
                            custid: Current.customerId,
                            orderNum: fulfillmentNum,
                            receiptNum: receiptNum,
                            linenum: lineData.line_num
                        });
                    }
                }
            }
        } catch (error) {
            log.error(
                logTitle,
                vc_util.getUsage() +
                    (LogPrefix + ' - Error encountered in map' + JSON.stringify(error))
            );

            vc_log.recordLog({
                header: LogTitle + ' | Error',
                body: vc_util.extractError(error),
                transaction: Current.poId,
                status: vc_constants.LIST.VC_LOG_STATUS.ERROR
            });
        } finally {
            log.debug(logTitle, '###### END: MAP ###### ');
        }
    };

    MAP_REDUCE.reduce = function (context) {
        // reduce runs on each serial number to save it
        // each instance of reduce has 5000 unit and this way there will be a new one for each line
        var logTitle = [LogTitle, 'reduce'].join('::');
        log.debug(logTitle, '###### START: REDUCE ###### ' + JSON.stringify(context.values));

        var serial = context.key;
        var data = JSON.parse(context.values[0]);
        var poId = data.docid;
        var itemNum = data.itemnum;
        var line = data.line;

        LogPrefix = 'REDUCE [purchaseorder:' + poId + '] ';

        log.debug(
            logTitle,
            vc_util.getUsage() + LogPrefix + '>> serial data: ' + JSON.stringify(data)
        );

        var po_record = ns_record.load({
            type: 'purchaseorder',
            id: poId,
            isDynamic: true
        });
        if (po_record != null) {
            var itemId = '';
            var vendor = po_record.getValue({ fieldId: 'entity' });
            var subsidiaryId = null;
            if (vc_constants.GLOBAL.ENABLE_SUBSIDIARIES)
                subsidiaryId = po_record.getValue({ fieldId: 'subsidiary' });

            var mainConfig = Helper.loadMainConfig();
            var subsidiary = Helper.getSubsidiary(poId);
            var vendorConfig = Helper.loadVendorConfig({
                vendor: vendor,
                vendorName: po_record.getText({ fieldId: 'entity' }),
                subsidiary: subsidiary
            });
            if (!vendorConfig) throw 'Vendor Config not found';
            // log.debug(logTitle,  vc_util.getUsage() + LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));

            // var lineNum = vcRecord.validateline(
            //     po_record,
            //     itemNum,
            //     null,
            //     mainConfig.ingramHashSpace,
            //     vendorConfig.xmlVendor
            // );

            var lineNum = vc_record.validateline({
                po_record: po_record,
                lineData: data.lineData,
                ingramHashSpace: mainConfig.ingramHashSpace,
                xmlVendor: vendorConfig.xmlVendor
            });

            if (lineNum != null) {
                itemId = po_record.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: lineNum
                });
            }
            //log.debug('Reduce ItemId', itemId);
            var soId = po_record.getValue({
                fieldId: 'createdfrom'
            });

            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> SalesOrder Id: ' + JSON.stringify(soId)
            );

            var rs = ns_search.global({ keywords: serial });
            //log.debug("Global search result", rs);
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> Global Search - serial: ' + serial
            );

            if (rs.length == 0) {
                // log.debug('xml app v2: saveSerial', serial);

                var sn_record = ns_record.create({
                    type: 'customrecordserialnum'
                });
                sn_record.setValue({
                    fieldId: 'name',
                    value: serial
                });
                if (poId != null) {
                    sn_record.setValue({
                        fieldId: 'custrecordserialpurchase',
                        value: poId
                    });
                }
                if (data.itemNum != null) {
                    sn_record.setValue({
                        fieldId: 'custrecordserialitem',
                        value: data.itemNum
                    });
                }
                if (soId != null) {
                    sn_record.setValue({
                        fieldId: 'custrecordserialsales',
                        value: soId
                    });
                }
                if (data.receiptNum != null) {
                    sn_record.setValue({
                        fieldId: 'custrecordcustomer',
                        value: data.custid
                    });
                }
                if (data.orderNum != null) {
                    sn_record.setValue({
                        fieldId: 'custrecorditemfulfillment',
                        value: data.orderNum
                    });
                }
                if (data.receiptNum != null) {
                    sn_record.setValue({
                        fieldId: 'custrecorditemreceipt',
                        value: data.receiptNum
                    });
                }
                if (itemId) {
                    sn_record.setValue({
                        fieldId: 'custrecordserialitem',
                        value: itemId
                    });
                }

                var sc = sn_record.save();
                log.debug(
                    logTitle,
                    vc_util.getUsage() + LogPrefix + '>> New Serial ID: ' + JSON.stringify(sc)
                );
            } else if (rs.length == 1) {
                log.debug(logTitle, vc_util.getUsage() + LogPrefix + ' >> Matching serial found');
            } else {
                log.debug(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        ' >> Multiple Duplicates ' +
                        JSON.stringify(rs.length)
                );
                // log.debug('xml app v2: error duplicates');
            }
        }
    };

    MAP_REDUCE.summarize = function (summary) {
        //any errors that happen in the above methods are thrown here so they should be handled
        //log stuff that we care about, like number of serial numbers
        var logTitle = [LogTitle, 'summarize'].join('::');
        log.debug(logTitle, '###### START: SUMMARY ###### ');

        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error(logTitle, 'Reduce Error for key: ' + JSON.stringify([key, error]));
            return true;
        });
        var reduceKeys = [];
        summary.reduceSummary.keys.iterator().each(function (key) {
            reduceKeys.push(key);
            return true;
        });
        log.audit('REDUCE keys processed', reduceKeys);
        vc_log.recordLog({
            header: 'VAR Connect END',
            body: 'VAR Connect END',
            status: vc_constants.LIST.VC_LOG_STATUS.INFO
        });

        log.debug(logTitle, '###### END OF SCRIPT ###### ');
    };

    var Helper = {
        getUsage: function () {
            Current.REMUSAGE = ns_runtime.getCurrentScript().getRemainingUsage();
            return '[rem-usage:' + Current.REMUSAGE + ']';
        },
        logMsg: function (option) {
            option = option || {};

            var logOption = {
                transaction: option.tranId || option.transactionId,
                transactionLineKey: option.transactionLineKey,
                header: [LogTitle, option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? vc_util.extractError(option.error) : option.errorMsg),
                status:
                    option.status ||
                    (option.error || option.isError
                        ? vc_constants.LIST.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? vc_constants.LIST.VC_LOG_STATUS.SUCCESS
                        : vc_constants.LIST.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, '::' + JSON.stringify(logOption));
            vc_log.recordLog(logOption);
            return true;
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');
            // log.audit(logTitle,  vc_util.getUsage() + LogPrefix + '>> option: ' + JSON.stringify(option));
            // return true;

            var mainConfig = option.mainConfig,
                license = mainConfig.license,
                response = vc_license.callValidationSuitelet({
                    license: license,
                    external: true
                });

            if (response == 'invalid')
                throw new Error(
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
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

                log.audit(
                    logTitle,
                    vc_util.getUsage() + LogPrefix + '..' + JSON.stringify([vendorList, startDate])
                );

                if (vendorList) {
                    arrVendors.push({
                        vendor: vendorList.split(/,/gi),
                        startDate: startDate
                    });
                    // arrVendors = arrVendors.concat(vendorList);
                }

                return true;
            });

            log.audit(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> vendors list: ' + JSON.stringify(arrVendors)
            );

            return arrVendors;
        },
        loadMainConfig: function () {
            var logTitle = [LogTitle, 'loadMainConfig'].join('::');

            var mainConfig = vc_maincfg.getMainConfiguration();
            if (!mainConfig) {
                log.error(logTitle, 'No Configuration available');
                throw new Error('No Configuration available');
            } else return mainConfig;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');
            // log.debug(logTitle,  vc_util.getUsage() + LogPrefix + '>> option: ' + JSON.stringify(option));

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary,
                vendorConfig = vc_vendorcfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                log.audit(
                    logTitle,
                    'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName
                );
            }

            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig)
            );
            return vendorConfig;
        },
        getSubsidiary: function (poId) {
            var logTitle = [LogTitle, 'getSubsidiary'].join('::');
            log.debug(
                logTitle,
                vc_util.getUsage() + LogPrefix + '>> poId: ' + JSON.stringify(poId)
            );

            var subsidiary = null;

            if (vc_constants.GLOBAL.ENABLE_SUBSIDIARIES) {
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
                if (!Current.poId) throw 'Missing PO ID';
                if (!Current.VendorCFG) throw 'Missing Vendor Config';

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
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw vc_util.extractError(error);
            } finally {
                log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
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
                if (vc_util.isEmpty(listOrderNum)) return false;

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

                log.audit(logTitle, logPrefix + '>> searchOption: ' + JSON.stringify(searchOption));

                var arrResults = [];
                var searchResults = vc_util.searchAllPaged({
                    searchObj: ns_search.create(searchOption)
                });

                searchResults.forEach(function (result) {
                    var orderNum = result.getValue({
                        name: 'custbody_ctc_if_vendor_order_match'
                    });
                    if (!vc_util.inArray(orderNum, arrResults)) arrResults.push(orderNum);
                    return true;
                });

                returnValue = arrResults;
            } catch (error) {
                log.error(logTitle, logPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw Helper.extractError(error);
            } finally {
                // log.audit(logTitle, logPrefix + '>> returnValue: ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        processItemFulfillment: function (option) {
            var logTitle = [LogTitle, 'processItemFulfillment'].join('::'),
                returnValue;

            try {
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
                    log.audit(
                        logTitle,
                        vc_util.getUsage() +
                            LogPrefix +
                            ('... processing ' + '[' + OrderLines[i].order_num + '] .....')
                    );

                    if (vc_util.inArray(OrderLines[i].order_num, arrOrderNums)) {
                        continue;
                    }

                    if (!OrderLines[i].order_num || OrderLines[i].order_num == 'NA') {
                        log.audit(
                            logTitle,
                            vc_util.getUsage() + LogPrefix + '......skipped: no item order num'
                        );
                        continue;
                    }

                    if (
                        OrderLines[i].hasOwnProperty('is_shipped') &&
                        OrderLines[i].is_shipped === false
                    ) {
                        log.audit(
                            logTitle,
                            vc_util.getUsage() + LogPrefix + '......skipped: not yet shipped'
                        );
                        continue;
                    }

                    if (OrderLines[i].hasOwnProperty('ns_record') && OrderLines[i].ns_record) {
                        log.audit(
                            logTitle,
                            vc_util.getUsage() +
                                LogPrefix +
                                '......skipped: fulfillment already exists.'
                        );
                        continue;
                    }

                    OrderLines[i].ship_qty = parseInt(OrderLines[i].ship_qty || '0', 10);
                    OrderLines[i].vendorOrderNum = numPrefix + OrderLines[i].order_num;

                    arrOrderNums.push(OrderLines[i].order_num);
                    arrVendorOrderNums.push(OrderLines[i].vendorOrderNum);
                }

                log.audit(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        '/// OrderNums: ' +
                        JSON.stringify([arrOrderNums, arrVendorOrderNums])
                );

                var arrExistingIFS = Helper.searchExistingIFs({
                    orderNums: arrVendorOrderNums
                });
                log.debug(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        ('>> arrExistingIFS: ' + JSON.stringify(arrExistingIFS))
                );

                /// run through all the ordernums
                for (i = 0; i < arrOrderNums.length; i++) {
                    var orderNum = arrOrderNums[i],
                        vendorOrderNum = numPrefix + orderNum;

                    var logPrefix = LogPrefix + ' [' + vendorOrderNum + ']  ';
                    log.audit(logTitle, logPrefix + '*** Processing order: *****');

                    try {
                        if (vc_util.inArray(vendorOrderNum, arrExistingIFS))
                            throw '... order already exists.';

                        // get the lineData;
                        var fulfillLine = [];
                        for (ii = 0; ii < OrderLines.length; ii++) {
                            if (orderNum != OrderLines[ii].order_num) continue;
                            fulfillLine.push(OrderLines[ii]);
                        }

                        if (vc_util.isEmpty(fulfillLine)) throw '... no line items to fulfill';

                        log.audit(
                            logTitle,
                            vc_util.getUsage() + LogPrefix + '// sending itemff restlet... '
                        );
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
                        log.debug(
                            logTitle,
                            logPrefix + '>> responseBody: ' + JSON.stringify(respBody)
                        );

                        for (var noteId in respBody) {
                            var respdata = respBody[noteId];

                            if (respdata.msg) {
                                log.debug(
                                    logTitle,
                                    logPrefix + '>> respdata.msg: ' + JSON.stringify(respdata.msg)
                                );

                                vc_log.recordLog({
                                    header: 'Fulfillment Creation | Notes',
                                    body:
                                        noteId + ' - ' + util.isArray(respdata.msg)
                                            ? respdata.msg.join('\r\n')
                                            : respdata.msg,
                                    transaction: Current.poId,
                                    status: vc_constants.LIST.VC_LOG_STATUS.INFO
                                });
                            }
                            if (respdata.error) {
                                log.debug(
                                    logTitle,
                                    logPrefix +
                                        '>> respdata.error: ' +
                                        JSON.stringify(respdata.error)
                                );
                                vc_log.recordLog({
                                    header: 'Fulfillment Creation | Error',
                                    body:
                                        noteId + ' - ' + util.isArray(respdata.error)
                                            ? respdata.error.join('\r\n')
                                            : respdata.error,
                                    transaction: Current.poId,
                                    status: vc_constants.LIST.VC_LOG_STATUS.ERROR
                                });
                            }
                        }

                        /////////////////////////////////////////
                    } catch (order_error) {
                        log.audit(
                            logTitle,
                            logPrefix + '//Skipped: ' + vc_util.extractError(order_error)
                        );
                        continue;
                    }
                }
            } catch (error) {
                log.error(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        'Error creating fulfillment: ' +
                        JSON.stringify(error)
                );

                vc_log.recordLog({
                    header: 'Fulfillment Creation | Error',
                    body: vc_util.extractError(error),
                    transaction: Current.poId,
                    status: vc_constants.LIST.VC_LOG_STATUS.ERROR
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
                log.error(
                    logTitle,
                    vc_util.getUsage() +
                        LogPrefix +
                        'Error creating item receipt : ' +
                        JSON.stringify(error)
                );

                vc_log.recordLog({
                    header: 'Item Receipt Creation | Error',
                    body: vc_util.extractError(error),
                    transaction: Current.poId,
                    status: vc_constants.LIST.VC_LOG_STATUS.ERROR
                });
            }

            return returnValue;
        }
    };

    return MAP_REDUCE;
});
