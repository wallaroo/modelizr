import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import Model from "../src/index"
import OrmDriver from "../src/OrmDriver"
import SimpleOrm from "./SimpleOrm";

@orm(new SimpleOrm())
class TestModel extends Model{
    @property({test:true})
    property="default"
}
test("model type",()=>{
    expect(TestModel.attrTypes["property"]).toBeTruthy();
});

test("model set",()=>{
    let model = new TestModel();
    expect(model.cid )
    expect(model.get("property")).toBe("default");
    expect(model.set({property:"value"})).toBeInstanceOf(Model);
    expect(model.get("property")).toBe("value")
});