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
define(['N/search', './CTC_VC2_Constants.js', './CTC_VC2_Lib_Utils'], function (ns_search, vc2_constant, vc2_util) {
    var MainCFG = vc2_constant.RECORD.MAIN_CONFIG;

    var mainConfigFields = [
        MainCFG.FIELD.ID, //0
        MainCFG.FIELD.SCHEDULED_FULFILLMENT_TEMPLATE, //1
        MainCFG.FIELD.SCHEDULED_FULFILLMENT_SENDER, //2
        MainCFG.FIELD.SERIAL_NO_FOLDER_ID, //3
        MainCFG.FIELD.PROCESS_DROPSHIPS, //4
        MainCFG.FIELD.PROCESS_SPECIAL_ORDERS, //5
        MainCFG.FIELD.CREATE_ITEM_FULFILLMENTS, //6
        MainCFG.FIELD.CREATE_ITEM_RECEIPTS, //7
        MainCFG.FIELD.IGNORE_DIRECT_SHIPS_DROPSHIPS, //8
        MainCFG.FIELD.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS, //9
        MainCFG.FIELD.CREATE_SERIAL_DROPSHIPS, //10
        MainCFG.FIELD.CREATE_SERIAL_SPECIAL_ORDERS, //11
        MainCFG.FIELD.USE_INB_TRACKING_SPECIAL_ORDERS, //12
        MainCFG.FIELD.LICENSE, //13
        MainCFG.FIELD.COPY_SERIALS_INV, //14
        MainCFG.FIELD.SERIAL_SCAN_UPDATE, //15
        MainCFG.FIELD.INV_PRINT_SERIALS, //16
        MainCFG.FIELD.PRINT_SERIALS_TEMPLATE, //17
        MainCFG.FIELD.MULTIPLE_INGRAM, //18
        MainCFG.FIELD.INGRAM_HASH_TO_SPACE, //19
        MainCFG.FIELD.FULFILMENT_SEARCH, //20,
        MainCFG.FIELD.DEFAULT_BILL_FORM, //21
        MainCFG.FIELD.DEFAULT_VENDOR_BILL_STATUS, //22
        MainCFG.FIELD.ALLOWED_VARIANCE_AMOUNT_THRESHOLD, //23
        MainCFG.FIELD.VARIANCE_ON_TAX, //24
        MainCFG.FIELD.DEFAULT_TAX_ITEM, //25
        MainCFG.FIELD.DEFAULT_TAX_ITEM2, //25
        MainCFG.FIELD.VARIANCE_ON_SHIPPING, //26
        MainCFG.FIELD.DEFAULT_SHIPPING_ITEM, //27
        MainCFG.FIELD.VARIANCE_ON_OTHER, //29
        MainCFG.FIELD.DEFAULT_OTHER_ITEM, //30
        MainCFG.FIELD.DISABLE_VENDOR_BILL_CREATION, //31,
        MainCFG.FIELD.OVERRIDE_PO_NUM
    ];

    var mainConfigMap = {
        id: MainCFG.FIELD.ID, //0
        emailTemplate: MainCFG.FIELD.SCHEDULED_FULFILLMENT_TEMPLATE, //1
        emailSender: MainCFG.FIELD.SCHEDULED_FULFILLMENT_SENDER, //2
        serialNoFolder: MainCFG.FIELD.SERIAL_NO_FOLDER_ID, //3
        processDropships: MainCFG.FIELD.PROCESS_DROPSHIPS, //4
        processSpecialOrders: MainCFG.FIELD.PROCESS_SPECIAL_ORDERS, //5
        createIF: MainCFG.FIELD.CREATE_ITEM_FULFILLMENTS, //6
        createIR: MainCFG.FIELD.CREATE_ITEM_RECEIPTS, //7
        ignoreDirectShipDropship: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_DROPSHIPS, //8
        ignoreDirectShipSpecialOrder: MainCFG.FIELD.IGNORE_DIRECT_SHIPS_SPECIAL_ORDERS, //9
        createSerialDropship: MainCFG.FIELD.CREATE_SERIAL_DROPSHIPS, //10
        createSerialSpecialOrder: MainCFG.FIELD.CREATE_SERIAL_SPECIAL_ORDERS, //11
        useInboundTrackingNumbers: MainCFG.FIELD.USE_INB_TRACKING_SPECIAL_ORDERS, //12
        license: MainCFG.FIELD.LICENSE, //13
        copySerialsInv: MainCFG.FIELD.COPY_SERIALS_INV, //14
        serialScanUpdate: MainCFG.FIELD.SERIAL_SCAN_UPDATE, //15
        invPrintSerials: MainCFG.FIELD.INV_PRINT_SERIALS, //16
        printSerialsTemplate: MainCFG.FIELD.PRINT_SERIALS_TEMPLATE, //17
        multipleIngram: MainCFG.FIELD.MULTIPLE_INGRAM, //18
        ingramHashSpace: MainCFG.FIELD.INGRAM_HASH_TO_SPACE, //19
        fulfillmentSearch: MainCFG.FIELD.FULFILMENT_SEARCH, //20,
        defaultBillForm: MainCFG.FIELD.DEFAULT_BILL_FORM, //21
        defaultVendorBillStatus: MainCFG.FIELD.DEFAULT_VENDOR_BILL_STATUS, //22
        allowedVarianceAmountThreshold: MainCFG.FIELD.ALLOWED_VARIANCE_AMOUNT_THRESHOLD, //23
        isVarianceOnTax: MainCFG.FIELD.VARIANCE_ON_TAX, //24
        defaultTaxItem: MainCFG.FIELD.DEFAULT_TAX_ITEM, //25
        defaultTaxItem2: MainCFG.FIELD.DEFAULT_TAX_ITEM2, //25
        isVarianceOnShipping: MainCFG.FIELD.VARIANCE_ON_SHIPPING, //26
        defaultShipItem: MainCFG.FIELD.DEFAULT_SHIPPING_ITEM, //27
        isVarianceOnOther: MainCFG.FIELD.VARIANCE_ON_OTHER, //29
        defaultOtherItem: MainCFG.FIELD.DEFAULT_OTHER_ITEM, //30
        isBillCreationDisabled: MainCFG.FIELD.DISABLE_VENDOR_BILL_CREATION, //31
        overridePONum: MainCFG.FIELD.OVERRIDE_PO_NUM
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
            type: MainCFG.ID,
            id: 1,
            columns: fldsMainConfig
        });

        if (recLookup) {
            result = _generateMainConfig(recLookup);
        }

        // log.audit('getMainConfiguration', result);
        return result;
    }

    return {
        getMainConfiguration: getMainConfiguration
    };
});
