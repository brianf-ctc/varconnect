define([],

function() {
    return {
    	Records: {
    		VENDOR_CONFIG:				'customrecord_ctc_vcsp_vendor_config',
    		MAIN_CONFIG:				'customrecord_ctc_vcsp_main_config',
    		VC_LOG:						'customrecord_ctc_vcsp_log'
    	},
        Fields: {
        	VendorConfig: {
        		ID: 					'internalid',
        		SUBSIDIARY: 			'custrecord_ctc_vcsp_vendor_subsidiary',
        		API_VENDOR: 			'custrecord_ctc_vcsp_api_vendor',
        		VENDOR: 				'custrecord_ctc_vcsp_vendor',
        		WEBSERVICE_ENDPOINT: 	'custrecord_ctc_vcsp_endpoint',
        		ACCESS_ENDPOINT:		'custrecord_ctc_vcsp_access_endpoint',
        		USERNAME: 				'custrecord_ctc_vcsp_username',
        		PASSWORD: 				'custrecord_ctc_vcsp_password',
        		CUSTOMER_NO: 			'custrecord_ctc_vcsp_customer_number',
        		API_KEY:				'custrecord_ctc_vcsp_api_key',
        		API_SECRET:				'custrecord_ctc_vcsp_api_secret',
        		SKU_COLUMN:				'custrecord_ctc_vcsp_ven_itemcol',
        		TEST_REQUEST:			'custrecord_ctc_vcsp_test',
        		QA_WEBSERVICE_ENDPOINT: 'custrecord_ctc_vcsp_endpoint',
        		QA_ACCESS_ENDPOINT:		'custrecord_ctc_vcsp_access_endpoint',
        		QA_API_KEY:				'custrecord_ctc_vcsp_api_key',
        		QA_API_SECRET:			'custrecord_ctc_vcsp_api_secret',
        		Bill: {
        			ADDRESSEE:			'custrecord_ctc_vcsp_bill_addressee',
        			ATTENTION:			'custrecord_ctc_vcsp_bill_attention',
        			ADDRESS_1:			'custrecord_ctc_vcsp_bill_addr1',
        			ADDRESS_2:			'custrecord_ctc_vcsp_bill_addr2',
        			CITY:				'custrecord_ctc_vcsp_bill_city',
        			STATE:				'custrecord_ctc_vcsp_bill_state',
        			ZIP:				'custrecord_ctc_vcsp_bill_zip',
        			COUNTRY:			'custrecord_ctc_vcsp_bill_country',
        			EMAIL:				'custrecord_ctc_vcsp_bill_email'
        		}
        	},
        	MainConfig: {
        		ID: 					'internalid',
        		LICENSE:				'custrecord_ctc_vcsp_license',
        		LICENSE_TEXT:			'custrecord_ctc_vcsp_license_text'
        	},
        	VarConnectLog: {
        		ID:						'internalid',
        		APPLICATION:			'custrecord_ctc_vcsp_log_app',
        		HEADER:					'custrecord_ctc_vcsp_log_header',
        		BODY:					'custrecord_ctc_vcsp_log_body',
        		TRANSACTION:			'custrecord_ctc_vcsp_log_transaction',
        		STATUS:					'custrecord_ctc_vcsp_status'
        	}
        },
        Lists: {
        	API_VENDOR: {
        		DELL: 					'1',
        		ARROW: 					'2',
        		SYNNEX:					'3'
        	},
        	VC_LOG_STATUS: {
        		SUCCESS:				'1',
        		ERROR:					'2',
        		INFO:					'3'
        	},
        	DELL_SHIPPING_CODE: {
        		NORMAL: '1',
        		TWO_DAY: '2',
        		NEXT_DAY: '3'
        	}
        },
        Scripts: {
        	Script: {
        		SEND_PO_SL: 			'customscript_ctc_vcsp_sl_sendpo',
        		LICENSE_VALIDATOR_SL:	'customscript_ctc_vcsp_sl_licensevalidate'
        	},
        	Deployment: {
        		SEND_PO_SL: 			'customdeploy_ctc_vcsp_sl_sendpo',
        		LICENSE_VALIDATOR_SL:	'customdeploy_ctc_vcsp_sl_licensevalidate'
        	}
        },
        LOG_APPLICATION: 'VAR Connect Send PO'
    };
});