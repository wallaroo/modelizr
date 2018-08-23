import "reflect-metadata";
import { Entity, EntityClass, initEntityClass, isEntityClass, } from '../utils';
import { IAttrType } from '../IAttrType';
import MdlzrChannel from '../sagas/sagaChannel';

function createGetter<T extends object>(key: keyof T) {
  return function getter(this: Entity<T>) {
    return MdlzrChannel.singleton.get(this, key);
    //initEntity(this);
    // const mdlzr = getMdlzrInstance(this);
    // const res = mdlzr.changes[ key ] || mdlzr.attributes[ key ];
    // return res
  }
}

function createSetter<T extends object, K extends keyof T = keyof T>(key: keyof T) {
  return function setter(this: Entity<T>, value: T[K]) {
    return MdlzrChannel.singleton.set(this, key, value);

    // initEntity(this);
    // const mdlzr = getMdlzrInstance(this);
    // const oldValue = mdlzr.changes[ key ] || mdlzr.attributes[ key ];
    // if (oldValue !== value) {
    //   handleChanges.call(this, mdlzr, key, oldValue, value);
    //   mdlzr.changes[ key ] = value;
    //   notifyObservers(this as object, key, value, oldValue)
    // }
  }
}

// function handleChanges<T extends object>(
//   this: Entity<T>,
//   mdlzr: MdlzrInstance<T>,
//   key: keyof T,
//   currentValue: any,
//   nextValue: any
// ) {
//   if (isEntity(currentValue) && (!nextValue || !haveSameCid(currentValue, nextValue))) {
//     mdlzr.subscriptions[ getCid(currentValue) ].unsubscribe();
//   }
//   if (isEntity(nextValue) && (!currentValue || !haveSameCid(currentValue, nextValue))) {
//     mdlzr.subscriptions[ getCid(nextValue) ] = getMdlzrInstance(nextValue).subject.subscribe(({model}: any) => this[ key ] = model);
//   }
// }

export default (descriptor: IAttrType = {}) => function property<T extends object>(this: any, target: T, key: keyof T): void {
  const clazz: EntityClass<T> = target.constructor as EntityClass<T>;
  initEntityClass(clazz);
  const type = Reflect.getMetadata("design:type", target, key as string);
  if (type !== Object) {
    switch (type) {
      case Number:
        descriptor.type = "number";
        break;
      case String:
        descriptor.type = "string";
        break;
      case Boolean:
        descriptor.type = "boolean";
        break;
      case Date:
        descriptor.type = "date";
        break;
      default:
        descriptor.type = type;
    }
  } else {
    throw new Error(`property ${clazz.name}.${key}: design:type is ${type}: please ensure emitDecoratorMetadata flag is set to true in your tsconfig.json`)
  }
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: createGetter(key),
    set: createSetter(key)
  });
  clazz.__mdlzr__.attrTypes[ key ] = descriptor;
  if (isEntityClass(descriptor.type) || isEntityClass(descriptor.itemType)) {
    clazz.__mdlzr__.childFields.push(key)
  }
}