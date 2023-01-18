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
define(['N/search', '../Library/CTC_VCSP_Constants.js'], function (search, constants) {
    function _getFieldValue(options) {
        var recPO = options.recPO,
            field = options.field;

        return recPO.getValue({ fieldId: field }) ? recPO.getValue({ fieldId: field }) : undefined;
    }

    function _getFieldText(options) {
        var recPO = options.recPO,
            field = options.field;

        return recPO.getText({ fieldId: field }) ? recPO.getText({ fieldId: field }) : undefined;
    }

    function _getSubrecordValue(options) {
        var recPO = options.recPO,
            subrecordId = options.subrecord,
            field = options.field,
            value;

        var subrecord = recPO.getSubrecord({ fieldId: subrecordId });
        if (subrecord) value = subrecord.getValue({ fieldId: field });

        return value;
    }

    function _getSublistValue(options) {
        var recPO = options.recPO,
            sublist = options.sublist,
            field = options.field,
            line = options.line,
            val = recPO.getSublistValue({
                sublistId: sublist,
                fieldId: field,
                line: line
            });

        if (field == 'rate' && !val) val = '0.00';

        return val ? val : undefined;
    }

    function _getSublistText(options) {
        var recPO = options.recPO,
            sublist = options.sublist,
            field = options.field,
            line = options.line,
            val = recPO.getSublistText({
                sublistId: sublist,
                fieldId: field,
                line: line
            });

        return val ? val : undefined;
    }

    function _getEmail(options) {
        var entityId = options.entityId,
            email = null;

        if (entityId) {
            var recLookup = search.lookupFields({
                type: 'entity',
                id: entityId,
                columns: 'email'
            });

            if (recLookup) email = recLookup.email;
        }
        return email;
    }

    function _getAdditionalLookupValues(options) {
        var recPO = options.recPO,
            columns = options.columns;
        var values = search.lookupFields({
            type: search.Type.PURCHASE_ORDER,
            id: recPO.id,
            columns: columns
        });
        return values ? values : undefined;
    }

    function PurchaseOrder(recPO) {
        this.id = recPO.id;
        this.tranId = recPO.getValue({ fieldId: 'tranid' });

        this.entity = recPO.getValue({ fieldId: 'entity' });
        this.subsidiary = recPO.getValue({ fieldId: 'subsidiary' });
        this.currency = recPO.getValue({ fieldId: 'currencysymbol' });
        this.total = recPO.getValue({ fieldId: 'total' });
        this.memo = recPO.getValue({ fieldId: 'memo' });
        this.tranDate = recPO.getText({ fieldId: 'trandate' });
        this.dropShipPO = recPO.getValue({ fieldId: 'dropshippo' });
        this.custPO = recPO.getText({ fieldId: constants.Fields.Transaction.CUSTOMER_PO_NUMBER });

        var subRecShipping = recPO.getSubrecord({ fieldId: 'shippingaddress' });
        var addressFields = [
            'attention',
            'addressee',
            'addrphone',
            'addr1',
            'addr2',
            'city',
            'state',
            'zip',
            'country',
            'countrycode'
        ];

        log.emergency('Sub Rec', subRecShipping);
        log.emergency('Sub Rec', addressFields);

        if (subRecShipping) {
            var shipAddr = {};
            addressFields.forEach(function (field) {
                shipAddr[field] = subRecShipping.getValue({ fieldId: field });
                return true;
            });
            log.emergency('Sub Rec', shipAddr);
        }

        this.shipAttention = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'attention'
        });
        this.shipAddressee = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'addressee'
        });
        this.shipPhone = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'addrphone'
        });
        this.shipAddr1 = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'addr1'
        });
        this.shipAddr2 = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'addr2'
        });
        this.shipCity = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'city'
        });
        this.shipState = _getFieldValue({ recPO: recPO, field: 'shipstate' });
        this.shipZip = _getFieldValue({ recPO: recPO, field: 'shipzip' });
        this.shipCountry = _getFieldValue({ recPO: recPO, field: 'shipcountry' });
        this.shipMethod = _getFieldValue({ recPO: recPO, field: 'shipmethod' });
        this.shipMethodCode = _getFieldValue({ recPO: recPO, field: constants.Fields.Transaction.SHIP_CODE });

        this.shipEmail = _getEmail({ entityId: _getFieldValue({ recPO: recPO, field: 'shipto' }) });
        
        var poLookupValues = _getAdditionalLookupValues({
            recPO: recPO,
            columns: [
                [ 'location', constants.Fields.Location.SYNNEX_WAREHOUSE_CODE ].join('.')
            ]
        });
        this.shipFromSynnexWarehouse = poLookupValues[ [ 'location', constants.Fields.Location.SYNNEX_WAREHOUSE_CODE ].join('.') ];

        this.billAttention = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'attention'
        });
        this.billAddressee = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'addressee'
        });
        this.billPhone = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'addrphone'
        });
        this.billAddr1 = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'addr1'
        });
        this.billAddr2 = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'addr2'
        });
        this.billCity = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'city'
        });
        this.billState = _getFieldValue({ recPO: recPO, field: 'billstate' });
        this.billZip = _getFieldValue({ recPO: recPO, field: 'billzip' });
        this.billCountry = _getFieldValue({ recPO: recPO, field: 'billcountry' });

        this.terms = _getFieldText({ recPO: recPO, field: 'terms' });

        this.createdFrom = _getFieldValue({ recPO: recPO, field: 'createdfrom' });
        // created a more generic custom ship method code field, but not dispensing of specific method code fields in case needed
        this.synnexShippingCode = this.shipMethodCode;
        this.dellShippingCode = _getFieldValue({
            recPO: recPO,
            field: 'custbody_ctc_vcsp_dell_ship_code'
        }) || this.shipMethodCode;

        this.paymentTerms = _getFieldValue({ recPO: recPO, field: 'terms' });

        this.items = [];

        var itemCount = recPO.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < itemCount; i++) {
            this.items.push({
                lineuniquekey: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'lineuniquekey',
                    line: i
                }),
                item: _getSublistText({ recPO: recPO, sublist: 'item', field: 'item', line: i }),
                description: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'description',
                    line: i
                }),
                quantity: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'quantity',
                    line: i
                }),
                rate: _getSublistValue({ recPO: recPO, sublist: 'item', field: 'rate', line: i }),
                amount: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'amount',
                    line: i
                }),
                expectedReceiptDate: _getSublistText({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'expectedreceiptdate',
                    line: i
                }),
                quotenumber: _getSublistText({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'custcol_ctc_vcsp_quote_no',
                    line: i
                }),
                manufacturer: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'custcol_ctc_manufacturer',
                    line: i
                }),
                synnexSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: constants.Fields.Transaction.Item.SYNNEX_SKU,
                    line: i
                }),
                dellSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'custcol_ctc_vcsp_sku_dell',
                    line: i
                })
            });
        }

        this.setQuote = function (options) {
            var columnId = options.columnId,
                nativePO = options.nativePO;

            for (var i = 0; i < this.items.length; i++) {
                this.items[i].quote = _getSublistValue({
                    recPO: nativePO,
                    sublist: 'item',
                    field: columnId,
                    line: i
                });
            }
        };

        this.setValuesFromVendorConfig = function (options) {
            var nativePO = options.nativePO,
                recVendorConfig = options.recVendorConfig;

            log.debug('recVendorConfig.Bill', recVendorConfig.Bill);

            this.billAttention = recVendorConfig.Bill.attention;
            this.billAddressee = recVendorConfig.Bill.addressee;
            this.billEmail = recVendorConfig.Bill.email;
            this.billAddr1 = recVendorConfig.Bill.address1;
            this.billAddr2 = recVendorConfig.Bill.address2;
            this.billCity = recVendorConfig.Bill.city;
            this.billState = recVendorConfig.Bill.state;
            this.billZip = recVendorConfig.Bill.zip;
            this.billCountry = recVendorConfig.Bill.country;

            if (recVendorConfig.skuColumn)
                this.setQuote({
                    columnId: recVendorConfig.skuColumn,
                    nativePO: nativePO
                });
        };
    }

    return PurchaseOrder;
});
