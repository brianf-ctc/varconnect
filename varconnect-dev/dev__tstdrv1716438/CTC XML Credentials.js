/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(['N/redirect', 'N/log'], function (redirect, log) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            redirect.toRecord({
                id: 1,
                type: 'customrecord_vc_config'
            });
        }
    }
    return {
        onRequest: onRequest
    };
});
