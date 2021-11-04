define(['N/ui/dialog', 'N/ui/message', 'N/currentRecord'], function (
    dialog,
    message,
    currentRecord
) {
    /**
     *@NApiVersion 2.0
     *@NScriptType ClientScript
     */

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

        if (context.fieldId == 'custpage_action') {
            var currRecord = context.currentRecord;
            // console.log('custpage_action', currentValue);

            var taxValue = currRecord.getValue('custpage_variance_tax');
            var shipValue = currRecord.getValue('custpage_variance_shipping');
            var otherValue = currRecord.getValue('custpage_variance_other');
            var adjValue = currRecord.getValue('custpage_variance_adjustment');

            // console.log('custpage_action', taxValue, shipValue, otherValue);

            if (currentValue == 'reprocess_hasvar') {
                currRecord.setValue({ fieldId: 'custpage_variance_tax_apply', value: !!taxValue });
                currRecord.setValue({
                    fieldId: 'custpage_variance_ship_apply',
                    value: !!shipValue
                });
                currRecord.setValue({
                    fieldId: 'custpage_variance_other_apply',
                    value: !!otherValue
                });
                currRecord.setValue({
                    fieldId: 'custpage_variance_adjustment_apply',
                    value: !!adjValue
                });
            } else if (currentValue == 'reprocess_novar') {
                currRecord.setValue({ fieldId: 'custpage_variance_tax_apply', value: false });
                currRecord.setValue({ fieldId: 'custpage_variance_ship_apply', value: false });
                currRecord.setValue({ fieldId: 'custpage_variance_other_apply', value: false });
                currRecord.setValue({
                    fieldId: 'custpage_variance_adjustment_apply',
                    value: false
                });
            }
        }

        var fldAmount;
        if (context.fieldId == 'custpage_variance_tax_apply') {
            fldAmount = context.currentRecord.getField('custpage_variance_tax');
            fldAmount.isDisabled = !currentValue;
        }
        if (context.fieldId == 'custpage_variance_ship_apply') {
            fldAmount = context.currentRecord.getField('custpage_variance_shipping');
            fldAmount.isDisabled = !currentValue;
        }
        if (context.fieldId == 'custpage_variance_other_apply') {
            fldAmount = context.currentRecord.getField('custpage_variance_other');
            fldAmount.isDisabled = !currentValue;
        }

        if (context.fieldId == 'custpage_variance_adjustment_apply') {
            fldAmount = context.currentRecord.getField('custpage_variance_adjustment');
            fldAmount.isDisabled = !currentValue;

            // var lineCount = context.currentRecord.getLineCount({
            //     sublistId: 'sublist'
            // });

            // for (var line = 0; line < lineCount; line++) {
            //     context.currentRecord.selectLine({
            //         sublistId: 'sublist',line: line
            //     })
            //     var rateValue = context.currentRecord.getSublistValue({
            //         sublistId: 'sublist',
            //         fieldId: !currentValue ? 'billrate' : 'nsrate',
            //         line: line
            //     });

            //     context.currentRecord.setCurrentSublistValue({
            //         sublistId: 'sublist',
            //         fieldId: 'frate',
            //         value: rateValue
            //     });
            // }
        }
    }

    function pageInit(context) {
        var currRecord = context.currentRecord;
        // console.log('currRecord', currRecord);

        var taxValueField = currRecord.getField('custpage_variance_tax');
        taxValueField.isDisabled = !currRecord.getValue('custpage_variance_tax_apply');
        // console.log('tax', taxValueField, currRecord.getValue('custpage_variance_tax_apply'));

        var shipValueField = currRecord.getField('custpage_variance_shipping');
        shipValueField.isDisabled = !currRecord.getValue('custpage_variance_ship_apply');
        // console.log('shipValueField', shipValueField, currRecord.getValue('custpage_variance_ship_apply'));

        var otherValueField = currRecord.getField('custpage_variance_other');
        otherValueField.isDisabled = !currRecord.getValue('custpage_variance_other_apply');

        var adjustmentValueField = currRecord.getField('custpage_variance_adjustment');
        adjustmentValueField.isDisabled = !currRecord.getValue(
            'custpage_variance_adjustment_apply'
        );

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
            return window.open(url, '_blank');
        }
    };
});
