import { ContentContainer } from './_components/ui/layout/ContentContainer';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <ContentContainer>
      <iframe
        src="https://detailed-elements-177735.framer.app/"
        title="Twenty Homepage"
        style={{
          width: '100vw',

          height: '100vh',
          border: 'none',
          overflow: 'hidden',
          marginTop: '0vh',
        }}
      />
    </ContentContainer>
  );
}
