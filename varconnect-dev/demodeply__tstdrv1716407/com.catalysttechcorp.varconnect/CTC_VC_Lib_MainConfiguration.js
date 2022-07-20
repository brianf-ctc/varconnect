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

/**
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		July 25, 2019	paolodl		Library for retrieving Main Configuration record
 *
 */
define(['N/search', './VC_Globals', './CTC_VC_Constants.js'], function (
    search,
    globals,
    constants
) {
    var mainConfigFields = [
        constants.Fields.MainConfig.ID, //0
        constants.Fields.MainConfig.SCHEDULED_FULFILLMENT_TEMPLATE, //1
        constants.Fields.MainConfig.SCHEDULED_FULFILLMENT_SENDER, //2
        constants.Fields.MainConfig.SERIAL_NO_FOLDER_ID, //3
        constants.Fields.MainConfig.PROCESS_DROPSHIPS, //4
        constants.Fields.MainConfig.PROCESS_SPECIAL_ORDERS, //5
        constants.Fields.MainConfig.CREATE_ITEM_FULFILLMENTS, //6
        constants.Fields.MainConfig.CREATE_ITEM_RECEIPTS, //7
        constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_DROPSHIPS, //8
        constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS, //9
        constants.Fields.MainConfig.CREATE_SERIAL_DROPSHIPS, //10
        constants.Fields.MainConfig.CREATE_SERIAL_SPECIAL_ORDERS, //11
        constants.Fields.MainConfig.USE_INB_TRACKING_SPECIAL_ORDERS, //12
        constants.Fields.MainConfig.LICENSE, //13
        constants.Fields.MainConfig.COPY_SERIALS_INV, //14
        constants.Fields.MainConfig.SERIAL_SCAN_UPDATE, //15
        constants.Fields.MainConfig.INV_PRINT_SERIALS, //16
        constants.Fields.MainConfig.PRINT_SERIALS_TEMPLATE, //17
        constants.Fields.MainConfig.MULTIPLE_INGRAM, //18
        constants.Fields.MainConfig.INGRAM_HASH_TO_SPACE, //19
        constants.Fields.MainConfig.FULFILMENT_SEARCH, //20,
        constants.Fields.MainConfig.DEFAULT_BILL_FORM, //21
        constants.Fields.MainConfig.DEFAULT_VENDOR_BILL_STATUS, //22
        constants.Fields.MainConfig.ALLOWED_VARIANCE_AMOUNT_THRESHOLD, //23
        constants.Fields.MainConfig.VARIANCE_ON_TAX, //24
        constants.Fields.MainConfig.DEFAULT_TAX_ITEM, //25
        constants.Fields.MainConfig.DEFAULT_TAX_ITEM2, //25
        constants.Fields.MainConfig.VARIANCE_ON_SHIPPING, //26
        constants.Fields.MainConfig.DEFAULT_SHIPPING_ITEM, //27
        constants.Fields.MainConfig.VARIANCE_ON_OTHER, //29
        constants.Fields.MainConfig.DEFAULT_OTHER_ITEM, //30
        constants.Fields.MainConfig.DISABLE_VENDOR_BILL_CREATION //31
    ];

    function _generateMainConfig(recLookup) {
        return {
            id: recLookup[mainConfigFields[0]],
            emailTemplate: recLookup[mainConfigFields[1]],
            emailSender: recLookup[mainConfigFields[2]],
            serialNoFolder: recLookup[mainConfigFields[3]],
            processDropships: recLookup[mainConfigFields[4]],
            processSpecialOrders: recLookup[mainConfigFields[5]],
            createIF: recLookup[mainConfigFields[6]],
            createIR: recLookup[mainConfigFields[7]],
            ignoreDirectShipDropship: recLookup[mainConfigFields[8]],
            ignoreDirectShipSpecialOrder: recLookup[mainConfigFields[9]],
            createSerialDropship: recLookup[mainConfigFields[10]],
            createSerialSpecialOrder: recLookup[mainConfigFields[11]],
            useInboundTrackingNumbers: recLookup[mainConfigFields[12]],
            license: recLookup[mainConfigFields[13]],
            copySerialsInv: recLookup[mainConfigFields[14]],
            serialScanUpdate: recLookup[mainConfigFields[15]],
            invPrintSerials: recLookup[mainConfigFields[16]],
            printSerialsTemplate: recLookup[mainConfigFields[17]],
            multipleIngram: recLookup[mainConfigFields[18]],
            ingramHashSpace: recLookup[mainConfigFields[19]],
            fulfillmentSearch: recLookup[mainConfigFields[20]],
            defaultBillForm: recLookup[mainConfigFields[21]],
            defaultVendorBillStatus: recLookup[mainConfigFields[22]],
            allowedVarianceAmountThreshold: recLookup[mainConfigFields[23]],
            isVarianceOnTax: recLookup[mainConfigFields[24]],
            defaultTaxItem: recLookup[mainConfigFields[25]],
            defaultTaxItem2: recLookup[mainConfigFields[26]],
            isVarianceOnShipping: recLookup[mainConfigFields[27]],
            defaultShipItem: recLookup[mainConfigFields[28]],
            isVarianceOnOther: recLookup[mainConfigFields[29]],
            defaultOtherItem: recLookup[mainConfigFields[30]],
            isBillCreationDisabled: recLookup[mainConfigFields[31]]
        };
    }

    function getMainConfiguration() {
        var result = {};

        var recLookup = search.lookupFields({
            type: constants.Records.MAIN_CONFIG,
            id: 1,
            columns: mainConfigFields
        });

        if (recLookup) {
            result = _generateMainConfig(recLookup);
        }

        return result;
    }

    return {
        getMainConfiguration: getMainConfiguration
    };
});
