"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.List = exports.cons = void 0;
/**
 * cons "constructs" a list node, if no second argument is specified it is the last node in the list
 */
exports.cons = (head, rest) => (selector) => selector(head, rest);
const get = (list, index) => index == 0 ? head(list) : get(rest(list), index - 1);
/**
 * head selector, returns the first element in the list
 * @param list is a Cons (note, not an empty ConsList)
 */
const head = (list) => list((head, rest) => head);
/**
 * rest selector, everything but the head
 * @param list is a Cons (note, not an empty ConsList)
 */
const rest = (list) => list((head, rest) => rest);
const forEach = (f, list, index = 0) => {
    if (list) {
        f(head(list), index);
        forEach(f, rest(list), index += 1);
    }
};
const map = (f, l) => l ? exports.cons(f(head(l)), map(f, rest(l))) : null;
const filter = (f, list) => list ? (f(head(list)) ? exports.cons(head(list), filter(f, rest(list))) : filter(f, rest(list))) : null;
const reduce = (f, initial, list) => list ? reduce(f, f(initial, head(list)), rest(list)) : initial;
const concat = (a, b) => a ? exports.cons(head(a), concat(rest(a), b)) : b ? exports.cons(head(b), concat(rest(b))) : null;
/**
 * A linked list backed by a ConsList
 */
class List {
    constructor(list) {
        this.map = (f) => new List(map(f, this.head));
        this.get = (index) => get(this.head, index);
        this.filter = (f) => new List(filter(f, this.head));
        this.reduce = (f, i) => reduce(f, i, this.head);
        this.concat = (other) => new List(concat(this.head, other.head)); // ???
        this.head = (list === undefined) ? null : list;
    }
    forEach(f) {
        forEach(f, this.head);
        return this; // return a reference to this List, so other methods can be chained.
    }
}
exports.List = List;
//# sourceMappingURL=cons.js.map