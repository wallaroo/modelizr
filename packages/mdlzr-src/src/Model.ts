import {OrmDriver} from "./OrmDriver";
import {isEmpty, objectDif} from "./utils"
import {Subject} from "rxjs/Subject";
import Query from "./Query";
import Collection from "./Collection";
import {ISubscription} from "rxjs/Subscription";

const merge = require("lodash.merge");
const isPlainObject = require("lodash.isplainobject");

export type ModelClass<T extends Model = Model> = { new (): T } & typeof Model;
export type FieldValue = any;

export interface FieldObject extends Object {
  [key: string]: FieldValue | FieldObject
}

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
  // protected static _ormDriver: OrmDriver;
  protected static _attrTypes: AttrTypes = {};
  static idAttribute: any;
  protected static _collection: Collection<Model>;
  protected static discriminator: string;
  public cid: Cid = new Cid();
  protected attributes: any = {};
  protected changes: any = {};

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

  static getCollection<T extends Model>(this:ModelClass<T>): Collection<T> {
    if (!this._collection) {
      this._collection = new Collection(this);
    }
    return this._collection as Collection<T>;
  }

  static getSuperClass() {
    return Object.getPrototypeOf(this);
  }

  static async getById(ormDriver: OrmDriver, id: string | number): Promise<Model | null> {
    return ormDriver.getModelById(this, id);
  }

  static create<T extends Model>(this: ModelClass<T>): T;
  static create<T extends Model>(this: ModelClass<T>, attributes: Array<FieldObject>): T[];
  static create<T extends Model>(this: ModelClass<T>, attributes: FieldObject): T;
  static create<T extends Model>(this: ModelClass<T>, attributes?: FieldObject | Array<FieldObject>): T | T[] {
    if (Array.isArray(attributes)) {
      let res: T[] = [];
      for (const cursor of attributes) {
        res.push(this.create(cursor) as T);
      }
      return res;
    } else {
      let res: T | null = null;
      const id = attributes && attributes[this.idAttribute];
      // if (id) {
      //   res = await this._ormDriver.getModelById<T>(this, (id as string | number));
      // }
      if (!res) {
        if (this.discriminator) {
          throw "implement me";
        }
        else {
          res = new this() as T;
        }
      }

      let defaults: { [key: string]: FieldValue } = {};
      for (let prop of Object.keys(this.getAttrTypes())) {
        let attrType = this.getAttrTypes()[prop];
        if (attrType.default)
          defaults[prop] = attrType.default;
      }
      if (id) {
        res = res.fetch(Object.assign(defaults, attributes));
      } else {
        res = res.set(Object.assign(defaults, attributes));
      }
      return res;
    }
  }

  static _resolve(setHash: FieldObject, owner: Model): FieldObject {
    const attrTypes = this.getAttrTypes();
    const res: FieldObject = {};
    for (const attrName of Object.keys(attrTypes)) {
      const attrType = attrTypes[attrName];
      const value = setHash[attrName];

      if (value !== undefined) {
        if (Model.isPrototypeOf(<any> attrType.type)) {
          if (value === null) {
            res[attrName] = value;
          } else if (typeof attrType.type === "function" && value instanceof attrType.type) {
            res[attrName] = value;
          } else if (isPlainObject(value)) {
            if ((attrType.type as ModelClass).discriminator) {
              throw "implement me"
            } else {
              res[attrName] = (attrType.type as ModelClass).create(value as FieldObject);
            }
          } else {
            throw `invalid type of ${value}; expecting ${attrType.type}`
          }
        } else {
          res[attrName] = value;
        }
      }
    }
    return res;
  }

  // static getOrmDriver(): OrmDriver {
  //   return this._ormDriver;
  // }

  static observeQuery<T extends Model>(ormDriver: OrmDriver, query: Query<T>, handler: (array: T[]) => void): ISubscription {
    return ormDriver.observeQuery(this as ModelClass<T>, query, handler);
  }

  static async executeQuery<T extends Model>(ormDriver: OrmDriver, query: Query<T>): Promise<T[]> {
    return ormDriver.executeQuery(this as ModelClass<T>, query);
  }

  static find<T extends Model>(this:ModelClass<T>,ormDriver:OrmDriver): Query<T> {
    return new Query(ormDriver,this);
  }

  resolve(setHash: FieldObject): FieldObject {
    return this.getClass()._resolve(setHash, this);
  }


  onChange(handler: (value: {}) => void): ISubscription {
    return this._subject.subscribe(handler)
  }

  observe = this.onChange;

  // [Symbol.observable](){
  //     return this._subject;
  // };

  getClass(): ModelClass<this> {
    return this.constructor as ModelClass<this>;
  }

  getId(): string | number | null {
    return this.get(this.getClass().idAttribute);
  }

  getRef(): { [k: string]: string | number | null } {
    return {[this.getClass().idAttribute]: this.getId()}
  }

  setId(id: string | number): this {
    return this.set({[this.getClass().idAttribute]: id});
  }

  private _processChanges(current: FieldObject, next: FieldObject): void {
    const attrTypes = this.getClass().getAttrTypes();
    for (const attrName of Object.keys(next)) {
      const attr = attrTypes[attrName];

      if (Model.isPrototypeOf(<any>attr.type)) {
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
          delete this._subs[curr[attrName].cid.toString()];
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

  clone(): this {
    const res = new (this.getClass())();
    res.cid = this.cid;
    res._subject = this._subject;
    res._subs = this._subs;
    res.attributes = Object.assign({},this.attributes);
    res.changes = Object.assign({},this.changes);
    return res;
  }

  /**
   * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
   */
  set<T extends Model>(setHash: FieldObject): this {
    setHash = this.resolve(setHash);
    const currentValues = this.getAttributes();
    const changes = objectDif(currentValues, setHash);
    for (const key of Object.keys(setHash)) {
      const attrType = this.getAttrType(key);
      if (attrType.setter) {
        setHash[key] = attrType.setter.call(this, setHash[key]);
      }
    }
    let res = this as any;
    if (changes) {
      res = this.clone();
      this._processChanges(currentValues, changes);
      Object.assign(res.changes, changes);
      this._subject.next(res);
    }
    return res;
  }

  fetch<T extends Model>(setHash: FieldObject): this {
    setHash = this.resolve(setHash);
    const changes = objectDif(this.getAttributes(), setHash);
    let res = this as any;
    if (changes) {

      this._processChanges(this.getAttributes(), changes);
      res = this.clone();
      Object.assign(res.attributes, changes);
      res.changes = objectDif(res.attributes, res.changes) || {};
      this._subject.next(res);
    }else{
      Object.assign(res.attributes, res.changes);
      res.changes = {};
    }
    return res;
  }

  getAttrType(attrName: string): AttrType {
    return this.getClass().getAttrTypes()[attrName];
  }

  /**
   * Gets the current value for the given property
   * if key is null gets all properties hash
   */
  get(key: string): any {
    let res = this.getAttributes()[key];
    const attrType = this.getAttrType(key);
    if (attrType.getter) {
      res = attrType.getter.call(this, res);
    }
    return res === undefined ? null : res;
  }

  getAttributes(): any {
    return Object.assign({}, this.attributes, this.changes);
  }

  getChanges(): FieldObject | null {
    if (isEmpty(this.changes)){
      return null;
    }else {
      return Object.assign({}, this.changes);
    }
  }

  async save<T extends Model>(this:T, ormDriver: OrmDriver): Promise<T> {
    return ormDriver.save(this);
  }

  async delete(ormDriver: OrmDriver): Promise<void> {
    return ormDriver.delete(this);
  }
}