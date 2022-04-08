/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/log', 'N/search'],
  function(log, search) {
    function onRequest(context) {

      log.debug('params', context.request.parameters);

      if (context.request.parameters.data == 'mainTable') {

        var returnArray = [];

        log.debug('started');

        var columns = [
          search.createColumn({
            name: "entity",
            join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
          }),

          search.createColumn({
            name: "location",
            join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
          }),

          search.createColumn({
            name: "statusref",
            join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
          }),


          search.createColumn({
            name: "amount",
            join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
          }),

          "custrecord_ctc_vc_bill_linked_po",
          "custrecord_ctc_vc_bill_number",
          "custrecord_ctc_vc_bill_date",
          "custrecord_ctc_vc_bill_due_date",
          "custrecord_ctc_vc_bill_due_date_f_file",
          "custrecord_ctc_vc_bill_proc_status",
          "custrecord_ctc_vc_bill_is_recievable",
          "custrecord_ctc_vc_bill_json",
          "custrecord_ctc_vc_bill_log"
        ]

        //get unprocessed files that have a linked PO
        var s = search.create({
          type: "customrecord_ctc_vc_bills",
          filters: [
            ["custrecord_ctc_vc_bill_proc_status", "anyof", "2", "1", "4", "6", "7"],
            "AND", ["custrecord_ctc_vc_bill_linked_po", "noneof", "@NONE@"],
            "AND", ["custrecord_ctc_vc_bill_linked_po.mainline", "is", "T"],
            "AND", ["isinactive", "is", "F"]
          ],
          columns: columns
        });

        var pagedData = s.runPaged({
          pageSize: 1000
        })

        for (var i = 0; i < pagedData.pageRanges.length; i++) {

          var currentPage = pagedData.fetch(i);

          currentPage.data.forEach(function(result) {

            returnArray.push(buildObject(result))

          });
        }

        //get unprocessed files that do not have a linked PO
        s = search.create({
          type: "customrecord_ctc_vc_bills",
          filters: [
            ["custrecord_ctc_vc_bill_proc_status", "anyof", "2", "1", "4"],
            "AND", ["custrecord_ctc_vc_bill_linked_po", "anyof", "@NONE@"],
            "AND", ["isinactive", "is", "F"]
          ],
          columns: columns
        });

        var pagedData = s.runPaged({
          pageSize: 1000
        })

        for (var i = 0; i < pagedData.pageRanges.length; i++) {

          var currentPage = pagedData.fetch(i);

          currentPage.data.forEach(function(result) {

            returnArray.push(buildObject(result))

          });
        }

        log.debug('done');

        context.response.write(JSON.stringify({
          data: returnArray
        }));

      } else if (context.request.parameters.data == 'statusSummary') {

        // 'Pending, Error, Reprocess, Hold'
        var returnArray = [0, 0, 0, 0, 0]

        var customrecord_ctc_vc_billsSearchObj = search.create({
          type: "customrecord_ctc_vc_bills",
          filters: [
            ["custrecord_ctc_vc_bill_proc_status", "anyof", "1", "2", "4", "6", "7"],
            "AND", ["isinactive", "is", "F"]
          ],
          columns: [
            search.createColumn({
              name: "custrecord_ctc_vc_bill_proc_status",
              summary: "GROUP"
            }),
            search.createColumn({
              name: "internalid",
              summary: "COUNT"
            })
          ]
        });
        var searchResultCount = customrecord_ctc_vc_billsSearchObj.runPaged().count;
        log.debug("customrecord_ctc_vc_billsSearchObj result count", searchResultCount);
        customrecord_ctc_vc_billsSearchObj.run().each(function(result) {

          var status = result.getValue({
            name: "custrecord_ctc_vc_bill_proc_status",
            summary: "GROUP"
          })

          if (status == '1') {

            returnArray[0] = result.getValue({
              name: "internalid",
              summary: "COUNT"
            }) * 1;

          } else if (status == '2') {

            returnArray[1] = result.getValue({
              name: "internalid",
              summary: "COUNT"
            }) * 1;

          } else if (status == '4') {

            returnArray[2] = result.getValue({
              name: "internalid",
              summary: "COUNT"
            }) * 1;

          } else if (status == '6') {

            returnArray[3] = result.getValue({
              name: "internalid",
              summary: "COUNT"
            }) * 1;

          } else if (status == '7') {

            returnArray[4] = result.getValue({
              name: "internalid",
              summary: "COUNT"
            }) * 1;

          }
          return true;
        });

        context.response.write(JSON.stringify(
          returnArray
        ));

      } else if (context.request.parameters.data == 'integrationSummary') {

        var returnArray = [0, 0, 0, 0, 0, 0]

        var customrecord_ctc_vc_billsSearchObj = search.create({
          type: "customrecord_ctc_vc_bills",
          filters: [
            ["created", "onorafter", "monthsago1"],
            "AND", ["isinactive", "is", "F"]
          ],
          columns: [
            search.createColumn({
              name: "internalid",
              summary: "COUNT"
            }),
            search.createColumn({
              name: "custrecord_ctc_vc_bill_integration",
              summary: "GROUP"
            })
          ]
        });
        var searchResultCount = customrecord_ctc_vc_billsSearchObj.runPaged().count;
        log.debug("customrecord_ctc_vc_billsSearchObj result count", searchResultCount);
        customrecord_ctc_vc_billsSearchObj.run().each(function(result) {

          var position = result.getValue({
            name: "custrecord_ctc_vc_bill_integration",
            summary: "GROUP"
          }) - 1;
          returnArray[position] = result.getValue({
            name: "internalid",
            summary: "COUNT"
          }) * 1;
          return true;
        });

        context.response.write(JSON.stringify(
          returnArray
        ));

      } 
      
    }

    function buildObject(result) {

      var billJson = JSON.parse(result.getValue({
        name: 'custrecord_ctc_vc_bill_json'
      }))
      
      var returnObj = {};

      returnObj.id = result.id;

      returnObj.bill = result.getValue({
        name: "custrecord_ctc_vc_bill_number"
      });

      returnObj.billStatus = result.getText({
        name: "custrecord_ctc_vc_bill_proc_status"
      });

      returnObj.poVendor = result.getText({
        name: "entity",
        join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
      });

      returnObj.billAmount = billJson.total;

      returnObj.billDate = result.getValue({
        name: "custrecord_ctc_vc_bill_date"
      });

      returnObj.billDue = result.getValue({
        name: "custrecord_ctc_vc_bill_due_date"
      });

      var po = result.getText({
        name: "custrecord_ctc_vc_bill_linked_po"
      });

      if (po && po !== '') {
        returnObj.po = po.slice(16);
      } else {
        returnObj.po = null;
      }

      returnObj.poId = result.getValue({
        name: "custrecord_ctc_vc_bill_linked_po"
      });

      returnObj.poStatus = result.getText({
        name: "statusref",
        join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
      });

      returnObj.poLoc = result.getText({
        name: "location",
        join: "CUSTRECORD_CTC_VC_BILL_LINKED_PO"
      });

      var logs = result.getValue({
        name: "custrecord_ctc_vc_bill_log"
      });

      var lastLogPosition = logs.lastIndexOf('\r\n');

      if (lastLogPosition !== logs.length && lastLogPosition !== -1) {
        returnObj.logs = logs.slice(lastLogPosition);
      } else {
        returnObj.logs = logs;
      }

      return returnObj;
    }

    return {
      onRequest: onRequest
    };
  });