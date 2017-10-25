// @flow
import merge from "lodash.merge"
import type {OrmDriver} from "./OrmDriver";

export type Field = number|string|boolean|null|Model|Field[];
export type AttrType = {
    type:"number"|"string"|"boolean"|Class<Model>|[Class<Model>],
    default:Field
}
export type AttrTypes = {[string]:AttrType};
export class Cid{
    static lastCid = 0;
    cid=Cid.lastCid++;
    toString(){
        return `cid#${this.cid}`;
    }
    equalsTo(cid:Cid){
        return this.cid === cid.cid;
    }
}

export default class Model{
    static _ormDriver:OrmDriver;
    static _attrTypes:AttrTypes = {};
    static idAttribute:string = "id";

    static get attrTypes():AttrTypes{
        if (this.superclass.attrTypes) {
            return merge({}, this.superclass.attrTypes, this._attrTypes);
        }
        else {
            return this._attrTypes;
        }
    }

    static get superclass(){
        return Object.getPrototypeOf(this);
    }

    get class():Class<Model>{
        return this.constructor;
    }

    get id():string|number|null{
        const res = this.get(this.class.idAttribute);
        if (res!==null
            && typeof res !== "number"
            && typeof res !== "string"){

            throw "id not valid"
        }
        return res;
    }

    constructor<T:Model>(properties?:{[$Keys<T>]:Field}){
        let defaults = {};
        for(let prop of Object.keys(this.class.attrTypes)){
            let attrType = this.class.attrTypes[prop];
            if (attrType.default)
                defaults[prop] = attrType.default;
        }
        this.class._ormDriver.set(this, Object.assign(defaults,properties));
    }

    cid = new Cid();
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:Model>(setHash: {[$Keys<T>]:Field}): Model{
        return this.class._ormDriver.set(this, setHash);
    }

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T:Model>(key?: string): Field|{ [$Keys<T>]: Field }{
        return this.class._ormDriver.get(this, key);
    }
}