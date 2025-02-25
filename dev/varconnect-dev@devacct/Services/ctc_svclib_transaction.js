/**
 * Copyright (c) 2025  sCatalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(function (require) {
    var LogTitle = 'SVC:Transaction';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('../CTC_VC2_Constants.js');

    var vcs_configLib = require('./ctc_svclib_configlib.js'),
        vcs_itemmatchLib = require('./ctc_svclib_itemmatch.js'),
        vcs_recordLib = require('./ctc_svclib_records.js');

    var ns_search = require('N/search'),
        ns_format = require('N/format'),
        ns_runtime = require('N/runtime'),
        ns_record = require('N/record');

    var CACHE_TTL = 300; // store the data for 1mins

    var Helper = {
        isPeriodLocked: function (option) {
            var logTitle = [LogTitle, 'Helper:isPeriodLocked'].join('|'),
                returnValue;
            option = option || {};

            var record = option.record;
            var isLocked = false;
            var periodValues = ns_search.lookupFields({
                type: ns_search.Type.ACCOUNTING_PERIOD,
                id: record.getValue({ fieldId: 'postingperiod' }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            isLocked = periodValues.aplocked || periodValues.alllocked || periodValues.closed;
            vc2_util.log(logTitle, '>> isPeriodLocked? ', isLocked);
            returnValue = isLocked;

            return returnValue;
        },
        isFulfillable: function (option) {
            var logTitle = [LogTitle, 'Helper:isFulfillable'].join('|'),
                returnValue;

            var salesOrderData = vc2_util.flatLookup({
                type: ns_record.Type.SALES_ORDER,
                id: option.soId,
                columns: ['status', 'statusRef', 'trandate', 'postingperiod']
            });

            returnValue = vc2_util.inArray(salesOrderData.status, [
                'pendingFulfillment',
                'pendingApproval',
                'pendingBillingPartFulfilled'
            ]);
            vc2_util.log(logTitle, '... salesOrderData: ', [salesOrderData, returnValue]);

            return returnValue;
        },
        extractMatchedLines: function (option) {
            var logTitle = [LogTitle, 'Helper:extractMatchedLines'].join('|'),
                returnValue = {};

            try {
                if (!option) throw 'Missing required parameter: option';

                var record = option.record,
                    recordLines = option.recordLines,
                    vendorLines = option.vendorLines;

                if (!record) throw 'Missing required parameter: record';
                if (!recordLines) throw 'Missing required parameter: recordLines';
                if (!vendorLines) throw 'Missing required parameter: vendorLines';

                vcs_itemmatchLib.matchOrderLines({
                    poRec: option.poRec,
                    poId: option.poId,
                    orderRec: record,
                    orderLines: recordLines,
                    vendorLines: vendorLines,
                    vendorConfig: option.vendorConfig,
                    mainConfig: option.mainConfig
                });

                var unmatchedLines = [],
                    matchedLines = [];

                vendorLines.forEach(function (vendorLine) {
                    if (vc2_util.isEmpty(vendorLine.MATCHING)) {
                        unmatchedLines.push(vendorLine);
                        return false;
                    }
                    //loop thru the MATCHING lines
                    vendorLine.MATCHING.forEach(function (matchedLine) {
                        var lineData = matchedLine;
                        for (var fld in vendorLine) {
                            if (util.isObject(vendorLine[fld])) continue;
                            util.extend(lineData, { fld: vendorLine[fld] });
                        }

                        matchedLines.push(lineData);
                    });
                });

                if (vc2_util.isEmpty(unmatchedLines)) {
                    vc2_util.log(logTitle, 'Unmatched Lines: ', unmatchedLines);
                    throw 'Failed to match the vendor lines';
                }

                returnValue.lines = matchedLines;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue.hasError = true;
                returnValue.errorMessage = vc2_util.extractError(error);
            }

            return returnValue;
        },
        vendorLineData: function (option) {
            var logTitle = [LogTitle, 'Helper:fetchLineDetails'].join('|'),
                returnValue = {};

            try {
                if (!option) throw 'Missing required parameter: option';
                var vendorLine = option.vendorLine,
                    poLineValue = option.poLineValue;

                if (vc2_util.isEmpty(vendorLine) || !util.isObject(vendorLine))
                    throw 'Missing required or invalid parameter: vendorLine';

                var VENDOR_COLS = vc2_constant.VENDOR_LINE_DEF.VENDORLINE_COLS,
                    ORDERLINE_COLS = vc2_constant.VENDOR_LINE_DEF.ORDERLINE_COLS,
                    FIELD_DEF = vc2_constant.VENDOR_LINE_DEF.FIELD_DEF,
                    MAPPING = vc2_constant.VENDOR_LINE_DEF.MAPPING;

                var lineData = {};
                VENDOR_COLS.forEach(function (vendorCol) {
                    var fldValue = vendorLine[vendorCol];
                    if (vc2_util.isEmpty(fldValue) || fldValue == 'NA') return;

                    // if (
                    //     vc2_util.inArray(vendorFld, ['SERIAL_NUMS', 'TRACKING_NUMS']) &&
                    //     util.isArray(fldValue)
                    // ) {
                    //     fldValue = fldValue.join(' ');
                    // }

                    ORDERLINE_COLS.forEach(function (orderCol) {
                        // Check if the order column matches the vendor column in the mapping
                        if (MAPPING[orderCol] !== vendorCol) return;

                        var poFldValue = poLineValue[orderCol];

                        if (vc2_util.inArray(orderCol, FIELD_DEF.DATE)) {
                            fldValue = vc2_util.parseFormatDate(fldValue);
                        } else if (vc2_util.inArray(orderCol, FIELD_DEF.TEXT)) {
                            fldValue = fldValue;
                        } else if (vc2_util.inArray(orderCol, FIELD_DEF.TEXT_LIST)) {
                            poFldValue = !vc2_util.isEmpty(poFldValue)
                                ? poFldValue.split(/,|\s/)
                                : [];

                            // Ensure fldValue is an array, splitting by comma or whitespace if necessary
                            fldValue =
                                (util.isArray(fldValue) ? fldValue : fldValue.split(/,|\s/)) || [];

                            // Combine and remove duplicates from the existing and new field values
                            fldValue = vc2_util.uniqueArray(poFldValue.concat(fldValue));

                            fldValue = fldValue.join(' ');
                        } else if (vc2_util.inArray(orderCol, FIELD_DEF.TEXTAREA)) {
                            fldValue = util.isArray(fldValue) ? fldValue.join(' ') : fldValue;
                        }

                        lineData[orderCol] = fldValue;
                    });
                });

                returnValue = lineData;
            } catch (error) {
                vc2_util.logError(logTitle, error);
            }

            return returnValue;
        },
        getShipGroup: function (option) {
            var logTitle = [LogTitle, 'Helper:getShipGroup'].join('|'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';

                // check if the feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' })) {
                    throw 'MULTISHIPTO feature is not enabled';
                }

                var poRec = option.poRec,
                    poId = option.poId,
                    soRec = option.soRec,
                    soId = option.soId;

                if (!poId) {
                    if (!poRec) throw 'Missing required parameter: poRec';
                    poId = poRec.id;
                }

                if (!soRec) {
                    if (!soId) throw 'Missing required parameter: soId';
                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });

                    if (!soRec) throw 'Failed to load the sales order record';
                }

                // look for the ship group from the SO
                var soLineNo = soRec.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'createpo',
                    value: poId
                });

                if (soLineNo >= 0) {
                    var shipGroup = soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'shipgroup',
                        line: soLineNo
                    });

                    returnValue = shipGroup;
                }
            } catch (error) {
                vc2_util.logWarn(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '... shipGroup: ', returnValue);
            }

            return returnValue;
        },
        getInventoryLocations: function (option) {
            var logTitle = [LogTitle, 'Helper:getInventoryLocations'].join('|'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';

                // check if the feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'crosssubsidiaryfulfillment' })) {
                    throw 'CROSSSUBSIDIARYFULFILLMENT feature is not enabled';
                }

                var poRec = option.poRec,
                    poId = option.poId,
                    soRec = option.soRec,
                    soId = option.soId;

                if (!poId) {
                    if (!poRec) throw 'Missing required parameter: poRec';
                    poId = poRec.id;
                }

                if (!soRec) {
                    if (!soId) throw 'Missing required parameter: soId';
                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });

                    if (!soRec) throw 'Failed to load the sales order record';
                }

                var soLineCount = soRec.getLineCount({ sublistId: 'item' }),
                    inventoryLocations = [];

                for (var soLine = 0; soLine < soLineCount; soLine++) {
                    var createPo = soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'createpo',
                        line: soLine
                    });
                    if (createPo != poId) continue;

                    var inventoryLocation = soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'inventorylocation',
                        line: soLine
                    });
                    if (vc2_util.isEmpty(inventoryLocation)) continue;

                    if (!vc2_util.inArray(inventoryLocation, inventoryLocations))
                        inventoryLocations.push(inventoryLocation);
                }

                returnValue = inventoryLocations;
            } catch (error) {
                vc2_util.logWarn(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '... inventoryLocations: ', returnValue);
            }

            return returnValue;
        },
        setSameLineLocation: function (option) {
            var logTitle = [LogTitle, 'Helper:getLineLocation'].join('|'),
                returnValue;

            try {
                if (!option) throw 'Missing required parameter: option';

                // check if the feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })) {
                    throw 'MULTILOCINVT feature is not enabled';
                }

                var record = option.record,
                    soLocation = option.location,
                    arrLineLocation = [];

                // get the location
                var lineCount = record.getLineCount({ sublistId: 'item' });
                for (var line = 0; line < lineCount; line++) {
                    var lineValues = vcs_recordLib.extractLineValues({
                        record: record,
                        line: line,
                        additionalColumns: ['location']
                    });

                    if (
                        !vc2_util.isEmpty(lineValues.location) &&
                        !vc2_util.inArray(lineValues.location, arrLineLocation)
                    ) {
                        arrLineLocation.push(lineValues.location);
                    }
                }

                var defaultLocation = soLocation;
                if (!vc2_util.isEmpty(arrLineLocation) && arrLineLocation.length == 1) {
                    defaultLocation = arrLineLocation[0];
                }

                // set the location on the line, if not yet set
                for (var line = 0; line < lineCount; line++) {
                    var lineLocation = record.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: line
                    });

                    if (lineLocation !== defaultLocation) {
                        record.selectLine({ sublistId: 'item', line: line });
                        record.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'location',
                            value: defaultLocation
                        });
                        record.commitLine({ sublistId: 'item', ignoreRecalc: true });
                    }
                }

                returnValue = location;
            } catch (error) {
                vc2_util.logWarn(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        },
        addInventoryDetails: function (option) {
            var logTitle = [LogTitle, 'Helper:addInventoryDetails'].join('|'),
                returnValue = {};

            try {
                if (!option) throw 'Missing required parameter: option';

                var record = option.record,
                    lineNo = option.line || option.lineNo,
                    soRec = option.soRec,
                    serialNumbers = option.serials || option.serialNumbers || [];

                // validate the serial numbers
                serialNumbers = util.isArray(serialNumbers)
                    ? serialNumbers
                    : serialNumbers.split(/,|\s/);

                if (vc2_util.isEmpty(serialNumbers))
                    throw 'Missing required parameter: serialNumbers';

                // VALIDATE THE SERIAL NUMBERS //
                var validSerials = [];
                serialNumbers.forEach(function (serial) {
                    if (!vc2_util.isEmpty(serial) && serial != 'NA') validSerials.push(serial);
                });

                if (vc2_util.isEmpty(validSerials)) throw 'No valid serial numbers found';

                // ADD THE SERIAL NUMBERS TO THE LINE //
                if (option.doCommit) record.selectLine({ sublistId: 'item', line: lineNo });

                // get the current location
                var location = record.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location'
                });

                returnValue = true;
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return {
        createFulfillment: function (option) {
            var logTitle = [LogTitle, 'createFulfillment'].join('::'),
                returnValue;

            var VENDOR_COLS = vc2_constant.VENDOR_LINE_DEF.VENDORLINE_COLS,
                ORDERLINE_COLS = vc2_constant.VENDOR_LINE_DEF.ORDERLINE_COLS,
                FIELD_DEF = vc2_constant.VENDOR_LINE_DEF.FIELD_DEF,
                MAPPING = vc2_constant.VENDOR_LINE_DEF.MAPPING;

            try {
                if (!option) throw 'Missing required parameter: option';

                vc2_util.log(logTitle, '#### START: FULFILLMENT CREATION #####', option);

                var poId = option.poId,
                    poRec = option.poRec,
                    soId = option.soId,
                    soRec = option.soRec;

                var mainConfig = option.mainConfig || vcs_configLib.mainConfig(),
                    vendorConfig =
                        option.vendorConfig || vcs_configLib.orderVendorConfig({ poId: poId }),
                    billConfig =
                        option.billConfig || vcs_configLib.billVendorConfig({ poId: poId });

                if (!soId) {
                    if (soRec) {
                        soId = soRec.id;
                    } else if (poRec) {
                        soId = poRec.getValue({ fieldId: 'createdfrom' });
                    } else if (poId) {
                        var poData = vc2_util.flatLookup({
                            type: ns_record.Type.PURCHASE_ORDER,
                            id: poId,
                            columns: ['createdfrom']
                        });
                        soId = poData.createdfrom.value || poData.createdfrom;
                    }
                    if (!soId) throw 'Missing required parameter: soId or poId';
                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });
                }

                // if (!soId) {
                //     soId = soRec ? soRec.id : null;
                //     if (!soId) {
                //         var poData = poRec
                //             ? vcs_recordLib.extractValues({
                //                   record: poRec,
                //                   columns: ['createdfrom']
                //               })
                //             : vc2_util.flatLookup({
                //                   type: ns_record.Type.PURCHASE_ORDER,
                //                   id: poId,
                //                   columns: ['createdfrom']
                //               });

                //         if (!poData || !poData.createdfrom)
                //             throw 'Missing required parameter: soId or poId';

                //         soId = poData.createdfrom.value || poData.createdfrom;
                //         if (!soId) throw 'PO is not created from a sales order';

                //         soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });
                //     }
                // }

                /// GET THE SALES ORDER DATA /////////////////////////
                var soData = vcs_recordLib.extractValues({
                    record: soRec,
                    columns: ['status', 'statusRef', 'trandate', 'postingperiod', 'location']
                });

                // CHECK IF THE SALES ORDER IS FULFILLABLE //////////
                if (
                    !vc2_util.inArray(soData.statusRef, [
                        'pendingFulfillment',
                        'pendingApproval',
                        'pendingBillingPartFulfilled'
                    ])
                ) {
                    throw (
                        'Sales Order is not fulfillable - ' +
                        [soData.statusRef, soData.status].join(' / ')
                    );
                }
                /////////////////////////////////////////////////

                var headerValues = option.headerValues || {},
                    lineValues = option.lineValues || [],
                    vendorLines = option.vendorLines || [];

                /// PREP ITEMFF VALUES /////////////////////////
                var transformOption = {
                    fromType: ns_record.Type.SALES_ORDER,
                    toType: ns_record.Type.ITEM_FULFILLMENT,
                    fromId: soId,
                    isDynamic: true
                };

                util.extend(headerValues, {
                    custbody_ctc_vc_createdby_vc: true
                });

                /// get inventory location
                var inventoryLocations =
                    Helper.getInventoryLocations({
                        poRec: poRec,
                        poId: poId,
                        soRec: soRec,
                        soId: soId
                    }) || [];

                (inventoryLocations || []).forEach(function (location) {
                    headerValues.inventorylocation = location;
                });

                // set the ship status
                if (vc2_constant.GLOBAL.PICK_PACK_SHIP) {
                    headerValues.shipstatus = 'C';
                }

                /// TRANSFORM THE SALES ORDER /////////////////////////
                var itemffRec = vcs_recordLib.transform(transformOption);
                if (!itemffRec) throw 'Failed to transform the record';
                /////////////////////////////////////////////////

                /// SET HEADER VALUES /////////////////////////
                var currentPostingPeriod = itemffRec.getValue({ fieldId: 'postingperiod' });

                for (var fld in headerValues) {
                    // if (fld == 'trandate' && headerValues[fld] == 'NA') continue;
                    itemffRec.setValue({ fieldId: fld, value: headerValues[fld] });
                }

                if (Helper.isPeriodLocked({ record: itemffRec })) {
                    // set back to the previous open period
                    itemffRec.setValue({
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }
                /////////////////////////////////////////////////

                /// PREPARE THE LINE ITEMS /////////////////////////
                var arrLinesToFulfill = [];

                // Extract all the itemff lines
                var itemffLines = vcs_recordLib.extractLineValues({
                        record: itemffRec,
                        additionalColumns: ORDERLINE_COLS.concat([
                            'itemreceive',
                            'orderline',
                            'lineuniquekey'
                        ])
                    }),
                    poLines = vcs_recordLib.extractLineValues({
                        record: poRec,
                        poId: poId,
                        additionalColumns: ORDERLINE_COLS.concat(['orderline', 'lineuniquekey'])
                    });

                if (!vc2_util.isEmpty(vendorLines)) {
                    // match it with the vendor lines

                    /// MATCH THE LINES /////////////////////////
                    vcs_itemmatchLib.matchOrderLines({
                        vendorLines: vendorLines,

                        // provide the po lines for reference
                        poRec: poRec,
                        poId: poId,
                        poLines: poLines,

                        // we'll use the itemff as matching reference
                        orderRec: itemffRec,
                        orderLines: itemffLines,

                        // include the configs
                        vendorConfig: vendorConfig,
                        mainConfig: mainConfig
                    });
                    /////////////////////////////////////////////////

                    /// PROCESS THE MATCHED LINES /////////////////////////
                    var unmatchedLines = [];

                    // collect the lineValues
                    vendorLines.forEach(function (vendorLine) {
                        // if there's no matching line, exit
                        if (vc2_util.isEmpty(vendorLine.MATCHING)) {
                            unmatchedLines.push(vendorLine);
                            return false;
                        }

                        // applied quantity for this line
                        var appliedQty = vendorLine.APPLIEDQTY;

                        vendorLine.MATCHING.forEach(function (matchLine) {
                            // applied quantity to this matched fulfillment line
                            var itemqty =
                                matchLine.quantity > appliedQty ? appliedQty : matchLine.quantity;
                            appliedQty -= itemqty;

                            var itemffLine = util.extend(
                                {
                                    itemquantity: itemqty,
                                    quantity: itemqty,
                                    itemreceive: true,
                                    VENDORLINE: vc2_util.extractValues({
                                        source: vendorLine,
                                        fields: VENDOR_COLS
                                    })
                                },
                                matchLine.ORDERLINE
                            );
                            arrLinesToFulfill.push(itemffLine);

                            // var lineData = {
                            // };

                            // util.extend(
                            //     lineData,
                            //     Helper.vendorLineData({
                            //         vendorLine: vendorLine,
                            //         poLineValue: matchLine
                            //     })
                            // );
                        });
                    });

                    if (!vc2_util.isEmpty(unmatchedLines)) {
                        vc2_util.log(logTitle, 'Unmatched Lines: ', unmatchedLines);
                        throw 'Failed to match the vendor lines';
                    }
                }

                vc2_util.log(logTitle, 'arrLinesToFulfill: ', arrLinesToFulfill);
                /////////////////////////////////////////////////

                /// LOOP THRU THE LINES /////////////////////////
                var lineCount = itemffRec.getLineCount({ sublistId: 'item' });

                for (var line = lineCount - 1; line >= 0; line--) {
                    try {
                        var fullfillLine = arrLinesToFulfill.filter(function (lineData) {
                            return lineData.line == line + 1;
                        });

                        /// if the line is not in the list, skip it
                        if (vc2_util.isEmpty(fullfillLine)) {
                            vcs_recordLib.updateLineValues({
                                record: itemffRec,
                                values: { itemreceive: false },
                                line: line,
                                isDynamic: true
                            });

                            vc2_util.log(logTitle, '...skipped line: ', fullfillLine);
                            continue;
                        }

                        /// generate the line data from the vendor input
                        var lineValues = util.extend(
                            {
                                itemreceive: true,
                                itemquantity: fullfillLine[0].itemquantity,
                                quantity: fullfillLine[0].itemquantity
                            },

                            Helper.vendorLineData({
                                vendorLine: fullfillLine[0].VENDORLINE,
                                poLineValue: fullfillLine[0]
                            })
                        );

                        lineValues.shipgroup = Helper.getShipGroup({
                            poRec: poRec,
                            poId: poId,
                            soRec: soRec,
                            soId: soId
                        });

                        /// UPDATE THE LINE VALUES /////////////////////////
                        vcs_recordLib.updateLineValues({
                            record: itemffRec,
                            values: lineValues,
                            line: line,
                            isDynamic: true
                        });
                        /////////////////////////////////////////////////

                        /// ADD SERIAL NUMBERS /////////////////////////
                        Helper.addInventoryDetails({
                            record: itemffRec,
                            line: line,
                            soRec: soRec,
                            doCommit: true
                        });

                        // set Ship Group
                    } catch (line_err) {
                        vc2_util.logError(logTitle, line_err);
                    }
                }

                Helper.setSameLineLocation({
                    record: itemffRec,
                    location: soData.location
                });

                ///////////////////////////////////////////////

                /// SAVE THE FULFILLMENT /////////////////////////
                var fulfillmentId = itemffRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                if (!fulfillmentId) throw 'Failed to save the fulfillment record';

                returnValue = fulfillmentId;
                /////////////////////////////////////////////////
            } catch (error) {
                vc2_util.logError(logTitle, error);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '#### END: FULFILLMENT CREATION #####');
            }

            return returnValue;
        },
        createItemReceipt: function (option) {},
        createBill: function (option) {}
    };
});
