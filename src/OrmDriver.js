// @flow
import Model, {Cid} from "./Model"
import type {FieldValue} from "./Model";
import Query from "./Query";
import Collection from "./Collection";

export interface OrmDriver {
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T:Model>(model: T, setHash: { [string]: FieldValue }): T;

    /**
     * Sets properties bypassing changes eventually pre-existing changes will be dropped
     */
    fetch<T:Model>(model: T, setHash: { [string]: FieldValue }): T;

    /**
     * Gets the current value for the given property
     * if key is null gets all properties hash
     */
    get<T:Model>(model: T, key?: string): Promise<FieldValue | { [string]: FieldValue }>;

    getId(model: Model): number | string | null;
    /**
     * Upserts the model in the ORM
     */
    save<T:Model>(model: T, collection?:Collection<T>): Promise<T>;

    /**
     * Removes the model in the ORM
     */
    delete<T:Model>(model: T, collection?:Collection<T>): Promise<void>;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getCidById(model: Class<Model>, id: string | number): Cid | null;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelById<T:Model>(model: Class<T>, id: string | number,collection?:Collection<T>): Promise<T | null>;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelByCid(cid: Cid): Model | null;

    /**
     * gets the changes from the last fetch
     */
    getChanges(model: Model): { [string]: FieldValue } | null;

    executeQuery<T:Model>(model: Class<T>, query:Query<T>):Promise<T[]>;

    observeQuery<T:Model>(model: Class<T>, query:Query<T>):Promise<void>;
}