/**
 * Copyright (c) 2025  sCatalyst Tech Corp
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
define((require) => {
    let ns_record = require('N/record'),
        ns_search = require('N/search');

    let lib_error = require('lib/ctc_lib_errors'),
        lib_util = require('lib/ctc_lib_utils'),
        lib_constant = require('lib/ctc_lib_constants');

    return {
        /**
         *  Attempts to match the given item to the vendorLine
         *
         * @param {*} option
         *   itemName, itemId (required)
         *   itemLineInfo (required)
         *   vendorLine, vendorItemd (required)
         *
         */
        itemMatching: (option) => {},
        itemMatchVendorCfg: (option) => {},
        itemMatchMainCfg: (option) => {},
        itemMatchFuzzy: (option) => {},
        itemMatchMapped: (option) => {},

        updateOrderLine: (option) => {},
        updateOrder: (option) => {},

        createFulfillment: (option) => {},
        createItemReceipt: (option) => {},

        // search open POs
        searchOpenOrders: function (option) {
            // auto-skip ByPass
        }

        //
    };
});
