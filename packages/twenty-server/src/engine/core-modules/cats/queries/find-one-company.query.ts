export const queryFindOneCompany = `query FindOneCompany($objectRecordId: UUID!) {
    company(filter: {id: {eq: $objectRecordId}}) {
      __typename
      domainName
      name
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
      position
      accountOwner {
        __typename
        avatarUrl
        name {
          firstName
          lastName
          __typename
        }
        createdAt
        colorScheme
        chatsId
        locale
        userEmail
        userId
        updatedAt
        id
      }
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
      opportunities {
        edges {
          node {
            __typename
            updatedAt
            amount {
              amountMicros
              currencyCode
              __typename
            }
            closeDate
            id
            createdAt
            name
            probability
            position
            companyId
            pointOfContactId
            stage
          }
          __typename
        }
        __typename
      }
      createdAt
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
      id
      linkedinLink {
        label
        url
        __typename
      }
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
      people {
        edges {
          node {
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
          __typename
        }
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
  }` 