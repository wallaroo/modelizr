//@flow
import {OrmDriver} from "../src/OrmDriver";
import type Model,{Field} from "../src/";

type MyModel = Model & {_properties?:any};
export default class SimpleOrm implements OrmDriver{
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:MyModel>(model: T, setHash: {[$Keys<T>]:Field}): T{
        model._properties = setHash;
        return model;
    }

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T:MyModel>(model: T, key?: string): Field|{ [$Keys<T>]: Field }{
        let res = null;
        if (key && model._properties){
            return model._properties[key];
        }else if (model._properties){
            res = model._properties;
        }
        return res;
    }

    /**
     * Upserts the model in the ORM
     */
    save<T:Model>(model: T): T{
        return model;
    }

    /**
     * Removes the model in the ORM
     */
    delete<T:Model>(model: T): boolean{
        return false;
    }
}