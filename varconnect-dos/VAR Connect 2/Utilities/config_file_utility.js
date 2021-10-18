/**
 * @copyright 2021 Catalyst Technology Corporation
 * @author Shawn Blackburn <shawnblackburn@gmail.com>
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public 
 * @NAmdConfig  ../libconfig.json
 */

define(['N/file', 'N/search', 'N/ui/serverWidget', 'N/log', 'ctc'],
    function(_file, _search, _serverWidget, _log, ctc) {
        function onRequest(context) {

            _log.debug('request', context.request)

            if (context.request.method === 'GET') {

                var form = _serverWidget.createForm({
                    title: "SHOULD NOT SEE THIS!"
                });

                switch (context.request.parameters.action) {
                    case 'viewfile':
                        form = viewFileForm(context)
                        break;
                    case 'createfile':
                        form = createFileForm(context)
                        break;
                }

                form.addSubmitButton();
                context.response.writePage(form);

            } else {
                // code here
                log.debug('parameters', context.request.parameters)

                var fileObj = _file.create({
                    name: context.request.parameters.custpage_filename + '.config.json',
                    fileType: _file.Type.JSON,
                    contents: '',
                    description: 'NetSuite Configuration Toolset File',
                    encoding: _file.Encoding.UTF8,
                    folder: context.request.parameters.custpage_folder,
                    isOnline: false
                });

                fileObj.save();

            }
        }

        return {
            onRequest: onRequest
        };

        function createFileForm(context) {

            var form = _serverWidget.createForm({
                title: 'Configuration File Creator'
            });

            var folderField = form.addField({
                id: 'custpage_folder',
                type: _serverWidget.FieldType.SELECT,
                //source: 'directory',
                label: 'Select Folder'
            });

            var folderSearchObj = _search.create({
                type: "folder",
                filters: [
                    ["name", "isnotempty", ""]
                ],
                columns: [
                    "internalid",
                    "parent",
                    _search.createColumn({
                        name: "name",
                        sort: _search.Sort.ASC
                    })
                ]
            });
            var searchResultCount = folderSearchObj.runPaged().count;
            log.debug("folderSearchObj result count", searchResultCount);
            folderSearchObj.run().each(function(result) {

                log.debug('result', result);

                log.debug('name', result.getValue('name'));

                var folderName = result.getValue('name')

                if (result.getText('parent') !== '') {
                    folderName = result.getText('parent') + ' : ' + result.getValue('name')
                }

                folderField.addSelectOption({
                    value: result.id,
                    text: folderName
                });

                return true;
            });

            var filenameField = form.addField({
                id: 'custpage_filename',
                type: _serverWidget.FieldType.TEXT,
                label: 'Filename'
            });

            return form;
        }


        function viewFileForm(context) {
            var myFile = ctc.config.getFile(context.request.parameters.file)

            var form = _serverWidget.createForm({
                title: 'Configuration File Viewer'
            });

            form.addFieldGroup({
                id: 'fieldgroupid',
                label: myFile.path
            });

            var j = JSON.parse(myFile.getContents());

            // iterate through all the object key:value pairs and for
            // each one we'll add it to a form

            for (const [key, value] of Object.entries(j)) {

                // build field

                var field_params = {
                    id: 'custpage_' + key,
                    container: 'fieldgroupid',
                    type: _serverWidget.FieldType[value.field_type.type],
                    label: value.display_name
                };

                switch (value.field_type.type) {

                    case 'SELECT':
                    case 'MULTISELECT':
                        field_params.source = value.field_type.reference_field;
                        break;
                };

                // add the field to the form

                var myfield = form.addField(field_params);

                // add field options that have to be set after
                // the field is added

                if (value.mandatory == true) {
                    myfield.isMandatory = true;
                }

                if (value.help) {
                    myfield.helpText = value.help;
                }

                // pull value from the file and set it to
                // the default value of the field

                switch (value.field_type.type) {

                    case 'SELECT':
                        myfield.defaultValue = value.values.id;
                        break;

                    case 'MULTISELECT':
                        var v = []
                        value.values.forEach(element => v.push(element.id));
                        myfield.defaultValue = v;
                        break;

                    default:
                        myfield.defaultValue = value.values.string;
                };
            }
            return form;
        }
    });