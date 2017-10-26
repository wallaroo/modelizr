// @flow
import Model,{Cid} from "./"
import type {Field} from "./index";

export interface OrmDriver {
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:Model>(model: T, setHash: {[string]:Field}): Promise<T>;

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T:Model>(model: T, key?: string): Promise<Field|{ [string]: Field }>;

    /**
     * Upserts the model in the ORM
     */
    save<T:Model>(model: T): Promise<T>;

    /**
     * Removes the model in the ORM
     */
    delete<T:Model>(model: T): Promise<boolean>;

    getCidById(model:Model, id:string|number):Cid|null;
}