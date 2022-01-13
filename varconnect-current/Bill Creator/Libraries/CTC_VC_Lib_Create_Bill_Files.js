/**
 * vendor_map.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/search', 'N/record', 'N/log', 'N/format', './moment', './fuse'], function (
    search,
    record,
    log,
    format,
    moment,
    Fuse
) {
    var LogTitle = 'LIB::BillFiles';

    function process(configObj, myArr, name) {
        var logTitle = [LogTitle, 'process'].join('::');

        log.audit(logTitle, '**** START process ****  ');
        log.audit(logTitle, '>> configObj: ' + JSON.stringify(configObj));
        log.audit(logTitle, '>> myArr: ' + JSON.stringify(myArr));
        log.audit(logTitle, '>> name: ' + JSON.stringify(name));

        for (var i = 0; i < myArr.length; i++) {
            log.audit(logTitle, '>>>> logfile: ' + JSON.stringify({ idx: i, data: myArr[i] }));

            var billFileSearchObj = search.create({
                type: 'customrecord_ctc_vc_bills',
                filters: [
                    // ["custrecord_ctc_vc_bill_po", "is", myArr[i].ordObj.po],
                    // "AND", ["custrecord_ctc_vc_bill_file_position", "is", i]
                    //["custrecord_ctc_vc_bill_json", "startswith", myArr[i].ordObj.invoice]
                    //myArr[i].ordObj.date
                    ['custrecord_ctc_vc_bill_number', 'is', myArr[i].ordObj.invoice],
                    'AND',
                    ['custrecord_ctc_vc_bill_date', 'on', myArr[i].ordObj.date]
                ],
                columns: [
                    search.createColumn({
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

            var objRecord = record.create({
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

            var purchaseorderSearchObj = search.create({
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

                var searchTerms = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: entityId,
                    columns: ['terms']
                });

                if (searchTerms.terms.length > 0) {
                    vendorTerms = searchTerms.terms[0].value;
                }

                if (manualDueDate == false) {
                    var daysToPay = search.lookupFields({
                        type: search.Type.TERM,
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

            if (dueDate !== null) {
                objRecord.setValue({
                    fieldId: 'custrecord_ctc_vc_bill_due_date',
                    value: format.parse({
                        value: dueDate,
                        type: format.Type.DATE
                    })
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
                value: format.parse({
                    value: myArr[i].ordObj.date,
                    type: format.Type.DATE
                })
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_proc_status',
                value: '1'
            });

            if (poId) {
                // match payload items to transaction items
                var availableSkus = [];

                var transactionSearchObj = search.create({
                    type: 'transaction',
                    filters: [['internalid', 'anyof', poId], 'AND', ['mainline', 'is', 'F']],
                    columns: [
                        search.createColumn({
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

                    // try to autoselect item using fuse;

                    const options = {
                        includeScore: true,
                        threshold: 0.4,
                        keys: ['text']
                    };

                    var fuse = new Fuse(availableSkus, options);

                    var fuseOutput = fuse.search(myArr[i].ordObj.lines[l].ITEMNO);

                    if (fuseOutput.length > 0) {
                        var matchedSku = fuseOutput[0].item.value;

                        myArr[i].ordObj.lines[l].NSITEM = matchedSku;
                        arrMatchedSKU.push(matchedSku);
                        // billFileNotes.push('Matched SKU: ' + matchedSku);
                    }
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
                value: moment().format('MM-DD-YY') + ' - ' + billFileNotes.join(' | ')
            });

            var record_id = objRecord.save();

            log.audit(logTitle, '>> Bill File created: ' + record_id);
        }

        log.audit(logTitle, '**** END process ****  ');

        return null;
    }

    // Add the return statement that identifies the entry point function.
    return {
        process: process
    };
});
