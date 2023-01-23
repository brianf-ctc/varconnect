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
define(function (require) {
    var ns_record = require('N/record'),
        ns_error = require('N/error'),
        vc2_util = require('./CTC_VC2_Lib_Utils.js');

    var LogTitle = 'VC_RecordLib';

    var VC_RecordLib = {
        transform: function (option) {
            var logTitle = [LogTitle, 'transform'].join('::'),
                returnValue;

            try {
                if (!option.fromType) throw 'Record fromType is required. [fromType]';
                if (!option.fromId) throw 'Record fromId is required. [fromId]';
                if (!option.toType) throw 'Record toType is required. [toType]';

                // log.audit(logTitle, '// TRANSFORM: ' + JSON.stringify(option));

                returnValue = ns_record.transform(option);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to transform record',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        },
        load: function (option) {
            var logTitle = [LogTitle, 'load'].join('::'),
                returnValue;

            try {
                if (!option.type) throw 'Record type is required. [type]';
                if (!option.id) throw 'Record ID is required. [id]';

                // log.audit(logTitle, '// LOAD RECORD: ' + JSON.stringify(option));
                returnValue = ns_record.load(option);
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                throw ns_error.create({
                    name: 'Unable to load record',
                    message: vc2_util.extractError(error)
                });
                // throw (
                //     'Unable to load record: ' +
                //     (vc_util.extractError(error) + '\n' + JSON.stringify(error))
                // );
            }

            return returnValue;
        },
        extractValues: function (option) {
            var logTitle = [LogTitle, 'extractValues'].join('::'),
                returnValue;

            try {
                if (!option.record || !option.fields) return false;
                returnValue = {};

                // log.audit(logTitle, '// EXTRACT VALUES: ' + JSON.stringify(option.fields));

                for (var fld in option.fields) {
                    var fieldId = option.fields[fld];
                    var fieldName = util.isArray(option.fields) ? fieldId : fld;

                    var value = option.record.getValue({ fieldId: fieldId }) || '',
                        textValue = option.record.getText({ fieldId: fieldId });
                    returnValue[fieldName] = value;

                    if (textValue !== null && textValue != value) {
                        returnValue[fieldName + '_text'] = textValue;
                    }
                }
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                throw ns_error.create({
                    name: 'Unable to extract values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        extractLineValues: function (option) {
            var logTitle = [LogTitle, 'extractLineValues'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    groupId = option.groupId,
                    line = option.line,
                    columns = option.columns;

                if (!record || !columns) return false;
                if (line == null || line < 0) return false;

                var lineData = {};
                for (var i = 0, j = columns.length; i < j; i++) {
                    var lineOption = {
                        sublistId: sublistId,
                        group: groupId,
                        fieldId: columns[i],
                        line: line
                    };
                    var value = record.getSublistValue(lineOption),
                        textValue = record.getSublistText(lineOption);
                    lineData[columns[i]] = value;
                    if (textValue !== null && value != textValue) lineData[columns[i] + '_text'] = textValue;
                }

                returnValue = lineData;
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                returnValue = false;
                throw ns_error.create({
                    name: 'Unable to extract values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        extractRecordLines: function (option) {
            var logTitle = [LogTitle, 'extractRecordLines'].join('::'),
                returnValue;

            try {
                var record = option.record;
                var columns = option.columns || [
                    'item',
                    'rate',
                    'quantity',
                    'amount',
                    'quantityreceived',
                    'quantitybilled',
                    'taxrate',
                    'taxrate1',
                    'taxrate2'
                ];
                var sublistId = option.sublistId || 'item';
                if (!record) return false;

                var lineCount = record.getLineCount({ sublistId: sublistId }),
                    arrRecordLines = [];
                for (var line = 0; line < lineCount; line++) {
                    var lineData = VC_RecordLib.extractLineValues({
                        record: record,
                        sublistId: sublistId,
                        line: line,
                        columns: columns
                    });
                    lineData.line = line;

                    // log.audit(logTitle, lineData);
                    if (!option.filter) {
                        arrRecordLines.push(lineData);
                        continue;
                    }

                    var isFound = true;
                    // check if this line satisfy our filters
                    for (var field in option.filter) {
                        var lineValue = lineData.hasOwnProperty(field)
                            ? lineData[field]
                            : record.getSublistValue({
                                  sublistId: sublistId,
                                  fieldId: field,
                                  line: line
                              });

                        if (option.filter[field] != lineValue) {
                            isFound = false;
                            break;
                        }
                    }
                    if (isFound) {
                        arrRecordLines.push(lineData);
                        if (!option.findAll) break;
                    }
                }
                returnValue =
                    arrRecordLines && arrRecordLines.length
                        ? option.findAll
                            ? arrRecordLines
                            : arrRecordLines.shift()
                        : false;
            } catch (error) {
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to extract line values',
                    message: vc2_util.extractError(error)
                });
            } finally {
                // log.audit(logTitle, '>> ' + JSON.stringify(returnValue));
            }

            return returnValue;
        },
        updateLine: function (option) {
            var logTitle = [LogTitle, 'updateLine'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    lineData = option.lineData;

                if (!record || !lineData) return false;
                if (!lineData.hasOwnProperty('line')) return;

                var lineOption = { sublistId: sublistId, line: lineData.line };

                log.audit(logTitle, '// UPDATE LINE: ' + JSON.stringify(lineData));

                record.selectLine(lineOption);
                for (var fieldId in lineData) {
                    if (fieldId == 'line') continue;
                    if (vc2_util.isEmpty(lineData[fieldId])) continue;

                    record.setCurrentSublistValue(
                        vc2_util.extend(lineOption, { fieldId: fieldId, value: lineData[fieldId] })
                    );
                }

                record.commitLine(lineOption);
                returnValue = record;
            } catch (error) {
                returnValue = false;
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to update line values',
                    message: vc2_util.extractError(error)
                });
            }

            return returnValue;
        },
        addLine: function (option) {
            var logTitle = [LogTitle, 'addLine'].join('::'),
                returnValue;

            try {
                var record = option.record,
                    sublistId = option.sublistId || 'item',
                    lineData = option.lineData;

                if (!record || !lineData) return false;
                var lineOption = { sublistId: sublistId };

                // log.audit(logTitle, '// ADD LINE: ' + JSON.stringify(lineData));

                record.selectNewLine(lineOption);
                for (var fieldId in lineData) {
                    if (vc2_util.isEmpty(lineData[fieldId])) continue;

                    record.setCurrentSublistValue(
                        vc2_util.extend(lineOption, { fieldId: fieldId, value: lineData[fieldId] })
                    );
                }
                record.commitLine(lineOption);

                var lineCount = record.getLineCount(lineOption);
                returnValue = lineCount - 1;
            } catch (error) {
                returnValue = false;
                log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));

                throw ns_error.create({
                    name: 'Unable to add line values',
                    message: vc2_util.extractError(error)
                });
            }
            return returnValue;
        }
    };

    return VC_RecordLib;
});
