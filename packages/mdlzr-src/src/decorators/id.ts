import { Entity, EntityClass, initEntityClass } from '../utils';

export default function id<T extends object>(target: Entity<T>, key: keyof T): void {
  const clazz = target.constructor;
  initEntityClass(clazz);
  clazz.__mdlzr__.idAttribute = key;
}