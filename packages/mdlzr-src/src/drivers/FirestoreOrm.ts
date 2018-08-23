import SimpleOrm from "./SimpleOrm";
import Query from "../Query";
import Collection from "../Collection";
import { ISubscription } from "rxjs/Subscription"
import * as types from "@firebase/firestore-types";
import {
  Entity,
  EntityClass,
  getAttrTypes,
  getCollection,
  getId,
  getIdAttribute,
  getMdlzrDescriptor,
  isEntity,
  isEntityClass,
  MaybeEntityClass
} from '../utils';
import { IFieldObject } from '../IFieldObject';
import { FetchOption } from '../OrmDriver';
import MdlzrSagaChannel from '../sagas/sagaChannel';

const omit = require('lodash.omit');

export default class FirestoreOrm extends SimpleOrm {
  private _db: types.FirebaseFirestore;

  constructor(db: any) {
    super();
    this._db = db;
  }

  observeQuery<T extends object>(model: EntityClass<T>,
                                 query: Query<T>,
                                 handler: (h: T[]) => void): ISubscription {
    let collection = this._db.collection(query.collection.name);
    let _query = this.applyQuery(collection, query);
    return {
      closed: false,
      unsubscribe: _query.onSnapshot((snapshot) => {
        let res: T[] = [];
        snapshot
          .forEach(
            (doc) => {
              res.push(MdlzrSagaChannel.singleton.fetch(new model(), doc.data() as IFieldObject<T>));
            }
          )
        ;
        handler(res);
      })
    }
  }

  observeModel<T extends object>(model: Entity<T>,
                                 handler: (h: T) => void = () => {
                                 }): ISubscription {
    const collection = getCollection(model.constructor); // TODO maybe to put in arguments
    const descr = getMdlzrDescriptor(model.constructor);
    let dbcollection = this._db.collection(collection.name);
    let doc = dbcollection.doc(`${getId(model)}`);
    return {
      closed: false,
      unsubscribe: doc.onSnapshot((snapshot) => {
        let data = snapshot.data() as IFieldObject<T>;
        if (data) {
          let res: T;
          // avoid to fetch child models, i'm expecting these are already observed
          data = omit(data, ...descr.childFields);
          res = MdlzrSagaChannel.singleton.fetch(model, data);
          handler(res);
        }
      })
    }
  }

  private applyQuery<T extends object>(collection: types.CollectionReference,
                                       query: Query<T>): types.Query {
    let result: types.Query = collection;
    if (query._orderBy) {
      for (const ordBy of query._orderBy) {
        result = collection.orderBy(ordBy);
      }
    }
    return result;
  }

  async executeQuery<T extends object>(model: EntityClass<T>,
                                       query: Query<T>): Promise<Array<T>> {
    let collection = this._db.collection(query.collection.name);
    let _query = this.applyQuery(collection, query);

    const snapshot = await _query.get();
    const promises: Promise<T>[] = [];
    snapshot.forEach(
      (doc) => {
        const data = doc.data();
        const modelFetched = this.deserialize(model, {
          [ getIdAttribute(model) ]: doc.id,
          ...data
        } as IFieldObject<T>);
        promises.push(modelFetched);
      }
    );
    return Promise.all(promises);
  }

  async deserialize<T extends object>(model: EntityClass<T> | Entity<T>, data: IFieldObject<T>, load: FetchOption<T> = {}): Promise<Entity<T>> {

    let res: Entity<T>;
    if (isEntityClass<T>(model)) {
      res = new model();
    } else {
      res = model;
    }
    const attrTypes = getAttrTypes(model);
    for (const attrName of Object.keys(attrTypes) as Array<keyof T>) {
      const attrType = attrTypes[ attrName ];
      let attrValue: any = data[ attrName ];
      if (isEntityClass(attrType.type) && attrValue) {
        if (attrType.embedded) {
          attrValue = await this.deserialize(
            attrType.type,
            attrValue,
            ((!load || typeof load[ attrName ] === "boolean") ? {} : load[ attrName ]) as FetchOption<any>
          );
        } else if (load[ attrName ]) {
          // resolve ref
          attrValue = await this.getModelById(
            attrType.type,
            attrValue[ getIdAttribute(attrType.type) ],
            getCollection(attrType.type),
            {load: typeof load[ attrName ] === "boolean" ? {} : load[ attrName ]});
        }
      }
      if (attrType.type === Array && isEntityClass(attrType.itemType) && attrValue) {
        if (attrType.embedded) {
          attrValue = await Promise.all(
            attrValue.map(
              (cur: any) => this.deserialize(
                attrType.itemType as EntityClass<any>,
                cur,
                ((!load || typeof load[ attrName ] === "boolean") ? {} : load[ attrName ]) as FetchOption<any>
              )
            )
          );
        } else if (load[ attrName ]) {
          // resolve ref
          attrValue = await Promise.all(
            attrValue.map(
              (cur: any) => this.getModelById(
                attrType.itemType as EntityClass<any>,
                cur[ getIdAttribute(attrType.itemType) ],
                getCollection(attrType.itemType as EntityClass<any>),
                (typeof load[ attrName ] === "boolean" ? {} : load[ attrName ] as FetchOption<any>))));
        }
      }
      res[ attrName ] = attrValue;
    }
    return res;
  }

  /**
   * Removes the model in the ORM
   */
  async delete<T extends object>(model: Entity<T>,
                                 collection: Collection<T> = getCollection(model.constructor)): Promise<void> {
    const id = getId(model);
    if (id) {
      await this._db.collection(collection.name).doc("" + id).delete()
    }
    return super.delete(model);
  }

  getAttributesForDB<T extends object>(model: Entity<T>): {} {
    const attrs: any = MdlzrSagaChannel.singleton.getAttributes(model);
    const attrTypes = getAttrTypes(model.constructor);
    for (let attrName of Object.keys(attrs) as Array<keyof T>) {
      const attrValue: any = attrs[ attrName ];
      const attrType = attrTypes[ attrName ];
      if (attrType.transient) {
        delete attrs[ attrName ];
      } else if (isEntityClass<any>(attrType.type) && isEntity<T>(attrValue)) {
        // TODO check embed
        attrs[ attrName ] = getRef(attrValue);
      }
      if (attrType.type === Array && attrType.itemType && isEntityClass(attrType.itemType)) {
        attrs[ attrName ] = attrValue.map((cursor: Entity<any>) => this.getAttributesForDB(cursor));
      }
    }
    return attrs;
  }

  getChildModels<T extends object>(model: Entity<T>): Entity<T>[] {
    const attrs = MdlzrSagaChannel.singleton.getAttributes(model);
    const attrTypes = getAttrTypes(model.constructor);
    const models: Entity<T>[] = [];
    for (let attrName of Object.keys(attrs) as Array<keyof T>) {
      const attrValue: any = attrs[ attrName ];
      const attrType = attrTypes[ attrName ];
      if (isEntityClass<any>(attrType.type) && isEntity<T>(attrValue)) {
        models.push(attrValue)
      }
      if (attrType.type === Array && isEntityClass(attrType.itemType) && attrValue) {
        models.push(...attrValue)
      }
    }
    return models;
  }

  async transactionSave<T extends object>(model: Entity<T>,
                                          collection: Collection<T> = getCollection(model.constructor),
                                          transaction: any,
                                          afterCommitTasks: Function[]): Promise<Entity<T>> {
    const childModels = this.getChildModels(model);
    for (const childModel of childModels) {
      await this.transactionSave(childModel, getCollection(childModel.constructor), transaction, afterCommitTasks)
    }

    const id = collection.getKey(model);
    const isModelCollection = (collection === getCollection(model.constructor));
    let attributes = this.getAttributesForDB(model);
    if (id) {
      await transaction.set(this._db.collection(collection.name).doc(`${id}`), isModelCollection ? attributes : getRef(model));
    } else {
      const doc = this._db.collection(getCollection(model.constructor).name).doc();
      model = getCollection(model.constructor).setKey(model, doc.id);
      attributes = this.getAttributesForDB(model);

      await transaction.set(doc, isModelCollection ? attributes : getRef(model));
    }

    afterCommitTasks.push(() => {
      this.selfObserveModel(model);
    });

    return model;
  }

  private selfObserveModel<T extends object>(model: Entity<T>): Entity<T> {
    const mdlz = MdlzrSagaChannel.singleton.getMdlzrInstance(model);
    if (!mdlz.selfSubscription) {
      mdlz.selfSubscription = this.observeModel(model);
    }
    return model;
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends object>(model: Entity<T>,
                               collection: Collection<T> = getCollection(model.constructor)): Promise<T> {
    const afterCommitTasks: Function[] = [];
    await this._db.runTransaction(async (transaction) => {

      model = await this.transactionSave(model, collection, transaction, afterCommitTasks)
    });

    for (const f of afterCommitTasks) {
      f();
    }
    return super.save(model);
  }

  async getModelById<T extends object>(modelClass: MaybeEntityClass<T>,
                                       id: string | number,
                                       collection: Collection<T> = getCollection(modelClass),
                                       options?: FetchOption<T>): Promise<T> {
    const load = options || {};

    const doc = await this._db
      .collection(collection.name)
      .doc("" + id)
      .get();

    let res;

    if (doc.exists) {
      let data: any = doc.data();
      // get the model from simple orm using the model id and not the collection key
      const modelId = data[ getIdAttribute(modelClass) ];

      if (modelId) {
        if (collection !== getCollection(modelClass)) {
          const modelDoc = await this._db
            .collection(getCollection(modelClass).name)
            .doc("" + modelId)
            .get();
          if (modelDoc.exists) {
            data = modelDoc.data();
          }
        }
        res = await super.getModelById(modelClass, modelId);
      }

      res = await this.deserialize(res || modelClass as EntityClass<T>, data, load);

      this.selfObserveModel(res);
    } else {
      res = null;
    }
    return res as T;
  }
}

export function getRef<T extends object, K extends keyof T = keyof T>(model: Entity<T>): { [ k in K ]: T[K] } {
  return {[ getIdAttribute(model)]: getId(model) as T[K]} as { [ k in keyof T ]: T[K] }
}