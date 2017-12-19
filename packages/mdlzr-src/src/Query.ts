const union = require("lodash.union");
import {ISubscription} from "rxjs/Subscription"
import Model,{ModelClass} from "./Model"

import Collection from "./Collection";
export type Operator = "==" | ">=" | ">" | "<" | "<=";
type WhereClause = {
    field:string,
    operator: Operator,
    value: number | string | string[] | number[] | null
}

const whereRegexp = /^(\w*)\s?(==|>|<|>=|<=)\s?((['"]\w*['"])|(\d*))$/;

export default class Query<T extends Model> {
    model: ModelClass;
    collection: Collection<T>;
    _orderBy: string[] | null;
    _startAt: number | null;
    _limit: number | null;
    private _whereClauses: WhereClause[] | null;

    constructor(model: ModelClass | Collection<T>) {
        if (Model.isPrototypeOf(model)) {
            this.model = model as ModelClass;
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

    subscribe(handler: (array:T[]) => void): ISubscription {
        return this.model.observeQuery(this,handler);
    }

    where(field:string, operator?:Operator, value?:string):Query<T>{
        let clause:WhereClause;
        if (!operator){
            const match = field.match(whereRegexp);
            if (!match) throw "wrong expression syntax";
            clause = {
                field:match[1],
                operator:match[2] as Operator,
                value:match[4]||parseInt(match[3]),
            }
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