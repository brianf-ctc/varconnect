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
    var mainConfigMap = {
        id: MainCFG.FIELD.ID,
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
    };

    function getMainConfiguration() {
        var logTitle = 'MainCFG';
        var result = {};

        var fldsMainConfig = [];
        for (var fld in mainConfigMap) {
            fldsMainConfig.push(mainConfigMap[fld]);
        }

        var mainConfigSearch = ns_search.create({
            type: MainCFG.ID,
            filters: [['isinactive', 'is', 'F']],
            columns: fldsMainConfig
        });

        var MainCFG = {};

        mainConfigSearch.run().each(function (row) {
            for (var fld in mainConfigMap) {
                var rowValue = row.getValue({ name: mainConfigMap[fld] });
                MainCFG[fld] = rowValue ? rowValue.value || rowValue : null;
            }
            return true;
        });
        return MainCFG;
    }

    return {
        getMainConfiguration: getMainConfiguration
    };
});
