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
    const PO_TRANSACTION_ID = 15;
    const ITEM_RECEIPT_TRANSACTION_ID = 16;
    const ITEM_FULFILLMENT_TRANSACTION_ID = 32;
    const RMA_TRANSACTION_ID = 33;
    const VENDOR_RMA_TRANSACTION_ID = 43;

    function onRequest(context) {
        if (context.request.method == 'GET') {
            doGet(context);
        } else if (context.request.method == 'POST') {
            doPost(context);
        }
    }

    function doGet(context) {
        // get the order type from a script parameter
        var scriptOrderType = runtime.getCurrentScript().getParameter({ name: 'custscript7' });
        var formTitle = '';
        var buttonLabel = '';
        var fieldLabel = '';

        if (scriptOrderType == ITEM_FULFILLMENT_TRANSACTION_ID) {
            formTitle = 'Item Fulfillment Assign Serial Numbers';
            buttonLabel = 'Load Item Fulfillment';
            fieldLabel = 'Item Fulfillment Number:';
        } else if (scriptOrderType == RMA_TRANSACTION_ID) {
            formTitle = 'RMA Assign Serial Numbers';
            buttonLabel = 'Load RMA';
            fieldLabel = 'RMA Number:';
        } else if (scriptOrderType == VENDOR_RMA_TRANSACTION_ID) {
            formTitle = 'Vendor RMA Assign Serial Numbers';
            buttonLabel = 'Load Vendor RMA';
            fieldLabel = 'Vendor RMA Number:';
        }

        var form = ui.createForm({
            title: formTitle
        });
        form.clientScriptModulePath = './VC_Associate_Serials_pg1_Library.js';

        form.addSubmitButton({
            label: buttonLabel
        });

        var poNum = form.addField({
            id: 'transnum',
            type: ui.FieldType.TEXT,
            label: fieldLabel
        });
        var tranType = form.addField({
            id: 'transtype',
            type: ui.FieldType.TEXT,
            label: 'transtype'
        });
        tranType.defaultValue = scriptOrderType;
        tranType.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

        context.response.writePage(form);
    }

    function doPost(context) {
        var request = context.request;

        /* 				log.debug({title: 'In POST code', details: 'Submit button clicked'});  */
        var transField = context.request.parameters.transnum;
        var typeField = context.request.parameters.transtype;
        log.debug('in doPost', 'poNum = ' + transField);
        if (!isEmpty(transField)) {
            var param = new Array();

            param['transnum'] = transField;

            var redirectScript = '';
            var redirectDeploy = '';
            if (typeField == ITEM_FULFILLMENT_TRANSACTION_ID) {
                redirectScript = 'customscript_vc_associatesn_pg2';
                redirectDeploy = 'customdeploy_vc_associate_sn_pg2_if';
            } else if (typeField == RMA_TRANSACTION_ID) {
                redirectScript = 'customscript_vc_associatesn_pg2';
                redirectDeploy = 'customdeploy_vc_associate_sn_pg2_rma';
            } else if (typeField == VENDOR_RMA_TRANSACTION_ID) {
                redirectScript = 'customscript_vc_associatesn_pg2';
                redirectDeploy = 'customdeploy_vc_associate_sn_pg2_vnd_rma';
            }

            //Redirect to second Suitelet Page
            log.debug('in doPost', 'before redirect');
            context.response.sendRedirect({
                type: http.RedirectType.SUITELET,
                identifier: redirectScript,
                id: redirectDeploy,
                editMode: false,
                parameters: param
            });
        } else {
        }
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
