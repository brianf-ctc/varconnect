/**
 * dh_sftp.js
 * @NApiVersion 2.x
 * @NModuleScope Public
 */



define(['N/log', '../Libraries/papa', 'N/sftp'],
    function(log, papa, sftp) {

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

            var xmlObj = papa.parse(xmlStr, {
                delimiter: "^",
            }).data;

            var returnArr = [];

            var returnObj = {};

            returnObj.xmlStr = xmlStr;

            var myObj = {};

            myObj.lines = [];

            for (var i = 0; i < xmlObj.length; i++) {
                if (xmlObj[i][0] == '|H|') {
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

                    var lineObj = {};

                    lineObj.processed = false;
                    // lineObj.ITEMNO = trimPadding(xmlObj[i][9], ' ');
                    lineObj.ITEMNO = trimPadding(xmlObj[i][10], ' ');
                    lineObj.PRICE = trimPadding(xmlObj[i][5], ' ').match(/\d|\./g).join('') * 1;
                    lineObj.QUANTITY = trimPadding(xmlObj[i][3], ' ').match(/\d|\./g).join('') * 1;
                    lineObj.DESCRIPTION = trimPadding(xmlObj[i][13], ' ');

                    myObj.lines.push(lineObj);

                } else if (xmlObj[i][0] == '|T|') {

                    myObj.total = trimPadding(xmlObj[i][9], ' ').match(/\d|\./g).join('') * 1;

                    myObj.charges.tax = trimPadding(xmlObj[i][3], ' ').match(/\d|\./g).join('') * 1;

                    myObj.charges.shipping = trimPadding(xmlObj[i][10], ' ').match(/\d|\./g).join('') * 1;
                    
                }

            }

            returnObj.ordObj = myObj;

            returnArr.push(returnObj);

            return returnArr;

        }

        function trimPadding(str, char) {
            var padChar = char;
            var trimLeftInt = 0;
            var trimRightInt = str.length;

            for (var i = 0; i < str.length; i++) {
                if (str[i] == padChar) {
                    trimLeftInt = i + 1;
                } else {
                    break;
                }
            }

            for (var i = str.length - 1; i > 0; i--) {
                if (str[i] == padChar) {
                    trimRightInt = i;
                } else {
                    break;
                }
            }

            var cleanStr = str.slice(trimLeftInt, trimRightInt);
            return cleanStr
        }

        // Add the return statement that identifies the entry point function.
        return {
            processXml: processXml
        }
    }
);