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
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(function (require) {
    var VC2_CONSTANT = require('./CTC_VC2_Constants'),
        XML_VENDOR = VC2_CONSTANT.LIST.XML_VENDOR,
        ORDER_STATUS = {},
        BILL_CREATE = {};

    /* ============================================================
	* Required fields
	* Auto complete if the field ID is populated.
	============================================================ */
    for (var vendorKey in XML_VENDOR) {
        switch (vendorKey) {
            case 'TECH_DATA':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://tdxml.techdata.com/xmlservlet',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: ''
                };
                break;
            case 'INGRAM_MICRO_API':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint:
                        'https://api.ingrammicro.com:443/resellers/v6.1/orders',
                    custrecord_ctc_vc_access_endpoint:
                        'https://api.ingrammicro.com:443/oauth/oauth30/token',
                    custrecord_ctc_vc_api_key: '',
                    custrecord_ctc_vc_api_secret: '',
                    custrecord_ctc_vc_customer_number: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'ingram_api',
                    custrecord_vc_bc_url: 'https://api.ingrammicro.com:443',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_partner: ''
                };
                break;
            case 'SYNNEX':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://ec.synnex.ca/SynnexXML/POStatus',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: '',
                    custrecord_ctc_vc_customer_number: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'synnex_api',
                    custrecord_vc_bc_url: 'https://ws.us.tdsynnex.com/webservice/invoice/query',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_partner: ''
                };
                break;
            case 'DandH':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://www.dandh.com/dhXML/xmlDispatch',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: '',
                    custrecord_ctc_vc_customer_number: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'dh_sftp',
                    custrecord_vc_bc_url: 'ftp.dandh.com',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_host_key: '',
                    custrecord_vc_bc_res_path: '/invoice_out'
                };
                break;
            case 'DELL':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://www.dandh.com/dhXML/xmlDispatch',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: ''
                };
                break;
            case 'ARROW':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint:
                        'https://ecsoag.arrow.com/ArrowECS/SalesOrder_RS/Status',
                    custrecord_ctc_vc_customer_number: '',
                    custrecord_ctc_vc_api_key: '-none-',
                    custrecord_ctc_vc_api_secret: '-none-'
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'arrow_api',
                    custrecord_vc_bc_url: 'https://qaecsoag.arrow.com',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_partner: ''
                };
                break;
            case 'JENNE':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://webservice.jenne.com/JenneWebService.asmx',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: '',
                    custrecord_ctc_vc_customer_number: ''
                };
                break;
            case 'SCANSOURCE':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://api.scansource.com/scsc/salesorder/v1',
                    custrecord_ctc_vc_access_endpoint:
                        'https://login.microsoftonline.com/scansourceb2c.onmicrosoft.com/oauth2/v2.0/token',
                    custrecord_ctc_vc_user: '-none-',
                    custrecord_ctc_vc_password: '-none-',
                    custrecord_ctc_vc_customer_number: '',
                    custrecord_ctc_vc_api_key: '',
                    custrecord_ctc_vc_api_secret: '',
                    custrecord_ctc_vc_oath_scope: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'scansource_api',
                    custrecord_vc_bc_url: 'https://api.scansource.com/scsc/invoice/v1',
                    custrecord_vc_bc_token_url:
                        'https://login.microsoftonline.com/scansourceb2c.onmicrosoft.com/oauth2/v2.0/token',
                    custrecord_vc_bc_partner: '',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_scope: '',
                    custrecord_vc_bc_subs_key: ''
                };
                break;
            case 'CARAHSOFT':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: 'https://api.carahsoft.com/odata/v1/Order/',
                    custrecord_ctc_vc_access_endpoint:
                        'https://login.carahsoft.com/auth/realms/carahsoft/protocol/openid-connect/token',
                    custrecord_ctc_vc_oath_scope: 'https://api.carahsoft.com',
                    custrecord_ctc_vc_api_key: '',
                    custrecord_ctc_vc_api_secret: '',
                    custrecord_ctc_vc_customer_number: '',
                    custrecord_ctc_vc_user: '-none-',
                    custrecord_ctc_vc_password: '-none-'
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'carahsoft_api',
                    custrecord_vc_bc_url: 'https://api.carahsoft.com/odata/v1/',
                    custrecord_vc_bc_token_url:
                        'https://login.carahsoft.com/auth/realms/carahsoft/protocol/openid-connect/token',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_scope: 'https://api.carahsoft.com',
                    custrecord_vc_bc_partner: ''
                };
                break;
            case 'SYNNEX':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: '',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: '',
                    custrecord_ctc_vc_customer_number: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'synnex_sftp',
                    custrecord_vc_bc_url: '',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: '',
                    custrecord_vc_bc_host_key: '',
                    custrecord_vc_bc_res_path: '/'
                };
                break;
            case 'SYNNEX_API':
                var xmlVendorId = XML_VENDOR[vendorKey];
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'synnex_api',
                    custrecord_vc_bc_url: '',
                    custrecord_vc_bc_partner: '',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: ''
                };
                break;
            case 'TECH_DATA_API':
                var xmlVendorId = XML_VENDOR[vendorKey];
                ORDER_STATUS[xmlVendorId] = {
                    custrecord_ctc_vc_vendor: '',
                    custrecord_ctc_vc_xml_vendor: '',
                    custrecord_ctc_vc_vendor_subsidiary: '',
                    custrecord_ctc_vc_endpoint: '',
                    custrecord_ctc_vc_user: '',
                    custrecord_ctc_vc_password: ''
                };
                BILL_CREATE[xmlVendorId] = {
                    custrecord_vc_bc_connect_type: '',
                    custrecord_vc_bc_entry: 'techdata_api',
                    custrecord_vc_bc_url: 'https://tdxml.techdata.com/xmlservlet',
                    custrecord_vc_bc_pass: '',
                    custrecord_vc_bc_user: ''
                };
                break;
            default:
                break;
        }
    }

    return {
        ORDER_STATUS: ORDER_STATUS,
        BILL_CREATE: BILL_CREATE
    };
});
