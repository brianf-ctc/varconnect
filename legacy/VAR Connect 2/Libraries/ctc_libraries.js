define([
        'N/file',
        'N/log',
        'N/record', 
        'N/runtime'
    ],

    function(
        file,
        log,
        record, 
        runtime
    ) {

        try {

            var CTC = {

                // enhanced logging to allow for more metadata and longer details
                // this is especially helpful for logging large return payloads that
                // would otherwise be truncated by netsuite's native logger

                log: {
                    info: function(stage, title, details) {

                        // info logs are only ever persisted and do
                        // not use the native netsuite logger
                        var persist = true;
                        return (persist ? persistLogEntry(stage, title, details, 'INFO') : null);

                    },
                    audit: function(stage, title, details, persist) {

                        log.audit(title, details);
                        return (persist ? persistLogEntry(stage, title, details, 'AUDIT') : null);

                    },
                    debug: function(stage, title, details, persist) {

                        log.debug(title, details);
                        return (persist ? persistLogEntry(stage, title, details, 'DEBUG') : null);

                    },
                    error: function(stage, title, details, persist) {

                        log.error(title, details);
                        return (persist ? persistLogEntry(stage, title, details, 'ERROR') : null);

                    }
                },

                // configuration file utilty.  this functionality allows plain text stringified json files
                // in the file cabinet to be interacted with.  this is preferential over useing custom records
                // to store configuration since it allows for different formats without the need for multiple
                // custom records or a single custom record type with all needed permuations.

                config: {
                    getJson: function(f) {
                        return JSON.parse(loadFile(f).getContents());

                    },
                    getFile: function(f) {
                        return loadFile(f);

                    },
                    getField: function(f, params) {
                        return params;
                        // future functionality

                    },
                    setField: function(f, params) {
                        return params;
                        // future functionality

                    },

                    createFile: function(f, params) {
                        return params;
                        // future functionality

                    },
                    addField: function(f, params) {
                        return params;
                        // future functionality

                    },
                    removeField: function(f, params) {
                        return params;
                        // future functionality

                    }
                }

            }

            return CTC;

            //
            // CTC.log helper functions
            //

            // logger helper function(s)

            function persistLogEntry(stage, title, details, level) {

                let s = runtime.getCurrentScript();
                let u = runtime.getCurrentUser();

                let r = record.create({
                    type: 'customrecord_ctc_el',
                    isDynamic: true
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_stage',
                    value: stage
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_title',
                    value: title
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_details_condensed',
                    value: (typeof details == 'object' ? JSON.stringify(details).substring(0, 300) : details.substring(0, 300))
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_details',
                    value: (typeof details == 'object' ? JSON.stringify(details) : details)
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_script_id',
                    value: s.id
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_deploy_id',
                    value: s.deploymentId
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_log_level',
                    value: level
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_script_bundles',
                    value: (typeof s.bundleIds == 'object' ? JSON.stringify(s.bundleIds) : bundleIds)
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_user_role',
                    value: u.role
                });

                // r.setValue({
                //     fieldId: 'custrecord_ctc_el_user_sub',
                //     value: (u.subsidiary !== 0 ? u.subsidiary : '')
                // });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_user_loc',
                    value: (u.location !== 0 ? u.location : '')
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_user_dept',
                    value: (u.department !== 0 ? u.department : '')
                });

                r.setValue({
                    fieldId: 'custrecord_ctc_el_user_class',
                    value: (u.class !== 0 ? u.class || '' : '')
                });

                return r.save();

            }

            // config file helper function(s)

            function loadFile(f) {
                var fileObj = file.load({
                    id: f
                });
                return fileObj;
            }

        } catch (e) {

            log.error('e', e);

        }

    });