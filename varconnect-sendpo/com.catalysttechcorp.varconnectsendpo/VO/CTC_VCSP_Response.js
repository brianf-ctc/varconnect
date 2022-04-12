define([], function () {
    function Response(options) {
        this.code = options.code;
        this.message = options.message;
        this.transactionNum = options.transactionNum;
    }

    return Response;
});
