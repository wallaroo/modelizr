import Model,{ModelClass} from "../Model";
import {OrmDriver} from "../OrmDriver";

export default (ormDriver: OrmDriver) => function orm(target: ModelClass) {
    target._ormDriver = ormDriver;
}