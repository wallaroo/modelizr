import { Entity, EntityClass, initEntityClass } from '../utils';

export default function id<T extends object>(target: T, key: keyof T): void {
  const clazz = target.constructor;
  const entityClass = initEntityClass(clazz);
  entityClass.__mdlzr__.idAttribute = key;
}