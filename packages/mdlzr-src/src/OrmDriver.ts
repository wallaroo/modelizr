import Query from "./Query";
import Collection from "./Collection";
import { ISubscription } from "rxjs/Subscription"
import { Class } from './Classes';

export type FetchOption<T> = {
  [K in keyof T]?: boolean | FetchOption<T[K]>
}

export type FetchOptions<T extends object> = {
  collection?: Collection<T>,
  load?: FetchOption<T>
}

export interface OrmDriver {
  /**
   * Upserts the model in the ORM
   */
  save<T extends object>(model: T, collection?: Collection<T>): Promise<T>;

  /**
   * Removes the model in the ORM
   */
  delete<T extends object>(model: T, collection?: Collection<T>): Promise<void>;

  /**
   * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
   */
  getModelById<T extends object>(model: Class<T>, id: string | number, collection?: Collection<T>, option?: FetchOption<T>): Promise<T | null>;

  // /**
  //  * gets the cid of the model with the passed id if the relative model is already fetched, null otherwise
  //  */
  // getModelByCid<T extends object>(cid: Cid): Entity<T>;

  executeQuery<T extends object>(model: Class<T>, query: Query<T>): Promise<T[]>;

  observeQuery<T extends object>(model: Class<T>, query: Query<T>, handler: (array: T[]) => void): ISubscription;

  find<T extends object>(model: Class<T>): Query<T>;
}