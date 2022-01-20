/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/log',
    'N/xml',
    'N/https',
    './CTC_Create_Item_Fulfillment',
    './netsuitelibrary_v2.js',
    './VC_Globals',
    './CTC_Create_Item_Receipt',
    './CTC_VC_Lib_MainConfiguration',
    './CTC_VC_Lib_VendorConfig',
    './CTC_VC_Lib_WebService',
    './CTC_VC_Lib_LicenseValidator',
    './CTC_VC_Lib_Utilities',
    './CTC_VC_Constants.js',
    './CTC_VC_Lib_Log.js'
], function (
    search,
    runtime,
    r,
    log,
    xml,
    https,
    createIF,
    libcode,
    vcGlobals,
    createIR,
    libMainConfig,
    libVendorConfig,
    libWebService,
    libLicenseValidator,
    util,
    constants,
    vcLog
) {
    var LogTitle = 'MR_OrderStatus';
    var LogPrefix = '';

    var Helper = {
        logMsg: function (option) {
            option = option || {};

            var logOption = {
                transaction: option.tranId || option.transactionId,
                header: [LogTitle, option.title ? '::' + option.title : null].join(''),
                body:
                    option.message ||
                    option.note ||
                    (option.error ? util.extractError(option.error) : option.errorMsg),
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
        }
    };

    function _validateLicense(options) {
        var logTitle = [LogTitle, 'validateLicense'].join('::');
        log.debug(logTitle, LogPrefix + '>> options: ' + JSON.stringify(options));

        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            response = libLicenseValidator.callValidationSuitelet({
                license: license,
                external: true
            });

        if (response == 'invalid')
            throw new Error(
                'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
            );
    }

    function _loadMainConfig() {
        var mainConfig = libMainConfig.getMainConfiguration();

        if (!mainConfig) {
            log.error('No Coniguration available');
            throw new Error('No Coniguration available');
        } else return mainConfig;
    }

    function _loadVendorConfig(options) {
        var logTitle = [LogTitle, 'loadVendorConfig'].join('::');
        log.debug(logTitle, LogPrefix + '>> options: ' + JSON.stringify(options));

        var vendor = options.vendor,
            subsidiary = options.subsidiary,
            vendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: vendor,
                subsidiary: subsidiary
            });

        if (!vendorConfig) {
            log.error(
                'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary
            );
        } else return vendorConfig;
    }

    function _processDropshipsAndSpecialOrders(options) {
        var logTitle = [LogTitle, 'processDropshipsAndSpecialOrders'].join('::');
        log.debug(logTitle, LogPrefix + '>> options: ' + JSON.stringify(options));

        var mainConfig = options.mainConfig,
            vendorConfig = options.vendorConfig,
            isDropPO = options.isDropPO,
            docid = options.docid,
            so_ID = options.soID,
            itemArray = options.itemArray,
            vendor = options.vendor,
            fulfillmentData;

        try {
            if (
                mainConfig.processDropships &&
                vendorConfig.processDropships &&
                mainConfig.createIF &&
                isDropPO
            ) {
                fulfillmentData = createIF.updateIF({
                    mainConfig: mainConfig,
                    vendorConfig: vendorConfig,
                    poId: docid,
                    soId: so_ID,
                    lineData: itemArray,
                    vendor: vendor
                });
            } else if (
                mainConfig.processSpecialOrders &&
                vendorConfig.processSpecialOrders &&
                mainConfig.createIR &&
                !isDropPO
            ) {
                fulfillmentData = createIR.updateIR({
                    mainConfig: mainConfig,
                    vendorConfig: vendorConfig,
                    poId: docid,
                    lineData: itemArray,
                    vendor: vendor
                });
            }
        } catch (e) {
            log.error(logTitle, 'Error creating fulfillment/receipt : ' + JSON.stringify(e));
        }

        return fulfillmentData;
    }

    function _getSubsidiary(poId) {
        var logTitle = [LogTitle, 'getSubsidiary'].join('::');
        log.debug(logTitle, LogPrefix + '>> poId: ' + JSON.stringify(poId));

        var subsidiary = null;

        if (vcGlobals.ENABLE_SUBSIDIARIES) {
            var lookupObj = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: poId,
                columns: 'subsidiary'
            });
            subsidiary = lookupObj.subsidiary[0].value;
        }

        return subsidiary;
    }

    function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join('::');
        log.debug(logTitle, '###### START OF SCRIPT ######');

        //return saved search for company to get list of purchase orders
        vcLog.recordLog({
            header: 'VAR Connect START',
            body: 'VAR Connect START',
            status: constants.Lists.VC_LOG_STATUS.INFO
        });
        var searchId = runtime.getCurrentScript().getParameter('custscript_searchid2');
        var vendor = runtime.getCurrentScript().getParameter('custscript_vendor2');

        var mainConfig = _loadMainConfig();
        log.debug(logTitle, '>> mainConfig: ' + JSON.stringify(mainConfig));

        _validateLicense({ mainConfig: mainConfig });

        if (searchId != null && (mainConfig.processDropships || mainConfig.processSpecialOrders)) {
            return search.load({ id: searchId });
        }

        return false;
    }

    function map(contextM) {
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

            var subsidiary = _getSubsidiary(docid);
            var mainConfig = _loadMainConfig();
            var vendorConfig = _loadVendorConfig({
                vendor: vendor,
                subsidiary: subsidiary
            });

            log.debug(logTitle, LogPrefix + '>> subsidiary: ' + JSON.stringify(subsidiary));
            log.debug(logTitle, LogPrefix + '>> mainConfig: ' + JSON.stringify(mainConfig));
            log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));

            if (vendorConfig) {
                var po_record = r.load({
                    type: 'purchaseorder',
                    id: docid,
                    isDynamic: true
                });

                isDropPO = po_record.getValue({
                    fieldId: 'dropshipso'
                });

                //			var isDropPO = po_record.getValue({ fieldId: 'custbody_ctc_po_link_type '}) == 'Drop Shipment';

                log.debug(logTitle, LogPrefix + '>> Initiating library webservice ....');

                outputObj = libWebService.process({
                    mainConfig: mainConfig,
                    vendorConfig: vendorConfig,
                    vendor: vendor,
                    po_record: po_record,
                    poId: docid,
                    poNum: docnum,
                    tranDate: tranDate,
                    subsidiary: subsidiary
                });
                log.debug(logTitle, LogPrefix + '>> outputObj: ' + JSON.stringify(outputObj));

                so_ID = libcode.updatepo({
                    po_record: po_record,
                    poNum: docid,
                    lineData: outputObj.itemArray,
                    mainConfig: mainConfig,
                    vendorConfig: vendorConfig
                });

                log.debug(logTitle, LogPrefix + '>> so_ID: ' + JSON.stringify(so_ID));

                if (so_ID != null && so_ID != undefined) {
                    var so_rec = r.load({
                        type: r.Type.SALES_ORDER,
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

                    var fulfillmentData = _processDropshipsAndSpecialOrders(params);
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
                    var ifSearch = search.load({ id: 'customsearch_ctc_if_vendor_orders' });
                    var ifFilters = search.createFilter({
                        name: 'custbody_ctc_if_vendor_order_match',
                        operator: search.Operator.STARTSWITH,
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
                    log.debug(
                        logTitle,
                        LogPrefix + '>> arrFulfillments: ' + JSON.stringify(arrFulfillments)
                    );

                    var arrReceipts = [];
                    var ifSearch = search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
                    var ifFilters = search.createFilter({
                        name: 'custbody_ctc_if_vendor_order_match',
                        operator: search.Operator.STARTSWITH,
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
                    log.debug(
                        logTitle,
                        LogPrefix + '>> arrReceipts: ' + JSON.stringify(arrReceipts)
                    );

                    for (var i = 0; i < lineData.length; i++) {
                        if (lineData) {
                            var serialStr = lineData[i].serial_num;
                            var serialArray = serialStr;
                            if (typeof serialArray == 'string' && serialArray.length > 0)
                                serialArray = serialStr.split(',');

                            // log.debug('xml app v2: serial array', serialArray);

                            var fulfillmentNum = null,
                                receiptNum = null;

                            if (isDropPO && mainConfig.processDropships) {
                                for (var x = 0; x < arrFulfillments.length; x++) {
                                    if (
                                        arrFulfillments[x].num ==
                                        numPrefix + lineData[i].order_num
                                    ) {
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
                                        custid: custID,
                                        orderNum: fulfillmentNum,
                                        receiptNum: receiptNum,
                                        linenum: lineData[i].line_num
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            log.error('Error encountered in map', e);
        }
    }

    //old
    function reduce(context) {
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

        var po_record = r.load({
            type: 'purchaseorder',
            id: poId,
            isDynamic: true
        });
        if (po_record != null) {
            var itemId = '';
            var vendor = po_record.getValue({ fieldId: 'entity' });
            var subsidiary = null;
            if (vcGlobals.ENABLE_SUBSIDIARIES)
                subsidiary = po_record.getValue({ fieldId: 'subsidiary' });

            var mainConfig = _loadMainConfig();
            var vendorConfig = _loadVendorConfig({
                vendor: vendor,
                subsidiary: subsidiary
            });

            var lineNum = libcode.validateline(
                po_record,
                itemNum,
                null,
                mainConfig.ingramHashSpace,
                vendorConfig.xmlVendor
            );
            if (lineNum != null) {
                var itemId = po_record.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: lineNum
                });
            }
            //log.debug('Reduce ItemId', itemId);

            var soId = '';
            var soId = po_record.getValue({
                fieldId: 'createdfrom'
            });

            log.debug(logTitle, LogPrefix + '>> SalesOrder Id: ' + JSON.stringify(soId));

            var rs = search.global({ keywords: serial });
            //log.debug("Global search result", rs);
            log.debug(logTitle, LogPrefix + '>> Global Search - serial: ' + serial);

            if (rs.length == 0) {
                // log.debug('xml app v2: saveSerial', serial);

                var sn_record = r.create({
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
    }

    function summarize(summary) {
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
    }

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

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
