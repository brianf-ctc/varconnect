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
 * @NModuleScope SameAccount
 */

define(function (require) {
    var nsSearch = require('N/search'),
        currentRecord = require('N/currentRecord'),
        constants = require('./CTC_VC_Constants.js'),
        vc_util = require('./CTC_VC2_Lib_Utils.js'),
        libVendorConfig = require('./CTC_VC_Lib_VendorConfig.js'),
        libWebService = require('./CTC_VC_Lib_WebService.js'),
        vcGlobals = require('./VC_Globals.js');
    var hljs = require('./highlight/highlight.js'),
        hljsXml = require('./highlight/languages/xml.min.js'),
        hljsJson = require('./highlight/languages/json.min.js');

    // get current folder
    if (hljs) {
        hljs.registerLanguage('xml', hljsXml);
        hljs.registerLanguage('json', hljsJson);
    }

    function pageInit(scriptContext) {
        console.log('page init', scriptContext);
        return true;
    }

    function _getPODetails(poNum) {
        var columns = [nsSearch.createColumn({ name: 'entity' })];
        if (vcGlobals.ENABLE_SUBSIDIARIES)
            columns.push(nsSearch.createColumn({ name: 'subsidiary' }));

        var poObj = {},
            purchaseorderSearchObj = nsSearch.create({
                type: 'purchaseorder',
                filters: [
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['numbertext', 'is', poNum],
                    'AND',
                    ['mainline', 'is', true]
                ],
                columns: columns
            });
        var searchResultCount = purchaseorderSearchObj.runPaged().count;
        log.debug('purchaseorderSearchObj result count', searchResultCount);
        purchaseorderSearchObj.run().each(function (result) {
            if (vcGlobals.ENABLE_SUBSIDIARIES) poObj['subsidiary'] = result.getValue('subsidiary');
            poObj['vendor'] = result.getValue('entity');
            poObj['id'] = result.id;
            // ?
            //            if (vcGlobals.ENABLE_SUBSIDIARIES)
            //            	poObj['subsidiary'] = result.getValue('subsidiary');

            return false;
        });

        return poObj;
    }

    function _loadDebugVendorConfig(options) {
        var xmlVendor = options.xmlVendor,
            xmlSubsidiary = options.xmlSubsidiary,
            vendorConfig = libVendorConfig.getDebugVendorConfiguration({
                xmlVendor: xmlVendor,
                subsidiary: xmlSubsidiary
            });

        if (!vendorConfig) {
            log.debug('No configuration set up for xml vendor ' + xmlVendor);
        } else return vendorConfig;
    }

    function _loadVendorConfig(vendor, subsidiary) {
        var vendorConfig = libVendorConfig.getVendorConfiguration({
            vendor: vendor,
            subsidiary: subsidiary
        });

        if (!vendorConfig) {
            log.debug(
                'No configuration set up for vendor ' + vendor + ' and subsidiary ' + subsidiary
            );
        } else return vendorConfig;
    }

    function showVendorName() {
        var xmlViewer = document.getElementById('custpage_xml_viewer_frame');
        var xmlViewerDocument = xmlViewer.contentDocument || xmlViewer.contentWindow.document;
        xmlViewerDocument.getElementById('custpage_xml__viewer').style.display = 'none';
        xmlViewerDocument.getElementById('custpage_json__viewer').style.display = 'none';
        var thisRecord = currentRecord.get();
        var xmlVendor = thisRecord.getValue({ fieldId: 'vendors' });

        var ponum = thisRecord.getValue({ fieldId: 'ponum' });
        var objPO = _getPODetails(ponum);

        if (!ponum || !ponum.length) {
            alert('Please Select a vendor and enter a PO number');
        } else {
            var xmlContent = 'Your PO = ' + ponum;
            var vendorConfig = _loadDebugVendorConfig({
                xmlVendor: xmlVendor,
                xmlSubsidiary: objPO.subsidiary
            });
            var elementIdToShow, elementIdToHide;
            if (!vendorConfig) {
                alert('Please Select a valid PO with vendor properly configured');
            } else {
                jQuery('#custpage_xml__loader').show();
                setTimeout(function () {
                    try {
                        console.log('debug lib: Calling library webservice');
                        var promiseResponse = new Promise(function (resolve) {
                            var outputObj;
                            try {
                                outputObj = libWebService.handleRequest({
                                    vendorConfig: vendorConfig,
                                    poNum: ponum,
                                    poId: objPO.id,
                                    country:
                                        vendorConfig.country == 'CA'
                                            ? constants.Lists.COUNTRY.CA
                                            : constants.Lists.COUNTRY.US,
                                    countryCode: vendorConfig.country
                                });
                            } catch (processErr) {
                                outputObj =
                                    'Error while handling request. Please make sure Vendor configuration was setup correctly. [' +
                                    (processErr.name + ': ') +
                                    (processErr.message + ']');
                                console.log(
                                    'debug lib: ' +
                                        (processErr.name + '- ') +
                                        (processErr.message + '==\n' + processErr.stack)
                                );
                            }
                            resolve(outputObj);
                        });
                        promiseResponse.then(function (outputObj) {
                            console.log(
                                'debug lib: webservice return ' + JSON.stringify(outputObj)
                            );
                            if (outputObj) {
                                if (
                                    vendorConfig.xmlVendor ==
                                    constants.Lists.XML_VENDOR.INGRAM_MICRO
                                ) {
                                    xmlContent =
                                        '<!--Retrieved XML-->\n' +
                                        outputObj.detailxml +
                                        '\n<!--Tracking XML-->\n' +
                                        outputObj.trackxml;
                                    try {
                                        xmlContent = vkbeautify.xml(xmlContent, 4);
                                        if (hljs)
                                        xmlContent = hljs.highlight(xmlContent, {
                                            language: 'xml'
                                        }).value;
                                        elementIdToShow = 'custpage_xml__viewer';
                                        elementIdToHide = 'custpage_json__viewer';
                                    } catch (parseErr) {
                                        xmlContent = JSON.stringify(outputObj);
                                        xmlContent = vkbeautify.json(xmlContent, 4);
                                        if (hljs)
                                        xmlContent = hljs.highlight(xmlContent, {
                                            language: 'JSON'
                                        }).value;
                                        elementIdToShow = 'custpage_json__viewer';
                                        elementIdToHide = 'custpage_xml__viewer';
                                    }
                                } else if (
                                    vendorConfig.xmlVendor == constants.Lists.XML_VENDOR.ARROW ||
                                    vendorConfig.xmlVendor == constants.Lists.XML_VENDOR.DELL ||
                                    vendorConfig.xmlVendor ==
                                        constants.Lists.XML_VENDOR.SYNNEX_API ||
                                    vendorConfig.xmlVendor ==
                                        constants.Lists.XML_VENDOR.INGRAM_MICRO_API ||
                                    vendorConfig.xmlVendor ==
                                        constants.Lists.XML_VENDOR.INGRAM_MICRO_V_ONE
                                ) {
                                    xmlContent = JSON.stringify(outputObj);
                                    try {
                                        xmlContent = vkbeautify.json(xmlContent, 4);
                                        if (hljs)
                                        xmlContent = hljs.highlight(xmlContent, {
                                            language: 'JSON'
                                        }).value;
                                        else xmlContent = '<pre>' + xmlContent + '</pre>';

                                        elementIdToShow = 'custpage_json__viewer';
                                        elementIdToHide = 'custpage_xml__viewer';
                                    } catch (parseErr) {
                                        xmlContent = vkbeautify.xml(xmlContent, 4);
                                        if (hljs)
                                        xmlContent = hljs.highlight(xmlContent, {
                                            language: 'xml'
                                        }).value;
                                        else xmlContent = '<pre>' + xmlContent + '</pre>';
                                        elementIdToShow = 'custpage_xml__viewer';
                                        elementIdToHide = 'custpage_json__viewer';
                                    }
                                } else {
                                    xmlContent = outputObj;
                                    if (typeof xmlContent == 'string') {
                                        try {
                                            xmlContent = vkbeautify.xml(xmlContent, 4);
                                            if (hljs)
                                            xmlContent = hljs.highlight(xmlContent, {
                                                language: 'xml'
                                            }).value;
                                            else xmlContent = '<pre>' + xmlContent + '</pre>';
                                            elementIdToShow = 'custpage_xml__viewer';
                                            elementIdToHide = 'custpage_json__viewer';
                                        } catch (parseErr) {
                                            xmlContent = JSON.stringify(outputObj);
                                            xmlContent = vkbeautify.json(xmlContent, 4);
                                            if (hljs)
                                            xmlContent = hljs.highlight(xmlContent, {
                                                language: 'JSON'
                                            }).value;
                                            else xmlContent = '<pre>' + xmlContent + '</pre>';
                                            elementIdToShow = 'custpage_json__viewer';
                                            elementIdToHide = 'custpage_xml__viewer';
                                        }
                                    } else {
                                        xmlContent = JSON.stringify(outputObj);
                                        try {
                                            xmlContent = vkbeautify.json(xmlContent, 4);
                                            if (hljs)
                                            xmlContent = hljs.highlight(xmlContent, {
                                                language: 'JSON'
                                            }).value;
                                            elementIdToShow = 'custpage_json__viewer';
                                            elementIdToHide = 'custpage_xml__viewer';
                                        } catch (parseErr) {
                                            xmlContent = vkbeautify.xml(xmlContent, 4);
                                            if (hljs)
                                            xmlContent = hljs.highlight(xmlContent, {
                                                language: 'xml'
                                            }).value;
                                            elementIdToShow = 'custpage_xml__viewer';
                                            elementIdToHide = 'custpage_json__viewer';
                                        }
                                    }
                                }
                                xmlViewerDocument.getElementById(elementIdToShow).style.display =
                                    '';
                                xmlViewerDocument.getElementById(elementIdToHide).style.display =
                                    'none';
                            }
                            xmlViewerDocument.getElementById(
                                elementIdToShow || 'custpage_xml__viewer'
                            ).style.display = '';
                            xmlViewerDocument.getElementById(
                                [elementIdToShow || 'custpage_xml__viewer', '_content'].join('')
                            ).innerHTML = xmlContent;
                        });
                    } finally {
                        jQuery('#custpage_xml__loader').hide();
                    }
                }, 500);
            }
        }
    }

    function showVendorResults() {
        var thisRecord = currentRecord.get();

        var xmlVendor = thisRecord.getValue({ fieldId: 'custpage_vendor' }),
            poNum = thisRecord.getValue({ fieldId: 'custpage_ponum' });

        jQuery('#vcdebugcontent').get(0).value = 'Please wait...';

        setTimeout(function () {
            // set the content
            var promiseObj = new Promise(function (resolve) {
                var outputObj,
                    objPO = _getPODetails(poNum),
                    vendorConfig = _loadDebugVendorConfig({
                        xmlVendor: xmlVendor,
                        xmlSubsidiary: objPO.subsidiary
                    });

                try {
                    outputObj = libWebService.handleRequest({
                        vendorConfig: vendorConfig,
                        poNum: poNum,
                        poId: objPO.id,
                        country:
                            vendorConfig.country == 'CA'
                                ? constants.Lists.COUNTRY.CA
                                : constants.Lists.COUNTRY.US,
                        countryCode: vendorConfig.country
                    });
                } catch (processErr) {
                    outputObj =
                        'Error while handling request. Please make sure Vendor configuration was setup correctly. [' +
                        (processErr.name + ': ') +
                        (processErr.message + ']');
                    console.log(
                        'debug lib: ' +
                            (processErr.name + '- ') +
                            (processErr.message + '==\n' + processErr.stack)
                    );
                }
                resolve(outputObj);
            });

            promiseObj.then(function (outputObj) {
                // console.log(outputObj);\
                var xmlContent = outputObj;
                jQuery('#custpage_xml__loader').hide();
                try {
                    if (!util.isObject(outputObj)) throw outputObj;
                    xmlContent = JSON.stringify(outputObj);
                    xmlContent = vkbeautify.json(xmlContent, 4);
                } catch (err) {
                    xmlContent = vkbeautify.xml(outputObj, 4);
                }
                jQuery('#vcdebugcontent').get(0).value = xmlContent;

                return true;
            });
            return true;
        }, 500);

        return true;
    }

    var QueueTasks = function (qname, cb) {
        var queueList = [],
            currentIndex = -1,
            isComplete = false,
            isStopped = false,
            hasStarted = false,
            callBack = { onFinished: function () {} };

        var runNext = function () {
            if (!hasStarted) throw 'Queue is not yet started!';
            currentIndex++;
            if (currentIndex == queueList.length) {
                isComplete = true;
                try {
                    callBack.onFinished.call(this);
                } catch (err) {}
            } else {
                queueList[currentIndex].run();
            }
            return true;
        };
        var QTask = function (task) {
            this.isDone = false;
            this.name =
                task.name || ['taskName', queueList.length + 1, new Date().getTime()].join('_');

            this.markDone = function () {
                this.isDone = true;
                if (task.onComplete && typeof task.onComplete == 'function') {
                    try {
                        task.onComplete.call(this);
                    } catch (err) {}
                }
                runNext();
            };
            this.run = function () {
                var fn = task.fn || task.FN;
                if (!fn || typeof fn != 'function') throw 'Task has no action';

                fn.call(this);
                if (task.delay) {
                    var _this = this;
                    console.log(this.name, '..waiting for: ', task.delay);
                    setTimeout(function () {
                        _this.markDone();
                    }, task.delay);
                } else {
                    if (!task.manualComplete) this.markDone();
                }
            };
            return this;
        };

        this.setOnFinished = function (cbOnFinished) {
            if (cbOnFinished && typeof cbOnFinished == 'function') {
                callBack.onFinished = cbOnFinished;
            }
            return;
        };

        this.runNext = runNext;
        this.queueLength = function () {
            return queueList.length;
        };
        this.add = function (task) {
            if (!task.fn || typeof task.fn != 'function') return;
            queueList.push(new QTask(task));
            return queueList[queueList.length];
        };
        this.start = function (option) {
            hasStarted = true;
            // var onFinished = option.onFinished;
            // if ( onFinished && typeof onFinished == 'function') {
            //     callBack.onFinished = onFinished;
            // }
            return runNext();
        };
        return this;
    };

    (function () {
        function createShiftArr(step) {
            var space = '    ';

            if (isNaN(parseInt(step))) {
                // argument is string
                space = step;
            } else {
                // argument is integer
                switch (step) {
                    case 1:
                        space = ' ';
                        break;
                    case 2:
                        space = '  ';
                        break;
                    case 3:
                        space = '   ';
                        break;
                    case 4:
                        space = '    ';
                        break;
                    case 5:
                        space = '     ';
                        break;
                    case 6:
                        space = '      ';
                        break;
                    case 7:
                        space = '       ';
                        break;
                    case 8:
                        space = '        ';
                        break;
                    case 9:
                        space = '         ';
                        break;
                    case 10:
                        space = '          ';
                        break;
                    case 11:
                        space = '           ';
                        break;
                    case 12:
                        space = '            ';
                        break;
                }
            }

            var shift = ['\n']; // array of shifts
            for (ix = 0; ix < 100; ix++) {
                shift.push(shift[ix] + space);
            }
            return shift;
        }

        function vkbeautify() {
            this.step = '    '; // 4 spaces
            this.shift = createShiftArr(this.step);
        }

        vkbeautify.prototype.xml = function (text, step) {
            var ar = text
                    .replace(/>\s{0,}</g, '><')
                    .replace(/</g, '~::~<')
                    .replace(/\s*xmlns\:/g, '~::~xmlns:')
                    .replace(/\s*xmlns\=/g, '~::~xmlns=')
                    .split('~::~'),
                len = ar.length,
                inComment = false,
                deep = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                // start comment or <![CDATA[...]]> or <!DOCTYPE //
                if (ar[ix].search(/<!/) > -1) {
                    str += shift[deep] + ar[ix];
                    inComment = true;
                    // end comment  or <![CDATA[...]]> //
                    if (
                        ar[ix].search(/-->/) > -1 ||
                        ar[ix].search(/\]>/) > -1 ||
                        ar[ix].search(/!DOCTYPE/) > -1
                    ) {
                        inComment = false;
                    }
                }
                // end comment  or <![CDATA[...]]> //
                else if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) {
                    str += ar[ix];
                    inComment = false;
                }
                // <elm></elm> //
                else if (
                    /^<\w/.exec(ar[ix - 1]) &&
                    /^<\/\w/.exec(ar[ix]) &&
                    /^<[\w:\-\.\,]+/.exec(ar[ix - 1]) ==
                        /^<\/[\w:\-\.\,]+/.exec(ar[ix])[0].replace('/', '')
                ) {
                    str += ar[ix];
                    if (!inComment) deep--;
                }
                // <elm> //
                else if (
                    ar[ix].search(/<\w/) > -1 &&
                    ar[ix].search(/<\//) == -1 &&
                    ar[ix].search(/\/>/) == -1
                ) {
                    str = !inComment ? (str += shift[deep++] + ar[ix]) : (str += ar[ix]);
                }
                // <elm>...</elm> //
                else if (ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) {
                    str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
                }
                // </elm> //
                else if (ar[ix].search(/<\//) > -1) {
                    str = !inComment ? (str += shift[--deep] + ar[ix]) : (str += ar[ix]);
                }
                // <elm/> //
                else if (ar[ix].search(/\/>/) > -1) {
                    str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
                }
                // <? xml ... ?> //
                else if (ar[ix].search(/<\?/) > -1) {
                    str += shift[deep] + ar[ix];
                }
                // xmlns //
                else if (ar[ix].search(/xmlns\:/) > -1 || ar[ix].search(/xmlns\=/) > -1) {
                    str += shift[deep] + ar[ix];
                } else {
                    str += ar[ix];
                }
            }

            return str[0] == '\n' ? str.slice(1) : str;
        };

        vkbeautify.prototype.json = function (text, step) {
            var step = step ? step : this.step;

            if (typeof JSON === 'undefined') return text;

            if (typeof text === 'string') return JSON.stringify(JSON.parse(text), null, step);
            if (typeof text === 'object') return JSON.stringify(text, null, step);

            return text; // text is not string nor object
        };

        vkbeautify.prototype.css = function (text, step) {
            var ar = text
                    .replace(/\s{1,}/g, ' ')
                    .replace(/\{/g, '{~::~')
                    .replace(/\}/g, '~::~}~::~')
                    .replace(/\;/g, ';~::~')
                    .replace(/\/\*/g, '~::~/*')
                    .replace(/\*\//g, '*/~::~')
                    .replace(/~::~\s{0,}~::~/g, '~::~')
                    .split('~::~'),
                len = ar.length,
                deep = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                if (/\{/.exec(ar[ix])) {
                    str += shift[deep++] + ar[ix];
                } else if (/\}/.exec(ar[ix])) {
                    str += shift[--deep] + ar[ix];
                } else if (/\*\\/.exec(ar[ix])) {
                    str += shift[deep] + ar[ix];
                } else {
                    str += shift[deep] + ar[ix];
                }
            }
            return str.replace(/^\n{1,}/, '');
        };

        //----------------------------------------------------------------------------

        function isSubquery(str, parenthesisLevel) {
            return (
                parenthesisLevel - (str.replace(/\(/g, '').length - str.replace(/\)/g, '').length)
            );
        }

        function split_sql(str, tab) {
            return (
                str
                    .replace(/\s{1,}/g, ' ')

                    .replace(/ AND /gi, '~::~' + tab + tab + 'AND ')
                    .replace(/ BETWEEN /gi, '~::~' + tab + 'BETWEEN ')
                    .replace(/ CASE /gi, '~::~' + tab + 'CASE ')
                    .replace(/ ELSE /gi, '~::~' + tab + 'ELSE ')
                    .replace(/ END /gi, '~::~' + tab + 'END ')
                    .replace(/ FROM /gi, '~::~FROM ')
                    .replace(/ GROUP\s{1,}BY/gi, '~::~GROUP BY ')
                    .replace(/ HAVING /gi, '~::~HAVING ')
                    //.replace(/ SET /ig," SET~::~")
                    .replace(/ IN /gi, ' IN ')

                    .replace(/ JOIN /gi, '~::~JOIN ')
                    .replace(/ CROSS~::~{1,}JOIN /gi, '~::~CROSS JOIN ')
                    .replace(/ INNER~::~{1,}JOIN /gi, '~::~INNER JOIN ')
                    .replace(/ LEFT~::~{1,}JOIN /gi, '~::~LEFT JOIN ')
                    .replace(/ RIGHT~::~{1,}JOIN /gi, '~::~RIGHT JOIN ')

                    .replace(/ ON /gi, '~::~' + tab + 'ON ')
                    .replace(/ OR /gi, '~::~' + tab + tab + 'OR ')
                    .replace(/ ORDER\s{1,}BY/gi, '~::~ORDER BY ')
                    .replace(/ OVER /gi, '~::~' + tab + 'OVER ')

                    .replace(/\(\s{0,}SELECT /gi, '~::~(SELECT ')
                    .replace(/\)\s{0,}SELECT /gi, ')~::~SELECT ')

                    .replace(/ THEN /gi, ' THEN~::~' + tab + '')
                    .replace(/ UNION /gi, '~::~UNION~::~')
                    .replace(/ USING /gi, '~::~USING ')
                    .replace(/ WHEN /gi, '~::~' + tab + 'WHEN ')
                    .replace(/ WHERE /gi, '~::~WHERE ')
                    .replace(/ WITH /gi, '~::~WITH ')

                    //.replace(/\,\s{0,}\(/ig,",~::~( ")
                    //.replace(/\,/ig,",~::~"+tab+tab+"")

                    .replace(/ ALL /gi, ' ALL ')
                    .replace(/ AS /gi, ' AS ')
                    .replace(/ ASC /gi, ' ASC ')
                    .replace(/ DESC /gi, ' DESC ')
                    .replace(/ DISTINCT /gi, ' DISTINCT ')
                    .replace(/ EXISTS /gi, ' EXISTS ')
                    .replace(/ NOT /gi, ' NOT ')
                    .replace(/ NULL /gi, ' NULL ')
                    .replace(/ LIKE /gi, ' LIKE ')
                    .replace(/\s{0,}SELECT /gi, 'SELECT ')
                    .replace(/\s{0,}UPDATE /gi, 'UPDATE ')
                    .replace(/ SET /gi, ' SET ')

                    .replace(/~::~{1,}/g, '~::~')
                    .split('~::~')
            );
        }

        vkbeautify.prototype.sql = function (text, step) {
            var ar_by_quote = text
                    .replace(/\s{1,}/g, ' ')
                    .replace(/\'/gi, "~::~'")
                    .split('~::~'),
                len = ar_by_quote.length,
                ar = [],
                deep = 0,
                tab = this.step, //+this.step,
                inComment = true,
                inQuote = false,
                parenthesisLevel = 0,
                str = '',
                ix = 0,
                shift = step ? createShiftArr(step) : this.shift;

            for (ix = 0; ix < len; ix++) {
                if (ix % 2) {
                    ar = ar.concat(ar_by_quote[ix]);
                } else {
                    ar = ar.concat(split_sql(ar_by_quote[ix], tab));
                }
            }

            len = ar.length;
            for (ix = 0; ix < len; ix++) {
                parenthesisLevel = isSubquery(ar[ix], parenthesisLevel);

                if (/\s{0,}\s{0,}SELECT\s{0,}/.exec(ar[ix])) {
                    ar[ix] = ar[ix].replace(/\,/g, ',\n' + tab + tab + '');
                }

                if (/\s{0,}\s{0,}SET\s{0,}/.exec(ar[ix])) {
                    ar[ix] = ar[ix].replace(/\,/g, ',\n' + tab + tab + '');
                }

                if (/\s{0,}\(\s{0,}SELECT\s{0,}/.exec(ar[ix])) {
                    deep++;
                    str += shift[deep] + ar[ix];
                } else if (/\'/.exec(ar[ix])) {
                    if (parenthesisLevel < 1 && deep) {
                        deep--;
                    }
                    str += ar[ix];
                } else {
                    str += shift[deep] + ar[ix];
                    if (parenthesisLevel < 1 && deep) {
                        deep--;
                    }
                }
                var junk = 0;
            }

            str = str.replace(/^\n{1,}/, '').replace(/\n{1,}/g, '\n');
            return str;
        };

        vkbeautify.prototype.xmlmin = function (text, preserveComments) {
            var str = preserveComments
                ? text
                : text
                      .replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g, '')
                      .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns');
            return str.replace(/>\s{0,}</g, '><');
        };

        vkbeautify.prototype.jsonmin = function (text) {
            if (typeof JSON === 'undefined') return text;

            return JSON.stringify(JSON.parse(text), null, 0);
        };

        vkbeautify.prototype.cssmin = function (text, preserveComments) {
            var str = preserveComments
                ? text
                : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g, '');

            return str
                .replace(/\s{1,}/g, ' ')
                .replace(/\{\s{1,}/g, '{')
                .replace(/\}\s{1,}/g, '}')
                .replace(/\;\s{1,}/g, ';')
                .replace(/\/\*\s{1,}/g, '/*')
                .replace(/\*\/\s{1,}/g, '*/');
        };

        vkbeautify.prototype.sqlmin = function (text) {
            return text
                .replace(/\s{1,}/g, ' ')
                .replace(/\s{1,}\(/, '(')
                .replace(/\s{1,}\)/, ')');
        };

        window.vkbeautify = new vkbeautify();
    })();

    return {
        pageInit: pageInit,
        showVendorName: showVendorName,
        showVendorResults: showVendorResults
    };
});
