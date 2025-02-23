interface TemplateComponent {
    type: string;
    text: string;
    format?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url: string;
    }>;
  }
  
  interface Template {
    name: string;
    components: TemplateComponent[];
    language: string;
    status: string;
    category: string;
    id: string;
  }
  
  export class MessageGenerator {
    private templates: Map<string, Template>;
  
    constructor(templatesData: any) {
      this.templates = new Map();
      this.initializeTemplates(templatesData);
    }
  
    private initializeTemplates(templatesData: any) {
      templatesData.templates.forEach((template: Template) => {
        this.templates.set(template.name, template);
      });
    }
  
    public generateMessage(templateName: string, data: Record<string, any>): string {
      const template = this.templates.get(templateName);
      
      if (!template) {
        throw new Error(`Template "${templateName}" not found`);
      }
  
      return this.processTemplate(template, data);
    }
  
    private processTemplate(template: Template, data: Record<string, any>): string {
      let message = '';
  
      template.components.forEach(component => {
        switch (component.type) {
          case 'HEADER':
            message += `${this.replaceParameters(component.text, data)}\n\n`;
            break;
          
          case 'BODY':
            message += `${this.replaceParameters(component.text, data)}\n`;
            break;
          
          case 'FOOTER':
            message += `\n${this.replaceParameters(component.text, data)}`;
            break;
        }
      });
  
      return message.trim();
    }
  
    private replaceParameters(text: string, data: Record<string, any>): string {
      // Handle numbered parameters ({{1}}, {{2}}, etc.)
      const numberedParamRegex = /{{(\d+)}}/g;
      text = text.replace(numberedParamRegex, (match, num) => {
        const key = `param${num}`;
        return data[key] || match;
      });
  
      // Handle named parameters
      const namedParamRegex = /{{(\w+)}}/g;
      text = text.replace(namedParamRegex, (match, key) => {
        return data[key] || match;
      });
  
      return text;
    }
  }
  
  // Usage example:
//   const messageGenerator = new MessageGenerator(templatesJson);
  
//   // Example using the 'application' template
//   const message = messageGenerator.generateMessage('application', {
//     param1: 'John', // candidateFirstName
//     param2: 'Alice', // recruiterName
//     param3: 'Director', // recruiterJobTitle
//     param4: 'Arxena', // recruiterCompanyName
//     param5: 'a global recruitment firm', // recruiterCompanyDescription
//     param6: 'MS23', // jobCode
//     param7: 'Senior Developer', // jobPositionName
//     param8: 'Tech Corp', // companyName
//     param9: 'New York' // jobLocation
//   });