/*
*SerialsLibrary.js
*@NApiVersion 2.x
*@NModuleScope Public
*/

define(['N/search', 'N/runtime', 'N/record'],
    function(search, runtime, record) {

        function createSerial(serial, poId, itemId, soId) {
            var rs = search.global({ keywords: serial});
            log.debug("Global search result", rs);

            if (rs.length == 0) {
                log.debug("saveSerial", serial);
                var sn_record = record.create({
                    type: 'customrecordserialnum'
                })
                sn_record.setValue({
                    fieldId: 'name',
                    value: serial
                })
                sn_record.setValue({
                    fieldId: 'custrecordserialpurchase',
                    value: poId
                })
                sn_record.setValue({
                    fieldId: 'custrecordserialitem',
                    value: itemId
                })
                sn_record.setValue({
                    fieldId: 'custrecordserialsales',
                    value: soId
                })
                var sc = sn_record.save();
                log.debug("New serial id",sc);
            } else {
                log.debug("Matching serial found");
            }

            return sc ? sc : ""
        }

        return {
            createSerial: createSerial
        };

    });