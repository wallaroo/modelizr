//@flow
import {OrmDriver} from "../OrmDriver";
import type {FieldValue} from "../Model"
import Model, {Cid} from "../Model";
import {objectDif} from "../utils";
import merge from "lodash.merge";
import Query from "../Query";
import Collection from "../Collection";

type StoreItem = {
    model: Model,
    attributes: { [string]: FieldValue },
    changes: { [string]: FieldValue } | null,
}

export default class SimpleOrm implements OrmDriver {
    _lastId: number = 0;
    _store: {
        "byCid": {
            [cid: string]: StoreItem
        },
        "byId": {
            [model: string]: { [id: string]: Cid }
        }
    } = {
        byCid: {},
        byId: {}
    };

    constructor(opts?: {
        executeQuery: (Class<Model>, Query<Model>) => Promise<Model[]>,
        observeQuery: (Class<Model>, Query<Model>) => void
    }) {
        //$FlowFixMe
        Object.assign(this, opts);
    }

    /**
     * gets the model by its id or null if doesn't exists
     */
    async getModelById<T:Model>(model: Class<T>,
                                id: string | number,
                                collection?: Collection<T> = model.getCollection()): Promise<T | null> {
        let res = null;
        const cid = this.getCidById(model, id);
        if (cid) {
            res = this.getModelByCid(cid);
        }
        return (res: any);
    }

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelByCid(cid: Cid): Model | null {
        return this._store.byCid[`${cid.toString()}`].model;
    }

    getCidById(model: Class<Model>, id: string | number): Cid | null {
        const storeItem = this._store.byId[model.getCollection().name];
        return storeItem ? storeItem[`${id}`] : null;
    }

    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:Model>(model: T, setHash: { [string]: FieldValue }): T {
        //ensure last model for immutability
        if (this._store.byCid[model.cid.toString()])
            model = this._store.byCid[model.cid.toString()].model;
        const sCid = model.cid.toString();
        let storeItem = this._store.byCid[sCid];
        if (storeItem) {
            let changes = objectDif(storeItem.attributes, Object.assign({}, storeItem.changes, setHash));
            if (changes){
                model = model.clone()
            }
            this._store.byCid[sCid] = {...storeItem, changes, model};
        } else {
            this._store.byCid[sCid] = {changes: setHash, attributes: {}, model: model};
        }
        return model;
    }

    fetch<T:Model>(model: T, setHash: { [string]: FieldValue }): T {
        //ensure last model for immutability
        if (this._store.byCid[model.cid.toString()])
            model = this._store.byCid[model.cid.toString()].model;
        const sCid = model.cid.toString();
        let storeItem = this._store.byCid[sCid];
        storeItem = {
            attributes: merge({}, storeItem && storeItem.attributes, setHash),
            changes: null,
            model: model
        };
        this._store.byCid[sCid] = storeItem;
        const id = this.getId(model);
        if (id) {
            if (!this._store.byId[model.getClass().getCollection().name]) {
                this._store.byId[model.getClass().getCollection().name] = {}
            }
            this._store.byId[model.getClass().getCollection().name][`${id}`] = model.cid
        }
        return model;
    }

    _get(model: Model): { [string]: FieldValue } {
        const sCid = model.cid.toString();
        const storeItem = this._store.byCid[sCid];
        return Object.assign({}, storeItem.attributes, storeItem.changes);
    }

    getId(model: Model): number | string | null {
        const values = this._get(model);
        const res = values[model.getClass()._idAttribute] || null;
        if (res !== null && typeof res !== "string" && typeof res !== "number") {
            throw "invalid id "
        }
        return res;
    }
    setId<T:Model>(model: T, id:string|number): T {
        const sCid = model.cid.toString();
        const storeItem = this._store.byCid[sCid];
        if (storeItem.attributes[model.getClass()._idAttribute] !== id){
            storeItem.attributes[model.getClass()._idAttribute] = id;
            model = model.clone()
        }
        return model;
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
            } else {
                res = merge({}, res.attributes, res.changes);
            }
        }
        return res;
    }

    /**
     * Upserts the model in the ORM
     */
    async save<T:Model>(model: T, collection?: Collection<T> = model.getClass().getCollection()): Promise<T> {
        //ensure last model for immutability
        model = this._store.byCid[model.cid.toString()].model;
        if (!this.getId(model)) {
            model = this.setId(model, this._lastId++)
        }
        this._store.byCid[model.cid.toString()].attributes = await model.get();
        if (this._store.byCid[model.cid.toString()].changes){
            this._store.byCid[model.cid.toString()].changes = null;
            model = model.clone();
            this._store.byCid[model.cid.toString()].model = model;
        }
        if (!this._store.byId[collection.name])
            this._store.byId[collection.name] = {};
        //$FlowFixMe
        this._store.byId[collection.name][model.getId()] = model.cid;
        return model;
    }

    /**
     * Removes the model in the ORM
     */
    async delete<T:Model>(model: T, collection?: Collection<T> = model.getClass().getCollection()): Promise<void> {
        const id = this.getId(model);
        if (id !== null) {
            delete this._store.byId[collection.name]["" + id];
        }
        delete this._store.byCid[model.cid.toString()];

    }

    /**
     * gets the changes from the last fetch
     */
    getChanges(model: Model): { [string]: FieldValue } | null {
        let storeItem = this._store.byCid[model.cid.toString()];
        return storeItem ? storeItem.changes : null;
    }

    async observeQuery<T:Model>(model: Class<Model>, query: Query<T>): Promise<void> {
        throw "implement me"
    }

    async executeQuery<T:Model>(model: Class<Model>, query: Query<T>): Promise<T[]> {
        throw "implement me"
    }
}