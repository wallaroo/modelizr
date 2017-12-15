import property from "../src/decorators/property"
import orm from "../src/decorators/orm"
import id from "../src/decorators/id"
import Model from "../src/Model"
import FirestoreOrm from "../src/drivers/FirestoreOrm";
import * as firebase from "firebase/app";
import "firebase/auth"
import "firebase/firestore"
import Collection from "../src/Collection";

// Initialize Firebase
//const serviceAccount = require("./modelizr-test-b8856144760b.json");
var config = {
    apiKey: "AIzaSyDNQJBogA1b7Ou5rY7Rnd3RtUAzH6ORfu8",
    authDomain: "modelizr-test.firebaseapp.com",
    databaseURL: "https://modelizr-test.firebaseio.com",
    projectId: "modelizr-test",
    storageBucket: "modelizr-test.appspot.com",
    messagingSenderId: "790929445331"
};
firebase.initializeApp(config);
const db = firebase.firestore();
const simpleorm = new FirestoreOrm(db);

beforeAll(async ()=>{
    const collection = await db.collection("testmodels").get();
    const collection2 = await db.collection("testCollection").get();
    const batch = db.batch();
    collection.forEach((cur)=>{
        batch.delete(cur.ref)
    });
    collection2.forEach((cur)=>{
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
    const res = await parent.getAttributes();
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
    jest.setTimeout(30000);
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
        if (runs === 0) {
            expect(models.length).toBe(3);
            expect(await models[0].get("property")).toBe("1one");
            expect(await models[1].get("property")).toBe("2two");
            expect(await models[2].get("property")).toBe("3three");
            await res[1].delete();
        }else if (runs === 1){
            expect(models.length).toBe(2);
            expect(await models[0].get("property")).toBe("1one");
            expect(await models[1].get("property")).toBe("3three");
            subscription.unsubscribe();
            done(false);
        }else{
            console.log(runs)
        }
        runs ++
    });
    const subscription = query.subscribe(handler);
});

test("immutability", async ()=>{
    const parent = await TestModel.create({property:"one","id":1});
    const parent11 = await parent.fetch({property:"one","id":1});
    expect(parent).toBe(parent11);
    const parent12 = await parent.set({property:"one","id":1});
    expect(parent).toBe(parent12);
    const parent13 = await TestModel.getById(1);
    expect(parent).toBe(parent13);
    const parent1 = await TestModel.create({"id":1});
    expect(parent).toBe(parent1);
    const parent2 = await parent1.set({property:"two"});
    expect(parent2).not.toBe(parent1);
});


test("collection", async()=>{
    const collection = new Collection(TestModel, {name:"testCollection", keyAttribute:"property"});
    const parent = await TestModel.create({property:"thisisatest"});
    const parent2 = await TestModel.create({property:"thisisanothertest"});
    const saved = await collection.save(parent);
    const saved21 = await parent2.save();
    const saved22 = await collection.save(parent2);
    const res = await collection.findByKey("thisisatest");
    expect(saved21.getId()).toBeTruthy();
    const res21 = await TestModel.getById(saved21.getId());
    const res2 = await collection.findByKey("thisisanothertest");
    expect(res).toBeTruthy();
    expect(parent).not.toBe(res);
    expect(saved).not.toBe(parent);
    expect(saved).toBe(res);

    expect(res21).toBe(saved21);
    expect(saved21).not.toBe(parent2);
    expect(saved21).toBe(saved22);
    expect(saved22).not.toBe(parent2);
    expect(res2).toBe(saved22);
});