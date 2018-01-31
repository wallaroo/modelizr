import {OrmDriver} from "../OrmDriver";
import {FieldValue, ModelClass} from "../Model"
import Model, {Cid} from "../Model";
import {objectDif} from "../utils";

import Query from "../Query";
import Collection from "../Collection";
import {ISubscription} from "rxjs/Subscription";
import {FieldObject} from "../Model";

const merge = require("lodash.merge");

export type StoreItem = {
  model: Model,
  attributes: FieldObject,
  changes: FieldObject | null,
}

export default class SimpleOrm implements OrmDriver {
  _lastId: number = 0;
  _store: {
    "byCid": {
      [cid: string]: StoreItem
    },
    "byId": {
      [model: string]: { [id: string]: Cid }
    }
  } = {
    byCid: {},
    byId: {}
  };

  constructor(opts?: {
    executeQuery: (modelClass: ModelClass, query: Query<Model>) => Promise<Model[]>,
    observeQuery: (modelClass: ModelClass, query: Query<Model>) => void
  }) {
    //$FlowFixMe
    Object.assign(this, opts);
  }

  /**
   * gets the model by its id or null if doesn't exists
   */
  async getModelById<T extends Model>(model: ModelClass,
                                      id: string | number,
                                      collection: Collection<T> = model.getCollection()): Promise<T | null> {
    let res = null;
    const cid = this.getCidById(model, id);
    if (cid) {
      res = this.getModelByCid(cid);
    }
    return res as T;
  }

  /**
   * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
   */
  getModelByCid(cid: Cid): Model | null {
    return this._store.byCid[`${cid.toString()}`].model;
  }

  getCidById(model: ModelClass, id: string | number): Cid | null {
    const storeItem = this._store.byId[model.getCollection().name];
    return storeItem ? storeItem[`${id}`] : null;
  }

  /**
   * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
   */
  set<T extends Model>(model: T, setHash: FieldObject): T {
    //ensure last model for immutability
    if (this._store.byCid[model.cid.toString()])
      model = this._store.byCid[model.cid.toString()].model as T;
    const sCid = model.cid.toString();
    let storeItem = this._store.byCid[sCid];
    if (storeItem) {
      let changes = objectDif(storeItem.attributes, Object.assign({}, storeItem.changes, setHash));
      if (changes) {
        model = model.clone()
      }
      this._store.byCid[sCid] = {...storeItem, changes, model};
    } else {
      this._store.byCid[sCid] = {changes: setHash, attributes: {}, model: model};
    }
    return model;
  }

  fetch<T extends Model>(model: T, setHash: FieldObject): T {
    //ensure last model for immutability
    if (this._store.byCid[model.cid.toString()])
      model = this._store.byCid[model.cid.toString()].model as T;
    const sCid = model.cid.toString();
    let storeItem = this._store.byCid[sCid];
    storeItem = {
      attributes: merge({}, storeItem && storeItem.attributes, setHash),
      changes: null,
      model: model
    };
    this._store.byCid[sCid] = storeItem;
    const id = this.getId(model);
    if (id) {
      if (!this._store.byId[model.getClass().getCollection().name]) {
        this._store.byId[model.getClass().getCollection().name] = {}
      }
      this._store.byId[model.getClass().getCollection().name][`${id}`] = model.cid
    }
    return model;
  }

  _get(model: Model): FieldObject {
    const sCid = model.cid.toString();
    const storeItem = this._store.byCid[sCid];
    return Object.assign({}, storeItem.attributes, storeItem.changes);
  }

  getId(model: Model): number | string | null {
    const values = this._get(model);
    const res = values[model.getClass()._idAttribute] || null;
    if (res !== null && typeof res !== "string" && typeof res !== "number") {
      throw "invalid id "
    }
    return res as number | string | null;
  }

  setId<T extends Model>(model: T, id: string | number): T {
    const sCid = model.cid.toString();
    const storeItem = this._store.byCid[sCid];
    if (storeItem.attributes[model.getClass()._idAttribute] !== id) {
      storeItem.attributes[model.getClass()._idAttribute] = id;
      model = model.clone()
    }
    return model;
  }

  /**
   * Gets the current value for the given property
   * if key is null gets all properties hash
   */
  get<T extends Model>(model: T, key: string): FieldValue {
    let storeItem = this._store.byCid[model.cid.toString()];
    let res = null;
    if (storeItem) {
      res = (storeItem.changes && storeItem.changes[key]) || storeItem.attributes[key];
    }
    return res as FieldValue;
  }

  /**
   * Gets the current value for the given property
   * if key is null gets all properties hash
   */
  getAttributes<T extends Model>(model: T): FieldObject {
    let storeItem = this._store.byCid[model.cid.toString()];
    let res = null;
    if (storeItem) {
      res = merge({}, storeItem.attributes, storeItem.changes);
    }
    return res as FieldObject;
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends Model>(model: T, collection: Collection<T> = model.getClass().getCollection()): Promise<T> {
    //ensure last model for immutability
    model = this._store.byCid[model.cid.toString()].model as T;
    const modelId = this.getId(model) || this._lastId++;
    if (!this.getId(model)) {
      model = this.setId(model, modelId)
    }
    this._store.byCid[model.cid.toString()].attributes = await model.getAttributes();
    if (this._store.byCid[model.cid.toString()].changes) {
      this._store.byCid[model.cid.toString()].changes = null;
      model = model.clone();
      this._store.byCid[model.cid.toString()].model = model;
    }
    if (!this._store.byId[collection.name])
      this._store.byId[collection.name] = {};
    this._store.byId[collection.name][modelId] = model.cid;
    return model;
  }

  /**
   * Removes the model in the ORM
   */
  async delete<T extends Model>(model: T, collection: Collection<T> = model.getClass().getCollection()): Promise<void> {
    const id = this.getId(model);
    if (id !== null) {
      delete this._store.byId[collection.name]["" + id];
    }
    delete this._store.byCid[model.cid.toString()];

  }

  /**
   * gets the changes from the last fetch
   */
  getChanges(model: Model): FieldObject | null {
    let storeItem = this._store.byCid[model.cid.toString()];
    return storeItem ? storeItem.changes : null;
  }

  observeQuery<T extends Model>(model: ModelClass<T>, query: Query<T>, handler: (array: T[]) => void): ISubscription {
    throw "implement me"
  }

  async executeQuery<T extends Model>(model: ModelClass<T>, query: Query<T>): Promise<T[]> {
    throw "implement me"
  }
}