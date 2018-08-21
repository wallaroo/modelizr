import { IAttrType } from './IAttrType';

export type IAttrTypes<T> = { [K in keyof T]: IAttrType };
