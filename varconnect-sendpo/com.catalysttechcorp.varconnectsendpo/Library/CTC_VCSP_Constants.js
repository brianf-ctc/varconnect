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
define([], function () {
    return {
        Records: {
            VENDOR_CONFIG: 'customrecord_ctc_vcsp_vendor_config',
            MAIN_CONFIG: 'customrecord_ctc_vcsp_main_config',
            VC_LOG: 'customrecord_ctc_vcsp_log',
            VC_POLINE: 'customrecord_ctc_vc_poline',
            VENDOR_SHIPMETHOD: 'customrecord_ctc_vcsp_vendor_shipping'
        },
        Fields: {
            Transaction: {
                DELL_SHIP_CODE: 'custbody_ctc_vcsp_dell_ship_code',
                IS_PO_SENT: 'custbody_ctc_vcsp_is_po_sent',
                VCSP_TIMESTAMP: 'custbody_ctc_vcsp_timestamp',
                CUSTOMER_PO_NUMBER: 'custbody_ctc_vcsp_custpo',
                VENDOR_PO_NUMBER: 'custbody_ctc_vcsp_transaction_num',
                VENDOR_RECEIPT: 'custbody_ctc_vcsp_vendor_rcpt',
                VENDOR_DETAILS: 'custbody_ctc_vcsp_vendoord_details',
                Item: {
                    MEMO: 'custcol_ctc_vcsp_memo',
                    QUOTE_NUMBER: 'custcol_ctc_vcsp_quote_no',
                    MANUFACTURER: 'custcol_ctc_manufacturer',
                    DELL_SKU: 'custcol_ctc_vcsp_sku_dell',
                    SYNNEX_SKU: 'custcol_ctc_vcsp_sku_synnex',
                    INGRAM_SKU: 'custcol_ctc_vcsp_sku_ingram',
                    DANDH_SKU: 'custcol_ctc_vcsp_sku_dandh'
                }
            },
            Location: {
                SYNNEX_WAREHOUSE_CODE: 'custrecord_ctc_vcsp_synnex_warehouse'
            },
            VendorConfig: {
                ID: 'internalid',
                SUBSIDIARY: 'custrecord_ctc_vcsp_vendor_subsidiary',
                API_VENDOR: 'custrecord_ctc_vcsp_api_vendor',
                VENDOR: 'custrecord_ctc_vcsp_vendor',
                WEBSERVICE_ENDPOINT: 'custrecord_ctc_vcsp_endpoint',
                ACCESS_ENDPOINT: 'custrecord_ctc_vcsp_access_endpoint',
                USERNAME: 'custrecord_ctc_vcsp_username',
                PASSWORD: 'custrecord_ctc_vcsp_password',
                CUSTOMER_NO: 'custrecord_ctc_vcsp_customer_number',
                API_KEY: 'custrecord_ctc_vcsp_api_key',
                API_SECRET: 'custrecord_ctc_vcsp_api_secret',
                SKU_COLUMN: 'custrecord_ctc_vcsp_ven_itemcol',
                TEST_REQUEST: 'custrecord_ctc_vcsp_test',
                FIELD_MAP: 'custrecord_ctc_vcsp_fieldmapping',
                EVENT_TYPE: 'custrecord_ctc_vcsp_event',
                QA_WEBSERVICE_ENDPOINT: 'custrecord_ctc_vcsp_endpoint_qa',
                QA_ACCESS_ENDPOINT: 'custrecord_ctc_vcsp_access_endpoint_qa', // fixed bug on QA fields
                QA_API_KEY: 'custrecord_ctc_vcsp_api_key_qa',
                QA_API_SECRET: 'custrecord_ctc_vcsp_api_secret_qa',
                ADDITIONAL_PO_FIELDS: 'custrecord_ctc_vcsp_po_fields',
                PO_LINE_COLUMNS: 'custrecord_ctc_vcsp_line_cols',
                SHOW_VENDOR_DETAILS: 'custrecord_ctc_vcsp_show_details',
                QUOTENO_FIELD: 'custrecord_ctc_vcsp_quoteno_field',
                Bill: {
                    ID: 'custrecord_ctc_vcsp_bill_addrid',
                    ADDRESSEE: 'custrecord_ctc_vcsp_bill_addressee',
                    ATTENTION: 'custrecord_ctc_vcsp_bill_attention',
                    ADDRESS_1: 'custrecord_ctc_vcsp_bill_addr1',
                    ADDRESS_2: 'custrecord_ctc_vcsp_bill_addr2',
                    PHONENO: 'custrecord_ctc_vcsp_phoneno',
                    CITY: 'custrecord_ctc_vcsp_bill_city',
                    STATE: 'custrecord_ctc_vcsp_bill_state',
                    ZIP: 'custrecord_ctc_vcsp_bill_zip',
                    COUNTRY: 'custrecord_ctc_vcsp_bill_country',
                    EMAIL: 'custrecord_ctc_vcsp_bill_email'
                },
                PAYMENT: {
                    MEAN: 'custrecord_ctc_vcsp_payment_mean',
                    OTHER: 'custrecord_ctc_vcsp_payment_mean_other',
                    TERM: 'custrecord_ctc_vcsp_payment_term'
                }
            },
            MainConfig: {
                ID: 'internalid',
                LICENSE: 'custrecord_ctc_vcsp_license',
                LICENSE_TEXT: 'custrecord_ctc_vcsp_license_text'
            },
            VarConnectLog: {
                ID: 'internalid',
                APPLICATION: 'custrecord_ctc_vcsp_log_app',
                HEADER: 'custrecord_ctc_vcsp_log_header',
                BODY: 'custrecord_ctc_vcsp_log_body',
                TRANSACTION: 'custrecord_ctc_vcsp_log_transaction',
                STATUS: 'custrecord_ctc_vcsp_log_status'
            },
            VarConnectPOLine: {
                PURCHASE_ORDER: 'custrecord_ctc_vc_poline_po',
                LINE_UNIQUE_KEY: 'custrecord_ctc_vc_poline_lineuniquekey',
                LINE: 'custrecord_ctc_vc_poline_line',
                VENDOR_LINE: 'custrecord_ctc_vc_poline_vendorline',
                STATUS: 'custrecord_ctc_vc_poline_status',
                TYPE: 'custrecord_ctc_vc_poline_type',
                VENDOR_ORDER_NUMBER: 'custrecord_ctc_vc_poline_vendorordernum',
                CUSTOMER_ORDER_NUMBER: 'custrecord_ctc_vc_poline_customerordnum',
                ORDER_DATE: 'custrecord_ctc_vc_poline_orderdate',
                SKU: 'custrecord_ctc_vc_poline_itemname',
                MPN: 'custrecord_ctc_vc_poline_mpn',
                NOTE: 'custrecord_ctc_vc_poline_note',
                QUANTITY: 'custrecord_ctc_vc_poline_quantity',
                RATE: 'custrecord_ctc_vc_poline_rate',
                SHIP_DATE: 'custrecord_ctc_vc_poline_shipdate',
                QTY_SHIPPED: 'custrecord_ctc_vc_poline_qtyshipped',
                SHIP_FROM: 'custrecord_ctc_vc_poline_shipfrom',
                SHIP_METHOD: 'custrecord_ctc_vc_poline_shipmethod',
                CARRIER: 'custrecord_ctc_vc_poline_carrier',
                ETA_DATE: 'custrecord_ctc_vc_poline_etadate',
                SERIAL_NUMBERS: 'custrecord_ctc_vc_poline_serialnumbers',
                TRACKING_NUMBERS: 'custrecord_ctc_vc_poline_trackingnumber',
                INTERNAL_REFERENCE: 'custrecord_ctc_vc_poline_internalref',
                JSON_DATA: 'custrecord_ctc_vc_poline_full_response',
                CREATE_LOG: 'custrecord_ctc_vc_poline_vccreatelog',
                UPDATE_LOG: 'custrecord_ctc_vc_poline_vcupdatelog'
            },
            VendorShipMethod: {
                VENDOR_CONFIG: 'custrecord_ctc_vcsp_ship_vendorconfg',
                SHIP_VALUE: 'custrecord_ctc_vcsp_ship_shipmethod',
                SHIP_METHOD_MAP: 'custrecord_ctc_vcsp_ship_shipmethodmap'
            }
        },
        Lists: {
            PO_EVENT: {
                ON_CREATE: 1,
                ON_APPROVE: 2,
                MANUAL: 3
            },
            API_VENDOR: {
                DELL: '1',
                ARROW: '2',
                SYNNEX: '3',
                INGRAM: '4',
                DANDH: '5'
            },
            VC_LOG_STATUS: {
                SUCCESS: '1',
                ERROR: '2',
                INFO: '3'
            },
            DELL_SHIPPING_CODE: {
                NORMAL: '1',
                TWO_DAY: '2',
                NEXT_DAY: '3'
            }
        },
        Scripts: {
            Script: {
                SEND_PO_SL: 'customscript_ctc_vcsp_sl_sendpo',
                LICENSE_VALIDATOR_SL: 'customscript_ctc_vcsp_sl_licensevalidate',
                VENDOR_DETAILS_SL: 'customscript_ctc_vcsp_sl_form_popup'
            },
            Deployment: {
                SEND_PO_SL: 'customdeploy_ctc_vcsp_sl_sendpo',
                LICENSE_VALIDATOR_SL: 'customdeploy_ctc_vcsp_sl_licensevalidate',
                VENDOR_DETAILS_SL: 'customdeploy_ctc_vcsp_sl_form_popup'
            }
        },
        LOG_APPLICATION: 'VAR Connect Send PO'
    };
});
