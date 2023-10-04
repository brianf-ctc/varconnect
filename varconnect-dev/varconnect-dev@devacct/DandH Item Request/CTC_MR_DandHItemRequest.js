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
 * @NScriptType MapReduceScript
 * @Description Syncs D&H Item information for use with VAR Connect
 */
/**
 * Project Number: TODO-001225
 * Script Name: CTC MR DandH Item Request
 * Author: paolodl@nscatalyst.com
 *
 * CHANGELOGS
 *
 * Version	Date            Author		    		Remarks
 * 1.00		Jan 1, 2020	    paolodl@nscatalyst.com	Initial Build
 * 1.01		Oct 25, 2022	christian@nscatalyst.com	Support non-inventory type
 */
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/https',
    'N/xml',
    '../CTC_VC_Lib_MainConfiguration',
    '../CTC_VC_Lib_VendorConfig',
    '../CTC_VC_Lib_LicenseValidator',
    '../CTC_VC2_Lib_Utils.js',
    '../CTC_VC2_Constants.js'
], function (
    ns_search,
    ns_record,
    ns_runtime,
    ns_https,
    ns_xml,
    vc_maincfg,
    vc_vendorcfg,
    vc_license,
    vc2_util,
    vc2_constant
) {
    var LogTitle = 'VC|D&H Item Request';

    var Helper = {
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);

            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld]) ? arrResults[fld][0] : arrResults[fld];
                }
            }
            return arrData;
        }
    };
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        var logTitle = [LogTitle, 'getInputData'].join(':');
        var mainConfig = _loadMainConfig();

        _validateLicense({ mainConfig: mainConfig });

        if (_checkDandHVendorConfig()) {
            var srchId = ns_runtime.getCurrentScript().getParameter('custscript_ctc_vc_dh_itemrequest_srch');
            if (!srchId) srchId = 'customsearch_ctc_vc_dh_itemrequest';

            log.debug(logTitle, 'Search id=' + srchId);
            var srch = ns_search.load({ id: srchId });

            var count = srch.runPaged().count;
            log.audit(logTitle, count + ' item(s) to process.');

            return srch;
        }
    }

    var _cachedResponses = {};
    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        var logTitle = [LogTitle, 'map'].join(':');
        log.audit(logTitle, 'item request: Map key: ' + context.key + '=' + context.value);

        var searchResult = JSON.parse(context.value);
        var subsidiary = searchResult.values.subsidiary.value;
        var tranId = searchResult.values.tranid;
        var item = searchResult.values.item.value;
        var itemName = searchResult.values.item.text;
        logTitle = [logTitle, itemName].join(':');
        var mpn = searchResult.values[vc2_constant.FIELD.TRANSACTION.DH_MPN];
        var vendor = searchResult.values['internalid.vendor'].value;
        var itemType = searchResult.values['type.item'].value;
        var isSerialItem = searchResult.values['isserialitem.item'];
        var itemRecordType;

        // Compare item type to its record type counterpart
        // switch (itemType) {
        //     case 'NonInvtPart':
        //         itemRecordType = ns_record.Type.NON_INVENTORY_ITEM;
        //         break;
        //     case 'InvtPart':
        //         if (isSerialItem) {
        //             itemRecordType = ns_record.Type.SERIALIZED_INVENTORY_ITEM;
        //         } else {
        //             itemRecordType = ns_record.Type.INVENTORY_ITEM;
        //         }
        //         break;
        //     default:
        //         itemRecordType = null;
        //         log.error(
        //             logTitle,
        //             'UNSUPPORTED_ITEM_TYPE: Not expecting D&H to fulfill this item type: ' +
        //                 itemType
        //         );
        //         break;
        // }
        // log.audit(logTitle, '>> item record type: ' + JSON.stringify([itemType, itemRecordType]));

        // try to lookup instead
        var itemData = Helper.flatLookup({ type: 'item', id: item, columns: ['recordtype'] });
        log.audit(logTitle, '>> item info: ' + JSON.stringify(itemData));
        itemRecordType = itemData.recordtype;

        log.audit(logTitle, '>> item record type: ' + JSON.stringify([itemType, itemRecordType]));

        if (!itemRecordType) return;

        var vendorConfig = _loadVendorConfig({
            vendor: vendor,
            subsidiary: subsidiary
        });

        if (!vendorConfig) return;
        var itemNumbers = _getItemValues({
            vendorConfig: vendorConfig,
            itemName: itemName
        });

        if (itemNumbers && (itemNumbers.itemNum || itemNumbers.partNum)) {
            log.debug(logTitle, 'itemNumbers=' + JSON.stringify(itemNumbers));
            var valToSave;

            if (itemNumbers.itemNum.toUpperCase() == itemName.toUpperCase()) valToSave = itemNumbers.partNum;
            else if (itemNumbers.partNum.toUpperCase() == itemName.toUpperCase()) valToSave = itemNumbers.itemNum;

            values = {};
            values[vc2_constant.FIELD.ITEM.DH_MPN] = valToSave;

            log.debug(logTitle, 'values to update:' + JSON.stringify(values));

            if (valToSave) {
                try {
                    ns_record.submitFields({
                        type: itemRecordType,
                        id: item,
                        values: values
                    });
                    log.debug(logTitle, '>> updated ' + (isSerialItem ? 'SERIALIZED_' : '') + itemType + item);
                } catch (error) {
                    log.error(logTitle, '## ERROR: ' + JSON.stringify(error));
                    throw error;
                }
            }
        }
    }

    function _getItemValues(options) {
        var logTitle = [LogTitle, '_getItemValues'].join(':');
        var vendorConfig = options.vendorConfig,
            itemName = options.itemName,
            itemNumbers;

        var responseXML = _processItemInquiryRequest({
            vendorConfig: vendorConfig,
            itemNum: itemName,
            lookupType: 'DH'
        });

        log.debug(logTitle, '1st response=' + responseXML);
        if (responseXML && responseXML.indexOf('Invalid') < 0)
            itemNumbers = _processItemInquiryResponse({
                responseXML: responseXML
            });

        if (!itemNumbers) {
            var responseXML = _processItemInquiryRequest({
                vendorConfig: vendorConfig,
                itemNum: itemName,
                lookupType: 'MFR'
            });

            log.debug(logTitle, '2nd response=' + responseXML);
            if (!responseXML || responseXML.indexOf('Invalid') >= 0) {
                var cachedResponseXml =
                    getCachedResponse({
                        itemNum: itemName,
                        lookupType: 'DH'
                    }) ||
                    getCachedResponse({
                        itemNum: itemName,
                        lookupType: 'MFR'
                    });
                log.debug(logTitle, 'Cached response=' + cachedResponseXml);
                responseXML = cachedResponseXml || responseXML;
            }
            if (responseXML)
                itemNumbers = _processItemInquiryResponse({
                    responseXML: responseXML
                });
        }

        return itemNumbers;
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
        var logTitle = [LogTitle, 'summarize'].join(':');
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error(logTitle, 'Map Error for key: ' + key + '=' + error);
            return true;
        });
        var mapKeys = [];
        summary.mapSummary.keys.iterator().each(function (key) {
            mapKeys.push(key);
            return true;
        });
        log.audit(logTitle, 'MAP keys processed=' + mapKeys);
    }

    function _loadMainConfig() {
        var logTitle = [LogTitle, '_loadMainConfig'].join(':');
        var mainConfig = vc_maincfg.getMainConfiguration();

        if (!mainConfig) {
            log.error(logTitle, 'No Configuration available');
            throw new Error('No Coniguration available');
        } else return mainConfig;
    }

    function _loadVendorConfig(options) {
        var logTitle = [LogTitle, '_loadVendorConfig'].join(':');
        var vendor = options.vendor,
            subsidiary = options.subsidiary,
            vendorConfig = vc_vendorcfg.getVendorConfiguration({
                vendor: vendor,
                subsidiary: subsidiary
            });

        if (!vendorConfig) {
            log.debug(logTitle, 'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary);
        } else return vendorConfig;
    }

    function _validateLicense(options) {
        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            response = vc_license.callValidationSuitelet({
                license: license,
                external: true
            });

        if (response == 'invalid')
            throw new Error(
                'License is no longer valid or have expired. Please contact damon@nscatalyst.com to get a new license. Your product has been disabled.'
            );
    }

    function _validateVendorConfig(options) {
        var vendorConfig = options.vendorConfig,
            endpoint = vendorConfig.endPoint,
            user = vendorConfig.user,
            password = vendorConfig.password,
            customerNo = vendorConfig.customerNo;

        if (!endpoint || !user || !password)
            throw Error('Incomplete webservice information for ' + vendorConfig.vendor);
    }

    function _checkDandHVendorConfig(options) {
        var logTitle = [LogTitle, '_checkDandHVendorConfig'].join(':');
        var filters = [];
        filters.push(
            ns_search.createFilter({
                name: vc2_constant.RECORD.VENDOR_CONFIG.FIELD.XML_VENDOR,
                operator: ns_search.Operator.ANYOF,
                values: vc2_constant.LIST.XML_VENDOR.DandH
            })
        );
        filters.push(
            ns_search.createFilter({
                name: 'isinactive',
                operator: ns_search.Operator.IS,
                values: false
            })
        );

        var columns = ['internalid'];

        var vendorConfigSearch = ns_search.create({
            type: vc2_constant.RECORD.VENDOR_CONFIG.ID,
            filters: filters,
            columns: columns
        });

        try {
            var result = vendorConfigSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.debug(logTitle, 'ERROR=' + JSON.stringify(e));
        }

        if (result && result[0]) {
            return true;
        } else {
            log.debug(logTitle, 'No D&H vendor configuration set up');
            return false;
        }
    }

    function _processItemInquiryRequest(options) {
        var logTitle = [LogTitle, '_processItemInquiryRequest'].join(':');
        var vendorConfig = options.vendorConfig,
            itemNum = options.itemNum,
            lookupType = options.lookupType,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password;
        log.debug(logTitle, 'Sending item inquiry to D&H ...');

        var xmlItemInquiry;
        var xmlInvoiceByPOStatus;

        var orderXMLLineData = [];

        xmlItemInquiry =
            '<XMLFORMPOST>' +
            '<REQUEST>itemInquiry</REQUEST>' +
            '<LOGIN>' +
            '<USERID>' +
            userName +
            '</USERID>' +
            '<PASSWORD>' +
            password +
            '</PASSWORD>' +
            '</LOGIN>' +
            '<PARTNUM>' +
            itemNum +
            '</PARTNUM>' +
            '<LOOKUPTYPE>' +
            lookupType +
            '</LOOKUPTYPE>' +
            '<QUANTITY>1</QUANTITY>' +
            '</XMLFORMPOST>';

        var headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': 'length'
        };

        var responseXML;
        try {
            /**
             * change endpoint
             * add to vendor config
             */
            var response = ns_https.post({
                url: requestURL,
                body: xmlItemInquiry,
                headers: headers
            });
            responseXML = response.body;
            log.debug({
                title: logTitle,
                details: 'D&H response length = ' + responseXML.length
            });
            // save latest response
            if (responseXML && responseXML.indexOf('Invalid') < 0) {
                _cachedResponses[[itemNum, lookupType].join('_')] = responseXML;
            }
        } catch (err) {
            log.debug({
                title: logTitle,
                details: 'D&H request error = ' + err.message
            });
            responseXML = null;
        }

        return responseXML;
    }

    function getCachedResponse(options) {
        var itemNum = options.itemNum,
            lookupType = options.lookupType;
        return _cachedResponses[[itemNum, lookupType].join('_')];
    }

    function _processItemInquiryResponse(options) {
        var logTitle = [LogTitle, '_processItemInquiryResponse'].join(':');
        var xmlString = options.responseXML;
        log.debug({
            title: logTitle,
            details: 'Parsing D&H response ...'
        });

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemNum, partNum;
        var xmlDoc = ns_xml.Parser.fromString({
            text: xmlString
        });

        if (xmlDoc != null) {
            var itemNode = ns_xml.XPath.select({ node: xmlDoc, xpath: '//ITEM' });
            if (itemNode != null && itemNode.length > 0) {
                itemNum = vc2_util.getNodeTextContent(
                    ns_xml.XPath.select({ node: itemNode[0], xpath: 'VENDORITEMNO' })[0]
                );
                partNum = vc2_util.getNodeTextContent(ns_xml.XPath.select({ node: itemNode[0], xpath: 'PARTNUM' })[0]);
            }
        }

        var ret = {
            itemNum: itemNum,
            partNum: partNum
        };

        return ret;
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
