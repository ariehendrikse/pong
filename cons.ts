import { isExternalModuleNameRelative, ModuleKind } from "typescript";

export type ConsList<T> = Cons<T> | null;

/**
 * The return type of the cons function, is itself a function
 * which can be given a selector function to pull out either the head or rest
 */
type Cons<T> = (selector: Selector<T>) => T | ConsList<T>;

/**
 * a selector will return either the head or rest
 */
type Selector<T> = (head:T, rest:ConsList<T>)=> T | ConsList<T>;

/**
 * cons "constructs" a list node, if no second argument is specified it is the last node in the list
 */
export const cons =<T>(head:T, rest: ConsList<T>): Cons<T> =>(selector: Selector<T>) => selector(head, rest);

const get = <T>(list:Cons<T>,index:number):T => index==0?head(list):get(rest(list),index-1)

/**
 * head selector, returns the first element in the list
 * @param list is a Cons (note, not an empty ConsList)
 */
const head= <T>(list:Cons<T>):T =><T>list((head, rest?) => head);

/**
 * rest selector, everything but the head
 * @param list is a Cons (note, not an empty ConsList)
 */
const rest = <T>(list:Cons<T>):ConsList<T> =><Cons<T>>list((head, rest?) => rest);

const forEach = <T>(f: (_:T,index:number)=>void, list:ConsList<T>,index:number=0): void=> {
    if (list) {
        f(head(list),index);
        forEach(f,rest(list),index+=1);
    }
}

const map = <T, V>(f: (_: T) => V, l: ConsList<T>): ConsList<V> => l ? cons(f(head(l)), map(f, rest(l))) : null;

const filter = <U>(f: (x: U) => boolean, list: ConsList<U>) : Cons<U> => list ?(f(head(list)) ? cons(head(list), filter(f, rest(list))) : filter(f, rest(list))): null;

const reduce = <U, V>(f: (accumulator: U, x: V) => U, initial: U, list: ConsList<V>) : U => list ? reduce(f, f(initial, head(list)), rest(list)) : initial;

const concat = <U>(a: ConsList<U>, b?: ConsList<U>): ConsList<U>=> a ? cons(head(a), concat(rest(a), b)) : b ? cons(head(b), concat(rest(b))): null

/**
 * A linked list backed by a ConsList
 */
export class List<T> {
    private readonly head: ConsList<T>;

    constructor(list:ConsList<T>) {
        this.head = (list === undefined) ? null : list;
    }
    map = <V>(f : (x: T) => V): List<V> => new List(map(f, this.head));

    get = (index: number):T => get(this.head,index);


    forEach(f: (x: T,index:number) => void): List<T> {
        forEach(f, this.head);
        return this; // return a reference to this List, so other methods can be chained.
    }

    filter=(f: (x: T) => boolean) =>new List(filter(f, this.head))


    reduce=<V>(f: (acc: V, x: T) => V, i: V): V =>reduce(f, i, this.head)

    concat=(other: List<T>) =>new List(concat(this.head, other.head))// ???
}

