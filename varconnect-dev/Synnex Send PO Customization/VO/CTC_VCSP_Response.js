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
define([], function () {
    function Response(options) {
        this.code = options.code;
        this.message = options.message;
        this.transactionNum = options.transactionNum;
        this.responseBody = options.responseBody;
        this.responseCode = options.responseCode;
        this.isError = options.isError || (function(options) {
            return (options.code == 'error' || !options.responseCode || options.responseCode < 200 || options.responseCode >= 300);
        })(this);
    }

    return Response;
});
