//@flow
import {Subject} from "rxjs/Subject"
import type Subscription from "rxjs/Subscription"
import Model from "./Model"
import union from "lodash.union"
import Collection from "./Collection";
type Operator = "==" | ">=" | ">" | "<" | "<=";
type WhereClause = {
    field:string,
    operator: Operator,
    value: number | string | string[] | number[] | null
}

const whereRegexp = /^(\w*)\s?(==|>|<|>=|<=)\s?((['"]\w*['"])|(\d*))$/;

export default class Query<T:Model> {
    model: Class<T>;
    collection: Collection<T>;
    _orderBy: string[] | null;
    _startAt: number | null;
    _limit: number | null;
    _whereClauses: WhereClause[] | null;

    constructor(model: Class<T> | Collection<T>) {
        if (Model.isPrototypeOf(model)) {
            this.model = ((model: any): Class<T>);
            this.collection = this.model.getCollection();
        }else if (model instanceof Collection){
            this.model = model.model;
            this.collection = model;
        }
    }

    orderBy(...fields: string[]):Query<T> {
        if (!this._orderBy) {
            this._orderBy = fields;
        } else {
            this._orderBy = union(this._orderBy, fields)
        }
        return this;
    }

    limit(number: number):Query<T> {
        this._limit = number;
        return this;
    }

    startAt(index: number):Query<T> {
        this._startAt = index;
        return this;
    }

    subscribe(handler: T[] => void): Subscription {
        return this.model.observeQuery(this,handler);
    }

    where(field:string, operator?:Operator, value?:string):Query<T>{
        let clause:WhereClause;
        if (!operator){
            const match = field.match(whereRegexp);
            if (!match) throw "wrong expression syntax";
            clause = (({
                field:match[1],
                operator:match[2],
                value:match[4]||parseInt(match[3]),
            }:any):WhereClause)
        }else if (value){
            clause = {
                field,
                operator,
                value
            };
        }else{
            throw "invalid params"
        }
        if (!this._whereClauses){
            this._whereClauses=[];
        }
        this._whereClauses.push(clause);
        return this;
    }

    async exec(): Promise<T[]> {
        return this.model.executeQuery(this);
    }
}