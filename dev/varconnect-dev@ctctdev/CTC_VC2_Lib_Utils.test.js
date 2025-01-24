// unit_test_sendRequest.js

const vc2_util = require('../CT_VC_Util'); // Replace with the actual path to the util file

describe('sendRequest function', () => {
    test('should handle non-string inputs gracefully', () => {
        const queryOption = {
            url: 'https://api.example.com/data',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                key1: 123,
                key2: 'value2'
            }
        };

        const expectedRequest = {
            url: 'https://api.example.com/data',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key1: 123,
                key2: 'value2'
            }),
            method: 'POST'
        };

        const option = {
            query: queryOption,
            method: 'post'
        };

        const result = vc2_util.sendRequest(option);

        expect(result.REQUEST).toEqual(expectedRequest);
    });
}); // Unit test for vc2_util.isEmpty function
// File: vc2_util_isEmpty_test.js

// Test case: Should return true for an empty string
it('should return true for an empty string', function () {
    // Arrange
    var stValue = '';

    // Act
    var result = vc2_util.isEmpty(stValue);

    // Assert
    expect(result).toBe(true);
});
