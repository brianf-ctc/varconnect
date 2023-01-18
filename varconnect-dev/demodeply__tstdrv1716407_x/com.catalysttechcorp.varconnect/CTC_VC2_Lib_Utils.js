/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/runtime', 'N/format', 'N/record', 'N/search', './CTC_VC2_Constants.js'], function (
    NS_Runtime,
    NS_Format,
    NS_Record,
    NS_Search,
    VC2_Global
) {
    var LogTitle = 'VC2_UTILS',
        LogPrefix;

    var Util = {
        CACHE: {},
        isEmpty: function (stValue) {
            return (
                stValue === '' ||
                stValue == null ||
                stValue == undefined ||
                stValue == 'undefined' ||
                stValue == 'null' ||
                (util.isArray(stValue) && stValue.length == 0) ||
                (util.isObject(stValue) &&
                    (function (v) {
                        for (var k in v) return false;
                        return true;
                    })(stValue))
            );
        },
        inArray: function (stValue, arrValue) {
            if (!stValue || !arrValue) return false;
            for (var i = arrValue.length - 1; i >= 0; i--) if (stValue == arrValue[i]) break;
            return i > -1;
        },
        uniqueArray: function (arrVar) {
            var arrNew = [];
            for (var i = 0, j = arrVar.length; i < j; i++) {
                if (Util.inArray(arrVar[i], arrNew)) continue;
                arrNew.push(arrVar[i]);
            }

            return arrNew;
        },
        parseFloat: function (stValue) {
            return stValue ? parseFloat(stValue.toString().replace(/[^0-9.-]+/g, '') || '0') : 0;
        },
        parseDate: function (option) {
            var logTitle = [LogTitle, 'parseDate'].join('::');
            log.audit(logTitle, '>> option: ' + JSON.stringify(option));

            var dateString = option.dateString || option,
                dateFormat = Util.CACHE.DATE_FORMAT,
                date = '';

            if (!dateFormat) {
                try {
                    require(['N/config'], function (config) {
                        var generalPref = config.load({
                            type: config.Type.COMPANY_PREFERENCES
                        });
                        dateFormat = generalPref.getValue({ fieldId: 'DATEFORMAT' });
                        return true;
                    });
                } catch (e) {}

                if (!dateFormat) {
                    try {
                        dateFormat = nlapiGetContext().getPreference('DATEFORMAT');
                    } catch (e) {}
                    // log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
                }
                Util.CACHE.DATE_FORMAT = dateFormat;
                log.audit(logTitle, '>> dateFormat: ' + JSON.stringify(dateFormat));
            }

            if (dateString && dateString.length > 0 && dateString != 'NA') {
                try {
                    var stringToProcess = dateString
                        .replace(/-/g, '/')
                        .replace(/\n/g, ' ')
                        .split(' ');

                    for (var i = 0; i < stringToProcess.length; i++) {
                        var singleString = stringToProcess[i];
                        if (singleString) {
                            var stringArr = singleString.split('T'); //handle timestamps with T
                            singleString = stringArr[0];
                            var convertedDate = new Date(singleString);

                            if (!date || convertedDate > date) date = convertedDate;
                        }
                    }
                } catch (e) {
                    log.error(logTitle, LogPrefix + '>> !! ERROR !! ' + util.extractError(e));
                }
            }

            //Convert to string
            if (date) {
                //set date
                var year = date.getFullYear();
                if (year < 2000) {
                    year += 100;
                    date.setFullYear(year);
                }

                date = NS_Format.format({
                    value: date,
                    type: dateFormat ? dateFormat : NS_Format.Type.DATE
                });
            }

            log.audit('---datestring ' + dateString, date);
            return date;
        },

        forceInt: function (stValue) {
            var intValue = parseInt(stValue, 10);

            if (isNaN(intValue) || stValue == Infinity) {
                return 0;
            }

            return intValue;
        },
        forceFloat: function (stValue) {
            var flValue = this.parseFloat(stValue);

            if (isNaN(flValue) || stValue == Infinity) {
                return 0.0;
            }

            return flValue;
        },
        flatLookup: function (option) {
            var arrData = null,
                arrResults = null;

            arrResults = NS_Search.lookupFields(option);
            // log.debug('flatLookup', 'arrResults>>' + JSON.stringify(arrResults));

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
        waitMs: function (waitms) {
            var logTitle = [LogTitle, 'waitMs'].join('::');
            waitms = waitms || 5000;

            log.audit(logTitle, 'waiting for ' + waitms);

            var nowDate = new Date(),
                isDone = false;
            while (!isDone) {
                var deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitms;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }

            return true;
        },
        waitRandom: function (max) {
            var logTitle = [LogTitle, 'waitRandom'].join('::');

            var waitTimeMS = Math.floor(Math.random() * Math.floor(max));
            max = max || 5000;

            log.audit(logTitle, 'waiting for ' + waitTimeMS);
            var nowDate = new Date(),
                isDone = false;

            while (!isDone) {
                var deltaMs = new Date() - nowDate;
                isDone = deltaMs >= waitTimeMS;
                if (deltaMs % 1000 == 0) {
                    log.audit(logTitle, '...' + deltaMs);
                }
            }
            log.audit(logTitle, '>> Total Wait: ' + (new Date() - nowDate));
            return true;
        },
        randomStr: function (len) {
            len = len || 5;
            var str = new Date().getTime().toString();
            return str.substring(str.length - len, str.length);
        },
        // getTaskStatus: function (taskId) {
        //     return NS_Task.checkStatus({ taskId: taskId });
        // },
        extractError: function (option) {
            var errorMessage = util.isString(option)
                ? option
                : option.message || option.error || JSON.stringify(option);

            if (!errorMessage || !util.isString(errorMessage))
                errorMessage = 'Unexpected Error occurred';

            return errorMessage;
        }
        // forceDeploy: function (option) {
        //     var logTitle = [LogTitle, 'forceDeploy'].join('::');
        //     var returnValue = null;
        //     var FN = {
        //         // deploy: function (scriptId, deployId, scriptParams, taskType) {
        //         deploy: function (option) {
        //             var logTitle = [LogTitle, 'forceDeploy:deploy'].join('::');
        //             var returnValue = false;

        //             try {
        //                 var objTask = NS_Task.create(option);
        //                 var taskId = objTask.submit();
        //                 var taskStatus = NS_Task.checkStatus({ taskId: taskId });
        //                 // check the status
        //                 log.audit(
        //                     logTitle,
        //                     '## DEPLOY status: ' +
        //                         JSON.stringify({ id: taskId, status: taskStatus })
        //                 );
        //                 returnValue = taskId;
        //             } catch (e) {
        //                 log.error(logTitle, e.name + ':' + e.message);
        //                 returnValue = false;
        //             }

        //             return returnValue;
        //         },
        //         copyDeploy: function (option) {
        //             var logTitle = [LogTitle, 'forceDeploy:copyDeploy'].join('::');
        //             var returnValue = false;
        //             try {
        //                 var searchDeploy = NS_Search.create({
        //                     type: NS_Search.Type.SCRIPT_DEPLOYMENT,
        //                     filters: [
        //                         ['script.scriptid', 'is', option.scriptId],
        //                         'AND',
        //                         ['status', 'is', 'NOTSCHEDULED'],
        //                         'AND',
        //                         ['isdeployed', 'is', 'T']
        //                     ],
        //                     columns: ['scriptid']
        //                 });
        //                 var newDeploy = null,
        //                     newScriptId;

        //                 searchDeploy.run().each(function (result) {
        //                     if (!result.id) return false;
        //                     newDeploy = NS_Record.copy({
        //                         type: NS_Record.Type.SCRIPT_DEPLOYMENT,
        //                         id: result.id
        //                     });

        //                     newScriptId = result.getValue({ name: 'scriptid' });
        //                     newScriptId = newScriptId.toUpperCase().split('CUSTOMDEPLOY')[1];
        //                     newScriptId = [newScriptId.substring(0, 20), Util.randomStr()].join(
        //                         '_'
        //                     );

        //                     newDeploy.setValue({ fieldId: 'status', value: 'NOTSCHEDULED' });
        //                     newDeploy.setValue({ fieldId: 'isdeployed', value: true });
        //                     newDeploy.setValue({
        //                         fieldId: 'scriptid',
        //                         value: newScriptId.toLowerCase().trim()
        //                     });
        //                     return true;
        //                 });

        //                 log.audit(logTitle, '## COPY A DEPLOYMENT [' + newScriptId + '] ##');

        //                 if (newDeploy) {
        //                     returnValue = newDeploy.save({
        //                         enableSourcing: false,
        //                         ignoreMandatoryFields: true
        //                     });
        //                 }
        //             } catch (e) {
        //                 log.error(logTitle, e.name + ': ' + e.message);
        //                 throw e;
        //             } finally {
        //                 log.audit(logTitle, ' >> returnValue : ' + JSON.stringify(returnValue));
        //             }

        //             return returnValue;
        //         },
        //         copyAndDeploy: function (scriptId, params, taskType) {
        //             FN.copyDeploy(scriptId);
        //             return FN.deploy(scriptId, null, params, taskType);
        //         }
        //     };
        //     ////////////////////////////////////////
        //     try {
        //         if (!option.scriptId)
        //             throw error.create({
        //                 name: 'MISSING_REQD_PARAM',
        //                 message: 'missing script id',
        //                 notifyOff: true
        //             });

        //         var scriptOption = {
        //             scriptId: option.scriptId
        //         };

        //         if (!option.taskType) {
        //             option.taskType = NS_Task.TaskType.SCHEDULED_SCRIPT;
        //             option.taskType = option.isMapReduce
        //                 ? NS_Task.TaskType.MAP_REDUCE
        //                 : option.isSchedScript
        //                 ? NS_Task.TaskType.SCHEDULED_SCRIPT
        //                 : option.taskType;
        //         }
        //         scriptOption.taskType = option.taskType;
        //         scriptOption.params =
        //             option.scriptParams || option.params || option.parameters || {};
        //         log.debug(logTitle, '>> script option: ' + JSON.stringify(scriptOption));

        //         returnValue = FN.deploy(scriptOption) || FN.copyAndDeploy(scriptOption);

        //         // var retryNum = option.retry || 5, isSuccesfulDeploy = false;

        //         // while (!isSuccesfulDeploy && retryNum-- > 0) {
        //         //     isSuccesfulDeploy = FN.deploy(scriptOption);
        //         //     log.audit(logTitle, '>>> Is Deployed? ' + JSON.stringify({isSuccess: isSuccesfulDeploy, retryLeft: retryNum}));
        //         //     // wait next run
        //         //     if (! isSuccesfulDeploy) Util.waitRandom(1000);
        //         // }
        //         // if (! isSuccesfulDeploy) {
        //         //     returnValue = FN.copyAndDeploy(option);
        //         // }

        //         log.audit(logTitle, '>> deploy: ' + JSON.stringify(returnValue));
        //     } catch (e) {
        //         log.error(logTitle, e.name + ': ' + e.message);
        //         throw e;
        //     }
        //     ////////////////////////////////////////

        //     return returnValue;
        // }
    };

    return Util;
});
