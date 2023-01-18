define(['N/ui/dialog', 'N/ui/message'],
    function(dialog, message) {
        /**
         *@NApiVersion 2.0
         *@NScriptType ClientScript
         */

        function fieldChanged(context) {

            if (context.fieldId == 'custpage_polink' && nlapiGetFieldValue('custpage_polink') !== '') {

                var options = {
                    title: 'WARNING',
                    message: 'You are manually linking a PO.  Once this record is saved with a linked PO, the PO can not be changed.  This Bill will have to be closed and manually created if linked to an incorrect PO!'
                 };
                function success(result) {
                    if (result == false){
                        nlapiSetFieldValue('custpage_polink', '');
                    }
                    
                }
                function failure(reason) {
                    console.log('Failure: ' + reason);
                }
        
                dialog.confirm(options).then(success).catch(failure);
               
            }
        }

          
        return {
            fieldChanged: fieldChanged
        }

    });