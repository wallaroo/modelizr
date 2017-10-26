// @flow
import merge from "lodash.merge"
import type {OrmDriver} from "./OrmDriver";
import {Subject} from "rxjs/Subject";
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

    static getAttrTypes():AttrTypes{
        const superClass = this.getSuperClass();
        if (Model.isPrototypeOf(superClass)) {
            // $FlowFixMe
            return merge({}, superClass.getAttrTypes(), this._attrTypes);
        }
        else {
            return this._attrTypes;
        }
    }

    static getSuperClass(){
        return Object.getPrototypeOf(this);
    }

    cid:Cid;
    _subject = new Subject();

    constructor<T:Model>(properties?:{[string]:Field}){
        const id = properties && properties[this.getClass().idAttribute];
        if(id && (typeof id === "number" || typeof id === "string")){
            let oldCid = this.getClass()._ormDriver.getCidById(this, id);
            this.cid=oldCid || new Cid();
        }else{
            this.cid=new Cid();
        }

        let defaults = {};
        for(let prop of Object.keys(this.getClass().getAttrTypes())){
            let attrType = this.getClass().getAttrTypes()[prop];
            if (attrType.default)
                defaults[prop] = attrType.default;
        }
        this.getClass()._ormDriver.set(this, Object.assign(defaults,properties));
    }

    onChange(handler:(value:string)=>void){
        return this._subject.subscribe(handler)
    }

    getClass():Class<Model>{
        return this.constructor;
    }

    getId():string|number|null{
        const res = this.get(this.getClass().idAttribute);
        if (res!==null
            && typeof res !== "number"
            && typeof res !== "string"){

            throw "id not valid"
        }
        return res;
    }
    setId(id:string|number):Model{
        this.set({[this.getClass().idAttribute]:id});
        return this;
    }


    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T:Model>(setHash: {[string]:Field}): Promise<Model>{
        return this.getClass()._ormDriver.set(this, setHash);
    }

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    async get<T:Model>(key?: string): Promise<Field|{ [string]: Field }>{
        return this.getClass()._ormDriver.get(this, key);
    }
}