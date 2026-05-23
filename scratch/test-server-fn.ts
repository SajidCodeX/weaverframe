import { createServerFn } from '@tanstack/react-start';

console.log("createServerFn is:", createServerFn);
const fn = createServerFn({ method: 'POST' });
console.log("fn methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(fn)));
console.log("fn keys:", Object.keys(fn));
