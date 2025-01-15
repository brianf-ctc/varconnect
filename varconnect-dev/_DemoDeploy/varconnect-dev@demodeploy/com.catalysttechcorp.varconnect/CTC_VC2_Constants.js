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

define(function (require) {
    var ns_runtime = require('N/runtime');

    var VC2_CONSTANT = {
        IS_DEBUG_MODE: false,
        LOG_APPLICATION: 'VAR Connect'
    };

    VC2_CONSTANT.RECORD = {
        MAIN_CONFIG: {
            ID: 'customrecord_ctc_vc_main_config',
            FIELD: {
                ID: 'internalid',
                NAME: 'name',
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
                NAME: 'name',
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
                SUBSCRIPTION_KEY: 'custrecord_ctc_vc_subscription_key',
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
                NAME: 'name',
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
                TOKEN_URL: 'custrecord_vc_bc_token_url',
                IGNORE_TAXVAR: 'custrecord_vc_bc_ignore_taxvar'
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
                NAME: 'name',
                SUBSIDIARY: 'custrecord_ctc_vcsp_vendor_subsidiary',
                XML_VENDOR: 'custrecord_ctc_vcsp_api_vendor',
                VENDOR: 'custrecord_ctc_vcsp_vendor',
                EVENT_TYPE: 'custrecord_ctc_vcsp_event',
                TEST_REQUEST: 'custrecord_ctc_vcsp_test',
                IS_SPECIAL_ITEM_NAME: 'custrecord_vcsp_is_item_name_special',
                WEBSERVICE_ENDPOINT: 'custrecord_ctc_vcsp_endpoint',
                ACCESS_ENDPOINT: 'custrecord_ctc_vcsp_access_endpoint',
                OAUTH_SCOPE: 'custrecord_ctc_vcsp_access_scope',
                SUBSCRIPTION_KEY: 'custrecord_ctc_vcsp_access_subscr_key',
                USERNAME: 'custrecord_ctc_vcsp_username',
                PASSWORD: 'custrecord_ctc_vcsp_password',
                CUSTOMER_NO: 'custrecord_ctc_vcsp_customer_number',
                API_KEY: 'custrecord_ctc_vcsp_api_key',
                API_SECRET: 'custrecord_ctc_vcsp_api_secret',
                FIELD_MAP: 'custrecord_ctc_vcsp_fieldmapping',
                QA_WEBSERVICE_ENDPOINT: 'custrecord_ctc_vcsp_endpoint_qa',
                QA_ACCESS_ENDPOINT: 'custrecord_ctc_vcsp_access_endpoint_qa',
                QA_OAUTH_SCOPE: 'custrecord_ctc_vcsp_access_scope_qa',
                QA_API_KEY: 'custrecord_ctc_vcsp_api_key_qa',
                QA_API_SECRET: 'custrecord_ctc_vcsp_api_secret_qa',
                QA_SUBSCRIPTION_KEY: 'custrecord_ctc_vcsp_access_subscr_qa',
                PONUM_FIELD: 'custrecord_ctc_vcsp_ponum_field',
                ITEM_COLUMN: 'custrecord_ctc_vcsp_item_field',
                QUOTE_COLUMN: 'custrecord_ctc_vcsp_quoteno_field',
                MEMO_FIELD: 'custrecord_ctc_vcsp_memo_field',
                SHIP_CONTACT_FIELD: 'custrecord_ctc_vcsp_shipcontact_field',
                SHIP_EMAIL_FIELD: 'custrecord_ctc_vcsp_shipemail_field',
                SHIP_PHONE_FIELD: 'custrecord_ctc_vcsp_shipphone_field',
                ENABLE_ADD_VENDOR_DETAILS: 'custrecord_ctc_vcsp_show_details',
                ADDITIONAL_PO_FIELDS: 'custrecord_ctc_vcsp_po_fields',
                ADD_DETAILS_ON_SUBMIT: 'custrecord_ctc_vcsp_auto_include_details',
                PO_LINE_COLUMNS: 'custrecord_ctc_vcsp_line_cols',
                BILL_ID: 'custrecord_ctc_vcsp_bill_addrid',
                BILL_ADDRESSEE: 'custrecord_ctc_vcsp_bill_addressee',
                BILL_ATTENTION: 'custrecord_ctc_vcsp_bill_attention',
                BILL_EMAIL: 'custrecord_ctc_vcsp_bill_email',
                BILL_PHONENO: 'custrecord_ctc_vcsp_phoneno',
                BILL_ADDRESS_1: 'custrecord_ctc_vcsp_bill_addr1',
                BILL_ADDRESS_2: 'custrecord_ctc_vcsp_bill_addr2',
                BILL_CITY: 'custrecord_ctc_vcsp_bill_city',
                BILL_STATE: 'custrecord_ctc_vcsp_bill_state',
                BILL_ZIP: 'custrecord_ctc_vcsp_bill_zip',
                BILL_COUNTRY: 'custrecord_ctc_vcsp_bill_country',
                PAYMENT_MEAN: 'custrecord_ctc_vcsp_payment_mean',
                PAYMENT_OTHER: 'custrecord_ctc_vcsp_payment_mean_other',
                PAYMENT_TERM: 'custrecord_ctc_vcsp_payment_term',
                BUSINESS_UNIT: 'custrecord_ctc_vcsp_businessunit'
            }
        },
        VENDOR_ITEM_MAPPING: {
            ID: 'customrecord_ctc_vc_item_mapping',
            FIELD: {
                NAME: 'name',
                ITEM: 'custrecord_ctc_vc_itemmap_item'
            }
        },
        ORDER_LINE: {
            ID: 'customrecord_ctc_vc_orderlines',
            FIELD: {
                ORDNUM_LINK: 'custrecord_ctc_vc_orderline_ordernum',
                RECKEY: 'custrecord_ctc_vc_orderline_reckey',
                VENDOR: 'custrecord_ctc_vc_orderline_vendor',
                TXN_LINK: 'custrecord_ctc_vc_orderline_txnlink',
                ORDER_NUM: 'custrecord_ctc_vc_orderline_vndordernum',
                ORDER_STATUS: 'custrecord_ctc_vc_orderline_vndorderstat',
                STATUS: 'custrecord_ctc_vc_orderline_orderstatus',
                LINE_STATUS: 'custrecord_ctc_vc_orderline_linestatus',
                ITEM: 'custrecord_ctc_vc_orderline_itemname',
                SKU: 'custrecord_ctc_vc_orderline_vendorsku',
                LINE_NO: 'custrecord_ctc_vc_orderline_vndlineno',
                ITEM_LINK: 'custrecord_ctc_vc_orderline_itemlink',
                POLINE_UNIQKEY: 'custrecord_ctc_vc_orderline_polinekey',
                QTY: 'custrecord_ctc_vc_orderline_vndqty',
                PO_QTY: 'custrecord_ctc_vc_orderline_poqty',
                ORDER_DATE: 'custrecord_ctc_vc_orderline_orderdate',
                // ORDER_DATETXT: 'custrecord_ctc_vc_orderline_vndorderdate',
                SHIPPED_DATE: 'custrecord_ctc_vc_orderline_shippeddate',
                ETA_DATE: 'custrecord_ctc_vc_orderline_eta_date',
                ETD_DATE: 'custrecord_ctc_vc_orderline_etd_date',
                PROMISED_DATE: 'custrecord_ctc_vc_orderline_promiseddate',
                CARRIER: 'custrecord_ctc_vc_orderline_carrier',
                SHIP_METHOD: 'custrecord_ctc_vc_orderline_shipmethod',
                TRACKING: 'custrecord_ctc_vc_orderline_trackingno',
                SERIALNUM: 'custrecord_ctc_vc_orderline_serialno',
                ORDER_DATA: 'custrecord_ctc_vc_orderline_vndorderdata',
                LINE_DATA: 'custrecord_ctc_vc_orderline_vndlinedata',
                ITEMFF_LINK: 'custrecord_ctc_vc_orderline_itemfflink',
                VB_LINK: 'custrecord_ctc_vc_orderline_vblink',
                BILLFILE_LINK: 'custrecord_ctc_vc_orderline_billfile',
                SHIP_STATUS: 'custrecord_ctc_vc_orderline_shipstatus'
            }
        },
        ORDER_NUM: {
            ID: 'customrecord_ctc_vc_ordernums',
            FIELD: {
                TXN_LINK: 'custrecord_ctc_vc_ordernum_txnlink',
                ORDER_NUM: 'custrecord_ctc_vc_ordernum_ponum',
                VENDOR_NUM: 'custrecord_ctc_vc_ordernum_vendorpo',
                ORDER_STATUS: 'custrecord_ctc_vc_ordernum_status',
                ORDER_DATE: 'custrecord_ctc_vc_ordernum_orderdate',
                TOTAL: 'custrecord_ctc_vc_ordernum_total',
                ITEMFF_LINK: 'custrecord_ctc_vc_ordernum_itemff',
                SOURCE: 'custrecord_ctc_vc_ordernum_sourcedata',
                LINES: 'custrecord_ctc_vc_ordernum_vendorlines',
                VENDOR: 'custrecord_ctc_vc_ordernum_vendor',
                VENDOR_CFG: 'custrecord_ctc_vc_ordernum_config',
                NOTE: 'custrecord_ctc_vc_ordernum_procnote',
                DETAILS: 'custrecord_ctc_vc_ordernum_procdetails'
            }
        },
        VAR_CONNECT_PO_LINE: {
            ID: 'customrecord_ctc_vc_poline',
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

    var BillCFG = VC2_CONSTANT.RECORD.BILLCREATE_CONFIG,
        VendorCFG = VC2_CONSTANT.RECORD.VENDOR_CONFIG,
        MainCFG = VC2_CONSTANT.RECORD.MAIN_CONFIG,
        SendPOVndCFG = VC2_CONSTANT.RECORD.SENDPOVENDOR_CONFIG;

    VC2_CONSTANT.MAPPING = {
        MAIN_CONFIG: {
            id: MainCFG.FIELD.ID,
            name: MainCFG.FIELD.NAME,
            emailTemplate: MainCFG.FIELD.SCHEDULED_FULFILLMENT_TEMPLATE,
            emailSender: MainCFG.FIELD.SCHEDULED_FULFILLMENT_SENDER,
            serialNoFolder: MainCFG.FIELD.SERIAL_NO_FOLDER_ID,
            processDropships: MainCFG.FIELD.PROCESS_DROPSHIPS,
            processSpecialOrders: MainCFG.FIELD.PROCESS_SPECIAL_ORDERS,
            createIF: MainCFG.FIELD.CREATE_ITEM_FULFILLMENTS,
            createIR: MainCFG.FIELD.CREATE_ITEM_RECEIPTS,
            ignoreDirectShipDropship: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_DROPSHIPS,
            ignoreDirectShipSpecialOrder: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS,
            createSerialDropship: MainCFG.FIELD.CREATE_SERIAL_DROPSHIPS,
            createSerialSpecialOrder: MainCFG.FIELD.CREATE_SERIAL_SPECIAL_ORDERS,
            useInboundTrackingNumbers: MainCFG.FIELD.USE_INB_TRACKING_SPECIAL_ORDERS,
            license: MainCFG.FIELD.LICENSE,
            copySerialsInv: MainCFG.FIELD.COPY_SERIALS_INV,
            serialScanUpdate: MainCFG.FIELD.SERIAL_SCAN_UPDATE,
            invPrintSerials: MainCFG.FIELD.INV_PRINT_SERIALS,
            printSerialsTemplate: MainCFG.FIELD.PRINT_SERIALS_TEMPLATE,
            multipleIngram: MainCFG.FIELD.MULTIPLE_INGRAM,
            ingramHashSpace: MainCFG.FIELD.INGRAM_HASH_TO_SPACE,
            fulfillmentSearch: MainCFG.FIELD.FULFILMENT_SEARCH,
            defaultBillForm: MainCFG.FIELD.DEFAULT_BILL_FORM,
            defaultVendorBillStatus: MainCFG.FIELD.DEFAULT_VENDOR_BILL_STATUS,
            allowedVarianceAmountThreshold: MainCFG.FIELD.ALLOWED_VARIANCE_AMOUNT_THRESHOLD,
            isVarianceOnTax: MainCFG.FIELD.VARIANCE_ON_TAX,
            allowAdjustLine: MainCFG.FIELD.ALLOW_ADJUSTLINE,
            defaultTaxItem: MainCFG.FIELD.DEFAULT_TAX_ITEM,
            defaultTaxItem2: MainCFG.FIELD.DEFAULT_TAX_ITEM2,
            isVarianceOnShipping: MainCFG.FIELD.VARIANCE_ON_SHIPPING,
            defaultShipItem: MainCFG.FIELD.DEFAULT_SHIPPING_ITEM,
            isVarianceOnOther: MainCFG.FIELD.VARIANCE_ON_OTHER,
            defaultOtherItem: MainCFG.FIELD.DEFAULT_OTHER_ITEM,
            isBillCreationDisabled: MainCFG.FIELD.DISABLE_VENDOR_BILL_CREATION,
            overridePONum: MainCFG.FIELD.OVERRIDE_PO_NUM,
            autoprocPriceVar: MainCFG.FIELD.AUTOPROC_PRICEVAR,
            autoprocTaxVar: MainCFG.FIELD.AUTOPROC_TAXVAR,
            autoprocShipVar: MainCFG.FIELD.AUTOPROC_SHIPVAR,
            autoprocOtherVar: MainCFG.FIELD.AUTOPROC_OTHERVAR,
            itemColumnIdToMatch: MainCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH,
            itemFieldIdToMatch: MainCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH,
            matchItemToPartNumber: MainCFG.FIELD.MATCH_CUSTOM_ITEM_TO_NAME,
            itemMPNColumnIdToMatch: MainCFG.FIELD.CUSTOM_MPN_COL_TO_MATCH,
            itemMPNFieldIdToMatch: MainCFG.FIELD.CUSTOM_MPN_FLD_TO_MATCH,
            matchMPNWithPartNumber: MainCFG.FIELD.MATCH_CUSTOM_MPN_TO_NAME
        },
        BILLCREATE_CONFIG: {
            id: BillCFG.FIELD.ID,
            name: BillCFG.FIELD.NAME,
            entry_function: BillCFG.FIELD.ENTRY_FUNC,
            ack_path: BillCFG.FIELD.ACK_FUNC,
            user_id: BillCFG.FIELD.USER,
            user_pass: BillCFG.FIELD.PASSWORD,
            partner_id: BillCFG.FIELD.PARTNERID,
            connectionType: BillCFG.FIELD.CONNECTION_TYPE,
            host_key: BillCFG.FIELD.SFTP_HOSTKEY,
            url: BillCFG.FIELD.URL,
            res_path: BillCFG.FIELD.SFTP_RESOURCE_PATH,
            ack_path: BillCFG.FIELD.SFTP_ACK_PATH,
            enableFulfillment: BillCFG.FIELD.ENABLE_FULFILLLMENT,
            subsidiary: BillCFG.FIELD.SUBSIDIARY,
            scope: BillCFG.FIELD.SCOPE,
            subscription_key: BillCFG.FIELD.SUBSCRIPTION_KEY,
            token_url: BillCFG.FIELD.TOKEN_URL,
            ignoreTaxVar: BillCFG.FIELD.IGNORE_TAXVAR
        },
        VENDOR_CONFIG: {
            id: VendorCFG.FIELD.ID,
            name: VendorCFG.FIELD.NAME,
            subsidiary: VendorCFG.FIELD.SUBSIDIARY,
            xmlVendor: VendorCFG.FIELD.XML_VENDOR,
            vendor: VendorCFG.FIELD.VENDOR,
            endPoint: VendorCFG.FIELD.WEBSERVICE_ENDPOINT,
            startDate: VendorCFG.FIELD.START_DATE,
            user: VendorCFG.FIELD.USERNAME,
            password: VendorCFG.FIELD.PASSWORD,
            customerNo: VendorCFG.FIELD.CUSTOMER_NO,
            processDropships: VendorCFG.FIELD.PROCESS_DROPSHIPS,
            processSpecialOrders: VendorCFG.FIELD.PROCESS_SPECIAL_ORDERS,
            fulfillmentPrefix: VendorCFG.FIELD.FULFILLMENT_PREFIX,
            accessEndPoint: VendorCFG.FIELD.ACCESS_ENDPOINT,
            apiKey: VendorCFG.FIELD.API_KEY,
            apiSecret: VendorCFG.FIELD.API_SECRET,
            oauthScope: VendorCFG.FIELD.OATH_SCOPE,
            useShipDate: VendorCFG.FIELD.USE_SHIPDATE,
            subscriptionKey: VendorCFG.FIELD.SUBSCRIPTION_KEY,
            itemColumnIdToMatch: VendorCFG.FIELD.CUSTOM_ITEM_COLUMN_TO_MATCH,
            itemFieldIdToMatch: VendorCFG.FIELD.CUSTOM_ITEM_FIELD_TO_MATCH,
            matchItemToPartNumber: VendorCFG.FIELD.MATCH_CUSTOM_ITEM_TO_NAME,
            itemMPNColumnIdToMatch: VendorCFG.FIELD.CUSTOM_MPN_COL_TO_MATCH,
            itemMPNFieldIdToMatch: VendorCFG.FIELD.CUSTOM_MPN_FLD_TO_MATCH,
            matchMPNWithPartNumber: VendorCFG.FIELD.MATCH_CUSTOM_MPN_TO_NAME
        },
        SENDPOVENDOR_CONFIG: {
            id: SendPOVndCFG.FIELD.ID,
            name: SendPOVndCFG.FIELD.NAME,
            vendor: SendPOVndCFG.FIELD.VENDOR,
            subsidiary: SendPOVndCFG.FIELD.SUBSIDIARY,
            xmlVendor: SendPOVndCFG.FIELD.XML_VENDOR,
            vendor: SendPOVndCFG.FIELD.VENDOR,
            eventType: SendPOVndCFG.FIELD.EVENT_TYPE,
            testRequest: SendPOVndCFG.FIELD.TEST_REQUEST,
            isSpecialItem: SendPOVndCFG.FIELD.IS_SPECIAL_ITEM_NAME,
            webserviceEndpoint: SendPOVndCFG.FIELD.WEBSERVICE_ENDPOINT,
            accessEndPoint: SendPOVndCFG.FIELD.ACCESS_ENDPOINT,
            oAuthScope: SendPOVndCFG.FIELD.OAUTH_SCOPE,
            subscriptionKey: SendPOVndCFG.FIELD.SUBSCRIPTION_KEY,
            username: SendPOVndCFG.FIELD.USERNAME,
            password: SendPOVndCFG.FIELD.PASSWORD,
            customerNo: SendPOVndCFG.FIELD.CUSTOMER_NO,
            apiKey: SendPOVndCFG.FIELD.API_KEY,
            apiSecret: SendPOVndCFG.FIELD.API_SECRET,
            fieldMap: SendPOVndCFG.FIELD.FIELD_MAP,
            qaWebserviceURL: SendPOVndCFG.FIELD.QA_WEBSERVICE_ENDPOINT,
            qaAccessURL: SendPOVndCFG.FIELD.QA_ACCESS_ENDPOINT,
            qaApiKey: SendPOVndCFG.FIELD.QA_API_KEY,
            qaOAuthScope: SendPOVndCFG.FIELD.QA_OAUTH_SCOPE,
            qaApiSecret: SendPOVndCFG.FIELD.QA_API_SECRET,
            qaSubscriptionKey: SendPOVndCFG.FIELD.QA_SUBSCRIPTION_KEY,
            poNumField: SendPOVndCFG.FIELD.PONUM_FIELD,
            itemColumn: SendPOVndCFG.FIELD.ITEM_COLUMN,
            quoteColumn: SendPOVndCFG.FIELD.QUOTE_COLUMN,
            memoField: SendPOVndCFG.FIELD.MEMO_FIELD,
            shipContactField: SendPOVndCFG.FIELD.SHIP_CONTACT_FIELD,
            shipEmailField: SendPOVndCFG.FIELD.SHIP_EMAIL_FIELD,
            shipPhoneField: SendPOVndCFG.FIELD.SHIP_PHONE_FIELD,
            enableAddDetails: SendPOVndCFG.FIELD.ENABLE_ADD_VENDOR_DETAILS,
            additionalFields: SendPOVndCFG.FIELD.ADDITIONAL_PO_FIELDS,
            addDetailsOnSubmit: SendPOVndCFG.FIELD.ADD_DETAILS_ON_SUBMIT,
            poLineColumns: SendPOVndCFG.FIELD.PO_LINE_COLUMNS,
            billId: SendPOVndCFG.FIELD.BILL_ID,
            billAddressee: SendPOVndCFG.FIELD.BILL_ADDRESSEE,
            billAttention: SendPOVndCFG.FIELD.BILL_ATTENTION,
            billEmail: SendPOVndCFG.FIELD.BILL_EMAIL,
            billPhoneNo: SendPOVndCFG.FIELD.BILL_PHONENO,
            billAddress1: SendPOVndCFG.FIELD.BILL_ADDRESS_1,
            billAddress2: SendPOVndCFG.FIELD.BILL_ADDRESS_2,
            billCity: SendPOVndCFG.FIELD.BILL_CITY,
            billState: SendPOVndCFG.FIELD.BILL_STATE,
            billZip: SendPOVndCFG.FIELD.BILL_ZIP,
            billCountry: SendPOVndCFG.FIELD.BILL_COUNTRY,
            paymentMean: SendPOVndCFG.FIELD.PAYMENT_MEAN,
            paymentOther: SendPOVndCFG.FIELD.PAYMENT_OTHER,
            paymentTerm: SendPOVndCFG.FIELD.PAYMENT_TERM,
            businessUnit: SendPOVndCFG.FIELD.BUSINESS_UNIT
        }
    };

    VC2_CONSTANT.FIELD = {
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

    VC2_CONSTANT.LIST = {
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
        },
        ORDER_STATUS: {
            PENDING: 1,
            SHIPPED: 2,
            INVOICED: 3,
            PARTIALLY_SHIPPED: 4,
            PARTIALLY_BILED: 5,
            BACKORDERED: 6,
            DELETED: 7,
            NOT_FOUND: 8,
            ON_HOLD: 9,
            IN_PROGRESS: 10,
            SCHEDULED: 11,
            CLOSED: 12,
            OPEN_ORDER: 13
        }
    };
    VC2_CONSTANT.SCRIPT = {
        ORDERSTATUS_MR: 'customscript_ctc_script_xml_v2',
        BILLPROCESS_MR: 'customscript_ctc_vc_process_bills',
        VIEW_SERIALS_SL: 'customscript_vc_view_serials',
        LICENSE_VALIDATOR_SL: 'customscript_ctc_vc_sl_licensevalidator',
        PRINT_SERIALS_SL: 'customscript_ctc_vc_sl_print_serial',
        SERIAL_UPDATE_MR: 'customscript_ctc_vc_mr_serial_manip',
        SERIAL_UPDATE_ALL_MR: 'customscript_ctc_vc_mr_serial_manip_so',
        ITEM_MATCH_RL: 'customscript_ctc_vc_fuse_itemmatch',
        SERVICES_RL: 'customscript_ctc_vc_rl_services',
        GETBILLS_API: 'customscript_ctc_vc_retrieve_api_file'
    };
    VC2_CONSTANT.DEPLOYMENT = {
        ORDERSTATUS_MR: 'customscript_ctc_script_xml_v2',
        VIEW_SERIALS_SL: 'customdeploy_vc_view_serials',
        LICENSE_VALIDATOR_SL: 'customdeploy_ctc_vc_sl_licensevalidator',
        PRINT_SERIALS_SL: 'customdeploy_ctc_vc_sl_print_serial',
        ITEM_MATCH_RL: 'customdeploy_ctc_vc_fuse_itemmatch',
        SERVICES_RL: 'customdeploy_ctc_rl_services'
    };

    VC2_CONSTANT.ERRORMSG = {
        /// CONFIG ERRORS ///
        INVALID_LICENSE: {
            message:
                'License is no longer valid or have expired. ' +
                'Please contact damon@nscatalyst.com to get a new license. ' +
                'Your product has been disabled.',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        MISSING_CONFIG: {
            message: 'Missing Main Configuration',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        MISSING_VENDORCFG: {
            message: 'Missing Vendor Configuration',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        MISSING_PREFIX: {
            message: 'Missing Fulfillment Prefix',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        NO_PROCESS_DROPSHIP_SPECIALORD: {
            message: 'Process DropShips and Process Special Orders is not enabled!',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        MISSING_ORDERSTATUS_SEARCHID: {
            message: 'Missing Search: Open PO for Order Status processing',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        BYPASS_VARCONNECT: {
            message: 'Bypass VAR Connect is checked on this PO',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        /// ORDER STATUS ///
        LINE_NOT_MATCHED: {
            message: 'Line item not matched',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        MATCH_NOT_FOUND: {
            message: 'Could not find matching item',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        MISSING_ORDERNUM: {
            message: 'Missing Order Num',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        /// FULFILLMENT ///
        MISSING_SALESORDER: {
            message: 'Created from Sales Order record is missing',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },

        FULFILLMENT_NOT_ENABLED: {
            message: 'Item Fulfillment creation is not enabled',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        INSUFFICIENT_SERIALS: {
            message: 'Insufficient Serials quantity',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        ORDER_EXISTS: {
            message: 'Order already exists',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        TRANSFORM_ERROR: {
            message: 'Transform error',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },
        NO_LINES_TO_PROCESS: {
            message: 'No lines to process.',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        NO_FULFILLABLES: {
            message: 'No fulfillable lines',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        NO_MATCHINGITEMS_TO_FULFILL: {
            message: 'No matching items to fulfill.',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        UNABLE_TO_FULFILL: {
            message: 'Unable to fulfill all items',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        NO_SHIP_QTY: {
            message: 'No shipped items',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        NOT_YET_SHIPPED: {
            message: 'Not yet shipped.',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        NO_ORDERS_TO_FULFILL: {
            message: 'No orders to fulfill.',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        PO_FULLYFULFILLED: {
            message: 'PO is fully fulfilled',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        PO_CLOSED: {
            message: 'PO is closed',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        /// ITEM RECEIPT ///
        ITEMRECEIPT_NOT_ENABLED: {
            message: 'Item Receipt creation is not enabled',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },

        /// SERIALS ///

        /// VALIDATION ERRORS ///
        MISSING_PO: {
            message: 'Missing PO',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },
        INVALID_PO: {
            message: 'Invalid PO',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },
        MISSING_LINES: {
            message: 'Missing Order Lines',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },
        MISSING_VENDOR_LINE: {
            message: 'Missing Vendor Line',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        INVALID_PODATE: {
            message: 'Invalid PO Date',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        /// ORDER STATUS ERROR //
        INVALID_CREDENTIALS: {
            message: 'Invalid credentials',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        INVALID_REQUEST: {
            message: 'Invalid request query',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        INVALID_ACCESSPOINT: {
            message: 'Invalid Access Endpoint',
            logStatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        ENDPOINT_URL_ERROR: {
            message: 'Unable to reach the webservice endpoint'
        },
        INVALID_ACCESS_TOKEN: {
            message: 'Invalid or expired access token'
        },
        ORDER_NOT_FOUND: {
            message: 'Order not found'
        }
    };

    var Bill_Creator = {};
    Bill_Creator.Status = {
        PENDING: 1,
        ERROR: 2,
        PROCESSED: 3,
        REPROCESS: 4,
        CLOSED: 5,
        HOLD: 6,
        VARIANCE: 7
    };

    Bill_Creator.Code = {
        MISSING_PO: {
            code: 'MISSING_PO',
            msg: 'Unable to find the PO record. ',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        MISSING_POLINK: {
            code: 'MISSING_POLINK',
            msg: 'PO Link not found',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        MISSING_BILL_LINES: {
            code: 'MISSING_BILL_LINES',
            msg: 'Missing bill file lines',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        INCOMPLETE_BILLFILE: {
            code: 'INCOMPLETE_BILLFILE',
            msg: 'Incomplete bill file data',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        NOT_BILLABLE: {
            code: 'NOT_BILLABLE',
            msg: 'PO is not ready for billing. ',
            status: Bill_Creator.Status.PENDING,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        NOT_FULLY_PROCESSED: {
            code: 'NOT_FULLY_PROCESSED',
            msg: 'Could not fully process Bill File. ',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.ERROR
        },
        INSUFFICIENT_QUANTITY: {
            code: 'INSUFFICIENT_QUANTITY',
            msg: 'PO Qty is insufficient for the bill.',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        INSUFFICIENT_RECEIVABLES: {
            code: 'INSUFFICIENT_RECEIVABLES',
            msg: 'Receivable Qty is not enough for the bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        INSUFFICIENT_BILLABLE: {
            code: 'INSUFFICIENT_BILLABLE',
            msg: 'Insufficient quantity to bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },

        ITEMS_ALREADY_BILLED: {
            code: 'ITEMS_ALREADY_BILLED',
            msg: 'Items are already billed',
            status: Bill_Creator.Status.CLOSED,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },

        ITEM_FULLY_BILLED: {
            code: 'ITEM_FULLY_BILLED',
            msg: 'Fully billed item/s',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },

        ITEM_NOT_BILLABLE: {
            code: 'ITEM_NOT_BILLABLE',
            msg: 'Not billable item/s',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        MISSING_ITEMNO: {
            code: 'MISSING_ITEMNO',
            msg: 'Missing Item on Bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        UNMATCHED_ITEMS: {
            code: 'UNMATCHED_ITEMS',
            msg: 'Unmatched item/s on the bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        MISMATCH_RATE: {
            code: 'MISMATCH_RATE',
            msg: 'Mismatched rates on item(s) on the bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        EXISTING_BILLS: {
            code: 'EXISTING_BILLS',
            msg: 'Linked to existing Bill.',
            status: Bill_Creator.Status.CLOSED,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        HAS_VARIANCE: {
            code: 'HAS_VARIANCE',
            msg: 'One or More Variances in Vendor Bill.',
            status: Bill_Creator.Status.VARIANCE,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        BILL_CREATED: {
            code: 'BILL_CREATED',
            msg: 'Created Vendor Bill',
            status: Bill_Creator.Status.PROCESSED,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.SUCCESS
        },
        FULLY_BILLED: {
            code: 'FULLY_BILLED',
            msg: 'PO is Fully Billed',
            status: Bill_Creator.Status.CLOSED,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        CLOSED_PO: {
            code: 'CLOSED_PO',
            msg: 'PO is Closed',
            status: Bill_Creator.Status.CLOSED,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        WITHIN_THRESHOLD: {
            code: 'WITHIN_THRESHOLD',
            msg: 'Variance detected but within threshold',
            status: Bill_Creator.Status.VARIANCE,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.INFO
        },
        EXCEED_THRESHOLD: {
            code: 'EXCEED_THRESHOLD',
            msg: 'Variance detected and exceeded threshold',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.WARN
        },
        BILL_NOT_CREATED: {
            code: 'BILL_NOT_CREATED',
            msg: 'Failed to create the Vendor Bill',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.RECORD_ERROR
        },
        BILL_CREATE_DISABLED: {
            code: 'BILL_CREATE_DISABLED',
            msg: 'Vendor Bill creation is disabled',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        UNABLE_TO_ADD_VARIANCE_LINE: {
            code: 'UNABLE_TO_ADD_VARIANCE_LINE',
            msg: 'Unable to add variance item',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        },
        MISSING_VARIANCE_ITEM: {
            code: 'MISSING_VARIANCE_ITEM',
            msg: 'Variance Item missing from configuration',
            status: Bill_Creator.Status.ERROR,
            logstatus: VC2_CONSTANT.LIST.VC_LOG_STATUS.CONFIG_ERROR
        }
    };

    VC2_CONSTANT.Bill_Creator = Bill_Creator;

    VC2_CONSTANT.GLOBAL = {
        ENABLE_SUBSIDIARIES: ns_runtime.isFeatureInEffect({
            feature: 'subsidiaries'
        }),
        PICK_PACK_SHIP: ns_runtime.isFeatureInEffect({
            feature: 'pickpackship'
        }),
        DATE_FORMAT: 'MM/DD/YYYY',
        COUNTRY: ns_runtime.country,
        SN_LINE_FIELD_LINK_ID: 'custcol_ctc_xml_serial_num_link',
        ITEM_ID_LOOKUP_COL: 'item',
        ITEM_FUL_ID_LOOKUP_COL: 'itemname',
        VENDOR_SKU_LOOKUP_COL: 'item',
        SN_FOLDER_ID: 7,
        EMAIL_TEMPLATE_ID: 220, // Var Connect Shipping Confirmation Template
        POHANDLING: 'Drop', // Special | Drop (default) | Both
        EMAIL_LIST_FIELD_ID: 'custbody_ctc_email_shipping_info_1',
        INCLUDE_ITEM_MAPPING_LOOKUP_KEY: 'ctc_includeItemMapping'
    };

    VC2_CONSTANT.CACHE_NAME = [
        'VC_CACHE_KEY',
        VC2_CONSTANT.IS_DEBUG_MODE ? new Date().getTime() : null,
        '202501010.1230'
    ].join('_');

    VC2_CONSTANT.CACHE_KEY = {
        LICENSE: 'VC_LICENSE',
        MAIN_CONFIG: 'VC_MAIN_CONFIG',
        VENDOR_CONFIG: 'VC_VENDOR_CONFIG',
        BILLCREATE_CONFIG: 'VC_BILLCREATE_CONFIG',
        SENDPOVND_CONFIG: 'VC_SENDPOVND_CONFIG',
        PO_DATA: 'VC_PODATA'
    };

    VC2_CONSTANT.LICENSE = {
        URL: 'https://nscatalystserver.azurewebsites.net/productauth.php',
        PRODUCT_CODE: 2,
        MAX_RETRY: 3,
        KEY: 'LICENSE_KEY.20241030.02',
        CACHE_NAME: VC2_CONSTANT.CACHE_NAME, //'VC_LICENSE',
        CACHE_TTL: 86400 // 24 hrs
    };

    VC2_CONSTANT.FIELD_TO_SEARCH_COLUMN_MAP = {
        TRANSACTION: {
            vendorname: {
                name: 'vendorcode',
                join: 'item'
            }
        }
    };

    return VC2_CONSTANT;
});
