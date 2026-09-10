import {
  formatWhatsappFlowDetailsBody,
  formatWhatsappTemplateDetailsParam,
  formatWhatsappUnipileDetailsText,
  splitWhatsappStructuredTemplateDetails,
} from '../format-workflow-form-whatsapp-text.util';

describe('format-workflow-form-whatsapp-text.util', () => {
  const messyDetails =
    'Contact: Arvind Pathak | Title: | Company: Dangote Cement | Draft: Thanks for the reply — happy to meet. | Last inbound: {"first":{"name":"LINKEDIN","message":"Thanks, I am interested. Can we talk next week?"}}';

  it('should keep template params single-line and Meta-safe', () => {
    const formatted = formatWhatsappTemplateDetailsParam(messyDetails);

    expect(formatted.includes('\n')).toBe(false);
    expect(formatted.includes('\r')).toBe(false);
    expect(formatted).toContain('Contact: Arvind Pathak');
    expect(formatted).toContain('Company: Dangote Cement');
    expect(formatted).toContain(' · ');
    expect(formatted.includes('Title:')).toBe(false);
    expect(formatted).toContain(
      'Last inbound: Thanks, I am interested. Can we talk next week?',
    );
    expect(formatted.includes('"messageObj"')).toBe(false);
  });

  it('should use newlines for Flow and Unipile bodies', () => {
    const flowBody = formatWhatsappFlowDetailsBody(messyDetails);
    const unipileBody = formatWhatsappUnipileDetailsText(messyDetails);

    expect(flowBody.split('\n').length).toBeGreaterThan(1);
    expect(unipileBody.split('\n').length).toBeGreaterThan(1);
    expect(flowBody).toContain('Draft: Thanks for the reply — happy to meet.');
    expect(unipileBody).toContain(
      'Last inbound: Thanks, I am interested. Can we talk next week?',
    );
  });

  it('should split details into Contact / Company / Draft for v3 templates', () => {
    expect(splitWhatsappStructuredTemplateDetails(messyDetails)).toEqual({
      contact: 'Arvind Pathak',
      company:
        'Dangote Cement · Inbound: Thanks, I am interested. Can we talk next week?',
      draft: 'Thanks for the reply — happy to meet.',
    });
  });
});
