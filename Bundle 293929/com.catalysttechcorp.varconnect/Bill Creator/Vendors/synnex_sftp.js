/**
 * synnex_sftp.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */


define(['N/log', 'N/xml', '../Libraries/moment', 'N/sftp', 'N/search'],
  function(log, xml, moment, sftp, search) {

    function processXml(input, config) {

     // establish connection to remote FTP server

      var connection = sftp.createConnection({
        username: config.user_id,
        passwordGuid: config.user_pass,
        url: config.url,
        directory: config.res_path,
        hostKey: config.host_key
      });

      var downloadedFile = connection.download({
        filename: input
      });

      var xmlStr = downloadedFile.getContents();


 
      var xmlArr = [];
      
      // Parse the file and break up individual bills

      var xmlKey = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';

      do {

        if (xmlStr.indexOf(xmlKey, xmlKey.length) == -1) {
         
          xmlArr.push(xmlStr);
          xmlStr = '';
        
        } else {
        
          xmlArr.push(xmlStr.slice(0, xmlStr.indexOf(xmlKey, xmlKey.length)));
          xmlStr = xmlStr.slice(xmlStr.indexOf(xmlKey, xmlKey.length), xmlStr.length);
      
        }

        log.debug('xmlStr', JSON.stringify(xmlStr));

      } while (xmlStr.indexOf(xmlKey) == 0);

      var returnArr = [];



      for (f = 0; f < xmlArr.length; f++) {

        var returnObj = {}
        returnObj.xmlStr = xmlArr[f];

        var xmlObj = xml.Parser.fromString(xmlArr[f]);

        var myObj = {};

        myObj.po = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/CustomerPONumber'
        })[0].textContent;

        myObj.charges = {};

        //XML XPath Tool https://xmlgrid.net/

        var rawDate = xml.XPath.select({ //12/16/16
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/InvoiceDate'
        })[0].textContent;

        myObj.date = moment(rawDate, 'YYYY-MM-DD').format('MM/DD/YYYY');

        myObj.invoice = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/InvoiceNumber'
        })[0].textContent;

        myObj.charges.tax = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/SalesTax'
        })[0].textContent * 1;

        // myObj.charges.other = xml.XPath.select({
        //   node: xmlObj,
        //   xpath: '/SynnexB2B/Invoice/Summary/ExpenseTotal'
        // })[0].textContent * 1;

        myObj.charges.other = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/MinOrderFee'
        })[0].textContent * 1;

        myObj.charges.other += xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/ProcessingFee'
        })[0].textContent * 1;

        myObj.charges.other += xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/BoxCharge'
        })[0].textContent * 1;

        myObj.charges.shipping = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/Freight'
        })[0].textContent * 1;

        myObj.total = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Summary/TotalInvoiceAmount'
        })[0].textContent * 1;

        myObj.lines = [];

        var lineItem = xml.XPath.select({
          node: xmlObj,
          xpath: '/SynnexB2B/Invoice/Items/Item'
        });

        log.debug('sx: lines', lineItem.length);
        log.debug('sx: lineItem', lineItem);


        for (var i = 0; i < lineItem.length; i++) {

          var lineObj = {};

          lineObj.processed = false;

          lineObj.ITEMNO = lineItem[i].getElementsByTagName({
            tagName: 'ManuafacturerPartNumber'
          })[0].textContent;

          lineObj.PRICE = lineItem[i].getElementsByTagName({
            tagName: 'UnitPrice'
          })[0].textContent * 1;

          lineObj.QUANTITY = lineItem[i].getElementsByTagName({
            tagName: 'ShipQuantity'
          })[0].textContent * 1;

          lineObj.DESCRIPTION = lineItem[i].getElementsByTagName({
            tagName: 'ProductDescription'
          })[0].textContent;

          myObj.lines.push(lineObj);
        }

        returnObj.ordObj = myObj;

        returnArr.push(returnObj);

      }

      log.debug('returnArr', returnArr);

      return returnArr;

    }

    // Add the return statement that identifies the entry point function.
    return {
      processXml: processXml
    }
  }
);