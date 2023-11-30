/**
 * Copyright (c) 2023 Catalyst Tech Corp
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
define([
    'N/search',
    '../Library/CTC_VCSP_Constants',
    '../Library/CTC_VCSP_Lib_VendorConfig'
], function (ns_search, VCSP_Global, libVendorConfig) {
    var VendorCFG = {};

    function _getFieldValue(options) {
        let recPO = options.recPO,
            field = options.field;

        return recPO.getValue({ fieldId: field }) ? recPO.getValue({ fieldId: field }) : undefined;
    }

    function _getFieldText(options) {
        let recPO = options.recPO,
            field = options.field;

        return recPO.getText({ fieldId: field }) ? recPO.getText({ fieldId: field }) : undefined;
    }

    function _getSubrecordValue(options) {
        let recPO = options.recPO,
            subrecordId = options.subrecord,
            field = options.field,
            value;

        let subrecord = recPO.getSubrecord({ fieldId: subrecordId });
        if (subrecord) value = subrecord.getValue({ fieldId: field });

        return value;
    }

    function _getSublistValue(options) {
        let recPO = options.recPO,
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
        let recPO = options.recPO,
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
        let entityId = options.entityId,
            email = null;

        if (entityId) {
            let recLookup = ns_search.lookupFields({
                type: 'entity',
                id: entityId,
                columns: 'email'
            });

            if (recLookup) email = recLookup.email;
        }
        return email;
    }

    function _getSalesOrderValues(options) {
        let salesOrderId = options.id || options,
            returnValue = null;

        if (salesOrderId) {
            returnValue = ns_search.lookupFields({
                type: ns_search.Type.SALES_ORDER,
                id: salesOrderId,
                columns: 'shipcomplete'
            });
        }
        return returnValue || {};
    }

    function PurchaseOrder(recPO) {
        this.entity = recPO.getValue({ fieldId: 'entity' });
        this.subsidiary = recPO.getValue({ fieldId: 'subsidiary' });

        VendorCFG = libVendorConfig.getVendorConfiguration({
            vendor: this.entity,
            subsidiary: this.subsidiary
        });
        log.audit('PO Obj', VendorCFG);

        this.id = recPO.id;
        this.tranId = recPO.getValue({ fieldId: 'tranid' });
        this.createdDate = recPO.getValue({ fieldId: 'createddate' });
        this.currency = recPO.getValue({ fieldId: 'currencysymbol' });
        this.total = recPO.getValue({ fieldId: 'total' });
        this.memo = recPO.getValue({ fieldId: 'memo' });
        this.tranDate = recPO.getText({ fieldId: 'trandate' });
        this.dropShipPO = recPO.getValue({ fieldId: 'dropshippo' });
        this.custPO = recPO.getText({ fieldId: VCSP_Global.Fields.Transaction.CUSTOMER_PO_NUMBER });
        this.additionalVendorDetails = recPO.getValue({
            fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS
        });

        let subRecShipping = recPO.getSubrecord({ fieldId: 'shippingaddress' });
        let addressFields = [
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

        if (subRecShipping) {
            let shipAddr = {};
            addressFields.forEach(function (field) {
                shipAddr[field] = subRecShipping.getValue({ fieldId: field });
                return true;
            });
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
        this.shipMethod = _getFieldText({ recPO: recPO, field: 'shipmethod' });

        this.shipEmail = _getEmail({ entityId: _getFieldValue({ recPO: recPO, field: 'shipto' }) });

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
        this.dellShippingCode = _getFieldValue({
            recPO: recPO,
            field: 'custbody_ctc_vcsp_dell_ship_code'
        });

        this.paymentTerms = _getFieldValue({ recPO: recPO, field: 'terms' });

        this.items = [];

        let itemCount = recPO.getLineCount({ sublistId: 'item' });

        for (let i = 0; i < itemCount; i++) {
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
                    field: VCSP_Global.Fields.Transaction.Item.QUOTE_NUMBER,
                    line: i
                }),
                quotenumber_ext: VendorCFG.quoteNoField
                    ? _getSublistText({
                          recPO: recPO,
                          sublist: 'item',
                          field: VendorCFG.quoteNoField,
                          line: i
                      })
                    : null,
                manufacturer: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.MANUFACTURER,
                    line: i
                }),
                synnexSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.SYNNEX_SKU,
                    line: i
                }),
                dellSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.DELL_SKU,
                    line: i
                }),
                ingramSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.INGRAM_SKU,
                    line: i
                }),
                dandhSKU: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.DANDH_SKU,
                    line: i
                })
            });
        }

        this.setQuote = function (options) {
            let columnId = options.columnId,
                nativePO = options.nativePO;

            for (let i = 0; i < this.items.length; i++) {
                this.items[i].quote = _getSublistValue({
                    recPO: nativePO,
                    sublist: 'item',
                    field: columnId,
                    line: i
                });
            }
        };

        this.setValuesFromVendorConfig = function (options) {
            let nativePO = options.nativePO,
                recVendorConfig = options.recVendorConfig;

            log.debug('recVendorConfig.Bill', recVendorConfig.Bill);

            this.billAttention = this.billAttention || recVendorConfig.Bill.attention;
            this.billAddressee = this.billAddressee || recVendorConfig.Bill.addressee;
            this.billEmail = this.billEmail || recVendorConfig.Bill.email;
            this.billAddr1 = this.billAddr1 || recVendorConfig.Bill.address1;
            this.billAddr2 = this.billAddr2 || recVendorConfig.Bill.address2;
            this.billCity = this.billCity || recVendorConfig.Bill.city;
            this.billState = this.billState || recVendorConfig.Bill.state;
            this.billZip = this.billZip || recVendorConfig.Bill.zip;
            this.billCountry = this.billCountry || recVendorConfig.Bill.country;
            this.billPhone = this.billPhone || recVendorConfig.Bill.phoneno;

            if (recVendorConfig.skuColumn)
                this.setQuote({
                    columnId: recVendorConfig.skuColumn,
                    nativePO: nativePO
                });
        };

        // set values from sales order
        if (this.createdFrom) {
            let salesOrderValues = _getSalesOrderValues(this.createdFrom);
            this.shipComplete = salesOrderValues.shipcomplete;
        }
    }

    return PurchaseOrder;
});
