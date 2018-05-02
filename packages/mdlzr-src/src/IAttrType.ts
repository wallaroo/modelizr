import { Class } from './Classes';

export interface IAttrType {
  type?: "number" | "string" | "boolean" | "date" | "object" | Class<any>,
  /** TO REMOVE WHEN https://github.com/Microsoft/TypeScript/issues/7169 Will be resolved */
  itemType?: "number" | "string" | "boolean" | "date" | "object" | Class<any>,
  default?: number | string | boolean | object,
  readOnly?: boolean,
  required?: boolean,
  embedded?: boolean,
  setter?: (value: any) => any,
  getter?: (value: any) => any,
  transient?: boolean
}