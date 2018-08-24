import * as React from "react";
import { Component, ComponentClass, ComponentType } from "react";
import { IObservable, ISubscription } from "mdlzr";
import { Entity, isEntity } from 'mdlzr/utils';
import MdlzrReduxChannel from 'mdlzr/redux/MdlzrReduxChannel';

export type Omit<T, K extends keyof T> = Pick<T, ({ [P in keyof T]: P } & { [P in K]: never } & { [ x: string ]: never, [ x: number ]: never })[keyof T]>;

const pick = require("lodash.pick");
// export type PropsBinding<Props, K extends keyof Props = keyof Props> = { [Key in K]?: IObservable<any> | Entity<any>}
// export type PropsBinder<Props, PB extends PropsBinding<Props>, KPB extends keyof Props = keyof Props> = (props: Props) => Promise<PB>
// export type MdlzrProps = { loading: boolean, children?: ReactNode };

export interface PropsBinder<TStateProps, TOwnProps> {
  (ownProps: TOwnProps): TStateProps;
}

export type PropsBinderParam<TStateProps, TOwnProps> = PropsBinder<TStateProps, TOwnProps> | TStateProps;

export type Shared<
  InjectedProps,
  DecorationTargetProps extends Shared<InjectedProps, DecorationTargetProps>
  > = {
  [P in Extract<keyof InjectedProps, keyof DecorationTargetProps>]?: DecorationTargetProps[P] extends InjectedProps[P] ? InjectedProps[P] : never;
};

export interface InferableComponentEnhancerWithProps<TInjectedProps, TNeedsProps> {
  <P extends Shared<TInjectedProps, P>>(
    component: ComponentType<P>
  ): ComponentClass<Omit<P, keyof Shared<TInjectedProps, P>> & TNeedsProps> & {WrappedComponent: ComponentType<P>}
}

export type MdlzrProps = {loading: boolean};

export default function mdlzr<TStateProps = {}, TOwnProps = {}>(propsbinding: PropsBinderParam<TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<TStateProps & TOwnProps & MdlzrProps, TOwnProps> {
  return (function (InputComponent: any){
    return (class Mdlzr extends Component<any> {
      static displayName = `Mdlzr(${InputComponent.displayName || InputComponent.name})`;
      state: {
        loading: boolean,
        [ k: string ]: any
      } = {loading: true};
      _subscriptions: { [ k: string ]: ISubscription } = {};

      private loadingProps: string[] = [];

      async getPropsBinding(props: any): Promise<any> {
        if (typeof propsbinding === "function") {
          return await propsbinding(props as any)
        } else if (Array.isArray(propsbinding)) {
          return pick(props, propsbinding);
        } else if (propsbinding){
          return propsbinding;
        } else {
          return props;
        }
      }

      private notifyLoaded(propName: string) {
        const i = this.loadingProps.indexOf(propName);
        if (i >= 0) {
          this.loadingProps.splice(i, 1);
          if (!this.loadingProps.length) {
            this.setState({loading: false});
          }
        }
      }

      private _subscribe<T extends object>(propName: string, propValue: IObservable<T> | Entity<T>) {
        const handler = (model:any) => {
          this.notifyLoaded(propName);
          if (model !== this.state[ propName ]) {
            this.setState({[ propName ]: model});
          }
        };
        if (isEntity<T>(propValue)) {
          this._subscriptions[ propName ] = MdlzrReduxChannel.singleton.observeChanges(propValue, handler);
          this.setState({[ propName ]: propValue});
          this.notifyLoaded(propName);
        } else {
          this._subscriptions[ propName ] = propValue.observe(handler)
        }
      }

      async componentDidMount() {
        const propsBinding = await this.getPropsBinding(this.props);
        this.loadingProps = Object.keys(propsBinding);
        for (const propName of this.loadingProps) {
          this._subscribe(propName, propsBinding[ propName])
        }
      }

      async componentDidUpdate(prevProps: any) {
        const propsBinding = await this.getPropsBinding(this.props);
        const prvProps = await this.getPropsBinding(prevProps);
        for (const propName of (Object.keys(propsBinding))) {
          if ((this.props as any)[ propName ] !== prvProps[ propName ]) {
            this._subscriptions[ propName ] && this._subscriptions[ propName ].unsubscribe();
            this._subscribe(propName, propsBinding[ propName ]);
          }
        }
      }

      componentWillUnmount() {
        for (const propName of Object.keys(this._subscriptions)) {
          this._subscriptions[ propName ].unsubscribe();
        }
      }

      render() {
        return <InputComponent {...this.props} {...this.state}/>
      }
    }) as any;
  }) as InferableComponentEnhancerWithProps<TStateProps & TOwnProps & MdlzrProps, TOwnProps>;
}