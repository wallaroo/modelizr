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
  model: ModelClass<T>;
  keyAttribute: string;
  static _ormDriver: OrmDriver;

  constructor(model: ModelClass<T>, {name, keyAttribute}: Opts<T> = {}) {
    this.model = model;

    if (name)
      this.name = name;
    else
      this.name = pluralize(model.name.toLowerCase());

    if (keyAttribute)
      this.keyAttribute = keyAttribute;
    else {
      this.keyAttribute = model.idAttribute;
    }
  }

  // getOrm():OrmDriver{
  //     return this.getClass()._ormDriver || this.model.getOrmDriver();
  // }

  getKey(model: T): string | number | null {
    const res = model.get(this.keyAttribute);
    if (res !== null && typeof res !== "number" && typeof res !== "string")
      throw new Error(`invalid key ${this.keyAttribute} of type ${typeof res} for model ${model.getClass().name}`);
    return res as string | number | null;
  }

  setKey(model: T, key: string): T {
    return model.set<T>({[this.keyAttribute]: key});
  }

  async save(ormDriver: OrmDriver, ...models: Array<T>): Promise<T | Array<T>> {
    if (models.length > 1) {
      const promises = [];
      for (let model of models) {
        model = await model.save(ormDriver);
        promises.push(ormDriver.save(model, this))
      }
      return Promise.all(promises);
    } else if (models.length > 0) {
      models[0] = await models[0].save(ormDriver);
      return ormDriver.save(models[0], this);
    } else {
      throw new Error("invalid parameters");
    }

  }

  find(ormDriver: OrmDriver): Query<T> {
    return new Query(ormDriver, this)
  }

  findAll(ormDriver: OrmDriver): Promise<T[] | null> {
    return this.find(ormDriver).exec()
  }

  async findByKey(ormDriver: OrmDriver, key: string | number): Promise<T | null> {
    return ormDriver.getModelById(this.model, key, this);
  }

  getClass(): typeof Collection {
    return this.constructor as typeof Collection;
  }
}

export default Collection