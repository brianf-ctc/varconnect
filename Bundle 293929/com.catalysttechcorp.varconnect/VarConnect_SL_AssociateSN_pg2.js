//*************************************************************************
//*
//*************************************************************************

/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/log', 'N/search', 'N/record', 'N/http'],
    function(ui, email, runtime, log, search, rec, http) {

		const SUBLIST_ID = 'custpage_items';

		const PO_TRANSACTION_ID = 15;
		const ITEM_RECEIPT_TRANSACTION_ID = 16;
		const ITEM_FULFILLMENT_TRANSACTION_ID = 32;
		const RMA_TRANSACTION_ID = 33;
		const VENDOR_RMA_TRANSACTION_ID = 43;

		
        function onRequest(context) {
            if (context.request.method == 'GET') {
				doGet (context);
			} else if (context.request.method == 'POST') {
				doPost (context);
			}
		}
		
        function doGet(context) {
				// Trans type set on deployment parameter
				var scriptOrderType = runtime.getCurrentScript().getParameter({name: 'custscript8'})
				
				// trans num passed from Pg 1
				var scriptOrderNum = context.request.parameters["transnum"];

				var searchType = "";
				var filterType = "";
				var formTitle = ""
				var labelTransType = ""
					
				if (scriptOrderType == ITEM_FULFILLMENT_TRANSACTION_ID){
					searchType = "itemfulfillment"
					filterType = "ItemShip"
					formTitle = " to Item Fulfillment"
					labelTransType = "Item Fulfillment"
				}
				else if (scriptOrderType == RMA_TRANSACTION_ID){
					searchType = "returnauthorization"
					filterType = "RtnAuth"
					formTitle = " to RMA"
					labelTransType = "RMA"
				}
				else if (scriptOrderType == VENDOR_RMA_TRANSACTION_ID){
					searchType = "vendorreturnauthorization"
					filterType = "VendAuth"
					formTitle = " to Vendor RMA"
					labelTransType = "Vendor RMA"
				}
				
				if (isEmpty(searchType)) return

				log.debug("in doGet ", "filterType = "+filterType+" scriptOrderNum = "+scriptOrderNum);
				
				// Get the current transaction's ID and created from ID
				var itemfulfillmentSearchObj = search.create({
				   type: searchType,
				   filters:
				   [
						["type","anyof",filterType], 
						"AND", 
						["numbertext","is",scriptOrderNum], 
						"AND", 
						["mainline","is","T"]
					],
				   columns:
				   [
					  search.createColumn({name: "internalid", label: "Internal ID"}),
					  search.createColumn({name: "createdfrom", label: "Created From"})
				   ]
				});

				var parentID;
				var parentName;
				var transID;
				
				itemfulfillmentSearchObj.run().each(function(result){
   					parentID = result.getValue({ "name": "createdfrom" });
   					parentName = result.getText({ "name": "createdfrom" });
					transID = result.getValue({ "name": "internalid" });
					return true;
				});
				
				if (isEmpty(parentID)) return
				
                var form = 	ui.createForm({ title: 'Associate Serial Numbers'+formTitle })

				var recID = form.addField({
					id: 'custpage_transid',
					type: ui.FieldType.TEXT,
					label: "Trans ID"
				});
				recID.defaultValue = transID;
                recID.updateDisplayType({ displayType : ui.FieldDisplayType.HIDDEN });

				var itemList = [];
				
				// Retrieves order data from a saved search
				itemList = getItems (scriptOrderType, scriptOrderNum, parentID, parentName);
				log.debug("itemlist = ",JSON.stringify(itemList));

                form.addSubmitButton({
                    label: 'Save Serial Numbers'
                });
				
				form.addField({
					id : 'labelfield',
					type : ui.FieldType.LABEL,
					label : 'The following items and serial numbers are available to link to this transaction.</br>Select the serial numbers to associate and click Save Serial Numbers button</br></br>'+labelTransType+':&nbsp&nbsp'+scriptOrderNum+'&nbsp&nbsp&nbsp&nbsp&nbspCreated From:&nbsp&nbsp'+parentName 
				});

				
 				var order_sublist = form.addSublist ({
					id: SUBLIST_ID,
					label: "Items and Serial Numbers",
					type: ui.SublistType.LIST
				});
				
				order_sublist.addMarkAllButtons();
				
				// Creates and populates the invoice sublist
				buildSublist (order_sublist, itemList);
				
                context.response.writePage(form);

		}
				
		function doPost (context){
			var request = context.request;
 //			log.debug({title: 'In POST code', details: 'request = '+JSON.stringify(request)});  
			var scriptOrderType = runtime.getCurrentScript().getParameter({name: 'custscript8'})
			var scriptTransID = request.parameters.custpage_transid

			var searchType = "";
			var filterType = "";
			var updateFieldID = "";
			
			log.debug("Script parameter of custscript8: " + scriptOrderType );
			log.debug("Context parameter of scriptTransID: " + scriptTransID );

			
				
			var lineCount = request.getLineCount({group:SUBLIST_ID});
			var includeCount = 0;
			var toInclude = [];

 			log.debug({title: 'In POST code', details: 'linecount = '+lineCount });  

			for (var i = 0; i < lineCount; i++){
				// For each line in the sublist, get the Include checkbox value
				var included = request.getSublistValue({
					group: SUBLIST_ID,
					name: 'include',
					line: i
				});

				// If the checkbox is checked, save the current transaction ID to the appropriate field on the SN record
				if (included == 'T'){
					var includedItem = request.getSublistValue({
						group: SUBLIST_ID,
						name: 'serialnumid',
						line: i
					});
					
					log.debug({title: 'In POST code', details: 'SN ID '+includedItem+' is included' });  
					
					if (scriptOrderType == ITEM_FULFILLMENT_TRANSACTION_ID){
						var otherId = rec.submitFields({
							type: 'customrecordserialnum',
							id: includedItem,
							values: {
								"custrecorditemfulfillment": scriptTransID
							}
						});
					}
					else if (scriptOrderType == RMA_TRANSACTION_ID){
						var otherId = rec.submitFields({
							type: 'customrecordserialnum',
							id: includedItem,
							values: {
								"custrecordrmanumber": scriptTransID
							}
						});
					}
					else if (scriptOrderType == VENDOR_RMA_TRANSACTION_ID){
						var otherId = rec.submitFields({
							type: 'customrecordserialnum',
							id: includedItem,
							values: {
								"custrecordvendorrma": scriptTransID
							}
						});
					}


				}
				
			}

			var redirectScript = "";
			var redirectDeploy = "";
			if (scriptOrderType == ITEM_FULFILLMENT_TRANSACTION_ID){
				redirectScript = "customscript_vc_associate_sn_pg1";
				redirectDeploy = "customdeploy_vc_associate_sn_pg1_if";
			}
			else if (scriptOrderType == RMA_TRANSACTION_ID ){
				redirectScript = "customscript_vc_associate_sn_pg1";
				redirectDeploy = "customdeploy_vc_associate_sn_pg1_rma";					
			}
			else if (scriptOrderType == VENDOR_RMA_TRANSACTION_ID){
				redirectScript = "customscript_vc_associate_sn_pg1";
				redirectDeploy = "customdeploy_vc_associate_sn_pg1_vnd_rma";
			}
			
			
			// Redirect back to page 1
			context.response.sendRedirect({
				type: http.RedirectType.SUITELET,
				identifier: redirectScript,
				id: redirectDeploy,
				editMode:false
			});

			
        }
		
		
		function getItems (transType, transNum, parentID){
			var itemsList = [];
			
			var strTransType = ""
			var strFilterType = ""
			
			if (transType == ITEM_FULFILLMENT_TRANSACTION_ID) {
				strTransType = "itemfulfillment"
				strFilterType = "ItemShip"
			}
			else if (transType == RMA_TRANSACTION_ID){
				strTransType = "returnauthorization"
				strFilterType = "RtnAuth"
			}
			else if (transType == VENDOR_RMA_TRANSACTION_ID){
				strTransType = "vendorreturnauthorization"
				strFilterType = "VendAuth"
			}

			var itemfulfillmentSearchObj = search.create({
			   type: strTransType,
			   filters:
			   [
				  ["type","anyof",strFilterType], 
				  "AND", 
				  ["numbertext","is",transNum], 
				  "AND", 
				  ["taxline","is","F"], 
				  "AND", 
				  ["shipping","is","F"]
			   ],
			   columns:
			   [
				  search.createColumn({
					 name: "tranid",
					 summary: "GROUP",
					 label: "Document Number"
				  }),
				  search.createColumn({
					 name: "item",
					 summary: "GROUP",
					 label: "Item"
				  })
			   ]
			});
			var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
			log.debug("item search result count",searchResultCount);

			itemfulfillmentSearchObj.run().each(function(result){
			   // .run().each has a limit of 4,000 results
			   var itemID = result.getValue({
					"name": "item",
					"summary": search.Summary.GROUP
				});
			   var itemName = result.getText({
					"name": "item",
					"summary": search.Summary.GROUP
				});
				
				if (!isEmpty(itemID) && !isEmpty(parentID)){
					var resultObj = {item : itemID, name : itemName, serialsList : getItemSerials(itemID, parentID, transType)}
					log.debug("in item search","search result = "+JSON.stringify(resultObj));
					itemsList.push(resultObj)
					
				}
			   return true;
			});
		
			return itemsList;
		}
 	
		function getItemSerials (itemID, parentID, transType){
			var serialsList = [];
			var filterList = [];

			log.debug("in getItemSerials", "itemID = "+itemID+"  parentID = "+parentID+"  transType = "+transType);

			if (transType == ITEM_FULFILLMENT_TRANSACTION_ID) {
				filterList =	[
									["custrecordserialitem","anyof",itemID], 
									"AND", 
									["custrecordserialsales","anyof",parentID],
									"AND", 
									["custrecorditemfulfillment","anyof","@NONE@"]
								]
			}
			else if (transType == RMA_TRANSACTION_ID){
				filterList =	[
									["custrecordserialitem","anyof",itemID], 
									"AND", 
									[["custrecordserialinvoice","anyof",parentID],"OR",["custrecordserialsales","anyof",parentID]],
									"AND", 
									["custrecordrmanumber","anyof","@NONE@"]
								]
			}
			else if (transType == VENDOR_RMA_TRANSACTION_ID){
				filterList =	[
									["custrecordserialitem","anyof",itemID], 
									"AND", 
									["custrecordserialpurchase","anyof",parentID],
									"AND", 
									["custrecordvendorrma","anyof","@NONE@"]
								]
			}
								


			var customrecordserialnumSearchObj = search.create({
			   type: "customrecordserialnum",
			   filters: filterList,
			   columns:
			   [
				  search.createColumn({
					 name: "name",
					 sort: search.Sort.ASC,
					 label: "Name"
				  }),
				  search.createColumn({name: "scriptid", label: "Script ID"}),
				  search.createColumn({name: "custrecordserialitem", label: "ItemNum"})
			   ]
			});
			
			var searchResultCount = customrecordserialnumSearchObj.runPaged().count;
			log.debug("customrecordserialnumSearchObj result count",searchResultCount);
			customrecordserialnumSearchObj.run().each(function(result){
			   // .run().each has a limit of 4,000 results
				var serialsObj = {
					sn_id : result.id,
					sn_name : result.getValue ({ "name": "name" })
				}
				serialsList.push(serialsObj)
			   return true;
			});
		
			return serialsList;
			
		}

		function buildSublist(trans_sublist, items){
			// Object array of paramters to pass to sublist .addField method
			var columns =	[{
								id: 'include',
								label: 'Include',
								type: ui.FieldType.CHECKBOX,
								displayType: ui.FieldDisplayType.ENTRY					
							},
							{
								id: 'itemnum',
								label: 'Item',
								type: ui.FieldType.TEXT,
								displayType: ui.FieldDisplayType.INLINE
							},
							{
								id: 'serialnum',
								label: 'Serial Number',
								type: ui.FieldType.TEXT,
								displayType: ui.FieldDisplayType.INLINE
							},
							{
								id: 'serialnumid',
								label: 'Serial Number ID',
								type: ui.FieldType.TEXT,
								displayType: ui.FieldDisplayType.HIDDEN
							}]
							
			columns.forEach(function(column){
				trans_sublist.addField(column).updateDisplayType({displayType: column.displayType});
			});
			
			var expandedItemList = [];
			// Add and populate a line for each item
			items.forEach(function(item, index) {
				log.debug({title: 'buildSublist', details: 'item = ' + JSON.stringify(item) });
				for (var i = 0; i < item.serialsList.length; i++){
					var expandedObj = {
						itemName: item.name,
						itemSN: item.serialsList[i].sn_name,
						itemSN_ID: item.serialsList[i].sn_id
					}
					expandedItemList.push(expandedObj);
				}
			});
			
			// Add and populate a line for each item
			expandedItemList.forEach(function(expandedItem, index) {
				log.debug({title: 'buildSublist', details: 'item = ' + JSON.stringify(expandedItem) });
				
				var params = {line: index};
				
				params.id = 'itemnum';
				params.value = expandedItem.itemName;
				trans_sublist.setSublistValue(params);

				params.id = 'serialnum';
				params.value = expandedItem.itemSN;
				trans_sublist.setSublistValue(params);

				params.id = 'serialnumid';
				params.value = expandedItem.itemSN_ID;
				trans_sublist.setSublistValue(params);
				
			});
			
		}
		
		
		function isEmpty (stValue)
		{
			if ((stValue == '') || (stValue == null) || (stValue == undefined))
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