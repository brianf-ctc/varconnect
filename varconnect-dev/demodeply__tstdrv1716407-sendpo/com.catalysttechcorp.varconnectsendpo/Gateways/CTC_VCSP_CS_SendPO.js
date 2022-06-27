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
define([
    'N/currentRecord',
    'N/url',
    'N/https',
    'N/ui/message',
    '../Library/CTC_VCSP_Constants.js'
], function (currentRecord, url, https, message, constants) {
    var msgObj;

    function _callSendPOSuitelet(options) {
        var recId = options.recId,
            params = { custparam_recId: recId },
            protocol = 'https://',
            domain = url.resolveDomain({
                hostType: url.HostType.APPLICATION
            }),
            linkUrl = url.resolveScript({
                scriptId: constants.Scripts.Script.SEND_PO_SL,
                deploymentId: constants.Scripts.Deployment.SEND_PO_SL,
                params: params
            }),
            link = protocol + domain + linkUrl;

        var res = https.get({
            url: link
        });

        console.log(res);

        var result = JSON.parse(res.body);

        return result;
    }

    function _displayMessage(options) {
        var code = options.code,
            msg = options.message;

        if (msgObj) msgObj.hide();

        if (code == 200 && !msg) {
            msgObj = message.create({
                title: 'Send PO Successful',
                message: 'PO has been successfully sent to the vendor',
                type: message.Type.CONFIRMATION
            });
        } else {
            var msgDisplay =
                'There was a problem sending the PO to the vendor :<br/>' +
                msg +
                '<br/>Please contact the vendor or Catalyst';
            msgObj = message.create({
                title: 'Send PO Unsuccessful',
                message: msgDisplay,
                type: message.Type.WARNING
            });
        }

        if (msgObj) msgObj.show();
    }

    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {}

    function sendPO() {
        var recId = currentRecord.get().id;

        //    	libMain.sendPO({recId: recId});
        var result = _callSendPOSuitelet({ recId: recId });
        _displayMessage(result);
    }

    return {
        pageInit: pageInit,
        sendPO: sendPO
    };
});
