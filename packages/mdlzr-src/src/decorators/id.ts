import Model from "../Model";

export default function id(target:Model, key:string){
    target.getClass()._idAttribute=key;
}