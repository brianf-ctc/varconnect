/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
/** 
 * USAGE
 * 
 * 1. Create Item Fulfillment:
 *    createFulfillment({
 *      poId: <string>,           // Purchase Order ID
 *      soId: <string>,           // Sales Order ID (optional if PO is linked to SO)
 *      vendorLines: [{           // Array of vendor line items
 *        ITEMNO: <string>,       // Item number/SKU
 *        QUANTITY: <number>,     // Quantity to fulfill
 *        SERIAL: <string>,       // Serial numbers (comma-separated)
 *        TRACKING: <string>      // Tracking numbers (comma-separated)
 *      }],
 *      headerValues: {           // Optional header field values
 *        trandate: <date>,
 *        tranid: <string>
 *      }
 *    })
 * 
 * 2. Validate Fulfillment:
 *    validateForFulfillment({
 *      poId: <string>,          // Purchase Order ID
 *      vendorLines: []          // Array of vendor line items
 *    })
 * 
 * 3. Create Bill:
 *    createBill({
 *      poId: <string>,          // Purchase Order ID
 *      vendorLines: []          // Array of vendor line items
 *    })
 * 

 */

define(function (require) {
    var LogTitle = 'SVC:Transaction';

    var vc2_util = require('./../CTC_VC2_Lib_Utils.js'),
        vc2_constant = require('./../CTC_VC2_Constants.js'),
        vclib_error = require('./lib/ctc_lib_errors.js');

    var vcs_configLib = require('./ctc_svclib_configlib.js'),
        vcs_itemmatchLib = require('./ctc_svclib_itemmatch.js'),
        vcs_recordLib = require('./ctc_svclib_records.js');

    var ns_search = require('N/search'),
        ns_runtime = require('N/runtime'),
        ns_record = require('N/record');

    var CACHE_TTL = 300; // store the data for 1mins

    var ERROR_MSG = {
        FEATURE_NOT_ENABLED: {
            code: 'FEATURE_NOT_ENABLED',
            message: 'Feature is not enabled'
        },
        LOAD_ERROR: {
            code: 'LOAD_ERROR',
            message: 'Failed to load the record'
        },
        MATCH_NOT_FOUND: {
            code: 'MATCH_NOT_FOUND',
            message: 'No matching line found'
        },
        LINE_NOT_FULFILLABLE: {
            code: 'LINE_NOT_FULFILLABLE',
            message: 'Line cannot be fulfilled'
        },
        INSUFFICIENT_QTY: {
            code: 'INSUFFICIENT_QTY',
            message: 'Insufficient quantity'
        },
        TRANSFORM_ERROR: {
            code: 'TRANSFORM_ERROR',
            message: 'Error transforming record'
        },
        FULFILLMENT_ERROR: {
            code: 'FULFILLMENT_ERROR',
            message: 'Error creating fulfillment'
        }
    };

    var Helper = {
        // Check if accounting period is locked for posting
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

        // Extract and process matched lines between PO and vendor data
        extractMatchedLines: function (option) {
            var logTitle = [LogTitle, 'Helper:extractMatchedLines'].join('|'),
                returnValue = {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                var record = option.record,
                    recordLines = option.recordLines,
                    vendorLines = option.vendorLines;

                if (!record) throw { code: 'MISSING_PARAMETER', details: 'record' };
                if (!recordLines) throw { code: 'MISSING_PARAMETER', details: 'recordLines' };
                if (!vendorLines) throw { code: 'MISSING_PARAMETER', details: 'vendorLines' };

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
                vclib_error.logError(logTitle, error, ERROR_MSG);
                // vc2_util.logError(logTitle, error);
                // returnValue.hasError = true;
                // returnValue.errorMessage = vc2_util.extractError(error);
            }

            return returnValue;
        },

        // Process and format vendor line data according to field definitions
        vendorLineData: function (option) {
            var logTitle = [LogTitle, 'Helper:fetchLineDetails'].join('|'),
                returnValue = {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };
                var vendorLine = option.vendorLine,
                    poLineValue = option.poLineValue;

                if (vc2_util.isEmpty(vendorLine) || !util.isObject(vendorLine))
                    throw { code: 'MISSING_PARAMETER', details: 'vendorLine' };

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
                vclib_error.logError(logTitle, error, ERROR_MSG);
            }

            return returnValue;
        },

        // Get shipping group information from Sales Order
        getShipGroup: function (option) {
            var logTitle = [LogTitle, 'Helper:getShipGroup'].join('|'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                // check if MULTISHIPTO feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'MULTISHIPTO' })) {
                    throw { code: 'FEATURE_NOT_ENABLED', details: 'MULTISHIPTO' };
                }

                var poId = option.poId || (option.poRec ? option.poRec.id : null);
                if (!poId) throw { code: 'MISSING_PARAMETER', details: 'poId or poRec' };

                var soRec = option.soRec;
                if (!soRec) {
                    var soId = option.soId;
                    if (!soId) throw { code: 'MISSING_PARAMETER', details: 'soId' };

                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });
                    if (!soRec) throw { code: 'LOAD_ERROR', details: 'soId: ' + soId };
                }

                // Find line with matching PO and get its ship group
                var soLineNo = soRec.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'createdpo',
                    value: poId
                });

                if (soLineNo >= 0) {
                    returnValue = soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'shipgroup',
                        line: soLineNo
                    });
                }
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Retrieve inventory locations for cross-subsidiary fulfillment
        getInventoryLocations: function (option) {
            var logTitle = [LogTitle, 'Helper:getInventoryLocations'].join('|'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                // check if the feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'crosssubsidiaryfulfillment' })) {
                    throw {
                        code: 'FEATURE_NOT_ENABLED',
                        details: 'CROSSSUBSIDIARYFULFILLMENT'
                    };
                }

                var poRec = option.poRec,
                    poId = option.poId,
                    soRec = option.soRec,
                    soId = option.soId;

                if (!poId) {
                    if (!poRec) throw { code: 'MISSING_PARAMETER', details: 'poRec' };
                    poId = poRec.id;
                }

                if (!soRec) {
                    if (!soId) throw { code: 'MISSING_PARAMETER', details: 'soId' };
                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });

                    if (!soRec) throw { code: 'LOAD_ERROR', details: 'soId: ' + soId };
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
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            } finally {
                vc2_util.log(logTitle, '... inventoryLocations: ', returnValue);
            }

            return returnValue;
        },

        // Set same location for all lines in a transaction
        getLineLocation: function (option) {
            var logTitle = [LogTitle, 'Helper:setSameLineLocation'].join('|'),
                returnValue;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                // check if the feature is enabled
                if (!ns_runtime.isFeatureInEffect({ feature: 'MULTILOCINVT' })) {
                    throw {
                        code: 'FEATURE_NOT_ENABLED',
                        details: 'MULTILOCINVT'
                    };
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

                returnValue = defaultLocation;
            } catch (error) {
                vclib_error.logWarn(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        // Add inventory details including serial numbers to transaction line
        addInventoryDetails: function (option) {
            var logTitle = [LogTitle, 'Helper:addInventoryDetails'].join('|'),
                returnValue = {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                var record = option.record,
                    lineNo = option.line || option.lineNo,
                    lineData = option.lineData,
                    serialNumbers = option.serials || option.serialNumbers || [];

                // lineNo, records and serialNUmbes are required
                if (!record) throw { code: 'MISSING_PARAMETER', details: 'record' };
                if (vc2_util.isEmpty(serialNumbers))
                    throw { code: 'MISSING_PARAMETER', details: 'serialNumbers' };

                if (!lineData) {
                    lineData = vcs_recordLib.extractLineValues({
                        record: record,
                        line: lineNo,
                        additionalColumns: ORDERLINE_COLS.concat([
                            'orderline',
                            'itemname',
                            'lineuniquekey',
                            'location',
                            'inventorydetailreq',
                            'inventorydetailavail',
                            'inventorydetailset',
                            'poline',
                            'binitem',
                            'isserial'
                        ])
                    });
                }

                if (
                    !lineData.isserial &&
                    !lineData.inventorydetailavail &&
                    !lineData.inventorydetailreq
                ) {
                    throw {
                        message: 'Line does not require serial numbers',
                        detail: vc2_util.extractValues({
                            source: lineData,
                            fields: [
                                'itemname',
                                'item',
                                'inventorydetailreq',
                                'inventorydetailavail',
                                'inventorydetailset'
                            ]
                        })
                    };
                }
                /// VALIDATE THE SERIAL NUMBERS //
                serialNumbers = util.isArray(serialNumbers)
                    ? serialNumbers
                    : serialNumbers.split(/,|\s/);

                if (vc2_util.isEmpty(serialNumbers))
                    throw { code: 'MISSING_PARAMETER', details: 'serialNumbers' };

                var validSerials = [];
                serialNumbers.forEach(function (serial) {
                    if (!vc2_util.isEmpty(serial) && serial != 'NA') validSerials.push(serial);
                });

                if (vc2_util.isEmpty(validSerials))
                    throw { code: 'VALIDATION_ERROR', details: 'No valid serial numbers found' };

                // ADD THE SERIAL NUMBERS TO THE LINE //
                record.selectLine({ sublistId: 'item', line: lineNo });
                var invDetailSubrec = record.getCurrentSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail'
                });

                validSerials.forEach(function (serial) {
                    invDetailSubrec.selectNewLine({ sublistId: 'inventoryassignment' });
                    invDetailSubrec.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'receiptinventorynumber',
                        value: serial
                    });
                    invDetailSubrec.commitLine({ sublistId: 'inventoryassignment' });
                });
                record.commitLine({ sublistId: 'item' });

                vc2_util.log(
                    logTitle,
                    'Serial numbers added successfully: ' + validSerials.join(', ')
                );

                returnValue = true;
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        },

        addNativePackages: function (option) {
            var logTitle = [LogTitle, 'Helper:addNativePackages'].join('|'),
                returnValue = {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                var record = option.record,
                    packages = option.packages || [];

                // validate the packages
                packages = util.isArray(packages) ? packages : packages.split(/,|\s/);

                if (vc2_util.isEmpty(packages))
                    throw { code: 'MISSING_PARAMETER', details: 'packages' };

                // VALIDATE THE PACKAGES //
                var validPackages = [];
                packages.forEach(function (package) {
                    if (!vc2_util.isEmpty(package) && package != 'NA') validPackages.push(package);
                });

                if (vc2_util.isEmpty(validPackages))
                    throw { code: 'VALIDATION_ERROR', details: 'No valid packages found' };

                var ctr = 0;
                validPackages.forEach(function (package) {
                    try {
                        if (!ctr) record.selectLine({ sublistId: 'package', line: ctr });
                        else record.selectNewLine({ sublistId: 'package' });

                        record.setCurrentSublistValue({
                            sublistId: 'package',
                            fieldId: 'packageweight',
                            value: 1.0
                        });
                        record.setCurrentSublistValue({
                            sublistId: 'package',
                            fieldId: 'packagetrackingnumber',
                            value: package
                        });

                        record.commitLine({ sublistId: 'package' });
                        ctr++;
                    } catch (package_error) {
                        vclib_error.logWarn(logTitle, package_error, ERROR_MSG);
                    }
                });

                returnValue = true;
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                returnValue = false;
            }

            return returnValue;
        }
    };

    return {
        // Validate if PO lines can be fulfilled based on vendor data
        validateForFulfillment: function (option) {
            var logTitle = [LogTitle, 'validateForFulfillment'].join('::'),
                returnValue = {};

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

                var poId = option.poId,
                    poRec = option.poRec,
                    soId = option.soId,
                    soRec = option.soRec;
                var vendorLines = option.vendorLines;

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
                    if (!soId) throw { code: 'MISSING_PARAMETER', details: 'soId or poId' };

                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });
                }

                var salesOrderData = vcs_recordLib.extractValues({
                    record: soRec,
                    columns: ['status', 'statusRef', 'trandate', 'postingperiod', 'location']
                });

                if (
                    !vc2_util.inArray(salesOrderData.statusRef, [
                        'pendingFulfillment',
                        'pendingApproval',
                        'partiallyFulfilled',
                        'pendingBillingPartFulfilled'
                    ])
                ) {
                    throw {
                        code: 'NOT_FULFILLABLE',
                        details: [salesOrderData.statusRef, salesOrderData.status].join(' / ')
                    };
                }

                // check if the items are fulfillable
                var vendorLines = option.vendorLines,
                    orderLines =
                        option.orderLines ||
                        vcs_recordLib.extractLineValues({
                            record: soRec,
                            additionalColumns: vc2_constant.VENDOR_LINE_DEF.ORDERLINE_COLS
                        });

                if (vc2_util.isEmpty(vendorLines))
                    throw { code: 'MISSING_PARAMETER', details: 'vendorLines' };

                vcs_itemmatchLib.matchOrderLines({
                    vendorLines: vendorLines,
                    orderLines: orderLines,
                    vendorConfig: option.vendorConfig,
                    mainConfig: option.mainConfig,
                    poId: poId,
                    poRec: poRec
                });

                var errorLines = {},
                    hasFulfillable = false;
                vendorLines.forEach(function (vendorLine) {
                    try {
                        if (!vendorLine.HAS_MATCH) throw 'MATCH_NOT_FOUND'; // no matching line found
                        if (vc2_util.isEmpty(vendorLine.MATCHING)) throw 'LINE_NOT_FULFILLABLE';
                        if (vendorLine.QUANTITY > vendorLine.APPLIEDQTY) throw 'INSUFFICIENT_QTY';

                        hasFulfillable = true; // there are itmes that can be fulfilled
                    } catch (line_error) {
                        var errorMsg = vclib_error.extractError(line_error, ERROR_MSG);
                        if (!errorLines[errorMsg]) errorLines[errorMsg] = [];
                        errorLines[errorMsg].push(vendorLine.ITEM_TEXT);
                    }
                    return true;
                });

                returnValue.hasFulfillable = hasFulfillable;
                returnValue.success = true;
                returnValue.hasError = false;

                if (!hasFulfillable) throw 'No fulfillable lines found'; // ensuring fulfillable lines exist

                if (!vc2_util.isEmpty(errorLines)) {
                    returnValue.hasError = true;
                    returnValue.success = true;
                    returnValue.errorMessage = Object.keys(errorLines).map(function (code) {
                        return vclib_error.extractError({
                            code: code,
                            detail: errorLines[code]
                        });
                    });
                }
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                returnValue.hasError = true;
                returnValue.errorMessage = vclib_error.extractError(error, ERROR_MSG);
            }

            return returnValue;
        },

        // Create Item Fulfillment record from Sales Order with vendor data
        createFulfillment: function (option) {
            var logTitle = [LogTitle, 'createFulfillment'].join('::'),
                returnValue = {};

            var VENDOR_COLS = vc2_constant.VENDOR_LINE_DEF.VENDORLINE_COLS,
                ORDERLINE_COLS = vc2_constant.VENDOR_LINE_DEF.ORDERLINE_COLS,
                FIELD_DEF = vc2_constant.VENDOR_LINE_DEF.FIELD_DEF,
                MAPPING = vc2_constant.VENDOR_LINE_DEF.MAPPING;

            try {
                if (!option) throw { code: 'MISSING_PARAMETER', details: 'option' };

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
                    if (!soId) throw { code: 'MISSING_PARAMETER', details: 'soId or poId' };
                    soRec = vcs_recordLib.load({ type: ns_record.Type.SALES_ORDER, id: soId });
                }

                // set the data
                returnValue.soId = soId;
                returnValue.poId = poId;

                var fulfillmentValidation = this.validateForFulfillment(
                    vc2_util.extend(option, { soId: soId, soRec: soRec })
                );

                if (fulfillmentValidation.hasError) {
                    returnValue.transformValidation = fulfillmentValidation;
                    throw {
                        code: 'FULFILLMENT_VALIDATION_ERROR',
                        details: fulfillmentValidation.errorMessage
                    };
                }

                /// GET THE SALES ORDER DATA /////////////////////////
                var soData = vcs_recordLib.extractValues({
                    record: soRec,
                    columns: ['status', 'statusRef', 'trandate', 'postingperiod', 'location']
                });

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
                if (!itemffRec)
                    throw { code: 'TRANSFORM_ERROR', message: 'Failed to transform the record' };
                /////////////////////////////////////////////////

                /// SET HEADER VALUES /////////////////////////
                vc2_util.log(logTitle, '___ headerValues: ', headerValues);

                var currentPostingPeriod = itemffRec.getValue({ fieldId: 'postingperiod' });
                for (var fld in headerValues) {
                    // if (fld == 'trandate' && headerValues[fld] == 'NA') continue;
                    itemffRec.setValue({ fieldId: fld, value: headerValues[fld] });
                }
                if (Helper.isPeriodLocked({ record: itemffRec })) {
                    // set back to the previous open period
                    itemffRec.setValue({ fieldId: 'postingperiod', value: currentPostingPeriod });
                }
                /////////////////////////////////////////////////

                /// PREPARE THE LINE ITEMS /////////////////////////
                var arrLinesToFulfill = [];

                // Extract all the itemff lines
                var itemffLines = vcs_recordLib.extractLineValues({
                        record: itemffRec,
                        additionalColumns: ORDERLINE_COLS.concat([
                            'location',
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
                        });
                    });

                    if (!vc2_util.isEmpty(unmatchedLines)) {
                        vc2_util.log(logTitle, 'Unmatched Lines: ', unmatchedLines);
                        throw 'Failed to match the vendor lines';
                    }
                }

                vc2_util.log(logTitle, 'arrLinesToFulfill: ', arrLinesToFulfill);
                returnValue.Lines = arrLinesToFulfill;
                /////////////////////////////////////////////////

                /// LOOP THRU THE LINES /////////////////////////
                var lineLocation = Helper.getLineLocation({
                        record: itemffRec,
                        location: soData.location
                    }),
                    lineShipGroup = Helper.getShipGroup({
                        poRec: poRec,
                        poId: poId,
                        soRec: soRec,
                        soId: soId
                    });

                // collect the serial numbers per item
                var arrSerials = {},
                    arrValidPackages = [];

                var lineCount = itemffRec.getLineCount({ sublistId: 'item' });
                for (var line = lineCount - 1; line >= 0; line--) {
                    try {
                        var fullfillLine = arrLinesToFulfill.filter(function (lineData) {
                            return lineData.line == line + 1;
                        });

                        var currentLine = vcs_recordLib.extractLineValues({
                            record: itemffRec,
                            sublistId: 'item',
                            line: line,
                            additionalColumns: ORDERLINE_COLS.concat([
                                'orderline',
                                'itemname',
                                'lineuniquekey',
                                'location',
                                'inventorydetailreq',
                                'inventorydetailavail',
                                'inventorydetailset',
                                'poline',
                                'binitem',
                                'isserial'
                            ])
                        });

                        /// if the line is not in the list, skip it
                        if (vc2_util.isEmpty(fullfillLine)) {
                            vcs_recordLib.updateLineValues({
                                record: itemffRec,
                                values: { itemreceive: false },
                                line: line,
                                isDynamic: true
                            });

                            vc2_util.log(
                                logTitle,
                                '...skipped line: ',
                                [line, currentLine.itemname].join('|')
                            );
                            continue;
                        }

                        var LineData = {
                                Vendor: fullfillLine[0].VENDORLINE,
                                PO: fullfillLine[0],
                                ItemFF: currentLine
                            },
                            Tracking = {
                                Vendor: LineData.Vendor.TRACKING || [],
                                PO:
                                    LineData.PO['custcol_ctc_xml_tracking_num'] &&
                                    LineData.PO['custcol_ctc_xml_tracking_num'] != 'NA'
                                        ? LineData.PO['custcol_ctc_xml_tracking_num'].split(/,|\s/)
                                        : null,
                                ItemFF:
                                    LineData.ItemFF['custcol_ctc_xml_tracking_num'] &&
                                    LineData.ItemFF['custcol_ctc_xml_tracking_num'] != 'NA'
                                        ? LineData.ItemFF['custcol_ctc_xml_tracking_num'].split(
                                              /,|\s/
                                          )
                                        : null
                            },
                            Serials = {
                                Vendor: LineData.Vendor.SERIAL_NUMS || [],
                                PO:
                                    LineData.PO['custcol_ctc_xml_serial_num'] &&
                                    LineData.PO['custcol_ctc_xml_serial_num'] != 'NA'
                                        ? LineData.PO['custcol_ctc_xml_serial_num'].split(/,|\s/)
                                        : null,
                                ItemFF:
                                    LineData.ItemFF['custcol_ctc_xml_serial_num'] &&
                                    LineData.ItemFF['custcol_ctc_xml_serial_num'] != 'NA'
                                        ? LineData.ItemFF['custcol_ctc_xml_serial_num'].split(
                                              /,|\s/
                                          )
                                        : null
                            },
                            Carrier = {
                                Vendor: LineData.Vendor.CARRIER || '',
                                PO: LineData.PO['custcol_ctc_xml_carrier'] || '',
                                ItemFF: LineData.ItemFF['custcol_ctc_xml_carrier'] || ''
                            };

                        /// generate the line data from the vendor input
                        var lineValues = util.extend(
                            {
                                itemreceive: true,
                                itemquantity: fullfillLine[0].itemquantity,
                                quantity: fullfillLine[0].itemquantity
                            },
                            Helper.vendorLineData({
                                vendorLine: LineData.Vendor,
                                poLineValue: LineData.PO
                            })
                        );

                        if (lineLocation) lineValues.location = lineLocation;
                        if (lineShipGroup) lineValues.shipgroup = lineShipGroup;

                        // only update the line if there are changes
                        var updateLineValues = {};
                        for (var fld in lineValues) {
                            if (LineData.ItemFF[fld] !== lineValues[fld]) {
                                updateLineValues[fld] = lineValues[fld];
                            }
                        }

                        /// UPDATE THE LINE VALUES /////////////////////////
                        vcs_recordLib.updateLineValues({
                            record: itemffRec,
                            line: line,
                            values: updateLineValues,
                            isDynamic: true
                        });
                        vc2_util.log(logTitle, '...added line: ', [
                            [line, currentLine.itemname].join('|'),
                            updateLineValues
                        ]);
                        /////////////////////////////////////////////////

                        var LineSerials = (function () {
                                // get serials from vendor data
                                return vc2_util.uniqueArray(
                                    // combine the serials from the vendor and ItemFF
                                    (Serials.Vendor || [])
                                        .concat(Serials.ItemFF || [])
                                        .filter(function (serial) {
                                            return !vc2_util.isEmpty(serial) && serial != 'NA';
                                        })
                                );
                            })(), // serial numbers
                            LineTracking = (function () {
                                // get tracking numbers from vendor data
                                return vc2_util.uniqueArray(
                                    // combine the tracking from the vendor, itemff and PO
                                    (Tracking.Vendor || [])
                                        .concat(Tracking.ItemFF || [])
                                        .filter(function (track) {
                                            return !vc2_util.isEmpty(track) && track != 'NA';
                                        })
                                );
                            })(),
                            Carrier = (function () {
                                // get carrier from vendor data
                                return vc2_util.uniqueArray(
                                    // combine the carrier from the vendor, itemff and PO
                                    [Carrier.Vendor, Carrier.PO, Carrier.ItemFF].filter(function (
                                        carr
                                    ) {
                                        return !vc2_util.isEmpty(carr) && carr != 'NA';
                                    })
                                );
                            })(); // tracking numbers

                        arrSerials[LineData.PO.item] = LineSerials;
                        arrValidPackages = arrValidPackages.concat(LineTracking);

                        vc2_util.log(logTitle, '......serials/tracking/carrier: ', [
                            LineSerials,
                            LineTracking,
                            Carrier
                        ]);

                        /// ADD SERIAL NUMBERS /////////////////////////
                        if (!vc2_util.isEmpty(LineSerials)) {
                            Helper.addInventoryDetails({
                                record: itemffRec,
                                line: line,
                                lineData: LineData.ItemFF,
                                serials: LineSerials,
                                doCommit: true
                            });
                        }
                    } catch (line_err) {
                        vclib_error.logError(logTitle, line_err, ERROR_MSG);
                    }
                }

                /// add the packages
                Helper.addNativePackages({
                    record: itemffRec,
                    packages: vc2_util.uniqueArray(arrValidPackages)
                });
                returnValue.Tracking = arrValidPackages;
                ///////////////////////////////////////////////

                /// SAVE THE FULFILLMENT /////////////////////////
                var fulfillmentId = itemffRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                if (!fulfillmentId) throw 'FULFILLMENT_ERROR';
                vc2_util.log(logTitle, '**** ITEM FULFILLMENT Success ****', fulfillmentId);

                returnValue.id = fulfillmentId;
                returnValue.success = true; // added to indicate the fulfillment was successful

                /// RETURN THE SERIAL NUMBERS /////////////////////////
                returnValue.Serials = [];
                for (var item in arrSerials) {
                    var serials = arrSerials[item];
                    if (vc2_util.isEmpty(serials)) continue;

                    returnValue.Serials.push({
                        serials: serials,
                        ITEM: item,
                        ITEM_FULFILLMENT: fulfillmentId
                    });
                }

                /////////////////////////////////////////////////
            } catch (error) {
                vclib_error.logError(logTitle, error, ERROR_MSG);
                util.extend(returnValue, {
                    errorMessage: vclib_error.extractError(error, ERROR_MSG),
                    hasError: true,
                    success: false // indicate the fulfillment failed
                });
            } finally {
                vc2_util.log(logTitle, '#### END: FULFILLMENT CREATION #####');
            }

            return returnValue;
        },

        // Create Item Receipt record from Purchase Order
        createItemReceipt: function (option) {},

        // Create Vendor Bill from Purchase Order with vendor data
        createBill: function (option) {}
    };
});
