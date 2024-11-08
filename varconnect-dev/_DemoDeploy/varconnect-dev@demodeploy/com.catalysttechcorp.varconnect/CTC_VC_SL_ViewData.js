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
define([
    'N/record',
    'N/ui/serverWidget',
    'N/ui/message',
    './Services/ctc_svclib_process-v1.js',
    './CTC_VC_Lib_FormHelper',
    './CTC_VC2_Constants',
    './CTC_VC2_Lib_Utils'
], function (ns_record, ns_ui, ns_msg, vcs_processLib, vc_uihelper, vc2_constant, vc2_util) {
    var LogTitle = 'ViewData';

    var ORDERLINE_REC = vc2_constant.RECORD.ORDER_LINE;

    var FORM_DEF = {
        Form: null,
        Fields: {
            HTMLDATA: {
                type: ns_ui.FieldType.INLINEHTML,
                label: 'HTML Content',
                defaultValue: '<br />'
            },
            TEXT: {
                type: ns_ui.FieldType.TEXT,
                label: 'Text F',
                defaultValue: '<br />'
            },
            DISABLED_TEXT: {
                type: ns_ui.FieldType.TEXT,
                label: 'Text Field (Disabled)',
                displayType: ns_ui.FieldDisplayType.DISABLED,
                defaultValue: '<br />'
            },

            VENDOR_DATA: {
                type: ns_ui.FieldType.TEXTAREA,
                label: 'VendorData',
                displayType: ns_ui.FieldDisplayType.DISABLED
            },
            SPACER: {
                type: ns_ui.FieldType.INLINEHTML,
                label: 'Spacer',
                defaultValue: '<br />'
            },
            HEADER: {
                type: ns_ui.FieldType.INLINEHTML,
                label: 'Header',
                defaultValue: ' '
            }
        }
    };

    var VendorDataContent = {
        default: function (content) {
            vc_uihelper.Fields = {
                VENDOR_DATA: util.extend(FORM_DEF.Fields.HTMLDATA, {
                    label: ' ',
                    defaultValue: [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">Vendor Data</a>',
                        '</span></span>',
                        '<textarea cols="100" rows="20" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        JSON.stringify(JSON.parse(content), null, '  '),
                        '</textarea>',
                        '</div>'
                    ].join('')
                })
            };
            vc_uihelper.renderFieldList(['VENDOR_DATA']);
        },
        defaultJSON: function (parsedContent) {
            vc_uihelper.Fields = {
                VENDOR_DATA: util.extend(FORM_DEF.Fields.HTMLDATA, {
                    label: ' ',
                    defaultValue: [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">Vendor Data</a>',
                        '</span></span>',
                        '<textarea cols="100" rows="20" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        JSON.stringify(parsedContent, null, '  '),
                        '</textarea>',
                        '</div>'
                    ].join('')
                })
            };
            vc_uihelper.renderFieldList(['VENDOR_DATA']);
        },
        defaultXML: function (content) {
            vc_uihelper.Fields = {
                VENDOR_DATA: util.extend(FORM_DEF.Fields.HTMLDATA, {
                    label: ' ',
                    defaultValue: [
                        '<div class="uir-field-wrapper uir-long-text" data-field-type="textarea">',
                        '<span class="smallgraytextnolink uir-label">',
                        '<span class="smallgraytextnolink">',
                        '<a class="smallgraytextnolink">Vendor Data</a>',
                        '</span></span>',
                        '<textarea cols="100" rows="20" disabled="true" ',
                        'style="padding: 5px 10px; margin: 5px; border:1px solid #CCC !important; color: #363636 !important;">',
                        content,
                        '</textarea>',
                        '</div>'
                    ].join('')
                })
            };
            vc_uihelper.renderFieldList(['VENDOR_DATA']);
        },
        serviceContractInfo: function (parsedContent) {
            var logTitle = [LogTitle, 'serviceContractInfo'].join('::'),
                returnValue;

            var formFields = {},
                fieldsList = [],
                isStart = true;

            ['contractInfo', 'licenseInfo'].forEach(function (infoName) {
                vc2_util.log(logTitle, '... info: ', [infoName, parsedContent[infoName]]);

                formFields[infoName + '_header'] = vc2_util.extend(FORM_DEF.Fields.HEADER, {
                    breakType: !isStart ? ns_ui.FieldBreakType.STARTCOL : null,
                    defaultValue: '<h3>' + (infoName || '').toUpperCase() + '</h3>'
                });
                fieldsList.push(infoName + '_header');

                for (var infoKey in parsedContent[infoName]) {
                    formFields[infoKey] = {
                        type: ns_ui.FieldType.TEXT,
                        label: infoKey,
                        displayType: ns_ui.FieldDisplayType.INLINE,
                        defaultValue: parsedContent[infoName][infoKey] || '-empty-'
                    };
                    fieldsList.push(infoKey);
                }

                isStart = false;
            });

            vc2_util.log(logTitle, '... fields: ', [formFields]);
            vc2_util.log(logTitle, '... list: ', [fieldsList]);

            vc_uihelper.setUI({ fields: formFields });
            vc_uihelper.renderFieldList(fieldsList);
        }
    };

    var PAGE = {
        Form: null,
        Param: {},
        vendorData: {
            onGET: function (scriptContext) {
                var logTitle = [LogTitle, 'VendorData'].join('::'),
                    returnValue;

                FORM_DEF.Form = ns_ui.createForm({ title: 'VENDOR DATA', hideNavBar: true });
                vc_uihelper.setUI({ form: FORM_DEF.Form });

                var orderLineId = scriptContext.request.parameters.orderlineid;
                if (!orderLineId) throw 'Missing order line data';

                var recOrderLine = ns_record.load({
                    type: ORDERLINE_REC.ID,
                    id: orderLineId
                });

                var content = recOrderLine.getValue({ fieldId: ORDERLINE_REC.FIELD.LINE_DATA }),
                    parsedContent = vc2_util.safeParse(content);

                vc2_util.log(logTitle, '// content', [content, parsedContent]);

                if (!parsedContent) {
                    VendorDataContent.default(content);
                } else {
                    if (!vc2_util.isEmpty(parsedContent.serviceContractInfo)) {
                        VendorDataContent.serviceContractInfo(parsedContent.serviceContractInfo);
                    } else {
                        VendorDataContent.defaultJSON(parsedContent);
                    }
                }
                scriptContext.response.writePage(FORM_DEF.Form);
                return returnValue;
            },
            onPOST: function () {}
        },
        orderLines: {
            onGET: function (scriptContext) {
                var logTitle = [LogTitle, 'VendorData'].join('::'),
                    returnValue;

                var ORDLINE_REC = vc2_constant.RECORD.ORDER_LINE,
                    ORDLINE_FLD = ORDLINE_REC.FIELD;

                var poId = scriptContext.request.parameters.actpoid,
                    orderNum = scriptContext.request.parameters.ordernum,
                    orderKey = scriptContext.request.parameters.orderkey;

                var formFields = {},
                    fieldsList = [];

                var orderLinesArr = vcs_processLib.searchOrderLines({
                        poId: poId,
                        orderNum: orderNum,
                        orderKey: orderKey
                    }),
                    orderNumList = [],
                    orderLinesByOrderNum = {};

                orderLinesArr.forEach(function (orderLine) {
                    var orderNum = orderLine.ORDER_NUM;

                    // vc2_util.log(logTitle, '..', [orderNum, orderLine]);
                    if (!orderLinesByOrderNum[orderNum]) {
                        orderLinesByOrderNum[orderNum] = [orderLine];
                        orderNumList.push(orderNum);
                    } else {
                        orderLinesByOrderNum[orderNum].push(orderLine);
                    }
                    return true;
                });

                vc2_util.log(logTitle, '.. ordNumLIst: ', orderNumList);

                var curOrderNum = orderNum || orderNumList[0],
                    curOrderList = orderLinesByOrderNum[curOrderNum];
                vc2_util.log(logTitle, '.. curOrderNum: ', [curOrderNum, curOrderList]);

                if (!curOrderList || !curOrderList[0]) {
                    curOrderNum = orderNumList[0];
                    curOrderList = orderLinesByOrderNum[curOrderNum];
                }
                curOrderData = curOrderList[0];

                FORM_DEF.Form = ns_ui.createForm({
                    title: 'Order Information: ' + curOrderData.ORDER_NUM,
                    hideNavBar: true
                });
                vc_uihelper.setUI({ form: FORM_DEF.Form });

                ['ORDER_NUM', 'ORDER_STATUS', 'ORDER_DATE', 'SHIPPED_DATE'].forEach(function (
                    orderField
                ) {
                    formFields[orderField] = {
                        type: ns_ui.FieldType.TEXT,
                        label: orderField,
                        displayType: ns_ui.FieldDisplayType.INLINE,
                        defaultValue: curOrderData[orderField]
                    };
                    fieldsList.push(orderField);
                });

                vc_uihelper.setUI({ fields: formFields });
                vc_uihelper.renderFieldList(fieldsList);

                var formSublist = {
                    id: 'orderlines',
                    label: 'Order lines',
                    type: ns_ui.SublistType.LIST,
                    fields: {
                        txnlink: {
                            label: 'PO Num',
                            type: ns_ui.FieldType.SELECT,
                            displayType: ns_ui.FieldDisplayType.INLINE,
                            source: 'transaction'
                        },
                        ordernum: {
                            label: 'OrderNum',
                            type: ns_ui.FieldType.TEXT
                        },

                        lineno: {
                            label: 'Line No',
                            type: ns_ui.FieldType.TEXT
                        },
                        itemname: {
                            label: 'Item Name',
                            type: ns_ui.FieldType.TEXT
                        },
                        sku: {
                            label: 'SKU',
                            type: ns_ui.FieldType.TEXT
                        },
                        itemlink: {
                            label: 'Item Link',
                            type: ns_ui.FieldType.SELECT,
                            source: 'item',
                            displayType: ns_ui.FieldDisplayType.INLINE
                        },
                        quantity: {
                            label: 'Quantity',
                            type: ns_ui.FieldType.INTEGER
                        },
                        linestatus: {
                            label: 'Line Status',
                            type: ns_ui.FieldType.TEXT
                        },
                        orderdate: {
                            label: 'OrdDate',
                            type: ns_ui.FieldType.TEXT
                        },
                        etadate: {
                            label: 'ETA',
                            type: ns_ui.FieldType.TEXT
                        },
                        etddate: {
                            label: 'ETD',
                            type: ns_ui.FieldType.TEXT
                        },
                        carrier: {
                            label: 'Carrier',
                            type: ns_ui.FieldType.TEXT
                        },
                        tracking: {
                            label: 'Tracking',
                            type: ns_ui.FieldType.TEXT
                        },
                        serial: {
                            label: 'Serial',
                            type: ns_ui.FieldType.TEXT
                        }
                    }
                };
                vc_uihelper.setUI({ sublist: formSublist });
                var itemSublist = vc_uihelper.renderSublist(formSublist);

                curOrderList.forEach(function (orderLine, line) {
                    var lineData = {
                        lineno: orderLine.LINE_NO,
                        txnlink: orderLine.TXN_LINK,
                        ordernum: orderLine.ORDER_NUM,
                        itemname: orderLine.ITEM,
                        sku: orderLine.SKU,
                        itemlink: orderLine.ITEM_LINK,
                        quantity: orderLine.QTY,
                        linestatus: orderLine.LINE_STATUS,
                        orderdate: orderLine.ORDER_DATE,
                        etadate: orderLine.ETA_DATE,
                        etddate: orderLine.ETD_DATE,
                        carrier: orderLine.CARRIER,
                        tracking: orderLine.TRACKING,
                        serial: orderLine.SERIALNUM
                    };

                    vc_uihelper.setSublistValues({
                        sublist: itemSublist,
                        line: line,
                        lineData: lineData
                    });
                });

                scriptContext.response.writePage(FORM_DEF.Form);
                return returnValue;
            },
            onPOST: function () {}
        },
        handleError: function (scriptContext, errorMsg) {
            var errorMessage = vc2_util.extractError(errorMsg);

            var logTitle = [LogTitle, 'VendorData'].join('::'),
                returnValue;

            vc_uihelper.Form = ns_ui.createForm({ title: 'ERROR FOUND' });

            // vc_uihelper.Fields = {
            //     ERROR_MSG: util.extend(FORM_DEF.Fields.HTMLDATA, {
            //         defaultValue: vc2_util.extractError(errorMessage)
            //     })
            // };
            // vc_uihelper.renderFieldList(['ERROR_MSG']);

            vc_uihelper.Form.addPageInitMessage({
                title: 'Error Found ', // + errorMessage,
                message: util.isString(errorMsg) ? errorMsg : JSON.stringify(errorMsg),
                type: ns_msg.Type.ERROR
            });
            scriptContext.response.writePage(vc_uihelper.Form);
        }
    };

    var Suitelet = {
        onRequest: function (scriptContext) {
            var logTitle = [LogTitle, 'onRequest'].join('::'),
                returnValue;

            var reqMethod = scriptContext.request.method.toUpperCase();

            try {
                PAGE.Param = { actview: scriptContext.request.parameters.actview || 'vendorData' };
                if (!PAGE[PAGE.Param.actview]) throw 'PAGE NOT FOUND';
                var pageObj = PAGE[PAGE.Param.actview];

                if (reqMethod == 'GET') {
                    (pageObj.onGET || pageObj).call(PAGE, scriptContext);
                } else {
                    (pageObj.onPOST || pageObj).call(PAGE, scriptContext);
                }
            } catch (error) {
                PAGE.handleError(scriptContext, error);
            }

            return returnValue;
        }
    };

    return Suitelet;
});
