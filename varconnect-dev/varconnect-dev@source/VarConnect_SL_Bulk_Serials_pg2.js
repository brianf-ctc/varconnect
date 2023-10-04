/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @NScriptType Suitelet
 */

//*************************************************************************
//* 1/10/19	JKC		Added redirect and error handling code in doPost
//*************************************************************************

define([
    'N/ui/serverWidget',
    'N/log',
    'N/search',
    'N/record',
    'N/file',
    'N/task',
    'N/http',
    'N/config',
    './CTC_VC_Lib_MainConfiguration.js',
    './VC_Globals.js',
    './CTC_VC_Lib_Utilities.js',
    './CTC_VC_Constants.js'
], function (
    ui,
    log,
    search,
    rec,
    file,
    task,
    http,
    config,
    libMainConfig,
    vcGlobals,
    util,
    constants
) {
    const PO_SERIAL_NUMBER_FOLDER = vcGlobals.SN_FOLDER_ID;

    function onRequest(context) {
        log.debug('Enter serial Pg2', 'main Entry');

        if (context.request.method == 'GET') {
            doGet(context);
        } else if (context.request.method == 'POST') {
            doPost(context);
        }
    }

    function doGet(context) {
        log.debug('DoGet', JSON.stringify(context));

        var poNum = context.request.parameters['item'];
        log.debug('Enter serial Pg2', 'poNum = ' + poNum);
        if (isEmpty(poNum)) {
            log.debug({ title: 'In Get code', details: 'PO Num EMPTY' });
            var form = ui.createForm({
                title: 'Error - PO Number empty/not found. Please try again'
            });
            context.response.writePage(form);
        }

        var itemList = getItems(poNum);

        if (!isEmpty(itemList)) {
            var form = ui.createForm({
                title: 'PO Manual Add Serial Numbers'
            });
            form.clientScriptModulePath = './VarConnect_Bulk_Serials_Library.js';

            var itemgroup = form.addFieldGroup({
                id: 'itemgroup',
                label: 'Order Information'
            });
            itemgroup.isSingleColumn = true;

            form.addSubmitButton({
                label: 'Save All Serial Numbers'
            });

            /*  				var item_sublist = form.addSublist ({
                                    id: SUBLIST_ID,
                                    label: "Purchase Order Items and Serial Numbers",
                                    type: ui.SublistType.LIST
                                });
                 */
            var labelfield = form.addField({
                id: 'custpage_label1',
                type: ui.FieldType.LABEL,
                label: 'Purchase Order # : ' + poNum,
                container: 'itemgroup'
            });

            var poNumField = form.addField({
                id: 'custpage_ponumfld',
                type: ui.FieldType.TEXT,
                label: 'Po Num:',
                container: 'itemgroup'
            });
            poNumField.defaultValue = poNum;
            poNumField.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

            var itemsField = form.addField({
                id: 'custpage_itemsfld',
                type: ui.FieldType.LONGTEXT,
                label: 'Items:',
                container: 'itemgroup'
            });
            itemsField.defaultValue = JSON.stringify(itemList);
            itemsField.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });

            var itemselect = form.addField({
                id: 'itemselectfield',
                type: ui.FieldType.SELECT,
                label: 'Items',
                container: 'itemgroup'
            });
            itemselect.addSelectOption({
                value: 0,
                text: 'Select Item',
                container: 'itemgroup'
            });

            for (var i = 0; i < itemList.length; i++) {
                var itemId = itemList[i].id;
                if (itemId <= 0) continue;
                itemselect.addSelectOption({
                    value: itemId,
                    text: itemList[i].name
                });

                var currentSNList = getCurrentSNList(poNum, itemId);
                var snCount = isEmpty(currentSNList) ? 0 : currentSNList.split(',').length;

                var labelcountfield = form.addField({
                    id: 'custpage_label_sncount_' + itemId,
                    type: ui.FieldType.LABEL,
                    label: 'Count of Existing Serial Numbers : ' + snCount,
                    container: 'itemgroup'
                });

                var currentField = form.addField({
                    id: 'custpage_currentsn_' + itemId,
                    type: ui.FieldType.LONGTEXT,
                    label: 'Existing Serial Numbers:',
                    container: 'itemgroup'
                });
                currentField.defaultValue = currentSNList;
                currentField.updateDisplayType({
                    displayType: ui.FieldDisplayType.READONLY
                });

                var newField = form.addField({
                    id: 'custpage_newsn_' + itemId,
                    type: ui.FieldType.LONGTEXT,
                    label: 'New Serial Numbers:',
                    container: 'itemgroup'
                });

                var lineKeyID = form.addField({
                    id: 'custpage_linekey_' + itemId,
                    type: ui.FieldType.TEXT,
                    label: 'Line Unique Key:'
                });
                lineKeyID.defaultValue = itemId;
                lineKeyID.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
            }

            // Creates and populates the invoice sublist
            //buildSublist (item_sublist, itemList);

            context.response.writePage(form);
        } else {
            log.debug({ title: 'In GET code', details: 'Item List EMPTY' });
            var form = ui.createForm({
                title: 'Error - No items found. Please try again'
            });
            context.response.writePage(form);
        }
    }

    function doPost(context) {
        var request = context.request;
        var params = JSON.stringify(context.request.parameters);

        var outputObj = {
            poId: '',
            soId: '',
            items: []
        };

        log.debug({ title: 'In POST code', details: 'Submit button clicked' });
        log.debug({ title: 'In POST code', details: 'parameters = ' + params });

        var poField = context.request.parameters.custpage_ponumfld;
        var itemsField = JSON.parse(context.request.parameters.custpage_itemsfld);

        if (!isEmpty(poField)) {
            log.debug({ title: 'In POST code', details: 'PO Num = ' + poField });
            outputObj.poId = itemsField[0].poID;
            if (!isEmpty(itemsField)) {
                if (!isEmpty(outputObj.poId)) {
                    setSNLineLink(outputObj.poId);
                }
                outputObj.soId = itemsField[0].soID;
                log.debug({ title: 'In POST code', details: 'SO Num = ' + outputObj.soId });
                for (var i = 0; i < itemsField.length; i++) {
                    var itemObj = {
                        itemId: '',
                        serials: []
                    };
                    itemObj.itemId = itemsField[i].id;

                    // get new sn's and strip out any carriage return/new lines
                    var newSNStr = getNewSNStr(params, itemsField[i].id)
                        .replace(/\\n/g, ',')
                        .replace(/\\r/g, ',');
                    log.debug({
                        title: 'In POST code',
                        details: 'Item ' + itemsField[i].id + ' New SNs = ' + newSNStr
                    });
                    if (!isEmpty(newSNStr)) {
                        var tempList = newSNStr.split(',');
                        //remove empty array elements
                        itemObj.serials = tempList.filter(function (el) {
                            return !isEmpty(el);
                        });
                    }
                    outputObj.items.push(itemObj);
                }
            }
            var fileID = createAndSaveFile(outputObj, poField);
            log.debug({ title: 'In POST code', details: 'PO File Created, ID = ' + fileID });

            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_add_serials_mr',
                deploymentId: 'customdeploy_add_serials_mr',
                params: { custscript_serialsfileid: fileID }
            });

            if (!isEmpty(mrTask)) {
                log.debug({ title: 'In POST code', details: 'mrTask = ' + JSON.stringify(mrTask) });
                var mrTaskID = mrTask.submit();
                // Redirect back to page 1
                context.response.sendRedirect({
                    type: http.RedirectType.SUITELET,
                    identifier: 'customscript_vc_bulk_serial_numbers',
                    id: 'customdeploy_vc_bulk_serial_numbers',
                    editMode: false
                });
            } else {
                log.debug({
                    title: 'In POST code',
                    details: 'Could not Create/Submit the Map/Reduce Task '
                });
                var form = ui.createForm({
                    title: 'Could not process serial numbers, please try again. (Error = Task-Create)'
                });
                context.response.writePage(form);
            }
        } else {
            log.debug({ title: 'In POST code', details: 'PO Num EMPTY' });
            var form = ui.createForm({
                title: 'Error - PO Number empty/not found. Please try again'
            });
            context.response.writePage(form);
        }
    }

    function _loadMainConfig() {
        var mainConfig = libMainConfig.getMainConfiguration();

        if (!mainConfig) {
            log.error('No Coniguration available');
            //    			throw new Error('No Coniguration available');
        } else return mainConfig;
    }

    function createAndSaveFile(outputObj, poField) {
        var mainConfig = _loadMainConfig(),
            fileObj = file.create({
                name: poField + 'Serials.txt',
                fileType: file.Type.PLAINTEXT,
                contents: JSON.stringify(outputObj)
            });
        //            fileObj.folder = PO_SERIAL_NUMBER_FOLDER;
        fileObj.folder = mainConfig.serialNoFolder;

        var id = fileObj.save();

        return id;
    }

    function getItems(poNum) {
        var items = [];
        var itemIDs = [];

        var purchaseorderSearchObj = search.create({
            type: 'purchaseorder',
            filters: [
                ['type', 'anyof', 'PurchOrd'],
                'AND',
                ['mainline', 'is', 'F'],
                'AND',
                ['taxline', 'is', 'F'],
                'AND',
                ['shipping', 'is', 'F'],
                'AND',
                ['numbertext', 'is', poNum]
            ],
            columns: [
                search.createColumn({ name: 'tranid', label: 'Document Number' }),
                search.createColumn({ name: 'item', label: 'Item' }),
                search.createColumn({ name: 'createdfrom', label: 'Created From' }),
                search.createColumn({ name: 'lineuniquekey', label: 'Line Unique Key' })
            ]
        });

        var searchResultCount = purchaseorderSearchObj.runPaged().count;
        log.debug('purchaseorderSearchObj result count', searchResultCount);
        purchaseorderSearchObj.run().each(function (result) {
            if (itemIDs.indexOf(result.getValue({ name: 'item' })) < 0) {
                var item_info = { id: '', name: '', soID: '', poID: '', lineKey: '' };
                item_info.id = result.getValue({ name: 'item' });
                item_info.name = result.getText({ name: 'item' });
                item_info.soID = result.getValue({ name: 'createdfrom' });
                item_info.poID = result.id;
                item_info.lineKey = result.getValue({ name: 'lineuniquekey' });

                items.push(item_info);
                itemIDs.push(item_info.id);
            }
            return true;
        });

        return items;
    }

    function getCurrentSNList(poNum, itemID) {
        var snList = '';

        var customrecordserialnumSearchObj = search.create({
            type: 'customrecordserialnum',
            filters: [
                ['custrecordserialpurchase.numbertext', 'is', poNum],
                'AND',
                ['custrecordserialitem.internalid', 'anyof', itemID]
            ],
            columns: [
                search.createColumn({
                    name: 'name',
                    sort: search.Sort.ASC,
                    label: 'Name'
                }),
                search.createColumn({ name: 'scriptid', label: 'Script ID' }),
                search.createColumn({ name: 'custrecordserialitem', label: 'ItemNum' })
            ]
        });
        var searchResultCount = customrecordserialnumSearchObj.runPaged().count;
        log.debug('customrecordserialnumSearchObj result count', searchResultCount);

        for (var x = 0; x < searchResultCount; x += 1000) {
            var rangeStart = x;

            var searchResult = customrecordserialnumSearchObj.run().getRange({
                start: rangeStart,
                end: rangeStart + 1000
            });
            for (var i = 0; i < searchResult.length; i++) {
                var snNum = searchResult[i].getValue({ name: 'name' });
                snList += snNum + ', ';
            }
        }
        if (!isEmpty(snList)) {
            var lastIndex = snList.lastIndexOf(',');
            var snList2 = snList.substring(0, lastIndex);
            return snList2;
        }
        return snList;
    }

    function getNewSNStr(params, itemid) {
        var itemID = 'custpage_newsn_' + itemid;
        var newIndex = params.indexOf('custpage_newsn_' + itemid);
        log.debug('index of item id', newIndex);
        if (newIndex >= 0) {
            newIndex += itemID.length + 3; // move past itemID +":"
            var newEndIndex = params.indexOf('"', newIndex);
            log.debug('end index of item id', newEndIndex);

            if (newIndex < newEndIndex) {
                var newSNStr = params.substring(newIndex, newEndIndex);
                log.debug('new SN string', newSNStr);

                return newSNStr;
            }
        }

        return '';
    }

    function setSNLineLink(poID) {
        var poRec = rec.load({
            type: rec.Type.PURCHASE_ORDER,
            id: poID,
            isDynamic: false
        });
        var poNum = encodeURIComponent(poRec.getText('tranid'));
        var soNum = encodeURIComponent(poRec.getText('createdfrom'));
        var companyObj = config.load({
            type: config.Type.COMPANY_INFORMATION
        });
        var accountId = companyObj.getValue('companyid');

        var lineCount = poRec.getLineCount({ sublistId: 'item' });
        for (var i = 0; i < lineCount; i++) {
            var itemName = encodeURIComponent(
                poRec.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                })
            );
            var itemId = poRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            var lineLinkUrl = util.generateSerialLink({
                sonum: soNum,
                ponum: poNum,
                itemid: itemId,
                itemname: itemName
            });
            poRec.setSublistValue({
                sublistId: 'item',
                fieldId: vcGlobals.SN_LINE_FIELD_LINK_ID,
                line: i,
                value: lineLinkUrl
            });
        }
        poRec.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });
    }

    function isEmpty(stValue) {
        if (stValue == '' || stValue == null || stValue == undefined) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if (stValue == '') {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }

            return false;
        }
    }

    function isEven(n) {
        return n % 2 == 0;
    }

    return {
        onRequest: onRequest
    };
});
