import {OrmDriver} from "../OrmDriver";

export default (ormDriver: OrmDriver) => function orm(target: any) {
    target._ormDriver = ormDriver;
}