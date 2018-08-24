import property from "../src/decorators/property"
import id from "../src/decorators/id"
import { getAttrTypes, getCid, getId } from '../src/utils';
import FirestoreOrm from "../src/drivers/FirestoreOrm";
import * as firebase from 'firebase/app';
import "firebase/auth"
import "firebase/firestore"
import Collection from "../src/Collection";
import { IFieldObject } from '../src/IFieldObject';
import entity from '../src/decorators/entity';
import MdlzrReduxChannel from '../src/redux/MdlzrReduxChannel';

const pick = require("lodash.pick");
//
// // Initialize Firebase
const config = {
  apiKey: "AIzaSyDNQJBogA1b7Ou5rY7Rnd3RtUAzH6ORfu8",
  authDomain: "modelizr-test.firebaseapp.com",
  databaseURL: "https://modelizr-test.firebaseio.com",
  projectId: "modelizr-test",
  storageBucket: "modelizr-test.appspot.com",
  messagingSenderId: "790929445331"
};
firebase.initializeApp(config);
const db = firebase.firestore();
db.settings({timestampsInSnapshots: true});
const orm = new FirestoreOrm(db);
beforeAll(()=>{
  MdlzrReduxChannel.setStore();
});
beforeEach(async () => {
  const collection = await db.collection("testmodels").get();
  const collection2 = await db.collection("testCollection").get();
  const collection3 = await db.collection("childmodels").get();
  const collection4 = await db.collection("baseclasses").get();
  const batch = db.batch();
  collection.forEach((cur) => {
    batch.delete(cur.ref)
  });
  collection2.forEach((cur) => {
    batch.delete(cur.ref)
  });
  collection3.forEach((cur) => {
    batch.delete(cur.ref)
  });
  collection4.forEach((cur) => {
    batch.delete(cur.ref)
  });
  return batch.commit()
});

@entity
class BaseClass {
  constructor(obj?: IFieldObject<BaseClass>) {
    Object.assign(this, obj)
  }

  @id
  @property()
  id: number = 0;

  @property()
  description: string;
}

@entity
class ChildModel extends BaseClass {
  constructor(obj?: IFieldObject<ChildModel>) {
    super(obj);
    Object.assign(this, obj)
  }

  @property()
  foo: string = "bar";

  @property({itemType: BaseClass})
  childs: BaseClass[];
}

@entity
class TestModel extends BaseClass {
  constructor(obj?: IFieldObject<TestModel>) {
    super(obj);
    Object.assign(this, obj)
  }

  @property()
  property: string = "default";

  @property()
  child: ChildModel | null;

  @property({itemType: ChildModel, embedded: true})
  childs: ChildModel[];
}

test("model type", () => {
  expect(getAttrTypes(TestModel)[ "property" ]).toBeTruthy();
  const testModel = new TestModel({property: "test"});
  expect(testModel).toBeInstanceOf(TestModel);
  //expect(getMdlzrInstance(testModel)).toBeTruthy();
  expect(testModel.property).toBe("test")
  // const testModel2 = new TestModel();
  // expect(getMdlzrInstance(testModel2)).toBeTruthy();
});

test("model save", async () => {
  let model = new TestModel();
  expect(getCid(model));
  expect(MdlzrReduxChannel.singleton.getChanges(model)).toBeTruthy();
  expect(model.property).toBe("default");
  model.property = "value";
  expect(model.property).toBe("value");

  model.property = "1one";
  expect(MdlzrReduxChannel.singleton.getChanges(model)).toBeTruthy();
  model = await orm.save(model);
  expect(MdlzrReduxChannel.singleton.getChanges(model)).toBeNull();
  return true;
});


test("model save composed", async () => {
  let model = new TestModel();
  model.child = new ChildModel();
  model.child.childs = [ new BaseClass({description: 'descr'}) ];
  await orm.save(model);
  expect(model.id).toBeTruthy();
  expect(model.child.id).toBeTruthy();
  expect(model.child.childs[ 0 ].id).toBeTruthy();
  const doc = await db.collection('childmodels').doc(`${model.child.id}`).get();
  expect(doc.get("childs")[ 0 ].id).toBe(model.child.childs[ 0 ].id);
  return true;
});


test("onchange", async () => {
  let model = new TestModel();
  let handler = jest.fn((model) => expect(model.property).toBe("pippo"));
  model.property = "pluto";
  expect(handler).toHaveBeenCalledTimes(0);
  let subscription = MdlzrReduxChannel.singleton.observeChanges(model, handler);
  expect(handler).toHaveBeenCalledTimes(0);
  expect(subscription).toBeInstanceOf(Object);
  model.property = "pippo";
  expect(handler).toHaveBeenCalledTimes(1);
  model.property = "pippo";
  expect(handler).toHaveBeenCalledTimes(1);
  subscription.unsubscribe();
  model.property = "value2";
  expect(handler).toHaveBeenCalledTimes(1);
  expect.assertions(7)
});

test("onchange observe", async (done) => {
  let model = new TestModel({property: "foo"});
  let handler = jest.fn((model) => {
    expect(model.property).toBe("pippo");
    expect.assertions(4);
    done();
  }).mockImplementationOnce((model) => {
    expect(model.id).toBeTruthy();
  });
  let subscription = MdlzrReduxChannel.singleton.observeChanges(model, handler);
  await orm.save(model);
  expect(model.id).toBeTruthy();
  let sameModelButOther = new TestModel({id: model.id, property: "pippo"});
  expect(handler).toHaveBeenCalledTimes(1);
  await orm.save(sameModelButOther);

});

// test("get", async () => {
//   let parent = await TestModel.create({child: {foo: "barzotto"}}) as TestModel;
//   const res = await parent.getAttributes();
//   expect(res.child).toBeTruthy();
//   expect(res.child).toBeInstanceOf(ChildModel);
// });

test("childmodel", async () => {
  const parentChangeHandler = jest.fn();
  const childChangeHandler = jest.fn();
  let parent = new TestModel();
  parent.child = new ChildModel();
  parent.childs = [ new ChildModel(), new ChildModel() ];
  // expect(Object.keys(parent._subs).length).toBe(1);
  MdlzrReduxChannel.singleton.observeChanges(parent, parentChangeHandler);
  let child = parent.child;
  MdlzrReduxChannel.singleton.observeChanges(child, childChangeHandler);
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
  let newChild = new ChildModel();
  newChild.foo = "barzotto";
  parent.child = newChild;
  parent = await orm.save(parent);
  const childaftersave = parent.child;
  expect(childaftersave).toBeTruthy();
  expect(parent.childs[ 0 ]).toBeTruthy();
  expect(parent.childs[ 0 ]).toBeInstanceOf(ChildModel);
  expect(parent.childs[ 0 ].id).toBeTruthy();
  expect(parent.childs[ 1 ].id).toBeTruthy();
  expect((childaftersave as ChildModel).foo).toBe("barzotto");
});

test("immutability", async () => {
  const parent = new TestModel();
  parent.property = "one";
  parent.id = 1;
  const parent11 = MdlzrReduxChannel.singleton.fetch(parent, {property: "one", "id": 1});
  expect(parent).toBe(parent11);
  await orm.save(parent);
  const parent13 = await orm.getModelById(TestModel, 1);
  expect(parent).toBe(parent13);
});


test("collection", async () => {
  const collection = new Collection(TestModel, {name: "testCollection", keyAttribute: "property"});
  const parent = new TestModel();
  parent.property = "thisisatest";
  const parent2 = new TestModel({property: "thisisanothertest"});
  const saved11 = await collection.save(orm, parent) as TestModel;
  const saved21 = await orm.save(parent2);
  const saved12 = await collection.save(orm, saved11) as TestModel;
  expect(getId(saved11)).toBe(getId(saved12));
  const res = await collection.findByKey(orm, "thisisatest");
  expect(getId(saved21)).toBeTruthy();
  const res21 = await orm.getModelById(TestModel, getId(saved21));
  const res2 = await collection.findByKey(orm, "thisisanothertest");
  expect(res).toBeTruthy();
  // expect(parent).not.toBe(res);
  // expect(saved).not.toBe(parent);
  //expect(saved).toBe(res);
  //expect(res21).toBe(saved21);
  expect(saved21).not.toBe(parent2);
  expect(saved11).toBe(saved12);
  expect(saved12).not.toBe(parent2);
  expect(res).toBe(saved12);
});


test("query", async done => {

  let res = await orm.find(TestModel).exec();
  expect(Array.isArray(res)).toBeTruthy();
  expect(res.length).toBe(0);
  const models = [ {"property": "1one"}, {"property": "2two"}, {"property": "3three"} ].map((cur) => new TestModel(cur));
  models[ 0 ].childs = [ new ChildModel({childs: [ new BaseClass() ]}), new ChildModel() ];
  const saved = [];
  for (const cur of models) {
    saved.push(await orm.save(cur));
  }
  expect(models[ 0 ].childs[ 0 ].id).toBeTruthy();
  expect(models[ 0 ].childs[ 0 ].childs[ 0 ].id).toBeTruthy();
  res = await orm
    .find(TestModel)
    .where("property=='field'")
    .where("property", ">", "1")
    .orderBy("property")
    .startAt(0)
    .limit(10)
    .exec();
  expect(res.length).toBe(3);
  expect(res[ 0 ].property).toBe("1one");
  expect(res[ 1 ].property).toBe("2two");
  expect(res[ 2 ].property).toBe("3three");
  expect(res[ 0 ].childs).toBeTruthy();
  expect(res[ 0 ].childs).toBeInstanceOf(Array);
  expect(res[ 0 ].childs[ 0 ]).toBeTruthy();
  expect(res[ 0 ].childs[ 1 ]).toBeTruthy();
  expect(res[ 0 ].childs[ 0 ]).toBeInstanceOf(ChildModel);
  expect(res[ 0 ].childs[ 1 ]).toBeInstanceOf(ChildModel);
  expect(res[ 0 ].childs[ 0 ].id).toBeTruthy();
  expect(res[ 0 ].childs[ 1 ].id).toBeTruthy();
  const query = orm
    .find(TestModel)
    .where("property=='field'")
    .where("property", ">", "1")
    .orderBy("property")
    .startAt(4)
    .limit(2);
  let runs = 0;
  let handler = jest.fn(async (models: TestModel[]) => {
    runs++;
    if (runs === 1) {
      expect(models.length).toBe(3);
      expect(models[ 0 ].property).toBe("1one");
      expect(models[ 1 ].property).toBe("2two");
      expect(models[ 2 ].property).toBe("3three");
      await orm.delete(res[ 1 ]);
    } else if (runs === 2) {
      expect(models.length).toBe(2);
      expect(models[ 0 ].property).toBe("1one");
      expect(models[ 1 ].property).toBe("3three");
      subscription.unsubscribe();
      done(false);
    }

  });
  const subscription = query.subscribe(handler);
}, 30000);