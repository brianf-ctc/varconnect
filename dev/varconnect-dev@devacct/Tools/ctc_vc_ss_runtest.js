/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(function (require) {
    var LogTitle = 'VC:UnitTesting';

    var vc2_util = require('../CTC_VC2_Lib_Utils.js');
    var UnitTesting = [require('./test_configlib.js'), require('./test_orderstatus.js')];

    return {
        execute: function (context) {
            var logTitle = LogTitle + ' :: execute',
                returnValue;

            // loop through all the unit tests

            UnitTesting.forEach(function (unitTest) {
                if (unitTest.run) {
                    try {
                        returnValue = unitTest.run(context);
                    } catch (e) {
                        vc2_util.log(logTitle, 'Error: ' + e);
                    }
                }
            });

            return returnValue;
        }
    };
});
