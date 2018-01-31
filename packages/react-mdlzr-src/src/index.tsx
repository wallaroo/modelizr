import * as React from "react";
import {ComponentType,Component} from "react";
import {IObservable, ISubscription} from "mdlzr";
const pick = require("lodash.pick");
export type PropsBinding = { [k:string]: IObservable }
export type PropsBinder = (props:{ [k:string]: any }) => PropsBinding

export default function mdlzr <Props extends {[k:string]:any}>(propsbinding: PropsBinder | PropsBinding | string[]): (cmp:ComponentType<Props>) => ComponentType<Props> {
    return function (InputComponent: ComponentType<Props>): ComponentType<Props> {
        return class Mdlzr extends Component<Props>{
            static displayName = `Mdlzr(${InputComponent.displayName || InputComponent.name})`;
            state:{[k:string]:any} = {};
            _subscriptions:{[k:string]:ISubscription} = {};

            getPropsBinding(props:Props):PropsBinding{
                if (typeof propsbinding === "function"){
                    return propsbinding(props)
                }else if (Array.isArray(propsbinding)){
                    return pick(props, propsbinding);
                }else{
                    return propsbinding;
                }
            }

            _subscribe(propName:string, propValue:IObservable){
                this._subscriptions[propName] = propValue.observe((obj)=>{
                    if (obj !== this.state[propName]){
                        this.setState({[propName]:obj});
                    }
                })
            }

            componentWillMount(){
                const propsBinding = this.getPropsBinding(this.props);
                for(const propName of Object.keys(propsBinding)){
                    this._subscribe(propName, propsBinding[propName])
                }
            }

            componentWillReceiveProps(nextProps:Props){
                const propsBinding = this.getPropsBinding(this.props);
                const nxtProps = this.getPropsBinding(nextProps);
                for(const propName of Object.keys(propsBinding)){
                    if (this.props[propName] !== nxtProps[propName]) {
                        this._subscriptions[propName] && this._subscriptions[propName].unsubscribe();
                        this._subscribe(propName, propsBinding[propName]);
                    }
                }
            }

            componentWillUnmount(){
                for(const propName of Object.keys(this._subscriptions)){
                    this._subscriptions[propName].unsubscribe();
                }
            }

            render(){
                return <InputComponent {...this.props} {...this.state}/>
            }
        }
    }
}