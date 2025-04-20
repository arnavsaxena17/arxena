import {
    AnimatedPlaceholder,
    AnimatedPlaceholderEmptyContainer,
    AnimatedPlaceholderEmptySubTitle,
    AnimatedPlaceholderEmptyTextContainer,
    AnimatedPlaceholderEmptyTitle,
    AnimatedPlaceholderType,
    Button,
    IconComponent,
} from 'twenty-ui';

type EmptyJobStateProps = {
  animatedPlaceholderType: AnimatedPlaceholderType;
  title: string;
  subTitle: string;
  ButtonIcon: IconComponent;
  buttonTitle: string;
  onClick: () => void;
};

export const EmptyJobState = (props: EmptyJobStateProps) => {
  return (
    <AnimatedPlaceholderEmptyContainer>
      <AnimatedPlaceholder type={props.animatedPlaceholderType} />
      <AnimatedPlaceholderEmptyTextContainer>
        <AnimatedPlaceholderEmptyTitle>
          {props.title}
        </AnimatedPlaceholderEmptyTitle>
        <AnimatedPlaceholderEmptySubTitle>
          {props.subTitle}
        </AnimatedPlaceholderEmptySubTitle>
      </AnimatedPlaceholderEmptyTextContainer>
      <Button
        Icon={props.ButtonIcon}
        title={props.buttonTitle}
        variant={'secondary'}
        onClick={props.onClick}
      />
    </AnimatedPlaceholderEmptyContainer>
  );
}; 