import { END } from "redux-saga"
import { Action, ActionMeta } from 'redux-actions';
import {
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
  subject: Subject<T>
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
  return createStore(MdlzrReduxChannel.reducer);
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

class MdlzrReduxChannel {
  public static singleton = new MdlzrReduxChannel();
  private static state: MdlzrState;
  private static store: Store;
  private emitter?: (action: Action<any> | ActionMeta<any, any> | END) => void;

  private constructor() {

  }

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
    } else if (action.type.startsWith("@@MDLZR/FETCH")) {
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
    } else {
      ret = state;
    }
    MdlzrReduxChannel.state = ret;
    return ret;
  }

  public static setStore(store: Store = defaultStore()) {
    if (!this.store) {
      this.store = store;
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
    if (MdlzrReduxChannel.state) {
      return MdlzrReduxChannel.state;
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
    const state: MdlzrState = MdlzrReduxChannel.getState();
    const cid: string = getCid(entity);
    const mdlzrInstance = state.byCid[ cid ] as MdlzrInstance<T>;
    if (!mdlzrInstance) {
      throw new Error(`Entity ${getClassName(entity.constructor)}[${cid}] isn't in the store yet`)
    }

    return mdlzrInstance.changes[ attribute ] || mdlzrInstance.attributes[ attribute ];
  }

  public set<T extends object, K extends keyof T = keyof T>(entity: Entity<T>, attribute: Partial<T>): void;
  public set<T extends object, K extends keyof T = keyof T>(entity: Entity<T>, attribute: K, value: T[K]): void;
  public set<T extends object, K extends keyof T = keyof T>(entity: Entity<T>, attribute: K | Partial<T>, value?: T[K]) {
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
    const changes: Partial<T> = {};
    if (typeof attribute == 'string') {
      changes[ attribute ] = value;
    } else {
      Object.assign(changes, attribute);
    }
    const setDescriptor = {
      entityClass,
      entity,
      cid,
      id,
      changes: changes
    };

    for (const attribute of Object.keys(changes) as Array<keyof T>) {
      let oldValue;
      if (mdlzrInstance) {
        oldValue = mdlzrInstance.changes[ attribute ] || mdlzrInstance.attributes[ attribute ] as T[K];
      }
      this.dispatch(`SET/${entityClass}/${cid}/${attribute}`, setDescriptor);
      if (oldValue !== value) {
        this.handleChange(entity, attribute, oldValue, value);
        this.notifyObservers<T, K>(entity); // TODO REMOVE
      }
    }
  }

  public fetch<T extends object>(entity: Entity<T>, setHash?: IFieldObject<T>): Entity<T> {
    let res = entity;
    const entityClass = getClassName(entity.constructor);
    const mdlzrDescriptor = getMdlzrDescriptor(entity);
    const cid = getCid(entity);
    const fetchPayload = {
      entityClass,
      entity,
      changes: {} as any,
      attributes: {},
      cid
    } as any;
    const resMdlzr = this.getMdlzrInstance(res);

    if (!setHash) {
      if (resMdlzr) {
        Object.assign(fetchPayload.attributes, resMdlzr.attributes, resMdlzr.changes);
        let id;
        if (mdlzrDescriptor.idAttribute in fetchPayload.attributes) {
          id = fetchPayload.attributes[ mdlzrDescriptor.idAttribute ];
        } else if (resMdlzr) {
          id = resMdlzr.attributes[ mdlzrDescriptor.idAttribute ]
        }
        fetchPayload.id = id;
        this.dispatch(`FETCH/${entityClass}/${cid}`, fetchPayload);
      }
    } else {
      const changes = objectDif(this.getAttributes(entity), setHash);

      if (changes) {
        this.handleChanges(entity, this.getAttributes(entity), changes);
        res = clone(entity);
        Object.assign(fetchPayload.attributes, resMdlzr ? resMdlzr.attributes : null, changes);
        Object.assign(fetchPayload.changes, resMdlzr ? resMdlzr.changes : null);
        for (const key of Object.keys(changes) as Array<keyof T>) {
          delete fetchPayload.changes[ key ];
        }
        let id;
        if (mdlzrDescriptor.idAttribute in setHash) {
          id = setHash[ mdlzrDescriptor.idAttribute ];
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

  public observeChanges<T extends object>(model: Entity<T>, handler: (event: T) => void): Subscription {
    const mdlzr = this.getMdlzrInstance(model);
    return mdlzr.subject.subscribe(handler);
  }

  public getMdlzrInstance<T extends object>(entity: Entity<T> | string): MdlzrInstance<T> {
    let cid: string;
    const state: MdlzrState = MdlzrReduxChannel.getState();

    if (typeof entity === "string") {
      cid = entity;
    } else {
      cid = getCid(entity);
    }
    return state.byCid[ cid ] as MdlzrInstance<T>;
  }

  public getAttributes<T extends object>(model: Entity<T>): IFieldObject<T> {
    const mdlzr = this.getMdlzrInstance(model);
    const res = {};
    if (mdlzr) {
      Object.assign(res, mdlzr.attributes, mdlzr.changes) as IFieldObject<T>;
    }
    return res;
  }

  /**
   * @deprecated
   */
  private notifyObservers<T extends object, K extends keyof T = keyof T>(model: Entity<T>) {
    const mdlzr = MdlzrReduxChannel.singleton.getMdlzrInstance(model);
    if (mdlzr.subject.observers.length) {
      mdlzr.subject.next(clone(model));
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
    return MdlzrReduxChannel.getStore().dispatch(actionObj);
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
      mdlzr.subscriptions[ getCid(nextValue) ] = this.getMdlzrInstance(nextValue).subject.subscribe((model: any) => entity[ key ] = model);
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

export default MdlzrReduxChannel;