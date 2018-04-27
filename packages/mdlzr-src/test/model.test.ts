import property from "../src/decorators/property"
import id from "../src/decorators/id"
import "core-js/shim"
import { getAttrTypes, getChanges, observeChanges } from '../src/utils';
import SimpleOrm from '../src/drivers/SimpleOrm';
import { OrmDriver } from '../src/OrmDriver';

const executeQuery = jest.fn(async (model, query) => {
  return [ {property: "one"}, {property: "two"}, {property: "three"} ].map((raw) => Object.assign(new model(), raw));
}).mockReturnValueOnce([ "a" ]);

const observeQuery = jest.fn(async (model, query, handler) => {
  handler([ {property: "four"}, {property: "five"} ].map((raw) => Object.assign(new TestModel(), raw)));
  setTimeout(async () => handler([ {property: "six"}, {property: "seven"} ].map((raw) => Object.assign(new model(), raw))), 1000)
});

const orm:OrmDriver = new SimpleOrm({
  executeQuery,
  observeQuery
});

class ChildModel {

  @id
  @property()
  id: number;

  @property()
  foo: string = "bar";
}

class TestModel {
  @id
  @property()
  id: number;

  @property()
  property: string = "default";

  @property()
  child: ChildModel | null;
}

test("Model Class attrTypes", () => {
  expect(getAttrTypes(TestModel)[ "property" ]).toBeTruthy();
  new TestModel()
});

test("Model Class creation", () => {
  const model = new TestModel();
  expect(model.property).toBe("default");
  model.property = "ciccio";
  const model2 = new TestModel();
  expect(model.property).toBe("ciccio");
  expect(model2.property).toBe("default");
  expect(getChanges(model)).toBeTruthy()
});

test("Model onChange", () => {
  let model = new TestModel();
  let handler = jest.fn(
    (changedmodel) => {
      expect(changedmodel.property).toBe("pippo");
      expect(changedmodel).not.toBe(model);
    }
  );
  expect(handler).toHaveBeenCalledTimes(0);
  let subscription = observeChanges(model, handler);
  expect(handler).toHaveBeenCalledTimes(0);
  expect(subscription).toBeInstanceOf(Object);
  model.property = "pippo";
  expect(handler).toHaveBeenCalledTimes(1);
  subscription.unsubscribe();
  model.property = "value2";
  expect(handler).toHaveBeenCalledTimes(1);
  expect.assertions(7)
});

test("childmodel", async () => {
  const parentChangeHandler = jest.fn((model)=> expect(model).toBeInstanceOf(TestModel));
  const childChangeHandler = jest.fn((model)=> expect(model).toBeInstanceOf(ChildModel));
  let parent = new TestModel();
  parent.child = new ChildModel();
  parent.child.foo = "barzotto";
  // expect(Object.keys(parent._subs).length).toBe(1);
  const parentSubs = observeChanges(parent, parentChangeHandler);
  const child = parent.child;
  const childSubs = observeChanges(child, childChangeHandler);
  expect(child).toBeInstanceOf(ChildModel);
  expect(childChangeHandler).toHaveBeenCalledTimes(0);
  expect(parentChangeHandler).toHaveBeenCalledTimes(0);
  child.foo = "barr";
  expect(childChangeHandler).toHaveBeenCalledTimes(1);
  expect(parentChangeHandler).toHaveBeenCalledTimes(1);
  parent.child = null;
  expect(childChangeHandler).toHaveBeenCalledTimes(1);
  expect(parentChangeHandler).toHaveBeenCalledTimes(2);
  child.foo = "bazz";
  expect(childChangeHandler).toHaveBeenCalledTimes(2);
  expect(parentChangeHandler).toHaveBeenCalledTimes(2);
  expect.assertions(13);
});

test("query", async done =>{
    let res = await orm.find(TestModel).exec();
    expect(Array.isArray(res)).toBeTruthy();
    expect(res.length).toBe(1);
    res = await orm.find(TestModel)
        .where("property=='field'")
        .where("property",">","1")
        .orderBy("property")
        .startAt(4)
        .limit(2)
        .exec();
    expect(res.length).toBe(3);
    expect(await res[0].property).toBe("one");
    expect(await res[1].property).toBe("two");
    expect(await res[2].property).toBe("three");

    let q = orm.find(TestModel)
        .where("property=='field'")
        .where("property",">","1")
        .orderBy("property")
        .startAt(4)
        .limit(2);
    let runs = 0;
    let handler = jest.fn(async (models)=>{
        if (runs ++ == 0) {
            expect(models.length).toBe(2);
            expect(await models[0].property).toBe("four");
            expect(await models[1].property).toBe("five");
        }else{
            expect(models.length).toBe(2);
            expect(await models[0].property).toBe("six");
            expect(await models[1].property).toBe("seven");
            done()
        }

    });
    await q.subscribe(handler);
    expect(handler).toHaveBeenCalledTimes(1);
},30000);

// test("query", async done =>{
//     let res = await TestModel.find(orm).exec();
//     expect(Array.isArray(res)).toBeTruthy();
//     expect(res.length).toBe(1);
//     res = await TestModel
//         .find(orm)
//         .where("property=='field'")
//         .where("property",">","1")
//         .orderBy("property")
//         .startAt(4)
//         .limit(2)
//         .exec();
//     expect(res.length).toBe(3);
//     expect(await res[0].get("property")).toBe("one");
//     expect(await res[1].get("property")).toBe("two");
//     expect(await res[2].get("property")).toBe("three");
//
//     let q = TestModel
//         .find(orm)
//         .where("property=='field'")
//         .where("property",">","1")
//         .orderBy("property")
//         .startAt(4)
//         .limit(2);
//     let runs = 0;
//     let handler = jest.fn(async (models)=>{
//         if (runs ++ == 0) {
//             expect(models.length).toBe(2);
//             expect(await models[0].get("property")).toBe("four");
//             expect(await models[1].get("property")).toBe("five");
//         }else{
//             expect(models.length).toBe(2);
//             expect(await models[0].get("property")).toBe("six");
//             expect(await models[1].get("property")).toBe("seven");
//             done()
//         }
//
//     });
//     await q.subscribe(handler);
//     expect(handler).toHaveBeenCalledTimes(1);
// },30000);
//
// // test("immutability", async ()=>{
// //     const parent = await TestModel.create({property:"one","id":1}) as TestModel;
// //     const parent1 = await TestModel.create({"id":1}) as TestModel;
// //     expect(parent).toBe(parent1);
// //     const parent2 = await parent1.set({property:"two"});
// //     expect(parent2).not.toBe(parent1);
// // });