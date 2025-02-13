/**
 * @NApiVersion 2.x
 */
define(function (require) {
    var reportSucessful = true;
    return {
        assertEqual: function (actual, expected, message, results) {
            if (actual !== expected) {
                throw new Error(
                    message + ' - FAILED: Expected: ' + expected + ', but got: ' + actual
                );
            }
            if (reportSucessful) return message + ' - PASSED ';
        },
        assertTrue: function (value, message, results) {
            if (!value) {
                throw new Error(message + ' - FAILED:  Expected true, but got: ' + value);
            }
            if (reportSucessful) return message + ' - PASSED ';
        },
        assertFalse: function (value, message, results) {
            if (value) {
                throw new Error(message + ' - FAILED:  Expected false, but got: ' + value);
            }
            if (reportSucessful) return message + ' - PASSED ';
        }
    };
});
