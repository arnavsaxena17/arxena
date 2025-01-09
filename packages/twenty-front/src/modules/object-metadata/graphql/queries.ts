import { gql } from '@apollo/client';

export const FIND_MANY_OBJECT_METADATA_ITEMS = gql`
  query ObjectMetadataItems(
    $objectFilter: objectFilter
    $fieldFilter: fieldFilter
  ) {
    objects(paging: { first: 1000 }, filter: $objectFilter) {
      edges {
        node {
          id
          dataSourceId
          nameSingular
          namePlural
          labelSingular
          labelPlural
          description
          icon
          isCustom
          isRemote
          isActive
          isSystem
          createdAt
          updatedAt
          labelIdentifierFieldMetadataId
          imageIdentifierFieldMetadataId
          fields(paging: { first: 1000 }, filter: $fieldFilter) {
            edges {
              node {
                id
                type
                name
                label
                description
                icon
                isCustom
                isActive
                isSystem
                isNullable
                createdAt
                updatedAt
                fromRelationMetadata {
                  id
                  relationType
                  toObjectMetadata {
                    id
                    dataSourceId
                    nameSingular
                    namePlural
                    isSystem
                    isRemote
                  }
                  toFieldMetadataId
                }
                toRelationMetadata {
                  id
                  relationType
                  fromObjectMetadata {
                    id
                    dataSourceId
                    nameSingular
                    namePlural
                    isSystem
                    isRemote
                  }
                  fromFieldMetadataId
                }
                defaultValue
                options
                relationDefinition {
                  relationId
                  direction
                  sourceObjectMetadata {
                    id
                    nameSingular
                    namePlural
                  }
                  sourceFieldMetadata {
                    id
                    name
                  }
                  targetObjectMetadata {
                    id
                    nameSingular
                    namePlural
                  }
                  targetFieldMetadata {
                    id
                    name
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;


// graphql/queries.ts
export const FIND_BASIC_OBJECT_METADATA = gql`
  query BasicObjectMetadata($objectFilter: objectFilter) {
    objects(paging: { first: 1000 }, filter: $objectFilter) {
      edges {
        node {
          id
          dataSourceId
          nameSingular
          namePlural
          labelSingular
          labelPlural
          description
          icon
          isCustom
          isRemote
          isActive
          isSystem
          createdAt
          updatedAt
          labelIdentifierFieldMetadataId
          imageIdentifierFieldMetadataId
          __typename
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
        __typename
      }
    }
  }
`;

export const FIND_OBJECT_FIELDS = gql`
  query ObjectFields($objectId: ID!, $fieldFilter: fieldFilter) {
    object(id: $objectId) {
      fields(paging: { first: 1000 }, filter: $fieldFilter) {
        edges {
          node {
            id
            type
            name
            label
            description
            icon
            isCustom
            isActive
            isSystem
            isNullable
            createdAt
            updatedAt
            defaultValue
            options
            fromRelationMetadata {
              id
              relationType
              toObjectMetadata {
                id
                dataSourceId
                nameSingular
                namePlural
                isSystem
                isRemote
                __typename
              }
              toFieldMetadataId
              __typename
            }
            toRelationMetadata {
              id
              relationType
              fromObjectMetadata {
                id
                dataSourceId
                nameSingular
                namePlural
                isSystem
                isRemote
                __typename
              }
              fromFieldMetadataId
              __typename
            }
            __typename
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
          __typename
        }
      }
    }
  }
`;