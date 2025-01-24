/**
 * Copyright (c) 2025 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
//*************************************************************************
//*  Description:
//*     Suitelet that displays list of serial numbers for the transaction
//*     and item that is passed in
//*************************************************************************

/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/search',
    'N/record',
    'N/url',
    './CTC_VC2_Constants.js',
    './CTC_VC2_Lib_Utils',
    './CTC_VC_LIb_SerialsLib.js'
], function (ns_ui, ns_search, ns_record, ns_url, vc2_constant, vc2_util, vc_serial) {
    var LogTitle = 'ViewSerials';

    var SUBLIST_ID = 'custpage_orders',
        SERIALREC = vc2_constant.RECORD.SERIALS;

    var Helper = {
        getItemSNList: function (option) {
            var logTitle = [LogTitle, 'getItemSNList'].join('::');

            var serialTxnMap = {};
            serialTxnMap[ns_record.Type.PURCHASE_ORDER] = SERIALREC.FIELD.PURCHASE_ORDER;
            serialTxnMap[ns_record.Type.SALES_ORDER] = SERIALREC.FIELD.SALES_ORDER;
            serialTxnMap[ns_record.Type.INVOICE] = SERIALREC.FIELD.INVOICE;
            serialTxnMap[ns_record.Type.ITEM_FULFILLMENT] = SERIALREC.FIELD.ITEM_FULFILLMENT;
            serialTxnMap[ns_record.Type.ITEM_RECEIPT] = SERIALREC.FIELD.ITEM_RECEIPT;
            serialTxnMap[ns_record.Type.RETURN_AUTHORIZATION] = 'custrecordrmanumber';
            serialTxnMap[ns_record.Type.VENDOR_RETURN_AUTHORIZATION] = 'custrecordvendorrma';

            var searchOption = {
                type: SERIALREC.ID,
                filters: [],
                columns: [
                    ns_search.createColumn({
                        name: 'name',
                        sort: ns_search.Sort.ASC
                    }),
                    ns_search.createColumn({ name: SERIALREC.FIELD.ITEM })
                ]
            };

            if (option.itemId)
                searchOption.filters.push([SERIALREC.FIELD.ITEM, 'anyof', option.itemId]);

            if (option.recordType && serialTxnMap[option.recordType] && option.recordId) {
                searchOption.filters.push('AND');
                searchOption.filters.push([
                    serialTxnMap[option.recordType],
                    'anyof',
                    option.recordId
                ]);
            }

            vc2_util.log(logTitle, '>> search option: ', searchOption);

            var serialNumSearch = ns_search.create(searchOption);
            var arrResults = [];

            serialNumSearch.run().each(function (result) {
                arrResults.push({
                    id: result.id,
                    serialNum: result.getValue({ name: 'name' }),
                    item: result.getValue({ name: 'name' })
                });
                return true;
            });

            return arrResults;
        }
    };

    var SUITELET = {
        SUBLIST_ID: 'custpage_orders',
        onRequest: function (context) {
            var logTitle = [LogTitle, 'onRequest'].join(':');

            var mapRecordLabel = {};
            mapRecordLabel[ns_record.Type.PURCHASE_ORDER] = 'Purchase Order';
            mapRecordLabel[ns_record.Type.SALES_ORDER] = 'Sales Order';
            mapRecordLabel[ns_record.Type.INVOICE] = 'Invoice';
            mapRecordLabel[ns_record.Type.ITEM_FULFILLMENT] = 'Item Fulfillment';
            mapRecordLabel[ns_record.Type.ITEM_RECEIPT] = 'Item Receipt';
            mapRecordLabel[ns_record.Type.RETURN_AUTHORIZATION] = 'Customer RMA';
            mapRecordLabel[ns_record.Type.VENDOR_RETURN_AUTHORIZATION] = 'Vendor RMA';

            try {
                var param = context.request.parameters,
                    Current = {
                        recordType: param.transType,
                        recordId: param.transId,
                        itemId: param.itemId,
                        itemName: param.itemName
                    };
                vc2_util.log(logTitle, '>> Current: ', Current);
                vc2_util.LogPrefix = '[' + [Current.recordType, Current.recordId].join(':') + '] ';

                if (!Current.itemName && Current.itemId) {
                    var itemData = vc2_util.flatLookup({
                        type: 'item',
                        id: Current.itemId,
                        columns: ['itemid']
                    });
                    vc2_util.log(logTitle, '>> Item Data: ', itemData);
                    Current.itemName = itemData.itemid;
                }

                var recordData = vc2_util.flatLookup({
                    type: 'transaction',
                    id: Current.recordId,
                    columns: [
                        'tranid',
                        'type',
                        'recordtype',
                        'createdfrom',
                        'createdfrom.type',
                        'createdfrom.recordtype',
                        'createdfrom.tranid'
                    ]
                });
                vc2_util.log(logTitle, '>> TranData: ', recordData);

                ///////////////////////////////////
                //// FORM CREATION ///////////////
                var form = ns_ui.createForm({ title: 'View Serial Numbers' });
                var mainGroup = form.addFieldGroup({
                    id: 'maingroup',
                    label: 'Primary Information'
                });
                mainGroup.isSingleColumn = true;

                var formFields = {};

                // FIELD: ITEM
                formFields.Item = form.addField({
                    id: 'custpage_itemname',
                    type: ns_ui.FieldType.TEXT,
                    label: 'Item',
                    container: 'maingroup'
                });
                formFields.Item.defaultValue = Current.itemName;
                formFields.Item.updateDisplayType({ displayType: ns_ui.FieldDisplayType.INLINE });

                // FIELD: Transaction
                formFields.TxnData = form.addField({
                    id: 'custpage_txnnum',
                    type: ns_ui.FieldType.SELECT,
                    source: 'transaction',
                    label: mapRecordLabel[Current.recordType],
                    container: 'maingroup'
                });
                formFields.TxnData.defaultValue = Current.recordId;
                formFields.TxnData.updateDisplayType({
                    displayType: ns_ui.FieldDisplayType.INLINE
                });

                // FIELD: createdfrom SO
                if (Current.recordType != ns_record.Type.SALES_ORDER && recordData.createdfrom) {
                    formFields.SalesOrd = form.addField({
                        id: 'custpage_salesord',
                        type: ns_ui.FieldType.SELECT,
                        source: 'transaction',
                        label: recordData['createdfrom.type'].text,
                        container: 'maingroup'
                    });
                    formFields.SalesOrd.defaultValue = recordData.createdfrom.value;
                    formFields.SalesOrd.updateDisplayType({
                        displayType: ns_ui.FieldDisplayType.INLINE
                    });
                }

                // SUBLIST: serials
                var arrSerialList = Helper.getItemSNList(Current);
                vc2_util.log(logTitle, '>> arrSerialList: ', arrSerialList);

                var formSublist = form.addSublist({
                    id: 'custpage_sublist',
                    type: ns_ui.SublistType.LIST,
                    label: 'Serials'
                });

                formSublist
                    .addField({
                        id: 'custpage_serialnum',
                        type: ns_ui.FieldType.TEXT,
                        label: 'Serial'
                    })
                    .updateDisplayType({
                        displayType: ns_ui.FieldDisplayType.INLINE
                    });

                arrSerialList.forEach(function (serial, idx) {
                    var serialLinkUrl = ns_url.resolveRecord({
                        recordType: SERIALREC.ID,
                        recordId: serial.id
                    });

                    formSublist.setSublistValue({
                        id: 'custpage_serialnum',
                        line: idx,
                        value:
                            '<span>' +
                            ('<a href="' +
                                serialLinkUrl +
                                '" target="_blank" class="dottedlink">') +
                            (serial.serialNum + '</a></span>')
                    });
                });

                context.response.writePage(form);
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ##', error);
            }
        }
    };

    return SUITELET;
});
