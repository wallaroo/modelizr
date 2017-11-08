//@flow
import Model from "./Model";
import pluralize from "pluralize";
import Query from "./Query";

type Opts<T:Model> = {
    name?: string,
    keyAttribute?: string
}

class Collection<T:Model> {
    name: string;
    model: Class<T>;
    keyAttribute: string;

    constructor(model:Class<T>,{name, keyAttribute}: Opts<T> = {}) {
        this.model = model;

        if (name)
            this.name = name;
        else
            this.name = pluralize(model.name.toLowerCase());

        if (keyAttribute)
            this.keyAttribute = keyAttribute;
        else {
            this.keyAttribute = model._idAttribute;
        }
    }

    getOrm(){
        return this.getClass()._ormDriver || this.model.getOrmDriver();
    }

    getKey(model:T): string | number {
        const res = model.get(this.keyAttribute);
        if (!res || (typeof res !== "number" && typeof res !== "string"))
            throw "invalid key";
        return res;
    }

    async save(...models: Array<T>): Promise<Array<T>> {
        return models;
    }

    where(...args: Array<*>): Query<T> {
        return (new Query((this))).where(...args);
    }

    orderBy(...args: Array<*>): Query<T> {
        return (new Query(this))._orderBy(...args);
    }

    limit(...args: Array<*>): Query<T> {
        return (new Query(this))._limit(...args);
    }

    startAt(...args: Array<*>): Query<T> {
        return (new Query(this))._startAt(...args);
    }

    getClass(): Class<Collection<T>> {
        return this.constructor;
    }
}

export default Collection