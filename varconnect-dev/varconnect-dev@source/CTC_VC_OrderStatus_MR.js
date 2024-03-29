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
    './CTC_VC2_Lib_Utils',
    './VC_Globals',
    './CTC_Create_Item_Fulfillment',
    './CTC_Create_Item_Receipt',
    './netsuitelibrary_v2.js',
    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_WebService',
    './CTC_VC_Lib_LicenseValidator',
    './CTC_VC_Lib_Utilities',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    vc2Utils,
    vcGlobals,
    vcCreateIF,
    vcCreateIR,
    vcRecord,
    vcMainCfg,
    vcVendorCfg,
    vcWebSvc,
    vcLicense,
    vcUtil,
    constants,
    vcLog
) {
    var LogTitle = 'MR_OrderStatus';
    var LogPrefix = '';
    var Params = {};

    var Helper = {
        logMsg: function (option) {
            option = option || {};

            var logOption = {
                transaction: option.tranId || option.transactionId,
                transactionLineKey: option.transactionLineKey,
                header: [LogTitle, option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? vcUtil.extractError(option.error) : option.errorMsg),
                status:
                    option.status ||
                    (option.error || option.isError
                        ? constants.Lists.VC_LOG_STATUS.ERROR
                        : option.isSucces
                        ? constants.Lists.VC_LOG_STATUS.SUCCESS
                        : constants.Lists.VC_LOG_STATUS.INFO)
            };

            log.audit(LogTitle, '::' + JSON.stringify(logOption));
            vcLog.recordLog(logOption);
            return true;
        },
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');
            // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));
            // return true;

            var mainConfig = option.mainConfig,
                license = mainConfig.license,
                response = vcLicense.callValidationSuitelet({
                    license: license,
                    external: true
                });

            if (response == 'invalid')
                throw new Error(
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
        },
        loadMainConfig: function () {
            var mainConfig = vcMainCfg.getMainConfiguration();
            if (!mainConfig) {
                log.error('No Configuration available');
                throw new Error('No Configuration available');
            } else return mainConfig;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::');
            // log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var vendor = option.vendor,
                subsidiary = option.subsidiary,
                vendorConfig = vcVendorCfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                log.error(
                    'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary
                );
                // log.error(
                //     'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary
                // );
            }

            log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));
            return vendorConfig;
        },
        getSubsidiary: function (poId) {
            var logTitle = [LogTitle, 'getSubsidiary'].join('::');
            log.debug(logTitle, LogPrefix + '>> poId: ' + JSON.stringify(poId));

            var subsidiary = null;

            if (vcGlobals.ENABLE_SUBSIDIARIES) {
                var lookupObj = ns_search.lookupFields({
                    type: ns_search.Type.TRANSACTION,
                    id: poId,
                    columns: 'subsidiary'
                });
                subsidiary = lookupObj.subsidiary[0].value;
            }

            return subsidiary;
        },
        processDropshipsAndSpecialOrders: function (option) {
            var logTitle = [LogTitle, 'processDropshipsAndSpecialOrders'].join('::');
            log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var mainConfig = option.mainConfig,
                vendorConfig = option.vendorConfig,
                isDropPO = option.isDropPO,
                docid = option.docid,
                so_ID = option.soID,
                itemArray = option.itemArray,
                vendor = option.vendor,
                fulfillmentData = false;

            try {
                log.audit(logTitle, LogPrefix + '>>>>  Is Drop PO? ' + JSON.stringify(isDropPO));
                if (isDropPO) {
                    //// FULFILLMENT CREATION  /////////////////
                    log.audit(
                        logTitle,
                        LogPrefix +
                            '>> Fulfillment Creation Settings << ' +
                            JSON.stringify({
                                'mainConfig.processDropships': mainConfig.processDropships,
                                'vendorConfig.processDropships': vendorConfig.processDropships,
                                'mainConfig.createIF': mainConfig.createIF
                            })
                    );

                    if (
                        mainConfig.processDropships &&
                        vendorConfig.processDropships &&
                        mainConfig.createIF
                    ) {
                        fulfillmentData = vcCreateIF.updateItemFulfillments({
                            mainConfig: mainConfig,
                            vendorConfig: vendorConfig,
                            poId: docid,
                            soId: so_ID,
                            lineData: itemArray,
                            vendor: vendor
                        });
                    } else {
                        log.audit(logTitle, LogPrefix + '*** Fulfillment Creation not allowed ***');
                    }
                    /////////////////////////////////////////////
                } else {
                    //// ITEM RECEIPT CREATION  /////////////////
                    log.audit(
                        logTitle,
                        LogPrefix +
                            '>> Item Receipt Creation Settings << ' +
                            JSON.stringify({
                                'mainConfig.processSpecialOrders': mainConfig.processSpecialOrders,
                                'vendorConfig.processSpecialOrders':
                                    vendorConfig.processSpecialOrders,
                                'mainConfig.createIR': mainConfig.createIR
                            })
                    );

                    if (
                        mainConfig.processSpecialOrders &&
                        vendorConfig.processSpecialOrders &&
                        mainConfig.createIR
                    ) {
                        fulfillmentData = vcCreateIR.updateIR({
                            mainConfig: mainConfig,
                            vendorConfig: vendorConfig,
                            poId: docid,
                            lineData: itemArray,
                            vendor: vendor
                        });
                    } else {
                        log.audit(
                            logTitle,
                            LogPrefix + '*** Item Receipt Creation not allowed ***'
                        );
                    }
                    /////////////////////////////////////////////
                }
            } catch (e) {
                log.error(logTitle, 'Error creating fulfillment/receipt : ' + JSON.stringify(e));

                vcLog.recordLog({
                    header: 'Fulfillment/Receipt Creation | Error',
                    body: vc2Utils.extractError(e),
                    transaction: docid,
                    status: constants.Lists.VC_LOG_STATUS.ERROR
                });
            }

            return fulfillmentData;
        }
    };

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
                // vendorId: ns_runtime.getCurrentScript().getParameter('custscript_searchid2'),
                internalid: ns_runtime
                    .getCurrentScript()
                    .getParameter('custscript_orderstatus_tranid')
            };
            log.debug(logTitle, '>> Params: ' + JSON.stringify(Params));

            var mainConfig = Helper.loadMainConfig();
            log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));
            Helper.validateLicense({ mainConfig: mainConfig });

            if (!mainConfig.processDropships && !mainConfig.processSpecialOrders) {
                throw 'Process DropShips and Process Special Orders is not enabled!';
            }

            if (!Params.searchId) {
                throw 'Missing Search: Open PO for Order Status processing';
            }

            log.debug(logTitle, '>> Params: ' + JSON.stringify(Params));

            if (!Params.internalid) {
                returnValue = ns_search.load({ id: Params.searchId });
            } else {
                var searchRec = ns_search.load({ id: Params.searchId });
                // log.audit(logTitle, '>> search type: ' + JSON.stringify(searchRec));

                var searchNew = ns_search.create({
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

                returnValue = searchNew;
            }
        } catch (error) {
            log.error(logTitle, ' ## ERROR ## ' + JSON.stringify(error));
            throw vcUtil.extractError(error);
            returnValue = false;
        }

        var totalResults = returnValue.runPaged().count;
        log.audit(logTitle, '>> Total Orders to Process: ' + totalResults);

        vcLog.recordLog({
            header: 'VAR Connect START',
            body:
                'VAR Connect START' +
                ('\n\nTotal Orders: ' + totalResults) +
                ('\n\nParameters: ' + JSON.stringify(Params)),
            status: constants.Lists.VC_LOG_STATUS.INFO
        });

        return returnValue;
    };

    MAP_REDUCE.map = function (contextM) {
        var logTitle = [LogTitle, 'map'].join('::');

        try {
            // for each search result, the map function is called in parallel. It will handle the request write out the requestXML
            log.debug(logTitle, '###### START: map ###### ' + contextM.value);

            var searchResult = JSON.parse(contextM.value);
            var docid = searchResult.id;
            var docnum = searchResult.values.tranid;
            var tranDate = searchResult.values.trandate;
            var isDropPO =
                searchResult.values.custbody_isdropshippo == 'F' ||
                !searchResult.values.custbody_isdropshippo
                    ? false
                    : true;
            var vendor = searchResult.values.entity.value;

            var outputObj = '';
            var custID = '';

            LogPrefix = 'MAP [purchaseorder:' + docid + '] ';

            log.debug(
                logTitle,
                LogPrefix +
                    '>> data: ' +
                    JSON.stringify({
                        docid: docid,
                        docnum: docnum,
                        tranDate: tranDate,
                        isDropPO: isDropPO,
                        vendor: vendor
                    })
            );

            var subsidiary = Helper.getSubsidiary(docid);
            // log.debug(logTitle, LogPrefix + '>> subsidiary: ' + JSON.stringify(subsidiary));

            var mainConfig = Helper.loadMainConfig();
            // log.debug(logTitle, LogPrefix + '>> mainConfig: ' + JSON.stringify(mainConfig));

            var vendorConfig = Helper.loadVendorConfig({
                vendor: vendor,
                subsidiary: subsidiary
            });
            if (!vendorConfig) throw 'Vendor Config not found';
            // log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));

            // looup the country
            var countryCode = vendorConfig.countryCode;

            var po_record = ns_record.load({
                type: 'purchaseorder',
                id: docid,
                isDynamic: true
            });

            log.audit(
                logTitle,
                '>> isDrop PO? ' +
                    JSON.stringify({
                        isDropPO: isDropPO,
                        dropshipso: po_record.getValue({
                            fieldId: 'dropshipso'
                        }),
                        po_linktype: po_record.getValue({ fieldId: 'custbody_ctc_po_link_type' })
                    })
            );

            isDropPO =
                po_record.getValue({
                    fieldId: 'dropshipso'
                }) ||
                po_record.getValue({ fieldId: 'custbody_ctc_po_link_type' }) == 'Drop Shipment';

            log.debug(logTitle, LogPrefix + '>> Initiating library webservice ....');

            outputObj = vcWebSvc.process({
                mainConfig: mainConfig,
                vendorConfig: vendorConfig,
                vendor: vendor,
                po_record: po_record,
                poId: docid,
                poNum: docnum,
                tranDate: tranDate,
                subsidiary: subsidiary,
                countryCode: countryCode
            });
            log.debug(logTitle, LogPrefix + '>> Order Lines: ' + JSON.stringify(outputObj));

            // if there are no lines.. just exit the script
            if (
                !outputObj.itemArray ||
                (!outputObj.itemArray.length && !outputObj.itemArray.header_info)
            ) {
                log.debug(logTitle, LogPrefix + '>> no line items to process... exiting script: ');
                return true;
            }

            var updateStatus = vcRecord.updatepo({
                po_record: po_record,
                poNum: docid,
                lineData: outputObj.itemArray,
                mainConfig: mainConfig,
                vendorConfig: vendorConfig
            });

            so_ID = null;
            if (updateStatus) {
                so_ID = updateStatus.id;
                if (updateStatus.error && updateStatus.lineuniquekey) {
                    vcLog.recordLog({
                        header: 'PO Update | Error',
                        body: vc2Utils.extractError(updateStatus.error),
                        transaction: docid,
                        transactionLineKey: updateStatus.lineuniquekey,
                        status: constants.Lists.VC_LOG_STATUS.ERROR
                    });
                }
            }

            log.debug(logTitle, LogPrefix + '>> so_ID: ' + JSON.stringify(so_ID));

            if (!vc2Utils.isEmpty(so_ID)) {
                var so_rec = ns_record.load({
                    type: ns_record.Type.SALES_ORDER,
                    id: so_ID
                });
                custID = so_rec.getValue('entity');
                var params = {
                    mainConfig: mainConfig,
                    vendorConfig: vendorConfig,
                    isDropPO: isDropPO,
                    docid: docid,
                    soID: so_ID,
                    itemArray: outputObj.itemArray,
                    vendor: vendor
                };

                var fulfillmentData = Helper.processDropshipsAndSpecialOrders(params);
                log.debug(
                    logTitle,
                    LogPrefix + '>> fulfillmentData: ' + JSON.stringify(fulfillmentData)
                );
            }
            // logXML(outputObj.xmlString);
            // logRowObjects(outputObj.itemArray);

            //Logic for retrieving information and creating list of serials to be created
            if (
                (isDropPO && mainConfig.createSerialDropship) ||
                (!isDropPO && mainConfig.createSerialSpecialOrder)
            ) {
                var numPrefix = vendorConfig.fulfillmentPrefix;

                var lineData = outputObj.itemArray;
                // log.debug(logTitle, '>> xml app v2: MAP lineData length: ' + JSON.stringify(lineData.length));

                // Move the searches outside of the for loop for governance issues
                var arrFulfillments = [];
                var ifSearch = ns_search.load({ id: 'customsearch_ctc_if_vendor_orders' });
                var ifFilters = ns_search.createFilter({
                    name: 'custbody_ctc_if_vendor_order_match',
                    operator: ns_search.Operator.STARTSWITH,
                    values: numPrefix
                });
                ifSearch.filters.push(ifFilters);
                ifSearch.run().each(function (result) {
                    arrFulfillments.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });
                // log.debug(
                //     logTitle,
                //     LogPrefix + '>> arrFulfillments: ' + JSON.stringify(arrFulfillments)
                // );

                var arrReceipts = [];
                var ifSearch = ns_search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
                var ifFilters = ns_search.createFilter({
                    name: 'custbody_ctc_if_vendor_order_match',
                    operator: ns_search.Operator.STARTSWITH,
                    values: numPrefix
                });
                ifSearch.filters.push(ifFilters);
                ifSearch.run().each(function (result) {
                    arrReceipts.push({
                        id: result.id,
                        num: result.getValue('custbody_ctc_if_vendor_order_match')
                    });
                    return true;
                });
                // log.debug(logTitle, LogPrefix + '>> arrReceipts: ' + JSON.stringify(arrReceipts));

                log.debug(logTitle, LogPrefix + '>> lineData: ' + JSON.stringify(lineData));

                if (lineData && lineData.length) {
                    for (var i = 0; i < lineData.length; i++) {
                        if (!lineData[i]) {
                            log.audit(
                                logTitle,
                                '....empty linedata: ' + JSON.stringify(lineData[i])
                            );
                            continue;
                        }

                        var serialStr = lineData[i].serial_num;
                        var serialArray = serialStr;
                        if (typeof serialArray == 'string' && serialArray.length > 0)
                            serialArray = serialStr.split(',');

                        // log.debug('xml app v2: serial array', serialArray);

                        var fulfillmentNum = null,
                            receiptNum = null;

                        if (isDropPO && mainConfig.processDropships) {
                            for (var x = 0; x < arrFulfillments.length; x++) {
                                if (arrFulfillments[x].num == numPrefix + lineData[i].order_num) {
                                    fulfillmentNum = arrFulfillments[x].id;
                                    break;
                                }
                            }

                            // log.debug('xml app v2: fulfillmentNum', fulfillmentNum);
                        } else if (!isDropPO && mainConfig.processSpecialOrders) {
                            for (var x = 0; x < arrReceipts.length; x++) {
                                if (arrReceipts[x].num == numPrefix + lineData[i].order_num) {
                                    receiptNum = arrReceipts[x].id;
                                    break;
                                }
                            }

                            // log.debug('xml app v2: receiptNum', receiptNum);
                        }

                        log.audit(
                            logTitle,
                            '.... matching fulfillment: ' +
                                JSON.stringify([lineData[i].order_num, fulfillmentNum])
                        );
                        log.audit(
                            logTitle,
                            '... matching receipt: ' +
                                JSON.stringify([lineData[i].order_num, receiptNum])
                        );

                        log.audit(logTitle, '... serialArray: ' + JSON.stringify(serialArray));

                        if (serialArray) {
                            for (var j = 0; j < serialArray.length; j++) {
                                if (serialArray[j] == '') continue;
                                var key =
                                    'IF' +
                                    fulfillmentNum +
                                    '|IR' +
                                    receiptNum +
                                    '|IT' +
                                    lineData[i].item_num;
                                //line serials
                                //									contextM.write(key, {'docid': docid, 'itemnum': lineData[i].item_num, 'custid':custID, 'orderNum': fulfillmentNum, 'receiptNum': receiptNum, serial: serialArray[j]});
                                //old
                                contextM.write(serialArray[j], {
                                    docid: docid,
                                    itemnum: lineData[i].item_num,
                                    lineData: lineData[i],
                                    custid: custID,
                                    orderNum: fulfillmentNum,
                                    receiptNum: receiptNum,
                                    linenum: lineData[i].line_num
                                });
                            }
                        }
                    }
                }
            } else {
                log.debug(
                    logTitle,
                    LogPrefix +
                        '>> SKIPPED: ' +
                        JSON.stringify({
                            createSerialDropship: mainConfig.createSerialDropship,
                            createSerialSpecialOrder: mainConfig.createSerialSpecialOrder,
                            isDropPO: isDropPO
                        })
                );
            }
        } catch (e) {
            log.error('Error encountered in map', e);
        }
    };

    //old
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

        log.debug(logTitle, LogPrefix + '>> serial data: ' + JSON.stringify(data));

        var po_record = ns_record.load({
            type: 'purchaseorder',
            id: poId,
            isDynamic: true
        });
        if (po_record != null) {
            var itemId = '';
            var vendor = po_record.getValue({ fieldId: 'entity' });
            var subsidiaryId = null;
            if (vcGlobals.ENABLE_SUBSIDIARIES)
                subsidiaryId = po_record.getValue({ fieldId: 'subsidiary' });

            var mainConfig = Helper.loadMainConfig();
            var subsidiary = Helper.getSubsidiary(poId);
            var vendorConfig = Helper.loadVendorConfig({
                vendor: vendor,
                subsidiary: subsidiary
            });
            if (!vendorConfig) throw 'Vendor Config not found';
            // log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));

            // var lineNum = vcRecord.validateline(
            //     po_record,
            //     itemNum,
            //     null,
            //     mainConfig.ingramHashSpace,
            //     vendorConfig.xmlVendor
            // );

            var lineNum = vcRecord.validateline({
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

            log.debug(logTitle, LogPrefix + '>> SalesOrder Id: ' + JSON.stringify(soId));

            var rs = ns_search.global({ keywords: serial });
            //log.debug("Global search result", rs);
            log.debug(logTitle, LogPrefix + '>> Global Search - serial: ' + serial);

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
                log.debug(logTitle, LogPrefix + '>> New Serial ID: ' + JSON.stringify(sc));
            } else if (rs.length == 1) {
                log.debug(logTitle, LogPrefix + ' >> Matching serial found');
            } else {
                log.debug(
                    logTitle,
                    LogPrefix + ' >> Multiple Duplicates ' + JSON.stringify(rs.length)
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
            log.error('Reduce Error for key: ' + key, error);
            return true;
        });
        var reduceKeys = [];
        summary.reduceSummary.keys.iterator().each(function (key) {
            reduceKeys.push(key);
            return true;
        });
        log.audit('REDUCE keys processed', reduceKeys);
        vcLog.recordLog({
            header: 'VAR Connect END',
            body: 'VAR Connect END',
            status: constants.Lists.VC_LOG_STATUS.INFO
        });

        log.debug(logTitle, '###### END OF SCRIPT ###### ');
    };

    //****************************************************************
    //** Debugging Code
    //****************************************************************
    function logXML(xmlString) {
        //log.debug("logXML");

        if (xml == '') {
            log.debug('logXML', 'No xml passed');
            return;
        }
        // log.debug('logXML code =', xmlString);
    }

    function logRowObjects(itemArray) {
        //log.debug("logRowObjects");
        if (itemArray == '') {
            log.debug('logRowObjects', 'No array present');
            return;
        }
        // log.debug('logRowObjects array =', JSON.stringify(itemArray));
    }

    return MAP_REDUCE;
});
