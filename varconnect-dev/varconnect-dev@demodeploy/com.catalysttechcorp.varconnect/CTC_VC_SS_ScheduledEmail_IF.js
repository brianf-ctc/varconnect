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
 * @NScriptType ScheduledScript
 */

/**
 * Module Description
 * Scheduled script that will send an email summary of the days shipments to recipients listed in a body field on the SO
 */
define([
    'N/search',
    'N/email',
    'N/record',
    'N/runtime',
    'N/render',
    './CTC_VC_Lib_MainConfiguration.js',
    './CTC_VC2_Lib_Utils.js',
    './CTC_VC2_Constants.js'
], function (
    ns_search,
    ns_email,
    ns_record,
    ns_runtime,
    ns_render,
    lib_mainconfig,
    vc2_util,
    vc2_constant
) {
    var CURRENT = {},
        LogTitle = 'Email-IF';
    var testEmail; // send to this email for testing

    function execute(context) {
        var logTitle = [LogTitle, 'execute'].join('::');

        var startTime = new Date();

        try {
            CURRENT.mainConfig = lib_mainconfig.getMainConfiguration();
            CURRENT.senderId = CURRENT.mainConfig.emailSender;
            CURRENT.emailTemplate = CURRENT.mainConfig.emailTemplate;
            CURRENT.searchId = CURRENT.mainConfig.fulfillmentSearch;

            log.debug(logTitle, '*********** Script Execution Start: ' + JSON.stringify(context));
            log.debug(logTitle, '... config settings: ' + JSON.stringify(CURRENT));

            if (!CURRENT.senderId) throw 'Missing email sender settings';
            if (!CURRENT.searchId) throw 'Missing search ID';

            var myResults = getItemFulfillments(CURRENT.searchId),
                emailsList = [],
                i,
                ii;

            // build unique list of emails addresses
            for (i = 0; i < myResults.length; i++) {
                var sendTo = myResults[i].getValue({
                    name: vc2_constant.FIELD.TRANSACTION.SEND_SHIPPING_UPDATE_TO,
                    // constants.Fields.Transaction.SEND_SHIPPING_UPDATE_TO,
                    join: 'createdFrom'
                });
                if (!sendTo) continue;
                var sendToList = sendTo.split(',');

                for (ii = 0; ii < sendToList.length; ii++) {
                    if (emailsList.indexOf(sendToList[ii]) >= 0) continue;
                    emailsList.push(sendToList[ii]);
                }
            }

            log.debug(logTitle, '>>> unique email list: ' + JSON.stringify(emailsList));

            for (i = 0; i < emailsList.length; i++) {
                var newSendTo = emailsList[i];
                var resultsList = [];

                // build list of entries for that email from the search results
                for (ii = 0; ii < myResults.length; ii++) {
                    var sendTo2 = myResults[ii].getValue({
                        name: vc2_constant.FIELD.TRANSACTION.SEND_SHIPPING_UPDATE_TO,
                        // constants.Fields.Transaction.SEND_SHIPPING_UPDATE_TO,
                        join: 'createdFrom'
                    });
                    if (sendTo2.indexOf(newSendTo) >= 0) {
                        resultsList.push(myResults[ii]);
                    }
                }
                if (!resultsList.length) continue;

                var itemTableHTML = buildItemTable(resultsList);

                if (testEmail) newSendTo = testEmail;

                log.debug(logTitle, ' /// sending email to: ' + newSendTo);

                // load email template, build and insert item table
                var emailDetails = buildEmail(CURRENT.emailTemplate, itemTableHTML);

                try {
                    ns_email.send({
                        author: CURRENT.senderId,
                        recipients: newSendTo,
                        subject: emailDetails.subject,
                        body: emailDetails.body
                    });
                    log.debug(logTitle, '...email succesfully sent');
                } catch (err) {
                    log.error(logTitle, '## Error sending email: ' + JSON.stringify(err));
                }
            }
        } catch (error) {
            log.error(logTitle, error);
            throw error;
        } finally {
            log.debug(
                logTitle,
                '******* Script Execution End: ' +
                    JSON.stringify({ durationms: new Date() - startTime })
            );
        }

        return true;
    }

    // Run a search for item fulfillments created today, return array of results
    function getItemFulfillments() {
        var logTitle = [LogTitle, 'getItemFulfillments'].join('::');

        log.audit(logTitle, '// get itemfulfillments from search: ' + CURRENT.searchId);

        var itemFFSearchObj = ns_search.load({ id: CURRENT.searchId });
        var itemFFSearchAll = vc2_util.searchAllPaged({ searchObj: itemFFSearchObj });

        log.debug(logTitle, '... results count' + itemFFSearchAll.length);
        var resultList = [];

        itemFFSearchAll.forEach(function (result) {
            var tempQty = result.getValue({ name: 'quantity' });
            if (!isEmpty(tempQty) && tempQty.indexOf('-') < 0) {
                resultList.push(result);
            }

            if (testEmail) return false; // test using first result

            return true;
        });

        // itemFFSearchObj.run().each(function (result) {
        //     // .run().each has a limit of 4,000 results
        //     var tempQty = result.getValue({ name: 'quantity' });
        //     if (!isEmpty(tempQty) && tempQty.indexOf('-') < 0) {
        //         resultList.push(result);
        //     }

        //     return true;
        // });

        return resultList;
    }

    function buildItemTable(bodyList) {
        var thStyle =
            'style="border:1px solid black; border-collapse:collapse;' +
            'font-size:small; padding: 5px 10px 5px 10px;"';
        var tdStyle =
            'style="border:1px solid black; border-collapse:collapse; ' +
            'font-size:small; padding: 5px 10px 5px 10px;"';

        var emailItemTable =
            '<table style="border: 1px solid black;border-collapse: collapse;font-size:small;width:900px">' +
            ('<thead><tr>' +
                ('<th ' + thStyle + '>CUSTOMER PO#</th>') +
                ('<th ' + thStyle + '>SALES ORDER #</th>') +
                ('<th ' + thStyle + '>ITEM #</th>') +
                ('<th ' + thStyle + '>QTY FULFILLED</th>') +
                ('<th ' + thStyle + '>TRACKING NUMBERS</th>') +
                ('<th ' + thStyle + '>CARRIER</th>') +
                '</tr></thead>');

        for (var i = 0; i < bodyList.length; i++) {
            var tempPO = bodyList[i].getValue({ name: 'otherrefnum', join: 'createdFrom' });
            var tempSO = bodyList[i].getText({ name: 'createdFrom' });
            var tempItem = bodyList[i].getText({ name: 'item' });
            var tempQty = bodyList[i].getValue({ name: 'quantity' });
            var tempTracking = bodyList[i].getValue({ name: 'custcol_ctc_xml_tracking_num' });
            var tempCarrier = bodyList[i].getValue({ name: 'custcol_ctc_xml_carrier' });
            // var tempCompany = bodyList[i].getText({ name: 'entity', join: 'createdFrom' });
            // var tempContact = bodyList[z].getValue({ name: 'contact', join: "customerMain" });
            // var tempShipTo = bodyList[i].getValue({ name: 'shipaddress', join: 'createdFrom' });

            emailItemTable +=
                '<tr>' +
                ('<td ' + tdStyle + '>' + tempPO + '</td>') +
                ('<td ' + tdStyle + '>' + tempSO + '</td>') +
                ('<td ' + tdStyle + '>' + tempItem + '</td>') +
                ('<td ' + tdStyle + '>' + tempQty + '</td>') +
                ('<td ' + tdStyle + '>' + tempTracking + '</td>') +
                ('<td ' + tdStyle + '>' + tempCarrier + '</td>') +
                '</tr>';
        }
        emailItemTable += '</table>';

        return emailItemTable;
    }

    function buildEmail(templateId, itemTableHTML) {
        var logTitle = [LogTitle, ' buildEmail'].join('::');

        // Internal ID of the record to attach the email to
        //var relatedRecordJson = { 'transactionId': tranRec.id };

        // Load email template
        var emailTemplate = ns_record.load({
            type: ns_record.Type.EMAIL_TEMPLATE,
            id: templateId,
            isDynamic: false
        });
        // Get Template Subject and Body
        var emailBody = emailTemplate.getValue({ fieldId: 'content' }),
            emailSubj = emailTemplate.getValue({ fieldId: 'subject' });

        // Create a template rendere so we can render (fill in template field tags)
        var renderer = ns_render.create();

        // render the subject line
        renderer.templateContent = emailSubj;
        var newSubject = renderer.renderAsString();

        // render email body
        renderer.templateContent = emailBody;
        var newBody = renderer.renderAsString();

        // replace the string <TABLEINFO> in the template body with the HTML string emailBody
        newBody = newBody.replace('%%TABLEINFO%%', itemTableHTML);

        // log.audit(logTitle, '>> email body:  ' + newBody);

        return {
            subject: newSubject,
            body: newBody
        };
    }

    function getTodayDate() {
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1; //January is 0!
        var yyyy = today.getFullYear();

        if (dd < 10) {
            dd = '0' + dd;
        }

        if (mm < 10) {
            mm = '0' + mm;
        }

        today = mm + '/' + dd + '/' + yyyy;
        return today;
    }

    function getAllResults(resultset) {
        var returnSearchResults = [];
        var searchid = 0;
        do {
            var resultslice = resultset.getRange({
                start: searchid,
                end: searchid + 1000
            });
            for (var rs in resultslice) {
                returnSearchResults.push(resultslice[rs]);
                searchid++;
            }
        } while (resultslice.length >= 1000);

        return returnSearchResults;
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

    return {
        execute: execute
    };
});
