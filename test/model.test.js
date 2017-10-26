import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import Model from "../src/index"
import SimpleOrm from "./SimpleOrm";

@orm(new SimpleOrm())
class TestModel extends Model{
    @property({test:true})
    property="default"
}
test("model type",()=>{
    expect(TestModel.getAttrTypes()["property"]).toBeTruthy();
});

test("model set",async ()=>{
    let model = new TestModel();
    expect(model.cid );
    expect(model.getChanges()).toBeTruthy();
    expect(await model.get("property")).toBe("default");
    expect(await model.set({property:"value"})).toBeInstanceOf(Model);
    expect(await model.get("property")).toBe("value")

    model = new TestModel({id:123});
    expect(model.getChanges()).toBeNull();
});


test("onchange",async ()=>{
    let model = new TestModel();
    let handler = jest.fn((value)=>expect(value).toBe("pippo"));

    let subscription = model.onChange(handler);
    expect(subscription).toBeInstanceOf(Object);
    expect(await model.set({property:"value"})).toBeInstanceOf(Model);
    model._subject.next("pippo");
    expect(handler).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
    model._subject.next("pippo");
    expect(handler).toHaveBeenCalledTimes(1);
});