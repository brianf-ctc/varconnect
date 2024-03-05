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

    var VC_CONSTANTS = {
        LOG_APPLICATION: 'VAR Connect'
    };

    VC_CONSTANTS.RECORD = {
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
                VARIANCE_ON_TAX: 'custrecord_ctc_vc_bill_tax_var',
                DEFAULT_TAX_ITEM: 'custrecord_ctc_vc_bill_tax_item',
                DEFAULT_TAX_ITEM2: 'custrecord_ctc_vc_bill_tax_item2',
                VARIANCE_ON_SHIPPING: 'custrecord_ctc_vc_bill_ship_var',
                DEFAULT_SHIPPING_ITEM: 'custrecord_ctc_vc_bill_ship_item',
                VARIANCE_ON_OTHER: 'custrecord_ctc_vc_bill_other_var',
                DEFAULT_OTHER_ITEM: 'custrecord_ctc_vc_bill_other_item',
                DISABLE_VENDOR_BILL_CREATION: 'custrecord_ctc_vc_bill_is_disabled', 
                OVERRIDE_PO_NUM: 'custrecord_ctc_vc_override_po_num'
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
                XML_REQUEST: 'custrecord_ctc_vc_xml_req',
                PROCESS_DROPSHIPS: 'custrecord_ctc_vc_process_dropship_vend',
                PROCESS_SPECIAL_ORDERS: 'custrecord_ctc_vc_process_spec_ord_vend',
                FULFILLMENT_PREFIX: 'custrecord_ctc_vc_prefix',
                ACCESS_ENDPOINT: 'custrecord_ctc_vc_access_endpoint',
                API_KEY: 'custrecord_ctc_vc_api_key',
                API_SECRET: 'custrecord_ctc_vc_api_secret',
                OATH_SCOPE: 'custrecord_ctc_vc_oath_scope'
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
        BILLFILE: {
            ID: 'customrecord_ctc_vc_bills',
            FIELD: {
                ID: 'id',
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
        }
    };

    VC_CONSTANTS.FIELD = {
        ITEM: {
            DH_MPN: 'custitem_ctc_vc_dh_item'
        },
        TRANSACTION: {
            INBOUND_TRACKING_NUM: 'custcol_ctc_xml_inb_tracking_num',
            SERIAL_NUMBER_SCAN: 'custcol_ctc_serial_number_scan',
            SERIAL_NUMBER_UPDATE: 'custcol_ctc_serial_number_update',
            DH_MPN: 'custcol_ctc_vc_dh_mpn',
            SEND_SHIPPING_UPDATE_TO: 'custbody_ctc_vc_email_shipping_info', 
            OVERRIDE_PONUM: 'custbody_ctc_vc_override_ponum'
        }
    };

    VC_CONSTANTS.LIST = {
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
            SCANSOURCE: '14'
        },
        VC_LOG_STATUS: {
            SUCCESS: '1',
            ERROR: '2',
            INFO: '3'
        },
        COUNTRY: {
            US: '1',
            CANADA: '2'
        }
    };
    VC_CONSTANTS.SCRIPT = {};

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
            status: Bill_Creator.Status.ERROR
        },
        NOT_BILLABLE: {
            code: 'NOT_BILLABLE',
            msg: 'PO is not ready for billing. ',
            status: Bill_Creator.Status.PENDING
        },
        NOT_FULLY_PROCESSED: {
            code: 'NOT_FULLY_PROCESSED',
            msg: 'Could not fully process Bill File. ',
            status: Bill_Creator.Status.ERROR
        },
        INSUFFICIENT_QUANTITY: {
            code: 'INSUFFICIENT_QUANTITY',
            msg: 'PO Qty is insufficient for the bill.',
            status: Bill_Creator.Status.ERROR
        },
        FULLY_BILLED: {
            code: 'FULLY_BILLED',
            msg: 'PO is Fully Billed',
            status: Bill_Creator.Status.CLOSED
        },
        ITEMS_ALREADY_BILLED: {
            code: 'ITEMS_ALREADY_BILLED',
            msg: 'Items are already billed',
            status: Bill_Creator.Status.CLOSED
        },
        EXISTING_BILLS: {
            code: 'EXISTING_BILLS',
            msg: 'Linked to existing Bill.',
            status: Bill_Creator.Status.CLOSED
        },
        HAS_VARIANCE: {
            code: 'HAS_VARIANCE',
            msg: 'One or More Variances in Vendor Bill.',
            status: Bill_Creator.Status.VARIANCE
        },
        BILL_CREATED: {
            code: 'BILL_CREATED',
            msg: 'Created Vendor Bill',
            status: Bill_Creator.Status.PROCESSED
        },
        BILL_NOT_CREATED: {
            code: 'BILL_NOT_CREATED',
            msg: 'Failed to create the Vendor Bill',
            status: Bill_Creator.Status.PENDING
        },
        BILL_CREATE_DISABLED: {
            code: 'BILL_CREATE_DISABLED',
            msg: 'Vendor Bill creation is disabled',
            status: Bill_Creator.Status.PENDING
        }
    };

    VC_CONSTANTS.Bill_Creator = Bill_Creator;

    VC_CONSTANTS.GLOBAL = {
        ENABLE_SUBSIDIARIES: ns_runtime.isFeatureInEffect({ feature: 'subsidiaries' }),
        PICK_PACK_SHIP: ns_runtime.isFeatureInEffect({ feature: 'pickpackship' }),
        COUNTRY: ns_runtime.country,
        SN_LINE_FIELD_LINK_ID: 'custcol_ctc_xml_serial_num_link',
        ITEM_ID_LOOKUP_COL: 'item',
        ITEM_FUL_ID_LOOKUP_COL: 'itemname',
        VENDOR_SKU_LOOKUP_COL: 'item',
        SN_FOLDER_ID: 7,
        EMAIL_TEMPLATE_ID: 220, // Var Connect Shipping Confirmation Template
        POHANDLING: 'Drop', // Special | Drop (default) | Both
        EMAIL_LIST_FIELD_ID: 'custbody_ctc_email_shipping_info_1'
    };
    
    return VC_CONSTANTS;
});
