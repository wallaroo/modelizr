import Query from "../Query";
import Collection from "../Collection";
import { ISubscription } from "rxjs/Subscription"
import { Entity, EntityClass, getCollection, isEntityClass, MaybeEntityClass } from '../utils';
import { FetchOption, OrmDriver } from '../OrmDriver';
import { Action, ActionMeta } from 'redux-actions';
import { Dispatch } from 'redux';

export default class ReduxOrm implements OrmDriver  {
  private baseActionName: string;
  private innerDispatch: Dispatch;

  public constructor(dispatch: Dispatch, baseActionName = "@@MDLZR") {
    this.baseActionName = baseActionName;
    this.innerDispatch = dispatch;
  }

  public observeQuery<T extends object>(modelClass: EntityClass<T>,
                                 query: Query<T>,
                                 handler: (h: T[]) => void): ISubscription {
    this.dispatch(`${query.collection.name.toUpperCase()}/QUERY_SUBSCRIBE`, query);
    return {
      closed: false,
      unsubscribe: () => this.dispatch(`${query.collection.name.toUpperCase()}/QUERY_UNSUBSCRIBE`, query)
    }
  }

  public async executeQuery<T extends object>(model: EntityClass<T>,
                                       query: Query<T>): Promise<T[]> {
    return this.dispatch<T[]>(`${query.collection.name.toUpperCase()}/QUERY_EXECUTE`, query, {async: true})
  }

  /**
   * Removes the model in the ORM
   */
  public async delete<T extends object>(model: Entity<T>,
                                 collection: Collection<T> = getCollection(model.constructor)): Promise<void> {
    return this.dispatch<void>(`${collection.name.toUpperCase()}/DELETE`, {model, collection}, {async: true});
  }

  /**
   * Upserts the model in the ORM
   */
  public async save<T extends object>(model: Entity<T>,
                               collection: Collection<T> = getCollection(model.constructor)): Promise<T> {
    return this.dispatch<T>(`${collection.name.toUpperCase()}/SAVE`, {model, collection}, {async: true});
  }

  public async getModelById<T extends object>(modelClass: MaybeEntityClass<T>,
                                       id: string | number,
                                       collection: Collection<T> = getCollection(modelClass),
                                       options?: FetchOption<T>): Promise<T> {
    return this.dispatch<T>(`${collection.name.toUpperCase()}/GET/${id}`, options, {async: true});
  }

  private async dispatch<R, T=any, M=any>(type: string, payload?: T, meta?: M): Promise<R> {
    return this.innerDispatch(this.action<T,M>(type, payload, meta)) as any as R;
  }

  private action<T, M>(type: string, payload?: T, meta?: M): Action<T> | ActionMeta<T, M> {
    return {
      type: `${this.baseActionName}/${type}`,
      payload,
      meta
    };
  }

  find<T extends object>(model: MaybeEntityClass<T>): Query<T> {
    if (isEntityClass<T>(model)) {
      return new Query<T>(this, model);
    } else {
      throw new Error(`class ${model.name} isn't an Entity`)
    }
  }
}