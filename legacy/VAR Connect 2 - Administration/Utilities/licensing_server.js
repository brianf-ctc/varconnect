/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['N/record', 'N/search', 'N/log', 'N/encode', 'N/error', '../Libraries/moment'],
    function(record, search, log, encode, error, moment) {

        // get and return a var connect license
        function _get(context) {

            log.debug('context', context);

            var returnObj = {
                "license": null,
                "customer": null,
                "status": null,
                "account": null,
                "valid_on": null,
                "valid_thru": null,
                "generated": Date.now(),
                "features": {},
                "integrations": {}
            };

            var customrecord_int_vc_licSearchObj = search.create({
                type: "customrecord_int_vc_lic",
                filters: [
                    ["custrecord_int_vc_lic_ns_acct", "is", "TSTDRV2486528"],
                    "AND", ["custrecord_int_vc_lic_valid_on", "onorbefore", "today"],
                    "AND", ["custrecord_int_vc_lic_valid_through", "onorafter", "today"],
                    "AND", ["isinactive", "is", "F"],
                    "AND", ["custrecord_int_vc_lic_status", "anyof", "1", "3"]
                ],
                columns: [
                    "custrecord_int_vc_lic_cust",
                    "custrecord_int_vc_lic_status",
                    "custrecord_int_vc_lic_ns_acct",
                    "custrecord_int_vc_lic_valid_on",
                    "custrecord_int_vc_lic_valid_through",
                    "custrecord_int_vc_lic_last_sync"
                ]
            });
            var searchResultCount = customrecord_int_vc_licSearchObj.runPaged().count;
            log.debug("customrecord_int_vc_licSearchObj result count", searchResultCount);
            customrecord_int_vc_licSearchObj.run().each(function(result) {

                log.debug('result', result);

                returnObj.license = result.id;
                returnObj.customer = result.getText('custrecord_int_vc_lic_cust');
                returnObj.status = result.getText('custrecord_int_vc_lic_status');
                returnObj.account = result.getValue('custrecord_int_vc_lic_ns_acct');
                returnObj.valid_on = result.getValue('custrecord_int_vc_lic_valid_on');
                returnObj.valid_thru = result.getValue('custrecord_int_vc_lic_valid_through');

                return true;
            });

            var customrecord_int_vc_lic_featSearchObj = search.create({
                type: "customrecord_int_vc_lic_feat",
                filters: [
                    ["custrecord_int_vc_lic_feat_lic", "anyof", returnObj.license],
                    "AND", ["isinactive", "is", "F"]
                ],
                columns: [
                    "custrecord_int_lic_feat_feat",
                    search.createColumn({
                        name: "custrecord_int_vc_features_script_id",
                        join: "CUSTRECORD_INT_LIC_FEAT_FEAT"
                    })
                ]
            });
            var searchResultCount = customrecord_int_vc_lic_featSearchObj.runPaged().count;
            log.debug("customrecord_int_vc_lic_featSearchObj result count", searchResultCount);
            customrecord_int_vc_lic_featSearchObj.run().each(function(result) {
                //returnObj.features.push(result.getText('custrecord_int_lic_feat_feat'));
                returnObj.features[result.getText('custrecord_int_lic_feat_feat')] = result.getValue({
                    name: "custrecord_int_vc_features_script_id",
                    join: "CUSTRECORD_INT_LIC_FEAT_FEAT"
                });
                return true;
            });

            var customrecord_int_vc_lic_intSearchObj = search.create({
                type: "customrecord_int_vc_lic_int",
                filters: [
                    ["custrecord_int_vc_lic_int_lic", "anyof", returnObj.license],
                    "AND", ["isinactive", "is", "F"]
                ],
                columns: [
                    "custrecord_int_vc_lic_int_int",
                    search.createColumn({
                        name: "custrecord_int_vc_integration_script_id",
                        join: "CUSTRECORD_INT_VC_LIC_INT_INT"
                    })
                ]
            });
            var searchResultCount = customrecord_int_vc_lic_intSearchObj.runPaged().count;
            log.debug("customrecord_int_vc_lic_intSearchObj result count", searchResultCount);
            customrecord_int_vc_lic_intSearchObj.run().each(function(result) {
                //returnObj.integrations.push(result.getText('custrecord_int_vc_lic_int_int'));
                returnObj.integrations[result.getText('custrecord_int_vc_lic_int_int')] = result.getValue({
                    name: "custrecord_int_vc_integration_script_id",
                    join: "CUSTRECORD_INT_VC_LIC_INT_INT"
                })
                return true;
            });

            record.submitFields({
                type: 'customrecord_int_vc_lic',
                id: returnObj.license,
                values: {
                    'custrecord_int_vc_lic_last_sync': moment().format('MM/DD/YYYY hh:mm:ss A')
                }
            });

            return returnObj;
        }

        return {
            get: _get
        };
    });