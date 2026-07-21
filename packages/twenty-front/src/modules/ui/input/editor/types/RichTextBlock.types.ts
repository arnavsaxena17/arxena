export type RichTextBlockContent = { text: string } | { link: string };

export type RichTextPartialBlock = {
  content?: RichTextBlockContent[] | null;
};
