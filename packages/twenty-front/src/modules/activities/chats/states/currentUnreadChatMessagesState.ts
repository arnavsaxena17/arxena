import { createState } from "twenty-ui";

export const currentUnreadChatMessagesState = createState<number>({
  defaultValue: 0,
  key: "currentUnreadChatMessagesState",
});
