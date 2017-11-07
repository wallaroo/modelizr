//@flow
import SimpleOrm from "./SimpleOrm";
import Model from "../Model";
import Query from "../Query";

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

    async observeQuery(model: Class<Model>, query: Query): Promise<void> {
        let collection = this._db.collection(model.name);
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

    applyQuery(firebaseQuery:FirestoreCollection, query:Query){
        if(query._orderBy){
            for (const ordBy of query._orderBy){
                firebaseQuery = firebaseQuery.orderBy(ordBy);
            }
        }
        return firebaseQuery;
    }

    async executeQuery(model: Class<Model>, query: Query): Promise<Model[]> {
        let res =[];
        let collection = this._db.collection(model.name);
        collection = this.applyQuery(collection, query);

        // $FlowFixMe
        const snapshot = await collection.get();
        snapshot.forEach((doc)=>{
            res.push(model.create(doc.data()));
        });
        return ((Promise.all(res):any):Promise<Model[]>);
    }

    /**
     * Removes the model in the ORM
     */
    async delete(model: Model): Promise<void> {
        const id = model.getId();
        if (id){
            await this._db.collection(model.getClass().name).doc(""+id).delete()
        }
        super.delete(model);
    }
    /**
     * Upserts the model in the ORM
     */
    async save<T:Model>(model: T): Promise<T> {
        const id = model.getId();
        if (id){
            await this._db.collection(model.getClass().name).doc(""+id).set(await model.get());
        }else{
            //$FlowFixMe
            const res = await this._db.collection(model.getClass().name).add(await model.get());
            model.setId(res.id);
            await this._db.collection(model.getClass().name).doc(res.id).set(await model.get());
        }
        return super.save(model);
    }

}