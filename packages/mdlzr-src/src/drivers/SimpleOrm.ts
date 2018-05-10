import { FetchOptions, OrmDriver } from "../OrmDriver";
import {
  Entity,
  EntityClass,
  fetch,
  getAttributes,
  getCid,
  getCollection,
  getId,
  isEntityClass,
  MaybeEntityClass
} from "../utils";

import Query from "../Query";
import Collection from "../Collection";
import { ISubscription } from "rxjs/Subscription";
import { IFieldObject } from '../IFieldObject';

const merge = require("lodash.merge");

export type StoreItem<T extends object> = {
  model: Entity<T>,
  attributes: IFieldObject<T>,
  changes: IFieldObject<T> | null,
}

export default class SimpleOrm implements OrmDriver {
  _lastId: number = 0;
  _store: {
    "byCid": {
      [ cid: string ]: Entity<any>
    },
    "byId": {
      [ model: string ]: { [ id: string ]: string }
    }
  } = {
    byCid: {},
    byId: {}
  };

  constructor(opts?: {
    executeQuery: <T extends object>(modelClass: EntityClass<T>, query: Query<T>) => Promise<T>,
    observeQuery: <T extends object>(modelClass: EntityClass<T>, query: Query<T>) => void
  }) {
    //$FlowFixMe
    Object.assign(this, opts);
  }

  /**
   * gets the model by its id or null if doesn't exists
   */
  async getModelById<T extends object>(model: MaybeEntityClass<T>,
                                       id: string | number,
                                       options?: FetchOptions<T>
  ): Promise<T | null> {
    // const {collection, load} = Object.assign({
    //   collection: getCollection(model),
    //   load: {}
    // }, options);
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
  getModelByCid<T extends object>(cid: string): Entity<T> | null {
    return this._store.byCid[ `${cid}` ];
  }

  getCidById<T extends object>(model: MaybeEntityClass<T>, id: string | number): string | null {
    const storeItem = this._store.byId[ getCollection(model).name ];
    return storeItem ? storeItem[ `${id}` ] : null;
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends object>(model: Entity<T>, collection: Collection<T> = getCollection(model.constructor)): Promise<T> {
    let modelId: any = collection.getKey(model);
    if (!modelId) {
      modelId = this._lastId++;
      model = collection.setKey(model, `${modelId}`);
    }
    model = fetch(model);
    if (!this._store.byId[ collection.name ])
      this._store.byId[ collection.name ] = {};
    this._store.byId[ collection.name ][ modelId ] = getCid(model);
    this._store.byCid[ getCid(model) ] = model;
    return model;
  }

  /**
   * Removes the model in the ORM
   */
  async delete<T extends object>(model: Entity<T>, collection: Collection<T> = getCollection(model.constructor)): Promise<void> {
    const id = getId(model);
    if (id !== null) {
      delete this._store.byId[ collection.name ][ `${id}` ];
    }
    delete this._store.byCid[ getCid(model) ];

  }

  observeQuery<T extends object>(model: EntityClass<T>, query: Query<T>, handler: (array: T[]) => void): ISubscription {
    throw "implement me"
  }

  async executeQuery<T extends object>(model: EntityClass<T>, query: Query<T>): Promise<T[]> {
    throw "implement me"
  }

  find<T extends object>(model: MaybeEntityClass<T>): Query<T> {
    if (isEntityClass<T>(model)) {
      return new Query<T>(this, model);
    } else {
      throw new Error(`class ${model.name} isn't an Entity`)
    }
  }
}