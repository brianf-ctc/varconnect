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
 * @NScriptType Restlet
 */
define([
    'N/record',
    'N/search',
    'N/format',
    './Libraries/CTC_VC_Lib_BillProcess',
    './../CTC_VC2_Constants',
    './../CTC_VC2_Lib_Utils',
    './../CTC_VC2_Lib_Record',
    './../Services/ctc_svclib_configlib',
    './Libraries/moment'
], function (
    ns_record,
    ns_search,
    ns_format,
    vc_billprocess,
    vc2_constant,
    vc2_util,
    vc2_recordlib,
    vcs_configLib,
    moment
) {
    var LogTitle = 'VC BILL CREATE RL',
        VCLOG_APPNAME = 'VAR Connect | Process Bill',
        Current = { MainCFG: {} },
        LogPrefix = '',
        BILL_CREATOR = vc2_constant.Bill_Creator;

    var RESTLET = {
        post: function (context) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            vc2_constant.LOG_APPLICATION = VCLOG_APPNAME;

            try {
                vc2_util.log(logTitle, '###########################################');
                vc2_util.log(logTitle, '### Request: ', context);

                util.extend(Current, {
                    poId: context.PO_LINK,
                    billFileId: context.ID,
                    billInAdvance: context.billInAdvance || false,
                    processVariance: context.PROC_VARIANCE || false
                });

                if (!Current.poId) {
                    returnObj.details = ' PO ID:' + Current.poId + ' is missing or inactive.';
                    throw BILL_CREATOR.Code.MISSING_PO;
                }
                LogPrefix = '[purchaseorder:' + Current.poId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                // Load the PO Record
                var recPO = vc2_recordlib.load({ type: 'purchaseorder', id: Current.poId });
                var poColumns = [
                    'tranid',
                    'entity',
                    'taxtotal',
                    'tax2total',
                    'status',
                    'statusRef'
                ];
                if (vc2_constant.GLOBAL.ENABLE_SUBSIDIARIES) {
                    poColumns.push('subsidiary');
                }
                Current.PO_DATA = vc2_recordlib.extractValues({
                    record: recPO,
                    fields: poColumns
                });

                Current.MainCFG = vcs_configLib.mainConfig();
                Current.BillCFG = vcs_configLib.billVendorConfig({ poId: Current.poId });
                Current.OrderCFG = vcs_configLib.orderVendorConfig({ poId: Current.poId });

                /// PROCESS THE BILL  =================
                var BillData = vc_billprocess.preprocessBill({
                    recOrder: recPO,
                    billFileId: Current.billFileId
                });

                if (BillData.VendorData && BillData.VendorData.hasOwnProperty('ignoreVariance')) {
                    Current.ignoreVariance = !!vc2_util.inArray(
                        BillData.VendorData.ignoreVariance,
                        ['T', 't', true]
                    );
                }
                /// =====================================

                /// FIND EXISTING BILLS =================
                vc2_util.log(logTitle, ' // Checking for existing bills...');

                var arrExistingBills = Helper.getExistingBill({
                    entity: Current.PO_DATA.entity,
                    invoiceNo: BillData.VendorData.invoice
                });

                /// BILL ALREADY EXISTS //////////////////////
                if (arrExistingBills && arrExistingBills.length) {
                    var billRec = ns_record.load({
                        type: 'vendorbill',
                        id: arrExistingBills[0]
                    });

                    returnObj = JSON.parse(JSON.stringify(billRec));
                    returnObj.existingBills = JSON.stringify(arrExistingBills);
                    returnObj.details =
                        'Linked to existing bill (id:' + arrExistingBills[0] + ' ). ';
                    util.extend(returnObj, BILL_CREATOR.Code.EXISTING_BILLS);

                    return returnObj;
                }
                /// =====================================

                /// STATUS CHECK ========================
                vc2_util.log(logTitle, '/// PO status is: ', BillData.OrderData.status);
                if (BillData.OrderData.isBillable || Current.billInAdvance) {
                    // continue processing
                    vc2_util.log(logTitle, '>> PO is ready for billing. ');
                } else {
                    return util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                }
                /// =====================================

                /// =====================================
                vc2_util.log(logTitle, '/// Current: ', Current);
                vc2_util.log(
                    logTitle,
                    '/// BillData (params): ',
                    vc2_util.extractValues({
                        source: BillData,
                        params: [
                            'AllowBill',
                            'AllowVariance',
                            'HasErrors',
                            'HasVariance',
                            'VarianceList',
                            'ErrorList',
                            'Error',
                            'Total',
                            'BillLines',
                            'Charges'
                        ]
                    })
                );

                /// =====================================

                vc2_util.log(logTitle, '>> Settings: ', {
                    AllowBill: BillData.AllowBill,
                    processVariance: Current.processVariance,
                    ignoreVariance: Current.ignoreVariance,
                    hasVariance: BillData.HasVariance,
                    notAllowed: !BillData.AllowBill && !Current.processVariance
                });
                /// VALIDATE BEFORE BILL CREATE =========
                if (!BillData.AllowBill && !Current.processVariance) {
                    if (BillData.HasVariance && !Current.ignoreVariance) {
                        vc2_util.log(logTitle, '>> Has Variances - ', BillData.VarianceList);

                        return util.extend(
                            util.extend(returnObj, {
                                details: BillData.VarianceList.join(', ')
                            }),
                            BILL_CREATOR.Code.HAS_VARIANCE
                        );
                    }

                    if (BillData.HasErrors) {
                        /// just get the first error
                        var errorCode = BillData.ErrorList.shift();
                        return util.extend(
                            returnObj,
                            BILL_CREATOR.Code[errorCode] || { msg: 'Unexpected error' }
                        );
                    }
                }
                /// =====================================

                /// START BILL CREATE  ==================
                // Get sales order details
                vc2_util.log(logTitle, '**** START: Vendor Bill Creation *****');
                Current.SO_DATA = Helper.getSalesOrderDetails({ poId: Current.poId });
                vc2_util.log(logTitle, '... SO Data: ', Current.SO_DATA);

                /// TRANSFORM TO VENDOR BILL
                var transformOption = {
                    fromType: 'purchaseorder',
                    fromId: Current.poId,
                    toType: 'vendorbill',
                    isDynamic: true
                };

                if (Current.MainCFG.defaultBillForm) {
                    transformOption.customform = Current.MainCFG.defaultBillForm;
                }
                vc2_util.log(logTitle, '... Transform: ', transformOption);

                Current.POBILL_REC = vc2_recordlib.transform(transformOption);

                if (Current.MainCFG.defaultBillForm) {
                    Current.POBILL_REC.setValue({
                        fieldId: 'customform',
                        value: Current.MainCFG.defaultBillForm
                    });
                }

                /// SET POSTING PERIOD
                var currentPostingPeriod = Current.POBILL_REC.getValue({
                    fieldId: 'postingperiod'
                });
                vc2_util.log(logTitle, '>> posting period: ', currentPostingPeriod);
                Current.POBILL_REC.setValue({
                    fieldId: 'trandate',
                    value: ns_format.parse({
                        value: moment(BillData.VendorData.date).toDate(),
                        type: ns_format.Type.DATE
                    })
                });

                /// SET DUE DATE
                if (BillData.VendorData.duedate) {
                    Current.POBILL_REC.setValue({
                        fieldId: 'duedate',
                        value: ns_format.parse({
                            value: moment(BillData.VendorData.duedate).toDate(),
                            type: ns_format.Type.DATE
                        })
                    });
                }

                /// SET POSTING PERIOD
                var isPeriodLocked = Helper.isPeriodLocked({ recordBill: Current.POBILL_REC });
                if (isPeriodLocked) {
                    // set to original period
                    Current.POBILL_REC.setValue({
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }

                /// Set INVOICE NAME
                Current.POBILL_REC.setValue({
                    fieldId: 'tranid',
                    value: BillData.VendorData.invoice
                });

                /// ADD THE LINES =======================
                var lineCount = Current.POBILL_REC.getLineCount({
                    sublistId: 'item'
                });

                vc2_util.log(logTitle, 'Matching vb-to-payload lines...line count: ', {
                    vbLines: lineCount,
                    payloadLines: BillData.VendorData.lines.length
                });

                vc_billprocess.processBillLines({
                    record: Current.POBILL_REC,
                    processVariance: Current.processVariance,
                    ignoreVariance: Current.ignoreVariance,
                    orderData: Current.SO_DATA
                });

                if (BillData.HasErrors) {
                    vc2_util.log(
                        logTitle,
                        '## Errors ## ',
                        vc2_util.extractValues({
                            source: BillData,
                            params: ['Error', 'HasErrors', 'HasVariannce', 'VarianceList']
                        })
                    );
                    for (var errorCode in BillData.Error) {
                        util.extend(returnObj, BILL_CREATOR.Code[errorCode]);
                        util.extend(returnObj, {
                            details: util.isArray(BillData.Error[errorCode])
                                ? BillData.Error[errorCode].join(', ')
                                : BillData.Error[errorCode]
                        });
                        return returnObj;
                    }
                }

                /// SAVING THE BILL =====================
                Current.POBILL_REC.setValue({
                    fieldId: 'approvalstatus',
                    value: Current.MainCFG.defaultVendorBillStatus || 1
                }); // defaults to pending approval

                // Bill Save is disabled
                if (Current.MainCFG.isBillCreationDisabled) {
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATE_DISABLED);
                    return returnObj;
                }

                // set the createdby field
                Current.POBILL_REC.setValue({
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                vc2_util.log(logTitle, '**** SAVING Bill Record *** ');

                var newRecordId = Current.POBILL_REC.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (newRecordId) {
                    vc2_util.log(logTitle, '... Bill Create succesfull - ', newRecordId);

                    returnObj = JSON.parse(JSON.stringify(Current.POBILL_REC));
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATED);

                    returnObj.details =
                        'Linked to vendor bill ' +
                        JSON.stringify({
                            id: newRecordId,
                            name: BillData.VendorData.invoice
                        });
                } else {
                    vc2_util.log(logTitle, '// bill creation fail...', [
                        Current.PO_DATA.tranid,
                        BillData.VendorData.invoice
                    ]);
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_NOT_CREATED);
                }

                /// =====================================

                return returnObj;
            } catch (error) {
                vc2_util.log(logTitle, '## ERROR ## ', error);
                returnObj.msg = error.msg || vc2_util.extractError(error);
                returnObj.details = returnObj.details || vc2_util.extractError(error);
                returnObj.status = error.status || BILL_CREATOR.Status.ERROR;
                returnObj.isError = true;
                if (error.logstatus) returnObj.logstatus = error.logstatus;
                returnObj.msg = [
                    returnObj.msg,
                    returnObj.details != returnObj.msg ? returnObj.details : ''
                ].join(' ');

                vc2_util.log(logTitle, '## ERROR ## ', returnObj);
            } finally {
                if (returnObj.logstatus) {
                    vc2_util.log(logTitle, '**** vc log (finally) ***', returnObj);
                    vc2_util.vcLog({
                        title: 'Process Bill' + (returnObj.isError ? '| Error' : ''),
                        message: returnObj.msg,
                        logStatus: returnObj.logstatus,
                        recordId: Current.poId
                    });
                }

                vc2_util.log(logTitle, '## EXIT SCRIPT ## ', returnObj);
            }

            return returnObj;
        }
    };

    var Helper = {
        getExistingBill: function (option) {
            var logTitle = [LogTitle, 'getExistingBill'].join('::'),
                returnValue;
            option = option || {};
            var arrExistingBills = [];

            var vendorbillSearchObj = ns_search.create({
                type: 'vendorbill',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['mainname', 'anyof', option.entity],
                    'AND',
                    ['numbertext', 'is', option.invoiceNo],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid']
            });

            vendorbillSearchObj.run().each(function (result) {
                arrExistingBills.push(result.getValue('internalid'));
                return true;
            });

            // vc2_util.log(logTitle, '>> Existing Bill: ', arrExistingBills || '-none-');
            returnValue = arrExistingBills;

            return returnValue;
        },
        getSalesOrderDetails: function (option) {
            var logTitle = [LogTitle, 'getSalesOrderDetails'].join('::'),
                returnValue;
            option = option || {};
            var poId = option.poId;
            if (poId) {
                var poDetails = ns_search.lookupFields({
                    type: 'transaction',
                    id: poId,
                    columns: ['createdfrom.entity']
                });
                var multiselectFields = ['createdfrom.entity'];
                var soDetails = {};
                for (var field in poDetails) {
                    var soFieldName = field;
                    if (field.indexOf('createdfrom.') == 0) {
                        soFieldName = field.substr(12);
                    }
                    if (
                        multiselectFields.indexOf(field) >= 0 &&
                        poDetails[field] &&
                        poDetails[field][0] &&
                        poDetails[field][0].value
                    ) {
                        soDetails[soFieldName] = poDetails[field][0].value;
                    } else {
                        soDetails[soFieldName] = poDetails[field];
                    }
                }

                vc2_util.log(logTitle, '... PO Details: ', poDetails);
                vc2_util.log(logTitle, '... SO Details: ', soDetails);

                returnValue = soDetails;
            }
            return returnValue;
        },
        isPeriodLocked: function (option) {
            var logTitle = [LogTitle, 'isPeriodLocked'].join('::'),
                returnValue;
            option = option || {};

            var recBill = option.recordBill;
            var isLocked = false;
            var periodValues = ns_search.lookupFields({
                type: ns_search.Type.ACCOUNTING_PERIOD,
                id: recBill.getValue({ fieldId: 'postingperiod' }),
                columns: ['aplocked', 'alllocked', 'closed']
            });

            isLocked = periodValues.aplocked || periodValues.alllocked || periodValues.closed;
            vc2_util.log(logTitle, '>> isPeriodLocked? ', isLocked);
            returnValue = isLocked;

            return returnValue;
        },
        roundOff: function (value) {
            var flValue = parseFloat(value || '0');
            if (!flValue || isNaN(flValue)) return 0;

            return Math.round(flValue * 100) / 100;
        }
        // loadBillingConfig: function () {
        //     var MainCFG = vc_mainCfg.getMainConfiguration();
        //     if (!MainCFG) {
        //         log.error('No Configuration available');
        //         throw new Error('No Configuration available');
        //     }
        //     return {
        //         defaultBillForm: MainCFG.defaultBillForm,
        //         billDefaultStatus: MainCFG.defaultVendorBillStatus,
        //         allowedThreshold: MainCFG.allowedVarianceAmountThreshold,
        //         allowAdjustLine: MainCFG.allowAdjustLine,

        //         applyTax: MainCFG.isVarianceOnTax || false,
        //         taxItem: MainCFG.defaultTaxItem,
        //         taxItem2: MainCFG.defaultTaxItem2,
        //         applyShip: MainCFG.isVarianceOnShipping || false,
        //         shipItem: MainCFG.defaultShipItem,
        //         applyOther: MainCFG.isVarianceOnOther || false,
        //         otherItem: MainCFG.defaultOtherItem,

        //         dontSaveBill: MainCFG.isBillCreationDisabled || false,

        //         autoprocPriceVar: MainCFG.autoprocPriceVar || false,
        //         autoprocTaxVar: MainCFG.autoprocTaxVar || false,
        //         autoprocShipVar: MainCFG.autoprocShipVar || false,
        //         autoprocOtherVar: MainCFG.autoprocOtherVar || false
        //     };
        // },
        // loadVendorConfig: function (option) {
        //     var logTitle = [LogTitle, 'loadVendorConfig'].join('::'),
        //         returnValue;
        //     var entityId = option.entity;
        //     var BILLCREATE_CFG = vc2_constant.RECORD.BILLCREATE_CONFIG;

        //     try {
        //         var searchOption = {
        //             type: 'vendor',
        //             filters: [['internalid', 'anyof', entityId]],
        //             columns: []
        //         };

        //         for (var field in BILLCREATE_CFG.FIELD) {
        //             searchOption.columns.push(
        //                 ns_search.createColumn({
        //                     name: BILLCREATE_CFG.FIELD[field],
        //                     join: vc2_constant.FIELD.ENTITY.BILLCONFIG
        //                 })
        //             );
        //         }

        //         var searchObj = ns_search.create(searchOption);
        //         if (!searchObj.runPaged().count) throw 'No config available';

        //         returnValue = {};
        //         searchObj.run().each(function (row) {
        //             for (var field in BILLCREATE_CFG.FIELD) {
        //                 returnValue[field] = row.getValue({
        //                     name: BILLCREATE_CFG.FIELD[field],
        //                     join: vc2_constant.FIELD.ENTITY.BILLCONFIG
        //                 });
        //             }
        //             return true;
        //         });
        //     } catch (error) {
        //         vc2_util.logError(logTitle, error);
        //         returnValue = false;
        //     }

        //     return returnValue;
        // },
        // loadOrderStatusVendorConfig: function (option) {
        //     var logTitle = [LogTitle, 'loadOrderStatusVendorConfig'].join('::');

        //     var vendor = option.vendor,
        //         vendorName = option.vendorName,
        //         subsidiary = option.subsidiary,
        //         BillCFG = vc_vendorcfg.getVendorConfiguration({
        //             vendor: vendor,
        //             subsidiary: subsidiary
        //         });

        //     if (!BillCFG) {
        //         vc2_util.log(
        //             logTitle,
        //             'No vendor configuration setup - [vendor:' + vendor + '] ' + vendorName
        //         );
        //     }

        //     return BillCFG;
        // }
    };

    return RESTLET;
});
