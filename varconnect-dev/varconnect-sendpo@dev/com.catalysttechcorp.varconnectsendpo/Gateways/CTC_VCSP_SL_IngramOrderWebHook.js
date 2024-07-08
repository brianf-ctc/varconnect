/**
 * Copyright (c) 2024 Catalyst Tech Corp
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
 * @NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/record',
    'N/format',
    'N/redirect',
    '../Library/CTC_VCSP_Lib_LicenseValidator',
    '../Library/CTC_VCSP_Lib_VendorConfig',
    '../Library/CTC_Lib_Utils',
    '../Library/CTC_Lib_ServerUtils',
    '../Library/CTC_VCSP_Constants',
    '../VO/CTC_VCSP_PO'
], function (
    NS_ServerWidget,
    NS_Record,
    NS_Format,
    NS_Redirect,
    libLicenseValidator,
    libVendorConfig,
    CTC_Util,
    CTC_SSUtil,
    VCSP_Global,
    PO
) {
    let LogTitle = 'VCSP:IngramOrderStatusWebHook';
    let Helper = {};
    // YYYY-MM-DD
    Helper.formatFromIngramDate = function(dateStr) {
        let formattedDate = null;
        if (dateStr) {
            try {
                let dateComponents = dateStr.split(/\D+/),
                    parsedDate = new Date(dateComponents[0], dateComponents[1], dateComponents[2]);
                if (parsedDate) {
                    formattedDate = NS_Format.format({
                        value: parsedDate,
                        type: NS_Format.Type.DATETIME
                    });
                }
            } catch (formatErr) {
                // do nothing
            }
        }
        return formattedDate;
    };
    Helper.processResponse = function(options) {
        let logTitle = [LogTitle, 'processResponse'].join('::'),
            returnValue = options.returnResponse,
            responseBody = options.responseBody || returnValue.responseBody,
            orderStatus = {};
        if (responseBody) {
            orderStatus.ponumber = responseBody.ingramOrderNumber;
            orderStatus.errorMessage = null;
            orderStatus.errorDetail = null;
            orderStatus.items = [];
            orderStatus.numSuccessfulLines = 0;
            orderStatus.numFailedLines = 0;
            let lineNotes = [];
            if (responseBody.orders && responseBody.orders.length) {
                for (let orderCtr = 0, orderCount = responseBody.orders.length; orderCtr < orderCount; orderCtr += 1) {
                    let orderDetails = responseBody.orders[orderCtr],
                        orderDate = Helper.formatFromIngramDate(orderDetails.ingramOrderDate);
                    if (orderDetails.notes) {
                        orderStatus.notes = orderDetails.notes;
                    }
                    if (orderDetails.lines && orderDetails.lines.length) {
                        // valid lines
                        for (let line = 0, lineCount = orderDetails.lines.length; line < lineCount; line += 1) {
                            let lineDetails = orderDetails.lines[line],
                                shipmentDetails = {};
                            if (lineDetails) {
                                shipmentDetails = lineDetails.shipmentDetails;
                            }
                            let itemDetails = {
                                line_number: lineDetails.ingramLineNumber || 'NA',
                                order_number: lineDetails.subOrderNumber || 'NA',
                                order_date: orderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                ship_method: shipmentDetails.carrierCode || 'NA',
                                ship_from: shipmentDetails.shipFromLocation || 'NA',
                                carrier: shipmentDetails.carrierName || 'NA',
                                order_status: lineDetails.lineStatus,
                                note: lineDetails.notes,
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.numSuccessfulLines += 1;
                        }
                    }
                    if (orderDetails.rejectedLineItems && orderDetails.rejectedLineItems.length) {
                        // rejected lines
                        for (let line = 0, lineCount = orderDetails.rejectedLineItems.length; line < lineCount; line += 1) {
                            let lineDetails = orderDetails.rejectedLineItems[line];
                            let itemDetails = {
                                order_number: orderDetails.ingramOrderNumber || 'NA',
                                order_date: orderDate || 'NA',
                                vendorSKU: lineDetails.ingramPartNumber || 'NA',
                                item_number: lineDetails.customerPartNumber || 'NA',
                                quantity: lineDetails.quantityOrdered || 'NA',
                                order_status: 'Rejected',
                                note: [ lineDetails.rejectCode, lineDetails.rejectReason ].join(': '),
                            };
                            orderStatus.items.push(itemDetails);
                            orderStatus.numFailedLines += 1;
                            lineNotes.push(itemDetails.note);
                        }
                    }
                }
                log.audit(logTitle, '>> Parsed response: ' + JSON.stringify(orderStatus));
                returnValue.transactionNum = orderStatus.ponumber;
            }
            returnValue.message = 'Send PO successful';
            if (responseBody.errors && responseBody.errors.length) {
                let errMessage = [];
                for (let errCtr = 0, errCount = responseBody.errors.length; errCtr < errCount; errCtr += 1) {
                    let errorResponse = responseBody.errors[errCtr];
                    if (errorResponse && errorResponse.message) {
                        errMessage.push(errorResponse.message);
                    }
                }
                returnValue.isError = true;
                returnValue.message = 'Send PO failed.';
                returnValue.errorMsg = errMessage.join('; ');
            } else if (orderStatus.numFailedLines) {
                returnValue.message = 'Send PO successful with ' +
                    orderStatus.numSuccessfulLines +
                    ' line item(s) and ' +
                    orderStatus.numFailedLines +
                    ' failed line(s):<br />' +
                    lineNotes.join('<br />');
            } else {
                returnValue.message =
                    'Send PO successful with ' + orderStatus.numSuccessfulLines + ' line item(s).';
            }
            returnValue.orderStatus = orderStatus;
        }
        return returnValue;
    };
    let SuiteletScript = {
        onRequest: function(context) {
            let logTitle = [LogTitle, 'onRequest'].join(':'),
                responseBody = {};
            if (context.request.method == 'POST') {
                CTC_Util.vcLog({
                    title: [LogTitle, 'Order Status Webhook Request'].join(' - '),
                    content: context.request.parameters,
                    transaction: poObj.id
                });
            } else {
                throw 'Method not allowed';
            }
        }
    };
    return SuiteletScript;
});
