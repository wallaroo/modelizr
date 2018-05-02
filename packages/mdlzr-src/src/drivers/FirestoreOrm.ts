import SimpleOrm from "./SimpleOrm";
import Query from "../Query";
import Collection from "../Collection";
import { ISubscription } from "rxjs/Subscription"
import * as types from "@firebase/firestore-types";
import {
  Entity,
  EntityClass,
  fetch,
  getAttributes,
  getAttrTypes,
  getCollection,
  getId,
  getIdAttribute,
  getRef,
  isEntity,
  isEntityClass, MaybeEntityClass
} from '../utils';
import { IFieldObject } from '../IFieldObject';

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
              res.push(fetch(new model(), doc.data() as IFieldObject<T>));
            }
          )
        ;
        handler(res);
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
    const promises : Promise<T>[] = [];
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

  async deserialize<T extends object>(model: EntityClass<T>, data: IFieldObject<T>): Promise<Entity<T>> {
    const res:Entity<T> = new model();
    const attrTypes = getAttrTypes(model);
    for (const attrName of Object.keys(attrTypes) as Array<keyof T>) {
      const attrType = attrTypes[ attrName ];
      let attrValue: any = data[ attrName ];
      if (isEntityClass(attrType.type) && attrValue) {
        if (attrType.embedded) {
          attrValue = this.deserialize(attrType.type, attrValue);
        } else {
          // resolve ref
          attrValue = await this.getModelById(attrType.type, attrValue[ getIdAttribute(attrType.type) ])
        }
      }
      if (attrType.type === Array && isEntityClass(attrType.itemType) && attrValue) {
        if (attrType.embedded) {
          attrValue = attrValue.map((cur: any) => this.deserialize(attrType.itemType as EntityClass<any>, cur));
        } else {
          // resolve ref
          attrValue = await Promise.all(attrValue.map((cur: any) => this.getModelById(attrType.itemType as EntityClass<any>, cur[ getIdAttribute(attrType.itemType) ])));
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
    const attrs: any = getAttributes(model);
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
    const attrs = getAttributes(model);
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
                                          transaction: any): Promise<Entity<T>> {
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
    return model;
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends object>(model: Entity<T>,
                               collection: Collection<T> = getCollection(model.constructor)): Promise<T> {
    const childModels = this.getChildModels(model);

    await this._db.runTransaction(async (transaction: any) => {
      for (const childModel of childModels) {
        await this.transactionSave(childModel, getCollection(childModel.constructor), transaction)
      }
      model = await this.transactionSave(model, collection, transaction)
    });
    return super.save(model);
  }


  async getModelById<T extends object>(model: MaybeEntityClass<T>,
                                       id: string | number,
                                       collection: Collection<T> = getCollection(model)): Promise<T> {
    const doc = await this._db
      .collection(collection.name)
      .doc("" + id)
      .get();

    let res;

    if (doc.exists) {
      let data: any = doc.data();
      // get the model from simple orm using the model id and not the collection key
      const modelId = data[ getIdAttribute(model) ];

      if (modelId) {
        if (collection !== getCollection(model)) {
          const modelDoc = await this._db
            .collection(getCollection(model).name)
            .doc("" + modelId)
            .get();
          if (modelDoc.exists) {
            data = modelDoc.data();
          }
        }
        res = await super.getModelById(model, modelId);
      }

      if (!res) {
        res = new model() as T;
        // res.cid = new Cid();
      }
      res = fetch(res, data);
    } else {
      res = null;
    }
    return res as T;
  }
}