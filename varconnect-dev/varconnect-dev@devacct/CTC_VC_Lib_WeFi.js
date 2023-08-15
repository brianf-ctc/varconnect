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
 *
 * Version		Date            		Author		    Remarks
 * 1.00			Oct 03, 2022			jjacob			Initial version
 * 1.10			Jan 06, 2022			jjacob			Changed the invoice number's field mapping to `documentNumber`
 *
 *
 */
define(['N/error', './CTC_VC2_Lib_Utils.js'], function (error, v2_util) {
    'use strict';

    var CURRENT = {};
    var WEFI = {};

    /**
     * Initialize wefi endpoints and credentials
     * @returns null
     */
    WEFI.init = function () {
        var logTitle = 'WeFi.init';
        var config = CURRENT.vendorConfig;

        WEFI.credential = {
            TENANT_ID: config.customerNo,
            CLIENT_ID: config.apiKey,
            CLIENT_SECRET: config.apiSecret,
            SCOPE: config.oauthScope
        };

        WEFI.endpoint = {
            TOKEN: config.accessEndPoint.replace(
                '{{TENANT_ID}}',
                WEFI.credential.TENANT_ID
            ),
            INVOICE: config.endPoint + '/v1.0/reseller/odata/invoices',
            ORDER: config.endPoint + '/v1.0/reseller/odata/approvals'
        };

        log.debug(
            logTitle,
            'WEFI.credential=' + JSON.stringify(WEFI.credential)
        );
        log.debug(logTitle, 'WEFI.endpoint=' + JSON.stringify(WEFI.endpoint));
    };

    /**
     *
     * @param option.poId - {String|Int} NS Transaction Internal Id
     * @param option.recordId - {String|Int} NS Transaction Internal Id
     * @param option.poNum - {String} NS TranId
     * @param option.transactionNum - {String} NS TranId
     * @param option.vendorConfig - {Object} NS Vendor Config Record
     *
     * @returns {Array} WeFi PO lines
     */
    WEFI.process = function (option) {
        var logTitle = 'WeFi.process';
        var returnValue = [];
        option = option || {};

        try {
            CURRENT.recordId = option.poId || option.recordId;
            CURRENT.recordNum = option.poNum || option.transactionNum;
            CURRENT.vendorConfig = option.vendorConfig;

            log.debug(logTitle, 'option=' + JSON.stringify(option));

            // Required param: vendor config
            if (!CURRENT.vendorConfig) {
                throw error.create({
                    name: 'MISSING_REQUIRED',
                    message: 'vendor config'
                });
            }

            // Initialize wefi config
            WEFI.init();

            // Get order from wefi
            var objWefiPO = WEFI.processRequest(option);

            var objWFPOLinesTMP = {};
            var arrWefiPOLines = [];

            if (!objWefiPO.header) {
                throw error.create({
                    name: 'MISSING_REQUIRED',
                    message: 'Wefi PO'
                });
            }

            if (!objWefiPO.invoices || !objWefiPO.invoices.length) {
                log.debug(
                    logTitle,
                    'No invoice found for PO (' +
                        objWefiPO.header.purchaseOrderNumber +
                        ')'
                );
            }

            var wfOrder = objWefiPO.header;
            var wfInvoices = objWefiPO.invoices;

            // Loop: WeFi Invoices
            // WeFi PO Lines are taken from the invoice
            for (var i = 0; wfInvoices && i < wfInvoices.length; i++) {
                var wfInvoice = wfInvoices[i];
                var wfInvoiceLines = wfInvoice.details;

                log.debug(
                    logTitle,
                    'wfInvoice=' +
                        JSON.stringify({
                            invoiceId: wfInvoice.invoiceId,
                            shippedDate: wfInvoice.shippedDate,
                            lines: wfInvoiceLines.length
                        })
                );

                // Loop: WeFi Invoice Lines
                for (
                    var ii = 0;
                    wfInvoiceLines && ii < wfInvoiceLines.length;
                    ii++
                ) {
                    var wfInvoiceLine = wfInvoiceLines[ii];
                    var invDetailId = wfInvoiceLine.invoiceDetailId;

                    log.debug(
                        logTitle,
                        '[invoice=' +
                            wfInvoice.invoiceId +
                            '] wfInvoiceLine=' +
                            JSON.stringify(wfInvoiceLine)
                    );

                    // Group items by `invoiceDetailId`
                    objWFPOLinesTMP[invDetailId] =
                        objWFPOLinesTMP[invDetailId] || null;

                    // Serial, tracking objects
                    var tracking = wfInvoiceLine.trackingNumber;
                    var serial = wfInvoiceLine.serialNumber;

                    // Serial number
                    var serialNo = serial ? serial.serialNumberValue : '';

                    if (objWFPOLinesTMP[invDetailId] === null) {
                        // Always true as The only way we can tell if anything has been shipped is
                        // if there is a matching invoice in the invoices endpoint with the same approvalId.
                        // Note that an order can be partially shipped (multiple invoices).
                        var IS_SHIPPED = true;

                        // As we don't have specific ship date on the line item in the Database,
                        // shipped date might not be sent by vendor so documentDate can be used as fallback
                        var shippedDate =
                            wfInvoice['​shippedDate'] ||
                            (serial ? serial.documentDate : null) ||
                            (tracking ? tracking.documentDate : null);

                        // Invoice line detail
                        objWFPOLinesTMP[invDetailId] = {
                            invoice_id: wfInvoiceLine.invoiceId,
                            line_num: wfInvoiceLine.lineNumber,
                            item_num: wfInvoiceLine.productCode,
                            item_num_alt: wfInvoiceLine.manufacturerProductCode,
                            is_shipped: IS_SHIPPED,
                            line_status: wfOrder.statusCode,
                            ship_qty: wfInvoiceLine.quantity,
                            order_date: '',
                            ship_date: shippedDate,
                            order_eta: '', // Not available on the API
                            order_eta_ship: '',
                            //order_num: wfInvoiceLine.invoiceId.toString(),	// v1.10
                            order_num: wfInvoiceLine.documentNumber, // v1.10
                            carrier: tracking ? tracking.carrier : '',
                            tracking_num: tracking
                                ? tracking.trackingNumberValue
                                : '',
                            ns_record: '',
                            serial_num: []
                        };
                    }

                    if (serialNo)
                        objWFPOLinesTMP[invDetailId].serial_num.push(serialNo);
                }
            }

            // Convert `objWFPOLinesTMP` to `arrWefiPOLines`
            for (var invDetailId in objWFPOLinesTMP) {
                var objInvLine = objWFPOLinesTMP[invDetailId];
                objInvLine.serial_num = objInvLine.serial_num.join(',');
                arrWefiPOLines.push(objInvLine);
            }

            log.debug(logTitle, 'arrWefiPOLines=' + arrWefiPOLines.length);

            // Return wefi po lines
            returnValue = arrWefiPOLines;
        } catch (e) {
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);

            v2_util.vcLog({
                title: logTitle + ': Process Error',
                error: err,
                recordId: CURRENT.recordId
            });
            throw e;
        }

        return returnValue;
    };

    /**
     * Processes single NS purchase order
     *
     * @param option.poId - {String|Int} NS Transaction Internal Id
     * @param option.recordId - {String|Int} NS Transaction Internal Id
     * @param option.poNum - {String} NS TranId
     * @param option.transactionNum - {String} NS TranId
     * @param option.recordNum - {String} NS TranId
     * @param option.vendorConfig - {Object} NS Vendor Config Record
     *
     * @returns {Object} WeFi Response
     */
    WEFI.processRequest = function (option) {
        var logTitle = 'WeFi.processRequest';
        var returnValue = [];
        option = option || {};

        try {
            CURRENT.recordId =
                option.poId || option.recordId || CURRENT.recordId;
            CURRENT.recordNum =
                option.poNum || option.transactionNum || CURRENT.recordNum;
            CURRENT.vendorConfig = option.vendorConfig || CURRENT.vendorConfig;

            log.debug(logTitle, 'option=' + JSON.stringify(option));

            // Empty vendor config
            if (!CURRENT.vendorConfig) {
                throw error.create({
                    name: 'MISSING_REQUIRED',
                    message: 'vendor config'
                });
            }

            // Initialize wefi config
            WEFI.init();

            // Request for token
            WEFI.generateToken();

            if (!CURRENT.accessToken) {
                throw error.create({
                    name: 'MISSING_REQUIRED',
                    message: 'Unable to generate access token'
                });
            }

            // Get WeFi PO via NS PO Tran Id
            var wefiPO = WEFI.getOrder({ poNumber: CURRENT.recordNum });

            if (!wefiPO.header) {
                log.error(
                    logTitle,
                    'RECORD_NOT_FOUND: wefi po (' + CURRENT.recordNum + ')'
                );
            } else if (!wefiPO.invoices || !wefiPO.invoices.length) {
                log.error(
                    logTitle,
                    'ORDER_NOT_SHIPPED: wefi po (' + CURRENT.recordNum + ')'
                );
            }

            returnValue = wefiPO;
        } catch (e) {
            returnValue = [];
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            throw e;
        }

        return returnValue;
    };

    /**
     * Request for token
     *
     * @returns {String} Token
     */
    WEFI.generateToken = function () {
        var logTitle = 'WeFi.generateToken';
        var returnValue;

        try {
            log.debug(logTitle, 'url=' + WEFI.endpoint.TOKEN);

            var tokenReq = v2_util.sendRequest({
                header: logTitle,
                method: 'post',
                recordId: CURRENT.recordId,
                doRetry: true,
                //maxRetry: 3,
                query: {
                    url: WEFI.endpoint.TOKEN,
                    body: v2_util.convertToQuery({
                        client_id: WEFI.credential.CLIENT_ID,
                        client_secret: WEFI.credential.CLIENT_SECRET,
                        scope: WEFI.credential.SCOPE,
                        grant_type: 'client_credentials'
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            });

            if (tokenReq.isError) throw tokenReq.errorMsg;
            var tokenResp = v2_util.safeParse(tokenReq.RESPONSE);
            if (!tokenResp || !tokenResp.access_token)
                throw 'Unable to generate token';
            returnValue = tokenResp.access_token;

            CURRENT.accessToken = tokenResp.access_token;
            log.debug(logTitle, 'access token=' + CURRENT.accessToken);
        } catch (e) {
            returnValue = null;
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);

            v2_util.vcLog({
                title: logTitle + ': Process Error',
                error: err,
                recordId: CURRENT.recordId
            });
            throw e;
        }

        return returnValue;
    };

    /**
     * Request order from WeFi
     *
     * @param option.poNumber - {String} NS PO Tran Id
     * @returns {Object} WeFi PO Data
     */
    WEFI.getOrder = function (option) {
        var logTitle = 'WeFi.getOrder';
        var returnValue = [];
        var option = option || {};

        try {
            if (!option.poNumber) {
                throw 'Missing required param: ns po number';
            }

            var wefiPO = {
                header: null,
                invoices: [] // An order can have multiple shipments (shipments are invoices in wefi)
            };

            // ----------------------
            // 1. Get purchase order
            // (ORDER HEADER DETAILS)
            // ----------------------

            var params =
                "$filter=purchaseOrderNumber eq '" + option.poNumber + "'";
            var url = WEFI.endpoint.ORDER + '?' + params;

            log.debug(logTitle, 'order request url=' + url);

            var response = v2_util.sendRequest({
                header: logTitle,
                query: {
                    url: url,
                    headers: {
                        Authorization: 'Bearer ' + CURRENT.accessToken,
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    }
                },
                recordId: CURRENT.recordId
            });

            if (response.isError) throw response.errorMsg;
            var parsedResponse = v2_util.safeParse(response.RESPONSE);
            if (!parsedResponse) throw 'Unable to fetch server response';
            if (!parsedResponse.value) throw 'Order(s) not found';

            // The .value from the wefi response is an array type
            // If there is no data, an empty array is returned
            wefiPO.header =
                parsedResponse.value && parsedResponse.value.length
                    ? parsedResponse.value[0]
                    : null;
            log.debug(
                logTitle,
                'wefiPO.header=' + JSON.stringify(wefiPO.header)
            );

            // --------------------------
            // 2. Get shipments/invoices
            // (ORDER LINE DETAILS)
            // --------------------------

            // Orders/Approvals don't contain any line items before invoice is created for particular approval.
            // You can correlate invoice with particular Order/Approval by using ApprovalId field on Invoice.

            if (wefiPO.header && wefiPO.header.approvalId) {
                var params =
                    '$filter=approvalId eq ' + wefiPO.header.approvalId;
                params +=
                    '&$expand=details($expand=serialNumber,trackingNumber)';

                var url = WEFI.endpoint.INVOICE + '?' + params;
                log.debug(logTitle, 'invoice required url=' + url);

                var response = v2_util.sendRequest({
                    header: logTitle,
                    query: {
                        url: url,
                        headers: {
                            Authorization: 'Bearer ' + CURRENT.accessToken,
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        }
                    },
                    recordId: CURRENT.recordId
                });

                if (response.isError) throw response.errorMsg;
                var parsedResponse = v2_util.safeParse(response.RESPONSE);
                if (!parsedResponse) throw 'Unable to fetch server response';
                if (!parsedResponse.value) throw 'Invoice(s) not found';

                // The .value from the wefi response is an array type
                // If there is no data, an empty array is returned
                var wefiInvoices = parsedResponse.value || [];
                log.debug(logTitle, 'wefiInvoices=' + wefiInvoices.length);

                // Some details would be coming from wefi invoice
                wefiPO.invoices = wefiInvoices;
            }

            // Contains both the PO Header and Lines
            returnValue = wefiPO;
        } catch (e) {
            returnValue = null;
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            throw e;
        }

        return returnValue;
    };

    return {
        process: WEFI.process,
        processRequest: WEFI.processRequest
    };
});
