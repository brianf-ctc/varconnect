//*************************************************************************
//*
//*************************************************************************

/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/email',
    'N/runtime',
    'N/log',
    'N/search',
    'N/record',
    'N/http'
], function (ui, email, runtime, log, search, rec, http) {
    const SUBLIST_ID = 'custpage_orders';

    function onRequest(context) {
        if (context.request.method == 'GET') {
            doGet(context);
        } else if (context.request.method == 'POST') {
            doPost(context);
        }
    }

    function doGet(context) {
        var form = ui.createForm({
            title: 'PO Manual Add Serial Numbers'
        });
        form.clientScriptModulePath = './VarConnect_Bulk_Serials_Library.js';

        form.addSubmitButton({
            label: 'Load PO'
        });

        /* 			var loadPoBtn = form.addButton({
                            id: 'loadpo',
                            label: 'Load PO',
                            functionName: 'loadPO'
                        });
             */
        var poNum = form.addField({
            id: 'ponum',
            type: ui.FieldType.TEXT,
            label: 'PO Number:'
        });

        /* 		   var itemselect = form.addField({
                           id: 'itemselectfield',
                           type: ui.FieldType.SELECT,
                           label: 'Items'
                       });

                       itemselect.addSelectOption({
                           value: 'item0',
                           text: 'Select Item'
                       });

                       itemselect.addSelectOption({
                           value: 'item1',
                           text: 'Item 1'
                       });

                          itemselect.addSelectOption({
                           value: 'item2',
                           text: 'Item 2'
                       });


                        var currentSerialNums = form.addField({
                           id: 'currentserialnums',
                           type: ui.FieldType.LONGTEXT,
                           label: 'Existing Serial Numbers:'
                        });

                        var newSerialNums = form.addField({
                           id: 'newserialnums',
                           type: ui.FieldType.LONGTEXT,
                           label: 'New Serial Numbers:'
                        });
             */

        context.response.writePage(form);
    }

    function doPost(context) {
        var request = context.request;

        /* 				log.debug({title: 'In POST code', details: 'Submit button clicked'});  */
        var poField = context.request.parameters.ponum;
        log.debug('in doPost', 'poNum = ' + poField);
        if (!isEmpty(poField)) {
            var param = new Array();

            param['item'] = poField;
            //Redirect to second Suitelet Page
            log.debug('in doPost', 'before redirect');
            context.response.sendRedirect({
                type: http.RedirectType.SUITELET,
                identifier: 'customscript_vc_sl_bulk_serials_pg2',
                id: 'customdeploy_vc_bulk_serial_numbers_pg2',
                editMode: false,
                parameters: param
            });
        } else {
            log.debug({ title: 'In POST code', details: 'PO Num EMPTY' });
            var form = ui.createForm({
                title: 'PO Number Required. Please try again'
            });
            context.response.writePage(form);
        }

        // When completed go back to the Suitelet main screen
        /* 			context.response.sendRedirect ({
                            type: http.RedirectType.SUITELET,
                            identifier: 'customscript_vc_bulk_serial_numbers',
                            id: 'customdeploy_vc_bulk_serial_numbers'
                        });
             */
    }

    function isEmpty(stValue) {
        if (stValue == '' || stValue == null || stValue == undefined) {
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

    function isEven(n) {
        return n % 2 == 0;
    }

    return {
        onRequest: onRequest
    };
});
