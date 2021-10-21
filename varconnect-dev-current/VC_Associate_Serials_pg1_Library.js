/**
 *@NApiVersion 2.x
 * @NScriptType ClientScript
 *@NModuleScope Public
 */

define(['N/search','N/https','N/record'],
    function(search, https, record) {


        // Searches NS for first customer occurrence of provided email
        // If found return customer information, if not return null
        // Note if multiple occurrences are found, only the first result is returned
        function isNSCustomer(email) {
            if (!isEmpty(email)) {
//                alert("in isNSCustomer email = "+email);

                var myFilters = [];
                myFilters.push(search.createFilter({
                    name: 'email',
                    operator: search.Operator.IS,
                    values: email
                }));
                myFilters.push(search.createFilter({
                    name: 'isinactive',
                    operator: search.Operator.IS,
                    values: 'F'
                }));
                var results = search.create({
                    type: search.Type.CUSTOMER,
                    columns: ['email', 'firstname', 'lastname'],
                    filters: myFilters
                }).run().getRange({
                    start: 0,
                    end: 1
                });
                if (results != "") {
                    return results[0].id;
                }
            }
            return null;
        }



        function pageInit(context) {
           console.log('page init');
	   
        }

        function saveRecord(context) {
           console.log('page init');
	   
            try {
				var currentRecord = context.currentRecord;
				if (!currentRecord.getValue({ fieldId: 'transnum' }) ) {
					throw error.create({
						name: 'MISSING_REQ_ARG',
						message: 'Please enter a document number before submiting'
					});
				}
				return true;					
				
			}
			catch (err){
	           console.log('Error validating submit = '+err);
            }

        }
		
		
        function fieldChanged(context){
            console.log(context);
//			alert ('field changed ' + context.fieldId)

            if (context.fieldId=='itemselectfield'){

            }
        }



        function isEmpty (stValue)
        {
            if ((stValue == '') || (stValue == null) || (stValue == undefined))
            {
                return true;
            }
            else
            {
                if (typeof stValue == 'string')
                {
                    if ((stValue == ''))
                    {
                        return true;
                    }
                }
                else if (typeof stValue == 'object')
                {
                    if (stValue.length == 0 || stValue.length == 'undefined')
                    {
                        return true;
                    }
                }

                return false;
            }
        }




        return {
            pageInit: pageInit,
			saveRecord: saveRecord

        };
    }
);