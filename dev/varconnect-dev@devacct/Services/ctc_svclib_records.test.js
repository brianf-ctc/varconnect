define(function (require) {
    var EndPoint = require('./ctc_svclib_records.js');
    var ns_record = require('N/record');
    var vc2_util = require('../CTC_VC2_Lib_Utils.js');
    var vc2_constant = require('../CTC_VC2_Constants.js');

    describe('EndPoint.matchOrderLines', function () {
        it('should throw an error if required parameters are missing', function () {
            expect(function () {
                EndPoint.matchOrderLines({});
            }).toThrow('Missing required parameter: poId');
        });

        it('should match order lines correctly', function () {
            var poId = 123;
            var vendorLines = [
                { item_num: 'item1', QUANTITY: 10, APPLIEDRATE: 100 },
                { item_num: 'item2', QUANTITY: 5, APPLIEDRATE: 200 }
            ];

            spyOn(EndPoint, 'load').and.returnValue({
                getLineCount: function () { return 2; },
                getSublistValue: function (options) {
                    if (options.line === 0) return options.fieldId === 'item' ? 'item1' : 10;
                    if (options.line === 1) return options.fieldId === 'item' ? 'item2' : 5;
                },
                getSublistText: function (options) {
                    if (options.line === 0) return options.fieldId === 'item' ? 'item1' : 10;
                    if (options.line === 1) return options.fieldId === 'item' ? 'item2' : 5;
                }
            });

            spyOn(vc2_util, 'log');
            spyOn(vc2_util, 'logError');

            var result = EndPoint.matchOrderLines({ poId: poId, vendorLines: vendorLines });

            expect(result).toBeDefined();
            expect(vc2_util.log).toHaveBeenCalled();
        });
    });
});
