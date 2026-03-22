export const ANTHROPIC_TOOL_RECRUITER = {
  name: 'generate_recruiter_queries',
  description: 'Generate LinkedIn Recruiter People Search queries',
  input_schema: {
    type: 'object' as const,
    properties: {
      searchRequests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            api:      { type: 'string', enum: ['recruiter'] },
            category: { type: 'string', enum: ['people'] },
            keywords: { type: ['string', 'null'] as any },
            role: {
              type: ['array', 'null'] as any,
              items: {
                type: 'object',
                properties: {
                  keywords: { type: 'string' },
                  priority: { type: 'string', enum: ['MUST_HAVE', 'CAN_HAVE', 'DOESNT_HAVE'] },
                  scope:    { type: 'string', enum: ['CURRENT_OR_PAST', 'CURRENT', 'PAST'] },
                },
                required: ['keywords', 'priority', 'scope'],
              },
            },
            // location: {
            //   type: ['array', 'null'] as any,
            //   items: {
            //     type: 'object',
            //     properties: {
            //       id:       { type: 'string' },
            //       priority: { type: 'string', enum: ['MUST_HAVE', 'CAN_HAVE'] },
            //       scope:    { type: 'string', enum: ['CURRENT', 'CURRENT_OR_OPEN_TO_RELOCATE'] },
            //       title:    { type: ['string', 'null'] as any },
            //     },
            //     required: ['id', 'priority', 'scope', 'title'],
            //   },
            // },
            company: {
              type: ['array', 'null'] as any,
              items: {
                type: 'object',
                properties: {
                  keywords: { type: 'string' },
                  priority: { type: 'string', enum: ['MUST_HAVE', 'CAN_HAVE'] },
                  scope:    { type: 'string', enum: ['CURRENT_OR_PAST', 'CURRENT', 'PAST'] },
                },
                required: ['keywords', 'priority', 'scope'],
              },
            },
          },
          required: ['api', 'category'],
        },
      },
    },
    required: ['searchRequests'],
  },
};

export const ANTHROPIC_TOOL_SALES_NAV = {
  name: 'generate_sales_nav_queries',
  description: 'Generate LinkedIn Sales Navigator People Search queries',
  input_schema: {
    type: 'object' as const,
    properties: {
      searchRequests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            api:      { type: 'string', enum: ['sales_navigator'] },
            category: { type: 'string', enum: ['people'] },
            keywords: { type: ['string', 'null'] as any },
            role: {
              type: ['object', 'null'] as any,
              properties: {
                include: { type: ['array', 'null'] as any, items: { type: 'string' } },
                exclude: { type: ['array', 'null'] as any, items: { type: 'string' } },
              },
            },
            location: {
              type: ['object', 'null'] as any,
              properties: {
                include: { type: ['array', 'null'] as any, items: { type: 'string' } },
                exclude: { type: ['array', 'null'] as any, items: { type: 'string' } },
              },
            },
            industry: {
              type: ['object', 'null'] as any,
              properties: {
                include: { type: ['array', 'null'] as any, items: { type: 'string' } },
                exclude: { type: ['array', 'null'] as any, items: { type: 'string' } },
              },
            },
            company: {
              type: ['object', 'null'] as any,
              properties: {
                include: { type: ['array', 'null'] as any, items: { type: 'string' } },
                exclude: { type: ['array', 'null'] as any, items: { type: 'string' } },
              },
            },
          },
          required: ['api', 'category'],
        },
      },
    },
    required: ['searchRequests'],
  },
};

export const ANTHROPIC_TOOL_CLASSIC = {
  name: 'generate_classic_queries',
  description: 'Generate LinkedIn Classic People Search queries',
  input_schema: {
    type: 'object' as const,
    properties: {
      searchRequests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            api:          { type: 'string', enum: ['classic'] },
            category:     { type: 'string', enum: ['people'] },
            keywords:     { type: ['string', 'null'] as any },
            industry:     { type: ['array', 'null'] as any, items: { type: 'string' } },
            location:     { type: ['array', 'null'] as any, items: { type: 'string' } },
            company:      { type: ['array', 'null'] as any, items: { type: 'string' } },
            past_company: { type: ['array', 'null'] as any, items: { type: 'string' } },
            school:       { type: ['array', 'null'] as any, items: { type: 'string' } },
            advanced_keywords: {
              type: ['object', 'null'] as any,
              properties: {
                title:   { type: ['string', 'null'] as any },
                company: { type: ['string', 'null'] as any },
                school:  { type: ['string', 'null'] as any },
              },
            },
          },
          required: ['api', 'category'],
        },
      },
    },
    required: ['searchRequests'],
  },
};
