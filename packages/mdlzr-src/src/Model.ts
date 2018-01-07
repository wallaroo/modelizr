import {OrmDriver} from "./OrmDriver";
import {objectDif} from "./utils"
import {Subject} from "rxjs/Subject";
import Query from "./Query";
import Collection from "./Collection";
import {ISubscription} from "rxjs/Subscription";
import {Operator} from "./Query";

const merge = require("lodash.merge");
const isPlainObject = require("lodash.isplainobject");

export type ModelClass = typeof Model;
export type FieldValue = number | string | boolean | null | Model | number[] | string[] | boolean[] | Model[];
export type FieldObject = { [key: string]: FieldValue | FieldObject };
export type AttrType = {
    type?: "number" | "string" | "boolean" | "date" | "object" | ModelClass | [ModelClass],
    default?: FieldValue,
    readOnly?: boolean,
    required?: boolean,
    embedded?: boolean,
    setter?: (value: any) => any,
    getter?: (value: any) => any,
    transient?: boolean
}
export type AttrTypes = { [key: string]: AttrType };
export type IObservable = {
    observe: (handler: (value: any) => void) => ISubscription
}
export type ISubscription = ISubscription;

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

export default class Model implements IObservable {
    static _ormDriver: OrmDriver;
    static _attrTypes: AttrTypes = {};
    static _idAttribute: string;
    static _collection: Collection<any>;
    static discriminator: string;
    cid: Cid;
    _subject = new Subject();
    _subs: { [k: string]: ISubscription } = {};

    static getAttrTypes(): AttrTypes {
        const superClass = this.getSuperClass();
        if (Model.isPrototypeOf(superClass)) {
            return merge({}, superClass.getAttrTypes(), this._attrTypes);
        }
        else {
            return this._attrTypes;
        }
    }

    static getCollection<T extends Model>(): Collection<T> {
        if (!this._collection) {
            this._collection = new Collection(this);
        }
        return this._collection;
    }

    static getSuperClass() {
        return Object.getPrototypeOf(this);
    }

    static async getById(id: string | number): Promise<Model | null> {
        return this._ormDriver.getModelById(this, id);
    }

    static async create<T extends Model>(attributes?: FieldObject | FieldObject[]): Promise<T | T[]> {
        if (Array.isArray(attributes)) {
            let res: T[] = [];
            for (const cursor of attributes) {
                res.push(await this.create(cursor) as T);
            }
            return res;
        } else {
            let res: T = null;
            const id = attributes && attributes[this._idAttribute];
            if (id) {
                res = await this._ormDriver.getModelById<T>(this, (id as string | number));
            }
            if (!res) {
                if (this.discriminator) {
                    throw "implement me";
                }
                else {
                    res = new this() as T;
                    res.cid = new Cid();
                }
            }

            let defaults: { [key: string]: FieldValue } = {};
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

    static async _resolve(setHash: FieldObject, owner: Model): Promise<FieldObject> {
        const attrTypes = this.getAttrTypes();
        const res: FieldObject = {};
        for (const attrName of Object.keys(attrTypes)) {
            const attrType = attrTypes[attrName];
            const value = setHash[attrName];

            if (value !== undefined) {
                if (Model.isPrototypeOf(attrType.type)) {
                    if (value === null) {
                        res[attrName] = value;
                    } else if (typeof attrType.type === "function" && value instanceof attrType.type) {
                        res[attrName] = value;
                    } else if (isPlainObject(value)) {
                        if ((attrType.type as ModelClass).discriminator) {
                            throw "implement me"
                        } else {
                            res[attrName] = await (attrType.type as ModelClass).create(value as FieldObject);
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

    static getOrmDriver(): OrmDriver {
        return this._ormDriver;
    }

    static observeQuery<T extends Model>(query: Query<T>, handler: (array: T[]) => void): ISubscription {
        // $FlowFixMe
        return this._ormDriver.observeQuery(this, query, handler);
    }

    static async executeQuery<T extends Model>(query: Query<T>): Promise<T[]> {
        // $FlowFixMe
        return this._ormDriver.executeQuery(this, query);
    }

    static find<T extends Model>(): Query<T> {
        return new Query(this);
    }

    static where<T extends Model>(field: string, operator?: Operator, value?: string): Query<T> {
        return (new Query<T>(this)).where(field, operator, value);
    }

    static orderBy<T extends Model>(...fields: string[]): Query<T> {
        return (new Query<T>(this)).orderBy(...fields);
    }

    static limit<T extends Model>(number: number): Query<T> {
        return (new Query<T>(this)).limit(number);
    }

    static startAt<T extends Model>(number: number): Query<T> {
        return (new Query<T>(this)).startAt(number);
    }


    async _resolve(setHash: FieldObject): Promise<FieldObject> {
        return this.getClass()._resolve(setHash, this);
    }


    onChange(handler: (value: string) => void): ISubscription {
        return this._subject.subscribe(handler)
    }

    observe = this.onChange;

    // [Symbol.observable](){
    //     return this._subject;
    // };

    getClass(): ModelClass {
        return this.constructor as ModelClass;
    }

    getId(): string | number | null {
        return this.getClass()._ormDriver.getId(this);
    }

    getRef(): { [k: string]: string | number | null } {
        return {[this.getClass()._idAttribute]: this.getId()}
    }

    setId(id: string | number): Model {
        this.getClass()._ormDriver.set(this, {[this.getClass()._idAttribute]: id});
        return this;
    }

    _processChanges(current: FieldObject, next: FieldObject): void {
        const attrTypes = this.getClass().getAttrTypes();
        for (const attrName of Object.keys(next)) {
            const attr = attrTypes[attrName];

            if (Model.isPrototypeOf(attr.type)) {
                const curr = current as { [k: string]: Model };
                const nxt = next as { [k: string]: Model };
                if (curr
                    && curr[attrName]
                    && (
                        !next[attrName]
                        || curr[attrName].cid.toString() !== nxt[attrName].cid.toString()
                    )
                ) {
                    this._subs[curr[attrName].cid.toString()].unsubscribe();
                    this._subs[curr[attrName].cid.toString()] = null;
                }

                if (nxt[attrName]
                    && (
                        !curr
                        || !curr[attrName]
                        || curr[attrName].cid.toString() !== nxt[attrName].cid.toString()
                    )) {

                    this._subs[nxt[attrName].cid.toString()] = nxt[attrName]._subject.subscribe(this._subject);
                }

            }
        }
    }

    clone<T extends Model>(): T {
        const res = new (this.getClass())();
        res.cid = this.cid;
        res._subject = this._subject;
        res._subs = this._subs;
        return res as T;
    }

    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T extends Model>(setHash: FieldObject): Promise<T> {
        setHash = await this._resolve(setHash);
        const currentValues = await this.getAttributes();
        const changes = objectDif(currentValues, setHash);
        for(const key of Object.keys(setHash)) {
            const attrType = this.getAttrType(key);
            if (attrType.setter){
                setHash[key] = attrType.setter.call(this,setHash[key]);
            }
        }
        let res = this as any;
        if (changes) {
            this._processChanges(currentValues, changes);
            res = await this.getClass()._ormDriver.set(res, setHash);
            this._subject.next(res);
        }
        return res;
    }

    async fetch<T extends Model>(setHash: FieldObject): Promise<T> {
        setHash = await this._resolve(setHash);
        const currentValues = await this.getAttributes();
        const changes = objectDif(currentValues, setHash);
        let res = this as any;
        if (changes) {
            this._processChanges(currentValues, changes);
            res = await this.getClass()._ormDriver.fetch(res, setHash);
            this._subject.next(res);
        }
        return res;
    }

    getAttrType(attrName:string):AttrType{
        return this.getClass().getAttrTypes()[attrName];
    }
    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T extends Model>(key: string): FieldValue {
        let res = this.getClass()._ormDriver.get(this, key) || null;
        const attrType = this.getAttrType(key);
        if (attrType.getter){
            res = attrType.getter.call(this,res);
        }
        return res;
    }

    getAttributes<T extends Model>(): FieldObject {
        return this.getClass()._ormDriver.getAttributes(this);
    }

    getChanges(): FieldObject | null {
        return this.getClass()._ormDriver.getChanges(this);
    }

    hasChanges = this.getChanges;

    async save(): Promise<Model> {
        return this.getClass()._ormDriver.save(this);
    }

    async delete(): Promise<void> {
        return this.getClass()._ormDriver.delete(this);
    }
}