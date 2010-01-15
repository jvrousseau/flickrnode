var sys = require("sys"),
   http = require("http"),
   md5 = require('./md5');

var flickr_request = http.createClient(80, "api.flickr.com");

Request= function Request(api_key, shared_secret, auth_token) {
    this._configure(api_key, shared_secret, auth_token);
};

Request.prototype._configure= function(api_key, shared_secret, auth_token) {
    this.api_key= api_key;
    this.shared_secret= shared_secret;
    this.auth_token= auth_token;
};

Request.prototype.setAuthenticationToken= function(auth_token) {
    this._configure(this.api_key, this.shared_secret, auth_token);
};

Request.prototype.generateSignature= function(shared_secret, arguments) {
    var argument_pairs= [];
    for(var key in arguments ) {
        argument_pairs[argument_pairs.length]= [key, arguments[key]];
    }
    
    argument_pairs.sort(function(a,b) {
        if ( a[0]== b[0] ) return 0 ;
        return a[0] < b[0] ? -1 : 1;  
    });
    var args= "";
    for(var i=0;i<argument_pairs.length;i++) {
        args+= argument_pairs[i][0];
        args+= argument_pairs[i][1];
    }
    var sig= shared_secret+args;
    return md5.md5(sig);
};

Request.prototype.getRequestPromise= function(method, arguments, sign_it, result_mapper) {
    var promise= new process.Promise()
    var argumentString = "";
    var api_sig= undefined;
    if( arguments === undefined )  arguments = {};

    // apply default arguments 
    arguments.format= "json";
    arguments.nojsoncallback= "1";
    arguments["method"]= method;
    arguments.api_key= this.api_key;
    if( this.auth_token ) arguments.auth_token= this.auth_token;
    
    if( this.shared_secret && (sign_it || this.auth_token) ) {
        api_sig= this.generateSignature(this.shared_secret, arguments);
        if( api_sig ) {
            arguments.api_sig= api_sig;
        }
    }
    var operator= "?";
    for(var key in arguments) {
        argumentString+= (operator + key + "=" + arguments[key]);
        if( operator == "?" ) operator= "&";
    }
    var request= flickr_request.request("GET", 
                          "/services/rest"+ argumentString, 
                          {"host": "api.flickr.com"});
    request.finish(function (response) {
        var result= "";
        response.setBodyEncoding("utf8");
        response.addListener("body", function (chunk) {
          result+= chunk;
        });
        response.addListener("complete", function () {
            var res= JSON.parse(result);
            if( res.stat == "ok" ) {
                // Munge the response to strip out the stat and just return the response value
                for(var key in res) {
                    if( key !== "stat" ) {
                        res= res[key];
                    }
                }
                if( result_mapper ) {
                    res= result_mapper(res);
                }
                promise.emitSuccess(res);
            } 
            else {
                promise.emitError({code: res.code, message: res.message});
            }
        });
    });       
    return promise;                   
};

exports.Request = Request;