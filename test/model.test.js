import property from "../src/decorators/property"
import Model from "../src/index"

class TestModel extends Model{
    @property({test:true})
    property="default"
}
test("model type",()=>{
    expect(TestModel.attrTypes["property"]).toBeTruthy();
    console.log(TestModel.attrTypes)
});