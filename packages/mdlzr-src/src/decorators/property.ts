import {AttrType} from "../Model";
import "reflect-metadata";
export default (descriptor:AttrType = {default:null,type:null})=>function property(target:any, key:string):void{
    let def = target[key];
    const type = Reflect.getMetadata("design:type",target, key);
    if (type != Object){
        switch (type){
            case Number:
                descriptor.type = "number";
                break;
            case String:
                descriptor.type = "string";
                break;
            case Boolean:
                descriptor.type = "boolean";
                break;
            default:
                descriptor.type = type;
        }
    }
    if (def !== undefined)
        descriptor.default = def;
    if(!target.getClass().hasOwnProperty("_attrTypes")) {
        target.getClass()._attrTypes = {}
    }
    target.getClass()._attrTypes[key]=descriptor;
}