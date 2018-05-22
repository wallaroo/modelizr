import * as React from "react";
import { ComponentType, Component, ComponentClass, ReactNode } from "react";
import { IObservable, ISubscription } from "mdlzr";
import { Entity, isEntity, observeChanges } from 'mdlzr/utils';

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
        } else {
          return propsbinding;
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

      private _subscribe(propName: string, propValue: IObservable<any> | Entity<any>) {
        const handler = (obj: any) => {
          this.notifyLoaded(propName);
          if (obj !== this.state[ propName ]) {
            this.setState({[ propName ]: obj});
          }
        };
        if (isEntity(propValue)) {
          this._subscriptions[ propName ] = observeChanges(propValue, handler);
          this.setState({[ propName ]: propValue});
          this.notifyLoaded(propName);
        } else {
          this._subscriptions[ propName ] = propValue.observe(handler)
        }
      }

      async componentWillMount() {
        const propsBinding = await this.getPropsBinding(this.props);
        this.loadingProps = Object.keys(propsBinding);
        for (const propName of this.loadingProps) {
          this._subscribe(propName, propsBinding[ propName])
        }
      }

      async componentWillReceiveProps(nextProps: any) {
        const propsBinding = await this.getPropsBinding(this.props);
        const nxtProps = await this.getPropsBinding(nextProps);
        for (const propName of (Object.keys(propsBinding))) {
          if ((this.props as any)[ propName ] !== nxtProps[ propName ]) {
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