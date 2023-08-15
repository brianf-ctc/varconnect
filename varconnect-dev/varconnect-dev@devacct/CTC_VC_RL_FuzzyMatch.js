/**
 * Copyright (c) 2022 Catalyst Tech Corp
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Catalyst Tech Corp. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Catalyst Tech.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/**
 * CTC_VC_RL_FuzzyMatch
 * Module Description
 *
 * Version	Date            Author		Remarks
 * 1.00		Oct 31, 2022    brianf      Initial build
 */

define(['./Bill Creator/Libraries/fuse.js'], function (Fuse) {
    var LogTitle = 'FuzzyItemMatch',
        LogPrefix = '';

    /**
        Data to expect
        {
        list: [ array of objects ], 
        keys: [ array of fieldnames ], 
        searchValue: string to search, 
        fuzzy search
    }
    */
    var RESTLET = {
        post: function (scriptContext) {
            var logTitle = [LogTitle, 'POST'].join('::'),
                returnObj = {};

            try {
                var arrItemList = scriptContext.list,
                    fieldKeys = scriptContext.keys,
                    searchValue = scriptContext.searchValue;
                log.audit(
                    logTitle,
                    '>> scriptContext:  ' + JSON.stringify(scriptContext)
                );

                const fuseOption = {
                    includeScore: true,
                    threshold: 0.4,
                    keys: fieldKeys
                };
                log.audit(
                    logTitle,
                    '... fuseOption:  ' + JSON.stringify(fuseOption)
                );

                const fuseObj = new Fuse(arrItemList, fuseOption);
                log.audit(logTitle, '... fuseObj:  ' + JSON.stringify(fuseObj));

                var fuseOutput = fuseObj.search(searchValue);
                log.audit(
                    logTitle,
                    '... fuseOutput:  ' + JSON.stringify(fuseOutput)
                );

                if (!fuseOutput.length) throw 'Empty search';
                returnObj.match = fuseOutput[0].item;
            } catch (error) {
                // log.error(logTitle, '## ERROR ## ' + JSON.stringify(error));
                log.error(logTitle, error);
                returnObj = { status: 'error', message: error };
            } finally {
                log.audit(
                    logTitle,
                    '/// returnObj:  ' + JSON.stringify(returnObj)
                );
            }

            return returnObj;
        }
    };
    return RESTLET;
});
