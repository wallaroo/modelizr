// @flow
/**
 * returns an obj with only the obj2 fields that differs from obj1
 * @param obj1
 * @param obj2
 */
export function objectDif(obj1:{[string]:any}, obj2:{[string]:any}):{[string]:any}|null{
    if (!obj1){
        return obj2;
    }else if (!obj2){
        return null;
    }else {
        const res = {};
        for (let fieldname of Object.keys(obj2)) {
            if (obj2[fieldname] !== obj1[fieldname]) {
                res[fieldname] = obj2[fieldname];
            }
        }
        return isEmpty(res) ? null : res;
    }
}

export function isEmpty(obj:{[string]:any}|null){
    return !obj || Object.keys(obj).length === 0
}