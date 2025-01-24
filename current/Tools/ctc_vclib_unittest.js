/**
 * @NApiVersion 2.x
 */
define(function (require) {
    var reportSucessful = true;
    return {
        assertEqual: function (actual, expected, message) {
            if (actual !== expected) {
                throw new Error(message + ' - Expected: ' + expected + ', but got: ' + actual);
            }
            if (reportSucessful) return message + ' - PASSED ';
        },
        assertTrue: function (value, message) {
            if (!value) {
                throw new Error(message + ' - Expected true, but got: ' + value);
            }
            if (reportSucessful) return message + ' - PASSED ';
        },
        assertFalse: function (value, message) {
            if (value) {
                throw new Error(message + ' - Expected false, but got: ' + value);
            }
            if (reportSucessful) return message + ' - PASSED ';
        }
    };
});
