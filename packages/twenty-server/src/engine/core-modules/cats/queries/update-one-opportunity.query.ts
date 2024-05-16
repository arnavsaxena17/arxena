export const updateOneOpportunity = `mutation UpdateOneOpportunity($idToUpdate: ID!, $input: OpportunityUpdateInput!) {
    updateOpportunity(id: $idToUpdate, data: $input) {
      __typename
      updatedAt
      amount {
        amountMicros
        currencyCode
        __typename
      }
      pointOfContact {
        __typename
        xLink {
          label
          url
          __typename
        }
        jobTitle
        id
        createdAt
        linkedinLink {
          label
          url
          __typename
        }
        city
        updatedAt
        companyId
        phone
        email
        avatarUrl
        category
        name {
          firstName
          lastName
          __typename
        }
        position
      }
      closeDate
      attachments {
        edges {
          node {
            __typename
            type
            updatedAt
            fullPath
            personId
            name
            id
            conversationId
            createdAt
            authorId
            chatId
            activityId
            opportunityId
            companyId
          }
          __typename
        }
        __typename
      }
      id
      createdAt
      name
      probability
      position
      companyId
      events {
        edges {
          node {
            __typename
            id
            chatId
            companyId
            properties
            name
            createdAt
            workspaceMemberId
            updatedAt
            conversationId
            opportunityId
            personId
          }
          __typename
        }
        __typename
      }
      pointOfContactId
      stage
      company {
        __typename
        domainName
        name
        position
        idealCustomerProfile
        annualRecurringRevenue {
          amountMicros
          currencyCode
          __typename
        }
        xLink {
          label
          url
          __typename
        }
        createdAt
        id
        linkedinLink {
          label
          url
          __typename
        }
        accountOwnerId
        address {
          addressStreet1
          addressStreet2
          addressCity
          addressState
          addressCountry
          addressPostcode
          addressLat
          addressLng
          __typename
        }
        updatedAt
        employees
      }
      favorites {
        edges {
          node {
            __typename
            companyId
            position
            createdAt
            conversationId
            personId
            opportunityId
            chatId
            id
            workspaceMemberId
            updatedAt
          }
          __typename
        }
        __typename
      }
      activityTargets {
        edges {
          node {
            __typename
            updatedAt
            conversationId
            activityId
            chatId
            createdAt
            opportunityId
            personId
            id
            companyId
          }
          __typename
        }
        __typename
      }
    }
  }`