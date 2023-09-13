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
    'N/search',
    'N/record',
    'N/file',
    'N/task',
    'N/http',
    'N/config',
    'N/url',
    './CTC_VC2_Lib_Utils',
    './CTC_VC2_Constants.js',
    './CTC_VC_Lib_MainConfiguration.js'
], function (
    ns_ui,
    ns_search,
    ns_record,
    ns_file,
    ns_task,
    ns_https,
    ns_config,
    ns_url,
    vc2_util,
    vc2_constant,
    lib_maincfg
) {
    var LogTitle = 'SL:BulkSerials';

    const PO_SERIAL_NUMBER_FOLDER = vc2_constant.GLOBAL.SN_FOLDER_ID;

    function onRequest(context) {
        var logTitle = [LogTitle, 'onRequest'].join('::');

        vc2_util.log(logTitle, 'Enter serial Pg2 - main Entry');

        if (context.request.method == 'GET') {
            doGet(context);
        } else if (context.request.method == 'POST') {
            doPost(context);
        }
    }

    function doGet(context) {
        var logTitle = [LogTitle, 'doGet'].join('::');

        var poNum = context.request.parameters['item'];
        vc2_util.log(logTitle, 'Enter serial Pg2 - poNum = ', poNum);

        if (isEmpty(poNum)) {
            vc2_util.log(logTitle, 'PO Num EMPTY');
            var form = ns_ui.createForm({
                title: 'Error - PO Number empty/not found. Please try again'
            });
            context.response.writePage(form);
        }

        var itemList = getItems(poNum);

        if (!isEmpty(itemList)) {
            var form = ns_ui.createForm({
                title: 'PO Manual Add Serial Numbers'
            });
            form.clientScriptModulePath = './CTC_VC_CS_Bulk_Serials_Lib.js';

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
                type: ns_ui.FieldType.LABEL,
                label: 'Purchase Order # : ' + poNum,
                container: 'itemgroup'
            });

            var poNumField = form.addField({
                id: 'custpage_ponumfld',
                type: ns_ui.FieldType.TEXT,
                label: 'Po Num:',
                container: 'itemgroup'
            });
            poNumField.defaultValue = poNum;
            poNumField.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });

            var itemsField = form.addField({
                id: 'custpage_itemsfld',
                type: ns_ui.FieldType.LONGTEXT,
                label: 'Items:',
                container: 'itemgroup'
            });
            itemsField.defaultValue = JSON.stringify(itemList);
            itemsField.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });

            var itemselect = form.addField({
                id: 'itemselectfield',
                type: ns_ui.FieldType.SELECT,
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
                    type: ns_ui.FieldType.LABEL,
                    label: 'Count of Existing Serial Numbers : ' + snCount,
                    container: 'itemgroup'
                });

                var currentField = form.addField({
                    id: 'custpage_currentsn_' + itemId,
                    type: ns_ui.FieldType.LONGTEXT,
                    label: 'Existing Serial Numbers:',
                    container: 'itemgroup'
                });
                currentField.defaultValue = currentSNList;
                currentField.updateDisplayType({
                    displayType: ns_ui.FieldDisplayType.READONLY
                });

                var newField = form.addField({
                    id: 'custpage_newsn_' + itemId,
                    type: ns_ui.FieldType.LONGTEXT,
                    label: 'New Serial Numbers:',
                    container: 'itemgroup'
                });

                var lineKeyID = form.addField({
                    id: 'custpage_linekey_' + itemId,
                    type: ns_ui.FieldType.TEXT,
                    label: 'Line Unique Key:'
                });
                lineKeyID.defaultValue = itemId;
                lineKeyID.updateDisplayType({ displayType: ns_ui.FieldDisplayType.HIDDEN });
            }

            // Creates and populates the invoice sublist
            //buildSublist (item_sublist, itemList);

            context.response.writePage(form);
        } else {
            vc2_util.log(logTitle, 'Item List EMPTY');
            var form = ns_ui.createForm({
                title: 'Error - No items found. Please try again'
            });
            context.response.writePage(form);
        }
    }

    function doPost(context) {
        var logTitle = [LogTitle, 'doPost'].join('::');

        var request = context.request;
        var params = JSON.stringify(context.request.parameters);

        var outputObj = {
            poId: '',
            soId: '',
            items: []
        };

        vc2_util.log(logTitle, 'Submit button clicked');
        vc2_util.log(logTitle, 'parameters = ', params);

        var poField = context.request.parameters.custpage_ponumfld;
        var itemsField = JSON.parse(context.request.parameters.custpage_itemsfld);

        if (!isEmpty(poField)) {
            vc2_util.log(logTitle, 'PO Num = ', poField);

            outputObj.poId = itemsField[0].poID;
            if (!isEmpty(itemsField)) {
                vc2_util.log(logTitle, 'itemsField = ', itemsField);

                if (!isEmpty(outputObj.poId)) {
                    setSNLineLink(outputObj.poId);
                }
                outputObj.soId = itemsField[0].soID;

                vc2_util.log(logTitle, 'SO Num = ', outputObj.soId);

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

                    vc2_util.log(logTitle, 'Item ', newSNStr);
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
            vc2_util.log(logTitle, 'PO File Created, ID = ', fileID);

            var mrTask = ns_task.create({
                taskType: ns_task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_add_serials_mr',
                deploymentId: 'customdeploy_add_serials_mr',
                params: { custscript_serialsfileid: fileID }
            });

            if (!isEmpty(mrTask)) {
                vc2_util.log(logTitle, 'mrTask = ', mrTask);

                var mrTaskID = mrTask.submit();
                // Redirect back to page 1
                context.response.sendRedirect({
                    type: ns_https.RedirectType.SUITELET,
                    identifier: 'customscript_vc_bulk_serial_numbers',
                    id: 'customdeploy_vc_bulk_serial_numbers',
                    editMode: false
                });
            } else {
                vc2_util.log(logTitle, 'Could not Create/Submit the Map/Reduce Task ');
                var form = ns_ui.createForm({
                    title: 'Could not process serial numbers, please try again. (Error = Task-Create)'
                });
                context.response.writePage(form);
            }
        } else {
            vc2_util.log(logTitle, 'PO Num EMPTY');
            var form = ns_ui.createForm({
                title: 'Error - PO Number empty/not found. Please try again'
            });
            context.response.writePage(form);
        }
    }

    function _loadMainConfig() {
        var logTitle = [LogTitle, '_loadMainConfig'].join('::');

        var mainConfig = lib_maincfg.getMainConfiguration();

        if (!mainConfig) {
            log.error('No Coniguration available');
            //    			throw new Error('No Coniguration available');
        } else return mainConfig;
    }

    function createAndSaveFile(outputObj, poField) {
        var logTitle = [LogTitle, 'createAndSaveFile'].join('::');

        var mainConfig = _loadMainConfig(),
            fileObj = ns_file.create({
                name: poField + 'Serials.txt',
                fileType: ns_file.Type.PLAINTEXT,
                contents: JSON.stringify(outputObj)
            });
        //            fileObj.folder = PO_SERIAL_NUMBER_FOLDER;
        fileObj.folder = mainConfig.serialNoFolder;

        var id = fileObj.save();

        return id;
    }

    function getItems(poNum) {
        var logTitle = [LogTitle, 'getItems'].join('::');

        var items = [];
        var itemIDs = [];

        var purchaseorderSearchObj = ns_search.create({
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
                ns_search.createColumn({ name: 'tranid', label: 'Document Number' }),
                ns_search.createColumn({ name: 'item', label: 'Item' }),
                ns_search.createColumn({ name: 'createdfrom', label: 'Created From' }),
                ns_search.createColumn({ name: 'lineuniquekey', label: 'Line Unique Key' })
            ]
        });

        var searchResultCount = purchaseorderSearchObj.runPaged().count;
        vc2_util.log(logTitle, 'purchaseorderSearchObj result count', searchResultCount);

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
        var logTitle = [LogTitle, 'getCurrentSNList'].join('::');

        var snList = '';

        var customrecordserialnumSearchObj = ns_search.create({
            type: 'customrecordserialnum',
            filters: [
                ['custrecordserialpurchase.numbertext', 'is', poNum],
                'AND',
                ['custrecordserialitem.internalid', 'anyof', itemID]
            ],
            columns: [
                ns_search.createColumn({
                    name: 'name',
                    sort: ns_search.Sort.ASC,
                    label: 'Name'
                }),
                ns_search.createColumn({ name: 'scriptid', label: 'Script ID' }),
                ns_search.createColumn({ name: 'custrecordserialitem', label: 'ItemNum' })
            ]
        });
        var searchResultCount = customrecordserialnumSearchObj.runPaged().count;
        vc2_util.log(logTitle, 'customrecordserialnumSearchObj result count', searchResultCount);

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
        var logTitle = [LogTitle, 'getNewSNStr'].join('::');

        var itemID = 'custpage_newsn_' + itemid;
        var newIndex = params.indexOf('custpage_newsn_' + itemid);
        vc2_util.log(logTitle, 'index of item id', newIndex);
        if (newIndex >= 0) {
            newIndex += itemID.length + 3; // move past itemID +":"
            var newEndIndex = params.indexOf('"', newIndex);
            vc2_util.log(logTitle, 'end index of item id', newEndIndex);

            if (newIndex < newEndIndex) {
                var newSNStr = params.substring(newIndex, newEndIndex);
                vc2_util.log(logTitle, 'new SN string', newSNStr);

                return newSNStr;
            }
        }

        return '';
    }

    function setSNLineLink(poID) {
        var logTitle = [LogTitle, 'setSNLineLink'].join('::');

        var poRec = ns_record.load({
            type: ns_record.Type.PURCHASE_ORDER,
            id: poID,
            isDynamic: false
        });
        var poNum = encodeURIComponent(poRec.getText('tranid'));
        var soNum = encodeURIComponent(poRec.getText('createdfrom'));
        var companyObj = ns_config.load({
            type: ns_config.Type.COMPANY_INFORMATION
        });
        var accountId = companyObj.getValue('companyid');

        vc2_util.log(logTitle, '>>  poNum', poNum);
        vc2_util.log(logTitle, '>>  soNum', soNum);
        vc2_util.log(logTitle, '>>  companyObj', companyObj);

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

            var lineLinkUrl = generateSerialLink({
                sonum: soNum,
                ponum: poNum,
                itemid: itemId,
                itemname: itemName
            });

            poRec.setSublistValue({
                sublistId: 'item',
                fieldId: vc2_constant.GLOBAL.SN_LINE_FIELD_LINK_ID,
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

    function generateSerialLink(option) {
        // var ns_url = ns_url || vc2_util.loadModule('N/url') || vc2_util.loadModuleNS('N/url');

        var protocol = 'https://';
        var domain = ns_url.resolveDomain({
            hostType: ns_url.HostType.APPLICATION
        });
        var linkUrl = ns_url.resolveScript({
            scriptId: vc2_constant.SCRIPT.VIEW_SERIALS_SL,
            deploymentId: vc2_constant.DEPLOYMENT.VIEW_SERIALS_SL,
            params: option
        });

        return protocol + domain + linkUrl;
    }

    return {
        onRequest: onRequest
    };
});
