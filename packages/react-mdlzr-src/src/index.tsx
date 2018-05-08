import * as React from "react";
import { ComponentType, Component, ComponentClass } from "react";
import { IObservable, ISubscription } from "mdlzr";
import { Entity, isEntity, observeChanges } from 'mdlzr/utils';

const pick = require("lodash.pick");
export type PropsBinding<Props> = { [Key in keyof Props]?: IObservable<any> | Entity<any>}
export type PropsBinder<Props> = (props: Props) => Promise<PropsBinding<Props>>
export type MdlzrProps = { loading: boolean };
export default function mdlzr<Props>(propsbinding: PropsBinder<Props> | PropsBinding<Props>): (cmp: ComponentType<Props>) => ComponentClass<Props> {
  return function (InputComponent: ComponentType<Props & MdlzrProps>): ComponentClass<Props> {
    return class Mdlzr extends Component<Props> {
      static displayName = `Mdlzr(${InputComponent.displayName || InputComponent.name})`;
      state: {
        loading: boolean,
        [ k: string ]: any
      } = {loading: true};
      _subscriptions: { [ k: string ]: ISubscription } = {};

      private loadingProps: string[] = [];

      async getPropsBinding(props: Props): Promise<PropsBinding<Props>> {
        if (typeof propsbinding === "function") {
          return await propsbinding(props)
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
          this._subscribe(propName, propsBinding[ propName as keyof Props ])
        }
      }

      async componentWillReceiveProps(nextProps: Props) {
        const propsBinding = await this.getPropsBinding(this.props);
        const nxtProps = await this.getPropsBinding(nextProps);
        for (const propName of (Object.keys(propsBinding) as Array<keyof Props>)) {
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
    }
  }
}