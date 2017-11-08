//@flow
import SimpleOrm from "./SimpleOrm";
import Model from "../Model";
import Query from "../Query";
import Collection from "../Collection";

type FirestoreDoc = {
    data : void => any,
    set: {[string]:any}=>Promise<void>,
    delete: void => Promise<void>
}

type QuerySnapshot = {
    data: void => Array<any>,
    size: number,
    forEach: (FirestoreDoc=>void) => void
}
type FirestoreCollection = {
    get:void=>Promise<QuerySnapshot>,
    doc:string=>FirestoreDoc,
    orderBy:string=>FirestoreCollection,
    add:{[string]:any}=>Promise<void>,
    onSnapshot: (QuerySnapshot=>void)=>void
}
type FirestoreDB = {
    collection:string=>FirestoreCollection
}
export default class FirestoreOrm extends SimpleOrm {
    _db:FirestoreDB;
    constructor(db:any){
        super();
        this._db = db;
    }

    async observeQuery<T:Model>(model: Class<Model>, query: Query<T>): Promise<void> {
        let collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);
        return new Promise((resolve)=>{
            collection.onSnapshot((snapshot)=>{
                let res = [];
                snapshot.forEach((doc)=>{
                    res.push(model.create(doc.data()));
                });
                // $FlowFixMe
                Promise.all(res).then((models:Model[])=>{
                    query.notify(models);
                    resolve()
                });
            })
        });
    }

    applyQuery<T:Model>(firebaseQuery:FirestoreCollection, query:Query<T>){
        if(query._orderBy){
            for (const ordBy of query._orderBy){
                firebaseQuery = firebaseQuery.orderBy(ordBy);
            }
        }
        return firebaseQuery;
    }

    // $FlowFixMe
    async executeQuery<T:Model>(model: Class<T>, query: Query<T>): Promise<Array<T>> {
        let res =[];
        let collection = this._db.collection(query.collection.name);
        collection = this.applyQuery(collection, query);

        // $FlowFixMe
        const snapshot = await collection.get();
        snapshot.forEach((doc)=>{
            res.push(model.create(doc.data()));
        });
        return ((Promise.all(res):any):Promise<Array<T>>);
    }

    /**
     * Removes the model in the ORM
     */
    async delete<T:Model>(model: T, collection?:Collection<T> = new Collection(model.getClass())): Promise<void> {
        const id = model.getId();
        if (id){
            await this._db.collection(collection.name).doc(""+id).delete()
        }
        super.delete(model);
    }
    /**
     * Upserts the model in the ORM
     */
    async save<T:Model>(model: T, collection?:Collection<T> = new Collection(model.getClass())): Promise<T> {
        const id = model.getId();
        if (id){
            await this._db.collection(collection.name).doc(""+id).set(await model.get());
        }else{
            //$FlowFixMe
            const res = await this._db.collection(collection.name).add(await model.get());
            model.setId(res.id);
            await this._db.collection(collection.name).doc(res.id).set(await model.get());
        }
        return super.save(model);
    }

}