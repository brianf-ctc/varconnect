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
    function process(configObj, myArr, name) {
        for (var i = 0; i < myArr.length; i++) {
            log.audit(i, myArr[i].ordObj);

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
                log.audit(i, 'Already exists, skipping');
                continue;
            }

            var objRecord = record.create({
                type: 'customrecord_ctc_vc_bills',
                isDynamic: true
            });

            objRecord.setValue({
                fieldId: 'name',
                value: name
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_file_position',
                value: i + 1
            });

            objRecord.setValue({
                fieldId: 'custrecord_ctc_vc_bill_po',
                value: myArr[i].ordObj.po
            });

            var purchaseorderSearchObj = search.create({
                type: 'purchaseorder',
                filters: [
                    ['numbertext', 'is', myArr[i].ordObj.po],
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

            var poSearch = purchaseorderSearchObj.run().getRange({
                start: 0,
                end: 1
            });

            var poId;
            var entityId;

            var dueDate = null;
            var manualDueDate = false;

            if (myArr[i].ordObj.hasOwnProperty('duedate') == true) {
                dueDate = myArr[i].ordObj.duedate;
                manualDueDate = true;
            }

            if (poSearch.length > 0) {
                poId = poSearch[0].getValue('internalid');
                entityId = poSearch[0].getValue('entity');

                objRecord.setValue({
                    fieldId: 'custrecord_ctc_vc_bill_linked_po',
                    value: poId
                });

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
                //

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
                log.debug('transactionSearchObj result count', searchResultCount);
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

                log.debug('availableSkus', availableSkus);

                for (var l = 0; l < myArr[i].ordObj.lines.length; l++) {
                    log.debug('initial SKU', myArr[i].ordObj.lines[l].ITEMNO);

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

                        log.debug(
                            'Matched SKUs',
                            myArr[i].ordObj.lines[l].ITEMNO + ':' + matchedSku
                        );

                        myArr[i].ordObj.lines[l].NSITEM = matchedSku;
                    }
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

            var record_id = objRecord.save();

            log.audit(i, 'created: ' + record_id);
        }

        return null;
    }

    // Add the return statement that identifies the entry point function.
    return {
        process: process
    };
});
