require(['N/search', 'N/record', 'N/error', 'N/runtime', 'N/format'], function (
    ns_search,
    ns_record,
    ns_error,
    ns_runtime,
    ns_format
) {
    var LOG_TITLE = 'VCLogReports';
    var IS_DEBUG = true;

    const SCRIPT_PARAMETER_NAMES = {
            searchId: { optional: false, id: 'custscript_vc_logsearchsummary' }
        },
        LIST = {
            CATEGORY: {
                FULFILLMENT: 'Fulfillment Created',
                ORDERLINE: 'PO Line',
                MISSING_ORDERNUM: 'Missing Order',
                INVALID_LOGIN: 'Invalid Login',
                INVALID_HOST: 'Invalid Host'
            },
            TYPE: {
                SUCCESS: 'SUCCESS',
                ERROR: 'ERROR'
            }
        },
        VCLOG_REC = {
            ID: 'customrecord_ctc_vcsp_log',
            FIELD: {
                ID: 'internalid',
                APPLICATION: 'custrecord_ctc_vcsp_log_app',
                HEADER: 'custrecord_ctc_vcsp_log_header',
                BODY: 'custrecord_ctc_vcsp_log_body',
                TRANSACTION: 'custrecord_ctc_vcsp_log_transaction',
                STATUS: 'custrecord_ctc_vcsp_log_status',
                DATE: 'custrecord_ctc_vcsp_log_date'
            }
        },
        VCLOGREP_REC = {
            ID: 'customrecord_ctc_vcsp_log_summary',
            FIELD: {
                APPLICATION: 'custrecord_ctc_vclog_application',
                CATEGORY: 'custrecord_ctc_vclog_category',
                COUNT: 'custrecord_ctc_vclog_count',
                DATE: 'custrecord_ctc_vclog_date',
                TYPE: 'custrecord_ctc_vclog_type',
                VENDOR: 'custrecord_ctc_vclog_vendorconfig',
                AMOUNT: 'custrecord_ctc_vclog_amount',
                LOGKEY: 'custrecord_ctc_vclog_key'
            }
        },
        VCLOG_MAPPING = [
            // FULFILLMENTS
            (logValues) => {
                let logTitle = 'MAPPING:Fulfillment';
                let reportObj = {
                        DATE: logValues.DATE,
                        APPLICATION: 'Order Status',
                        CATEGORY: LIST.CATEGORY.FULFILLMENT,
                        VENDOR: logValues.VENDOR
                    },
                    returnValue = null;
                log.audit(logTitle, '>> log values: ' + JSON.stringify(logValues));

                var logKeyId = [logValues.DATE, logValues.VENDOR, logValues.TRANSACTION.value];

                if (
                    /Fulfillment.*Successfully Created/i.test(logValues.HEADER) &&
                    /Success/i.test(logValues.STATUS.text)
                ) {
                    // get the fulfillment id
                    var fulfillmentId = logValues.BODY.replace(
                        /^.*Created\sFulfillment.*\((.+?)\).*$/gs,
                        '$1'
                    );

                    logKeyId.push(LIST.CATEGORY.FULFILLMENT);
                    logKeyId.push(fulfillmentId);

                    util.extend(reportObj, {
                        CATEGORY: LIST.CATEGORY.FULFILLMENT,
                        TYPE: LIST.TYPE.SUCCESS
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                } else if (/Fulfillment.*Order Lines/i.test(logValues.HEADER)) {
                    /// get the order num
                    var orderNum = logValues.HEADER.replace(/.*\[(.+?)\].*$/gs, '$1');

                    logKeyId.push(LIST.CATEGORY.FULFILLMENT);
                    logKeyId.push(orderNum);
                    util.extend(reportObj, {
                        TYPE: LIST.TYPE.SUCCESS
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                } else if (/Fulfillment.*Missing Order Num/i.test(logValues.HEADER)) {
                    logKeyId.push(LIST.CATEGORY.MISSING_ORDERNUM);
                    util.extend(reportObj, {
                        TYPE: LIST.TYPE.ERROR
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                }

                return returnValue;
            },

            // INVALID LOGIN //
            (logValues) => {
                let logTitle = 'MAPPING:InvalidLogin';
                let reportObj = {
                        DATE: logValues.DATE,
                        APPLICATION: 'Order Status',
                        VENDOR: logValues.VENDOR
                    },
                    returnValue = null;
                log.audit(logTitle, '>> log values: ' + JSON.stringify(logValues));

                var logKeyId = [logValues.DATE, logValues.VENDOR, logValues.TRANSACTION.value];

                if (
                    (/WebService Error/i.test(logValues.STATUS) &&
                        /Login failed/i.test(logValues.BODY)) ||
                    /XML services has not been registered/i.test(logValues.BODY) ||
                    /User not found/i.test(logValues.BODY) ||
                    /Client\.ValidateUser User not found/i.test(logValues.BODY) ||
                    /The login was invalid/i.test(logValues.BODY) ||
                    /Invalid client identifier/i.test(logValues.BODY)
                ) {
                    logKeyId.push(LIST.CATEGORY.INVALID_LOGIN);
                    util.extend(reportObj, {
                        TYPE: LIST.TYPE.ERROR,
                        CATEGORY: LIST.CATEGORY.INVALID_LOGIN
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                } else if (
                    /Received invalid response code/i.test(logValues.BODY) ||
                    /File or directory not found/i.test(logValues.BODY) ||
                    /Error 404/i.test(logValues.BODY)
                ) {
                    logKeyId.push(LIST.CATEGORY.INVALID_HOST);
                    util.extend(reportObj, {
                        TYPE: LIST.TYPE.ERROR,
                        CATEGORY: LIST.CATEGORY.INVALID_HOST
                    });

                    returnValue = {
                        key: logKeyId.join('_'),
                        value: reportObj
                    };
                }
                return returnValue;
            }
        ];

    let SCRIPT_LOGS = {};

    // const VC_LOG_MAP = {
    //     fulfillmenCreatedt: (objValues) => {
    //         let categoryName = 'Fulfullment';
    //         let objReturn = null;

    //         //get field value
    //         let statusLog = objValues.custrecord_ctc_vcsp_log_status.text;
    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let bodyLog = objValues.custrecord_ctc_vcsp_log_body;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);
    //         let ifId = Helper.alphaNumOnly(getIdFromBody(bodyLog));

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = [
    //             dateLog,
    //             Helper.alphaNumOnly(categoryName),
    //             Helper.alphaNumOnly(vendorConfigName),
    //             ifId
    //         ].join('_');

    //         if (statusLog.toUpperCase() == 'SUCCESS' && /Created Fulfillment/i.test(bodyLog)) {
    //             objReturn = {
    //                 key: `success_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: ifId
    //                 }
    //             };
    //             // } else if (statusLog.toUpperCase() == 'ERROR') {
    //             //     objReturn = {
    //             //         key: `error_${stKey}`,
    //             //         value: {
    //             //             date: dateLog,
    //             //             categoryName: categoryName,
    //             //             vendorConfig: vendorConfigName,
    //             //             transaction: ifId
    //             //         }
    //             //     };
    //         }
    //         return objReturn;
    //     },
    //     billFile: (objValues) => {
    //         let categoryName = 'Bill File';
    //         let objReturn = null;

    //         //get field value
    //         let statusLog = objValues.custrecord_ctc_vcsp_log_status.text;
    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;
    //         let headerLog = objValues.custrecord_ctc_vcsp_log_header;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         // get the file id
    //         let billFileId = /Downloaded file/i.test(headerLog)
    //             ? headerLog.replace(/.*(\d*)\D/gi, '$1')
    //             : headerLog.replace(/.+?(\d+?)\D.*$/gi, '$1');

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = [
    //             dateLog,
    //             Helper.alphaNumOnly(categoryName),
    //             Helper.alphaNumOnly(vendorConfigName),
    //             // tranId,
    //             billFileId
    //         ].join('_');

    //         // `${Helper.alphaNumOnly(categoryName)}_${Helper.alphaNumOnly(
    //         //     vendorConfigName
    //         // )}_${tranId}`;

    //         if (statusLog.toUpperCase() == 'SUCCESS') {
    //             objReturn = {
    //                 key: `success_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: tranId
    //                 }
    //             };
    //         }
    //         return objReturn;
    //     },
    //     billsCreated: (objValues) => {
    //         let categoryName = 'Bills Created';
    //         let objReturn = null;

    //         //get field value
    //         let statusLog = objValues.custrecord_ctc_vcsp_log_status.text;
    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;
    //         let bodyLog = objValues.custrecord_ctc_vcsp_log_body;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = [
    //             dateLog,
    //             Helper.alphaNumOnly(categoryName),
    //             Helper.alphaNumOnly(vendorConfigName),
    //             tranId
    //         ].join('_');

    //         if (/Created Vendor Bill/i.test(bodyLog)) {
    //             objReturn = {
    //                 key: `success_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: tranId
    //                 }
    //             };
    //         } else if (statusLog.toUpperCase() == 'WARNING') {
    //             objReturn = {
    //                 key: `error_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName
    //                 }
    //             };
    //         }
    //         return objReturn;
    //     },
    //     poLine: (objValues) => {
    //         let categoryName = 'PO Line';
    //         let objReturn = null;

    //         let statusLog = objValues.custrecord_ctc_vcsp_log_status.text;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;
    //         let bodyLog = objValues.custrecord_ctc_vcsp_log_body;
    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         //set key suffix (category name with no spaces and lowercase + vendor config)

    //         let stKey = [
    //             dateLog,
    //             Helper.alphaNumOnly(categoryName),
    //             Helper.alphaNumOnly(vendorConfigName),
    //             tranId
    //         ].join('_');

    //         if (Helper.isJsonParsable(bodyLog) && statusLog.toUpperCase() != 'ERROR') {
    //             if (Array.isArray(JSON.parse(bodyLog))) {
    //                 objReturn = {
    //                     key: `success_${stKey}`,
    //                     value: {
    //                         date: dateLog,
    //                         categoryName: categoryName,
    //                         vendorConfig: vendorConfigName,
    //                         transaction: tranId
    //                     }
    //                 };
    //             }
    //         } else if (statusLog.toUpperCase() == 'ERROR') {
    //             objReturn = {
    //                 key: `error_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: tranId
    //                 }
    //             };
    //         }
    //         return objReturn;
    //     },
    //     webServiceError: (objValues) => {
    //         let categoryName = null; //'API/Web Service';
    //         let objReturn = null;

    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;
    //         let bodyLog = objValues.custrecord_ctc_vcsp_log_body;
    //         let headerLog = objValues.custrecord_ctc_vcsp_log_header;

    //         if (/BadGateway/i.test(body)) {
    //             categoryName = 'Bad Gateway';
    //         } else if (/Missing Item Details/i.test(body)) {
    //             categoryName = 'Missing Items';
    //         } else if (/invalid response code/i.test(body)) {
    //             categoryName = 'Invalid Response Code';
    //         }
    //         if (!categoryName) return false;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = [
    //             dateLog,
    //             Helper.alphaNumOnly(categoryName),
    //             Helper.alphaNumOnly(vendorConfigName),
    //             tranId
    //         ].join('_');

    //         //always error daw
    //         objReturn = {
    //             key: `error_${stKey}`,
    //             value: {
    //                 date: dateLog,
    //                 categoryName: categoryName,
    //                 vendorConfig: vendorConfigName,
    //                 transaction: tranId
    //             }
    //         };

    //         return objReturn;
    //     },
    //     webServiceApi: (objValues) => {
    //         let categoryName = 'API/Web Service';
    //         let objReturn = {};

    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = `${Helper.alphaNumOnly(categoryName)}_${Helper.alphaNumOnly(
    //             vendorConfigName
    //         )}`;

    //         //always error daw
    //         objReturn = {
    //             key: `error_${stKey}`,
    //             value: {
    //                 date: dateLog,
    //                 categoryName: categoryName,
    //                 vendorConfig: vendorConfigName,
    //                 transaction: tranId
    //             }
    //         };

    //         return objReturn;
    //     },
    //     record: (objValues) => {
    //         let categoryName = 'Record';
    //         let objReturn = {};

    //         let dateLog = objValues.custrecord_ctc_vcsp_log_date;
    //         let tranId = objValues.custrecord_ctc_vcsp_log_transaction.value;
    //         let statusLog = objValues.custrecord_ctc_vcsp_log_status.text;

    //         //get vendor config name
    //         let vendorConfigName = getVendorConfig(tranId);

    //         //set key suffix (category name with no spaces and lowercase + vendor config)
    //         let stKey = `${Helper.alphaNumOnly(categoryName)}_${Helper.alphaNumOnly(
    //             vendorConfigName
    //         )}`;

    //         if (statusLog.toUpperCase() == 'SUCCESS') {
    //             objReturn = {
    //                 key: `success_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: tranId
    //                 }
    //             };
    //         }
    //         if (statusLog.toUpperCase() == 'ERROR') {
    //             objReturn = {
    //                 key: `error_${stKey}`,
    //                 value: {
    //                     date: dateLog,
    //                     categoryName: categoryName,
    //                     vendorConfig: vendorConfigName,
    //                     transaction: tranId
    //                 }
    //             };
    //         }
    //         return objReturn;
    //     }
    // };

    const Helper = {
        createLogSummary: (arrValues, key) => {
            let logSummaryId = getExistingLogSummaryId(key);
            SCRIPT_LOGS.logSummaryId = logSummaryId;

            let objRec = '';
            if (!Helper.isEmpty(logSummaryId)) {
                objRec = ns_record.load({
                    type: VCLOGREP_REC.ID,
                    id: logSummaryId
                });
            } else {
                objRec = ns_record.create({ type: VCLOGREP_REC.ID });
            }

            let objDate = Helper.convertDate(arrValues.map((a) => a.date)[0]);
            let objFieldValues = {
                custrecord_ctc_vclog_application: 'Var Connect - Dev Account',
                custrecord_ctc_vclog_category: arrValues.map((a) => a.categoryName)[0] || '',
                custrecord_ctc_vclog_count: arrValues.length,
                custrecord_ctc_vclog_date: objDate,
                custrecord_ctc_vclog_type: key.split('_')[0] || '',
                custrecord_ctc_vclog_vendorconfig: arrValues.map((a) => a.vendorConfig)[0] || '',
                //custrecord_ctc_vclog_transaction: arrValues.map((a) => a.transaction)[0] || '',
                custrecord_ctc_vclog_amount: '',
                custrecord_ctc_vclog_key: key
            };
            for (let fieldIdKey in objFieldValues) {
                let fieldValue = objFieldValues[fieldIdKey];
                if (!Helper.isEmpty(fieldValue)) {
                    objRec.setValue({
                        fieldId: fieldIdKey,
                        value: fieldValue
                    });
                }
            }
            let recId = objRec.save();
            log.audit('Success', `Successfully added var connect summary log. ID:${recId}`);
        },

        getVendorName: (poId) => {
            var logTitle = 'Helper::getVendorName';
            var vendorInfo = {};

            /// MAPPING ///
            var XML_VENDOR = {
                TECH_DATA: { id: '1', name: 'TechData', entry: 'techdata_api' },
                INGRAM_MICRO: { id: '2', name: 'IngramMicro', entry: 'ingram_api' },
                SYNNEX: { id: '3', name: 'Synnex', entry: 'synnex_sftp' },
                DandH: { id: '4', name: 'D&H', entry: 'dh_sftp' },
                AVNET: { id: '5', name: 'AVNet', entry: '' },
                WESTCON: { id: '6', name: 'WestCon', entry: '' },
                ARROW: { id: '7', name: 'Arrow', entry: 'arrow_api' },
                DELL: { id: '8', name: 'Dell', entry: '' },
                SYNNEX_API: { id: '9', name: 'Synnex', entry: 'synnex_api' },
                INGRAM_MICRO_API: { id: '10', name: 'IngramMicro', entry: '' },
                INGRAM_MICRO_V_ONE: { id: '11', name: 'IngramMicro', entry: '' },
                TECH_DATA_API: { id: '12', name: 'TechData', entry: '' },
                JENNE: { id: '13', name: 'Jenne', entry: 'jenne_api' },
                SCANSOURCE: { id: '14', name: 'ScanSource', entry: 'scansource_api' },
                WEFI: { id: '16', name: 'WEFI', entry: 'wefi_api' }
            };

            // fetch the POs' vendor
            var poData = Helper.flatLookup({
                type: ns_record.Type.PURCHASE_ORDER,
                id: poId,
                columns: ['entity', 'tranid', 'vendor.custentity_vc_bill_config']
            });
            log.audit(logTitle, 'PO Data >> ' + JSON.stringify(poData));

            /// BILL Config Data
            if (
                poData['vendor.custentity_vc_bill_config'] &&
                poData['vendor.custentity_vc_bill_config'].value
            ) {
                vendorInfo.BillConfig = poData['vendor.custentity_vc_bill_config'];

                var billConfigData = Helper.flatLookup({
                    type: 'customrecord_vc_bill_vendor_config',
                    id: vendorInfo.BillConfig.value,
                    columns: ['custrecord_vc_bc_entry']
                });

                if (billConfigData && billConfigData.custrecord_vc_bc_entry) {
                    vendorInfo.BillConfig.entry = billConfigData.custrecord_vc_bc_entry;
                }
            }

            var vendorConfigSearch = ns_search.create({
                type: 'customrecord_ctc_vc_vendor_config',
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['custrecord_ctc_vc_vendor', 'anyof', poData.entity.value]
                ],
                columns: ['custrecord_ctc_vc_xml_vendor', 'name']
            });

            vendorConfigSearch.run().each((searchRow) => {
                vendorInfo.OrderStatus = {
                    value: searchRow.getValue({ name: 'custrecord_ctc_vc_xml_vendor' }),
                    text: searchRow.getText({ name: 'custrecord_ctc_vc_xml_vendor' })
                };
            });
            log.audit(logTitle, '>> vendorInfo: ' + JSON.stringify(vendorInfo));

            // look for the vendor name
            for (var vendorName in XML_VENDOR) {
                if (
                    vendorInfo.OrderStatus &&
                    vendorInfo.OrderStatus.value &&
                    vendorInfo.OrderStatus.value == XML_VENDOR[vendorName].id
                ) {
                    vendorInfo.OrderStatus.vendorName = XML_VENDOR[vendorName].name;
                }

                if (
                    vendorInfo.BillConfig &&
                    vendorInfo.BillConfig.entry &&
                    XML_VENDOR[vendorName].entry &&
                    vendorInfo.BillConfig.entry == XML_VENDOR[vendorName].entry
                ) {
                    vendorInfo.BillConfig.vendorName = XML_VENDOR[vendorName].name;
                }
            }

            log.audit(logTitle, '>> vendorInfo: ' + JSON.stringify(vendorInfo));

            return vendorInfo.OrderStatus && vendorInfo.OrderStatus.vendorName
                ? vendorInfo.OrderStatus.vendorName
                : vendorInfo.BillConfig && vendorInfo.BillConfig.vendorName
                ? vendorInfo.BillConfig.vendorName
                : null;
        },
        getVendorConfig: (poId) => {
            if (Helper.isEmpty(poId)) {
                return;
            }
            let objVcSearch = ns_search.create({
                type: 'purchaseorder',
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['internalid', 'anyof', poId],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: [
                    ns_search.createColumn({
                        name: 'custentity_vc_bill_config',
                        join: 'vendor'
                    })
                ]
            });

            let resultSet = objVcSearch.run();
            let arrResult = resultSet.getRange({ start: 0, end: 1 });

            if (Array.isArray(arrResult) && typeof arrResult[0] !== 'undefined') {
                return arrResult[0].getText({
                    name: 'custentity_vc_bill_config',
                    join: 'vendor'
                });
            }
        },

        flatLookup: (option) => {
            var arrData = null,
                arrResults = null;

            arrResults = ns_search.lookupFields(option);
            if (arrResults) {
                arrData = {};
                for (var fld in arrResults) {
                    arrData[fld] = util.isArray(arrResults[fld])
                        ? arrResults[fld][0]
                        : arrResults[fld];
                }
            }
            return arrData;
        },
        isJsonParsable: (stValue) => {
            try {
                JSON.parse(stValue);
                return true;
            } catch (error) {
                return false;
            }
        },
        isEmpty: (stValue) => {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isString(stValue) && stValue.trim() === '') ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (let k in v) return false;
                        return true;
                    })(stValue))
            );
        },

        getScriptParameters: () => {
            var stLogTitle = 'getScriptParameters';
            var parametersMap = {};
            var scriptContext = ns_runtime.getCurrentScript();
            var obj;
            var value;
            var optional;
            var id;
            var arrMissingParams = [];

            for (let key in SCRIPT_PARAMETER_NAMES) {
                if (SCRIPT_PARAMETER_NAMES.hasOwnProperty(key)) {
                    obj = SCRIPT_PARAMETER_NAMES[key];
                    if (typeof obj === 'string') {
                        value = scriptContext.getParameter(obj);
                    } else {
                        id = obj.id;
                        optional = obj.optional;
                        value = scriptContext.getParameter(id);
                    }
                    if (value || value === false || value === 0) {
                        parametersMap[key] = value;
                    } else if (!optional) {
                        arrMissingParams.push(key + '[' + id + ']');
                    }
                }
            }

            if (arrMissingParams && arrMissingParams.length) {
                var objError = {};
                objError.name = 'Missing Script Parameter Values';
                objError.message =
                    'The following script parameters are empty: ' + arrMissingParams.join(', ');
                objError = ns_error.create(objError);
                for (let key in parametersMap) {
                    if (parametersMap.hasOwnProperty(key)) {
                        objError[key] = parametersMap[key];
                    }
                }
                throw objError;
            }
            log.audit(stLogTitle, parametersMap);
            return parametersMap;
        },
        alphaNumOnly: (stValue) => {
            let stReturn = '';
            if (!Helper.isEmpty(stValue)) {
                stReturn = stValue.replace(/[^a-zA-Z0-9]/g, '');
            }
            return stReturn;
        },
        convertDate: (dateVal) => {
            let returnVal = '';
            if (dateVal) {
                var dateObj = ns_format.parse({ value: dateVal, type: ns_format.Type.DATETIME });
                returnVal = ns_format.format({
                    value: dateObj,
                    type: ns_format.Type.DATE
                });
            }
            return returnVal;
        },
        getIdFromBody: (bodyLog) => {
            let stReturn = '';
            let match = bodyLog.match(/\((\d+)\)/);
            if (match) {
                stReturn = match[1];
            }
            return stReturn;
        },
        getExistingLogSummaryId: (stKey) => {
            if (Helper.isEmpty(stKey)) {
                return;
            }
            let objLogSummarySearch = ns_search.create({
                type: 'customrecord_ctc_vcsp_log_summary',
                filters: [['custrecord_ctc_vclog_key', 'is', stKey]],
                columns: ['internalid']
            });
            let resultSet = objLogSummarySearch.run();
            let arrResult = resultSet.getRange({ start: 0, end: 1 });
            if (Array.isArray(arrResult) && typeof arrResult[0] !== 'undefined') {
                return arrResult[0].getValue('internalid');
            }
        },
        loadVCLogValues: (objValues) => {
            var values = {};

            for (var fld in VCLOG_REC.FIELD) {
                values[fld] = objValues[VCLOG_REC.FIELD[fld]] || null;
            }
            return values;
        }
    };

    const handleErrorInStage = (stage, summary) => {
        let errorMsg = [];
        summary.errors.iterator().each(function (key, value) {
            let msg = 'SCRIPT FAILURE: ' + key + '. Error was:' + JSON.parse(value).message;
            errorMsg.push(msg);
            return true;
        });
        if (errorMsg.length > 0) {
            log.error(stage, JSON.stringify(errorMsg));
        }
    };

    const logErrorIfAny = (summary) => {
        let inputSummary = summary.inputSummary;
        let mapSummary = summary.mapSummary;
        let reduceSummary = summary.reduceSummary;
        //get input data error
        if (inputSummary.error) {
            let e = ns_error.create({
                name: 'Error on Get Input Data',
                message: inputSummary.error
            });
            log.error('Input Data', e.message);
        }
        handleErrorInStage('map', mapSummary);
        handleErrorInStage('reduce', reduceSummary);
    };

    var EntryPoint = {
        getInputData: () => {
            // let objParams = Helper.getScriptParameters();
            return ns_search.load({ id: 2877 });
        },
        map: (context) => {
            var logTitle = 'MAP';
            log.debug(logTitle, context);

            let searchValue = JSON.parse(context.value);
            let searchValues = searchValue.values;

            var vcLogValues = {};

            for (var logField in VCLOG_REC.FIELD) {
                vcLogValues[logField] = searchValues[VCLOG_REC.FIELD[logField]] || null;

                if (util.isArray(vcLogValues[logField])) {
                    vcLogValues[logField] = vcLogValues[logField].shift();
                }
            }
            vcLogValues.DATE = Helper.convertDate(vcLogValues.DATE);

            if (vcLogValues.TRANSACTION && vcLogValues.TRANSACTION.value) {
                vcLogValues.VENDOR = Helper.getVendorName(vcLogValues.TRANSACTION.value);
            }
            log.debug(logTitle, 'Log Values: ' + JSON.stringify(vcLogValues));

            // loop into our mapped logparser //
            let objWrite = null;
            VCLOG_MAPPING.forEach((fnVCLogAction) => {
                let result = fnVCLogAction.call(null, vcLogValues, searchValues);
                if (result) objWrite = result;
                return true;
            });

            if (!Helper.isEmpty(objWrite)) {
                context.write(objWrite);
            }

            return true;
        },
        // reduce: (context) => {
        //     log.debug('context reduce', context);

        //     let arrValues = context.values;
        //     arrValues = arrValues.map(JSON.parse);

        //     if (!Helper.isEmpty(arrValues) && Array.isArray(arrValues)) {
        //         createLogSummary(arrValues, context.key);
        //     }

        //     log.debug('SCRIPT_LOGS', SCRIPT_LOGS);
        // },
        summarize: (summary) => {
            let type = summary.toString();
            log.audit(
                '[Summarize] ' + type,
                'Usage Consumed: ' +
                    summary.usage +
                    ' | Number of Queues: ' +
                    summary.concurrency +
                    ' | Number of Yields: ' +
                    summary.yields
            );
            summary.output.iterator().each(function (key, value) {
                return true;
            });
            logErrorIfAny(summary);
        }
    };

    var searchResults = EntryPoint.getInputData(),
        arrReduceData = {};

    searchResults.run().each(function (result, idx) {
        EntryPoint.map.call(this, { key: idx, value: JSON.stringify(result) });
        return true;
    });

    return true;
});

// require(['N/search', 'N/record', 'N/error', 'N/runtime', 'N/format'], function (
//     ns_search,
//     ns_record,
//     ns_error,
//     ns_runtime,
//     ns_format
// ) {
//     var searchResults = EntryPoint.getInputData(),
//         arrReduceData = {};

//     searchResults.run().each(function (result, idx) {
//         EntryPoint.map.call(this, { key: idx, value: JSON.stringify(result) });
//         return true;
//     });

//     return true;
