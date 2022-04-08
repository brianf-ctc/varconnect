define([
        'N/url',
        './CTC_VC_Constants.js'],

function(url,
		constants) {
    function isEmpty(stValue) {
        if ((stValue == '') || (stValue == null) || (stValue == undefined)) {
            return true;
        } else {
            if (typeof stValue == 'string') {
                if ((stValue == '')) {
                    return true;
                }
            } else if (typeof stValue == 'object') {
                if (stValue.length == 0 || stValue.length == 'undefined') {
                    return true;
                }
            }
            return false;
        }
    }
    
    function getNodeTextContent(node){
    	log.debug('node', node);
        if (!isUndefined(node))
            return (node.textContent)
        else
            return null
    }
    
    function isUndefined(value){
        // Obtain `undefined` value that's guaranteed to not have been re-assigned
        var undefined = void(0);
        return value === undefined;
    }
    
    function generateSerialLink(params) {
    	var protocol = 'https://';
    	var domain = url.resolveDomain({
    	    hostType: url.HostType.APPLICATION
    	});
    	var linkUrl = url.resolveScript({
			scriptId: constants.Scripts.Script.VIEW_SERIALS_SL,
			deploymentId: constants.Scripts.Deployment.VIEW_SERIALS_SL,
			params: params
		});

    	return protocol + domain + linkUrl;
    }

    return {
        isEmpty: isEmpty,
        getNodeTextContent: getNodeTextContent,
        generateSerialLink: generateSerialLink
    };
    
});
