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
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
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

    function getItems(poNum) {
        var itemList = [];

        var purchaseorderSearchObj = search.create({
            type: 'purchaseorder',
            filters: [
                ['type', 'anyof', 'PurchOrd'],
                'AND',
                ['transactionnumber', 'is', poNum],
                'AND',
                ['mainline', 'is', 'F']
            ],
            columns: [
                search.createColumn({ name: 'mainline', label: '*' }),
                search.createColumn({
                    name: 'tranid',
                    label: 'Document Number'
                }),
                search.createColumn({ name: 'item', label: 'Item' }),
                search.createColumn({ name: 'quantity', label: 'Quantity' })
            ]
        });
        var searchResultCount = purchaseorderSearchObj.runPaged().count;
        log.debug('purchaseorderSearchObj result count', searchResultCount);
        purchaseorderSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var itemObj = { id: '', name: '', qty: '' };
            itemObj.id = result.getValue('item');
            itemObj.name = result.getText('item');
            itemObj.qty = result.getValue('quantity');
            itemList.push(itemObj);
            return true;
        });
        return itemList;
    }

    function loadPO() {
        try {
            console.log('in loadPO');
            var poNum = jQuery('#ponum').val();
            if (!isEmpty(poNum)) {
                var itemList = getItems(poNum);
                if (!isEmpty(itemList)) {
                    var mySelect = jQuery('#itemselectfield');
                    console.log('mySelect = ' + JSON.stringify(mySelect));

                    for (var i = 0; i < itemList.length; i++) {
                        console.log(
                            'found item id = ' +
                                itemList[i].id +
                                ' name = ' +
                                itemList[i].name +
                                ' quantity = ' +
                                itemList[i].qty
                        );
                        //							options[options.length] = new Option(itemList[i].name, itemList[i].id);
                        mySelect.append(new Option('Foo', 'foo', true, true));
                    }
                } else {
                    console.log('No items found');
                }
            }

            console.log('in loadPO, po num = ' + poNum);
        } catch (err) {
            console.log('ERROR in loadPO ' + err);
        }
    }

    function showCart() {
        //				alert('Please Select a vendor and enter a PO number');

        try {
            alert('Starting showCartContents');

            var cartInfo = {};

            var cartEmail = document.getElementById('emailfield').value;
            alert('In library code email = ' + cartEmail);

            var userID = isNSCustomer(cartEmail);
            alert('after isNSCustomer userID = ' + userID);

            if (!isEmpty(userID)) {
                cartInfo.userID = userID;
                cartInfo.cart = getCart(userID);
                //					alert ('cart = '+cartInfo.cart)
                if (!isEmpty(cartInfo.cart)) {
                    document.getElementById('fnamefield').value = cartInfo.cart.firstName;
                    document.getElementById('lnamefield').value = cartInfo.cart.lastName;
                    document.getElementById('addr1field').value = cartInfo.cart.address.addr1;
                    document.getElementById('addr2field').value = cartInfo.cart.address.addr2;
                    document.getElementById('cityfield').value = cartInfo.cart.address.city;
                    document.getElementById('statefield').value = cartInfo.cart.address.state;
                    document.getElementById('zipfield').value = cartInfo.cart.address.zipcode;
                    document.getElementById('countryfield').value = cartInfo.cart.address.country;
                    document.getElementById('phonefield').value = cartInfo.cart.address.addrphone;
                    document.getElementById('cartloaded_fs_inp').value = true;
                }
            }
        } catch (err) {
            alert('error retrieving cart = ' + err);
        }
    }

    function pageInit(context) {
        console.log('page init');
        //alert('page init');
        //            jQuery('#tr_fg_donationgroup > :nth-child(2)').hide();
        //            jQuery('#tr_fg_donationgroup > :nth-child(3)').hide();
        // var rdoLabelField = context.currentRecord.getField('donationlabelfield')
        // var rdobehalfField = context.currentRecord.getField('rdoidentify')
        // try {
        // rdoLabelField.isDisplay = false;
        // rdobehalfField.isDisplay = false;
        // }
        // catch (err){
        // jQuery('#tr_fg_donationgroup > :nth-child(2)').hide();
        // jQuery('#tr_fg_donationgroup > :nth-child(3)').hide();
        // }
    }

    function fieldChanged(context) {
        console.log(context);
        //			alert ('field changed ' + context.fieldId)

        if (context.fieldId == 'productfieldid2') {
            /* 				alert ('context.sublistId = '  + context.sublistId);
                                alert ('context.line = '  + context.line);
                 */
            var cartJSON = JSON.parse(context.currentRecord.getValue('cartjsonfield'));
            console.log('cartJSON = ' + cartJSON.optionalPrices);

            var lineValue = context.currentRecord.getCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: context.fieldId
            });
            var linePrice = 0;

            console.log('lineValue = ' + lineValue);
            //find optional line by matching outNSItemId == lineValue
            for (var i = 0; i < cartJSON.optionalPrices.length; i++) {
                if (cartJSON.optionalPrices[i].outNSItemID == lineValue) {
                    linePrice = cartJSON.optionalPrices[i].outPrice;
                    console.log('price found = ' + linePrice);
                    break;
                }
            }

            context.currentRecord.setCurrentSublistValue({
                sublistId: context.sublistId,
                fieldId: 'upfieldid2',
                value: linePrice
            });
        } else if (context.fieldId == 'rdodonations') {
            //               alert ('you selected radio button '+ context.currentRecord.getText('rdodonations') + ' = '  +  context.currentRecord.getValue('rdodonations'))
            jQuery('#tr_fg_donationgroup > :nth-child(2)').show(500);
        } else if (context.fieldId == 'rdoidentify') {
            //               alert ('you selected radio button '+ context.currentRecord.getText('rdodonations') + ' = '  +  context.currentRecord.getValue('rdodonations'))
            var rdoLabelField = context.currentRecord.getField('donationlabelfield');
            var rdobehalfField = context.currentRecord.getField('rdoidentify');
            if (context.currentRecord.getValue('rdoidentify') == 'p3') {
                try {
                    rdoLabelField.isDisplay = true;
                    rdobehalfField.isDisplay = true;
                } catch (err) {
                    jQuery('#tr_fg_donationgroup > :nth-child(3)').show(500);
                }
            } else {
                try {
                    rdoLabelField.isDisplay = false;
                    rdobehalfField.isDisplay = false;
                } catch (err) {
                    jQuery('#tr_fg_donationgroup > :nth-child(3)').hide(500);
                }
            }
        }
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
        loadPO: loadPO,
        pageInit: pageInit
    };
});
