/**
 * Copyright (c) 2023 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
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
    './CTC_VCSP_Lib_WebService',
    '../VO/CTC_VCSP_PO',
    './CTC_VCSP_Lib_Preferences',
    '../Library/CTC_VCSP_Constants'
], function (NS_Record, libWebService, PO, VCSP_Pref, VCSP_Global) {
    let LogTitle = 'VCSendPO';
    function _updateNativePO(option) {
        let logTitle = [LogTitle, '_updateNativePO'].join('::');
        let response = option.response,
            orderStatus = response.orderStatus,
            rec = option.purchOrder,
            isRecChanged = false;

        if (response) {
            let newHeaderValues = {};
            if (response.transactionNum) {
                newHeaderValues[VCSP_Global.Fields.Transaction.VENDOR_PO_NUMBER] =
                    response.transactionNum;
            }
            newHeaderValues[VCSP_Global.Fields.Transaction.VCSP_TIMESTAMP] = new Date();
            newHeaderValues[VCSP_Global.Fields.Transaction.IS_PO_SENT] = response.isError
                ? false
                : true;
            newHeaderValues[VCSP_Global.Fields.Transaction.VENDOR_RECEIPT] = JSON.stringify({
                code: response.responseCode,
                message: response.message
            });
            newHeaderValues[VCSP_Global.Fields.Transaction.IS_AWAITING_RESPONSE] =
                !!response.isAsync;

            if (response.isError) {
                newHeaderValues[VCSP_Global.Fields.Transaction.VENDOR_RECEIPT] =
                    JSON.stringify(response);
            }

            for (let fieldId in newHeaderValues) {
                rec.setValue({
                    fieldId: fieldId,
                    value: newHeaderValues[fieldId]
                });
                isRecChanged = true;
            }

            if (orderStatus && orderStatus.items) {
                let vcPOLineFieldsIds = VCSP_Global.Fields.VarConnectPOLine;
                let poLineSublistId = ['recmach', vcPOLineFieldsIds.PURCHASE_ORDER].join('');
                let mapItemDetailsToSublistFieldId = {
                    line_unique_key: vcPOLineFieldsIds.LINE_UNIQUE_KEY,
                    line_number: vcPOLineFieldsIds.LINE,
                    vendor_line: vcPOLineFieldsIds.VENDOR_LINE,
                    order_status: vcPOLineFieldsIds.STATUS,
                    order_type: vcPOLineFieldsIds.TYPE,
                    vendor_order_number: vcPOLineFieldsIds.VENDOR_ORDER_NUMBER,
                    customer_order_number: vcPOLineFieldsIds.CUSTOMER_ORDER_NUMBER,
                    vendor_sku: vcPOLineFieldsIds.SKU,
                    item_number: vcPOLineFieldsIds.MPN,
                    note: vcPOLineFieldsIds.NOTE,
                    quantity: vcPOLineFieldsIds.QUANTITY,
                    rate: vcPOLineFieldsIds.RATE,
                    ship_date: vcPOLineFieldsIds.SHIP_DATE,
                    ship_qty: vcPOLineFieldsIds.QTY_SHIPPED,
                    ship_from: vcPOLineFieldsIds.SHIP_FROM,
                    ship_method: vcPOLineFieldsIds.SHIP_METHOD,
                    carrier: vcPOLineFieldsIds.CARRIER,
                    eta_date: vcPOLineFieldsIds.ETA_DATE,
                    serial_num: vcPOLineFieldsIds.SERIAL_NUMBERS,
                    tracking_num: vcPOLineFieldsIds.TRACKING_NUMBERS,
                    internal_reference_num: vcPOLineFieldsIds.INTERNAL_REFERENCE,
                    json_data: vcPOLineFieldsIds.JSON_DATA
                };
                let mapItemDetailsToSublistFieldIdText = {
                    order_date: vcPOLineFieldsIds.ORDER_DATE
                };
                for (let i = 0, len = orderStatus.items.length; i < len; i += 1) {
                    let responseLineDetails = orderStatus.items[i];
                    rec.selectLine({
                        sublistId: poLineSublistId,
                        line: i
                    });
                    for (let responseLineProperty in mapItemDetailsToSublistFieldId) {
                        let columnFieldId = mapItemDetailsToSublistFieldId[responseLineProperty],
                            columnValue = responseLineDetails[responseLineProperty];
                        if (columnValue != 'NA') {
                            rec.setCurrentSublistValue({
                                sublistId: poLineSublistId,
                                fieldId: columnFieldId,
                                value: columnValue
                            });
                        }
                    }
                    for (let responseLineProperty in mapItemDetailsToSublistFieldIdText) {
                        let columnFieldId =
                                mapItemDetailsToSublistFieldIdText[responseLineProperty],
                            columnValue = responseLineDetails[responseLineProperty];
                        if (columnValue != 'NA') {
                            rec.setCurrentSublistText({
                                sublistId: poLineSublistId,
                                fieldId: columnFieldId,
                                text: columnValue
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

    function sendPO(option) {
        let logTitle = [LogTitle, 'sendPO'].join('::'),
            purchaseOrderId = option.purchaseOrderId,
            response,
            record = NS_Record.load({
                type: NS_Record.Type.PURCHASE_ORDER,
                id: purchaseOrderId,
                isDynamic: true
            });
        if (record) {
            response = libWebService.process({ transaction: record });
            log.audit(logTitle, '>> send PO response: ' + JSON.stringify(response));
            _updateNativePO({ response: response, purchOrder: record });
            libWebService.getOrderStatus();
        }
        return response;
    }

    return {
        sendPO: sendPO
    };
});
