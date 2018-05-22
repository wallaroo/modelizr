import React, { Component} from 'react';
import ReactDOM from 'react-dom'
import mdlzr, { MdlzrProps } from './index'
import { id } from 'mdlzr';

export class TestModel {
  @id
  id:string
}

export type TestProps = {
  test:string,
  test2: TestModel,
  other?: string
} & MdlzrProps;

class TestComponent extends Component<TestProps>{
  render(){
    return (
      <div>
        Hello World
      </div>
    )
  }
}

export const Cmp1 = mdlzr({test2: new TestModel()})(TestComponent);
export const Cmp2 = mdlzr((props)=>{
  return {test: ""}
})(TestComponent);


ReactDOM.render(
  <div>
    <Cmp1 test={"df"}/>
    <Cmp2 test2={new TestModel()}/>
  </div>,
  document.getElementById("root")
)