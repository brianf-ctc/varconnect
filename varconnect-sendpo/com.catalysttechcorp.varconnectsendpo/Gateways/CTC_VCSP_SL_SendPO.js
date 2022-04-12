/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/runtime', '../Library/CTC_VCSP_Lib_Main.js'], function (runtime, libMain) {
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        var recId = context.request.parameters.custparam_recId,
            resp = libMain.sendPO({ recId: recId });

        context.response.write({ output: JSON.stringify(resp) });
    }

    return {
        onRequest: onRequest
    };
});
