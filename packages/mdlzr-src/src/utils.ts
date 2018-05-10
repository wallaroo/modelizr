import { ISubscription, Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';
import Collection from './Collection';
import { Class } from './Classes';
import { IAttrTypes } from './IAttrTypes';
import { IFieldObject } from './IFieldObject';

const pick = require('lodash.pick');
const omit = require('lodash.omit');
let cid = 1;

export type MdlzrDescriptor<T extends object> = {
  idAttribute: keyof T
  collection: Collection<T>
  name: string,
  attrTypes: IAttrTypes
}

export type MdlzrInstance<T, KEYS extends keyof T = keyof T> = {
  attributes: { [key in KEYS]?: T[key] }
  changes: { [key in KEYS]?: T[key] }
  subject: Subject<T>
  subscriptions: { [ cid: string ]: Subscription }
  selfSubscription?:ISubscription
  cid: string
}

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

export type Entity<T extends object> = T & { __mdlzr__?: MdlzrInstance<T>, constructor: EntityClass<T> }

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

export function notifyObservers<T extends object>(model: Entity<T>){
  const mdlzr = getMdlzrInstance(model);
  if (mdlzr.subject.observers.length) {
    mdlzr.subject.next(clone(model));
  }
}

export function isEmpty(obj: { [ key: string ]: any } | null) {
  return !obj || Object.keys(obj).length === 0
}

export function getAttrTypes<T extends object>(model: MaybeEntityClass<T> | Entity<T>): IAttrTypes {
  return getMdlzrDescriptor(model).attrTypes;
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

export function initEntityClass<T extends object>(entity: EntityClass<T>): void {
  if (!entity.hasOwnProperty("__mdlzr__")) {
    let parent:any = entity.__mdlzr__ || {attrTypes: {}, idAttribute: null};
    Object.defineProperty(entity, "__mdlzr__", {
      enumerable: false,
      writable: false,
      value: {
        name: entity.name,
        attrTypes: {...parent.attrTypes},
        idAttribute: parent.idAttribute
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
}


export function initEntity<T extends object>(entity: Entity<T>) {
  if (!entity.__mdlzr__) {
    Object.defineProperty(entity, "__mdlzr__", {
      enumerable: false,
      writable: false,
      value: {
        attributes: {},
        changes: {},
        subject: new Subject(),
        subscriptions: {},
        cid: `${cid++}`
      } as MdlzrInstance<T>
    });
  }
}

export function isEntity<T extends object>(model: any): model is Entity<T> {
  return model && typeof model === 'object' && !!model.__mdlzr__;
}

export function isEntityClass<T extends object>(model: any): model is EntityClass<T> {
  return model && typeof model === 'function' && !!model.__mdlzr__;
}

export function getCid(model: Entity<any>): string
export function getCid(model: object): null
export function getCid(model: Entity<any>): string | null {
  return isEntity(model) ? getMdlzrInstance(model).cid : null;
}

export function getId<T extends object>(model: Entity<T>): string
export function getId<T extends object>(model: object): null
export function getId<T extends object>(model: Entity<T>) {
  return isEntity<T>(model) ? model[ getMdlzrDescriptor<T>(model).idAttribute ] : null;
}

export function haveSameCid(modelA: Entity<any>, modelB: Entity<any>) {
  return getCid(modelA) === getCid(modelB);
}

export function getMdlzrInstance<T extends object>(model: Entity<T>): MdlzrInstance<T> {
  if (!model.__mdlzr__) {
    throw new Error(`model ${model.constructor.name} is not an entity`);
  } else {
    return model.__mdlzr__;
  }
}

export function getMdlzrDescriptor<T extends object>(model: EntityClass<T> | Entity<T>): MdlzrDescriptor<T> {
  if (isEntityClass<T>(model)) {
    return model.__mdlzr__;
  } else if (isEntity(model)) {
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
  initEntity(clone);
  Object.assign(clone.__mdlzr__, model.__mdlzr__);
  return clone;
}

export function getChanges<T extends object>(model: Entity<T>): { [ key: string ]: any } | null {
  const mdlzr = getMdlzrInstance(model);
  if (isEmpty(mdlzr.changes)) {
    return null;
  } else {
    return Object.assign({}, mdlzr.changes);
  }
}

export function observeChanges<T extends object>(model: Entity<T>, handler: (model: T) => void): Subscription {
  const mdlzr = getMdlzrInstance(model);
  return mdlzr.subject.subscribe(handler);
}

export function getAttributes<T extends object>(model: Entity<T>): IFieldObject<T> {
  initEntity(model);
  const mdlzr = getMdlzrInstance(model);
  return Object.assign({}, mdlzr.attributes, mdlzr.changes) as IFieldObject<T>;
}

export function resolveAttributes<T extends object>(clazz: EntityClass<T>, setHash: IFieldObject<T>): IFieldObject<T> {
  // TODO implement me
  return setHash;
}

export function fetch<T extends object>(model: Entity<T>, setHash?: IFieldObject<T>): Entity<T> {
  initEntity(model);
  let res = model;
  if (!setHash) {
    const resMdlzr = getMdlzrInstance(res);
    Object.assign(resMdlzr.attributes, resMdlzr.changes);
    resMdlzr.changes = {};
    return res;
  }
  setHash = resolveAttributes(model.constructor, setHash);
  const changes = objectDif(getAttributes(model), setHash);

  if (changes) {
    handleChanges(model, getAttributes(model), changes);
    res = clone(model);
    const resMdlzr = getMdlzrInstance(res);
    Object.assign(resMdlzr.attributes, changes);
    for (const key of Object.keys(changes) as Array<keyof T>) {
      delete resMdlzr.changes[ key ];
    }
    notifyObservers(res);
  }
  return res;
}

export function handleChanges<T extends object>(
  model: Entity<T>,
  current: IFieldObject<T>,
  next: Partial<IFieldObject<T>>
) {
  for (const attrName in next) {
    handleChange.call(model, getMdlzrInstance(model), attrName, current[ attrName ], next[ attrName ])
  }
}

export function handleChange<T extends object>(
  this: Entity<T>,
  mdlzr: MdlzrInstance<T>,
  key: keyof T,
  currentValue: any,
  nextValue: any
) {
  if (isEntity(currentValue) && (!nextValue || !haveSameCid(currentValue, nextValue))) {
    mdlzr.subscriptions[ getCid(currentValue) ].unsubscribe();
  }
  if (isEntity(nextValue) && (!currentValue || !haveSameCid(currentValue, nextValue))) {
    mdlzr.subscriptions[ getCid(nextValue) ] = getMdlzrInstance(nextValue).subject.subscribe((child: any) => this[ key ] = child);
  }
}

export function getRef<T extends object>(model: Entity<T>): { [ k: string ]: string | number | null } {
  return {[ getIdAttribute(model) ]: getId(model)}
}