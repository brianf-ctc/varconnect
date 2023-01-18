/**
 * 
 * Module Description
 * Scheduled script that will send an email summary of the days shipments to recipients listed in a body field on the SO
 *
 * 
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 */
define(['N/search', 
        'N/email', 
        'N/record',
        'N/log', 
        'N/runtime', 
        'N/render', 
        './VC_Globals.js', 
        './CTC_VC_Lib_MainConfiguration.js',
        './CTC_VC_Constants.js'],
function(search, 
		email, 
		record, 
		log, 
		runtime, 
		render, 
		vcGlobals, 
		libMainConfig,
		constants) {

    function execute() {
        log.debug({ title: 'Scheduled Email Script', details: 'STARTING' });
        
        var mainConfig = libMainConfig.getMainConfiguration();

        var senderId = mainConfig.emailSender ? mainConfig.emailSender[0].value : null,
    		emailTemplate = mainConfig.emailTemplate ? mainConfig.emailTemplate[0].value : null,
			searchId = mainConfig.fulfillmentSearch ? mainConfig.fulfillmentSearch[0].value : null;
        
//        var senderId = runtime.getCurrentScript().getParameter("custscript_senderID");
//            var senderId = vcGlobals.EMAIL_AUTHOR_ID;
/*
        log.debug({
            title: 'Scheduled Email Script',
            details: 'Starting execute function, senderID parameter = '+senderId
        });
*/

        if (senderId != null && senderId.length > 0){
//				var ccEmail = [vcGlobals.EMAIL_CC_ADDRESS];
            var ccEmail = "";

            // search name = Shipping Email Notification - Item Fulfillment v2
            var myResults = getItemFulfillments(searchId);
            var emailsList = [];
            
            // build unique list of emails addresses
            for (var i =0; i < myResults.length; i++){
                var sendTo = myResults[i].getValue({ name: constants.Fields.Transaction.SEND_SHIPPING_UPDATE_TO, join: 'createdFrom' });
                    
//					log.debug({ title: 'Scheduled Email Script', details: 'From employee ID '+senderId+' Send to = '+sendTo });
                
                if (sendTo != null && sendTo.length > 0){
                    var sendToList = new Array();
                    sendToList = sendTo.split(',');
                    for (var x = 0; x < sendToList.length; x++){
                        if (emailsList.indexOf(sendToList[x]) < 0){
                            emailsList.push(sendToList[x])
                        }
                    }
                }
            }
            
            log.debug({ title: 'Scheduled Email Script', details: 'Unique email list length = '+emailsList.length });
            // loop through the email list
            for (var j =0; j < emailsList.length; j++){
                var newSendTo = emailsList[j];
                var bodyList =[];
                var emailBody = []
                // build list of entries for that email from the search results
                for (var x =0; x < myResults.length; x++){
                    var sendTo2 = myResults[x].getValue({ name: constants.Fields.Transaction.SEND_SHIPPING_UPDATE_TO, join: 'createdFrom' });				
                    if (sendTo2.indexOf(newSendTo) >= 0){
                        bodyList.push(myResults[x]);
                    }
                }
                
                if (bodyList.length > 0){
                    // build the HTML table for the items on this email
                    var itemTableHTML = buildItemTable(bodyList)			
                }
                else {
                    // no items to email
                    continue;
                }
                var itemTableHTML = '1'; //remove group

                // if there are any rows in the table, send an email
                // getText({name: 'companyname', join: 'customerMain'})
                if (itemTableHTML.length > 0){

                    log.debug({
                        title: 'Scheduled Email Script',
                        details: 'From '+ senderId +' Sending email to '+newSendTo
                    });
                    
                    // build and insert item table
                    if (emailTemplate) {
//	                    var myHTML = buildEmail(mainConfig.emailTemplate, itemTableHTML);
//                    	var emailObj = buildEmail(mainConfig.emailTemplate, itemTableHTML),
                    	var emailObj = buildEmail(emailTemplate, bodyList),
                    		subject = emailObj.subject,
                    		body = emailObj.body;
	
	                    try {
	                        email.send({
	                            author: senderId,
	                            recipients: newSendTo,
	//								cc:	ccEmail,
	                            subject: subject,
	                            body: body
	                        });
	                        
	                        log.audit('email sent to ' + newSendTo);
	                    }
	                    catch (err){
	                        log.error({
	                            title: 'Scheduled Email Script',
	                            details: 'Error Sending email '+ err.message
	                        });
	                    }
                    }
                }
            }
        }
    }


    // Run a search for item fulfillments created today, return array of results
    function getItemFulfillments (searchId) {
        log.debug({ title: 'Scheduled Email Script', details: 'Starting getItemFulfillments with Search ' + searchId });
        
//        var itemfulfillmentSearchObj = search.create({
//            type: "itemfulfillment",
//            filters:
//            [
//               ["mainline","any",""],
//               "AND", 
//               ["type","anyof","ItemShip"], 
//               "AND", 
//               ["trandate","within","yesterday"], 
//               "AND", 
//               ["shipping","is","F"], 
//               "AND", 
//               ["taxline","is","F"]
//            ],
//
//
///** Old version
//            filters:
//            [
//               ["mainline","is","F"], 
//               "AND", 
//               ["type","anyof","ItemShip"], 
//               "AND", 
//               ["trandate","on","today"], 
//               "AND", 
//               ["item.type","anyof","InvtPart","NonInvtPart"], 
//               "AND", 
//               ["shipping","is","F"], 
//               "AND", 
//               ["taxline","is","F"], 
//               "AND", 
//               ["accounttype","noneof","@NONE@"]
//            ],
//**/                
//            columns:
//            [
//               search.createColumn({
//                  name: "otherrefnum",
//                  join: "createdFrom",
//                  label: "Customer PO#"
//               }),
//               search.createColumn({name: "createdfrom", label: "Order Number"}),
//               search.createColumn({name: "item", label: "Part#"}),
//               search.createColumn({
//                  name: "salesdescription",
//                  join: "item",
//                  label: "Description"
//               }),
//               search.createColumn({name: "quantityuom", label: "Qty Ordered"}),
//               search.createColumn({name: "quantity", label: "Qty Fulfilled"}),
//               search.createColumn({name: "custcol_ctc_xml_carrier", label: "Carrier"}),
//               search.createColumn({name: "custcol_ctc_xml_eta", label: "ETA"}),
//               search.createColumn({name: "custcol_ctc_xml_ship_date", label: "Ship Date"}),
//               search.createColumn({name: "custcol_ctc_xml_ship_method", label: "Ship Method"}),
//               search.createColumn({name: "custcol_ctc_xml_tracking_num", label: "Tracking Number"}),
//               search.createColumn({
//                  name: constants.Fields.Transaction.SEND_SHIPPING_UPDATE_TO,
//                  join: "createdFrom",
//                  label: "Send Automated Shipping Emails To"
//               }),
//               search.createColumn({
//                  name: "salesrep",
//                  join: "createdFrom",
//                  label: "Sales Rep"
//               }),
//               search.createColumn({
//                  name: "entity",
//                  join: "createdFrom",
//                  label: "Company Name"
//               }),
//               search.createColumn({
//                  name: "shipaddress",
//                  join: "createdFrom",
//                  label: "Shipping Address"
//               }),
//               search.createColumn({
//                  name: "contact",
////                  join: "customerMain",
//                  join: "customer",
//                  label: "Primary Contact"
//               }),
//               search.createColumn({
//                  name: "trandate",
//                  sort: search.Sort.ASC,
//                  label: "Date"
//               })
//            ]
//         });
        
        var itemfulfillmentSearchObj = search.load({ id: searchId });

         var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
         log.debug("itemfulfillmentSearchObj result count",searchResultCount);
         var resultList = [];

         itemfulfillmentSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var tempQty = result.getValue({ name: 'quantity' })
            if (!isEmpty(tempQty) && (tempQty.indexOf('-') < 0) ){
                resultList.push(result);
            }

            return true;
         });


         return resultList;
    }


    function buildItemTable (bodyList){
        var thStyle = 'style="border:1px solid black; border-collapse:collapse; font-size:small; padding: 5px 10px 5px 10px;"';
        var tdStyle = 'style="border:1px solid black; border-collapse:collapse; font-size:small; padding: 5px 10px 5px 10px;"';
        
        var emailItemTable ='<table style="border: 1px solid black;border-collapse: collapse;font-size:small;width:900px">'+
                            '<thead>'+
                                '<tr>'+
                                '<th '+thStyle+'>CUSTOMER PO#</th>'+
                                '<th '+thStyle+'>SALES ORDER #</th>'+
                                '<th '+thStyle+'>ITEM #</th>'+
                                '<th '+thStyle+'>QTY FULFILLED</th>'+
                                '<th '+thStyle+'>TRACKING NUMBERS</th>'+
                                '<th '+thStyle+'>CARRIER</th>'+
                                '</tr></thead>';

        for (var z=0; z < bodyList.length; z++){

            var tempPO = bodyList[z].getValue({ name: 'otherrefnum', join: 'createdFrom' });
            var tempSO = bodyList[z].getText({ name: 'createdFrom' });
            var tempItem = bodyList[z].getText({ name: 'item' });
            var tempQty = bodyList[z].getValue({ name: 'quantity' });
            var tempTracking = bodyList[z].getValue({ name: 'custcol_ctc_xml_tracking_num' });
            var tempCarrier = bodyList[z].getValue({ name: 'custcol_ctc_xml_carrier' });
            var tempCompany = bodyList[z].getText({ name: 'entity', join: "createdFrom" });
//            var tempContact = bodyList[z].getValue({ name: 'contact', join: "customerMain" });
            var tempShipTo = bodyList[z].getValue({ name: 'shipaddress', join: "createdFrom" });
            
            emailItemTable += '<tr>'+
                    '<td '+tdStyle+'>'+ tempPO +'</td>'+
                    '<td '+tdStyle+'>'+ tempSO +'</td>'+
                    '<td '+tdStyle+'>'+ tempItem +'</td>'+
                    '<td '+tdStyle+'>'+ tempQty +'</td>'+
                    '<td '+tdStyle+'>'+ tempTracking +'</td>'+
                    '<td '+tdStyle+'>'+ tempCarrier +'</td>'+
                '</tr>';

        }
        emailItemTable += '</table>';

        return emailItemTable;
    }        

    function buildEmail(templateId, bodyList){
        // Internal ID of the record to attach the email to
        //var relatedRecordJson = { 'transactionId': tranRec.id };						
        
        // Load email template
//        var emailTemplate = record.load({
//                    type: record.Type.EMAIL_TEMPLATE,
//                    id: templateId,
//                    isDynamic: false
//                });
        // Get Template Subject and Body
//        var emailSubj = emailTemplate.getValue({ fieldId: 'subject' });
//        var emailBody =	emailTemplate.getValue({ fieldId: 'content' });
                        
        // Create a template rendere so we can render (fill in template field tags)
        var renderer = render.create();	
        renderer.setTemplateByScriptId('CUSTTMPL_105_T1716438_121');

        // attach PO record to source field info from
        //renderer.addRecord('transaction', tranRec);					

        // render the subject line
//        renderer.templateContent = emailSubj;
//        var rendererSubject = renderer.renderAsString();
		renderer.addSearchResults({
			templateName: 'records',
			searchResult: bodyList
		});
          
        var newBody = renderer.renderAsString();
        // render email body
//        renderer.templateContent = emailBody;
//        var rendererBody = renderer.renderAsString();

        // replace the string <TABLEINFO> in the template body with the HTML string emailBody
//        var newBody = rendererBody.replace('&lt;TABLEINFO&gt;', itemTableHTML);
//        log.debug({ title: 'newBody =', details: newBody });
        
        return {
        	subject: 'Test Subject',
        	body: newBody
        };
        // TODO: use recipientList on the recipients line
/* 			email.send({
                author: vcGlobals.EMAIL_AUTHOR_ID,
                recipients: recipientsList,
                subject: rendererSubject,
                body: newBody,
                relatedRecords: relatedRecordJson
                
        });	
*/
        
    }

    function getTodayDate (){
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth()+1; //January is 0!
        var yyyy = today.getFullYear();

        if(dd<10) {
            dd = '0'+dd
        } 

        if(mm<10) {
            mm = '0'+mm
        } 

        today = mm + '/' + dd + '/' + yyyy;
        return today;
    }
    
    function getAllResults (resultset) {
        var returnSearchResults = [];
        var searchid = 0;
        do {
            var resultslice = resultset.getRange({
                start: searchid, 
                end: searchid + 1000
            });
            for ( var rs in resultslice) {
                returnSearchResults.push(resultslice[rs]);
                searchid++;
            }
        } while (resultslice.length >= 1000);

        return returnSearchResults;
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

    
    return {
        execute: execute
    };
});