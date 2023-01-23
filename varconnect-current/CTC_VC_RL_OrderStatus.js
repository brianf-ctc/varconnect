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
    var ns_record = require('N/record'),
        ns_search = require('N/search'),
        ns_runtime = require('N/runtime');

    var vc_util = require('./CTC_VC2_Lib_Utils'),
        vc_websvclib = require('./CTC_VC_Lib_WebService'),
        vc_record = require('./netsuitelibrary_v2'),
        util_record = require('./CTC_VC_Lib_Record'),
        vc_log = require('./CTC_VC_Lib_Log'),
        vc_constants = require('./CTC_VC2_Constants');

    var LogTitle = 'RL_OrderStatus',
        LogPrefix = '',
        Current = {
            Data: {},
            Record: {}
        };

    var RESTLET = {
        post: function (scriptContext) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};
            try {
                var CurrentData = Current.Data,
                    CurrentRec = Current.Record;

                util.extend(CurrentData, {
                    poId: scriptContext.purchase_id || scriptContext.poId,
                    poNum: scriptContext.poNum,
                    action: scriptContext.action
                });

                log.debug(logTitle, '##### START SCRIPT ##### ' + JSON.stringify(CurrentData));
                LogPrefix = '[' + ['PO', CurrentData.poId, CurrentData.action].join(':') + '] ';

                Current.MainCFG = Helper.loadMainConfig();
                if (!Current.MainCFG) throw 'Unable to load Main Configuration';

                if (!CurrentData.poId) throw 'Missing PO ID!';
                // load the PO
                Current.Record.PO = ns_record.load({
                    type: ns_record.Type.PURCHASE_ORDER,
                    id: CurrentData.poId,
                    isDynamic: true
                });

                var PO_Data = util_record.extractValues({
                    record: Current.Record.PO,
                    fields: [
                        'tranid',
                        'trandate',
                        'subsidiary',
                        'entity',
                        'dropshipso',
                        'custbody_isdropshippo',
                        'custbody_ctc_po_link_type'
                    ]
                });
                CurrentData.PO = PO_Data;
                log.debug(logTitle, LogPrefix + '// PO Data: ' + JSON.stringify(PO_Data));

                Current.VendorCFG = Helper.loadVendorConfig({
                    vendor: PO_Data.entity,
                    vendorName: PO_Data.entity_text,
                    subsidiary: PO_Data.subsidiary
                });
                if (!Current.VendorCFG) throw 'Missing Vendor Config';

                // looup the country
                var countryCode = Current.VendorCFG.countryCode;

                CurrentData.isDropPO =
                    Current.poData.dropshipso || Current.poData.custbody_ctc_po_link_type == 'Drop Shipment';

                log.debug(logTitle, LogPrefix + '///// Initiating library webservice ....');

                var outputObj = vc_websvclib.process({
                    mainConfig: Current.MainCFG,
                    vendorConfig: Current.VendorCFG,
                    vendor: PO_Data.entity,
                    po_record: Current.Record.PO,
                    poId: Current.Data.poId,
                    poNum: PO_Data.tranid,
                    tranDate: PO_Data.trandate,
                    subsidiary: PO_Data.subsidiary,
                    countryCode: countryCode
                });
                log.debug(logTitle, LogPrefix + '>> Order Lines: ' + JSON.stringify(outputObj));

                // if there are no lines.. just exit the script
                if (!outputObj.itemArray || (!outputObj.itemArray.length && !outputObj.itemArray.header_info)) {
                    log.debug(logTitle, LogPrefix + '>> no line items to process... exiting script: ');
                    return true;
                }

                var updateStatus = vc_record.updatepo({
                    po_record: Current.Record.PO,
                    poNum: Current.Data.poId,
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
                            transaction: Current.Data.poId,
                            transactionLineKey: updateStatus.lineuniquekey,
                            status: vc_constants.Lists.VC_LOG_STATUS.ERROR
                        });
                    }
                }

                log.debug(logTitle, LogPrefix + '>> so_ID: ' + JSON.stringify(Current.soId));

                if (!vc_util.isEmpty(Current.soId)) {
                    Current.Record.SO = ns_record.load({
                        type: ns_record.Type.SALES_ORDER,
                        id: Current.soId
                    });

                    Current.Data.SO = util_record.extractValues({
                        record: Current.Record.SO,
                        fields: ['entity']
                    });
                }

                var fulfillmentData = Helper.processOrders({
                    itemArray: outputObj.itemArray
                });

                log.debug(logTitle, LogPrefix + '>> fulfillmentData: ' + JSON.stringify(fulfillmentData));

                //Logic for retrieving information and creating list of serials to be created
                if (
                    (CurrentData.isDropPO && Current.MainCFG.createSerialDropship) ||
                    (!CurrentData.isDropPO && Current.MainCFG.createSerialSpecialOrder)
                ) {
                    var numPrefix = Current.VendorCFG.fulfillmentPrefix;

                    var lineData = outputObj.itemArray;
                    // log.debug(logTitle, '>> xml app v2: MAP lineData length: ' + JSON.stringify(lineData.length));

                    // Move the searches outside of the for loop for governance issues

                    /// IF SEARCH ///////////////
                    var arrFulfillments = [];
                    var objSearchIF = ns_search.load({ id: 'customsearch_ctc_if_vendor_orders' });
                    objSearchIF.filters.push(
                        ns_search.createFilter({
                            name: 'custbody_ctc_if_vendor_order_match',
                            operator: ns_search.Operator.STARTSWITH,
                            values: numPrefix
                        })
                    );

                    var ItemFFSearchAll = vc_util.searchAllPaged({ searchObj: objSearchIF });
                    log.debug(logTitle, LogPrefix + '>> Total Results [IF]: ' + ItemFFSearchAll.length);

                    ItemFFSearchAll.forEach(function (result) {
                        arrFulfillments.push({
                            id: result.id,
                            num: result.getValue('custbody_ctc_if_vendor_order_match')
                        });
                        return true;
                    });
                    log.debug(logTitle, LogPrefix + '>> arrFulfillments: ' + JSON.stringify(arrFulfillments.length));
                    //////////////////////////////////////////////////

                    /// IR SEARCH /////////////////
                    var arrReceipts = [];
                    var objSearchIR = ns_search.load({ id: 'customsearch_ctc_ir_vendor_orders' });
                    objSearchIR.filters.push(
                        ns_search.createFilter({
                            name: 'custbody_ctc_if_vendor_order_match',
                            operator: ns_search.Operator.STARTSWITH,
                            values: numPrefix
                        })
                    );
                    var ItemRcptSearchAll = vc_util.searchAllPaged({
                        searchObj: objSearchIR
                    });

                    ItemRcptSearchAll.forEach(function (result) {
                        arrReceipts.push({
                            id: result.id,
                            num: result.getValue('custbody_ctc_if_vendor_order_match')
                        });
                        return true;
                    });
                    log.debug(logTitle, LogPrefix + '>> arrReceipts: ' + JSON.stringify(arrReceipts.length));
                    //////////////////////////////////////////////////

                    log.debug(logTitle, LogPrefix + '>> lineData: ' + lineData.length);

                    if (lineData && lineData.length) {
                        for (var i = 0; i < lineData.length; i++) {
                            if (!lineData[i]) {
                                log.audit(logTitle, '....empty linedata: ' + JSON.stringify(lineData[i]));
                                continue;
                            }

                            var serialStr = lineData[i].serial_num;
                            var serialArray = serialStr;
                            if (typeof serialArray == 'string' && serialArray.length > 0)
                                serialArray = serialStr.split(',');

                            // log.debug('xml app v2: serial array', serialArray);

                            var fulfillmentNum = null,
                                receiptNum = null;

                            if (CurrentData.isDropPO && Current.MainCFG.processDropships) {
                                for (var x = 0; x < arrFulfillments.length; x++) {
                                    if (arrFulfillments[x].num == numPrefix + lineData[i].order_num) {
                                        fulfillmentNum = arrFulfillments[x].id;
                                        break;
                                    }
                                }

                                // log.debug('xml app v2: fulfillmentNum', fulfillmentNum);
                            } else if (!CurrentData.isDropPO && Current.MainCFG.processSpecialOrders) {
                                for (var x = 0; x < arrReceipts.length; x++) {
                                    if (arrReceipts[x].num == numPrefix + lineData[i].order_num) {
                                        receiptNum = arrReceipts[x].id;
                                        break;
                                    }
                                }

                                // log.debug('xml app v2: receiptNum', receiptNum);
                            }

                            if (fulfillmentNum)
                                log.audit(
                                    logTitle,
                                    '.... matching fulfillment: ' +
                                        JSON.stringify([lineData[i].order_num, fulfillmentNum])
                                );

                            if (receiptNum)
                                log.audit(
                                    logTitle,
                                    '... matching receipt: ' + JSON.stringify([lineData[i].order_num, receiptNum])
                                );

                            log.audit(logTitle, '... serialArray: ' + JSON.stringify(serialArray));
                            if (serialArray) {
                                for (var ii = 0; ii < serialArray.length; ii++) {
                                    if (serialArray[ii] == '') continue;

                                    contextM.write(serialArray[ii], {
                                        docid: Current.Data.poId,
                                        itemnum: lineData[i].item_num,
                                        lineData: lineData[i],
                                        custid: Current.Data.SO.entity,
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
                                createSerialDropship: Current.MainCFG.createSerialDropship,
                                createSerialSpecialOrder: Current.MainCFG.createSerialSpecialOrder,
                                isDropPO: CurrentData.isDropPO
                            })
                    );
                }
            } catch (e) {
                util.extend(returnObj, {
                    msg: error.msg || vc_util.extractError(error),
                    details: returnObj.details || JSON.stringify(error),
                    isError: true
                });

                log.debug(logTitle, LogPrefix + '!! ERROR !! ' + JSON.stringify(error));
            } finally {
                log.debug(logTitle, '##### EXIT SCRIPT ##### ' + JSON.stringify(returnObj));
            }

            return returnObj;
        }
    };

    var Helper = {
        validateLicense: function (option) {
            var logTitle = [LogTitle, 'validateLicense'].join('::');
            // log.audit(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));
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
            // log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var vendor = option.vendor,
                vendorName = option.vendorName,
                subsidiary = option.subsidiary,
                vendorConfig = vc_vendorcfg.getVendorConfiguration({
                    vendor: vendor,
                    subsidiary: subsidiary
                });

            if (!vendorConfig) {
                log.audit(logTitle, 'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName);
            }

            log.debug(logTitle, LogPrefix + '>> vendorConfig: ' + JSON.stringify(vendorConfig));
            return vendorConfig;
        },
        processOrders: function (option) {
            var logTitle = [LogTitle, 'processOrders'].join('::');
            // log.debug(logTitle, LogPrefix + '>> option: ' + JSON.stringify(option));

            var CurrentData = Current.Data,
                PO_Data = CurrentData.PO,
                CurrentRec = Current.Record;

            var itemArray = option.itemArray,
                fulfillmentData = false;

            try {
                log.audit(logTitle, LogPrefix + '>>>>  Is Drop PO? ' + JSON.stringify(CurrentData.isDropPO));
                if (CurrentData.isDropPO) {
                    // lets require the SO record here
                    if (!CurrentRec.SO) throw 'Unable to fulfill without a valid SO record';

                    //// FULFILLMENT CREATION  /////////////////
                    log.audit(
                        logTitle,
                        LogPrefix +
                            '>> Fulfillment Creation Settings << ' +
                            JSON.stringify({
                                'mainConfig.processDropships': Current.MainCFG.processDropships,
                                'vendorConfig.processDropships': vendorConfig.processDropships,
                                'mainConfig.createIF': Current.MainCFG.createIF
                            })
                    );

                    if (Current.MainCFG.processDropships && vendorConfig.processDropships && Current.MainCFG.createIF) {
                        fulfillmentData = vc_itemfflib.updateItemFulfillments({
                            mainConfig: Current.MainCFG,
                            vendorConfig: vendorConfig,
                            poId: CurrentData.poId,
                            recSalesOrd: CurrentRec.SO,
                            recPurchOrd: CurrentRec.PO,
                            lineData: itemArray,
                            vendor: PO_Data.entity
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
                                'mainConfig.processSpecialOrders': Current.MainCFG.processSpecialOrders,
                                'vendorConfig.processSpecialOrders': vendorConfig.processSpecialOrders,
                                'mainConfig.createIR': Current.MainCFG.createIR
                            })
                    );

                    if (
                        Current.MainCFG.processSpecialOrders &&
                        vendorConfig.processSpecialOrders &&
                        Current.MainCFG.createIR
                    ) {
                        fulfillmentData = vc_itemrcpt.updateIR({
                            mainConfig: Current.MainCFG,
                            vendorConfig: vendorConfig,
                            poId: CurrentData.poId,
                            lineData: itemArray,
                            vendor: PO_Data.entity
                        });
                    } else {
                        log.audit(logTitle, LogPrefix + '*** Item Receipt Creation not allowed ***');
                    }
                    /////////////////////////////////////////////
                }
            } catch (e) {
                log.error(logTitle, LogPrefix + 'Error creating fulfillment/receipt : ' + JSON.stringify(e));

                vc_log.recordLog({
                    header: 'Fulfillment/Receipt Creation | Error',
                    body: vc_util.extractError(e),
                    transaction: CurrentData.poId,
                    status: vc_constants.Lists.VC_LOG_STATUS.ERROR
                });

                throw e;
            }

            return fulfillmentData;
        }
    };

    return RESTLET;
});
