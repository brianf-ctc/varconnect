define([
    './CTC_VCSP_Constants.js',
    './CTC_VCSP_Lib_VendorConfig.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Dell.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Arrow.js',
    '../Vendor Scripts/CTC_VCSP_Lib_Synnex.js',
    '../VO/CTC_VCSP_Response.js',
    '../VO/CTC_VCSP_PO.js'
], function (constants, libVendorConfig, libDell, libArrow, libSynnex, response, PO) {
    function _validateVendorConfig(options) {
        var recVendorConfig = options.recVendorConfig,
            endpoint = recVendorConfig.endPoint,
            apiKey = recVendorConfig.apiKey,
            apiSecret = recVendorConfig.apiSecret,
            customerNo = recVendorConfig.customerNo;

        log.debug({
            title: 'Lib_WS: vendor config ',
            details:
                'endpoint: ' +
                endpoint +
                ' | ' +
                'apiKey: ' +
                !!apiKey +
                ' | ' +
                'apiSecret: ' +
                !!apiSecret
        });
        if (!endpoint || !apiKey || !apiSecret)
            throw Error('Incomplete webservice information for ' + recVendorConfig.vendor);
    }

    function _getVendorLibrary(options) {
        var recVendorConfig = options.recVendorConfig,
            apiVendor = recVendorConfig.apiVendor,
            vendorList = constants.Lists.API_VENDOR,
            libVendor;

        log.debug('Lib_WS: apiVendor', apiVendor);
        switch (apiVendor) {
            case vendorList.DELL:
                libVendor = libDell;
                break;
            case vendorList.ARROW:
                libVendor = libArrow;
                break;
            case vendorList.SYNNEX:
                libVendor = libSynnex;
                break;
            default:
                log.error('Switch case vendor', 'API Vendor not setup');
                break;
        }

        log.debug('Lib_WS: get lib libVendor', JSON.stringify(libVendor));

        return libVendor;
    }

    function _updateRecPO(options) {
        var recVendorConfig = options.recVendorConfig,
            recPO = options.recPO,
            nativePO = options.nativePO;

        recPO.setValuesFromVendorConfig({
            recVendorConfig: recVendorConfig,
            nativePO: nativePO
        });
    }

    function process(options) {
        var nativePO = options.nativePO,
            recPO = new PO(nativePO),
            resp;

        try {
            var recVendorConfig = libVendorConfig.getVendorConfiguration({
                vendor: recPO.entity,
                subsidiary: recPO.subsidiary
            });

            if (recVendorConfig) {
                _updateRecPO({
                    recPO: recPO,
                    nativePO: nativePO,
                    recVendorConfig: recVendorConfig
                });

                var libVendor = _getVendorLibrary({
                    recVendorConfig: recVendorConfig
                });

                if (libVendor) {
                    _validateVendorConfig({
                        recVendorConfig: recVendorConfig
                    });

                    resp = libVendor.process({
                        recVendorConfig: recVendorConfig,
                        recPO: recPO
                    });
                }
            }
        } catch (e) {
            resp = new response({
                code: 'Err',
                message: e.message
            });
        }

        return resp;
    }

    return {
        process: process
    };
});
