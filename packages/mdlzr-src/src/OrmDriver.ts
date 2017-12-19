import Model, {Cid, FieldObject, ModelClass} from "./Model"
import {FieldValue} from "./Model";
import Query from "./Query";
import Collection from "./Collection";
import {ISubscription} from "rxjs/Subscription"

export interface OrmDriver {
    /**
     * Sets properties and if something changes isChanged will return true and getChanges will return changed fields
     */
    set<T extends Model>(model: T, setHash: FieldObject): T;

    /**
     * Sets properties bypassing changes eventually pre-existing changes will be dropped
     */
    fetch<T extends Model>(model: T, setHash: FieldObject): T;

    /**
     * Gets the current value for the given property
     */
    get<T extends Model>(model: T, key: string): FieldValue;

    /**
     * Gets the current value for the given property
     */
    getAttributes<T extends Model>(model: T, key?: string): FieldObject;

    getId(model: Model): number | string | null;
    /**
     * Upserts the model in the ORM
     */
    save<T extends Model>(model: T, collection?:Collection<T>): Promise<T>;

    /**
     * Removes the model in the ORM
     */
    delete<T extends Model>(model: T, collection?:Collection<T>): Promise<void>;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getCidById(model: ModelClass, id: string | number): Cid | null;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelById<T extends Model>(model: ModelClass, id: string | number,collection?:Collection<T>): Promise<T | null>;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelByCid(cid: Cid): Model | null;

    /**
     * gets the changes from the last fetch
     */
    getChanges(model: Model): FieldObject | null;

    executeQuery<T extends Model>(model: ModelClass, query:Query<T>):Promise<T[]>;

    observeQuery<T extends Model>(model: ModelClass, query:Query<T>, handler: (array:T[]) => void): ISubscription;
}