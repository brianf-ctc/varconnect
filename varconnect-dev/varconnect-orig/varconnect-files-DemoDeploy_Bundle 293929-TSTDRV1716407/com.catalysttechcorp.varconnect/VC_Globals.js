define(['N/error', 'N/runtime', 'N/url', './CTC_VC_Constants.js'], function (
    error,
    runtime,
    url,
    constants
) {
    function generateLink(params) {
        var link = url.resolveScript({
            scriptId: constants.Scripts.VIEW_SERIALS_SL,
            params: params
        });
    }

    return {
        ENABLE_SUBSIDIARIES: runtime.isFeatureInEffect({ feature: 'subsidiaries' }),
        PICK_PACK_SHIP: runtime.isFeatureInEffect({ feature: 'pickpackship' }),
        COUNTRY: runtime.country,
        SN_VIEW_SL_URL: generateLink,
        SN_LINE_FIELD_LINK_ID: 'custcol_ctc_xml_serial_num_link',
        ITEM_ID_LOOKUP_COL: 'item',
        ITEM_FUL_ID_LOOKUP_COL: 'itemname',
        VENDOR_SKU_LOOKUP_COL: 'item',
        //            ENABLE_SUBSIDIARIES: false,

        SN_FOLDER_ID: 7,
        EMAIL_TEMPLATE_ID: 220, // Var Connect Shipping Confirmation Template

        POHANDLING: 'Drop', // Special | Drop (default) | Both
        EMAIL_LIST_FIELD_ID: 'custbody_ctc_email_shipping_info_1'
    };
});
