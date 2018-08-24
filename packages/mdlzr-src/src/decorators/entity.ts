import { initEntityClass } from '../utils';

let cid = 1;

function cidGetter(this: any) {
  if (!this[ "$$cid$$" ]) {
    this[ "$$cid$$" ] = `${cid++}`;
  }
  return this[ "$$cid$$" ];
}

function cidSetter(this: any, value:string) {
  this[ "$$cid$$" ] = value;
}

export default function entity(clazz: any) {
  initEntityClass(clazz);
  Object.defineProperty(clazz.prototype, "__cid__", {
    enumerable: false,
    configurable: false,
    get: cidGetter,
    set: cidSetter
  })
}