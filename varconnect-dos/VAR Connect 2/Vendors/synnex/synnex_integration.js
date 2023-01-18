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

            // see config.json in mock api folder for an example
            // of config file format and supported field types.
            // https://tstdrv2486528.app.netsuite.com/app/site/hosting/scriptlet.nl?script=7&deploy=1&action=viewfile&file=616 (mock example)
            // 
            // https://tstdrv2486528.app.netsuite.com/app/site/hosting/scriptlet.nl?script=7&deploy=1&action=viewfile&file=1213 (synnex)

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
            var baseUrl = config.base_url.values.string;
            ctc.log.debug('config', 'config.base_url.values.string', baseUrl, true);

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

                        // use schema from mock integration for guidelines
                        // 
                        // use vendor resource APIs to build order json and overwrite trx

                        break;

                    case 'invoices':

                        // use schema from mock integration for guidelines
                        // 
                        // use vendor resource APIs to build order json and overwrite trx

                        break;
                }

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: action'
                });
            };

            return trx;
        };

        return {
            get: _get
        };
    });