//*************************************************************************
//*  Description:
//*     Suitelet that displays list of serial numbers for the transaction
//*     and item that is passed in
//*************************************************************************

/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record', 'N/url', './VC_Globals', './VC_SN_Library'],
    function(ui, log, search, rec, url, vcGlobals, vcsnLib) {

        const SUBLIST_ID = 'custpage_orders';

        function onRequest(context) {
            if (context.request.method == 'GET') {
                doGet (context);
            } else if (context.request.method == 'POST') {
                doPost (context);
            }
        }

        function doGet(context) {

            //log.debug('params', JSON.stringify(context.request.parameters))
            var params = context.request.parameters;
            log.debug ("params", JSON.stringify(params))


            var tType, poNum="N/A", soNum="N/A", itemNum="N/A", fulNum="N/A", itemName="N/A", transId="N/A", invNum="N/A", vendorRMANum="N/A", custRMANum="N/A";
            
            if (params.transType) {
                if (!isEmpty(params.transId)){
                	var lookup = search.lookupFields({
                		type: 'transaction',
                		id: params.transId,
                		columns: ['tranid', 'createdfrom']
                	});
//                    var transObj = rec.load({
//                        type: params.transType,
//                        id: params.transId
//                    })    
                	var lookup = search.lookupFields({
                		type: 'transaction',
                		id: params.transId,
                		columns: ['tranid', 'createdfrom']
                	});
                    itemName = decodeURIComponent(params.itemName);
                    itemNum = params.itemId;
                    
                    if(params.transType == rec.Type.PURCHASE_ORDER) {
//                        poNum = transObj.getText('tranid');
//                        soNum = transObj.getText('createdfrom');
                    	poNum = lookup.tranid;
                        if (lookup.createdfrom[0])
                        	soNum = lookup.createdfrom[0].text;
                        tType = "Purchase Order";     
                        transId = poNum;    
                    }
                    if(params.transType == rec.Type.SALES_ORDER) {
//                        soNum = transObj.getText('tranid');
                    	soNum = lookup.tranid;
                        tType = "Sales Order"    
                        transId = soNum;     
                    }
                    if(params.transType == rec.Type.ITEM_FULFILLMENT) {
//                        fulNum = transObj.getText('tranid');
//                        soNum = transObj.getText('createdfrom');
                    	fulNum = lookup.tranid;
                    	if (lookup.createdfrom[0])
                    		soNum = lookup.createdfrom[0].text;
                        tType = "Item Fulfillment"    
                        transId = fulNum;     
                    }
                    if(params.transType == rec.Type.INVOICE) {
//                        invNum = transObj.getText('tranid');
//                        soNum = transObj.getText('createdfrom');
                    	invNum = lookup.tranid;
                    	if (lookup.createdfrom[0])
                    		soNum = lookup.createdfrom[0].text;
                        tType = "Invoice"    
                        transId = invNum;     
                    }
                    if(params.transType == rec.Type.RETURN_AUTHORIZATION) {
//                        custRMANum = transObj.getText('tranid');
                    	custRMANum = lookup.tranid;
                        tType = "Customer RMA"    
                        transId = custRMANum;     
                    }
                    if(params.transType == rec.Type.VENDOR_RETURN_AUTHORIZATION) {
//                        vendorRMANum = transObj.getText('tranid');
                    	vendorRMANum = lookup.tranid;
                        tType = "Vendor RMA"    
                        transId = vendorRMANum;     
                    }
                        
                }
                else {
                    tType = "ERROR - Transaction ID not found. Re-save source transaction and re-try SN Link";
                    transId = 0; 
                }

            } else {
                poNum = params.ponum;
                soNum = params.sonum;    
                transId = poNum; 
                itemNum = params.itemid
                tType = "Purchase Order";
            }

            var form = ui.createForm({
                title: 'View Serial Numbers'
            })
            var maingroup = form.addFieldGroup({
                id : 'maingroup',
                label : 'Primary Information'
            });
            maingroup.isSingleColumn = true;

//            form.clientScriptModulePath = './VC_View_Serials_Library.js';

            /*
                        form.addSubmitButton({
                            label: 'Save Serials'
                        });
            */

            var itemNameField = form.addField({
                id: 'custpage_itemname',
                type: ui.FieldType.TEXT,
                label: 'Item:',
                container: 'maingroup'
            });
            itemNameField.defaultValue =  itemName;
            itemNameField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});

            if (poNum && poNum != 'N/A') {
	            var poNumField = form.addField({
	                id: 'custpage_ponum',
	                type: ui.FieldType.TEXT,
	                label: 'PO Number:',
	                container: 'maingroup'
	            });
	            poNumField.defaultValue = poNum;
	            poNumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }

            if (soNum && soNum != 'N/A') {
	            var soNumField = form.addField({
	                id: 'custpage_sonum',
	                type: ui.FieldType.TEXT,
	                label: 'SO Number:',
	                container: 'maingroup'
	            });
	            soNumField.defaultValue = soNum;
	            soNumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }

            if (fulNum && fulNum != 'N/A') {
	            var fulNumField = form.addField({
	                id: 'custpage_fulnum',
	                type: ui.FieldType.TEXT,
	                label: 'Fulfillment Number:',
	                container: 'maingroup'
	            });
	            fulNumField.defaultValue = fulNum;
	            fulNumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }
            
            if (invNum && invNum != 'N/A') {
	            var invNumField = form.addField({
	                id: 'custpage_invnum',
	                type: ui.FieldType.TEXT,
	                label: 'Invoice  Number:',
	                container: 'maingroup'
	            });
	            invNumField.defaultValue = invNum;
	            invNumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }

            if (custRMANum && custRMANum != 'N/A') {
	            var custRMANumField = form.addField({
	                id: 'custpage_rmanum',
	                type: ui.FieldType.TEXT,
	                label: 'Customer RMA Number:',
	                container: 'maingroup'
	            });
	            custRMANumField.defaultValue = custRMANum;
	            custRMANumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }

            if (vendorRMANum && vendorRMANum != 'N/A') {
	            var vendorRMANumField = form.addField({
	                id: 'custpage_vrmanum',
	                type: ui.FieldType.TEXT,
	                label: 'Vendor RMA Number:',
	                container: 'maingroup'
	            });
	            vendorRMANumField.defaultValue = vendorRMANum;
	            vendorRMANumField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
            }

            var typeField = form.addField({
                id: 'custpage_transtype',
                type: ui.FieldType.TEXT,
                label: 'Type:',
                container: 'maingroup'
            });
            typeField.defaultValue = tType;
            typeField.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});

            // don't search for SN's if there was an error
            var snList = null;
            log.debug("View SNs", "tType = "+tType)
            if (tType.indexOf("ERROR") < 0){
//                snList = vcsnLib.getItemSNList(transId, itemNum, tType).split(",");
            	snList = vcsnLib.getItemSNList(transId, itemNum, tType);
            }
            log.debug("View SNs", "snList = "+JSON.stringify(snList))

            var itemSublist = form.addSublist({
                id: 'custpage_itemsublist',
                type: ui.SublistType.LIST,
                label: 'Items'
            });
            var snField = itemSublist.addField({
                id: 'custpage_serialtext',
                type: ui.FieldType.TEXT,
                label: 'Serial'
            });


            if (!isEmpty(snList)) {
                for (var i = 0; i < snList.length; i++) {
                    if (snList[i].snId > 0){
                    	var url = _generateLink({
                    		recId: snList[i].snId,
                    		snNum: snList[i].snNum
                    	});
                        itemSublist.setSublistValue({
                            id: 'custpage_serialtext',
                            line: i,
//                            value: snList[i]
                            value: url
                        });
                    }
                }
            }

            context.response.writePage(form);

        }
        
        function _generateLink(options) {
        	var recId = options.recId;
        	var snNum = options.snNum;
        	var protocol = 'https://';
        	var domain = url.resolveDomain({
        	    hostType: url.HostType.APPLICATION
        	});
        	var linkUrl = url.resolveRecord({
        		recordType: 'customrecordserialnum',
        		recordId: recId,
        		isEditMode: false
        	});
        	
        	var link = '<a href="'+protocol+domain+linkUrl+'">'+snNum+'</a>';
        	
        	return link;
        }

        function doPost (context){
            var request = context.request;

         }



        function isEmpty (stValue)
        {
            if ((stValue === '') || (stValue == null) || (stValue == undefined))
            {
                return true;
            }
            else
            {
                if (typeof stValue == 'string')
                {
                    if ((stValue == ''))
                    {
                        return true;
                    }
                }
                else if (typeof stValue == 'object')
                {
                    if (stValue.length == 0 || stValue.length == 'undefined')
                    {
                        return true;
                    }
                }

                return false;
            }
        }


        function isEven(n) {
            return n % 2 == 0;
        }

        return {
            onRequest: onRequest
        };
    });