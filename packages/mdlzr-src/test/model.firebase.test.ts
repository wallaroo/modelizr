import property from "../src/decorators/property"
import id from "../src/decorators/id"
import { getAttrTypes } from '../src/utils';
// import Model from "../src/Model"
// import FirestoreOrm from "../src/drivers/FirestoreOrm";
// import * as firebase from "firebase/app";
// import "firebase/auth"
// import "firebase/firestore"
// import Collection from "../src/Collection";
//
// // Initialize Firebase
// const config = {
//   apiKey: "AIzaSyDNQJBogA1b7Ou5rY7Rnd3RtUAzH6ORfu8",
//   authDomain: "modelizr-test.firebaseapp.com",
//   databaseURL: "https://modelizr-test.firebaseio.com",
//   projectId: "modelizr-test",
//   storageBucket: "modelizr-test.appspot.com",
//   messagingSenderId: "790929445331"
// };
// firebase.initializeApp(config);
// const db = firebase.firestore();
// const orm = new FirestoreOrm(db);
//
// beforeAll(async () => {
//   const collection = await db.collection("testmodels").get();
//   const collection2 = await db.collection("testCollection").get();
//   const collection3 = await db.collection("childmodels").get();
//   const batch = db.batch();
//   collection.forEach((cur) => {
//     batch.delete(cur.ref)
//   });
//   collection2.forEach((cur) => {
//     batch.delete(cur.ref)
//   });
//   collection3.forEach((cur) => {
//     batch.delete(cur.ref)
//   });
//   return batch.commit()
// });
//
class ChildModel{
  @id
  @property()
  id:number;

  @property()
  foo:string = "bar";
}

class TestModel{
  @id
  @property()
  id:number;

  @property()
  property:string = "default";

  @property()
  child:ChildModel;
}
//
//
test("model type", () => {
  expect(getAttrTypes(TestModel)["property"]).toBeTruthy();
});
//
// test("model save", async () => {
//   let model = await TestModel.create() as TestModel;
//   expect(model.cid);
//   expect(model.getChanges()).toBeTruthy();
//   expect(await model.get("property")).toBe("default");
//   expect(model = await model.set({property: "value"})).toBeInstanceOf(Model);
//   expect(await model.get("property")).toBe("value");
//
//   model = await TestModel.create({id: 123}) as TestModel;
//   expect(model.getChanges()).toBeNull();
//
//   model = await model.set({property: "1one"});
//   expect(model.getChanges()).toBeTruthy();
//   model = await model.save(orm);
//   expect(model.getChanges()).toBeNull();
//   return true;
// });
//
//
// test("onchange", async () => {
//   let model = await TestModel.create();
//   let handler = jest.fn(async (model) => expect(await model.get("property")).toBe("pippo"));
//   await model.set({property: "pluto"});
//   expect(handler).toHaveBeenCalledTimes(0);
//   let subscription = model.onChange(handler);
//   expect(handler).toHaveBeenCalledTimes(0);
//   expect(subscription).toBeInstanceOf(Object);
//   expect(await model.set({property: "pippo"})).toBeInstanceOf(Model);
//   expect(handler).toHaveBeenCalledTimes(1);
//   subscription.unsubscribe();
//   await model.set({property: "value2"});
//   expect(handler).toHaveBeenCalledTimes(1);
//   expect.assertions(7)
// });
//
// test("get", async () => {
//   let parent = await TestModel.create({child: {foo: "barzotto"}}) as TestModel;
//   const res = await parent.getAttributes();
//   expect(res.child).toBeTruthy();
//   expect(res.child).toBeInstanceOf(ChildModel);
// });
//
// test("childmodel", async () => {
//   const parentChangeHandler = jest.fn();
//   const childChangeHandler = jest.fn();
//   let parent = TestModel.create({child: {foo: "barzotto"}}) as TestModel;
//   expect(Object.keys(parent._subs).length).toBe(1);
//   parent.onChange(parentChangeHandler);
//   let child = parent.get("child") as ChildModel;
//   child.onChange(childChangeHandler);
//   expect(child).toBeInstanceOf(ChildModel);
//   expect(childChangeHandler).toHaveBeenCalledTimes(0);
//   expect(parentChangeHandler).toHaveBeenCalledTimes(0);
//   child = child.set({foo: "barr"});
//   expect(childChangeHandler).toHaveBeenCalledTimes(1);
//   expect(parentChangeHandler).toHaveBeenCalledTimes(1);
//   parent = parent.set({child: null});
//   expect(childChangeHandler).toHaveBeenCalledTimes(1);
//   expect(parentChangeHandler).toHaveBeenCalledTimes(2);
//   child = child.set({foo: "bazz"});
//   expect(childChangeHandler).toHaveBeenCalledTimes(2);
//   expect(parentChangeHandler).toHaveBeenCalledTimes(2);
//
//   parent = parent.set({child: {foo: "barzotto"}});
//   parent = await parent.save(orm);
//   const childaftersave = parent.get("child") as ChildModel;
//   expect(childaftersave.get("foo")).toBe("barzotto");
// });
//
// test("immutability", async () => {
//   const parent = TestModel.create({property: "one", "id": 1}) as TestModel;
//   const parent11 = parent.fetch({property: "one", "id": 1});
//   expect(parent).toBe(parent11);
//   const parent12 = parent.set({property: "one", "id": 1});
//   expect(parent).toBe(parent12);
//   await parent.save(orm);
//   const parent13 = await TestModel.getById(orm,1);
//   expect(parent).toBe(parent13);
//   // const parent1 = TestModel.create({"id": 1}) as TestModel;
//   // expect(parent).toBe(parent1);
//   // const parent2 = parent1.set({property: "two"});
//   // expect(parent2).not.toBe(parent1);
// });
//
//
// test("collection", async () => {
//   const collection = new Collection(TestModel, {name: "testCollection", keyAttribute: "property"});
//   const parent = await TestModel.create({property: "thisisatest"}) as TestModel;
//   const parent2 = await TestModel.create({property: "thisisanothertest"}) as TestModel;
//   const saved11 = await collection.save(orm, parent) as TestModel;
//   const saved21 = await parent2.save(orm);
//   const saved12 = await collection.save(orm,saved11) as TestModel;
//   expect(saved11.getId()).toBe(saved12.getId());
//   const res = await collection.findByKey(orm,"thisisatest");
//   expect(saved21.getId()).toBeTruthy();
//   const res21 = await TestModel.getById(orm, saved21.getId());
//   const res2 = await collection.findByKey(orm, "thisisanothertest");
//   expect(res).toBeTruthy();
//   // expect(parent).not.toBe(res);
//   // expect(saved).not.toBe(parent);
//   //expect(saved).toBe(res);
//   //expect(res21).toBe(saved21);
//   console.log("AAAAAAAAAAA")
//   expect(saved21).not.toBe(parent2);
//   expect(saved11).toBe(saved12);
//   console.log("BBBBBBBBBB")
//   expect(saved12).not.toBe(parent2);
//   expect(res).toBe(saved12);
// });
//
//
// test("query", async done => {
//
//   let res = await TestModel.find(orm).exec();
//   expect(Array.isArray(res)).toBeTruthy();
//   expect(res.length).toBe(5);
//   for (const cur of (TestModel.create([{"property": "2two"}, {"property": "3three"}]))) {
//     await cur.save(orm)
//   }
//   res = await TestModel
//     .find(orm)
//     .where("property=='field'")
//     .where("property", ">", "1")
//     .orderBy("property")
//     .startAt(0)
//     .limit(10)
//     .exec();
//   expect(res.length).toBe(7);
//   expect(res[0].get("property")).toBe("1one");
//   expect(res[1].get("property")).toBe("2two");
//   expect(res[2].get("property")).toBe("3three");
//
//   const query = TestModel
//     .find(orm)
//     .where("property=='field'")
//     .where("property", ">", "1")
//     .orderBy("property")
//     .startAt(4)
//     .limit(2);
//   let runs = 0;
//   let handler = jest.fn(async (models) => {
//     runs++;
//     console.log(runs)
//     if (runs === 1) {
//       console.log(runs)
//       expect(models.length).toBe(7);
//       expect(models[0].get("property")).toBe("1one");
//       expect(models[1].get("property")).toBe("2two");
//       expect(models[2].get("property")).toBe("3three");
//       console.log(res[1].getAttributes());
//       await res[1].delete(orm);
//     } else if (runs === 2) {
//       console.log(runs)
//       expect(models.length).toBe(6);
//       expect(models[0].get("property")).toBe("1one");
//       expect(models[1].get("property")).toBe("3three");
//       subscription.unsubscribe();
//       done(false);
//     }
//
//   });
//   const subscription = query.subscribe(handler);
// },30000);