// @flow
import merge from "lodash.merge"
import OrmDriver from "./OrmDriver";
export type AttrType = {

}
export type AttrTypes = {[string]:AttrType}


export default class Model{
    static _ormDriver:OrmDriver;
    static _attrTypes:AttrTypes = {};
    static get attrTypes():AttrTypes{
        if (this.superclass.attrTypes) {
            return merge({}, this.superclass.attrTypes, this._attrTypes);
        }
        else {
            return this._attrTypes;
        }
    }
    static get superclass():* {
        return Object.getPrototypeOf(this);
    }
    get class():Class<Model>{
        return this.constructor;
    }
    toString():string{
        return ""
    }
}