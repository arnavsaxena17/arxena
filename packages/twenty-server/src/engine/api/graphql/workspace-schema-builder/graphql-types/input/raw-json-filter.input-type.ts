import { GraphQLBoolean, GraphQLFloat, GraphQLInputObjectType, GraphQLList, GraphQLString } from 'graphql';

import { FilterIs } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/input/filter-is.input-type';

export const RawJsonFilterType = new GraphQLInputObjectType({
  name: 'RawJsonFilter',
  fields: {
    is: { type: FilterIs },
    like: {
      type: GraphQLString,
      description: 'Pattern match with % wildcard (e.g. %value%)',
    },
    path: {
      type: GraphQLString,
      description: 'Top-level JSON key to filter on',
    },
    eq: { type: GraphQLString },
    neq: { type: GraphQLString },
    in: { type: new GraphQLList(GraphQLString) },
    gt: { type: GraphQLFloat },
    gte: { type: GraphQLFloat },
    lt: { type: GraphQLFloat },
    lte: { type: GraphQLFloat },
    isEmpty: { type: GraphQLBoolean },
  },
});
