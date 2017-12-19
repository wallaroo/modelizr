import SimpleOrm from "./SimpleOrm";
import Model, {Cid, ModelClass} from "../Model";
import Query from "../Query";
import Collection from "../Collection";
import {ISubscription} from "rxjs/Subscription"

export type FirestoreDoc = {
    data: () => any,
    get: () => Promise<QuerySnapshot>,
    set: (h: { [k: string]: any }) => Promise<void>,
    "delete": () => Promise<void>
}

export type QuerySnapshot = {
    data: () => any,
    size: number,
    exists: boolean,
    forEach: (c: (doc: FirestoreDoc) => void) => void
}
export type FirestoreCollection = {
    get: () => Promise<QuerySnapshot>,
    doc: (string: string) => FirestoreDoc,
    orderBy: (string: string) => FirestoreCollection,
    add: (a: { [k: string]: any }) => Promise<{id:string}>,
    onSnapshot: (p: (q: QuerySnapshot) => void) => () => void
}
type FirestoreDB = {
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
                                  collection : Collection<T> = model.getClass().getCollection()): Promise<void> {
        const id = model.getId();
        if (id) {
            await
                this._db.collection(collection.name).doc("" + id).delete()
        }
        return super.delete(model);
    }

    /**
     * Upserts the model in the ORM
     */
    async save<T extends Model>(model: T,
                                collection : Collection<T> = model.getClass().getCollection()): Promise<T> {
        const id = collection.getKey(model);
        const isModelCollection = (collection === model.getClass().getCollection());
        if (id) {
            await
                this._db.collection(collection.name).doc("" + id).set(isModelCollection ? model.getAttributes() : model.getRef());
        } else {
            const res = await this._db.collection(collection.name).add(model.getRef());
            await
                collection.setKey(model, res.id);
            await
                this._db.collection(collection.name).doc(res.id).set(isModelCollection ? model.getAttributes() : model.getRef());
        }
        return super.save(model);
    }


    async getModelById<T extends Model>(model: ModelClass,
                                        id: string | number,
                                        collection : Collection<T> = model.getCollection()): Promise<T> {
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
            res = await res.fetch<T>(data);
        } else {
            res = await super.getModelById<T>(model, id);
        }
        return res;
    }
}