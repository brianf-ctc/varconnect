
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
 */

define(['N/search', 'N/record', 'N/log', 'N/format', 'N/config', './moment', './fuse'], function (
    ns_search,
    ns_record,
    log,
    format,
    config,
    moment,
    Fuse
) {
    var LogTitle = 'LIB::BillFiles';

    var dateFormat;

    // TODO: a universal date parser with config

    function parseDate(options) {
        var logTitle = [LogTitle, 'parseDate'].join('::');
        log.audit(logTitle, '>> options: ' + JSON.stringify(options));

        var dateString = options.dateString || options,
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
            dateValue = format.format({
                value: dateValue,
                type: format.Type.DATE
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
            var generalPref = config.load({
                type: config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
        }

        //TODO: Parse the date before searching

        for (var i = 0; i < myArr.length; i++) {
            log.audit(logTitle, '>>>> logfile: ' + JSON.stringify({ idx: i, data: myArr[i] }));

            var parsedDate = parseDate({ dateString: myArr[i].ordObj.date });

            var billFileSearchObj = ns_search.create({
                type: 'customrecord_ctc_vc_bills',
                filters: [
                    // ["custrecord_ctc_vc_bill_po", "is", myArr[i].ordObj.po],
                    // "AND", ["custrecord_ctc_vc_bill_file_position", "is", i]
                    //["custrecord_ctc_vc_bill_json", "startswith", myArr[i].ordObj.invoice]
                    //myArr[i].ordObj.date
                    ['custrecord_ctc_vc_bill_number', 'is', myArr[i].ordObj.invoice],
                    'AND',
                    ['custrecord_ctc_vc_bill_date', 'on', parsedDate]
                ],
                columns: [
                    ns_search.createColumn({
                        name: 'id'
                    })
                ]
            });

            var billFileSearch = billFileSearchObj.run().getRange({
                start: 0,
                end: 1
            });

            if (billFileSearch.length > 0) {
                // this bill already exists so skip it
                log.audit(logTitle, 'Already exists, skipping');
                continue;
            }

            var objRecord = ns_record.create({
                type: 'customrecord_ctc_vc_bills',
                isDynamic: true
            });

            var billFileNotes = [];
            objRecord.setValue({ fieldId: 'name', value: name });
            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_file_position',
                value: i + 1
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_po',
                value: myArr[i].ordObj.po
            });

            var poName = myArr[i].ordObj.po.trim();
            log.audit(logTitle, '>>>> PO search: ' + JSON.stringify([poName, myArr[i].ordObj.po]));

            var purchaseorderSearchObj = ns_search.create({
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

            var poSearch = purchaseorderSearchObj.run().getRange({ start: 0, end: 1 });
            log.audit(logTitle, '>>>> PO Search Results: ' + poSearch.length);

            var poId, entityId, poTranId;

            var dueDate = null;
            var manualDueDate = false;

            if (myArr[i].ordObj.hasOwnProperty('duedate') == true) {
                dueDate = myArr[i].ordObj.duedate;
                manualDueDate = true;
            }

            if (poSearch.length > 0) {
                poId = poSearch[0].getValue('internalid');
                entityId = poSearch[0].getValue('entity');
                poTranId = poSearch[0].getValue('tranid');

                log.audit(
                    logTitle,
                    '>>>> PO Data : ' +
                        JSON.stringify({
                            poId: poId,
                            entityId: entityId
                        })
                );

                objRecord.setValue({
                    fieldId: 'custrecord_ctc_vc_bill_linked_po',
                    value: poId
                });
                billFileNotes.push('Linked to PO: ' + poTranId + ' (' + poId + ') ');

                // if (entityId == '75' || entityId == '203' || entityId == '216' || entityId == '371' || entityId == '496') { // Cisco, Dell, EMC, Scansource, Westcon

                //     objRecord.setValue({
                //         fieldId: 'custrecord_ctc_vc_bill_is_recievable',
                //         value: true
                //     });

                // }

                var vendorTerms = 0;

                var searchTerms = ns_search.lookupFields({
                    type: ns_search.Type.VENDOR,
                    id: entityId,
                    columns: ['terms']
                });

                if (searchTerms.terms.length > 0) {
                    vendorTerms = searchTerms.terms[0].value;
                }

                if (manualDueDate == false) {
                    var daysToPay = ns_search.lookupFields({
                        type: ns_search.Type.TERM,
                        id: vendorTerms,
                        columns: ['daysuntilnetdue']
                    }).daysuntilnetdue;

                    dueDate = moment(myArr[i].ordObj.date)
                        .add(parseInt(daysToPay), 'days')
                        .format('MM/DD/YYYY');
                }
            } else {
                billFileNotes.push('PO Link is not found : [' + myArr[i].ordObj.po + ']');
            }

            log.audit(logTitle, '>> due date: ' + JSON.stringify([dueDate, typeof dueDate]));

            if (dueDate !== null) {
                objRecord.setValue({
                    fieldId: 'custrecord_ctc_vc_bill_due_date',
                    value: moment(dueDate).toDate()
                });

                if (manualDueDate == true) {
                    objRecord.setValue({
                        fieldId: 'custrecord_ctc_vc_bill_due_date_f_file',
                        value: true
                    });
                }
            }

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_number',
                value: myArr[i].ordObj.invoice
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_date',
                value: moment(myArr[i].ordObj.date).toDate()
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_proc_status',
                value: '1'
            });

            if (poId) {
                // match payload items to transaction items
                var availableSkus = [];

                var transactionSearchObj = ns_search.create({
                    type: 'transaction',
                    filters: [['internalid', 'anyof', poId], 'AND', ['mainline', 'is', 'F']],
                    columns: [
                        ns_search.createColumn({
                            name: 'item',
                            summary: 'GROUP'
                        })
                    ]
                });
                var searchResultCount = transactionSearchObj.runPaged().count;

                transactionSearchObj.run().each(function (result) {
                    var skuObj = {};

                    skuObj.text = result.getText({
                        name: 'item',
                        summary: 'GROUP'
                    });

                    skuObj.value = result.getValue({
                        name: 'item',
                        summary: 'GROUP'
                    });

                    availableSkus.push(skuObj);

                    return true;
                });

                log.audit(logTitle, '>>>> availableSkus: ' + JSON.stringify(availableSkus));

                var arrMatchedSKU = [];

                for (var l = 0; l < myArr[i].ordObj.lines.length; l++) {
                    log.audit(
                        logTitle,
                        '>>>>>> initial SKU: ' + JSON.stringify(myArr[i].ordObj.lines[l].ITEMNO)
                    );

                    var matchedSku;
                    availableSkus.forEach(function (sku) {
                        if (myArr[i].ordObj.lines[l].ITEMNO == sku.text ) {
                            matchedSku = sku.value;
                        }
                        return true;
                    });

                    if (matchedSku) {
                        myArr[i].ordObj.lines[l].NSITEM = matchedSku;
                        arrMatchedSKU.push(matchedSku);
                    }
                    
                    // // try to autoselect item using fuse;
                    // const options = {
                    //     includeScore: true,
                    //     threshold: 0.4,
                    //     keys: ['text']
                    // };

                    // var fuse = new Fuse(availableSkus, options);

                    // var fuseOutput = fuse.search(myArr[i].ordObj.lines[l].ITEMNO);

                    // if (fuseOutput.length > 0) {
                    //     var matchedSku = fuseOutput[0].item.value;

                    //     myArr[i].ordObj.lines[l].NSITEM = matchedSku;
                    //     arrMatchedSKU.push(matchedSku);
                    //     // billFileNotes.push('Matched SKU: ' + matchedSku);
                    // }
                }

                if (arrMatchedSKU.length) {
                    // billFileNotes.push('Matched SKU: (' + arrMatchedSKU.join(',') + ')');
                    billFileNotes.push('Matched SKU: ' + arrMatchedSKU.length);
                }
            } else {
                for (var l = 0; l < myArr[i].ordObj.lines.length; l++) {
                    myArr[i].ordObj.lines[l].NSITEM = '';
                }
            }

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_json',
                value: JSON.stringify(myArr[i].ordObj)
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_src',
                value: myArr[i].xmlStr
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_integration',
                value: configObj.id
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_log',
                value: addNote({ note: billFileNotes.join(' | ') })
            });

            var record_id = objRecord.save();

            log.audit(logTitle, '>> Bill File created: ' + record_id);
        }

        log.audit(logTitle, '**** END process ****  ');

        return null;
    }

    function addNote(option) {
        var logTitle = [LogTitle, 'addNote'].join('::');

        var billFileId = option.billFileId || option.billId || option.id,
            notes = option.note || option.notes || option.content,
            allNotes = option.all || option.allNotes || option.current || '';

        // if (!billFileId) return false;
        // if (!notes) return false;

        // //4.01
        if (!dateFormat) {
            var generalPref = config.load({
                type: config.Type.COMPANY_PREFERENCES
            });
            dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
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
        var arrNotes = noteHelper.splitByDate(allNotes);
        arrNotes = noteHelper.removeDuplicates(arrNotes);
        arrNotes = noteHelper.removeSameSucceedingLogs(arrNotes);
        arrNotes = noteHelper.flatten(arrNotes);

        var newNoteStr = arrNotes.join('\r\n\r\n');

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
