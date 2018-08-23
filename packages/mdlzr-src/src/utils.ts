import Collection from './Collection';
import { IAttrTypes } from './IAttrTypes';
import { Class } from './Classes';

const pick = require('lodash.pick');

export type MdlzrDescriptor<T extends object> = {
  idAttribute: keyof T
  collection?: Collection<T>
  name: string,
  attrTypes: IAttrTypes<T>,
  childFields: Array<keyof T>
}

export type ChangeEvent<T, K extends keyof T = keyof T> = { model: T, attribute?: K, newValue?: T[K], oldValue?: T[K] }

export type EntityClass<T extends object> = {
  new(...x: any[]): Entity<T>
  prototype: T;
  name: string;
  __mdlzr__: MdlzrDescriptor<T>;
}

export type MaybeEntityClass<T extends object> = {
  new(...x: any[]): Entity<T>
  prototype: T;
  name: string;
  __mdlzr__?: MdlzrDescriptor<T>;
}

export type Entity<T extends object> = T & { __cid__?: string, constructor: EntityClass<T> }

/**
 * returns an obj with only the obj2 fields that differs from obj1
 * @param obj1
 * @param obj2
 */
export function objectDif<T1 extends object, T2 extends object>(obj1: T1, obj2: T2): Partial<T1 & T2> | null {
  if (!obj1) {
    return obj2;
  } else if (!obj2) {
    return null;
  } else {
    const res = {} as { [ key: string ]: any };
    for (let fieldname of Object.keys(obj2)) {
      if ((obj2 as any)[ fieldname ] !== (obj1 as any)[ fieldname ]) {
        res[ fieldname ] = (obj2 as any)[ fieldname ];
      }
    }
    return (isEmpty(res) ? null : res) as Partial<T1 & T2> | null;
  }
}

// export function notifyObservers<T extends object, K extends keyof T = keyof T>(model: Entity<T>, attribute?: K, newValue?: T[K], oldValue?: T[K]) {
//   const mdlzr = getMdlzrInstance(model);
//   if (mdlzr.subject.observers.length) {
//     mdlzr.subject.next({model: clone(model), attribute, newValue, oldValue});
//   }
// }

export function getClassName<T extends { name: string, displayName?: string }>(t: T) {
  return t.displayName || t.name;
}

export function isEmpty(obj: { [ key: string ]: any } | null) {
  return !obj || Object.keys(obj).length === 0
}

export function getAttrTypes<T extends object>(model: MaybeEntityClass<T> | Entity<T>): IAttrTypes<T> {
  return getMdlzrDescriptor<T>(model).attrTypes;
}

export function getIdAttribute<T extends object>(entity: Entity<T> | EntityClass<T>): keyof T {
  let mdlzr;
  if (isEntity(entity)) {
    mdlzr = entity.constructor.__mdlzr__;
  } else if (isEntityClass(entity)) {
    mdlzr = entity.__mdlzr__;
  } else {
    throw new Error("not entity nor entity class")
  }
  return mdlzr.idAttribute;
}

export function getCollection<T extends object>(clazz: MaybeEntityClass<T>): Collection<T> {
  if (isEntityClass<T>(clazz)) {
    if (!clazz.__mdlzr__.collection) {
      clazz.__mdlzr__.collection = new Collection(clazz);
    }
    return clazz.__mdlzr__.collection;
  }
  else {
    throw new Error(`class ${clazz.name} isn't an Entity`);
  }
}

export function initEntityClass<T extends object>(entity: Class<T> | Function): EntityClass<T> {
  if (!entity.hasOwnProperty("__mdlzr__")) {
    let parent: any = (entity as any).__mdlzr__ || {attrTypes: {}, idAttribute: null};
    Object.defineProperty(entity, "__mdlzr__", {
      enumerable: false,
      writable: false,
      value: {
        name: entity.name,
        attrTypes: {...parent.attrTypes},
        idAttribute: parent.idAttribute,
        childFields: []
      } as MdlzrDescriptor<T>
    });
  }
  if (!(entity.prototype as any)[ 'toJSON' ]) {
    (entity.prototype as any)[ 'toJSON' ] = function () {
      let obj = Object.assign(this);
      let keys = Object.keys(obj).concat(Object.keys(this.constructor.prototype));
      return pick(obj, keys)
    }
  }
  return entity as EntityClass<T>;
}

export function isEntity<T extends object>(model: any): model is Entity<T> {
  return model && typeof model === 'object' && !!model.__cid__;
}

export function isEntityClass<T extends object>(model: any): model is EntityClass<T> {
  return model && typeof model === 'function' && !!model.__mdlzr__;
}

export function getCid(model: Entity<any>): string
export function getCid(model: object): null
export function getCid(model: Entity<any>): string | null | undefined{
  return isEntity(model) ? model["__cid__"] : null;
}

export function getId<T extends object>(model: Entity<T>): T[keyof T] | null {
  return isEntity<T>(model) ? model[ getMdlzrDescriptor<T>(model).idAttribute ] : null;
}

export function haveSameCid(modelA: Entity<any>, modelB: Entity<any>) {
  return getCid(modelA) === getCid(modelB);
}

export function getMdlzrDescriptor<T extends object>(model: MaybeEntityClass<T> | Entity<T>): MdlzrDescriptor<T> {
  if (isEntityClass<T>(model)) {
    return model.__mdlzr__;
  } else if (isEntity<T>(model)) {
    return model.constructor.__mdlzr__;
  } else {
    throw new Error(`model ${model.constructor.name} is not an entity`);
  }
}

export function clone<T extends object>(model: Entity<T>): Entity<T> {
  if (!isEntity(model)) {
    throw new Error(`model is not an entity but ${model}`)
  }

  let clone: Entity<T> = new (model.constructor)();
  clone.__cid__ = model.__cid__;
  return clone;
}