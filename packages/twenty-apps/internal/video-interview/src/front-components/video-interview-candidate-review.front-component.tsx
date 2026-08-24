import { useCallback, useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';
import { Button } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';

export const CANDIDATE_REVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'video-interview-candidate-review',
  });

type ResponseRecord = {
  id: string;
  name?: string;
  transcript?: string;
  feedback?: string;
  completedResponse?: boolean;
};

const CandidateReview = () => {
  const selectedIds = useSelectedRecordIds();
  const candidateId = selectedIds[0];
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [draftFeedback, setDraftFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!candidateId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await new RestApiClient().get<{
        data?: ResponseRecord[];
      }>('/rest/videoInterviewResponses', {
        query: { filter: `candidateId[eq]:${candidateId}` },
      });

      const loaded = result?.data ?? [];
      setResponses(loaded);
      setDraftFeedback(
        Object.fromEntries(
          loaded.map((response) => [response.id, response.feedback ?? '']),
        ),
      );
    } catch {
      await enqueueSnackbar({
        message: 'Failed to load interview responses.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFeedback = async (responseId: string) => {
    try {
      await new RestApiClient().patch(
        `/rest/videoInterviewResponses/${responseId}`,
        { feedback: draftFeedback[responseId] ?? '' },
      );
      await enqueueSnackbar({
        message: 'Feedback saved.',
        variant: 'success',
      });
    } catch {
      await enqueueSnackbar({
        message: 'Failed to save feedback.',
        variant: 'error',
      });
    }
  };

  if (!candidateId) {
    return <div style={{ padding: 16 }}>Select a candidate to review responses.</div>;
  }

  if (isLoading) {
    return <div style={{ padding: 16 }}>Loading responses...</div>;
  }

  if (responses.length === 0) {
    return <div style={{ padding: 16 }}>No video interview responses yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <H2Title title="Video interview responses" />
      {responses.map((response) => (
        <div
          key={response.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong>{response.name || 'Response'}</strong>
          <div>{response.completedResponse ? 'Completed' : 'In progress'}</div>
          <div>
            <div>Transcript</div>
            <p>{response.transcript || 'No transcript yet.'}</p>
          </div>
          <label>
            Feedback
            <textarea
              value={draftFeedback[response.id] ?? ''}
              onChange={(event) =>
                setDraftFeedback((current) => ({
                  ...current,
                  [response.id]: event.target.value,
                }))
              }
              style={{ display: 'block', width: '100%', minHeight: 72, marginTop: 4 }}
            />
          </label>
          <Button
            title="Save feedback"
            onClick={() => void saveFeedback(response.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CANDIDATE_REVIEW_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'video-interview-candidate-review',
  description: 'Review candidate video interview transcripts and feedback',
  component: CandidateReview,
});
