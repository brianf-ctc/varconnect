/**
 * Copyright (c) 2024  sCatalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.VarConnectPOLine.TYPE
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(function (require) {
    const LogTitle = 'SVC:WebSVC',
        LOG_APP = 'WebSVC';

    let lib_util = require('../lib/ctc_lib_util'),
        lib_global = require('../lib/ctc_lib_global'),
        lib_log = require('../lib/ctc_lib_vclogs');

    let vcs_configLib = require('./ctc_svclib_configlib.js');

    let ns_search = require('N/search'),
        ns_record = require('N/record');

    let lib_ingram = require('../vendor/ingram_lib');

    var Helper = {
        getVendorLibrary: function (option) {}
    };

    return {
        orderStatus: function (option) {},
        sendOrder: function (option) {},
        fetchInvoice: function (option) {}
    };
});
