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
 */
define([
    'N/search',
    'N/record',
    'N/runtime',
    'N/https',
    'N/xml',
    '../CTC_VC2_Lib_Utils.js',
    '../CTC_VC_Lib_MainConfiguration',
    '../CTC_VC_Lib_VendorConfig',
    '../CTC_VC_Lib_LicenseValidator',
    '../CTC_VC_Constants'
], function (
    search,
    record,
    runtime,
    https,
    xml,
    util,
    libMainConfig,
    libVendorConfig,
    libLicenseValidator,
    constants
) {
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
        log.audit('getInputData');
        var mainConfig = _loadMainConfig();

        _validateLicense({ mainConfig: mainConfig });

        if (_checkDandHVendorConfig()) {
            var srchId = runtime
                .getCurrentScript()
                .getParameter('custscript_ctc_vc_dh_itemrequest_srch');
            if (!srchId) srchId = 'customsearch_ctc_vc_dh_itemrequest';

            log.debug('srchId', srchId);
            var srch = search.load({ id: srchId });

            var count = srch.runPaged().count;
            log.debug('count', count);

            return srch;
        }
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        log.audit('item request: Map key: ' + context.key, context.value);

        var searchResult = JSON.parse(context.value);
        var subsidiary = searchResult.values.subsidiary.value;
        var tranId = searchResult.values.tranid;
        var item = searchResult.values.item.value;
        var itemName = searchResult.values.item.text;
        var mpn = searchResult.values[constants.Columns.DH_MPN];
        var vendor = searchResult.values['internalid.vendor'].value;
        var itemType = searchResult.values['type.item'].value;

        var vendorConfig = _loadVendorConfig({
            vendor: vendor,
            subsidiary: subsidiary
        });

        if (vendorConfig) {
            var itemNumbers = _getItemValues({
                vendorConfig: vendorConfig,
                itemName: itemName
            });

            if (itemNumbers && (itemNumbers.itemNum || itemNumbers.partNum)) {
                log.debug('itemname / itemNumbers', JSON.stringify([itemNumbers, itemName]));
                var valToSave;

                if (itemNumbers.itemNum.toUpperCase() == itemName.toUpperCase())
                    valToSave = itemNumbers.partNum;
                else if (itemNumbers.partNum.toUpperCase() == itemName.toUpperCase())
                    valToSave = itemNumbers.itemNum;

                values = {};
                values[constants.Fields.Item.DH_MPN] = valToSave;

                log.debug('values to update:', JSON.stringify([valToSave, values]));

                if (valToSave) {
                    try {
                        record.submitFields({
                            type: record.Type.INVENTORY_ITEM,
                            id: item,
                            values: values
                        });
                        log.debug('update :', '>> updated INVENTORY_ITEM: ' + item);
                    } catch (e) {
                        //If error, try another item type
                        record.submitFields({
                            type: record.Type.SERIALIZED_INVENTORY_ITEM,
                            id: item,
                            values: values
                        });
                        log.debug('update :', '>> updated SERIALIZED_INVENTORY_ITEM: ' + item);
                    }
                }
            }
        }
    }

    function _getItemValues(options) {
        var vendorConfig = options.vendorConfig,
            itemName = options.itemName,
            itemNumbers;

        var responseXML = _processItemInquiryRequest({
            vendorConfig: vendorConfig,
            itemNum: itemName,
            lookupType: 'DH'
        });

        log.debug('first response', responseXML);
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

            log.debug('second response', responseXML);
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
        log.audit('summarize');
        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('Map Error for key: ' + key, error);
            return true;
        });
        var mapKeys = [];
        summary.mapSummary.keys.iterator().each(function (key) {
            mapKeys.push(key);
            return true;
        });
        log.audit('MAP keys processed', mapKeys);
    }

    function _loadMainConfig() {
        var mainConfig = libMainConfig.getMainConfiguration();

        if (!mainConfig) {
            log.error('No Coniguration available');
            throw new Error('No Coniguration available');
        } else return mainConfig;
    }

    function _loadVendorConfig(options) {
        var vendor = options.vendor,
            subsidiary = options.subsidiary,
            vendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: vendor,
                subsidiary: subsidiary
            });

        if (!vendorConfig) {
            log.debug(
                'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary
            );
        } else return vendorConfig;
    }

    function _validateLicense(options) {
        var mainConfig = options.mainConfig,
            license = mainConfig.license,
            response = libLicenseValidator.callValidationSuitelet({
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
        var filters = [];
        filters.push(
            search.createFilter({
                name: constants.Fields.VendorConfig.XML_VENDOR,
                operator: search.Operator.ANYOF,
                values: constants.Lists.XML_VENDOR.DandH
            })
        );
        filters.push(
            search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            })
        );

        var columns = ['internalid'];

        var vendorConfigSearch = search.create({
            type: constants.Records.VENDOR_CONFIG,
            filters: filters,
            columns: columns
        });

        try {
            var result = vendorConfigSearch.run().getRange({
                start: 0,
                end: 1
            });
        } catch (e) {
            log.debug('error', JSON.stringify(e));
        }

        if (result && result[0]) {
            return true;
        } else {
            log.debug('No D&H', 'No D&H vendor configuration set up');
            return false;
        }
    }

    function _processItemInquiryRequest(options) {
        var vendorConfig = options.vendorConfig,
            itemNum = options.itemNum,
            lookupType = options.lookupType,
            requestURL = vendorConfig.endPoint,
            userName = vendorConfig.user,
            password = vendorConfig.password;
        log.debug('item inquiry d and h');

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
            var response = https.post({
                url: requestURL,
                body: xmlItemInquiry,
                headers: headers
            });
            responseXML = response.body;
            log.debug({
                title: 'D and H Scheduled - Item Inquiry',
                details: 'DandH response length ' + responseXML.length
            });
        } catch (err) {
            log.debug({
                title: 'D and H Scheduled - Item Inquiry',
                details: 'DandH scheduled error = ' + err.message
            });
            responseXML = null;
        }

        return responseXML;
    }

    function _processItemInquiryResponse(options) {
        var xmlString = options.responseXML;
        log.debug({
            title: 'D and H Scheduled - Item Inquiry Response',
            details: 'ParseDandH'
        });

        // Create XML object from XML text returned from vendor, using Netsuite XML parser
        var itemNum, partNum;
        var xmlDoc = xml.Parser.fromString({
            text: xmlString
        });

        if (xmlDoc != null) {
            var itemNode = xml.XPath.select({ node: xmlDoc, xpath: '//ITEM' });
            if (itemNode != null && itemNode.length > 0) {
                itemNum = util.getNodeTextContent(
                    xml.XPath.select({ node: itemNode[0], xpath: 'VENDORITEMNO' })[0]
                );
                partNum = util.getNodeTextContent(
                    xml.XPath.select({ node: itemNode[0], xpath: 'PARTNUM' })[0]
                );
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
