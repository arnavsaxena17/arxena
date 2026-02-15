'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { Theme } from '@/app/_components/ui/theme/theme';

const StyledSection = styled.section`
  padding: ${Theme.spacing(12)} ${Theme.spacing(6)};
  max-width: 480px;
  margin: 0 auto;
  @media (max-width: 809px) {
    padding: ${Theme.spacing(8)} ${Theme.spacing(4)};
  }
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${Theme.spacing(4)};
`;

const StyledLabel = styled.label`
  font-size: ${Theme.font.size.sm};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  display: block;
  margin-bottom: ${Theme.spacing(1)};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${Theme.spacing(2)} ${Theme.spacing(3)};
  font-size: ${Theme.font.size.base};
  border: 1px solid ${Theme.color.gray20};
  border-radius: ${Theme.border.radius.sm};
  color: ${Theme.text.color.primary};
  background: ${Theme.color.white};
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: ${Theme.color.gray60};
  }
`;

const StyledButton = styled.button`
  padding: ${Theme.spacing(3)} ${Theme.spacing(6)};
  background-color: ${Theme.color.gray60};
  color: ${Theme.color.white};
  font-weight: ${Theme.font.weight.medium};
  font-size: ${Theme.font.size.base};
  border: none;
  border-radius: ${Theme.border.radius.md};
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledSuccess = styled.div`
  padding: ${Theme.spacing(4)};
  background: ${Theme.color.gray10};
  border-radius: ${Theme.border.radius.md};
  font-size: ${Theme.font.size.base};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
`;

const StyledError = styled.div`
  padding: ${Theme.spacing(2)};
  font-size: ${Theme.font.size.sm};
  color: #b33;
`;

export function LandingLeadForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [requestedCompany, setRequestedCompany] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    try {
      const res = await fetch('/api/org-chart-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          requestedCompany,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(
          data.message || 'Something went wrong. Please try again.',
        );
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  }

  if (status === 'success') {
    const displayCompany =
      requestedCompany?.trim() || company?.trim() || 'your requested company';
    return (
      <StyledSection id="lead-form">
        <StyledSuccess>
          We'll generate {displayCompany}'s org chart and send it within 24
          hours.
        </StyledSuccess>
      </StyledSection>
    );
  }

  return (
    <StyledSection id="lead-form">
      <StyledForm onSubmit={handleSubmit}>
        <div>
          <StyledLabel htmlFor="name">Name</StyledLabel>
          <StyledInput
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
        <div>
          <StyledLabel htmlFor="email">Email</StyledLabel>
          <StyledInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div>
          <StyledLabel htmlFor="company">Company</StyledLabel>
          <StyledInput
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company"
            autoComplete="organization"
          />
        </div>
        <div>
          <StyledLabel htmlFor="requestedCompany">
            Which company org chart do you want to see?
          </StyledLabel>
          <StyledInput
            id="requestedCompany"
            type="text"
            value={requestedCompany}
            onChange={(e) => setRequestedCompany(e.target.value)}
            required
            placeholder="e.g. Google, Acme Inc"
          />
        </div>
        {status === 'error' && (
          <StyledError role="alert">{errorMessage}</StyledError>
        )}
        <StyledButton type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Generate org chart'}
        </StyledButton>
      </StyledForm>
    </StyledSection>
  );
}
