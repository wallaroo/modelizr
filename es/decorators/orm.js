"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function () {
    return function orm(target, key, descriptor) {
        target.attrTypes[key] = descriptor;
        console.log(target, key, descriptor);
        return descriptor;
    };
};
//# sourceMappingURL=orm.js.map