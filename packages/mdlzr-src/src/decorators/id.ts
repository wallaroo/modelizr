import Model from "../Model";

export default function id(target:Model, key:string):void{
    target.getClass()._idAttribute=key;
}