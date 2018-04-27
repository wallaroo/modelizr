import { ISubscription } from 'rxjs/Subscription';

export type IObservable = {
  observe: (handler: (value: any) => void) => ISubscription
}