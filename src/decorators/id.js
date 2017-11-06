//@flow
import Model from "../Model";

export default function id(target:Model, key:string, desc:any){
    target.getClass()._idAttribute=key;
    return desc;
}