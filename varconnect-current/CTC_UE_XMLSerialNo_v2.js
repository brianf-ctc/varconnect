/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

/**
 * Module Description
 * Var Connect v2, Saves all xml Var Connect column fields from PO to SO and Invoice
 * When PO is saved, match lines on PO to parent SO and update VAR Connect fields,
 * then if invoice already exists, match lines on invoice to lines on SO and copy VAR Connect fields
 *
 * Note: saved searches are used in both functions below, consider putting search id's in VCGlobals
 *
 * Version	Date            Author		Remarks
 * 1.00		Aug 31, 2017    jcorrea
 * 1.01		Sep 7, 2017		jcorrea		Removed call to updateFieldList function, just copying all of the data over now
 * 2.00     Jan 20, 2019    jcorrea     Updated to VR connect v2 and including all VAR Cnnect fields (not just serial nums)
 * 2.10     Feb 20, 2019    jcorrea     Updated isEmpty to use === when testing for empty string
 *
 */

/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/error', 'N/search', './VC_Globals.js'], function (
    record,
    runtime,
    error,
    search,
    vcGlobals
) {
    //  TODO put these field IDs in VCGlobals
    var xmlFields = [
        'custcol_ctc_xml_carrier', //0
        'custcol_ctc_xml_date_order_placed', //1
        'custcol_ctc_xml_dist_order_num', //2
        'custcol_ctc_xml_eta', //3
        'custcol_ctc_xml_serial_num', //4
        'custcol_ctc_xml_ship_date', //5
        'custcol_ctc_xml_ship_method', //6
        'custcol_ctc_xml_tracking_num', //7
        'custcol_ctc_vc_order_placed_date', //8
        'custcol_ctc_vc_eta_date', //9
        'custcol_ctc_vc_shipped_date' //10
    ];

    var SEARCH_PO_TO_SO = 'customsearch_ctc_po_so_line_nums';
    var SEARCH_INVOICE_MATCH_SO = 'customsearch_ctc_invoice_search';
    var SEARCH_INVOICE_TO_SO = 'customsearch_ctc_invoice_line_ids';

    function afterSubmit(context) {
        if (
            context.type == context.UserEventType.CREATE ||
            context.type == context.UserEventType.EDIT
        ) {
            var current_rec = context.newRecord;
            var currentID = current_rec.id;
            var createdFromSO = current_rec.getValue({
                fieldId: 'createdfrom'
            });
            var createdFromType;
            if (createdFromSO)
                createdFromType = search.lookupFields({
                    type: search.Type.TRANSACTION,
                    id: createdFromSO,
                    columns: 'recordtype'
                });

            log.debug({
                title: 'CTC after submit',
                details:
                    'current rec id = ' +
                    currentID +
                    ', created from id = ' +
                    createdFromSO +
                    ', created from type = ' +
                    JSON.stringify(createdFromType)
            });

            if (
                createdFromSO != null &&
                createdFromSO != '' &&
                (createdFromType === record.Type.SALES_ORDER ||
                    createdFromType.recordtype === record.Type.SALES_ORDER)
            ) {
                updateSO_v2(createdFromSO, currentID, current_rec);
            }
        } else {
            return;
        }
    }

    function updateSO_v2(createdFromSO, transID, transRec) {
        var recType = transRec.type;

        log.debug({
            title: 'Update SO V2',
            details: 'recType = ' + recType
        });

        var soRec = record.load({
            type: record.Type.SALES_ORDER,
            id: createdFromSO,
            isDynamic: true
        });

        if (soRec != null && transRec != null) {
            var soUpdated = false;

            log.debug({
                title: 'Update SO V2',
                details: 'PO ID = ' + transID + ' SO ID = ' + createdFromSO
            });

            //** Run a search on the current PO/Cash Sale, returning line items and their line numbers for the PO and parent SO
            var filters = search.createFilter({
                name: 'internalid',
                operator: search.Operator.IS,
                values: transID
            });
            var mySearch = search.load({
                id: SEARCH_PO_TO_SO
            });
            mySearch.filters.push(filters);
            // For each line item save serials to SO if needed
            var searchresults = mySearch.run().each(function (result) {
                var transLineNum = result.getValue('linesequencenumber');
                log.debug({
                    title: 'Update SO V2',
                    details: 'PO line num ' + transLineNum
                });
                log.debug({
                    title: 'Update SO V2',
                    details: 'result =  ' + JSON.stringify(result)
                });

                var soLineKey = result.getValue({
                    name: 'lineuniquekey',
                    join: 'appliedToTransaction'
                });

                var soLineNum = getLineNum(soRec, soLineKey);
                log.debug({
                    title: 'Update SO V2',
                    details:
                        'soLineNum =  ' + soLineNum + '  PO Line sequence num = ' + transLineNum
                });

                if (!isEmpty(transLineNum)) {
                    if (soLineNum != null) {
                        var lineNum = soRec.selectLine({
                            sublistId: 'item',
                            line: soLineNum
                        });
                        log.debug({
                            title: 'Update SO V2',
                            details: 'selectLine LineNum =  ' + lineNum
                        });

                        for (var xmlField in xmlFields) {
                            var fieldValue = result.getValue(xmlFields[xmlField]);
                            log.debug({
                                title: 'Update SO V2',
                                details:
                                    'xmlField =  ' + xmlFields[xmlField] + ' value = ' + fieldValue
                            });

                            if (!isEmpty(fieldValue)) {
                                if (xmlField > 7 && xmlField < 11) {
                                    fieldValue = new Date(fieldValue);
                                    if (!!fieldValue) fieldValue = '';
                                }
                                soRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: xmlFields[xmlField],
                                    value: fieldValue
                                });
                            } else
                                soRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: xmlFields[xmlField],
                                    value: ''
                                });
                        }

                        try {
                            soUpdated = true;
                            if (soUpdated) {
                                soRec.commitLine({
                                    sublistId: 'item'
                                });
                                log.debug({
                                    title: 'Update SO V2',
                                    details: 'Committed SO line num ' + soLineNum
                                });
                            }
                        } catch (err) {
                            log.error({
                                title: 'Update SO V2 - Error committing SO line',
                                details: 'SO line ' + soLineNum + ' error = ' + err.message
                            });
                        }
                    } else {
                        log.debug({
                            title: 'Update SO V2',
                            details: 'soLineNum is EMPTY'
                        });
                    }
                } else {
                    log.debug({
                        title: 'Update SO V2',
                        details: 'transLineNum is EMPTY'
                    });
                }

                return true;
            });
            if (soUpdated) {
                try {
                    soRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    updateInvoiceRecords(createdFromSO);
                } catch (err) {
                    log.error({
                        title: 'Update SO V2 - Error submitting SO',
                        details: 'error = ' + err.message
                    });
                }
            }
        }
    }

    function updateInvoiceRecords(soID) {
        log.debug({
            title: 'Update Invoice Records',
            details: 'Updating SO nums = ' + soID
        });

        // Run a search that will return a list of invoices created from soID(SO internal id)
        var filters = search.createFilter({
            name: 'createdfrom',
            operator: search.Operator.IS,
            values: soID
        });
        var myInvoiceSearch = search.load({
            id: SEARCH_INVOICE_MATCH_SO
        });
        myInvoiceSearch.filters.push(filters);

        // For each invoice returned, loop through items and update XML fields from matching lines on the SO
        var searchresults = myInvoiceSearch.run().each(function (result) {
            log.debug({
                title: 'Update Invoice Records',
                details: 'Updating invoice num = ' + result.getValue('internalid')
            });

            var invUpdated = false;
            var invRec = record.load({
                type: record.Type.INVOICE,
                id: result.getValue('internalid'),
                isDynamic: true
            });
            if (invRec != null) {
                log.debug({
                    title: 'Update Invoice Records',
                    details: 'Loaded invoice num = ' + result.getValue('internalid')
                });

                var inv_filters = search.createFilter({
                    name: 'internalid',
                    operator: search.Operator.IS,
                    values: result.getValue('internalid')
                });
                var myInvoiceLineSearch = search.load({
                    id: SEARCH_INVOICE_TO_SO
                });
                myInvoiceLineSearch.filters.push(inv_filters);

                var searchLineResults = myInvoiceLineSearch.run().each(function (result) {
                    var invLineKey = result.getValue({
                        name: 'lineuniquekey'
                    });
                    var invLineNum = getLineNum(invRec, invLineKey);

                    log.debug({
                        title: 'Update Invoice Records',
                        details: 'Procesing invoice line num = ' + invLineNum
                    });

                    if (!isEmpty(invLineNum)) {
                        var lineNum = invRec.selectLine({
                            sublistId: 'item',
                            line: invLineNum
                        });

                        for (var xmlField in xmlFields) {
                            var fieldValue = result.getValue({
                                name: xmlFields[xmlField],
                                join: 'appliedToTransaction'
                            });
                            if (!isEmpty(fieldValue))
                                invRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: xmlFields[xmlField],
                                    value: fieldValue
                                });
                            else
                                invRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: xmlFields[xmlField],
                                    value: ''
                                });
                        }

                        try {
                            invUpdated = true;
                            invRec.commitLine({
                                sublistId: 'item'
                            });
                        } catch (err) {
                            log.error({
                                title: 'Update Invoice - Error committing invoice line',
                                details: 'Invoice line ' + invLineNum + ' error = ' + err.message
                            });
                        }
                    }
                    return true;
                });
            }
            if (invUpdated) {
                try {
                    invRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                } catch (err) {
                    log.error({
                        title: 'Update Invoice - Error submitting Invoice',
                        details: 'error = ' + err.message
                    });
                }
            }
            return true;
        });
    }

    function getLineNum(rec, lineKey) {
        var lineCount = rec.getLineCount({
            sublistId: 'item'
        });
        for (var i = 0; i < lineCount; i++) {
            var tempLineKey = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'lineuniquekey',
                line: i
            });
            if (tempLineKey == lineKey) {
                return i;
            }
        }
        return null;
    }

    function isEmpty(stValue) {
        if (stValue === '' || stValue == null || stValue == undefined) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if (stValue == '') {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }

            return false;
        }
    }

    //**********************************************************************************************************
    //************ Don't think this code is needed but saving for now, not calling it at the moment ************
    function updateFieldList(newNumbers, rec, fieldID, line_num) {
        var errorMsg = 'Maximum Field Length Exceeded';
        var errorFound = false;
        var maxFieldLength = 3950;
        var recUpdated = false;

        /* 		log.debug({	title: 'CTC Update PO ', details: 'In updateFieldLIST '+fieldID+' = '+newNumbers }); */

        // split up the newline delimited line data into arrays for easier processing
        var scannedNums = new Array();
        scannedNums = newNumbers.split('\n');
        /* 		log.debug({ title: 'CTC Update PO ', details: 'In updateFieldLIST scannedNums ='+scannedNums+' , line_Num = '+line_num }); */
        try {
            var currentNumbers = rec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: fieldID
            });
            /* 			log.debug({	title: 'CTC Update PO ', details: 'In updateFieldLIST currentNumbers = '+currentNumbers	}); */
            if (currentNumbers != null) {
                if (currentNumbers == 'NA' || (currentNumbers.length = 0)) {
                    var newValue = newNumbers.replace(/[","]+/g, '\n');
                    /* 					log.debug({ title: 'CTC Update PO ', details: 'In updateFieldLIST newValue ='+newValue }); */

                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fieldID,
                        value: newValue
                    });
                    recUpdated = true;
                } else {
                    /* remove \r chars */
                    var newCurrent = currentNumbers.split('\r').join('');
                    var newNumAdded = false;

                    var currentNumbersList = Array();
                    currentNumbersList = newCurrent.split('\n');

                    /** check to see if the field already exceeds the max length **/
                    if (currentNumbersList[currentNumbersList.length - 1] === errorMsg)
                        errorFound = true;

                    if (!errorFound) {
                        for (var j = 0; j < scannedNums.length; j++) {
                            var numFound = false;
                            for (var x = 0; x < currentNumbersList.length; x++) {
                                if (currentNumbersList[x] == scannedNums[j]) {
                                    numFound = true;
                                    break;
                                }
                            }
                            if (!numFound && scannedNums[j] != 'NA') {
                                /* OLD  newCurrent += ',' + scannedNums[j]; */
                                newNumAdded = true;
                                if (newCurrent.length + scannedNums[j].length < maxFieldLength) {
                                    newCurrent += '\n' + scannedNums[j];
                                    currentNumbersList.push(scannedNums[j]);
                                } else {
                                    newCurrent += '\n' + errorMsg;
                                    break;
                                }
                            }
                        }
                        if (newNumAdded) {
                            rec.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: fieldID,
                                value: newCurrent
                            });
                            recUpdated = true;
                        }
                    }
                }
            } else {
                if (newNumbers.length <= maxFieldLength) {
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fieldID,
                        value: newNumbers.replace(/[","]+/g, '\n')
                    });
                    recUpdated = true;
                } else {
                    var newCurrent = '';
                    for (var i = 0; i < scannedNums.length; i++) {
                        if (newCurrent.length + scannedNums[i].length > maxFieldLength) {
                            newCurrent += errorMsg;
                            break;
                        } else newCurrent += scannedNums[i] + '\n';
                    }

                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fieldID,
                        value: newCurrent
                    });
                    recUpdated = true;
                }
            }
            return recUpdated;
        } catch (err) {
            log.error({
                title: 'CTC Update PO ',
                details: 'ERROR In updateFieldLIST ' + fieldID + ' = ' + err.message
            });
            return recUpdated;
        }
        /* 		log.debug({
        			title: 'CTC Update PO ',
        			details: 'Leaving updateFieldLIST '+fieldID
        		});
         */
    }
    //**********************************************************************************************

    return {
        afterSubmit: afterSubmit
    };
});
