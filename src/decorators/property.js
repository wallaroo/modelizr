//@flow
import Model from "../index";
import type {AttrType} from "../index";

export default (descriptor:AttrType)=>function property(target:Model, key:string, desc:any){
    let def = desc.initializer && desc.initializer();
    if (def !== undefined)
        descriptor.default = def;
    target.getClass()._attrTypes[key]=descriptor;
    return desc;
}