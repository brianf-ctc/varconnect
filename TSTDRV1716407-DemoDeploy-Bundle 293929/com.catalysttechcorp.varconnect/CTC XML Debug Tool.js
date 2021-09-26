/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define([
    "N/ui/serverWidget",
    "N/email",
    "N/runtime",
    "N/log"],
    function (
        ui,
        email,
        runtime,
        log) {
            
    function onRequest(context) {
        if (context.request.method === "GET") {
            var form = ui.createForm({
                title: "VAR Connect Admin | XML Debug Tool",
            });
            form.clientScriptModulePath = "./CTC_VC_Lib_Debug_Tool.js";

            var fgFieldId = 'custpage_fldgroup';
            var fgField = form.addFieldGroup({
                id:fgFieldId,
                label: 'XML Debug Tool', 
            });
            fgField.isBorderHidden = true;
            // fgField.isSingleColumn = true;
            

            var vendors = form.addField({
                id: "vendors",
                type: ui.FieldType.SELECT,
                source: "customlist_ctc_xml_vendor_list",
                label: "Select a Vendor",
                container: fgFieldId
            });
            vendors.isMandatory = true;

            var subject = form.addField({
                id: "ponum",
                type: ui.FieldType.TEXT,
                label: "Enter PO Number",
                container: fgFieldId
            });
            subject.isMandatory = true;
            // subject.layoutType = ui.FieldLayoutType.NORMAL;
            // subject.breakType = ui.FieldBreakType.STARTCOL;

            var country = form.addField({
                id: "country",
                type: ui.FieldType.SELECT,
                source: "customlist_ctc_vc_debug_country",
                label: "Select Country",
                container: fgFieldId
            });

            
            // var message = form.addField({
                //     id: "message",
                //     type: ui.FieldType.TEXTAREA,
                //     label: "Retrieved Order Status XML",
                //     container: fgFieldId
                // });
                // message.displaySize = {
                    //     width: 60,
                    //     height: 100,
                    // };
                    // message.updateDisplayType({
                        //     displayType: 'INLINE'
                        // });
                        // form.updateDefaultValues({
                            //     message: "Sample XML Text Goes Here",
                            // });

            var msgBox = form.addField({
                id: 'messagebox', 
                type: ui.FieldType.INLINEHTML, 
                label: 'Message Box', 
                container: fgFieldId
            });

            msgBox.updateBreakType({
                breakType: ui.FieldBreakType.STARTCOL
            })
            msgBox.defaultValue = [
                '<span class="smallgraytextnolink">Retrieved Order Status XML</span><br/>',
                '<div id="xml_msgbox" class="uir-custom-field"', 
                     'style="display: block; width: 50%; height: 200px; overflow:auto;', 
                            'background-color: #EEE;',
                            'font-family: monospace;font-size:8pt;',
                            'border:1px solid #CCC; line-height: 1.8em; margin: 10px 0; padding:10px;"> ... </div> ',
            ].join('');


            form.addButton({
                id: "getxml",
                label: "Display Data",
                functionName: "showVendorName",
            });

            context.response.writePage(form);
        } else {
            var request = context.request;
            var selectedVendor = request.parameters.vendors;
            context.response.write("Vendor Selected: " + selectedVendor);
        }
    }
    return {
        onRequest: onRequest,
    };
});
