/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/log'],
    function(ui, email, runtime, log) {
        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = ui.createForm({
                    title: 'XML Debug Tool 2'
                });
                form.clientScriptModulePath = './CTC_VC_Lib_Debug_Tool.js';
                
              var vendors = form.addField({
	              id: 'vendors',
	              type: ui.FieldType.SELECT,
	              source: 'customlist_ctc_xml_vendor_list',
	              label: 'Select a Vendor'
	          });
				
                vendors.isMandatory = true;
				
                var subject = form.addField({
                    id: 'ponum',
                    type: ui.FieldType.TEXT,
                    label: 'Enter PO Number'
                });
                subject.layoutType = ui.FieldLayoutType.NORMAL;
                subject.breakType = ui.FieldBreakType.STARTCOL;
                subject.isMandatory = true;
                
                var country = form.addField({
                	id: 'country',
					type: ui.FieldType.SELECT,
					source: 'customlist_ctc_vc_debug_country',
					label: 'Select Country'
                });
                subject.layoutType = ui.FieldLayoutType.NORMAL;
                subject.breakType = ui.FieldBreakType.STARTCOL;
                
                var message = form.addField({
                    id: 'message',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Retrieved Order Status XML'
                });
                message.displaySize = {
                    width: 60,
                    height: 100
                };
				form.updateDefaultValues ({
					message: 'Sample XML Text Goes Here'
				});
                form.addButton({
					id: 'getxml',
                    label: 'Display Data',
					functionName: 'showVendorName'
                });
				
                context.response.writePage(form);
            } else {
                var request = context.request;
				var selectedVendor = request.parameters.vendors;
				context.response.write('Vendor Selected: ' + selectedVendor);
            }
        }
        return {
            onRequest: onRequest
        };
    });