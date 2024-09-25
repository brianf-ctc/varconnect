/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
define([], function () {
    function Response(option) {
        this.logId = option.logId;
        this.status = option.status;
        this.message = option.message;
        this.transactionNum = option.transactionNum;
        this.orderStatus = option.orderStatus;
        this.responseBody = option.responseBody;
        this.responseCode = option.responseCode;
        this.isError =
            option.isError ||
            (function (option) {
                return (
                    option.status == 'error' ||
                    !option.responseCode ||
                    option.responseCode < 200 ||
                    option.responseCode >= 300
                );
            })(this);
        this.error = option.error;
        this.errorId = option.errorId;
        this.errorName = option.errorName;
        this.errorMsg = option.errorMsg;
    }

    return Response;
});
