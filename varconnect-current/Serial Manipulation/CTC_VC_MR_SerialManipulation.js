/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
 * @Description Creates and/or updates serial nunmbrs and associates them to the speicifed transaction/s
 */

/**
 * Project Number: 001225
 * Script Name: CT MR Serial Manipulation
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.10		Aug 24, 2020	paolodl@nscatalyst.com	Check main config for feature enablement
 *
 */
define([
    'N/record',
    'N/search',
    'N/runtime',
    'N/email',
    '../CTC_VC2_Constants.js',
    '../CTC_VC_Lib_MainConfiguration.js',
    '../CTC_VC_Lib_LicenseValidator',
    '../CTC_VC2_Lib_Utils'
], function (
    ns_record,
    ns_search,
    ns_runtime,
    ns_email,
    vc2_constant,
    vc_maincfg,
    vc_license,
    vc2_utils
) {
    var LogTitle = 'MR_LinkSerials',
        LogPrefix = '',
        PARAM = {};

    var CONST_COLUMN = vc2_constant.FIELD.TRANSACTION;

    var MAP_REDUCE = {
        getInputData: function () {
            var logTitle = [LogTitle, 'getInputData'].join('::');
            var returnData = [];

            try {
                var currentScript = ns_runtime.getCurrentScript();
                PARAM = {
                    recordType: currentScript.getParameter('custscript_vc_type'),
                    recordId: currentScript.getParameter('custscript_vc_id')
                };
                log.debug(logTitle, '>> PARAMS: ' + JSON.stringify(PARAM));
                LogPrefix = '[' + [PARAM.recordType, PARAM.recordId].join(':') + '] ';

                if (!PARAM.recordType || !PARAM.recordId) throw 'Missing record details';

                var mainConfig = Helper.loadMainConfig();

                Helper.validateLicense({ mainConfig: mainConfig });

                if (!mainConfig || !mainConfig.serialScanUpdate) {
                    //Terminate if Serials Scan and Update functionality is not set
                    throw 'Serials Scan and Update functionality is not set';
                }

                var record = ns_record.load({ type: PARAM.recordType, id: PARAM.recordId });
                if (!record) throw 'Invalid record';

                var SERIALFLD = vc2_constant.RECORD.SERIALS.FIELD;
                var recordData = {
                    createdfrom: record.getValue({ fieldId: 'createdfrom' }),
                    recordType: record.type,
                    salesOrderId: null
                };
                var createdFromData = vc2_utils.flatLookup({
                    type: ns_search.Type.TRANSACTION,
                    id: recordData.createdfrom,
                    columns: ['type', 'recordtype', 'createdfrom']
                });

                recordData.salesOrderId =
                    // actual sales order
                    PARAM.recordType == ns_record.Type.SALES_ORDER
                        ? PARAM.recordId
                        : // creatdfrom is SO
                        createdFromData.recordtype == ns_record.Type.SALES_ORDER
                        ? recordData.createdfrom
                        : // created from PO, and has createdfrom data
                        createdFromData.recordtype == ns_record.Type.PURCHASE_ORDER &&
                          createdFromData.createdfrom
                        ? createdFromData.createdfrom
                        : null;

                log.audit(logTitle, LogPrefix + '// record: ' + JSON.stringify(recordData));
                log.audit(
                    logTitle,
                    LogPrefix + '// createdFrom: ' + JSON.stringify(createdFromData)
                );

                var lineCount = record.getLineCount({ sublistId: 'item' }),
                    serialObj = {};

                for (var recTypeKey in ns_record.Type) {
                    if (!SERIALFLD[recTypeKey]) continue;

                    if (PARAM.recordType == ns_record.Type[recTypeKey]) {
                        serialObj[SERIALFLD[recTypeKey]] = PARAM.recordId;
                    }

                    if (createdFromData.recordtype == ns_record.Type[recTypeKey]) {
                        serialObj[SERIALFLD[recTypeKey]] = recordData.createdfrom;
                    }
                }
                if (
                    createdFromData.recordtype == ns_record.Type.PURCHASE_ORDER &&
                    createdFromData.createdfrom
                ) {
                    serialObj[SERIALFLD.SALES_ORDER] = createdFromData.createdfrom;
                }
                log.audit(logTitle, LogPrefix + '// serial obj: ' + JSON.stringify(serialObj));

                for (var line = 0; line < lineCount; line++) {
                    var lineData = {
                        line: line,
                        item: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: line
                        }),
                        quantity: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: line
                        }),
                        serialStr: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: CONST_COLUMN.SERIAL_NUMBER_SCAN,
                            line: line
                        }),
                        updateSerialStr: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: CONST_COLUMN.SERIAL_NUMBER_UPDATE,
                            line: line
                        }),
                        poDoc: record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'podoc',
                            line: line
                        })
                    };

                    if (lineData.serialStr) lineData.serialArr = Helper.split(lineData.serialStr);
                    if (lineData.updateSerialStr)
                        lineData.updateSerialArr = Helper.split(lineData.updateSerialStr);

                    log.audit(logTitle, LogPrefix + '// Line Data: ' + JSON.stringify(lineData));

                    // var itemNum = record.getSublistValue({
                    //     sublistId: 'item',
                    //     fieldId: 'item',
                    //     line: line
                    // });
                    // var serialString = record.getSublistValue({
                    //     sublistId: 'item',
                    //     fieldId: COLUMN.SERIAL_NUMBER_SCAN,
                    //     line: line
                    // });
                    // var updateSerialString = record.getSublistValue({
                    //     sublistId: 'item',
                    //     fieldId: COLUMN.SERIAL_NUMBER_UPDATE,
                    //     line: line
                    // });
                    // var podoc = record.getSublistValue({
                    //     sublistId: 'item',
                    //     fieldId: 'podoc',
                    //     line: line
                    // });
                    // if (podoc) poId = podoc;

                    // var serialArray = Helper.split(serialString);
                    // var updateSerialArray = Helper.split(updateSerialString);

                    if (lineData.serialArr)
                        lineData.serialArr.forEach(function (serial) {
                            var serialData = util.extend(
                                { action: 'create', name: serial },
                                serialObj
                            );
                            serialData[SERIALFLD.ITEM] = lineData.item;
                            returnData.push(serialData);
                            return true;
                        });

                    if (lineData.updateSerialArr)
                        lineData.updateSerialArr.forEach(function (serial) {
                            var serialData = util.extend(
                                { action: 'update', name: serial },
                                serialObj
                            );
                            serialData[SERIALFLD.ITEM] = lineData.item;
                            returnData.push(serialData);
                            return true;
                        });

                    // for (var i in serialArray)
                    //     returnObj.push({
                    //         command: 'create',
                    //         serial: serialArray[i],
                    //         itemNum: itemNum,
                    //         ifId: ifId,
                    //         irId: irId,
                    //         soId: soId,
                    //         poId: poId,
                    //         returnAuthId: returnAuthId,
                    //         vendAuthId: vendorAuthId
                    //     });

                    // for (var i in updateSerialArray) {
                    //     if (serialArray.indexOf(updateSerialArray[i]) == -1)
                    //         returnObj.push({
                    //             command: 'update',
                    //             serial: updateSerialArray[i],
                    //             recType: PARAM.recordType,
                    //             recId: PARAM.recordId
                    //         });
                    // }
                }

                log.audit(logTitle, LogPrefix + '// Return Data: ' + JSON.stringify(returnData));
            } catch (error) {
                log.audit(logTitle, LogPrefix + ' ## EXIT SCRIPT ## ' + JSON.stringify(error));
                return false;
            }

            return returnData;
        },

        reduce: function (context) {
            var logTitle = [LogTitle, 'reduce'].join('::');

            var currentScript = ns_runtime.getCurrentScript();
            PARAM = {
                recordType: currentScript.getParameter('custscript_vc_type'),
                recordId: currentScript.getParameter('custscript_vc_id')
            };
            log.debug(logTitle, '>> PARAMS: ' + JSON.stringify(PARAM));
            LogPrefix = '[' + [PARAM.recordType, PARAM.recordId].join(':') + '] ';

            if (!PARAM.recordType || !PARAM.recordId) throw 'Missing record details';

            var currentData = JSON.parse(context.values[0]),
                action = currentData.action,
                serialId;

            log.debug(logTitle, LogPrefix + '// currentData: ' + JSON.stringify(currentData));

            serialId =
                action == 'create'
                    ? Helper.createSerial(currentData)
                    : action == 'update'
                    ? Helper.updateSerial(currentData)
                    : false;

            if (!serialId || !action || !currentData.name) throw 'Invalid data';

            if (serialId) context.write({ key: 'success', value: currentData.name });
            else {
                if (action == 'create')
                    context.write({ key: 'duplicate', value: currentData.name });
                else if (action == 'update') context.write({ key: 'dne', value: currentData.name });
            }
        },

        summarize: function (summary) {
            //any errors that happen in the above methods are thrown here so they should be handled
            //log stuff that we care about, like number of serial numbers
            log.audit('summarize');
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

            var duplicateSerials = [],
                dneSerials = [];
            summary.output.iterator().each(function (key, value) {
                if (key == 'duplicate') duplicateSerials.push(value);
                else if (key == 'dne') dneSerials.push(value);
                return true;
            });

            log.debug('duplicateSerials', duplicateSerials);
            log.debug('dneSerials', dneSerials);

            Helper.updateTransactionSerials({
                duplicateSerials: duplicateSerials,
                dneSerials: dneSerials
            });

            if (duplicateSerials.length > 0 || dneSerials.length > 0) {
                Helper.sendEmail({
                    duplicate: duplicateSerials,
                    dne: dneSerials
                });
            }
        }
    };

    var EMAIL_SUBJECT = ' Serial Numbers need to be rechecked for ',
        EMAIL_BODY_DUP =
            'Please double check transaction {txn} for the Serial Numbers to be processed. \n' +
            'The following Serial Numbers to be created are duplicates: \n{dup}\n\n',
        EMAIL_BODY_DNE =
            'Please double check transaction {txn} for the Serial Numbers to be processed. \n' +
            'The following Serial numbers to be updated are not yet created: \n{dne}';
    //		,CC_ITEM_RECEIPT = ['evasconcellos@myriad360.com', 'serials@myriad360.com'],
    //		CC_ITEM_FULFILLMENT =['atief@myriad360.com', 'serials@myriad360.com']

    var Helper = {
        validateLicense: function (option) {
            var mainConfig = option.mainConfig,
                license = mainConfig.license,
                response = vc_license.callValidationSuitelet({
                    license: license,
                    external: true
                }),
                result = true;

            if (response == 'invalid') {
                log.error(
                    'License expired',
                    'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
                );
                result = false;
            }

            return result;
        },
        loadMainConfig: function () {
            var mainConfig = vc_maincfg.getMainConfiguration();

            if (!mainConfig) {
                log.error('No VAR Connect Main Coniguration available');
            } else return mainConfig;
        },

        createSerial: function (option) {
            var logTitle = [LogTitle, 'createSerial'].join('::');
            var SERIALFLD = vc2_constant.RECORD.SERIALS.FIELD;

            var returnValue = false;

            try {
                var serialSearch = ns_search.global({ keywords: 'serial: ' + option.name });
                log.debug(
                    logTitle,
                    LogPrefix + '// Global search result: ' + JSON.stringify(serialSearch)
                );
                if (serialSearch.length) throw 'Matching serial found';

                var recSerial = ns_record.create({ type: 'customrecordserialnum' });

                for (var key in SERIALFLD) {
                    var fld = SERIALFLD[key];
                    if (!option.hasOwnProperty(fld)) continue;

                    recSerial.setValue({ fieldId: fld, value: option[fld] });
                }

                var serialId = recSerial.save();
                log.debug(logTitle, LogPrefix + '// New serial id: ' + serialId);

                returnValue = serialId;
            } catch (error) {
                log.audit(logTitle, LogPrefix + '## ERROR:' + JSON.stringify(error));
                returnValue = false;
            }

            return returnValue;
        },

        updateSerial: function (option) {
            var logTitle = [LogTitle, 'updateSerial'].join('::');
            var SERIALFLD = vc2_constant.RECORD.SERIALS.FIELD;

            var returnValue = false;

            try {
                var serialSearch = ns_search.global({ keywords: 'serial: ' + option.name });
                log.debug(
                    logTitle,
                    LogPrefix + '// Global search result: ' + JSON.stringify(serialSearch)
                );
                if (!serialSearch.length) throw 'Matching serial not found';
                if (serialSearch.length > 1) throw 'Multiple serials found';

                var updateValues = {};
                for (var key in SERIALFLD) {
                    var fld = SERIALFLD[key];
                    if (!option.hasOwnProperty(fld)) continue;

                    updateValues[fld] = option[fld];
                }

                log.audit(
                    logTitle,
                    LogPrefix + '// Serial values: ' + JSON.stringify(updateValues)
                );

                var serialId = ns_record.submitFields({
                    type: 'customrecordserialnum',
                    id: serialSearch[0].id,
                    values: updateValues
                });
                log.debug(logTitle, LogPrefix + '// updated  serial id: ' + serialId);

                returnValue = serialId;
            } catch (error) {
                log.audit(logTitle, LogPrefix + '## ERROR:' + JSON.stringify(error));
                returnValue = false;
            }

            return returnValue;
        },

        createSerial_old: function (serial, poId, itemId, soId, ifId, raId, vaId, irId) {
            var rs = ns_search.global({ keywords: 'serial: ' + serial });
            log.debug('Global search result', rs);

            if (rs.length == 0) {
                log.debug('saveSerial', serial);
                var sn_record = ns_record.create({
                    type: 'customrecordserialnum'
                });
                sn_record.setValue({
                    fieldId: 'name',
                    value: serial
                });
                sn_record.setValue({
                    fieldId: 'custrecordserialpurchase',
                    value: poId
                });
                sn_record.setValue({
                    fieldId: 'custrecordserialitem',
                    value: itemId
                });
                sn_record.setValue({
                    fieldId: 'custrecordserialsales',
                    value: soId
                });
                sn_record.setValue({
                    fieldId: 'custrecorditemfulfillment',
                    value: ifId
                });
                sn_record.setValue({
                    fieldId: 'custrecorditemreceipt',
                    value: irId
                });
                sn_record.setValue({
                    fieldId: 'custrecordrmanumber',
                    value: raId
                });
                sn_record.setValue({
                    fieldId: 'custrecordvendorrma',
                    value: vaId
                });
                var sc = sn_record.save();
                log.debug('New serial id', sc);
            } else {
                log.debug('Matching serial found');
            }

            return sc ? sc : '';
        },

        updateSerial_old: function (serial, recType, recId) {
            var rs = ns_search.global({ keywords: 'serial: ' + serial }),
                sc;
            log.debug('Global search result', rs);

            if (rs.length == 1) {
                var field = null;

                switch (recType) {
                    case ns_record.Type.INVOICE:
                        field = 'custrecordserialinvoice';
                        break;
                    case ns_record.Type.ITEM_FULFILLMENT:
                        field = 'custrecorditemfulfillment';
                        break;
                    case ns_record.Type.ITEM_RECEIPT:
                        field = 'custrecorditemreceipt';
                        break;
                    case ns_record.Type.RETURN_AUTHORIZATION:
                        field = 'custrecordrmanumber';
                        break;
                    case ns_record.Type.VENDOR_RETURN_AUTHORIZATION:
                        field = 'custrecordvendorrma';
                        break;
                    default:
                        return '';
                }

                var val = {};
                val[field] = recId;

                sc = ns_record.submitFields({
                    type: 'customrecordserialnum',
                    id: rs[0].id,
                    values: val
                });
            } else if (rs.length > 1) {
                log.debug('Multiple serials found');
            } else {
                log.debug('Matching serial not found');
            }
            return sc ? sc : '';
        },

        //Splits the input string via comma, line break, or spaces
        split: function (inputString) {
            var result = [];

            if (inputString) {
                inputString = inputString.trim().replace(/[\r\n, ]/g, ',');
                inputString = inputString.replace(/,(?=,)/g, '');
                result = inputString.split(',');
            }

            return result;
        },

        /**
         * Update transaction to mark serials as processed
         */
        updateTransactionSerials: function (options) {
            var recType = ns_runtime.getCurrentScript().getParameter('custscript_vc_type'),
                recId = ns_runtime.getCurrentScript().getParameter('custscript_vc_id');
            (duplicateSerials = options.duplicateSerials), (dneSerials = options.dneSerials);

            var rec = ns_record.load({
                    type: recType,
                    id: recId
                }),
                itemLen = rec.getLineCount({ sublistId: 'item' });

            for (var itemCounter = 0; itemCounter < itemLen; itemCounter++) {
                var serialString = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: CONST_COLUMN.SERIAL_NUMBER_SCAN,
                        line: itemCounter
                    }),
                    serialUpdateString = rec.getSublistValue({
                        sublistId: 'item',
                        fieldId: CONST_COLUMN.SERIAL_NUMBER_UPDATE,
                        line: itemCounter
                    }),
                    newSerials = [],
                    newDneSerials = [];

                var serialArray = Helper.split(serialString),
                    serialUpdateArray = Helper.split(serialUpdateString);

                serialArray.forEach(function (serial) {
                    if (serial && duplicateSerials.indexOf(serial) > -1)
                        newSerials.push('DUP-FOUND-' + serial);
                });
                serialUpdateArray.forEach(function (serial) {
                    if (serial && dneSerials.indexOf(serial) > -1)
                        newDneSerials.push('DNE-' + serial);
                });

                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: CONST_COLUMN.SERIAL_NUMBER_SCAN,
                    line: itemCounter,
                    value: newSerials.join('\n')
                });

                //Clear out serial update field
                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: CONST_COLUMN.SERIAL_NUMBER_UPDATE,
                    line: itemCounter,
                    value: newDneSerials.join('\n')
                });
            }

            rec.save();
        },

        /**
         * Sends out an email notification to the user and corresponding email addresses if there are duplicate and/or DNE serial numbers
         */
        sendEmail: function (options) {
            var duplicate = options.duplicate,
                dne = options.dne,
                sender = ns_runtime.getCurrentScript().getParameter('custscript_vc_sender'),
                recId = ns_runtime.getCurrentScript().getParameter('custscript_vc_id'),
                recType = ns_runtime.getCurrentScript().getParameter('custscript_vc_type'),
                txnNumber;

            var lookup = ns_search.lookupFields({
                type: recType,
                id: recId,
                columns: ['tranid']
            });

            if (lookup && lookup.tranid) txnNumber = lookup.tranid;

            var recipient = sender,
                cc = [sender];

            if (recType == ns_record.Type.ITEM_RECEIPT) cc = cc.concat(CC_ITEM_RECEIPT);
            else if (recType == ns_record.Type.ITEM_FULFILLMENT)
                cc = cc.concat(CC_ITEM_FULFILLMENT);

            if (duplicate && duplicate.length > 0) {
                log.debug('Sending email for duplicate serials');
                var subject = 'Duplicate' + EMAIL_SUBJECT + txnNumber,
                    body = EMAIL_BODY_DUP.replace('{txn}', txnNumber).replace(
                        '{dup}',
                        duplicate.join(', ')
                    );

                ns_email.send({
                    author: sender,
                    recipients: recipient,
                    cc: cc,
                    subject: subject,
                    body: body
                });
            }
            if (dne && dne.length > 0) {
                log.debug('Sending email for dne serials');
                var subject = 'Non-existent' + EMAIL_SUBJECT + txnNumber,
                    body = EMAIL_BODY_DNE.replace('{txn}', txnNumber).replace(
                        '{dne}',
                        dne.join(', ')
                    );

                ns_email.send({
                    author: sender,
                    recipients: recipient,
                    cc: cc,
                    subject: subject,
                    body: body
                });
            }
        }
    };

    return MAP_REDUCE;
});
