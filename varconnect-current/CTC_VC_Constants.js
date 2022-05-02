/**
 * Copyright (c) 2017 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */

define([], function () {
    var VC_CONSTANTS = {
        Records: {
            MAIN_CONFIG: 'customrecord_ctc_vc_main_config',
            VENDOR_CONFIG: 'customrecord_ctc_vc_vendor_config',
            VC_LOG: 'customrecord_ctc_vcsp_log',
            SERIALS: 'customrecordserialnum'
        },
        Fields: {
            MainConfig: {
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
                FULFILMENT_SEARCH: 'custrecord_ctc_vc_sch_if_search'
            },
            VendorConfig: {
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
            },
            VarConnectLog: {
                ID: 'internalid',
                APPLICATION: 'custrecord_ctc_vcsp_log_app',
                HEADER: 'custrecord_ctc_vcsp_log_header',
                BODY: 'custrecord_ctc_vcsp_log_body',
                TRANSACTION: 'custrecord_ctc_vcsp_log_transaction',
                STATUS: 'custrecord_ctc_vcsp_log_status',
                DATE: 'custrecord_ctc_vcsp_log_date'
            },
            Transaction: {
                SEND_SHIPPING_UPDATE_TO: 'custbody_ctc_vc_email_shipping_info'
            },
            Serials: {
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
            },
            Item: {
                DH_MPN: 'custitem_ctc_vc_dh_item'
            }
        },
        Columns: {
            INBOUND_TRACKING_NUM: 'custcol_ctc_xml_inb_tracking_num',
            SERIAL_NUMBER_SCAN: 'custcol_ctc_serial_number_scan',
            SERIAL_NUMBER_UPDATE: 'custcol_ctc_serial_number_update',
            DH_MPN: 'custcol_ctc_vc_dh_mpn'
        },
        Lists: {
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
                DELL_API: '15'
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
        },
        Scripts: {
            Script: {
                VIEW_SERIALS_SL: 'customscript_vc_view_serials',
                LICENSE_VALIDATOR_SL: 'customscript_ctc_vc_sl_licensevalidator',
                PRINT_SERIALS_SL: 'customscript_ctc_vc_sl_print_serial',
                SERIAL_UPDATE_MR: 'customscript_ctc_vc_mr_serial_manip',
                SERIAL_UPDATE_ALL_MR: 'customscript_ctc_vc_mr_serial_manip_so'
            },
            Deployment: {
                VIEW_SERIALS_SL: 'customdeploy_vc_view_serials',
                LICENSE_VALIDATOR_SL: 'customdeploy_ctc_vc_sl_licensevalidator',
                PRINT_SERIALS_SL: 'customdeploy_ctc_vc_sl_print_serial'
            }
        },
        LOG_APPLICATION: 'VAR Connect'
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
        ITEMS_ALREADY_BILLED: {
            code: 'ITEMS_ALREADY_BILLED',
            msg: 'Items are already billed. ',
            status: Bill_Creator.Status.CLOSED
        },
        EXISTING_BILLS: {
            code: 'EXISTING_BILLS',
            msg: 'Linked to existing Bill. ',
            status: Bill_Creator.Status.CLOSED
        },
        HAS_VARIANCE: {
            code: 'HAS_VARIANCE',
            msg: 'One or More Variances in Vendor Bill.',
            status: Bill_Creator.Status.VARIANCE
        },
        BILL_CREATED: {
            code: 'BILL_CREATED',
            msg: 'Created Vendor Bill. ',
            status: Bill_Creator.Status.PROCESSED
        },
        BILL_NOT_CREATED: {
            code: 'BILL_NOT_CREATED',
            msg: 'Failed to create the Vendor Bill. ',
            status: Bill_Creator.Status.ERROR
        },
        BILL_CREATE_DISABLED: {
            code: 'BILL_CREATE_DISABLED',
            msg: 'Vendor Bill creation is disabled. ',
            status: Bill_Creator.Status.PENDING
        }
    };


    VC_CONSTANTS.Bill_Creator = Bill_Creator;
    return VC_CONSTANTS;
});
