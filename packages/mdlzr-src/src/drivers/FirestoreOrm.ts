import SimpleOrm from "./SimpleOrm";
import Model, {Cid, ModelClass} from "../Model";
import Query from "../Query";
import Collection from "../Collection";
import {ISubscription} from "rxjs/Subscription"
import {async} from "rxjs/scheduler/async";

export type FirestoreDoc = {
    data: () => any,
    get: () => Promise<QuerySnapshot>,
    set: (h: { [k: string]: any }) => Promise<void>,
    "delete": () => Promise<void>,
    id: string
}

export type QuerySnapshot = {
    data: () => any,
    size: number,
    exists: boolean,
    forEach: (c: (doc: FirestoreDoc) => void) => void
}
export type FirestoreCollection = {
    get: () => Promise<QuerySnapshot>,
    doc: (string?: string) => FirestoreDoc,
    orderBy: (string: string) => FirestoreCollection,
    add: (a: { [k: string]: any }) => Promise<{ id: string }>,
    onSnapshot: (p: (q: QuerySnapshot) => void) => () => void
}
type FirestoreDB = {
    runTransaction: (fun: any) => any,
    collection: (string: string) => FirestoreCollection
}
export default class FirestoreOrm extends SimpleOrm {
    private _db: FirestoreDB;

    constructor(db: any) {
        super();
        this._db = db;
    }

    observeQuery<T extends Model>(model: ModelClass,
                                  query: Query<T>,
                                  handler: (h: T[]) => void): ISubscription {
        let
            collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);
        return {
            closed: false,
            unsubscribe: collection.onSnapshot((snapshot) => {
                let res: Promise<T | T[]>[] = [];
                snapshot
                    .forEach(
                        (doc) => {
                            res.push(model.create(doc.data()));
                        }
                    )
                ;
                Promise.all(res).then((models: T[]) => {
                    handler(models);
                });
            })
        }
    }

    applyQuery<T extends Model>(firebaseQuery: FirestoreCollection,
                                query: Query<T>) {
        if (query._orderBy) {
            for (const ordBy of query._orderBy) {
                firebaseQuery = firebaseQuery.orderBy(ordBy);
            }
        }
        return firebaseQuery;
    }

    async executeQuery<T extends Model>(model: ModelClass,
                                        query: Query<T>): Promise<Array<T>> {
        let res: Promise<T>[] = [];
        let collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);

        const snapshot = await collection.get();

        snapshot.forEach(
            (doc) => {
                res.push(model.create(doc.data()) as Promise<T>);
            }
        );
        return Promise.all(res);
    }

    /**
     * Removes the model in the ORM
     */
    async delete<T extends Model>(model: T,
                                  collection: Collection<T> = model.getClass().getCollection()): Promise<void> {
        const id = model.getId();
        if (id) {
            await
                this._db.collection(collection.name).doc("" + id).delete()
        }
        return super.delete(model);
    }

    getAttributesForDB<T extends Model>(model: T): {} {
        const attrs = model.getAttributes();
        const attrTypes = model.getClass().getAttrTypes();
        for (let attrName of Object.keys(attrs)) {
            const attrValue = attrs[attrName];
            const attrType = attrTypes[attrName];
            if (attrType.transient){
                delete attrs[attrName];
            }else if (Model.isPrototypeOf(attrType.type) && attrValue) {
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
            if (Model.isPrototypeOf(attrType.type) && attrValue) {
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
            await model.getClass().getCollection().setKey(model, doc.id);
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


    async getModelById<T extends Model>(model: ModelClass,
                                        id: string | number,
                                        collection: Collection<T> = model.getCollection()): Promise<T> {
        const doc = await this._db
            .collection(collection.name)
            .doc("" + id)
            .get();

        let res;

        if (doc.exists) {
            let data = doc.data();
            // get the model from simple orm using the model id and not the collection key
            const modelId = data[model._idAttribute];

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
                res = await
                    super.getModelById(model, modelId);
            }

            if (!res) {
                res = new model() as T;
                res.cid = new Cid();
            }
            res = await res.fetch(data);
        } else {
            res = await super.getModelById<T>(model, id);
        }
        return res;
    }
}