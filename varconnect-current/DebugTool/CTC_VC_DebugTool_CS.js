/**
 * Copyright (c) 2025 Catalyst Tech Corp
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
 */

var hlFolder = 'SuiteScripts/VAR Connect/highlight';
define([
    'N/search',
    'N/currentRecord',
    'N/url',
    'N/https',
    hlFolder + '/highlight.js',
    hlFolder + '/languages/xml.min.js',
    hlFolder + '/languages/json.min.js'
], function (ns_search, ns_currentRecord, ns_url, ns_https, hljs, hljsXml, hljsJson) {
    const RL_SERVICES = {
        scriptId: 'customscript_ctc_vc_rl_services',
        deploymentId: 'customdeploy_ctc_rl_services'
    };

    var Helper = {
        resetDisplay: function () {
            var xmlViewer = jQuery('#custpage_xml_viewer_frame').contents();
            jQuery('#custpage_xml__loader').show();
            if (hljs) {
                xmlViewer.find('#custpage_xml__viewer').hide();
                xmlViewer.find('#custpage_json__viewer').hide();
                jQuery('#vcdebugcontent').hide();
            } else {
                jQuery('#vcdebugcontent').hide().get(0).value = '';
            }
        },

        updateDisplay: function (option) {
            var xmlViewer = jQuery('#custpage_xml_viewer_frame').contents();
            var content = option.content || option.body,
                elementIdToHide,
                elementIdToShow;

            if (util.isString(content)) {
                // XML //
                content = vkbeautify.xml(content, 4);
                if (hljs) {
                    content = hljs.highlight(content, { language: 'xml' }).value;
                    elementIdToShow = 'custpage_xml__viewer';
                    elementIdToHide = 'custpage_json__viewer';
                }
            } else {
                // JSON //
                content = JSON.stringify(content);
                content = vkbeautify.json(content, 4);

                if (hljs) {
                    content = hljs.highlight(content, { language: 'JSON' }).value;
                    elementIdToShow = 'custpage_json__viewer';
                    elementIdToHide = 'custpage_xml__viewer';
                }
            }

            if (hljs) {
                xmlViewer.find('#' + elementIdToShow).show();
                xmlViewer.find('#' + elementIdToHide).hide();

                xmlViewer.find('#' + [elementIdToHide, '_content'].join('')).hide();
                xmlViewer
                    .find('#' + [elementIdToShow, '_content'].join(''))
                    .show()
                    .get(0).innerHTML = content;
            } else {
                xmlViewer.find('#custpage_xml__viewer').hide();
                xmlViewer.find('#custpage_json__viewer').hide();

                jQuery('#vcdebugcontent').show().get(0).value = content;
                jQuery('#custpage_xml_viewer_frame').hide();
            }

            jQuery('#custpage_xml__loader').hide();

            return true;
        }
    };

    var DebugToolHelper = {
        // pageInit: function () {
        //     console.log('load page');
        // },

        showResults: function (scriptContext) {
            Helper.resetDisplay();

            var thisRecord = ns_currentRecord.get();
            try {
                var poNum = thisRecord.getValue({ fieldId: 'custpage_ponum' }),
                    showLines = thisRecord.getValue({ fieldId: 'custpage_showlines' }),
                    vendorConfigId = thisRecord.getValue({ fieldId: 'custpage_vendor' });

                if (!poNum) throw 'PO Number is required';

                var requestOption = {
                    url: ns_url.resolveScript(RL_SERVICES),
                    body: {
                        moduleName: 'webserviceLibV1',
                        action: 'OrderStatusDebug',
                        parameters: {
                            poNum: poNum,
                            vendorConfigId: vendorConfigId, 
                            showLines: showLines
                        }
                    },
                    method: 'POST'
                };

                // send the request
                ns_https.request
                    .promise(requestOption)
                    .then(function (option) {
                        var displayOption = {};
                        try {
                            if (!option.body) throw 'Unable to receive a response content';
                            displayOption.content = JSON.parse(option.body);
                        } catch (error) {
                            displayOption.content = error;
                            displayOption.isError = true;
                        }
                        Helper.updateDisplay(displayOption);
                    })
                    .catch(function (reason) {
                        Helper.updateDisplay({ content: reason, isError: true });
                    });
            } catch (error) {
                // update the display
                Helper.updateDisplay({
                    content: error,
                    isError: true
                });
            } finally {
            }

            return true;
        }
    };
    //////////////////////////////////////////////////////////////////////////

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

    return DebugToolHelper;
});
