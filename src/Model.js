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
    static idAttribute: string = "id";
    static discriminator: string;

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

    static create(attributes?: FieldObject | FieldObject[]): Model | Model[]{
        if (Array.isArray(attributes)){
            let res:Model[] = [];
            for(const cursor of attributes){
                res.push((this.create(cursor):any));
            }
            return res;
        }else {
            let res: Model;
            const id = attributes && attributes[this.idAttribute];
            if (this.discriminator) {
                throw "implement me";
            }
            else {
                res = new this();
            }

            if (id && (typeof id === "number" || typeof id === "string")) {
                let oldCid = this._ormDriver.getCidById(res, id);
                res.cid = oldCid || new Cid();
            } else {
                res.cid = new Cid();
            }

            let defaults = {};
            for (let prop of Object.keys(this.getAttrTypes())) {
                let attrType = this.getAttrTypes()[prop];
                if (attrType.default)
                    defaults[prop] = attrType.default;
            }
            if (id) {
                this._ormDriver.fetch(res, this._resolve(Object.assign(defaults, attributes)));
            } else {
                this._ormDriver.set(res, this._resolve(Object.assign(defaults, attributes)));
            }
            return res;
        }
    }

    static _resolve(setHash: { [string]: FieldValue }): { [string]: FieldValue } {
        const attrTypes = this.getAttrTypes();
        const res = {};
        for (const attrName of Object.keys(attrTypes)) {
            const attrType = attrTypes[attrName];
            const value = setHash[attrName];

            if (value !== undefined) {
                if (Model.isPrototypeOf(attrType.type)) {
                    if (value instanceof attrType.type)
                        res[attrName] = value;
                    else if (isPlainObject(value)) {
                        if (attrType.type.discriminator) {
                            throw "implement me"
                        } else {
                            //$FlowFixMe
                            res[attrName] = attrType.type.create(value);
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

    static observeQuery(query: Query): void {
        this._ormDriver.observeQuery(this, query);
    }

    static async executeQuery(query: Query): Promise<Model[]> {
        return this._ormDriver.executeQuery(this, query);
    }

    static find():Query{
        return new Query(this);
    }


    cid: Cid;
    _subject = new Subject();


    onChange(handler: (value: string) => void) {
        return this._subject.subscribe(handler)
    }

    getClass(): Class<Model> {
        return this.constructor;
    }

    getId(): string | number | null {
        const res = this.get(this.getClass().idAttribute);
        if (res !== null
            && typeof res !== "number"
            && typeof res !== "string") {

            throw "id not valid"
        }
        return res;
    }

    setId(id: string | number): Model {
        this.set({[this.getClass().idAttribute]: id});
        return this;
    }

    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T:Model>(setHash: { [string]: FieldValue }): Promise<Model> {
        setHash = this.getClass()._resolve(setHash);
        const changes = objectDif(this.get(), setHash);
        let res = this;
        if (changes) {
            await this.getClass()._ormDriver.set(this, setHash);
            this._subject.next(this);
        }
        return res;
    }

    async fetch<T:Model>(setHash: { [string]: FieldValue }): Promise<Model> {
        return this.getClass()._ormDriver.fetch(this, setHash);
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
}