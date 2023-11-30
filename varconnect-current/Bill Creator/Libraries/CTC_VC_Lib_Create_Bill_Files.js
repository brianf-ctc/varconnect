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
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([
    'N/search',
    'N/record',
    'N/format',
    'N/config',
    'N/https',
    './../../CTC_VC2_Constants',
    './../../CTC_VC2_Lib_Utils',
    './../../CTC_VC_Lib_MainConfiguration',
    './moment'
], function (
    ns_search,
    ns_record,
    ns_format,
    ns_config,
    ns_https,
    vc2_constant,
    vc2_util,
    vc_mainCfg,
    moment
) {
    var LogTitle = 'LIB::BillFiles',
        LogPrefix;

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    var MainConfig = null;

    var Helper = {
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (Helper.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::'),
                returnValue;

            var dateString = option.dateString || option,
                dateValue = '';

            try {
                if (dateString && dateString.length > 0 && dateString != 'NA') {
                    dateValue = moment(dateString).toDate();
                }

                //Convert to string
                if (dateValue) {
                    dateValue = ns_format.format({
                        value: dateValue,
                        type: ns_format.Type.DATE
                    });
                }

                returnValue = dateValue;
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                throw error;
            } finally {
                log.audit(
                    logTitle,
                    LogPrefix +
                        ('Parsed Date [' + dateString + ']: ') +
                        JSON.stringify([dateValue, typeof dateValue])
                );
            }
            return returnValue;
        },
        extractVendorItemNames: function (option) {
            var logTitle = [LogTitle, 'extractVendorItemNames'].join('::'),
                returnValue = option.lines || option;

            try {
                var GlobalVar = vc2_constant.GLOBAL,
                    ItemMapRecordVar = vc2_constant.RECORD.VENDOR_ITEM_MAPPING;
                if (returnValue && returnValue.length) {
                    var uniqueItemIds = [];
                    for (var i = 0, len = returnValue.length; i < len; i += 1) {
                        var lineData = returnValue[i];
                        if (!vc2_util.inArray(lineData.item, uniqueItemIds)) {
                            uniqueItemIds.push(lineData.item);
                        }
                    }
                    log.debug(
                        logTitle,
                        'Lookup items for assigned vendor names... ' + uniqueItemIds.join(', ')
                    );
                    if (uniqueItemIds.length) {
                        var searchOption = {
                            type: ItemMapRecordVar.ID,
                            filterExpression: [
                                [ItemMapRecordVar.FIELD.ITEM, 'anyof', uniqueItemIds],
                                'and',
                                ['isinactive', 'is', 'F']
                            ],
                            columns: [ItemMapRecordVar.FIELD.NAME, ItemMapRecordVar.FIELD.ITEM]
                        };
                        var searchResults = vc2_util.searchAllPaged(searchOption);
                        if (searchResults && searchResults.length) {
                            var vendorItemMap = {};
                            searchResults.forEach(function (result) {
                                var vendorItemName = result.getValue({
                                        name: ItemMapRecordVar.FIELD.NAME
                                    }),
                                    item = result.getValue({ name: ItemMapRecordVar.FIELD.ITEM });
                                if (!vendorItemMap[item]) vendorItemMap[item] = [];
                                vendorItemMap[item].push(vendorItemName);
                                return true;
                            });
                            for (var i = 0, len = returnValue.length; i < len; i += 1) {
                                var lineData = returnValue[i],
                                    vendorItemNames = vendorItemMap[lineData.item];
                                if (vendorItemNames && vendorItemNames.length) {
                                    lineData[GlobalVar.INCLUDE_ITEM_MAPPING_LOOKUP_KEY] =
                                        vendorItemNames.join('\n');
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to extract vendor item names',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        searchPO: function (poName) {
            var logTitle = [LogTitle, 'searchPO'].join('::'),
                returnValue;

            log.audit(logTitle, LogPrefix + '// search for existing PO: ' + poName);

            var searchObj = ns_search.create({
                type: 'purchaseorder',
                filters: [
                    MainConfig.overridePONum
                        ? [
                              ['numbertext', 'is', poName],
                              'OR',
                              ['custbody_ctc_vc_override_ponum', 'is', poName]
                          ]
                        : ['numbertext', 'is', poName],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'PurchOrd']
                ],
                columns: [
                    'trandate',
                    'postingperiod',
                    'type',
                    MainConfig.overridePONum ? 'custbody_ctc_vc_override_ponum' : 'tranid',
                    'tranid',
                    'entity',
                    'amount',
                    'internalid'
                ]
            });

            var poData = false;
            if (searchObj.runPaged().count) {
                var searchResult = searchObj.run().getRange({ start: 0, end: 1 }).shift();

                poData = {
                    id: searchResult.getValue({ name: 'internalid' }),
                    entityId: searchResult.getValue({ name: 'entity' }),
                    tranId: searchResult.getValue({ name: 'tranid' }),
                    date: searchResult.getValue({ name: 'trandate' })
                };
            }
            returnValue = poData;
            log.audit(logTitle, LogPrefix + '... PO Data : ' + JSON.stringify(poData));

            return returnValue;
        },
        billFileExists: function (option) {
            var logTitle = [LogTitle, 'searchBillFile'].join('::'),
                returnValue;

            var parsedDate = parseDate({ dateString: option.date });
            var searchObj = ns_search.create({
                type: 'customrecord_ctc_vc_bills',
                filters: [
                    ['custrecord_ctc_vc_bill_number', 'is', option.invoice],
                    'AND',
                    ['custrecord_ctc_vc_bill_date', 'on', parsedDate],
                    'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: ['id']
            });
            returnValue = searchObj.runPaged().count;

            return !!returnValue;
        },
        collectItemsFromPO: function (option) {
            var logTitle = [LogTitle, 'collectItemsFromPO'],
                returnValue = [];

            if (!option.poId) return false;

            var itemSearch = ns_search.create({
                type: 'transaction',
                filters: [['internalid', 'anyof', option.poId], 'AND', ['mainline', 'is', 'F']],
                columns: [
                    ns_search.createColumn({
                        name: 'item',
                        summary: 'GROUP'
                    })
                ]
            });

            var arrSKUs = [];
            itemSearch.run().each(function (result) {
                arrSKUs.push({
                    text: result.getText({
                        name: 'item',
                        summary: 'GROUP'
                    }),
                    itemNum: result.getText({
                        name: 'item',
                        summary: 'GROUP'
                    }),
                    value: result.getValue({
                        name: 'item',
                        summary: 'GROUP'
                    })
                });
                return true;
            });
            returnValue = arrSKUs;

            var arrPOItems = [];
            arrSKUs.forEach(function (skuDetails) {
                arrPOItems.push({ item: skuDetails.value });
                return true;
            });
            var arrSKUsVendorNames = Helper.extractVendorItemNames({ lines: arrPOItems });
            vc2_util.log(logTitle, '// arrSKUsVendorNames: ', arrSKUsVendorNames);

            for (var i = 0, len = arrSKUs.length; i < len; i += 1) {
                arrSKUs[i].vendorItemName =
                    arrSKUsVendorNames[i][vc2_constant.GLOBAL.INCLUDE_ITEM_MAPPING_LOOKUP_KEY];
                // return true;
            }

            return returnValue;
        },
        loadVendorConfig: function (option) {
            var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
                returnValue;
            var entityId = option.entity;
            var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

            try {
                var searchOption = {
                    type: 'vendor',
                    filters: [['internalid', 'anyof', entityId]],
                    columns: []
                };

                for (var field in BILLCREATE_CFG.FIELD) {
                    searchOption.columns.push(
                        ns_search.createColumn({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        })
                    );
                }

                var searchObj = ns_search.create(searchOption);
                if (!searchObj.runPaged().count) throw 'No config available';

                returnValue = {};
                searchObj.run().each(function (row) {
                    for (var field in BILLCREATE_CFG.FIELD) {
                        returnValue[field] = row.getValue({
                            name: BILLCREATE_CFG.FIELD[field],
                            join: vc2_constant.FIELD.ENTITY.BILLCONFIG
                        });
                    }
                    return true;
                });

                log.audit(logTitle, LogPrefix + '// config: ' + JSON.stringify(returnValue));
            } catch (error) {
                log.audit(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
            }

            return returnValue;
        },
        isItemMatchRL: function (option) {
            var logTitle = [LogTitle, 'isFuseMatch'].join('::'),
                returnValue = false;

            try {
                var fuzzyResp = ns_https.requestRestlet({
                    headers: { 'Content-Type': 'application/json' },
                    scriptId: vc2_constant.SCRIPT.ITEM_MATCH_RL,
                    deploymentId: vc2_constant.DEPLOYMENT.ITEM_MATCH_RL,
                    method: 'POST',
                    body: JSON.stringify({
                        list: option.list,
                        keys: option.searchKeys,
                        searchValue: option.value
                    })
                });
                var results = JSON.parse(fuzzyResp.body);
                log.audit(logTitle, LogPrefix + '/// Fuse match: ' + JSON.stringify(results));

                if (results.match) {
                    returnValue = true;
                }
            } catch (match_error) {
                log.audit(logTitle, LogPrefix + '// Match error: ' + JSON.stringify(match_error));
            }

            return returnValue;
        }
    };

    var dateFormat;
    function parseDate(option) {
        var logTitle = [LogTitle, 'parseDate'].join('::');
        log.audit(logTitle, '>> options: ' + JSON.stringify(option));

        var dateString = option.dateString || option,
            dateValue = '';

        if (dateString && dateString.length > 0 && dateString != 'NA') {
            try {
                dateValue = moment(dateString).toDate();
            } catch (e) {
                log.error(logTitle, '>> !! ERROR !! ' + util.extractError(e));
            }
        }
        log.audit(
            logTitle,
            'Parsed Date :' + dateString + ' : ' + JSON.stringify([dateValue, typeof dateValue])
        );
        // return date;
        //Convert to string
        if (dateValue) {
            dateValue = ns_format.format({
                value: dateValue,
                type: ns_format.Type.DATE
            });
        }

        log.audit(logTitle, 'return value :' + JSON.stringify([dateValue, typeof dateValue]));

        return dateValue;
    }

    function process(configObj, myArr, name) {
        var logTitle = [LogTitle, 'process'].join('::');

        vc2_util.log(logTitle, '**** START process ****  ');
        vc2_util.log(logTitle, '>> configObj: ', configObj);
        vc2_util.log(logTitle, '>> myArr: ', myArr);
        vc2_util.log(logTitle, '>> name: ', name);

        if (!MainConfig) {
            MainConfig = vc_mainCfg.getMainConfiguration();
            if (!MainConfig) {
                log.error(logTitle, 'No Configuration available');
            }
        }

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
        }

        try {
            if (!myArr || !myArr.length) throw 'Empty response';
            
            for (var i = 0; i < myArr.length; i++) {
                var currentOrder = myArr[i].ordObj;
                LogPrefix = '[bill:' + currentOrder.invoice + '] ';
                vc2_util.LogPrefix = '[bill:' + currentOrder.invoice + '] ';

                vc2_util.log(logTitle, '###### PROCESSING [' + currentOrder.invoice + '] ######');
                log.audit(logTitle, { idx: i, data: myArr[i] });

                log.audit(logTitle, LogPrefix + '// Look for existing bills...');
                if (Helper.billFileExists(currentOrder)) {
                    log.audit(logTitle, LogPrefix + '...already exists, skipping');
                    continue;
                }

                log.audit(logTitle, LogPrefix + ' /// Initiate bill file record.');
                var billFileNotes = [];
                var billFileValues = {
                    name: name,
                    custrecord_ctc_vc_bill_file_position: i + 1,
                    custrecord_ctc_vc_bill_po: currentOrder.po,
                    custrecord_ctc_vc_bill_number: currentOrder.invoice,
                    custrecord_ctc_vc_bill_date: moment(currentOrder.date).toDate(),
                    custrecord_ctc_vc_bill_proc_status: 1,
                    custrecord_ctc_vc_bill_integration: configObj.id,
                    custrecord_ctc_vc_bill_src: myArr[i].xmlStr
                };

                var dueDate = null,
                    manualDueDate = false;

                if (currentOrder.hasOwnProperty('duedate') == true) {
                    dueDate = currentOrder.duedate;
                    manualDueDate = true;
                }

                var poData = Helper.searchPO(currentOrder.po.trim());
                if (!poData) {
                    billFileNotes.push('PO Link is not found : [' + currentOrder.po + ']');
                } else {
                    // load the vendor config
                    var vendorCfg = Helper.loadVendorConfig({
                        entity: poData.entityId
                    });

                    billFileValues.custrecord_ctc_vc_bill_linked_po = poData.id;
                    billFileNotes.push('Linked to PO: ' + poData.tranId + ' (' + poData.id + ') ');

                    ///////////////////////////////////
                    //For Ergo:  Cisco, Dell, EMC, Scansource, Westcon
                    // if (Helper.inArray(poData.entityId, ['75', '203', '216', '371', '496'])) {
                    //     billFileValues.custrecord_ctc_vc_bill_is_recievable = true;
                    // }

                    if (vendorCfg.ENABLE_FULFILLLMENT)
                        billFileValues.custrecord_ctc_vc_bill_is_recievable = true;

                    var vendorTerms = 0;
                    var searchTerms = ns_search.lookupFields({
                        type: ns_search.Type.VENDOR,
                        id: poData.entityId,
                        columns: ['terms']
                    });

                    if (searchTerms.terms.length > 0) {
                        vendorTerms = searchTerms.terms[0].value;

                        if (!manualDueDate) {
                            var daysToPay = ns_search.lookupFields({
                                type: ns_search.Type.TERM,
                                id: vendorTerms,
                                columns: ['daysuntilnetdue']
                            }).daysuntilnetdue;

                            dueDate = moment(currentOrder.date)
                                .add(parseInt(daysToPay), 'days')
                                .format('MM/DD/YYYY');
                        }
                    }
                }

                if (dueDate !== null) {
                    billFileValues.custrecord_ctc_vc_bill_due_date = moment(dueDate).toDate();
                    if (manualDueDate) {
                        billFileValues.custrecord_ctc_vc_bill_due_date_f_file = true;
                    }
                }

                var ii;
                if (poData.id) {
                    // match payload items to transaction items
                    var availableSkus = Helper.collectItemsFromPO({
                        poId: poData.id
                    });
                    var arrMatchedSKU = [];

                    for (ii = 0; ii < currentOrder.lines.length; ii++) {
                        var itemNo = currentOrder.lines[ii].ITEMNO;

                        var logPrefix = LogPrefix + '// search for matching item [' + itemNo + '] ';

                        var matchedSku = false;

                        for (var iii = 0; iii < availableSkus.length; iii++) {
                            if (
                                availableSkus[iii].text == itemNo ||
                                availableSkus[iii].vendorItemName == itemNo
                            ) {
                                matchedSku = availableSkus[iii].value;
                                break;
                            }
                        }
                        log.audit(
                            logTitle,
                            logPrefix + '.. exact match ? ' + JSON.stringify(matchedSku)
                        );

                        if (!matchedSku) {
                            matchedSku = Helper.isItemMatchRL({
                                list: availableSkus,
                                searchKeys: ['text'],
                                value: itemNo
                            });

                            log.audit(
                                logTitle,
                                logPrefix + '.. fuzzy match ? ' + JSON.stringify(matchedSku)
                            );
                        }

                        if (!matchedSku) {
                            billFileNotes.push('Not matched SKU: ' + itemNo);
                            log.audit(logTitle, logPrefix + '.. match not found. ');
                        } else {
                            currentOrder.lines[ii].NSITEM = matchedSku;
                            arrMatchedSKU.push(matchedSku);
                        }
                    }

                    log.audit(
                        logTitle,
                        LogPrefix + '... matched items: ' + JSON.stringify(arrMatchedSKU)
                    );

                    if (arrMatchedSKU.length) {
                        billFileNotes.push('Matched SKU: ' + arrMatchedSKU.length);
                    }
                } else {
                    for (ii = 0; ii < currentOrder.lines.length; ii++) {
                        currentOrder.lines[ii].NSITEM = '';
                    }
                }
                billFileValues.custrecord_ctc_vc_bill_json = JSON.stringify(currentOrder);
                billFileValues.custrecord_ctc_vc_bill_log = addNote({
                    note: billFileNotes.join(' | ')
                });

                // create the bill file record
                var objRecord = ns_record.create({
                    type: 'customrecord_ctc_vc_bills',
                    isDynamic: true
                });

                for (var fieldId in billFileValues) {
                    objRecord.setValue({
                        fieldId: fieldId,
                        value: billFileValues[fieldId]
                    });
                }
                var record_id = objRecord.save();

                vc2_util.vcLog({
                    title: 'Bill File',
                    message: 'Created bill file |' + [record_id, billFileValues.name].join(' - '),
                    details: billFileValues,
                    status: LOG_STATUS.SUCCESS
                });

                log.audit(logTitle, '>> Bill File created: ' + record_id);
            }
        } catch (error) {
            vc2_util.logError(logTitle, error);
            throw error;
        }

        log.audit(logTitle, '**** END process ****  ');

        return null;
    }

    function addNote(option) {
        var logTitle = [LogTitle, 'addNote'].join('::');

        log.audit(logTitle, option);

        var billFileId = option.billFileId || option.billId || option.id,
            notes = option.note || option.notes || option.content,
            allNotes = option.all || option.allNotes || option.current || '';

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
        }

        // get the current notes
        if (billFileId) {
            var recData = ns_search.lookupFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                columns: ['custrecord_ctc_vc_bill_log']
            });
            allNotes = recData.custrecord_ctc_vc_bill_log;
        }
        if (notes) allNotes = allNotes + '\r\n' + moment().format('MM/DD/YYYY') + ' - ' + notes;

        // lets simplify ///
        // first, split up the notes by date, and make each an object
        var arrNotes = [];
        allNotes.split(/\r\n/).map(function (line) {
            if (arrNotes.indexOf(line) < 0) arrNotes.push(line);
            return true;
        });
        var newNoteStr = arrNotes.join('\r\n');

        if (billFileId) {
            // update
            ns_record.submitFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                values: {
                    custrecord_ctc_vc_bill_log: newNoteStr
                },
                options: {
                    ignoreMandatoryFields: true
                }
            });
        }

        return newNoteStr;
    }

    // Add the return statement that identifies the entry point function.
    return {
        mainConfig: MainConfig,
        process: process,
        addNote: addNote
    };
});
