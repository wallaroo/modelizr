//@flow
import {OrmDriver} from "../src/OrmDriver";
import type Model, {Field, Cid} from "../src/";

type MyModel = Model & { _properties?: any };
type StoreItem = {
    model: $Subtype<Model>,
    attributes: { [string]: Field },
    changes: { [string]: Field }|null,
}
export default class SimpleOrm implements OrmDriver {
    _lastId = 0;
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

    getCidById(model:Model, id:string|number){
        return this._store.byId[model.getClass().name][`${id}`];
    }
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    async set<T:MyModel>(model: T, setHash: { [string]: Field }): Promise<T> {
        model._properties = setHash;
        return model;
    }

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    async get<T:MyModel>(model: T, key?: string): Promise<Field | { [string]: Field }> {
        let res = this._store.byCid[model.cid.toString()].attributes;
        if (key) {
            res = res[key];
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
    async delete<T:Model>(model: T): Promise<boolean> {
        return false;
    }
}