/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
function dashboard(portlet) {
    portlet.setTitle('Bill Creator - Dashboard');
    var content =
        '<iframe src="/app/site/hosting/scriptlet.nl?script=customscriptctc_vc_bill_creator_db&deploy=customdeploy_ctc_vc_dashboard" width="100%" height="820" style="margin:0px; border:0px; padding:0px"></iframe>';
    portlet.setHtml(content);
}
