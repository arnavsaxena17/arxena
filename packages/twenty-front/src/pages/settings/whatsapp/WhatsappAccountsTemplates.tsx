/** @jsxImportSource @emotion/react */
// src/components/WhatsAppTemplateManager/index.tsx
import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Template, templateService } from './services/whatsapp-template.service';

// Styled Components
const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
  border: none;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return css`
          background-color: #3182ce;
          color: white;
          &:hover {
            background-color: #2c5282;
          }
        `;
      case 'danger':
        return css`
          background-color: #e53e3e;
          color: white;
          &:hover {
            background-color: #c53030;
          }
        `;
      default:
        return css`
          background-color: #edf2f7;
          color: #4a5568;
          &:hover {
            background-color: #e2e8f0;
          }
        `;
    }
  }}
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
`;

const CardHeader = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const CardTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
`;

const CardContent = styled.div`
  padding: 1.25rem;
`;

const CardFooter = styled.div`
  padding: 1rem 1.25rem;
  background-color: #f7fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const Badge = styled.span<{ status: Template['status'] }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;

  ${props => {
    switch (props.status) {
      case 'APPROVED':
        return css`
          background-color: #9ae6b4;
          color: #22543d;
        `;
      case 'PENDING':
        return css`
          background-color: #fbd38d;
          color: #744210;
        `;
      case 'REJECTED':
        return css`
          background-color: #feb2b2;
          color: #742a2a;
        `;
      default:
        return css`
          background-color: #e2e8f0;
          color: #4a5568;
        `;
    }
  }}
`;

const Modal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => (props.isOpen ? 'flex' : 'none')};
  justify-content: center;
  align-items: center;
  z-index: 50;
`;

const ComponentWrapper = styled.div`
  margin-bottom: 1rem;
`;

const ComponentLabel = styled.strong`
  display: block;
  font-size: 0.875rem;
  color: #4a5568;
  margin-bottom: 0.25rem;
`;

const ComponentText = styled.p`
  margin: 0;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #4a5568;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: white;

  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  }
`;

const Heading = styled.h2`
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 2rem;
  height: 2rem;
  border: 2px solid #e2e8f0;
  border-radius: 50%;
  border-top-color: #3182ce;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorMessage = styled.div`
  background-color: #fff5f5;
  color: #c53030;
  padding: 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  border: 1px solid #feb2b2;
`;

// Main Component
const WhatsAppTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Partial<Template>>({
    name: '',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: '',
        example: {
          body_text: [[]],
        },
      },
    ],
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templateService.getTemplates();
      setTemplates(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await templateService.createTemplate(formData as Template);
      setIsModalOpen(false);
      loadTemplates();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate?.id) return;

    try {
      await templateService.updateTemplate(selectedTemplate.id, selectedTemplate);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await templateService.deleteTemplate(id);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'UTILITY',
      language: 'en',
      components: [
        {
          type: 'BODY',
          text: '',
          example: {
            body_text: [[]],
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <Container
        css={css`
          display: flex;
          justify-content: center;
          align-items: center;
          height: 50vh;
        `}>
        <LoadingSpinner />
      </Container>
    );
  }
  console.log("templates:", templates)

  return (
    <Container>
      <Header>
        <Title>WhatsApp Templates</Title>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          Create Template
        </Button>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Grid>
        {templates.map(template => (
          <Card key={template.id}>
            <CardHeader>
              <HeaderContainer>
                <CardTitle>{template.name}</CardTitle>
                <Badge status={template.status}>{template.status}</Badge>
              </HeaderContainer>
            </CardHeader>

            <CardContent>
              {template.components.map((component, index) => (
                <ComponentWrapper key={index}>
                  <ComponentLabel>{component.type}:</ComponentLabel>
                  <ComponentText>{component.text}</ComponentText>
                </ComponentWrapper>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={() => setSelectedTemplate(template)}>Edit</Button>
              <Button variant="danger" onClick={() => template.id && handleDeleteTemplate(template.id)}>
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </Grid>

      <Modal isOpen={isModalOpen || !!selectedTemplate}>
        <ModalContent>
          <Heading>{selectedTemplate ? 'Edit Template' : 'Create Template'}</Heading>

          <Form onSubmit={selectedTemplate ? handleUpdateTemplate : handleCreateTemplate}>
            {!selectedTemplate && (
              <>
                <FormGroup>
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="template_name" required />
                </FormGroup>

                <FormGroup>
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        category: e.target.value as Template['category'],
                      })
                    }>
                    <option value="UTILITY">Utility</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </Select>
                </FormGroup>
              </>
            )}

            <FormGroup>
              <Label>Body Text</Label>
              <Textarea
                value={selectedTemplate?.components[0]?.text || formData.components?.[0]?.text}
                onChange={e => {
                  if (selectedTemplate) {
                    setSelectedTemplate({
                      ...selectedTemplate,
                      components: [{ ...selectedTemplate.components[0], text: e.target.value }],
                    });
                  } else {
                    setFormData({
                      ...formData,
                      components: [{ ...formData.components![0], text: e.target.value }],
                    });
                  }
                }}
                placeholder="Enter template body text"
                required
              />
            </FormGroup>

            <div
              css={css`
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
                margin-top: 1rem;
              `}>
              <Button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedTemplate(null);
                  resetForm();
                }}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {selectedTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </Form>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default WhatsAppTemplateManager;
