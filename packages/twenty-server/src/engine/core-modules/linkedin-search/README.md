# LinkedIn Search Module

This module provides comprehensive LinkedIn search functionality using the Unipile API. It supports searching for people, companies, posts, and jobs across LinkedIn Classic, Sales Navigator, and Recruiter APIs.

## Features

- **Multiple API Support**: LinkedIn Classic, Sales Navigator, and Recruiter APIs
- **Comprehensive Search Types**: People, companies, posts, and jobs
- **Parameter Management**: Dynamic parameter retrieval for search filters
- **Pagination Support**: Cursor-based pagination for large result sets
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# LinkedIn Unipile API Configuration
LINKEDIN_UNIPILE_BASE_URL=https://api1.unipile.com:13111
LINKEDIN_UNIPILE_API_KEY=your_api_key_here
```

### Required Setup

1. **Unipile Account**: You need a valid Unipile account with LinkedIn integration
2. **LinkedIn Account**: Connect your LinkedIn account through Unipile
3. **API Key**: Obtain your Unipile API key from the dashboard

## API Endpoints

### Search Endpoints

#### General Search
```http
POST /linkedin-search/search
```

#### People Search (Classic)
```http
POST /linkedin-search/search/people
```

#### Companies Search (Classic)
```http
POST /linkedin-search/search/companies
```

#### Posts Search (Classic)
```http
POST /linkedin-search/search/posts
```

#### Jobs Search (Classic)
```http
POST /linkedin-search/search/jobs
```

#### Sales Navigator - People
```http
POST /linkedin-search/search/sales-navigator/people
```

#### Sales Navigator - Companies
```http
POST /linkedin-search/search/sales-navigator/companies
```

#### Recruiter - People
```http
POST /linkedin-search/search/recruiter/people
```

#### Search from URL
```http
POST /linkedin-search/search/url
```

#### Continue Search with Cursor
```http
POST /linkedin-search/search/continue
```

### Parameter Endpoints

#### Get Search Parameters
```http
GET /linkedin-search/parameters/{type}
```

#### Specific Parameter Types
```http
GET /linkedin-search/parameters/locations
GET /linkedin-search/parameters/industries
GET /linkedin-search/parameters/companies
GET /linkedin-search/parameters/schools
GET /linkedin-search/parameters/job-titles
GET /linkedin-search/parameters/skills
GET /linkedin-search/parameters/saved-searches
GET /linkedin-search/parameters/recent-searches
```

## Usage Examples

### Basic People Search

```typescript
import { LinkedInSearchService } from './services/linkedin-search.service';

// Search for software engineers in San Francisco
const searchRequest = {
  keywords: 'software engineer',
  location: ['101863742'], // San Francisco location ID
  industry: ['6'], // Technology industry ID
};

const results = await linkedInSearchService.searchPeople(
  searchRequest,
  'your_account_id',
  { limit: 10 }
);
```

### Sales Navigator Company Search

```typescript
// Search for tech companies with specific criteria
const salesNavRequest = {
  keywords: 'artificial intelligence',
  industry: {
    include: ['6'], // Technology industry
  },
  headcount: [
    { min: 201, max: 1000 }
  ],
  location: {
    include: ['101863742'], // San Francisco
  }
};

const results = await linkedInSearchService.searchCompaniesSalesNavigator(
  salesNavRequest,
  'your_account_id',
  { limit: 20 }
);
```

### Getting Search Parameters

```typescript
// Get location parameters
const locations = await linkedInSearchService.getLocationParameters(
  'your_account_id',
  'san francisco',
  10
);

// Get industry parameters
const industries = await linkedInSearchService.getIndustryParameters(
  'your_account_id',
  'technology',
  10
);
```

## Search Request Types

### LinkedIn Classic People Search

```typescript
interface LinkedInClassicPeopleSearchRequest {
  keywords?: string;
  industry?: string[];
  location?: string[];
  profile_language?: string[];
  network_distance?: (1 | 2 | 3)[];
  company?: string[];
  past_company?: string[];
  school?: string[];
  service?: string[];
  connections_of?: string[];
  followers_of?: string[];
  open_to?: ('proBono' | 'boardMember')[];
  advanced_keywords?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    company?: string;
    school?: string;
  };
}
```

### Sales Navigator People Search

```typescript
interface LinkedInSalesNavigatorPeopleSearchRequest {
  keywords?: string;
  last_viewed_at?: number;
  saved_search_id?: string;
  recent_search_id?: string;
  location?: {
    include?: string[];
    exclude?: string[];
  };
  industry?: {
    include?: string[];
    exclude?: string[];
  };
  company?: {
    include?: string[];
    exclude?: string[];
  };
  seniority?: {
    include?: LinkedInSeniorityType[];
    exclude?: LinkedInSeniorityType[];
  };
  // ... many more options
}
```

## Response Types

### Search Response

```typescript
interface LinkedInSearchResponse {
  object: 'LinkedinSearch';
  items: LinkedInSearchResult[];
  config: LinkedInSearchConfig;
  paging: LinkedInSearchPaging;
  cursor: string | null;
}
```

### People Search Result

```typescript
interface LinkedInPeopleSearchResult {
  object: 'SearchResult';
  type: 'PEOPLE';
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  headline: string;
  location: string;
  industry: string;
  current_positions: LinkedInCurrentPosition[];
  education: LinkedInEducation[];
  work_experience: LinkedInWorkExperience[];
  skills: LinkedInSkill[];
  // ... many more fields
}
```

## Error Handling

The module includes comprehensive error handling for various scenarios:

- **Authentication Errors**: Invalid API key or disconnected account
- **Permission Errors**: Insufficient permissions for the requested operation
- **Rate Limiting**: API rate limit exceeded
- **Network Errors**: Connection issues with the Unipile API

## Best Practices

1. **Parameter IDs**: Always use parameter IDs instead of raw text for better search accuracy
2. **Pagination**: Use cursor-based pagination for large result sets
3. **Rate Limiting**: Implement appropriate delays between requests
4. **Error Handling**: Always handle potential errors gracefully
5. **Caching**: Consider caching parameter lookups to reduce API calls

## Limitations

- **API Limits**: Subject to Unipile API rate limits
- **LinkedIn Restrictions**: Some features may require specific LinkedIn subscription levels
- **Account Status**: Requires active LinkedIn account connection through Unipile

## Support

For issues related to:
- **LinkedIn API**: Contact Unipile support
- **Module Integration**: Check the Twenty CRM documentation
- **Configuration**: Verify environment variables and API credentials
