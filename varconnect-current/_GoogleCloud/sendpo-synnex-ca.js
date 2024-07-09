const axios = require('axios');

exports.synnexSendPO = async (req, res) => {
    try {
        if (req.method !== 'POST') throw new Error('Forbidden request method');

        if (!req.body || !req.body.toString()) throw new Error('No XML Data provided in the request body');

        const { xmlparser } = require('xml2js');

        var configUrl =
            req.query.ccode == 'CA' ? 'https://ec.synnex.ca/SynnexXML/PO' : 'https://ec.synnex.com/SynnexXML/PO';

        console.log('CCODE', req.query.ccode);
        console.log('CONFIGURL', configUrl);

        axios
            .post(configUrl, req.body.toString(), {
                headers: {
                    'Content-Type': 'application/xml'
                }
            })
            .then(
                (response) => {
                    res.status(200).send(response.data);
                    console.log('!!response!! ', response);
                },
                (error) => {
                    res.status(500).send(error.data);
                    console.log('!! error!', error);
                }
            );

        // res.status(200).json({ message: 'Message received ' });
    } catch (error) {
        console.error(' !! Error Encountered:', error);
        res.status(500).json({
            error: 'An error occurred while processing XML',
            message: error.message
        });
    }
};
