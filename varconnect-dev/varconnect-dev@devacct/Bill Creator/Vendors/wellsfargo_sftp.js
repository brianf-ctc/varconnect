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

define(['N/sftp', 'N/encode', '../Libraries/moment', '../Libraries/lodash'], function (
    ns_sftp,
    ns_encode,
    moment,
    lodash
) {
    function processXml(input, config) {
        // establish connection to remote FTP server
        var connection = ns_sftp.createConnection({
            username: config.user_id,
            passwordGuid: config.user_pass,
            url: config.url,
            directory: config.res_path,
            hostKey: config.host_key
        });

        var downloadedFile = connection.download({
            filename: input
        });

        xmlStr = ns_encode.convert({
            string: downloadedFile.getContents(),
            inputEncoding: ns_encode.Encoding.BASE_64,
            outputEncoding: ns_encode.Encoding.UTF_8
        });

        var fileObj = xmlStr.split(/\r?\n/);

        lodash.reverse(fileObj);

        var tmpArray = [];

        tmpArray.push('end_of_transaction');

        // we've pulled down the file, now lets pre-process it to deal with wf craziness

        fileObj.forEach(function (lineStr) {
            var lineObj = mapLine(lineStr);

            if (lineObj.hasOwnProperty('rec_type')) {
                tmpArray.push(lineObj);

                if (lineObj.rec_type == 'HDRH10') {
                    tmpArray.push('end_of_transaction');
                }
            }
        });

        lodash.reverse(tmpArray);

        if (typeof tmpArray[0] == 'string') {
            // since we flipped the array we need to make sure we're not starting with an end of transaction marker
            tmpArray.splice(0, 1);
        }

        var xmlArr = [];

        trxObj = {};
        trxObj.HDRH10 = {};
        trxObj.HDRH66 = [];
        trxObj.DTLD10 = [];
        trxObj.SUMS10 = [];
        var lastDTLD10 = 0;

        tmpArray.forEach(function (lineObj) {
            if (typeof lineObj == 'string') {
                // we've hit the end of a transaction - push the object and reset values

                log.debug('trxObj', trxObj);

                xmlArr.push(trxObj);

                trxObj = {};
                trxObj.HDRH10 = {};
                trxObj.HDRH66 = [];
                trxObj.DTLD10 = [];
                trxObj.SUMS10 = [];
                lastDTLD10 = 0;

                return;
            } else {
                //log.debug(i, JSON.stringify(lineObj));

                switch (lineObj.rec_type) {
                    case 'HDRH10':
                        trxObj.HDRH10 = lineObj;
                        break;

                    case 'HDRH66':
                        trxObj.HDRH66.push(lineObj);
                        break;

                    case 'DTLD10':
                        lastDTLD10 = trxObj.DTLD10.push(lineObj) - 1;
                        trxObj.DTLD10[lastDTLD10].DTLD40 = [];
                        trxObj.DTLD10[lastDTLD10].DTLD42 = [];
                        break;

                    case 'DTLD11':
                        trxObj.DTLD10[lastDTLD10].DTLD11 = lineObj;
                        break;

                    case 'DTLD15':
                        trxObj.DTLD10[lastDTLD10].DTLD15 = lineObj;
                        break;

                    case 'DTLD40':
                        trxObj.DTLD10[lastDTLD10].DTLD40.push(lineObj);
                        break;

                    case 'DTLD41':
                        trxObj.DTLD10[lastDTLD10].DTLD41 = lineObj;
                        break;

                    case 'DTLD42':
                        trxObj.DTLD10[lastDTLD10].DTLD42.push(lineObj);
                        break;

                    case 'DTLD43':
                        trxObj.DTLD10[lastDTLD10].DTLD43 = lineObj;
                        break;

                    case 'SUMS10':
                        trxObj.SUMS10.push(lineObj);
                        break;
                }
            }
        });

        log.debug('xmlArr', xmlArr);

        var returnArr = [];

        xmlArr.forEach(function (xmlLine) {
            var ordObj = {};

            var HDRH10 = xmlLine.HDRH10;
            var HDRH66 = xmlLine.HDRH66;
            var DTLD10 = xmlLine.DTLD10;
            var SUMS10 = xmlLine.SUMS10;

            ordObj.date = moment(HDRH10.invoice_date, 'YYMMDD').format('MM/DD/YYYY');
            ordObj.invoice = HDRH10.invoice_number;
            ordObj.po = HDRH10.purchase_order_number;
            ordObj.charges = {};
            ordObj.charges.tax = 0;
            ordObj.charges.shipping = 0;
            ordObj.charges.other = 0;

            // set due date if it exists
            for (var h = 0; h < HDRH66.length; h++) {
                if (HDRH66[h].payment_amount_qualifier == 'ZZ') {
                    ordObj.duedate = moment(HDRH66[h].scheduled_payment_date, 'YYYYMMDD').format(
                        'MM/DD/YYYY'
                    );
                }
            }

            ordObj.total = SUMS10[0].invoice_amount;

            // if the bill is less then or equal to $0 then skip it
            if (ordObj.total <= 0) {
                return;
            }

            SUMS10.forEach(function (sums_10, ctr) {
                log.error('SUMS10', JSON.stringify([SUMS10, sums_10, ctr]));

                if (sums_10.model_number == 'FREIGHT') {
                    ordObj.charges.shipping += sums_10.finance_charge;
                }
                if (sums_10.model_number == 'TAX') {
                    ordObj.charges.tax += sums_10.finance_charge;
                }
                if (sums_10.model_number == 'MISCELLANEOUS') {
                    ordObj.charges.other += sums_10.finance_charge;
                }

                return true;
            });
            ordObj.lines = [];

            DTLD10.forEach(function (dtld10) {
                // don't create bill lines if they don't have an amount;
                if (dtld10.line_amount == 0) {
                    return;
                }

                var lineObj = {};
                lineObj.SERIAL = [];
                lineObj.TRACKING = [];
                lineObj.CARRIER = '';

                lineObj.ITEMNO = dtld10.model_number;

                if (dtld10.hasOwnProperty('DTLD41')) {
                    if (dtld10.DTLD41.mfg_part_number && dtld10.DTLD41.mfg_part_number !== '') {
                        lineObj.ITEMNO = dtld10.DTLD41.mfg_part_number;
                    }
                    if (dtld10.DTLD41.scac_code !== '') {
                        lineObj.CARRIER = dtld10.DTLD41.scac_code;
                    }

                    if (
                        dtld10.DTLD41.extended_model_number &&
                        dtld10.DTLD41.extended_model_number !== ''
                    ) {
                        lineObj.ITEMNO_EXT = dtld10.DTLD41.extended_model_number;
                    }
                }

                if (dtld10.hasOwnProperty('DTLD15')) {
                    lineObj.DESCRIPTION = dtld10.DTLD15.product_discription;
                } else {
                    lineObj.DESCRIPTION = 'Not Included in Vendor Feed';
                }

                lineObj.PRICE = dtld10.unit_price;
                lineObj.QUANTITY = dtld10.line_quantity;

                // add any serial numbers
                if (dtld10.hasOwnProperty('DTLD40')) {
                    dtld10.DTLD40.forEach(function (dtld40) {
                        if (dtld40.serial_number_qualifier == 'SE' && dtld40.serial_number !== '') {
                            lineObj.SERIAL.push(dtld40.serial_number);
                        }
                    });
                }

                // add any tracking information
                if (dtld10.hasOwnProperty('DTLD42')) {
                    dtld10.DTLD42.forEach(function (dtld42) {
                        if (dtld42.ship_trace_number !== '') {
                            lineObj.TRACKING.push(dtld42.ship_trace_number);
                        }
                    });
                }

                lineObj.processed = false;

                var itemIdx = lodash.findIndex(ordObj.lines, {
                    ITEMNO: lineObj.ITEMNO,
                    PRICE: lineObj.PRICE
                });

                if (itemIdx !== -1) {
                    ordObj.lines[itemIdx].QUANTITY += lineObj.QUANTITY;

                    lineObj.SERIAL.forEach(function (serial) {
                        ordObj.lines[itemIdx].SERIAL.push(serial);
                    });

                    lineObj.TRACKING.forEach(function (tracking) {
                        ordObj.lines[itemIdx].TRACKING.push(tracking);
                    });

                    if ((ordObj.lines[itemIdx].CARRIER = '' && lineObj.CARRIER !== '')) {
                        ordObj.lines[itemIdx].CARRIER = lineObj.CARRIER;
                    }
                } else {
                    ordObj.lines.push(lineObj);
                }
            });

            var returnObj = {};
            returnObj.ordObj = ordObj;
            returnObj.xmlStr = JSON.stringify(xmlLine);
            returnArr.push(returnObj);
        });

        log.audit('returnArray', returnArr);
        return returnArr;
    }

    function mapLine(lineStr) {
        var lineType = lineStr.slice(0, 6);

        var returnObj = {};

        switch (lineType) {
            case 'HDRH10':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.invoice_date = trimPadding(lineStr.slice(27, 33));
                returnObj.invoice_number_two = trimPadding(lineStr.slice(33, 44));
                returnObj.purchase_order_number = trimPadding(lineStr.slice(44, 64));
                returnObj.invoice_type_indicator = trimPadding(lineStr.slice(64, 66));
                returnObj.filler = trimPadding(lineStr.slice(66, 74));
                returnObj.ge_distributor_number = trimPadding(lineStr.slice(74, 80));
                returnObj.repurchase_flag = trimPadding(lineStr.slice(80, 81));
                returnObj.transaction_type = trimPadding(lineStr.slice(81, 82));
                returnObj.filler_two = trimPadding(lineStr.slice(82, 194));
                break;

            // case 'HDRH20':

            //   returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
            //   returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
            //   returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
            //   returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
            //   returnObj.qualifier = trimPadding(lineStr.slice(27, 29));
            //   returnObj.reference_number = trimPadding(lineStr.slice(29, 59));
            //   returnObj.program_type_reference_name = trimPadding(lineStr.slice(59, 79));
            //   returnObj.filler = trimPadding(lineStr.slice(79, 89));
            //   returnObj.vat_amt_field = underPunchString(trimPadding(lineStr.slice(89, 100)));
            //   returnObj.filler_two = trimPadding(lineStr.slice(100, 194));
            //   break;

            // case 'HDRH30':

            //   returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
            //   returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
            //   returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
            //   returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
            //   returnObj.qualifier = trimPadding(lineStr.slice(27, 29));
            //   returnObj.name = trimPadding(lineStr.slice(29, 64));
            //   returnObj.buyer_qualifier_code = trimPadding(lineStr.slice(64, 66));
            //   returnObj.ge_assigned_number = trimPadding(lineStr.slice(66, 80));
            //   returnObj.filler = trimPadding(lineStr.slice(80, 194));
            //   break;

            case 'HDRH66':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.payment_amount_qualifier = trimPadding(lineStr.slice(27, 29));
                returnObj.scheduled_payment_date = trimPadding(lineStr.slice(29, 37));
                returnObj.scheduled_payment_amount = trimPadding(lineStr.slice(37, 51));
                returnObj.filler = trimPadding(lineStr.slice(51, 57));
                returnObj.late_charge_text = trimPadding(lineStr.slice(57, 77));
                returnObj.filler_two = trimPadding(lineStr.slice(77, 79));
                returnObj.epd_rate = trimPadding(lineStr.slice(79, 85));
                returnObj.epd_payment_date = trimPadding(lineStr.slice(85, 91));
                returnObj.epd_amount = trimPadding(lineStr.slice(91, 4));
                returnObj.epd_refund_pay_amount = trimPadding(lineStr.slice(4, 111));
                returnObj.epd_days = trimPadding(lineStr.slice(121, 124));
                returnObj.epd_rate_with_decimal = trimPadding(lineStr.slice(124, 131));
                returnObj.filler_three = trimPadding(lineStr.slice(131, 194));
                break;

            case 'DTLD10':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.line_number = trimPadding(lineStr.slice(27, 31));
                returnObj.line_quantity = trimPadding(lineStr.slice(31, 41)) * 1;
                returnObj.unit_of_measure = trimPadding(lineStr.slice(41, 43));
                returnObj.line_amount = underPunchString(trimPadding(lineStr.slice(43, 54)));
                returnObj.product_code_qualifier = trimPadding(lineStr.slice(54, 56));
                returnObj.model_number = trimPadding(lineStr.slice(56, 80));
                returnObj.po_line_number = trimPadding(lineStr.slice(80, 86));
                returnObj.unit_price = underPunchString(trimPadding(lineStr.slice(86, 97)));
                returnObj.dad03_unit_price = underPunchString(trimPadding(lineStr.slice(97, 110)));
                returnObj.dad03_quantity = underPunchString(trimPadding(lineStr.slice(110, 124)));
                returnObj.duration_months = underPunchString(trimPadding(lineStr.slice(124, 135)));
                returnObj.contract_start_date = trimPadding(lineStr.slice(135, 145));
                returnObj.contract_end_date = trimPadding(lineStr.slice(145, 155));
                returnObj.line_transaction_type = trimPadding(lineStr.slice(155, 156));
                returnObj.filler = trimPadding(lineStr.slice(156, 194));
                break;

            case 'DTLD11':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.invoice_line_number = trimPadding(lineStr.slice(27, 31));
                returnObj.mfg_part_number_qualifier = trimPadding(lineStr.slice(31, 33));
                returnObj.mfg_part_number = trimPadding(lineStr.slice(33, 43));
                returnObj.sku_id_qualifier = trimPadding(lineStr.slice(43, 45));
                returnObj.sku_id = trimPadding(lineStr.slice(45, 69));
                returnObj.mfg_number_qualifier = trimPadding(lineStr.slice(69, 17));
                returnObj.mfg_number = trimPadding(lineStr.slice(71, 77));
                returnObj.distributor_number_qualifier = trimPadding(lineStr.slice(77, 79));
                returnObj.distributor_number = trimPadding(lineStr.slice(79, 85));
                returnObj.program_code_qualifier = trimPadding(lineStr.slice(85, 87));
                returnObj.program_number = trimPadding(lineStr.slice(87, 92));
                returnObj.filler = trimPadding(lineStr.slice(92, 194));
                break;

            case 'DTLD15':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.invoice_line_number = trimPadding(lineStr.slice(27, 31));
                returnObj.product_discription_qualifier = trimPadding(lineStr.slice(31, 32));
                returnObj.product_discription = trimPadding(lineStr.slice(32, 80));
                returnObj.filler = trimPadding(lineStr.slice(80, 194));
                break;

            case 'DTLD40':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.serial_number_qualifier = trimPadding(lineStr.slice(27, 29));
                returnObj.serial_number = trimPadding(lineStr.slice(29, 59));
                returnObj.filler = trimPadding(lineStr.slice(59, 194));
                break;

            case 'DTLD41':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.mfg_part_number = trimPadding(lineStr.slice(27, 51));
                returnObj.vendor_part_number = trimPadding(lineStr.slice(51, 71));
                returnObj.vendor_upc_number = trimPadding(lineStr.slice(71, 91));
                returnObj.scac_code = trimPadding(lineStr.slice(91, 95));
                returnObj.extended_model_number = trimPadding(lineStr.slice(95, 125));
                returnObj.serial_number = trimPadding(lineStr.slice(125, 145));
                returnObj.vendor_code_number = trimPadding(lineStr.slice(145, 149));
                returnObj.filler = trimPadding(lineStr.slice(149, 194));
                break;

            case 'DTLD42':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.line_level_ship_via_desc = trimPadding(lineStr.slice(27, 47));
                returnObj.ship_trace_number = trimPadding(lineStr.slice(47, 72));
                returnObj.filler = trimPadding(lineStr.slice(72, 194));
                break;

            case 'DTLD43':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.tax_qualifier = trimPadding(lineStr.slice(27, 29));
                returnObj.tax_amount = trimPadding(lineStr.slice(29, 40));
                returnObj.tax_type = trimPadding(lineStr.slice(40, 42));
                returnObj.tax_rate = trimPadding(lineStr.slice(42, 47));
                returnObj.filler = trimPadding(lineStr.slice(47, 194));
                break;

            case 'SUMS10':
                returnObj.rec_type = trimPadding(lineStr.slice(0, 6));
                returnObj.issue_ge_branch_nbr = trimPadding(lineStr.slice(6, 10));
                returnObj.dealer_number = trimPadding(lineStr.slice(10, 16));
                returnObj.invoice_number = trimPadding(lineStr.slice(16, 27));
                returnObj.invoice_amount = underPunchString(trimPadding(lineStr.slice(27, 37)));
                returnObj.finance_charge = underPunchString(trimPadding(lineStr.slice(37, 48)));
                returnObj.tax_type = trimPadding(lineStr.slice(48, 50));
                returnObj.vat_amt = underPunchString(trimPadding(lineStr.slice(50, 61)));
                returnObj.vat_rate = underPunchString(trimPadding(lineStr.slice(61, 66)));
                returnObj.filler = trimPadding(lineStr.slice(66, 74));
                returnObj.distributor_number = trimPadding(lineStr.slice(74, 80));
                returnObj.filler_two = trimPadding(lineStr.slice(80, 81));
                returnObj.qst_pst_tax_qualifier = trimPadding(lineStr.slice(81, 83));
                returnObj.qst_pst_tax_amount = underPunchString(trimPadding(lineStr.slice(83, 94)));
                returnObj.all_tax_qualifier = trimPadding(lineStr.slice(94, 96));
                returnObj.tax_amount = underPunchString(trimPadding(lineStr.slice(96, 107)));
                returnObj.model_number_qualifier = trimPadding(lineStr.slice(107, 109));
                returnObj.model_number = trimPadding(lineStr.slice(109, 139));
                returnObj.manufacturer_number_qualifier = trimPadding(lineStr.slice(139, 141));
                returnObj.manufacturer_number = trimPadding(lineStr.slice(141, 147));
                returnObj.distributor_number_qualifier = trimPadding(lineStr.slice(147, 149));
                returnObj.distributor_number = trimPadding(lineStr.slice(149, 155));
                returnObj.program_code_qualifier = trimPadding(lineStr.slice(155, 157));
                returnObj.program_number = trimPadding(lineStr.slice(157, 162));
                returnObj.filler_two = trimPadding(lineStr.slice(162, 194));
                break;
        }
        return returnObj;
    }

    function trimPadding(str, char) {
        if (!char) {
            char = ' ';
        }
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
        return cleanStr;
    }

    function underPunchString(str) {
        if (!str || str == '') {
            return 0;
        }

        var firstPart = str.slice(0, str.length - 1);
        var lastPart = str.slice(str.length - 1, str.length);

        var map = {
            '{': '0',
            A: '1',
            B: '2',
            C: '3',
            D: '4',
            E: '5',
            F: '6',
            G: '7',
            H: '8',
            I: '9',
            '}': '0',
            J: '1',
            K: '2',
            L: '3',
            M: '4',
            N: '5',
            O: '6',
            P: '7',
            Q: '8',
            R: '9'
        };

        var newStr;

        var lp = lastPart;

        if (
            lp == '}' ||
            lp == 'J' ||
            lp == 'K' ||
            lp == 'L' ||
            lp == 'M' ||
            lp == 'N' ||
            lp == 'O' ||
            lp == 'P' ||
            lp == 'Q' ||
            lp == 'R'
        ) {
            newStr = (firstPart + map[lastPart]) * -0.01;
        } else {
            newStr = (firstPart + map[lastPart]) * 0.01;
        }
        return newStr.toFixed(2) * 1;
    }

    // Add the return statement that identifies the entry point function.
    return {
        processXml: processXml
    };
});
