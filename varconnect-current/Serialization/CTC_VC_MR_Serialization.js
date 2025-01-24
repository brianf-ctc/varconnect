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
define(['N/record', 'N/search', 'N/url', 'N/runtime', './../CTC_VC2_Lib_Utils'], function (
    ns_record,
    ns_search,
    ns_url,
    ns_runtime,
    vc2_util
) {
    var LogTitle = 'VC_SERIALS',
        LogPrefix = '';

    var MAP_REDUCE = {};
    MAP_REDUCE.getInputData = function () {
        var logTitle = [LogTitle, 'getInputData'].join('::');
        log.debug(logTitle, '############ START SCRIPT ############');

        var srchId = ns_runtime
            .getCurrentScript()
            .getParameter('custscript_ctc_vc_mr_serialization_srch');

        if (!srchId) throw new Error('No search provided');
        var srch = ns_search.load({ id: srchId });

        var allSerialsSearch = vc2_util.searchAllPaged({ searchObj: srch });

        log.debug(logTitle, '>> Total Serials: ' + allSerialsSearch.length);

        return allSerialsSearch;
    };

    MAP_REDUCE.map = function (context) {
        var logTitle = [LogTitle, 'map'].join('::');
        log.debug(logTitle, '================ START: MAP ================ ');

        log.debug(logTitle, '>> Map key: ' + JSON.stringify([context.key, context.value]));

        var searchResult = JSON.parse(context.value),
            id = searchResult.id,
            serial = searchResult.values.inventorynumber,
            item = (searchResult.values.item[0] || searchResult.values.item).value,
            customSerial =
                searchResult.values.custitemnumber_ctc_vc_sn[0] ||
                searchResult.values.custitemnumber_ctc_vc_sn;

        // 2.00 change for updating custom serials
        log.debug(logTitle, '>> VALUES: ' + JSON.stringify(searchResult.values));

        LogPrefix = '[' + serial + '] ';
        log.debug(logTitle, LogPrefix + '>> PROCESSING ' + serial);

        var fulfil = Helper.processCustomSerial({
            id: id,
            item: item,
            serial: serial,
            customSerial: customSerial // 2.00 change for updating custom serials
        });

        log.debug(logTitle, '================ END: MAP ================ ');
    };
    MAP_REDUCE.summarize = function (summary) {
        var logTitle = [LogTitle, 'summarize'].join('::');
        log.debug(logTitle, '================ START: SUMMARY ================ ');

        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error(logTitle, 'Reduce Error for key: ' + key + ' | ' + JSON.stringify(error));
            return true;
        });
        var mapKeys = [];
        summary.mapSummary.keys.iterator().each(function (key) {
            mapKeys.push(key);
            return true;
        });

        log.audit(logTitle, 'MAP keys processed - ' + JSON.stringify(mapKeys));
        log.debug(logTitle, '================ END: SUMMARY ================ ');
    };

    ///////////////////////////////////////////////////////////
    var Helper = {
        generateLink: function (options) {
            var logTitle = [LogTitle, 'Helper:generateLink'].join('::');

            var recId = options.id;
            var protocol = 'https://';
            var domain = ns_url.resolveDomain({
                hostType: ns_url.HostType.APPLICATION
            });
            var linkUrl = ns_url.resolveRecord({
                recordType: ns_record.Type.INVENTORY_NUMBER,
                recordId: recId,
                isEditMode: false
            });

            return protocol + domain + linkUrl;
        },

        searchRelatedTransactions: function (options) {
            var logTitle = [LogTitle, 'Helper:searchRelatedTransactions'].join('::');

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
                ns_search.createColumn({
                    name: 'trandate',
                    sort: ns_search.Sort.DESC
                })
            );
            columns.push(
                ns_search.createColumn({
                    name: 'internalid'
                })
            );
            columns.push(
                ns_search.createColumn({
                    name: 'type'
                })
            );
            columns.push(
                ns_search.createColumn({
                    name: 'createdfrom'
                })
            );
            columns.push(
                ns_search.createColumn({
                    name: 'type',
                    join: 'createdfrom'
                })
            );

            var soFound = false,
                poFound = false,
                ifFound = false,
                irFound = false,
                txnSearch = ns_search.create({
                    type: ns_search.Type.TRANSACTION,
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
        },

        createCustomSerial: function (options) {
            var logTitle = [LogTitle, 'Helper:createCustomSerial'].join('::');

            var id = options.id,
                item = options.item,
                serial = options.serial,
                so = options.so,
                po = options.po,
                fulfil = options.fulfil,
                receipt = options.receipt;

            log.audit(logTitle, LogPrefix + '** Create Custom Serials: ' + JSON.stringify(options));

            var newSerial = ns_record.create({
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
                value: Helper.generateLink({ id: id })
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
        },

        // 2.00 - Added methods for updating custom serials - START
        updateCustomSerial: function (options) {
            var logTitle = [LogTitle, 'Helper:updateCustomSerial'].join('::');

            var customSerial = options.customSerial,
                item = options.item,
                so = options.so,
                po = options.po,
                fulfil = options.fulfil,
                receipt = options.receipt;

            log.audit(logTitle, LogPrefix + '** Update Custom Serials: ' + JSON.stringify(options));

            if (customSerial && (so || po)) {
                var rec = ns_record.load({
                    type: 'customrecordserialnum',
                    id: customSerial.value
                });

                if (item) rec.setValue({ fieldId: 'custrecordserialitem', value: item });

                if (so && !rec.getValue({ fieldId: 'custrecordserialsales' }))
                    rec.setValue({ fieldId: 'custrecordserialsales', value: so });

                if (po && !rec.getValue({ fieldId: 'custrecordserialpurchase' }))
                    rec.setValue({ fieldId: 'custrecordserialpurchase', value: po });

                //3.00
                if (fulfil && !rec.getValue({ fieldId: 'custrecorditemfulfillment' }))
                    rec.setValue({ fieldId: 'custrecorditemfulfillment', value: fulfil });

                //3.00
                if (receipt && !rec.getValue({ fieldId: 'custrecorditemreceipt' }))
                    rec.setValue({ fieldId: 'custrecorditemreceipt', value: fulfil });

                rec.save();
            }
        },
        // 2.00 - Added methods for updating custom serials - END

        processCustomSerial: function (options) {
            var logTitle = [LogTitle, 'Helper:processCustomSerial'].join('::');

            var id = options.id,
                item = options.item,
                serial = options.serial,
                customSerial = options.customSerial,
                txns = Helper.searchRelatedTransactions({ id: id }),
                so = txns.so,
                po = txns.po,
                fulfil = txns.fulfil,
                receipt = txns.receipt;

            log.audit(logTitle, LogPrefix + '>> PROCESS serial -- ' + JSON.stringify(options));

            try {
                if (vc2_util.isEmpty(customSerial)) {
                    var newId = Helper.createCustomSerial({
                        id: id,
                        item: item,
                        serial: serial,
                        so: so,
                        po: po,
                        fulfil: fulfil,
                        receipt: receipt
                    });

                    // 2.00 Move logic and change updated field for custom serial
                    ns_record.submitFields({
                        type: ns_record.Type.INVENTORY_NUMBER,
                        id: id,
                        values: { custitemnumber_ctc_vc_sn: newId }
                    });
                } //2.00 Logic for updating the so and po fields of the existing custom serial
                else
                    Helper.updateCustomSerial({
                        customSerial: customSerial,
                        item: item,
                        so: so,
                        po: po,
                        fulfil: fulfil,
                        receipt: receipt
                    });
            } catch (e) {
                log.error(logTitle, LogPrefix + '## ERROR ## ' + JSON.stringify(e));
            }

            return fulfil;
        }
    };

    return MAP_REDUCE;
});
