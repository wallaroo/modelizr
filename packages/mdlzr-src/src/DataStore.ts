import {OrmDriver} from "./OrmDriver";
import {ModelClass} from "./Model";

export type Schema = { [ModelName: string]: ModelClass }

type Options<T extends object> =
{
    [K in keyof T]:T[K];
}

function createDataStore<T extends object>(value: T): Options<T> {
    return Object.assign({}, value);
}

var c = createDataStore({t: 0});
