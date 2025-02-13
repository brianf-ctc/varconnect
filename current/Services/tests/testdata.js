define(function (require) {
    return {
        PO_LIST: [
            {
                // ARROW|ITI
                name: 'ARROW|ITI',
                poNum: 'PO100075',
                poId: 24148,
                vendorConfigId: 2513,
                vendorId: 290
            },
            {
                // Carahsoft|BlueAlly
                name: 'Carahsoft|BlueAlly',
                poNum: 'PO2872',
                poId: 27152,
                vendorConfigId: 1512,
                vendorId: 173
            },
            {
                // D&H|ACP
                name: 'D&H|ACP',
                poNum: '364832',
                poId: 17600,
                vendorConfigId: 1613,
                vendorId: 175
            },
            {
                // Ingram|Aqueduct
                name: 'Ingram|Aqueduct',
                poNum: '126074',
                poId: 14190,
                vendorConfigId: 505,
                vendorId: 147
            },
            {
                // Jenne|Highpoint
                name: 'Jenne|Highpoint',
                poNum: '8930',
                poId: 5204,
                vendorConfigId: 2713,
                vendorId: 152
            },
            {
                // Scansource|Highpoint
                name: 'Scansource|Highpoint',
                poNum: '17103',
                poId: 5509,
                vendorConfigId: 706,
                vendorId: 154
            },
            {
                // Synnex|AnnexPro
                name: 'Synnex|AnnexPro',
                poNum: 'POC14824',
                poId: 7016,
                vendorConfigId: 906,
                vendorId: 158
            },

            {
                // TD Synnex|AnnexPro
                name: 'Synnex|AnnexPro',
                poNum: 'POC15487',
                poId: 7022,
                vendorConfigId: 906,
                vendorId: 158
            }
        ],
        VENDOR_LINES: {
            ITEM_MATCH: {
                PONUM: 'PO100075',
                POID: 27150,
                SOID: 24147,
                ITEMFF: 27552,
                ITEM: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 2,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MTEF-KIT-D',
                        item_sku: 'MTEF-KIT-D',
                        vendorSKU: 'MTEF-KIT-D',
                        item_altnum: 'MTEF-KIT-D',
                        line_num: '2',
                        line_status: 'SHIPPED',
                        line_price: '535.86',
                        ship_qty: 2,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: '781-S21N0Z+P2CMI36',
                        item_sku: '781-S21N0Z+P2CMI36',
                        vendorSKU: '781-S21N0Z+P2CMI36',
                        item_altnum: '781-S21N0Z+P2CMI36',
                        line_num: '3',
                        line_status: 'SHIPPED',
                        line_price: '760.54',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ],
                ALTITEM_COL: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MT:EF-KIT-D#TEST',
                        item_sku: 'MT:EF-KIT-D#TEST',
                        line_num: '2',
                        line_status: 'SHIPPED',
                        line_price: '535.86',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ],
                ALTITEM_REC: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MT:EF-KIT-D#ITMFLD',
                        item_sku: 'MT:EF-KIT-D#ITMFLD',
                        line_num: '2',
                        line_status: 'SHIPPED',
                        line_price: '535.86',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ],
                MAPPING: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: '781-S2 1N0Z#P2CMI36',
                        item_sku: '781-S2 1N0Z#P2CMI36',
                        line_num: '3',
                        line_status: 'SHIPPED',
                        line_price: '760.54',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ],
                NO_MATCH: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC:NO_MATCH',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 2,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MTEF-KIT-D#NO_MATCH',
                        line_num: '2',
                        line_status: 'SHIPPED',
                        line_price: '535.86',
                        ship_qty: 2,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: '781-S21N0Z+P2CMI36#NO_MATCH',
                        line_num: '3',
                        line_status: 'SHIPPED',
                        line_price: '760.54',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ]
            },
            FILL_LINES: {
                PONUM: 'PO100075',
                POID: 27150,
                FULL_QTY: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 10,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MTEF-KIT-D',
                        item_sku: 'MTEF-KIT-D',
                        vendorSKU: 'MTEF-KIT-D',
                        item_altnum: 'MTEF-KIT-D',
                        line_num: '2',
                        line_status: 'SHIPPED',
                        line_price: '535.86',
                        ship_qty: 10,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: '781-S21N0Z+P2CMI36',
                        item_sku: '781-S21N0Z+P2CMI36',
                        vendorSKU: '781-S21N0Z+P2CMI36',
                        item_altnum: '781-S21N0Z+P2CMI36',
                        line_num: '3',
                        line_status: 'SHIPPED',
                        line_price: '760.54',
                        ship_qty: 10,
                        is_shipped: true
                    }
                ],
                PARTIAL_QTY: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 5,
                        is_shipped: true
                    }
                ],
                FULLY_SPLIT: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 3,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 5,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 2,
                        is_shipped: true
                    }
                ],
                EXCEED_QTY: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 20,
                        is_shipped: true
                    }
                ],
                EXCEED_QTY_SPLIT: [
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 8,
                        is_shipped: true
                    },
                    {
                        order_num: '5045071',
                        order_status: 'CLOSED',
                        item_num: 'MSN2010-CB2FC',
                        item_sku: 'MSN2010-CB2FC',
                        vendorSKU: 'MSN2010-CB2FC',
                        item_altnum: 'MSN2010-CB2FC',
                        line_num: '1',
                        line_status: 'SHIPPED',
                        line_price: '5378.64',
                        ship_qty: 8,
                        is_shipped: true
                    }
                ]
            },
            SAMEITEM_FILL: []
        },
        BILLFILES: [
            {
                billFileId: 56810,
            },
            // {
            //     billFileId: 63816,
            // },
            // {
            //     billFileId: 64372,
            // },
            // {
            //     billFileId: 64076,
            // }
            // {
            //     billFileId: 9907,
            //     isReceivable: true,
            //     billPayload: {}
            // }
        ]
    };
});
