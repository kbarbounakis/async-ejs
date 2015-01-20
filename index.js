var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var common = require('common');

var noop = function() {};
var fns = {file:noop};

exports.fn = fns;

var renderFile = function(file, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }

    common.step([
        function(next) {
            fs.readFile(file, 'utf-8', next);
        },
        function(template) {
            render(template, options, callback);
        }
    ], callback);
};
exports.renderFile = renderFile;

if(!Object.getPrototypeOf) {
    if(({}).__proto__===Object.prototype&&([]).__proto__===Array.prototype) {
        Object.getPrototypeOf=function getPrototypeOf(object) {
            return object.__proto__;
        };
    } else {
        Object.getPrototypeOf=function getPrototypeOf(object) {
            // May break if the constructor has been changed or removed
            return object.constructor?object.constructor.prototype:void 0;
        };
    }
}

var render = function(src, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    options.locals = options.locals || {};

    fns.file = function(filename, callback) {
        renderFile(filename, options, callback);
    };
    //get prototype of options.local
    var proto = Object.getPrototypeOf(options.locals);
    if (proto) {
        var keys = Object.keys(proto);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (typeof proto[key] === 'function')
                fns[key] = proto[key];
        }
    }
    var fns_local = {};
    common.step([
        function(next) {
            var args = [];
            Object.keys(fns).forEach(function(name) {
                options.locals[name] = function() {
                    args.push([name].concat(Array.prototype.slice.call(arguments)));
                };
            });

            var result = ejs.render(src, options);
            if (!args.length) {
                callback(null, result);
                return;
            }

            args.forEach(function(arg) {
                var name = arg.shift();
                arg.push(next.parallel());
                fns[name].apply(options.locals, arg);
            });
        },
        function(results, next) {
            var i = 0;
            Object.keys(fns).forEach(function(name) {
                options.locals[name] = function() {
                    return results[i++];
                }
            });
            src = ejs.render(src, options);
            callback(null,src);
        }
    ], callback);
};
exports.render = render;

var add = function(name, fn) {
    if (typeof name === 'object') {
        for (var i in name) {
            add(i, name[i]);
        }
        return exports;
    }
    fns[name] = fn;

    return exports;
};
exports.add = add;