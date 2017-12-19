import Model, {ModelClass} from "./Model";

import Query from "./Query";
import {OrmDriver} from "./OrmDriver";
import {Operator} from "./Query";
const pluralize = require("pluralize");

export type Opts<T extends Model> = {
    name?: string,
    keyAttribute?: string
}

class Collection<T extends Model> {
    name: string;
    model: ModelClass;
    keyAttribute: string;
    static _ormDriver:OrmDriver;

    constructor(model:ModelClass,{name, keyAttribute}: Opts<T> = {}) {
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

    getKey(model:T): string | number | null {
        const res = model.get(this.keyAttribute);
        if (res !== null && typeof res !== "number" && typeof res !== "string")
            throw "invalid key ";
        return res as string | number | null;
    }
    async setKey(model:T, key:string): Promise<T> {
        return  model.set<T>({[this.keyAttribute]:key});
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

    where(field:string, operator?:Operator, value?:string): Query<T> {
        return this.find().where(field, operator, value);
    }

    orderBy(...args: string[]): Query<T> {
        return this.find().orderBy(...args);
    }

    limit(number:number): Query<T> {
        return this.find().limit(number);
    }

    startAt(number:number): Query<T> {
        return this.find().startAt(number);
    }

    getClass(): typeof Collection {
        return this.constructor as typeof Collection;
    }
}

export default Collection