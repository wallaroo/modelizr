import { Class } from './Classes';

export interface IAttrType {
  type?: "number" | "string" | "boolean" | "date" | "object" | Class<any>,
  default?: number | string | boolean | object,
  readOnly?: boolean,
  required?: boolean,
  embedded?: boolean,
  setter?: (value: any) => any,
  getter?: (value: any) => any,
  transient?: boolean
}