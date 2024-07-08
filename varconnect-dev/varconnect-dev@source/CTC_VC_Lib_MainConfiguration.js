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
define(['N/search', './VC_Globals', './CTC_VC_Constants.js', './CTC_VC2_Lib_Utils'], function (
    search,
    globals,
    constants,
    vc2_util
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

    var mainConfigMap = {
        id: constants.Fields.MainConfig.ID, //0
        emailTemplate: constants.Fields.MainConfig.SCHEDULED_FULFILLMENT_TEMPLATE, //1
        emailSender: constants.Fields.MainConfig.SCHEDULED_FULFILLMENT_SENDER, //2
        serialNoFolder: constants.Fields.MainConfig.SERIAL_NO_FOLDER_ID, //3
        processDropships: constants.Fields.MainConfig.PROCESS_DROPSHIPS, //4
        processSpecialOrders: constants.Fields.MainConfig.PROCESS_SPECIAL_ORDERS, //5
        createIF: constants.Fields.MainConfig.CREATE_ITEM_FULFILLMENTS, //6
        createIR: constants.Fields.MainConfig.CREATE_ITEM_RECEIPTS, //7
        ignoreDirectShipDropship: constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_DROPSHIPS, //8
        ignoreDirectShipSpecialOrder:
            constants.Fields.MainConfig.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS, //9
        createSerialDropship: constants.Fields.MainConfig.CREATE_SERIAL_DROPSHIPS, //10
        createSerialSpecialOrder: constants.Fields.MainConfig.CREATE_SERIAL_SPECIAL_ORDERS, //11
        useInboundTrackingNumbers: constants.Fields.MainConfig.USE_INB_TRACKING_SPECIAL_ORDERS, //12
        license: constants.Fields.MainConfig.LICENSE, //13
        copySerialsInv: constants.Fields.MainConfig.COPY_SERIALS_INV, //14
        serialScanUpdate: constants.Fields.MainConfig.SERIAL_SCAN_UPDATE, //15
        invPrintSerials: constants.Fields.MainConfig.INV_PRINT_SERIALS, //16
        printSerialsTemplate: constants.Fields.MainConfig.PRINT_SERIALS_TEMPLATE, //17
        multipleIngram: constants.Fields.MainConfig.MULTIPLE_INGRAM, //18
        ingramHashSpace: constants.Fields.MainConfig.INGRAM_HASH_TO_SPACE, //19
        fulfillmentSearch: constants.Fields.MainConfig.FULFILMENT_SEARCH, //20,
        defaultBillForm: constants.Fields.MainConfig.DEFAULT_BILL_FORM, //21
        defaultVendorBillStatus: constants.Fields.MainConfig.DEFAULT_VENDOR_BILL_STATUS, //22
        allowedVarianceAmountThreshold:
            constants.Fields.MainConfig.ALLOWED_VARIANCE_AMOUNT_THRESHOLD, //23
        isVarianceOnTax: constants.Fields.MainConfig.VARIANCE_ON_TAX, //24
        defaultTaxItem: constants.Fields.MainConfig.DEFAULT_TAX_ITEM, //25
        defaultTaxItem2: constants.Fields.MainConfig.DEFAULT_TAX_ITEM2, //25
        isVarianceOnShipping: constants.Fields.MainConfig.VARIANCE_ON_SHIPPING, //26
        defaultShipItem: constants.Fields.MainConfig.DEFAULT_SHIPPING_ITEM, //27
        isVarianceOnOther: constants.Fields.MainConfig.VARIANCE_ON_OTHER, //29
        defaultOtherItem: constants.Fields.MainConfig.DEFAULT_OTHER_ITEM, //30
        isBillCreationDisabled: constants.Fields.MainConfig.DISABLE_VENDOR_BILL_CREATION //31
    };

    function _generateMainConfig(recLookup) {
        var mainConfig = {};

        for (var fld in mainConfigMap) {
            var configValue = recLookup[mainConfigMap[fld]];
            mainConfig[fld] = configValue ? configValue.value || configValue : null;
        }

        return mainConfig;
    }

    // function _generateMainConfig_old(recLookup) {
    //     return {
    //         id: recLookup[mainConfigFields[0]],
    //         emailTemplate: recLookup[mainConfigFields[1]] || null,
    //         emailSender: recLookup[mainConfigFields[2]] || null,
    //         serialNoFolder: recLookup[mainConfigFields[3]] || null,
    //         processDropships: recLookup[mainConfigFields[4]] || false,
    //         processSpecialOrders: recLookup[mainConfigFields[5]] || false,
    //         createIF: recLookup[mainConfigFields[6]] || false,
    //         createIR: recLookup[mainConfigFields[7]] || false,
    //         ignoreDirectShipDropship: recLookup[mainConfigFields[8]] || false,
    //         ignoreDirectShipSpecialOrder: recLookup[mainConfigFields[9]] || false,
    //         createSerialDropship: recLookup[mainConfigFields[10]] || false,
    //         createSerialSpecialOrder: recLookup[mainConfigFields[11]] || false,
    //         useInboundTrackingNumbers: recLookup[mainConfigFields[12]] || false,
    //         license: recLookup[mainConfigFields[13]] || null,
    //         copySerialsInv: recLookup[mainConfigFields[14]] || false,
    //         serialScanUpdate: recLookup[mainConfigFields[15]] || false,
    //         invPrintSerials: recLookup[mainConfigFields[16]] || false,
    //         printSerialsTemplate: recLookup[mainConfigFields[17]] || null,
    //         multipleIngram: recLookup[mainConfigFields[18]] || false,
    //         ingramHashSpace: recLookup[mainConfigFields[19]] || null,
    //         fulfillmentSearch: recLookup[mainConfigFields[20]] || null,
    //         defaultBillForm: recLookup[mainConfigFields[21]] || null,
    //         defaultVendorBillStatus: recLookup[mainConfigFields[22]] || null,
    //         allowedVarianceAmountThreshold: recLookup[mainConfigFields[23]] || null,
    //         isVarianceOnTax: recLookup[mainConfigFields[24]] || false,
    //         defaultTaxItem: recLookup[mainConfigFields[25]] || null,
    //         defaultTaxItem2: recLookup[mainConfigFields[26]] || null,
    //         isVarianceOnShipping: recLookup[mainConfigFields[27]] || false,
    //         defaultShipItem: recLookup[mainConfigFields[28]] || null,
    //         isVarianceOnOther: recLookup[mainConfigFields[29]] || false,
    //         defaultOtherItem: recLookup[mainConfigFields[30]] || null,
    //         isBillCreationDisabled: recLookup[mainConfigFields[31]] || false
    //     };
    // }

    function getMainConfiguration() {
        var result = {};

        var fldsMainConfig = [];
        for (var fld in mainConfigMap) {
            fldsMainConfig.push(mainConfigMap[fld]);
        }

        var recLookup = vc2_util.flatLookup({
            type: constants.Records.MAIN_CONFIG,
            id: 1,
            columns: fldsMainConfig
        });

        if (recLookup) {
            result = _generateMainConfig(recLookup);
        }

        log.audit('getMainConfiguration', result);

        return result;
    }

    return {
        getMainConfiguration: getMainConfiguration
    };
});
