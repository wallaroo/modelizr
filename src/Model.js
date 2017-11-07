// @flow
import merge from "lodash.merge"
import isPlainObject from "lodash.isplainobject"
import type {OrmDriver} from "./OrmDriver";
import {objectDif} from "./utils"
import {Subject} from "rxjs/Subject";
import Query from "./Query";

export type FieldValue = number | string | boolean | null | Model | FieldValue[];
export type FieldObject = { [string]: FieldValue };
export type AttrType = {
    type: "number" | "string" | "boolean" | Class<Model> | [Class<Model>],
    default: FieldValue
}
export type AttrTypes = { [string]: AttrType };

export class Cid {
    static lastCid = 0;
    cid = Cid.lastCid++;

    toString() {
        return `cid#${this.cid}`;
    }

    equalsTo(cid: Cid) {
        return this.cid === cid.cid;
    }
}

export default class Model {
    static _ormDriver: OrmDriver;
    static _attrTypes: AttrTypes = {};
    static _idAttribute: string;
    static discriminator: string;
    cid: Cid;
    _subject = new Subject();
    _subs = {};

    static getAttrTypes(): AttrTypes {
        const superClass = this.getSuperClass();
        if (Model.isPrototypeOf(superClass)) {
            // $FlowFixMe
            return merge({}, superClass.getAttrTypes(), this._attrTypes);
        }
        else {
            return this._attrTypes;
        }
    }

    static getSuperClass() {
        return Object.getPrototypeOf(this);
    }

    static async create(attributes?: FieldObject | FieldObject[]): Promise<Model | Model[]>{
        if (Array.isArray(attributes)){
            let res:Model[] = [];
            for(const cursor of attributes){
                res.push(await (this.create(cursor):any));
            }
            return res;
        }else {
            let res: Model|null = null;
            const id = attributes && attributes[this._idAttribute];
            if (id){
                res = await this._ormDriver.getModelById(this, ((id:any):string|number));
            }
            if (!res) {
                if (this.discriminator) {
                    throw "implement me";
                }
                else {
                    res = new this();
                    res.cid = new Cid();
                }
            }

            let defaults = {};
            for (let prop of Object.keys(this.getAttrTypes())) {
                let attrType = this.getAttrTypes()[prop];
                if (attrType.default)
                    defaults[prop] = attrType.default;
            }
            if (id) {
                await res.fetch(Object.assign(defaults, attributes));
            } else {
                await res.set(Object.assign(defaults, attributes));
            }
            return res;
        }
    }

    static async _resolve(setHash: { [string]: FieldValue }, owner:Model): Promise<{ [string]: FieldValue }> {
        const attrTypes = this.getAttrTypes();
        const res = {};
        for (const attrName of Object.keys(attrTypes)) {
            const attrType = attrTypes[attrName];
            const value = setHash[attrName];

            if (value !== undefined) {
                if (Model.isPrototypeOf(attrType.type)) {
                    if (value === null){
                        res[attrName] = value;
                    }else if (value instanceof attrType.type) {
                        res[attrName] = value;
                    }else if (isPlainObject(value)) {
                        if (attrType.type.discriminator) {
                            throw "implement me"
                        } else {
                            //$FlowFixMe
                            res[attrName] = await attrType.type.create(value);
                        }
                    } else {
                        throw `invalid type of ${+value}; expecting ${+attrType.type}`
                    }
                } else {
                    res[attrName] = value;
                }
            }
        }
        return res;
    }

    static async observeQuery(query: Query): Promise<void> {
        return this._ormDriver.observeQuery(this, query);
    }

    static async executeQuery(query: Query): Promise<Model[]> {
        return this._ormDriver.executeQuery(this, query);
    }

    static find():Query{
        return new Query(this);
    }

    static where(...args):Query{
        return (new Query(this)).where(...args);
    }

    async _resolve(setHash: { [string]: FieldValue }): { [string]: FieldValue } {
        return this.getClass()._resolve(setHash, this);
    }


    onChange(handler: (value: string) => void) {
        return this._subject.subscribe(handler)
    }

    getClass(): Class<Model> {
        return this.constructor;
    }

    getId(): string | number | null {
        return this.getClass()._ormDriver.getId(this);
    }

    setId(id: string | number): Model {
        this.getClass()._ormDriver.set(this, {[this.getClass()._idAttribute]: id});
        return this;
    }

    _processChanges(current:{ [string]: FieldValue }, next:{ [string]: FieldValue }):void{
        const attrTypes = this.getClass().getAttrTypes();
        for (const attrName of Object.keys(next)){
            const attr = attrTypes[attrName];

            if(Model.isPrototypeOf(attr.type)){
                if (current
                    && current[attrName]
                    && (
                        !next[attrName]
                        // $FlowFixMe
                        || current[attrName].cid.toString() !== next[attrName].cid.toString()
                    )
                ){
                    // $FlowFixMe
                    this._subs[current[attrName].cid.toString()].unsubscribe();
                    // $FlowFixMe
                    this._subs[current[attrName].cid.toString()] = null;
                }
                if (next[attrName]
                    && (
                        !current
                        || !current[attrName]
                        // $FlowFixMe
                        || current[attrName].cid.toString() !== next[attrName].cid.toString()
                    )){
                    // $FlowFixMe
                    this._subs[next[attrName].cid.toString()] = next[attrName]._subject.subscribe(this._subject);
                }

            }
        }
    }

    clone():Model{
        const res = new (this.getClass())();
        res.cid = this.cid;
        res._subject = this._subject;
        return res;
    }

    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T:Model>(setHash: { [string]: FieldValue }): Promise<Model> {
        setHash = await this._resolve(setHash);
        const currentValues = await this.get();
        const changes = objectDif(currentValues, setHash);
        let res = this;
        if (changes) {
            this._processChanges(currentValues, changes);
            this.getClass()._ormDriver.set(this, setHash);
            res = this.clone();
            this._subject.next(res);

        }
        return res;
    }

    async fetch<T:Model>(setHash: { [string]: FieldValue }): Promise<Model> {
        setHash = await this._resolve(setHash);
        const currentValues = await this.get();
        const changes = objectDif(currentValues, setHash);
        let res = this;
        if (changes) {
            this._processChanges(currentValues, changes);
            this.getClass()._ormDriver.fetch(this, setHash);
            res = this.clone();
            this._subject.next(res);
        }
        return res;
    }

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    async get<T:Model>(key?: string): Promise<FieldValue | { [string]: FieldValue }> {
        return this.getClass()._ormDriver.get(this, key);
    }

    getChanges(): { [string]: FieldValue } | null {
        return this.getClass()._ormDriver.getChanges(this);
    }

    hasChanges = this.getChanges;

    async save():Promise<Model>{
        return this.getClass()._ormDriver.save(this);
    }

    async delete():Promise<void>{
        return this.getClass()._ormDriver.delete(this);
    }
}