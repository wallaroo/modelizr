//@flow
import Model from "./Model";
import pluralize from "pluralize";
import Query from "./Query";
import type {OrmDriver} from "./OrmDriver";

type Opts<T:Model> = {
    name?: string,
    keyAttribute?: string
}

class Collection<T:Model> {
    name: string;
    model: Class<T>;
    keyAttribute: string;
    static _ormDriver:OrmDriver;

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

    getOrm():OrmDriver{
        return this.getClass()._ormDriver || this.model.getOrmDriver();
    }

    async getKey(model:T): Promise<string | number | null> {
        const res = await model.get(this.keyAttribute);
        if (res && typeof res !== "number" && typeof res !== "string")
            throw "invalid key";
        return res;
    }
    async setKey(model:T, key:string): Promise<T> {
        return  model.set({[this.keyAttribute]:key});
    }

    async save(...models: Array<T>): Promise<T|Array<T>> {
        if (models.length > 1) {
            const promises = [];
            for (const model of models) {
                await model.save();
                promises.push(this.getOrm().save(model, this))
            }
            return Promise.all(promises);
        }else{
            await models[0].save();
            return this.getOrm().save(models[0], this);
        }
    }

    find():Query<T>{
        return new Query(this)
    }

    findAll():Promise<T[]|null>{
        return this.find().exec()
    }

    async findByKey(key:string|number):Promise<T|null>{
        return this.getOrm().getModelById(this.model, key, this);
    }

    where(...args: Array<*>): Query<T> {
        return this.find().where(...args);
    }

    orderBy(...args: Array<*>): Query<T> {
        return this.find().orderBy(...args);
    }

    limit(...args: Array<*>): Query<T> {
        return this.find().limit(...args);
    }

    startAt(...args: Array<*>): Query<T> {
        return this.find().startAt(...args);
    }

    getClass(): Class<Collection<T>> {
        return this.constructor;
    }
}

export default Collection