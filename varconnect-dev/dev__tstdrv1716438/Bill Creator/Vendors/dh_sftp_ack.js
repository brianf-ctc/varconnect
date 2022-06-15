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
 */

define(['N/search', 'N/sftp', 'N/file', '../Libraries/moment'], function (
    search,
    sftp,
    file,
    moment
) {
    function sendAck(input, config, billId) {
        //log.debug('input', input)
        //log.debug('config', config)
        //log.debug('billId', billId)

        var transaction = search.lookupFields({
            type: search.Type.TRANSACTION,
            id: billId,
            columns: ['entity', 'tranid']
        });

        log.audit('transaction', transaction);

        var parent = search.lookupFields({
            type: search.Type.TRANSACTION,
            id: input,
            columns: ['entity', 'tranid']
        });

        log.audit('parent', parent);

        var connection = sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.ack_path,
            hostKey: config.host_key
        });

        // specify the file to upload using the N/file module

        //ErgonomicGroup_InvoiceAck_{DateTime}.txt
        //PONumber1|InvoiceNumber1|DateTimeoftheinvoicereceived

        var ackString = parent.tranid + '|';
        ackString += transaction.tranid + '|';
        ackString += moment().format();

        var ackFile = file.create({
            name: 'ErgonomicGroup_InvoiceAck_' + moment().format('YYYYMMDDTHHmmssS') + '.txt',
            fileType: file.Type.PLAINTEXT,
            contents: ackString
        });

        // upload the file to the remote server

        connection.upload({
            file: ackFile,
            replaceExisting: true
        });

        return;
    }

    // Add the return statement that identifies the entry point function.
    return {
        sendAck: sendAck
    };
});
