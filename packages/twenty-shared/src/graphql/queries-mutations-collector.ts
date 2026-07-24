import * as allMutations from './mutations';
import * as allQueries from './queries';


export const queries = Object.entries(allQueries).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && key !== 'queries') {
        acc[key] = value;
    }
    return acc;
}, {} as Record<string, string>);

// console.log("queries", queries);

export const mutations = Object.entries(allMutations).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && key !== 'mutations') {
        acc[key] = value;
    }
    return acc;
}, {} as Record<string, string>);

// console.log("mutations", mutations);