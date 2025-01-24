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
 * @Description Contains the reusable functions for linking serials to the lines
 */

/**
 * CHANGELOGS
 *
 * Version Date Author Remarks 1.00 May 13, 2020 paolodl@nscatalyst.com Initial
 * Build
 *
 */
define(['N/record', 'N/search', './CTC_VC2_Constants.js'], function (
    ns_record,
    ns_search,
    vc2_constant
) {
    var SERIALFLD = vc2_constant.RECORD.SERIALS.FIELD;

    function processSerials(options) {
        var serialsToCreate = options.serialsToCreate,
            serialsToUpdate = options.serialsToUpdate,
            item = options.item,
            txnList = options.txnList, //['salesorder', 'purchaseorder', etc]
            txnIds = options.txnIds; //{salesorder: 1, purchaseorder: 2, etc}

        log.debug('lineSerials: processSerials', options);
        if (serialsToCreate && serialsToCreate.length > 0) {
            log.debug('Creating serials for transactions', txnList);

            processCreateSerialsList({
                serialsToCreate: serialsToCreate,
                item: item,
                txnList: txnList,
                txnIds: txnIds
            });
        } else if (serialsToUpdate && serialsToUpdate.length > 0) {
            log.debug('Updating serials for transaction', txnList);
            processUpdateSerialsList({
                serialsToUpdate: serialsToUpdate,
                item: item,
                txnList: txnList,
                txnIds: txnIds
            });
        }
    }

    function processUpdateSerialsList(options) {
        var serialsToUpdate = options.serialsToUpdate,
            item = options.item,
            txnList = options.txnList, //['salesorder'];
            txnIds = options.txnIds; //{salesorder: 1}

        log.debug('lineSerials: processUpdateSerialsList', options);

        var txnType = txnList[0]; //Should only contain 1 txn type for update
        var txnId = txnIds[txnType];

        var fields = _getSerialsTransactionFields({ txnType: txnType });
        /* {
         * 		txnField: fieldId,
         *		txnLineField: lineFieldId
         *	}
         */

        //Trannsaction Line Id with quantities grouped per transaction type
        var txnLineNumbers = _getItemLineNumbers({
            item: item,
            txnId: txnId,
            txnType: txnType
        });
        /* {
         * 		idList: [list of line ids]
         * 		lineId: qty
         * }
         */

        //Count of existing serials per Line Id grouped per transaction
        var existingSerialCounts = _searchSerialsForTransactionItem({
            item: item,
            txnId: txnId,
            txnType: txnType,
            fields: fields
        });

        var serialIds = _getSerialIdsToUpdate({ serials: serialsToUpdate });

        var lineIdCounter = 0;
        for (var i = 0; i < serialIds.length; i++) {
            try {
                var serialId = serialIds[i];
                log.debug('Updating serial id ' + serialId);
                var values = [];

                if (serialId) {
                    lineIdLoop: for (
                        ;
                        lineIdCounter < txnLineNumbers.idList.length;
                        lineIdCounter++
                    ) {
                        var lineId = txnLineNumbers.idList[lineIdCounter],
                            qty = txnLineNumbers[lineId],
                            count = existingSerialCounts[lineId];

                        //If serial count is met for the line (qty), continue to next line id
                        if (qty <= count) {
                            continue lineIdLoop;
                        }

                        //Set values to proper fields
                        values[fields.txnField] = txnId;
                        values[fields.txnLineField] = lineId;

                        //Increment serial count
                        existingSerialCounts[txnType][lineId]++;
                        break lineIdLoop;
                    }
                }
                log.debug('Updating serial id ' + serialId + ' - info', values);
                if (values && values.length > 0)
                    ns_record.submitFields({
                        type: vc2_constant.RECORD.SERIALS.ID,
                        id: serialId,
                        values: values
                    });
            } catch (e) {
                log.error('Error encountered when updating serial ' + serialId, e);
            }
        }
    }

    function processCreateSerialsList(options) {
        var serialsToCreate = options.serialsToCreate,
            item = options.item,
            txnList = options.txnList, //['salesorder', 'purchaseorder', etc]
            txnIds = options.txnIds, //{salesorder: 1, purchaseorder: 2, etc}
            txnLineNumbers = {}, //{salesorder: {idList: [line1, line2], line1: 1, line2: 2},
            //	purchaseorder: {idList: [line1, line2], line1: 1, line2: 2}}
            existingSerialCounts = {}, //{salesorder: {line1: 1, line2: 2},
            //	purchaseorder: {line1: 1, line2: 2}}
            allFields = {}, //{salesorder: {txnField: 'soField', txnLineField: 'soLineField'},
            //	purchaseorder: {txnField: 'poField', txnLineField: 'poLineField'}}
            lineIdCounter = {}; //{salesorder: 0,
        //	purchaseorder: 0}

        log.debug('lineSerrials: processCreateSerialsList', options);

        //Iterate through serials list, get the necessary fields,
        //then create the serial with the proper fields populate with the correct values
        for (var serialCount = 0; serialCount < serialsToCreate.length; serialCount++) {
            try {
                var serial = serialsToCreate[serialCount];

                if (serial) {
                    log.debug('Creating serial ' + serial, 'START');
                    var logInfo = '';

                    //Create serial record placeholder
                    var recSerial = ns_record.create({
                        type: vc2_constant.RECORD.SERIALS.ID
                    });

                    recSerial.setValue({
                        fieldId: SERIALFLD.NAME,
                        value: serial
                    });
                    recSerial.setValue({
                        fieldId: SERIALFLD.ITEM,
                        value: item
                    });

                    //Get Field information per transaction type, line quantity, and serial count per line
                    for (
                        var txnTypeCounter = 0;
                        txnTypeCounter < txnList.length;
                        txnTypeCounter++
                    ) {
                        var txnType = txnList[txnTypeCounter],
                            txnId = txnIds[txnType];
                        log.debug(
                            'loop count ' + txnTypeCounter,
                            'txnType' + txnType + ' txnId' + txnId
                        );

                        //Transaction Field Ids on serial record grouped by transaction type
                        if (!allFields[txnType]) {
                            var fields = _getSerialsTransactionFields({
                                txnType: txnType
                            });
                            allFields[txnType] = fields;
                            log.debug('allFields[txnType]', allFields[txnType]);
                        }
                        /* {
                         * 		txnField: fieldId,
                         *		txnLineField: lineFieldId
                         *	}
                         */

                        //Trannsaction Line Id with quantities grouped per transaction type
                        if (!txnLineNumbers[txnType]) {
                            txnLineNumbers[txnType] = _getItemLineNumbers({
                                item: item,
                                txnId: txnId,
                                txnType: txnType
                            });
                            log.debug('txnLineNumbers[txnType]', txnLineNumbers[txnType]);
                        }
                        /* {
                         * 		idList: [list of line ids]
                         * 		lineId: qty
                         * }
                         */

                        //Count of existing serials per Line Id grouped per transaction
                        if (!existingSerialCounts[txnType] && item) {
                            existingSerialCounts[txnType] = _searchSerialsForTransactionItem({
                                item: item,
                                txnId: txnId,
                                txnType: txnType,
                                fields: allFields[txnType]
                            });
                            log.debug(
                                'existingSerialCounts[txnType]',
                                existingSerialCounts[txnType]
                            );
                        }
                        /* {
                         * 		lineId: count
                         * }
                         */

                        if (txnLineNumbers[txnType] && txnLineNumbers[txnType].length > 0) {
                            //Iterate through transaction lines and check qty vs existing serial count
                            if (!lineIdCounter[txnType]) lineIdCounter[txnType] = 0;

                            lineIdLoop: for (
                                ;
                                lineIdCounter[txnType] < txnLineNumbers[txnType].idList.length;
                                lineIdCounter[txnType]++
                            ) {
                                var lineId = txnLineNumbers[txnType].idList[lineIdCounter[txnType]],
                                    qty = txnLineNumbers[txnType][lineId],
                                    count = existingSerialCounts[txnType][lineId];

                                //If serial count is met for the line (qty), continue to next line id
                                if (qty <= count) {
                                    continue lineIdLoop;
                                }

                                //Set values to proper fields
                                recSerial.setValue({
                                    fieldId: allFields[txnType].txnField,
                                    value: txnId
                                });
                                recSerial.setValue({
                                    fieldId: allFields[txnType].txnLineField,
                                    value: lineId
                                });

                                if (logInfo.length > 0) logInfo += ' | ';
                                logInfo += allFields[txnType].txnField + ' = ' + txnId + ', ';
                                logInfo += allFields[txnType].txnLineField + ' = ' + lineId;

                                //Increment serial count
                                existingSerialCounts[txnType][lineId]++;
                                break lineIdLoop;
                            }
                        } else {
                            //If item doesn't exist/mismatch, don't set the line
                            recSerial.setValue({
                                fieldId: allFields[txnType].txnField,
                                value: txnId
                            });
                        }
                    }

                    log.debug('Creating serial ' + serial + ' - info', logInfo);
                    recSerial.save();
                }
            } catch (e) {
                log.error('Error encountered when creating serial ' + serial, e);
            }
        }
    }

    function _getSerialIdsToUpdate(options) {
        var serials = options.serials,
            serialIds = [];

        var filters = [],
            columns = ['internalid'];

        for (var i = 0; i < serial.length; i++) {
            var serial = serials[i];

            if (i > 0) filters.push('or');
            filters.push([SERIALFLD.NAME, 'is', serial]);
        }

        var srch = ns_search.create({
            type: vc2_constant.RECORD.SERIALS.ID,
            filters: filters,
            columns: columns
        });

        srch.run().each(function (result) {
            serialIds.push(result.id);
            return true;
        });

        return serialIds;
    }

    function _getItemLineNumbers(options) {
        var item = options.item,
            txnId = options.txnId,
            txnType = options.txnType,
            lineIds = {};
        lineIds.idList = [];

        var txn = ns_record.load({
            type: txnType,
            id: txnId
        });

        if (txn) {
            var itemCount = txn.getLineCount({
                sublistId: 'item'
            });

            for (var i = 0; i < itemCount; i++) {
                var lineItem = txn.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                if (lineItem == item) {
                    var qty = txn.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    var lineId = txn.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'id',
                        line: i
                    });

                    // For IR and IF
                    if (!lineId) {
                        var orderDoc = txn.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'orderdoc',
                            line: i
                        });
                        var orderLine = txn.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'orderline',
                            line: i
                        });

                        lineId = orderDoc + '_' + orderLine;
                    }

                    lineIds.idList.push(lineId);
                    lineIds[lineId] = qty;
                }
            }
        }

        return lineIds;
    }

    function _searchSerialsForTransactionItem(options) {
        var item = options.item,
            txnId = options.txnId,
            txnType = options.txnType,
            fields = options.fields,
            lineIdCount = [];

        log.debug('line serials : _searchSerialsForTransactionItem', options);

        //Terminate if invalid transaction type
        if (!fields || !fields.txnField || !fields.txnLineField) return;

        var filters = [],
            columns = [];

        filters.push(
            ns_search.createFilter({
                name: fields.txnField,
                operator: 'anyof',
                values: txnId
            })
        );
        filters.push(
            ns_search.createFilter({
                name: SERIALFLD.ITEM,
                operator: 'anyof',
                values: item
            })
        );

        columns.push(
            ns_search.createColumn({
                name: fields.txnLineField,
                summary: 'group'
            })
        );
        columns.push(
            ns_search.createColumn({
                name: SERIALFLD.ID,
                summary: 'count'
            })
        );

        var srch = ns_search.create({
            type: vc2_constant.RECORD.SERIALS.ID,
            filters: filters,
            columns: columns
        });

        log.debug('filters', filters);
        srch.run().each(function (result) {
            var parsed = _parseResults({
                result: result,
                txnLineField: fields.txnLineField
            });

            lineIdCount[parsed.lineId] = parsed.count;
            return true;
        });

        return lineIdCount;
    }

    function _getSerialsTransactionFields(options) {
        var txnType = options.txnType,
            txnField,
            txnLineField;

        if (txnType == ns_record.Type.SALES_ORDER) {
            txnField = SERIALFLD.SALES_ORDER;
            txnLineField = SERIALFLD.SO_LINE;
        } else if (txnType == ns_record.Type.PURCHASE_ORDER) {
            txnField = SERIALFLD.PURCHASE_ORDER;
            txnLineField = SERIALFLD.PO_LINE;
        } else if (txnType == ns_record.Type.ITEM_FULFILLMENT) {
            txnField = SERIALFLD.ITEM_FULFILLMENT;
            txnLineField = SERIALFLD.IF_LINE;
        } else if (txnType == ns_record.Type.ITEM_RECEIPT) {
            txnField = SERIALFLD.ITEM_RECEIPT;
            txnLineField = SERIALFLD.IR_LINE;
        } else if (txnType == ns_record.Type.INVOICE) {
            txnField = SERIALFLD.INVOICE;
            txnLineField = SERIALFLD.INV_LINE;
        }

        return {
            txnField: txnField,
            txnLineField: txnLineField
        };
    }

    function _parseResults(options) {
        var txnLineField = options.txnLineField,
            result = options.result;
        var objReturn = {};

        objReturn.lineId = result.getValue({
            name: txnLineField,
            summary: ns_search.Summary.GROUP
        });
        objReturn.count = result.getValue({
            name: SERIALFLD.ID,
            summary: ns_search.Summary.COUNT
        });

        return objReturn;
    }

    return {
        processSerials: processSerials
    };
});
