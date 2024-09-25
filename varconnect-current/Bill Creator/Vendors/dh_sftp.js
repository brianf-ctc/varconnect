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

// define(['N/sftp', '../Libraries/papa'], function (ns_sftp, papa) {
define(function (require) {
    var ns_sftp = require('N/sftp'),
        papa = require('../Libraries/papa'),
        vc2_util = require('./../../CTC_VC2_Lib_Utils');

    var LogTitle = 'WS:D&H SFTP';

    function processXml_old(input, config) {
        var logTitle = [LogTitle, 'processXml'].join('::'),
            returnValue;

        vc2_util.log(logTitle, '/// input: ', [input, config]);

        // establish connection to remote FTP server
        var connection = ns_sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.res_path,
            hostKey: config.host_key
        });

        var downloadedFile = connection.download({ filename: input });
        var xmlStr = downloadedFile.getContents();
        var xmlObj = papa.parse(xmlStr, { delimiter: '^' }).data;

        vc2_util.log(logTitle, '// xmlObj: ', xmlObj);

        var returnArr = [];
        var returnObj = {};
        returnObj.xmlStr = xmlStr;

        var myObj = {};
        myObj.lines = [];

        for (var i = 0; i < xmlObj.length; i++) {
            if (xmlObj[i][0] == '|H|') {
                log.audit('D&H Process XML', '>>  Header: ' + JSON.stringify({ line: xmlObj[i] }));

                myObj.invoice = trimPadding(xmlObj[i][4], ' ');
                myObj.date = trimPadding(xmlObj[i][6], ' ');
                //myObj.parentNsid = null;
                myObj.po = trimPadding(xmlObj[i][7]);

                //log.debug('dh: processing po', trimPadding(xmlObj[i][7]));

                myObj.charges = {};
                myObj.charges.tax = 0;
                myObj.charges.shipping = 0;
                myObj.charges.other = 0;
                myObj.total = 0;
            } else if (xmlObj[i][0] == '|D|') {
                log.audit(
                    'D&H Process XML',
                    '>> Detail line: ' + JSON.stringify({ line: xmlObj[i] })
                );

                var lineObj = {};

                lineObj.processed = false;
                // lineObj.ITEMNO = trimPadding(xmlObj[i][9], ' ');
                lineObj.ITEMNO = trimPadding(xmlObj[i][10], ' ');
                lineObj.PRICE = trimPadding(xmlObj[i][5], ' ').match(/\d|\./g).join('') * 1;
                lineObj.QUANTITY = trimPadding(xmlObj[i][3], ' ').match(/\d|\./g).join('') * 1;
                lineObj.DESCRIPTION = trimPadding(xmlObj[i][13], ' ');

                myObj.lines.push(lineObj);
            } else if (xmlObj[i][0] == '|T|') {
                log.audit(
                    'D&H Process XML',
                    '>> summary line: ' + JSON.stringify({ line: xmlObj[i] })
                );

                // total charges
                // vdeChargeAmount = TaxAmount + EHFTotal + (Tax1 + Tax2 + Tax3)
                var summary = {
                    taxAmount: trimPadding(xmlObj[i][3], ' ').match(/\d|\./g).join('') * 1,
                    tax1: trimPadding(xmlObj[i][5], ' ').match(/\d|\./g).join('') * 1,
                    tax2: trimPadding(xmlObj[i][6], ' ').match(/\d|\./g).join('') * 1,
                    tax3: trimPadding(xmlObj[i][7], ' ').match(/\d|\./g).join('') * 1,
                    freight: trimPadding(xmlObj[i][13], ' ').match(/\d|\./g).join('') * 1,
                    handling: trimPadding(xmlObj[i][14], ' ').match(/\d|\./g).join('') * 1,
                    ehfTotal: trimPadding(xmlObj[i][4], ' ').match(/\d|\./g).join('') * 1,
                    invoiceTotal: trimPadding(xmlObj[i][9], ' ').match(/\d|\./g).join('') * 1
                };

                log.audit('D&H Process XML', '>> summary line: ' + JSON.stringify(summary));

                myObj.total = summary.invoiceTotal;
                myObj.charges.tax = summary.taxAmount + summary.tax1 + summary.tax2 + summary.tax3;
                myObj.charges.shipping = summary.freight + summary.handling;
                myObj.charges.other = summary.ehfTotal;

                // myObj.total = trimPadding(xmlObj[i][9], ' ').match(/\d|\./g).join('') * 1;

                // myObj.charges.tax = trimPadding(xmlObj[i][3], ' ').match(/\d|\./g).join('') * 1;

                // myObj.charges.shipping =
                //     trimPadding(xmlObj[i][10], ' ').match(/\d|\./g).join('') * 1;
            }
        }

        returnObj.ordObj = myObj;
        returnArr.push(returnObj);
        return returnArr;
    }

    function processXml(input, config) {
        var logTitle = [LogTitle, 'processXml'].join('::'),
            returnValue;

        vc2_util.log(logTitle, '/// input: ', [input, config]);

        // establish connection to remote FTP server
        var connection = ns_sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.res_path,
            hostKey: config.host_key
        });

        var downloadedFile = connection.download({ filename: input });
        var rawBillData = downloadedFile.getContents();
        var parsedBillData = papa.parse(rawBillData, { delimiter: '^' }).data;

        vc2_util.log(logTitle, '// parsedBillData length: ', (parsedBillData || []).length);
        var returnArr = [],
            arrRawData = [],
            currentBillObj = { lines: [] };

        parsedBillData.forEach(function (rowData) {
            vc2_util.log(logTitle, '...data: ', { line: rowData });

            if (rowData[0] == '|H|') {
                vc2_util.log(logTitle, '##### START NEW LINE #####');
                currentBillObj = {
                    invoice: trimPadding(rowData[4]),
                    date: trimPadding(rowData[6]),
                    po: trimPadding(rowData[7]),
                    charges: {
                        tax: 0,
                        shipping: 0,
                        other: 0
                    },
                    total: 0,
                    lines: []
                };
                arrRawData = [rowData];

                vc2_util.log(logTitle, '.... obj: ', currentBillObj);
            } else if (rowData[0] == '|D|') {
                vc2_util.log(logTitle, '---- ADD LINE TO CURRENT LINE ----');

                var lineData = {
                    ITEMNO: trimPadding(rowData[10]),
                    PRICE: trimPadding(rowData[5]).match(/\d|\./g).join('') * 1,
                    QUANTITY: trimPadding(rowData[3]).match(/\d|\./g).join('') * 1,
                    DESCRIPTION: trimPadding(rowData[13])
                };
                arrRawData.push(rowData);

                vc2_util.log(logTitle, '.... line: ', lineData);
                currentBillObj.lines.push(lineData);
            } else if (rowData[0] == '|T|') {
                
                var summary = {
                    taxAmount: trimPadding(rowData[3]).match(/\d|\./g).join('') * 1,
                    tax1: trimPadding(rowData[5]).match(/\d|\./g).join('') * 1,
                    tax2: trimPadding(rowData[6]).match(/\d|\./g).join('') * 1,
                    tax3: trimPadding(rowData[7]).match(/\d|\./g).join('') * 1,
                    freight: trimPadding(rowData[13]).match(/\d|\./g).join('') * 1,
                    handling: trimPadding(rowData[14]).match(/\d|\./g).join('') * 1,
                    ehfTotal: trimPadding(rowData[4]).match(/\d|\./g).join('') * 1,
                    invoiceTotal: trimPadding(rowData[9]).match(/\d|\./g).join('') * 1
                };
                arrRawData.push(rowData);
                vc2_util.log(logTitle, '---- SUMMARY LINE ----', summary);

                currentBillObj.total = summary.invoiceTotal;
                currentBillObj.charges.tax =
                    summary.taxAmount + summary.tax1 + summary.tax2 + summary.tax3;
                currentBillObj.charges.shipping = summary.freight + summary.handling;
                currentBillObj.charges.other = summary.ehfTotal;

                // then push it
                returnArr.push({
                    ordObj: currentBillObj, 
                    xmlStr: arrRawData.join('\n')
                });
            }
            return true;
        });
        vc2_util.log(logTitle, '.... returnArr: ', returnArr);

        return returnArr;
    }

    function trimPadding(str, char) {
        return str.replace(/^\s+|\s+$/g, '');
        s;
    }

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
