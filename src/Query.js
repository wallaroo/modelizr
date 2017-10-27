//@flow
import Subject from "rxjs/Subject"
import type Subscription from "rxjs/Subscription"
import type Model from "./"
import union from "lodash.union"
type Operator = "==" | ">=" | ">" | "<" | "<=";
type WhereClause = {
    field:string,
    operator: Operator,
    value: number | string | string[] | number[] | null
}

const whereRegexp = /^(\w*)\s?(==|>|<|>=|<=)\s?((['"]\w*['"])|(\d*))$/;

export default class Query {
    _model: Class<Model>;
    _subject: Subject | null;
    _orderBy: string[] | null;
    _startAt: number | null;
    _limit: number | null;
    _whereClauses: WhereClause[] | null;

    constructor(model: Class<Model>) {
        this._model = model;
    }

    orderBy(...fields: string[]) {
        if (!this._orderBy) {
            this._orderBy = fields;
        } else {
            this._orderBy = union(this._orderBy, fields)
        }
        return this;
    }

    limit(number: number) {
        this._limit = number;
        return this;
    }

    startAt(index: number) {
        this._startAt = index;
        return this;
    }

    subscribe(handler: Model[] => void): Subscription {
        if (this._subject) {
            this._subject = new Subject;
            this._model.observeQuery(this);
        }
        //$FlowFixMe
        const res = this._subject.subscribe(handler);
        // TODO res.add(this._onUnsubscribe)
        return res;
    }

    where(field:string, operator?:Operator, value?:string):Query{
        let clause:WhereClause;
        if (!operator){
            const match = field.match(whereRegexp);
            if (!match) throw "wrong expression syntax"
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

    async exec(): Promise<Model[]> {
        return this._model.executeQuery(this);
    }

    notify(models:Model[]){
        if (this._subject){
            this._subject.next(models);
        }
    }
}