import SimpleOrm from "./SimpleOrm";
import Model, {Cid, ModelClass} from "../Model";
import Query from "../Query";
import Collection from "../Collection";
import {ISubscription} from "rxjs/Subscription"
import * as types from "@firebase/firestore-types";

export default class FirestoreOrm extends SimpleOrm {
  private _db: types.FirebaseFirestore;

  constructor(db: any) {
    super();
    this._db = db;
  }

  observeQuery<T extends Model>(model: ModelClass<T>,
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
              res.push(model.create(doc.data()));
            }
          )
        ;
        handler(res);
      })
    }
  }

  private applyQuery<T extends Model>(collection: types.CollectionReference,
                                      query: Query<T>): types.Query {
    let result: types.Query = collection;
    if (query._orderBy) {
      for (const ordBy of query._orderBy) {
        result = collection.orderBy(ordBy);
      }
    }
    return result;
  }

  async executeQuery<T extends Model>(model: ModelClass<T>,
                                      query: Query<T>): Promise<Array<T>> {
    let res: T[] = [];
    let collection = this._db.collection(query.collection.name);
    let _query = this.applyQuery(collection, query);

    const snapshot = await _query.get();

    snapshot.forEach(
      (doc) => {
        res.push(model.create({
          [model.idAttribute]:doc.id,
          ...doc.data()})
        );
      }
    );
    return res;
  }

  /**
   * Removes the model in the ORM
   */
  async delete<T extends Model>(model: T,
                                collection: Collection<T> = model.getClass().getCollection()): Promise<void> {
    const id = model.getId();
    if (id) {
      await this._db.collection(collection.name).doc("" + id).delete()
    }
    return super.delete(model);
  }

  getAttributesForDB<T extends Model>(model: T): {} {
    const attrs = model.getAttributes();
    const attrTypes = model.getClass().getAttrTypes();
    for (let attrName of Object.keys(attrs)) {
      const attrValue = attrs[attrName];
      const attrType = attrTypes[attrName];
      if (attrType.transient) {
        delete attrs[attrName];
      } else if (Model.isPrototypeOf(attrType.type as object) && attrValue) {
        // TODO check embed
        attrs[attrName] = (attrValue as Model).getRef();
      }
    }
    return attrs;
  }

  getChildModels<T extends Model>(model: T): Model[] {
    const attrs = model.getAttributes();
    const attrTypes = model.getClass().getAttrTypes();
    const models: Model[] = [];
    for (let attrName of Object.keys(attrs)) {
      const attrValue = attrs[attrName];
      const attrType = attrTypes[attrName];
      if (Model.isPrototypeOf(attrType.type as object) && attrValue) {
        models.push(attrValue as Model)
      }
    }
    return models;
  }

  async transactionSave<T extends Model>(model: T,
                                         collection: Collection<T> = model.getClass().getCollection(),
                                         transaction: any) {
    const id = collection.getKey(model);
    const isModelCollection = (collection === model.getClass().getCollection());
    let attributes = this.getAttributesForDB(model);

    if (id) {
      await transaction.set(this._db.collection(collection.name).doc("" + id), isModelCollection ? attributes : model.getRef());
    } else {
      const doc = this._db.collection(model.getClass().getCollection().name).doc();
      model = model.getClass().getCollection().setKey(model, doc.id);
      attributes = this.getAttributesForDB(model);
      await transaction.set(doc, isModelCollection ? attributes : model.getRef());
    }
  }

  /**
   * Upserts the model in the ORM
   */
  async save<T extends Model>(model: T,
                              collection: Collection<T> = model.getClass().getCollection()): Promise<T> {

    const childModels = this.getChildModels(model);

    await this._db.runTransaction(async (transaction: any) => {
      for (const childModel of childModels) {
        await this.transactionSave(childModel, childModel.getClass().getCollection(), transaction)
      }
      await this.transactionSave(model, collection, transaction)
    });

    return super.save(model);
  }


  async getModelById<T extends Model>(model: ModelClass<T>,
                                      id: string | number,
                                      collection: Collection<T> = model.getCollection()): Promise<T> {
    const doc = await this._db
      .collection(collection.name)
      .doc("" + id)
      .get();

    let res;

    if (doc.exists) {
      let data: any = doc.data();
      // get the model from simple orm using the model id and not the collection key
      const modelId = data[model.idAttribute];

      if (modelId) {
        if (collection !== model.getCollection()) {
          const modelDoc = await this._db
            .collection(model.getCollection().name)
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
        res.cid = new Cid();
      }
      res = await res.fetch(data);
    } else {
      res = null;
    }
    return res as T;
  }
}