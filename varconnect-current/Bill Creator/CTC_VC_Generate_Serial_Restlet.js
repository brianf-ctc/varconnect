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
 * @NScriptType Restlet
 */
define(['N/record', './../CTC_VC2_Lib_Utils'], function (ns_record, vc_util) {
    var LogTitle = 'VC|Generate Serials',
        LogPrefix = '';

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            log.debug(logTitle, LogPrefix + '**** START SCRIPT *** ' + JSON.stringify(context));

            try {
                var vcSerial = context.serialObj;
                var lineToProcess = context.lineToProcess;

                log.debug(logTitle, LogPrefix + ' // vcSerial:  ' + JSON.stringify(vcSerial));
                log.debug(logTitle, LogPrefix + ' // lineToProcess:  ' + JSON.stringify(lineToProcess));

                for (var i = 0; i < vcSerial.lines[lineToProcess].serials.length; i++) {
                    var serialRec = ns_record.create({
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
            } catch (error) {
                returnObj.msg = vc_util.extractError(error);
                returnObj.isError = true;
                log.debug(logTitle, '## ERROR ## ' + JSON.stringify(error));
            }

            return returnObj;
        }
    };

    return RESTLET;
});
