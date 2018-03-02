import Model, {Cid, FieldObject, ModelClass} from "./Model"
import Query from "./Query";
import Collection from "./Collection";
import {ISubscription} from "rxjs/Subscription"

export interface OrmDriver {
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
    getModelById<T extends Model>(model: ModelClass<T>, id: string | number,collection?:Collection<T>): Promise<T | null>;

    /**
     * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
     */
    getModelByCid(cid: Cid): Model | null;

    executeQuery<T extends Model>(model: ModelClass<T>, query:Query<T>):Promise<T[]>;

    observeQuery<T extends Model>(model: ModelClass<T>, query:Query<T>, handler: (array:T[]) => void): ISubscription;
}