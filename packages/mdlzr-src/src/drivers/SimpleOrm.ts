import { FetchOption, OrmDriver } from "../OrmDriver";
import { Entity, EntityClass, getCid, getCollection, getId, isEntityClass, MaybeEntityClass } from "../utils";

import Query from "../Query";
import Collection from "../Collection";
import { ISubscription } from "rxjs/Subscription";
import MdlzrSagaChannel from '../sagas/sagaChannel';

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

  constructor(opts?: { // TODO why not an abstract class?
    executeQuery: <T extends object>(modelClass: EntityClass<T>, query: Query<T>) => Promise<T>,
    observeQuery: <T extends object>(modelClass: EntityClass<T>, query: Query<T>) => void
  }) {
    Object.assign(this, opts);
  }

  /**
   * gets the model by its id or null if doesn't exists
   */
  async getModelById<T extends object>(modelClass: MaybeEntityClass<T>,
                                       id: string | number,
                                       collection: Collection<T> = getCollection(modelClass),
                                       options?: FetchOption<T>
  ): Promise<T | null> {
    let res = null;
    const cid = this.getCidById(modelClass, id);
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
    model = MdlzrSagaChannel.singleton.fetch(model);
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