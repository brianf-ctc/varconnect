/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 */
/**
 *
 *  Library of routines to support VAR Connect serial number functionality
 *
 **/

/*
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/search', 'N/https', 'N/record'], function (search, https, record) {
    // Searches NS for first customer occurrence of provided email
    // If found return customer information, if not return null
    // Note if multiple occurrences are found, only the first result is returned
    function isNSCustomer(email) {
        if (!isEmpty(email)) {
            //                alert("in isNSCustomer email = "+email);

            var myFilters = [];
            myFilters.push(
                search.createFilter({
                    name: 'email',
                    operator: search.Operator.IS,
                    values: email
                })
            );
            myFilters.push(
                search.createFilter({
                    name: 'isinactive',
                    operator: search.Operator.IS,
                    values: 'F'
                })
            );
            var results = search
                .create({
                    type: search.Type.CUSTOMER,
                    columns: ['email', 'firstname', 'lastname'],
                    filters: myFilters
                })
                .run()
                .getRange({
                    start: 0,
                    end: 1
                });
            if (results != '') {
                return results[0].id;
            }
        }
        return null;
    }

    function confirmEmail(checkEmail) {
        alert('In confirmEmail ' + checkEmail);
        var userID = isNSCustomer(checkEmail);
        alert('after isNSCustomer userID = ' + userID);

        if (!isEmpty(userID)) {
            alert('That is an NS customer email! user ID = ' + userID);
            return userID;
        } else {
            alert('That is NOT an NS customer email!');
            return null;
        }
    }

    // Provided the PO num and Item id, will return a comma delimited string of serial numbers for that PO and Item
    function getItemSNList(transNum, ItemId, transType) {
        transType = transType || 'Purchase Order';

        var fieldMap = {
            'Purchase Order': 'custrecordserialpurchase.numbertext',
            'Sales Order': 'custrecordserialsales.numbertext',
            'Item Fulfillment': 'custrecorditemfulfillment.numbertext',
            Invoice: 'custrecordserialinvoice.numbertext',
            'Customer RMA': 'custrecordrmanumber.numbertext',
            'Vendor RMA': 'custrecordvendorrma.numbertext'
        };
        //            var snList = "";
        var snList = [];
        log.debug('params', transNum + ' - ' + ItemId);
        log.debug('transType', transType);
        log.debug('fieldMapping', fieldMap[transType]);

        var transStr = String(transNum);
        var ItemId = decodeURIComponent(String(ItemId));
        var customrecordserialnumSearchObj = search.create({
            type: 'customrecordserialnum',
            filters: [
                [fieldMap[transType], 'is', transStr],
                'AND',
                ['custrecordserialitem.internalid', 'anyof', ItemId]
            ],
            columns: [
                search.createColumn({
                    name: 'name',
                    sort: search.Sort.ASC,
                    label: 'Name'
                }),
                search.createColumn({ name: 'scriptid', label: 'Script ID' }),
                search.createColumn({
                    name: 'custrecordserialitem',
                    label: 'ItemNum'
                })
            ]
        });
        var searchResultCount = customrecordserialnumSearchObj.runPaged().count;
        log.debug(
            'customrecordserialnumSearchObj result count',
            searchResultCount
        );

        for (var x = 0; x < searchResultCount; x += 1000) {
            var rangeStart = x;

            var searchResult = customrecordserialnumSearchObj.run().getRange({
                start: rangeStart,
                end: rangeStart + 1000
            });
            for (var i = 0; i < searchResult.length; i++) {
                var snNum = searchResult[i].getValue({ name: 'name' });
                var snId = searchResult[i].id;

                snList.push({
                    snNum: snNum,
                    snId: snId
                });
                //                    snList += snNum + ", ";
            }
        }
        //            if (!isEmpty(snList)){
        //                var lastIndex = snList.lastIndexOf(",")
        //                var snList2 = snList.substring(0, lastIndex);
        //                return snList2;
        //            }
        return snList;
    }

    function isEmpty(stValue) {
        if (stValue == '' || stValue == null || stValue == undefined) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if (stValue == '') {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }

            return false;
        }
    }

    return {
        confirmEmail: confirmEmail,
        getItemSNList: getItemSNList
    };
});
