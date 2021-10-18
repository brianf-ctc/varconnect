/**
 * @copyright 2021 Catalyst Technology Corporation
 * @author Shawn Blackburn <shawnblackburn@gmail.com>
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope Public 
 * @NAmdConfig  ../../libconfig.json
 * 
 */

define([
        'ctc',
        'N/record',
        'N/error'
    ],
    function(
        ctc,
        record,
        error
    ) {


        function _get(context) {

            // the restlet should alway return an array
            // if there are multiple transactions each one
            // should be contained in an object inside the array
            // if there are no transactions return an empty array
            var trx = [];

            var poId = null;
            var config = null;

            if (context.hasOwnProperty('poid')) {
                poId = context.poid;

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: poid'
                });
            }

            // see config.json in mock api folder for an example
            // of config file format and supported field types.
            // https://tstdrv2486528.app.netsuite.com/app/site/hosting/scriptlet.nl?script=7&deploy=1&action=viewfile&file=616 (mock example)
            // 
            // https://tstdrv2486528.app.netsuite.com/app/site/hosting/scriptlet.nl?script=7&deploy=1&action=viewfile&file=1118 (scansource)

            if (context.hasOwnProperty('configid')) {
                config = ctc.config.loadJson(context.configid)

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: configid'
                });
            }

            // example of interacting with the config file
            var baseUrl = config.base_url.values.string;
            ctc.log.debug('config', 'config.base_url.values.string', baseUrl, true);

            if (context.hasOwnProperty('action')) {
                switch (context.action) {

                    case acknowledgements:
                        // code block
                        break;

                    case shipments:
                        // code block
                        break;

                    case invoices:
                        // code block
                        break;
                }

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: action'
                });
            }

            return trx;
        }


        function _post(context) {
            var trx = [];

            var poId = null;
            var config = null;

            if (context.hasOwnProperty('poid')) {
                poId = context.poid;

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: poid'
                });
            }

            if (context.hasOwnProperty('configid')) {
                config = ctc.config.loadFile(context.configid)

            } else {

                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: configid'
                });
            }

            if (context.hasOwnProperty('action')) {
                switch (context.action) {

                    case order:
                        // code block
                        break;
                }
            }

            return trx;
        }

        return {
            get: _get,
            post: _post
        };
    });