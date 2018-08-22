import Query from "./Query";
import { OrmDriver } from "./OrmDriver";
import { Entity, EntityClass, fetch, getClassName, getIdAttribute, isEntityClass, MaybeEntityClass } from './utils';

const pluralize = require("pluralize");

export type Opts<T extends object> = {
  name?: string,
  keyAttribute?: keyof T
}

class Collection<T extends object> {
  name: string;
  model: EntityClass<T>;
  keyAttribute: keyof T;

  constructor(model: MaybeEntityClass<T>, {name, keyAttribute}: Opts<T> = {}) {
    if (isEntityClass(model)) {
      this.model = model;

      if (name)
        this.name = name;
      else
        this.name = pluralize(getClassName(model).toLowerCase());

      if (keyAttribute) {
        this.keyAttribute = keyAttribute;
      } else {
        this.keyAttribute = getIdAttribute(model) as keyof T;
      }
    }
    else {
      throw new Error(`class ${getClassName(model)} isn't an Entity`)
    }
  }

  // getOrm():OrmDriver{
  //     return this.getClass()._ormDriver || this.model.getOrmDriver();
  // }

  getKey(model: Entity<T>) {
    const res = model[ this.keyAttribute ];
    if (res !== undefined && res !== null && typeof res !== "number" && typeof res !== "string")
      throw new Error(`invalid key ${this.keyAttribute} of type ${typeof res} for model ${getClassName(model.constructor)}`);
    return res;
  }

  setKey(model: Entity<T>, key: any): Entity<T> {
    return fetch(model, {[ this.keyAttribute ]: key} as any);
  }

  async save(ormDriver: OrmDriver, ...models: Array<T>): Promise<T | Array<T>> {
    if (models.length > 1) {
      const promises = [];
      for (let model of models) {
        model = await ormDriver.save(model);
        promises.push(ormDriver.save(model, this))
      }
      return Promise.all(promises);
    } else if (models.length > 0) {
      models[ 0 ] = await ormDriver.save(models[ 0 ]);
      return ormDriver.save(models[ 0 ], this);
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