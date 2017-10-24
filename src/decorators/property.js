//@flow
import Model from "../index";
import type {AttrType} from "../index";

export default (descriptor:AttrType)=>function property(target:Model, key:string){
    target.class._attrTypes[key]=descriptor;
    return descriptor;
}