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
 * @Description VAR Connect library for netsuit record handling
 */

/**
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jan 1, 2020	    <author email>			Initial Build
 * 2.00		Nov 2, 2020		paolodl@nscatalyst.com	Add hash conversion to space for Ingram
 * 3.00		Feb 8, 2021		paolodl@nscatalyst.com	Add popylation for new date columns
 * 4.00		Jun 3, 2021		paolodl@nscatalyst.com	Add get order line function
 * 4.01		Jul 21,2021		paolodl@nscatalyst.com	Dynamic date parse
 * 4.02		Apr 8,2022		christian@nscatalyst.com	Date parse returns closest date for ETA
 *                                                      Updating fields overwrite value if append failed
 * 4.03		May 10,2022		christian@nscatalyst.com	Carrier info should not append to itself
 * 4.04		Jun 14,2022		christian@nscatalyst.com	Return errors and line key for updatePOItemData
 * 4.05		Jun 28,2022		christian@nscatalyst.com	Update po header and line order status
 *
 */

define([
    'N/search',
    'N/runtime',
    'N/record',
    'N/config',
    'N/format',
    './CTC_VC2_Lib_Record',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js'
], function (
    ns_search,
    ns_runtime,
    ns_record,
    ns_config,
    ns_format,
    vc2_record,
    vc2_util,
    vc2_constant
) {
    var LogTitle = 'NS_Library',
        LogPrefix;

    var Current = {
        dateFormat: null,
        PO_NUM: null,
        VendorLines: [],
        OrderLines: [],
        MainCFG: null,
        VendorCFG: null
    };

    var Helper = {
        logPrefix: function (option) {
            return vc2_util.getUsage() + LogPrefix;
        },
        logMsg: function (msg, objVar) {
            var logMsg = msg;
            if (!vc2_util.isEmpty(objVar)) logMsg += ' ' + JSON.stringify(objVar);
            return vc2_util.getUsage() + LogPrefix + ' ' + logMsg;
        },
        getDateFormat: function () {
            if (!Current.dateFormat) {
                var generalPref = ns_config.load({
                    type: ns_config.Type.COMPANY_PREFERENCES
                });
                Current.dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
            }
            return Current.dateFormat;
        }
    };

    var MAXLEN = {
        TEXT: 300,
        TEXTAREA: 3950,
        ERRORMSG: 'Maximum Field Length Exceeded'
    };

    var MAPPING = {
        lineColumn: {
            custcol_ctc_xml_dist_order_num: 'order_num', //text
            custcol_ctc_xml_date_order_placed: 'order_date', //text
            custcol_ctc_vc_order_placed_date: 'order_date', //date
            custcol_ctc_vc_shipped_date: 'ship_date', //date
            custcol_ctc_vc_eta_date: 'order_eta', //date
            custcol_ctc_xml_ship_date: 'ship_date', //text
            custcol_ctc_xml_carrier: 'carrier', // text
            custcol_ctc_vc_order_status: 'STATUS', // text
            custcol_ctc_xml_eta: 'order_eta', //textarea
            custcol_ctc_xml_tracking_num: 'tracking_num', // textarea
            custcol_ctc_xml_inb_tracking_num: 'tracking_num' // textarea
        },
        colVendorInfo: 'custcol_ctc_vc_vendor_info',
        vendorColumns: [
            'order_num',
            'order_status',
            'order_date',
            'order_eta',
            'ship_date',
            'tracking_num',
            'carrier',
            'STATUS'
            // 'serial_num'
        ],
        columnType: {
            date: [
                'custcol_ctc_vc_order_placed_date',
                'custcol_ctc_vc_eta_date',
                'custcol_ctc_vc_shipped_date'
            ],
            // entry: ['custcol_ctc_xml_carrier', 'custcol_ctc_vc_order_status'],
            // stack: ['custcol_ctc_xml_eta'],
            biglist: [
                'custcol_ctc_xml_tracking_num',
                'custcol_ctc_xml_inb_tracking_num',
                'custcol_ctc_xml_eta'
            ],
            list: [
                'custcol_ctc_xml_dist_order_num',
                'custcol_ctc_xml_date_order_placed',
                'custcol_ctc_xml_ship_date'
                // 'custcol_ctc_xml_tracking_num',
                // 'custcol_ctc_xml_inb_tracking_num'
            ]
        }
    };

    //***********************************************************************
    //** Update PO Fields with parsed XML data
    //***********************************************************************
    //	function updatePOItemData(poNum, lineData)
    function updatePOItemData_old(option) {
        var logTitle = [LogTitle, 'updatePOItemData'].join('::');

        Current.PO_NUM = option.poNum;
        Current.VendorLines = option.lineData; //vc2_util.copyValues();
        Current.MainCFG = option.mainConfig;
        Current.VendorCFG = option.vendorConfig;
        Current.PO_REC = option.po_record;
        returnValue = { id: null };

        LogPrefix = ['[', Current.PO_REC.type, ':', Current.PO_REC.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var isUpdatedPO = false,
            isUpdatedSO = false,
            mapLineOrderStatus = {};

        try {
            if (!Current.PO_REC || Current.PO_REC == null) throw 'Unable to update PO Record';

            var POData = {
                bypassVC: Current.PO_REC.getValue({ fieldId: 'custbody_ctc_bypass_vc' }),
                createdFromID: Current.PO_REC.getValue({ fieldId: 'createdfrom' }),
                isDropPO: Current.PO_REC.getValue({ fieldId: 'custbody_isdropshippo' }),
                DocNum: Current.PO_REC.getValue({ fieldId: 'tranid' })
            };
            var specialOrder = false;
            vc2_util.log(logTitle, '// PO Data: ', POData);

            if (POData.bypassVC) return returnValue;
            returnValue.id = POData.createdFromID;

            // checkForDuplicateItems(Current.PO_REC);
            Helper.getDateFormat();

            // extract lines from the PO
            Current.OrderLines = vc2_record.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: [
                    'item',
                    'quantity',
                    'rate',
                    'amount',
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN
                ]
            });

            // loop thru all vendor lines
            for (var i = 0; i < Current.VendorLines.length; i++) {
                var vendorLine = Current.VendorLines[i];

                vc2_util.log(logTitle, '*** Line Info *** ', vendorLine);

                try {
                    var orderLineMatch = vc2_record.findMatchingOrderLine({
                        record: Current.PO_REC,
                        mainConfig: Current.MainCFG,
                        vendorConfig: Current.VendorCFG,
                        orderLines: Current.OrderLines,
                        lineData: vendorLine
                    });

                    if (!orderLineMatch) {
                        throw (
                            'Could not find matching order line - ' +
                            [vendorLine.item_num, vendorLine.vendorSKU].join(':')
                        );
                    }

                    //Serial num link is created with a UE now
                    var lineNum = Current.PO_REC.selectLine({
                        sublistId: 'item',
                        line: orderLineMatch.line
                    });

                    returnValue.lineuniquekey = Current.PO_REC.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'lineuniquekey'
                    });

                    // updateField({
                    //     fieldID: 'custcol_ctc_xml_dist_order_num',
                    //     xmlVal: vendorLine.order_num
                    // });

                    updateField({
                        fieldID: 'custcol_ctc_xml_dist_order_num',
                        xmlVal: vendorLine.order_num
                    });
                    updateField({
                        fieldID: 'custcol_ctc_xml_date_order_placed',
                        xmlVal: vendorLine.order_date
                    });
                    updateField({ fieldID: 'custcol_ctc_xml_eta', xmlVal: vendorLine.order_eta });

                    // custcol_ctc_vc_order_placed_date
                    var nsDate = parseDate({ dateString: vendorLine.order_date });
                    if (nsDate)
                        updateField({
                            fieldID: 'custcol_ctc_vc_order_placed_date',
                            xmlVal: nsDate
                        });

                    // custcol_ctc_vc_eta_date
                    nsDate = parseDate({
                        dateString: vendorLine.order_eta,
                        returnClosestDate: true
                    });
                    if (nsDate) updateField({ fieldID: 'custcol_ctc_vc_eta_date', xmlVal: nsDate });

                    //  Don't use XML serial numbers on special order POs, warehouse will scan them in
                    if (!specialOrder) {
                        //Serials are viewed with a separate suitelet now
                        //updateFieldList (vendorLine.serial_num, Current.PO_REC, 'custcol_ctc_xml_serial_num', line_num);
                    }

                    if (
                        vendorLine.order_status &&
                        vendorLine.line_status &&
                        vendorLine.line_status != 'NA'
                    ) {
                        vendorLine.order_status =
                            'Order: ' +
                            vendorLine.order_status +
                            '\nItem: ' +
                            vendorLine.line_status;
                        mapLineOrderStatus[lineNum + ''] = vendorLine.order_status;
                    }
                    updateField({ fieldID: 'custcol_ctc_xml_carrier', xmlVal: vendorLine.carrier });
                    updateField({
                        fieldID: 'custcol_ctc_vc_order_status',
                        xmlVal: mapLineOrderStatus[lineNum + ''] || vendorLine.order_status
                    });

                    updateFieldList({
                        xmlnum: vendorLine.ship_date,
                        fieldID: 'custcol_ctc_xml_ship_date'
                    });

                    if (POData.isDropPO || !Current.MainCFG.useInboundTrackingNumbers)
                        updateFieldList({
                            xmlnum: vendorLine.tracking_num,
                            fieldID: 'custcol_ctc_xml_tracking_num'
                        });
                    else
                        updateFieldList({
                            xmlnum: vendorLine.tracking_num,
                            fieldID: 'custcol_ctc_xml_inb_tracking_num'
                        });

                    isUpdatedPO = true;

                    Current.PO_REC.commitLine({ sublistId: 'item' });
                } catch (line_error) {
                    vc2_util.log(logTitle, { type: 'error', msg: '## LINE ERROR ## ' }, line_error);
                    vc2_util.vcLog({
                        title: 'Update Record Line | Error',
                        error: line_error,
                        transaction: Current.PO_REC ? Current.PO_REC.id : null,
                        isError: true
                    });
                    continue;
                }
            }

            if (isUpdatedPO) {
                Current.PO_REC.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                returnValue.lineuniquekey = null;
            }
        } catch (err) {
            vc2_util.logError(logTitle, err);
            vc2_util.vcLog({
                title: 'Update Record | Error',
                error: err,
                transaction: Current.PO_REC ? Current.PO_REC.id : null,
                isError: true
            });

            returnValue.id = null;
            returnValue.error = err;
        }

        return returnValue;
    }
    function updatePOItemData_v1(option) {
        var logTitle = [LogTitle, 'updatePOItemData'].join('::');

        Current.PO_NUM = option.poNum;
        Current.VendorLines = option.lineData; //vc2_util.copyValues();
        Current.MainCFG = option.mainConfig;
        Current.VendorCFG = option.vendorConfig;
        Current.PO_REC = option.po_record;
        returnValue = { id: null };

        LogPrefix = ['[', Current.PO_REC.type, ':', Current.PO_REC.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var isUpdatedPO = false,
            isUpdatedSO = false,
            mapLineOrderStatus = {};

        try {
            if (!Current.PO_REC || Current.PO_REC == null) throw 'Unable to update PO Record';

            var POData = {
                bypassVC: Current.PO_REC.getValue({ fieldId: 'custbody_ctc_bypass_vc' }),
                createdFromID: Current.PO_REC.getValue({ fieldId: 'createdfrom' }),
                isDropPO: Current.PO_REC.getValue({ fieldId: 'custbody_isdropshippo' }),
                DocNum: Current.PO_REC.getValue({ fieldId: 'tranid' })
            };
            var specialOrder = false;
            vc2_util.log(logTitle, '// PO Data: ', POData);

            if (POData.bypassVC) return returnValue;
            returnValue.id = POData.createdFromID;

            // checkForDuplicateItems(po_record);
            Helper.getDateFormat();

            // extract lines from the PO
            Current.OrderLines = vc2_record.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: [
                    'item',
                    'quantity',
                    'rate',
                    'amount',
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN
                ]
            });

            vc2_util.log(logTitle, '###### UPDATE PO LINES: START ######');

            // loop thru all vendor lines
            for (var i = 0; i < Current.VendorLines.length; i++) {
                var vendorLine = Current.VendorLines[i];
                vc2_util.log(logTitle, '***** Line Info ****** ', vendorLine);

                try {
                    var orderLineMatch = vc2_record.findMatchingOrderLine({
                        record: Current.PO_REC,
                        mainConfig: Current.MainCFG,
                        vendorConfig: Current.VendorCFG,
                        orderLines: Current.OrderLines,
                        lineData: vendorLine
                    });

                    if (!orderLineMatch) {
                        throw (
                            'Could not find matching order line - ' +
                            [vendorLine.item_num, vendorLine.vendorSKU].join(':')
                        );
                    }

                    ///////////////////////
                    // set the vendorStatus
                    var vendorStatus = [];
                    if (vendorLine.order_num && vendorLine.order_num != 'NA')
                        vendorStatus.push('Order:' + vendorLine.order_num);
                    if (vendorLine.order_status && vendorLine.order_status != 'NA')
                        vendorStatus.push('Status:' + vendorLine.order_status);
                    if (vendorLine.line_status && vendorLine.line_status != 'NA')
                        vendorStatus.push('Item:' + vendorLine.line_status);
                    if (vendorLine.ship_qty) vendorStatus.push('Qty:' + vendorLine.ship_qty);

                    if (vendorStatus.length) vendorLine.STATUS = vendorStatus.join('\n');
                    ///////////////////////

                    var updateLineValues = {},
                        orderLineData = vc2_record.extractLineValues({
                            record: Current.PO_REC,
                            line: orderLineMatch.line,
                            columns: vc2_util.arrayKeys(MAPPING.lineColumn)
                        });

                    vc2_util.log(logTitle, '-- orderLineMatch: ', [orderLineMatch, orderLineData]);

                    // loop thru the vendor columns
                    for (var ii = 0, jj = MAPPING.vendorColumns.length; ii < jj; ii++) {
                        var vendorCol = MAPPING.vendorColumns[ii],
                            orderCols = vc2_util.getKeysFromValues({
                                source: MAPPING.lineColumn,
                                value: vendorCol
                            }),
                            vendorValue = vendorLine[vendorCol];

                        // skip empty value or NA
                        if (vc2_util.isEmpty(vendorValue) || vendorValue == 'NA') continue;

                        for (var iii = 0, jjj = orderCols.length; iii < jjj; iii++) {
                            var currLineCol = orderCols[iii],
                                currValue = orderLineData[currLineCol];

                            // set the new
                            var newValue = vendorValue;

                            // if (!vc2_util.inArray(currLineCol, MAPPING.columnType.list)) continue;

                            if (vc2_util.inArray(currLineCol, MAPPING.columnType.list)) {
                                var currList =
                                    currValue &&
                                    currValue !== 'NA' &&
                                    currValue !== 'Duplicate Item'
                                        ? currValue.split(/\n/)
                                        : [];

                                if (!vc2_util.inArray(newValue, currList)) {
                                    // custcol_ctc_xml_eta is a stack
                                    if (currLineCol == 'custcol_ctc_xml_eta') {
                                        currList.unshift(newValue); // place on top
                                    } else {
                                        currList.push(newValue);
                                    }
                                }
                                newValue = currList.join('\n');

                                if (currValue != newValue)
                                    updateLineValues[currLineCol] =
                                        newValue.length > MAXLEN.TEXT
                                            ? newValue.substr(0, MAXLEN.TEXT - 1)
                                            : newValue;
                            } else if (vc2_util.inArray(currLineCol, MAPPING.columnType.biglist)) {
                                if (!currValue || currValue == 'NA') {
                                    newValue = newValue.replace(/[","]+/g, '\n');
                                } else {
                                    var currListValue = currValue.replace('\r', ''),
                                        currList = currListValue.split('\n'),
                                        newValueList = vendorValue.split(',');

                                    // check if the field is not maxxed out yet
                                    if (!vc2_util.inArray(MAXLEN.ERRORMSG, currList)) {
                                        newValueList.forEach(function (newVal) {
                                            if (newVal && newVal != 'NA') {
                                                if (!vc2_util.inArray(newVal, currList))
                                                    currList.push(newVal);

                                                if (
                                                    currList.join('\n').length >
                                                    MAXLEN.TEXTAREA - 50
                                                ) {
                                                    currList.pop(); // remove the newVal
                                                    currList.push(MAXLEN.ERRORMSG); // add the errormsg
                                                }
                                            }

                                            return true;
                                        });

                                        newValue = currList.join('\n');
                                    }
                                    if (currValue != newValue)
                                        updateLineValues[currLineCol] = newValue;
                                }

                                if (currValue != newValue)
                                    updateLineValues[currLineCol] =
                                        newValue.length > MAXLEN.TEXTAREA
                                            ? newValue.substr(0, MAXLEN.TEXTAREA - 10)
                                            : newValue;
                            } else if (vc2_util.inArray(currLineCol, MAPPING.columnType.date)) {
                                newValue =
                                    vendorCol == 'order_eta'
                                        ? parseDate({
                                              dateString: vendorValue,
                                              returnClosestDate: true
                                          })
                                        : parseDate({
                                              dateString: vendorValue
                                          });

                                updateLineValues[currLineCol] = newValue;
                            } else {
                                // for everything else, just overwrite if not the same value already
                                if (currValue != newValue) updateLineValues[currLineCol] = newValue;
                            }

                            // vc2_util.log(logTitle, '..... col: ', {
                            //     col: currLineCol,
                            //     curval: currValue || '',
                            //     xmlcol: vendorCol,
                            //     vendorVal: vendorValue,
                            //     newval: newValue || '',
                            //     issame: newValue == currValue
                            // });

                            // only update if not the same
                        } // endloop - orderCols
                    }
                    vc2_util.log(logTitle, '...updateLineValues', updateLineValues);

                    if (!vc2_util.isEmpty(updateLineValues)) {
                        updateLineValues.line = orderLineMatch.line;
                        updateLineValues[MAPPING.colVendorInfo] = JSON.stringify(vendorLine);

                        // check for length
                        if (
                            updateLineValues[MAPPING.colVendorInfo] &&
                            updateLineValues[MAPPING.colVendorInfo].length &&
                            updateLineValues[MAPPING.colVendorInfo].length > MAXLEN.TEXTAREA
                        ) {
                            updateLineValues[MAPPING.colVendorInfo] = updateLineValues[
                                MAPPING.colVendorInfo
                            ].substr(0, MAXLEN.TEXTAREA);
                        }

                        isUpdatedPO = true;

                        vc2_record.updateLine({
                            record: Current.PO_REC,
                            lineData: updateLineValues
                        });
                    }
                } catch (line_error) {
                    vc2_util.log(logTitle, { type: 'error', msg: '## LINE ERROR ## ' }, line_error);
                    vc2_util.vcLog({
                        title: 'Update Record Line | Error',
                        error: line_error,
                        transaction: Current.PO_REC ? Current.PO_REC.id : null,
                        isError: true
                    });
                    continue;
                }
            }

            if (isUpdatedPO) {
                Current.PO_REC.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                returnValue.lineuniquekey = null;

                vc2_util.log(logTitle, ' // PO updated successfully');
            }
        } catch (err) {
            vc2_util.logError(logTitle, err);
            vc2_util.vcLog({
                title: 'Update Record | Error',
                error: err,
                transaction: Current.PO_REC ? Current.PO_REC.id : null,
                isError: true
            });

            returnValue.id = null;
            returnValue.error = err;
        } finally {
            vc2_util.log(logTitle, '###### UPDATE PO LINES: END ######', returnValue);
        }

        return returnValue;
    }

    function updatePOItemData(option) {
        var logTitle = [LogTitle, 'updatePOItemData'].join('::');

        Current.PO_NUM = option.poNum;
        Current.VendorLines = option.lineData; //vc2_util.copyValues();
        Current.MainCFG = option.mainConfig;
        Current.VendorCFG = option.vendorConfig;
        Current.PO_REC = option.po_record;
        returnValue = { id: null };

        LogPrefix = ['[', Current.PO_REC.type, ':', Current.PO_REC.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var isUpdatedPO = false,
            isUpdatedSO = false,
            mapLineOrderStatus = {};

        try {
            if (!Current.PO_REC || Current.PO_REC == null) throw 'Unable to update PO Record';

            var POData = {
                bypassVC: Current.PO_REC.getValue({ fieldId: 'custbody_ctc_bypass_vc' }),
                createdFromID: Current.PO_REC.getValue({ fieldId: 'createdfrom' }),
                isDropPO: Current.PO_REC.getValue({ fieldId: 'custbody_isdropshippo' }),
                DocNum: Current.PO_REC.getValue({ fieldId: 'tranid' })
            };
            var specialOrder = false;
            vc2_util.log(logTitle, '// PO Data: ', POData);

            if (POData.bypassVC) return returnValue;
            returnValue.id = POData.createdFromID;

            // checkForDuplicateItems(po_record);
            Helper.getDateFormat();

            // extract lines from the PO
            Current.OrderLines = vc2_record.extractRecordLines({
                record: Current.PO_REC,
                findAll: true,
                columns: [
                    'item',
                    'quantity',
                    'rate',
                    'amount',
                    vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                    vc2_constant.FIELD.TRANSACTION.DH_MPN
                ]
            });

            vc2_util.log(logTitle, '###### UPDATE PO LINES: START ######');

            // loop thru all vendor lines
            for (var i = 0; i < Current.VendorLines.length; i++) {
                var vendorLine = Current.VendorLines[i];
                vc2_util.log(logTitle, '***** Line Info ****** ', vendorLine);

                try {
                    var orderLineMatch = vc2_record.findMatchingOrderLine({
                        record: Current.PO_REC,
                        mainConfig: Current.MainCFG,
                        vendorConfig: Current.VendorCFG,
                        orderLines: Current.OrderLines,
                        lineData: vendorLine
                    });

                    if (!orderLineMatch) {
                        throw (
                            'Could not find matching order line - ' +
                            [vendorLine.item_num, vendorLine.vendorSKU].join(':')
                        );
                    }

                    ///////////////////////
                    // set the vendorStatus
                    var vendorStatus = [];
                    if (vendorLine.order_num && vendorLine.order_num != 'NA')
                        vendorStatus.push('Order:' + vendorLine.order_num);
                    if (vendorLine.order_status && vendorLine.order_status != 'NA')
                        vendorStatus.push('Status:' + vendorLine.order_status);
                    if (vendorLine.line_status && vendorLine.line_status != 'NA')
                        vendorStatus.push('Item:' + vendorLine.line_status);
                    if (vendorLine.ship_qty) vendorStatus.push('Qty:' + vendorLine.ship_qty);

                    if (vendorStatus.length) vendorLine.STATUS = vendorStatus.join('\n');
                    ///////////////////////

                    var updateLineValues = {},
                        orderLineData = vc2_record.extractLineValues({
                            record: Current.PO_REC,
                            line: orderLineMatch.line,
                            columns: vc2_util.arrayKeys(MAPPING.lineColumn)
                        });

                    vc2_util.log(logTitle, '-- orderLineMatch: ', [orderLineMatch, orderLineData]);

                    // loop thru the vendor columns
                    for (var ii = 0, jj = MAPPING.vendorColumns.length; ii < jj; ii++) {
                        var vendorCol = MAPPING.vendorColumns[ii],
                            orderCols = vc2_util.getKeysFromValues({
                                source: MAPPING.lineColumn,
                                value: vendorCol
                            }),
                            vendorValue = vendorLine[vendorCol];

                        // skip empty value or NA
                        if (vc2_util.isEmpty(vendorValue) || vendorValue == 'NA') continue;

                        for (var iii = 0, jjj = orderCols.length; iii < jjj; iii++) {
                            var currLineCol = orderCols[iii],
                                currValue = orderLineData[currLineCol];

                            // set the new
                            var newValue = vendorValue;

                            // if (!vc2_util.inArray(currLineCol, MAPPING.columnType.list)) continue;

                            if (vc2_util.inArray(currLineCol, MAPPING.columnType.list)) {
                                var currList =
                                    currValue &&
                                    currValue !== 'NA' &&
                                    currValue !== 'Duplicate Item'
                                        ? currValue.split(/\n/)
                                        : [];

                                if (!vc2_util.inArray(newValue, currList)) {
                                    // custcol_ctc_xml_eta is a stack
                                    if (currLineCol == 'custcol_ctc_xml_eta') {
                                        currList.unshift(newValue); // place on top
                                    } else {
                                        currList.push(newValue);
                                    }
                                }
                                newValue = currList.join('\n');

                                if (currValue != newValue)
                                    updateLineValues[currLineCol] =
                                        newValue.length > MAXLEN.TEXT
                                            ? newValue.substr(0, MAXLEN.TEXT - 1)
                                            : newValue;
                            } else if (vc2_util.inArray(currLineCol, MAPPING.columnType.biglist)) {
                                if (!currValue || currValue == 'NA') {
                                    newValue = newValue.replace(/[","]+/g, '\n');
                                } else {
                                    var currListValue = currValue.replace('\r', ''),
                                        currList = currListValue.split('\n'),
                                        newValueList = vendorValue.split(',');

                                    // check if the field is not maxxed out yet
                                    if (!vc2_util.inArray(MAXLEN.ERRORMSG, currList)) {
                                        newValueList.forEach(function (newVal) {
                                            if (newVal && newVal != 'NA') {
                                                if (!vc2_util.inArray(newVal, currList))
                                                    currList.push(newVal);

                                                if (
                                                    currList.join('\n').length >
                                                    MAXLEN.TEXTAREA - 50
                                                ) {
                                                    currList.pop(); // remove the newVal
                                                    currList.push(MAXLEN.ERRORMSG); // add the errormsg
                                                }
                                            }

                                            return true;
                                        });

                                        newValue = currList.join('\n');
                                    }
                                    if (currValue != newValue)
                                        updateLineValues[currLineCol] = newValue;
                                }

                                if (currValue != newValue)
                                    updateLineValues[currLineCol] =
                                        newValue.length > MAXLEN.TEXTAREA
                                            ? newValue.substr(0, MAXLEN.TEXTAREA - 10)
                                            : newValue;
                            } else if (vc2_util.inArray(currLineCol, MAPPING.columnType.date)) {
                                newValue =
                                    vendorCol == 'order_eta'
                                        ? parseDate({
                                              dateString: vendorValue,
                                              returnClosestDate: true
                                          })
                                        : parseDate({
                                              dateString: vendorValue
                                          });

                                updateLineValues[currLineCol] = newValue;
                            } else {
                                // for everything else, just overwrite if not the same value already
                                if (currValue != newValue) updateLineValues[currLineCol] = newValue;
                            }

                            // vc2_util.log(logTitle, '..... col: ', {
                            //     col: currLineCol,
                            //     curval: currValue || '',
                            //     xmlcol: vendorCol,
                            //     vendorVal: vendorValue,
                            //     newval: newValue || '',
                            //     issame: newValue == currValue
                            // });

                            // only update if not the same
                        } // endloop - orderCols
                    }
                    vc2_util.log(logTitle, '...updateLineValues', updateLineValues);

                    if (!vc2_util.isEmpty(updateLineValues)) {
                        updateLineValues.line = orderLineMatch.line;
                        updateLineValues[MAPPING.colVendorInfo] = JSON.stringify(vendorLine);

                        // check for length
                        if (
                            updateLineValues[MAPPING.colVendorInfo] &&
                            updateLineValues[MAPPING.colVendorInfo].length &&
                            updateLineValues[MAPPING.colVendorInfo].length > MAXLEN.TEXTAREA
                        ) {
                            updateLineValues[MAPPING.colVendorInfo] = updateLineValues[
                                MAPPING.colVendorInfo
                            ].substr(0, MAXLEN.TEXTAREA);
                        }

                        isUpdatedPO = true;

                        vc2_record.updateLine({
                            record: Current.PO_REC,
                            lineData: updateLineValues
                        });
                    }
                } catch (line_error) {
                    vc2_util.log(logTitle, { type: 'error', msg: '## LINE ERROR ## ' }, line_error);
                    vc2_util.vcLog({
                        title: 'Update Record Line | Error',
                        error: line_error,
                        transaction: Current.PO_REC ? Current.PO_REC.id : null,
                        isError: true
                    });
                    continue;
                }
            }

            if (isUpdatedPO) {
                Current.PO_REC.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                returnValue.lineuniquekey = null;

                vc2_util.log(logTitle, ' // PO updated successfully');
            }
        } catch (err) {
            vc2_util.logError(logTitle, err);
            vc2_util.vcLog({
                title: 'Update Record | Error',
                error: err,
                transaction: Current.PO_REC ? Current.PO_REC.id : null,
                isError: true
            });

            returnValue.id = null;
            returnValue.error = err;
        } finally {
            vc2_util.log(logTitle, '###### UPDATE PO LINES: END ######', returnValue);
        }

        return returnValue;
    }

    /**
     * Matches item number to PO line number
     * @param {obj} po_record the opened PO record
     * @param {str} itemNum the display item number to be matched
     * @param {*} vendorSKU optionally the vendorSKU if matching that instead of mpn
     * @returns {int} the line number of the matching item or null
     */
    function validateLineNumber(option) {
        //po_record, itemNum, vendorSKU, hashSpace, xmlVendor
        var logTitle = [LogTitle, 'validateLineNumber'].join('::'),
            returnValue = null;

        var lineData = option.lineData,
            orderLines = option.orderLines || Current.OrderLines,
            hashSpace =
                option.ingramHashSpace || Current.MainCFG ? Current.MainCFG.ingramHashSpace : null,
            xmlVendor = option.xmlVendor || Current.VendorCFG ? Current.VendorCFG.xmlVendor : null;

        Current.PO_REC = option.po_record || Current.PO_REC;
        lineData.vendorSKU = lineData.vendorSKU || lineData.item_num_alt;

        vc2_util.log(logTitle, '>> lineData: ', lineData);
        var VendorList = vc2_constant.LIST.XML_VENDOR,
            GlobalVar = vc2_constant.GLOBAL;

        try {
            if (vc2_util.isEmpty(lineData.item_num) || lineData.item_num == 'NA')
                throw 'Item number is missing';

            var lineNotFound = false,
                matchFound = false,
                lineItemValues = {},
                i;
            for (var i = 0; i <= orderLines.length; i++) {
                var orderLine = orderLines[i];
                vc2_util.log(logTitle, '...order linevalues: ', orderLineData);

                lineItemValues = {
                    itemNum: orderLine[GlobalVar.ITEM_ID_LOOKUP_COL],
                    skuName: GlobalVar.VENDOR_SKU_LOOKUP_COL
                        ? orderLine[GlobalVar.VENDOR_SKU_LOOKUP_COL]
                        : null,
                    dnhName: orderLine[vc2_constant.FIELD.TRANSACTION.DH_MPN]
                };

                vc2_util.log(logTitle, '... line values: ', lineItemValues);

                // check for itemNum or skuName
                if (
                    // check for itemNum
                    lineData.item_num == lineItemValues.itemNum ||
                    // check for vendorSKU
                    (lineData.vendorSKU && lineData.vendorSKU == lineItemValues.skuName) ||
                    // check for dnh
                    (xmlVendor == VendorList.DandH &&
                        vc2_util.inArray(lineItemValues.dnhName, [
                            lineData.item_num,
                            lineData.vendorSKU
                        ]))
                ) {
                    // match found;
                    matchFound = true;
                    break;
                }

                // check for ingram match
                if (
                    Current.MainCFG.ingramHashSpace &&
                    vc2_util.inArray(Current.VendorCFG.xmlVendor, [
                        VendorList.INGRAM_MICRO_V_ONE,
                        VendorList.INGRAM_MICRO
                    ])
                ) {
                    // check for itemNum
                    if (lineItemValues.itemNum.replace('#', ' ') == lineData.item_num) break;
                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                record;
            }

            var lineCount = Current.PO_REC.getLineCount({ sublistId: 'item' });
            if (lineCount <= 0) throw 'No line items found';

            for (i = 0; i < lineCount; i++) {
                lineNotFound = false;

                lineItemValues = {
                    itemNum: Current.PO_REC.getSublistText({
                        sublistId: 'item',
                        fieldId: vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                        line: i
                    }),
                    skuName: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                        ? Current.PO_REC.getSublistText({
                              sublistId: 'item',
                              fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                              line: i
                          })
                        : null,
                    dnhName: Current.PO_REC.getSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        line: i
                    })
                };

                vc2_util.log(logTitle, '// lineValues: ', lineItemValues);

                // check for itemNum or skuName
                if (
                    // check for itemNum
                    lineData.item_num == lineItemValues.itemNum ||
                    // check for vendorSKU
                    (lineData.vendorSKU && lineData.vendorSKU == lineItemValues.skuName) ||
                    // check for dnh
                    (xmlVendor == VendorList.DandH &&
                        vc2_util.inArray(lineItemValues.dnhName, [
                            lineData.item_num,
                            lineData.vendorSKU
                        ]))
                ) {
                    // match found;
                    matchFound = true;
                    break;
                }

                // check for ingram match
                if (
                    Current.MainCFG.ingramHashSpace &&
                    vc2_util.inArray(Current.VendorCFG.xmlVendor, [
                        VendorList.INGRAM_MICRO_V_ONE,
                        VendorList.INGRAM_MICRO
                    ])
                ) {
                    // check for itemNum
                    if (lineItemValues.itemNum.replace('#', ' ') == lineData.item_num) break;
                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                var tempItemNum = Current.PO_REC.getSublistText({
                    sublistId: 'item',
                    fieldId: vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    line: i
                });

                var tempVendorSKU = vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL
                    ? Current.PO_REC.getSublistText({
                          sublistId: 'item',
                          fieldId: vc2_constant.GLOBAL.VENDOR_SKU_LOOKUP_COL,
                          line: i
                      })
                    : null;

                // check for itemNum
                if (tempItemNum == lineData.item_num) break;

                // check for vendorSKU
                if (lineData.vendorSKU && tempVendorSKU && tempVendorSKU == lineData.vendorSKU)
                    break;

                //Ingram Hash replacement
                if (
                    Current.MainCFG.ingramHashSpace &&
                    (Current.VendorCFG.xmlVendor == VendorList.INGRAM_MICRO_V_ONE ||
                        Current.VendorCFG.xmlVendor == VendorList.INGRAM_MICRO)
                ) {
                    // check for itemNum
                    if (lineData.item_num.replace('#', ' ') == tempItemNum) break;

                    // check vendor SKUI
                    if (
                        lineData.vendorSKU &&
                        tempVendorSKU &&
                        lineData.vendorSKU.replace('#', ' ') == tempVendorSKU
                    )
                        break;
                }

                if (Current.VendorCFG.xmlVendor == VendorList.DandH) {
                    //D&H Item replacement
                    var dAndhItem = Current.PO_REC.getSublistValue({
                        sublistId: 'item',
                        fieldId: vc2_constant.FIELD.TRANSACTION.DH_MPN,
                        line: i
                    });

                    if (dAndhItem == lineData.item_num) break;
                }

                // we reached this, line not yet found
                lineNotFound = true;
            }

            returnValue = lineNotFound ? null : i;
        } catch (error) {
            vc2_util.logError(logTitle, error);
            returnValue = null;
        } finally {
            vc2_util.log(logTitle, '// Line Number: ', returnValue);
        }

        return returnValue;
    }

    /**
     * Sets column field value, appending if already set and not equal
     * @param {obj} po_record the opened PO record
     * @param {str} fieldID the internal id of the field to be updated
     * @param {str} xmlVal the value to be set in the field
     * @returns {*} void
     */
    function updateField(option) {
        // po_record, fieldID, xmlVal) {
        var po_record = option.po_record || Current.PO_REC,
            fieldID = option.fieldID,
            xmlVal = option.xmlVal;

        var logTitle = [LogTitle, 'updateField'].join('::');
        LogPrefix = ['[', po_record.type, ':', po_record.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var maxFieldLength = 290; // free form text fields have max length of 300 chars

        var currentFieldValue = po_record.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: fieldID
        });

        if (
            currentFieldValue != null &&
            currentFieldValue.length > 0 &&
            currentFieldValue != 'NA'
        ) {
            if (
                // fieldid is custcol_ctc_xml_carrier || custcol_ctc_vc_order_status OR
                ['custcol_ctc_xml_carrier', 'custcol_ctc_vc_order_status'].indexOf(fieldID) >= 0 ||
                // newValue is not currentValue, and newValue is not NA
                (currentFieldValue.indexOf(xmlVal) < 0 && xmlVal != 'NA')
            ) {
                var newFieldValue = null;
                // some fields should just be overwritten
                if (
                    ['custcol_ctc_xml_carrier', 'custcol_ctc_vc_order_status'].indexOf(fieldID) >= 0
                ) {
                    // some fields should just be overwritten
                    newFieldValue = xmlVal;
                } else if (
                    // some field values should stack instead of appending
                    ['custcol_ctc_xml_eta'].indexOf(fieldID) >= 0
                ) {
                    newFieldValue = xmlVal + '\n' + currentFieldValue;
                } else {
                    newFieldValue = currentFieldValue + '\n' + xmlVal;
                }

                // if it exceeded 300
                if (newFieldValue && newFieldValue.length > 300) {
                    newFieldValue = newFieldValue.substr(0, maxFieldLength);
                }

                if (newFieldValue != currentFieldValue) {
                    po_record.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fieldID,
                        value: newFieldValue
                    });

                    var returnedNewFieldValue = po_record.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: fieldID
                    });

                    if (
                        !returnedNewFieldValue ||
                        (returnedNewFieldValue != newFieldValue && newFieldValue != xmlVal)
                    ) {
                        po_record.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: fieldID,
                            value: xmlVal
                        });
                    }
                }
            }
        } else if (xmlVal && xmlVal != null && xmlVal != undefined) {
            po_record.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: fieldID,
                value: xmlVal
            });
        }
    }

    /**
     * Sets column field list value, appending if already set and not equal
     * @param {str} xmlVal the comma separated values to be set in the field
     * @param {obj} po_record the opened PO record
     * @param {str} fieldID the internal id of the field to be updated
     * @returns {*} void
     */
    function updateFieldList(option) {
        //(xmlNumbers, po_record, fieldID) {

        var po_record = option.po_record || Current.PO_REC,
            xmlNumbers = option.xmlNumbers || option.xmlnum,
            fieldID = option.fieldID;

        var logTitle = [LogTitle, 'updateFieldList'].join('::');
        LogPrefix = ['[', po_record.type, ':', po_record.id, '] '].join('');
        vc2_util.LogPrefix = LogPrefix;

        var errorMsg = 'Maximum Field Length Exceeded';
        var errorFound = false;
        var maxFieldLength = 3950;

        // split up the comma delimited line data into arrays for easier processing
        if (xmlNumbers && xmlNumbers != null && xmlNumbers != undefined) {
            var scannedNums = new Array();
            if (typeof xmlNumbers == 'string') scannedNums = xmlNumbers.split(',');
            else scannedNums = xmlNumbers;
            try {
                var currentNumbers = po_record.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: fieldID
                });

                if (currentNumbers != null) {
                    if (currentNumbers == 'NA' || (currentNumbers.length = 0)) {
                        var newValue = xmlNumbers.replace(/[","]+/g, '\n');

                        if (newValue && newValue != null && newValue != undefined)
                            po_record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: fieldID,
                                value: newValue
                            });

                        if (fieldID == 'custcol_ctc_xml_ship_date') {
                            var newDate = parseDate({ dateString: newValue });
                            if (newDate && newDate != null && newDate != undefined)
                                po_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ctc_vc_shipped_date',
                                    value: newDate
                                });
                        }
                    } else {
                        /* remove \r chars */
                        var newCurrent = currentNumbers.split('\r').join('');

                        var newNumAdded = false;

                        var currentNumbersList = Array();
                        currentNumbersList = newCurrent.split('\n');

                        /** check to see if the field already exceeds the max length **/
                        if (currentNumbersList[currentNumbersList.length - 1] === errorMsg)
                            errorFound = true;

                        if (!errorFound) {
                            for (var j = 0; j < scannedNums.length; j++) {
                                var numFound = false;
                                for (var x = 0; x < currentNumbersList.length; x++) {
                                    if (currentNumbersList[x] == scannedNums[j]) {
                                        numFound = true;
                                        break;
                                    }
                                }
                                if (!numFound && scannedNums[j] != 'NA') {
                                    /* OLD  newCurrent += ',' + scannedNums[j]; */
                                    newNumAdded = true;
                                    if (
                                        newCurrent.length + scannedNums[j].length <
                                        maxFieldLength
                                    ) {
                                        newCurrent += '\n' + scannedNums[j];
                                        currentNumbersList.push(scannedNums[j]);
                                    } else {
                                        newCurrent += '\n' + errorMsg;
                                        break;
                                    }
                                }
                            }
                            if (
                                newNumAdded &&
                                newCurrent &&
                                newCurrent != null &&
                                newCurrent != undefined
                            ) {
                                po_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: fieldID,
                                    value: newCurrent
                                });
                                if (fieldID == 'custcol_ctc_xml_ship_date') {
                                    var newDate = parseDate({ dateString: newCurrent });
                                    if (newDate && newDate != null && newDate != undefined)
                                        po_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_ctc_vc_shipped_date',
                                            value: newDate
                                        });
                                }
                            } else if (fieldID == 'custcol_ctc_xml_ship_date') {
                                var newDate = parseDate({
                                    dateString: currentNumbers.split('\r').join('')
                                });
                                if (newDate && newDate != null && newDate != undefined)
                                    po_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_ctc_vc_shipped_date',
                                        value: newDate
                                    });
                            }
                        }
                    }
                } else {
                    if (
                        xmlNumbers.length <= maxFieldLength &&
                        xmlNumbers != null &&
                        xmlNumbers != undefined
                    ) {
                        po_record.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: fieldID,
                            value: xmlNumbers.replace(/[","]+/g, '\n')
                        });
                        if (fieldID == 'custcol_ctc_xml_ship_date') {
                            var newDate = parseDate({
                                dateString: xmlNumbers.replace(/[","]+/g, '\n')
                            });
                            if (newDate && newDate != null && newDate != undefined)
                                po_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_ctc_vc_shipped_date',
                                    value: newDate
                                });
                        }
                    } else {
                        var newCurrent = '';
                        for (var i = 0; i < scannedNums.length; i++) {
                            if (newCurrent.length + scannedNums[i].length > maxFieldLength) {
                                newCurrent += errorMsg;
                                break;
                            } else newCurrent += scannedNums[i] + '\n';
                        }
                        if (newCurrent && newCurrent != null && newCurrent != undefined) {
                            po_record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: fieldID,
                                value: newCurrent
                            });
                            if (fieldID == 'custcol_ctc_xml_ship_date') {
                                var newDate = parseDate({ dateString: newCurrent });
                                if (newDate && newDate != null && newDate != undefined)
                                    po_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_ctc_vc_shipped_date',
                                        value: newDate
                                    });
                            }
                        }
                    }
                }
            } catch (err) {
                vc2_util.logError(logTitle, err);
            }
        }
    }

    /**
     * Checks for lines with duplicate items and sets the ctc fields in the duplicate lines to "Duplicate Item"
     * @param {obj} po_record the opened PO record
     * @returns {*} void
     */
    function checkForDuplicateItems(po_record) {
        var logTitle = [LogTitle, 'checkForDuplicateItems'].join('::');

        var lineItemCount = po_record.getLineCount({ sublistId: 'item' });
        if (!lineItemCount || lineItemCount <= 0) return;

        var a = [
            'custcol_ctc_xml_dist_order_num',
            'custcol_ctc_xml_date_order_placed',
            'custcol_ctc_xml_eta',
            'custcol_ctc_xml_serial_num',
            'custcol_ctc_xml_carrier',
            'custcol_ctc_xml_tracking_num',
            'custcol_ctc_xml_ship_date'
        ];

        for (var line = 0; line < lineItemCount; line++) {
            var tempItem = po_record.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: line
            });

            for (var x = line + 1; x < lineItemCount; x++) {
                var tempSubItem = po_record.getSublistText({
                    sublistId: 'item',
                    fieldId: vc2_constant.GLOBAL.ITEM_ID_LOOKUP_COL,
                    line: x
                });

                if (tempItem == tempSubItem) {
                    //Update XML fields with word DUPLICATE
                    var tempItemDupeTest = po_record.getSublistText({
                        sublistId: 'item',
                        fieldId: 'custcol_ctc_xml_eta',
                        line: x
                    });

                    if (tempItemDupeTest !== 'Duplicate Item') {
                        var lineNum = po_record.selectLine({
                            sublistId: 'item',
                            line: x
                        });
                        a.forEach(function (fieldID) {
                            po_record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: fieldID,
                                value: 'Duplicate Item'
                            });
                        });
                        po_record.commitLine({
                            sublistId: 'item'
                        });
                    }
                }
            }
        }
    }

    function parseDate(option) {
        var logTitle = [LogTitle, 'parseDate'].join('::');

        var dateString = option.dateString,
            date = '';

        if (dateString && dateString.length > 0 && dateString != 'NA') {
            try {
                var stringToProcess = dateString.replace(/-/g, '/').replace(/\n/g, ' ').split(' ');
                var currentDate = new Date();

                for (var i = 0; i < stringToProcess.length; i++) {
                    var singleString = stringToProcess[i];
                    if (singleString) {
                        var stringArr = singleString.split('T'); //handle timestamps with T
                        singleString = stringArr[0];
                        var convertedDate = new Date(singleString);
                        date = date || convertedDate;

                        // returnClosestDate gets date nearest current date vs default latest date
                        if (
                            option.returnClosestDate &&
                            ((convertedDate >= currentDate && convertedDate < date) ||
                                (convertedDate < currentDate && convertedDate > date))
                        ) {
                            date = convertedDate;
                        } else if (!option.returnClosestDate && convertedDate > date) {
                            date = convertedDate;
                        }
                    }
                }
            } catch (e) {
                vc2_util.logError(logTitle, e);
            }
        }

        //Convert to string
        if (date) {
            //set date
            var year = date.getFullYear();
            if (year < 2000) {
                year += 100;
                date.setFullYear(year);
            }

            date = ns_format.format({
                value: date,
                type: Current.dateFormat ? Current.dateFormat : ns_format.Type.DATE
            });
        }

        return date;
    }

    function getOrderLineNumbers(options) {
        var logTitle = [LogTitle, 'getOrderLineNumbers'].join('::');

        var fulfillmentId = options.fulfillmentId,
            poLine = options.poLine,
            soLine,
            fulfillmentLine;

        var recFulfillment = record.load({
            type: record.Type.ITEM_FULFILLMENT,
            id: fulfillmentId
        });

        if (recFulfillment) {
            var lineCount = recFulfillment.getLineCount({
                sublistId: 'item'
            });

            for (var i = 0; i < lineCount; i++) {
                var currPoLine = recFulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'poline',
                    line: i
                });

                if (!currPoLine != poLine) continue;
                else {
                    soLine = recFulfillment.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'orderline',
                        line: i
                    });
                    fulfillmentLine = recFulfillment.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        line: i
                    });
                    break;
                }
            }
        }

        return {
            poLine: poLine,
            soLine: soLine,
            fulfillmentLine: fulfillmentLine
        };
    }

    return {
        updatepo: updatePOItemData,
        validateline: validateLineNumber,
        validateLineNumber: validateLineNumber,
        getOrderLineNumbers: getOrderLineNumbers,
        parseDate: parseDate,
        FieldMapping: MAPPING
    };
});
