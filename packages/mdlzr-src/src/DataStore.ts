import {OrmDriver} from "./OrmDriver";
import {ModelClass} from "./Model";

export type Schema = { [ModelName: string]: ModelClass }

export default function createDataStore<T extends Schema>(value: T, driver: OrmDriver): T {
  const res: any = {};
  for (const modelName of Object.keys(value)) {
    const OrigModel = value[modelName];
    res[modelName] = (class OrmMappedClass extends OrigModel {
      static _ormDriver = driver;
    });
  }
  return res as T;
}
