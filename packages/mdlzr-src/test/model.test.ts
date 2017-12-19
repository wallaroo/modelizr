import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import id from "../src/decorators/id"
import Model from "../src/Model"
import SimpleOrm from "../src/drivers/SimpleOrm";
import "core-js/shim"

const executeQuery = jest.fn(async (model, query)=>{
    return TestModel.create([{property:"one"},{property:"two"},{property: "three"}]);
}).mockReturnValueOnce(["a"]);

const observeQuery = jest.fn(async (model,query, handler)=>{
    handler(await model.create([{property:"four"},{property: "five"}]));
    setTimeout(async ()=>handler(await model.create([{property:"six"},{property: "seven"}])),1000)
});

const simpleorm = new SimpleOrm({
    executeQuery,
    observeQuery
});

@orm(simpleorm)
class ChildModel extends Model{
    @id
    @property()
    id:number;

    @property({default:"bar"})
    foo:string;
}

@orm(simpleorm)
class TestModel extends Model{
    @id
    @property()
    id:number;

    @property({default:"default"})
    property:string;

    @property({type:ChildModel})
    child;
}




test("model type",()=>{
    expect(TestModel.getAttrTypes()["property"]).toBeTruthy();
    expect(Model.isPrototypeOf(TestModel)).toBeTruthy();
});

test("model set",async ()=>{
    let model = await TestModel.create() as TestModel;
    expect(model.cid );
    expect(model.getChanges()).toBeTruthy();
    expect(await model.get("property")).toBe("default");
    expect(await model.set({property:"value"})).toBeInstanceOf(Model);
    expect(await model.get("property")).toBe("value");

    model = await TestModel.create({id:123}) as TestModel;
    expect(model.getChanges()).toBeNull();
});


test("onchange",async ()=>{
    let model = await TestModel.create() as TestModel;
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

test("get", async ()=>{
    let parent = await TestModel.create({child:{foo:"barzotto"}}) as TestModel;
    const res = await parent.getAttributes();
    expect(res.child).toBeTruthy();
    expect(res.child).toBeInstanceOf(ChildModel);
});
test("childmodel",async ()=>{
    const parentChangeHandler = jest.fn();
    const childChangeHandler = jest.fn();
    let parent = await TestModel.create({child:{foo:"barzotto"}}) as TestModel;
    expect(Object.keys(parent._subs).length).toBe(1);
    parent.onChange(parentChangeHandler);
    const child = await parent.get("child") as ChildModel;
    child.onChange(childChangeHandler);
    expect(child).toBeInstanceOf(ChildModel);
    expect(childChangeHandler).toHaveBeenCalledTimes(0);
    expect(parentChangeHandler).toHaveBeenCalledTimes(0);
    await child.set({foo:"barr"});
    expect(childChangeHandler).toHaveBeenCalledTimes(1);
    expect(parentChangeHandler).toHaveBeenCalledTimes(1);
    await parent.set({child:null});
    expect(childChangeHandler).toHaveBeenCalledTimes(1);
    expect(parentChangeHandler).toHaveBeenCalledTimes(2);
    await child.set({foo:"bazz"});
    expect(childChangeHandler).toHaveBeenCalledTimes(2);
    expect(parentChangeHandler).toHaveBeenCalledTimes(2);
});

test("query", async done =>{
    let res = await TestModel.find().exec();
    expect(Array.isArray(res)).toBeTruthy();
    expect(res.length).toBe(1);
    res = await TestModel
        .find()
        .where("property=='field'")
        .where("property",">","1")
        .orderBy("property")
        .startAt(4)
        .limit(2)
        .exec();
    expect(res.length).toBe(3);
    expect(await res[0].get("property")).toBe("one");
    expect(await res[1].get("property")).toBe("two");
    expect(await res[2].get("property")).toBe("three");

    let q = TestModel
        .find()
        .where("property=='field'")
        .where("property",">","1")
        .orderBy("property")
        .startAt(4)
        .limit(2);
    let runs = 0;
    let handler = jest.fn(async (models)=>{
        if (runs ++ == 0) {
            expect(models.length).toBe(2);
            expect(await models[0].get("property")).toBe("four");
            expect(await models[1].get("property")).toBe("five");
        }else{
            expect(models.length).toBe(2);
            expect(await models[0].get("property")).toBe("six");
            expect(await models[1].get("property")).toBe("seven");
            done()
        }

    });
    await q.subscribe(handler);
    expect(handler).toHaveBeenCalledTimes(1);
});

test("immutability", async ()=>{
    const parent = await TestModel.create({property:"one","id":1}) as TestModel;
    const parent1 = await TestModel.create({"id":1}) as TestModel;
    expect(parent).toBe(parent1);
    const parent2 = await parent1.set({property:"two"});
    expect(parent2).not.toBe(parent1);
});