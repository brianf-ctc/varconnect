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
define(['N/search', '../Library/CTC_VCSP_Constants'], function (ns_search, VCSP_Global) {
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

    function _getEntityContactValues(options) {
        let entityId = options.entityId,
            returnValue = null;

        if (entityId) {
            let recLookup = ns_search.lookupFields({
                type: 'entity',
                id: entityId,
                columns: ['email', 'phone']
            });

            if (recLookup) {
                returnValue = {
                    email: recLookup.email,
                    phone: recLookup.phone
                };
            }
        }
        return returnValue;
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
        this.id = recPO.id;
        this.tranId = recPO.getValue({ fieldId: 'tranid' });
        this.vendorNumber = recPO.getValue('otherrefnum');
        this.createdDate = recPO.getValue({ fieldId: 'createddate' });
        this.entity = recPO.getValue({ fieldId: 'entity' });
        this.subsidiary = recPO.getValue({ fieldId: 'subsidiary' });
        this.currency = recPO.getValue({ fieldId: 'currencysymbol' });
        this.total = recPO.getValue({ fieldId: 'total' });
        this.tranDate = recPO.getText({ fieldId: 'trandate' });
        this.memo = recPO.getValue({ fieldId: 'memo' });
        this.dropShipSO = recPO.getValue({ fieldId: 'dropshipso' });
        this.isDropShip = this.dropShipSO ? true : false;
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
        this.shipContact = this.shipAttention;
        this.shipAddressee = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'addressee'
        });
        this.shipAddrName1 = this.shipAttention || this.shipAddressee;
        (this.shipAddrName2 = this.shipAttention ? this.shipAddressee : null),
            (this.shipPhone = _getSubrecordValue({
                recPO: recPO,
                subrecord: 'shippingaddress',
                field: 'addrphone'
            }));
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
        this.shipState = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'state'
        });
        this.shipZip = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'zip'
        });
        this.shipCountry = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'shippingaddress',
            field: 'country'
        });
        this.shipMethod = _getFieldText({ recPO: recPO, field: 'shipmethod' });

        let shipToContactDetails = _getEntityContactValues({
            entityId: _getFieldValue({ recPO: recPO, field: 'shipto' })
        });
        if (shipToContactDetails) {
            this.shipEmail = shipToContactDetails.email;
            this.shipPhone = this.shipPhone || shipToContactDetails.phone;
        }

        this.billAttention = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'attention'
        });
        this.billContact = this.billAttention;
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
        this.billState = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'state'
        });
        this.billZip = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'zip'
        });
        this.billCountry = _getSubrecordValue({
            recPO: recPO,
            subrecord: 'billingaddress',
            field: 'country'
        });

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
                item: _getSublistText({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'item',
                    line: i
                }),
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
                rate: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: 'rate',
                    line: i
                }),
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
                memo: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.MEMO,
                    line: i
                }),
                quotenumber: _getSublistText({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.QUOTE_NUMBER,
                    line: i
                }),
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
                ingramPartNumber: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.INGRAM_PART_NUMBER,
                    line: i
                }),
                dandhPartNumber: _getSublistValue({
                    recPO: recPO,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.DANDH_PART_NUMBER,
                    line: i
                })
            });
        }

        this.setQuote = function (options) {
            let columnId = options.columnId,
                nativePO = options.nativePO;

            for (let i = 0; i < this.items.length; i++) {
                this.items[i].quotenumber =
                    _getSublistValue({
                        recPO: nativePO,
                        sublist: 'item',
                        field: columnId,
                        line: i
                    }) || this.items[i].quotenumber;
            }
        };

        this.setValuesFromVendorConfig = function (options) {
            let nativePO = options.nativePO,
                recVendorConfig = options.recVendorConfig;

            let poBillAddress = [
                this.billAttention,
                this.billAddressee,
                this.billAddr1,
                this.billAddr2,
                this.billCity,
                this.billState,
                this.billZip
            ]
                .join('')
                .trim();

            if (!poBillAddress || !poBillAddress.length) {
                this.billAttention = recVendorConfig.Bill.attention;
                this.billAddressee = recVendorConfig.Bill.addressee;
                this.billAddr1 = recVendorConfig.Bill.address1;
                this.billAddr2 = recVendorConfig.Bill.address2;
                this.billCity = recVendorConfig.Bill.city;
                this.billState = recVendorConfig.Bill.state;
                this.billZip = recVendorConfig.Bill.zip;
                this.billCountry = recVendorConfig.Bill.country;
            }
            this.billContact = recVendorConfig.Bill.attention;
            this.billEmail = recVendorConfig.Bill.email;
            this.billPhone = this.billPhone || recVendorConfig.Bill.phoneno;

            if (recVendorConfig.poNumField) {
                this.tranId =
                    recPO.getValue({
                        fieldId: recVendorConfig.poNumField
                    }) || this.tranId;
            }

            if (recVendorConfig.quoteColumn) {
                this.setQuote({
                    columnId: recVendorConfig.quoteColumn,
                    nativePO: nativePO
                });
            }

            if (recVendorConfig.memoField) {
                this.memo =
                    recPO.getValue({
                        fieldId: recVendorConfig.memoField
                    }) || this.memo;
            }

            if (recVendorConfig.shipContactField) {
                this.shipContact =
                    recPO.getValue({
                        fieldId: recVendorConfig.shipContactField
                    }) || this.shipContact;
            }

            if (recVendorConfig.shipEmailField) {
                this.shipEmail =
                    recPO.getValue({
                        fieldId: recVendorConfig.shipEmailField
                    }) || this.shipEmail;
            }

            if (recVendorConfig.shipPhoneField) {
                this.shipPhone =
                    recPO.getValue({
                        fieldId: recVendorConfig.shipPhoneField
                    }) || this.shipPhone;
            }
        };

        // set values from sales order
        if (this.createdFrom) {
            let salesOrderValues = _getSalesOrderValues(this.createdFrom);
            this.shipComplete = salesOrderValues.shipcomplete;
        }
    }

    return PurchaseOrder;
});
