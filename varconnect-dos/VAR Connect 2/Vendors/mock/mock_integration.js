/**
 * @copyright 2021 Catalyst Technology Corporation
 * @author Shawn Blackburn <shawnblackburn@gmail.com>
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope Public 
 * @NAmdConfig  ../../libconfig.json
 * 
 * ctc, lodash, moment, and papaparse are provided via
 * libconfig.json - comment out unneeded libraries.
 * 
 */

define([
        'ctc',
        'lodash',
        'moment',
        'papa',
        'N/log',
        'N/record',
        'N/error'
    ],
    function(
        ctc,
        lodash,
        moment,
        papa,
        log,
        record,
        error
    ) {

        function _get(context) {

            // the restlet should alway return an array
            // if there are multiple transactions each one
            // should be contained in an object inside the array
            // if there are no transactions return an empty array
            var trx = [];

            var po = null;
            var config = null;

            if (context.hasOwnProperty('poid')) {
                po = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: context.poid,
                    isDynamic: true,
                });

                //ctc.log.info(stage, title, details, persist)
                ctc.log.info('entry', 'po object', po);

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: poid'
                });
            };

            //https://tstdrv2486528.app.netsuite.com/app/site/hosting/scriptlet.nl?script=7&deploy=1&action=viewfile&file=616

            if (context.hasOwnProperty('configid')) {
                config = ctc.config.getJson(context.configid);
                log.debug('config', config);

                ctc.log.info('entry', 'config', config)

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: configid'
                });
            };

            // example of interacting with the config file
            var baseUrl = config.url.values.string;
            ctc.log.debug('config', 'config.url.values.string', baseUrl, true);

            if (context.hasOwnProperty('action')) {

                log.debug('action', context.action);

                switch (context.action) {

                    case 'submit':
                        // BECAUSE LINE ID AND LINE SEQ NUMBER CAN CHANGE IF AN ITEM IS 
                        // INSERTED OR DELETED ALWAYS USE LINE UNIQUE KEY (lineuniquekey) 
                        // AS THE PO LINE NUMBER WHEN SUBMITTING A PURCHASE ORDER TO THE VENDOR.

                        // load transaction and format it as needed to submit to vendor.

                        // some vendors have async submissions so return a 200 and an empty
                        // array if successful.  If it isn't successful throw an error and return
                        // a non-200 code.  In the orders function below we'll query
                        // the vendor using our PO number to get back the details.

                        // trx is already an empty array so nothing to do here if everyting was
                        // successful.

                        break;

                    case 'orders':

                        var exampleSchema = [
                            // if the po generated more than one vendor sales order push another object to the trx array
                            {
                                "ns_poid": context.poid,
                                "ven_so_number": "SO123456",
                                "ven_so_status": "pending",
                                "ven_so_last_ship_date": "12/31/2021",
                                "ven_so_currency": "USD",
                                "ven_so_lines": {
                                    "306057032": { // create a new object for each po line number (ns lineuniquekey)
                                        "ven_sol_num": '1',
                                        "ven_sol_item": 'ITEM123', // maps to ns item on transaction
                                        "ven_sol_description": "Test Item",
                                        "ven_sol_qty_ordered": 6,
                                        "ven_sol_qty_committed": 1,
                                        "ven_sol_qty_backorderd": 2,
                                        "ven_sol_qty_shipped": 3,
                                        "ven_sol_rate": 1.5,
                                        "ven_sol_amount": 9,
                                        "ven_sol_est_shipments": [{
                                            "ven_sol_est_ship_date": '12/20/2021',
                                            "ven_sol_est_ship_qty": 1
                                        }, {
                                            "ven_sol_est_ship_date": '12/32/2021',
                                            "ven_sol_est_ship_qty": 2
                                        }, {
                                            "ven_sol_est_ship_date": '01/05/2022',
                                            "ven_sol_est_ship_qty": 1
                                        }, {
                                            "ven_sol_est_ship_date": '01/31/2022',
                                            "ven_sol_est_ship_qty": 2
                                        }],
                                        "ven_sol_mac_addresses": [
                                            "2C:54:91:88:C9:E3",
                                            "2C:54:91:88:C9:E4",
                                            "2C:54:91:88:C9:E5"
                                        ],
                                        "ven_sol_serial_numbers": [
                                            "ABCDEFG",
                                            "HIJKLMN",
                                            "OPQRSTU"
                                        ],
                                        "ven_sol_shipments": [{
                                            "ven_sol_ship_date": "12/20/2021",
                                            "ven_sol_carton": "C01",
                                            "ven_sol_carrier": "UPS",
                                            "ven_sol_tracking": "1Z999999999999990",
                                            "ven_sol_ship_weight": 0.5,
                                            "ven_sol_ship_weight_uom": 'Pounds'
                                        }, {
                                            "ven_sol_ship_date": "12/31/2021",
                                            "ven_sol_carton": "C02",
                                            "ven_sol_carrier": "UPS",
                                            "ven_sol_tracking": "1Z999999999999991",
                                            "ven_sol_ship_weight": 1.0,
                                            "ven_sol_ship_weight_uom": 'Pounds'
                                        }]
                                    }
                                }
                            }
                        ]

                        trx = exampleSchema;

                        break;

                    case 'invoices':

                        var exampleSchema = [
                            // if the po generated more than one vendor invoice push another object to the trx array
                            {
                                "ns_poid": context.poid,
                                "ven_so_number": "SO123456",
                                "ven_inv_number": "INV67890",
                                "ven_inv_date": "12/20/2021",
                                "ven_inv_currency": "USD",
                                "ven_inv_freight_amt": 5,
                                "ven_inv_tax_amt": .25,
                                "ven_inv_other_amt": 0, // any other header level charge that isn't freight or tax
                                "ven_inv_total_amt": 6.75,
                                "ven_inv_lines": {
                                    "306057032": { // create a new object for each po line number (ns lineuniquekey)
                                        "ven_invl_num": '1',
                                        "ven_invl_item": 'ITEM123', // maps to ns item on transaction
                                        "ven_invl_description": "Test Item",
                                        "ven_invl_qty_invoiced": 1,
                                        "ven_invl_rate": 1.5,
                                        "ven_invl_amount": 1.5,
                                    }
                                }
                            }, {
                                "ns_poid": context.poid,
                                "ven_so_number": "SO123456",
                                "ven_inv_number": "INV67891",
                                "ven_inv_date": "12/31/2021",
                                "ven_inv_currency": "USD",
                                "ven_inv_freight_amt": 10,
                                "ven_inv_tax_amt": .5,
                                "ven_inv_other_amt": 0, // any other header level charge that isn't freight or tax
                                "ven_inv_total_amt": 13.5,
                                "ven_inv_lines": {
                                    "306057032": { // create a new object for each po line number (ns lineuniquekey)
                                        "ven_invl_num": '1',
                                        "ven_invl_item": 'ITEM123', // maps to ns item on transaction
                                        "ven_invl_description": "Test Item",
                                        "ven_invl_qty_invoiced": 2,
                                        "ven_invl_rate": 1.5,
                                        "ven_invl_amount": 3,
                                    }
                                }
                            }
                        ]

                        trx = exampleSchema;

                        break;
                }

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: action', 
                    notifyOff: false
                });
            };

            return trx;
        };

        return {
            get: _get
        };
    });