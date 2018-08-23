import { END } from "redux-saga"
import { Action, ActionMeta } from 'redux-actions';
import {
  ChangeEvent,
  clone,
  Entity,
  getCid,
  getClassName,
  getMdlzrDescriptor,
  haveSameCid,
  isEmpty,
  isEntity,
  objectDif,
} from '../utils';
import { createStore, Store } from 'redux';
import { Subject, Subscription } from 'rxjs';
import { ISubscription } from 'rxjs/Subscription';
import { IFieldObject } from '../IFieldObject';

export type MdlzrInstance<T, KEYS extends keyof T = keyof T> = {
  attributes: { [key in KEYS]?: T[key] }
  changes: { [key in KEYS]?: T[key] }
  subject: Subject<ChangeEvent<T>>
  subscriptions: { [ cid: string ]: Subscription }
  selfSubscription?: ISubscription
  cid: string
}

interface MdlzrState {
  "byCid": {
    [ cid: string ]: MdlzrInstance<any>
  },
  "byId": {
    [ model: string ]: { [ id: string ]: string }
  }
}

const defState: MdlzrState = {
  byCid: {},
  byId: {}
};

function defaultStore(): Store {
  return createStore(MdlzrSagaChannel.reducer);
}

function initEntityInstance<T>(previous: MdlzrInstance<T> | null | undefined, cid: string): MdlzrInstance<T> {
  let res: MdlzrInstance<T>;
  if (previous) {
    res = {
      ...previous
    }
  } else {
    res = {
      attributes: {},
      changes: {},
      subject: new Subject(),
      subscriptions: {},
      cid
    }
  }
  return res;
}

class MdlzrSagaChannel {
  public static singleton = new MdlzrSagaChannel();
  private static store: Store;
  private static storeRoot: string;
  //private readonly channel: Channel<Action<any> | ActionMeta<any, any>>;
  private emitter?: (action: Action<any> | ActionMeta<any, any> | END) => void;

  // public getSaga(): () => void {
  //   const channel = this.channel;
  //   return function* () {
  //     try {
  //       while (true) {
  //         // take(END) will cause the saga to terminate by jumping to the finally block
  //         let action = yield take(channel);
  //         yield put(action);
  //       }
  //     } finally {
  //       console.log('channel closed')
  //     }
  //   }
  // };

  public static reducer(state: MdlzrState = defState, action: Action<any> | ActionMeta<any, any>) {
    let ret: MdlzrState;
    if (action.type.startsWith("@@MDLZR/SET")) {
      const entityInstance = initEntityInstance(state.byCid[ action.payload.cid ], action.payload.cid);
      entityInstance.changes = Object.assign({}, entityInstance.changes, action.payload.changes);
      ret = {
        byId: {
          ...state.byId,
          [ action.payload.entityClass ]: {
            ...state.byId[ action.payload.entityClass ],
          }
        },
        byCid: {
          ...state.byCid,
          [ action.payload.cid ]: entityInstance
        }
      };
      if (action.payload.id) {
        ret.byId[ action.payload.entityClass ][ action.payload.id ] = action.payload.cid;
      }
    }else if (action.type.startsWith("@@MDLZR/FETCH")) {
      const entityInstance = initEntityInstance(state.byCid[ action.payload.cid ], action.payload.cid);
      entityInstance.changes = action.payload.changes;
      entityInstance.attributes = action.payload.attributes;
      ret = {
        byId: {
          ...state.byId,
          [ action.payload.entityClass ]: {
            ...state.byId[ action.payload.entityClass ],
          }
        },
        byCid: {
          ...state.byCid,
          [ action.payload.cid ]: entityInstance
        }
      };
      if (action.payload.id) {
        ret.byId[ action.payload.entityClass ][ action.payload.id ] = action.payload.cid;
      }
    }else {
      ret = state;
    }
    return ret;
  }

  public static setStore(store: Store = defaultStore(), storeRoot: string = "") {
    if (!this.store) {
      this.store = store;
      this.storeRoot = storeRoot;
      // FIXME maybe is better to subscribe to store and refresh a local state property
    } else {
      throw new Error("Change the store can cause several errors");
    }
  }

  public static getStore(): Store {
    if (this.store) {
      return this.store;
    } else {
      throw new Error("Store not ready yet. Have you called MdlzrSagaChannel.setStore(...)?");
    }
  }

  public static getState(): MdlzrState {
    const state = this.getStore().getState();
    if (!this.storeRoot && state) {
      return state;
    } else if (state && state[ this.storeRoot ]) {
      return state[ this.storeRoot ]
    } else {
      throw new Error("State not ready yet");
    }
  }

  public getChanges<T extends object>(model: Entity<T>): { [ key: string ]: any } | null {
    const mdlzr = this.getMdlzrInstance(model);
    if (isEmpty(mdlzr.changes)) {
      return null;
    } else {
      return Object.assign({}, mdlzr.changes);
    }
  }

  public get<T extends object, K extends keyof T = keyof T>(entity: Entity<T>, attribute: K): T[K] | undefined {
    const state: MdlzrState = MdlzrSagaChannel.getState();
    const cid: string = getCid(entity);
    const mdlzrInstance = state.byCid[ cid ] as MdlzrInstance<T>;
    if (!mdlzrInstance) {
      throw new Error(`Entity ${getClassName(entity.constructor)}[${cid}] isn't in the store yet`)
    }

    return mdlzrInstance.changes[ attribute ] || mdlzrInstance.attributes[ attribute ];
  }

  public set<T extends object, K extends keyof T = keyof T>(entity: Entity<T>, attribute: K, value: T[K]) {
    const cid: string = getCid(entity);
    const mdlzrInstance = this.getMdlzrInstance(entity);
    const mdlzrDescriptor = getMdlzrDescriptor(entity);
    let id;
    if (mdlzrDescriptor.idAttribute === attribute) {
      id = value;
    } else if (mdlzrInstance) {
      id = mdlzrInstance.attributes[ mdlzrDescriptor.idAttribute ]
    }
    const entityClass = getClassName(entity.constructor);
    const setDescriptor = {
      entityClass,
      cid,
      id,
      changes: {[ attribute ]: value}
    };
    let oldValue;
    if (mdlzrInstance) {
      oldValue = mdlzrInstance.changes[ attribute ] || mdlzrInstance.attributes[ attribute ] as T[K];
    }
    this.dispatch(`SET/${entityClass}/${cid}/${attribute}`, setDescriptor);
    if (oldValue !== value) {
      this.handleChange(entity, attribute, oldValue, value);
      this.notifyObservers<T, K>(entity, attribute, value, oldValue)
    }
  }

  public fetch<T extends object>(entity: Entity<T>, setHash?: IFieldObject<T>): Entity<T> {
    let res = entity;
    const entityClass = getClassName(entity.constructor);
    const mdlzrDescriptor = getMdlzrDescriptor(entity);
    const cid = getCid(entity);
    const fetchPayload = {
      changes:{} as any,
      attributes:{},
      cid
    } as any;
    const resMdlzr = this.getMdlzrInstance(res);

    if (!setHash) {
      Object.assign(fetchPayload.attributes, resMdlzr.attributes, resMdlzr.changes);
      let id;
      if (mdlzrDescriptor.idAttribute in fetchPayload.attributes) {
        id = fetchPayload.attributes[mdlzrDescriptor.idAttribute];
      } else if (resMdlzr) {
        id = resMdlzr.attributes[ mdlzrDescriptor.idAttribute ]
      }
      fetchPayload.id = id;
      this.dispatch(`FETCH/${entityClass}/${cid}`, fetchPayload);
    }else {
      const changes = objectDif(this.getAttributes(entity), setHash);

      if (changes) {
        this.handleChanges(entity, this.getAttributes(entity), changes);
        res = clone(entity);
        Object.assign(fetchPayload.attributes, resMdlzr.attributes, changes);
        Object.assign(fetchPayload.changes, resMdlzr.changes);
        for (const key of Object.keys(changes) as Array<keyof T>) {
          delete fetchPayload.changes[ key ];
        }
        let id;
        if (mdlzrDescriptor.idAttribute in setHash) {
          id = setHash[mdlzrDescriptor.idAttribute];
        } else if (resMdlzr) {
          id = resMdlzr.attributes[ mdlzrDescriptor.idAttribute ]
        }
        fetchPayload.id = id;
        this.dispatch(`FETCH/${entityClass}/${cid}`, fetchPayload);
        this.notifyObservers(res);
      }
    }
    return res;
  }

  public observeChanges<T extends object>(model: Entity<T>, handler: (event: ChangeEvent<T>) => void): Subscription {
    const mdlzr = this.getMdlzrInstance(model);
    return mdlzr.subject.subscribe(handler);
  }

  public getMdlzrInstance<T extends object>(entity: Entity<T>): MdlzrInstance<T> {
    const state: MdlzrState = MdlzrSagaChannel.getState();
    const cid: string = getCid(entity);
    let res = state.byCid[ cid ] as MdlzrInstance<T>;
    return res;
  }

  public getAttributes<T extends object>(model: Entity<T>): IFieldObject<T> {
    const mdlzr = this.getMdlzrInstance(model);
    return Object.assign({}, mdlzr.attributes, mdlzr.changes) as IFieldObject<T>;
  }

  private constructor() {
    // this.channel = eventChannel((emitter) => {
    //   this.emitter = emitter;
    //   return () => {
    //     // nothing to do
    //   }
    // }, buffers.fixed())
  }

  private notifyObservers<T extends object, K extends keyof T = keyof T>(model: Entity<T>, attribute?: K, newValue?: T[K], oldValue?: T[K]) {
    const mdlzr = this.getMdlzrInstance(model);
    if (mdlzr.subject.observers.length) {
      mdlzr.subject.next({model: clone(model), attribute, newValue, oldValue});
    }
  }

  private dispatch<P, M>(action: string | Action<P> | ActionMeta<P, M>, payload?: P, meta?: M) {
    let actionObj: Action<P> | ActionMeta<P, M>;
    if (typeof action == 'string') {
      actionObj = {
        type: `@@MDLZR/${action}`,
        payload,
        meta
      }
    } else {
      actionObj = action;
    }
    return MdlzrSagaChannel.getStore().dispatch(actionObj);
  }

  handleChanges<T extends object>(
    model: Entity<T>,
    current: IFieldObject<T>,
    next: Partial<IFieldObject<T>>
  ) {
    for (const attrName of Object.keys(next) as Array<keyof T>) {
      this.handleChange(model, attrName, current[ attrName ], next[ attrName ])
    }
  }

  private handleChange<T extends object>(
    entity: Entity<T>,
    key: keyof T,
    currentValue: any,
    nextValue: any
  ) {
    const mdlzr = this.getMdlzrInstance(entity);
    if (isEntity(currentValue) && (!nextValue || !haveSameCid(currentValue, nextValue))) {
      mdlzr.subscriptions[ getCid(currentValue) ].unsubscribe();
    }
    if (isEntity(nextValue) && (!currentValue || !haveSameCid(currentValue, nextValue))) {
      mdlzr.subscriptions[ getCid(nextValue) ] = this.getMdlzrInstance(nextValue).subject.subscribe(({model}: any) => entity[ key ] = model);
    }
  }

  private emit(action: Action<any> | ActionMeta<any, any>) {
    if (this.emitter) {
      this.emitter(action);
    } else {
      throw new Error("emitter isn't ready yet!");
    }
  }
}

export default MdlzrSagaChannel;