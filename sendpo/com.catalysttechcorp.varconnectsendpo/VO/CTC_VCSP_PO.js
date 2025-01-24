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
    function _getFieldValue(option) {
        let record = option.transaction,
            field = option.field;

        return record.getValue({ fieldId: field }) ? record.getValue({ fieldId: field }) : undefined;
    }

    function _getFieldText(option) {
        let record = option.transaction,
            field = option.field;

        return record.getText({ fieldId: field }) ? record.getText({ fieldId: field }) : undefined;
    }

    function _getSubrecordValue(option) {
        let record = option.transaction,
            subrecordId = option.subrecord,
            field = option.field,
            value;

        let subrecord = record.getSubrecord({ fieldId: subrecordId });
        if (subrecord) value = subrecord.getValue({ fieldId: field });

        return value;
    }

    function _getSublistValue(option) {
        let record = option.transaction,
            sublist = option.sublist,
            field = option.field,
            line = option.line,
            val = record.getSublistValue({
                sublistId: sublist,
                fieldId: field,
                line: line
            });

        if (field == 'rate' && !val) val = '0.00';

        return val ? val : undefined;
    }

    function _getSublistText(option) {
        let record = option.transaction,
            sublist = option.sublist,
            field = option.field,
            line = option.line,
            val = record.getSublistText({
                sublistId: sublist,
                fieldId: field,
                line: line
            });

        return val ? val : undefined;
    }

    function _getEntityContactValues(option) {
        let entityId = option.entityId,
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

    function _getSalesOrderValues(option) {
        let salesOrderId = option.id || option,
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

    function PurchaseOrder(record) {
        this.id = record.id;
        this.tranId = record.getValue({ fieldId: 'tranid' });
        this.vendorNumber = record.getValue('otherrefnum');
        this.createdDate = record.getValue({ fieldId: 'createddate' });
        this.entity = record.getValue({ fieldId: 'entity' });
        this.subsidiary = record.getValue({ fieldId: 'subsidiary' });
        this.currency = record.getValue({ fieldId: 'currencysymbol' });
        this.total = record.getValue({ fieldId: 'total' });
        this.tranDate = record.getText({ fieldId: 'trandate' });
        this.memo = record.getValue({ fieldId: 'memo' });
        this.dropShipSO = record.getValue({ fieldId: 'dropshipso' });
        this.isDropShip = this.dropShipSO ? true : false;
        this.custPO = record.getText({
            fieldId: VCSP_Global.Fields.Transaction.CUSTOMER_PO_NUMBER
        });
        this.additionalVendorDetails = record.getValue({
            fieldId: VCSP_Global.Fields.Transaction.VENDOR_DETAILS
        });

        let subRecShipping = record.getSubrecord({ fieldId: 'shippingaddress' });
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
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'attention'
        });
        this.shipContact = this.shipAttention;
        this.shipAddressee = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'addressee'
        });
        this.shipAddrName1 = this.shipAttention || this.shipAddressee;
        (this.shipAddrName2 = this.shipAttention ? this.shipAddressee : null),
            (this.shipPhone = _getSubrecordValue({
                transaction: record,
                subrecord: 'shippingaddress',
                field: 'addrphone'
            }));
        this.shipAddr1 = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'addr1'
        });
        this.shipAddr2 = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'addr2'
        });
        this.shipCity = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'city'
        });
        this.shipState = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'state'
        });
        this.shipZip = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'zip'
        });
        this.shipCountry = _getSubrecordValue({
            transaction: record,
            subrecord: 'shippingaddress',
            field: 'country'
        });
        this.shipMethod = _getFieldText({ transaction: record, field: 'shipmethod' });

        let shipToContactDetails = _getEntityContactValues({
            entityId: _getFieldValue({ transaction: record, field: 'shipto' })
        });
        if (shipToContactDetails) {
            this.shipEmail = shipToContactDetails.email;
            this.shipPhone = this.shipPhone || shipToContactDetails.phone;
        }

        this.billAttention = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'attention'
        });
        this.billContact = this.billAttention;
        this.billAddressee = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'addressee'
        });
        this.billPhone = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'addrphone'
        });
        this.billAddr1 = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'addr1'
        });
        this.billAddr2 = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'addr2'
        });
        this.billCity = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'city'
        });
        this.billState = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'state'
        });
        this.billZip = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'zip'
        });
        this.billCountry = _getSubrecordValue({
            transaction: record,
            subrecord: 'billingaddress',
            field: 'country'
        });

        this.terms = _getFieldText({ transaction: record, field: 'terms' });

        this.createdFrom = _getFieldValue({ transaction: record, field: 'createdfrom' });
        this.dellShippingCode = _getFieldValue({
            transaction: record,
            field: 'custbody_ctc_vcsp_dell_ship_code'
        });

        this.paymentTerms = _getFieldValue({ transaction: record, field: 'terms' });

        this.items = [];

        let itemCount = record.getLineCount({ sublistId: 'item' });

        for (let i = 0; i < itemCount; i++) {
            this.items.push({
                lineuniquekey: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: 'lineuniquekey',
                    line: i
                }),
                item: _getSublistText({
                    transaction: record,
                    sublist: 'item',
                    field: 'item',
                    line: i
                }),
                description: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: 'description',
                    line: i
                }),
                quantity: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: 'quantity',
                    line: i
                }),
                rate: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: 'rate',
                    line: i
                }),
                amount: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: 'amount',
                    line: i
                }),
                expectedReceiptDate: _getSublistText({
                    transaction: record,
                    sublist: 'item',
                    field: 'expectedreceiptdate',
                    line: i
                }),
                memo: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.MEMO,
                    line: i
                }),
                quotenumber: _getSublistText({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.QUOTE_NUMBER,
                    line: i
                }),
                manufacturer: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.MANUFACTURER,
                    line: i
                }),
                synnexSKU: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.SYNNEX_SKU,
                    line: i
                }),
                dellSKU: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.DELL_SKU,
                    line: i
                }),
                ingramPartNumber: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.INGRAM_PART_NUMBER,
                    line: i
                }),
                dandhPartNumber: _getSublistValue({
                    transaction: record,
                    sublist: 'item',
                    field: VCSP_Global.Fields.Transaction.Item.DANDH_PART_NUMBER,
                    line: i
                })
            });
        }

        this.setItemLineValues = function (option) {
            let columns = option.columns,
                record = option.transaction;
            for (let fieldName in columns) {
                let fieldId = columns[fieldName];
                for (let i = 0, lineCount = this.items.length; i < lineCount; i++) {
                    this.items[i][fieldName] =
                        _getSublistValue({
                            transaction: record,
                            sublist: 'item',
                            field: fieldId,
                            line: i
                        }) || this.items[i][fieldName];
                }
            }
        };

        this.setValuesFromVendorConfig = function (option) {
            let record = option.transaction,
                vendorConfig = option.vendorConfig;

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
                this.billAttention = vendorConfig.Bill.attention;
                this.billAddressee = vendorConfig.Bill.addressee;
                this.billAddr1 = vendorConfig.Bill.address1;
                this.billAddr2 = vendorConfig.Bill.address2;
                this.billCity = vendorConfig.Bill.city;
                this.billState = vendorConfig.Bill.state;
                this.billZip = vendorConfig.Bill.zip;
                this.billCountry = vendorConfig.Bill.country;
            }
            this.billContact = vendorConfig.Bill.attention;
            this.billEmail = vendorConfig.Bill.email;
            this.billPhone = this.billPhone || vendorConfig.Bill.phoneno;

            if (vendorConfig.poNumField) {
                this.tranId =
                    record.getValue({
                        fieldId: vendorConfig.poNumField
                    }) || this.tranId;
            }

            let columns = {};
            if (vendorConfig.itemColumn) {
                columns.item = vendorConfig.itemColumn;
            }

            if (vendorConfig.quoteColumn) {
                columns.quotenumber = vendorConfig.quoteColumn;
            }

            this.setItemLineValues({
                columns: columns,
                transaction: record
            });

            if (vendorConfig.memoField) {
                this.memo =
                    record.getValue({
                        fieldId: vendorConfig.memoField
                    }) || this.memo;
            }

            if (vendorConfig.shipContactField) {
                this.shipContact =
                    record.getText({
                        fieldId: vendorConfig.shipContactField
                    }) || this.shipContact;
            }

            if (vendorConfig.shipEmailField) {
                this.shipEmail =
                    record.getValue({
                        fieldId: vendorConfig.shipEmailField
                    }) || this.shipEmail;
            }

            if (vendorConfig.shipPhoneField) {
                this.shipPhone =
                    record.getValue({
                        fieldId: vendorConfig.shipPhoneField
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
