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
 * @NScriptType ClientScript
 */
define(['N/ui/dialog', 'N/ui/message', 'N/currentRecord'], function (dialog, message, currentRecord) {
    var Helper = {
        calculateLineTax: function (option) {
            var amount = option.amount,
                taxRate1 = option.taxrate1 || false,
                taxRate2 = option.taxrate2 || false;

            var taxAmount = taxRate1 ? (taxRate1 / 100) * amount : 0;
            taxAmount += taxRate2 ? (taxRate2 / 100) * amount : 0;

            return Helper.roundOff(taxAmount) || 0;
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        }
    };

    function recalculateTotals() {
        var currRecord = currentRecord.get();

        /// extract  the taxlines
        var taxLinesJSON = currRecord.getValue({ fieldId: 'custpage_taxlines' });
        var taxLines = JSON.parse(taxLinesJSON || '{}');

        var Totals = {
            lineTax: 0,
            lineShip: 0,
            lineAmount: 0,
            Amount: 0,
            deltaTax: 0,
            deltaShip: 0
        };
        var lineCount, line, lineAmount, lineData;

        // get the line items
        lineCount = currRecord.getLineCount({ sublistId: 'item' });
        for (line = 0; line < lineCount; line++) {
            lineData = {
                itemid: currRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'nsitem',
                    line: line
                }),
                quantity: currRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'fqty',
                    line: line
                }),
                rate: currRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'frate',
                    line: line
                })
            };
            lineData.amount = lineData.quantity * lineData.rate;
            lineData.taxAmount = Helper.calculateLineTax(util.extend(lineData, taxLines[lineData.itemid]));

            console.log('lineData (item) >> ', lineData, taxLines[lineData.itemid]);
            Totals.lineTax += lineData.taxAmount;
            Totals.lineAmount += lineData.amount;
        }

        // variance lines
        lineCount = currRecord.getLineCount({ sublistId: 'variance' });
        for (line = 0; line < lineCount; line++) {
            lineData = {
                itemid:
                    currRecord.getSublistValue({
                        sublistId: 'variance',
                        fieldId: 'nsitem',
                        line: line
                    }) ||
                    currRecord.getSublistValue({
                        sublistId: 'variance',
                        fieldId: 'itemid',
                        line: line
                    }),
                amount: currRecord.getSublistValue({
                    sublistId: 'variance',
                    fieldId: 'amount',
                    line: line
                })
            };
            lineData.taxAmount = Helper.calculateLineTax(util.extend(lineData, taxLines[lineData.itemid]));

            console.log('lineData (variance) >> ', lineData, taxLines[lineData.itemid]);

            Totals.lineTax += lineData.taxAmount;
            Totals.lineAmount += lineData.amount;
        }

        console.log('** Totals >> ', Totals);

        console.log(taxLines);
    }

    function fieldChanged(context) {
        var currentValue = context.currentRecord.getValue(context);

        if (context.fieldId == 'custpage_polink' && nlapiGetFieldValue('custpage_polink') !== '') {
            dialog
                .confirm({
                    title: 'WARNING',
                    message:
                        'You are manually linking a PO.  ' +
                        'Once this record is saved with a linked PO, ' +
                        'the PO can not be changed.  ' +
                        'This Bill will have to be closed and manually ' +
                        'created if linked to an incorrect PO!'
                })
                .then(function (result) {
                    if (result == false) {
                        nlapiSetFieldValue('custpage_polink', '');
                    }
                })
                .catch(function (reason) {
                    console.log('Failure: ' + reason);
                });
        }

        // if (context.sublistId == 'variance') {
        //     console.log('fieldChange: ' + context.sublistId, currentValue);
        //     recalculateTotals();
        // }
        // if (context.sublistId == 'item') {
        //     console.log('fieldChange: ' + context.sublistId, currentValue);
        //     recalculateTotals();
        // }

        //     currentValue = context.currentRecord.getSublistValue(context);
        //     var amountFixed = context.currentRecord.getSublistValue({
        //         sublistId: 'variance',
        //         fieldId: 'amountfixed', line: context.line
        //     });
        //     console.log('variance-apply', currentValue, amountFixed);

        //     context.currentRecord.setCurrentSublistValue({
        //         sublistId:'variance',
        //         fieldId: 'amount',
        //         value: currentValue ? amountFixed : 0
        //     });

        // }

        if (context.fieldId == 'custpage_action') {
            var currRecord = context.currentRecord;

            // var taxValue = currRecord.getValue('custpage_variance_tax');
            // var shipValue = currRecord.getValue('custpage_variance_shipping');
            // var otherValue = currRecord.getValue('custpage_variance_other');
            // var adjValue = currRecord.getValue('custpage_variance_adjustment');

            // console.log('custpage_action', taxValue, shipValue, otherValue);

            if (currentValue == 'reprocess_hasvar') {
                // currRecord.setValue({ fieldId: 'custpage_variance_tax_apply', value: !!taxValue });
                // currRecord.setValue({
                //     fieldId: 'custpage_variance_ship_apply',
                //     value: !!shipValue
                // });
                // currRecord.setValue({
                //     fieldId: 'custpage_variance_other_apply',
                //     value: !!otherValue
                // });
                // currRecord.setValue({
                //     fieldId: 'custpage_variance_adjustment_apply',
                //     value: !!adjValue
                // });
            } else if (currentValue == 'reprocess_novar') {
                // currRecord.setValue({ fieldId: 'custpage_variance_tax_apply', value: false });
                // currRecord.setValue({ fieldId: 'custpage_variance_ship_apply', value: false });
                // currRecord.setValue({ fieldId: 'custpage_variance_other_apply', value: false });
                // currRecord.setValue({
                //     fieldId: 'custpage_variance_adjustment_apply',
                //     value: false
                // });
            }
        }

        // var fldAmount;
        // if (context.fieldId == 'custpage_variance_tax_apply') {
        //     fldAmount = context.currentRecord.getField('custpage_variance_tax');
        //     fldAmount.isDisabled = !currentValue;
        // }
        // if (context.fieldId == 'custpage_variance_ship_apply') {
        //     fldAmount = context.currentRecord.getField('custpage_variance_shipping');
        //     fldAmount.isDisabled = !currentValue;
        // }
        // if (context.fieldId == 'custpage_variance_other_apply') {
        //     fldAmount = context.currentRecord.getField('custpage_variance_other');
        //     fldAmount.isDisabled = !currentValue;
        // }

        // if (context.fieldId == 'custpage_variance_adjustment_apply') {
        //     fldAmount = context.currentRecord.getField('custpage_variance_adjustment');
        //     fldAmount.isDisabled = !currentValue;
        // }
    }

    function pageInit(context) {
        var currRecord = context.currentRecord;
        // console.log('currRecord', currRecord);

        // var taxValueField = currRecord.getField('custpage_variance_tax');
        // taxValueField.isDisabled = !currRecord.getValue('custpage_variance_tax_apply');
        // // console.log('tax', taxValueField, currRecord.getValue('custpage_variance_tax_apply'));

        // var shipValueField = currRecord.getField('custpage_variance_shipping');
        // shipValueField.isDisabled = !currRecord.getValue('custpage_variance_ship_apply');
        // // console.log('shipValueField', shipValueField, currRecord.getValue('custpage_variance_ship_apply'));

        // var otherValueField = currRecord.getField('custpage_variance_other');
        // otherValueField.isDisabled = !currRecord.getValue('custpage_variance_other_apply');

        // var adjustmentValueField = currRecord.getField('custpage_variance_adjustment');
        // adjustmentValueField.isDisabled = !currRecord.getValue(
        //     'custpage_variance_adjustment_apply'
        // );

        // console.log('otherValueField', otherValueField, currRecord.getValue('custpage_variance_other_apply'));

        return true;
    }

    return {
        fieldChanged: fieldChanged,
        pageInit: pageInit,
        goToBillFile: function () {
            var curRec = currentRecord.get();
            var url = curRec.getValue({ fieldId: 'custpage_bill_file' });
            return window.open(url, '_blank');
        },
        goToProcessBill: function () {
            var curRec = currentRecord.get();
            var url = curRec.getValue({ fieldId: 'custpage_suitelet_url' });
            url += '&taskact=processbill';

            return window.open(url);
        },
        returnBack: function () {
            return history.back();
        }
    };
});
