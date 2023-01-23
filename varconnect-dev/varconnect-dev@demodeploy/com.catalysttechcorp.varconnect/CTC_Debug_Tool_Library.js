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

define(['N/xml', 'N/search', 'N/https', 'N/record', './CTC_VC2_Constants.js'], function (
    ns_xml,
    ns_search,
    ns_https,
    ns_record,
    vc2_constant
) {
    function showVendorName() {
        var vendor = document.getElementById('inpt_vendors1').value;
        var ponum = document.getElementById('ponum').value;
        var ouputObj = '';

        if (vendor != '---' && ponum != null && ponum.length > 0) {
            var msg = document.getElementById('message');
            msg.value = 'You selected ' + vendor + '\nYour PO = ' + ponum;
            if (vendor == 'Synnex') {
                //alert("Starting Synnex")
                ouputObj = handleSynnex(ponum);
                msg.value = 'Retrieved XML:\n' + vkbeautify.xml(ouputObj.xmlString, 4);
            } else if (vendor == 'D&H') {
                //alert("Starting D&H")
                ouputObj = handleDandH(ponum);
                msg.value = 'Retrieved XML:\n' + vkbeautify.xml(ouputObj.xmlString, 4);
            } else if (vendor == 'Tech Data') {
                //alert("Starting Tech Data- TEST")
                ouputObj = handleTechData(ponum);
                msg.value = 'Retrieved XML:\n' + vkbeautify.xml(ouputObj.xmlString, 4);
            } else if (vendor == 'Ingram Micro') {
                //alert("Starting Ingram Micro")
                ouputObj = handleIngramMicro(ponum);
                msg.value =
                    'Retrieved XML:\n' +
                    vkbeautify.xml(ouputObj.xmlString.detailxml, 4) +
                    '\nTracking XML:\n' +
                    vkbeautify.xml(ouputObj.xmlString.trackxml, 4);
            } else if (vendor == 'Westcon') {
                //alert("Starting Westcon")
                ouputObj = handleWestcon(ponum);
                msg.value = 'Retrieved XML:\n' + vkbeautify.xml(ouputObj.xmlString, 4);
            }
        } else alert('Please Select a vendor and enter a PO number');
    }

    //****************************************************************
    //** Westcon Code
    //****************************************************************
    function handleWestcon(poNum) {
        //stub function that handles everything for synnex

        //requestWestcon
        var responseXML = requestWestcon(poNum);

        //var outputObj = {"xmlString": responseXML, "itemArray": outputArr};
        var outputObj = { xmlString: responseXML };
        //returnXML
        return outputObj;
    }

    function requestWestcon(poNum) {
        var xmlorderStatus;

        var customerNumber = '597668';
        var custPONumber = poNum;
        var requestURL = 'https://companya.cloudfloordns.com/b2b/OrderStatus/v2/OrderStatus.svc?wsdl';

        var orderXMLLineData = [];

        /* 			xmlorderStatus =
                            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:wes="http://schemas.datacontract.org/2004/07/Westcon.B2B.WebServices.OrderStatus.Contracts.Request">' +
                                '<soapenv:Body>' +
                                    '<tem:GetOrderStatus>' +
                                        '<tem:GetOrderStatus>' +
                                            '<wes:WestconOrderStatus>' +
                                                '<wes:CustomerAccountNumber>1003408</wes:CustomerAccountNumber>' +
                                                '<wes:OrderNumberType>W</wes:OrderNumberType>' +
                                                '<wes:Orders>' +
                                                    '<wes:Order>' +
                                                        '<wes:OrderNumber>704571</wes:OrderNumber>' +
                                                    '</wes:Order>' +
                                                '</wes:Orders>' +
                                            '</wes:WestconOrderStatus>' +
                                        '</tem:request>' +
                                    '</tem:GetOrderStatus>' +
                                '</soapenv:Body>' +
                            '</soapenv:Envelope>';
             */
        xmlorderStatus =
            '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tem="http://tempuri.org/" xmlns:wes="http://schemas.datacontract.org/2004/07/Westcon.B2B.WebServices.OrderStatus.Contracts.Request"> ' +
            '   <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">' +
            '	   <wsse:Security soap:mustUnderstand="true" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
            '         <wsse:UsernameToken wsu:Id="UsernameToken-AEFEE4C6144495356215102517373256">' +
            '            <wsse:Username>1009255</wsse:Username>' +
            '            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">OZobLgcYMS8cclKxRQnQBOYxnDk21jiqqhbj</wsse:Password>' +
            '            <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">EmkG1ju7JxFq2/Bh6tHLuQ==</wsse:Nonce>' +
            '            <wsu:Created>2017-11-09T18:22:17.325Z</wsu:Created>' +
            '         </wsse:UsernameToken>' +
            '      </wsse:Security>' +
            '      <wsa:Action>http://tempuri.org/IOrderStatus/GetOrderStatus</wsa:Action>' +
            '   </soap:Header>' +
            '   <soap:Body>' +
            '      <tem:GetOrderStatus>' +
            '         <tem:request>' +
            '            <wes:WestconMetadata>' +
            '               <wes:Culture>2000</wes:Culture>' +
            '               <wes:OperationType>OrderStatus</wes:OperationType>' +
            '               <wes:SourceSystem>B2BWEB</wes:SourceSystem>' +
            '               <wes:TimeStamp>2016-05-31T09:00:00</wes:TimeStamp>' +
            '               <wes:TransactionID>B2BWEB</wes:TransactionID>' +
            '            </wes:WestconMetadata>' +
            '            <wes:WestconOrderStatus>' +
            '               <wes:CustomerAccountNumber>1009255</wes:CustomerAccountNumber>' +
            '               <wes:OrderNumberType>W</wes:OrderNumberType>' +
            '               <wes:Orders>' +
            '                  <wes:Order>' +
            '                     <wes:OrderNumber>' +
            custPONumber +
            '</wes:OrderNumber>' +
            '                  </wes:Order>' +
            '               </wes:Orders>' +
            '            </wes:WestconOrderStatus>' +
            '         </tem:request>' +
            '      </tem:GetOrderStatus>' +
            '   </soap:Body>' +
            '</soap:Envelope>';

        var headers = {
            'Content-Type': 'application/soap+xml'
            //				'Content-Length': 'length'
        };

        try {
            var response = ns_https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            });
            var responseXML = response.body;
            //				alert ('response = '+responseXML)

            //				responseXML='This is where the Westcon POST goes';
        } catch (err) {
            alert('Post error = ' + err);
        }

        return responseXML;
    }

    //****************************************************************
    //** Synnex Code
    //****************************************************************
    function handleSynnex(poNum) {
        var responseXML = requestSynnex(poNum);
        var outputObj = { xmlString: responseXML };
        //returnXML
        return outputObj;
    }

    function requestSynnex(poNum) {
        var xmlorderStatus;

        var credentials = decodeCredentials('Synnex', poNum);
        if (credentials == null) return 'Synnex Credentials missing';
        if (isEmpty(credentials.userName) || isEmpty(credentials.password) || isEmpty(credentials.customerNum))
            return 'Synnex Credentials missing';

        var userName = credentials.userName;
        var password = credentials.password;
        var customerNumber = credentials.customerNum;

        var custPONumber = poNum;
        var requestURL = 'https://ec.synnex.com/SynnexXML/POStatus';
        //var requestURL = "https://ec.synnex.ca/SynnexXML/POStatus";

        var orderXMLLineData = [];

        xmlorderStatus =
            '<?xml version="1.0" encoding="UTF-8" ?>' +
            '<SynnexB2B version="2.2">' +
            '<Credential>' +
            '<UserID>' +
            userName +
            '</UserID>' +
            '<Password>' +
            password +
            '</Password>' +
            '</Credential>' +
            '<OrderStatusRequest>' +
            '<CustomerNumber>' +
            customerNumber +
            '</CustomerNumber>' +
            '<PONumber>' +
            custPONumber +
            '</PONumber>' +
            '</OrderStatusRequest>' +
            '</SynnexB2B>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        log.debug('url', requestURL);
        log.debug('body', xmlorderStatus);
        log.debug('headers', headers);

        try {
            var request = {
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            };
            log.debug('obj ', request);
            log.debug('obj string ', JSON.stringify(request));

            var response = ns_https.post(request);
            var responseXML = response.body;
        } catch (err) {
            /**				log.error({
					title: 'Synnex scheduled',
					details: 'error = '+err.message
				});
                 **/
            alert('Synnex scheduled : error = ' + err.message);
        }

        return responseXML;
    }

    //****************************************************************
    //** D and H Code
    //****************************************************************
    function handleDandH(poNum) {
        var responseXML = requestDandH(poNum);

        var outputObj = { xmlString: responseXML };

        return outputObj;
    }

    function requestDandH(poNum) {
        var xmlorderStatus;
        var xmlInvoiceByPOStatus;

        var credentials = decodeCredentials('DandH', poNum);
        if (credentials == null) return 'DandH Credentials missing';
        if (isEmpty(credentials.userName) || isEmpty(credentials.password)) return 'DandH Credentials missing';

        var userName = credentials.userName;
        var password = credentials.password;

        var custPONumber = poNum;
        var requestURL = 'https://www.dandh.com/dhXML/xmlDispatch';

        var orderXMLLineData = [];

        xmlorderStatus =
            '<XMLFORMPOST>' +
            '<REQUEST>orderStatus</REQUEST>' +
            '<LOGIN>' +
            '<USERID>' +
            userName +
            '</USERID>' +
            '<PASSWORD>' +
            password +
            '</PASSWORD>' +
            '</LOGIN>' +
            '<STATUSREQUEST>' +
            '<PONUM>' +
            custPONumber +
            '</PONUM>' +
            '</STATUSREQUEST>' +
            '</XMLFORMPOST>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        try {
            var response = ns_https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            });
            var responseXML = response.body;
        } catch (err) {
            alert('DandH scheduled error = ' + err.message);
        }

        return responseXML;
    }

    //****************************************************************
    //** Tech Data Code
    //****************************************************************

    function handleTechData(poNum) {
        var responseXML = requestTechData(poNum);
        var outputObj = { xmlString: responseXML };

        return outputObj;
    }

    function requestTechData(poNum) {
        var xmlInvoiceByPOStatus;

        var credentials = decodeCredentials('TechData', poNum);
        if (credentials == null) return 'TechData Credentials not found';
        if (isEmpty(credentials.userName) || isEmpty(credentials.password)) return 'TechData Credentials missing';

        var userName = credentials.userName;
        var password = credentials.password;

        var responseVersion = '1.8';
        var custPONumber = poNum;

        var requestURL = 'https://tdxml.techdata.com/xmlservlet';

        var orderXMLLineData = [];

        xmlInvoiceByPOStatus =
            '<XML_InvoiceDetailByPO_Submit>' +
            '<Header>' +
            '<UserName>' +
            userName +
            '</UserName>' +
            '<Password>' +
            password +
            '</Password>' +
            '</Header>' +
            '<Detail>' +
            '<POInfo>' +
            '<PONbr>' +
            custPONumber +
            '</PONbr>' +
            '</POInfo>' +
            '</Detail>' +
            '</XML_InvoiceDetailByPO_Submit>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        try {
            var response = ns_https.post({
                url: requestURL,
                body: xmlInvoiceByPOStatus,
                headers: headers
            });
            var responseXML = response.body;
        } catch (err) {
            alert('TechData scheduled error = ' + err.message);
        }

        // Remove first two lines of XML response
        responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);
        responseXML = responseXML.substring(responseXML.indexOf('\n') + 1);

        return responseXML;
    }

    //****************************************************************
    //** Ingram Micro Code
    //****************************************************************
    function handleIngramMicro(poNum) {
        var responseXML = requestIngramMicro(poNum);
        var outputObj = { xmlString: responseXML };

        return outputObj;
    }

    function requestIngramMicro(poNum) {
        var xmlorderStatus;
        var xmlInvoiceByPOStatus;

        var credentials = decodeCredentials('IngramMicro', poNum);
        if (credentials == null) return 'IngramMicro Credentials not found';
        if (isEmpty(credentials.userName) || isEmpty(credentials.password)) return 'IngramMicro Credentials missing';

        var userName = credentials.userName;
        var password = credentials.password;

        var custPONumber = poNum;
        var requestURL = 'https://newport.ingrammicro.com';
        var branchOrderNumber = '';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        //get branch order number
        xmlorderStatus =
            '<OrderStatusRequest>' +
            '<Version>2.0</Version>' +
            '<TransactionHeader>' +
            '<SenderID>123456789</SenderID>' +
            '<ReceiverID>987654321</ReceiverID>' +
            '<CountryCode>MD</CountryCode>' +
            '<LoginID>' +
            userName +
            '</LoginID>' +
            '<Password>' +
            password +
            '</Password>' +
            '<TransactionID>54321</TransactionID>' +
            '</TransactionHeader>' +
            '<OrderHeaderInfo>' +
            '<CustomerPO>' +
            custPONumber +
            '</CustomerPO>' +
            '</OrderHeaderInfo>' +
            '</OrderStatusRequest>';
        try {
            var orderNumberResponse = ns_https.post({
                url: requestURL,
                body: xmlorderStatus,
                headers: headers
            });
            var orderNumberXML = ns_xml.Parser.fromString({
                text: orderNumberResponse.body
            });

            branchOrderNumber = ns_xml.XPath.select({
                node: orderNumberXML,
                xpath: '//BranchOrderNumber'
            })[0].textContent;
        } catch (err) {
            alert('requestIngramMicro error = ' + err.message);
        }

        var orderXMLLineData = [];

        var xmlorderDetailStatus =
            '<OrderDetailRequest>' +
            '<Version>2.0</Version>' +
            '<TransactionHeader>' +
            '<SenderID>123456789</SenderID>' +
            '<ReceiverID>987654321</ReceiverID>' +
            '<CountryCode>MD</CountryCode>' +
            '<LoginID>' +
            userName +
            '</LoginID>' +
            '<Password>' +
            password +
            '</Password>' +
            '<TransactionID>54321</TransactionID>' +
            '</TransactionHeader>' +
            '<OrderHeaderInfo>' +
            '<BranchOrderNumber>' +
            branchOrderNumber +
            '</BranchOrderNumber>' +
            '<OrderSuffix/>' +
            '<CustomerPO>' +
            custPONumber +
            '</CustomerPO>' +
            '</OrderHeaderInfo>' +
            '<ShowDetail>2</ShowDetail>' +
            '</OrderDetailRequest>';

        var orderTrackingRequest =
            '<OrderTrackingRequest>' +
            '<Version>2.0</Version>' +
            '<TransactionHeader>' +
            '<SenderID>123456789</SenderID>' +
            '<ReceiverID>987654321</ReceiverID>' +
            '<CountryCode>MD</CountryCode>' +
            '<LoginID>' +
            userName +
            '</LoginID>' +
            '<Password>' +
            password +
            '</Password>' +
            '<TransactionID>54321</TransactionID>' +
            '</TransactionHeader>' +
            '<TrackingRequestHeader>' +
            '<BranchOrderNumber>' +
            branchOrderNumber +
            '</BranchOrderNumber>' +
            '<OrderSuffix/>' +
            '<CustomerPO>' +
            custPONumber +
            '</CustomerPO>' +
            '</TrackingRequestHeader>' +
            '<ShowDetail>2</ShowDetail>' +
            '</OrderTrackingRequest>';
        try {
            var response = ns_https.post({
                url: requestURL,
                body: xmlorderDetailStatus,
                headers: headers
            });
            var responseXML = response.body;

            var trackingXML = ns_https.post({
                url: requestURL,
                body: orderTrackingRequest,
                headers: headers
            }).body;
        } catch (err) {
            alert('requestIngramMicro error = ' + err.message);
        }

        return { detailxml: responseXML, trackxml: trackingXML };
    }

    /***  OLD Encoded Version
         function decodeCredentials(company) {
		var cred = record.load({
			type: 'customrecord_vc_config',
			id: 1
		});
		var loginCreds = {userName:"", password:""};

		var encoded = "";
		if (company == 'Synnex') encoded = cred.getValue({fieldId: 'credentialsSynnex'});
		if (company == 'DandH') encoded = cred.getValue({fieldId: 'credentialsDandH'});
		if (company == 'IngramMicro') encoded = cred.getValue({fieldId: 'credentialsIngramMicro'});
		if (company == 'TechData') encoded = cred.getValue({fieldId: 'credentialsTechData'});
		return encode.convert({
			string: encoded,
			inputEncoding: encode.Encoding.BASE_64,
			outputEncoding: encode.Encoding.UTF_8
		});
	};
         *********/

    function decodeCredentials(company, poNum) {
        var cred;
        var enableSubsidiaries = vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES;
        var loginCreds = { userName: '', password: '', customerNum: '' };

        log.debug('decodeCredentials', poNum);
        if (enableSubsidiaries) {
            var subsidiary = '';
            var purchaseorderSearchObj = ns_search.create({
                type: 'purchaseorder',
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['numbertext', 'is', poNum],
                    'AND',
                    ['mainline', 'is', true]
                ],
                columns: [ns_search.createColumn({ name: 'subsidiary' })]
            });
            var searchResultCount = purchaseorderSearchObj.runPaged().count;
            log.debug('purchaseorderSearchObj result count', searchResultCount);
            purchaseorderSearchObj.run().each(function (result) {
                subsidiary = result.getValue('subsidiary');

                return false;
            });

            //var subsidiary = poRec.getValue('subsidiary');
            log.debug('decodeCredentials:subsidiary', subsidiary);

            var myFilters2 = [];
            myFilters2.push(
                ns_search.createFilter({
                    name: 'custrecord_vc_subsidiary',
                    operator: ns_search.Operator.IS,
                    values: subsidiary
                })
            );
            var results2 = ns_search
                .create({
                    type: 'customrecord_vc_config',
                    filters: myFilters2
                })
                .run()
                .getRange({
                    start: 0,
                    end: 1
                });
            log.debug('decodeCredentials:results2', results2);
            if (results2) {
                cred = ns_record.load({
                    type: 'customrecord_vc_config',
                    id: results2[0].id
                });
            } else {
                return null;
            }
        } else {
            cred = ns_record.load({
                type: 'customrecord_vc_config',
                id: 1
            });
        }

        if (company == 'Synnex') {
            loginCreds.userName = cred.getValue({ fieldId: 'custrecord_vc_synnex_user' });
            loginCreds.password = cred.getValue({ fieldId: 'custrecord_vc_synnex_pass' }).replace('&', '&amp;');
            loginCreds.customerNum = cred.getValue({ fieldId: 'custrecord_vc_synnex_customernum' });
            return loginCreds;
        } else if (company == 'DandH') {
            loginCreds.userName = cred.getValue({ fieldId: 'custrecord_vc_dandh_user' });
            loginCreds.password = cred.getValue({ fieldId: 'custrecord_vc_dandh_pass' }).replace('&', '&amp;');
            return loginCreds;
        } else if (company == 'IngramMicro') {
            loginCreds.userName = cred.getValue({ fieldId: 'custrecord_vc_ingrammicro_user' });
            loginCreds.password = cred.getValue({ fieldId: 'custrecord_vc_ingrammicro_pass' }).replace('&', '&amp;');
            return loginCreds;
        } else if (company == 'TechData') {
            loginCreds.userName = cred.getValue({ fieldId: 'custrecord_vc_techdata_user' });
            loginCreds.password = cred.getValue({ fieldId: 'custrecord_vc_techdata_pass' }).replace('&', '&amp;');
            log.debug({
                title: 'TechData info',
                details: 'user = ' + loginCreds.userName + ' pass = ' + loginCreds.password
            });

            return loginCreds;
        }

        return null;
    }

    function isEmpty(stValue) {
        if (stValue == '' || stValue == null || stValue == undefined) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if (stValue == '') {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }

            return false;
        }
    }

    /**
     * vkBeautify - javascript plugin to pretty-print or minify text in XML, JSON, CSS and SQL formats.
     *
     * Version - 0.99.00.beta
     * Copyright (c) 2012 Vadim Kiryukhin
     * vkiryukhin @ gmail.com
     * http://www.eslinstructor.net/vkbeautify/
     *
     * Dual licensed under the MIT and GPL licenses:
     *   http://www.opensource.org/licenses/mit-license.php
     *   http://www.gnu.org/licenses/gpl.html
     *
     *   Pretty print
     *
     *        vkbeautify.xml(text [,indent_pattern]);
     *        vkbeautify.json(text [,indent_pattern]);
     *        vkbeautify.css(text [,indent_pattern]);
     *        vkbeautify.sql(text [,indent_pattern]);
     *
     *        @text - String; text to beatufy;
     *        @indent_pattern - Integer | String;
     *                Integer:  number of white spaces;
     *                String:   character string to visualize indentation ( can also be a set of white spaces )
     *   Minify
     *
     *        vkbeautify.xmlmin(text [,preserve_comments]);
     *        vkbeautify.jsonmin(text);
     *        vkbeautify.cssmin(text [,preserve_comments]);
     *        vkbeautify.sqlmin(text);
     *
     *        @text - String; text to minify;
     *        @preserve_comments - Bool; [optional];
     *                Set this flag to true to prevent removing comments from @text ( minxml and mincss functions only. )
     *
     *   Examples:
     *        vkbeautify.xml(text); // pretty print XML
     *        vkbeautify.json(text, 4 ); // pretty print JSON
     *        vkbeautify.css(text, '. . . .'); // pretty print CSS
     *        vkbeautify.sql(text, '----'); // pretty print SQL
     *
     *        vkbeautify.xmlmin(text, true);// minify XML, preserve comments
     *        vkbeautify.jsonmin(text);// minify JSON
     *        vkbeautify.cssmin(text);// minify CSS, remove comments ( default )
     *        vkbeautify.sqlmin(text);// minify SQL
     *
     */

    (function () {
        function createShiftArr(step) {
            var space = '    ';

            if (isNaN(parseInt(step))) {
                // argument is string
                space = step;
            } else {
                // argument is integer
                switch (step) {
                    case 1:
                        space = ' ';
                        break;
                    case 2:
                        space = '  ';
                        break;
                    case 3:
                        space = '   ';
                        break;
                    case 4:
                        space = '    ';
                        break;
                    case 5:
                        space = '     ';
                        break;
                    case 6:
                        space = '      ';
                        break;
                    case 7:
                        space = '       ';
                        break;
                    case 8:
                        space = '        ';
                        break;
                    case 9:
                        space = '         ';
                        break;
                    case 10:
                        space = '          ';
                        break;
                    case 11:
                        space = '           ';
                        break;
                    case 12:
                        space = '            ';
                        break;
                }
            }

            var shift = ['\n']; // array of shifts
            for (ix = 0; ix < 100; ix++) {
                shift.push(shift[ix] + space);
            }
            return shift;
        }

        function vkbeautify() {
            this.step = '    '; // 4 spaces
            this.shift = createShiftArr(this.step);
        }

        vkbeautify.prototype.xml = function (text, step) {
            var ar = text
                    .replace(/>\s{0,}</g, '><')
                    .replace(/</g, '~::~<')
                    .replace(/\s*xmlns\:/g, '~::~xmlns:')
                    .replace(/\s*xmlns\=/g, '~::~xmlns=')
                    .split('~::~'),
                len = ar.length,
                inComment = false,
                deep = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                // start comment or <![CDATA[...]]> or <!DOCTYPE //
                if (ar[ix].search(/<!/) > -1) {
                    str += shift[deep] + ar[ix];
                    inComment = true;
                    // end comment  or <![CDATA[...]]> //
                    if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1 || ar[ix].search(/!DOCTYPE/) > -1) {
                        inComment = false;
                    }
                }
                // end comment  or <![CDATA[...]]> //
                else if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) {
                    str += ar[ix];
                    inComment = false;
                }
                // <elm></elm> //
                else if (
                    /^<\w/.exec(ar[ix - 1]) &&
                    /^<\/\w/.exec(ar[ix]) &&
                    /^<[\w:\-\.\,]+/.exec(ar[ix - 1]) == /^<\/[\w:\-\.\,]+/.exec(ar[ix])[0].replace('/', '')
                ) {
                    str += ar[ix];
                    if (!inComment) deep--;
                }
                // <elm> //
                else if (ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) == -1 && ar[ix].search(/\/>/) == -1) {
                    str = !inComment ? (str += shift[deep++] + ar[ix]) : (str += ar[ix]);
                }
                // <elm>...</elm> //
                else if (ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) {
                    str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
                }
                // </elm> //
                else if (ar[ix].search(/<\//) > -1) {
                    str = !inComment ? (str += shift[--deep] + ar[ix]) : (str += ar[ix]);
                }
                // <elm/> //
                else if (ar[ix].search(/\/>/) > -1) {
                    str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
                }
                // <? xml ... ?> //
                else if (ar[ix].search(/<\?/) > -1) {
                    str += shift[deep] + ar[ix];
                }
                // xmlns //
                else if (ar[ix].search(/xmlns\:/) > -1 || ar[ix].search(/xmlns\=/) > -1) {
                    str += shift[deep] + ar[ix];
                } else {
                    str += ar[ix];
                }
            }

            return str[0] == '\n' ? str.slice(1) : str;
        };

        vkbeautify.prototype.json = function (text, step) {
            var step = step ? step : this.step;

            if (typeof JSON === 'undefined') return text;

            if (typeof text === 'string') return JSON.stringify(JSON.parse(text), null, step);
            if (typeof text === 'object') return JSON.stringify(text, null, step);

            return text; // text is not string nor object
        };

        vkbeautify.prototype.css = function (text, step) {
            var ar = text
                    .replace(/\s{1,}/g, ' ')
                    .replace(/\{/g, '{~::~')
                    .replace(/\}/g, '~::~}~::~')
                    .replace(/\;/g, ';~::~')
                    .replace(/\/\*/g, '~::~/*')
                    .replace(/\*\//g, '*/~::~')
                    .replace(/~::~\s{0,}~::~/g, '~::~')
                    .split('~::~'),
                len = ar.length,
                deep = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                if (/\{/.exec(ar[ix])) {
                    str += shift[deep++] + ar[ix];
                } else if (/\}/.exec(ar[ix])) {
                    str += shift[--deep] + ar[ix];
                } else if (/\*\\/.exec(ar[ix])) {
                    str += shift[deep] + ar[ix];
                } else {
                    str += shift[deep] + ar[ix];
                }
            }
            return str.replace(/^\n{1,}/, '');
        };

        //----------------------------------------------------------------------------

        function isSubquery(str, parenthesisLevel) {
            return parenthesisLevel - (str.replace(/\(/g, '').length - str.replace(/\)/g, '').length);
        }

        function split_sql(str, tab) {
            return (
                str
                    .replace(/\s{1,}/g, ' ')

                    .replace(/ AND /gi, '~::~' + tab + tab + 'AND ')
                    .replace(/ BETWEEN /gi, '~::~' + tab + 'BETWEEN ')
                    .replace(/ CASE /gi, '~::~' + tab + 'CASE ')
                    .replace(/ ELSE /gi, '~::~' + tab + 'ELSE ')
                    .replace(/ END /gi, '~::~' + tab + 'END ')
                    .replace(/ FROM /gi, '~::~FROM ')
                    .replace(/ GROUP\s{1,}BY/gi, '~::~GROUP BY ')
                    .replace(/ HAVING /gi, '~::~HAVING ')
                    //.replace(/ SET /ig," SET~::~")
                    .replace(/ IN /gi, ' IN ')

                    .replace(/ JOIN /gi, '~::~JOIN ')
                    .replace(/ CROSS~::~{1,}JOIN /gi, '~::~CROSS JOIN ')
                    .replace(/ INNER~::~{1,}JOIN /gi, '~::~INNER JOIN ')
                    .replace(/ LEFT~::~{1,}JOIN /gi, '~::~LEFT JOIN ')
                    .replace(/ RIGHT~::~{1,}JOIN /gi, '~::~RIGHT JOIN ')

                    .replace(/ ON /gi, '~::~' + tab + 'ON ')
                    .replace(/ OR /gi, '~::~' + tab + tab + 'OR ')
                    .replace(/ ORDER\s{1,}BY/gi, '~::~ORDER BY ')
                    .replace(/ OVER /gi, '~::~' + tab + 'OVER ')

                    .replace(/\(\s{0,}SELECT /gi, '~::~(SELECT ')
                    .replace(/\)\s{0,}SELECT /gi, ')~::~SELECT ')

                    .replace(/ THEN /gi, ' THEN~::~' + tab + '')
                    .replace(/ UNION /gi, '~::~UNION~::~')
                    .replace(/ USING /gi, '~::~USING ')
                    .replace(/ WHEN /gi, '~::~' + tab + 'WHEN ')
                    .replace(/ WHERE /gi, '~::~WHERE ')
                    .replace(/ WITH /gi, '~::~WITH ')

                    //.replace(/\,\s{0,}\(/ig,",~::~( ")
                    //.replace(/\,/ig,",~::~"+tab+tab+"")

                    .replace(/ ALL /gi, ' ALL ')
                    .replace(/ AS /gi, ' AS ')
                    .replace(/ ASC /gi, ' ASC ')
                    .replace(/ DESC /gi, ' DESC ')
                    .replace(/ DISTINCT /gi, ' DISTINCT ')
                    .replace(/ EXISTS /gi, ' EXISTS ')
                    .replace(/ NOT /gi, ' NOT ')
                    .replace(/ NULL /gi, ' NULL ')
                    .replace(/ LIKE /gi, ' LIKE ')
                    .replace(/\s{0,}SELECT /gi, 'SELECT ')
                    .replace(/\s{0,}UPDATE /gi, 'UPDATE ')
                    .replace(/ SET /gi, ' SET ')

                    .replace(/~::~{1,}/g, '~::~')
                    .split('~::~')
            );
        }

        vkbeautify.prototype.sql = function (text, step) {
            var ar_by_quote = text
                    .replace(/\s{1,}/g, ' ')
                    .replace(/\'/gi, "~::~'")
                    .split('~::~'),
                len = ar_by_quote.length,
                ar = [],
                deep = 0,
                tab = this.step, //+this.step,
                inComment = true,
                inQuote = false,
                parenthesisLevel = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                if (ix % 2) {
                    ar = ar.concat(ar_by_quote[ix]);
                } else {
                    ar = ar.concat(split_sql(ar_by_quote[ix], tab));
                }
            }

            len = ar.length;
            for (ix = 0; ix < len; ix++) {
                parenthesisLevel = isSubquery(ar[ix], parenthesisLevel);

                if (/\s{0,}\s{0,}SELECT\s{0,}/.exec(ar[ix])) {
                    ar[ix] = ar[ix].replace(/\,/g, ',\n' + tab + tab + '');
                }

                if (/\s{0,}\s{0,}SET\s{0,}/.exec(ar[ix])) {
                    ar[ix] = ar[ix].replace(/\,/g, ',\n' + tab + tab + '');
                }

                if (/\s{0,}\(\s{0,}SELECT\s{0,}/.exec(ar[ix])) {
                    deep++;
                    str += shift[deep] + ar[ix];
                } else if (/\'/.exec(ar[ix])) {
                    if (parenthesisLevel < 1 && deep) {
                        deep--;
                    }
                    str += ar[ix];
                } else {
                    str += shift[deep] + ar[ix];
                    if (parenthesisLevel < 1 && deep) {
                        deep--;
                    }
                }
                var junk = 0;
            }

            str = str.replace(/^\n{1,}/, '').replace(/\n{1,}/g, '\n');
            return str;
        };

        vkbeautify.prototype.xmlmin = function (text, preserveComments) {
            var str = preserveComments
                ? text
                : text
                      .replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g, '')
                      .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns');
            return str.replace(/>\s{0,}</g, '><');
        };

        vkbeautify.prototype.jsonmin = function (text) {
            if (typeof JSON === 'undefined') return text;

            return JSON.stringify(JSON.parse(text), null, 0);
        };

        vkbeautify.prototype.cssmin = function (text, preserveComments) {
            var str = preserveComments ? text : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g, '');

            return str
                .replace(/\s{1,}/g, ' ')
                .replace(/\{\s{1,}/g, '{')
                .replace(/\}\s{1,}/g, '}')
                .replace(/\;\s{1,}/g, ';')
                .replace(/\/\*\s{1,}/g, '/*')
                .replace(/\*\/\s{1,}/g, '*/');
        };

        vkbeautify.prototype.sqlmin = function (text) {
            return text
                .replace(/\s{1,}/g, ' ')
                .replace(/\s{1,}\(/, '(')
                .replace(/\s{1,}\)/, ')');
        };

        window.vkbeautify = new vkbeautify();
    })();

    return {
        showVendorName: showVendorName
    };
});
