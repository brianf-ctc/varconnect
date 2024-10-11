/**
 * Copyright (c) 2024  sCatalyst Tech Corp
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
define(['N/search', 'N/record', '../CTC_VC2_Lib_Utils.js', '../CTC_VC2_Constants.js'], function (
    ns_search,
    ns_record,
    vc2_util,
    vc2_constant
) {
    var LogTitle = 'SVC:VCProcess',
        LOG_APP = 'VCProcess';

    var ERROR_MSG = vc2_constant.ERRORMSG,
        LOG_STATUS = vc2_constant.LIST.VC_LOG_STATUS;

    return {
        processSerials: function (option) {
            var logTitle = [LogTitle, 'processSerials'].join(':'),
                returnValue,
                SERIAL_REC = vc2_constant.RECORD.SERIALS;

            var recordValues = {},
                arrSearchCols = ['internalid', 'name'],
                arrSerialFilters = [],
                arrSerials = option.serials;

            if (vc2_util.isEmpty(arrSerials)) return false;

            // make the list unique
            arrSerials = vc2_util.uniqueArray(arrSerials);

            vc2_util.log(logTitle, '// Total serials: ', arrSerials.length);

            for (var fld in SERIAL_REC.FIELD) {
                if (option[fld] == null) continue;
                recordValues[SERIAL_REC.FIELD[fld]] = option[fld];
                arrSearchCols.push(SERIAL_REC.FIELD[fld]);
            }
            vc2_util.log(logTitle, '>> record data: ', recordValues);

            // search if serials are already existing
            var searchOption = {
                type: SERIAL_REC.ID,
                filters: [['isinactive', 'is', 'F']],
                columns: arrSearchCols
            };

            arrSerials.forEach(function (serial) {
                if (arrSerialFilters.length) arrSerialFilters.push('OR');
                arrSerialFilters.push(['name', 'is', serial]);
                return true;
            });

            searchOption.filters.push(
                'AND',
                arrSerialFilters.length > 1 ? arrSerialFilters : arrSerialFilters.shift()
            );

            // vc2_util.log(logTitle, '>> searchOption: ', searchOption);
            var serialSarchObj = ns_search.create(searchOption);
            vc2_util.log(logTitle, '>> Total existing serials: ', serialSarchObj.runPaged().count);

            // prepare serials creation/update
            var arrUpdatedSerial = [],
                arrAddedSerial = [],
                arrProcessedSerial = [];

            // First update the existing ones
            serialSarchObj.run().each(function (searchRow) {
                var serialNum = searchRow.getValue({ name: 'name' });
                ns_record.submitFields({
                    type: SERIAL_REC.ID,
                    id: searchRow.id,
                    values: recordValues,
                    options: { enablesourcing: true }
                });
                arrUpdatedSerial.push(serialNum);
                arrProcessedSerial.push(serialNum);

                vc2_util.log(logTitle, '>> Updated Serial: ', [serialNum, searchRow.id]);
                return true;
            });

            // then create the remainin
            arrSerials.forEach(function (serial) {
                if (vc2_util.inArray(serial, arrUpdatedSerial)) return;

                var recSerial = ns_record.create({ type: SERIAL_REC.ID });
                recSerial.setValue({ fieldId: 'name', value: serial });

                for (var fld in recordValues) {
                    recSerial.setValue({ fieldId: fld, value: recordValues[fld] });
                }
                var serialId = recSerial.save();

                vc2_util.log(logTitle, '>> New Serial ID: ', [serial, recordValues, serialId]);

                arrAddedSerial.push(serial);
                arrProcessedSerial.push(serial);
            });

            vc2_util.log(logTitle, '...total processed serials: ', {
                recordValues: recordValues,
                processed: arrProcessedSerial.length,
                added: arrAddedSerial.length,
                updated: arrUpdatedSerial.length
            });

            return true;
        },
        processOrderLines: function (option) {
            var logTitle = [LogTitle, 'processOrderLines'].join(':'),
                returnValue,
                ORDERLINE_REC = vc2_constant.RECORD.ORDER_LINE;
            /**
    OrderNum: orderResult.ingramOrderNumber,
    OrderDate: orderResult.ingramOrderDate,
    customerOrderNum: orderResult.customerOrderNumber,
    Status: orderResult.orderStatus,
    Total: orderResult.orderTotal
             */
        },
        processOrderLine: function (option) {
            var logTitle = [LogTitle, 'processOrderLine'].join(':'),
                returnValue,
                ORDERLINE_REC = vc2_constant.RECORD.ORDER_LINE;

            // required params
            var txnId = option.txnid || option.po_id || option.poId;

            return returnValue;
        }
    };
});
