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

define(['N/search', 'N/record', 'N/format', 'N/config', './moment', './fuse'], function (
    ns_search,
    ns_record,
    ns_format,
    ns_config,
    moment,
    Fuse
) {
    var LogTitle = 'LIB::BillFiles',
        LogPrefix;

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
        searchPO: function (poName) {
            var logTitle = [LogTitle, 'searchPO'].join('::'),
                returnValue;

            log.audit(logTitle, LogPrefix + '// search for existing PO: ' + poName);

            var searchObj = ns_search.create({
                type: 'purchaseorder',
                filters: [
                    ['numbertext', 'is', poName],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'PurchOrd']
                ],
                columns: [
                    'trandate',
                    'postingperiod',
                    'type',
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
                    value: result.getValue({
                        name: 'item',
                        summary: 'GROUP'
                    })
                });
                return true;
            });
            returnValue = arrSKUs;

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

        log.audit(logTitle, '**** START process ****  ');
        log.audit(logTitle, '>> configObj: ' + JSON.stringify(configObj));
        log.audit(logTitle, '>> myArr: ' + JSON.stringify(myArr));
        log.audit(logTitle, '>> name: ' + JSON.stringify(name));

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
        }

        for (var i = 0; i < myArr.length; i++) {
            var currentOrder = myArr[i].ordObj;
            LogPrefix = '[bill:' + currentOrder.invoice + '] ';

            log.audit(logTitle, '###### PROCESSING [' + currentOrder.invoice + '] ######');
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
                billFileValues.custrecord_ctc_vc_bill_linked_po = poData.id;
                billFileNotes.push('Linked to PO: ' + poData.tranId + ' (' + poData.id + ') ');

                ///////////////////////////////////
                //For Ergo:  Cisco, Dell, EMC, Scansource, Westcon
                if (Helper.inArray(poData.entityId, ['75', '203', '216', '371', '496'])) {
                    billFileValues.custrecord_ctc_vc_bill_is_recievable = true;
                }
                ///////////////////////////////////

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
                var availableSkus = Helper.collectItemsFromPO({ poId: poData.id });
                var arrMatchedSKU = [];

                for (ii = 0; ii < currentOrder.lines.length; ii++) {
                    var itemNo = currentOrder.lines[ii].ITEMNO;

                    var logPrefix = LogPrefix + '// search for matching item [' + itemNo + '] ';

                    var matchedSku = false;
                    for (var iii = 0; iii < availableSkus.length; iii++) {
                        if (availableSkus[iii].text == itemNo) {
                            matchedSku = availableSkus[iii].value;
                            break;
                        }
                    }
                    log.audit(
                        logTitle,
                        logPrefix + '.. exact match: ' + JSON.stringify(matchedSku)
                    );

                    if (!matchedSku) {
                        // do the fuzzy search
                        const options = {
                            includeScore: true,
                            threshold: 0.4,
                            keys: ['text']
                        };
                        var fuse = new Fuse(availableSkus, options);
                        var fuseOutput = fuse.search(itemNo);
                        if (fuseOutput.length > 0) {
                            matchedSku = fuseOutput[0].item.value;
                        }

                        log.audit(
                            logTitle,
                            logPrefix + '.. fuzzy match: ' + JSON.stringify(matchedSku)
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
            log.audit(logTitle, '>> Bill File created: ' + record_id);
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

        // if (!billFileId) return false;
        // if (!notes) return false;

        // //4.01
        if (!dateFormat) {
            var generalPref = ns_config.load({
                type: ns_config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
        }

        log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));

        // get the current notes
        if (billFileId) {
            var recData = ns_search.lookupFields({
                type: 'customrecord_ctc_vc_bills',
                id: billFileId,
                columns: ['custrecord_ctc_vc_bill_log']
            });
            allNotes = recData.custrecord_ctc_vc_bill_log;
        }
        if (notes) allNotes = moment().format(dateFormat) + ' - ' + notes + '\r\n' + allNotes;

        ////////////////////////////////////////
        var noteHelper = {
            splitByDate: function (allNotesStr) {
                var arr = allNotesStr
                    .split(/(\d{1,2}\/\d{1,2}\/\d{4})\s-\s/gm)
                    .filter(function (str) {
                        return !!str;
                    });
                var arrNotes = [];
                while (arr.length) {
                    var dateStr = arr.shift();
                    if (!new Date(dateStr)) continue;

                    var note = {
                        date: dateStr,
                        dateVal: new Date(dateStr),
                        msg: arr.shift()
                    };
                    if (note.msg) note.msg = note.msg.replace(/\r\n/gm, '');
                    arrNotes.push(note);
                }
                log.audit('noteHelper::splitByDate', '>> arrNotes: ' + JSON.stringify(arrNotes));
                return arrNotes.sort(function (a, b) {
                    return b.dateVal - a.dateVal;
                });
            },
            removeDuplicates: function (notesList) {
                var arrNotes = [];
                notesList.map(function (noteOut) {
                    var isFound = false;
                    arrNotes.forEach(function (noteIn) {
                        if (isFound) return false;
                        if (noteOut.date == noteIn.date && noteOut.msg == noteIn.msg) {
                            isFound = true;
                            return false;
                        }
                        return true;
                    });
                    if (!isFound) arrNotes.push(noteOut);
                });
                return arrNotes;
            },
            removeSameSucceedingLogs: function (notesList) {
                var arrNotes = [];
                notesList.map(function (note) {
                    var isSameNote = false;
                    if (arrNotes.length && arrNotes[arrNotes.length - 1]) {
                        var lastEntry = arrNotes[arrNotes.length - 1];
                        isSameNote = lastEntry.msg == note.msg;
                    }
                    if (!isSameNote) {
                        arrNotes.push(note);
                    }
                });
                return arrNotes;
            },
            flatten: function (notesList) {
                return notesList.map(function (note) {
                    return [note.date, note.msg].join(' - ');
                });
            }
        };
        ////////////////////////////////////////

        // lets simplify ///
        // first, split up the notes by date, and make each an object
        var newNoteStr = allNotes;
        try {
            var arrNotes = noteHelper.splitByDate(allNotes);
            log.audit(logTitle, '>> arrNotes [splitByDate]: ' + JSON.stringify(arrNotes));
            arrNotes = noteHelper.removeDuplicates(arrNotes);
            log.audit(logTitle, '>> arrNotes [removeDuplicates]: ' + JSON.stringify(arrNotes));
            arrNotes = noteHelper.removeSameSucceedingLogs(arrNotes);
            log.audit(
                logTitle,
                '>> arrNotes [removeSameSucceedingLogs]: ' + JSON.stringify(arrNotes)
            );
            arrNotes = noteHelper.flatten(arrNotes);
            log.audit(logTitle, '>> arrNotes [flatten]: ' + JSON.stringify(arrNotes));

            newNoteStr = arrNotes.join('\r\n\r\n');
        } catch (e) {}
        log.audit(logTitle, '>> newNoteStr: ' + JSON.stringify(newNoteStr));

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
        process: process,
        addNote: addNote
    };
});
