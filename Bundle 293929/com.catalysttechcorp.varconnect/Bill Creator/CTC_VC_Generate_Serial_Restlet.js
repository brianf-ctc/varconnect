/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['N/record', 'N/log'], function (record, log) {
    function _post(context) {
        log.debug('restlet called', context);

        var vcSerial = context.serialObj;
        var lineToProcess = context.lineToProcess;

        for (var i = 0; i < vcSerial.lines[lineToProcess].serials.length; i++) {
            var serialRec = record.create({
                type: 'customrecordserialnum',
                isDynamic: true
            });

            serialRec.setValue({
                fieldId: 'name',
                value: vcSerial.lines[lineToProcess].serials[i]
            });

            serialRec.setValue({
                fieldId: 'custrecordserialpurchase',
                value: vcSerial.poId
            });

            serialRec.setValue({
                fieldId: 'custrecordserialsales',
                value: vcSerial.soId
            });

            serialRec.setValue({
                fieldId: 'custrecordserialitem',
                value: vcSerial.lines[lineToProcess].item
            });

            serialRec.setValue({
                fieldId: 'custrecordcustomer',
                value: vcSerial.custId
            });

            if (vcSerial.type == 'if') {
                serialRec.setValue({
                    fieldId: 'custrecorditemfulfillment',
                    value: vcSerial.trxId
                });
            } else if (vcSerial.type == 'ir') {
                serialRec.setValue({
                    fieldId: 'custrecorditemreceipt',
                    value: vcSerial.trxId
                });
            }

            var record_id = serialRec.save();

            log.debug('created', record_id);
        }
    }

    return {
        //get: _get,
        post: _post
    };
});
