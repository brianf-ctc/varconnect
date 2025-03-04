/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
 * 1.10			Jan 10, 2023			jjacob			Group invoice lines by inv detail id
 */

define(['N/error', 'N/search', 'N/crypto', '../../CTC_VC2_Lib_Utils'], function (
    ns_error,
    ns_search,
    ns_crypto,
    vc2_util
) {
    var WEFI_BC = {};
    WEFI_BC.OrderCFG = null;
    WEFI_BC.credential = {};
    WEFI_BC.endpoint = {};

    /**
     * Initialize WEFI_BC endpoints and credentials
     * @param option.OrderCFG - {Object} Vendor Configuration
     * @returns null
     */
    WEFI_BC.init = function (option) {
        var logTitle = 'WEFI_BC.init';
        var config = option.orderConfig;
        WEFI_BC.OrderCFG = config;

        WEFI_BC.credential = {
            CLIENT_ID: config.user_id,
            CLIENT_SECRET: config.user_pass,
            SCOPE: config.scope || 'https://wefitecdevb2c.onmicrosoft.com/go-api-amer/.default'
        };

        WEFI_BC.endpoint = {
            TOKEN:
                config.token_url ||
                'https://login.microsoftonline.com/1c392e32-a57c-433c-b9d8-b7c8ae1f664d/oauth2/v2.0/token',
            INVOICE: config.url + '/v1.0/reseller/odata/invoices',
            ORDER: config.url + '/v1.0/reseller/odata/approvals'
        };

        log.debug(logTitle, 'WEFI_BC.credential=' + JSON.stringify(WEFI_BC.credential));
        log.debug(logTitle, 'WEFI_BC.endpoint=' + JSON.stringify(WEFI_BC.endpoint));
    };

    /**
     * Main entry point
     *
     * @param poNumber - {String} Netsuite PO Tran Id
     * @param OrderCFG - {Object} Netsuite Vendor Config
     * @returns {Array} WeFi Invoice Data
     */
    WEFI_BC.process = function (poInternalId, OrderCFG) {
        var logTitle = 'WEFI_BC.process';
        try {
            var arrInvoices = [];

            if (!poInternalId) {
                throw ns_error.create({
                    name: 'MISSING_REQUIRED_PARAM',
                    message: 'ns po internal id'
                });
            }

            log.debug(logTitle, 'poInternalId=' + poInternalId);
            log.debug(logTitle, 'OrderCFG=' + JSON.stringify(OrderCFG));

            // var objLookup = ns_search.lookupFields({
            //     type: ns_search.Type.PURCHASE_ORDER,
            //     id: poInternalId,
            //     columns: ['tranid']
            // });

            var poNumber = OrderCFG.poNum;
            log.debug(logTitle, 'poNumber=' + poNumber);

            if (!poNumber) {
                throw ns_error.create({
                    name: 'MISSING_REQUIRED_PARAM',
                    message: 'ns po tranid'
                });
            }

            if (!OrderCFG) {
                throw ns_error.create({
                    name: 'MISSING_REQUIRED_PARAM',
                    message: 'ns vendor config'
                });
            }

            // Initialize wefi params
            WEFI_BC.init({ OrderCFG: OrderCFG });

            // Get order
            var wefiPO = WEFI_BC.getOrder({ poNumber: poNumber });
            log.debug(logTitle, 'wefiPO=' + JSON.stringify(wefiPO));

            if (!wefiPO) {
                throw ns_error.create({
                    name: 'RECORD_NOT_FOUND',
                    message: 'wefi order (' + poNumber + ')'
                });
            }

            if (!wefiPO.approvalId) {
                throw ns_error.create({
                    name: 'MISSING_REQUIRED_PARAM',
                    message: 'apparoval id: order (' + poNumber + ')'
                });
            }

            // Get invoices
            var wefiInvoices = WEFI_BC.getInvoices({
                approvalId: wefiPO.approvalId
            });
            log.debug(logTitle, 'wefiInvoices=' + wefiInvoices.length);

            // Loop: WeFi Invoices
            for (var i = 0; wefiInvoices && i < wefiInvoices.length; i++) {
                var wfInvoice = wefiInvoices[i];
                var wfInvoiceLines = wfInvoice.details;
                var objLinesTemp = {}; // v1.1

                var objInvoice = {
                    invoice: wfInvoice.documentNumber,
                    date: wfInvoice.documentDate,
                    po: wfInvoice.purchaseOrderNumber,
                    total: wfInvoice.documentAmount,
                    charges: {
                        tax: wfInvoice.taxAmount,
                        shipping: wfInvoice.freightAmount,
                        other: wfInvoice.miscAmount
                    },
                    lines: []
                };

                log.debug(
                    logTitle,
                    'wfInvoice=' +
                        JSON.stringify({
                            invoiceId: wfInvoice.invoiceId,
                            lines: wfInvoiceLines.length
                        })
                );

                // Loop: WeFi Invoice Lines
                for (var ii = 0; wfInvoiceLines && ii < wfInvoiceLines.length; ii++) {
                    var wfInvoiceLine = wfInvoiceLines[ii];
                    var invDetailId = wfInvoiceLine.invoiceDetailId; // v1.1

                    log.debug(
                        logTitle,
                        '[invoice=' +
                            wfInvoice.invoiceId +
                            '] wfInvoiceLine=' +
                            JSON.stringify(wfInvoiceLine)
                    );

                    // v1.1
                    objLinesTemp[invDetailId] = {
                        processed: false,
                        ITEMNO: wfInvoiceLine.productCode,
                        PRICE: wfInvoiceLine.unitPrice,
                        QUANTITY: wfInvoiceLine.quantity,
                        DESCRIPTION: wfInvoiceLine.productDescription,
                        NSITEM: ''
                    };
                }

                // v1.1: Convert `objLinesTemp` to `objInvoice.lines`
                for (var invDetailId in objLinesTemp) {
                    var objInvLine = objLinesTemp[invDetailId];
                    objInvoice.lines.push(objInvLine);
                }

                arrInvoices.push({
                    ordObj: objInvoice,
                    xmlStr: JSON.stringify(wfInvoice)
                });
            }

            log.debug(logTitle, 'arrInvoices=' + arrInvoices.length);
            log.debug(logTitle, 'arrInvoices=' + JSON.stringify(arrInvoices));

            return arrInvoices;
        } catch (e) {
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            throw e;
        }
    };

    /**
     * Request order from WeFi
     *
     * @param option.poNumber - {String} NS PO Tran Id
     * @returns {Object} WeFi PO Data
     */
    WEFI_BC.getOrder = function (option) {
        var logTitle = 'WEFI_BC.getOrder';

        try {
            var params = "$filter=purchaseOrderNumber eq '" + option.poNumber + "'";
            var url = WEFI_BC.endpoint.ORDER + '?' + params;

            log.debug(logTitle, 'url=' + url);

            // Get PO
            var response = vc2_util.sendRequest({
                header: [logTitle, 'Order Search'].join(' : '),
                query: {
                    url: url,
                    headers: {
                        Authorization: 'Bearer ' + WEFI_BC.getTokenCache(),
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    }
                },
                recordId: null
            });

            if (response.isError) throw response.errorMsg;
            var parsedResponse = vc2_util.safeParse(response.RESPONSE);
            if (!parsedResponse) throw 'Unable to fetch server response';
            if (!parsedResponse.value) throw 'Order(s) not found';

            // The .value from the wefi response is an array type
            // If there is no data, an empty array is returned
            return parsedResponse.value && parsedResponse.value.length
                ? parsedResponse.value[0]
                : null;
        } catch (e) {
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            throw e;
        }
    };

    /**
     * Request invoices from WeFi
     *
     * @param option.approvalId - {String} WeFi PO approvalId
     * @returns {Object} WeFi PO Data
     */
    WEFI_BC.getInvoices = function (option) {
        var logTitle = 'WEFI_BC.getInvoices';
        try {
            var params = '$filter=approvalId eq ' + option.approvalId;
            params += '&$expand=details($expand=serialNumber,trackingNumber)';

            var url = WEFI_BC.endpoint.INVOICE + '?' + params;
            log.debug(logTitle, 'get invoice url=' + url);

            var response = vc2_util.sendRequest({
                header: [logTitle, 'Order Line Search'].join(' : '),
                query: {
                    url: url,
                    headers: {
                        Authorization: 'Bearer ' + WEFI_BC.generateToken(),
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    }
                },
                recordId: null
            });

            if (response.isError) throw response.errorMsg;
            var parsedResponse = vc2_util.safeParse(response.RESPONSE);
            if (!parsedResponse) throw 'Unable to fetch server response';
            if (!parsedResponse.value) throw 'Invoice(s) not found';

            // The .value from the wefi response is an array type
            // If there is no data, an empty array is returned
            return parsedResponse.value || [];
        } catch (e) {
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            throw e;
        }
    };

    /**
     * Get access token
     *
     * @returns {String} Access Token
     */
    WEFI_BC.generateToken = function () {
        var logTitle = 'WEFI_BC.generateToken';
        var returnValue = null;
        try {
            log.debug(logTitle, 'url=' + WEFI_BC.endpoint.TOKEN);

            var tokenReq = vc2_util.sendRequest({
                header: [logTitle, 'Generate Token'].join(' '),
                method: 'post',
                recordId: null,
                doRetry: false,
                maxRetry: 1,
                query: {
                    url: WEFI_BC.endpoint.TOKEN,
                    body: vc2_util.convertToQuery({
                        client_id: WEFI_BC.credential.CLIENT_ID,
                        client_secret: WEFI_BC.credential.CLIENT_SECRET,
                        scope: WEFI_BC.credential.SCOPE,
                        grant_type: 'client_credentials'
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            });

            if (tokenReq.isError) throw tokenReq.errorMsg;
            var tokenResp = vc2_util.safeParse(tokenReq.RESPONSE);
            if (!tokenResp || !tokenResp.access_token) throw 'Unable to generate token';

            log.debug(logTitle, 'access token=' + tokenResp.access_token);
            returnValue = tokenResp.access_token;
        } catch (e) {
            var err = e.name + ': ' + e.message;
            log.error(logTitle, err);
            returnValue = false;
            throw e;
        } finally {
        }
        return returnValue;
    };

    WEFI_BC.generateChecksum = function () {
        var OrderCFG = this.OrderCFG,
            checkSum = '';
        if (OrderCFG) {
            var hash = ns_crypto.createHash({
                algorithm: ns_crypto.HashAlg.SHA256
            });
            hash.update({
                input: JSON.stringify({
                    id: OrderCFG.id,
                    subsidiary: OrderCFG.subsidiary,
                    country: OrderCFG.country,
                    ack_function: OrderCFG.ack_function,
                    entry_function: OrderCFG.entry_function,
                    user_id: OrderCFG.user_id,
                    user_pass: OrderCFG.user_pass,
                    partner_id: OrderCFG.partner_id,
                    host_key: OrderCFG.host_key,
                    url: OrderCFG.url,
                    res_path: OrderCFG.res_path,
                    ack_path: OrderCFG.ack_path,
                    token_url: OrderCFG.token_url,
                    scope: OrderCFG.scope,
                    subscription_key: OrderCFG.subscription_key
                })
            });
            checkSum = hash.digest();
        }
        return checkSum;
    };

    WEFI_BC.getTokenCache = function () {
        var cacheKey = 'VC_BC_WEFI_TOKEN' + this.generateChecksum(), //set cache based on config values, if they change, then cache will change
            token = vc2_util.getNSCache({ key: cacheKey });
        if (vc2_util.isEmpty(token)) token = this.generateToken();

        if (!vc2_util.isEmpty(token)) {
            vc2_util.setNSCache({
                key: cacheKey,
                cacheTTL: 14400,
                value: token
            });
        }
        return token;
    };

    return {
        processXml: WEFI_BC.process
    };
});
