//@flow
import Model from "../index";
import OrmDriver from "../OrmDriver";

export default (ormDriver:OrmDriver)=>function orm(target:Class<Model>){
    target._ormDriver = ormDriver;
}