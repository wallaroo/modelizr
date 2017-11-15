//@flow
import SimpleOrm from "./SimpleOrm";
import Model, {Cid} from "../Model";
import Query from "../Query";
import Collection from "../Collection";

type FirestoreDoc = {
    data: void => any,
    get: void => Promise<QuerySnapshot>,
    set: { [string]: any } => Promise<void>,
    delete: void => Promise<void>
}

type QuerySnapshot = {
    data: void => any,
    size: number,
    forEach: (FirestoreDoc => void) => void
}
type FirestoreCollection = {
    get: void => Promise<QuerySnapshot>,
    doc: string => FirestoreDoc,
    orderBy: string => FirestoreCollection,
    add: { [string]: any } => Promise<void>,
    onSnapshot: (QuerySnapshot => void) => void
}
type FirestoreDB = {
    collection: string => FirestoreCollection
}
export default class FirestoreOrm extends SimpleOrm {
    _db: FirestoreDB;

    constructor(db: any) {
        super();
        this._db = db;
    }

    async observeQuery<T:Model>(model: Class<Model>, query: Query<T>): Promise<void> {
        let collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);
        return new Promise((resolve) => {
            collection.onSnapshot((snapshot) => {
                let res = [];
                snapshot.forEach((doc) => {
                    res.push(model.create(doc.data()));
                });
                // $FlowFixMe
                Promise.all(res).then((models: Model[]) => {
                    query.notify(models);
                    resolve()
                });
            })
        });
    }

    applyQuery<T:Model>(firebaseQuery: FirestoreCollection, query: Query<T>) {
        if (query._orderBy) {
            for (const ordBy of query._orderBy) {
                firebaseQuery = firebaseQuery.orderBy(ordBy);
            }
        }
        return firebaseQuery;
    }

    // $FlowFixMe
    async executeQuery<T:Model>(model: Class<T>, query: Query<T>): Promise<Array<T>> {
        let res = [];
        let collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);

        // $FlowFixMe
        const snapshot = await collection.get();
        snapshot.forEach((doc) => {
            res.push(model.create(doc.data()));
        });
        return ((Promise.all(res): any): Promise<Array<T>>);
    }

    /**
     * Removes the model in the ORM
     */
    async delete<T:Model>(model: T, collection?: Collection<T> = model.getClass().getCollection()): Promise<void> {
        const id = model.getId();
        if (id) {
            await this._db.collection(collection.name).doc("" + id).delete()
        }
        super.delete(model);
    }

    /**
     * Upserts the model in the ORM
     */
    async save<T:Model>(model: T, collection?: Collection<T> = model.getClass().getCollection()): Promise<T> {
        const id = await collection.getKey(model);
        const isModelCollection = (collection === model.getClass().getCollection());
        if (id) {
            await this._db.collection(collection.name).doc("" + id).set(isModelCollection ? await model.get() : model.getRef() );
        } else {
            //$FlowFixMe
            const res = await this._db.collection(collection.name).add(model.getRef());
            await collection.setKey(model,res.id);
            await this._db.collection(collection.name).doc(res.id).set(isModelCollection ? await model.get() : model.getRef() );
        }
        return super.save(model);
    }


    async getModelById<T:Model>(model: Class<T>,
                          id: string | number,
                          collection?: Collection<T> = model.getCollection()): Promise<T | null> {
        const doc = await this._db.collection(collection.name).doc(""+id).get();

        let res;
        if (doc.exists){
            let data = doc.data();
            // get the model from simple orm using the model id and not the collection key
            const modelId = data[model._idAttribute];

            if (modelId) {
                if(collection !== model.getCollection()){
                    const modelDoc = await this._db.collection(model.getCollection().name).doc(""+modelId).get()
                    if (modelDoc.exists) {
                        data = modelDoc.data();
                    }
                }
                res = await super.getModelById(model, modelId);
            }
            if (!res) {
                res = new model();
                res.cid = new Cid();
            }
            res = await res.fetch(data);
        }else{
            res = await super.getModelById(model,id);
        }
        return (res:any);
    }
}