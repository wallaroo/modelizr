import { ISubscription } from 'rxjs/Subscription';
import { Entity } from './utils';

export type IObservable<T extends object> = {
  observe: (handler: (value: T[]) => void) => ISubscription
}