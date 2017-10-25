// @flow
import Model from "./"
import type {Field} from "./index";

export interface OrmDriver {
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:Model>(model: T, setHash: {[$Keys<T>]:Field}): T;

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T:Model>(model: T, key?: string): Field|{ [$Keys<T>]: Field };

    /**
     * Upserts the model in the ORM
     */
    save<T:Model>(model: T): T;

    /**
     * Removes the model in the ORM
     */
    delete<T:Model>(model: T): boolean;
}