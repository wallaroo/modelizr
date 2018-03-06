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
      [cid: string]: Model
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
  async getModelById<T extends Model>(model: ModelClass<T>,
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
    return this._store.byCid[`${cid.toString()}`];
  }

  getCidById(model: ModelClass, id: string | number): Cid | null {
    const storeItem = this._store.byId[model.getCollection().name];
    return storeItem ? storeItem[`${id}`] : null;
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends Model>(model: T, collection: Collection<T> = model.getClass().getCollection()): Promise<T> {
    let modelId = collection.getKey(model);
    if (!modelId) {
      modelId = this._lastId++;
      model = collection.setKey(model, "" + modelId);
    }
    model = model.fetch(model.getAttributes());
    if (!this._store.byId[collection.name])
      this._store.byId[collection.name] = {};
    this._store.byId[collection.name][modelId] = model.cid;
    this._store.byCid[model.cid.toString()] = model;
    return model;
  }

  /**
   * Removes the model in the ORM
   */
  async delete<T extends Model>(model: T, collection: Collection<T> = model.getClass().getCollection()): Promise<void> {
    const id = model.getId();
    if (id !== null) {
      delete this._store.byId[collection.name]["" + id];
    }
    delete this._store.byCid[model.cid.toString()];

  }

  observeQuery<T extends Model>(model: ModelClass<T>, query: Query<T>, handler: (array: T[]) => void): ISubscription {
    throw "implement me"
  }

  async executeQuery<T extends Model>(model: ModelClass<T>, query: Query<T>): Promise<T[]> {
    throw "implement me"
  }
}