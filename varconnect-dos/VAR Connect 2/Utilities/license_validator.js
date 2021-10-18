/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define([
        'N/https',
        'N/runtime',
        'N/log',
        'N/file',
        'N/search',
        '../Libraries/oauth',
        '../Libraries/moment'
    ],

    function(
        https,
        runtime,
        log,
        file,
        search,
        oauth,
        moment
    ) {

        function _get(context) {

            var forceRefresh = false;

            if (context.refresh == 'true') {
                forceRefresh = true;
            };

            var folderId = null;

            var folderSearchObj = search.create({
                type: "folder",
                filters: [
                    ["name", "is", "VAR Connect 2"],
                    "AND", ["description", "is", "567f0b32-fcdc-4c53-8ba6-d5bc441c1641"]
                ],
                columns: [
                    "internalid"
                ]
            });

            folderSearchObj.run().each(function(result) {
                folderId = result.id;
                return true;
            });

            var fileId = null;

            var fileSearchObj = search.create({
                type: "file",
                filters: [
                    ["name", "is", "license.txt"],
                    "AND", ["folder", "anyof", "5"]
                ],
                columns: [
                    "internalid"
                ]
            });

            fileSearchObj.run().each(function(result) {
                fileId = result.id;
                return true;
            });

            var licObj = {};
            var today = moment();
            var licAge = null;

            if (fileId) {

                var fileObj = file.load({
                    id: fileId
                })

                var licFile = fileObj.getContents();

                var decryptedLic = decrypt(signingKey, licFile);

                licObj = JSON.parse(decryptedLic);

                log.audit('Licensing', 'Cached license found');

                var generated = moment(licObj.generated); 

                // log.debug('today', today);
                // log.debug('generated', generated);                

                var licAge = today.diff(generated, 'days');

                log.debug('Licensing', 'License is ' + licAge + ' day(s) old');
            };

            if (licAge <= 1) {
                log.audit('Licensing', 'Cached license is less than 1 day old, using existing license')
            }

            if (licAge > 4 && licAge < 7) {
                log.audit('licensing', 'WARNING - license is ' + licAge +
                    ' days old and will no longer be valid after 7 days.  Please open a ticket with Catalyst Support if this problem persists');
            }

            if (licAge > 7) {
                licObj.status = 'Stale';
                log.audit('Licensing', 'ERROR - license is older than 7 days and is no longer valid');
            }

            if (licAge > 1 || forceRefresh == true) {

                if (forceRefresh == true) {
                    log.audit('Licensing', 'license refresh requested');
                }

                var fId = requestlicObj(folderId)

                if (fId) {

                    log.audit('Licensing', 'Successfully refreshed license');

                } else {

                    log.audit('Licensing', 'Error saving new license')
                }
            }
            return licObj;
        };

        function requestlicObj(folderId) {

            var nsid = null;

            log.audit('Licensing', 'Refreshing license');
            var url = 'https://tstdrv2486528.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1&deploy=1&account=' + runtime.accountId;

            var headers = oauth.getHeaders({
                url: url,
                method: 'GET',
                tokenKey: '0bb0d75f429a350273ebde9dedc32d1a91838dca20893c1df0c2629cada1fbeb',
                tokenSecret: '5f2d4b72dd431a71e535ed2f2d6c497c2e0d3a18e136edd261ac4d61419d123e'
            });

            headers['Content-Type'] = 'application/json';

            var resp = https.get({
                url: url,
                headers: headers
            });

            log.debug('resp', resp);

            if (resp.code == 200) {

                licObj = JSON.parse(resp.body);

                var licObjStr = encrypt(signingKey, resp.body);

                let fileObj = file.create({
                    name: 'license.txt',
                    fileType: file.Type.PLAINTEXT,
                    contents: licObjStr
                });

                fileObj.folder = folderId;

                nsid = fileObj.save();

            } else {

                log.audit('Licensing', 'Error retrieving license from server');
                log.error('Licensing', resp.code + ' - ' + resp.body);
            }

            return nsid;
        }

        var signingKey = JSON.stringify([
            'a680fdff-8d39-41a8-bac8-1d3ed75f3df1',
            'f7b70ee4-9b13-40b3-a20a-e4d3a86d3ebe',
            'db6ac360-f155-45b8-b748-2b49d7f61fac',
            'd012aa76-3ae8-4271-8711-09631a80e08b'
        ]);

        const encrypt = (salt, text) => {
            const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
            const byteHex = (n) => ("0" + Number(n).toString(16)).substr(-2);
            const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);

            return text
                .split("")
                .map(textToChars)
                .map(applySaltToChar)
                .map(byteHex)
                .join("");
        };

        const decrypt = (salt, encoded) => {
            const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
            const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
            return encoded
                .match(/.{1,2}/g)
                .map((hex) => parseInt(hex, 16))
                .map(applySaltToChar)
                .map((charCode) => String.fromCharCode(charCode))
                .join("");
        };

        return {
            get: _get
        };
    });