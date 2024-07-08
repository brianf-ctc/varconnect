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
 * @NScriptType ClientScript
 * @Description Validates the entered serial numbers and checks if there are duplicates
 */
/**
 * Project Number: 001225
 * Script Name: CTC CS Serial Manipulation
 * Author: paolodl@nstacalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		May 1, 2020	    paolodl@nscatalyst.com	Initial Build
 *
 */
define([], function () {
    var FLD_SERIAL_NO = 'custcol_ctc_serial_number_scan';
    var FLD_SERIAL_NO_UPDATE = 'custcol_ctc_serial_number_update';
    var HIDDEN_SERIALS = 'custpage_ctc_serials';
    var serials = [];

    //Splits the input string via comma, line break, or spaces
    function _split(inputString) {
        var result = [];

        inputString = inputString.trim().replace(/[\r\n, ]/g, ',');
        inputString = inputString.replace(/,(?=,)/g, '');
        var result = inputString.split(',');

        log.debug('serials to create', result.join(','));

        return result;
    }

    // Checks if the serial array of the row has any duplicate in the cached serial list
    function _checkHasDuplicate(serialArray) {
        var dupSerials = [],
            clearedSerials = [];

        serialArray.forEach(function (serial) {
            var dup = false;
            if (clearedSerials.indexOf(serial) > -1) dup = true;

            if (dup && dupSerials.indexOf(serial) < 0) dupSerials.push(serial);
            else clearedSerials.push(serial);
        });

        return dupSerials;
    }

    /**
     * Checks the serials of another line if the current list of serials exists in them
     */
    function _checkLineForDuplicate(options) {
        var lineSerials = options.lineSerials,
            serials = options.serials,
            dupSerials = options.dupSerials,
            clearedSerials = [],
            lineSerialArray = [];

        if (lineSerials) lineSerialArray = _split(lineSerials);

        serials.forEach(function (serial) {
            var dup = false;
            if (lineSerialArray.indexOf(serial) > -1) dup = true;

            if (dup && dupSerials.indexOf(serial) < 0) dupSerials.push(serial);
        });

        return dupSerials;
    }

    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {
        var currRec = scriptContext.currentRecord,
            hiddenSerials = currRec.getValue({ fieldId: HIDDEN_SERIALS });

        if (hiddenSerials) {
            serials = JSON.parse(hiddenSerials);
        }
    }

    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {
        var currRec = scriptContext.currentRecord,
            sublistId = scriptContext.sublistId,
            fieldId = scriptContext.fieldId,
            line = scriptContext.line;
        if (fieldId === FLD_SERIAL_NO || fieldId === FLD_SERIAL_NO_UPDATE) {
            var serialArray = [];

            var val = currRec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: fieldId
            });

            if (val) serialArray = _split(val);

            if (serialArray.length > 200) {
                alert('Cannot enter more than 200 serials in a scan');
                return false;
            } else if (serialArray.length > 0) {
                var lineCount = currRec.getLineCount({ sublistId: sublistId }),
                    dupSerials = _checkHasDuplicate(serialArray);
                for (var i = 0; i < lineCount; i++) {
                    if (i != line) {
                        var lineSerials = currRec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: fieldId,
                            line: i
                        });

                        dupSerials = _checkLineForDuplicate({
                            lineSerials: lineSerials,
                            serials: serialArray,
                            dupSerials: dupSerials
                        });
                    }
                }

                if (dupSerials && dupSerials.length > 0) {
                    alert(
                        'On item line ' +
                            (line + 1) +
                            ', the following serials have duplicate entries within the transaction: \n' +
                            dupSerials.join('\n')
                    );
                }

                var qty = currRec.getCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'quantity'
                });

                if (qty != serialArray.length)
                    alert('Item quantity and number of serials do not match');
            }
        }

        return true;
    }

    return {
        pageInit: pageInit,
        validateField: validateField
    };
});
