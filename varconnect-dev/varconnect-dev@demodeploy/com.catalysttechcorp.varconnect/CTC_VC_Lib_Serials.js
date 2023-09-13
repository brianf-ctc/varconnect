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

define(['N/search', 'N/record'], function (search, record) {
    function createSerial(serial, poId, itemId, soId) {
        var rs = search
            .create({
                type: 'customrecordserialnum',
                filters: [['name', 'is', serial], 'and', ['custrecordserialitem', 'anyof', itemId]]
            })
            .run()
            .getRange(0, 1);
        log.debug('Global search result', rs);

        if (rs.length == 0) {
            log.debug('saveSerial', serial);
            var sn_record = record.create({
                type: 'customrecordserialnum'
            });
            sn_record.setValue({
                fieldId: 'name',
                value: serial
            });
            sn_record.setValue({
                fieldId: 'custrecordserialpurchase',
                value: poId
            });
            sn_record.setValue({
                fieldId: 'custrecordserialitem',
                value: itemId
            });
            sn_record.setValue({
                fieldId: 'custrecordserialsales',
                value: soId
            });
            var sc = sn_record.save();
            log.debug('New serial id', sc);
        } else {
            log.debug('Matching serial found');
        }

        return sc ? sc : '';
    }

    return {
        createSerial: createSerial
    };
});
