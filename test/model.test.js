import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import Model from "../src/index"
import SimpleOrm from "../src/drivers/SimpleOrm";

const simpleorm = new SimpleOrm();

@orm(simpleorm)
class ChildModel extends Model{
    @property({type:"string"})
    foo="bar";
}

@orm(simpleorm)
class TestModel extends Model{
    @property({type:"string"})
    property="default";

    @property({type:ChildModel})
    child;
}




test("model type",()=>{
    expect(TestModel.getAttrTypes()["property"]).toBeTruthy();
});

test("model set",async ()=>{
    let model = TestModel.create();
    expect(model.cid );
    expect(model.getChanges()).toBeTruthy();
    expect(await model.get("property")).toBe("default");
    expect(await model.set({property:"value"})).toBeInstanceOf(Model);
    expect(await model.get("property")).toBe("value");

    model = TestModel.create({id:123});
    expect(model.getChanges()).toBeNull();
});


test("onchange",async ()=>{
    let model = TestModel.create();
    let handler = jest.fn(async (model)=>expect(await model.get("property")).toBe("pippo"));
    await model.set({property:"pluto"});
    expect(handler).toHaveBeenCalledTimes(0);
    let subscription = model.onChange(handler);
    expect(handler).toHaveBeenCalledTimes(0);
    expect(subscription).toBeInstanceOf(Object);
    expect(await model.set({property:"pippo"})).toBeInstanceOf(Model);
    expect(handler).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
    await model.set({property:"value2"});
    expect(handler).toHaveBeenCalledTimes(1);
    expect.assertions(7)
});


test("childmodel",async ()=>{
    let model = TestModel.create({child:{foo:"barzotto"}});
    expect(await model.get("child")).toBeInstanceOf(ChildModel);
});