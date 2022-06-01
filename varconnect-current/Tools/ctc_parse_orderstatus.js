/**
 *@NScriptType MapReduceScript
 */
require(['N/search', 'N/record', 'N/xml'], function (ns_search, ns_record, ns_xml) {
    var ssearchId = '';

    var Helper = {
        getNodeContent: function (node) {
            var returnValue;
            try {
                returnValue = (node[0] || node).textContent;
            } catch (err) {}
            return returnValue;
        }
    };

    var vcLogSearch = ns_search.create({
        type: 'customrecord_ctc_vcsp_log',
        filters: [
            ['custrecord_ctc_vcsp_log_transaction', 'anyof', '86726'],
            'AND',
            ['custrecord_ctc_vcsp_log_body', 'contains', 'HX2W8E'],
            'AND',
            ['custrecord_ctc_vcsp_log_header', 'contains', 'XML_OrderStatus_Submit:Response']
        ],
        columns: [
            ns_search.createColumn({
                name: 'id',
                sort: ns_search.Sort.ASC
            }),
            'custrecord_ctc_vcsp_log_date',
            'custrecord_ctc_vcsp_log_status',
            'custrecord_ctc_vcsp_log_header',
            'custrecord_ctc_vcsp_log_body',
            'custrecord_ctc_vcsp_log_transaction'
        ]
    });

    var arrResults = [];
    vcLogSearch.run().each(function (row) {
        var vcLogRow = {
            date: row.getValue({ name: 'custrecord_ctc_vcsp_log_date' }),
            content: row.getValue({ name: 'custrecord_ctc_vcsp_log_body' }),
            header: row.getValue({ name: 'custrecord_ctc_vcsp_log_header' })
        };

        var xmlDoc;
        try {
            xmlDoc = ns_xml.Parser.fromString({
                text: vcLogRow.content
            });
        } catch (err) {
            log.error('error', err);
        }

        if (xmlDoc) {
            // get the detail
            var xmlDetail = ns_xml.XPath.select({
                node: xmlDoc,
                xpath: '//Detail'
            });

            xmlDetail.forEach(function (xmldet) {
                var xmlLines = ns_xml.XPath.select({
                    node: xmldet,
                    xpath: '//LineInfo'
                });
                var lineData = {
                    logDate: vcLogRow.date.toString().split(/\s/g)[0],
                    orderStatus: Helper.getNodeContent(
                        ns_xml.XPath.select({
                            node: xmldet,
                            xpath: '//OrderStatus'
                        })
                    ),
                    ETA: Helper.getNodeContent(
                        ns_xml.XPath.select({
                            node: xmldet,
                            xpath: '//EstimatedShipDate'
                        })
                    )
                };

                xmlLines.forEach(function (lineXml) {
                    var lineValues = {
                        item: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'ProductID2'
                            })
                        ),
                        eta: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'ItemEstimatedShipDate'
                            })
                        ),
                        status: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'LineStatus'
                            })
                        ),
                        qtyOrdered: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'QtyOrdered'
                            })
                        ),
                        qtyShipped: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'QtyShipped'
                            })
                        ),
                        qtyBackorderd: Helper.getNodeContent(
                            ns_xml.XPath.select({
                                node: lineXml,
                                xpath: 'QtyBackordered'
                            })
                        )
                    };

                    for (var prop in lineValues) {
                        lineData[prop + ':' + lineValues.item] = lineValues[prop];
                    }

                    return true;
                });

                arrResults.push(lineData);

                return true;
            });
        }

        return true;
    });

    /**
    1. load the search 
     */

    // get the columns
    var arrColumns = [];
    arrResults.forEach(function (row) {
        for (var prop in row) {
            if (arrColumns.indexOf(prop) == -1) arrColumns.push(prop);
        }
    });

    var arrData = [];
    arrData.push(arrColumns.join(','));
    arrResults.forEach(function (row) {
        var lineData = [];

        arrColumns.forEach(function (col) {
            lineData.push((row[col] || '-null-').toString());
            return true;
        });

        arrData.push(lineData.join(','));
        return true;
    });

    return true;
});
