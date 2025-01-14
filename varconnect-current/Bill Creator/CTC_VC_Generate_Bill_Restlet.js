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
        BILLPROC,
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
                    processVariance: context.PROC_VARIANCE || false,
                    poVendor: context.entity,
                    invoiceNo: context.invoiceNo
                });

                if (!Current.poId) {
                    returnObj.details = ' PO ID:' + Current.poId + ' is missing or inactive.';
                    throw BILL_CREATOR.Code.MISSING_PO;
                }
                LogPrefix = '[purchaseorder:' + Current.poId + '] ';
                vc2_util.LogPrefix = LogPrefix;

                /// FIND EXISTING BILLS =================
                vc2_util.log(logTitle, '// Checking for existing bills...');
                var arrExistingBills = vc_billprocess.searchExistingBills({
                    entity: Current.poVendor,
                    invoiceNo: Current.invoiceNo
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

                /// PRE PROCESS THE BILL ////
                BILLPROC = vc_billprocess.preprocessBill({
                    billFileId: Current.billFileId,
                    poId: Current.poId
                });
                /// PRE PROCESS THE BILL ////

                // Load the PO Record
                Current.PO_REC = BILLPROC.PO.REC;
                Current.PO_DATA = BILLPROC.PO.DATA;
                BILLPROC.CFG.MainCFG = BILLPROC.CFG.MainCFG;
                Current.BillCFG = BILLPROC.CFG.BillCFG;
                Current.OrderCFG = BILLPROC.CFG.OrderCFG;
                Current.ignoreVariance = BILLPROC.STATUS.IgnoreVariance;

                /// CHECK FOR ERRORS  ///
                if (
                    BILLPROC.STATUS.HasErrors &&
                    !(BILLPROC.STATUS.AllowVariance || BILLPROC.STATUS.IgnoreVariance)
                ) {
                    vc2_util.log(logTitle, '-- Errors Detected: ', BILLPROC.ErrorList);

                    var errorCode = BILLPROC.ErrorList.shift();
                    return util.extend(
                        returnObj,
                        BILL_CREATOR.Code[errorCode] || { msg: 'Unexpected error' }
                    );
                }

                /// CHECK FOR VARIANCE  ///
                if (
                    BILLPROC.HasVariance &&
                    !(
                        BILLPROC.STATUS.BILLFILE.AllowVariance ||
                        BILLPROC.STATUS.BILLFILE.IgnoreVariance
                    )
                ) {
                    var errorReport = vc_billprocess.reportError();
                    var errorMsg = [];

                    if (errorReport.errors) errorMsg.pushg(errorReport.errors.join(', '));
                    if (errorReport.variances) errorMsg.pushg(errorReport.variances.join(', '));

                    vc2_util.log(logTitle, '-- Error Detected: ', errorReport);

                    return util.extend(
                        util.extend(returnObj, {
                            details: errorMsg.join('\n')
                        }),
                        BILL_CREATOR.Code.HAS_VARIANCE
                    );
                }
                // /// STATUS CHECK ========================
                if (
                    !BILLPROC.STATUS.AllowToBill &&
                    !Current.billInAdvance &&
                    !(BILLPROC.STATUS.AllowVariance || BILLPROC.STATUS.IgnoreVariance)
                ) {
                    return util.extend(returnObj, BILL_CREATOR.Code.NOT_BILLABLE);
                }

                /// PROCESS THE BILL  =================
                vc2_util.log(logTitle, '/// BILL PROCESS STATUS', BILLPROC.STATUS);
                vc2_util.log(logTitle, '/// PO DATA', BILLPROC.PO.DATA);

                /// =====================================

                /// START BILL CREATE  ==================
                // Get sales order details
                vc2_util.log(logTitle, '**** START: Vendor Bill Creation *****');

                Current.SO_DATA = Helper.getSalesOrderDetails({ poId: BILLPROC.PO.ID });
                vc2_util.log(logTitle, '... SO Data: ', Current.SO_DATA);

                /// SET POSTING PERIOD
                var currentPostingPeriod = BILLPROC.BILL.REC.getValue({ fieldId: 'postingperiod' });
                vc2_util.log(logTitle, '>> posting period: ', currentPostingPeriod);

                // vc2_util.dumpLog(logTitle, BILLPROC.BILLFILE.JSON, 'BILLFILE(JSON): ');
                // vc2_util.dumpLog(logTitle, BILLPROC.BILLFILE.DATA, 'BILLFILE(DATA): ');
                /// Set INVOICE NAME
                vc2_recordlib.setRecordValue({
                    record: BILLPROC.BILL.REC,
                    fieldId: 'tranid',
                    value: BILLPROC.BILLFILE.JSON.invoice
                });

                /// SET the trandate
                vc2_recordlib.setRecordValue({
                    record: BILLPROC.BILL.REC,
                    fieldId: 'trandate',
                    value: ns_format.parse({
                        value: moment(BILLPROC.BILLFILE.JSON.date).toDate(),
                        type: ns_format.Type.DATE
                    })
                });

                /// SET DUE DATE
                if (BILLPROC.BILLFILE.DATA.duedate) {
                    vc2_recordlib.setRecordValue({
                        record: BILLPROC.BILL.REC,
                        fieldId: 'duedate',
                        value: ns_format.parse({
                            value: moment(BILLPROC.BILLFILE.JSON.duedate).toDate(),
                            type: ns_format.Type.DATE
                        })
                    });
                }

                /// SET POSTING PERIOD
                var isPeriodLocked = Helper.isPeriodLocked({ recordBill: BILLPROC.BILL.REC });
                if (isPeriodLocked) {
                    // set to original period
                    vc2_recordlib.setRecordValue({
                        record: BILLPROC.BILL.REC,
                        fieldId: 'postingperiod',
                        value: currentPostingPeriod
                    });
                }

                /// SAVING THE BILL =====================
                vc2_recordlib.setRecordValue({
                    record: BILLPROC.BILL.REC,
                    fieldId: 'approvalstatus',
                    value: BILLPROC.CFG.MainCFG.defaultVendorBillStatus || 1
                }); // defaults to pending approval

                // Bill Save is disabled
                if (BILLPROC.CFG.MainCFG.isBillCreationDisabled) {
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATE_DISABLED);
                    return returnObj;
                }

                // set the createdby field
                vc2_recordlib.setRecordValue({
                    record: BILLPROC.BILL.REC,
                    fieldId: 'custbody_ctc_vc_createdby_vc',
                    value: true
                });

                // run through each bill lines
                var lineItemCount = BILLPROC.BILL.REC.getLineCount({ sublistId: 'item' });
                for (var line = 0; line < lineItemCount; line++) {
                    BILLPROC.BILL.REC.selectLine({ sublistId: 'item', line: line });

                    var lineData = vc2_recordlib.extractLineValues({
                        record: BILLPROC.BILL.REC,
                        line: line,
                        columns: [
                            'item',
                            'quantity',
                            'binitem',
                            'inventorydetailreq',
                            'isserial',
                            'location', 
                            'custcol_ctc_xml_serial_num'
                        ]
                    });
                    vc2_util.log(logTitle, '... Line Data: ', lineData);

                }

                // if (BILLPROC.STATUS.AllowToBill) {
                //     vc_billprocess.addBillLines();
                // }

                vc2_util.log(logTitle, '**** SAVING Bill Record *** ');
                var newRecordId = BILLPROC.BILL.REC.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (newRecordId) {
                    vc2_util.log(logTitle, '... Bill Create succesfull - ', newRecordId);

                    returnObj = JSON.parse(JSON.stringify(BILLPROC.BILL.REC));
                    util.extend(returnObj, BILL_CREATOR.Code.BILL_CREATED);

                    returnObj.details =
                        'Linked to vendor bill ' +
                        JSON.stringify({
                            id: newRecordId,
                            name: BILLPROC.BILLFILE.DATA.invoice
                        });
                } else {
                    vc2_util.log(logTitle, '// bill creation fail...', [
                        Current.PO_DATA.tranid,
                        BILLPROC.BILLFILE.DATA.invoice
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
        }
    };

    return RESTLET;
});
