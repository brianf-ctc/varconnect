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
/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Jan 9, 2020		paolodl		Library for main processing of VAR Connect Send PO
 */
define([
    'N/record',
    './CTC_VCSP_Lib_Preferences.js',
    './CTC_VCSP_Lib_WebService.js',
    '../VO/CTC_VCSP_PO.js',
    '../Library/CTC_VCSP_Constants.js'
], function (ns_record, pref, libWebService, PO, constant) {
    var LogTitle = 'VCSendPO';
    function _updateNativePO(options) {
        var logTitle = [LogTitle, '_updateNativePO'].join('::');
        var response = options.response,
            orderStatus = response.orderStatus,
            rec = options.purchOrder,
            isRecChanged = false;

        if (response) {
            var newHeaderValues = {};
            if (response.transactionNum) {
                newHeaderValues[constant.Fields.Transaction.VENDOR_PO_NUMBER] =
                    response.transactionNum;
            }
            newHeaderValues[constant.Fields.Transaction.VCSP_TIMESTAMP] = new Date();
            newHeaderValues[constant.Fields.Transaction.IS_PO_SENT] = response.isError
                ? false
                : true;
            newHeaderValues[constant.Fields.Transaction.VENDOR_RECEIPT] = JSON.stringify({
                code: response.responseCode,
                message: response.message
            });

            if (response.isError) {
                newHeaderValues[constant.Fields.Transaction.VENDOR_RECEIPT] =
                    JSON.stringify(response);
            }

            for (var fieldId in newHeaderValues) {
                rec.setValue({
                    fieldId: fieldId,
                    value: newHeaderValues[fieldId]
                });
                isRecChanged = true;
            }

            if (orderStatus && orderStatus.items) {
                var vcPOLineFieldsIds = constant.Fields.VarConnectPOLine;
                var poLineSublistId = ['recmach', vcPOLineFieldsIds.PURCHASE_ORDER].join('');
                var mapItemDetailsToSublistFieldId = {
                    line_number: vcPOLineFieldsIds.LINE,
                    order_status: vcPOLineFieldsIds.STATUS,
                    ship_date: vcPOLineFieldsIds.SHIP_DATE,
                    order_number: vcPOLineFieldsIds.VENDOR_ORDER_NUMBER,
                    vendorSKU: vcPOLineFieldsIds.SKU,
                    item_number: vcPOLineFieldsIds.MPN,
                    note: vcPOLineFieldsIds.DESCRIPTION,
                    quantity: vcPOLineFieldsIds.QUANTITY,
                    ship_qty: vcPOLineFieldsIds.QTY_SHIPPED,
                    ship_from: vcPOLineFieldsIds.SHIP_FROM,
                    ship_method: vcPOLineFieldsIds.SHIP_METHOD,
                    carrier: vcPOLineFieldsIds.SHIP_METHOD_DESCRIPTION,
                    eta_date: vcPOLineFieldsIds.ETA_DATE,
                    tracking_num: vcPOLineFieldsIds.TRACKING_NUMBERS,
                    serial_num: vcPOLineFieldsIds.SERIAL_NUMBERS
                };
                for (var i = 0, len = orderStatus.items.length; i < len; i += 1) {
                    var responseLineDetails = orderStatus.items[i];
                    rec.selectLine({
                        sublistId: poLineSublistId,
                        line: i
                    });
                    for (var responseLineProperty in mapItemDetailsToSublistFieldId) {
                        var columnFieldId = mapItemDetailsToSublistFieldId[responseLineProperty],
                            columnValue = responseLineDetails[responseLineProperty];
                        if (columnValue != 'NA') {
                            rec.setCurrentSublistValue({
                                sublistId: poLineSublistId,
                                fieldId: columnFieldId,
                                value: columnValue
                            });
                        }
                    }
                    // meant to record only 1st log id
                    rec.setCurrentSublistValue({
                        sublistId: poLineSublistId,
                        fieldId: vcPOLineFieldsIds.CREATE_LOG,
                        value: response.logId
                    });
                    // meant to record latest log id if order status is periodically fetched
                    rec.setCurrentSublistValue({
                        sublistId: poLineSublistId,
                        fieldId: vcPOLineFieldsIds.UPDATE_LOG,
                        value: response.logId
                    });
                    rec.commitLine({
                        sublistId: poLineSublistId,
                        ignoreRecalc: true
                    });
                    isRecChanged = true;
                }
            }

            if (isRecChanged) {
                log.audit(
                    logTitle,
                    'Update purchase order. Id=' +
                        rec.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        })
                );
            }
        }
    }

    function sendPO(options) {
        var logTitle = [LogTitle, 'sendPO'].join('::');

        var recId = options.recId,
            response;
        var rec = ns_record.load({
            type: ns_record.Type.PURCHASE_ORDER,
            id: recId,
            isDynamic: true
        });

        if (rec) {
            response = libWebService.process({ nativePO: rec });

            log.audit(logTitle, '>> send PO response: ' + JSON.stringify(response));
            _updateNativePO({ response: response, purchOrder: rec });
        }

        return response;
    }

    return {
        sendPO: sendPO
    };
});
