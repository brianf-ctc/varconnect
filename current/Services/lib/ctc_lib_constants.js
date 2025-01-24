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
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define(['N/runtime'], function (ns_runtime) {
    let VC_GLOBAL = {
        ENABLE_SUBSIDIARIES: ns_runtime.isFeatureInEffect({ feature: 'subsidiaries' }),
        PICK_PACK_SHIP: ns_runtime.isFeatureInEffect({ feature: 'pickpackship' }),
        DATE_FORMAT: 'YYYY-MM-DD',
        COUNTRY: ns_runtime.country,
        SN_LINE_FIELD_LINK_ID: 'custcol_ctc_xml_serial_num_link',
        ITEM_ID_LOOKUP_COL: 'item',
        ITEM_FUL_ID_LOOKUP_COL: 'itemname',
        VENDOR_SKU_LOOKUP_COL: 'item',
        SN_FOLDER_ID: 7,
        EMAIL_TEMPLATE_ID: 220, // let Connect Shipping Confirmation Template
        POHANDLING: 'Drop', // Special | Drop (default) | Both
        EMAIL_LIST_FIELD_ID: 'custbody_ctc_email_shipping_info_1',
        INCLUDE_ITEM_MAPPING_LOOKUP_KEY: 'ctc_includeItemMapping'
    };

    // RECORDS
    VC_GLOBAL.RECORD = {
        MAIN_CONFIG: {
            ID: 'customrecord_ctc_vc_main_config',
            FIELD: {
                ID: 'internalid',
                SCHEDULED_FULFILLMENT_TEMPLATE: 'custrecord_ctc_vc_sch_if_email_template',
                SCHEDULED_FULFILLMENT_SENDER: 'custrecord_ctc_vc_sch_if_email_sender',
                SCHEDULED_FULFILLMENT_SEARCH: 'custrecord_ctc_vc_sch_if_search',
                SERIAL_NO_FOLDER_ID: 'custrecord_ctc_vc_serial_folder_id',
                PROCESS_DROPSHIPS: 'custrecord_ctc_vc_process_dropship',
                PROCESS_SPECIAL_ORDERS: 'custrecord_ctc_vc_process_special_order',
                CREATE_ITEM_FULFILLMENTS: 'custrecord_ctc_vc_ds_create_if',
                CREATE_ITEM_RECEIPTS: 'custrecord_ctc_vc_specord_create_ir',
                IGNORE_DIRECT_SHIPS_DROPSHIPS: 'custrecord_ctc_vc_ds_ignore_direct_ship',
                IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS: 'custrecord_ctc_vc_spo_ignore_direct_ship',
                CREATE_SERIAL_DROPSHIPS: 'custrecord_ctc_vc_ds_create_serial',
                CREATE_SERIAL_SPECIAL_ORDERS: 'custrecord_ctc_vc_spo_create_serial',
                USE_INB_TRACKING_SPECIAL_ORDERS: 'custrecord_ctc_vc_specord_inb_track_num',
                LICENSE: 'custrecord_ctc_vc_license',
                LICENSE_TEXT: 'custrecord_ctc_vc_license_text',
                COPY_SERIALS_INV: 'custrecord_ctc_vc_copy_serials_inv',
                SERIAL_SCAN_UPDATE: 'custrecord_ctc_vc_serial_scan_update',
                PRINT_SERIALS_TEMPLATE: 'custrecord_ctc_vc_print_serial_template',
                INV_PRINT_SERIALS: 'custrecord_ctc_vc_print_serials',
                MULTIPLE_INGRAM: 'custrecord_ctc_vc_multiple_ingram',
                INGRAM_HASH_TO_SPACE: 'custrecord_ctc_vc_ingram_hash_to_space',
                FULFILMENT_SEARCH: 'custrecord_ctc_vc_sch_if_search',
                DEFAULT_BILL_FORM: 'custrecord_ctc_vc_bill_form',
                DEFAULT_VENDOR_BILL_STATUS: 'custrecord_ctc_vc_bill_status',
                ALLOWED_VARIANCE_AMOUNT_THRESHOLD: 'custrecord_ctc_vc_bill_var_threshold',
                ALLOW_ADJUSTLINE: 'custrecord_ctc_vc_bill_var_allow_adjline',
                VARIANCE_ON_TAX: 'custrecord_ctc_vc_bill_tax_var',
                DEFAULT_TAX_ITEM: 'custrecord_ctc_vc_bill_tax_item',
                DEFAULT_TAX_ITEM2: 'custrecord_ctc_vc_bill_tax_item2',
                VARIANCE_ON_SHIPPING: 'custrecord_ctc_vc_bill_ship_var',
                DEFAULT_SHIPPING_ITEM: 'custrecord_ctc_vc_bill_ship_item',
                VARIANCE_ON_OTHER: 'custrecord_ctc_vc_bill_other_var',
                DEFAULT_OTHER_ITEM: 'custrecord_ctc_vc_bill_other_item',
                DISABLE_VENDOR_BILL_CREATION: 'custrecord_ctc_vc_bill_is_disabled',
                OVERRIDE_PO_NUM: 'custrecord_ctc_vc_override_po_num',
                AUTOPROC_PRICEVAR: 'custrecord_ctc_vcbc_autopr_pricevar',
                AUTOPROC_TAXVAR: 'custrecord_ctc_vcbc_autopr_taxvar',
                AUTOPROC_SHIPVAR: 'custrecord_ctc_vcbc_autopr_shipvar',
                AUTOPROC_OTHERVAR: 'custrecord_ctc_vcbc_autopr_othervar',
                CUSTOM_ITEM_COLUMN_TO_MATCH: 'custrecord_ctc_vc_cust_item_match_col_id',
                CUSTOM_ITEM_FIELD_TO_MATCH: 'custrecord_ctc_vc_cust_item_match_fld_id',
                MATCH_CUSTOM_ITEM_TO_NAME: 'custrecord_ctc_vc_cust_item_match_strict',
                CUSTOM_MPN_COL_TO_MATCH: 'custrecord_ctc_vc_cust_mpn_match_col_id',
                CUSTOM_MPN_FLD_TO_MATCH: 'custrecord_ctc_vc_cust_mpn_match_fld_id',
                MATCH_CUSTOM_MPN_TO_NAME: 'custrecord_ctc_vc_cust_mpn_match_is_lax'
            }
        },
        VENDOR_CONFIG: {
            ID: 'customrecord_ctc_vc_vendor_config',
            FIELD: {
                ID: 'internalid',
                SUBSIDIARY: 'custrecord_ctc_vc_vendor_subsidiary',
                XML_VENDOR: 'custrecord_ctc_vc_xml_vendor',
                VENDOR: 'custrecord_ctc_vc_vendor',
                WEBSERVICE_ENDPOINT: 'custrecord_ctc_vc_endpoint',
                START_DATE: 'custrecord_ctc_vc_vendor_start',
                USERNAME: 'custrecord_ctc_vc_user',
                PASSWORD: 'custrecord_ctc_vc_password',
                CUSTOMER_NO: 'custrecord_ctc_vc_customer_number',
                // XML_REQUEST: 'custrecord_ctc_vc_xml_req',
                PROCESS_DROPSHIPS: 'custrecord_ctc_vc_process_dropship_vend',
                PROCESS_SPECIAL_ORDERS: 'custrecord_ctc_vc_process_spec_ord_vend',
                FULFILLMENT_PREFIX: 'custrecord_ctc_vc_prefix',
                ACCESS_ENDPOINT: 'custrecord_ctc_vc_access_endpoint',
                API_KEY: 'custrecord_ctc_vc_api_key',
                API_SECRET: 'custrecord_ctc_vc_api_secret',
                OATH_SCOPE: 'custrecord_ctc_vc_oath_scope',
                USE_SHIPDATE: 'custrecord_ctc_vc_use_shipdate',
                CUSTOM_ITEM_COLUMN_TO_MATCH: 'custrecord_ctc_vc_item_match_col',
                CUSTOM_ITEM_FIELD_TO_MATCH: 'custrecord_ctc_vc_item_match_fld',
                MATCH_CUSTOM_ITEM_TO_NAME: 'custrecord_ctc_vc_item_match_strict',
                CUSTOM_MPN_COL_TO_MATCH: 'custrecord_ctc_vc_mpn_match_col_id',
                CUSTOM_MPN_FLD_TO_MATCH: 'custrecord_ctc_vc_mpn_match_fld_id',
                MATCH_CUSTOM_MPN_TO_NAME: 'custrecord_ctc_vc_mpn_match_is_lax'
            }
        },
        VC_LOG: {
            ID: 'customrecord_ctc_vcsp_log',
            FIELD: {
                ID: 'internalid',
                APPLICATION: 'custrecord_ctc_vcsp_log_app',
                HEADER: 'custrecord_ctc_vcsp_log_header',
                BODY: 'custrecord_ctc_vcsp_log_body',
                TRANSACTION: 'custrecord_ctc_vcsp_log_transaction',
                TRANSACTION_LINEKEY: 'custrecord_ctc_vcsp_log_linekey',
                STATUS: 'custrecord_ctc_vcsp_log_status',
                DATE: 'custrecord_ctc_vcsp_log_date',
                BATCH: 'custrecord_ctc_vcsp_log_batch'
            }
        },
        VC_LOG_BATCH: {
            ID: 'customrecord_ctc_vcsp_log_batch',
            FIELD: {
                ID: 'internalid',
                TRANSACTION: 'custrecord_ctc_vcsp_log_batch_txn'
            }
        },
        SERIALS: {
            ID: 'customrecordserialnum',
            FIELD: {
                ID: 'internalid',
                NAME: 'name',
                ITEM: 'custrecordserialitem',
                CUSTOMER: 'custrecordcustomer',
                PURCHASE_ORDER: 'custrecordserialpurchase',
                SALES_ORDER: 'custrecordserialsales',
                ITEM_RECEIPT: 'custrecorditemreceipt',
                ITEM_FULFILLMENT: 'custrecorditemfulfillment',
                INVOICE: 'custrecordserialinvoice',
                SO_LINE: 'custrecord_ctc_vc_so_line',
                PO_LINE: 'custrecord_ctc_vc_po_line',
                IF_LINE: 'custrecord_ctc_vc_if_line',
                IR_LINE: 'custrecord_ctc_vc_ir_line',
                INV_LINE: 'custrecord_ctc_vc_inv_line'
            }
        },
        BILLCREATE_CONFIG: {
            ID: 'customrecord_vc_bill_vendor_config',
            FIELD: {
                ID: 'internalid',
                ENTRY_FUNC: 'custrecord_vc_bc_entry',
                ACK_FUNC: 'custrecord_vc_bc_ack',
                USER: 'custrecord_vc_bc_user',
                PASSWORD: 'custrecord_vc_bc_pass',
                PARTNERID: 'custrecord_vc_bc_partner',
                CONNECTION_TYPE: 'custrecord_vc_bc_connect_type',
                SFTP_HOSTKEY: 'custrecord_vc_bc_host_key',
                URL: 'custrecord_vc_bc_url',
                SUBSIDIARY: 'custrecord_vc_bc_subsidiary',
                SFTP_RESOURCE_PATH: 'custrecord_vc_bc_res_path',
                SFTP_ACK_PATH: 'custrecord_vc_bc_ack_path',
                ENABLE_FULFILLLMENT: 'custrecord_vc_bc_enable_fulfillment',
                SCOPE: 'custrecord_vc_bc_scope',
                SUBSCRIPTION_KEY: 'custrecord_vc_bc_subs_key',
                TOKEN_URL: 'custrecord_vc_bc_token_url'
            }
        },
        BILLFILE: {
            ID: 'customrecord_ctc_vc_bills',
            FIELD: {
                ID: 'id',
                NAME: 'name',
                POID: 'custrecord_ctc_vc_bill_po',
                PO_LINK: 'custrecord_ctc_vc_bill_linked_po',
                BILL_NUM: 'custrecord_ctc_vc_bill_number',
                BILL_LINK: 'custrecord_ctc_vc_bill_linked_bill',
                DATE: 'custrecord_ctc_vc_bill_date',
                DUEDATE: 'custrecord_ctc_vc_bill_due_date',
                DDATE_INFILE: 'custrecord_ctc_vc_bill_due_date_f_file',
                STATUS: 'custrecord_ctc_vc_bill_proc_status',
                PROCESS_LOG: 'custrecord_ctc_vc_bill_log',
                INTEGRATION: 'custrecord_ctc_vc_bill_integration',
                SOURCE: 'custrecord_ctc_vc_bill_src',
                JSON: 'custrecord_ctc_vc_bill_json',
                NOTES: 'custrecord_ctc_vc_bill_notes',
                HOLD_REASON: 'custrecord_ctc_vc_bill_hold_rsn',
                IS_RCVBLE: 'custrecord_ctc_vc_bill_is_recievable',
                PROC_VARIANCE: 'custrecord_ctc_vc_bill_proc_variance',
                FILEPOS: 'custrecord_ctc_vc_bill_file_position'
            }
        },
        SENDPO_CONFIG: { ID: 'customrecord_ctc_vcsp_vendor_config' },
        SENDPOVENDOR_CONFIG: {
            ID: 'customrecord_ctc_vcsp_vendor_config',
            FIELD: {
                ID: 'internalid',
                SUBSIDIARY: 'custrecord_ctc_vcsp_vendor_subsidiary',
                XML_VENDOR: 'custrecord_ctc_vcsp_api_vendor',
                VENDOR: 'custrecord_ctc_vcsp_vendor'
            }
        },
        VENDOR_ITEM_MAPPING: {
            ID: 'customrecord_ctc_vc_item_mapping',
            FIELD: {
                NAME: 'name',
                ITEM: 'custrecord_ctc_vc_itemmap_item'
            }
        },
        VAR_CONNECT_PO_LINE: {
            ID: '',
            FIELD: {
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
            }
        }
    };

    // LISTS
    VC_GLOBAL.LIST = {
        XML_VENDOR: {
            TECH_DATA: '1',
            INGRAM_MICRO: '2',
            SYNNEX: '3',
            DandH: '4',
            AVNET: '5',
            WESTCON: '6',
            ARROW: '7',
            DELL: '8',
            SYNNEX_API: '9',
            INGRAM_MICRO_API: '10',
            INGRAM_MICRO_V_ONE: '11',
            TECH_DATA_API: '12',
            JENNE: '13',
            SCANSOURCE: '14',
            WEFI: '16',
            DandH_API: '17',
            CARAHSOFT: '19'
        },
        VC_LOG_STATUS: {
            SUCCESS: '1',
            ERROR: '2',
            INFO: '3',
            WARN: '4',
            RECORD_ERROR: '5',
            API_ERROR: '6',
            SFTP_ERROR: '7',
            CONFIG_ERROR: '8',
            WS_ERROR: '9'
        },
        COUNTRY: {
            US: '1',
            CANADA: '2'
        }
    };

    // FIELDS
    VC_GLOBAL.FIELD = {
        ITEM: {
            DH_MPN: 'custitem_ctc_vc_dh_item'
        },
        TRANSACTION: {
            INBOUND_TRACKING_NUM: 'custcol_ctc_xml_inb_tracking_num',
            SERIAL_NUMBER_SCAN: 'custcol_ctc_serial_number_scan',
            SERIAL_NUMBER_UPDATE: 'custcol_ctc_serial_number_update',
            DH_MPN: 'custcol_ctc_vc_dh_mpn',
            SEND_SHIPPING_UPDATE_TO: 'custbody_ctc_vc_email_shipping_info',
            OVERRIDE_PONUM: 'custbody_ctc_vc_override_ponum',
            DELL_QUOTE_NO: 'custcol_ctc_vcsp_quote_no'
        },
        ENTITY: {
            BILLCONFIG: 'custentity_vc_bill_config'
        }
    };

    // SCRIPTS
    VC_GLOBAL.SCRIPTS = {
        MR_ORDERSTATUS: {
            id: 'customscript_ctc_script_xml_v2',
            deploymentId: 'customscript_ctc_script_xml_v2'
        },
        MR_PROCESSBILL: {},
        RL_SERVICES: {}
    };

    let LOG_STATUS = VC_GLOBAL.LIST.LOG_STATUS;

    VC_GLOBAL.ERRORMGS = {
        INVALID_LICENSE: {
            message:
                'License is no longer valid or have expired. ' +
                'Please contact damon@nscatalyst.com to get a new license. ' +
                'Your product has been disabled.',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        MISSING_CONFIG: {
            message: 'Missing Main Configuration',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        MISSING_VENDORCFG: {
            message: 'Missing Vendor Configuration',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        MISSING_PREFIX: {
            message: 'Missing Fulfillment Prefix',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        NO_PROCESS_DROPSHIP_SPECIALORD: {
            message: 'Process DropShips and Process Special Orders is not enabled!',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        MISSING_ORDERSTATUS_SEARCHID: {
            message: 'Missing Search: Open PO for Order Status processing',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        BYPASS_VARCONNECT: {
            message: 'Bypass let Connect is checked on this PO',
            logStatus: LOG_STATUS.WARN
        },

        /// ORDER STATUS ///
        LINE_NOT_MATCHED: {
            message: 'Line item not matched',
            logStatus: LOG_STATUS.INFO
        },
        MATCH_NOT_FOUND: {
            message: 'Could not find matching item',
            logStatus: LOG_STATUS.WARN
        },
        MISSING_ORDERNUM: {
            message: 'Missing Order Num',
            logStatus: LOG_STATUS.WARN
        },

        /// FULFILLMENT ///
        MISSING_SALESORDER: {
            message: 'Created from Sales Order record is missing',
            logStatus: LOG_STATUS.RECORD_ERROR
        },

        FULFILLMENT_NOT_ENABLED: {
            message: 'Item Fulfillment creation is not enabled',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },
        INSUFFICIENT_SERIALS: {
            message: 'Insufficient Serials quantity',
            logStatus: LOG_STATUS.ERROR
        },
        ORDER_EXISTS: {
            message: 'Order already exists',
            logStatus: LOG_STATUS.WARN
        },
        TRANSFORM_ERROR: {
            message: 'Transform error',
            logStatus: LOG_STATUS.RECORD_ERROR
        },
        NO_LINES_TO_PROCESS: {
            message: 'No lines to process.',
            logStatus: LOG_STATUS.WARN
        },
        NO_FULFILLABLES: {
            message: 'No fulfillable lines',
            logStatus: LOG_STATUS.INFO
        },
        NO_MATCHINGITEMS_TO_FULFILL: {
            message: 'No matching items to fulfill.',
            logStatus: LOG_STATUS.INFO
        },
        UNABLE_TO_FULFILL: {
            message: 'Unable to fulfill the following items',
            logStatus: LOG_STATUS.ERROR
        },
        NO_SHIP_QTY: {
            message: 'No shipped items',
            logStatus: LOG_STATUS.WARN
        },
        NOT_YET_SHIPPED: {
            message: 'Not yet shipped.',
            logStatus: LOG_STATUS.WARN
        },
        NO_ORDERS_TO_FULFILL: {
            message: 'No orders to fulfill.',
            logStatus: LOG_STATUS.WARN
        },

        /// ITEM RECEIPT ///
        ITEMRECEIPT_NOT_ENABLED: {
            message: 'Item Receipt creation is not enabled',
            logStatus: LOG_STATUS.CONFIG_ERROR
        },

        /// SERIALS ///

        /// VALIDATION ERRORS ///
        MISSING_PO: {
            message: 'Missing PO',
            logStatus: LOG_STATUS.RECORD_ERROR
        },
        INVALID_PO: {
            message: 'Invalid PO',
            logStatus: LOG_STATUS.RECORD_ERROR
        },
        MISSING_LINES: {
            message: 'Missing Order Lines',
            logStatus: LOG_STATUS.RECORD_ERROR
        },
        MISSING_VENDOR_LINE: {
            message: 'Missing Vendor Line',
            logStatus: LOG_STATUS.ERROR
        },
        INVALID_PODATE: {
            message: 'Invalid PO Date',
            logStatus: LOG_STATUS.WARN
        }
    };

    // CACHING
    VC_GLOBAL.CACHE = {
        NAME: 'VC_20240719.001',
        LICENSE: 'VC_LICENSE',
        MAIN_CONFIG: 'VC_MAINCFG',
        VENDOR_CONFIG: 'VC_VENDORCFG',
        BILLCREATE_CONFIG: 'VC_BILLCFG',
        SENDPOVND_CONFIG: 'VC_SENDPOVCFG',

        TTL: 86400
    };

    // LICENSING / CONFIG SERVER
    VC_GLOBAL.SERVER = {
        LICENSE: 'https://nscatalystserver.azurewebsites.net/productauth.php',
        CONFIG: 'https://nscatalystserver.azurewebsites.net/productauth.php',
        PRODUCT_CODE: 2
    };

    return VC_GLOBAL;
});
