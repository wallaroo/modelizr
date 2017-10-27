//@flow
import Subject from "rxjs/Subject"
import type Subscription from "rxjs/Subscription"
import type Model from "./"
import union from "lodash.union"
export default class Query{
    _model:Class<Model>;
    _subject:Subject|null;
    _orderBy:string[]|null;
    _startAt:number|null;
    _limit:number|null;

    constructor(model:Class<Model>){
        this._model = model;
    }

    orderBy(...fields:string[]){
        if (!this._orderBy){
            this._orderBy = fields;
        }else{
            this._orderBy = union(this._orderBy, fields)
        }
    }

    limit(number:number){
        this._limit = number;
    }

    startAt(index:number){
        this._startAt = index;
    }

    subscribe(handler:Model[]=>void):Subscription{
        if (this._subject) {
            this._subject = new Subject;
            this._model.observeQuery(this);
        }
        //$FlowFixMe
        const res = this._subject.subscribe(handler);
        // TODO res.add(this._onUnsubscribe)
        return res;
    }

    async get():Promise<Model[]>{
        return this._model.executeQuery(this);
    }
}