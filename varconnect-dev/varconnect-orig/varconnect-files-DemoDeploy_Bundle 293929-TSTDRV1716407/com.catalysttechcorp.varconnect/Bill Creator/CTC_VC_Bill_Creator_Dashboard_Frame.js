function dashboard(portlet) {
    portlet.setTitle('Bill Creator - Dashboard');
    var content = '<iframe src="/app/site/hosting/scriptlet.nl?script=customscriptctc_vc_bill_creator_db&deploy=customdeploy_ctc_vc_dashboard" width="100%" height="820" style="margin:0px; border:0px; padding:0px"></iframe>';
    portlet.setHtml(content);
}