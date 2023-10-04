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
 * @NScriptType MapReduceScript
 * @Description Async process to sync native serials to custom serialnumber record
 */
/**
 *
 * Project Number:
 * Script Name: CTC VC MR Serialization
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jul 9, 2020	    paolodl@nscatalyst.com	Initial Build
 * 2.00		Jan 5, 2021		paolodl@nscatalyst.com	Changes to update SO/PO for serials created via inventory
 * 3.00		May 10,2021	`	paolodl@nscatalyst.com	Include IR and IF in sync
 *
 */
define(['N/record', 'N/search', 'N/url', 'N/runtime'], function (record, search, url, runtime) {
    function _generateLink(options) {
        var recId = options.id;
        var protocol = 'https://';
        var domain = url.resolveDomain({
            hostType: url.HostType.APPLICATION
        });
        var linkUrl = url.resolveRecord({
            recordType: record.Type.INVENTORY_NUMBER,
            recordId: recId,
            isEditMode: false
        });

        return protocol + domain + linkUrl;
    }

    function _searchRelatedTransactions(options) {
        var id = options.id,
            filters = [],
            columns = [];

        //		filters.push(search.createFilter({
        //			name: 'inventorynumber',
        //			join: 'inventorydetail',
        //			operator: search.Operator.ANYOF,
        //			values: id
        //		}));
        //		filters.push(search.createFilter({
        //			name: 'type',
        //			operator: 'anyof',
        //			values: ['SalesOrd', 'PurchOrd']
        //		}));

        filters = [
            ['inventorydetail.inventorynumber', 'anyof', id],
            //					['itemnumber.inventorynumber', 'is', id],
            'and',
            [
                ['type', 'anyof', ['SalesOrd', 'PurchOrd', 'ItemShip', 'ItemRcpt']],
                'or',
                ['createdfrom.type', 'anyof', ['SalesOrd', 'PurchOrd']]
            ]
        ];

        columns.push(
            search.createColumn({
                name: 'trandate',
                sort: search.Sort.DESC
            })
        );
        columns.push(
            search.createColumn({
                name: 'internalid'
            })
        );
        columns.push(
            search.createColumn({
                name: 'type'
            })
        );
        columns.push(
            search.createColumn({
                name: 'createdfrom'
            })
        );
        columns.push(
            search.createColumn({
                name: 'type',
                join: 'createdfrom'
            })
        );

        var soFound = false,
            poFound = false,
            ifFound = false,
            irFound = false,
            txnSearch = search.create({
                type: search.Type.TRANSACTION,
                filters: filters,
                columns: columns
            });

        txnSearch.run().each(function (result) {
            var type = result.getValue('type'),
                createdFrom = result.getValue('createdfrom'),
                createdFromType = result.getValue({ name: 'type', join: 'createdfrom' });

            if (!soFound) {
                if (type == 'SalesOrd') soFound = result.id;
                else if (createdFromType == 'SalesOrd') soFound = createdFrom;
            }
            if (!poFound) {
                if (type == 'PurchOrd') poFound = result.id;
                else if (createdFromType == 'PurchOrd') poFound = createdFrom;
            }
            if (!ifFound) {
                //3.00
                if (type == 'ItemShip') ifFound = result.id;
            }
            if (!ifFound) {
                //3.00
                if (type == 'ItemRcpt') irFound = result.id;
            }

            if (soFound && poFound && ifFound && irFound) return false;
            else return true;
        });

        return { so: soFound, po: poFound, fulfil: ifFound, receipt: irFound };
    }

    function _createCustomSerial(options) {
        var id = options.id,
            item = options.item,
            serial = options.serial,
            so = options.so,
            po = options.po,
            fulfil = options.fulfil,
            receipt = options.receipt;

        log.debug(
            'createcustom',
            JSON.stringify({
                id: id,
                item: item,
                serial: serial,
                so: so,
                po: po
            })
        );

        var newSerial = record.create({
            type: 'customrecordserialnum',
            isDynamic: true
        });

        newSerial.setValue({
            fieldId: 'name',
            value: serial
        });
        newSerial.setValue({
            fieldId: 'custrecordserialitem',
            value: item
        });
        newSerial.setValue({
            fieldId: 'custrecord_ctc_vc_inv_no',
            value: _generateLink({ id: id })
        });
        if (so)
            newSerial.setValue({
                fieldId: 'custrecordserialsales',
                value: so
            });
        if (po)
            newSerial.setValue({
                fieldId: 'custrecordserialpurchase',
                value: po
            });
        if (fulfil)
            //3.00
            newSerial.setValue({
                fieldId: 'custrecorditemfulfillment',
                value: fulfil
            });
        if (receipt)
            //3.00
            newSerial.setValue({
                fieldId: 'custrecorditemreceipt',
                value: receipt
            });

        //Return new custom serial id
        return newSerial.save();
    }

    // 2.00 - Added methods for updating custom serials - START
    function _updateCustomSerial(options) {
        var customSerial = options.customSerial,
            so = options.so,
            po = options.po,
            fulfil = options.fulfil,
            receipt = options.receipt;

        log.debug('options', options);
        if (customSerial && (so || po)) {
            var rec = record.load({
                type: 'customrecordserialnum',
                id: customSerial.value
            });

            var values = {};
            if (so && !rec.getValue({ fieldId: 'custrecordserialsales' }))
                rec.setValue({
                    fieldId: 'custrecordserialsales',
                    value: so
                });
            if (po && !rec.getValue({ fieldId: 'custrecordserialpurchase' }))
                rec.setValue({
                    fieldId: 'custrecordserialpurchase',
                    value: po
                });
            if (fulfil && !rec.getValue({ fieldId: 'custrecorditemfulfillment' }))
                //3.00
                rec.setValue({
                    fieldId: 'custrecorditemfulfillment',
                    value: fulfil
                });
            if (receipt && !rec.getValue({ fieldId: 'custrecorditemreceipt' }))
                //3.00
                rec.setValue({
                    fieldId: 'custrecorditemreceipt',
                    value: fulfil
                });

            rec.save();
        }
    }
    // 2.00 - Added methods for updating custom serials - END

    function _processCustomSerial(options) {
        var id = options.id,
            item = options.item,
            serial = options.serial,
            customSerial = options.customSerial,
            txns = _searchRelatedTransactions({ id: id }),
            so = txns.so,
            po = txns.po,
            fulfil = txns.fulfil,
            receipt = txns.receipt;

        try {
            if (!customSerial) {
                var newId = _createCustomSerial({
                    id: id,
                    item: item,
                    serial: serial,
                    so: so,
                    po: po,
                    fulfil: fulfil,
                    receipt: receipt
                });

                // 2.00 Move logic and change updated field for custom serial
                record.submitFields({
                    type: record.Type.INVENTORY_NUMBER,
                    id: id,
                    values: { custitemnumber_ctc_vc_sn: newId }
                });
            } //2.00 Logic for updating the so and po fields of the existing custom serial
            else
                _updateCustomSerial({
                    customSerial: customSerial,
                    so: so,
                    po: po,
                    fulfil: fulfil,
                    receipt: receipt
                });
        } catch (e) {
            log.error('Error encountered processing custom serials', e);
        }

        return fulfil;
    }

    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        log.audit('getInputData');
        var srchId = runtime
            .getCurrentScript()
            .getParameter('custscript_ctc_vc_mr_serialization_srch');

        var filters = [],
            columns = ['inventorynumber', 'internalid', 'item', 'custitemnumber_ctc_vc_sn'];

        var filterCustomSerial = filters.push(
            search.createFilter({
                name: 'custitemnumber_ctc_vc_sn',
                operator: 'anyof',
                value: '@NONE@'
            })
        );

        var filterSO = filters.push(
            search.createFilter({
                name: 'custrecordserialsales',
                join: 'custitemnumber_ctc_vc_sn',
                operator: 'anyof',
                value: '@NONE@'
            })
        );

        var filterPO = filters.push(
            search.createFilter({
                name: 'custrecordserialpurchase',
                join: 'custitemnumber_ctc_vc_sn',
                operator: 'anyof',
                value: '@NONE@'
            })
        );

        //		filters.push(search.createFilter({
        //			name: 'custitemnumber_ctc_vc_synced',
        //			operator: 'is',
        //			value: false
        //		}));

        //		var srch = search.create({
        //			type: search.Type.INVENTORY_NUMBER,
        //			filters: filters,
        //			columns: columns
        //		});
        //
        //		log.debug('search count', srch.runPaged().count);
        //
        //		return search.create({
        //			type: search.Type.INVENTORY_NUMBER,
        //			filters: filters,
        //			columns: columns
        //		});

        var srch = null;
        if (srchId) {
            srch = search.load({ id: srchId });
        } else throw new Error('No search provided');
        log.debug('search count', srch.runPaged().count);

        return srch;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        log.debug('serialization: Map key: ' + context.key, context.value);
        var searchResult = JSON.parse(context.value),
            id = searchResult.id,
            serial = searchResult.values.inventorynumber,
            item = searchResult.values.item.value,
            customSerial = searchResult.values.custitemnumber_ctc_vc_sn; // 2.00 change for updating custom serials

        log.debug('processing for serial ' + serial);

        var fulfil = _processCustomSerial({
            id: id,
            item: item,
            serial: serial,
            customSerial: customSerial // 2.00 change for updating custom serials
        });
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
        log.audit('summarize');
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('Reduce Error for key: ' + key, error);
            return true;
        });
        var mapKeys = [];
        summary.mapSummary.keys.iterator().each(function (key) {
            mapKeys.push(key);
            return true;
        });
        log.audit('MAP keys processed', mapKeys);
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
