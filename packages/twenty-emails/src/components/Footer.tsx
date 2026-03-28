import { Column, Row } from '@react-email/components';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

export const Footer = () => {
  return (
    <>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href="https://arxena.com/"
              value="Website"
              aria-label="Visit Arxena's website"
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://github.com/arxena/arxena"
              value="Github"
              aria-label="Visit Arxena's GitHub repository"
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://arxena.com/user-guide"
              value="User guide"
              aria-label="Read Arxena's user guide"
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://docs.arxena.com/"
              value="Developers"
              aria-label="Visit Arxena's developer documentation"
            />
          </ShadowText>
        </Column>
      </Row>
      {/* <ShadowText>
        Arxena.com
        <br />
        651 N Broad St, Suite 206
        <br />
        Middletown, New Castle, Delaware - 19709
      </ShadowText> */}
    </>
  );
};
