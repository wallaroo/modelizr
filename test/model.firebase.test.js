import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import id from "../src/decorators/id"
import Model from "../src/Model"
import FirestoreOrm from "../src/drivers/FirestoreOrm";
import firebase from "firebase-admin";

// Initialize Firebase
const serviceAccount = require("./modelizr-test-b8856144760b.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
});
const db = firebase.firestore();
const simpleorm = new FirestoreOrm(db);

beforeAll(async ()=>{
    const collection = await db.collection("testmodels").get();
    const batch = db.batch();
    collection.forEach((cur)=>{
        batch.delete(cur.ref)
    });
    return batch.commit()
});

@orm(simpleorm)
class ChildModel extends Model{
    @id
    @property({type:"number"})
    id;

    @property({type:"string"})
    foo="bar";
}

@orm(simpleorm)
class TestModel extends Model{
    @id
    @property({type:"number"})
    id;

    @property({type:"string"})
    property="default";

    @property({type:ChildModel})
    child;
}




test("model type",()=>{
    expect(TestModel.getAttrTypes()["property"]).toBeTruthy();
});

test("model save",async ()=>{
    let model = await TestModel.create();
    expect(model.cid );
    expect(model.getChanges()).toBeTruthy();
    expect(await model.get("property")).toBe("default");
    expect(await model.set({property:"value"})).toBeInstanceOf(Model);
    expect(await model.get("property")).toBe("value");

    model = await TestModel.create({id:123});
    expect(model.getChanges()).toBeNull();

    await model.set({property:"1one"});
    expect(model.getChanges()).toBeTruthy();
    await model.save();
    expect(model.getChanges()).toBeNull();
});


test("onchange",async ()=>{
    let model = await TestModel.create();
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
    let parent = await TestModel.create({child:{foo:"barzotto"}});
    const res = await parent.get();
    expect(res.child).toBeTruthy();
    expect(res.child).toBeInstanceOf(ChildModel);
});
test("childmodel",async ()=>{
    const parentChangeHandler = jest.fn();
    const childChangeHandler = jest.fn();
    let parent = await TestModel.create({child:{foo:"barzotto"}});
    expect(Object.keys(parent._subs).length).toBe(1);
    parent.onChange(parentChangeHandler);
    const child = await parent.get("child");
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
    for (const cur of await TestModel.create([{"property":"2two"},{"property":"3three"}])){
        await cur.save()
    }
    res = await TestModel
        .where("property=='field'")
        .where("property",">",1)
        .orderBy("property")
        .startAt(4)
        .limit(2)
        .exec();
    expect(res.length).toBe(3);
    expect(await res[0].get("property")).toBe("1one");
    expect(await res[1].get("property")).toBe("2two");
    expect(await res[2].get("property")).toBe("3three");

    const query = TestModel
        .where("property=='field'")
        .where("property",">",1)
        .orderBy("property")
        .startAt(4)
        .limit(2);
    let runs = 0;
    let handler = jest.fn(async (models)=>{
        if (runs ++ == 0) {
            expect(models.length).toBe(3);
            expect(await models[0].get("property")).toBe("1one");
            expect(await models[1].get("property")).toBe("2two");
            expect(await models[2].get("property")).toBe("3three");
        }else{
            expect(models.length).toBe(2);
            expect(await models[0].get("property")).toBe("1one");
            expect(await models[1].get("property")).toBe("3three");
            done()
        }

    });
    await query.subscribe(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    await res[1].delete();
});

test("immutability", async ()=>{
    const parent = await TestModel.create({property:"one","id":1});
    const parent1 = await TestModel.create({"id":1});
    expect(parent).toBe(parent1);
    const parent2 = await parent1.set({property:"two"});
    expect(parent2).not.toBe(parent1);
});