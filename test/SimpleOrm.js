//@flow
import {OrmDriver} from "../src/OrmDriver";
import type {FieldValue} from "../src/"
import Model, {Cid} from "../src/";
import {objectDif} from "../src/utils";
import merge from "lodash.merge";
type StoreItem = {
    model: Class<Model>,
    attributes: { [string]: FieldValue },
    changes: { [string]: FieldValue }|null,
}
export default class SimpleOrm implements OrmDriver {
    _lastId:number = 0;
    _store: {
        "byCid": {
            [cid: string]: StoreItem
        },
        "byId": {
            [model:string]:{ [id: string]: Cid }
        }
    } = {
        byCid: {},
        byId: {}
    };

    getCidById(model:Model, id:string|number):Cid|null{
        const storeItem = this._store.byId[model.getClass().name];
        return storeItem ? storeItem[`${id}`] : null;
    }
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T:Model>(model: T, setHash: { [string]: FieldValue }): Promise<T> {
        const sCid = model.cid.toString();
        let storeItem = this._store.byCid[sCid];
        if (storeItem){
            let changes = objectDif(storeItem.attributes, setHash);
            this._store.byCid[sCid] = {...storeItem, changes};
        }else{
            this._store.byCid[sCid] = {changes:setHash,attributes:{},model:model.getClass()};
        }
        return model;
    }
    async fetch<T:Model>(model: T, setHash: { [string]: FieldValue }): Promise<T> {
        const sCid = model.cid.toString();
        let storeItem = this._store.byCid[sCid];
        storeItem = {
            attributes:merge({},storeItem.attributes, setHash),
            changes:null,
            model:model.getClass()
        };
        this._store.byCid[sCid] = storeItem;
        const id = this.getId(model);
        if (id){
            this._store.byId[`${id}`] = model.cid
        }
        return model;
    }
    getId(model:Model):number|string|null{
        const res = this.get(model, model.getClass().idAttribute);
        if (res!== null && typeof res !== "string" && typeof res !== "number"){
            throw "invalid id"
        }
        return res;
    }
    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    async get<T:Model>(model: T, key?: string): Promise<FieldValue | { [string]: FieldValue }> {
        let res = this._store.byCid[model.cid.toString()];
        if (res) {
            if (key) {
                res = (res.changes && res.changes[key]) || res.attributes[key];
            }else{
                res = merge({},res.attributes,res.changes);
            }
        }
        return res;
    }

    /**
     * Upserts the model in the ORM
     */
    async save<T:Model>(model: T): Promise<T> {
        if (!model.getId()) {
            model.setId(this._lastId++)
        }
        this._store.byCid[model.cid.toString()].attributes = await model.get();
        this._store.byCid[model.cid.toString()].changes = null;
        return model;
    }

    /**
     * Removes the model in the ORM
     */
    async delete(model: Model): Promise<boolean> {
        return false;
    }

    /**
     * gets the changes from the last fetch
     */
    getChanges(model: Model):{ [string]: FieldValue } | null{
        let storeItem = this._store.byCid[model.cid.toString()];
        return storeItem ? storeItem.changes : null;
    }
}