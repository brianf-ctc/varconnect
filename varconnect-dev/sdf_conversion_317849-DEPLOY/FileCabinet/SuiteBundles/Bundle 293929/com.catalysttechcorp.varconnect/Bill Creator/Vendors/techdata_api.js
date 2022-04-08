/**
 * techdata_api.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */


define(['N/log', 'N/xml', 'N/https', '../Libraries/moment', 'N/search'],
  function(log, xml, https, moment, search) {

    function processXml(input, config) {

      var tranNsid = input;

      var headers = {};

      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';

      var findDocumentNumber = search.lookupFields({
        type: search.Type.PURCHASE_ORDER,
        id: tranNsid,
        columns: ['tranid']
      });

      var docNum = findDocumentNumber.tranid;

      var baseUrl = config.url;

      var searchBody = '';
      searchBody += '<XML_InvoiceDetailByPO_Submit>'
      searchBody += '<Header>'
      searchBody += '<UserName>' + config.user_id + '</UserName>'
      searchBody += '<Password>' + config.user_pass + '</Password>'
      searchBody += '</Header>'
      searchBody += '<Detail>'
      searchBody += '<POInfo>'
      searchBody += '<PONbr>' + docNum + '</PONbr>'
      searchBody += '</POInfo>'
      searchBody += '</Detail>'
      searchBody += '</XML_InvoiceDetailByPO_Submit>'

      var searchResponse = https.post({
        url: baseUrl,
        headers: headers,
        body: searchBody
      });

      log.debug('td: searchResponse', input + ': ' + searchResponse.body);

      var searchObj = xml.Parser.fromString(searchResponse.body);

      var orders = xml.XPath.select({
        node: searchObj,
        xpath: '/XML_InvoiceDetailByPO_Response/Detail/OrderInfo'
      });

      log.debug('td: orders', input + ': ' + JSON.stringify(orders));

      log.debug('td: order length', input + ': ' + orders.length);

      // iterate OrderInfo[s] to get Invoice Numbers 

      var myArr = [];

      for (var l = 0; l < orders.length; l++) {


        var invoicesInPayload = orders[l].getElementsByTagName({
          tagName: 'InvoiceNbr'
        });

        if (invoicesInPayload.length == 0) {
          continue;
        }

        var invoiceNumber = orders[l].getElementsByTagName({
          tagName: 'InvoiceNbr'
        })[0].textContent;


        log.debug('td: invoiceNumber', input + ': ' + invoiceNumber)

        // node: searchObj,
        //   xpath: '/XML_InvoiceDetailByPO_Response/Detail/OrderInfo[' + l + ']/InvoiceNbr'
        // })[0].textContent;

        // for each Invoice Number repeat the line building process below

        var invoiceBody = '';
        invoiceBody += '<XML_OrderStatus_Submit>'
        invoiceBody += '<Header>'
        invoiceBody += '<UserName>' + config.user_id + '</UserName>'
        invoiceBody += '<Password>' + config.user_pass + '</Password>'
        invoiceBody += '<TransSetIDCode>869</TransSetIDCode>'
        invoiceBody += '<TransControlID>10000</TransControlID>'
        invoiceBody += '<ResponseVersion>1.8</ResponseVersion>'
        invoiceBody += '</Header>'
        invoiceBody += '<Detail>'
        invoiceBody += '<PurposeCode>02</PurposeCode>'
        invoiceBody += '<RefInfo>'
        invoiceBody += '<RefIDQual>IN</RefIDQual>'
        invoiceBody += '<RefID>' + invoiceNumber + '</RefID>'
        invoiceBody += '</RefInfo>'
        invoiceBody += '</Detail>'
        invoiceBody += '<Summary>'
        invoiceBody += '<NbrOfSegments/>'
        invoiceBody += '</Summary>'
        invoiceBody += '</XML_OrderStatus_Submit>'

        var invoiceResponse = https.post({
          url: baseUrl,
          headers: headers,
          body: invoiceBody
        });

        log.debug('td: invoiceResponse', input + ': ' + invoiceResponse.body);

        var xmlStr = invoiceResponse.body;

        log.debug('td: billXml', input + ': ' + xmlStr);

        var xmlObj = xml.Parser.fromString(xmlStr);

        var myObj = {};
        myObj.po = docNum;

        myObj.charges = {};

        //XML XPath Tool https://xmlgrid.net/


//        var rawDate = xml.XPath.select({ //12/16/16
//          node: xmlObj,
//          xpath: '/XML_OrderStatus_Response/Detail/InvoiceDate'
//        })[0].textContent;
        var rawDate = xml.XPath.select({ //12/16/16
            node: xmlObj,
            xpath: '/XML_OrderStatus_Response/Detail/InvoiceDate'
          })[0];

        if (!rawDate)
        	rawDate = new Date();
        else
          	rawDate = rawDate.textContent;

        log.debug('td: rawDate', input + ': ' + rawDate);

        myObj.date = moment(rawDate, 'MM/DD/YY').format('MM/DD/YYYY');

        // myObj.invoice = xml.XPath.select({ 
        //   node: xmlObj,
        //   xpath: '/XML_OrderStatus_Response/Detail/RefInfo[2]/RefID'
        // })[0].textContent;

        myObj.invoice = invoiceNumber;

        log.debug('td: invoice', input + ': ' + myObj.invoice)

        log.debug('td: tax node', input + ': ' + xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/TaxCharge'
        }))

        var tax = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/TaxCharge'
        });

        if (tax.length > 0) {
          myObj.charges.tax = tax[0].textContent * 1
        } else {
          myObj.charges.tax = 0;
        }

        log.debug('td: tax', input + ': ' + myObj.charges.tax)

        var other = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/StateFee'
        });

        if (other.length > 0) {
          myObj.charges.other = other[0].textContent * 1
        } else {
          myObj.charges.other = 0;
        }

        log.debug('other', myObj.charges.other)

        var shipping = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/NetFreightCharge'
        })

        if (shipping.length > 0) {
          myObj.charges.shipping = shipping[0].textContent * 1;
        } else {
          myObj.charges.shipping = 0;
        }

        log.debug('td: shipping', input + ': ' + myObj.charges.shipping)

        var shipping2 = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/HandlingCharge'
        })

        if (shipping2.length > 0) {
          myObj.charges.shipping += shipping2[0].textContent * 1
        }

        log.debug('td: shipping', input + ': ' + myObj.charges.shipping)

        myObj.total = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/InvoiceTotal'
        })[0].textContent * 1;

        log.debug('td: total', input + ': ' + myObj.total);

        myObj.lines = [];

        var lineItem = xml.XPath.select({
          node: xmlObj,
          xpath: '/XML_OrderStatus_Response/Detail/LineInfo'
        });

        for (var i = 0; i < lineItem.length; i++) {

          var lineObj = {};

          lineObj.processed = false;

          lineObj.ITEMNO = lineItem[i].getElementsByTagName({
            tagName: 'ProductID2'
          })[0].textContent;

          lineObj.PRICE = lineItem[i].getElementsByTagName({
            tagName: 'UnitPrice'
          })[0].textContent * 1;

          lineObj.QUANTITY = lineItem[i].getElementsByTagName({
            //tagName: 'QtyShipped'
            tagName: 'QtyOrdered'
          })[0].textContent * 1;

          lineObj.DESCRIPTION = lineItem[i].getElementsByTagName({
            tagName: 'ProductDesc'
          })[0].textContent;

          myObj.lines.push(lineObj);
        }

        var returnObj = {};
        returnObj.ordObj = myObj;
        returnObj.xmlStr = xmlStr;
        myArr.push(returnObj);

      }

      log.debug('myArr', myArr);

      return myArr;

    }

    // Add the return statement that identifies the entry point function.
    return {
      processXml: processXml
    }
  }
);