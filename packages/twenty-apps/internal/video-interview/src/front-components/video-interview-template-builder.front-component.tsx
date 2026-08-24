import { useCallback, useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';
import { Button } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const TEMPLATE_BUILDER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'video-interview-template-builder',
  });

type TemplateRecord = {
  id: string;
  name?: string;
  introduction?: string;
  instructions?: string;
};

type QuestionRecord = {
  id: string;
  name?: string;
  questionValue?: string;
  timeLimit?: number | null;
  questionType?: string;
  answerType?: string;
  retakes?: string;
};

const TemplateBuilder = () => {
  const selectedIds = useSelectedRecordIds();
  const projectId = selectedIds[0];
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<TemplateRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const client = new RestApiClient();

    try {
      const templatesResponse = await client.get<{
        data?: TemplateRecord[];
      }>(`/rest/videoInterviewTemplates`, {
        query: { filter: `projectId[eq]:${projectId}` },
      });

      const existing = templatesResponse?.data?.[0];
      let current = existing;

      if (!current) {
        current = await client.post<TemplateRecord>(
          '/rest/videoInterviewTemplates',
          {
            name: 'Video interview template',
            projectId,
            introduction: '',
            instructions: '',
          },
        );
      }

      setTemplate(current ?? null);

      if (current?.id) {
        const questionsResponse = await client.get<{
          data?: QuestionRecord[];
        }>(`/rest/videoInterviewQuestions`, {
          query: { filter: `videoInterviewTemplateId[eq]:${current.id}` },
        });

        setQuestions(questionsResponse?.data ?? []);
      }
    } catch {
      await enqueueSnackbar({
        message: 'Failed to load video interview template.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTemplate = async () => {
    if (!template?.id) {
      return;
    }

    setIsSaving(true);
    try {
      await new RestApiClient().patch(
        `/rest/videoInterviewTemplates/${template.id}`,
        {
          name: template.name,
          introduction: template.introduction,
          instructions: template.instructions,
        },
      );
      await enqueueSnackbar({
        message: 'Template saved.',
        variant: 'success',
      });
    } catch {
      await enqueueSnackbar({
        message: 'Failed to save template.',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestion = async () => {
    if (!template?.id || newQuestion.trim().length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await new RestApiClient().post<QuestionRecord>(
        '/rest/videoInterviewQuestions',
        {
          name: newQuestion.trim(),
          questionValue: newQuestion.trim(),
          videoInterviewTemplateId: template.id,
          questionType: 'VIDEO',
          answerType: 'VIDEO',
          retakes: 'ONE',
          timeLimit: 60,
        },
      );

      setQuestions((current) => [...current, created]);
      setNewQuestion('');
    } catch {
      await enqueueSnackbar({
        message: 'Failed to add question.',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!projectId) {
    return <div style={{ padding: 16 }}>Select a project to edit its template.</div>;
  }

  if (isLoading) {
    return <div style={{ padding: 16 }}>Loading template...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <H2Title title="Video interview template" />
      <label>
        Name
        <input
          value={template?.name ?? ''}
          onChange={(event) =>
            setTemplate((current) =>
              current ? { ...current, name: event.target.value } : current,
            )
          }
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>
      <label>
        Introduction
        <textarea
          value={template?.introduction ?? ''}
          onChange={(event) =>
            setTemplate((current) =>
              current
                ? { ...current, introduction: event.target.value }
                : current,
            )
          }
          style={{ display: 'block', width: '100%', minHeight: 80, marginTop: 4 }}
        />
      </label>
      <label>
        Instructions
        <textarea
          value={template?.instructions ?? ''}
          onChange={(event) =>
            setTemplate((current) =>
              current
                ? { ...current, instructions: event.target.value }
                : current,
            )
          }
          style={{ display: 'block', width: '100%', minHeight: 80, marginTop: 4 }}
        />
      </label>
      <Button
        title={isSaving ? 'Saving...' : 'Save template'}
        onClick={() => void saveTemplate()}
        disabled={isSaving}
      />
      <H2Title title="Questions" />
      <ul>
        {questions.map((question) => (
          <li key={question.id}>{question.questionValue || question.name}</li>
        ))}
      </ul>
      {questions.length === 0 && <div>No questions yet.</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newQuestion}
          onChange={(event) => setNewQuestion(event.target.value)}
          placeholder="Add a question"
          style={{ flex: 1 }}
        />
        <Button
          title="Add"
          onClick={() => void addQuestion()}
          disabled={isSaving || newQuestion.trim().length === 0}
        />
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TEMPLATE_BUILDER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'video-interview-template-builder',
  description: 'Create and edit the video interview template for a project',
  component: TemplateBuilder,
});
