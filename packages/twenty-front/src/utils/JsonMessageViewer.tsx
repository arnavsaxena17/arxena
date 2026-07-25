type JsonMessageViewerProps = {
  content: string;
  label?: string;
};

export const JsonMessageViewer = ({
  content,
  label = 'JSON',
}: JsonMessageViewerProps) => {
  let formattedContent = content;
  try {
    formattedContent = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Keep raw content when it is not valid JSON
  }

  return (
    <div>
      {label ? <div>{label}</div> : null}
      <pre>{formattedContent}</pre>
    </div>
  );
};
